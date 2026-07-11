# A800 unlimited — status (2026-07-11)

## Venue
- URL: `https://discovery.intern-ai.org.cn/notebooks/run/6a4bd983...` (NEXUS_scientist_v0.1)
- GPU: A800, **no time limit** (panel shows multi-hour Time; 已用 ~1h+ at handoff)
- Paths: `/home/mw/project` (persist), input, temp, work

## Proven working (CDP automation)
1. Focus `li.content__tab-notebook` (Notebook-python3-*), **not** 启动页
2. Wait for on-screen `.monaco-editor` (scrollIntoView; reject y&lt;0)
3. Fill via `window.monaco.editor.getModels().setValue(code)` on **all** models
4. Menu **运行 → 运行所有** (not 运行当前 alone)
5. Unique markers: `NEXUS_A800_DONE` / probe stamps
6. Kernel **中断** available if hung

## Fresh proof (this session)
- Stamp `FRESH_1783779176953`: `doneFresh=true`, `probeFresh=true`, `cuda=true` in ~3s
- Driver: `intern_s4_a800_go.mjs` — A800_HOURS=6, PHASE_SEC=900, TRAIN_STEPS=500
- Outputs: `/home/mw/project/NEXUS_session4/reports/a800/` + GH `reports/session4/a800/`

## Tick 1 durable proof (GH)
- Files: `A800_TICK_1_20260711T140859Z.json`, `LATEST.json`, `A800_STATUS.md`
- GPU: **NVIDIA A800-SXM4-80GB** · torch 2.6.0+cu124 · `cuda: true`
- TinyLM train: **500 steps in 0.692s** on `cuda`
- ckpt: `/home/mw/project/NEXUS_session4/checkpoints/tinylm_a800_t1_20260711T140859Z.pt`
- TokenHD scaffold written; suite scripts pulled OK (suite run timed out 180s — non-blocking for GPU proof)
- Host: `klab`

## Do not
- Thrash Cline / type into extensions
- Trust historical body text for DONE without unique stamp
- Treat log `启动中` history as kernel-not-ready forever (use active `正在拉取镜像` only)

## Token note
- GH/HF tokens injected as `os.environ` in notebook cells for GH upload
- Prefer rotating GH token if cell source was ever screenshotted/logged

## Longrun
```
node intern_s4_a800_go.mjs   # via _launch_a800_6h.ps1
# logs: intern_session3/a800_go_stdout.txt a800_go.jsonl
```
