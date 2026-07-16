# NEXUS_discovery_GPU

Backup and experiment package for **Intern / discovery GPU** sessions (Shanghai A100 lane).

## On the Intern machine

```text
/data/NEXUS/                 # JuiceFS ~30G persistent
  logs/                      # smoke, bench, train_runs, heartbeat
  git_backups/work/          # local git (push to this GitHub repo)
  workspace/                 # SESSION_PROGRESS_LATEST.md
  datasets/tiny/
```

## Quick start (on A100 code-server)

```bash
cd /data/NEXUS/git_backups/work
# if not cloned yet:
# git clone https://github.com/specimba/NEXUS_discovery_GPU.git /data/NEXUS/git_backups/work

python3 scripts/train_stub.py --steps 100 --size 2048 --seed 42
python3 scripts/gpu_bench.py
bash scripts/tick_1.sh
```

## Agents

- **Cline** / **Kilo Code** on code-server: prefer writing proofs to files under `/data/NEXUS/logs` (shell-integration may be unavailable).
- Explorer often opens `/root`; open **NEXUS** / `/data/NEXUS` for real project files.

## GitHub

This repo is the durable backup target. Do **not** commit PATs or secrets.

## Session notes

See `docs/` for automation policy (calm single-burst CDP, no thrash).

### Session 4 (2026-07-16)

- Longrun inventory + continuity on JuiceFS
- DPO gold + canary config in-repo: `datasets/nexus_local/`, `configs/`
- After push, on A100: `bash scripts/pull_and_stage.sh`
- Laptop OCR helpers under `local_ocr/` (optional; not for A100 GPU hours)
- Latest narrative: `reports/session4/SESSION_LATEST.md`
