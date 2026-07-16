# KILO_TASK (Cline / Vincent OFF)

## Operating mode
- **Primary agent:** Kilo Code (history + tool use when model/provider available)
- **Orchestrator:** CDP automation on the **existing** code-server tab only
- **Skip forever this session:** Cline (redirect/login broken), Vincent (cannot login)

## Hard constraints
1. torch **2.4.0+cu124 FREEZE** — never upgrade torch/CUDA
2. Never install **trl ≥ 1.x** (FSDPModule break)
3. Prefer JuiceFS + **jsDelivr** (VM bandwidth low)
4. Compute points nearly empty until top-up — no heavy downloads

## Verified baseline
- dpo_lines: **150**
- dryrun_marker: **True** (manual_dpo_torch24 earlier)
- HF whoami was **specimba**
- Extensions: Kilo + Jupyter + ms-python present

## Autonomous next (when points land)
1. Read `KILO_PROGRESS.json` + `COVERAGE_INDEX_LATEST.json`
2. Optional: longer DPO steps (still TRL-free script `scripts/dpo_dryrun_v7.py`)
3. Scale model only if weights already in `hf_cache`
4. Update MISSION_STATUS.md after each step

## Collaboration protocol
- Kilo: plan / edit / terminal when user or automation queues a short task
- CDP host: inject short terminal one-shots if Kilo chat empty or blocked by marketplace modals
- Never open new browser tabs for the same IDE URL
