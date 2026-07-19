# Cline + cline-pass + kimi-k3 flake (ops note)

**Why it hurts now:** web K3 is **cheap / high demand** → provider load, empty streams, truncated tool XML, intermittent parse fails. That shows up as:

- `Invalid API Response: empty or unparsable`
- tool loop → **Proceed Anyways**
- "one tool only" thrash
- slow Thinking with no shell marker

**Not:** Terminal settings, AA off, or A100 host dying (unless metrics also die).

## Harness path

```
Cline UI  →  cline-pass (cline:moonshotai/kimi-k3)  →  Moonshot/K3 web capacity
```

Lowest price tier = **shared** capacity. Consistency is **provider-side**, not your repo.

## Mitigations that actually work (NEXUS law)

| Do | Don't |
|----|--------|
| **Act** only | Plan mode monologue |
| **One tool / turn**, short shell | Mega multi-tool batches |
| Every shell: `requires_approval=false` | Omit required tool fields |
| ≤12-line mission body + fixed ENV | Freeform "continue / explore" |
| **Proceed Anyways** same conversation | Spam New Task on parse fail |
| New Task **only** after green Task Completed | New Task to "escape" Invalid API |
| Trust **disk markers** (echo E*_OK) | Trust Thinking prose |
| Cooldown 60–90s between re-dispatches | Re-send same mega prompt 10× |

## When K3 is unusable

1. Keep **Kilo Hy3** on disk verify / short shell (also free-queue risk).
2. **Grok orch** terminal lane for portable/tar/sync (already used for E19).
3. Optional: switch ClinePass to a **less loaded** lane if you have one (paid K3, other model id) — same short-prompt protocol.
4. Never start train mid-flake — markers and portables first.

## Success criteria unchanged

- File exists + size/sha on disk  
- One echo marker line  
- Portable tar refreshed after meaningful missions  
- Local `portables/discovery_session_*` + git handoff when session ends  
