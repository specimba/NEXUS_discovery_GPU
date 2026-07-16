# A100-80GB long-horizon factory plan — Merge · Tool-eval · Frontier traces · SLM product

**Stamp:** 2026-07-16 (long-run revision)  
**Audience:** NEXUS operator + GPU lane  
**Cloud resource:** Intern / Discovery **A100-SXM4-80GB** (not the product card)  
**Product card:** local **~8 GB VRAM** SLM cascade  

### Doctrine correction (this revision)

| Old over-strict line | **Corrected research stance** |
|----------------------|-------------------------------|
| “Fable/Claude distill = trash / never touch” | **Wrong for research.** Full **weight clones** of closed frontier are a **legal/ops risk** if redistributed as if open. **Frontier traces, transcripts, tool trajectories, and Sol/Fable session outputs from our paid usage** are **first-class training fuel** — they are **ours** as generated under our accounts for **NEXUS-specific** specialization. |
| Random public UltraFeedback | Useful baseline, **lower priority** than **NEXUS-native** trajectories (CLI, CDP, ModelRelay, guard alarms, agent runs). |
| Only TIES/DARE | **False.** Paper + mergekit stack has **many** methods (see §3). ARCHIVIST already points at SLERP, Task Arithmetic, TIES, DARE-sparsified guard merging, soups, etc. |

**Rule of thumb:**  
- **Experiment freely** with frontier **behaviors** (traces, prefs, critiques, tool schemas).  
- **Ship product weights** only from **permissive bases + our deltas** (or clearly labeled research checkpoints).  
- **Do not** treat “license partition” as “throw away Fable/Sol science.”

---

## 1. Why 80 GB exists (NEXUS, not vanity 90% util)

```
LOCAL 8GB (product)          A100 80GB (factory)
─────────────────            ───────────────────
rotate 0.3–3B specialists    train / merge / judge / eval / export
guard voters always on       multi-parent mergekits, LoRA banks
GGUF Q4–Q6 serve             full bf16/fp16 parents + mid-saves
                             parallel tool-eval harnesses
                             distill from frontier TRACES (ours)
```

Success metrics (FABLE5-aligned):  
1. **Checkpoint lineage** (named dirs, LATEST_CKPT, GGUF promote)  
2. **Tool-call fidelity** (Hermes / MCP-style)  
3. **Guard metrics** (FPR/recall on frozen pack + NEXUS stress)  
4. **Merge ablations** (which method wins for *our* parents)  
**Not** GPU util % alone.

---

## 2. High-value path A — Tool eval (do this hard)

### 2.1 Why this is gold
NEXUS is **tool-native** (CLI, MCP, CDP, ModelRelay). A model that scores math but **malforms `<tool_call>`** is useless in cascade. Community already reports:

- **VibeThinker-3B** base: **not** trained for tool-calling; strong verifiable reasoning.  
- **Hermes-3-Llama-3.2-3B**: tool/agent format native.  
- **RefinedNeuro VibeThinker-3B-Hermes**: **LoRA** of Hermes-style tools **on Vibe base** (not weight-merge of Llama⊕Qwen). Card: use **Q6_K+** for tool fidelity; Q3–Q5 emit broken calls.  
- Reddit/local reports: Vibe with MCP tools **overthinks / wrong tool hesitation** — template + stop tokens matter.

### 2.2 Tool-eval harness (A100 or local; A100 for batch speed)

| Suite | What it measures | Gate |
|-------|------------------|------|
| **T0 Schema** | valid JSON / Hermes XML tool call parse rate | ≥95% well-formed |
| **T1 Single-call** | correct tool name + args on NEXUS fixtures | ≥80% |
| **T2 Multi-step** | 2–4 hop tool chains (relay → file → shell dry-run) | ≥60% |
| **T3 Poison** | refuses or flags bash/exfil tool abuse (guard in loop) | no silent exec |
| **T4 Over-call** | doesn’t spam tools on pure chat | low false tool rate |

**Models to score first (download GGUF / HF):**

1. `NousResearch/Hermes-3-Llama-3.2-3B` (+ bartowski GGUF)  
2. `RefinedNeuro/VibeThinker-3B-Hermes-GGUF` (Q6_K / Q8)  
3. `huggermax/VibeThinker-3B-tool-calling-GGUF`  
4. `refinedneuro/refinedtoolcallv5-3b`  
5. Baseline: stock `WeiboAI/VibeThinker-3B` (expect **poor tools**, good math)  
6. Baseline: `Qwen/Qwen2.5-Coder-3B-Instruct` raw (control)

**NEXUS-native fixtures (higher value than generic BFCL alone):**  
- ModelRelay health / model list tool  
- JuiceFS path list under `/data/NEXUS`  
- GPU snap / nvidia-smi wrapper (read-only)  
- CDP “list tabs” dry schema  
- Guard vote: “is this prompt jailbreak?” classifier call  

### 2.3 Output artifact
`workspace/TOOL_EVAL_MATRIX.json` + markdown table → decides **which tool SLM is pin for L2 rotate**.

---

## 3. High-value path B — Merge science (many methods, not one)

### 3.1 Technique catalog (≥10 — paper + mergekit ecosystem)

| # | Method | Core idea | Best when | Same arch required? |
|---|--------|-----------|-----------|---------------------|
| 1 | **Linear / Model Soup** | Average weights | same base, multi-seed FT | Yes |
| 2 | **SLERP** | Spherical interp on weight sphere | **exactly 2** parents | Yes |
| 3 | **Task Arithmetic** | \(θ = θ_0 + Σ λ_i(θ_i−θ_0)\) | shared pretrain ancestor | Yes |
| 4 | **TIES** | Trim · Elect sign · Merge | multi-task interference | Yes |
| 5 | **DARE** / **DARE-TIES** | Drop & rescale deltas | noisy multi-FT | Yes |
| 6 | **Breadcrumbs** | Mask small + large outliers | reduce interference | Yes |
| 7 | **DELLA** | Magnitude-based drop adaptive | multi-model | Yes |
| 8 | **Model Stock** | Geometric stock-like average | multi-checkpoint | Yes |
| 9 | **Fisher / RegMean** | Importance by Fisher / activation | when activations available | Yes (+ stats) |
| 10 | **WiSE-FT** | Interp pretrain ↔ FT | keep zero-shot + task | Yes |
| 11 | **Passthrough / Frankenmerge** | Layer-stack slices from parents | creative layer recipes | Same layer shapes |
| 12 | **FrankenMoE / mergekit-moe** | Experts + gate (not dense merge) | complementary skills | Expert arch compatible |
| 13 | **SAMM** (plan) | Safety-bounded merge α≈0.3 | safety + capability parents | Yes |
| 14 | **CABS / ZipIt!-class** | Conflict-aware / feature align | advanced research | Often yes / extra train |
| 15 | **FuseLLM / CALM-class** | Distill fuse **different** arch | **cross-family** | **No** — needs **extra training** |

ARCHIVIST anchors already in stack docs:  
- Task Arithmetic + TIES (LOCAL_SLM plan)  
- DARE-sparsified guard merging (dossier v3 P3)  
- SLERP deep notes in `SLMselectionDEEPdive.txt`  
- BashGemma-270M-**merged** as L0 pattern  

### 3.2 Hard constraint — architecture & tokenizer

**Community + mergekit consensus (mlabonne / arcee / LocalLLaMA):**

1. **Dense weight merge (1–11)** requires **same architecture family and size**: same hidden size, layers, head counts, and usually **compatible tokenizer / tied embeddings**.  
2. Different tokenizer → use mergekit `tokenizer.source: union | base | model` carefully; **bad tokenizer merge = fluent gibberish**.  
3. **Different families (Qwen vs Llama) cannot TIES/SLERP** into one dense net without **surgery or training**.  
4. Cross-arch “merge” that *works in the wild* is usually:  
   - **LoRA/SFT** of behavior A onto base B  
   - **MoE routing** (frankenMoE)  
   - **FuseLLM / distillation** (extra GPU train — **this is what 80 GB is for**)  
   - **Runtime cascade** (no weight merge): Vibe for math, Hermes for tools  

### 3.3 Case study: Vibe + Hermes + EAGLE

| Pair | Architectures | Dense mergekit? | Recommended NEXUS path |
|------|---------------|-----------------|------------------------|
| **VibeThinker-3B ⊕ Vibe-Coder siblings** | Both **Qwen2.5-Coder-3B lineage** | **YES** — TIES/DARE/SLERP/TaskArith | Primary **merge lab** on A100 |
| **Vibe ⊕ Hermes-3-Llama-3.2-3B** | **Qwen2.5 vs Llama-3.2** | **NO** (shapes/tokenizer differ) | **Already solved by community: LoRA Hermes tools on Vibe** (RefinedNeuro). Or **runtime cascade**. |
| **EAGLE / EAGLE-3 / DFlash “merge”** | Draft head ≠ full LM | Not a soup of two chat models | **Speculative stack**: train/attach **draft** for a **fixed target** (e.g. Qwen3-1.7B + AngelSlim eagle3) |
| **Guard 0.5B ⊕ Guard 1B** | Different sizes | NO dense | **Ensemble vote** at runtime (better for product) |
| **Multiple Qwen2.5-0.5B DPO runs** | Same arch | **YES** soup/TIES | Cheap merge of our own seeds |

**Conclusion:** The fascinating “Vibe+Hermes” path is **not** mergekit SLERP — it is **tool-specialization on the reasoning base** (LoRA/SFT) + optional **merge among Qwen-family specialists**. EAGLE is a **third axis** (speed), not a third dense parent.

### 3.4 Merge lab protocol (A100 night runs)

```
Phase M0  Repair env: unsloth + mergekit import gate (FABLE5 wave-2 debt)
Phase M1  Parents on JuiceFS (bf16): VibeThinker-3B, Qwen2.5-Coder-3B-Instruct,
          our guard DPO ckpts (0.5B/0.6B), optional Hermes only for LoRA teacher labels
Phase M2  Same-arch grid:
            - linear / soup
            - slerp (pairs)
            - task_arithmetic
            - ties
            - dare_ties
            - breadcrumbs / della (if mergekit version supports)
Phase M3  Score each merge on: tool suite (if tools LoRA applied), math smoke,
          guard holdout, over-refusal
Phase M4  Export winners → GGUF Q4/Q5/Q6 → promote candidates for 8GB
Phase M5  Cross-family: Hermes-style SFT/LoRA on Vibe (or FuseLLM distill later)
```

**VRAM note:** 3B×2–3 parents in mergekit out-of-core fits 80 GB easily; use `--allow-crimes` / shard if needed. 0.5B multi-seed soups are nearly free.

---

## 4. Frontier traces (Fable / Sol / paid usage) — how to use them *right*

### 4.1 What we keep and why
| Source | Ownership / value | Use on A100 |
|--------|-------------------|-------------|
| **Our Fable5 / Sol / Claude / GPT sessions** (paid) | **Our operational IP** for NEXUS workflows | Preference pairs, tool traces, critique pairs, routing labels |
| **NEXUS product logs** (relay, CDP, CLI, guard stress) | Highest domain match | Primary SFT/DPO/GRPO fuel |
| Public UltraFeedback / random HF | Commodity | Fillers / ablations only |
| Closed **weights** redistributed as open | Legal/ops risk | Research **reference only**, not default product ship |

### 4.2 Trace → training pipeline (novel NEXUS factory)

```
Paid frontier sessions + local agent runs
    → redact secrets (PAT/keys)
    → schema: {prompt, chosen, rejected, tools[], lane, trust}
    → license_class: operator_owned | public_permissive | reference_only
    → v9 pairs / tool trajectories
    → A100: DPO / SFT / GRPO on SLM students (0.5B–3B)
    → eval on NEXUS fixtures
    → GGUF home
```

This is **more valuable than random traces** because it encodes **our stack’s failure modes** (guard FPR, CDP thrash, relay 429, tool schema).

### 4.3 Distillation modes (research OK)

| Mode | Description | Product ship? |
|------|-------------|----------------|
| **Behavior distill** | Student mimics teacher **outputs** on NEXUS prompts | Yes if student base permissive |
| **Preference distill** | Teacher ranks A/B → DPO | Yes |
| **Tool-trace distill** | Teacher tool plans → Hermes SFT on Vibe | Yes |
| **Weight transplant** of closed model | Full param copy | **No** as open product; lab-only if ever |

---

## 5. Combined long-run A100 schedule (recommended)

### Wave 0 — always on
- Keep continuous **guard SLM train** (Qwen2.5-0.5B and/or **Qwen3Guard-0.6B**) with v8→v9 pairs (**NEXUS + frontier-trace** prefs).  
- Mid-save every 500 steps; honest GPU snaps.

### Wave 1 — Tool-eval (1–2 days wall, high ROI)
- Download 5–6 candidates; run T0–T4 harness on A100 (throughput).  
- Write `TOOL_EVAL_MATRIX`; pick **L2 tool pin**.

### Wave 2 — Vibe tool specialization (not Llama⊕Qwen soup)
- Start from best of: community Vibe-Hermes **or** fresh LoRA Hermes-format on Vibe using **our tool traces**.  
- Train on A100; export Q6_K for 8 GB.

### Wave 3 — Same-arch merge grid
- Parents: Vibe / Coder-3B / our LoRAs / multi-seed guards.  
- Run technique grid §3.4; rank by NEXUS metrics.  
- Document which of the **10+ methods** actually move *our* needles (paper ≠ automatic win).

### Wave 4 — Speculative draft (optional speed)
- Target: Qwen3-1.7B or 3B task pin.  
- Draft: AngelSlim eagle3 or trained tiny draft.  
- Measure tokens/s on A100 then on 8 GB.

### Wave 5 — Promote
- Winners → GGUF matrix → Ollama/llama-server pins → registry v3.  
- Guard multi-voter live; task rotate unload-before-load.

---

## 6. Compatibility cheat-sheet (quick)

| Want | Do this | Don’t do this |
|------|---------|----------------|
| Reason + tools in **one** 3B | LoRA/SFT tools on **Vibe (Qwen)** | TIES Vibe⊕Hermes-Llama |
| Multi-skill Qwen specialists | TIES/DARE/TaskArith/SLERP/… | Hope tokenizer “union” fixes arch mismatch |
| Faster local 3B | EAGLE/DFlash-style **draft** | Merge EAGLE weights into chat soup blindly |
| Safer generators | Outer **guard voters** + optional SAMM | One uncensored merge as only gate |
| Use Fable/Sol intelligence | **Traces → student SLM** | Ship closed weights as open NEXUS core |

---

## 7. Immediate next actions (no theatre)

1. **Tool-eval harness** script + fixture pack under `/data/NEXUS/eval/tools/`.  
2. **Download shortlist** to JuiceFS `hf_cache` (Hermes-3-3B, Vibe, Vibe-Hermes GGUF, Qwen3Guard-0.6B).  
3. **Continue guard DPO** on v8; start **v9 trace ingest** from NEXUS + paid session exports (redacted).  
4. **mergekit env gate** (`import mergekit`) before any merge night.  
5. First merge experiment: **two same-arch Qwen 0.5B/3B** seeds (prove pipeline) before fancy 5-way TIES.

---

## 8. One-line summary

**80 GB is for: (1) tool-fidelity specialization, (2) multi-method same-arch merges, (3) distill of *our* frontier+NEXUS traces into small students, (4) draft heads for local speed — not for 27B vanity or discarding Fable/Sol research.**

**Vibe+Hermes value is real — as LoRA/cascade/distill, not as illegal geometry merge across Llama and Qwen.**
