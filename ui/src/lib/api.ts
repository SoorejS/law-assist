import type {
  MatterInfo,
  FileInfo,
  IngestResult,
  QueryResponse,
} from "./types";

const BASE = "http://localhost:8765";

async function request<T>(
  path: string,
  opts?: RequestInit
): Promise<T> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {
    ...(opts?.headers as Record<string, string> ?? {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers,
  });
  
  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error");
    if (res.status === 401) {
      // Force logout on 401
      localStorage.removeItem("auth_token");
      window.dispatchEvent(new Event("auth_expired"));
    }
    throw new Error(`Engine error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`, {
      signal: AbortSignal.timeout(2500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// -- Auth & Setup --

export async function checkSetupStatus(): Promise<boolean> {
  const res = await request<{ initialized: boolean }>("/auth/setup-status");
  return res.initialized;
}

export async function setupWorkspace(data: any): Promise<void> {
  await request("/auth/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function fetchProfiles(): Promise<any[]> {
  const data = await request<{ profiles: any[] }>("/auth/profiles");
  return data.profiles;
}

export async function login(username: string, password: string): Promise<string> {
  const params = new URLSearchParams();
  params.append("username", username);
  params.append("password", password);
  
  const data = await request<{ access_token: string }>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  return data.access_token;
}

export async function fetchCurrentUser(): Promise<any> {
  return request("/auth/me");
}

// -- Query & Chat --

export async function sendQuery(
  query: string,
  matterId: string | null,
  forceCloud = false
): Promise<QueryResponse> {
  return request<QueryResponse>("/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      matter_id: matterId,
      force_cloud: forceCloud,
    }),
  });
}

export async function fetchChatHistory(matterId: string): Promise<any[]> {
  const data = await request<{ history: any[] }>(`/matters/${encodeURIComponent(matterId)}/chat`);
  return data.history;
}

// -- Matters --

export async function fetchMatters(): Promise<MatterInfo[]> {
  const data = await request<{ matters: MatterInfo[] }>("/matters");
  return data.matters;
}

export async function createMatter(title: string, description: string = ""): Promise<any> {
  return request("/matters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description }),
  });
}

export async function fetchFiles(matterId: string): Promise<FileInfo[]> {
  const data = await request<{ files: FileInfo[] }>(
    `/matters/${encodeURIComponent(matterId)}/files`
  );
  return data.files;
}

export async function fetchIntelligence(matterId: string): Promise<any> {
  return request(`/matters/${encodeURIComponent(matterId)}/intelligence`);
}

export async function uploadFile(
  file: File,
  matterId: string,
  onProgress?: (name: string) => void
): Promise<IngestResult> {
  onProgress?.(file.name);
  const form = new FormData();
  form.append("file", file);
  form.append("matter_id", matterId);
  return request<IngestResult>("/ingest/file", {
    method: "POST",
    body: form,
  });
}

export async function uploadFiles(
  files: File[],
  matterId: string,
  onProgress?: (name: string, index: number, total: number) => void
): Promise<IngestResult[]> {
  const results: IngestResult[] = [];
  for (let i = 0; i < files.length; i++) {
    onProgress?.(files[i].name, i + 1, files.length);
    const result = await uploadFile(files[i], matterId);
    results.push(result);
  }
  return results;
}

export async function deleteFile(
  matterId: string,
  filename: string
): Promise<void> {
  await request(
    `/matters/${encodeURIComponent(matterId)}/files/${encodeURIComponent(filename)}`,
    { method: "DELETE" }
  );
}
