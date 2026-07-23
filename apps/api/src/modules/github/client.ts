import { z } from "zod";

export const GitHubWorkflowRunSchema = z.object({
  id: z.number(),
  name: z.string(),
  head_sha: z.string(),
  head_branch: z.string().nullable(),
  status: z.string(),
  conclusion: z.string().nullable(),
  html_url: z.string().url(),
  created_at: z.string(),
  updated_at: z.string(),
  run_started_at: z.string().nullable().optional(),
});

export const GitHubJobSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.string(),
  conclusion: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  html_url: z.string().url(),
  steps: z
    .array(
      z.object({
        name: z.string(),
        number: z.number(),
        status: z.string(),
        conclusion: z.string().nullable(),
        started_at: z.string().nullable(),
        completed_at: z.string().nullable(),
      }),
    )
    .optional()
    .default([]),
});

export const GitHubCommitSchema = z.object({
  sha: z.string(),
  commit: z.object({
    message: z.string(),
    author: z.object({
      date: z.string().nullable(),
    }),
  }),
});

export type GitHubWorkflowRun = z.infer<typeof GitHubWorkflowRunSchema>;
export type GitHubJob = z.infer<typeof GitHubJobSchema>;
export type GitHubCommit = z.infer<typeof GitHubCommitSchema>;

export interface GitHubClientOptions {
  token: string;
  repository: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export class GitHubClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "GitHubClientError";
  }
}

export class GitHubClient {
  private readonly owner: string;
  private readonly repo: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly options: GitHubClientOptions) {
    const [owner, repo] = options.repository.split("/");
    if (!owner || !repo) {
      throw new Error("GITHUB_REPOSITORY must be owner/name");
    }
    this.owner = owner;
    this.repo = repo;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? "https://api.github.com";
  }

  private async request<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await this.fetchImpl(url, {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${this.options.token}`,
            "X-GitHub-Api-Version": "2022-11-28",
          },
          signal: controller.signal,
        });

        if (response.status === 429 || response.status >= 500) {
          lastError = new GitHubClientError(
            `GitHub API error ${response.status}`,
            response.status,
            true,
          );
          continue;
        }

        if (!response.ok) {
          throw new GitHubClientError(
            `GitHub API error ${response.status}`,
            response.status,
          );
        }

        return schema.parse(await response.json());
      } catch (error) {
        if (error instanceof GitHubClientError) {
          lastError = error;
          if (error.retryable && attempt === 0) {
            continue;
          }
          throw error;
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new GitHubClientError("GitHub request failed");
  }

  getWorkflowRun(runId: number) {
    return this.request(
      `/repos/${this.owner}/${this.repo}/actions/runs/${runId}`,
      GitHubWorkflowRunSchema,
    );
  }

  getWorkflowJobs(runId: number) {
    return this.request(
      `/repos/${this.owner}/${this.repo}/actions/runs/${runId}/jobs`,
      z.object({ jobs: z.array(GitHubJobSchema) }),
    );
  }

  getCommit(sha: string) {
    return this.request(
      `/repos/${this.owner}/${this.repo}/commits/${sha}`,
      GitHubCommitSchema,
    );
  }

  listWorkflowRuns(input: { branch: string; status?: string; perPage?: number }) {
    const params = new URLSearchParams({
      branch: input.branch,
      per_page: String(input.perPage ?? 30),
    });
    if (input.status) {
      params.set("status", input.status);
    }
    return this.request(
      `/repos/${this.owner}/${this.repo}/actions/runs?${params.toString()}`,
      z.object({ workflow_runs: z.array(GitHubWorkflowRunSchema) }),
    );
  }
}
