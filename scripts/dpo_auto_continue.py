#!/usr/bin/env python3
"""Autonomous longer DPO (default 50 steps). TRL-free, torch 2.4 freeze safe."""
from __future__ import annotations

import json
import math
import os
import sys
import time
import traceback
from pathlib import Path

ROOT = Path(os.environ.get("NEXUS_ROOT", "/data/NEXUS"))
STEPS = int(os.environ.get("NEXUS_DPO_MAX_STEPS", "50"))
MODEL = os.environ.get("NEXUS_DPO_MODEL", "Qwen/Qwen2.5-0.5B-Instruct")
BETA = float(os.environ.get("NEXUS_DPO_BETA", "0.1"))
MAX_LEN = int(os.environ.get("NEXUS_DPO_MAX_LEN", "384"))
STAMP = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())


def main() -> int:
    for d in [
        "workspace",
        "logs",
        "scripts",
        "checkpoints/dpo_guard_v7_canary",
        "datasets/nexus_local",
        "hf_cache",
    ]:
        (ROOT / d).mkdir(parents=True, exist_ok=True)

    out: dict = {"stamp": STAMP, "plan": "auto_continue", "steps": STEPS, "model": MODEL}
    # Prefer explicit path (v8 pipeline stages train jsonl); else gold v7.
    env_pairs = os.environ.get("NEXUS_DPO_PAIRS", "").strip()
    candidates = []
    if env_pairs:
        candidates.append(Path(env_pairs))
    candidates.extend(
        [
            ROOT / "datasets/nexus_local/v8_dpo_pairs_train.jsonl",
            ROOT / "datasets/nexus_local/v8/v8_dpo_train.jsonl",
            ROOT / "datasets/nexus_local/v7_dpo_pairs_fixed.jsonl",
        ]
    )
    dpo = next((p for p in candidates if p.exists() and p.stat().st_size > 1000), candidates[-1])
    if not dpo.exists() or sum(1 for _ in dpo.open()) < 20:
        import urllib.request

        url = "https://cdn.jsdelivr.net/gh/specimba/NEXUS_discovery_GPU@main/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl"
        dpo = ROOT / "datasets/nexus_local/v7_dpo_pairs_fixed.jsonl"
        urllib.request.urlretrieve(url, dpo)
        out["restaged"] = True
    out["dpo_path"] = str(dpo)
    out["dpo_lines"] = sum(1 for _ in dpo.open())
    out["dpo_bytes"] = dpo.stat().st_size

    train: dict = {"ok": False}
    try:
        import torch
        import torch.nn.functional as F
        from transformers import AutoModelForCausalLM, AutoTokenizer

        train["torch"] = torch.__version__
        train["cuda"] = bool(torch.cuda.is_available())
        train["gpu"] = torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
        os.environ.setdefault("HF_ENDPOINT", os.environ.get("HF_ENDPOINT") or "https://hf-mirror.com")
        os.environ.setdefault("HF_HOME", str(ROOT / "hf_cache"))
        os.environ.setdefault("HUGGINGFACE_HUB_CACHE", str(ROOT / "hf_cache"))
        tok_path = ROOT / ".secrets" / "hf_token"
        if tok_path.is_file():
            t = tok_path.read_text(encoding="utf-8").strip()
            os.environ["HF_TOKEN"] = t
            os.environ["HUGGING_FACE_HUB_TOKEN"] = t

        # transformers 5.14+ imports DTensor (needs torch>=2.5). Stack freeze is 2.4 —
        # pin transformers if DTensor missing.
        try:
            from torch.distributed.tensor import DTensor  # noqa: F401
        except Exception:
            print("PIN transformers for torch2.4 (no DTensor)", flush=True)
            import subprocess

            subprocess.check_call(
                [
                    sys.executable,
                    "-m",
                    "pip",
                    "install",
                    "-q",
                    "transformers==4.46.3",
                    "--upgrade-strategy",
                    "only-if-needed",
                ]
            )
            # re-import
            import importlib

            import transformers as _tf

            importlib.reload(_tf)
            from transformers import AutoModelForCausalLM, AutoTokenizer

        print("LOAD", MODEL, flush=True)
        tok = AutoTokenizer.from_pretrained(MODEL, trust_remote_code=True)
        if tok.pad_token is None:
            tok.pad_token = tok.eos_token
        dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32
        model = AutoModelForCausalLM.from_pretrained(
            MODEL, torch_dtype=dtype, trust_remote_code=True
        )
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model.to(device)
        model.train()
        opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=5e-6)

        pairs = []
        with dpo.open(encoding="utf-8", errors="replace") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    o = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if o.get("prompt") and o.get("chosen") and o.get("rejected"):
                    pairs.append(
                        {
                            "prompt": str(o["prompt"]),
                            "chosen": str(o["chosen"]),
                            "rejected": str(o["rejected"]),
                        }
                    )
                # Prefer full gold set; only cap if huge
                if len(pairs) >= max(STEPS * 4, 500):
                    break
        train["pairs"] = len(pairs)
        if len(pairs) < 4:
            raise RuntimeError(f"not enough pairs: {len(pairs)}")

        def seq_logprob(input_ids, attention_mask, prompt_len: int):
            outm = model(input_ids=input_ids, attention_mask=attention_mask)
            logits = outm.logits[:, :-1, :]
            labels = input_ids[:, 1:]
            logp = F.log_softmax(logits, dim=-1)
            token_lp = logp.gather(2, labels.unsqueeze(-1)).squeeze(-1)
            plen = max(prompt_len - 1, 0)
            comp = torch.zeros_like(token_lp)
            comp[:, plen:] = 1.0
            comp = comp * attention_mask[:, 1:].to(token_lp.dtype)
            denom = comp.sum(dim=-1).clamp(min=1.0)
            return (token_lp * comp).sum(dim=-1) / denom

        losses = []
        t0 = time.time()
        for step in range(STEPS):
            row = pairs[step % len(pairs)]
            prompt = row["prompt"]
            p_ids = tok(prompt, add_special_tokens=True, return_tensors="pt")
            prompt_len = int(p_ids["input_ids"].shape[1])
            ch = tok(
                prompt + "\n" + row["chosen"],
                truncation=True,
                max_length=MAX_LEN,
                return_tensors="pt",
            )
            rj = tok(
                prompt + "\n" + row["rejected"],
                truncation=True,
                max_length=MAX_LEN,
                return_tensors="pt",
            )
            ch = {k: v.to(device) for k, v in ch.items()}
            rj = {k: v.to(device) for k, v in rj.items()}
            lp_c = seq_logprob(ch["input_ids"], ch["attention_mask"], prompt_len)
            lp_r = seq_logprob(rj["input_ids"], rj["attention_mask"], prompt_len)
            loss = -F.logsigmoid(BETA * (lp_c - lp_r)).mean()
            opt.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            lv = float(loss.detach().float().cpu())
            losses.append(lv)
            if step % 10 == 0 or step == STEPS - 1:
                print(f"step {step+1}/{STEPS} loss={lv:.4f}", flush=True)
            if device.type == "cuda" and step % 10 == 0:
                torch.cuda.synchronize()
            # Mid-run HF saves so long jobs leave artifacts before final step
            save_flag = os.environ.get("NEXUS_DPO_SAVE", "").strip() in ("1", "true", "yes")
            save_every = int(os.environ.get("NEXUS_DPO_SAVE_EVERY", "500"))
            ckpt_dir = ROOT / "checkpoints/dpo_guard_v7_canary"
            if save_flag and save_every > 0 and (step + 1) % save_every == 0:
                mid = ckpt_dir / f"step_{step+1}_{STAMP}"
                print("SAVE_MID", mid, flush=True)
                try:
                    ckpt_dir.mkdir(parents=True, exist_ok=True)
                    model.save_pretrained(str(mid))
                    tok.save_pretrained(str(mid))
                    (mid / "train_metrics.json").write_text(
                        json.dumps(
                            {
                                "step": step + 1,
                                "loss": lv,
                                "loss_mean": sum(losses) / len(losses),
                            },
                            indent=2,
                        ),
                        encoding="utf-8",
                    )
                    (ckpt_dir / "LATEST_CKPT.txt").write_text(str(mid), encoding="utf-8")
                except Exception as se:
                    print("SAVE_MID_FAIL", repr(se), flush=True)
        if device.type == "cuda":
            torch.cuda.synchronize()
        train["train_sec"] = round(time.time() - t0, 2)
        train["metrics"] = {
            "loss_start": losses[0],
            "loss_end": losses[-1],
            "loss_mean": sum(losses) / len(losses),
            "steps": len(losses),
            "finite": all(math.isfinite(x) for x in losses),
        }
        train["ok"] = bool(train["metrics"]["finite"] and len(losses) == STEPS)
        ckpt_dir = ROOT / "checkpoints/dpo_guard_v7_canary"
        ckpt_dir.mkdir(parents=True, exist_ok=True)
        (ckpt_dir / "dryrun_ok.json").write_text(
            json.dumps(
                {
                    "stamp": STAMP,
                    "model": MODEL,
                    "steps": STEPS,
                    "metrics": train["metrics"],
                    "trainer_api": "manual_dpo_auto_continue",
                    "pairs": train.get("pairs"),
                    "dpo_path": out.get("dpo_path"),
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        # Optional HF weight save (longer runs / explicit flag)
        save_flag = os.environ.get("NEXUS_DPO_SAVE", "").strip() in ("1", "true", "yes")
        if train["ok"] and (save_flag or STEPS >= 200):
            save_path = ckpt_dir / f"step_{STEPS}_{STAMP}"
            print("SAVE_PRETRAINED", save_path, flush=True)
            try:
                model.save_pretrained(str(save_path))
                tok.save_pretrained(str(save_path))
                (save_path / "train_metrics.json").write_text(
                    json.dumps(train["metrics"], indent=2), encoding="utf-8"
                )
                train["saved"] = str(save_path)
                # pointer for resume
                (ckpt_dir / "LATEST_CKPT.txt").write_text(str(save_path), encoding="utf-8")
            except Exception as se:
                train["save_error"] = repr(se)
                print("SAVE_FAIL", repr(se), flush=True)
    except Exception as e:
        train["ok"] = False
        train["error"] = repr(e)
        train["trace"] = traceback.format_exc()[-3000:]
        print("TRAIN_FAIL", repr(e), flush=True)
        print(train["trace"], flush=True)

    out["train"] = train
    text = json.dumps(out, indent=2, default=str)
    (ROOT / "workspace/PLAN_PROGRESS.json").write_text(text, encoding="utf-8")
    (ROOT / "logs/PLAN_PROGRESS.json").write_text(text, encoding="utf-8")
    (ROOT / "workspace/ZZZ_PLAN.txt").write_text(text, encoding="utf-8")
    (ROOT / "workspace/DPO_DRYRUN_LATEST.json").write_text(
        json.dumps(
            {
                "stamp": STAMP,
                "ok": train.get("ok"),
                "max_steps": STEPS,
                "metrics": train.get("metrics"),
                "error": train.get("error"),
                "trace_tail": (train.get("trace") or "")[-1200:],
                "dpo_lines": out.get("dpo_lines"),
                "torch": train.get("torch"),
                "gpu": train.get("gpu"),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    (ROOT / "logs" / f"DPO_DRYRUN_{STAMP}.json").write_text(text, encoding="utf-8")
    (ROOT / "workspace/COVERAGE_INDEX_LATEST.json").write_text(
        json.dumps(
            {
                "stamp": STAMP,
                "dpo_lines": out.get("dpo_lines"),
                "dpo_bytes": out.get("dpo_bytes"),
                "torch": train.get("torch"),
                "gpu": train.get("gpu"),
                "dryrun_ok": train.get("ok"),
                "max_steps": STEPS,
                "metrics": train.get("metrics"),
                "error": train.get("error"),
                "plan": "auto_continue",
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    (ROOT / "workspace/MISSION_STATUS.md").write_text(
        f"# MISSION_STATUS\n- {'GREEN' if train.get('ok') else 'YELLOW'}\n"
        f"- stamp: {STAMP}\n- plan: auto_continue max_steps={STEPS}\n"
        f"- dpo_lines: {out.get('dpo_lines')}\n- ok: {train.get('ok')}\n"
        f"- metrics: {train.get('metrics')}\n- error: {train.get('error')}\n"
        f"- torch: {train.get('torch')} gpu: {train.get('gpu')}\n",
        encoding="utf-8",
    )
    print("AUTO_CONTINUE_DONE", train.get("ok"), flush=True)
    return 0 if train.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
