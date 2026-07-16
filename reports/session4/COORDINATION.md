# Session 4 coordination

| Lane | Role |
|------|------|
| Grok / CDP :9224 | Drive code-server, harvest logs, push save points |
| Kilo Code | Agent continuity (cloud history) |
| Cline | Secondary; history may reset after session recycle |
| Local Windows OCR | Optional telemetry only; parked during train hours |

## Artifacts

- Live: `/data/NEXUS/workspace/MISSION_STATUS.md`, `SESSION_PROGRESS_LATEST.md`, `LONGRUN_LATEST.txt`
- Mirror: this repo `reports/session4/`
- Host logs: `Downloads/NEXUSlogs/_runs/GROK/20260716/`

## Do not

- Commit HF tokens / `.secrets`
- Thrash CDP injects into Cline chat panel
- Spend A100 hours re-tuning local OCR
