import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Repositories } from "../../db/repositories/index.js";

export interface RecordDeploymentInput {
  repository: string;
  commitSha: string;
  serviceName: string;
  environmentName: string;
  role: "baseline" | "candidate" | "recovery";
  status: "started" | "succeeded" | "failed";
  deployedAt: string;
}

export class DeploymentService {
  constructor(
    private readonly repos: Repositories,
    private readonly healthCheck: (url: string) => Promise<boolean> = defaultHealthCheck,
    private readonly versionVisible: (serviceName: string, version: string) => Promise<boolean> = async () => true,
    private readonly ensureChange?: (commitSha: string) => Promise<void>,
  ) {}

  async recordDeployment(input: RecordDeploymentInput) {
    let change = this.repos.getChangeBySha(input.commitSha);
    if (!change && this.ensureChange) {
      await this.ensureChange(input.commitSha);
      change = this.repos.getChangeBySha(input.commitSha);
    }
    if (!change) {
      throw new Error("Change must exist before deployment can be recorded");
    }

    if (input.role === "baseline" && input.status === "succeeded") {
      const existing = this.repos.getBaselineDeployment(
        input.serviceName,
        input.environmentName,
      );
      if (existing) {
        throw new Error("Baseline deployment already exists for service/environment");
      }
    }

    if (input.status === "succeeded") {
      const healthy = await this.healthCheck("http://127.0.0.1:8081/actuator/health");
      if (!healthy) {
        throw new Error("LMS health check failed");
      }
      const visible = await this.versionVisible(input.serviceName, input.commitSha);
      if (!visible) {
        throw new Error("Deployed service.version is not visible in telemetry yet");
      }
    }

    const deploymentId = `dep_${input.commitSha.slice(0, 12)}_${input.role}`;
    this.repos.insertDeployment({
      id: deploymentId,
      change_id: change.id,
      service_name: input.serviceName,
      environment_name: input.environmentName,
      role: input.role,
      status: input.status,
      deployed_at: input.deployedAt,
      emitted_trace_id: null,
      created_at: new Date().toISOString(),
    });

    return { deploymentId, evaluationReadyAt: input.deployedAt };
  }
}

async function defaultHealthCheck(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    return response.ok;
  } catch {
    return false;
  }
}

export function ensureDatabaseDirectory(databasePath: string) {
  mkdirSync(dirname(databasePath), { recursive: true });
}
