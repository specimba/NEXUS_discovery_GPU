#!/usr/bin/env python3
"""CUDA experiment stub for NEXUS Intern / discovery GPU sessions."""
from __future__ import annotations
import argparse, json, time, pathlib, random
import torch

def main():
    ap = argparse.ArgumentParser(description="NEXUS A100 train stub with metrics")
    ap.add_argument("--steps", type=int, default=100)
    ap.add_argument("--size", type=int, default=2048)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", type=str, default="/data/NEXUS/logs/train_runs")
    a = ap.parse_args()
    random.seed(a.seed)
    torch.manual_seed(a.seed)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cuda":
        torch.cuda.manual_seed_all(a.seed)
    name = torch.cuda.get_device_name(0) if device == "cuda" else "cpu"
    n = a.size
    x = torch.randn(n, n, device=device)
    w = torch.randn(n, n, device=device)
    losses = []
    t0 = time.time()
    for step in range(a.steps):
        y = torch.relu(x @ w / n)
        loss = float((y - x).pow(2).mean().item())
        losses.append(loss)
        w = w - 0.01 * (x.T @ (y - x) / n)
        x = 0.99 * x + 0.01 * y
        if device == "cuda" and step % 10 == 0:
            torch.cuda.synchronize()
    if device == "cuda":
        torch.cuda.synchronize()
    dt = time.time() - t0
    rec = {
        "stamp": time.strftime("%Y%m%dT%H%M%SZ", time.gmtime()),
        "device": device,
        "name": name,
        "steps": a.steps,
        "size": n,
        "seed": a.seed,
        "sec": dt,
        "sec_per_step": dt / max(a.steps, 1),
        "loss_start": losses[0] if losses else None,
        "loss_end": losses[-1] if losses else None,
        "torch": torch.__version__,
    }
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    path = out / f"run_{rec['stamp']}.json"
    path.write_text(json.dumps(rec, indent=2))
    with (out / "metrics.jsonl").open("a") as f:
        f.write(json.dumps(rec) + "\n")
    print(json.dumps(rec, indent=2))
    print("WROTE", path)

if __name__ == "__main__":
    main()
