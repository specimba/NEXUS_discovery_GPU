# Mission queue (efficient path only — no random walks)

**Protocol:** `../CLINE_EFFICIENT_PROMPT_PROTOCOL.md`  
**Rule:** One mission at a time. Next only after **shell** marker (not Thinking prose).

| Order | Prompt file | Shell marker to advance | Notes |
|-------|-------------|-------------------------|--------|
| 1 | `E1_CLOSEOUT_ACT.txt` | `PHASE_B_OK` | **ACTIVE** dispatched 2026-07-19 |
| 2 | `E2_HARNESS_ACT.txt` | `STEP_2_OK` | After E1 |
| 3 | `E3_GGUF_SMOKE_ACT.txt` | `GGUF_SMOKE_OK` or `GGUF_SMOKE_PARTIAL` | After E2 |
| 4 | `E4_L0_STUB_ACT.txt` | `L0_BOUNCER_PLAN_OK` | After E3 |
| 5 | (router stub later) | `STEP_5_OK` | After E4 |

## Dispatch ritual (every mission)

1. Chevron scroll-to-bottom  
2. Act `aria-checked=true`  
3. New Task if prior done/stuck  
4. Paste **only** the matching `E*_ACT.txt`  
5. Send; confirm Thinking/Cancel  
6. Orch watch: scroll each tick; **do not** send E(n+1) until marker in tool output  
7. Kilo optional one-shot disk verify after marker  

## Ban

- Freeform “continue / explore / improve”  
- Multi-phase mega prompts  
- Plan mode  
- Redefining markers in chat  
