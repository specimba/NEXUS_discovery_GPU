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
| Download refresh (pin b82e497) | DONE — 150 pairs + scripts |
| Install verify (no trl) | DONE |
| Longer DPO 200 + save | DONE — two ckpts `step_200_20260716T144911Z` + `T145518Z` |
| LATEST_CKPT pointer | DONE |
| Coverage mirror session5 | DONE (this push) |

## Next (NEXUS-related)
1. **500-step stretch** with save + loss curve log
2. **Optional** small eval prompt set vs base model
3. **SCP guard skills** only when hub auth works (do not block train)
4. Keep ignoring Google / Vincent


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
