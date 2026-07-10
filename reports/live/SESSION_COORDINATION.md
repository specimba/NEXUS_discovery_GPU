# NEXUS discovery GPU — coordination status

- UTC: 2026-07-10T12:58:10+00:00
- Repo package: commit f688336 (train_stub, gpu_bench, tick_1, docs)
- Intern code-server: reachable via CDP (monaco true)
- GPU live metrics: generated on-box under /data/NEXUS; auto-upload from GPU may be blocked (egress/git/API)
- Sparse longrun: active every 15m (terminal bursts only)
- Operator: extend Intern timer if <1h remaining

## On GPU verify
```bash
ls -la /data/NEXUS/logs
cat /data/NEXUS/workspace/SESSION_PROGRESS_LATEST.md
python3 /data/NEXUS/git_backups/work/scripts/train_stub.py --steps 50 --size 1024 --seed 1
```

## Pull on GPU
```bash
cd /data/NEXUS/git_backups
git clone https://github.com/specimba/NEXUS_discovery_GPU.git work
# or
cd work && git pull origin main
```
