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

import os
import json
import re
import threading
from typing import Iterator
import config
import hardware

_local_model = None
_load_lock = threading.Lock()
_infer_lock = threading.Lock()

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


def sarvam_stream(
    system_prompt: str,
    user_prompt: str,
    use_heavy: bool = False,
) -> Iterator[str]:
    if not config.SARVAM_API_KEY:
        raise ValueError(
            "SARVAM_API_KEY not set. Add it to engine/.env or set LLM_BACKEND=local."
        )
    import httpx, privacy_filter
    user_prompt = privacy_filter.sanitize_text(user_prompt)
    model = config.SARVAM_MODEL_HEAVY if use_heavy else config.SARVAM_MODEL
    with httpx.Client(timeout=90.0) as client:
        with client.stream(
            "POST",
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
                "max_tokens": config.SARVAM_MAX_TOKENS,
                "temperature": config.LOCAL_MODEL_TEMPERATURE,
                "stream": True,
            },
        ) as resp:
            if resp.status_code != 200:
                body = resp.read().decode("utf-8", errors="ignore")[:300]
                raise RuntimeError(f"Sarvam API error {resp.status_code}: {body}")
            for line in resp.iter_lines():
                if not line:
                    continue
                if line.startswith("data: "):
                    payload = line[6:].strip()
                    if payload == "[DONE]":
                        break
                    try:
                        chunk = json.loads(payload)
                        delta = chunk["choices"][0].get("delta", {})
                        content = delta.get("content")
                        if content:
                            yield content
                    except Exception:
                        continue


# ── Local model (llama.cpp / GGUF) ────────────────────────────────────────────

def _get_local_model():
    global _local_model
    if _local_model is not None:
        return _local_model
    with _load_lock:
        if _local_model is not None:
            return _local_model
        from llama_cpp import Llama  # type: ignore
        if not os.path.exists(config.LOCAL_MODEL_PATH):
            raise FileNotFoundError(
                f"Local model not found at {config.LOCAL_MODEL_PATH}.\n"
                "Download a GGUF model and place it there, "
                "or set LLM_BACKEND=sarvam in .env."
            )
        prof = hardware.get_profile()
        print(f"[llm] loading local model … ({hardware.describe()})")
        model = Llama(
            model_path=config.LOCAL_MODEL_PATH,
            n_ctx=config.LOCAL_MODEL_CONTEXT,
            n_threads=prof.n_threads,
            n_threads_batch=prof.n_threads_batch,
            n_batch=prof.n_batch,
            n_ubatch=prof.n_ubatch,
            n_gpu_layers=prof.n_gpu_layers,
            use_mmap=True,
            use_mlock=prof.use_mlock,
            flash_attn=prof.flash_attn,
            verbose=False,
        )
        try:
            from llama_cpp import LlamaRAMCache  # type: ignore
            model.set_cache(LlamaRAMCache(capacity_bytes=prof.prompt_cache_bytes))
        except Exception as e:
            print(f"[llm] prompt cache disabled: {e}")
        _local_model = model
        print("[llm] local model ready")
        return _local_model


def _local_kwargs() -> dict:
    return dict(
        max_tokens=config.LOCAL_MODEL_MAX_TOKENS,
        temperature=config.LOCAL_MODEL_TEMPERATURE,
        stop=["</s>", "[/INST]", "User:", "Question:", "<|im_end|>"],
        echo=False,
    )


def local_generate(prompt: str) -> str:
    model = _get_local_model()
    with _infer_lock:
        output = model(prompt, **_local_kwargs())
    return output["choices"][0]["text"].strip()


def local_stream(prompt: str) -> Iterator[str]:
    """Yields token pieces incrementally as the local model generates."""
    model = _get_local_model()
    with _infer_lock:
        for part in model(prompt, stream=True, **_local_kwargs()):
            text = part["choices"][0].get("text", "")
            if text:
                yield text


def _build_local_prompt(system_prompt: str, user_prompt: str) -> str:
    return (
        f"<|im_start|>system\n{system_prompt}<|im_end|>\n"
        f"<|im_start|>user\n{user_prompt}<|im_end|>\n"
        f"<|im_start|>assistant\n"
    )


def warmup(system_prompt: str) -> None:
    """
    Background pre-load: maps model weights and pre-evaluates the static system prompt
    into KV cache so the first advocate query starts instantly.
    """
    if config.LLM_BACKEND != "local" or not os.path.exists(config.LOCAL_MODEL_PATH):
        return
    try:
        model = _get_local_model()
        prefix = f"<|im_start|>system\n{system_prompt}<|im_end|>\n<|im_start|>user\n"
        with _infer_lock:
            model(prefix, max_tokens=1, temperature=0.0)
        print("[llm] warm-up complete (system prompt cached)")
    except Exception as e:
        print(f"[llm] warm-up skipped: {e}")


class ThoughtFilter:
    """
    Incrementally filters out internal <thought>...</thought> reasoning tokens
    during streaming so user receives clean answer text.
    """
    OPEN = "<thought>"
    CLOSE = "</thought>"

    def __init__(self):
        self.state = "start"  # start | thinking | answer
        self.buf = ""

    def feed(self, text: str) -> str:
        self.buf += text
        out = ""
        while True:
            if self.state == "start":
                head = self.buf.lstrip()
                low = head.lower()
                if low.startswith(self.OPEN):
                    self.state = "thinking"
                    self.buf = head[len(self.OPEN):]
                    continue
                if len(low) < len(self.OPEN) and self.OPEN.startswith(low):
                    return out  # might become <thought>, wait for more
                self.state = "answer"
                self.buf = head
                continue
            if self.state == "thinking":
                idx = self.buf.lower().find(self.CLOSE)
                if idx == -1:
                    self.buf = self.buf[-len(self.CLOSE):]
                    return out
                self.state = "answer"
                self.buf = self.buf[idx + len(self.CLOSE):].lstrip()
                continue
            out += self.buf
            self.buf = ""
            return out


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


def anthropic_stream(system_prompt: str, user_prompt: str) -> Iterator[str]:
    if not config.ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY not set.")
    import anthropic, privacy_filter
    user_prompt = privacy_filter.sanitize_text(user_prompt)
    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    with client.messages.stream(
        model=config.ANTHROPIC_MODEL,
        max_tokens=config.LOCAL_MODEL_MAX_TOKENS,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    ) as stream:
        for text in stream.text_stream:
            yield text


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


def stream(
    system_prompt: str,
    user_prompt: str,
    backend: str = None,
    use_heavy: bool = False,
) -> tuple[Iterator[str], str]:
    """Returns (token_iterator, backend_used)."""
    backend = backend or config.LLM_BACKEND

    if backend == "sarvam":
        def _sarvam_filtered():
            tf = ThoughtFilter()
            for token in sarvam_stream(system_prompt, user_prompt, use_heavy=use_heavy):
                clean = tf.feed(token)
                if clean:
                    yield clean
            tail = tf.feed("")
            if tail:
                yield tail
        return _sarvam_filtered(), "sarvam"

    elif backend == "local":
        full = _build_local_prompt(system_prompt, user_prompt)
        def _local_filtered():
            tf = ThoughtFilter()
            for token in local_stream(full):
                clean = tf.feed(token)
                if clean:
                    yield clean
            tail = tf.feed("")
            if tail:
                yield tail
        return _local_filtered(), "local"

    elif backend == "anthropic":
        return anthropic_stream(system_prompt, user_prompt), "anthropic"

    else:
        raise ValueError(f"Unknown LLM backend: {backend}")


def stream_with_fallback(
    system_prompt: str,
    user_prompt: str,
    prefer_cloud: bool = False,
    use_heavy: bool = False,
) -> tuple[Iterator[str], str]:
    """
    Returns (token_iterator, backend_used).
    Tries backends in preference order. If streaming cannot be initialized,
    falls back cleanly to non-streaming generate_with_fallback wrapped as an iterator.
    """
    if prefer_cloud:
        order = _cloud_order() + ["local"]
    else:
        primary = config.LLM_BACKEND
        others = [b for b in ["sarvam", "local", "anthropic"] if b != primary]
        order = [primary] + others

    last_err = None
    for backend in order:
        try:
            if backend == "local" and not os.path.exists(config.LOCAL_MODEL_PATH):
                continue
            if backend == "sarvam" and not config.SARVAM_API_KEY:
                continue
            if backend == "anthropic" and not config.ANTHROPIC_API_KEY:
                continue

            it, b = stream(system_prompt, user_prompt, backend=backend, use_heavy=use_heavy)
            return it, b
        except (FileNotFoundError, ValueError) as e:
            last_err = str(e)
            continue
        except Exception as e:
            last_err = str(e)
            continue

    # Resilient fallback: return standard generation wrapped as an iterator
    ans, b = generate_with_fallback(system_prompt, user_prompt, prefer_cloud=prefer_cloud, use_heavy=use_heavy)
    return iter([ans]), b



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
