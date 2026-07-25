#!/usr/bin/env bash
set -euo pipefail

API_IMAGE="${1:-greenlight-api:0.1.0}"
WORKER_IMAGE="${2:-greenlight-worker:0.1.0}"
WEB_IMAGE="${3:-greenlight-web:0.1.0}"

fail() {
  echo "runtime-image-contract: error: $*" >&2
  exit 1
}

[[ "$(docker image inspect "$API_IMAGE" --format '{{.Config.User}}')" == "65532" ]] ||
  fail "${API_IMAGE} must run as distroless nonroot UID 65532"
[[ "$(docker image inspect "$WORKER_IMAGE" --format '{{.Config.User}}')" == "65532" ]] ||
  fail "${WORKER_IMAGE} must run as distroless nonroot UID 65532"
[[ "$(docker image inspect "$WEB_IMAGE" --format '{{.Config.User}}')" == "101" ]] ||
  fail "${WEB_IMAGE} must run as UID 101"

verify_node_image() {
  local image="$1"
  docker run --rm --entrypoint /nodejs/bin/node "$image" --input-type=module -e '
    import { existsSync } from "node:fs";
    for (const manager of [
      "/bin/sh",
      "/usr/bin/npm",
      "/usr/local/bin/npm",
      "/usr/local/bin/npx",
      "/usr/local/bin/corepack",
    ]) {
      if (existsSync(manager)) {
        throw new Error(`runtime image unexpectedly contains ${manager}`);
      }
    }
    for (const required of ["fastify", "pg", "@greenlight/shared"]) {
      import.meta.resolve(required);
    }
    for (const forbidden of [
      "react",
      "react-router",
      "react-router-dom",
      "@modelcontextprotocol/sdk",
      "typescript",
      "vitest",
    ]) {
      try {
        import.meta.resolve(forbidden);
        throw new Error(`runtime image unexpectedly contains ${forbidden}`);
      } catch (error) {
        if (
          !["ERR_MODULE_NOT_FOUND", "ERR_PACKAGE_PATH_NOT_EXPORTED"].includes(
            error?.code,
          )
        ) {
          throw error;
        }
      }
    }
  '
}

verify_node_image "$API_IMAGE"
verify_node_image "$WORKER_IMAGE"

echo "runtime-image-contract: non-root identities and workspace-scoped dependencies verified"
