#!/bin/bash
# Saravonix Local Memory Engine — setup script
# Run once after cloning. Tested on macOS and Ubuntu.

set -e

echo "=== Saravonix Engine Setup ==="

# ── Python environment ──────────────────────────────────────────────────────────
python3 -m venv .venv
source .venv/bin/activate

pip install --upgrade pip

# ── Core dependencies ────────────────────────────────────────────────────────────
pip install -r requirements.txt

# ── llama-cpp-python (platform-specific) ─────────────────────────────────────────
ARCH=$(uname -m)
OS=$(uname -s)

echo ""
echo "Installing llama-cpp-python for $OS / $ARCH ..."
if [ "$OS" = "Darwin" ] && [ "$ARCH" = "arm64" ]; then
    # Apple Silicon — use Metal GPU
    CMAKE_ARGS="-DLLAMA_METAL=on" pip install llama-cpp-python --no-cache-dir
elif [ "$OS" = "Darwin" ]; then
    # Intel Mac — CPU only
    CMAKE_ARGS="-DLLAMA_METAL=off" pip install llama-cpp-python --no-cache-dir
else
    # Linux/Windows — CPU only (add -DLLAMA_CUDA=on if you have an NVIDIA GPU)
    CMAKE_ARGS="-DLLAMA_METAL=off" pip install llama-cpp-python --no-cache-dir
fi

# ── Create .env ─────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    echo "Created .env from template. Edit it to set your API keys and model path."
fi

# ── Create data and models directories ──────────────────────────────────────────
mkdir -p data models sample_docs

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Download a GGUF model (see below) and place it at models/model.gguf"
echo "  2. Edit .env — set SARAVONIX_VERTICAL=law_firm (or ca_firm, generic)"
echo "  3. Ingest documents: python ingest.py /path/to/docs --folder my_matter"
echo "  4. Chat: python cli.py --folder my_matter"
echo "  5. Start API server: python api.py"
echo ""
echo "Recommended models (download from Hugging Face):"
echo "  Qwen2.5-1.5B-Instruct-Q4_K_M.gguf   ~1 GB  (fast, English-strong)"
echo "  Sarvam-1-Q4_K_M.gguf                 ~1.3 GB (Tamil/Indian languages)"
echo "  Llama-3.2-3B-Instruct-Q4_K_M.gguf    ~2 GB  (better reasoning, 16GB RAM)"
echo ""
echo "HuggingFace CLI download example:"
echo "  pip install huggingface_hub"
echo "  huggingface-cli download Qwen/Qwen2.5-1.5B-Instruct-GGUF Qwen2.5-1.5B-Instruct-Q4_K_M.gguf --local-dir models/"
echo "  mv models/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf models/model.gguf"
