#!/usr/bin/env bash
# Run on Intern A100 under /data/NEXUS
# Multi-mirror: jsDelivr first (China-friendly), then ghproxy, then raw GitHub, then git clone.
set -euo pipefail
ROOT=/data/NEXUS
WORK=$ROOT/git_backups/work
mkdir -p "$ROOT/git_backups" "$ROOT/datasets/nexus_local" "$ROOT/configs" "$ROOT/logs" "$ROOT/workspace"

fetch_file() {
  local dest="$1"
  shift
  local url
  for url in "$@"; do
    echo "GET $url"
    if curl -fsSL --connect-timeout 20 --max-time 180 -A "NEXUS-stage/8" -o "$dest" "$url"; then
      local sz
      sz=$(wc -c <"$dest" | tr -d ' ')
      if [ "${sz:-0}" -gt 200 ]; then
        echo "OK $dest bytes=$sz via $url"
        return 0
      fi
      echo "too_small $sz"
    else
      echo "FAIL $url"
    fi
  done
  return 1
}

# Prefer CDN mirrors (raw.githubusercontent.com often blocked from CN)
if fetch_file "$ROOT/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl" \
  "https://cdn.jsdelivr.net/gh/specimba/NEXUS_discovery_GPU@main/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl" \
  "https://ghproxy.net/https://raw.githubusercontent.com/specimba/NEXUS_discovery_GPU/main/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl" \
  "https://raw.githubusercontent.com/specimba/NEXUS_discovery_GPU/main/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl"; then
  echo "DPO lines=$(wc -l <"$ROOT/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl")"
else
  echo "curl mirrors failed; trying git clone"
  if [ ! -d "$WORK/.git" ]; then
    git clone --depth 1 https://github.com/specimba/NEXUS_discovery_GPU.git "$WORK" || \
      git clone --depth 1 https://ghproxy.net/https://github.com/specimba/NEXUS_discovery_GPU.git "$WORK" || true
  else
    git -C "$WORK" pull --ff-only || git -C "$WORK" pull --rebase || true
  fi
  if [ -f "$WORK/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl" ]; then
    cp -f "$WORK/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl" "$ROOT/datasets/nexus_local/"
    echo "staged DPO lines=$(wc -l <"$ROOT/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl")"
  fi
fi

fetch_file "$ROOT/configs/dpo_a100_guard_v7.yaml" \
  "https://cdn.jsdelivr.net/gh/specimba/NEXUS_discovery_GPU@main/configs/dpo_a100_guard_v7.yaml" \
  "https://ghproxy.net/https://raw.githubusercontent.com/specimba/NEXUS_discovery_GPU/main/configs/dpo_a100_guard_v7.yaml" \
  "https://raw.githubusercontent.com/specimba/NEXUS_discovery_GPU/main/configs/dpo_a100_guard_v7.yaml" || \
  { [ -f "$WORK/configs/dpo_a100_guard_v7.yaml" ] && cp -f "$WORK/configs/dpo_a100_guard_v7.yaml" "$ROOT/configs/"; }

# Rewrite coverage from actual staged file
python3 - <<'PY'
import json, time
from pathlib import Path
root = Path("/data/NEXUS")
dpo = root / "datasets/nexus_local/v7_dpo_pairs_fixed.jsonl"
n = sum(1 for _ in dpo.open()) if dpo.exists() else 0
idx = {
    "stamp": time.strftime("%Y%m%dT%H%M%SZ", time.gmtime()),
    "dpo_lines": n,
    "dpo_bytes": dpo.stat().st_size if dpo.exists() else 0,
    "source": "pull_and_stage_multi_mirror",
    "gpu": "NVIDIA A100-SXM4-80GB",
    "host": "nb-582b5f51",
}
for p in [root / "workspace" / "COVERAGE_INDEX_LATEST.json", root / "logs" / "COVERAGE_INDEX_LATEST.json"]:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(idx, indent=2), encoding="utf-8")
print("COVERAGE", json.dumps(idx))
print("STAGE_COMPLETE" if n >= 150 else "STAGE_PARTIAL")
PY

echo "pull_and_stage done $(date -u +%Y%m%dT%H%M%SZ)"
