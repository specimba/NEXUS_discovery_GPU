# ORCH_10H — nb-253ef43e A100 (autonomous)

## Non-negotiables
- Do **not** ask the human to run cloud steps
- Skip Vincent + Google login blockers
- Cline = execute; Kilo = plan/docs (if healthy)
- torch freeze 2.4; transformers pin 4.46.3 if DTensor fails
- Secrets only under `/data/NEXUS/.secrets/` (never git)

## Wave plan (repeat until time/points end)
1. **Paths:** ensure `/data/NEXUS/workspace` dir + `/home/jovyan/Desktop/NEXUS` → `/data/NEXUS`
2. **Stage:** jsDelivr gold DPO 150 + `dpo_auto_continue.py` + config
3. **Smoke:** `NEXUS_DPO_MAX_STEPS=20` then **50** then **100** if green
4. **Coverage:** write COVERAGE/MISSION/BOOTSTRAP on JuiceFS
5. **SCP later:** skill probes for guard eval when hub auth works
6. **GitHub:** push metrics/reports after each green wave

## Success metrics
- dpo_lines=150, dryrun_ok true, finite losses, A100 visible
- No trl 1.x install
