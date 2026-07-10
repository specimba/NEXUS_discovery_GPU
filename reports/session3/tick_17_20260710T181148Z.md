# session3 tick 17 @ 20260710T181148Z
- host: nb-582b5f51afb6b085773ce464c2654850-0
- gpu: GPU 0: NVIDIA A100-SXM4-80GB (UUID: GPU-a4d58e91-84d1-f5cd-38ff-49500089c75c)
- df: JuiceFS:discovery-prod   30G  578M   30G   2% /data

## train
```
{
  "stamp": "20260710T181148Z",
  "device": "cuda",
  "name": "NVIDIA A100-SXM4-80GB",
  "steps": 120,
  "size": 2048,
  "seed": 57,
  "sec": 0.4199187755584717,
  "sec_per_step": 0.0034993231296539308,
  "loss_start": 1.0003374814987183,
  "loss_end": 0.09144928306341171,
  "torch": "2.4.0+cu124",
  "gpu_line": "GPU 0: NVIDIA A100-SXM4-80GB (UUID: GPU-a4d58e91-84d1-f5cd-38ff-49500089c75c)",
  "tick": 17,
  "session": "session3"
}
```

## bench
```
{
  "device": "NVIDIA A100-SXM4-80GB",
  "torch": "2.4.0+cu124",
  "tests": [
    {
      "op": "matmul",
      "n": 2048,
      "reps": 8,
      "dt_s": 0.007910013198852539,
      "gflops": 17375.312786069368
    },
    {
      "op": "matmul",
      "n": 4096,
      "reps": 4,
      "dt_s": 0.02915191650390625,
      "gflops": 18858.307782760516
    }
  ],
  "stamp": "20260710T181148Z",
  "tick": 17
}
```
