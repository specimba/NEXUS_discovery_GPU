# GPU Priority Execution Plan (from V1–V4)

**Date:** 2026-07-11 · **Author:** Grok 4.5 · **Venue:** Intern A800 unlimited  

Live: GH ticks through **13** · A800-SXM4-80GB · conveyor healthy  

---

## Priority ladder (GPU-first)

| P | Work | Why GPU / A800 | Source docs |
|---|------|----------------|-------------|
| **P0** | Keep longrun healthy (ticks 14+) | Without conveyor, nothing durable | V1, Manifest §11 |
| **P0** | TokenHD **label gravity** on project disk | Data before train; needs HF + disk not full 80GB train yet | V2, V2.1, V4 |
| **P1** | TinyLM/health ticks every phase | CUDA + GH proof + Project% growth | V1 |
| **P1** | Crown **public** pull: xLAM-60k, ToolACE, When2Call (small–medium) | Tool elevation; fits A800 disk before Toucan full | V4 |
| **P2** | Toucan-1.5M **sample/subset** first | Crown jewel but huge — staged download | V4 |
| **P2** | SWE OpenHands / agent traj **sample** | Coding-agent elevation | V4 |
| **P3** | TokenHD train v0 (Qwen3-0.6B) | Product organ; after labels land | V2 T2, V3 NX-01 |
| **P3** | Operator paid traces forge (Fable5/Claude DeepReason → JSONL) | Private edge; CPU/A800 prep | Manifest §11.4, V4 |
| **P4** | F-2 dark eval + weight flip | Operator gate — not automatic | V3 week 3–4 |
| **P4** | DPO / RIFT / Trinity verifier | Only F-2 green | V3 |

**Not on GPU queue:** 1T foundation models, public vanity leaderboards, multi-account scrape.

---

## A800 tick policy (smart)

```
Every tick:     health train (TinyLM 500) + GH LATEST  → conveyor
Every 3rd tick: + data gravity cell (HF snapshot of priority packs)
Later ticks:    TokenHD train job when labels present
```

Disk: project path `/home/mw/project/NEXUS_session4/datasets/`  
GH: `reports/session4/a800/` only metrics + small JSON (not full datasets)

---

## Data gravity pack order (download on A800)

1. `KRLabsOrg/lettucedetect-code-hallucination`  
2. `Ivan1008/toolace-hallucination-spans`  
3. `marrita/toolace-tool-calling-hallucination-ragtruth`  
4. `nvidia/When2Call`  
5. `lockon/xlam-function-calling-60k` (or Salesforce if token gated OK)  
6. `lockon/ToolACE` (or Team-ACE)  
7. Toucan / SWE trajs — **subset or later** (size)

---

## Success this session

- [x] Conveyor to tick 13+  
- [ ] Data gravity mode in driver  
- [ ] First `A800_DATA_*` GH report after pull  
- [ ] Priority plan on GH + ARCHIVIST  

---

*Grok 4.5 · GPU-first queue under NEXUS_MANIFEST (organs, not 1T)*
