# Session2 tick 1 @ 20260710T142605Z
- host: nb-582b5f51afb6b085773ce464c2654850-0
- gpu: GPU 0: NVIDIA A100-SXM4-80GB (UUID: GPU-7c0d2770-c8c9-0e77-b020-8be5ced7f5ba)
- df: JuiceFS:discovery-prod   30G  578M   30G   2% /data

## train
{
  "stamp": "20260710T142610Z",
  "device": "cuda",
  "name": "NVIDIA A100-SXM4-80GB",
  "steps": 100,
  "size": 2048,
  "seed": 41,
  "sec": 0.38509440422058105,
  "sec_per_step": 0.0038509440422058107,
  "loss_start": 1.0002820491790771,
  "loss_end": 0.13668575882911682,
  "torch": "2.4.0+cu124"
}
WROTE /data/NEXUS/logs/train_runs/run_20260710T142610Z.json

## bench
{
  "device": "NVIDIA A100-SXM4-80GB",
  "torch": "2.4.0+cu124",
  "tests": [
    {
      "op": "matmul",
      "n": 2048,
      "reps": 8,
      "dt_s": 0.07509565353393555,
      "gflops": 1830.1851972017482
    },
    {
      "op": "matmul",
      "n": 4096,
      "reps": 4,
      "dt_s": 0.035418033599853516,
      "gflops": 15521.918017782718
    }
  ]
}

## train_runs
total 10
-rw-r--r-- 1 root root  279 Jul 10 14:26 metrics.jsonl
-rw-r--r-- 1 root root  302 Jul 10 14:26 run_20260710T142610Z.json
-rw-r--r-- 1 root root 9066 Jul 10 11:17 run_seed42_size2048_steps100.jsonl
