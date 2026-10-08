import type {
  MatterInfo,
  FileInfo,
  IngestResult,
  QueryResponse,
  DocComparisonResult,
  WebVerifyResult,
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

export interface StreamHandlers {
  onMetadata?: (meta: { sources: any[]; backend_used: string; escalated: boolean; cached: boolean; retrieval_ms: number }) => void;
  onToken?: (token: string) => void;
  onDone?: (result: QueryResponse) => void;
  onError?: (err: Error) => void;
}

export async function sendQueryStream(
  query: string,
  matterId: string | null,
  forceCloud = false,
  handlers: StreamHandlers = {},
  signal?: AbortSignal
): Promise<QueryResponse> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "text/event-stream",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}/query/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query,
      matter_id: matterId,
      force_cloud: forceCloud,
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error");
    if (res.status === 401) {
      localStorage.removeItem("auth_token");
      window.dispatchEvent(new Event("auth_expired"));
    }
    throw new Error(`Engine error ${res.status}: ${text}`);
  }

  if (!res.body) {
    throw new Error("No response body received from engine stream");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: QueryResponse | null = null;
  let currentEvent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        currentEvent = "";
        continue;
      }
      if (trimmed.startsWith("event: ")) {
        currentEvent = trimmed.slice(7).trim();
      } else if (trimmed.startsWith("data: ")) {
        const rawData = trimmed.slice(6);
        try {
          const parsed = JSON.parse(rawData);
          if (currentEvent === "metadata") {
            handlers.onMetadata?.(parsed);
          } else if (currentEvent === "token") {
            handlers.onToken?.(parsed.token);
          } else if (currentEvent === "done") {
            finalResult = parsed;
            handlers.onDone?.(parsed);
          }
        } catch {
          // Ignore incomplete/malformed SSE chunk
        }
      }
    }
  }

  if (finalResult) {
    return finalResult;
  }
  throw new Error("Stream finished without final done payload");
}

export async function fetchHardwareInfo(): Promise<any> {
  return request("/system/hardware");
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

export async function createMatter(title: string, description: string = "", tags: string[] = []): Promise<any> {
  return request("/matters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, tags }),
  });
}

export async function updateMatterTags(matterId: string, tags: string[]): Promise<{ matter_id: string; tags: string[] }> {
  return request(`/matters/${encodeURIComponent(matterId)}/tags`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tags }),
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

// -- OpenWorker Coworkers --

export async function fetchCoworkers(vertical?: string): Promise<{ coworkers: any[]; workspace_vertical: string }> {
  const q = vertical ? `?vertical=${encodeURIComponent(vertical)}` : "";
  return request(`/coworkers${q}`);
}

export async function runCoworker(
  matterId: string,
  coworkerId: string,
  customInstruction?: string,
  forceCloud = false,
  useHeavy = false
): Promise<any> {
  return request(`/matters/${encodeURIComponent(matterId)}/coworker`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      coworker_id: coworkerId,
      custom_instruction: customInstruction,
      force_cloud: forceCloud,
      use_heavy: useHeavy,
    }),
  });
}

export async function createCustomCoworker(data: {
  id?: string;
  name: string;
  role: string;
  description: string;
  icon?: string;
  vertical?: string;
  system_prompt: string;
  default_query: string;
}): Promise<any> {
  return request("/coworkers/custom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteCustomCoworker(coworkerId: string): Promise<any> {
  return request(`/coworkers/custom/${encodeURIComponent(coworkerId)}`, {
    method: "DELETE",
  });
}

export async function exportCoworkerBundle(coworkerId: string): Promise<any> {
  return request(`/coworkers/${encodeURIComponent(coworkerId)}/export`);
}

export async function importCoworkerBundle(bundle: any): Promise<any> {
  return request("/coworkers/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bundle }),
  });
}

export async function exportMatterWord(matterId: string): Promise<Blob> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}/matters/${encodeURIComponent(matterId)}/export`, {
    headers,
  });
  if (!res.ok) throw new Error("Failed to export Word report");
  return res.blob();
}

export async function exportMatterCalendarIcs(matterId: string): Promise<Blob> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}/matters/${encodeURIComponent(matterId)}/calendar.ics`, {
    headers,
  });
  if (!res.ok) throw new Error("Failed to export calendar deadlines");
  return res.blob();
}

export async function compareMatterDocs(
  matterId: string,
  doc1: string,
  doc2: string,
  focus?: string
): Promise<DocComparisonResult> {
  return request(`/matters/${encodeURIComponent(matterId)}/compare-docs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc1, doc2, focus }),
  });
}

export async function webVerify(
  matterId: string,
  query: string
): Promise<WebVerifyResult> {
  return request(`/matters/${encodeURIComponent(matterId)}/web-verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
}


