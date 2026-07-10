#!/usr/bin/env python3
"""Session2: train (if needed) + upload reports/session2/* via Contents API."""
import os, json, base64, time, pathlib, urllib.request, subprocess, sys

T = os.environ.get("T") or os.environ.get("GITHUB_TOKEN")
R = os.environ.get("R") or os.environ.get("GITHUB_REPO") or "specimba/NEXUS_discovery_GPU"
TICK = int(os.environ.get("TICK") or "1")
if not T:
    print("NO_TOKEN"); sys.exit(2)

N = pathlib.Path("/data/NEXUS")
for p in ["logs/train_runs", "workspace", "reports", "git_backups/work/scripts"]:
    (N / p).mkdir(parents=True, exist_ok=True)
stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())

try:
    gpu = subprocess.check_output(["nvidia-smi", "-L"], text=True, timeout=20).splitlines()[0]
except Exception as e:
    gpu = str(e)

# Prefer package train_stub if present
train_py = N / "git_backups/work/scripts/train_stub.py"
bench_py = N / "git_backups/work/scripts/gpu_bench.py"
if train_py.is_file():
    subprocess.run(
        [sys.executable, str(train_py), "--steps", "100", "--size", "2048", "--seed", str(40 + TICK)],
        cwd=str(N / "git_backups/work"),
        check=False,
    )
else:
    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    torch.manual_seed(40 + TICK)
    n, steps = 2048, 100
    x = torch.randn(n, n, device=device)
    w = torch.randn(n, n, device=device)
    losses = []
    t0 = time.time()
    for step in range(steps):
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
    name = torch.cuda.get_device_name(0) if device == "cuda" else "cpu"
    rec = dict(
        stamp=stamp, device=device, name=name, steps=steps, size=n, seed=40 + TICK,
        sec=dt, sec_per_step=dt / steps, loss_start=losses[0], loss_end=losses[-1],
        torch=torch.__version__, gpu_line=gpu, tick=TICK,
    )
    (N / "logs/train_runs" / f"run_{stamp}.json").write_text(json.dumps(rec, indent=2))
    (N / "logs/last_train.txt").write_text(json.dumps(rec, indent=2))
    print("INLINE_TRAIN", json.dumps(rec))

if bench_py.is_file():
    subprocess.run([sys.executable, str(bench_py)], cwd=str(N / "git_backups/work"), check=False)
else:
    import torch
    if torch.cuda.is_available():
        tests = []
        for nn, reps in ((2048, 8), (4096, 4)):
            a = torch.randn(nn, nn, device="cuda")
            b = torch.randn(nn, nn, device="cuda")
            torch.cuda.synchronize()
            t1 = time.time()
            for _ in range(reps):
                c = a @ b
            torch.cuda.synchronize()
            dtt = time.time() - t1
            tests.append(dict(op="matmul", n=nn, reps=reps, dt_s=dtt, gflops=reps * (2 * nn**3) / dtt / 1e9))
        bench = dict(device=torch.cuda.get_device_name(0), torch=torch.__version__, tests=tests, stamp=stamp)
        (N / "logs/gpu_bench_suite.json").write_text(json.dumps(bench, indent=2))
        (N / "logs/last_bench.txt").write_text(json.dumps(bench, indent=2))
        print("INLINE_BENCH", json.dumps(bench)[:300])

# Report md
lt = (N / "logs/last_train.txt").read_text() if (N / "logs/last_train.txt").is_file() else ""
lb = (N / "logs/last_bench.txt").read_text() if (N / "logs/last_bench.txt").is_file() else ""
md = f"# Session2 tick {TICK} @ {stamp}\n- gpu: {gpu}\n\n## train\n```\n{lt[-2000:]}\n```\n\n## bench\n```\n{lb[-2000:]}\n```\n"
rep = N / "reports" / f"tick_{TICK}_{stamp}.md"
rep.write_text(md)
(N / "workspace/SESSION_PROGRESS_LATEST.md").write_text(md)

def upload(path, file, msg):
    p = pathlib.Path(file)
    if not p.is_file():
        print("SKIP", path)
        return
    b64 = base64.b64encode(p.read_bytes()).decode()
    url = f"https://api.github.com/repos/{R}/contents/{path}"
    headers = {
        "Authorization": f"Bearer {T}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "nexus-s2",
        "Content-Type": "application/json",
    }
    sha = None
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=25) as resp:
            sha = json.load(resp).get("sha")
    except Exception:
        pass
    body = {"message": msg, "content": b64}
    if sha:
        body["sha"] = sha
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="PUT", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            out = json.load(resp)
            print("UPLOAD_OK", path, (out.get("commit") or {}).get("sha", "")[:7])
    except Exception as e:
        print("UPLOAD_FAIL", path, e)

upload(f"reports/session2/{rep.name}", str(rep), f"session2 {rep.name}")
upload("reports/session2/SESSION_LATEST.md", str(N / "workspace/SESSION_PROGRESS_LATEST.md"), f"session2 latest {TICK}")
for cand in [
    N / "logs/gpu_bench_suite.json",
    N / "git_backups/work/benches/gpu_bench_suite.json",
]:
    if cand.is_file():
        upload(f"reports/session2/gpu_bench_tick{TICK}.json", str(cand), f"session2 bench {TICK}")
        break
runs = sorted((N / "logs/train_runs").glob("run_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
if runs:
    upload(f"reports/session2/{runs[0].name}", str(runs[0]), f"session2 train {TICK}")
if (N / "logs/last_train.txt").is_file():
    upload(f"reports/session2/last_train_tick{TICK}.txt", str(N / "logs/last_train.txt"), f"session2 last_train {TICK}")
if (N / "logs/last_bench.txt").is_file():
    upload(f"reports/session2/last_bench_tick{TICK}.txt", str(N / "logs/last_bench.txt"), f"session2 last_bench {TICK}")
print(f"TICK_{TICK}_COMPLETE", stamp)