# Intern test2 — CALM automated session plan

## Why it was laggy
Three+ CDP workers hammered the same code-server tab every few seconds:
- `force_approve` (Run click spam)
- `active_mission` every ~40s
- `longrun` every 4 min + anti-idle that **spammed `echo active-...` into Untitled-1**

Result: editor flooded, UI frozen, CDP timeouts.

## What we stopped
All thrash workers killed. **One** process only: `intern_calm_session.mjs`.

## What we test (~1.5h remaining)

| Phase | Timing | Work | Success marker |
|-------|--------|------|----------------|
| **P0** | 0–1.5 min | UI breather — no CDP | You can click IDE again |
| **P1** | ~2 min | GPU list + git log + keepalive | `P1_OK` / A100 |
| **P2** | ~5–8 min | CUDA matmul 4096×20 | `matmul_bench.json` gflops |
| **P3** | ~12 min | `train_stub` CUDA | `train_stub.json` |
| **P4** | ~18 min | tiny dataset + MISSION_STATUS | `sample.jsonl` + git |
| **KA** | every **10 min** | light keepalive only | heartbeat + util |

## Persist on /data (30G)
```
/data/NEXUS/logs/{smoke_gpu,torch_cuda,matmul_bench,train_stub,heartbeat}
/data/NEXUS/git_backups/work/     # versioned commits
/data/NEXUS/datasets/tiny/
/data/NEXUS/workspace/MISSION_STATUS.md
```

## Rules
- ONE node process
- No continuous Run spam
- Multi-minute gaps between heavy phases so UI stays usable
- Watch: `cdp_agent_scratch\intern_session\calm_console.txt`
