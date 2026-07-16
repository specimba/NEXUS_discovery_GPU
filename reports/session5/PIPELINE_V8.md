# DPO Pipeline v8 (CPU-side)

**Purpose:** sophisticated dataset structure while A100 runs long DPO — uses standby Cline/Kilo CLIs for validation docs, not short train thrash.

## Flow
1. Load gold `v7_dpo_pairs_fixed.jsonl` (150)
2. Schema validate (id/prompt/chosen/rejected)
3. Quality score + stratify holdout ~15% by governance_category
4. Synthesize HARD preference pairs (multi-turn, MCP tool abuse, over-refusal balance, poisoning, C2, phishing refuse, etc.)
5. Write:
   - `datasets/nexus_local/v8/v8_dpo_train.jsonl`
   - `datasets/nexus_local/v8/v8_dpo_holdout.jsonl`
   - `datasets/nexus_local/v8_dpo_pairs_train.jsonl` (staged for trainer)
   - `MANIFEST.json` + `workspace/PIPELINE_V8_*`

## Trainer
`dpo_auto_continue.py` now prefers `NEXUS_DPO_PAIRS` → v8 train paths → gold v7.

## Agent roles
- **Terminal nohup:** REAL long DPO (GPU)
- **Cline:** validate pipeline outputs, write `CLI_CLINE_PIPELINE.md`
- **Kilo:** write `KILO_PIPELINE_STRUCTURE.md` data-flow docs
