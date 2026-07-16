# GPU truth check + plan update (2026-07-16)

## What discovery monitor shows (user)
**资源监控 · NEXUS-GPU-test3**
- GPU A100 ×1 · 80Gi · 4 vCPU · 16G RAM  
- **GPU 使用率 0% · 显存 0%** · CPU ~2.5% · 内存 ~33.8%

## Live truth from VM terminal (same session nb-253ef43e)
| Check | Result |
|-------|--------|
| `nvidia-smi` processes | **No running processes found** |
| `ps` python train | **None** (only jupyter-lab) |
| `cline_long_500d.log` | **56 lines**, ends `AUTO_CONTINUE_DONE True` |
| Checkpoints dir | **Only** `step_200_*` ×2 + `LATEST_CKPT.txt` + `dryrun_ok.json` |
| `step_300_*` / `step_500_*` | **Missing** |

**Conclusion:** User monitor is correct for **now**. GPU is idle. There is no continuous multi-hour A100 load.

## How this reconciles with earlier “GREEN ladder”
1. **Canary model is tiny** (`Qwen2.5-0.5B`) — a 100–500 step DPO loop can finish in **minutes**, not hours.  
2. Discovery “使用监控” is often a **recent average** → after a short spike, panel shows **0%** most of the day.  
3. Automation **claimed** 300/500 complete from log tails (`AUTO_CONTINUE_DONE`) — those logs exist.  
4. But **HF weight saves for 500 are not on disk** (only 200-step dirs). So “500 GREEN” ≠ “500-step checkpoint artifact proven.”  
5. `dryrun_ok.json` updates (tiny JSON) can succeed even when `save_pretrained` fails or is skipped.  
6. Host waves/nudges often re-ran short jobs or raced; duty cycle low → **looks like no GPU use** on the control page.

## What was real vs overstated
| Claim | Reality |
|-------|---------|
| A100 can run our DPO script | **Real** (cuda true, gpu name in metrics, step_200 saves exist) |
| Scale ladder 20→100 finite | **Real** (metrics + logs) |
| Sustained high GPU occupancy | **Not true** — short canaries + idle gaps |
| step_500 checkpoint saved | **Not verified** — missing on JuiceFS |
| Continuous “progression load” | **Overstated** relative to discovery monitor |

## Plan updates for better runs (near future)

### P0 — Make GPU use visible and honest
1. **Occupancy proof required:** every wave writes  
   `workspace/GPU_SNAP.json` = `{stamp, util, mem_used, pids, train_cmd}` from `nvidia-smi` **mid-run**.  
2. **Heartbeat log** while training: every 30s append util% to `logs/gpu_heartbeat.jsonl`.  
3. Success gate: not only `AUTO_CONTINUE_DONE` but **(a)** process existed, **(b)** mid-run util>0 or mem_used>1Gi, **(c)** checkpoint dir exists for that step.

### P1 — Fix checkpoint SAVE for long runs
1. Audit `dpo_auto_continue.py` after 500: confirm `NEXUS_DPO_SAVE=1` path + disk full / OOM / path bugs.  
2. Force save on exit: always write `step_{STEPS}_{STAMP}` when `ok` and STEPS≥100.  
3. Mirror `train_metrics.json` into `reports/session5/` only if checkpoint dir lists non-empty.

### P2 — Better runs = longer duty cycle (not more empty waves)
| Mode | How | Why |
|------|-----|-----|
| **A. Longer continuous job** | Single nohup 2k–5k steps or multi-epoch over full gold | Keeps A100 busy for monitor |
| **B. Larger model canary** | 1.5B / 3B if VRAM allows | Real mem occupancy (80G underused by 0.5B) |
| **C. Batch / grad accum** | Raise effective batch | Higher util between steps |
| **D. Pause 20m thrash** | Waves become **health+heartbeat only** if train already green | Stop fake “busy” without GPU |

### P3 — Research-informed tracks (still valid, but after P0/P1)
1. **Data v8:** HarDBench/RedBench rejected seeds (quality, not just steps).  
2. **Eval pack:** holdout + OR/SORRY style (don’t trust loss alone).  
3. **Serve later:** EAGLE-3 / DFlash — **after** train artifacts and occupancy are real.

### P4 — Ops / agents
- Prefer **one long nohup** over many short CDP pastes.  
- Cline: monitor heartbeat + checkpoint, not re-launch 100-step storms.  
- Discovery monitor is **ground truth for load**; terminal screenshots are ground truth for logs.

## Immediate next action (recommended)
1. Do **not** claim GPU busy unless `nvidia-smi` shows a process.  
2. Start **one** controlled long job:  
   `NEXUS_DPO_MAX_STEPS=2000 NEXUS_DPO_SAVE=1` with heartbeat, watch discovery util rise.  
3. Confirm new `step_2000_*` (or step_2000) dir appears under checkpoints.  
4. Only then resume multi-wave automation.

## One-line summary
**Earlier ladder logs show short successful canaries; discovery 0%/0% is correct for sustained load. Plan shifts from “more green checkmarks” to “provable multi-minute GPU occupancy + real checkpoint dirs + better data/eval.”**
