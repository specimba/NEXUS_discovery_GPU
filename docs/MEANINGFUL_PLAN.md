# Meaningful progress plan (post-NEXUS folder open)

## Already done (your screenshot + automation)

| Source | Result |
|--------|--------|
| **Cline** | `tick_1.sh` created + committed; **All tasks completed** / TICK_1_OK |
| **Kilo** | A–E cycle + PROOF_E: train_stub on **A100-SXM4-80GB**, git HEADs `b9416fb` / `35bf110` |
| **Explorer** | **NEXUS** folder under ROOT (you opened it) |
| **GitHub** | Device login in code-server (you completed) |
| **This run** | Session report path + GPU bench suite + Kilo train_stub v2 mission + Cline peer |

## Cline “Shell Integration Unavailable”

On code-server this is **common**. Mitigations:
1. Default profile = **bash** (Terminal: Select Default Profile)
2. Prefer agents writing proof to **files** under `/data/NEXUS/logs/` (not only live shell stream)
3. Optional: Settings → `terminal.integrated.shellIntegration.enabled: true`
4. VS Code “Update” often not available on Intern-hosted code-server — ignore if no update UI

## Next meaningful work (remaining GPU hours)

1. **Confirm Kilo finished train_stub v2** (argparse + `/data/NEXUS/logs/train_runs/*.jsonl`)
2. **Read** `/data/NEXUS/workspace/SESSION_PROGRESS_LATEST.md` and `logs/gpu_bench_suite.json`
3. **GitHub remote** (when you pick a private repo URL):
   ```bash
   cd /data/NEXUS/git_backups/work
   git remote add origin git@github.com:YOU/REPO.git   # or HTTPS
   git push -u origin main
   ```
4. **Real experiment block** (pick one):
   - Scale matmul bench + log CSV over time
   - Small torch training on `datasets/tiny`
   - Clone your main NEXUS repo into `/data/NEXUS/repo_sync` and run a unit of real code

## Paths that matter

```
/data/NEXUS/
  git_backups/work/scripts/tick_1.sh
  git_backups/work/scripts/train_stub.py
  logs/gpu_bench_suite.json
  logs/train_runs/
  workspace/SESSION_PROGRESS_LATEST.md
  reports/
```
