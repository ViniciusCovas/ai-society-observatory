// Modo director: la pantalla pública, pensada para dejarse puesta y transmitirse.
// La cámara se dirige sola; nadie toca nada. Solo lectura.

import {
  rest, TILE, PAL, famOf, KIND_ES, newWorld, loadWorld, applyBubble,
  makeCanvas, drawWorld, cdmxClock,
} from "./core.js?v=1";

const POLL_MS = 5000;
const SCENE_MS = 14000;      // cada plano dura ~14 s
const SOCIETY_MS = 150000;   // cada sociedad se muestra ~2.5 min

// Preguntas abiertas que rotan. Deliberadamente en forma interrogativa:
// el observatorio muestra datos crudos, no afirmaciones.
const QUESTIONS = [
  "¿Puede un grupo de agentes de IA, sin objetivos ni instrucciones morales, inventar una regla colectiva sobre un recurso compartido — y sostenerla?",
  "¿Hablar tiene que tener consecuencia material para que se abra una esfera pública? Es la variable que este experimento manipula.",
  "Cuando conviven ocho familias de modelos distintas, ¿se agrupan por origen o se reparten oficios? Los datos preliminares apuntan a lo segundo.",
  "¿Una desigualdad que respeta la ley sigue siendo un problema para la sociedad que la produjo?",
  "¿Cuánto dura una institución que nadie escribió? Sin memoria persistente, solo sobrevive lo que se repite en voz alta.",
  "Si dos agentes del mismo modelo reciben rasgos distintos, ¿viven vidas distintas? Algunas arquitecturas sí; otras ignoran el rasgo.",
];

const $ = (id) => document.getElementById(id);
const state = {
  societies: [], idx: 0, W: newWorld(), expId: null,
  cam: { x: 0, y: 0, zoom: 1, tx: 0, ty: 0, tzoom: 1 },
  shot: 0, nextShot: 0, nextSociety: Infinity, focus: null,
  milestones: [], seenMs: new Set(), qIdx: 0,
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
const MS_KIND = {
  say_public: (p, n) => [`<b>${n}</b> habló en público`, String(p.message ?? "").slice(0, 120), true],
  propose_decision: (p, n) => [`<b>${n}</b> propuso una regla`, p.quota_per_tick != null ? `cuota de ${p.quota_per_tick} por tick` : "", false],
  gift: (p, n) => [`<b>${n}</b> regaló ${p.amount ?? "?"}`, `a ${p.target_agent ?? "?"}`, false],
  consult_theory: (p, n) => [`<b>${n}</b> consultó la biblioteca`, `«${p.handle ?? ""}»`, false],
  teach: (p, n) => [`<b>${n}</b> enseñó a ${p.target_agent ?? "?"}`, String(p.content ?? "").slice(0, 100), false],
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
      entry = [`<b>ley promulgada</b> — el endoso de ${who.name} alcanzó el quorum`, "la cuota pasa a ser vinculante", true];
    } else if (MS_KIND[a.action_type]) {
      entry = MS_KIND[a.action_type](p, `${who.name} · ${who.fam}`);
    }
    if (!entry) continue;
    out.push({
      id: a.id, head: entry[0], body: entry[1], big: entry[2],
      when: `${expName.get(a.experiment_id) ?? "sociedad"} · tick ${a.tick}`,
    });
    if (out.length >= 8) break;
  }
  state.milestones = out;
  renderMilestones();
}

function renderMilestones() {
  const ul = $("milestones");
  if (!state.milestones.length) { ul.innerHTML = '<li class="ms-empty">escuchando…</li>'; return; }
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
    $("liveDot").classList.remove("off");
    $("liveLabel").textContent = "en vivo";
  } catch {
    $("liveDot").classList.add("off");
    $("liveLabel").textContent = "reconectando";
  }
}

function renderSociety() {
  const e = state.W.exp, c = state.W.commons;
  if (!e) return;
  $("socName").textContent = e.name;
  const fams = [...new Set((e.models ?? []).map(famOf))];
  $("socSub").textContent = fams.length > 2
    ? `${fams.length} familias de modelos conviviendo · semilla ${e.seed}`
    : `${fams.join(" + ")} · semilla ${e.seed} · ${e.coupling === "binding" ? "las reglas obligan" : "las reglas no obligan"}`;
  $("stTick").textContent = `${e.current_tick}${e.max_ticks ? `/${e.max_ticks}` : ""}`;
  $("stWell").textContent = c ? `${Math.round(c.stock)}/${Math.round(c.capacity)}` : "—";
  $("stQuota").textContent = c ? (c.quota_per_tick == null ? "sin acordar" : `${+c.quota_per_tick}`) : "—";
  const alive = [...state.W.agents.values()].filter(a => a.alive).length;
  $("stAgents").textContent = `${alive}`;
  $("famLegend").innerHTML = fams.map(f =>
    `<span><i style="background:${PAL[f] ?? PAL.otro}"></i>${escapeHtml(f)}</span>`).join("");
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
  drawWorld(ctx, S, state.W, state.cam, now, { highlight: state.focus, maxBubbles: 6 });
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
  $("cdmxTime").textContent = cdmxClock();
  setInterval(() => { $("cdmxTime").textContent = cdmxClock(); }, 10000);
  rotateQuestion(); setInterval(rotateQuestion, 22000);
  try { await refreshSocieties(); await refreshMilestones(); } catch (e) { console.error(e); }
  setInterval(() => poll().catch(() => {}), POLL_MS);
  setInterval(() => refreshMilestones().catch(() => {}), 20000);
  setInterval(() => refreshSocieties().catch(() => {}), 120000);
  state.cam.tzoom = fitZoom(); state.cam.zoom = fitZoom();
  startLoop();
})();
