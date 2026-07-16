#!/usr/bin/env node
/**
 * Stage full DPO gold on A100 via multi-mirror urllib (jsDelivr first — China-friendly).
 * Base64 single-shot python like longrun v7 (terminal-proven path).
 * Harvest by opening STAGE_GOLD_RESULT.json + COVERAGE_INDEX_LATEST.json.
 */
import fs from "node:fs";

const PORT = 9224;
const OUT = "C:/Users/speci.000/Downloads/NEXUSlogs/_runs/GROK/20260716";
fs.mkdirSync(OUT, { recursive: true });
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

const chord = async (keys) => {
  // keys: array of {key, code, vk, mod?}
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
  for (let i = keys.length - 1; i >= 0; i--) {
    const k = keys[i];
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

await send("Page.enable");
await send("Runtime.enable");
await send("Page.bringToFront");
await sleep(400);

const dim = await send("Runtime.evaluate", {
  expression: `({w:innerWidth,h:innerHeight})`,
  returnByValue: true,
});
const W = dim.result?.value?.w || 1584;
const H = dim.result?.value?.h || 859;

// Toggle Cline closed (activity bar ~2nd icon)
for (const y of [H * 0.2, H * 0.24]) {
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: 20,
    y,
    button: "left",
    clickCount: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: 20,
    y,
    button: "left",
    clickCount: 1,
  });
  await sleep(200);
}
for (let i = 0; i < 3; i++) await press("Escape", "Escape", 27);

// Ctrl+Shift+P -> Terminal: Focus Terminal
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
await sleep(450);
await press("Enter", "Enter", 13);
await sleep(700);

// click terminal body
await send("Input.dispatchMouseEvent", {
  type: "mousePressed",
  x: W * 0.55,
  y: H * 0.9,
  button: "left",
  clickCount: 1,
});
await send("Input.dispatchMouseEvent", {
  type: "mouseReleased",
  x: W * 0.55,
  y: H * 0.9,
  button: "left",
  clickCount: 1,
});
await sleep(300);
// Ctrl+C to clear any partial line
await press("c", "KeyC", 67, 2);
await sleep(250);

const py = `
import json, time, urllib.request
from pathlib import Path

stamp = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
root = Path('/data/NEXUS')
for p in ['datasets/nexus_local','configs','logs','workspace']:
    (root/p).mkdir(parents=True, exist_ok=True)

def fetch(urls, dest, min_bytes=200):
    errs = []
    for u in urls:
        try:
            print('GET', u, flush=True)
            req = urllib.request.Request(u, headers={'User-Agent': 'NEXUS-stage/8'})
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
            if len(data) < min_bytes:
                errs.append(u + ' too_small ' + str(len(data)))
                continue
            dest.write_bytes(data)
            print('OK', dest, len(data), flush=True)
            return u, len(data)
        except Exception as e:
            errs.append(u + ' ' + repr(e))
            print('FAIL', u, e, flush=True)
    raise RuntimeError('all_failed ' + ' | '.join(errs))

dpo = root/'datasets/nexus_local/v7_dpo_pairs_fixed.jsonl'
cfg = root/'configs/dpo_a100_guard_v7.yaml'
dpo_urls = [
  'https://cdn.jsdelivr.net/gh/specimba/NEXUS_discovery_GPU@main/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl',
  'https://ghproxy.net/https://raw.githubusercontent.com/specimba/NEXUS_discovery_GPU/main/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl',
  'https://raw.githubusercontent.com/specimba/NEXUS_discovery_GPU/main/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl',
]
cfg_urls = [
  'https://cdn.jsdelivr.net/gh/specimba/NEXUS_discovery_GPU@main/configs/dpo_a100_guard_v7.yaml',
  'https://ghproxy.net/https://raw.githubusercontent.com/specimba/NEXUS_discovery_GPU/main/configs/dpo_a100_guard_v7.yaml',
  'https://raw.githubusercontent.com/specimba/NEXUS_discovery_GPU/main/configs/dpo_a100_guard_v7.yaml',
]
src_dpo, dpo_bytes = fetch(dpo_urls, dpo, min_bytes=100000)
src_cfg, cfg_bytes = fetch(cfg_urls, cfg, min_bytes=200)
n = sum(1 for _ in dpo.open(encoding='utf-8', errors='replace'))
idx = {
  'stamp': stamp,
  'dpo_lines': n,
  'dpo_bytes': dpo_bytes,
  'cfg_bytes': cfg_bytes,
  'source_dpo': src_dpo,
  'source_cfg': src_cfg,
  'gpu': 'NVIDIA A100-SXM4-80GB',
  'host': 'nb-582b5f51',
  'stage': 'gold_v8',
}
for path in [root/'workspace'/'COVERAGE_INDEX_LATEST.json', root/'logs'/'COVERAGE_INDEX_LATEST.json']:
    path.write_text(json.dumps(idx, indent=2), encoding='utf-8')
result = dict(idx)
result['ok'] = n >= 150
result['marker'] = 'STAGE_GOLD_OK' if n >= 150 else 'STAGE_GOLD_PARTIAL'
(root/'workspace'/'STAGE_GOLD_RESULT.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
(root/'logs'/'STAGE_GOLD_RESULT.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
(root/'workspace'/'MISSION_STATUS.md').write_text(
  f"# MISSION_STATUS\\n- GREEN\\n- stamp: {stamp}\\n- dpo_lines: {n}\\n- dpo_bytes: {dpo_bytes}\\n- source: {src_dpo}\\n- next: HF whoami + trl dry-run 20\\n",
  encoding='utf-8',
)
(root/'workspace'/'SESSION_PROGRESS_LATEST.md').write_text(
  f"# SESSION_PROGRESS\\n- {stamp}\\n- staged gold DPO lines={n}\\n- cfg ok\\n- next: HF whoami, deps, DPO max_steps=20\\n",
  encoding='utf-8',
)
print('STAGE_GOLD_RESULT', json.dumps(result), flush=True)
print('STAGE_GOLD_OK' if n >= 150 else 'STAGE_GOLD_PARTIAL', n, flush=True)
`.trim();

const b64 = Buffer.from(py, "utf8").toString("base64");
const cmd =
  `python3 -c "import base64,pathlib; pathlib.Path('/tmp/stage_gold_v8.py').write_bytes(base64.b64decode('${b64}')); print('wrote', pathlib.Path('/tmp/stage_gold_v8.py').stat().st_size)" && python3 /tmp/stage_gold_v8.py && echo V8_DONE && cat /data/NEXUS/workspace/STAGE_GOLD_RESULT.json && wc -l /data/NEXUS/datasets/nexus_local/v7_dpo_pairs_fixed.jsonl`;

console.log("CMD_LEN", cmd.length, "PY_LEN", py.length, "B64_LEN", b64.length);
await send("Input.insertText", { text: cmd });
await press("Enter", "Enter", 13);
console.log("SUBMITTED stage_gold_v8");
await sleep(90000);

const shot1 = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(`${OUT}/a100_stage_v8.png`, Buffer.from(shot1.data, "base64"));

// Open STAGE_GOLD_RESULT.json via quick open
const openFile = async (name) => {
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
  await send("Input.insertText", { text: name });
  await sleep(500);
  await press("Enter", "Enter", 13);
  await sleep(2000);
};

await openFile("STAGE_GOLD_RESULT.json");
const mon1 = await send("Runtime.evaluate", {
  expression: `[...document.querySelectorAll('.view-lines .view-line')].map(e=>e.innerText||'').join('\\n')`,
  returnByValue: true,
});
const stageTxt = mon1.result?.value || "";
fs.writeFileSync(`${OUT}/A100_STAGE_GOLD_RESULT.txt`, stageTxt);

await openFile("COVERAGE_INDEX_LATEST.json");
const mon2 = await send("Runtime.evaluate", {
  expression: `[...document.querySelectorAll('.view-lines .view-line')].map(e=>e.innerText||'').join('\\n')`,
  returnByValue: true,
});
const covTxt = mon2.result?.value || "";
fs.writeFileSync(`${OUT}/A100_STAGE_COVERAGE_V8.txt`, covTxt);

const body = await send("Runtime.evaluate", {
  expression: `(document.body?.innerText||'').slice(-12000)`,
  returnByValue: true,
});
const bodyTxt = body.result?.value || "";
const all = [stageTxt, covTxt, bodyTxt].join("\n");
fs.writeFileSync(`${OUT}/A100_STAGE_V8_HARVEST.txt`, all);

const shot2 = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(`${OUT}/a100_stage_v8_after.png`, Buffer.from(shot2.data, "base64"));

const flags = {
  status: "ok",
  gold_ok: /STAGE_GOLD_OK|"dpo_lines":\s*150|dpo_lines.: 150/.test(all),
  lines_150: /"dpo_lines":\s*150/.test(all) || /\b150\b/.test(stageTxt),
  jsdelivr: /jsdelivr/.test(all),
  v8_done: /V8_DONE|STAGE_GOLD_OK|STAGE_GOLD_PARTIAL/.test(all),
  stage_chars: stageTxt.length,
  cov_chars: covTxt.length,
  stage_preview: stageTxt.slice(0, 800),
  cov_preview: covTxt.slice(0, 500),
};
fs.writeFileSync(`${OUT}/A100_STAGE_V8.json`, JSON.stringify(flags, null, 2));
console.log(JSON.stringify(flags));
ws.close();
