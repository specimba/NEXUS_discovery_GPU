/**
 * Tab health: detect Chrome OOM / Aw Snap / dead IDE → simple refresh of inside URL.
 * Then optional Cline Proceed click. NO waiting theatre.
 *
 *   node tab_health_watch.mjs           # one-shot
 *   node tab_health_watch.mjs --loop 30 # every 30s
 */
import fs from "node:fs";
import { listPages, pickNotebook, isAllowed, CDP_PORT } from "./cdp_tab_guard.mjs";

const OUT = "C:/Users/speci.000/Downloads/NEXUSlogs/_runs/GROK/20260719/vision";
const TARGET =
  "https://discovery.intern-ai.org.cn/compute/dev-machine/inside/101/nb-253ef43eacdbe4e480503d693d5026ed";
const args = process.argv.slice(2);
const loopSec = (() => {
  const i = args.indexOf("--loop");
  return i >= 0 ? Math.max(15, Number(args[i + 1]) || 30) : 0;
})();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => {
  const line = [new Date().toISOString(), "TAB_HEALTH", ...a.map((x) => (typeof x === "string" ? x : JSON.stringify(x)))].join(" ");
  console.log(line);
  try {
    fs.mkdirSync(OUT, { recursive: true });
    fs.appendFileSync(`${OUT}/PROGRESSION_ORCH.log`, line + "\n");
  } catch {}
};

function crashRe() {
  return /Aw,? Snap|STATUS_BREAKPAD|out of memory|OOM|ERR_.*MEMORY|This page isn.?t working|crashed|Unresponsive|Kill pages|sad tab|Something went wrong|网页无法|重新加载/i;
}

async function connect(page) {
  await fetch(`http://127.0.0.1:${CDP_PORT}/json/activate/${page.id}`).catch(() => {});
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("ws")), 15000);
    ws.addEventListener("open", () => {
      clearTimeout(t);
      res();
    }, { once: true });
  });
  let id = 1;
  const cdp = (method, params = {}, ms = 60000) =>
    new Promise((resolve, reject) => {
      const my = id++;
      const timer = setTimeout(() => reject(new Error(method)), ms);
      const h = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          if (m.id === my) {
            clearTimeout(timer);
            ws.removeEventListener("message", h);
            m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
          }
        } catch {}
      };
      ws.addEventListener("message", h);
      ws.send(JSON.stringify({ id: my, method, params }));
    });
  return { ws, cdp };
}

async function pickNb() {
  const pages = await listPages();
  return (
    pickNotebook(pages.filter(isAllowed)) ||
    pages.find((p) => p.type === "page" && /nb-253ef43e/i.test(p.url || "") && /inside/i.test(p.url || "")) ||
    null
  );
}

async function tick() {
  let nb = await pickNb();
  if (!nb) {
    log("NO_TAB open", TARGET);
    await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(TARGET)}`, { method: "PUT" }).catch(() => {});
    await sleep(3000);
    nb = await pickNb();
    if (!nb) return { action: "NO_TAB" };
  }

  let ws, cdp;
  try {
    ({ ws, cdp } = await connect(nb));
  } catch (e) {
    log("CONNECT_FAIL refresh", String(e.message || e));
    // try navigate via new activate after delay
    return { action: "CONNECT_FAIL" };
  }

  let probe;
  try {
    probe = (
      await cdp("Runtime.evaluate", {
        returnByValue: true,
        expression: `(()=>{
          const t=(document.body?.innerText||'');
          const html=(document.documentElement?.innerHTML||'').slice(0,2000);
          const title=document.title||'';
          const crash=${crashRe()}.test(t+title+html);
          const iframes=document.querySelectorAll('iframe').length;
          const metrics=/A100|显存|GPU|4000m/i.test(t);
          // dead: metrics only, no code iframe, or tiny body after load
          const deadIDE = metrics && iframes===0;
          const thin = t.length < 40 && !metrics;
          return { crash, deadIDE, thin, bodyLen:t.length, iframes, metrics, href:location.href.slice(0,100), title:title.slice(0,40), head:t.replace(/\\s+/g,' ').slice(0,120) };
        })()`,
      })
    ).result?.value;
  } catch (e) {
    probe = { crash: true, err: String(e.message || e) };
  }

  const bad = !!(probe?.crash || probe?.deadIDE || probe?.thin || probe?.err);
  log("PROBE", probe, "bad=", bad);

  if (bad) {
    log("ACTION_REFRESH", TARGET);
    try {
      await cdp("Page.navigate", { url: TARGET });
      await sleep(6000);
      await cdp("Page.reload", { ignoreCache: true });
      await sleep(4000);
    } catch (e) {
      log("REFRESH_ERR", String(e.message || e));
    }
    // wait monaco briefly
    for (let i = 0; i < 12; i++) {
      await sleep(2500);
      try {
        const tree = await cdp("Page.getFrameTree");
        const frames = [];
        (function w(n) {
          if (!n) return;
          frames.push(n.frame);
          (n.childFrames || []).forEach(w);
        })(tree.frameTree);
        let mon = false;
        for (const f of frames) {
          try {
            const world = await cdp("Page.createIsolatedWorld", {
              frameId: f.id,
              worldName: "h" + Date.now() + Math.random().toString(36).slice(2, 3),
              grantUniversalAccess: true,
            });
            const r = await cdp("Runtime.evaluate", {
              contextId: world.executionContextId,
              returnByValue: true,
              expression: `!!document.querySelector('.monaco-workbench')`,
            });
            if (r.result?.value) mon = true;
          } catch {}
        }
        log("POST_REFRESH_WAIT", i, "monaco=", mon);
        if (mon) break;
      } catch {}
    }
    try {
      ws.close();
    } catch {}
    return { action: "REFRESHED", probe };
  }

  // healthy: click Proceed if Cline has it
  try {
    const tree = await cdp("Page.getFrameTree");
    const frames = [];
    (function w(n) {
      if (!n) return;
      frames.push(n.frame);
      (n.childFrames || []).forEach(w);
    })(tree.frameTree);
    for (const f of frames) {
      try {
        const world = await cdp("Page.createIsolatedWorld", {
          frameId: f.id,
          worldName: "p" + Date.now() + Math.random().toString(36).slice(2, 3),
          grantUniversalAccess: true,
        });
        const isC = await cdp("Runtime.evaluate", {
          contextId: world.executionContextId,
          returnByValue: true,
          expression: `/^Cline$/i.test(document.title||'')`,
        });
        if (!isC.result?.value) continue;
        const click = await cdp("Runtime.evaluate", {
          contextId: world.executionContextId,
          returnByValue: true,
          expression: `(()=>{for(const e of document.querySelectorAll('button')){if(/Proceed Anyways/i.test((e.innerText||'').trim())){e.click();return 1;}}return 0;})()`,
        });
        if (click.result?.value) log("PROCEED_CLICKED");
      } catch {}
    }
  } catch {}

  try {
    ws.close();
  } catch {}
  return { action: "OK", probe };
}

if (loopSec > 0) {
  log("LOOP_START", loopSec);
  for (;;) {
    try {
      await tick();
    } catch (e) {
      log("TICK_EX", String(e.message || e));
    }
    await sleep(loopSec * 1000);
  }
} else {
  const r = await tick();
  log("ONESHOT", r);
  process.exit(0);
}
