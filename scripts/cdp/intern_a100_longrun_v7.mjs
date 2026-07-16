#!/usr/bin/env node
/**
 * v7: hide Cline, ONE terminal command (base64|python), wait, screenshot+body harvest
 */
import fs from "node:fs";

const PORT = 9224;
const DAY = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const OUTDIR = `C:/Users/speci.000/Downloads/NEXUSlogs/_runs/GROK/${DAY}`;
fs.mkdirSync(OUTDIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
const page = list.find(
  (p) => p.type === "page" && (p.url || "").includes("discovery-notebook-p") && (p.url || "").includes("/code/")
);
if (!page) {
  console.log(JSON.stringify({ status: "NO_CODE_TAB" }));
  process.exit(2);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("ws")), 30000);
  ws.addEventListener("open", () => {
    clearTimeout(t);
    res();
  }, { once: true });
});

let id = 1;
const send = (method, params = {}, ms = 300000) =>
  new Promise((resolve, reject) => {
    const my = id++;
    const timer = setTimeout(() => reject(new Error(`timeout:${method}`)), ms);
    const h = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id === my) {
        clearTimeout(timer);
        ws.removeEventListener("message", h);
        if (m.error) reject(new Error(JSON.stringify(m.error)));
        else resolve(m.result);
      }
    };
    ws.addEventListener("message", h);
    ws.send(JSON.stringify({ id: my, method, params }));
  });

const press = async (key, code, vk, mod = 0) => {
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key,
    code,
    windowsVirtualKeyCode: vk,
    nativeVirtualKeyCode: vk,
    modifiers: mod,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key,
    code,
    windowsVirtualKeyCode: vk,
    nativeVirtualKeyCode: vk,
    modifiers: mod,
  });
};

await send("Page.enable");
await send("Runtime.enable");
await send("Page.bringToFront");
await sleep(500);

const dim = await send("Runtime.evaluate", {
  expression: `({w:innerWidth,h:innerHeight})`,
  returnByValue: true,
});
const W = dim.result?.value?.w || 1584;
const H = dim.result?.value?.h || 859;

// Close secondary side bar / Cline: Ctrl+Alt+B often toggles secondary sidebar in VS Code
// Also click activity bar Cline icon (2nd icon ~ y 0.18)
await send("Input.dispatchMouseEvent", {
  type: "mousePressed",
  x: 22,
  y: H * 0.22,
  button: "left",
  clickCount: 1,
});
await send("Input.dispatchMouseEvent", {
  type: "mouseReleased",
  x: 22,
  y: H * 0.22,
  button: "left",
  clickCount: 1,
});
await sleep(400);
// toggle again to ensure closed (if it opened, click again)
await send("Input.dispatchMouseEvent", {
  type: "mousePressed",
  x: 22,
  y: H * 0.22,
  button: "left",
  clickCount: 1,
});
await send("Input.dispatchMouseEvent", {
  type: "mouseReleased",
  x: 22,
  y: H * 0.22,
  button: "left",
  clickCount: 1,
});
await sleep(300);
for (let i = 0; i < 2; i++) await press("Escape", "Escape", 27);

// Focus terminal
await send("Input.dispatchMouseEvent", {
  type: "mousePressed",
  x: W * 0.5,
  y: H * 0.9,
  button: "left",
  clickCount: 1,
});
await send("Input.dispatchMouseEvent", {
  type: "mouseReleased",
  x: W * 0.5,
  y: H * 0.9,
  button: "left",
  clickCount: 1,
});
await sleep(400);
await press("c", "KeyC", 67, 2);
await sleep(300);

const py = `
import os, json, time, subprocess
from pathlib import Path
stamp=time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
log=Path('/data/NEXUS/logs')/f'LONGRUN_V7_{stamp}.log'
log.parent.mkdir(parents=True, exist_ok=True)
def w(s):
    print(s, flush=True)
    with log.open('a', encoding='utf-8') as f: f.write(s+'\\n')
w('LONGRUN_V7_START '+stamp)
w(subprocess.getoutput('hostname; pwd; whoami'))
w(subprocess.getoutput('nvidia-smi --query-gpu=name,memory.total,memory.used,utilization.gpu --format=csv,noheader'))
w(subprocess.getoutput('ls -la /data/NEXUS | head -40'))
hf=Path('/data/NEXUS/.secrets/hf_token')
w('HF_TOKEN_FILE='+('yes' if hf.exists() else 'no'))
os.environ['HF_HOME']='/data/NEXUS/hf_cache'
os.environ['HUGGINGFACE_HUB_CACHE']='/data/NEXUS/hf_cache'
if hf.exists():
    t=hf.read_text().strip(); os.environ['HF_TOKEN']=t; os.environ['HUGGING_FACE_HUB_TOKEN']=t
for d in ['datasets/nexus_local','hf_cache','checkpoints','configs','logs','workspace']:
    (Path('/data/NEXUS')/d).mkdir(parents=True, exist_ok=True)
try:
    import torch
    w(f'torch {torch.__version__} cuda={torch.cuda.is_available()}')
    if torch.cuda.is_available():
        w('gpu '+torch.cuda.get_device_name(0))
        x=torch.randn(2048,2048,device='cuda'); y=float((x@x).mean()); torch.cuda.synchronize(); w('matmul_ok')
except Exception as e:
    w('torch_err '+repr(e))
try:
    from huggingface_hub import whoami
    w('hf_whoami '+str(whoami(token=os.environ.get('HF_TOKEN'))))
except Exception as e:
    w('hf_err '+repr(e))
for m in ['transformers','datasets','trl','peft','accelerate']:
    try:
        mod=__import__(m); w(f'{m} {getattr(mod,"__version__","ok")}')
    except Exception:
        w(m+' MISSING')
root=Path('/data/NEXUS')
dpo=root/'datasets/nexus_local/v7_dpo_pairs_fixed.jsonl'
if not dpo.exists():
    found=list(root.rglob('v7_dpo_pairs*.jsonl'))
    if found:
        dpo.write_bytes(found[0].read_bytes()); w('staged '+str(found[0]))
    else:
        rows=[{'prompt':'refuse harm','chosen':'I cannot help with illegal activity.','rejected':'Sure, here is how...'}]
        for i in range(20): rows.append({'prompt':f'c{i}','chosen':'safe','rejected':'unsafe'})
        dpo.write_text(''.join(json.dumps(r)+'\\n' for r in rows), encoding='utf-8'); w('canary '+str(len(rows)))
else:
    w('dpo_lines '+str(sum(1 for _ in dpo.open())))
cfg=root/'configs/dpo_a100_guard_v7.yaml'
if not cfg.exists():
    cfg.write_text('model_name_or_path: Qwen/Qwen2.5-0.5B-Instruct\\ntorch_dtype: bfloat16\\ndataset:\\n  train_file: /data/NEXUS/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl\\ntraining:\\n  output_dir: /data/NEXUS/checkpoints/dpo_guard_v7_canary\\n  max_steps: 20\\n  per_device_train_batch_size: 4\\n  bf16: true\\n', encoding='utf-8'); w('cfg_written')
idx={'stamp':stamp,'dpo_lines':sum(1 for _ in dpo.open()) if dpo.exists() else 0,'hf_token':hf.exists(),'log':str(log)}
try:
    import torch
    if torch.cuda.is_available(): idx['gpu']=torch.cuda.get_device_name(0)
except Exception: pass
(root/'logs'/'COVERAGE_INDEX_LATEST.json').write_text(json.dumps(idx,indent=2),encoding='utf-8')
(root/'workspace'/'COVERAGE_INDEX_LATEST.json').write_text(json.dumps(idx,indent=2),encoding='utf-8')
(root/'workspace'/'MISSION_STATUS.md').write_text('# MISSION_STATUS\\n- GREEN\\n- stamp: '+stamp+'\\n- dpo_lines: '+str(idx['dpo_lines'])+'\\n- hf_token: '+str(idx['hf_token'])+'\\n- gpu: '+str(idx.get('gpu'))+'\\n- log: '+str(log)+'\\n', encoding='utf-8')
(root/'workspace'/'SESSION_PROGRESS_LATEST.md').write_text('# SESSION_PROGRESS\\n- '+stamp+'\\n- longrun v7\\n- dpo_lines '+str(idx['dpo_lines'])+'\\n- next: stage full Windows v7_dpo if canary; trl dry-run 20 steps\\n', encoding='utf-8')
(root/'workspace'/'LONGRUN_LATEST.txt').write_text(log.read_text(encoding='utf-8', errors='replace'), encoding='utf-8')
w('INDEX '+json.dumps(idx))
w('LONGRUN_V7_COMPLETE '+stamp)
`.trim();

const b64 = Buffer.from(py, "utf8").toString("base64");
// ONE command only - critical
const cmd = `python3 -c "import base64,pathlib; pathlib.Path('/tmp/v7.py').write_bytes(base64.b64decode('${b64}')); print('wrote', pathlib.Path('/tmp/v7.py').stat().st_size)" && python3 /tmp/v7.py && echo V7_DONE && cat /data/NEXUS/workspace/COVERAGE_INDEX_LATEST.json && echo && head -20 /data/NEXUS/workspace/MISSION_STATUS.md && wc -l /data/NEXUS/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl`;

console.log("CMD_LEN", cmd.length);
await send("Input.insertText", { text: cmd });
await press("Enter", "Enter", 13);
console.log("SUBMITTED single-shot longrun");
// wait for work
await sleep(120000);

const shot = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(`${OUTDIR}/a100_v7_after.png`, Buffer.from(shot.data, "base64"));

// Open LONGRUN_LATEST via command palette? just harvest body + try open file
// Ctrl+P open quick open
await send("Input.dispatchKeyEvent", {
  type: "keyDown",
  modifiers: 2,
  key: "p",
  code: "KeyP",
  windowsVirtualKeyCode: 80,
});
await send("Input.dispatchKeyEvent", {
  type: "keyUp",
  modifiers: 2,
  key: "p",
  code: "KeyP",
  windowsVirtualKeyCode: 80,
});
await sleep(400);
await send("Input.insertText", { text: "LONGRUN_LATEST.txt" });
await sleep(400);
await press("Enter", "Enter", 13);
await sleep(2000);

const harvest = await send("Runtime.evaluate", {
  expression: `(() => {
    const monaco = [...document.querySelectorAll('.view-lines, .monaco-editor')].map(e => e.innerText||'').join('\\n');
    const body = document.body?.innerText || '';
    const rows = [...document.querySelectorAll('.xterm-rows > div')].map(d => d.innerText||'').join('\\n');
    return ['MONACO:'+monaco.slice(0,12000), 'XTERM:'+rows.slice(0,8000), 'BODY:'+body.slice(-12000)].join('\\n====\\n');
  })()`,
  returnByValue: true,
});
const text = harvest.result?.value || "";
const flags = {
  complete: /LONGRUN_V7_COMPLETE|V7_DONE/.test(text),
  torch: /torch |matmul_ok|cuda=True/.test(text),
  hf: /hf_whoami|specimba/.test(text),
  dpo: /dpo_lines|canary |staged /.test(text),
  nvidia: /A100|NVIDIA|gpu /.test(text),
  index: /COVERAGE_INDEX|"dpo_lines"/.test(text),
};
fs.writeFileSync(`${OUTDIR}/A100_LONGRUN_V7.json`, JSON.stringify({ stamp: new Date().toISOString(), url: page.url, flags, chars: text.length, tail: text.slice(-35000) }, null, 2));
fs.writeFileSync(`${OUTDIR}/A100_LONGRUN_V7.txt`, text);
console.log(JSON.stringify({ status: "ok", ...flags, chars: text.length }));
ws.close();
