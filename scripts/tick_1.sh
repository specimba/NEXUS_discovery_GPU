#!/bin/bash
# Session keepalive + GPU snapshot (Cline-produced pattern)
set -e
HB=/data/NEXUS/logs/heartbeat.txt
mkdir -p /data/NEXUS/logs /data/NEXUS/git_backups/work/meta/ticks
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) alive" >> "$HB"
nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total --format=csv,noheader 2>/dev/null || true
cd /data/NEXUS/git_backups/work 2>/dev/null || exit 0
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
{
  date -u
  nvidia-smi -L 2>/dev/null || true
  df -h /data 2>/dev/null | head -3 || true
} > "meta/ticks/tick_${STAMP}.txt"
git add -A
git commit -m "tick: keepalive + gpu snapshot ${STAMP}" 2>/dev/null || true
echo "=== TICK_OK ==="
