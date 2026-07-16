# Status snapshot (maintained)

- **GPU target:** NVIDIA A100-SXM4-80GB (Intern nb-582b5f51 / NEXUS-GPU-test2)
- **Torch (observed 2026-07-16):** 2.4.0+cu124 · cuda=True · stack freeze default
- **HF token on JuiceFS:** yes (path only — never commit)
- **DPO gold in repo:** `datasets/nexus_local/v7_dpo_pairs_fixed.jsonl`
- **Config:** `configs/dpo_a100_guard_v7.yaml` (20-step canary)
- **Session:** session4 longrun + OCR continuity save (parked OCR)
- **Remote:** https://github.com/specimba/NEXUS_discovery_GPU
- **Pull on A100:** `bash scripts/pull_and_stage.sh` from git work tree
