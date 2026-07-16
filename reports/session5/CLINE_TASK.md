# CLINE_TASK — nb-253ef43e stable workspace

YOLO ok. Skip Kilo. Use **bash** terminal (not Kubernetes).

```bash
mkdir -p /data/NEXUS/{workspace,logs,datasets/nexus_local,configs,scripts,checkpoints,hf_cache,m0_prep,.secrets}
curl -fsSL -o /tmp/boot.sh https://cdn.jsdelivr.net/gh/specimba/NEXUS_discovery_GPU@main/scripts/new_session_bootstrap.sh && bash /tmp/boot.sh
wc -l /data/NEXUS/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl
python3 -c "import torch; print(torch.__version__, torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else None)"
# if DTensor / transformers too new:
python3 -m pip install 'transformers==4.46.3' --upgrade-strategy only-if-needed
# optional smoke:
# NEXUS_DPO_MAX_STEPS=20 python3 /data/NEXUS/scripts/dpo_auto_continue.py
```

Write results into `/data/NEXUS/workspace/MISSION_STATUS.md`. Never echo API keys. Echo `CLINE_BOOT_DONE` at end.
