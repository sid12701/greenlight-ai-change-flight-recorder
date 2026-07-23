import type { ChangeListResponse, ChangeReceipt } from "@greenlight/shared";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:4000";

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`API ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function fetchChanges() {
  return request<ChangeListResponse>("/api/v1/changes");
}

export function fetchReceipt(commitSha: string) {
  return request<ChangeReceipt>(`/api/v1/changes/${commitSha}`);
}
