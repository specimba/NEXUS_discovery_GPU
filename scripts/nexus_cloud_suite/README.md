# NEXUS cloud suite (Intern A100 / A800)

Deeper training path beyond micro matmul ticks.

## Pipeline
1. `hf_dataset_deep_search.py` — HF Hub search (tool/safety/reasoning/code/MCP)
2. `build_nexus_sft_mix.py` — mix local D:/cloud shards + synthetic security/tool edges
3. `train_and_stress.py` — TinyLM train on mix + matmul ladder + EMA merge dry-run + edge battery
4. `run_suite.py` — orchestrate + upload to `reports/<SESSION>/cloud_suite/`

## On cloud VM
```bash
export T=$GITHUB_TOKEN R=specimba/NEXUS_discovery_GPU SESSION=session4 TICK=1
export NEXUS_DATA=/data/NEXUS
# optional: export HF_TOKEN=...  (never commit)
cd /data/NEXUS/git_backups/work/scripts/nexus_cloud_suite
python3 run_suite.py
```

## Local D: alignment
- Datasets: `D:\NEXUS_MODELS\datasets\` (glaive, hermes, APIGen, UltraInteract, …)
- Research: `Documents\NEXUS\docs\research\HF_HUB_DEEP_SEARCH_2026-06-22.md`
- Plan venue: A800 for TokenHD later; A100 for suite while timed

## Security
See `SECURITY.md`. Tokens env-only. No gated-data bypass.
