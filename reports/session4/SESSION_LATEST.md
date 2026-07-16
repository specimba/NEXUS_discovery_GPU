# SESSION_LATEST — A100 nb-582b5f51 (2026-07-16)

## Done

- Local OCR path parked; continuity facts wired earlier
- GitHub `NEXUS_discovery_GPU` holds gold DPO + `dpo_a100_guard_v7.yaml`
- Longrun CDP wrote durable workspace files on JuiceFS (`MISSION_STATUS`, `COVERAGE`, logs)
- Env: A100 80GB, torch 2.4.0+cu124, HF_TOKEN_FILE=yes

## In progress

- Stage full 150-line DPO onto `/data/NEXUS/datasets/nexus_local/` via multi-mirror (jsDelivr first)
- Then: HF whoami, install missing trl/peft if needed, DPO dry-run 20 steps

## Blockers / notes

- CDP terminal focus flaky when Cline steals Input.insertText
- Prefer: Terminal: Focus Terminal + single base64|python shot
- Prefer CDN mirrors over raw.githubusercontent.com from China hosts
