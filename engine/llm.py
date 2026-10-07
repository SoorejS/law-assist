"""
LLM layer — three backends, clean fallback chain.

Priority order (configurable via LLM_BACKEND env):
  sarvam   → Sarvam AI (primary, Indian sovereign cloud, OpenAI-compatible)
  local    → llama.cpp GGUF (offline, zero cost)
  anthropic → Claude (optional premium English fallback)

Sarvam models:
  sarvam-30b  — standard queries (64K context, 23 Indian languages)
  sarvam-105b — deep multi-document synthesis (128K context, highest quality)
"""

from __future__ import annotations
import os
import config

_local_model = None

NOT_FOUND_REPLY = "I could not find that in your documents."


# ── Sarvam AI (primary — Indian sovereign stack) ───────────────────────────────

def sarvam_generate(
    system_prompt: str,
    user_prompt: str,
    use_heavy: bool = False,
) -> str:
    if not config.SARVAM_API_KEY:
        raise ValueError(
            "SARVAM_API_KEY not set. Add it to engine/.env or set LLM_BACKEND=local."
        )
    # Sarvam uses api-subscription-key header (not Authorization: Bearer)
    import httpx, json, privacy_filter
    user_prompt = privacy_filter.sanitize_text(user_prompt)
    model = config.SARVAM_MODEL_HEAVY if use_heavy else config.SARVAM_MODEL
    resp = httpx.post(
        f"{config.SARVAM_BASE_URL}/chat/completions",
        headers={
            "api-subscription-key": config.SARVAM_API_KEY,
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            # Sarvam is a thinking model — it uses internal reasoning tokens before
            # producing content. max_tokens must be high enough for thinking + answer.
            "max_tokens": config.SARVAM_MAX_TOKENS,
            "temperature": config.LOCAL_MODEL_TEMPERATURE,
        },
        timeout=60.0,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Sarvam API error {resp.status_code}: {resp.text[:300]}")
    data = resp.json()
    # Sarvam returns reasoning in reasoning_content; the actual answer is in content
    content = data["choices"][0]["message"].get("content") or ""
    return content.strip()


# ── Local model (llama.cpp / GGUF) ────────────────────────────────────────────

def _get_local_model():
    global _local_model
    if _local_model is not None:
        return _local_model
    from llama_cpp import Llama
    if not os.path.exists(config.LOCAL_MODEL_PATH):
        raise FileNotFoundError(
            f"Local model not found at {config.LOCAL_MODEL_PATH}.\n"
            "Download a GGUF model and place it there, "
            "or set LLM_BACKEND=sarvam in .env."
        )
    print(f"[llm] loading local model …")
    _local_model = Llama(
        model_path=config.LOCAL_MODEL_PATH,
        n_ctx=config.LOCAL_MODEL_CONTEXT,
        n_threads=config.LOCAL_MODEL_THREADS,
        verbose=False,
    )
    print("[llm] local model ready")
    return _local_model


def local_generate(prompt: str) -> str:
    model = _get_local_model()
    output = model(
        prompt,
        max_tokens=config.LOCAL_MODEL_MAX_TOKENS,
        temperature=config.LOCAL_MODEL_TEMPERATURE,
        stop=["</s>", "[/INST]", "User:", "Question:", "<|im_end|>"],
        echo=False,
    )
    return output["choices"][0]["text"].strip()


def _build_local_prompt(system_prompt: str, user_prompt: str) -> str:
    return (
        f"<|im_start|>system\n{system_prompt}<|im_end|>\n"
        f"<|im_start|>user\n{user_prompt}<|im_end|>\n"
        f"<|im_start|>assistant\n"
    )


# ── Anthropic Claude (optional premium English fallback) ───────────────────────

def anthropic_generate(system_prompt: str, user_prompt: str) -> str:
    if not config.ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY not set.")
    import anthropic, privacy_filter
    user_prompt = privacy_filter.sanitize_text(user_prompt)
    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    message = client.messages.create(
        model=config.ANTHROPIC_MODEL,
        max_tokens=config.LOCAL_MODEL_MAX_TOKENS,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return message.content[0].text.strip()


# ── Unified interface ──────────────────────────────────────────────────────────

def generate(
    system_prompt: str,
    user_prompt: str,
    backend: str = None,
    use_heavy: bool = False,
) -> tuple[str, str]:
    """Returns (response_text, backend_used)."""
    import re
    backend = backend or config.LLM_BACKEND

    if backend == "sarvam":
        ans, b = sarvam_generate(system_prompt, user_prompt, use_heavy=use_heavy), "sarvam"
    elif backend == "local":
        full = _build_local_prompt(system_prompt, user_prompt)
        ans, b = local_generate(full), "local"
    elif backend == "anthropic":
        ans, b = anthropic_generate(system_prompt, user_prompt), "anthropic"
    else:
        raise ValueError(f"Unknown LLM backend: {backend}")
        
    ans = re.sub(r'<thought>(?:.*?</thought>|.*$)', '', ans, flags=re.DOTALL | re.IGNORECASE).strip()
    return ans, b


def generate_with_fallback(
    system_prompt: str,
    user_prompt: str,
    prefer_cloud: bool = False,
    use_heavy: bool = False,
) -> tuple[str, str]:
    """
    Try backends in preference order, fall back on failure.
    prefer_cloud=True puts cloud backends first (for complex queries).
    use_heavy=True routes to sarvam-105b instead of sarvam-30b.
    """
    if prefer_cloud:
        order = _cloud_order() + ["local"]
    else:
        # Default: try configured backend first
        primary = config.LLM_BACKEND
        others = [b for b in (["sarvam", "local", "anthropic"]) if b != primary]
        order = [primary] + others

    last_err = None
    for backend in order:
        try:
            return generate(system_prompt, user_prompt, backend=backend, use_heavy=use_heavy)
        except (FileNotFoundError, ValueError) as e:
            last_err = str(e)
            continue
        except Exception as e:
            last_err = str(e)
            continue

    raise RuntimeError(f"All LLM backends failed. Last error: {last_err}")


def _cloud_order() -> list[str]:
    order = []
    if config.SARVAM_API_KEY:
        order.append("sarvam")
    if config.ANTHROPIC_API_KEY:
        order.append("anthropic")
    return order


# ── Confidence evaluation ──────────────────────────────────────────────────────

def is_confident(response: str) -> bool:
    if not response or len(response.split()) < config.MIN_LOCAL_ANSWER_WORDS:
        return False
    lower = response.lower()
    if any(phrase in lower for phrase in config.HEDGING_PHRASES):
        return False
    if NOT_FOUND_REPLY.lower() in lower:
        return False
    return True
