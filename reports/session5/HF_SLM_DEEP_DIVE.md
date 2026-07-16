# HF Hub deep dive — NEXUS SLM factory shortlist

**Stamp:** 2026-07-16  
**Criteria:** deploy on **8 GB VRAM**; train/merge/export on **A100-80GB**; no 27B+ product path.  
**Method:** `huggingface_hub` multi-query list (`scripts/hf_slm_deep_search.py`) → **523** unique hits under size filter, curated into roles.  
**Doctrine:** A100 = factory; local 8 GB = product (FABLE5 / LOCAL_SLM_STACK).

---

## 1) Highest-value finds (play / merge / combine)

### A. Guard cascade (L0–L2) — **priority factory targets**

| Model | Size class | Why NEXUS | Play mode |
|-------|------------|-----------|-----------|
| [`meta-llama/Prompt-Guard-86M`](https://huggingface.co/meta-llama/Prompt-Guard-86M) | **86M** | Tiny **injection/jailbreak classifier** — always-on L0; fits CPU or pin GPU | Combine with voters; train head on NEXUS attack dict |
| [`meta-llama/Llama-Prompt-Guard-2-86M`](https://huggingface.co/meta-llama/Llama-Prompt-Guard-2-86M) | 86M | Next-gen prompt guard family | A/B vs 86M v1 on stress pack |
| [`meta-llama/Llama-Guard-3-1B`](https://huggingface.co/meta-llama/Llama-Guard-3-1B) | **1B** | Canonical content risk guard (plan L2) | **DPO/SFT on A100** with v8 pairs; export GGUF |
| [`Qwen/Qwen3Guard-Gen-0.6B`](https://huggingface.co/Qwen/Qwen3Guard-Gen-0.6B) | **0.6B** | **New official Qwen guard** — same family as our train stack | Strong candidate to **replace plain Qwen2.5-0.5B DPO backbone** |
| [`walledai/walledguard-edge`](https://huggingface.co/walledai/walledguard-edge) | **0.6B** | Plan L1; multilingual jailbreak claims vs LlamaGuard-1B | Keep as voter; optional continued train |
| [`ibm-granite/granite-guardian-3.2-3b-a800m`](https://huggingface.co/ibm-granite/granite-guardian-3.2-3b-a800m) | **3B-A800M MoE** | Risk detection + **verbalized confidence**; GGUF ports exist | L3 confirmer when VRAM budget allows; **Apache** |
| [`huihui-ai/Qwen2.5-0.5B-Instruct-CensorTune`](https://huggingface.co/huihui-ai/Qwen2.5-0.5B-Instruct-CensorTune) | 0.5B | Safety SFT recipe on **same base we train** | Study method; **don’t** use as sole generator (over-refuse risk) |

**Novel combo:**  
`Prompt-Guard-86M (hard filter) → WalledGuard-Edge + Qwen3Guard-0.6B (vote) → Llama-Guard-1B or Granite-Guardian (confirm)`  
Safety outside task SLM (Fable5 classifier-routing pattern).

---

### B. Anchors & embeds (always-on, tiny)

| Model | Role | Notes |
|-------|------|--------|
| [`google/functiongemma-270m-it`](https://huggingface.co/google/functiongemma-270m-it) | Intent / tool-select | Plan Tier0; unsloth GGUF variants exist |
| [`Qwen/Qwen3-Embedding-0.6B`](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B) | Embed / retrieval | High downloads; GGUF available |
| [`Qwen/Qwen3-Reranker-0.6B`](https://huggingface.co/Qwen/Qwen3-Reranker-0.6B) | Rerank | Fits SLM cascade for memory/RAG |

*(bashgemma / Mythos-nano / refinedtoolcall — verify card live; some plan IDs may be private/renamed)*

---

### C. Task SLMs (rotate 2–2.5 GB)

| Model | Role | Notes |
|-------|------|--------|
| [`WeiboAI/VibeThinker-3B`](https://huggingface.co/WeiboAI/VibeThinker-3B) | Math/code **reasoning** | Strong 3B; **explicitly NOT tool/agent trained** |
| [`Qwen/Qwen2.5-Coder-3B-Instruct`](https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct) | Code | Clean Apache-ish stack mate for LoRA |
| [`Qwen/Qwen2.5-Coder-0.5B-Instruct`](https://huggingface.co/Qwen/Qwen2.5-Coder-0.5B-Instruct) | Micro-coder | Factory distill target / draft |
| [`NousResearch/Hermes-3-Llama-3.2-3B`](https://huggingface.co/NousResearch/Hermes-3-Llama-3.2-3B) | Tool/agent format | Hermes tool schema; GGUF ports (bartowski) |
| [`huggermax/VibeThinker-3B-tool-calling-GGUF`](https://huggingface.co/huggermax/VibeThinker-3B-tool-calling-GGUF) | Tool on Vibe | Plan-aligned hybrid |
| [`RefinedNeuro/VibeThinker-3B-Hermes-GGUF`](https://huggingface.co/RefinedNeuro/VibeThinker-3B-Hermes-GGUF) | Hermes+Vibe | Use **Q6_K+** for tool fidelity (card) |
| [`mradermacher/fable-qwen2.5-3b-agentic-merged-heretic-i1-GGUF`](https://huggingface.co/mradermacher/fable-qwen2.5-3b-agentic-merged-heretic-i1-GGUF) | **Merged** agentic Qwen2.5-3B | Play as **mergekit reference** (license: check parents) |
| [`google/gemma-3-1b-it`](https://huggingface.co/google/gemma-3-1b-it) | Tiny general | Pin budget alternative to 0.5B Qwen |
| [`Andycurrent/Gemma-3-1B-it-GLM-4.7-Flash-Heretic-Uncensored-Thinking_GGUF`](https://huggingface.co/Andycurrent/Gemma-3-1B-it-GLM-4.7-Flash-Heretic-Uncensored-Thinking_GGUF) | 1B uncensored task | Plan Tier1 pre-filter / task rotate — **outer guards mandatory** |

**Merge play (A100):**  
VibeThinker-3B (reason) ⊕ Hermes-3-3B (tools) via **TIES/DARE** → single GGUF; safety stays in guard voters (LOCAL_SLM SAMM α=0.3).

---

### D. Speculative / draft (make 3B *feel* faster on 8 GB)

| Model | Notes |
|-------|--------|
| [`AngelSlim/Qwen3-1.7B_eagle3`](https://huggingface.co/AngelSlim/Qwen3-1.7B_eagle3) | **EAGLE-3 draft for Qwen3-1.7B** — same family, deployable |
| [`z-lab/Qwen3.6-35B-A3B-DFlash`](https://huggingface.co/z-lab/Qwen3.6-35B-A3B-DFlash) | DFlash for **large** MoE — learn recipe; draft heads may inform **small** draft train |
| [`yuhuili/EAGLE3-LLaMA3.1-Instruct-8B`](https://huggingface.co/yuhuili/EAGLE3-LLaMA3.1-Instruct-8B) | Reference EAGLE-3 (target 8B — heavy for home) |

**Novel:** train/export a **0.5B–1.7B draft** for local **3B target** (not train 35B).

---

### E. Adapters / DPO recipes (factory toys)

| Model / pattern | Notes |
|-----------------|--------|
| [`shawhin/Qwen2.5-0.5B-DPO`](https://huggingface.co/shawhin/Qwen2.5-0.5B-DPO) | Public DPO on **same base** as session5 train |
| [`steven0226/qwen2.5-0.5b-dpo-ultrafeedback`](https://huggingface.co/steven0226/qwen2.5-0.5b-dpo-ultrafeedback) | UltraFeedback-style adapter path |
| Many `qwen2.5-3b-*-lora` (GSM8k, medical, domain) | **Domain LoRA bank** pattern — NEXUS should own **guard/tool/code** LoRAs |

**A100 play:** multi-adapter train in one session → promote only winning LoRAs to `D:\NEXUS_MODELS\loras`.

---

### F. Bases worth switching to (vs current 0.5B canary)

| Base | Why switch / keep |
|------|-------------------|
| **Qwen3-0.6B / Qwen3-1.7B** | Newer family; pair with **Qwen3Guard-0.6B** + EAGLE draft |
| **Qwen2.5-0.5B-Instruct** | Current; 900+ finetunes / 677 adapters on hub — ecosystem mature |
| **Qwen2.5-1.5B / 3B** | Step up when guard metrics plateau |
| **unsloth/Qwen2.5-0.5B-Instruct** | Fast FT recipes (if unsloth env repaired) |

---

## 2) Combine recipes (concrete)

### Recipe 1 — Guard factory (now)
1. Teacher labels optional (cloud free tier).  
2. Student: **Qwen3Guard-0.6B** or **Qwen2.5-0.5B** + v8 hard pairs.  
3. Eval: holdout + stress (OR/SORRY/HarDBench-style).  
4. Export GGUF; load next to Prompt-Guard-86M.

### Recipe 2 — Dual brain local (8 GB rotate)
- Pin: FunctionGemma + Prompt-Guard-86M + Embed-0.6B  
- Rotate: VibeThinker-3B Q4 **or** Hermes-3-3B Q4  
- Never load uncensored task without guard voters first

### Recipe 3 — Merge kit night (A100)
- Parents: VibeThinker-3B + Hermes-3-3B (+ optional Coder-3B)  
- Method: TIES / DARE; SAMM α≈0.3 safety-bounded if merging safety into task  
- Gate: tool-call fidelity + over-refusal on holdout

### Recipe 4 — Draft accelerate
- Target: Qwen2.5-3B or Qwen3-1.7B  
- Draft: train/adapt EAGLE-3 / small Qwen draft  
- Serve local llama.cpp / vLLM when stack ready

---

## 3) Avoid / quarantine

| Pattern | Reason |
|---------|--------|
| 27B / 35B / 122B “heretic GGUF” as **local product** | Breaks 8 GB; PCIe thrash (plan already rejected 35B) |
| Fable/Claude/GPT **distill weights** as train parents | **License partition** (LOCAL_SLM correction 7) |
| Single uncensored 1B as only gate | Plan: multi-voter; one gate never enough |
| CensorTune-only generator | High over-refusal; use as **guard signal**, not task SLM |

---

## 4) Suggested next A100 experiments (ordered)

1. **Baseline swap:** continue long DPO on **Qwen3Guard-0.6B** or dual-track vs Qwen2.5-0.5B with same v8 pairs.  
2. **Classifier pin:** download Prompt-Guard-86M; add to local cascade smoke.  
3. **Tool track:** Hermes-3-3B or Vibe+Hermes GGUF tool eval (not train yet).  
4. **Merge dry-run:** mergekit config only on A100 after unsloth/mergekit env green.  
5. **EAGLE draft:** AngelSlim Qwen3-1.7B_eagle3 smoke if serving path exists.

---

## 5) Search stats

- Queries: 40+ HF list_models sorts by downloads  
- Unique under size filter: **~523**  
- Role buckets (approx): base 215 · code 96 · guard 73 · tool 56 · uncensored 43 · draft 22 · adapter 11 · embed 5  

Raw script: `scripts/hf_slm_deep_search.py` · probe: `scripts/hf_probe_shortlist.py`
