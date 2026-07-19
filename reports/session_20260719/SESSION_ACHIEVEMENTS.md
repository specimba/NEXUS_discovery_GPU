# Discovery A100 session achievements — 2026-07-19

**Account/drive:** Intern Discovery · NEXUS-GPU-test3 · `nb-253ef43eacdbe4e480503d693d5026ed` · tenant **101**  
**Host paths:** `/data/NEXUS` · workspace `/data/NEXUS/workspace`  
**Local mirror:** `Documents/NEXUS` · orch/scratch · `Downloads/NEXUSlogs/_runs/GROK/20260719/`  
**Law:** BEST step_5000 **frozen** · cascade not soup · **no train** without GO · no gdrive thrash · bnb4 = product truth until GGUF proven  

---

## What we achieved (honest)

### Ops / boot (critical for next account)

| Item | Result |
|------|--------|
| Hours-end kick after 续时 | Machine **stopped**; 续时 ≠ still running |
| Gray · 已停止 | **Cannot 进入** — only **运行中** |
| 启动 modal | Need duration; **确认** disabled if cost > remaining pts |
| 8h @ 60pt/h = 480 | Blocked when only **439** left → set **7h = 420** |
| Boot path | 启动 → 确认 → 排队中 → **运行中** → **进入开发机** |
| 离开开发机 dialog | Exit, not enter — do not confirm by accident |
| code-server 403 | Recover via list **进入开发机** / reload inside |
| Keepalive | `intern_keepalive.mjs` — restart after max_runtime |
| Tab health | `tab_health_watch.mjs` on inside URL |
| Decoy | `nexus_decoy` ~96MiB pulse when shell alive |

### Product / cascade (E1–E14 markers claimed this arc)

| Marker | Meaning |
|--------|---------|
| PHASE_B_OK / STEP_2_OK | Phase B + harness path |
| GGUF_SMOKE_OK | GGUF smoke evidence |
| L0_BOUNCER_PLAN_OK | L0 stub path |
| STEP_5_OK / POST_OOM_OK / STABLE_OK | Cascade note, router, stable checkpoint |
| E8_DISK_TRUTH_OK | Post-reboot file truth + decoy |
| E9_CASCADE_DRY_OK | L0 + router dry evidence |
| E10_PRODUCT_SPINE_OK | product_8gb inventory |
| E11_BENCH_SMOKE_OK | bench smoke |
| E12_GUARD_STUB_OK | guard between L0 and router |
| E13_STABLE_REFRESH_OK | STABLE_CHECKPOINT refresh |
| E14_NEXT_PLAN_OK | NEXT_6H_PLAN authored |

### Agents

| Agent | Role | Notes |
|-------|------|--------|
| **Cline** `cline-pass:kimi-k3` | Primary code/tool lane | Act + full AA; short prompts; `requires_approval=false` |
| **Kilo Hy3** | Disk verify + mid session build | Free tier **Queued** stall ~40m+ observed |
| **Grok orch** | CDP 9224 coordinate, proceed, boot, backup | `orch_5h_collab.mjs`, mission dispatch |

### Not done / GO still OFF

- Full train / DPO resume  
- Multi-GB model re-export unless requested  
- Claiming GGUF quality equal to bnb4 without scores  
- Unlimited Hy3 free reliability  

---

## Portable sync targets (this last session)

1. **Remote:** `/data/NEXUS/workspace/portables/NEXUS_DISCOVERY_SESSION_20260719.tar.gz`  
2. **Local:** `Documents/NEXUS/portables/discovery_session_20260719/`  
3. **Logs:** `Downloads/NEXUSlogs/_runs/GROK/20260719/`  
4. **GitHub:** `specimba/nexusalpha` (origin) · `specimba/NEXUS-A2A-OS` (github remote)  
5. **Cold (if present):** `D:\NEXUS_COLD` — large models only, not required for clean-sheet code boot  

---

## Clean-sheet next VM checklist

See `CLEAN_SHEET_BOOT.md` in this folder and on remote workspace after E20.

## Eyes-on update (user screenshot viHaSgk)

**UI truth when user pinged:**
- Cline LEFT: empty "What can I do for you?", **clinemoonshotai/kimi-k3**, Act, full AA (Read/Edit/All Commands/Browser/MCP)
- Kilo center: E19 portable mission running
- Terminal: **E19 already complete**
  - `portables/NEXUS_DISCOVERY_SESSION_20260719.tar.gz` (then grown ~50KB after E20)
  - `portables/session_20260719/MANIFEST.md` with sha256 rows
  - markers: `E19_PORTABLE_BACKUP_OK` · `GROK_BACKUP_DONE`
- Workspace files visible: HONEST_SCOREBOARD, KILO_*, KIMI_RESEARCH_ADVISORY (RESEARCH_OK), etc.

**Follow-up:** E20_CLEAN_SHEET_OK claimed after CLEAN_SHEET_BOOT.md packed into tar meta.
