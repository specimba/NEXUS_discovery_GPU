#!/usr/bin/env python3
"""Session3 GPU tick: train + bench + upload to reports/session3 via Contents API."""
import os, json, time, pathlib, base64, urllib.request, subprocess, sys
T = os.environ.get("T") or os.environ.get("GITHUB_TOKEN")
R = os.environ.get("R") or os.environ.get("GITHUB_REPO") or "specimba/NEXUS_discovery_GPU"
TICK = int(os.environ.get("TICK") or "1")
SESSION = os.environ.get("SESSION") or "session3"
if not T:
    print("NO_TOKEN"); sys.exit(2)
N = pathlib.Path("/data/NEXUS")
for sub in ["logs/train_runs", "workspace", f"reports/{SESSION}", "git_backups/work/scripts"]:
    (N / sub).mkdir(parents=True, exist_ok=True)
stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
try:
    gpu = subprocess.check_output(["nvidia-smi", "-L"], text=True, timeout=20).splitlines()[0]
except Exception as e:
    gpu = str(e)
import torch
device = "cuda" if torch.cuda.is_available() else "cpu"
torch.manual_seed(40 + TICK)
n, steps = 2048, 120
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
rec = dict(stamp=stamp, device=device, name=name, steps=steps, size=n, seed=40+TICK,
           sec=dt, sec_per_step=dt/steps, loss_start=losses[0], loss_end=losses[-1],
           torch=torch.__version__, gpu_line=gpu, tick=TICK, session=SESSION)
(N / "logs/train_runs" / f"run_{stamp}.json").write_text(json.dumps(rec, indent=2))
(N / "logs/last_train.txt").write_text(json.dumps(rec, indent=2))
print("TRAIN_OK", json.dumps(rec))
tests = []
if device == "cuda":
    for nn, reps in ((2048, 8), (4096, 4)):
        a = torch.randn(nn, nn, device=device)
        b = torch.randn(nn, nn, device=device)
        torch.cuda.synchronize(); t1 = time.time()
        for _ in range(reps):
            c = a @ b
        torch.cuda.synchronize(); dtt = time.time() - t1
        tests.append(dict(op="matmul", n=nn, reps=reps, dt_s=dtt, gflops=reps * (2 * nn**3) / dtt / 1e9))
bench = dict(device=name, torch=torch.__version__, tests=tests, stamp=stamp, tick=TICK)
(N / "logs/gpu_bench_suite.json").write_text(json.dumps(bench, indent=2))
(N / "logs/last_bench.txt").write_text(json.dumps(bench, indent=2))
print("BENCH_OK", json.dumps(bench)[:400])
md = f"# {SESSION} tick {TICK} @ {stamp}\n- host: {os.uname().nodename if hasattr(os,'uname') else 'gpu'}\n- gpu: {gpu}\n- df: {subprocess.getoutput('df -h /data | tail -1')}\n\n## train\n```\n{json.dumps(rec, indent=2)}\n```\n\n## bench\n```\n{json.dumps(bench, indent=2)}\n```\n"
rep = N / "reports" / SESSION / f"tick_{TICK}_{stamp}.md"
rep.write_text(md)
(N / "workspace/SESSION_PROGRESS_LATEST.md").write_text(md)

def upload(path, file, msg):
    p = pathlib.Path(file)
    if not p.is_file():
        print("SKIP", path); return
    b64 = base64.b64encode(p.read_bytes()).decode()
    url = f"https://api.github.com/repos/{R}/contents/{path}"
    headers = {"Authorization": f"Bearer {T}", "Accept": "application/vnd.github+json",
               "User-Agent": "nexus-s3", "Content-Type": "application/json"}
    sha = None
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=25) as resp:
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

upload(f"reports/{SESSION}/tick_{TICK}_{stamp}.md", str(rep), f"{SESSION} tick {TICK} {stamp}")
upload(f"reports/{SESSION}/SESSION_LATEST.md", str(N / "workspace/SESSION_PROGRESS_LATEST.md"), f"{SESSION} latest {TICK}")
upload(f"reports/{SESSION}/gpu_bench_tick{TICK}.json", str(N / "logs/gpu_bench_suite.json"), f"{SESSION} bench {TICK}")
upload(f"reports/{SESSION}/run_{stamp}.json", str(N / "logs/train_runs" / f"run_{stamp}.json"), f"{SESSION} train {TICK}")
print(f"TICK_{TICK}_COMPLETE", stamp)
