# A100-80GB for NEXUS SLM needs — not giant models

**Stamp:** 2026-07-16  
**Sources (grounded this session):**
- `docs/plans/NEXUS_LOCAL_SLM_STACK_PLAN_2026-07-08.md` (Fable5-ported antigravity design)
- `docs/plans/NEXUS_MODEL_USAGE_PLAN_2026-07-10.md` (antiGRAV-11 distill)
- `Downloads/ARCHIVIST/NEXUS_FABLE5_30H_GROUNDING_ADVISORY_2026-07-13.md`
- `Downloads/ARCHIVIST/NEXUS_FABLE5_8H_REVIEW_WAVE2_2026-07-13.md`
- `Downloads/ARCHIVIST/NEXUS_MASTER_WALKTHROUGH_AND_MISSION_DOC_2026-07-14.md` (NXM-020→032 ladder)
- `nexus_os/research/fable-5-deep-dive.md` (Fable5/Mythos safety architecture patterns)
- session5 `METHODS_LEARNING_BRIEF.md` (DFlash/EAGLE/HarDBench for SLM serve)
- Live constraint: **local 8 GB VRAM** — no 27B / Qwen3-class local; cloud elevation only for frontier

**Non-goal:** Fill A100 to 90% for vanity occupancy, or train large models we cannot serve at home.

---

## 1. What “success” means for NEXUS

```
Local 8GB card (always the product):
  L0 anchors 270M (~0.7GB)
  + L1 guard stack ≤1–1.5GB (multi voter, not one gate)
  + L2 task SLM rotation 2–2.5GB (3B-class)
  = ≤3.5GB active  →  room left for OS/browser
  → escalate cloud free-frontier only when trust/quality gate says so
```

**Fable5 insight to steal (not the model weights):** classifier-routing safety  
(main SLM → safety classifiers → fallback) maps to NEXUS **guard voters outside the task SLM**, not “one big censored model.”  
**License law:** HelioAI/Fable-5-Distill & Claude/GPT-derived corpora = **reference-only**; train only permissive + operator-owned pairs.

---

## 2. Why A100-80GB exists in this program (FABLE5 / NXM ladder)

FABLE5 master doc cards (not ticks):

| Card | Mission | Product for 8GB |
|------|---------|-----------------|
| **NXM-020** | A800 frozen baseline M0 | Repro env + metrics |
| **NXM-022** | **M1 guard-DPO + pairs** | Specialized **0.5–1B guards** exportable as GGUF |
| **NXM-030** | M2 RIFT ablation | Prefer recipe that improves real guard metrics |
| **NXM-031** | M3 guard-v2 1000 | Promote LoRAs → `D:\NEXUS_MODELS\loras\` |
| **NXM-032** | M4 trace capture | Train on real NEXUS tool/agent traces |

FABLE5 30h advisory §4.7 / queue #12 (verbatim intent):  
> A800 should get **one concrete training mission (guard-DPO on validated FPR alarms)**  
> instead of keepalive ticks. Metric = **checkpoint lineage**, not tick count.

Wave-2: repair unsloth/mergekit before fancy merge; first mission after env repair = SERA/guard-DPO not OCR thrash.

**80 GB is a factory, not a product GPU.** Local 8 GB is the product.

---

## 3. How 80 GB is useful for SLMs (novel / high-leverage uses)

These **need** big VRAM temporarily even when deploy target is tiny:

| Factory use of A100 | Why 80 GB helps | Ships to 8 GB as |
|---------------------|-----------------|------------------|
| **Guard DPO / multi-voter training** (0.5–1.5B) | Long steps, mid-saves, eval loops, batch>1 | GGUF Q4/Q5 guards |
| **Teacher→student distillation** (cloud/teacher labels → 0.5–3B) | Large teacher forward + student train | Specialized task SLM |
| **Hard preference synthesis + judge** | Many parallel judge calls + pair build | v8+ jsonl (already started) |
| **LoRA / multi-adapter bank** for 3B task roles | Several adapters in one session | One adapter load locally |
| **Merge factory** (TIES/Task-Arithmetic/SAMM α=0.3) | mergekit peak RAM | Single merged GGUF |
| **Gabliteration / refusal-direction edit** on task SLMs | Full-weight experiments | Task model with safety in outer guards |
| **Trust-driven GRPO** (11-element `compute_score`) | Rollouts + ref model | Policy head / small adapter |
| **Speculative draft training** (EAGLE/DFlash-style **draft** SLM) | Train tiny drafter vs frozen target | Faster **local** serve of 3B |
| **Frozen eval pack** (OR/SORRY/HarDBench stress) | Throughput overnight | Promotion gate before D: copy |
| **Batch export** (HF → GGUF multi-quant matrix) | Parallel quant | Files ready for Ollama |

**Not useful for NEXUS product:** training 27B “because VRAM is free,” then never loading it on 8 GB.

---

## 4. Why ~50% util / ~8% VRAM is OK *for current recipe* — and what to change

Current live job: **Qwen2.5-0.5B** manual DPO, batch≈1, max_len 384, v8 pairs.  
That **is** SLM-aligned, but **under-uses the factory** for NEXUS value:

- 50% util = small model + sequential loop (not failure)
- 8% VRAM = correct for 0.5B; **raising to 90% by padding is wrong**
- Right way to use more of 80 GB for **our** needs:
  1. **Larger batch / longer context** on the **same** 0.5–1B guard  
  2. **Multi-adapter / multi-role** train in one session  
  3. **Distill/merge** jobs that peak higher then export small  
  4. **Parallel eval** + train (CPU pipeline already: `pipeline_dpo_v8`)  
  5. Optional **3B LoRA** (fits train on A100; deploy Q4 on 8 GB)

**Never** equate “util 90%” with “better for NEXUS.” Prefer **checkpoint that improves guard FPR/recall on frozen pack**.

---

## 5. Redirect map — from today’s canary ladder → NEXUS factory

| Now (session5) | Keep? | Next (NEXUS-aligned) |
|----------------|-------|----------------------|
| 0.5B DPO long run + SAVE | Yes as **guard backbone canary** | Target **named guard roles** (WalledGuard-edge class, Llama-Guard-1B path) |
| v8 train/holdout pairs | **Yes** | Expand with HarDBench/RedBench-style **rejected** + **over-refusal balance** (OR-Bench) |
| Mid-run SAVE_EVERY=500 | Yes | Export GGUF after each promoted step |
| Short 20-step waves | **No** | Dead per FABLE5 “ticks ≠ progress” |
| 27B / full Qwen3.6 local | **No** | Cloud elevation only |
| DFlash/EAGLE serve | Later | Train **draft SLM** for local 3B speed, not train 70B target |

### Preferred model targets (8 GB-serveable)

| Role | Train on A100 | Deploy local |
|------|---------------|--------------|
| Intent / CLI anchors | light SFT optional | FunctionGemma / BashGemma 270M |
| Guard voters | **DPO / GRPO primary** | 0.3–1B class (multi voter) |
| Task coder | LoRA on 3B | VibeThinker-3B family Q4 |
| Task tools | LoRA on 3B tool-caller | refinedtoolcallv5-3b class |
| Task “uncensored brain” | careful abliteration + outer guards | Mythos-nano-OBLITERATED class footprint |

---

## 6. Novel approach package (what “interesting” means here)

1. **Governance outside the generator** (Fable5 classifier pattern → multi-guard voters).  
2. **License-clean preference factory** (v8 pipeline + OG-3 license resolution before scale).  
3. **Specialist daisy-chain** (antiGRAV / DaisyChain idea): many sharp SLMs + router, not one giant.  
4. **Merge factory on A100 → single GGUF home** (TIES + SAMM safety-bounded).  
5. **Draft SLM for local speed** (DFlash/EAGLE papers → accelerate 3B serve on 8 GB, not A100 vanity).  
6. **Promotion gate**: frozen eval pack + stress (`nexus_guard_stress_test`) before `D:\NEXUS_MODELS\loras`.

---

## 7. Immediate operating rules (this GPU session)

1. Keep continuous **guard-oriented** SLM train (0.5–1.5B) with v8+ hard pairs — not idle, not 27B.  
2. Prefer **checkpoint dirs + holdout metrics** over discovery util %.  
3. After REAL_V8_5000: pull trainer with mid-save; run **named mission** `guard_v8_dpo` with SAVE_EVERY=500.  
4. Stage GGUF export script path for promote-to-8GB (next code slice).  
5. Do not thrash Cline/SQL UI; factory = terminal + JuiceFS artifacts.

---

## 8. One-line doctrine

**A100-80GB = NEXUS SLM factory (specialize, merge, eval, export).  
Local 8 GB = NEXUS product (rotate small specialists).  
Frontier 27B+ = cloud elevation only.**
