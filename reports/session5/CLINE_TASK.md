# CLINE_TASK — long heavy A100 work (nb-253ef43e)

**Do not sleep.** YOLO. Skip Google / Vincent / human prompts.

## Active long job
```bash
# ensure scripts + gold
test -s /data/NEXUS/scripts/dpo_auto_continue.py || curl -fsSL -o /data/NEXUS/scripts/dpo_auto_continue.py \
  https://cdn.jsdelivr.net/gh/specimba/NEXUS_discovery_GPU@main/scripts/dpo_auto_continue.py
test -s /data/NEXUS/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl || curl -fsSL -o \
  /data/NEXUS/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl \
  https://cdn.jsdelivr.net/gh/specimba/NEXUS_discovery_GPU@main/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl

# pin if needed (no trl 1.x)
python3 -c "from torch.distributed.tensor import DTensor" 2>/dev/null || \
  python3 -m pip install -q 'transformers==4.46.3' --upgrade-strategy only-if-needed

# HEAVY: 300 then 500 steps with checkpoint save
cd /data/NEXUS
NEXUS_ROOT=/data/NEXUS NEXUS_DPO_MAX_STEPS=300 NEXUS_DPO_SAVE=1 \
  HF_ENDPOINT=https://hf-mirror.com HF_HOME=/data/NEXUS/hf_cache \
  python3 scripts/dpo_auto_continue.py | tee logs/cline_long_300.log

NEXUS_ROOT=/data/NEXUS NEXUS_DPO_MAX_STEPS=500 NEXUS_DPO_SAVE=1 \
  HF_ENDPOINT=https://hf-mirror.com HF_HOME=/data/NEXUS/hf_cache \
  python3 scripts/dpo_auto_continue.py | tee logs/cline_long_500.log

# status surfaces
cp -f workspace/DPO_DRYRUN_LATEST.json workspace/COVERAGE_INDEX_LATEST.json workspace/MISSION_STATUS.md . 2>/dev/null || true
ls -la checkpoints/dpo_guard_v7_canary
cat checkpoints/dpo_guard_v7_canary/LATEST_CKPT.txt
echo CLINE_LONG_DONE
```

## Host automation
- `intern_cline_long_heavy.mjs` — submit Cline + parallel terminal nohup
- `intern_cline_nudge.mjs` — re-wake if Task Completed / no train PID
- Terminal waves still run every 20m (do not replace Cline; both stay busy)

## Rules
- Auto-approve / YOLO
- Never echo secrets
- Keep GPU utilized (pgrep dpo_auto_continue should usually be non-empty during work windows)
