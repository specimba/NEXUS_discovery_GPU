#!/usr/bin/env python3
"""Deep HF Hub search for NEXUS SLM factory (8GB deploy, A100 train)."""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone

from huggingface_hub import HfApi


def size_hint(tags, model_id: str) -> str:
    t = " ".join(tags or []).lower() + " " + model_id.lower()
    for s in (
        "0.5b",
        "0.6b",
        "1b",
        "1.5b",
        "1.7b",
        "2b",
        "2.5b",
        "3b",
        "3.5b",
        "4b",
        "7b",
        "8b",
        "9b",
        "12b",
        "14b",
        "27b",
        "32b",
        "70b",
    ):
        if s in t:
            return s
    return "?"


def role_guess(model_id: str, tags, pipeline) -> str:
    s = (model_id + " " + " ".join(tags or [])).lower()
    if any(
        x in s
        for x in (
            "guard",
            "safety",
            "moderation",
            "prompt-guard",
            "guardian",
            "injection",
            "jailbreak",
        )
    ):
        return "guard"
    if any(x in s for x in ("tool", "function", "agentic", "mcp", "hermes")):
        return "tool"
    if any(x in s for x in ("coder", "code")):
        return "code"
    if any(
        x in s
        for x in ("abliterat", "heretic", "obliterat", "uncensor", "decensor")
    ):
        return "task_uncensored"
    if any(x in s for x in ("eagle", "dflash", "speculat", "draft")):
        return "draft_sd"
    if any(x in s for x in ("embed", "gte-", "nomic", "bge-")):
        return "embed"
    if any(x in s for x in ("lora", "peft", "adapter")):
        return "adapter"
    if any(x in s for x in ("merge", "ties", "dare", "slerp")):
        return "merge"
    if pipeline == "text-classification":
        return "classifier"
    return "base_or_other"


def main() -> int:
    api = HfApi()
    filters = [
        dict(search="prompt-guard", sort="downloads", limit=15),
        dict(search="Llama-Guard-3", sort="downloads", limit=12),
        dict(search="walledguard", sort="downloads", limit=10),
        dict(search="granite-guardian", sort="downloads", limit=10),
        dict(search="Qwen2.5-0.5B", sort="downloads", limit=25),
        dict(search="Qwen2.5-1.5B", sort="downloads", limit=18),
        dict(search="Qwen2.5-3B-Instruct", sort="downloads", limit=18),
        dict(search="Qwen2.5-Coder-3B", sort="downloads", limit=15),
        dict(search="Qwen3-0.6B", sort="downloads", limit=15),
        dict(search="Qwen3-1.7B", sort="downloads", limit=15),
        dict(search="Qwen3-4B", sort="downloads", limit=12),
        dict(search="gemma-3-1b", sort="downloads", limit=15),
        dict(search="Llama-3.2-1B", sort="downloads", limit=15),
        dict(search="Llama-3.2-3B", sort="downloads", limit=12),
        dict(search="functiongemma", sort="downloads", limit=12),
        dict(search="VibeThinker-3B", sort="downloads", limit=25),
        dict(search="tool-calling 3B", sort="downloads", limit=18),
        dict(search="abliterated GGUF 3B", sort="downloads", limit=18),
        dict(search="OBLITERATED", sort="downloads", limit=18),
        dict(search="heretic GGUF", sort="downloads", limit=18),
        dict(search="DPO 0.5B", sort="downloads", limit=15),
        dict(search="DPO 1B", sort="downloads", limit=12),
        dict(search="EAGLE-3", sort="downloads", limit=12),
        dict(search="dflash", sort="downloads", limit=12),
        dict(search="speculative decoding", sort="downloads", limit=12),
        dict(search="Nanbeige", sort="downloads", limit=12),
        dict(search="Mythos-nano", sort="downloads", limit=12),
        dict(search="bashgemma", sort="downloads", limit=8),
        dict(search="Arch-Guard", sort="downloads", limit=8),
        dict(search="GLiGuard", sort="downloads", limit=8),
        dict(search="prompt injection classifier", sort="downloads", limit=12),
        dict(search="SmolLM2", sort="downloads", limit=15),
        dict(search="Phi-4-mini", sort="downloads", limit=12),
        dict(search="gemma-2-2b", sort="downloads", limit=12),
        dict(search="LoRA Qwen2.5-3B", sort="downloads", limit=15),
        dict(search="peft adapter Qwen2.5-0.5B", sort="downloads", limit=12),
        dict(search="security DPO", sort="downloads", limit=12),
        dict(search="refusal DPO", sort="downloads", limit=12),
        dict(search="OR-Bench", sort="downloads", limit=8),
        dict(search="agentic 3B GGUF", sort="downloads", limit=15),
        dict(search="Hermes 3B", sort="downloads", limit=12),
        dict(search="Nemotron Mini", sort="downloads", limit=10),
        dict(search="granite-3.1-2b", sort="downloads", limit=10),
        dict(search="IBM granite 3b guardian", sort="downloads", limit=10),
    ]

    seen: dict[str, bool] = {}
    rows: list[dict] = []

    for f in filters:
        try:
            models = list(api.list_models(**f))
        except Exception as e:
            print("ERR", f.get("search"), e)
            continue
        for m in models:
            mid = m.id
            if mid in seen:
                continue
            tags = list(m.tags or [])
            sh = size_hint(tags, mid)
            if sh in ("27b", "32b", "70b", "14b"):
                continue
            # skip multi-70b false positives with 12b edge allowed
            if "70b" in mid.lower() or "72b" in mid.lower():
                continue
            seen[mid] = True
            pipe = getattr(m, "pipeline_tag", None)
            rows.append(
                {
                    "id": mid,
                    "downloads": getattr(m, "downloads", 0) or 0,
                    "likes": getattr(m, "likes", 0) or 0,
                    "pipeline": pipe,
                    "library": getattr(m, "library_name", None),
                    "size_hint": sh,
                    "role": role_guess(mid, tags, pipe),
                    "tags": [
                        t
                        for t in tags
                        if t
                        in (
                            "gguf",
                            "peft",
                            "lora",
                            "apache-2.0",
                            "mit",
                            "llama",
                            "qwen",
                            "gemma",
                            "text-generation",
                            "safetensors",
                            "adapters",
                            "text-classification",
                        )
                        or "license:" in t
                    ][:14],
                    "search": f.get("search"),
                }
            )

    rows.sort(key=lambda r: (-r["downloads"], -r["likes"]))
    print("TOTAL_UNIQUE", len(rows))

    by: dict[str, list] = defaultdict(list)
    for r in rows:
        by[r["role"]].append(r)

    out = {
        "stamp": datetime.now(timezone.utc).isoformat(),
        "total": len(rows),
        "criteria": {
            "deploy_vram_gb": 8,
            "prefer_params": "0.5B-3B (edge 4B Q4, rare 9-12B full-card)",
            "roles": [
                "guard",
                "tool",
                "code",
                "task_uncensored",
                "draft_sd",
                "adapter",
                "merge",
            ],
            "factory": "A100-80GB train/merge/export",
            "exclude": "27B+ local train/serve",
        },
        "by_role": {},
    }

    for role, items in sorted(by.items(), key=lambda x: -len(x[1])):
        top = items[:20]
        out["by_role"][role] = top
        print(f"\n=== {role} n={len(items)} ===")
        for r in top[:14]:
            print(
                f"{r['downloads']:>9}  {r['likes']:>5}  {r['size_hint']:6}  {r['id']}"
            )

    path = (
        "/mnt/c/Users/speci.000/Documents/NEXUS_discovery_GPU/reports/session5/"
        "HF_SLM_DEEP_SEARCH.json"
    )
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    print("\nWROTE", path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
