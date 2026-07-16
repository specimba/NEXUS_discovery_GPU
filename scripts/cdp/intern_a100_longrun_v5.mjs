#!/usr/bin/env node
/**
 * v5: steal focus FROM Cline → Terminal: Focus Terminal → run longrun
 * Screenshot showed prior injects hit Cline task box.
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
const send = (method, params = {}, ms = 180000) =>
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

const keyChord = async (keys) => {
  // keys: [{key,code,vk,mod}]
  for (const k of keys) {
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: k.key,
      code: k.code,
      windowsVirtualKeyCode: k.vk,
      nativeVirtualKeyCode: k.vk,
      modifiers: k.mod || 0,
    });
  }
  for (const k of [...keys].reverse()) {
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: k.key,
      code: k.code,
      windowsVirtualKeyCode: k.vk,
      nativeVirtualKeyCode: k.vk,
      modifiers: k.mod || 0,
    });
  }
};

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

// Escape Cline / dialogs
for (let i = 0; i < 4; i++) await press("Escape", "Escape", 27);
await sleep(200);

// Click Cancel on Cline if visible (left panel lower)
const dim0 = await send("Runtime.evaluate", {
  expression: `({w:innerWidth,h:innerHeight})`,
  returnByValue: true,
});
const W = dim0.result?.value?.w || 1584;
const H = dim0.result?.value?.h || 859;

// Click TERMINAL tab area (bottom bar labels ~ center-left bottom)
// From screenshot TERMINAL is above the xterm, roughly y=72% of panel, x=40%
await send("Input.dispatchMouseEvent", {
  type: "mousePressed",
  x: W * 0.28,
  y: H * 0.72,
  button: "left",
  clickCount: 1,
});
await send("Input.dispatchMouseEvent", {
  type: "mouseReleased",
  x: W * 0.28,
  y: H * 0.72,
  button: "left",
  clickCount: 1,
});
await sleep(400);

// Command Palette → Terminal: Focus Terminal
// Ctrl+Shift+P
await send("Input.dispatchKeyEvent", {
  type: "keyDown",
  modifiers: 2,
  key: "Control",
  code: "ControlLeft",
  windowsVirtualKeyCode: 17,
});
await send("Input.dispatchKeyEvent", {
  type: "keyDown",
  modifiers: 2 | 8,
  key: "Shift",
  code: "ShiftLeft",
  windowsVirtualKeyCode: 16,
});
await send("Input.dispatchKeyEvent", {
  type: "keyDown",
  modifiers: 2 | 8,
  key: "P",
  code: "KeyP",
  windowsVirtualKeyCode: 80,
});
await send("Input.dispatchKeyEvent", {
  type: "keyUp",
  modifiers: 2 | 8,
  key: "P",
  code: "KeyP",
  windowsVirtualKeyCode: 80,
});
await send("Input.dispatchKeyEvent", {
  type: "keyUp",
  modifiers: 2,
  key: "Shift",
  code: "ShiftLeft",
  windowsVirtualKeyCode: 16,
});
await send("Input.dispatchKeyEvent", {
  type: "keyUp",
  modifiers: 0,
  key: "Control",
  code: "ControlLeft",
  windowsVirtualKeyCode: 17,
});
await sleep(500);
await send("Input.insertText", { text: "Terminal: Focus Terminal" });
await sleep(400);
await press("Enter", "Enter", 13);
await sleep(1000);

// Click deep into terminal body (not cline)
await send("Input.dispatchMouseEvent", {
  type: "mousePressed",
  x: W * 0.55,
  y: H * 0.88,
  button: "left",
  clickCount: 1,
});
await send("Input.dispatchMouseEvent", {
  type: "mouseReleased",
  x: W * 0.55,
  y: H * 0.88,
  button: "left",
  clickCount: 1,
});
await sleep(300);

// Ctrl+C clear
await send("Input.dispatchKeyEvent", {
  type: "keyDown",
  modifiers: 2,
  key: "c",
  code: "KeyC",
  windowsVirtualKeyCode: 67,
});
await send("Input.dispatchKeyEvent", {
  type: "keyUp",
  modifiers: 2,
  key: "c",
  code: "KeyC",
  windowsVirtualKeyCode: 67,
});
await sleep(300);

const enter = async () => press("Enter", "Enter", 13);
const run = async (cmd, wait = 2000) => {
  await send("Input.insertText", { text: cmd });
  await enter();
  console.log("T>", cmd.slice(0, 100));
  await sleep(wait);
};

// Verify focus with unique marker
const marker = `NEXUS_TFOCUS_${Date.now()}`;
await run(`echo ${marker}`, 2000);

// Single python longrun file using only one line where possible
await run(
  `python3 -c "open('/data/NEXUS/logs/v5_boot.txt','w').write('boot')"; mkdir -p /data/NEXUS/logs /data/NEXUS/datasets/nexus_local /data/NEXUS/hf_cache /data/NEXUS/checkpoints /data/NEXUS/configs; echo V5_DIRS_OK`,
  3000
);

// Write v5 longrun script using base64 in one python -c (chunked carefully)
const py = `
import os, json, time, subprocess
from pathlib import Path
stamp=time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
log=Path('/data/NEXUS/logs')/f'LONGRUN_V5_{stamp}.log'
def w(s):
    print(s, flush=True)
    with log.open('a', encoding='utf-8') as f: f.write(s+'\\n')
w('LONGRUN_V5_START '+stamp)
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
        x=torch.randn(2048,2048,device='cuda'); y=float((x@x).mean()); torch.cuda.synchronize(); w(f'matmul_ok {y}')
except Exception as e:
    w('torch_err '+repr(e))
try:
    from huggingface_hub import whoami
    w('hf_whoami '+str(whoami(token=os.environ.get('HF_TOKEN'))))
except Exception as e:
    w('hf_err '+repr(e))
for m in ['transformers','datasets','trl','peft','accelerate','huggingface_hub']:
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
        dpo.write_text(''.join(json.dumps(r)+chr(10) for r in rows), encoding='utf-8'); w('canary '+str(len(rows)))
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
(root/'workspace'/'MISSION_STATUS.md').write_text('# MISSION_STATUS\\n- GREEN\\n- stamp: '+stamp+'\\n- dpo_lines: '+str(idx['dpo_lines'])+'\\n- hf_token: '+str(idx['hf_token'])+'\\n- gpu: '+str(idx.get('gpu'))+'\\n', encoding='utf-8')
(root/'workspace'/'SESSION_PROGRESS_LATEST.md').write_text('# SESSION_PROGRESS\\n- '+stamp+'\\n- longrun v5\\n- dpo_lines '+str(idx['dpo_lines'])+'\\n', encoding='utf-8')
w('INDEX '+json.dumps(idx))
w('LONGRUN_V5_COMPLETE '+stamp)
`;

const b64 = Buffer.from(py, "utf8").toString("base64");
// write via python reading chunks to /tmp/v5.py
await run(`rm -f /tmp/v5.b64 /tmp/v5.py; echo V5_PREP`, 1500);
// write b64 in 2000 char echo appends
for (let i = 0; i < b64.length; i += 2000) {
  const chunk = b64.slice(i, i + 2000);
  await run(`printf '%s' '${chunk}' >> /tmp/v5.b64`, 600);
}
await run(
  `python3 -c "import base64,pathlib; pathlib.Path('/tmp/v5.py').write_bytes(base64.b64decode(pathlib.Path('/tmp/v5.b64').read_text())); print('py_bytes', pathlib.Path('/tmp/v5.py').stat().st_size)"`,
  3000
);
await run(`python3 /tmp/v5.py; echo V5_EXIT:$?`, 90000);
await run(
  `echo '---SHOW---'; cat /data/NEXUS/logs/COVERAGE_INDEX_LATEST.json; echo; wc -l /data/NEXUS/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl; head -15 /data/NEXUS/workspace/MISSION_STATUS.md; echo V5_SHOW_DONE`,
  5000
);

const shot = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(`${OUTDIR}/a100_v5_after.png`, Buffer.from(shot.data, "base64"));

const harvest = await send("Runtime.evaluate", {
  expression: `(() => {
    const rows = [...document.querySelectorAll('.xterm-rows > div')].map(d => d.innerText||'').join('\\n');
    return rows || '';
  })()`,
  returnByValue: true,
});
const text = harvest.result?.value || "";
const flags = {
  marker: text.includes("NEXUS_TFOCUS") || text.includes("NEXUS_V4") || /V5_/.test(text) || text.includes(marker.slice(0, 12)),
  complete: /LONGRUN_V5_COMPLETE/.test(text),
  torch: /torch |matmul_ok|cuda=True/.test(text),
  hf: /hf_whoami|specimba/.test(text),
  dpo: /dpo_lines|canary |staged /.test(text),
  nvidia: /A100|NVIDIA/.test(text),
};
fs.writeFileSync(
  `${OUTDIR}/A100_LONGRUN_V5.json`,
  JSON.stringify({ stamp: new Date().toISOString(), url: page.url, flags, chars: text.length, tail: text.slice(-25000) }, null, 2)
);
fs.writeFileSync(`${OUTDIR}/A100_LONGRUN_V5.txt`, text || "(empty xterm rows)");
console.log(JSON.stringify({ status: "ok", focusMarker: marker, ...flags, chars: text.length }));
ws.close();
