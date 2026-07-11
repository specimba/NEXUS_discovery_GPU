#!/usr/bin/env python3
"""HF Hub deep search for NEXUS training/benchmark datasets.

Security: HF_TOKEN optional via env only. No secrets written to disk.
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

# Prefer huggingface_hub; fall back to REST
try:
    from huggingface_hub import HfApi, list_datasets
except ImportError:
    HfApi = None
    list_datasets = None

QUERIES = {
    "tool_calling": [
        "function calling",
        "tool use",
        "glaive function",
        "hermes function calling",
        "xlam function",
    ],
    "safety_guard": [
        "prompt injection",
        "jailbreak dataset",
        "safety preference",
        "dpo safety",
        "refusal dataset",
    ],
    "reasoning_sft": [
        "reasoning sft",
        "chain of thought distill",
        "ultrainteract",
        "openhermes",
    ],
    "code_agent": [
        "swe bench trajectories",
        "code agent sft",
        "openhands trajectories",
    ],
    "mcp_agent": [
        "mcp tool",
        "multi agent tool use",
        "api gen tool",
    ],
}

# Curated shortlist from D: HF search + plan S3 (always include)
CURATED = [
    {"id": "glaiveai/glaive-function-calling-v2", "cat": "tool_calling", "local": "glaive-function-calling-v2"},
    {"id": "NousResearch/hermes-function-calling-v1", "cat": "tool_calling", "local": "test-hermes-function-calling-v1"},
    {"id": "Salesforce/APIGen-MT-5k", "cat": "tool_calling", "local": "test-APIGen-MT-5k"},
    {"id": "openbmb/UltraInteract_sft", "cat": "reasoning_sft", "local": "test-UltraInteract_sft"},
    {"id": "Salesforce/xlam-function-calling-60k", "cat": "tool_calling", "local": "xlam-function-calling-60k", "gated": True},
    {"id": "princeton-nlp/SWE-bench_Verified", "cat": "code_agent", "local": None},
    {"id": "SWE-Gym/OpenHands-SFT-Trajectories", "cat": "code_agent", "local": None},
]


def redact(s: str) -> str:
    import re
    return re.sub(r"(hf_|github_pat_|gho_|sk-)[A-Za-z0-9_\-]+", r"\1***", s)


def search_rest(query: str, limit: int = 8) -> list[dict]:
    import urllib.parse
    import urllib.request

    q = urllib.parse.quote(query)
    url = f"https://huggingface.co/api/datasets?search={q}&limit={limit}&full=true"
    req = urllib.request.Request(url, headers={"User-Agent": "nexus-cloud-suite"})
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=40) as resp:
            data = json.load(resp)
    except Exception as e:
        return [{"error": redact(str(e)), "query": query}]
    out = []
    for d in data if isinstance(data, list) else []:
        out.append(
            {
                "id": d.get("id") or d.get("modelId"),
                "downloads": d.get("downloads"),
                "likes": d.get("likes"),
                "tags": (d.get("tags") or [])[:12],
                "gated": d.get("gated"),
                "query": query,
            }
        )
    return out


def search_hub(query: str, limit: int = 8) -> list[dict]:
    if list_datasets is None:
        return search_rest(query, limit)
    out = []
    try:
        for d in list_datasets(search=query, limit=limit):
            out.append(
                {
                    "id": getattr(d, "id", None),
                    "downloads": getattr(d, "downloads", None),
                    "likes": getattr(d, "likes", None),
                    "tags": list(getattr(d, "tags", None) or [])[:12],
                    "gated": getattr(d, "gated", None),
                    "query": query,
                }
            )
    except Exception as e:
        return [{"error": redact(str(e)), "query": query}]
    return out


def main() -> int:
    root = Path(os.environ.get("NEXUS_DATA", "/data/NEXUS"))
    out_dir = root / "datasets" / "hf_search"
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    results = {"stamp": stamp, "categories": {}, "curated": CURATED, "token_used": bool(os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN"))}

    for cat, qs in QUERIES.items():
        hits = []
        for q in qs:
            hits.extend(search_hub(q, limit=5))
            time.sleep(0.3)
        # dedupe by id
        seen = set()
        uniq = []
        for h in hits:
            i = h.get("id")
            if not i or i in seen:
                continue
            seen.add(i)
            uniq.append(h)
        uniq.sort(key=lambda x: (x.get("downloads") or 0), reverse=True)
        results["categories"][cat] = uniq[:15]
        print(f"CAT {cat} hits={len(uniq)}")

    # local D: inventory if mounted (optional on Windows host path via env)
    d_path = os.environ.get("NEXUS_MODELS_DATASETS", "")
    local = []
    if d_path and Path(d_path).is_dir():
        for p in sorted(Path(d_path).iterdir()):
            if p.is_dir():
                local.append({"name": p.name, "path": str(p)})
    results["local_d_datasets"] = local

    out = out_dir / f"search_{stamp}.json"
    out.write_text(json.dumps(results, indent=2), encoding="utf-8")
    (out_dir / "LATEST.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    print("WROTE", out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
