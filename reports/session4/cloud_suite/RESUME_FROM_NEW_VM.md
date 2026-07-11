# Resume NEXUS GPU work on a **new** Intern VM (1h session)

**Checked:** 2026-07-11 · workbench  
`https://d.intern-ai.org.cn/workbench/dev-machine/inside/55/nb-582b5f51afb6b085773ce464c2654850`

**Live VM evidence (this session):**
- Hostname pattern: `nb-582b5f51afb6b085773ce464c2654850-0`
- GPU bar: **Nvidia A100 ×1 · 80Gi**
- `/data/NEXUS` present with **~549 files** under tree (JuiceFS durable)
- Explorer: `ROOT/NEXUS`, `ROOT/NEXUS_DATA` (symlinks to `/data/NEXUS`)
- Phase **11 bonus** wrote: `/data/NEXUS/reports/session4/cloud_suite/PHASE11_BONUS.json`
- Prompt cwd after suite: `.../git_backups/work/scripts/nexus_cloud_suite`

---

## 1) What you can retrieve from the **latest** session

### A. Always available (even if VM wiped): **GitHub**
Repo: `specimba/NEXUS_discovery_GPU`

| Artifact | Path |
|----------|------|
| Suite scripts | `scripts/nexus_cloud_suite/*` |
| AFK 2h summary | `reports/session4/cloud_suite/AFK_SUMMARY.md` |
| Heartbeats | `reports/session4/cloud_suite/AFK_HEARTBEAT.json` |
| HF search (auth) | `reports/session4/cloud_suite/HF_SEARCH_LATEST.json` |
| Mix / suite LATEST | `LATEST_MIX.json`, `LATEST_suite.json` |
| Lane coop note | `LANE_COOP_AFK_2026-07-11.md` |
| Run ticks | `RUN_*_tick*.json` |

**This is the source of truth for “what we ran”** if JuiceFS is empty on a brand-new image.

### B. Durable on Intern when JuiceFS mounts the same volume: **`/data/NEXUS`**
If `/data` is still the **same JuiceFS volume** (usual for same org project):

| Tree | Contents |
|------|----------|
| `reports/session4/cloud_suite/` | Suite JSON/MD, PHASE11, recover markers |
| `datasets/hf_search/` | Authenticated HF deep search LATEST |
| `datasets/nexus_mix/` | SFT mix shards |
| `checkpoints/cloud_suite/` | Tiny train checkpoints |
| `logs/` | heartbeats |
| `git_backups/work/scripts/nexus_cloud_suite/` | Pulled suite scripts |

**This session:** ~**549** files under `/data/NEXUS` → **high recoverability** without GH re-pull.

### C. Local Windows host (CDP agent scratch)
`C:\Users\speci.000\Downloads\cdp_agent_scratch\intern_session3\`
- `AFK_SUMMARY.md`, `realwork_stdout.txt`, phase screenshots
- `recover_*.png`, `recover_probe.jsonl`
- Secrets: `intern_cdp\.env.local` (HF only; not on VM by default)

### D. **Not** durable across VMs
- Cline/Kilo chat history (webview state)
- In-memory env `T` / `HF_TOKEN` (must re-export)
- Polluted editor buffers (`.bashrc` open in editor ≠ disk)
- Microtick session state

---

## 2) How to resume on a **new** VM (checklist)

### Step 0 — Confirm durability class
```bash
df -h /data
ls -la /data/NEXUS | head
find /data/NEXUS -type f 2>/dev/null | wc -l
```
| Result | Meaning |
|--------|---------|
| `/data/NEXUS` has reports/datasets | **Resume cold** — only re-export tokens + continue phases |
| `/data` empty or no NEXUS | **Rebuild from GH** (below) |

### Step 1 — Layout + links (always safe)
```bash
export NEXUS_DATA=/data/NEXUS
mkdir -p /data/NEXUS/{logs,datasets,checkpoints,reports/session4/cloud_suite,git_backups/work/scripts/nexus_cloud_suite,workspace/session4}
ln -sfn /data/NEXUS /root/NEXUS
ln -sfn /data/NEXUS /root/NEXUS_DATA
```

### Step 2 — Secrets (env only — never commit)
```bash
# On host: gh auth token + HF from .env.local
export T="<GITHUB_TOKEN>" R=specimba/NEXUS_discovery_GPU
export HF_TOKEN="<HF_TOKEN>" HUGGING_FACE_HUB_TOKEN="$HF_TOKEN"
export SESSION=session4 NEXUS_DATA=/data/NEXUS TRAIN_STEPS=300
```

### Step 3 — Pull suite if missing
```bash
for f in run_suite.py hf_dataset_deep_search.py build_nexus_sft_mix.py train_and_stress.py SECURITY.md README.md; do
  curl -fsSL --max-time 50 -H "Authorization: Bearer $T" -H "Accept: application/vnd.github.raw" \
    "https://api.github.com/repos/$R/contents/scripts/nexus_cloud_suite/$f?ref=main" \
    -o /data/NEXUS/git_backups/work/scripts/nexus_cloud_suite/$f && echo PULLED $f
done
```

### Step 4 — Optional: rehydrate reports from GH
```bash
# examples
curl -fsSL -H "Authorization: Bearer $T" -H "Accept: application/vnd.github.raw" \
  "https://api.github.com/repos/$R/contents/reports/session4/cloud_suite/AFK_SUMMARY.md?ref=main" \
  -o /data/NEXUS/reports/session4/cloud_suite/AFK_SUMMARY.md
```

### Step 5 — Continue work (next phase)
```bash
export TICK=12 PHASE=12   # or next free tick
cd /data/NEXUS/git_backups/work/scripts/nexus_cloud_suite
python3 run_suite.py
unset T HF_TOKEN HUGGING_FACE_HUB_TOKEN
```

### Step 6 — CDP automation note
- Outer URL = workbench shell; **code-server is inside iframe**  
  `discovery-notebook-p.../code/?folder=/root`
- Always focus **xterm** before typing (never monaco/.bashrc)
- Create terminal: F1 → `Terminal: Create New Terminal` or Terminal panel click

---

## 3) Phase 11 bonus (this check)

| Item | Status |
|------|--------|
| Terminal suite path | Yes — cwd under `nexus_cloud_suite` |
| `PHASE11_BONUS.json` | Written on `/data` |
| `REALWORK_PHASE_11_DONE` | Observed in terminal |
| HF token | Available from host `.env.local` for suite |
| Full suite exit code | Confirm via `LATEST_suite.json` / GH upload if token valid during run |

---

## 4) Recoverability score (this 1h VM)

| Layer | Score | Notes |
|-------|-------|-------|
| JuiceFS `/data/NEXUS` | **High** | ~549 files still present |
| GitHub suite/reports | **High** | AFK 10 phases + docs |
| HF auth | **High** | Host `.env.local`; re-export on VM |
| Cline chats | **Low** | Do not depend on |
| Editor `.bashrc` buffer | **Dirty risk** | Prefer terminal `cat ~/.bashrc`; reset if polluted |

**Bottom line:** You can resume **without redoing** AFK search/mix/train from scratch if `/data` is this volume. If a truly new empty VM appears, rebuild layout + pull suite from GH in ~2 minutes, then continue at next `TICK`.

---

## 5) Operator “first 5 minutes” on any new 1h box

1. Open workbench inside URL + code-server terminal  
2. `ls /data/NEXUS | head` + `find /data/NEXUS -type f | wc -l`  
3. Export `T` + `HF_TOKEN`  
4. Pull suite if `run_suite.py` missing  
5. `python3 run_suite.py` once (proof) → check GH SHA  

Do **not** micro-tick spam. Prefer 10–15 min suite phases for the remaining hour.
