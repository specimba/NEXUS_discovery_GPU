# Migration: Discovery cloud disk → local (quota ended)

**When:** GPU session quota over (`0 Running / 10`).  
**Source:** https://discovery.intern-ai.org.cn/compute/clouddisk/NEXUS  
**Dest (laptop):** `Documents/NEXUS_MIGRATION_20260719/` + git `NEXUS_discovery_GPU`  
**Do not** dump multi‑GB junk into OS monorepo.

## Priority tiers (download order)

### P0 — must save first (small / irreplaceable)

| Path under `/NEXUS` | Why |
|---------------------|-----|
| `workspace/portables/` | Session tar + MANIFEST + clean-sheet |
| `workspace/*.md` | STABLE, CLEAN_SHEET, PRODUCT_SCORE, cascade notes, DISCOVERY_GIT_SYNC |
| `workspace/**/*.py` stubs | router_stub, guard_stub, cascade_wire, l0_score, run_batch |
| `git_backups/work/` | Clone of `NEXUS_discovery_GPU` @ 96c6490 if present |
| `scripts/` | Ops scripts |
| `configs/` if any | Train/canary configs |
| `workspace/export/product_8gb/` **inventory + small artifacts only** | Product spine docs; skip multi‑GB if already elsewhere |

### P1 — training-critical (may be large; do second)

| Path | Why |
|------|-----|
| `checkpoints/` or under EXUS/… `dpo_guard_*` / BEST / step_* | Canary + BEST weights — **largest** |
| `export/product_8gb/gguf/` | Product GGUF if not backed up |
| `datasets/nexus_local/` small JSONL | Fixtures; skip huge raw dumps |

### P2 — skip or last

| Path | Why |
|------|-----|
| `hf_cache/` | Re-downloadable from HF |
| `.kilo/` | IDE local state |
| `__pycache__`, `.venv`, node_modules | Regenerable |
| Huge intermediate train logs if already in `logs/` summary | Prefer summaries |

## UI workflow (cloud storage)

1. Open **cloud storage** → **NEXUS** (you are here).  
2. **Do not download everything at once** — Chrome will thrash; path shown was `…/dpo_guard_v7_canary/step_1000_…/special_tokens_map.json` (8109 files batch — too wide).  
3. Prefer **folder zip/download per P0 folder** when UI allows, else enter folder → select docs only.  
4. Cancel huge recursive folder downloads of `hf_cache` / full canary tree if you only need tokenizer + config + final BEST.  
5. For checkpoints: download **config.json, tokenizer*, special_tokens_map.json, adapter/model index** first; then **one** BEST weight file if needed.

## Local landing layout

```
Documents/NEXUS_MIGRATION_20260719/
  cloud_NEXUS/
    workspace/
    git_backups/
    scripts/
    configs/
    checkpoints/   # only if pulled
  README_MIGRATE.md
```

## After download

```bash
# 1) Copy P0 into discovery GPU repo reports if new
cd Documents/NEXUS_discovery_GPU
# 2) Commit only new session proofs
git add reports/ docs/
git commit -m "migrate: cloud disk P0 after quota end"
git push origin main

# 3) Keep large checkpoints OUT of git — store on D: or external
# D:/NEXUS_COLD/discovery_20260719/checkpoints/
```

## New account boot (after migrate)

1. New Discovery account → create machine → mount cloud disk if same JuiceFS/account cloud, **or** upload P0 tar.  
2. Restore: `tar xzf NEXUS_DISCOVERY_SESSION_*.tar.gz` under `/data/NEXUS/workspace`.  
3. `git clone https://github.com/specimba/NEXUS_discovery_GPU.git /data/NEXUS/git_backups/work` (if egress works).  
4. Read `CLEAN_SHEET_BOOT.md` / `docs/CLEAN_SHEET_BOOT_20260719.md`.

## Efficiency rules

- **One folder download at a time** (workspace → git_backups → scripts → selective checkpoints).  
- Watch Chrome Downloads; pause if queue >20 tiny HF files.  
- Prefer **already on GitHub** (`NEXUS_discovery_GPU`) over re-downloading docs.  
- Weights: only what you cannot re-train or re-export.
