/**
 * Intern AFK keepalive — do NOT idle-kill the notebook.
 * Every ~90s: activate tab, slight scroll/mousemove, optional terminal touch if idle.
 * NEVER navigate away from notebook. NEVER reload. NEVER open binary files.
 * NEVER close Cline.
 */
import fs from "node:fs";
const OUT = "C:/Users/speci.000/Downloads/NEXUSlogs/_runs/GROK/20260717";
const TARGET =
  "https://discovery.intern-ai.org.cn/compute/dev-machine/inside/101/nb-253ef43eacdbe4e480503d693d5026ed";
const INTERVAL_MS = 90_000;
const LOG = `${OUT}/KEEPALIVE.log`;
fs.mkdirSync(OUT, { recursive: true });

function log(m) {
  const line = `${new Date().toISOString()} ${m}`;
  fs.appendFileSync(LOG, line + "\n");
  console.log(line);
}

async function getPage() {
  const list = await fetch("http://127.0.0.1:9224/json/list").then((r) => r.json());
  let page = list.find(
    (p) => p.type === "page" && (p.url || "").includes("nb-253ef43e") && (p.url || "").includes("inside")
  );
  if (!page) {
    page = list.find((p) => p.type === "page" && (p.url || "").includes("nb-253ef43e"));
  }
  if (!page) {
    page = list.find(
      (p) => p.type === "page" && (p.url || "").includes("discovery.intern-ai.org.cn/compute")
    );
  }
  return page;
}

async function tick() {
  const page = await getPage();
  if (!page) {
    log("NO_PAGE — open notebook tab");
    return;
  }
  // Only navigate if we lost inside URL (session refresh) — rare
  if (!(page.url || "").includes("inside/101") && !(page.url || "").includes("/code/")) {
    log("PAGE_OFF_NOTEBOOK url=" + (page.url || "").slice(0, 100));
  }
  await fetch(`http://127.0.0.1:9224/json/activate/${page.id}`).catch(() => {});
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("ws")), 12000);
    ws.addEventListener(
      "open",
      () => {
        clearTimeout(t);
        res();
      },
      { once: true }
    );
  });
  let id = 1;
  const cdp = (method, params = {}, ms = 20000) =>
    new Promise((resolve, reject) => {
      const my = id++;
      const timer = setTimeout(() => reject(new Error(method)), ms);
      const h = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id === my) {
          clearTimeout(timer);
          ws.removeEventListener("message", h);
          m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
        }
      };
      ws.addEventListener("message", h);
      ws.send(JSON.stringify({ id: my, method, params }));
    });

  try {
    await cdp("Page.bringToFront");
    // Mild activity only — no navigation, no reload
    const x = 400 + Math.floor(Math.random() * 200);
    const y = 300 + Math.floor(Math.random() * 150);
    await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await cdp("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x,
      y,
      deltaX: 0,
      deltaY: 40,
    });
    await cdp("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x,
      y,
      deltaX: 0,
      deltaY: -40,
    });
    // Touch a tiny heartbeat file via terminal ONLY if terminal likely focused is risky;
    // instead evaluate no-op in page to reset activity timers in browser.
    await cdp("Runtime.evaluate", {
      expression: `(()=>{document.title=document.title;window.dispatchEvent(new Event('mousemove'));return Date.now();})()`,
    });
    log("TICK ok " + (page.url || "").slice(0, 80));
  } catch (e) {
    log("TICK_ERR " + e.message);
  } finally {
    try {
      ws.close();
    } catch {}
  }
}

log("KEEPALIVE_START interval_ms=" + INTERVAL_MS);
await tick();
setInterval(() => {
  tick().catch((e) => log("INTERVAL_ERR " + e.message));
}, INTERVAL_MS);
// keep process alive
await new Promise(() => {});
