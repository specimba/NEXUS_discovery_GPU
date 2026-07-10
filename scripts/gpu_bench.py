#!/usr/bin/env python3
"""Matmul microbench for A100 lane."""
import json, time, pathlib, torch
def main():
    assert torch.cuda.is_available(), "CUDA required"
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
    pathlib.Path("benches").mkdir(exist_ok=True)
    pathlib.Path("benches/gpu_bench_suite.json").write_text(json.dumps(out, indent=2))
    print(json.dumps(out, indent=2))
if __name__ == "__main__":
    main()
