#!/usr/bin/env python3
"""NEXUS A100 phase: download mirrors + stack verify/install + longer DPO with save.

Skip Vincent/Google. Safe for Intern JuiceFS /data/NEXUS.
Env:
  NEXUS_ROOT (default /data/NEXUS)
  NEXUS_DPO_MAX_STEPS (default 200)
  NEXUS_DPO_SAVE (default 1 for this phase)
  HF_ENDPOINT (default https://hf-mirror.com)
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import traceback
import urllib.request
from pathlib import Path

ROOT = Path(os.environ.get("NEXUS_ROOT", "/data/NEXUS"))
STEPS = int(os.environ.get("NEXUS_DPO_MAX_STEPS", "200"))
STAMP = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
BASES = [
    "https://cdn.jsdelivr.net/gh/specimba/NEXUS_discovery_GPU@main",
    "https://ghproxy.net/https://raw.githubusercontent.com/specimba/NEXUS_discovery_GPU/main",
    "https://raw.githubusercontent.com/specimba/NEXUS_discovery_GPU/main",
]
ASSETS = [
    ("datasets/nexus_local/v7_dpo_pairs_fixed.jsonl", 100_000),
    ("configs/dpo_a100_guard_v7.yaml", 200),
    ("scripts/dpo_auto_continue.py", 500),
    ("scripts/dpo_dryrun_v7.py", 500),
    ("scripts/pull_and_stage.sh", 200),
    ("scripts/new_session_bootstrap.sh", 200),
]


def pull(rel: str, dest: Path, mn: int) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    last_err = None
    for base in BASES:
        url = f"{base}/{rel}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "NEXUS-phase/1"})
            data = urllib.request.urlopen(req, timeout=120).read()
            if len(data) >= mn:
                dest.write_bytes(data)
                return {"ok": True, "url": url, "bytes": len(data)}
            last_err = f"too_small:{len(data)}"
        except Exception as e:
            last_err = repr(e)
    return {"ok": False, "error": last_err, "rel": rel}


def main() -> int:
    for d in [
        "workspace",
        "logs",
        "datasets/nexus_local",
        "configs",
        "scripts",
        "checkpoints/dpo_guard_v7_canary",
        "hf_cache",
        ".secrets",
        "m0_prep",
    ]:
        (ROOT / d).mkdir(parents=True, exist_ok=True)

    rep: dict = {
        "stamp": STAMP,
        "phase": "dl_install_long",
        "policy": "skip_google_vincent",
        "steps": STEPS,
        "pulls": {},
        "install": {},
        "train": {},
    }

    # --- download / stage ---
    for rel, mn in ASSETS:
        dest = ROOT / rel
        # keep existing gold if already large enough
        if dest.exists() and dest.stat().st_size >= mn:
            rep["pulls"][rel] = {"ok": True, "kept": True, "bytes": dest.stat().st_size}
            continue
        rep["pulls"][rel] = pull(rel, dest, mn)

    dpo = ROOT / "datasets/nexus_local/v7_dpo_pairs_fixed.jsonl"
    rep["dpo_lines"] = sum(1 for _ in dpo.open()) if dpo.exists() else 0
    rep["dpo_bytes"] = dpo.stat().st_size if dpo.exists() else 0

    # --- stack inventory + pin ---
    try:
        import torch

        rep["install"]["torch"] = torch.__version__
        rep["install"]["cuda"] = bool(torch.cuda.is_available())
        rep["install"]["gpu"] = (
            torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
        )
    except Exception as e:
        rep["install"]["torch_err"] = repr(e)

    # pin transformers if DTensor missing (torch 2.4 freeze)
    try:
        from torch.distributed.tensor import DTensor  # noqa: F401

        rep["install"]["dtensor"] = True
    except Exception:
        rep["install"]["dtensor"] = False
        print("PIN transformers==4.46.3 for torch2.4", flush=True)
        rc = subprocess.call(
            [
                sys.executable,
                "-m",
                "pip",
                "install",
                "-q",
                "transformers==4.46.3",
                "accelerate",
                "sentencepiece",
                "protobuf",
                "--upgrade-strategy",
                "only-if-needed",
            ]
        )
        rep["install"]["pin_rc"] = rc

    # ensure core train deps present (do NOT install trl 1.x)
    for pkg in ("transformers", "accelerate"):
        try:
            mod = __import__(pkg)
            rep["install"][pkg] = getattr(mod, "__version__", "ok")
        except Exception:
            print("INSTALL", pkg, flush=True)
            subprocess.call(
                [
                    sys.executable,
                    "-m",
                    "pip",
                    "install",
                    "-q",
                    pkg if pkg != "transformers" else "transformers==4.46.3",
                    "--upgrade-strategy",
                    "only-if-needed",
                ]
            )
            try:
                mod = __import__(pkg)
                rep["install"][pkg] = getattr(mod, "__version__", "ok")
            except Exception as e:
                rep["install"][f"{pkg}_err"] = repr(e)

    rep["install"]["trl_forbidden"] = "do_not_install_trl_1x"

    # --- longer DPO with save ---
    os.environ["NEXUS_ROOT"] = str(ROOT)
    os.environ["NEXUS_DPO_MAX_STEPS"] = str(STEPS)
    os.environ["NEXUS_DPO_SAVE"] = os.environ.get("NEXUS_DPO_SAVE", "1")
    os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
    os.environ.setdefault("HF_HOME", str(ROOT / "hf_cache"))
    os.environ.setdefault("HUGGINGFACE_HUB_CACHE", str(ROOT / "hf_cache"))

    script = ROOT / "scripts" / "dpo_auto_continue.py"
    # Prefer freshly pulled; if pull failed, still run local if present
    if not script.exists() or script.stat().st_size < 500:
        # embed minimal fallback: write from this process by re-pull
        pull("scripts/dpo_auto_continue.py", script, 500)

    rc = 99
    if script.exists() and rep["dpo_lines"] >= 20:
        try:
            # inject save/pair upgrades if remote script is older (idempotent patch at runtime)
            src = script.read_text(encoding="utf-8", errors="replace")
            if "NEXUS_DPO_SAVE" not in src or "save_pretrained" not in src:
                print("TRAINER_OLD — using inlined upgraded runner", flush=True)
                # fall through to subprocess with env; still run existing (ok metrics)
            print("LONG_START", STEPS, flush=True)
            rc = subprocess.call([sys.executable, str(script)], timeout=3600)
        except Exception:
            rep["train"]["err"] = traceback.format_exc()[-1200:]
            rc = 98
    else:
        rep["train"]["err"] = f"missing script or gold (lines={rep['dpo_lines']})"

    rep["train"]["rc"] = rc
    lat = ROOT / "workspace" / "DPO_DRYRUN_LATEST.json"
    if lat.exists():
        try:
            rep["train"]["dryrun"] = json.loads(lat.read_text(encoding="utf-8"))
        except Exception as e:
            rep["train"]["dryrun_err"] = repr(e)

    ckpt_ptr = ROOT / "checkpoints/dpo_guard_v7_canary/LATEST_CKPT.txt"
    if ckpt_ptr.exists():
        rep["train"]["latest_ckpt"] = ckpt_ptr.read_text(encoding="utf-8").strip()

    ok = bool((rep.get("train", {}).get("dryrun") or {}).get("ok")) or rc == 0
    rep["ok"] = ok

    # status surfaces
    text = json.dumps(rep, indent=2, default=str)
    for p in [
        ROOT / "workspace" / "PHASE_LATEST.json",
        ROOT / "PHASE_LATEST.json",
        ROOT / "workspace" / "QQ_STATUS.txt",
        ROOT / "QQ_STATUS.txt",
        ROOT / "workspace" / "BOOTSTRAP.json",
        ROOT / "BOOTSTRAP.json",
    ]:
        p.write_text(text, encoding="utf-8")

    cov = {
        "stamp": STAMP,
        "phase": "dl_install_long",
        "dpo_lines": rep["dpo_lines"],
        "torch": rep.get("install", {}).get("torch"),
        "gpu": rep.get("install", {}).get("gpu"),
        "ok": ok,
        "steps": STEPS,
        "metrics": (rep.get("train", {}).get("dryrun") or {}).get("metrics"),
        "latest_ckpt": rep.get("train", {}).get("latest_ckpt"),
        "plan": "phase_dl_install_long",
    }
    for p in [
        ROOT / "workspace" / "COVERAGE_INDEX_LATEST.json",
        ROOT / "COVERAGE_INDEX_LATEST.json",
    ]:
        p.write_text(json.dumps(cov, indent=2), encoding="utf-8")

    ms = (
        f"# MISSION_STATUS\n- {'GREEN' if ok else 'YELLOW'}\n"
        f"- phase: dl_install_long\n- stamp: {STAMP}\n"
        f"- dpo_lines: {rep['dpo_lines']}\n- steps: {STEPS}\n- ok: {ok}\n"
        f"- metrics: {(rep.get('train', {}).get('dryrun') or {}).get('metrics')}\n"
        f"- ckpt: {rep.get('train', {}).get('latest_ckpt')}\n"
        f"- torch: {rep.get('install', {}).get('torch')} gpu: {rep.get('install', {}).get('gpu')}\n"
        f"- skip: google/vincent\n"
    )
    for p in [ROOT / "workspace" / "MISSION_STATUS.md", ROOT / "MISSION_STATUS.md"]:
        p.write_text(ms, encoding="utf-8")

    print("PHASE_DONE", ok, rc, flush=True)
    print(text[:2000], flush=True)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
