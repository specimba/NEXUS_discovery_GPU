#!/usr/bin/env node
/**
 * Fetch dpo_dryrun_v7.py via jsDelivr and run on A100 (base64 single-shot).
 * Harvest DPO_DRYRUN_LATEST.json + COVERAGE after wait.
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
const send = (method, params = {}, ms = 600000) =>
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
await sleep(400);

const dim = await send("Runtime.evaluate", {
  expression: `({w:innerWidth,h:innerHeight})`,
  returnByValue: true,
});
const W = dim.result?.value?.w || 1584;
const H = dim.result?.value?.h || 859;

// collapse Cline-ish
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

// Terminal: Focus Terminal
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
await press("c", "KeyC", 67, 2);
await sleep(250);

// Bootstrap: download dryrun script via multi-mirror, run it, write marker
const py = `
import urllib.request, pathlib, subprocess, sys, time
root = pathlib.Path('/data/NEXUS')
(root/'scripts').mkdir(parents=True, exist_ok=True)
dest = root/'scripts'/'dpo_dryrun_v7.py'
urls = [
  'https://cdn.jsdelivr.net/gh/specimba/NEXUS_discovery_GPU@main/scripts/dpo_dryrun_v7.py',
  'https://ghproxy.net/https://raw.githubusercontent.com/specimba/NEXUS_discovery_GPU/main/scripts/dpo_dryrun_v7.py',
  'https://raw.githubusercontent.com/specimba/NEXUS_discovery_GPU/main/scripts/dpo_dryrun_v7.py',
]
ok = False
for u in urls:
    try:
        print('GET', u, flush=True)
        req = urllib.request.Request(u, headers={'User-Agent':'NEXUS-dryrun/1'})
        data = urllib.request.urlopen(req, timeout=60).read()
        if len(data) < 500:
            continue
        dest.write_bytes(data)
        print('OK', dest, len(data), flush=True)
        ok = True
        break
    except Exception as e:
        print('FAIL', u, e, flush=True)
if not ok:
    raise SystemExit('dryrun script download failed')
# env for CN HF
import os
os.environ.setdefault('HF_ENDPOINT', 'https://hf-mirror.com')
os.environ.setdefault('NEXUS_ROOT', '/data/NEXUS')
os.environ.setdefault('NEXUS_DPO_MAX_STEPS', '20')
print('START dryrun', time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()), flush=True)
rc = subprocess.call([sys.executable, str(dest)])
print('DRYRUN_RC', rc, flush=True)
# print latest
lat = root/'workspace'/'DPO_DRYRUN_LATEST.json'
if lat.exists():
    print(lat.read_text(encoding='utf-8', errors='replace')[:4000], flush=True)
print('DRYRUN_BOOTSTRAP_DONE', flush=True)
`.trim();

const b64 = Buffer.from(py, "utf8").toString("base64");
const cmd =
  `python3 -c "import base64,pathlib; pathlib.Path('/tmp/boot_dryrun.py').write_bytes(base64.b64decode('${b64}')); print('boot', pathlib.Path('/tmp/boot_dryrun.py').stat().st_size)" && python3 /tmp/boot_dryrun.py && echo BOOT_DONE`;

console.log("CMD_LEN", cmd.length);
await send("Input.insertText", { text: cmd });
await press("Enter", "Enter", 13);
console.log("SUBMITTED dpo dryrun bootstrap — waiting up to 12 min");

// model download + 20 steps can take a while
await sleep(720000);

const shot = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(`${OUT}/a100_dpo_dryrun.png`, Buffer.from(shot.data, "base64"));

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
  await sleep(2500);
};

await openFile("DPO_DRYRUN_LATEST.json");
const mon1 = await send("Runtime.evaluate", {
  expression: `[...document.querySelectorAll('.view-lines .view-line')].map(e=>e.innerText||'').join('\\n')`,
  returnByValue: true,
});
const dry = mon1.result?.value || "";
fs.writeFileSync(`${OUT}/A100_DPO_DRYRUN_LATEST.txt`, dry);

await openFile("COVERAGE_INDEX_LATEST.json");
const mon2 = await send("Runtime.evaluate", {
  expression: `[...document.querySelectorAll('.view-lines .view-line')].map(e=>e.innerText||'').join('\\n')`,
  returnByValue: true,
});
const cov = mon2.result?.value || "";
fs.writeFileSync(`${OUT}/A100_DPO_COVERAGE.txt`, cov);

const body = await send("Runtime.evaluate", {
  expression: `(document.body?.innerText||'').slice(-15000)`,
  returnByValue: true,
});
const all = [dry, cov, body.result?.value || ""].join("\n");
fs.writeFileSync(`${OUT}/A100_DPO_DRYRUN_HARVEST.txt`, all);

const flags = {
  status: "ok",
  dryrun_ok: /DPO_DRYRUN_OK|"ok":\s*true|"dryrun_ok":\s*true/.test(all),
  whoami: /specimba|"name":\s*"specimba"/.test(all),
  lines_150: /"dpo_lines":\s*150/.test(all),
  fail: /DPO_DRYRUN_FAIL|DPO_DRYRUN_CRASH|"ok":\s*false/.test(all),
  dry_preview: dry.slice(0, 1200),
  cov_preview: cov.slice(0, 600),
};
fs.writeFileSync(`${OUT}/A100_DPO_DRYRUN.json`, JSON.stringify(flags, null, 2));
console.log(JSON.stringify(flags));
ws.close();
