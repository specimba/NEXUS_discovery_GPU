# A800 unlimited plan (post A100 1h)

## Venue
- URL: discovery.intern-ai.org.cn notebook `NEXUS_scientist_v0.1`
- GPU: **A800, no time limit** (already used 0.0h at handoff)
- Paths: `/home/mw/project` (persist), `input`, `temp`, `work`
- UI: Jupyter-like cells (CodeMirror), 运行 / 运行所有 / 离线任务

## Learned from A100
- Terminal-first on VS Code VM; JuiceFS `/data/NEXUS` + GH suite ticks 11–13
- Do not thrash Cline; secrets env-only
- Toggle Panel only when closed; never type into extensions
- Proof = GH SHA + durable files

## A800 product (plan S3 / NEXUS_UPGRADED)
| Priority | Work | Notes |
|----------|------|--------|
| P0 | GPU hello + inventory project/input/temp | every phase |
| P1 | Elevated TinyLM train (500+ steps) | real CUDA, not 2‑min spam |
| P1 | Pull + run cloud_suite under project NEXUS_DATA | HF if token |
| P2 | TokenHD scaffold under `project/NEXUS_session4/tokenhd/` | **no DPO until F-2** |
| P2 | Upload `reports/session4/a800/*` to GH | durable proof |
| Later | TokenHD 0.6B + Guard-DPO after F-2 gate | not now |

## Automation
```text
node intern_s4_a800_go.mjs
  A800_HOURS=6 A800_PHASE_SEC=900 TRAIN_STEPS=500
```
- Fills first cell, Shift+Enter / ▶ run
- Waits for `NEXUS_A800_DONE`
- Sleep ~15 min between ticks

## Success
- Growing `/home/mw/project/NEXUS_session4/reports/a800/`
- GH commits under `reports/session4/a800/`
- No SyntaxError cells; no microtick thrash
