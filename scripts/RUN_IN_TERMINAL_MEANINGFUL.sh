#!/bin/bash
# Paste into a WORKING Intern bash terminal (not via CDP if tab is frozen).
# Meaningful progress: train_stub v2 + bench + report + git commit.
set -e
N=/data/NEXUS
mkdir -p "$N"/{logs/train_runs,workspace,reports,benches,git_backups/work/scripts,datasets/tiny,checkpoints}
cd "$N/git_backups/work" 2>/dev/null || {
  mkdir -p "$N/git_backups"
  cd "$N/git_backups"
  test -d session.git || git init --bare session.git
  test -d work || git clone session.git work
  cd work
}

cat > scripts/train_stub.py << 'PY'
#!/usr/bin/env python3
import argparse, json, time, pathlib, random
import torch

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--steps", type=int, default=100)
    ap.add_argument("--size", type=int, default=2048)
    ap.add_argument("--seed", type=int, default=42)
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
        "loss_start": losses[0],
        "loss_end": losses[-1],
        "torch": torch.__version__,
    }
    out = pathlib.Path("/data/NEXUS/logs/train_runs")
    out.mkdir(parents=True, exist_ok=True)
    path = out / f"run_{rec['stamp']}.json"
    path.write_text(json.dumps(rec, indent=2))
    with (out / "metrics.jsonl").open("a") as f:
        f.write(json.dumps(rec) + "\n")
    print(json.dumps(rec, indent=2))
    print("WROTE", path)

if __name__ == "__main__":
    main()
PY

echo "=== GPU ==="
nvidia-smi -L
python3 -c "import torch; print('cuda', torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else None)"

echo "=== TRAIN ==="
python3 scripts/train_stub.py --steps 100 --size 2048 --seed 42

echo "=== BENCH ==="
python3 << 'PY'
import json, time, pathlib, torch
assert torch.cuda.is_available()
dev = torch.device("cuda")
tests = []
for n, reps in ((2048, 8), (4096, 4)):
    a = torch.randn(n, n, device=dev)
    b = torch.randn(n, n, device=dev)
    torch.cuda.synchronize()
    t0 = time.time()
    for _ in range(reps):
        c = a @ b
    torch.cuda.synchronize()
    dt = time.time() - t0
    tests.append({"op": "matmul", "n": n, "reps": reps, "dt_s": dt, "gflops": reps * (2 * n**3) / dt / 1e9})
out = {"device": torch.cuda.get_device_name(0), "torch": torch.__version__, "tests": tests}
pathlib.Path("/data/NEXUS/logs/gpu_bench_suite.json").write_text(json.dumps(out, indent=2))
pathlib.Path("benches").mkdir(exist_ok=True)
pathlib.Path("benches/gpu_bench_suite.json").write_text(json.dumps(out, indent=2))
print(json.dumps(out, indent=2))
PY

R=/data/NEXUS/workspace/SESSION_PROGRESS_LATEST.md
{
  echo "# NEXUS Intern meaningful progress"
  echo "- UTC: $(date -u -Iseconds)"
  echo "- GPU: $(nvidia-smi -L 2>/dev/null | head -1)"
  echo "- df: $(df -h /data 2>/dev/null | tail -1)"
  echo
  echo "## Latest train"
  ls -t /data/NEXUS/logs/train_runs/run_*.json 2>/dev/null | head -1 | xargs cat 2>/dev/null
  echo
  echo "## Bench"
  cat /data/NEXUS/logs/gpu_bench_suite.json 2>/dev/null | head -40
  echo
  echo "## Git"
  git log -8 --oneline 2>/dev/null
} | tee "$R"

git config user.email "nexus@intern-gpu.local" 2>/dev/null || true
git config user.name "NEXUS Intern" 2>/dev/null || true
git add -A
git commit -m "progress: train_stub v2 + bench + report $(date -u +%Y%m%dT%H%M%SZ)" || true
git log -5 --oneline
echo
echo "MEANINGFUL_OK — files under /data/NEXUS/"
echo "If timer is low: extend session on d.intern workbench"
