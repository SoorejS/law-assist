# Saravonix · Local Memory Engine
## Offline Agentic RAG for Solo Professionals — Architecture & Build Plan

**Codename:** "Local Memory Engine" (placeholder — deserves a name in your tradition, like the keeper-of-records / inner-knower concept)
**Target users:** Solo lawyers, individual auditors/CAs, single-person professional practices
**Core promise:** Upload your documents. Ask questions. Get instant, sourced answers and summaries. All on your own laptop. Your data never leaves.
**Owner:** KB · Saravonix Technologies
**Last updated:** 28 May 2026
**Architecture decision (v2):** ALL-SARVAM SOVEREIGN STACK — see §3.1

---

## 0. Decision: the all-Sarvam sovereign stack

This product runs entirely on the Indian sovereign AI stack. Every layer is Sarvam, India-hosted or on-device. Nothing leaves India.

| Layer | Component | Where it runs |
|---|---|---|
| Speech-to-text (code-mixed audio) | **Sarvam Saaras V3** | Cloud (Sarvam, India) or on-device if available |
| Local SLM (the on-device brain) | **Sarvam-1 (~2B)** | On the customer's CPU laptop |
| Document OCR (Indian scripts) | **Sarvam Vision** | Cloud or on-device |
| Cloud fallback (hard queries) | **Sarvam-30B / 105B via Pravah** | Cloud (Sarvam, India) |
| Embeddings | Sarvam embedding if available, else BGE-m3 (multilingual) | On-device |

**Why all-Sarvam:**
1. **Code-mixing is native.** Indian professionals speak Tanglish/Hinglish; Sarvam is built for exactly this. Documents may be formal English or Tamil; audio is mixed. Sarvam handles both.
2. **Full data sovereignty.** With Sarvam as the cloud fallback (instead of a foreign provider), the entire pipeline stays in India. The customer pitch becomes unbeatable: *"Your data stays in India, on Indian AI, on your own machine."*
3. **Strategic doors.** Sarvam is the Government of India's chosen partner for the sovereign LLM under the IndiaAI Mission. Tamil Nadu has an MoU with Sarvam for a Sovereign AI Park. A TN company building applied vertical AI on Sarvam aligns with state incentives, Sarvam's enterprise-partner program, and government procurement preference for sovereign vendors.

**Note on model sizes:** Sarvam's flagship 30B/105B are CLOUD models — they cannot run on a laptop. The ON-DEVICE model is the small Sarvam-1 (~2B). The big models are used only as the cloud fallback via Pravah. Do not confuse the two.

**Optional:** Claude may be kept as a *premium optional* fallback for English-heavy complex reasoning, but the DEFAULT sovereign path is all-Sarvam. Verify all current Sarvam model names, sizes, and licenses at build time — the lineup is evolving fast.

---

## 1. What we are building (and what we are NOT)

### We ARE building
A desktop application that runs entirely on a normal CPU laptop. It lets a professional:
- Drag in PDFs, Word docs, CSVs (case files, audit reports, contracts, financials)
- Ask questions in plain language ("What did we find in the 2021 audit?" / "Summarize the Krishnan case")
- Get answers grounded in their actual documents, with the source passage shown
- Keep years of records, searchable and recallable, with nothing leaving the machine

It is **agentic RAG**: the system decides what to retrieve, retrieves it, judges whether a small local model can answer, and escalates to cloud Claude only when needed.

### We are NOT building
- A language model from scratch (pretraining — millions of dollars, not advisable)
- A cloud product (this is local-first by design — that's the whole selling point)
- A general chatbot (it answers from the user's documents, not the open internet)

### The honest framing for the model
We will **use an existing open-source small model** (commodity, free, runs on CPU). Our IP is NOT the model — it's:
1. The agentic orchestration (when to retrieve, when to escalate, how to ground answers)
2. The packaging, licensing, and on-prem deployment
3. The per-customer workflow customization via TACO
4. The accumulated, private memory that belongs to each customer

The model is a replaceable commodity. Our engine and the customer's data are the value.

---

## 2. Architecture overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    CUSTOMER'S LAPTOP (offline-capable)             │
│                                                                    │
│  ┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐  │
│  │  Desktop UI   │    │  Ingestion       │    │  Document Store   │  │
│  │  (Tauri or    │───▶│  - PDF (PyMuPDF) │───▶│  - files on disk  │  │
│  │   Electron)   │    │  - DOCX          │    │  - SQLite (meta)  │  │
│  │               │    │  - CSV (pandas)  │    │                   │  │
│  └──────┬───────┘    │  - chunk + embed │    └────────┬─────────┘  │
│         │            └─────────────────┘             │            │
│         │                                            ▼            │
│         │            ┌─────────────────┐    ┌──────────────────┐  │
│         │            │  Embeddings      │    │  Vector Store     │  │
│         │            │  (BGE-m3, CPU)   │───▶│  (sqlite-vec      │  │
│         │            └─────────────────┘    │   or FAISS)       │  │
│         │                                    └────────┬─────────┘  │
│         ▼                                             │            │
│  ┌─────────────────────────────────────────────────┐ │            │
│  │           AGENTIC ORCHESTRATOR (the IP)           │◀┘            │
│  │  1. Analyze query                                 │              │
│  │  2. Retrieve relevant chunks (vector search)      │              │
│  │  3. Decide: can local SLM answer well?            │              │
│  │     ├── YES → local SLM generates (grounded)      │              │
│  │     └── NO  → escalate to cloud Claude            │              │
│  │  4. Ground answer in sources, show citations      │              │
│  └────────┬──────────────────────────┬──────────────┘              │
│           │                          │                             │
│           ▼                          │                             │
│  ┌─────────────────┐                 │                             │
│  │  Local SLM       │                 │                             │
│  │  (llama.cpp)     │                 │ (only when needed)          │
│  │  Qwen2.5-1.5B or │                 │                             │
│  │  Sarvam-1 (2B)   │                 │                             │
│  │  GGUF Q4, CPU    │                 │                             │
│  └─────────────────┘                 │                             │
│                                       │                             │
│  ┌─────────────────────────────────┐ │                             │
│  │  License + Node-lock (C++ core) │ │                             │
│  └─────────────────────────────────┘ │                             │
└───────────────────────────────────────┼─────────────────────────────┘
                                         │ HTTPS (only on escalation)
                                         ▼
┌──────────────────────────────────────────────────────────────────┐
│           SARAVONIX LICENSE + FALLBACK PROXY (cloud)               │
│  - Validates license key + node lock before any cloud call         │
│  - Proxies to Claude (Haiku/Sonnet) for hard queries               │
│  - For Indian-language queries → optionally route to Sarvam cloud  │
│  - Meters usage against the $5-8/month fallback budget             │
│  - Subscription expiry check                                       │
│                                                                    │
│  IMPORTANT: only the QUESTION + retrieved snippets go to cloud,    │
│  never the full document store. Masked where possible.             │
└──────────────────────────────────────────────────────────────────┘
```

The cloud piece is small and rarely hit. ~85-90% of queries are answered locally at zero marginal cost.

---

## 3. Component choices (with honest tradeoffs)

### Local small language model (SLM)

> Verify the latest versions at build time — this space moves fast. The principle (a 1.5B–3B model, quantized to ~4-bit, run via llama.cpp on CPU) is stable; the exact model is a swap-in decision.

| Model | Size (Q4) | Strength | Weakness | Best for |
|---|---|---|---|---|
| **Qwen2.5-1.5B-Instruct** | ~1 GB | Fast, strong instruction-following | English-leaning | Default — 8GB laptops |
| **Sarvam-1 (2B)** | ~1.3 GB | Native Indian languages (Tamil, Hindi, +) | Newer ecosystem | Tamil/regional document sets |
| **Llama-3.2-3B-Instruct** | ~2 GB | Better reasoning & summaries | Slower on CPU | 16GB laptops, quality-first |
| **Phi-3.5-mini (3.8B)** | ~2.3 GB | Strong reasoning for size | Slower | Complex summarization |

**Recommendation:** Ship with **Qwen2.5-1.5B** as default for speed, **Sarvam-1** as the Indian-language option. The installer picks based on the customer's documents (English vs Tamil) and RAM. You already have a Sarvam relationship — that's a real advantage for the Tamil Nadu professional market.

**Inference engine:** `llama.cpp` (via `llama-cpp-python`). It is the standard for CPU inference, uses GGUF quantized models, and is heavily AVX2-optimized. Mature, fast, embeddable.

### Embeddings (for retrieval)

| Model | Size | Notes |
|---|---|---|
| **BGE-m3** | ~560 MB | Multilingual (100+ langs incl. Tamil/Hindi). Best for mixed legal docs. |
| **bge-small-en-v1.5** | ~130 MB | English only, very fast. Use if customer is English-only. |

**Recommendation:** **BGE-m3** for Indian professional documents (they mix English + regional). Embedding a query is sub-second on CPU.

### Vector store

| Option | Notes |
|---|---|
| **sqlite-vec** | A SQLite extension. Just a file. No server. Perfect for single-user desktop. Tiny footprint. **Recommended.** |
| **FAISS (CPU)** | Faster at huge scale, C++ with Python bindings. Overkill for one professional's docs but rock-solid. |

**Recommendation:** **sqlite-vec.** For a solo professional with thousands (not millions) of documents, it's ideal — the whole memory is one portable file they can back up to a pen drive.

### Document parsing

- **PDF:** PyMuPDF (`fitz`) — fast, accurate text extraction
- **DOCX:** `python-docx`
- **CSV:** `pandas`
- **Scanned PDFs (optional):** Tesseract OCR — heavier; make it an optional install for customers with scanned documents

### Agentic orchestrator (our IP)

A lightweight agent loop — NOT a heavy framework. Steps:
1. **Analyze** the query (is it a lookup, a summary, a comparison, a multi-doc synthesis?)
2. **Retrieve** relevant chunks via vector search (+ optional keyword hybrid for exact terms like case numbers)
3. **Judge** whether the local SLM can answer well (based on query type, retrieved-chunk quality, and a confidence heuristic)
4. **Generate** — local SLM for simple/medium, escalate to cloud Claude for hard
5. **Ground** — every answer cites the source document + page/section, and shows the actual passage

Keep this in **C++ or well-obfuscated Python** — it's the part worth protecting.

### Cloud fallback

- **Claude Haiku** for most escalations (cheap, fast, good)
- **Claude Sonnet** for genuinely complex multi-document synthesis
- **Sarvam cloud** optionally for heavy Indian-language summaries
- Routed through Saravonix's proxy that validates the license first — this doubles as anti-piracy (see §7)

---

## 4. Bare-minimum vs recommended hardware

### Bare minimum (runs the 1.5B model)
| Spec | Requirement |
|---|---|
| CPU | x86-64 with AVX2 (any Intel from ~2013 / AMD from ~2015 onward) |
| RAM | **8 GB** |
| Disk | **5 GB** free |
| OS | Windows 10 64-bit or later (also Linux, macOS) |
| GPU | **Not required** |
| Internet | Only for activation + cloud fallback; local queries work fully offline |

### Recommended (comfortable, runs 3B model)
| Spec | Requirement |
|---|---|
| CPU | 4+ cores, 2018 or newer |
| RAM | **16 GB** |
| Disk | **10 GB** free, SSD |
| Internet | Broadband for fallback |

### Performance expectations (set these honestly)
- A 1.5B Q4 model on a modern CPU: roughly **10–25 tokens/second**
- A typical 150-word summary: **~10–20 seconds**
- Query embedding + retrieval: **under 1 second**
- This is NOT instant like ChatGPT-on-a-server. Manage UX with streaming output and a clear "thinking" indicator. For a professional recalling a case, 15 seconds for a sourced summary is perfectly acceptable.

---

## 5. The local-first + cloud-fallback flow

```
User asks a question
        │
        ▼
Retrieve relevant document chunks (local, instant)
        │
        ▼
Is the query simple/medium AND are good chunks found?
        │
        ├── YES → Local SLM answers, grounded in chunks, with citations
        │         (cost: ₹0, fully offline, ~10-20 sec)
        │
        └── NO (complex synthesis / weak local answer / user wants "deep")
                  │
                  ▼
            Check license + fallback budget at Saravonix proxy
                  │
                  ▼
            Send ONLY the question + retrieved snippets to Claude
            (never the whole document store)
                  │
                  ▼
            Claude answers, grounded, with citations
            (cost: ~₹1-3, metered against monthly budget)
```

**Escalation triggers:**
- Query requires synthesis across many documents
- Local SLM output is short, hedging, or low-confidence
- User explicitly taps "Deep analysis"
- Retrieved context exceeds local model's comfortable window

---

## 6. Accuracy & safety — CRITICAL for legal/audit

Small models hallucinate. For legal and audit work, a confident wrong answer is a liability. The design must prevent this:

1. **Never let the model free-generate facts.** Every answer must be grounded in retrieved passages. If nothing relevant is retrieved, the answer is *"I couldn't find that in your documents"* — never a guess.
2. **Always show the source.** Every answer displays the document name, page/section, and the actual passage it drew from. The professional verifies with their own eyes.
3. **Citations are mandatory, not optional.** No citation → no answer shown.
4. **Confidence signalling.** If the model is uncertain, say so plainly and suggest the deep (Claude) analysis.
5. **No legal/financial advice.** The app recalls and summarizes the customer's own records. It does not advise. The EULA states this clearly to limit liability.

This grounding discipline is also a *feature*: "every answer points to the exact page in your own file" is exactly what a lawyer or auditor trusts.

---

## 7. Licensing & anti-piracy

You asked about PyArmor and anti-resell. Here's a layered approach — no single layer is unbreakable, but together they make piracy not worth the effort:

| Layer | What it does | Strength |
|---|---|---|
| **PyArmor obfuscation** | Scrambles the Python bytecode | Stops casual copying; determined crackers can still work at it |
| **C++ core for the orchestrator + license check** | Compiles the valuable logic to a binary | Much harder to reverse than Python |
| **Node-locked license** | Ties the license key to the machine's hardware ID | Can't copy the install to another machine |
| **Cloud-validated fallback** | The Claude fallback only works if the proxy validates the license | **Strongest layer** — crack the local app, you still lose the cloud intelligence and the license dies |
| **Subscription expiry** | App deactivates cloud features + (optionally) locks after non-renewal | Enforces the yearly model (same cron pattern you use for GUHA) |
| **Legal EULA** | No-resale, no-redistribution, node-lock, single-practice clauses | The legal backstop |

**The key insight:** your real anti-piracy isn't the obfuscation — it's that (a) the cloud fallback requires Saravonix's living license, and (b) the customer's accumulated *memory* is the value, and that's theirs and grows over time, so there's nothing worth reselling. The model is a free commodity anyone can download. Reselling your wrapper gains a pirate little, while losing the cloud brain and the AMC updates.

### Legal terms outline (for your lawyer to formalize)
- Annual subscription, non-transferable, single-practice / single-node license
- No resale, no redistribution, no sublicensing
- Customer data stays on customer's machine; Saravonix has no access (a selling point AND a liability shield)
- No warranty of legal/financial accuracy; tool is for recall/summary, not advice
- Auto-deactivation of cloud features on non-renewal
- IP (engine, model packaging, orchestration) remains Saravonix property

---

## 8. Unit economics & pricing

Your idea: yearly subscription with a $5-8/month Claude fallback budget inside. Let me model the margin honestly.

**Reality of usage:** with local-first design, ~85-90% of queries cost ₹0 (handled on-device). Only the hard 10-15% hit Claude. So actual cloud cost per user is typically **$1-3/month**, with $5-8 as a generous ceiling.

| Scenario | Yearly price | Claude budget (cap) | Typical actual cloud cost | Gross margin |
|---|---|---|---|---|
| Solo lawyer / individual | ₹7,999/yr (~$8/mo) | $5/mo cap | ~$1.5/mo | Healthy if usage stays local |
| Small practice (2-5) | ₹19,999/yr | $8/mo cap | ~$3/mo | Strong |
| Power user add-on | +₹3,000/yr | $15/mo cap | varies | Pass-through |

**Recommendation:** Price the solo tier so the subscription comfortably exceeds the *typical* cloud cost, not the cap. Use the cap as a fair-use ceiling — if a user blows past it, they're a power user and you upsell. Local-first economics are the whole reason this is profitable: you're not paying cloud costs for routine recall.

**Two pricing-model options:**
- **Flat yearly** (simplest for Indian buyers who dislike metering): one price, fair-use cloud cap, deactivate at renewal.
- **Yearly + metered overage** (if power users emerge): base yearly + pay-as-you-go beyond the cap.

Start flat. Add metering only if data shows power users.

---

## 9. Build phases

### Phase 0 — Proof of concept (1-2 weeks)
A command-line / minimal-UI prototype on your own laptop:
- Ingest a few PDFs
- Embed with BGE-m3, store in sqlite-vec
- Retrieve + answer with Qwen2.5-1.5B via llama.cpp
- Grounded answers with citations
- **Goal:** prove the quality is good enough on real legal/audit documents

### Phase 1 — Desktop MVP (4-6 weeks)
- Real desktop UI (Tauri recommended — lighter than Electron, Rust+web, small binary)
- Drag-drop ingestion for PDF/DOCX/CSV
- The agentic orchestrator with local-vs-cloud routing
- Cloud fallback through a basic Saravonix proxy
- Basic license key + node lock
- **Goal:** a usable app a friendly solo lawyer can pilot

### Phase 2 — Licensed release (4-6 weeks)
- PyArmor + C++ core hardening
- Full license server (node-lock, expiry, fallback metering)
- Installer (PyInstaller → signed .exe; .dmg for Mac)
- Sarvam-1 option for Tamil-heavy users
- TACO hooks for per-customer workflow tweaks
- EULA + legal terms
- **Goal:** sellable product

### Phase 3 — Fine-tune (optional, only if data justifies)
- Collect (with consent) examples of good legal/audit summaries
- QLoRA fine-tune the chosen SLM for the domain
- **Goal:** better local quality, less cloud escalation, lower cost

---

## 10. Risks & honest cautions

1. **Small-model quality on legal/audit text.** SLMs are weaker than GPT-class models. The grounding discipline (§6) is what makes this safe — never let the model invent. Pilot with real documents before selling.
2. **CPU speed.** 15 seconds per summary is fine for recall, not for rapid chat. Set expectations and design the UX around it (streaming, clear progress).
3. **PyArmor is breakable.** Don't over-rely on it. The cloud-validation + node-lock + "the value is the customer's own data" are the real protections.
4. **OCR for scanned documents** is heavy and imperfect. Make it optional; many legal/audit docs are scanned, so test this path carefully.
5. **Support burden.** Desktop software on varied hardware generates support tickets. The AMC model must price this in. Keep a remote-diagnostics hook (with consent).
6. **Model licensing.** Verify the chosen open model's license permits commercial redistribution (most do — Qwen, Llama, Sarvam have permissive terms — but confirm the exact version's license at build time).

---

## 11. Open decisions for KB

1. **Name** for this product (your Tamil/divine tradition — the "keeper of memory" concept)
2. **Standalone product, or the local engine inside FlowHub?** I'd suggest: ship standalone for solo professionals (low entry price, big TAM), AND use the same engine as FlowHub's memory layer. One codebase, two go-to-markets.
3. **Default model** — Qwen2.5-1.5B (speed) vs Sarvam-1 (Tamil). Or ship both and let the installer choose.
4. **Desktop framework** — Tauri (lighter, my recommendation) vs Electron (more familiar, heavier)
5. **Fallback provider** — Claude only, or Claude + Sarvam-cloud for Indian languages?
6. **Pricing model** — flat yearly vs yearly + metered overage
7. **Pilot customer** — which friendly solo lawyer or CA can test Phase 1?

---

## 12. My recommendation

Build **Phase 0 first, this week,** on your own laptop. Before committing to UI, licensing, or pricing, prove the single most important thing: *does a 1.5B model + RAG give a solo lawyer accurate, sourced answers from their real case files?* If yes, everything else is engineering. If the quality isn't there yet, we adjust (bigger model, better retrieval, more cloud escalation) before spending on packaging.

Prove the brain. Then build the body.

---

*யாமிருக்க பயமேன்*
*Saravonix Technologies · Built Right · Held Secure*
