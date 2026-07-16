#!/usr/bin/env bash
# Bootstrap /data/NEXUS on a NEW Intern A100 session (nb-253ef43e family).
# Safe: no secrets printed. Prefer jsDelivr. Fix missing workspace dir.
set -euo pipefail
ROOT=/data/NEXUS
echo "BOOTSTRAP_START $(date -u +%Y%m%dT%H%M%SZ)"

# 1) dirs — critical: workspace must be a directory (not missing)
mkdir -p \
  "$ROOT/workspace" \
  "$ROOT/logs" \
  "$ROOT/datasets/nexus_local" \
  "$ROOT/configs" \
  "$ROOT/scripts" \
  "$ROOT/checkpoints" \
  "$ROOT/hf_cache" \
  "$ROOT/m0_prep" \
  "$ROOT/.secrets" \
  "$ROOT/git_backups"

# 2) multi-mirror fetch helper
fetch() {
  local dest="$1"; shift
  local url sz
  for url in "$@"; do
    echo "GET $url"
    if curl -fsSL --connect-timeout 20 --max-time 180 -A "NEXUS-boot/1" -o "$dest" "$url"; then
      sz=$(wc -c <"$dest" | tr -d ' ')
      if [ "${sz:-0}" -gt 200 ]; then
        echo "OK $dest bytes=$sz"
        return 0
      fi
    fi
  done
  return 1
}

# 3) stage DPO gold + config + train scripts from GitHub via jsDelivr
fetch "$ROOT/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl" \
  "https://cdn.jsdelivr.net/gh/specimba/NEXUS_discovery_GPU@main/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl" \
  "https://raw.githubusercontent.com/specimba/NEXUS_discovery_GPU/main/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl" || true

fetch "$ROOT/configs/dpo_a100_guard_v7.yaml" \
  "https://cdn.jsdelivr.net/gh/specimba/NEXUS_discovery_GPU@main/configs/dpo_a100_guard_v7.yaml" || true

fetch "$ROOT/scripts/dpo_auto_continue.py" \
  "https://cdn.jsdelivr.net/gh/specimba/NEXUS_discovery_GPU@main/scripts/dpo_auto_continue.py" || true

fetch "$ROOT/scripts/dpo_dryrun_v7.py" \
  "https://cdn.jsdelivr.net/gh/specimba/NEXUS_discovery_GPU@main/scripts/dpo_dryrun_v7.py" || true

fetch "$ROOT/scripts/pull_and_stage.sh" \
  "https://cdn.jsdelivr.net/gh/specimba/NEXUS_discovery_GPU@main/scripts/pull_and_stage.sh" || true
chmod +x "$ROOT/scripts/"*.sh 2>/dev/null || true

# 4) inventory
python3 - <<'PY'
import json, time, os
from pathlib import Path
root = Path("/data/NEXUS")
stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
dpo = root / "datasets/nexus_local/v7_dpo_pairs_fixed.jsonl"
rep = {
    "stamp": stamp,
    "event": "new_session_bootstrap",
    "host": os.uname().nodename if hasattr(os, "uname") else None,
    "dpo_lines": sum(1 for _ in dpo.open()) if dpo.exists() else 0,
    "dpo_bytes": dpo.stat().st_size if dpo.exists() else 0,
    "cfg": (root / "configs/dpo_a100_guard_v7.yaml").exists(),
    "scripts": sorted(p.name for p in (root / "scripts").glob("*") if p.is_file()),
    "workspace_is_dir": (root / "workspace").is_dir(),
    "policy": {
        "torch_freeze": "2.4.x+cu124 prefer; pin transformers==4.46.3 if DTensor missing",
        "agent": "Cline primary (YOLO); Kilo optional if healthy",
        "scp_key": "store only under /data/NEXUS/.secrets/scp_api_key (never git)",
        "mirrors": "jsDelivr first",
    },
}
try:
    import torch
    rep["torch"] = torch.__version__
    rep["cuda"] = bool(torch.cuda.is_available())
    rep["gpu"] = torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
except Exception as e:
    rep["torch_err"] = repr(e)

# packages light check
pkgs = {}
for m in ["torch", "transformers", "datasets", "huggingface_hub"]:
    try:
        mod = __import__(m)
        pkgs[m] = getattr(mod, "__version__", "ok")
    except Exception:
        pkgs[m] = "MISSING"
rep["packages"] = pkgs

(root / "workspace/BOOTSTRAP.json").write_text(json.dumps(rep, indent=2), encoding="utf-8")
(root / "logs/BOOTSTRAP.json").write_text(json.dumps(rep, indent=2), encoding="utf-8")
(root / "workspace/COVERAGE_INDEX_LATEST.json").write_text(
    json.dumps(
        {
            "stamp": stamp,
            "event": "new_session_bootstrap",
            "dpo_lines": rep["dpo_lines"],
            "dpo_bytes": rep["dpo_bytes"],
            "torch": rep.get("torch"),
            "gpu": rep.get("gpu"),
            "packages": pkgs,
        },
        indent=2,
    ),
    encoding="utf-8",
)
(root / "workspace/MISSION_STATUS.md").write_text(
    f"""# MISSION_STATUS
- GREEN (bootstrap)
- stamp: {stamp}
- machine: new session nb-253ef43e /data/NEXUS
- dpo_lines: {rep['dpo_lines']}
- torch: {rep.get('torch')} gpu: {rep.get('gpu')}
- agent: Cline primary; Kilo skip if broken
- next: HF token file if needed; transformers pin 4.46.3; DPO auto_continue; SCP key in .secrets only
- scp: https://scphub.intern-ai.org.cn/ + discovery datasets square
""",
    encoding="utf-8",
)
(root / "workspace/CLINE_TASK.md").write_text(
    f"""# CLINE_TASK — stable workspace (new A100)
Stamp: {stamp}

## Do now (YOLO ok)
1. Confirm /data/NEXUS/workspace is a directory and pwd works in bash.
2. Read MISSION_STATUS.md and BOOTSTRAP.json.
3. If transformers missing or DTensor import fails: `pip install 'transformers==4.46.3' --upgrade-strategy only-if-needed` (do NOT upgrade torch).
4. If dpo_lines < 150: run `bash /data/NEXUS/scripts/pull_and_stage.sh` or re-fetch jsonl via jsDelivr.
5. Optional smoke: `NEXUS_DPO_MAX_STEPS=20 python3 /data/NEXUS/scripts/dpo_auto_continue.py`
6. Never commit API keys. SCP key only in /data/NEXUS/.secrets/scp_api_key if user places it.
7. Skip Kilo until connection healthy. Prefer Cline.
8. Google Cloud: use a working bash terminal tab (not Kubernetes profile) for gcloud auth if needed.

## Resources
- DPO gold + train scripts: github.com/specimba/NEXUS_discovery_GPU
- SCP square: scphub.intern-ai.org.cn / discovery.intern-ai.org.cn/scp
- Datasets square: discovery.intern-ai.org.cn/dataset
""",
    encoding="utf-8",
)
print("BOOTSTRAP_OK", json.dumps(rep)[:2000])
PY

echo "BOOTSTRAP_DONE $(date -u +%Y%m%dT%H%M%SZ)"
ls -la "$ROOT/workspace" | head -30
wc -l "$ROOT/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl" 2>/dev/null || true
