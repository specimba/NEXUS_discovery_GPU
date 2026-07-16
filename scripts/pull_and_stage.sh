#!/usr/bin/env bash
# Run on Intern A100 under /data/NEXUS
set -euo pipefail
ROOT=/data/NEXUS
WORK=$ROOT/git_backups/work
mkdir -p "$ROOT/git_backups" "$ROOT/datasets/nexus_local" "$ROOT/configs" "$ROOT/logs"
if [ ! -d "$WORK/.git" ]; then
  git clone https://github.com/specimba/NEXUS_discovery_GPU.git "$WORK"
else
  git -C "$WORK" pull --ff-only || git -C "$WORK" pull --rebase || true
fi
# stage DPO + config
if [ -f "$WORK/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl" ]; then
  cp -f "$WORK/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl" "$ROOT/datasets/nexus_local/"
  echo "staged DPO lines=$(wc -l < "$ROOT/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl")"
fi
if [ -f "$WORK/configs/dpo_a100_guard_v7.yaml" ]; then
  cp -f "$WORK/configs/dpo_a100_guard_v7.yaml" "$ROOT/configs/"
  echo "staged config"
fi
# session continuity
cp -f "$WORK/reports/session4/"* "$ROOT/workspace/" 2>/dev/null || true
cp -f "$WORK/reports/session4/MISSION_STATUS.md" "$ROOT/workspace/" 2>/dev/null || true
echo "pull_and_stage done $(date -u +%Y%m%dT%H%M%SZ)"
