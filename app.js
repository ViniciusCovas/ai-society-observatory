// AI Society Lab — Observatorio en vivo.
// Solo lectura: consulta la API pública (clave anon) y dibuja. No puede escribir.

const SUPABASE_URL = "https://rxjwoigrzudcttnjaaul.supabase.co";
const ANON_KEY = "sb_publishable_hLFAPII9PUqvcnvxzQMdiA_SC9PfyzC";
const POLL_MS = 4000;

async function rest(pathQ) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${pathQ}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!r.ok) throw new Error(`${r.status} ${pathQ}`);
  return r.json();
}

// ---------- estado ----------
const S = {
  exps: [], expId: null, exp: null, commons: null,
  agents: new Map(),          // id -> {name,fam,gx,gy,x,y,holdings,alive,bubble,phase}
  seenActions: new Set(), feedIds: new Set(),
  online: false, lastTick: 0,
};

const FAM = (model) => model.includes("gemini") ? "gem" : "gpt";
const COL = { gem: "#3d8bde", gpt: "#f07a3e" };
const ICON = {
  say_public: "📣", address: "🗣", reply_to: "↩", propose_decision: "📜", endorse: "🤝",
  talk_to: "💬", gift: "🎁", teach: "📖", consult_theory: "📚",
  gather: "💧", move_to: "🧭", eat: "🍽", rest: "😴", reflect: "💭",
};
const KIND_ES = {
  say_public: "habló en público", propose_decision: "propuso una regla", endorse: "endosó",
  talk_to: "habló en privado", reply_to: "respondió", address: "se dirigió a",
  gather: "extrajo del pozo", gift: "regaló", teach: "enseñó", consult_theory: "consultó teoría",
  move_to: "se movió", reflect: "reflexionó", rest: "descansó", eat: "comió",
};

// ---------- datos ----------
async function loadExperiments() {
  S.exps = await rest("v2_experiments?select=id,name,status,current_tick,max_ticks,started_at&order=started_at.desc&limit=20");
  const sel = document.getElementById("expSelect");
  sel.innerHTML = S.exps.map(e =>
    `<option value="${e.id}">${e.name} · ${e.status}</option>`).join("");
  if (!S.expId && S.exps.length) S.expId = (S.exps.find(e => e.status === "active") ?? S.exps[0]).id;
  sel.value = S.expId ?? "";
}

async function poll() {
  if (!S.expId) return;
  const id = S.expId;
  const [exps, commons, agents, actions] = await Promise.all([
    rest(`v2_experiments?id=eq.${id}&select=*`),
    rest(`v2_commons?experiment_id=eq.${id}&select=*`),
    rest(`v2_agents?experiment_id=eq.${id}&select=id,name,model,alive,v2_agent_state(x,y,holdings,last_action)`),
    rest(`v2_actions?experiment_id=eq.${id}&select=id,tick,action_type,payload,success,decision_status,agent_id,created_at&order=created_at.desc&limit=40`),
  ]);
  S.exp = exps[0] ?? null;
  S.commons = commons[0] ?? null;

  for (const a of agents) {
    const st = a.v2_agent_state ?? {};
    let ag = S.agents.get(a.id);
    if (!ag) {
      ag = { id: a.id, name: a.name, fam: FAM(a.model), x: st.x ?? 0, y: st.y ?? 0,
             gx: st.x ?? 0, gy: st.y ?? 0, holdings: 0, alive: a.alive,
             bubble: null, phase: Math.random() * Math.PI * 2 };
      S.agents.set(a.id, ag);
    }
    ag.gx = st.x ?? ag.gx; ag.gy = st.y ?? ag.gy;
    ag.holdings = Number(st.holdings ?? 0); ag.alive = a.alive;
  }

  const fresh = actions.filter(x => !S.seenActions.has(x.id)).reverse();
  for (const x of fresh) {
    S.seenActions.add(x.id);
    const ag = S.agents.get(x.agent_id);
    if (ag && x.success && ICON[x.action_type]) {
      ag.bubble = { icon: ICON[x.action_type], until: performance.now() + 6500 };
    }
    pushFeed(x);
  }

  updateHud();
  S.online = true; S.lastTick = Date.now();
  document.getElementById("liveDot").classList.add("on");
}

function agentName(id) { return S.agents.get(id)?.name ?? "¿?"; }
function agentFam(id) { return S.agents.get(id)?.fam ?? "gem"; }

function pushFeed(x) {
  if (S.feedIds.has(x.id)) return;
  if (!x.success && x.decision_status !== "ok") return;
  const p = x.payload ?? {};
  let body = "", milestone = false;
  switch (x.action_type) {
    case "say_public": body = p.message ?? ""; milestone = true; break;
    case "propose_decision":
      body = (p.proposal ?? "") + (p.quota_per_tick != null ? ` (cuota: ${p.quota_per_tick})` : "");
      break;
    case "endorse":
      body = p.quota_enacted ? "…y con ese endoso la cuota quedó VINCULANTE" : "apoyó una propuesta";
      milestone = !!p.quota_enacted; break;
    case "talk_to": body = `a ${p.target_agent ?? "?"}: ${p.message ?? ""}`; break;
    case "reply_to": case "address": body = p.message ?? ""; break;
    case "gather": body = p.granted != null ? `obtuvo ${p.granted}${p.refused_reason ? ` (${p.refused_reason})` : ""}` : ""; break;
    case "gift": body = `${p.amount ?? "?"} a ${p.target_agent ?? "?"}`; break;
    case "teach": body = `a ${p.target_agent ?? "?"}: ${p.content ?? ""}`; break;
    case "consult_theory": body = `«${p.handle ?? ""}»`; break;
    default: return;
  }
  if (!x.success && !milestone) return;
  S.feedIds.add(x.id);
  const el = document.createElement("div");
  el.className = "evt" + (milestone ? " milestone" : "");
  el.innerHTML =
    `<div class="evt-head"><span>${ICON[x.action_type] ?? ""}</span>` +
    `<span class="evt-agent ${agentFam(x.agent_id)}">${agentName(x.agent_id)}</span>` +
    `<span class="evt-kind">${KIND_ES[x.action_type] ?? x.action_type}</span>` +
    `<span class="evt-tick">t${x.tick}</span></div>` +
    (body ? `<div class="evt-body"></div>` : "");
  if (body) el.querySelector(".evt-body").textContent = body.slice(0, 220);
  const feed = document.getElementById("feed");
  feed.prepend(el);
  while (feed.children.length > 60) feed.lastChild.remove();
}

function updateHud() {
  const e = S.exp, c = S.commons;
  document.getElementById("hudTick").textContent =
    e ? `${e.current_tick}${e.max_ticks ? " / " + e.max_ticks : ""}` : "—";
  if (c) {
    const pct = Math.max(0, Math.min(100, (Number(c.stock) / Number(c.capacity)) * 100));
    document.getElementById("wellFill").style.width = pct + "%";
    document.getElementById("hudWell").textContent = `${Math.round(c.stock)} / ${Math.round(c.capacity)}`;
    document.getElementById("hudQuota").textContent =
      c.quota_per_tick == null ? "sin acordar" : `${Number(c.quota_per_tick)} / tick`;
  }
  const alive = [...S.agents.values()].filter(a => a.alive).length;
  document.getElementById("hudAlive").textContent = `${alive} / ${S.agents.size || "—"}`;
}

// ---------- luz de Ciudad de México ----------
function cdmxHour() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Mexico_City", hour: "numeric", minute: "numeric", hour12: false,
  }).formatToParts(new Date());
  const h = +parts.find(p => p.type === "hour").value;
  const m = +parts.find(p => p.type === "minute").value;
  return h + m / 60;
}
function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
function mix(a, b, t) {
  const A = hex(a), B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`;
}
// paradas: [hora, cieloAlto, cieloBajo, suelo, aguaClara]
const LIGHT = [
  [0.0, "#1a2340", "#2b3660", "#5c5a6e", "#3a6a8a"],
  [5.5, "#1a2340", "#2b3660", "#5c5a6e", "#3a6a8a"],
  [6.5, "#5a4a7a", "#e8927c", "#a3907e", "#5a90ac"],
  [8.0, "#8fc3e8", "#d9ecf6", "#e5d8bb", "#4a9ec4"],
  [13.0, "#6fb1e4", "#cfe8f5", "#ecdfc2", "#4a9ec4"],
  [17.5, "#7ea6d8", "#f0c98e", "#e8d5ae", "#4a94b8"],
  [19.0, "#4a3f6e", "#e07a5a", "#a08668", "#4a7a9a"],
  [20.5, "#20294a", "#3a4470", "#635f70", "#3a6a8a"],
  [24.0, "#1a2340", "#2b3660", "#5c5a6e", "#3a6a8a"],
];
function lightAt(t) {
  let i = 0;
  while (i < LIGHT.length - 2 && LIGHT[i + 1][0] < t) i++;
  const [t0, ...c0] = LIGHT[i], [t1, ...c1] = LIGHT[i + 1];
  const k = Math.max(0, Math.min(1, (t - t0) / (t1 - t0 || 1)));
  return c0.map((c, j) => mix(c, c1[j], k));
}
const isNight = (t) => t < 6.2 || t > 19.8;

// ---------- render isométrico ----------
const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
let W = 0, H = 0, DPR = 1;

function resize() {
  DPR = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  W = r.width; H = r.height;
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
new ResizeObserver(resize).observe(canvas);

function draw(now) {
  requestAnimationFrame(draw);
  if (!W) resize();
  const t = cdmxHour();
  const [skyTop, skyBot, groundC, waterC] = lightAt(t);
  const night = isNight(t);

  const g = ctx.createLinearGradient(0, 0, 0, H * 0.65);
  g.addColorStop(0, skyTop); g.addColorStop(1, skyBot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // sol / luna en arco
  const dayT = (t - 6.5) / 13;
  if (dayT > 0 && dayT < 1) {
    const sx = W * (0.12 + 0.76 * dayT), sy = H * 0.42 - Math.sin(dayT * Math.PI) * H * 0.30;
    ctx.fillStyle = "rgba(255,236,180,0.92)";
    ctx.beginPath(); ctx.arc(sx, sy, 17, 0, 7); ctx.fill();
  } else if (night) {
    ctx.fillStyle = "rgba(238,240,250,0.9)";
    ctx.beginPath(); ctx.arc(W * 0.78, H * 0.14, 12, 0, 7); ctx.fill();
    ctx.fillStyle = skyTop;
    ctx.beginPath(); ctx.arc(W * 0.78 + 5, H * 0.14 - 3, 11, 0, 7); ctx.fill();
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 127.3) % 1) * W, sy = ((i * 61.7) % 1) * H * 0.5;
      ctx.fillStyle = `rgba(255,255,255,${0.25 + ((i * 37) % 10) / 20})`;
      ctx.fillRect(sx, sy, 1.6, 1.6);
    }
  }

  // rejilla isométrica
  const TW = Math.min(W / 14.5, 58), TH = TW / 2;
  const CX = W / 2, CY = H * 0.46;
  const iso = (x, y) => [CX + (x - y) * TW / 2, CY + (x + y) * TH / 2];

  const c0 = iso(-6.5, -6.5), c1 = iso(6.5, -6.5), c2 = iso(6.5, 6.5), c3 = iso(-6.5, 6.5);
  ctx.fillStyle = groundC;
  ctx.beginPath(); ctx.moveTo(...c0); ctx.lineTo(...c1); ctx.lineTo(...c2); ctx.lineTo(...c3);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = night ? "rgba(255,255,255,0.06)" : "rgba(90,75,45,0.13)";
  ctx.lineWidth = 1;
  for (let i = -6; i <= 6; i++) {
    let a = iso(i, -6.5), b = iso(i, 6.5);
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
    a = iso(-6.5, i); b = iso(6.5, i);
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
  }

  // el pozo: el nivel del agua ES el stock
  const [wx, wy] = iso(0, 0);
  const frac = S.commons ? Math.max(0, Math.min(1, Number(S.commons.stock) / Number(S.commons.capacity))) : 1;
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.beginPath(); ctx.ellipse(wx + TW * 0.3, wy + 8, TW * 1.15, TH * 1.05, 0, 0, 7); ctx.fill();
  ctx.fillStyle = night ? "#6a6458" : "#948b7c";
  ctx.beginPath(); ctx.ellipse(wx, wy, TW * 1.05, TH * 0.98, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#241f18";
  ctx.beginPath(); ctx.ellipse(wx, wy - 2, TW * 0.8, TH * 0.72, 0, 0, 7); ctx.fill();
  const wr = 0.25 + 0.55 * frac;
  ctx.fillStyle = waterC;
  ctx.beginPath(); ctx.ellipse(wx, wy - 2 + TH * 0.5 * (1 - frac), TW * 0.8 * wr / 0.8, TH * 0.6 * wr, 0, 0, 7); ctx.fill();
  const shimmer = Math.sin(now / 700) * 2;
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath(); ctx.ellipse(wx - 8 + shimmer, wy - 4 + TH * 0.5 * (1 - frac), TW * 0.3, TH * 0.16, 0, 0, 7); ctx.fill();
  ctx.fillStyle = night ? "#4d4436" : "#7a6a52";
  ctx.fillRect(wx - TW * 1.02, wy - TH * 1.9, 5, TH * 1.9);
  ctx.fillRect(wx + TW * 1.02 - 5, wy - TH * 1.9, 5, TH * 1.9);
  ctx.fillStyle = night ? "#6e5138" : "#a97350";
  ctx.beginPath();
  ctx.moveTo(wx - TW * 1.18, wy - TH * 1.82); ctx.lineTo(wx, wy - TH * 2.5); ctx.lineTo(wx + TW * 1.18, wy - TH * 1.82);
  ctx.closePath(); ctx.fill();

  // agentes (interpolan hacia su posición real)
  const list = [...S.agents.values()].sort((a, b) => (a.y + a.x) - (b.y + b.x));
  const groups = new Map();
  for (const a of list) {
    a.x += (a.gx - a.x) * 0.06; a.y += (a.gy - a.y) * 0.06;
    const key = `${Math.round(a.x)},${Math.round(a.y)}`;
    const n = groups.get(key) ?? 0; groups.set(key, n + 1);
    let [px, py] = iso(a.x, a.y);
    px += n * TW * 0.3; py += n * 4;
    const bob = Math.sin(now / 900 + a.phase) * 1.6;
    const col = COL[a.fam];

    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.beginPath(); ctx.ellipse(px + 5, py + 3, 10, 4, 0, 0, 7); ctx.fill();

    ctx.fillStyle = a.alive ? col : "#8b8578";
    ctx.beginPath();
    ctx.moveTo(px, py - 20 + bob); ctx.lineTo(px + 8, py - 3 + bob);
    ctx.lineTo(px, py + 2 + bob); ctx.lineTo(px - 8, py - 3 + bob);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#faeed9";
    ctx.strokeStyle = a.alive ? col : "#8b8578"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(px, py - 26 + bob, 6, 0, 7); ctx.fill(); ctx.stroke();

    if (a.holdings > 0) {
      ctx.fillStyle = "#2fbd8a";
      ctx.beginPath(); ctx.arc(px + 12, py - 30 + bob, 5.5, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "600 8px ui-sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(Math.round(a.holdings)), px + 12, py - 27 + bob);
    }

    ctx.fillStyle = night ? "rgba(240,236,220,0.85)" : "#57503f";
    ctx.font = "600 10.5px ui-sans-serif"; ctx.textAlign = "center";
    ctx.fillText(a.name, px, py + 14);

    if (a.bubble && a.bubble.until > now) {
      const age = 1 - (a.bubble.until - now) / 6500;
      const by = py - 44 + bob - age * 4;
      ctx.globalAlpha = age > 0.8 ? (1 - age) * 5 : 1;
      ctx.fillStyle = "#fffdf7"; ctx.strokeStyle = "rgba(90,75,45,0.35)"; ctx.lineWidth = 1;
      ctx.beginPath();
      const r = 6;
      ctx.roundRect(px - 15, by - 13, 30, 22, 8);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px - 4, by + 9); ctx.lineTo(px, by + 15); ctx.lineTo(px + 4, by + 9);
      ctx.closePath(); ctx.fillStyle = "#fffdf7"; ctx.fill();
      ctx.font = "13px ui-sans-serif"; ctx.fillStyle = "#333";
      ctx.fillText(a.bubble.icon, px, by + 4);
      ctx.globalAlpha = 1;
    } else if (a.bubble && a.bubble.until <= now) a.bubble = null;
  }
}

// ---------- reloj ----------
function tickClock() {
  const f = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  document.getElementById("cdmxTime").textContent = f.format(new Date());
}

// ---------- arranque ----------
document.getElementById("expSelect").addEventListener("change", (e) => {
  S.expId = e.target.value;
  S.agents.clear(); S.seenActions.clear(); S.feedIds.clear();
  document.getElementById("feed").innerHTML = "";
  poll().catch(console.error);
});

(async function main() {
  tickClock(); setInterval(tickClock, 5000);
  try { await loadExperiments(); await poll(); } catch (e) { console.error(e); }
  setInterval(() => poll().catch(() => {
    S.online = false;
    document.getElementById("liveDot").classList.remove("on");
  }), POLL_MS);
  setInterval(() => loadExperiments().catch(() => {}), 60000);
  requestAnimationFrame(draw);
})();
