# Lane cooperation — AFK window 2026-07-11

**Purpose:** Keep Z.ai GLM-5.2 (control-plane sandbox) and Grok/Intern GPU lane aligned without thrash.

## Lanes (live)

| Lane | Surface | Owner now | Success signal |
|------|---------|-----------|----------------|
| **grok** | This session + MCP + CDP :9224 | Coordinator | AFK monitor + realwork health, suite GH proof |
| **glm52** | https://chat.z.ai/c/818afb28-dcc7-43bc-a514-1d13ebd11ec6 | Control-plane app / docs / sandbox Next.js | Verified GH commits, STATE.md resume, no secret leaks |
| **intern_gpu** | Intern AI A100 VS Code (CDP inside workbench) | realwork longrun PID | `/data/NEXUS` + `reports/session4/cloud_suite/` |
| **cline/kilo** | A100 IDE sidebars | **Standby** | Do not thrash; terminal-first |

## Split of work (AFK)

### Grok (coordinator)
- CDP drive A100 terminal suite (HF search → mix → train/stress → GH)
- AFK monitor every ~8m; scheduler every 20m
- Heartbeats: `AFK_HEARTBEAT.json`
- Do **not** ask GLM to run GPU jobs or hold secrets in chat

### GLM-5.2 (this Z.ai chat)
- Own the **control-plane app** in sandbox (Next.js, A2A ops board, lane registry UI)
- Encode real ports: 9224 CDP, 7354 Grok MCP, continuity ledger path
- Document resume: STATE.md / worklog / RESUME.md
- **Ingest** coordinator briefs (below) and update dashboard lane status for `intern_gpu` + `grok`
- Retries only on model lock; no parallel GPU claims

### Intern GPU (A100)
- `run_suite.py` with HF_TOKEN env-only
- Proof: JuiceFS `/data/NEXUS` + GitHub `specimba/NEXUS_discovery_GPU`
- Not micro-ticks

## Shared truth URLs (no secrets)

- GH suite: `https://github.com/specimba/NEXUS_discovery_GPU/tree/main/reports/session4/cloud_suite`
- AFK plan: `.../SESSION4_AFK_PLAN.md`
- AFK heartbeat: `.../AFK_HEARTBEAT.json`
- HF search: `.../HF_SEARCH_LATEST.json`
- This coop note: mirror under same folder when uploaded

## Rules of engagement
1. **One owner per artifact** — GLM owns control-plane code; Grok owns A100 automation; no dual writes.
2. **Evidence over essay** — status = PID alive + GH SHA + `/data` paths, not “still working”.
3. **Secrets** — HF/GitHub tokens env-only; never paste into Z.ai chat or sandbox files that get committed.
4. **Gated HF** — if 401/403, flag `need_user_gate_approval`; do not invent access.
5. **Cline** — minimized; terminal is source of truth for suite.
6. **After AFK** — GLM should read latest `AFK_HEARTBEAT` + suite LATEST and refresh lane tiles.

## Coordinator brief to paste (status)
See companion message injected into Z.ai (timestamped). Update when phase advances.

## Contact pattern
```
[COOP] from=grok to=glm52 topic=lane_status
body: { intern_gpu: {phase, pid, last_sha}, grok: {afk_min_left}, blockers: [] }
```
