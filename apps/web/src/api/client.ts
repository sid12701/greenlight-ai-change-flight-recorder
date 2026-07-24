import {
  ChangeListResponseSchema,
  ChangeReceiptSchema,
  type ChangeListResponse,
  type ChangeReceipt,
} from "@greenlight/shared";
import type { z } from "zod";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:4000";

/**
 * Distinguishes the failure modes the UI must render differently.
 *
 * A single "request failed" collapses "you are not signed in", "this change
 * does not exist" and "the API is degraded" into one indistinguishable state.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: "unauthorized" | "forbidden" | "not_found" | "unavailable" | "unknown",
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static fromStatus(status: number): ApiError {
    switch (status) {
      case 401:
        return new ApiError(status, "unauthorized", "Sign-in is required to read changes");
      case 403:
        return new ApiError(status, "forbidden", "This session is not allowed to read changes");
      case 404:
        return new ApiError(status, "not_found", "The requested change was not found");
      case 502:
      case 503:
        return new ApiError(status, "unavailable", "GreenLight is degraded");
      default:
        return new ApiError(status, "unknown", `The API responded with ${status}`);
    }
  }
}

/** The API returned 200 with a body that does not match the shared contract. */
export class ResponseContractError extends Error {
  constructor(readonly issues: z.ZodIssue[]) {
    super("The API returned a response GreenLight does not recognise");
    this.name = "ResponseContractError";
  }
}

/**
 * Reads are made with the browser's own credentials; no token is embedded.
 *
 * `VITE_*` values are inlined at build time and shipped to every visitor, so a
 * bearer token placed there is a public credential. When the API requires read
 * authentication it must be fronted by something that issues a per-user
 * session, never by a shared static token compiled into the bundle.
 */
async function request<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new ApiError(0, "unavailable", "GreenLight could not be reached");
  }

  if (!response.ok) {
    throw ApiError.fromStatus(response.status);
  }

  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new ResponseContractError(parsed.error.issues);
  }
  return parsed.data;
}

export function fetchChanges() {
  return request<ChangeListResponse>("/api/v1/changes", ChangeListResponseSchema);
}

export function fetchReceipt(commitSha: string) {
  return request<ChangeReceipt>(
    `/api/v1/changes/${encodeURIComponent(commitSha)}`,
    ChangeReceiptSchema,
  );
}
