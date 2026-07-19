#!/usr/bin/env node
/**
 * Intern NEXUS-GPU-test3 enter (and optional start).
 * Learned the hard way: list page → 运行中 → 进入开发机 → new inside tab.
 * NEVER in-notebook Reconnect thrash.
 *
 * Usage:
 *   node enter_dev_machine.mjs
 *   node enter_dev_machine.mjs --start
 *   node enter_dev_machine.mjs --wait-min 20
 */
import fs from "node:fs";

const PORT = 9224;
const OUT = "C:/Users/speci.000/Downloads/NEXUSlogs/_runs/GROK/20260718/vision";
const LIST = "https://discovery.intern-ai.org.cn/compute/dev-machine";
const NB_RE = /nb-253ef43e/i;
const NAME_RE = /NEXUS-GPU-test3/i;

const args = process.argv.slice(2);
const DO_START = args.includes("--start");
const PRINT_URL = args.includes("--print-url");
/** Tenant path segment in /inside/{tenant}/nb-... — this account */
const TENANT_PATH = "101";
const waitMin = (() => {
  const i = args.indexOf("--wait-min");
  return i >= 0 ? Math.max(1, Number(args[i + 1]) || 15) : 15;
})();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => {
  const line = `${new Date().toISOString()} ${a.join(" ")}`;
  console.log(line);
  try {
    fs.mkdirSync(OUT, { recursive: true });
    fs.appendFileSync(`${OUT}/vm_boot_wait.log`, line + "\n");
  } catch {}
};

async function listPages() {
  return fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
}

function isAwake(p) {
  return p?.type === "page" && !String(p.title || "").startsWith("💤");
}

async function getListTab(pages) {
  return (
    pages.find(
      (p) =>
        isAwake(p) &&
        /discovery\.intern-ai\.org\.cn\/compute\/dev-machine/i.test(p.url || "") &&
        !/\/inside\//i.test(p.url || "")
    ) ||
    pages.find(
      (p) => isAwake(p) && /discovery\.intern-ai\.org\.cn\/compute\/dev-machine/i.test(p.url || "")
    )
  );
}

function connect(page) {
  return new Promise(async (resolve, reject) => {
    await fetch(`http://127.0.0.1:${PORT}/json/activate/${page.id}`).catch(() => {});
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    const t = setTimeout(() => reject(new Error("ws_timeout")), 20000);
    ws.addEventListener(
      "open",
      () => {
        clearTimeout(t);
        let id = 1;
        const cdp = (method, params = {}, ms = 60000) =>
          new Promise((res, rej) => {
            const my = id++;
            const timer = setTimeout(() => rej(new Error(method)), ms);
            const h = (ev) => {
              const m = JSON.parse(ev.data);
              if (m.id === my) {
                clearTimeout(timer);
                ws.removeEventListener("message", h);
                m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
              }
            };
            ws.addEventListener("message", h);
            ws.send(JSON.stringify({ id: my, method, params }));
          });
        resolve({ ws, cdp });
      },
      { once: true }
    );
  });
}

async function cardState(cdp) {
  return (
    await cdp("Runtime.evaluate", {
      returnByValue: true,
      expression: `(()=>{
        const t=(document.body?.innerText||'').replace(/\\s+/g,' ');
        const idx=Math.max(t.search(/NEXUS-GPU-test3/i), t.search(/nb-253ef43e/i));
        const slice=idx>=0 ? t.slice(idx, idx+220) : t.slice(0,350);
        let cardStatus='unknown';
        // 已运行N分钟 also means live (badge text sometimes omitted from slice)
        if(/启动中/.test(slice)) cardStatus='starting';
        else if(/运行中/.test(slice) || /已运行\\d+/.test(slice) || /已运行\\s*\\d+/.test(slice)) cardStatus='running';
        else if(/已停止/.test(slice)) cardStatus='stopped';
        else if(/失败|异常/.test(slice)) cardStatus='error';
        // also check full page for 运行中 near card name
        if(cardStatus==='unknown' && /NEXUS-GPU-test3[^]{0,40}运行中|运行中[^]{0,40}nb-253ef43e/i.test(t)) cardStatus='running';
        const idMatch=slice.match(/nb-[a-f0-9]{20,}/i) || t.match(/nb-[a-f0-9]{20,}/i);
        const machineId=idMatch?idMatch[0]:null;
        const buttons=[];
        for(const e of document.querySelectorAll('button,a,[role=button]')){
          const lab=(e.innerText||'').replace(/\\s+/g,' ').trim();
          if(!lab) continue;
          if(!/进入开发机|启动|停止|资源监控/.test(lab)) continue;
          const r=e.getBoundingClientRect();
          if(r.width<4||r.height<4) continue;
          buttons.push({
            lab: lab.slice(0,28),
            x: Math.round(r.x+r.width/2),
            y: Math.round(r.y+r.height/2),
            dis: !!(e.disabled || e.getAttribute('aria-disabled')==='true')
          });
        }
        return {
          hasCard: idx>=0,
          cardStatus,
          machineId,
          enter: buttons.find(b=>b.lab.includes('进入开发机'))||null,
          start: buttons.find(b=>b.lab==='启动'||b.lab.includes('启动'))||null,
          buttons,
          slice: slice.slice(0,140)
        };
      })()`,
    })
  ).result?.value;
}

function buildInsideUrl(machineId, tenant = TENANT_PATH) {
  if (!machineId) return null;
  return `https://discovery.intern-ai.org.cn/compute/dev-machine/inside/${tenant}/${machineId}`;
}

async function resolveTenantFromOpenTabs() {
  const pages = await listPages();
  for (const p of pages) {
    const m = (p.url || "").match(/\/inside\/(\d+)\/nb-/i);
    if (m) return m[1];
  }
  return TENANT_PATH;
}

async function clickLab(cdp, labSubstr) {
  const hit = await cdp("Runtime.evaluate", {
    returnByValue: true,
    expression: `(()=>{
      for(const e of document.querySelectorAll('button,a,[role=button]')){
        const lab=(e.innerText||'').replace(/\\s+/g,' ').trim();
        if(!lab.includes(${JSON.stringify(labSubstr)})) continue;
        if(e.disabled) continue;
        e.click();
        const r=e.getBoundingClientRect();
        return {lab,x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
      }
      return null;
    })()`,
  });
  const t = hit.result?.value;
  if (!t) return null;
  const x = t.x;
  const y = t.y;
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await cdp("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
  await cdp("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
  return t;
}

// --- main ---
let page = await getListTab(await listPages());
if (!page) {
  log("NO_LIST_TAB open", LIST);
  process.exit(2);
}
log("LIST_TAB", (page.url || "").slice(0, 90));

let { ws, cdp } = await connect(page);
await cdp("Page.bringToFront").catch(() => {});

const href0 = (await cdp("Runtime.evaluate", { returnByValue: true, expression: "location.href" }))
  .result?.value;
if (!href0 || !/dev-machine/i.test(href0) || /\/inside\//i.test(href0)) {
  log("NAV_LIST");
  await cdp("Page.navigate", { url: LIST });
  await sleep(4500);
}

let st = await cardState(cdp);
const tenant = await resolveTenantFromOpenTabs();
const builtUrl = buildInsideUrl(st?.machineId, tenant);
log("STATE0", st?.cardStatus, "machineId=", st?.machineId, "built=", builtUrl);
log("STATE0_BTNS", JSON.stringify(st?.enter || st?.start));

if (PRINT_URL) {
  const pages = await listPages();
  const live = pages
    .filter(
      (p) =>
        isAwake(p) &&
        /\/inside\//i.test(p.url || "") &&
        (st?.machineId ? (p.url || "").includes(st.machineId) : NB_RE.test(p.url || ""))
    )
    .map((p) => p.url);
  console.log(
    JSON.stringify(
      {
        list: LIST,
        machineId: st?.machineId || null,
        status: st?.cardStatus || null,
        tenant,
        builtInsideUrl: builtUrl,
        liveInsideTabs: live,
      },
      null,
      2
    )
  );
  try {
    ws.close();
  } catch {}
  process.exit(st?.machineId ? 0 : 2);
}

if (st?.cardStatus === "stopped") {
  if (!DO_START) {
    log("STOPPED — re-run with --start after user confirms duration/quota");
    process.exit(10);
  }
  log("CLICK_START");
  const s = await clickLab(cdp, "启动");
  log("START", s);
  await sleep(3000);
}

const deadline = Date.now() + waitMin * 60 * 1000;
let n = 0;
while (Date.now() < deadline) {
  st = await cardState(cdp);
  if (n % 3 === 0) log("POLL", st?.cardStatus, st?.slice);
  n++;

  if (st?.cardStatus === "running" && st?.enter && !st.enter.dis) {
    log("READY_ENTER", st.enter.x, st.enter.y);
    await clickLab(cdp, "进入开发机");

    let inside = null;
    for (let i = 0; i < 24; i++) {
      await sleep(1500);
      const pages = await listPages();
      const insides = pages.filter(
        (p) =>
          isAwake(p) &&
          NB_RE.test(p.url || "") &&
          /\/inside\//i.test(p.url || "")
      );
      inside = insides[insides.length - 1] || null;
      if (inside) {
        log("INSIDE_TAB", (inside.url || "").slice(0, 100));
        break;
      }
      log("WAIT_TAB", i);
    }

    if (!inside) {
      log("FAIL_NO_INSIDE_TAB");
      process.exit(4);
    }

    await fetch(`http://127.0.0.1:${PORT}/json/activate/${inside.id}`).catch(() => {});
    const { ws: ws2, cdp: cdp2 } = await connect(inside);
    await cdp2("Page.bringToFront").catch(() => {});
    await sleep(4000);
    const metrics = (
      await cdp2("Runtime.evaluate", {
        returnByValue: true,
        expression: `(()=>{
          const t=(document.body?.innerText||'').replace(/\\s+/g,' ');
          return {
            href: location.href,
            reconnect: /Attempting to reconnect|Reconnect Now/i.test(t),
            gpu: /A100|GPU|显存/i.test(t),
            snip: t.slice(0,160)
          };
        })()`,
      })
    ).result?.value;
    log("INSIDE_OK", JSON.stringify(metrics));
    try {
      const shot = await cdp2("Page.captureScreenshot", { format: "png", fromSurface: true });
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(`${OUT}/vm_boot_entered.png`, Buffer.from(shot.data, "base64"));
      fs.appendFileSync(
        `${OUT}/PROGRESSION_LOG.md`,
        `\n### ${new Date().toISOString()} — ENTER_DEV_MACHINE_SCRIPT\n${JSON.stringify(metrics)}\n`
      );
    } catch {}
    try {
      ws2.close();
    } catch {}
    try {
      ws.close();
    } catch {}
    log("SUCCESS");
    process.exit(0);
  }

  if (st?.cardStatus === "error") {
    log("CARD_ERROR");
    process.exit(6);
  }

  // soft reload list every ~30s while starting
  if (st?.cardStatus === "starting" && n % 4 === 0) {
    try {
      await cdp("Page.reload", { ignoreCache: false });
      await sleep(4000);
    } catch {
      try {
        ws.close();
      } catch {}
      page = await getListTab(await listPages());
      if (!page) {
        log("LOST_LIST");
        process.exit(5);
      }
      ({ ws, cdp } = await connect(page));
    }
  }

  await sleep(8000);
}

log("TIMEOUT");
process.exit(3);
