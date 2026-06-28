import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from engine directory
load_dotenv(Path(__file__).parent / ".env")

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"
VERTICALS_DIR = BASE_DIR / "verticals"

# ── Vector DB ─────────────────────────────────────────────────────────────────
VECTOR_DB_PATH = str(DATA_DIR / "memory.db")
EMBEDDING_DIM = 1024  # BGE-m3 output dimension

# ── Embedding model ────────────────────────────────────────────────────────────
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")

# ── Chunking ───────────────────────────────────────────────────────────────────
CHUNK_SIZE_WORDS = int(os.getenv("CHUNK_SIZE_WORDS", "400"))
CHUNK_OVERLAP_WORDS = int(os.getenv("CHUNK_OVERLAP_WORDS", "60"))

# ── Retrieval ──────────────────────────────────────────────────────────────────
TOP_K = int(os.getenv("TOP_K", "6"))
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "1.0"))
KEYWORD_TOP_K = int(os.getenv("KEYWORD_TOP_K", "3"))

# ── LLM backend ────────────────────────────────────────────────────────────────
# Options: "local" | "sarvam" | "anthropic"
LLM_BACKEND = os.getenv("LLM_BACKEND", "local")

# Local model (llama.cpp / GGUF) — offline fallback
LOCAL_MODEL_PATH = os.getenv("LOCAL_MODEL_PATH", str(MODELS_DIR / "model.gguf"))
LOCAL_MODEL_CONTEXT = int(os.getenv("LOCAL_MODEL_CONTEXT", "4096"))
LOCAL_MODEL_MAX_TOKENS = int(os.getenv("LOCAL_MODEL_MAX_TOKENS", "768"))    # local llama.cpp
SARVAM_MAX_TOKENS = int(os.getenv("SARVAM_MAX_TOKENS", "4096"))              # Sarvam uses thinking tokens before output
LOCAL_MODEL_TEMPERATURE = float(os.getenv("LOCAL_MODEL_TEMPERATURE", "0.1"))
LOCAL_MODEL_THREADS = int(os.getenv("LOCAL_MODEL_THREADS", "4"))

# ── Sarvam AI (primary cloud backend — Indian sovereign stack) ─────────────────
# Models verified 2026-05: sarvam-30b (64K ctx), sarvam-105b (128K ctx, highest quality)
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
SARVAM_BASE_URL = os.getenv("SARVAM_BASE_URL", "https://api.sarvam.ai/v1")
SARVAM_MODEL = os.getenv("SARVAM_MODEL", "sarvam-30b")         # standard queries
SARVAM_MODEL_HEAVY = os.getenv("SARVAM_MODEL_HEAVY", "sarvam-105b")  # deep synthesis

# ── Anthropic Claude (optional premium English fallback) ───────────────────────
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")

# ── Cloud escalation triggers ──────────────────────────────────────────────────
ESCALATION_KEYWORDS = [
    "compare", "summarize all", "across all", "across all matters",
    "synthesize", "draft", "contrast", "difference between",
    "find all", "pattern", "common across", "throughout", "all cases",
]
# Use the heavy model (105B) for deep multi-document synthesis
HEAVY_ESCALATION_KEYWORDS = [
    "compare", "synthesize", "across all", "draft", "pattern across",
]
MIN_LOCAL_ANSWER_WORDS = 40
HEDGING_PHRASES = [
    "i don't know", "i cannot", "not sure", "unable to determine",
    "i'm not able", "cannot determine", "no information", "i do not have",
    "i am unable", "cannot find",
]

# ── Vertical ───────────────────────────────────────────────────────────────────
VERTICAL = os.getenv("SARAVONIX_VERTICAL", "law_firm")

# ── API server ─────────────────────────────────────────────────────────────────
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8765"))

# ── Auth (multi-user server mode) ─────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "change_this_secret")
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "8"))

# ── License daemon ────────────────────────────────────────────────────────────
LICENSE_DAEMON_SOCKET = os.getenv("LICENSE_DAEMON_SOCKET", "/tmp/saravonix_license.sock")
LICENSE_FILE = os.getenv("LICENSE_FILE", str(BASE_DIR / "license.dat"))
LICENSE_ENABLED = os.getenv("LICENSE_ENABLED", "false").lower() == "true"
