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
  follow_ups?: string[];
  cached?: boolean;
  isStreaming?: boolean;
}

export interface MatterInfo {
  id: string;
  title: string;
  description: string;
  file_count: number;
  chunk_count: number;
  created_at: string;
  permission_level?: string;
  tags?: string[];
}

export interface DocComparisonResult {
  matter_id: string;
  doc1: string;
  doc2: string;
  comparison: {
    summary: string;
    additions: string[];
    deletions: string[];
    modifications: Array<{
      clause: string;
      doc1_version: string;
      doc2_version: string;
      risk_impact: string;
    }>;
    risk_assessment: string;
  };
  backend: string;
}

export interface WebVerifyResult {
  query: string;
  sanitized_query: string;
  pii_redacted: boolean;
  results: Array<{
    title: string;
    snippet: string;
    url: string;
  }>;
  status: string;
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
  follow_ups?: string[];
  cached?: boolean;
}

export interface IntelligenceData {
  timeline: { date: string; event: string }[];
  people: { name: string; role: string }[];
  contradictions: string[];
  missing_evidence: string[];
}

export interface Coworker {
  id: string;
  name: string;
  role: string;
  description: string;
  icon: string;
  vertical: string;
  default_query: string;
  is_builtin?: boolean;
}

export interface CoworkerOutcome {
  coworker_id: string;
  coworker_name: string;
  role: string;
  status: string;
  title: string;
  summary: string;
  key_findings: string[];
  risk_matrix: Array<{ item: string; severity: "low" | "medium" | "high"; detail: string }>;
  action_plan: Array<{ step: number; action: string; owner_or_deadline: string }>;
  citations: Array<{ source: string; page: string; reference: string }>;
  markdown_memo: string;
  backend_used: string;
  timing: Timing;
}

