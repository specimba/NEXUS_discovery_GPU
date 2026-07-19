# Cline / kimi-k3 efficient prompt protocol

**Problem:** kimi-k3 over-reasons (PHASE_B_OK vs PARTIAL essays, tool-batch philosophy) and under-executes. Markers in chat prose fool the orch.

**Goal:** Short, path-hard, env-hard prompts → tools first → one marker line → stop.

---

## 1. Hard rules (every prompt)

| Rule | Why |
|------|-----|
| **ACT only** — never send until Plan/Act switch `aria-checked=true` on Act | Plan = prep theatre |
| **`requires_approval=false`** on every `execute_command` | Stops Proceed Anyways thrash |
| **≤12 lines of task body** (plus fixed ENV block) | Cuts monologue |
| **No “decide whether OK or PARTIAL” philosophy** | Give the exact echo string |
| **Paths absolute** under `/data/NEXUS/...` | No cwd guessing |
| **One marker only at end** | Orch parses real completion |
| **STOP after marker** | No free exploration |
| **Small tools** — one shell or one write per call if provider flaky | Avoids Invalid API Response on huge payloads |
| **Do not re-derive plan** if files already listed in prompt | Inventory is orch’s job |

---

## 2. Fixed ENV block (paste every time)

```
ENV (do not rediscover):
- Host: Intern A100 nb-253ef43e tenant 101
- Workspace: /data/NEXUS/workspace
- Root: /data/NEXUS
- BEST: frozen step_5000 — never delete/mutate/train-from-zero
- Product truth: bnb4 under export/product_8gb; GGUF under export/product_8gb/gguf/
- Bench: /data/NEXUS/workspace/bench/  (scenarios/, run_batch.py, runs/)
- Logs: /data/NEXUS/logs/
- Tools: /data/NEXUS/tools/  (decoy: nexus_decoy_worker.py)
- Decoy: pgrep -af nexus_decoy  (expect running; do not kill)
- Model: cline-pass:kimi-k3 Act + full AA (Read/Edit/All Commands/Browser/MCP)
- Law: cascade not soup; no gdrive; no dual DPO; no Llama⊗Qwen
- Tool: every execute_command requires_approval=false
```

---

## 3. Task body template

```
ACT. NO ESSAYS. Tools only. Then one marker line. STOP.

ENV: (block above)

MISSION E#: <one sentence>
DO (in order, no extras):
1) <exact command or write>
2) ...
N) echo <EXACT_MARKER>

DONE when: <one line>
DO NOT: replan, redefine markers, train, touch BEST, open gdrive
```

**Marker style:** `E1_DONE` / `PHASE_B_OK` / `STEP_2_OK` — single token orch can regex. Prefer **one** canonical marker per mission.

---

## 4. Mission snippets (ready)

### E1 closeout (if inventory already exists)

```
ACT. NO ESSAYS. requires_approval=false on every shell. BEST frozen.

ENV:
- Workspace: /data/NEXUS/workspace
- Bench: /data/NEXUS/workspace/bench
- Decoy: pgrep -af nexus_decoy only (do not restart unless missing)

MISSION E1 closeout: confirm files + decoy; polish only if thin; marker; STOP.

DO:
1) ls -lah /data/NEXUS/workspace/PHASE_A_INVENTORY.md /data/NEXUS/workspace/CKPT_HYGIENE.md /data/NEXUS/workspace/PRODUCT_SCORE.md /data/NEXUS/workspace/LONG_PLAN_MIRROR.md /data/NEXUS/workspace/bench/scenarios/README.md /data/NEXUS/workspace/bench/run_batch.py
2) If run_batch.py missing or <20 lines: write stub that reads scenarios/, writes runs/<ts>/ — no train
3) If PRODUCT_SCORE.md missing table: add bnb4 27/40 + GGUF q4/q5 one-line notes only
4) pgrep -af nexus_decoy || true
5) echo PHASE_B_OK

STOP. Do not discuss OK vs PARTIAL. Do not start E2.
```

### E2 harness expand

```
ACT. NO ESSAYS. requires_approval=false. BEST frozen. No train.

ENV:
- /data/NEXUS/workspace/bench/run_batch.py
- /data/NEXUS/workspace/bench/scenarios/
- /data/NEXUS/workspace/bench/runs/
- /data/NEXUS/workspace/PRODUCT_SCORE.md

MISSION E2: expand run_batch to score same fixtures; write one run folder.

DO:
1) Read run_batch.py + scenarios/README.md only
2) Expand run_batch.py: CLI that loads scenarios, writes bench/runs/<ts>/summary.json (stub scores ok)
3) python3 /data/NEXUS/workspace/bench/run_batch.py once; show exit 0
4) echo STEP_2_OK

STOP. No GGUF train. No L0 download.
```

### E3 GGUF template smoke

```
ACT. NO ESSAYS. requires_approval=false. BEST frozen.

ENV:
- GGUF dir: /data/NEXUS/workspace/export/product_8gb/gguf/
- llama-cli: prefer /data/NEXUS/tools/llama.cpp/build/bin/llama-cli if present
- Out: /data/NEXUS/workspace/export/experiments/GGUF_SMOKE_ORCH.txt

MISSION E3: non-empty GGUF smoke text + short template note.

DO:
1) ls -lah /data/NEXUS/workspace/export/product_8gb/gguf/
2) Write /data/NEXUS/workspace/GGUF_TEMPLATE_AUDIT.md (≤40 lines: template/stop/rope hypotheses only)
3) One llama-cli or documented skip if binary missing; tee smoke file
4) echo GGUF_SMOKE_OK if non-empty else echo GGUF_SMOKE_PARTIAL

STOP.
```

### E4 L0 stub

```
ACT. NO ESSAYS. requires_approval=false. BEST frozen. No full model train.

ENV:
- Plan: see L0_BOUNCER_PLAN (Prompt-Guard-86M / ProtectAI DeBERTa)
- Code: /data/NEXUS/workspace/l0_bouncer/
- Disk free: check df -h /data before any download

MISSION E4: stub only.

DO:
1) mkdir -p /data/NEXUS/workspace/l0_bouncer
2) Write l0_score.py CLI stub returning {label,score} (heuristic ok if no HF weight yet)
3) python3 l0_score.py --text "test" once
4) echo L0_BOUNCER_PLAN_OK

STOP. No bulk HF download unless df shows >8G free and orch said GO_DOWNLOAD.
```

---

## 5. Orch dispatch checklist

Before send:

1. Scroll chevron-to-bottom  
2. Act `aria-checked=true`  
3. AA collapsed (not expanded checkboxes)  
4. Prompt = ENV + DO list + one `echo MARKER` + STOP  
5. After run: trust **terminal output + disk**, not chat discussion of markers  
6. Advance step only when marker appears as **tool/shell result**, not Thinking prose  

### SAME WINDOW law (user 2026-07-19)

| Situation | Do | Never |
|-----------|-----|--------|
| Invalid API / tool-fail / **Proceed Anyways** | **Click Proceed** (or Resume) | New Task spam |
| Continue after fail | Same conversation + Act | Start New Task loop |
| Next mission after real marker | Type next E*_ACT into **same** chat input | Open endless new chats |
| Healthy Cancel/Thinking | Wait | Cancel + New Task thrash |

`dispatchMission(..., { sameWindow: true })` is default.  
`clickProceedSameWindow(cdp)` on every orch tick when Proceed is visible.  

---

## 6. Anti-patterns (ban)

- “Decide whether PHASE_B_OK or PARTIAL based on interpretation…”  
- “Let me draft a multi-block strategy…”  
- “First I will explore the whole tree…”  
- Pasting terminal decoy scripts into Cline chat  
- Sending while Plan is on  
- YOLO thrash / 15m new tasks  

---

## 7. File locations

| Artifact | Path |
|----------|------|
| This protocol | `Documents/NEXUS/scratch/CLINE_EFFICIENT_PROMPT_PROTOCOL.md` |
| Execution order | `Documents/NEXUS/scratch/NEXUS_EXECUTION_ORDER_20260719.md` |
| Live prompts | `Documents/NEXUS/scratch/prompts/` (E*_ACT.txt) |
