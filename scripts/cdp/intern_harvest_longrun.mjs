#!/usr/bin/env node
/** Open JuiceFS longrun artifacts in code-server and harvest text. */
import fs from "node:fs";

const PORT = 9224;
const DAY = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const OUTDIR = `C:/Users/speci.000/Downloads/NEXUSlogs/_runs/GROK/${DAY}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
const page = list.find(
  (p) => p.type === "page" && (p.url || "").includes("discovery-notebook-p") && (p.url || "").includes("/code/")
);
if (!page) {
  console.log(JSON.stringify({ status: "NO_TAB" }));
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
const send = (method, params = {}, ms = 60000) =>
  new Promise((resolve, reject) => {
    const my = id++;
    const timer = setTimeout(() => reject(new Error(method)), ms);
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
for (let i = 0; i < 2; i++) await press("Escape", "Escape", 27);

async function openFile(name) {
  // Ctrl+P quick open
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
  await sleep(500);
  await send("Input.insertText", { text: name });
  await sleep(600);
  await press("Enter", "Enter", 13);
  await sleep(2000);
}

const files = ["LONGRUN_LATEST.txt", "COVERAGE_INDEX_LATEST.json", "MISSION_STATUS.md", "SESSION_PROGRESS_LATEST.md"];
const collected = {};

for (const f of files) {
  await openFile(f);
  const r = await send("Runtime.evaluate", {
    expression: `(() => {
      const lines = [...document.querySelectorAll('.view-lines .view-line')].map(e => e.innerText||e.textContent||'');
      if (lines.length) return lines.join('\\n');
      const ed = document.querySelector('.monaco-editor');
      return ed ? (ed.innerText||'') : '';
    })()`,
    returnByValue: true,
  });
  collected[f] = r.result?.value || "";
  console.log("OPENED", f, "chars", (collected[f] || "").length);
}

// also cat via terminal one short line after focus terminal
const dim = await send("Runtime.evaluate", {
  expression: `({w:innerWidth,h:innerHeight})`,
  returnByValue: true,
});
const W = dim.result?.value?.w || 1584;
const H = dim.result?.value?.h || 859;
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
await sleep(200);
const dumpCmd =
  "echo '===DUMP==='; cat /data/NEXUS/workspace/COVERAGE_INDEX_LATEST.json; echo; cat /data/NEXUS/workspace/MISSION_STATUS.md; echo; tail -60 /data/NEXUS/workspace/LONGRUN_LATEST.txt; echo '===ENDDUMP==='";
await send("Input.insertText", { text: dumpCmd });
await press("Enter", "Enter", 13);
await sleep(8000);

const shot = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(`${OUTDIR}/a100_harvest.png`, Buffer.from(shot.data, "base64"));

const body = await send("Runtime.evaluate", {
  expression: `(document.body?.innerText||'').slice(-20000)`,
  returnByValue: true,
});

const report = {
  stamp: new Date().toISOString(),
  files: Object.fromEntries(
    Object.entries(collected).map(([k, v]) => [k, { chars: (v || "").length, text: v }])
  ),
  body_tail: body.result?.value || "",
};
fs.writeFileSync(`${OUTDIR}/A100_HARVEST.json`, JSON.stringify(report, null, 2));
// write individual
for (const [k, v] of Object.entries(collected)) {
  if (v && v.length > 10) fs.writeFileSync(`${OUTDIR}/harvest_${k.replace(/\./g, "_")}`, v);
}
const blob = JSON.stringify(report);
const flags = {
  complete: /LONGRUN_V[567]_COMPLETE|GREEN/.test(blob + (body.result?.value || "")),
  torch: /torch|matmul_ok|cuda=True/.test(blob + (body.result?.value || "")),
  hf: /hf_whoami|specimba|hf_token/.test(blob + (body.result?.value || "")),
  dpo: /dpo_lines|canary/.test(blob + (body.result?.value || "")),
  nvidia: /A100|NVIDIA/.test(blob + (body.result?.value || "")),
};
console.log(JSON.stringify({ status: "ok", ...flags, files: Object.keys(collected).map((k) => [k, collected[k]?.length || 0]) }));
ws.close();
