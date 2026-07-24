import { z } from "zod";
import { DependencyError } from "../../http/errors.js";

const GitShaSchema = z.string().regex(/^[0-9a-f]{40}$/i);
const GitHubTimestampSchema = z.string().datetime({ offset: true });

export const GitHubWorkflowRunSchema = z.object({
  id: z.number(),
  workflow_id: z.number().optional(),
  name: z.string(),
  head_sha: GitShaSchema,
  head_branch: z.string().nullable(),
  status: z.string(),
  conclusion: z.string().nullable(),
  html_url: z.string().url(),
  created_at: GitHubTimestampSchema,
  updated_at: GitHubTimestampSchema,
  run_started_at: GitHubTimestampSchema.nullable().optional(),
});

export const GitHubJobSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.string(),
  conclusion: z.string().nullable(),
  started_at: GitHubTimestampSchema.nullable(),
  completed_at: GitHubTimestampSchema.nullable(),
  html_url: z.string().url(),
  steps: z
    .array(
      z.object({
        name: z.string(),
        number: z.number(),
        status: z.string(),
        conclusion: z.string().nullable(),
        started_at: GitHubTimestampSchema.nullable(),
        completed_at: GitHubTimestampSchema.nullable(),
      }),
    )
    .optional()
    .default([]),
});

export const GitHubCommitSchema = z.object({
  sha: GitShaSchema,
  commit: z.object({
    message: z.string(),
    author: z.object({
      date: GitHubTimestampSchema.nullable(),
    }),
  }),
});

export type GitHubWorkflowRun = z.infer<typeof GitHubWorkflowRunSchema>;
export type GitHubJob = z.infer<typeof GitHubJobSchema>;
export type GitHubCommit = z.infer<typeof GitHubCommitSchema>;

export interface GitHubClientOptions {
  token?: string;
  repository: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  sleepImpl?: (milliseconds: number) => Promise<void>;
  randomImpl?: () => number;
  maxPages?: number;
  maxItems?: number;
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
  private readonly sleepImpl: (milliseconds: number) => Promise<void>;
  private readonly randomImpl: () => number;
  private readonly maxPages: number;
  private readonly maxItems: number;

  constructor(private readonly options: GitHubClientOptions) {
    const [owner, repo] = options.repository.split("/");
    if (!owner || !repo) {
      throw new Error("GITHUB_REPOSITORY must be owner/name");
    }
    this.owner = owner;
    this.repo = repo;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? "https://api.github.com";
    this.sleepImpl = options.sleepImpl ?? ((milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.randomImpl = options.randomImpl ?? Math.random;
    this.maxPages = options.maxPages ?? 20;
    this.maxItems = options.maxItems ?? 2_000;
  }

  private async request<T>(
    pathOrUrl: string,
    schema: z.ZodType<T>,
  ): Promise<{ data: T; nextUrl: string | null }> {
    const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${this.baseUrl}${pathOrUrl}`;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const headers: Record<string, string> = {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        };
        if (this.options.token) {
          headers.Authorization = `Bearer ${this.options.token}`;
        }
        const response = await this.fetchImpl(url, {
          headers,
          signal: controller.signal,
        });

        if (response.status === 429 || response.status >= 500) {
          lastError = new GitHubClientError(
            `GitHub API error ${response.status}`,
            response.status,
            true,
          );
          if (attempt < 3) {
            const retryAfter = response.headers.get("retry-after");
            const serverDelay = retryAfter ? Number(retryAfter) * 1_000 : Number.NaN;
            const exponentialDelay = Math.min(250 * (2 ** attempt), 2_000);
            const delay = Number.isFinite(serverDelay)
              ? Math.min(serverDelay, 10_000)
              : exponentialDelay + Math.floor(this.randomImpl() * 100);
            await this.sleepImpl(delay);
          }
          continue;
        }

        if (!response.ok) {
          throw new GitHubClientError(
            `GitHub API error ${response.status}`,
            response.status,
          );
        }

        const parsed = schema.safeParse(await response.json());
        if (!parsed.success) {
          throw new GitHubClientError("GitHub returned an invalid response", response.status);
        }
        return {
          data: parsed.data,
          nextUrl: parseNextLink(response.headers.get("link")),
        };
      } catch (error) {
        if (error instanceof GitHubClientError) {
          lastError = error;
          if (error.retryable && attempt < 3) {
            continue;
          }
          throw error;
        }
        lastError = error instanceof Error ? error : new Error("GitHub request failed");
        if (attempt < 3) {
          const delay = Math.min(250 * (2 ** attempt), 2_000) + Math.floor(this.randomImpl() * 100);
          await this.sleepImpl(delay);
          continue;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new DependencyError(
      "github_unavailable",
      lastError?.message ?? "GitHub request failed",
      true,
    );
  }

  private async requestAll<T>(
    path: string,
    extract: (payload: unknown) => T[],
    schema: z.ZodType<unknown>,
  ): Promise<T[]> {
    const items: T[] = [];
    let nextUrl: string | null = path;
    let page = 0;
    while (nextUrl && page < this.maxPages && items.length < this.maxItems) {
      const response: { data: unknown; nextUrl: string | null } =
        await this.request(nextUrl, schema);
      items.push(...extract(response.data));
      nextUrl = response.nextUrl;
      page += 1;
    }
    if (nextUrl) {
      throw new GitHubClientError("GitHub pagination safety limit exceeded");
    }
    return items.slice(0, this.maxItems);
  }

  async getWorkflowRun(runId: number) {
    const response = await this.request(
      `/repos/${this.owner}/${this.repo}/actions/runs/${runId}`,
      GitHubWorkflowRunSchema,
    );
    return response.data;
  }

  async getWorkflowJobs(runId: number) {
    const schema = z.object({ jobs: z.array(GitHubJobSchema) });
    const jobs = await this.requestAll(
      `/repos/${this.owner}/${this.repo}/actions/runs/${runId}/jobs?per_page=100`,
      (payload) => schema.parse(payload).jobs,
      schema,
    );
    return { jobs };
  }

  async getCommit(sha: string) {
    const response = await this.request(
      `/repos/${this.owner}/${this.repo}/commits/${sha}`,
      GitHubCommitSchema,
    );
    return response.data;
  }

  async listWorkflowRuns(input: { branch: string; status?: string; perPage?: number }) {
    const params = new URLSearchParams({
      branch: input.branch,
      per_page: String(input.perPage ?? 30),
    });
    if (input.status) {
      params.set("status", input.status);
    }
    const schema = z.object({ workflow_runs: z.array(GitHubWorkflowRunSchema) });
    const workflowRuns = await this.requestAll(
      `/repos/${this.owner}/${this.repo}/actions/runs?${params.toString()}`,
      (payload) => schema.parse(payload).workflow_runs,
      schema,
    );
    return { workflow_runs: workflowRuns };
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.request(
        "/rate_limit",
        z.object({ resources: z.record(z.string(), z.unknown()).optional() }).passthrough(),
      );
      return Boolean(response.data);
    } catch {
      return false;
    }
  }
}

function parseNextLink(value: string | null): string | null {
  if (!value) {
    return null;
  }
  for (const entry of value.split(",")) {
    const match = entry.trim().match(/^<([^>]+)>;\s*rel="([^"]+)"$/);
    if (match?.[2] === "next") {
      return match[1];
    }
  }
  return null;
}
