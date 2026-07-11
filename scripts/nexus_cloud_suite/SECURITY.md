# NEXUS cloud suite — security posture

## Hard rules
1. **No secrets in repo/files** — only env vars: `GITHUB_TOKEN`, `HF_TOKEN` (optional), `HF_HOME`.
2. **Never print tokens** — redact `github_pat_`, `gho_`, `hf_`, `sk-` in logs.
3. **No training on unrestricted chat dumps** — respect NEXUS license partition (trainable vs reference).
4. **Cloud VM is isolated** — still treat as multi-tenant: no `chmod 777`, no world-writable secrets.
5. **Edge cases must not crash the host** — catch OOM, empty batch, NaN loss, missing CUDA, missing peft.
6. **Gated HF datasets** — fail soft with “needs operator HF agree”; never embed credentials.
7. **Uploads** — only to operator-owned GH path `reports/session4/` or `reports/cloud_suite/`.

## Edge-case battery (stress)
- empty dataset / single-row batch  
- CPU fallback when CUDA missing  
- mixed precision autocast on/off  
- max length clamp  
- NaN/Inf loss abort  
- disk full soft-fail on write  
- interrupted download resume (HF)  
- concurrent tick collision (atomic stamp filenames)

## Operator
Rotate any token ever pasted into Cline/terminal history.
