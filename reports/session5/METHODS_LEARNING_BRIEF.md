# METHODS_LEARNING_BRIEF — papers + DFlash + benchmarks (while A100 trains)

**Stamp:** 2026-07-16  
**Sources:** local `ARCHIVIST/PAPERS` (~877 PDFs, papers01–14 + gap-fill), ARCHIVIST dossiers v2/v3, NVIDIA/Z-Lab DFlash materials, arXiv 2602.06036.  
**Google Drive folder** `10IrK3uWFAuzObYJAQKAhmpZlQtfDE6gw`: MCP connector unavailable this session — re-pull when Drive auth works.

---

## 1. Local library map (what we already own)

| Cluster (filename heuristic) | ~PDF count | Role for NEXUS |
|------------------------------|------------|----------------|
| Agent / multi-agent | 147 | Swarm, A2A, tool protocols |
| Safety / red-team | 108 | Guard DPO negatives, stress |
| Benchmark / eval | 105 | How (not) to trust scores |
| Speculative decode | 13 | Inference acceleration |
| Diffusion LLM | 17 | Drafters for SD (SpecDiff, DART) |
| Routing / cost | 13 | Relay, GMR, token guard |
| Sandbox | 3+ | Runtime isolation |

**Spec / draft / accelerate cluster already on disk (high value):**
- Leviathan et al. — *Fast Inference via Speculative Decoding* (foundation)
- EAGLE / EAGLE-2 / EAGLE-3
- SPEED-Bench (NVIDIA) — production-realistic SD benchmark
- SpecDiff-2, DART, Draft-with-Diffusion, Block Diffusion Draft Trees
- HarDBench — draft-based co-authoring jailbreaks (safety × drafting)
- RedBench, SORRY-Bench, CAN WE TRUST AI BENCHMARKS
- Gap-fill pack: ProtocolBench, SandboxEscapeBench, routing surveys

---

## 2. Speculative decoding (core method)

**Problem:** Autoregressive decode is memory-bound; GPU compute underused.

**Classic SD (Leviathan 2023):**
1. Small **draft** model proposes K tokens  
2. Large **target** verifies in one parallel pass  
3. Accept longest correct prefix (rejection sampling)  
4. **Lossless** w.r.t. target distribution if done correctly  

**EAGLE family:** draft from target hidden features (feature-level speculation), not a full independent small LM. EAGLE-3 scales acceptance / depth.

**Diffusion-style drafters:** draft a **block** of tokens in parallel (not sequential draft). SpecDiff-2, DART, block-diffusion trees → higher draft parallelism.

---

## 3. DFlash (learn this deeply)

**Paper:** Chen, Liang, Liu — *DFlash: Block Diffusion for Flash Speculative Decoding* (arXiv:2602.06036, ICML 2026).  
**Code/models:** https://github.com/z-lab/dflash · HF `z-lab/dflash` · project z-lab.ai/dflash

### Idea
Replace autoregressive drafter with a **lightweight block-diffusion** model that predicts a masked future **block in one forward pass**, conditioned on target context.

### Three techniques
1. **Block-diffusion drafting** — parallel candidates (GPU-friendly)  
2. **Target hidden-state conditioning** — draft sees target’s context features  
3. **KV injection** — inject target KV into drafter layers (better acceptance as depth grows; skip re-modeling full context)

### Why it matters
- Claims **>6× lossless** acceleration; up to **~2.5× vs EAGLE-3** in paper setting  
- NVIDIA blog: up to **15× throughput** vs pure AR on Blackwell for large models at same interactivity; strong results on **SPEED-Bench** domains (coding, RAG, reasoning, …)  
- Integrated in **vLLM Speculators**, **SGLang**, **TensorRT-LLM** (config swap, not app rewrite)  
- Qwen-family checkpoints exist — relevant to our Qwen 0.5B/guard lane  

### NEXUS mapping
| Current A100 work | DFlash angle |
|-------------------|--------------|
| DPO canary train | Training quality / alignment |
| Inference later (guard cascade, agents) | SD/DFlash for **latency under load** |
| Stress / red-team loops | Faster multi-turn attack/defend sims |
| Qwen stack | Prefer Qwen DFlash draft checkpoints when serving |

**Not a replacement for DPO** — orthogonal: train better guards; serve them faster with DFlash/EAGLE.

---

## 4. Benchmarks — trust + which to use

### From local synthesis (papers02 + dossiers)
1. **Static benches contaminate** (MMLU/GSM8K/HumanEval scrape risk) → prefer **dynamic** (LiveBench, LiveCodeBench, DyVal) for capability claims  
2. **Evaluation awareness / sandbagging** (Mythos system card theme) → static “100% recall” can be inflated  
3. **Safety ⟂ capability** sometimes anticorrelated → don’t optimize only general scores  
4. **RedBench** — unified red-team taxonomy (37 sources → ~29k samples)  
5. **SORRY-Bench / OR-Bench** — over-refusal vs under-refusal tradeoff (critical for guards)  
6. **HarDBench** — draft co-authoring jailbreaks (harmful incomplete drafts) → great DPO **rejected** seed  
7. **SPEED-Bench** — SD-specific: diversity + throughput/concurrency splits + vLLM/TRT-LLM realism  
8. **SandboxEscapeBench / ProtocolBench** — agent runtime + protocol choice  

### Meta: *Can We Trust AI Benchmarks?*
Benchmarks are sociotechnical: contamination, gaming, construct validity, one-shot text bias. Use multi-bench + red-team + live traffic, not a single leaderboard.

---

## 5. Stress testing (what “good” looks like for NEXUS)

Layered stress, not one script:

| Layer | Method | Papers / tools |
|-------|--------|----------------|
| Preference quality | DPO canary finite loss + held-out pairs | current A100 lane |
| Jailbreak / multi-turn | TAP tree attacks, Crescendo, RedBench mix | papers02, dossiers |
| Draft abuse | HarDBench co-author complete-the-harm | papers09 |
| Over-refusal | OR-Bench / SORRY | papers02/06 |
| Agent runtime | SandboxEscapeBench, CVE-Bench | papers14 gap-fill |
| Serving | SPEED-Bench + concurrency sweeps | papers09 + NVIDIA |
| Contamination | shortcut neurons, 1-replica effects | papers02 synthesis |

---

## 6. Actionable NEXUS backlog (priority)

1. **Keep A100 DPO canary** (train/guard quality) — already green 20→200+  
2. **Seed DPO rejected from HarDBench + RedBench** categories (not only generic pairs)  
3. **Add eval pack:** OR-Bench subset + multi-turn jailbreak + evaluation-awareness probe  
4. **When serving guards:** pilot **EAGLE-3 then DFlash** on Qwen targets via vLLM Speculators; measure with **SPEED-Bench**-style tasks  
5. **Stress lab:** TAP mutation → DPO negatives; never trust single static bench  
6. **Drive folder:** when MCP works, mirror methods PDFs into `ARCHIVIST/PAPERS/papers15_drive`  

---

## 7. One-line takeaway

**Train** with DPO + adversarial preference data; **prove** with dynamic + red-team + over-refusal benches; **serve** with speculative decoding (EAGLE-3 → DFlash) measured on SPEED-Bench — three different jobs, three different method stacks.
