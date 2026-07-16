# SCP & Dataset resources (session5)

## Portals
| Resource | URL |
|----------|-----|
| SCP on Discovery | https://discovery.intern-ai.org.cn/scp |
| Dataset square | https://discovery.intern-ai.org.cn/dataset |
| SCP Hub | https://scphub.intern-ai.org.cn/ |
| Public tool DB | https://yankai96.github.io/SCP_Tool_List/ |
| Protocol + skills | https://github.com/InternScience/scp |

## Auth
- Discovery **API Key** (密钥管理): 6 months, RPM 500 default  
- Store only: `/data/NEXUS/.secrets/scp_api_key` and local `Documents/NEXUS/.secrets/intern_scp_api_key`  
- **Do not** commit keys  
- Host-side probe of Hub with Bearer/X-API-Key returned `msg: user token expired` — treat hub list APIs as needing **browser session JWT** and/or **per-server keys** from each tool page (SCP README: replace key on each server page)

## Why useful beyond DPO gold
- **Governance / safety eval:** chemical_safety, drug_warning, toxicity, ADMET skills → enrich or score NEXUS guard pairs  
- **Biology/chem compute:** docking, protein structure, multiomics — optional eval stress sets  
- **Literature:** PubMed / PDF skills for dataset curation  
- **Datasets square:** public scientific datasets to mix with local `v7_dpo_pairs_fixed.jsonl` (after license check)

## Local adapter
- `nexus_os/bridge/intern_discovery.py` — maps 8 primary SCP-style tools to MCP (currently simulated call path); wire live endpoints when hub auth format confirmed
