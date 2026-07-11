# Session4 AFK plan (~2h) — 2026-07-11

**Mode:** no-touch observation. Operator AFK. Agents run freely.

## Goals
1. Keep A100 realwork pipeline alive with **HF_TOKEN** (authenticated search/mix/train/stress).
2. Phases every ~10 min — **not** micro-tick spam.
3. Proof on `/data/NEXUS` + GitHub `reports/session4/cloud_suite/`.
4. Auto-restart realwork if process dies; CDP health checks.
5. **Do not** thrash Cline/Kilo UI unless terminal path fails.

## What realwork does each phase
1. Symlink `/root/NEXUS` → `/data/NEXUS`
2. Pull `scripts/nexus_cloud_suite/*` from GH
3. `export HF_TOKEN` (env only, redacted logs)
4. `python3 run_suite.py` → HF search → SFT mix → tiny train+stress → upload
5. Heartbeat / screenshots / GH SHA check

## Secrets
- GitHub: `gh auth` / env `GITHUB_TOKEN`
- HF: `intern_cdp/.env.local` (gitignored) → env on runner
- **Never** commit tokens

## Gated HF
- Current curated set: **access OK** (incl. xlam auto, Llama manual already approved)
- If 401/403 appears: log in `need_user_gate_approval` and AFK heartbeat — user approves after return

## Google Drive
- MCP disconnected at AFK start — use `/data` + GH only
- Reconnect Drive later for manifest mirror

## Processes
- `intern_s4_realwork_longrun.mjs` — heavy phases
- `intern_s4_afk_monitor.mjs` — 8 min checks, restart, `AFK_HEARTBEAT.json`

## Success when you return
- [ ] New suite JSON under `reports/session4/cloud_suite/`
- [ ] `AFK_HEARTBEAT.json` recent
- [ ] `/data/NEXUS/datasets/hf_search` + `nexus_mix` updated
- [ ] A100 not idle for 2h straight without proof
