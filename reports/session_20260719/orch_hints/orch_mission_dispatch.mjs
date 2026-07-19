/**
 * Efficient mission dispatch — New Task + Act + prompt file + send.
 * Used by proactive watch when Task Completed / idle after marker.
 *
 *   import { dispatchMission } from "./orch_mission_dispatch.mjs";
 *   await dispatchMission(cdp, "E2_HARNESS_ACT");
 *
 * CLI:
 *   node orch_mission_dispatch.mjs E2_HARNESS_ACT
 */
import fs from "node:fs";
import { listAllowed, pickNotebook, withPage, CDP_PORT } from "./cdp_tab_guard.mjs";
import { scrollClineToBottom } from "./cline_scroll_bottom.mjs";

const PROMPTS = "C:/Users/speci.000/Documents/NEXUS/scratch/prompts";
const OUT = "C:/Users/speci.000/Downloads/NEXUSlogs/_runs/GROK/20260719/vision";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const QUEUE = [
  { id: "E1_CLOSEOUT_ACT", file: "E1_CLOSEOUT_ACT.txt", marker: /PHASE_B_OK/ },
  { id: "E2_HARNESS_ACT", file: "E2_HARNESS_ACT.txt", marker: /STEP_2_OK/ },
  { id: "E3_GGUF_SMOKE_ACT", file: "E3_GGUF_SMOKE_ACT.txt", marker: /GGUF_SMOKE_(OK|PARTIAL)/ },
  { id: "E4_L0_STUB_ACT", file: "E4_L0_STUB_ACT.txt", marker: /L0_BOUNCER_PLAN_OK/ },
  // Post-reboot 5h collab lane (after STABLE_OK)
  { id: "E8_DISK_TRUTH_ACT", file: "E8_DISK_TRUTH_ACT.txt", marker: /E8_DISK_TRUTH_OK/ },
  { id: "E9_CASCADE_DRY_ACT", file: "E9_CASCADE_DRY_ACT.txt", marker: /E9_CASCADE_DRY_OK/ },
  { id: "E10_PRODUCT_SPINE_ACT", file: "E10_PRODUCT_SPINE_ACT.txt", marker: /E10_PRODUCT_SPINE_OK/ },
  { id: "E11_BENCH_SMOKE_ACT", file: "E11_BENCH_SMOKE_ACT.txt", marker: /E11_BENCH_SMOKE_OK/ },
  { id: "E12_GUARD_STUB_ACT", file: "E12_GUARD_STUB_ACT.txt", marker: /E12_GUARD_STUB_OK/ },
  { id: "E13_STABLE_REFRESH_ACT", file: "E13_STABLE_REFRESH_ACT.txt", marker: /E13_STABLE_REFRESH_OK/ },
  { id: "E14_KIMI_NEXT_PLAN_ACT", file: "E14_KIMI_NEXT_PLAN_ACT.txt", marker: /E14_NEXT_PLAN_OK/ },
  { id: "E19_PORTABLE_BACKUP_ACT", file: "E19_PORTABLE_BACKUP_ACT.txt", marker: /E19_PORTABLE_BACKUP_OK/ },
  { id: "E20_CLEAN_SHEET_NOTE_ACT", file: "E20_CLEAN_SHEET_NOTE_ACT.txt", marker: /E20_CLEAN_SHEET_OK/ },
];

export function queueInfo() {
  return QUEUE;
}

export async function frames(cdp) {
  const t = await cdp("Page.getFrameTree");
  const o = [];
  (function w(n) {
    if (!n) return;
    o.push(n.frame);
    (n.childFrames || []).forEach(w);
  })(t.frameTree);
  return o;
}

export async function evalCline(cdp, expr) {
  // Match Cline webview: title Cline, or task input, NOT marketplace false-positive.
  for (const f of await frames(cdp)) {
    try {
      const w = await cdp("Page.createIsolatedWorld", {
        frameId: f.id,
        worldName: "d" + Date.now() + Math.random().toString(36).slice(2, 4),
        grantUniversalAccess: true,
      });
      const p = await cdp("Runtime.evaluate", {
        contextId: w.executionContextId,
        returnByValue: true,
        expression: `(()=>{
          const title=document.title||'';
          const body=(document.body?.innerText||'');
          const t=body.slice(0,1200);
          const r=document.body?.getBoundingClientRect?.()||{width:0,height:0};
          if ((r.width||0)<100) return false;
          if (/^Cline$/i.test(title)) return true;
          if (/Kilo Code/i.test(title)) return false;
          // Cline panel markers (avoid marketplace "Cline 1399ms")
          if (/Type your task here|What can I do for you|clinemoonshotai|cline-pass:|Plan\\s*Act|Auto-approve:/i.test(t)
              && !/Search Extensions in Marketplace/i.test(t.slice(0,200))) return true;
          if (/Type your task here/i.test(body) || /clinemoonshotai\\/kimi/i.test(body)) return true;
          return false;
        })()`,
      });
      if (!p.result?.value) continue;
      return (
        await cdp("Runtime.evaluate", {
          contextId: w.executionContextId,
          returnByValue: true,
          expression: expr,
          awaitPromise: true,
        })
      ).result?.value;
    } catch {}
  }
  return null;
}

/** Kilo Code webview (Hy3) */
export async function evalKilo(cdp, expr) {
  for (const f of await frames(cdp)) {
    try {
      const w = await cdp("Page.createIsolatedWorld", {
        frameId: f.id,
        worldName: "k" + Date.now() + Math.random().toString(36).slice(2, 4),
        grantUniversalAccess: true,
      });
      const p = await cdp("Runtime.evaluate", {
        contextId: w.executionContextId,
        returnByValue: true,
        expression: `(()=>{
          const title=document.title||'';
          const t=(document.body?.innerText||'').slice(0,800);
          const r=document.body?.getBoundingClientRect?.()||{width:0};
          return (r.width||0)>100 && (/^Kilo Code$/i.test(title) || /Type a message|Hy3|Kilo Code is an AI/i.test(t));
        })()`,
      });
      if (!p.result?.value) continue;
      return (
        await cdp("Runtime.evaluate", {
          contextId: w.executionContextId,
          returnByValue: true,
          expression: expr,
          awaitPromise: true,
        })
      ).result?.value;
    } catch {}
  }
  return null;
}

export async function readKiloStatus(cdp) {
  return evalKilo(
    cdp,
    `(()=>{
      const t=(document.body?.innerText||'').replace(/\\s+/g,' ');
      const cancel=[...document.querySelectorAll('button')].some(b=>/^Cancel$/i.test((b.innerText||'').trim()));
      const newSess=[...document.querySelectorAll('button')].some(b=>/New Session|Start New/i.test((b.innerText||'').trim()));
      const markers=[...new Set((t.match(/E8_DISK_TRUTH_OK|E9_CASCADE_DRY_OK|E10_PRODUCT_SPINE_OK|E11_BENCH_SMOKE_OK|E12_GUARD_STUB_OK|E13_STABLE_REFRESH_OK|E14_NEXT_PLAN_OK|KILO_SESSION_GREEN|KILO_SESSION_PARTIAL|PHASE_B_OK|STABLE_OK|POST_REBOOT/g)||[]))];
      const running=cancel || /API Request|running|Shell |Writing|Reading/i.test(t.slice(-400));
      const done=/DONE\\.|Task complete|New Session/i.test(t.slice(-500)) && !cancel;
      return {
        cancel, newSess, running, done, idle: !cancel && (done || newSess),
        markers, model:(t.match(/Hy3[^\\s]*/i)||[])[0],
        tail: t.slice(-280)
      };
    })()`
  );
}

export async function dispatchKiloMission(cdp, missionId) {
  const item = QUEUE.find((q) => q.id === missionId);
  if (!item) return { ok: false, err: "unknown", missionId };
  const path = `${PROMPTS}/${item.file}`;
  if (!fs.existsSync(path)) return { ok: false, err: "missing", path };
  const PROMPT = fs.readFileSync(path, "utf8").trim();

  // New Session if done
  await evalKilo(
    cdp,
    `(()=>{
      for (const e of document.querySelectorAll('button')) {
        const lab=(e.innerText||'').replace(/\\s+/g,' ').trim();
        if (/^New Session$/i.test(lab) || /^Start New/i.test(lab)) { e.click(); return lab; }
      }
      return null;
    })()`
  );
  await new Promise((r) => setTimeout(r, 900));

  const filled = await evalKilo(
    cdp,
    `(()=>{
      const tas=[...document.querySelectorAll('textarea')].filter(t=>t.getBoundingClientRect().width>80);
      const ta=tas.sort((a,b)=>b.getBoundingClientRect().y-a.getBoundingClientRect().y)[0];
      if(!ta) return {ok:false};
      ta.focus(); ta.click();
      const d=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value');
      d.set.call(ta,'');
      ta.dispatchEvent(new Event('input',{bubbles:true}));
      d.set.call(ta, ${JSON.stringify(PROMPT)});
      ta.dispatchEvent(new Event('input',{bubbles:true}));
      return {ok:true,len:(ta.value||'').length};
    })()`
  );

  if (!filled?.ok) {
    await evalKilo(cdp, `(()=>{const ta=document.querySelector('textarea');if(ta){ta.focus();return 1;}return 0;})()`);
    await cdp("Input.insertText", { text: PROMPT }).catch(() => {});
  }

  await evalKilo(
    cdp,
    `(()=>{
      for (const e of document.querySelectorAll('button,[aria-label]')) {
        const a=((e.getAttribute('aria-label')||'')+(e.innerText||'')+(e.className||'')).toString();
        if (/Send|codicon-send/i.test(a)) { e.click(); return 1; }
      }
      return 0;
    })()`
  );
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await new Promise((r) => setTimeout(r, 2500));
  const st = await readKiloStatus(cdp);
  const result = {
    ok: !!(st?.running || st?.cancel || (st && !st.done)),
    missionId,
    agent: "kilo",
    st,
    ts: new Date().toISOString(),
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/last_kilo_dispatch.json`, JSON.stringify(result, null, 2));
  fs.appendFileSync(
    `${OUT}/PROGRESSION_ORCH.log`,
    `${result.ts} KILO_DISPATCH ${missionId} ok=${result.ok} run=${st?.running} markers=${(st?.markers||[]).join(",")}\n`
  );
  return result;
}

/** Snapshot: task done? running? markers? */
export async function readClineStatus(cdp) {
  await scrollClineToBottom(cdp).catch(() => {});
  return evalCline(
    cdp,
    `(()=>{
    const t=(document.body?.innerText||'').replace(/\\s+/g,' ');
    const modes=[...document.querySelectorAll('[role=switch]')].map(e=>({t:(e.innerText||'').trim(),c:e.getAttribute('aria-checked')}));
    const cancel=[...document.querySelectorAll('button')].some(b=>/^Cancel$/i.test((b.innerText||'').trim()));
    const startNew=[...document.querySelectorAll('button')].some(b=>/Start New Task|^New Task$/i.test((b.innerText||'').trim()));
    const resume=[...document.querySelectorAll('button')].some(b=>/^Resume Task$/i.test((b.innerText||'').trim()));
    const proceed=[...document.querySelectorAll('button')].some(b=>/Proceed Anyways/i.test((b.innerText||'').trim()));
    const thinking=/\\bThinking\\b|API Request|Background Exec/i.test(t);
    const taskCompleted=/Task Completed|All tasks have been completed/i.test(t);
    // Prefer last 600 chars for "fresh" completion
    const recent=t.slice(-700);
    const recentDone=/Task Completed|Start New Task/i.test(recent) && !cancel;
    const invalidAPI=/Invalid API Response|empty or unparsable|repeated tool call failures/i.test(t.slice(-2000));
    const markers=[...new Set((t.match(/PHASE_B_OK|STEP_2_OK|GGUF_SMOKE_OK|GGUF_SMOKE_PARTIAL|L0_BOUNCER_PLAN_OK|PHASE_B_PARTIAL|STABLE_OK|POST_OOM_OK|STEP_5_OK|E8_DISK_TRUTH_OK|E9_CASCADE_DRY_OK|E10_PRODUCT_SPINE_OK|E11_BENCH_SMOKE_OK|E12_GUARD_STUB_OK|E13_STABLE_REFRESH_OK|E14_NEXT_PLAN_OK|E15_DECOY_VRAM_OK|E16_CASCADE_WIRE_OK|E17_HONEST_SCORE_OK|E18_SESSION_PACK_OK|E19_PORTABLE_BACKUP_OK|E20_CLEAN_SHEET_OK|KILO_SESSION_GREEN|KILO_SESSION_PARTIAL/g)||[]))];
    const draft=Math.max(0,...[...document.querySelectorAll('textarea')].map(x=>(x.value||'').length),0);
    return {
      actOn: modes.some(m=>m.t==='Act'&&m.c==='true'),
      planOn: modes.some(m=>m.t==='Plan'&&m.c==='true'),
      cancel, startNew, resume, proceed, thinking, taskCompleted, recentDone, invalidAPI,
      idle: !cancel && !thinking && (taskCompleted || startNew || resume || recentDone),
      // Proceed gate = NOT healthy run; need click, same window
      running: (cancel || thinking) && !proceed,
      markers, draft, model:(t.match(/cline-pass:[\\w./:-]+|kimi-k3/i)||[])[0],
      tail: recent.slice(-280)
    };
  })()`
  );
}

/** SAME conversation: click Proceed Anyways / Resume — NEVER New Task */
export async function clickProceedSameWindow(cdp) {
  return evalCline(
    cdp,
    `(()=>{
    const prefer=[/Proceed Anyways/i,/^Proceed$/i,/^Resume Task$/i,/^Resume$/i,/^Retry$/i];
    for (const re of prefer){
      for (const e of document.querySelectorAll('button,vscode-button,[role=button]')){
        const lab=(e.innerText||e.getAttribute('aria-label')||'').replace(/\\s+/g,' ').trim();
        if (re.test(lab) && !/New Task|Start New|Cancel/i.test(lab)){
          e.click();
          return {clicked:lab};
        }
      }
    }
    return {clicked:null};
  })()`
  );
}

const MARKER_CHAIN = [
  { re: /E20_CLEAN_SHEET_OK/, next: null },
  { re: /E19_PORTABLE_BACKUP_OK/, next: "E20_CLEAN_SHEET_NOTE_ACT" },
  { re: /E14_NEXT_PLAN_OK|E18_SESSION_PACK_OK/, next: "E19_PORTABLE_BACKUP_ACT" },
  { re: /E13_STABLE_REFRESH_OK/, next: "E14_KIMI_NEXT_PLAN_ACT" },
  { re: /E12_GUARD_STUB_OK/, next: "E13_STABLE_REFRESH_ACT" },
  { re: /E11_BENCH_SMOKE_OK/, next: "E12_GUARD_STUB_ACT" },
  { re: /E10_PRODUCT_SPINE_OK/, next: "E11_BENCH_SMOKE_ACT" },
  { re: /E9_CASCADE_DRY_OK/, next: "E10_PRODUCT_SPINE_ACT" },
  { re: /E8_DISK_TRUTH_OK/, next: "E9_CASCADE_DRY_ACT" },
  { re: /STABLE_OK|POST_OOM_OK|STEP_5_OK|L0_BOUNCER_PLAN_OK/, next: "E8_DISK_TRUTH_ACT" },
  { re: /GGUF_SMOKE_(OK|PARTIAL)/, next: "E4_L0_STUB_ACT" },
  { re: /STEP_2_OK/, next: "E3_GGUF_SMOKE_ACT" },
  { re: /PHASE_B_OK/, next: "E2_HARNESS_ACT" },
];

export function nextMissionId(markers, currentId) {
  const has = (re) => (markers || []).some((m) => re.test(m));
  for (const step of MARKER_CHAIN) {
    if (has(step.re)) return step.next;
  }
  // post-stable default: start E8
  if (!currentId || /E7|STABLE|E5|E6/.test(currentId)) return "E8_DISK_TRUTH_ACT";
  return currentId || "E8_DISK_TRUTH_ACT";
}

export async function forceAct(cdp) {
  for (let i = 0; i < 5; i++) {
    const r = await evalCline(
      cdp,
      `(()=>{
      const act=[...document.querySelectorAll('[role=switch]')].find(e=>(e.innerText||'').trim()==='Act');
      const plan=[...document.querySelectorAll('[role=switch]')].find(e=>(e.innerText||'').trim()==='Plan');
      if(!act) return {ok:false};
      if(plan&&plan.getAttribute('aria-checked')==='true'){ act.click(); return {clicked:true}; }
      if(act.getAttribute('aria-checked')!=='true'){ act.click(); return {clicked:true}; }
      return {ok:true};
    })()`
    );
    if (r?.ok) return true;
    await sleep(250);
  }
  const st = await evalCline(
    cdp,
    `(()=>[...document.querySelectorAll('[role=switch]')].some(e=>(e.innerText||'').trim()==='Act'&&e.getAttribute('aria-checked')==='true'))()`
  );
  return !!st;
}

/**
 * @param {{ sameWindow?: boolean }} opts
 * sameWindow=true (DEFAULT for continue): type into current chat — NO New Task.
 * sameWindow=false: only when user explicitly wants a clean slate (rare).
 */
export async function dispatchMission(cdp, missionId, opts = {}) {
  const sameWindow = opts.sameWindow !== false; // default: stay in same conversation
  const item = QUEUE.find((q) => q.id === missionId);
  if (!item) return { ok: false, err: "unknown_mission", missionId };
  const path = `${PROMPTS}/${item.file}`;
  if (!fs.existsSync(path)) return { ok: false, err: "missing_prompt", path };
  const PROMPT = fs.readFileSync(path, "utf8").trim();

  await scrollClineToBottom(cdp);
  await sleep(200);

  // If API-fail gate is up, Proceed first — never New Task thrash
  const gate = await clickProceedSameWindow(cdp);
  if (gate?.clicked) await sleep(1500);

  // SAME WINDOW law: do NOT click New Task / Start New Task
  if (!sameWindow) {
    await evalCline(
      cdp,
      `(()=>{
      for (const e of document.querySelectorAll('button,[aria-label]')){
        const a=((e.getAttribute('aria-label')||'')+(e.getAttribute('title')||'')+(e.innerText||'')).trim();
        if (/New Task|Start New Task/i.test(a) && a.length<40){ e.click(); return a.slice(0,40); }
      }
      return null;
    })()`
    );
    await sleep(900);
  }

  await forceAct(cdp);
  await sleep(200);

  // Collapse AA
  await evalCline(
    cdp,
    `(()=>{
    if(![...document.querySelectorAll('label,div')].some(e=>/^Read project files$/i.test((e.innerText||'').trim()))) return 0;
    for(const e of document.querySelectorAll('div,button,span')){
      const t=(e.innerText||'').replace(/\\s+/g,' ').trim();
      if(/^Auto-approve:/i.test(t)&&t.length<100){ e.click(); return 1; }
    }
    return 0;
  })()`
  );

  await evalCline(
    cdp,
    `(()=>{
    const ta=[...document.querySelectorAll('textarea')].filter(t=>t.getBoundingClientRect().width>100)
      .sort((a,b)=>b.getBoundingClientRect().y-a.getBoundingClientRect().y)[0];
    if(!ta) return 0;
    ta.focus(); ta.click();
    const d=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value');
    d.set.call(ta,'');
    ta.dispatchEvent(new Event('input',{bubbles:true}));
    d.set.call(ta, ${JSON.stringify(PROMPT)});
    ta.dispatchEvent(new Event('input',{bubbles:true}));
    ta.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste'}));
    return (ta.value||'').length;
  })()`
  );

  const len = await evalCline(
    cdp,
    `(()=>{
    const ta=[...document.querySelectorAll('textarea')].filter(t=>t.getBoundingClientRect().width>100)
      .sort((a,b)=>b.getBoundingClientRect().y-a.getBoundingClientRect().y)[0];
    return ta?(ta.value||'').length:0;
  })()`
  );
  if (!len || len < 40) {
    await evalCline(cdp, `(()=>{const ta=document.querySelector('textarea');if(ta){ta.focus();const d=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value');d.set.call(ta,'');ta.dispatchEvent(new Event('input',{bubbles:true}));}return 1;})()`);
    await cdp("Input.insertText", { text: PROMPT });
  }

  await evalCline(
    cdp,
    `(()=>{
    const ta=document.querySelector('textarea'); if(ta) ta.focus();
    for (const e of document.querySelectorAll('button,[aria-label]')){
      if (/^Send$/i.test(e.getAttribute('aria-label')||'') || /codicon-send/i.test((e.className||'').toString())){ e.click(); return 1; }
    }
    const icons=[...document.querySelectorAll('button')].filter(b=>{const r=b.getBoundingClientRect();return r.y>400&&r.width<50&&r.height<50;});
    if(icons.length){ icons[icons.length-1].click(); return 2; }
    return 0;
  })()`
  );
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await sleep(2500);
  await forceAct(cdp);

  const st = await readClineStatus(cdp);
  const result = {
    ok: !!(st?.thinking || st?.cancel || st?.running),
    missionId,
    file: item.file,
    promptLen: PROMPT.length,
    st,
    ts: new Date().toISOString(),
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/last_dispatch.json`, JSON.stringify(result, null, 2));
  fs.appendFileSync(
    `${OUT}/PROGRESSION_ORCH.log`,
    `${result.ts} DISPATCH ${missionId} ok=${result.ok} act=${st?.actOn} run=${st?.running} thinking=${st?.thinking}\n`
  );
  fs.appendFileSync(
    `${OUT}/PROGRESSION_LOG.md`,
    `\n### ${result.ts} — AUTO DISPATCH ${missionId}\n- ok=${result.ok} act=${st?.actOn} running=${st?.running}\n- next marker: ${item.marker}\n`
  );
  return result;
}

// CLI
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("orch_mission_dispatch.mjs") || process.argv[1].includes("orch_mission_dispatch"));

if (isMain) {
  const id = process.argv[2] || "E2_HARNESS_ACT";
  const nb = pickNotebook(await listAllowed());
  if (!nb) {
    console.error("NO_NB");
    process.exit(2);
  }
  await fetch(`http://127.0.0.1:${CDP_PORT}/json/activate/${nb.id}`).catch(() => {});
  const r = await withPage(nb, async (cdp) => dispatchMission(cdp, id));
  console.log(JSON.stringify(r, null, 2));
  process.exit(r?.ok ? 0 : 1);
}
