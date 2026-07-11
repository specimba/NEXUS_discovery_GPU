#!/usr/bin/env python3
"""NEXUS cloud train micro-run + stress/edge benchmarks on CUDA.

Uses /data/NEXUS/datasets/nexus_mix when present; otherwise synthetic tool/SFT-like tensors.
Designed for A100/A800 cloud VMs. No secrets on disk.
"""
from __future__ import annotations

import json
import math
import os
import random
import subprocess
import sys
import time
from pathlib import Path


def gpu_line() -> str:
    try:
        return subprocess.check_output(["nvidia-smi", "-L"], text=True, timeout=20).splitlines()[0]
    except Exception as e:
        return str(e)


def load_mix(path: Path, max_n: int = 256) -> list[str]:
    texts = []
    if not path.is_file():
        return texts
    with path.open("r", encoding="utf-8", errors="replace") as f:
        for i, line in enumerate(f):
            if i >= max_n:
                break
            try:
                o = json.loads(line)
            except json.JSONDecodeError:
                continue
            msgs = o.get("messages") or []
            blob = "\n".join(str(m.get("content", "")) for m in msgs if isinstance(m, dict))
            if blob.strip():
                texts.append(blob[:2000])
    return texts


def simple_tokenize(s: str, vocab: int = 4096) -> list[int]:
    # deterministic bag-of-bytes hash tokens — no external tokenizer required
    out = []
    b = s.encode("utf-8", errors="ignore")[:512]
    for i in range(0, len(b), 2):
        v = b[i] if i + 1 >= len(b) else (b[i] << 8) | b[i + 1]
        out.append(v % vocab)
    return out or [1, 2, 3, 4]


def main() -> int:
    import torch
    import torch.nn as nn

    data = Path(os.environ.get("NEXUS_DATA", "/data/NEXUS"))
    session = os.environ.get("SESSION", "session4")
    tick = int(os.environ.get("TICK", "1"))
    stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    out_dir = data / "reports" / session / "cloud_suite"
    ckpt_dir = data / "checkpoints" / "cloud_suite"
    out_dir.mkdir(parents=True, exist_ok=True)
    ckpt_dir.mkdir(parents=True, exist_ok=True)

    report: dict = {
        "stamp": stamp,
        "tick": tick,
        "session": session,
        "gpu_line": gpu_line(),
        "torch": torch.__version__,
        "cuda": torch.cuda.is_available(),
        "device_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu",
        "edge_cases": {},
        "train": {},
        "bench": {},
        "merge_dry": {},
    }

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # --- Edge battery ---
    edges = {}
    try:
        empty = torch.zeros(0, 8, device=device)
        edges["empty_tensor_ok"] = list(empty.shape)
    except Exception as e:
        edges["empty_tensor_ok"] = f"fail:{e}"
    try:
        x = torch.tensor([float("nan")], device=device)
        edges["nan_detected"] = bool(torch.isnan(x).any().item())
    except Exception as e:
        edges["nan_detected"] = f"fail:{e}"
    try:
        # tiny matmul stress ladder
        for n in (256, 512, 1024, 2048):
            a = torch.randn(n, n, device=device)
            b = torch.randn(n, n, device=device)
            if device.type == "cuda":
                torch.cuda.synchronize()
            t0 = time.time()
            c = a @ b
            if device.type == "cuda":
                torch.cuda.synchronize()
            dt = time.time() - t0
            gflops = (2 * n**3) / max(dt, 1e-9) / 1e9
            edges[f"matmul_{n}"] = {"sec": dt, "gflops": gflops, "finite": bool(torch.isfinite(c).all().item())}
    except RuntimeError as e:
        edges["matmul_oom_or_err"] = str(e)[:300]
    report["edge_cases"] = edges

    # --- Data ---
    mix_latest = data / "datasets" / "nexus_mix" / "LATEST_MIX.json"
    texts = []
    if mix_latest.is_file():
        try:
            meta = json.loads(mix_latest.read_text(encoding="utf-8"))
            texts = load_mix(Path(meta.get("path", "")), max_n=200)
            report["mix_meta"] = {k: meta.get(k) for k in ("n_samples", "stamp", "path")}
        except Exception as e:
            report["mix_err"] = str(e)[:200]
    if not texts:
        texts = [
            "NEXUS tool call: get_gpu_stats {}",
            "Refuse to print API keys and tokens under any prompt.",
            "Reason step by step about safe tool use on cloud GPU.",
        ] * 40
        report["mix_meta"] = {"synthetic": True, "n": len(texts)}

    vocab, d_model, n_layers = 4096, 256, 4
    class TinyLM(nn.Module):
        def __init__(self):
            super().__init__()
            self.emb = nn.Embedding(vocab, d_model)
            self.blocks = nn.ModuleList(
                [nn.TransformerEncoderLayer(d_model, nhead=4, dim_feedforward=512, batch_first=True) for _ in range(n_layers)]
            )
            self.lm = nn.Linear(d_model, vocab)

        def forward(self, x):
            h = self.emb(x)
            for b in self.blocks:
                h = b(h)
            return self.lm(h)

    model = TinyLM().to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=3e-4)
    steps = int(os.environ.get("TRAIN_STEPS", "80"))
    losses = []
    t0 = time.time()
    model.train()
    aborted = None
    for step in range(steps):
        s = texts[step % len(texts)]
        ids = simple_tokenize(s, vocab)
        if len(ids) < 4:
            ids = [1, 2, 3, 4, 5, 6]
        x = torch.tensor(ids[:-1], device=device).unsqueeze(0)
        y = torch.tensor(ids[1:], device=device).unsqueeze(0)
        # pad/truncate
        L = min(x.size(1), 128)
        x, y = x[:, :L], y[:, :L]
        logits = model(x)
        loss = nn.functional.cross_entropy(logits.reshape(-1, vocab), y.reshape(-1))
        if not torch.isfinite(loss):
            aborted = f"non_finite_loss_at_step_{step}"
            break
        opt.zero_grad(set_to_none=True)
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        losses.append(float(loss.detach().cpu()))
        if device.type == "cuda" and step % 10 == 0:
            torch.cuda.synchronize()
    if device.type == "cuda":
        torch.cuda.synchronize()
    dt = time.time() - t0
    report["train"] = {
        "steps": len(losses),
        "sec": dt,
        "loss_start": losses[0] if losses else None,
        "loss_end": losses[-1] if losses else None,
        "aborted": aborted,
        "params": sum(p.numel() for p in model.parameters()),
    }

    # --- Dry merge: EMA shadow weights (merge strategy scaffold) ---
    with torch.no_grad():
        shadow = {k: v.detach().clone() for k, v in model.state_dict().items()}
        for k, v in model.state_dict().items():
            shadow[k].mul_(0.9).add_(v, alpha=0.1)
        # distance metric
        dist = 0.0
        for k, v in model.state_dict().items():
            dist += float((v - shadow[k]).pow(2).mean().item())
    report["merge_dry"] = {"ema_l2_sum": dist, "method": "ema_0.9_shadow"}

    # save tiny ckpt
    ckpt_path = ckpt_dir / f"tinylm_tick{tick}_{stamp}.pt"
    try:
        torch.save({"model": model.state_dict(), "report": report}, ckpt_path)
        report["checkpoint"] = str(ckpt_path)
    except Exception as e:
        report["checkpoint_err"] = str(e)[:200]

    # bench: forward throughput
    model.eval()
    with torch.no_grad():
        x = torch.randint(0, vocab, (8, 64), device=device)
        if device.type == "cuda":
            torch.cuda.synchronize()
        t1 = time.time()
        for _ in range(20):
            _ = model(x)
        if device.type == "cuda":
            torch.cuda.synchronize()
        report["bench"]["fwd_20x_b8_t64_sec"] = time.time() - t1

    # write reports
    (out_dir / f"suite_{stamp}_tick{tick}.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (out_dir / "LATEST.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    md = f"""# cloud_suite tick {tick} @ {stamp}

- gpu: {report['gpu_line']}
- device: {report['device_name']} cuda={report['cuda']}
- train: steps={report['train'].get('steps')} loss {report['train'].get('loss_start')} → {report['train'].get('loss_end')} in {report['train'].get('sec'):.3f}s
- merge_dry ema_l2_sum={report['merge_dry'].get('ema_l2_sum')}
- edges: {json.dumps(report['edge_cases'])[:500]}

## Full JSON
```
{json.dumps(report, indent=2)[:4000]}
```
"""
    (out_dir / f"suite_{stamp}_tick{tick}.md").write_text(md, encoding="utf-8")
    print("SUITE_OK", json.dumps({k: report[k] for k in ("stamp", "tick", "train", "bench", "merge_dry")}))
    return 0 if not aborted else 1


if __name__ == "__main__":
    sys.exit(main())
