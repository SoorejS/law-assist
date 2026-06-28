# Claude Code · Local Memory Engine — Phase 0 Proof of Concept

**Goal:** Prove that a small CPU model + RAG gives accurate, sourced answers from real legal/audit documents — BEFORE investing in UI, licensing, or packaging. Run this on your own laptop this week.

**What you need first (you do this):**
- A laptop with 8GB+ RAM (16GB ideal)
- Python 3.10+ installed
- 5-10 real (or realistic) PDF documents to test with — e.g. a few case files, an audit report, a contract
- Your Anthropic API key (for the cloud fallback test)

Run `claude` in a fresh folder and paste the prompt below.

---

## PROMPT P0 — Build the proof of concept

```
Build a Phase 0 proof-of-concept for a local, offline agentic RAG application. It must run entirely on a CPU laptop (no GPU). This proves whether a small local model + retrieval can give accurate, sourced answers from a professional's documents (legal/audit use case).

REQUIREMENTS:

Tech stack (all CPU, all local except the optional cloud fallback):
- Python 3.10+
- llama-cpp-python for local model inference
- A small GGUF model: download Qwen2.5-1.5B-Instruct Q4_K_M (from Hugging Face). Make the model path configurable so I can swap models later.
- sentence-transformers with BAAI/bge-m3 for embeddings (multilingual — handles English + Indian languages)
- sqlite-vec for the vector store (a single local DB file)
- PyMuPDF (fitz) for PDF parsing, python-docx for DOCX, pandas for CSV
- anthropic SDK for the cloud fallback (Claude Haiku)

BUILD THESE MODULES:

1. `ingest.py`
   - Function `ingest(file_path)` — detects type (pdf/docx/csv), extracts text
   - Chunk text into ~500-token chunks with ~50-token overlap, preserving page/section metadata
   - Embed each chunk with bge-m3
   - Store in sqlite-vec with metadata: { source_file, page, chunk_text, embedding }
   - CLI: `python ingest.py path/to/file.pdf` (and support a folder)

2. `retrieve.py`
   - Function `retrieve(query, top_k=5)` — embed the query, vector-search sqlite-vec, return top_k chunks with their source metadata
   - Add a simple hybrid option: also do a keyword match for exact terms (case numbers, names) and merge results

3. `local_llm.py`
   - Wrapper around llama-cpp-python
   - Function `generate(prompt, max_tokens=400)` — runs the local model
   - Function `is_confident(response)` — a heuristic: returns False if the response is very short, contains hedging phrases ("I don't know", "not sure", "cannot determine"), or is empty

4. `cloud_fallback.py`
   - Function `cloud_generate(query, context_chunks)` — sends ONLY the query + retrieved chunks to Claude Haiku (never the whole document store)
   - Returns the grounded answer
   - Reads ANTHROPIC_API_KEY from environment

5. `agent.py` — the orchestrator (the core IP)
   - Function `answer(query)`:
     a) retrieve(query)
     b) If no relevant chunks found (similarity below threshold) → return "I couldn't find that in your documents." (NEVER guess)
     c) Build a grounded prompt: instruct the model to answer ONLY from the provided chunks, and to cite the source file + page for every claim
     d) Try local_llm.generate()
     e) If is_confident() is False OR the query looks complex (asks for synthesis across many docs, or contains words like "compare", "summarize all", "across") → escalate to cloud_generate()
     f) Return: { answer, sources: [{file, page, passage}], used_cloud: bool }
   - CRITICAL: the answer must always include citations. If the model returns an answer with no traceable source, discard it and say "I couldn't find that in your documents."

6. `cli.py` — a simple REPL
   - `python cli.py` opens a prompt
   - User types a question, gets back: the answer, the sources (file + page + the actual passage), and whether cloud was used
   - Show timing (how many seconds the answer took)

7. `README.md` with setup instructions and how to run.

IMPORTANT DESIGN RULES:
- Grounding is mandatory. The model must never state a fact that isn't in the retrieved chunks. Every answer shows its sources.
- If retrieval finds nothing relevant, say so honestly. Do not hallucinate.
- Everything runs offline EXCEPT the optional cloud fallback.
- Make the local model path, embedding model, chunk size, and similarity threshold all configurable in a `config.py`.

After building:
- Show me the setup steps to download the model and install dependencies
- Walk me through ingesting a sample PDF
- Show me 3 example questions and their grounded, cited answers
- Show me the timing for local answers vs cloud answers
- Show me what happens when I ask about something NOT in the documents (it must say "I couldn't find that")

Then give me a short assessment: based on this POC, is the local model quality good enough for legal/audit recall, or do we need a bigger model / more cloud escalation?
```

---

## What to test after it's built

Run these queries against YOUR real documents and judge the quality honestly:

1. **Simple lookup:** "What is the hearing date for [case]?" — should be fast, local, cited.
2. **Summary:** "Summarize the [X] matter in 3 points" — local or cloud, must cite.
3. **Multi-doc:** "What findings repeat across these audit reports?" — should escalate to cloud.
4. **Not-in-docs:** "What's the GST rate on textiles?" — must say "I couldn't find that in your documents" (NOT answer from general knowledge — that would be a hallucination risk).
5. **Regional language:** if you have a Tamil document, ask a question in Tamil — see how bge-m3 + Qwen handle it. (This tells you whether to switch to Sarvam-1.)

**The decision gate:** if answers 1-4 are accurate and sourced, the brain works — proceed to Phase 1 (desktop app). If quality is weak, we try Sarvam-1 or a 3B model, or lean more on cloud escalation, before building anything else.

---

## After Phase 0 succeeds

Come back and we'll plan Phase 1 in detail:
- Tauri desktop UI
- The license + node-lock system
- The Saravonix fallback proxy with metering
- Per-customer workflow customization via TACO

Don't build Phase 1 until Phase 0 proves the quality. Prove the brain, then build the body.

---

*யாமிருக்க பயமேன்*
