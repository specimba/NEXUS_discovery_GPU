/**
 * CDP tab selection — NEVER wake discarded/sleeping tabs.
 *
 * Rule: only connect to allowlisted URLs. Never loop all pages + bringToFront.
 * Sleeping Chrome tabs show title prefix "💤" or discarded flag — skip always.
 */

export const CDP_PORT = 9224;

/** Only these may be activated / bringToFront */
export const ALLOW_URL = [
  /nb-253ef43e/i, // NEXUS-GPU-test3 notebook
  /discovery\.intern-ai\.org\.cn\/compute\/dev-machine/i, // list + inside (enter green VM)
  /app\.cline\.bot/i, // Cline OAuth only when needed
  /api\.workos\.com/i, // WorkOS authorize (Cline login external website)
  /workos\.com/i, // WorkOS auth pages during ClinePass login
];

/** Hard deny — never touch */
export const DENY = [
  /^💤/, // discarded title marker in this browser
  /notebooklm\.google/i,
  /gmicloud/i,
  /grok\.com/i,
  /aistudio\.xiaomi/i,
  /meta\.ai/i,
  /huggingnews/i,
  /huggingface\.co/i,
  /gemini\.google/i,
  /chat\.qwen/i,
  /chatgpt\.com/i,
  /deepseek\.com/i,
  /chat\.z\.ai/i,
];

export function isSleeping(page) {
  const t = page.title || "";
  if (t.startsWith("💤") || /\bdiscarded\b/i.test(t)) return true;
  // Chrome discarded tabs sometimes still have normal titles but low activity —
  // never guess; only use allowlist.
  return false;
}

export function isAllowed(page) {
  if (!page || page.type !== "page") return false;
  if (isSleeping(page)) return false;
  const u = page.url || "";
  const t = page.title || "";
  if (DENY.some((re) => re.test(t) || re.test(u))) return false;
  return ALLOW_URL.some((re) => re.test(u));
}

export async function listPages(port = CDP_PORT) {
  const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
  return list.filter((p) => p.type === "page");
}

/** Safe list: allowlisted only */
export async function listAllowed(port = CDP_PORT) {
  return (await listPages(port)).filter(isAllowed);
}

export function pickNotebook(pages) {
  return (
    pages.find((p) => isAllowed(p) && /nb-253ef43e/i.test(p.url || "") && /inside/i.test(p.url || "")) ||
    pages.find((p) => isAllowed(p) && /nb-253ef43e/i.test(p.url || "")) ||
    null
  );
}

export function pickClineAuth(pages) {
  return (
    pages.find((p) => isAllowed(p) && /app\.cline\.bot/i.test(p.url || "")) ||
    pages.find((p) => isAllowed(p) && /workos\.com/i.test(p.url || "")) ||
    null
  );
}

/**
 * Connect CDP. bringToFront only if opts.front === true (default true for single target).
 * Never call on bulk lists.
 */
export async function withPage(page, fn, opts = {}) {
  if (!isAllowed(page)) {
    throw new Error(`TAB_DENIED ${(page.url || page.title || "").slice(0, 80)}`);
  }
  const front = opts.front !== false;
  if (front) {
    await fetch(`http://127.0.0.1:${CDP_PORT}/json/activate/${page.id}`).catch(() => {});
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("ws")), 15000);
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
  const cdp = (method, params = {}, ms = 60000) =>
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
    if (front) await cdp("Page.bringToFront").catch(() => {});
    const out = await fn(cdp, page);
    ws.close();
    return out;
  } catch (e) {
    try {
      ws.close();
    } catch {}
    throw e;
  }
}

/** Cancel external/open-local dialogs ONLY on allowlisted pages (max 2: nb + cline auth) */
export async function cancelAttentionOnAllowedOnly(port = CDP_PORT) {
  const pages = await listAllowed(port);
  // Prefer notebook + auth only even within allowlist
  const targets = [
    pickNotebook(pages),
    pickClineAuth(pages),
  ].filter(Boolean);
  const seen = new Set();
  const results = [];
  for (const page of targets) {
    if (seen.has(page.id)) continue;
    seen.add(page.id);
    try {
      const r = await withPage(
        page,
        async (cdp) => {
          const res = await cdp("Runtime.evaluate", {
            returnByValue: true,
            expression: `(()=>{
              const t=document.body?.innerText||'';
              const has=/external website|open the external|vscode:|Open URL|protocol|Open Visual Studio|Do you want .+ to open/i.test(t);
              if(!has) return {has:false};
              let clicked=null;
              for(const b of document.querySelectorAll('button,.monaco-button,.ant-btn')){
                const lab=(b.innerText||'').replace(/\\s+/g,' ').trim();
                if(/^Cancel$/i.test(lab)||/^Deny$/i.test(lab)||/^No$/i.test(lab)){
                  b.click(); clicked=lab;
                }
              }
              return {has:true, clicked, snip:t.replace(/\\s+/g,' ').slice(0,120)};
            })()`,
          });
          return res.result?.value;
        },
        { front: true }
      );
      results.push({ url: (page.url || "").slice(0, 60), r });
    } catch (e) {
      results.push({ err: String(e.message || e) });
    }
  }
  return results;
}
