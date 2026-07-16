# PHASE_NEXT — post scale-100 (nb-253ef43e)

## Policy
- **Skip Google / Vincent logins** (known broken; not blocking train lane)
- Cline/Kilo optional helpers only
- Secrets only under `/data/NEXUS/.secrets/` (never git)

## Completed
| Phase | Status |
|-------|--------|
| Session bootstrap + workspace dir | DONE |
| Multi-mirror gold DPO stage (150) | DONE |
| Torch freeze 2.4.0+cu124 | DONE |
| transformers pin if no DTensor | DONE |
| Smoke 20 / scale 50 / scale 100 | DONE (finite losses) |
| TRL-free manual DPO | DONE |

## In progress / next (NEXUS-related)
1. **Download refresh** — re-pull gold + scripts + configs via jsDelivr/ghproxy
2. **Install verify** — torch/cuda/gpu inventory; pin transformers==4.46.3; accelerate; **no trl 1.x**
3. **Longer DPO** — 200 steps with `NEXUS_DPO_SAVE=1` → `checkpoints/dpo_guard_v7_canary/step_200_*`
4. **Checkpoint pointer** — `LATEST_CKPT.txt`
5. **Coverage mirror** — PHASE_LATEST / COVERAGE / MISSION → GitHub `reports/session5`
6. **Later** — 500-step stretch; SCP guard skill probes when hub auth works

## Host automation
```text
node C:/Users/speci.000/Documents/NEXUS/scratch/intern_phase_dl_install_long.mjs
# or
NEXUS_DPO_MAX_STEPS=200 node .../intern_phase_dl_install_long.mjs
```

## Success criteria
- dpo_lines=150
- steps=200, finite=true, ok=true
- torch 2.4.x+cu124, gpu A100
- checkpoint dir non-empty under JuiceFS
- no Google/Vincent dependency
