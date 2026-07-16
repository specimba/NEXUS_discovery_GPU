# MISSION_STATUS — new account / new A100

- **Machine:** `nb-253ef43eacdbe4e480503d693d5026ed` (inside/101)
- **Code:** `discovery-notebook-p.../notebook/81100172/nb-253ef43e.../code/?folder=/data/NEXUS/workspace`
- **GPU:** NVIDIA A100 ×1 · 80Gi (from IDE header)
- **Agent:** **Cline primary** (YOLO + deepseek-v4-flash). **Kilo skip** (EEXIST server connection failed)
- **GitHub:** logged in on IDE
- **Google:** sign-in when a **bash** terminal works (avoid Kubernetes profile)

## Critical fix first
IDE error: `cwd /data/NEXUS/workspace is not a directory`  
→ create real dirs:

```bash
mkdir -p /data/NEXUS/{workspace,logs,datasets/nexus_local,configs,scripts,checkpoints,hf_cache,m0_prep,.secrets}
```

Then re-open folder `/data/NEXUS/workspace` or `/data/NEXUS`.

## Bootstrap (from GitHub)
```bash
curl -fsSL -o /tmp/boot.sh https://cdn.jsdelivr.net/gh/specimba/NEXUS_discovery_GPU@main/scripts/new_session_bootstrap.sh
bash /tmp/boot.sh
```

Stages DPO gold (150 lines), configs, `dpo_auto_continue.py`, writes `BOOTSTRAP.json` + `CLINE_TASK.md`.

## Stack freeze (from prior session)
- torch **2.4.x+cu124** — do not upgrade torch
- if `DTensor` import error: `pip install 'transformers==4.46.3' --upgrade-strategy only-if-needed`
- TRL-free DPO: `NEXUS_DPO_MAX_STEPS=20 python3 /data/NEXUS/scripts/dpo_auto_continue.py`

## SCP + Datasets (new API key)
- Square: https://scphub.intern-ai.org.cn/ · https://discovery.intern-ai.org.cn/scp
- Datasets: https://discovery.intern-ai.org.cn/dataset  
- Tool list: https://yankai96.github.io/SCP_Tool_List/  
- Skills (206): https://github.com/InternScience/scp/tree/main/skills  
- **Key storage:** `/data/NEXUS/.secrets/scp_api_key` only (chmod 600). **Never git.**  
- Note: Hub returned `user token expired` for raw Bearer/API-Key probes from host; many tools use **per-tool keys** on each SCP server page. Platform session JWT may also be required for hub list APIs.

### High-value skills for NEXUS guard lane
`drug_warning_report` · `chemical_safety_assessment` · `admet_druglikeness_report` · `toxicity_assessment` · `drug_safety_profile` · literature/PubMed skills · protein/structure tools as needed

## Terminal tips (this VM)
- Use **bash** terminal profile, not **Kubernetes**
- Helm/kubectl CDN may fail (low bandwidth) — skip k8s tooling for train lane
- **PIP Manager** extension: install `transformers==4.46.3`, `datasets`, `huggingface_hub` if terminal flaky
- Extensions already useful: Python, Jupyter, GitHub, Cline, PIP Manager

## Old session carry-forward
Prior nb-582b5f51: DPO gold + 20/50/100-step train path proven; artifacts on GitHub `NEXUS_discovery_GPU` main.
