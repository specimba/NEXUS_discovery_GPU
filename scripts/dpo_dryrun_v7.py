#!/usr/bin/env python3
"""A100 DPO dry-run (max_steps=20) for NEXUS guard pairs.

Stack freeze: do not upgrade torch. Prefer existing CUDA torch.
HF mirror fallback for CN hosts. Writes durable JSON under /data/NEXUS/logs.
"""
from __future__ import annotations

import json
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
STAMP = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())


def log(msg: str) -> None:
    print(msg, flush=True)


def ensure_dirs() -> None:
    for p in [OUT, LOGS, WORK, ROOT / "hf_cache"]:
        p.mkdir(parents=True, exist_ok=True)


def load_hf_token() -> str | None:
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


def setup_env(token: str | None) -> None:
    os.environ.setdefault("HF_HOME", str(ROOT / "hf_cache"))
    os.environ.setdefault("HUGGINGFACE_HUB_CACHE", str(ROOT / "hf_cache"))
    os.environ.setdefault("TRANSFORMERS_CACHE", str(ROOT / "hf_cache"))
    # CN-friendly HF endpoint if not set
    if not os.environ.get("HF_ENDPOINT"):
        os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
    if token:
        os.environ["HF_TOKEN"] = token
        os.environ["HUGGING_FACE_HUB_TOKEN"] = token


def pip_install_missing(mods: list[str]) -> dict:
    """Install missing packages without upgrading torch."""
    result = {}
    for m in mods:
        try:
            __import__(m)
            result[m] = "present"
        except Exception:
            log(f"installing {m} (no torch upgrade)")
            cmd = [
                sys.executable,
                "-m",
                "pip",
                "install",
                "-q",
                m,
                "--upgrade-strategy",
                "only-if-needed",
            ]
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
            result[m] = f"rc={r.returncode}"
            if r.returncode != 0:
                result[m + "_err"] = (r.stderr or r.stdout or "")[-500:]
    return result


def main() -> int:
    ensure_dirs()
    report: dict = {
        "stamp": STAMP,
        "model": MODEL,
        "max_steps": MAX_STEPS,
        "dpo": str(DPO),
        "out": str(OUT),
        "ok": False,
        "phase": "start",
    }
    result_path = LOGS / f"DPO_DRYRUN_{STAMP}.json"
    latest = WORK / "DPO_DRYRUN_LATEST.json"

    def flush() -> None:
        text = json.dumps(report, indent=2, default=str)
        result_path.write_text(text, encoding="utf-8")
        latest.write_text(text, encoding="utf-8")
        (LOGS / "DPO_DRYRUN_LATEST.json").write_text(text, encoding="utf-8")
        # short unique dump for CDP monaco harvest (avoid fuzzy-open collisions)
        brief = {
            "stamp": report.get("stamp"),
            "phase": report.get("phase"),
            "ok": report.get("ok"),
            "dpo_lines": report.get("dpo_lines"),
            "hf_whoami": report.get("hf_whoami"),
            "hf_whoami_err": report.get("hf_whoami_err"),
            "versions": report.get("versions"),
            "torch": report.get("torch"),
            "gpu": report.get("gpu"),
            "trainer_api": report.get("trainer_api"),
            "metrics": report.get("metrics"),
            "train_sec": report.get("train_sec"),
            "error": report.get("error"),
            "train_err_tail": (report.get("train_err") or "")[-1200:],
            "trace_tail": (report.get("trace") or "")[-800:],
        }
        (WORK / "DPO_ERR.txt").write_text(json.dumps(brief, indent=2, default=str), encoding="utf-8")
        (LOGS / "DPO_ERR.txt").write_text(json.dumps(brief, indent=2, default=str), encoding="utf-8")

    try:
        import torch

        report["torch"] = torch.__version__
        report["cuda"] = bool(torch.cuda.is_available())
        report["gpu"] = (
            torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
        )
        report["vram_mib"] = (
            int(torch.cuda.get_device_properties(0).total_memory / 1024 / 1024)
            if torch.cuda.is_available()
            else None
        )
        log(f"torch {report['torch']} cuda={report['cuda']} gpu={report['gpu']}")

        token = load_hf_token()
        setup_env(token)
        report["hf_token"] = bool(token)
        report["hf_endpoint"] = os.environ.get("HF_ENDPOINT")

        # whoami
        report["phase"] = "hf_whoami"
        flush()
        try:
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

        # deps
        report["phase"] = "deps"
        flush()
        report["pip"] = pip_install_missing(
            ["transformers", "datasets", "trl", "peft", "accelerate"]
        )
        # versions
        vers = {}
        for m in ["transformers", "datasets", "trl", "peft", "accelerate"]:
            try:
                mod = __import__(m)
                vers[m] = getattr(mod, "__version__", "ok")
            except Exception as e:
                vers[m] = f"MISSING:{e}"
        report["versions"] = vers
        log(f"versions {vers}")

        if not DPO.is_file():
            report["error"] = f"missing DPO file {DPO}"
            flush()
            log(report["error"])
            return 2
        n_lines = sum(1 for _ in DPO.open(encoding="utf-8", errors="replace"))
        report["dpo_lines"] = n_lines
        report["dpo_bytes"] = DPO.stat().st_size
        if n_lines < 20:
            report["error"] = f"DPO too small: {n_lines} lines"
            flush()
            return 3

        # freeze check
        if not str(report["torch"]).startswith("2.4"):
            report["torch_warn"] = "expected ~2.4.x stack freeze"

        report["phase"] = "load_model"
        flush()
        from datasets import load_dataset
        from transformers import AutoModelForCausalLM, AutoTokenizer

        log(f"loading model {MODEL}")
        tok = AutoTokenizer.from_pretrained(MODEL, trust_remote_code=True)
        if tok.pad_token is None:
            tok.pad_token = tok.eos_token
        model = AutoModelForCausalLM.from_pretrained(
            MODEL,
            torch_dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float32,
            device_map="auto" if torch.cuda.is_available() else None,
            trust_remote_code=True,
        )
        report["phase"] = "dataset"
        flush()
        ds = load_dataset("json", data_files=str(DPO), split="train")
        # keep only TRL columns
        keep = [c for c in ["prompt", "chosen", "rejected"] if c in ds.column_names]
        ds = ds.remove_columns([c for c in ds.column_names if c not in keep])
        report["dataset_rows"] = len(ds)
        report["dataset_cols"] = list(ds.column_names)

        report["phase"] = "train"
        flush()
        import trl

        report["trl_version"] = getattr(trl, "__version__", "?")

        trained = False
        train_err = None
        # Prefer modern DPOConfig API; fall back to older TrainingArguments style
        try:
            from trl import DPOConfig, DPOTrainer

            args = DPOConfig(
                output_dir=str(OUT),
                max_steps=MAX_STEPS,
                per_device_train_batch_size=2,
                gradient_accumulation_steps=2,
                learning_rate=5e-6,
                logging_steps=1,
                save_steps=MAX_STEPS,
                bf16=bool(torch.cuda.is_available()),
                remove_unused_columns=False,
                report_to=[],
                max_length=512,
                max_prompt_length=256,
            )
            try:
                trainer = DPOTrainer(
                    model=model,
                    ref_model=None,
                    args=args,
                    train_dataset=ds,
                    processing_class=tok,
                )
            except TypeError:
                trainer = DPOTrainer(
                    model=model,
                    ref_model=None,
                    args=args,
                    train_dataset=ds,
                    tokenizer=tok,
                )
            t0 = time.time()
            out = trainer.train()
            report["train_sec"] = round(time.time() - t0, 2)
            metrics = getattr(out, "metrics", None) or {}
            report["metrics"] = {k: float(v) if isinstance(v, (int, float)) else v for k, v in metrics.items()}
            trained = True
            report["trainer_api"] = "DPOConfig"
        except Exception as e1:
            train_err = f"DPOConfig path: {e1}\n{traceback.format_exc()[-1500:]}"
            log(train_err)
            try:
                from transformers import TrainingArguments
                from trl import DPOTrainer

                args = TrainingArguments(
                    output_dir=str(OUT),
                    max_steps=MAX_STEPS,
                    per_device_train_batch_size=1,
                    gradient_accumulation_steps=4,
                    learning_rate=5e-6,
                    logging_steps=1,
                    bf16=bool(torch.cuda.is_available()),
                    remove_unused_columns=False,
                    report_to=[],
                )
                trainer = DPOTrainer(
                    model=model,
                    ref_model=None,
                    args=args,
                    train_dataset=ds,
                    tokenizer=tok,
                )
                t0 = time.time()
                out = trainer.train()
                report["train_sec"] = round(time.time() - t0, 2)
                metrics = getattr(out, "metrics", None) or {}
                report["metrics"] = {
                    k: float(v) if isinstance(v, (int, float)) else v for k, v in metrics.items()
                }
                trained = True
                report["trainer_api"] = "TrainingArguments"
            except Exception as e2:
                train_err = (train_err or "") + f"\nTrainingArguments path: {e2}\n{traceback.format_exc()[-1500:]}"
                report["train_err"] = train_err[-4000:]

        report["ok"] = trained
        report["phase"] = "done" if trained else "failed"
        # coverage update
        cov = {
            "stamp": STAMP,
            "dpo_lines": n_lines,
            "dpo_bytes": report.get("dpo_bytes"),
            "dryrun_ok": trained,
            "phase": report.get("phase"),
            "hf_whoami": report.get("hf_whoami"),
            "hf_whoami_err": report.get("hf_whoami_err"),
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
            f"- stamp: {STAMP}\n- dpo_lines: {n_lines}\n"
            f"- dryrun_ok: {trained}\n- hf: {report.get('hf_whoami')}\n"
            f"- model: {MODEL}\n- max_steps: {MAX_STEPS}\n"
            f"- log: {result_path}\n",
            encoding="utf-8",
        )
        flush()
        log("DPO_DRYRUN_OK" if trained else "DPO_DRYRUN_FAIL")
        log(json.dumps({k: report[k] for k in report if k != "train_err"}, default=str))
        return 0 if trained else 4
    except Exception as e:
        report["phase"] = "crash"
        report["error"] = repr(e)
        report["trace"] = traceback.format_exc()[-3000:]
        flush()
        log("DPO_DRYRUN_CRASH " + repr(e))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
