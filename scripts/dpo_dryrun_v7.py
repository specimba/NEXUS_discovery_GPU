#!/usr/bin/env python3
"""A100 DPO dry-run (max_steps=20) — TRL-free for torch 2.4 stack freeze.

trl>=1.x imports FSDPModule (torch 2.5+). This path uses transformers only +
manual preference loss so we do not break torch 2.4.0+cu124.
"""
from __future__ import annotations

import json
import math
import os
import subprocess
import sys
import time
import traceback
from pathlib import Path

ROOT = Path(os.environ.get("NEXUS_ROOT", "/data/NEXUS"))
DPO = Path(
    os.environ.get(
        "NEXUS_DPO",
        str(ROOT / "datasets/nexus_local/v7_dpo_pairs_fixed.jsonl"),
    )
)
OUT = ROOT / "checkpoints" / "dpo_guard_v7_canary"
LOGS = ROOT / "logs"
WORK = ROOT / "workspace"
MODEL = os.environ.get("NEXUS_DPO_MODEL", "Qwen/Qwen2.5-0.5B-Instruct")
MAX_STEPS = int(os.environ.get("NEXUS_DPO_MAX_STEPS", "20"))
BETA = float(os.environ.get("NEXUS_DPO_BETA", "0.1"))
MAX_LEN = int(os.environ.get("NEXUS_DPO_MAX_LEN", "384"))
STAMP = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())


def log(msg: str) -> None:
    print(msg, flush=True)


def ensure_dirs() -> None:
    for p in [OUT, LOGS, WORK, ROOT / "hf_cache"]:
        p.mkdir(parents=True, exist_ok=True)


def load_hf_token():
    for p in [
        ROOT / ".secrets" / "hf_token",
        ROOT / ".secrets" / "HF_TOKEN",
        Path.home() / ".cache" / "huggingface" / "token",
    ]:
        if p.is_file():
            t = p.read_text(encoding="utf-8", errors="replace").strip()
            if t:
                return t
    return os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")


def setup_env(token) -> None:
    os.environ.setdefault("HF_HOME", str(ROOT / "hf_cache"))
    os.environ.setdefault("HUGGINGFACE_HUB_CACHE", str(ROOT / "hf_cache"))
    os.environ.setdefault("TRANSFORMERS_CACHE", str(ROOT / "hf_cache"))
    if not os.environ.get("HF_ENDPOINT"):
        os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
    if token:
        os.environ["HF_TOKEN"] = token
        os.environ["HUGGING_FACE_HUB_TOKEN"] = token


def ensure_pkg(mod: str, pip_name: str | None = None) -> str:
    pip_name = pip_name or mod
    try:
        m = __import__(mod)
        return f"present:{getattr(m, '__version__', 'ok')}"
    except Exception:
        log(f"installing {pip_name} (no torch upgrade)")
        r = subprocess.run(
            [
                sys.executable,
                "-m",
                "pip",
                "install",
                "-q",
                pip_name,
                "--upgrade-strategy",
                "only-if-needed",
            ],
            capture_output=True,
            text=True,
            timeout=600,
        )
        if r.returncode != 0:
            return f"fail:{ (r.stderr or r.stdout or '')[-300:] }"
        try:
            m = __import__(mod)
            return f"installed:{getattr(m, '__version__', 'ok')}"
        except Exception as e:
            return f"import_fail:{e}"


def load_pairs(path: Path, limit: int = 64):
    rows = []
    with path.open(encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                o = json.loads(line)
            except json.JSONDecodeError:
                continue
            if o.get("prompt") and o.get("chosen") and o.get("rejected"):
                rows.append(
                    {
                        "prompt": str(o["prompt"]),
                        "chosen": str(o["chosen"]),
                        "rejected": str(o["rejected"]),
                    }
                )
            if len(rows) >= limit:
                break
    return rows


def seq_logprob(model, input_ids, attention_mask, prompt_len: int):
    """Mean logprob of completion tokens (after prompt_len)."""
    import torch
    import torch.nn.functional as F

    out = model(input_ids=input_ids, attention_mask=attention_mask)
    logits = out.logits[:, :-1, :]
    labels = input_ids[:, 1:]
    logp = F.log_softmax(logits, dim=-1)
    token_lp = logp.gather(2, labels.unsqueeze(-1)).squeeze(-1)
    # mask: completion only + valid attention
    plen = max(prompt_len - 1, 0)
    comp_mask = torch.zeros_like(token_lp)
    comp_mask[:, plen:] = 1.0
    comp_mask = comp_mask * attention_mask[:, 1:].to(token_lp.dtype)
    denom = comp_mask.sum(dim=-1).clamp(min=1.0)
    return (token_lp * comp_mask).sum(dim=-1) / denom


def main() -> int:
    ensure_dirs()
    report = {
        "stamp": STAMP,
        "model": MODEL,
        "max_steps": MAX_STEPS,
        "dpo": str(DPO),
        "out": str(OUT),
        "ok": False,
        "phase": "start",
        "trainer_api": "manual_dpo_torch24",
        "beta": BETA,
    }
    result_path = LOGS / f"DPO_DRYRUN_{STAMP}.json"
    latest = WORK / "DPO_DRYRUN_LATEST.json"

    def flush() -> None:
        text = json.dumps(report, indent=2, default=str)
        result_path.write_text(text, encoding="utf-8")
        latest.write_text(text, encoding="utf-8")
        (LOGS / "DPO_DRYRUN_LATEST.json").write_text(text, encoding="utf-8")
        brief = {
            "stamp": report.get("stamp"),
            "phase": report.get("phase"),
            "ok": report.get("ok"),
            "dpo_lines": report.get("dpo_lines"),
            "hf_whoami": report.get("hf_whoami"),
            "versions": report.get("versions"),
            "torch": report.get("torch"),
            "gpu": report.get("gpu"),
            "trainer_api": report.get("trainer_api"),
            "metrics": report.get("metrics"),
            "train_sec": report.get("train_sec"),
            "error": report.get("error"),
            "train_err_tail": (report.get("train_err") or "")[-1200:],
        }
        (WORK / "DPO_ERR.txt").write_text(json.dumps(brief, indent=2, default=str), encoding="utf-8")
        (LOGS / "DPO_ERR.txt").write_text(json.dumps(brief, indent=2, default=str), encoding="utf-8")

    def write_cov(trained: bool) -> None:
        cov = {
            "stamp": STAMP,
            "dpo_lines": report.get("dpo_lines"),
            "dpo_bytes": report.get("dpo_bytes"),
            "dryrun_ok": trained,
            "phase": report.get("phase"),
            "hf_whoami": report.get("hf_whoami"),
            "versions": report.get("versions"),
            "torch": report.get("torch"),
            "gpu": report.get("gpu"),
            "model": MODEL,
            "max_steps": MAX_STEPS,
            "trainer_api": report.get("trainer_api"),
            "metrics": report.get("metrics"),
            "train_sec": report.get("train_sec"),
            "error": report.get("error"),
            "train_err_tail": (report.get("train_err") or "")[-900:],
            "log": str(result_path),
        }
        (WORK / "COVERAGE_INDEX_LATEST.json").write_text(
            json.dumps(cov, indent=2), encoding="utf-8"
        )
        (LOGS / "COVERAGE_INDEX_LATEST.json").write_text(
            json.dumps(cov, indent=2), encoding="utf-8"
        )
        (WORK / "MISSION_STATUS.md").write_text(
            f"# MISSION_STATUS\n- {'GREEN' if trained else 'YELLOW'}\n"
            f"- stamp: {STAMP}\n- dpo_lines: {report.get('dpo_lines')}\n"
            f"- dryrun_ok: {trained}\n- hf: {report.get('hf_whoami')}\n"
            f"- model: {MODEL}\n- max_steps: {MAX_STEPS}\n"
            f"- trainer: manual_dpo_torch24\n- log: {result_path}\n",
            encoding="utf-8",
        )

    try:
        import torch

        report["torch"] = torch.__version__
        report["cuda"] = bool(torch.cuda.is_available())
        report["gpu"] = (
            torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
        )
        log(f"torch {report['torch']} cuda={report['cuda']} gpu={report['gpu']}")
        if not str(report["torch"]).startswith("2.4"):
            report["torch_warn"] = "expected ~2.4.x stack freeze"

        token = load_hf_token()
        setup_env(token)
        report["hf_token"] = bool(token)
        report["hf_endpoint"] = os.environ.get("HF_ENDPOINT")

        report["phase"] = "hf_whoami"
        flush()
        try:
            # only hub; no trl
            ensure_pkg("huggingface_hub")
            from huggingface_hub import whoami

            info = whoami(token=token)
            report["hf_whoami"] = {
                "name": info.get("name") if isinstance(info, dict) else str(info)
            }
            if isinstance(info, dict):
                report["hf_whoami"]["type"] = info.get("type")
            log(f"hf_whoami {report['hf_whoami']}")
        except Exception as e:
            report["hf_whoami_err"] = repr(e)
            log(f"hf_whoami_err {e}")

        report["phase"] = "deps"
        flush()
        # Do NOT install trl (FSDPModule / torch 2.5 conflict). transformers+datasets only.
        report["pip"] = {
            "transformers": ensure_pkg("transformers"),
            "datasets": ensure_pkg("datasets"),
            "trl": "SKIPPED_torch24_fsdp_incompat",
        }
        vers = {}
        for m in ["transformers", "datasets"]:
            try:
                mod = __import__(m)
                vers[m] = getattr(mod, "__version__", "ok")
            except Exception as e:
                vers[m] = f"MISSING:{e}"
        report["versions"] = vers
        log(f"versions {vers}")

        if not DPO.is_file():
            report["error"] = f"missing DPO file {DPO}"
            report["phase"] = "failed"
            write_cov(False)
            flush()
            return 2
        n_lines = sum(1 for _ in DPO.open(encoding="utf-8", errors="replace"))
        report["dpo_lines"] = n_lines
        report["dpo_bytes"] = DPO.stat().st_size
        if n_lines < 20:
            report["error"] = f"DPO too small: {n_lines}"
            report["phase"] = "failed"
            write_cov(False)
            flush()
            return 3

        pairs = load_pairs(DPO, limit=max(MAX_STEPS * 2, 40))
        report["pairs_loaded"] = len(pairs)
        if len(pairs) < 4:
            report["error"] = "not enough valid prompt/chosen/rejected rows"
            report["phase"] = "failed"
            write_cov(False)
            flush()
            return 3

        report["phase"] = "load_model"
        flush()
        from transformers import AutoModelForCausalLM, AutoTokenizer

        log(f"loading model {MODEL}")
        tok = AutoTokenizer.from_pretrained(MODEL, trust_remote_code=True)
        if tok.pad_token is None:
            tok.pad_token = tok.eos_token
        dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32
        model = AutoModelForCausalLM.from_pretrained(
            MODEL,
            torch_dtype=dtype,
            trust_remote_code=True,
        )
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model.to(device)
        model.train()
        opt = torch.optim.AdamW(model.parameters(), lr=5e-6)

        report["phase"] = "train"
        flush()
        t0 = time.time()
        losses = []
        for step in range(MAX_STEPS):
            row = pairs[step % len(pairs)]
            prompt = row["prompt"]
            # build full sequences
            chosen_text = prompt + "\n" + row["chosen"]
            rejected_text = prompt + "\n" + row["rejected"]
            p_ids = tok(prompt, add_special_tokens=True, return_tensors="pt")
            prompt_len = int(p_ids["input_ids"].shape[1])

            ch = tok(
                chosen_text,
                truncation=True,
                max_length=MAX_LEN,
                return_tensors="pt",
            )
            rj = tok(
                rejected_text,
                truncation=True,
                max_length=MAX_LEN,
                return_tensors="pt",
            )
            ch = {k: v.to(device) for k, v in ch.items()}
            rj = {k: v.to(device) for k, v in rj.items()}

            lp_c = seq_logprob(model, ch["input_ids"], ch["attention_mask"], prompt_len)
            lp_r = seq_logprob(model, rj["input_ids"], rj["attention_mask"], prompt_len)
            # DPO without ref model: soft preference push (policy-only canary)
            logits = BETA * (lp_c - lp_r)
            loss = -torch.nn.functional.logsigmoid(logits).mean()
            opt.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            lv = float(loss.detach().float().cpu())
            losses.append(lv)
            if step % 5 == 0 or step == MAX_STEPS - 1:
                log(f"step {step+1}/{MAX_STEPS} loss={lv:.4f}")
            if device.type == "cuda" and step % 5 == 0:
                torch.cuda.synchronize()

        if device.type == "cuda":
            torch.cuda.synchronize()
        report["train_sec"] = round(time.time() - t0, 2)
        report["metrics"] = {
            "loss_start": losses[0] if losses else None,
            "loss_end": losses[-1] if losses else None,
            "loss_mean": (sum(losses) / len(losses)) if losses else None,
            "steps": len(losses),
            "finite": all(math.isfinite(x) for x in losses),
        }
        # light save: config marker only (full weights optional)
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / "dryrun_ok.json").write_text(
            json.dumps(
                {
                    "stamp": STAMP,
                    "model": MODEL,
                    "steps": MAX_STEPS,
                    "metrics": report["metrics"],
                    "trainer_api": "manual_dpo_torch24",
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        report["ok"] = bool(report["metrics"]["finite"] and len(losses) == MAX_STEPS)
        report["phase"] = "done" if report["ok"] else "failed"
        write_cov(report["ok"])
        flush()
        log("DPO_DRYRUN_OK" if report["ok"] else "DPO_DRYRUN_FAIL")
        log(json.dumps({k: report[k] for k in report if k != "train_err"}, default=str))
        return 0 if report["ok"] else 4
    except Exception as e:
        report["phase"] = "crash"
        report["error"] = repr(e)
        report["train_err"] = traceback.format_exc()[-4000:]
        report["trace"] = report["train_err"]
        write_cov(False)
        flush()
        log("DPO_DRYRUN_CRASH " + repr(e))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
