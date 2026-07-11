#!/usr/bin/env python3
"""Orchestrate HF search → SFT mix → train/stress → GitHub upload.

Env:
  T / GITHUB_TOKEN, R / GITHUB_REPO, TICK, SESSION, HF_TOKEN (optional), NEXUS_DATA
"""
from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent


def run_py(script: str) -> int:
    p = HERE / script
    print("RUN", p.name)
    return subprocess.call([sys.executable, str(p)], env=os.environ.copy())


def upload(path: str, file: Path, msg: str, token: str, repo: str) -> str | None:
    if not file.is_file():
        print("SKIP", path)
        return None
    b64 = base64.b64encode(file.read_bytes()).decode()
    url = f"https://api.github.com/repos/{repo}/contents/{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "nexus-cloud-suite",
        "Content-Type": "application/json",
    }
    sha = None
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as resp:
            sha = json.load(resp).get("sha")
    except Exception:
        pass
    body = {"message": msg, "content": b64}
    if sha:
        body["sha"] = sha
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="PUT", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            j = json.load(resp)
            s = (j.get("content") or {}).get("sha", "")[:7]
            print("UPLOAD_OK", path, s)
            return s
    except Exception as e:
        print("UPLOAD_FAIL", path, str(e)[:200])
        return None


def main() -> int:
    token = os.environ.get("T") or os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("R") or os.environ.get("GITHUB_REPO") or "specimba/NEXUS_discovery_GPU"
    session = os.environ.get("SESSION") or "session4"
    tick = int(os.environ.get("TICK") or "1")
    data = Path(os.environ.get("NEXUS_DATA", "/data/NEXUS"))
    if not token:
        print("NO_TOKEN")
        return 2

    # ensure layout + root links (best effort)
    for sub in [
        "datasets/hf_search",
        "datasets/nexus_mix",
        "reports/" + session + "/cloud_suite",
        "checkpoints/cloud_suite",
        "logs",
        "workspace/session4",
    ]:
        (data / sub).mkdir(parents=True, exist_ok=True)
    try:
        Path("/root/NEXUS").unlink(missing_ok=True) if hasattr(Path, "unlink") else None
    except Exception:
        pass
    for a, b in [("/root/NEXUS", str(data)), ("/root/NEXUS_DATA", str(data))]:
        try:
            if not Path(a).exists():
                os.symlink(b, a)
        except Exception:
            pass

    codes = {}
    codes["hf_search"] = run_py("hf_dataset_deep_search.py")
    codes["build_mix"] = run_py("build_nexus_sft_mix.py")
    codes["train_stress"] = run_py("train_and_stress.py")

    stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    summary = {
        "stamp": stamp,
        "tick": tick,
        "session": session,
        "exit_codes": codes,
        "gpu": subprocess.getoutput("nvidia-smi -L | head -1"),
        "df": subprocess.getoutput("df -h /data | tail -1"),
        "host": os.uname().nodename if hasattr(os, "uname") else "cloud",
    }
    sum_path = data / "reports" / session / "cloud_suite" / f"RUN_{stamp}_tick{tick}.json"
    sum_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    latest = data / "reports" / session / "cloud_suite" / "LATEST.json"

    # upload key artifacts
    base = f"reports/{session}/cloud_suite"
    upload(f"{base}/RUN_{stamp}_tick{tick}.json", sum_path, f"cloud suite run tick {tick}", token, repo)
    if latest.is_file():
        upload(f"{base}/LATEST_suite.json", latest, f"cloud suite latest tick {tick}", token, repo)
    mix = data / "datasets" / "nexus_mix" / "LATEST_MIX.json"
    if mix.is_file():
        upload(f"{base}/LATEST_MIX.json", mix, f"cloud suite mix tick {tick}", token, repo)
    search = data / "datasets" / "hf_search" / "LATEST.json"
    if search.is_file():
        upload(f"{base}/HF_SEARCH_LATEST.json", search, f"cloud suite hf search tick {tick}", token, repo)

    md = f"""# NEXUS cloud suite tick {tick} @ {stamp}

- host: {summary['host']}
- gpu: {summary['gpu']}
- df: {summary['df']}
- exits: {json.dumps(codes)}

Artifacts under `/data/NEXUS/reports/{session}/cloud_suite/` and GH `{base}/`.

Pipeline: **HF search → SFT mix → TinyLM train + matmul stress + EMA merge dry-run**.
"""
    md_path = data / "reports" / session / "cloud_suite" / f"RUN_{stamp}_tick{tick}.md"
    md_path.write_text(md, encoding="utf-8")
    upload(f"{base}/RUN_{stamp}_tick{tick}.md", md_path, f"cloud suite md tick {tick}", token, repo)

    print("PIPELINE_DONE", json.dumps(summary))
    return 0 if all(c == 0 for c in codes.values()) else 1


if __name__ == "__main__":
    import subprocess

    sys.exit(main())
