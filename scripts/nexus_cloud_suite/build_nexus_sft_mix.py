#!/usr/bin/env python3
"""Build a small NEXUS-style SFT/tool mix from local JSON/JSONL shards.

No network required if shards already on disk under /data/NEXUS/datasets or HF cache.
Security: skips paths that look like secret dumps; redacts token-like strings in samples.
"""
from __future__ import annotations

import json
import os
import random
import re
import sys
import time
from pathlib import Path

TOKEN_RE = re.compile(r"(hf_|github_pat_|gho_|sk-|Bearer\s+)[A-Za-z0-9_\-\.]+", re.I)


def redact(s: str) -> str:
    return TOKEN_RE.sub(r"\1***", s)


def load_jsonl(path: Path, limit: int = 500) -> list[dict]:
    rows = []
    try:
        with path.open("r", encoding="utf-8", errors="replace") as f:
            for i, line in enumerate(f):
                if i >= limit:
                    break
                line = line.strip()
                if not line:
                    continue
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    except OSError:
        pass
    return rows


def load_json(path: Path) -> list | dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except Exception:
        return None


def normalize_row(obj: dict, source: str) -> dict | None:
    """Map heterogeneous HF/tool datasets into {messages|prompt/response}."""
    if not isinstance(obj, dict):
        return None
    # common shapes
    if "messages" in obj and isinstance(obj["messages"], list):
        msgs = obj["messages"]
    elif "conversations" in obj:
        msgs = obj["conversations"]
    elif "prompt" in obj and ("response" in obj or "chosen" in obj):
        resp = obj.get("response") or obj.get("chosen") or ""
        msgs = [{"role": "user", "content": str(obj["prompt"])}, {"role": "assistant", "content": str(resp)}]
    elif "instruction" in obj:
        inp = obj.get("input") or obj.get("context") or ""
        out = obj.get("output") or obj.get("response") or ""
        user = str(obj["instruction"]) + (("\n" + str(inp)) if inp else "")
        msgs = [{"role": "user", "content": user}, {"role": "assistant", "content": str(out)}]
    else:
        # tools / function call variants
        if "query" in obj and "answers" in obj:
            msgs = [{"role": "user", "content": str(obj["query"])}, {"role": "assistant", "content": json.dumps(obj["answers"])[:4000]}]
        else:
            return None

    clean = []
    for m in msgs:
        if not isinstance(m, dict):
            continue
        role = m.get("role") or m.get("from") or "user"
        content = m.get("content") or m.get("value") or m.get("text") or ""
        if isinstance(content, (dict, list)):
            content = json.dumps(content, ensure_ascii=False)[:4000]
        content = redact(str(content))[:8000]
        if not content.strip():
            continue
        # map ShareGPT roles
        role = {"human": "user", "gpt": "assistant", "system": "system"}.get(str(role).lower(), str(role).lower())
        if role not in ("user", "assistant", "system", "tool"):
            role = "user"
        clean.append({"role": role, "content": content})
    if len(clean) < 2:
        return None
    return {"messages": clean, "source": source}


def gather_candidates(roots: list[Path], max_files: int = 40) -> list[Path]:
    files = []
    for root in roots:
        if not root.is_dir():
            continue
        for p in root.rglob("*"):
            if p.suffix.lower() in (".jsonl", ".json") and p.is_file():
                # skip huge indexes
                if p.stat().st_size > 200_000_000:
                    continue
                if any(x in p.name.lower() for x in ("secret", "token", "credential", ".env")):
                    continue
                files.append(p)
            if len(files) >= max_files:
                return files
    return files


def main() -> int:
    data = Path(os.environ.get("NEXUS_DATA", "/data/NEXUS"))
    d_local = Path(os.environ.get("NEXUS_MODELS_DATASETS", ""))
    roots = [data / "datasets", data / "workspace", Path("/root/NEXUS/datasets")]
    if d_local.is_dir():
        roots.insert(0, d_local)

    max_samples = int(os.environ.get("MIX_MAX", "800"))
    seed = int(os.environ.get("MIX_SEED", "42"))
    random.seed(seed)

    files = gather_candidates(roots)
    samples = []
    stats = {"files": 0, "rows_read": 0, "kept": 0, "sources": {}}

    for fp in files:
        stats["files"] += 1
        src = str(fp)
        if fp.suffix == ".jsonl":
            rows = load_jsonl(fp, limit=300)
        else:
            raw = load_json(fp)
            if isinstance(raw, list):
                rows = raw[:300]
            elif isinstance(raw, dict) and "data" in raw and isinstance(raw["data"], list):
                rows = raw["data"][:300]
            else:
                rows = []
        stats["rows_read"] += len(rows)
        for r in rows:
            n = normalize_row(r, source=fp.name)
            if not n:
                continue
            samples.append(n)
            stats["sources"][fp.name] = stats["sources"].get(fp.name, 0) + 1
            stats["kept"] += 1
            if len(samples) >= max_samples * 3:
                break
        if len(samples) >= max_samples * 3:
            break

    # Always inject synthetic edge-case / tool rows for stress+NEXUS identity
    synth = [
        {
            "messages": [
                {"role": "system", "content": "You are a NEXUS cloud agent. Never echo secrets."},
                {"role": "user", "content": "List GPU and refuse to print any API keys."},
                {"role": "assistant", "content": "I can report device names via nvidia-smi, but I will never print tokens or credentials."},
            ],
            "source": "synthetic_security",
        },
        {
            "messages": [
                {"role": "user", "content": "Call tool get_gpu_stats with empty args."},
                {"role": "assistant", "content": "{\"name\": \"get_gpu_stats\", \"arguments\": {}}"},
            ],
            "source": "synthetic_tool",
        },
        {
            "messages": [
                {"role": "user", "content": ""},
                {"role": "assistant", "content": "I need a non-empty request to help."},
            ],
            "source": "synthetic_edge_empty",
        },
    ]
    samples.extend(synth)
    random.shuffle(samples)
    samples = samples[:max_samples]

    out_dir = data / "datasets" / "nexus_mix"
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    out = out_dir / f"sft_mix_{stamp}.jsonl"
    with out.open("w", encoding="utf-8") as f:
        for s in samples:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")
    meta = {
        "stamp": stamp,
        "path": str(out),
        "n_samples": len(samples),
        "stats": stats,
        "seed": seed,
    }
    (out_dir / "LATEST_MIX.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print("MIX_OK", json.dumps(meta))
    return 0


if __name__ == "__main__":
    import time

    sys.exit(main())
