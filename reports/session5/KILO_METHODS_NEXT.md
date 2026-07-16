# KILO_METHODS_NEXT — post-refresh progression (nb-253ef43e)

**Stamp:** 2026-07-16T16:10Z  
**Session:** healthy after refresh · Cline YOLO · Kilo Code open (Hy3)

## 1) DPO canary ladder status
| Steps | Status |
|-------|--------|
| 20 / 50 / 100 | GREEN finite losses |
| 200 ×2 | GREEN + HF save |
| 300 | GREEN (`AUTO_CONTINUE_DONE`, loss ~0.25 end) |
| 500 | Launched (`cline_long_500.log`) — poll until done |

Stack: torch **2.4.0+cu124**, A100-80GB, gold **150** pairs, TRL-free manual DPO, transformers pin if no DTensor.

## 2) Next data (preference quality)
- Seed **rejected** from HarDBench (draft co-author jailbreaks) + RedBench taxonomy
- Keep gold 150 as holdout; grow train set with adversarial negatives only
- Never put secrets in jsonl/git

## 3) Next serve (orthogonal to train)
- Baseline: AR decode latency on A100
- Then **EAGLE-3** draft on Qwen target via vLLM Speculators
- Then **DFlash** block-diffusion draft (HF z-lab/dflash, Qwen family if available)
- Measure with SPEED-Bench-style domains + concurrency (not MT-Bench alone)

## 4) Eval pack (trust)
- OR-Bench / SORRY-Bench (over-refusal)
- Multi-turn jailbreak + HarDBench stress
- Avoid single static board claims (contamination / eval awareness)

## 5) Agent roles now
- **Terminal nohup:** heavy DPO 500 SAVE=1
- **Cline:** execute/poll train, write MISSION/COVERAGE
- **Kilo:** plan/docs (this file + ORCH notes); do not thrash Google login

## 6) Success when
- 500 finite + checkpoint under `checkpoints/dpo_guard_v7_canary/step_500_*`
- MISSION_STATUS lists 20→500 green
- Optional: draft `EVAL_PLAN.md` + `SERVE_DFLASH_PLAN.md` on JuiceFS
