// Modo director: la pantalla pública, pensada para dejarse puesta y transmitirse.
// La cámara se dirige sola; nadie toca nada. Solo lectura.

import {
  rest, TILE, PAL, famOf, PUBLIC_SOCIETY, newWorld, loadWorld, applyBubble,
  makeCanvas, drawWorld, cdmxClock,
} from "./core.js?v=2";
import { L, t, supports, applyStatic, mountSwitcher } from "./i18n.js?v=1";

const POLL_MS = 5000;
const SCENE_MS = 14000;      // cada plano dura ~14 s
const SOCIETY_MS = 150000;   // cada sociedad se muestra ~2.5 min

// Preguntas abiertas que rotan (en el idioma elegido). Deliberadamente en
// forma interrogativa: el observatorio muestra datos crudos, no afirmaciones.
const QUESTIONS = L.questions;

const $ = (id) => document.getElementById(id);
const state = {
  societies: [], idx: 0, W: newWorld(), expId: null,
  cam: { x: 0, y: 0, zoom: 1, tx: 0, ty: 0, tzoom: 1 },
  shot: 0, nextShot: 0, nextSociety: Infinity, focus: null,
  milestones: [], seenMs: new Set(), qIdx: 0,
  lastT: null, manualUntil: 0, prevStock: null, stockTrend: "trend_flat",
};

// ---------- selección de sociedades ----------
async function refreshSocieties() {
  const rows = await rest(
    "v2_experiments?select=id,name,status,current_tick,max_ticks,arm,coupling,seed,models&order=started_at.desc&limit=30");
  const active = rows.filter(r => r.status === "active" && r.current_tick > 0);
  // Prioriza las multi-familia (más vistosas) sin excluir a las demás.
  active.sort((a, b) => (b.models?.length ?? 0) - (a.models?.length ?? 0));
  state.societies = active.length ? active : rows.slice(0, 3);
  if (!state.expId && state.societies.length) await switchTo(0);
}

async function switchTo(i) {
  if (!state.societies.length) return;
  state.idx = ((i % state.societies.length) + state.societies.length) % state.societies.length;
  const s = state.societies[state.idx];
  state.expId = s.id;
  state.W = newWorld();
  state.focus = null;
  state.nextSociety = performance.now() + SOCIETY_MS;
  await poll();
  frameWide();
}

// ---------- planos ----------
function frameWide() { state.cam.tx = 0; state.cam.ty = 0; state.cam.tzoom = fitZoom(); }
function fitZoom() {
  const r = document.getElementById("stage").getBoundingClientRect();
  // Llena la pantalla: el mundo mide 17x17 casillas, pero encuadrar ~11 de alto
  // deja la plaza y el pozo dominando el plano, que es lo que se quiere ver.
  return Math.max(0.6, Math.min(2.2, Math.min(r.width / (15 * TILE), r.height / (10.5 * TILE))));
}
function frameWell() { state.cam.tx = 0; state.cam.ty = 0; state.cam.tzoom = fitZoom() * 1.9; }
function frameAgent(a) {
  if (!a) return frameWide();
  state.focus = a.id;
  state.cam.tx = a.vx; state.cam.ty = a.vy - 0.3;
  state.cam.tzoom = Math.min(2.6, fitZoom() * 2.2);
}
function mostActive() {
  const list = [...state.W.agents.values()].filter(a => a.alive);
  if (!list.length) return null;
  return list.reduce((best, a) => (a.lastActive > (best?.lastActive ?? -1) ? a : best), null);
}
function talker() {
  const list = [...state.W.agents.values()].filter(a => a.bubble?.text);
  return list.length ? list[Math.floor(state.shot) % list.length] : null;
}
function richest() {
  const list = [...state.W.agents.values()];
  return list.length ? list.reduce((b, a) => (a.holdings > (b?.holdings ?? -1) ? a : b), null) : null;
}

function directCamera(now) {
  if (now < state.manualUntil) return;
  if (now < state.nextShot) return;
  state.nextShot = now + SCENE_MS;
  state.shot++;
  const pick = state.shot % 5;
  if (pick === 0) { state.focus = null; frameWide(); }
  else if (pick === 1) { state.focus = null; frameWell(); }
  else if (pick === 2) frameAgent(talker() ?? mostActive());
  else if (pick === 3) frameAgent(mostActive());
  else frameAgent(richest());
}

// ---------- hitos del laboratorio ----------
// n llega ya escapado y envuelto en <b>; el resto se escapa al renderizar.
const MS_KIND = {
  say_public: (p, n) => [t("ms_spoke", { n }), String(p.message ?? "").slice(0, 120), true],
  propose_decision: (p, n) => [t("ms_proposed", { n }), p.quota_per_tick != null ? t("ms_quota_of", { q: p.quota_per_tick }) : "", false],
  gift: (p, n) => [t("ms_gift", { n, amt: p.amount ?? "?" }), t("ms_gift_to", { t: p.target_agent ?? "?" }), false],
  consult_theory: (p, n) => [t("ms_consult", { n }), `«${p.handle ?? ""}»`, false],
  teach: (p, n) => [t("ms_teach", { n, t: escapeHtml(String(p.target_agent ?? "?")) }), String(p.content ?? "").slice(0, 100), false],
};

async function refreshMilestones() {
  const [acts, exps] = await Promise.all([
    rest("v2_actions?select=id,tick,action_type,payload,agent_id,experiment_id,created_at&success=eq.true&decision_status=eq.ok" +
         "&action_type=in.(say_public,propose_decision,gift,consult_theory,teach,endorse)&order=created_at.desc&limit=60"),
    rest("v2_experiments?select=id,name&order=started_at.desc&limit=30"),
  ]);
  const expName = new Map(exps.map(e => [e.id, e.name]));
  const needAgents = [...new Set(acts.map(a => a.agent_id))].slice(0, 60);
  let names = new Map();
  if (needAgents.length) {
    const ags = await rest(`v2_agents?id=in.(${needAgents.join(",")})&select=id,name,model`);
    names = new Map(ags.map(a => [a.id, { name: a.name, fam: famOf(a.model) }]));
  }
  const out = [];
  for (const a of acts) {
    const who = names.get(a.agent_id);
    if (!who) continue;
    const p = a.payload ?? {};
    let entry = null;
    if (a.action_type === "endorse" && p.quota_enacted) {
      entry = [`<b>${t("law_enacted_head", { who: escapeHtml(who.name) })}</b>`, t("law_enacted_body"), true];
    } else if (MS_KIND[a.action_type]) {
      entry = MS_KIND[a.action_type](p, `<b>${escapeHtml(`${who.name} · ${who.fam}`)}</b>`);
    }
    if (!entry) continue;
    const rawName = expName.get(a.experiment_id) ?? "";
    const pub = PUBLIC_SOCIETY[rawName];
    out.push({
      id: a.id, head: entry[0], body: entry[1], big: entry[2],
      when: `${pub?.name ?? rawName ?? "?"} · tick ${a.tick}`,
    });
    if (out.length >= 8) break;
  }
  state.milestones = out;
  renderMilestones();
}

function renderMilestones() {
  const ul = $("milestones");
  if (!state.milestones.length) { ul.innerHTML = `<li class="ms-empty">${escapeHtml(t("listening"))}</li>`; return; }
  ul.innerHTML = state.milestones.map(m =>
    `<li class="${m.big ? "big" : ""}">${m.head}${m.body ? `<br>${escapeHtml(m.body)}` : ""}` +
    `<span class="ms-when">${escapeHtml(m.when)}</span></li>`).join("");
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- datos de la sociedad en foco ----------
async function poll() {
  if (!state.expId) return;
  try {
    const fresh = await loadWorld(state.W, state.expId, { actionLimit: 30 });
    for (const x of fresh) { state.W.seen.add(x.id); applyBubble(state.W, x); }
    renderSociety();
    renderSubtitle(fresh);
    refreshDebate().catch(() => {});
    updateFollowMini();
    $("liveDot").classList.remove("off");
    $("liveLabel").textContent = t("live");
  } catch {
    $("liveDot").classList.add("off");
    $("liveLabel").textContent = t("reconnecting");
  }
}

function renderSociety() {
  const e = state.W.exp, c = state.W.commons;
  if (!e) return;
  const pub = PUBLIC_SOCIETY[e.name];
  $("socName").textContent = pub?.name ?? e.name;
  $("eraChip").hidden = !pub?.era;
  if (pub?.era) $("eraChip").textContent = t("era_chip");
  const fams = [...new Set((e.models ?? []).map(famOf))];
  const sub = pub
    ? t(pub.subKey)
    : fams.length > 2
      ? t("soc_families", { n: fams.length, seed: e.seed })
      : `${fams.join(" + ")} · ${e.coupling === "binding" ? t("rules_bind") : t("rules_nobind")}`;
  // El nombre técnico queda visible en pequeño: la procedencia nunca se oculta.
  $("socSub").innerHTML = `${escapeHtml(sub)}<span class="soc-tech">${escapeHtml(e.name)} · seed ${escapeHtml(String(e.seed))}</span>`;
  $("stTick").textContent = pub ? `${e.current_tick}` : `${e.current_tick}${e.max_ticks ? `/${e.max_ticks}` : ""}`;
  $("stWell").textContent = c ? `${Math.round(c.stock)}/${Math.round(c.capacity)}` : "—";
  $("stQuota").textContent = c ? (c.quota_per_tick == null ? "—" : `${+c.quota_per_tick}`) : "—";
  const alive = [...state.W.agents.values()].filter(a => a.alive).length;
  $("stAgents").textContent = `${alive}`;
  $("famLegend").innerHTML = fams.map(f =>
    `<span><i style="background:${PAL[f] ?? PAL.otro}"></i>${escapeHtml(f)}</span>`).join("");
}

// ---------- subtítulos: lo último dicho en público ----------
let subUntil = 0;
function renderSubtitle(fresh) {
  const speech = fresh.filter(x => x.success &&
    ["say_public", "reply_to", "address"].includes(x.action_type) && x.payload?.message);
  const last = speech[speech.length - 1];
  const el = $("subtitle");
  if (last) {
    const ag = state.W.agents.get(last.agent_id);
    const kind = L.kind[last.action_type] ?? last.action_type;
    $("subWho").textContent = ag ? `${ag.name} · ${ag.fam} · ${kind}` : kind;
    $("subText").textContent = String(last.payload.message).slice(0, 220);
    el.hidden = false;
    subUntil = performance.now() + 18000;
  } else if (performance.now() > subUntil) {
    el.hidden = true;
  }
}

// ---------- ¿qué se está decidiendo? (mecánico, en el idioma elegido) ----------
async function refreshDebate() {
  const c = state.W.commons;
  if (c) {
    $("dLaw").textContent = c.quota_per_tick == null
      ? t("quota_none")
      : t("quota_law", { q: +c.quota_per_tick }) +
        (c.quota_set_tick != null ? t("quota_since", { t: c.quota_set_tick }) : "");
    const stock = Number(c.stock);
    if (state.prevStock != null && stock !== state.prevStock) {
      state.stockTrend = stock > state.prevStock ? "trend_up" : "trend_down";
    }
    state.prevStock = stock;
    const pct = Math.round(100 * stock / Number(c.capacity));
    $("dWell").textContent = t("well_pct", { pct, trend: t(state.stockTrend) });
  }
  if (!state.expId) return;
  const turns = await rest(
    `v2_turns?experiment_id=eq.${state.expId}&action_kind=in.(propose_decision,endorse)` +
    `&select=id,speaker_id,action_kind,claim,references_turn&order=id.desc&limit=60`);
  const endos = new Map();
  for (const tn of turns) if (tn.action_kind === "endorse" && tn.references_turn)
    endos.set(tn.references_turn, (endos.get(tn.references_turn) ?? 0) + 1);
  const lastProp = turns.find(tn => tn.action_kind === "propose_decision");
  if (!lastProp) { $("dProposal").textContent = t("nothing_now"); return; }
  let quota = null;
  try { quota = JSON.parse(lastProp.claim ?? "{}").quota_per_tick; } catch { /* claim libre */ }
  const who = state.W.agents.get(lastProp.speaker_id);
  const apoyos = endos.get(lastProp.id) ?? 0;
  const cur = state.W.commons?.quota_per_tick;
  let key = "wants_set";
  if (quota != null && cur != null) key = quota > +cur ? "wants_raise" : quota < +cur ? "wants_lower" : "wants_keep";
  $("dProposal").textContent = quota == null
    ? `${t("proposed_rule", { who: who?.name ?? "?" })} · ${supports(apoyos)}`
    : `${t(key, { who: who?.name ?? "?", fam: who?.fam ?? "?", q: quota })} · ${supports(apoyos)}`;
}

// ---------- clic para seguir a un habitante ----------
function updateFollowMini() {
  const card = $("followMini");
  const a = state.focus ? state.W.agents.get(state.focus) : null;
  if (!a || performance.now() > state.manualUntil) { card.hidden = true; return; }
  card.hidden = false;
  $("fmName").textContent = a.name;
  $("fmSub").textContent = t("fm_sub", { fam: a.fam, trait: a.trait, n: Math.round(a.holdings) });
  $("fmThought").textContent = a.thought ? `“${a.thought}”` : "…";
}

// ---------- bucle ----------
const canvas = $("stage");
const { ctx, S } = makeCanvas(canvas);

// El bucle no puede depender solo de requestAnimationFrame: los navegadores lo
// congelan en pestañas ocultas o en segundo plano, y esta pantalla está pensada
// para transmitirse 24/7 desde un navegador sin ventana visible. Se usa rAF
// cuando el compositor lo permite y un temporizador de respaldo cuando no.
let lastFrame = 0;
function startLoop() {
  const tick = () => { frame(performance.now()); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  setInterval(() => {
    const now = performance.now();
    if (now - lastFrame > 120) frame(now);   // rAF congelado: dibujamos igual
  }, 1000 / 24);
}

function frame(now) {
  lastFrame = now;
  try {
  directCamera(now);
  if (now > state.nextSociety && state.societies.length > 1) switchTo(state.idx + 1);
  const f = state.focus ? state.W.agents.get(state.focus) : null;
  if (f) { state.cam.tx = f.vx; state.cam.ty = f.vy - 0.3; }
  state.cam.zoom += (state.cam.tzoom - state.cam.zoom) * 0.035;
  state.cam.x += (state.cam.tx - state.cam.x) * 0.035;
  state.cam.y += (state.cam.ty - state.cam.y) * 0.035;
  state.lastT = drawWorld(ctx, S, state.W, state.cam, now, { highlight: state.focus, maxBubbles: 5 });
  } catch (e) { console.error(e); }
}

function rotateQuestion() {
  $("qText").textContent = QUESTIONS[state.qIdx % QUESTIONS.length];
  state.qIdx++;
}

// assets opcionales: se muestran solo si existen
for (const [id, el] of [["uniLogo", $("uniLogo")], ["avatar", $("avatar")]]) {
  el.addEventListener("load", () => { el.hidden = false; });
  el.addEventListener("error", () => { el.remove(); });
  if (el.complete && el.naturalWidth) el.hidden = false;
}

(async function main() {
  // Idioma: rótulos estáticos + conmutador ES · PT · EN.
  applyStatic();
  mountSwitcher($("langSwitch"));

  // Bienvenida en la primera visita; re-abrible desde "¿qué estoy viendo?".
  const welcome = $("welcome");
  const openWelcome = () => { welcome.hidden = false; };
  const closeWelcome = () => { welcome.hidden = true; localStorage.setItem("aisl_welcomed", "1"); };
  if (!localStorage.getItem("aisl_welcomed")) openWelcome();
  $("wEnter").addEventListener("click", closeWelcome);
  welcome.addEventListener("click", (e) => { if (e.target === welcome) closeWelcome(); });
  $("whatLink").addEventListener("click", (e) => { e.preventDefault(); openWelcome(); });

  $("cdmxTime").textContent = cdmxClock();
  setInterval(() => { $("cdmxTime").textContent = cdmxClock(); }, 10000);
  rotateQuestion(); setInterval(rotateQuestion, 22000);
  try { await refreshSocieties(); await refreshMilestones(); } catch (e) { console.error(e); }
  setInterval(() => poll().catch(() => {}), POLL_MS);
  setInterval(() => refreshMilestones().catch(() => {}), 20000);
  setInterval(() => refreshSocieties().catch(() => {}), 120000);
  canvas.addEventListener("pointerdown", (e) => {
    if (!state.lastT) return;
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = null, bd = 34 * state.cam.zoom;
    for (const a of state.W.agents.values()) {
      const d = Math.hypot(state.lastT.sx(a.vx) - mx, state.lastT.sy(a.vy) - 10 * state.cam.zoom - my);
      if (d < bd) { bd = d; best = a; }
    }
    if (best) {
      state.manualUntil = performance.now() + 75000;
      frameAgent(best);
      updateFollowMini();
    }
  });
  $("fmClose").addEventListener("click", () => {
    state.manualUntil = 0; state.focus = null;
    $("followMini").hidden = true;
    frameWide();
  });
  state.cam.tzoom = fitZoom(); state.cam.zoom = fitZoom();
  startLoop();
})();
