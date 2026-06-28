"""
Download a GGUF model for local CPU inference.
Supported models:
  sarvam   → Sarvam-2B-v0.5 Q4_K_M (Tamil/Hindi/Indian languages, ~1.3 GB)
  qwen     → Qwen2.5-1.5B-Instruct Q4_K_M (English-strong, ~1.0 GB, fastest)
  llama    → Llama-3.2-3B-Instruct Q4_K_M (best reasoning, ~2 GB, 16GB RAM recommended)

Usage:
  python download_model.py sarvam   ← recommended for Indian languages
  python download_model.py qwen     ← recommended for English-heavy use
  python download_model.py llama    ← recommended for complex reasoning
"""

import sys
import os
from pathlib import Path

MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(exist_ok=True)

REGISTRY = {
    "sarvam": {
        "repo": "rachittshah/sarvam-2b-v0.5-Q4_K_M-GGUF",
        "filename": "sarvam-2b-v0.5-q4_k_m.gguf",
        "size": "~1.3 GB",
        "description": "Sarvam-2B — Tamil, Hindi, and 20 Indian languages. Best for Tamil Nadu law firms.",
        "dest": "model.gguf",
    },
    "qwen": {
        "repo": "Qwen/Qwen2.5-1.5B-Instruct-GGUF",
        "filename": "qwen2.5-1.5b-instruct-q4_k_m.gguf",
        "size": "~1.0 GB",
        "description": "Qwen2.5-1.5B — fastest CPU inference, strong English instruction-following.",
        "dest": "model.gguf",
    },
    "llama": {
        "repo": "bartowski/Llama-3.2-3B-Instruct-GGUF",
        "filename": "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
        "size": "~2.0 GB",
        "description": "Llama-3.2-3B — best local reasoning quality. Needs 16 GB RAM.",
        "dest": "model.gguf",
    },
}

def download(model_key: str) -> None:
    if model_key not in REGISTRY:
        print(f"Unknown model: {model_key}")
        print(f"Available: {', '.join(REGISTRY.keys())}")
        sys.exit(1)

    entry = REGISTRY[model_key]
    dest = MODELS_DIR / entry["dest"]

    print(f"\nModel:       {model_key} — {entry['description']}")
    print(f"Size:        {entry['size']}")
    print(f"Destination: {dest}")

    if dest.exists():
        size_mb = dest.stat().st_size / 1024 / 1024
        print(f"\nModel already exists ({size_mb:.0f} MB). Use --force to re-download.")
        print("To use it: set LOCAL_MODEL_PATH=models/model.gguf in .env")
        return

    print(f"\nDownloading {entry['filename']} from {entry['repo']} ...")
    print("This may take several minutes depending on your connection.\n")

    try:
        from huggingface_hub import hf_hub_download
        path = hf_hub_download(
            repo_id=entry["repo"],
            filename=entry["filename"],
            local_dir=str(MODELS_DIR),
            local_dir_use_symlinks=False,
        )
        # Rename to standard model.gguf
        final = MODELS_DIR / entry["dest"]
        Path(path).rename(final)
        size_mb = final.stat().st_size / 1024 / 1024
        print(f"\nDownloaded: {final} ({size_mb:.0f} MB)")
    except Exception as e:
        print(f"Download failed: {e}")
        print("\nManual download:")
        print(f"  pip install huggingface_hub")
        print(f"  huggingface-cli download {entry['repo']} {entry['filename']} --local-dir models/")
        print(f"  mv models/{entry['filename']} models/model.gguf")
        sys.exit(1)

    # Update .env to use local backend
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        env_text = env_path.read_text()
        # Don't overwrite if user explicitly set a cloud backend
        print("\n.env is set to LLM_BACKEND=sarvam (cloud).")
        print("To switch to local model, set LLM_BACKEND=local in .env")
        print("To use local as OFFLINE FALLBACK (when cloud unavailable), keep LLM_BACKEND=sarvam")
        print("The engine will auto-fallback to local if Sarvam API is unreachable.\n")

    print("=" * 60)
    print("DONE. Local model installed.")
    print("Install llama-cpp-python to use it:")
    print()
    import platform
    if platform.system() == "Darwin" and platform.machine() == "arm64":
        print("  # Apple Silicon (uses Metal GPU):")
        print("  CMAKE_ARGS=\"-DLLAMA_METAL=on\" pip install llama-cpp-python --no-cache-dir")
    else:
        print("  # Intel Mac / Linux / Windows (CPU only):")
        print("  CMAKE_ARGS=\"-DLLAMA_METAL=off\" pip install llama-cpp-python --no-cache-dir")
    print()
    print("Performance on CPU (~Intel i5/i7, 8GB RAM):")
    print("  Sarvam-2B Q4:  ~10-20 tokens/sec -> ~15 sec per answer")
    print("  Qwen-1.5B Q4:  ~15-25 tokens/sec -> ~10 sec per answer")
    print("  Llama-3.2-3B:  ~8-15 tokens/sec  -> ~20 sec per answer")
    print()
    print("Tip: Keep LLM_BACKEND=sarvam for cloud speed.")
    print("     The local model is the OFFLINE FALLBACK when internet is down.")
    print("=" * 60)


if __name__ == "__main__":
    force = "--force" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    model_key = args[0] if args else "sarvam"
    download(model_key)
