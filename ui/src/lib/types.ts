export type EngineStatus = "starting" | "ready" | "offline";

export interface Source {
  file: string;
  page: number | null;
  section: string | null;
  passage: string;
  distance: number;
}

export interface Timing {
  retrieval_ms: number;
  generation_ms: number;
  total_ms: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  backend?: string;
  escalated?: boolean;
  timing?: Timing;
  timestamp: Date;
  isError?: boolean;
}

export interface MatterInfo {
  id: string;
  title: string;
  description: string;
  file_count: number;
  chunk_count: number;
  created_at: string;
  permission_level?: string;
}

export interface FileInfo {
  source_file: string;
  doc_type: string;
  chunks: number;
  added_at: string;
}

export interface IngestResult {
  source_file: string;
  matter_id: string;
  chunks_added: number;
  skipped: boolean;
  error?: string;
}

export interface QueryResponse {
  query: string;
  answer: string;
  sources: Source[];
  backend_used: string;
  escalated: boolean;
  timing: Timing;
}

export interface IntelligenceData {
  timeline: { date: string; event: string }[];
  people: { name: string; role: string }[];
  contradictions: string[];
  missing_evidence: string[];
}
