/**
 * 5h collab orch — Cline (kimi) + Kilo (Hy3) + Grok coordinator.
 * Auto-proceed same window, chevron scroll, decoy observe, no theatre.
 *
 *   node orch_5h_collab.mjs --hours 5 --interval 28
 */
import fs from "node:fs";
import { listAllowed, pickNotebook, withPage, CDP_PORT } from "./cdp_tab_guard.mjs";
import {
  readClineStatus,
  readKiloStatus,
  dispatchMission,
  dispatchKiloMission,
  nextMissionId,
  forceAct,
  evalCline,
  queueInfo,
  clickProceedSameWindow,
  frames,
} from "./orch_mission_dispatch.mjs";
import { scrollClineToBottom } from "./cline_scroll_bottom.mjs";

const OUT = "C:/Users/speci.000/Downloads/NEXUSlogs/_runs/GROK/20260719/vision";
const PROMPTS = "C:/Users/speci.000/Documents/NEXUS/scratch/prompts";
const LOG = `${OUT}/PROGRESSION_ORCH.log`;
const STATE = `${OUT}/PROGRESSION_STATE.json`;
const QUEUE_STATE = `${OUT}/MISSION_QUEUE_STATE.json`;
const PROG = `${OUT}/PROGRESSION_LOG.md`;
const OBS = `${OUT}/COLLAB_OBS.jsonl`;

const args = process.argv.slice(2);
const argNum = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 ? Number(args[i + 1]) || d : d;
};
const HOURS = argNum("--hours", 5);
const INTERVAL = (argNum("--interval", 28) || 28) * 1000;
const MAX = Math.ceil((HOURS * 3600 * 1000) / INTERVAL);

fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => {
  const line = [new Date().toISOString(), ...a.map((x) => (typeof x === "string" ? x : JSON.stringify(x)))].join(" ");
  console.log(line);
  try {
    fs.appendFileSync(LOG, line + "\n");
  } catch {}
};
const obs = (o) => {
  try {
    fs.appendFileSync(OBS, JSON.stringify({ ts: new Date().toISOString(), ...o }) + "\n");
  } catch {}
};

const CHAIN = [
  { id: "E8_DISK_TRUTH_ACT", marker: /E8_DISK_TRUTH_OK/ },
  { id: "E9_CASCADE_DRY_ACT", marker: /E9_CASCADE_DRY_OK/ },
  { id: "E10_PRODUCT_SPINE_ACT", marker: /E10_PRODUCT_SPINE_OK/ },
  { id: "E11_BENCH_SMOKE_ACT", marker: /E11_BENCH_SMOKE_OK/ },
  { id: "E12_GUARD_STUB_ACT", marker: /E12_GUARD_STUB_OK/ },
  { id: "E13_STABLE_REFRESH_ACT", marker: /E13_STABLE_REFRESH_OK/ },
  { id: "E14_KIMI_NEXT_PLAN_ACT", marker: /E14_NEXT_PLAN_OK/ },
];

function loadQ() {
  try {
    return JSON.parse(fs.readFileSync(QUEUE_STATE, "utf8"));
  } catch {
    return {};
  }
}
function saveQ(q) {
  fs.writeFileSync(QUEUE_STATE, JSON.stringify(q, null, 2));
}

function advanceFromMarkers(chatMarkers, diskMarkers, current, completed = []) {
  const all = [
    ...new Set([
      ...(chatMarkers || []),
      ...(diskMarkers || []),
      ...(completed || []),
    ]),
  ];
  const has = (re) => all.some((m) => re.test(String(m)));
  for (let i = 0; i < CHAIN.length; i++) {
    if (!has(CHAIN[i].marker)) return CHAIN[i].id;
  }
  return null;
}

// Seed post-reboot queue — preserve in-progress state; never wipe completed markers
const prior = loadQ();
const baseCompleted = Array.from(
  new Set([
    ...(prior.completed || []),
    "PHASE_B_OK",
    "STEP_2_OK",
    "GGUF_SMOKE_OK",
    "L0_BOUNCER_PLAN_OK",
    "STEP_5_OK",
    "POST_OOM_OK",
    "STABLE_OK",
  ])
);
const diskMarkers = Array.from(new Set([...(prior.diskMarkers || [])]));
const startCurrent =
  prior.current && /E(8|9|1[0-4])_/.test(prior.current)
    ? prior.current
    : advanceFromMarkers([], diskMarkers.concat(baseCompleted), null) || "E8_DISK_TRUTH_ACT";
const q0 = {
  current: startCurrent,
  completed: baseCompleted,
  lane: "E8_E14_5H_COLLAB",
  law: "auto_proceed_no_user_wait_0_theatre",
  agents: ["cline-kimi-k3", "kilo-hy3", "grok-orch"],
  lastDispatchTs: prior.lastDispatchTs || 0,
  dispatched: prior.dispatched || {},
  kiloLastTs: prior.kiloLastTs || 0,
  decoyLastTs: prior.decoyLastTs || 0,
  diskMarkers,
  ts: new Date().toISOString(),
};
saveQ(q0);

const COOLDOWN_MS = 75_000;
const KILO_EVERY_MS = 12 * 60_000;
const DECOY_EVERY_MS = 8 * 60_000;
let idleTicks = 0;
let lastKilo = 0;
let lastDecoy = 0;
let lastShot = 0;

async function ensureFullAA(cdp) {
  return evalCline(
    cdp,
    `(()=>{
    const t=(document.body?.innerText||'');
    if (/Read \\(all\\).*Edit \\(all\\).*All Commands/i.test(t) || /Auto-approve:.*All Commands/i.test(t.slice(-800))) return {full:true};
    for (const e of document.querySelectorAll('div,button,span')) {
      const lab=(e.innerText||'').replace(/\\s+/g,' ').trim();
      if (/^Auto-approve:/i.test(lab) && lab.length<120) { e.click(); break; }
    }
    let n=0;
    for (const lab of document.querySelectorAll('label,div,span')) {
      const s=(lab.innerText||'').replace(/\\s+/g,' ').trim();
      if (/^Read project files$|^Edit project files$|^Execute all commands$|^Use the browser$|^Use MCP servers$|^All commands$/i.test(s)) {
        const inp=lab.querySelector('input[type=checkbox]')||lab;
        try { inp.click(); n++; } catch {}
      }
    }
    for (const e of document.querySelectorAll('div,button,span')) {
      const lab=(e.innerText||'').replace(/\\s+/g,' ').trim();
      if (/^Auto-approve:/i.test(lab) && lab.length<140) { e.click(); break; }
    }
    return {toggled:n};
  })()`
  );
}

async function kickDecoy(cdp) {
  // Use shell in notebook via Cline one-shot is heavy; try code-server terminal focus is flaky.
  // Inject via Cline only if idle — otherwise just log observation request in obs.
  // Prefer Runtime.evaluate nothing; dispatch a tiny Cline shell mission inline is too heavy.
  // Terminal: send keys if xterm focused — best effort on page
  const r = await cdp("Runtime.evaluate", {
    returnByValue: true,
    expression: `(()=>{
      const t=(document.body?.innerText||'');
      return {
        metrics:/A100|显存|GPU/.test(t),
        snip:t.replace(/\\s+/g,' ').slice(0,160)
      };
    })()`,
  }).then((x) => x.result?.value).catch(() => null);
  return r;
}

function mergeCompleted(q, markers) {
  const set = new Set(q.completed || []);
  for (const m of markers || []) set.add(m);
  q.completed = [...set];
}

log("START 5h collab orch", {
  HOURS,
  INTERVAL: INTERVAL / 1000,
  MAX,
  queue: CHAIN.map((c) => c.id),
  agents: q0.agents,
});

for (let tick = 0; tick < MAX; tick++) {
  const t0 = Date.now();
  try {
    const pages = await listAllowed();
    // Prefer code-server (Cline+Kilo webviews) over bare inside shell
    let nb =
      pages.find(
        (p) =>
          p.type === "page" &&
          !String(p.title || "").startsWith("💤") &&
          (/code-server|Kilo Code/i.test(p.title || "") ||
            (/nb-253ef43e/i.test(p.url || "") && /\/code\//i.test(p.url || "")))
      ) ||
      pages.find(
        (p) =>
          p.type === "page" &&
          !String(p.title || "").startsWith("💤") &&
          /nb-253ef43e/i.test(p.url || "") &&
          /\/inside\//i.test(p.url || "")
      ) ||
      pickNotebook(pages);

    if (!nb) {
      log(`tick=${tick}`, "NO_NB");
      // try open inside
      await fetch(
        `http://127.0.0.1:${CDP_PORT}/json/new?` +
          encodeURIComponent(
            "https://discovery.intern-ai.org.cn/compute/dev-machine/inside/101/nb-253ef43eacdbe4e480503d693d5026ed"
          ),
        { method: "PUT" }
      ).catch(() => {});
      await sleep(INTERVAL);
      continue;
    }
    await fetch(`http://127.0.0.1:${CDP_PORT}/json/activate/${nb.id}`).catch(() => {});

    const snap = await withPage(nb, async (cdp) => {
      await cdp("Page.bringToFront").catch(() => {});
      await scrollClineToBottom(cdp).catch(() => {});
      let st = await readClineStatus(cdp);
      let kilo = await readKiloStatus(cdp);

      // Prefer agent that is visible; dual-lane: Cline OR Kilo
      if (st?.planOn || (st && !st?.actOn)) {
        await forceAct(cdp);
        await ensureFullAA(cdp);
        st = await readClineStatus(cdp);
      }

      if (st?.proceed || st?.invalidAPI) {
        const g = await clickProceedSameWindow(cdp);
        log(`tick=${tick}`, "PROCEED", g);
        await sleep(1800);
        st = await readClineStatus(cdp);
        idleTicks = 0;
        return { st, kilo, action: { type: "PROCEED", g }, q: loadQ() };
      }

      const q = loadQ();
      const clineRun = !!st?.cancel && !st?.proceed;
      const kiloRun = !!kilo?.cancel || (!!kilo?.running && !kilo?.done);
      if (clineRun || kiloRun) {
        idleTicks = 0;
        mergeCompleted(q, [...(st?.markers || []), ...(kilo?.markers || [])]);
        saveQ(q);
        if (Date.now() - lastShot > 180_000) {
          try {
            const shot = await cdp("Page.captureScreenshot", { format: "png", fromSurface: true });
            fs.writeFileSync(`${OUT}/collab_run_${tick}.png`, Buffer.from(shot.data, "base64"));
            lastShot = Date.now();
          } catch {}
        }
        return { st, kilo, action: "RUNNING", q, via: clineRun ? "cline" : "kilo" };
      }

      if (st?.taskCompleted || st?.startNew || st?.recentDone || kilo?.done || kilo?.newSess) {
        st = st ? { ...st, idle: true, running: false } : st;
      }
      idleTicks++;

      mergeCompleted(q, [...(st?.markers || []), ...(kilo?.markers || [])]);
      // E8 already green from Kilo session
      if ((kilo?.markers || []).some((m) => /E8_DISK_TRUTH_OK/.test(m))) {
        if (!q.diskMarkers) q.diskMarkers = [];
        if (!q.diskMarkers.includes("E8_DISK_TRUTH_OK")) q.diskMarkers.push("E8_DISK_TRUTH_OK");
        if (!q.completed.includes("E8_DISK_TRUTH_OK")) q.completed.push("E8_DISK_TRUTH_OK");
      }
      const target = advanceFromMarkers(
        [...(st?.markers || []), ...(kilo?.markers || [])],
        q.diskMarkers,
        q.current,
        q.completed
      );
      const now = Date.now();
      const cooled = now - (q.lastDispatchTs || 0) > COOLDOWN_MS;

      if (now - lastDecoy > DECOY_EVERY_MS) {
        const d = await kickDecoy(cdp);
        lastDecoy = now;
        q.decoyLastTs = now;
        obs({ type: "decoy_shell_metrics", d, tick });
        log(`tick=${tick}`, "DECOY_OBS", d);
      }

      // Periodic Kilo disk verify (separate from mission chain)
      if (now - lastKilo > KILO_EVERY_MS && target && idleTicks >= 2) {
        // skip separate verify while advancing missions; use mission dispatch instead
        lastKilo = now;
      }

      if (!target) {
        if (idleTicks >= 5 && cooled && now - (q.lastDispatchTs || 0) > 15 * 60_000) {
          log(`tick=${tick}`, "QUEUE_DONE_REPLAN_E14");
          let r = await dispatchKiloMission(cdp, "E14_KIMI_NEXT_PLAN_ACT");
          if (!r?.ok) r = await dispatchMission(cdp, "E14_KIMI_NEXT_PLAN_ACT", { sameWindow: true });
          q.current = "E14_KIMI_NEXT_PLAN_ACT";
          q.lastDispatchTs = now;
          saveQ(q);
          idleTicks = 0;
          return { st, kilo, action: { type: "REPLAN", r }, q };
        }
        saveQ(q);
        return { st, kilo, action: "QUEUE_DONE", q };
      }

      const idle =
        !clineRun &&
        !kiloRun &&
        (st?.idle ||
          st?.taskCompleted ||
          st?.recentDone ||
          st?.startNew ||
          kilo?.idle ||
          kilo?.done ||
          kilo?.newSess ||
          !st ||
          idleTicks >= 2);

      if (idle) {
        const already = q.dispatched?.[target] && now - q.dispatched[target] < COOLDOWN_MS;
        if (already && q.current === target && idleTicks < 5) {
          return { st, kilo, action: "COOLDOWN", q, target };
        }
        if (cooled || q.current !== target || idleTicks >= 2) {
          log(`tick=${tick}`, "DISPATCH", target, "kiloM=", (kilo?.markers || []).join(","), "clineM=", (st?.markers || []).join(","));
          // Prefer Kilo when Cline frame missing (common after reboot); also try Cline
          let r = null;
          let via = "kilo";
          if (kilo || !st) {
            r = await dispatchKiloMission(cdp, target);
            via = "kilo";
          }
          if (!r?.ok && st) {
            await ensureFullAA(cdp);
            await forceAct(cdp);
            r = await dispatchMission(cdp, target, { sameWindow: true });
            via = "cline";
            if (!r?.ok) r = await dispatchMission(cdp, target, { sameWindow: false });
          }
          if (!r?.ok && !kilo) {
            r = await dispatchKiloMission(cdp, target);
            via = "kilo";
          }
          q.current = target;
          q.lastDispatchTs = now;
          q.dispatched = q.dispatched || {};
          q.dispatched[target] = now;
          if (r?.ok) idleTicks = 0;
          saveQ(q);
          fs.appendFileSync(
            PROG,
            `\n### ${new Date().toISOString()} COLLAB ${via} ${target}\n- ok=${r?.ok}\n- kilo=${(kilo?.markers || []).join(",")}\n`
          );
          return {
            st: await readClineStatus(cdp),
            kilo: await readKiloStatus(cdp),
            action: { type: "DISPATCH", target, r, via },
            q,
          };
        }
      }

      if (idleTicks >= 5 && cooled) {
        const g = await clickProceedSameWindow(cdp);
        if (g?.clicked) {
          idleTicks = 0;
          return { st: await readClineStatus(cdp), kilo, action: { type: "STUCK_PROCEED", g }, q };
        }
        let r = await dispatchKiloMission(cdp, target);
        if (!r?.ok) r = await dispatchMission(cdp, target, { sameWindow: true });
        q.current = target;
        q.lastDispatchTs = now;
        q.dispatched = q.dispatched || {};
        q.dispatched[target] = now;
        saveQ(q);
        idleTicks = 0;
        return { st, kilo, action: { type: "STUCK_DISPATCH", target, r }, q };
      }

      saveQ(q);
      return { st, kilo, action: "WATCH", q, idleTicks, target };
    });

    const st = snap?.st || {};
    const kilo = snap?.kilo || {};
    const state = {
      ts: new Date().toISOString(),
      tick,
      collab5h: true,
      hours: HOURS,
      idleTicks,
      current: snap?.q?.current,
      action: snap?.action,
      actOn: st.actOn,
      running: !!(st.running || st.cancel || kilo.running || kilo.cancel),
      idle: st.idle || kilo.idle,
      taskCompleted: st.taskCompleted || kilo.done,
      markers: [...new Set([...(st.markers || []), ...(kilo.markers || [])])],
      model: st.model || kilo.model,
      tail: (st.tail || kilo.tail || "").slice(-160),
    };
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
    log(
      `tick=${tick}`,
      `cur=${state.current}`,
      `run=${!!state.running}`,
      `idle=${!!state.idle}`,
      `done=${!!state.taskCompleted}`,
      `m=${(state.markers || []).join(",") || "-"}`,
      `actn=${typeof snap?.action === "object" ? snap.action.type + ":" + (snap.action.target || "") + (snap.action.via ? "@" + snap.action.via : "") : snap?.action}`
    );
    obs({ type: "tick", ...state });
  } catch (e) {
    log(`tick=${tick}`, "EX", String(e.message || e));
    obs({ type: "ex", tick, err: String(e.message || e) });
  }
  const wait = Math.max(6000, INTERVAL - (Date.now() - t0));
  await sleep(wait);
}

log("END 5h collab orch");
fs.appendFileSync(PROG, `\n### ${new Date().toISOString()} — COLLAB_5H_END\n`);
