// AI Society Lab — Observatorio v2 "Teatro".
// Vista cenital estilo RPG clásico: avatares que caminan, cámara libre con zoom,
// y modo reality: sigue la vida de un agente.
//
// Solo lectura. Las posiciones-ancla, acciones, pensamientos y el pozo son datos
// reales del experimento; el deambular dentro de la casilla propia es presentación
// (los agentes viven en una rejilla discreta) y no altera ni inventa datos.

const SUPABASE_URL = "https://rxjwoigrzudcttnjaaul.supabase.co";
const ANON_KEY = "sb_publishable_hLFAPII9PUqvcnvxzQMdiA_SC9PfyzC";
const POLL_MS = 4000;
const TILE = 46;

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
  agents: new Map(),
  seenActions: new Set(), feedIds: new Set(),
  followId: null,
};
const cam = { x: 0, y: 0, zoom: 1, tx: 0, ty: 0, tzoom: 1 };

const FAM = (m) => m.includes("gemini") ? "gem" : "gpt";
const PAL = {
  gem: { tunic: "#3d8bde", tunic2: "#2c6cb4", trim: "#bcd9f4" },
  gpt: { tunic: "#f07a3e", tunic2: "#c85a20", trim: "#f9d3b8" },
};
const SKIN = ["#f2c9a0", "#e0ac7e", "#c98d5f", "#a96f45"];
const HAIR = ["#2f2a24", "#4a3320", "#7a5230", "#1d1d22", "#5c5c66", "#8a6440"];
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

const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const rnd = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

// ---------- datos ----------
async function loadExperiments() {
  S.exps = await rest("v2_experiments?select=id,name,status,current_tick,max_ticks,started_at&order=started_at.desc&limit=20");
  const sel = document.getElementById("expSelect");
  sel.innerHTML = S.exps.map(e => `<option value="${e.id}">${e.name} · ${e.status}</option>`).join("");
  if (!S.expId && S.exps.length) S.expId = (S.exps.find(e => e.status === "active") ?? S.exps[0]).id;
  sel.value = S.expId ?? "";
}

async function poll() {
  if (!S.expId) return;
  const id = S.expId;
  const [exps, commons, agents, actions] = await Promise.all([
    rest(`v2_experiments?id=eq.${id}&select=*`),
    rest(`v2_commons?experiment_id=eq.${id}&select=*`),
    rest(`v2_agents?experiment_id=eq.${id}&select=id,name,model,personality,alive,v2_agent_state(x,y,holdings,last_action,last_thought)`),
    rest(`v2_actions?experiment_id=eq.${id}&select=id,tick,action_type,payload,success,decision_status,agent_id,created_at&order=created_at.desc&limit=48`),
  ]);
  S.exp = exps[0] ?? null;
  S.commons = commons[0] ?? null;

  for (const a of agents) {
    const st = a.v2_agent_state ?? {};
    let ag = S.agents.get(a.id);
    if (!ag) {
      const h = hash(a.id);
      ag = {
        id: a.id, name: a.name, fam: FAM(a.model), model: a.model,
        trait: a.personality?.trait ?? "—",
        ax: st.x ?? 0, ay: st.y ?? 0,          // ancla real (dato)
        vx: st.x ?? 0, vy: st.y ?? 0,          // posición visual
        wx: st.x ?? 0, wy: st.y ?? 0,          // objetivo de paseo
        nextWander: 0, walkPhase: rnd(h) * 6, facing: "s", moving: false,
        holdings: 0, alive: a.alive, thought: null,
        skin: SKIN[h % SKIN.length], hair: HAIR[(h >> 3) % HAIR.length],
        bubble: null,
      };
      S.agents.set(a.id, ag);
    }
    ag.ax = st.x ?? ag.ax; ag.ay = st.y ?? ag.ay;
    ag.holdings = Number(st.holdings ?? 0);
    ag.alive = a.alive;
    ag.thought = st.last_thought ?? ag.thought;
  }

  const fresh = actions.filter(x => !S.seenActions.has(x.id)).reverse();
  for (const x of fresh) {
    S.seenActions.add(x.id);
    bubbleFor(x);
    pushFeed(x);
  }

  updateHud();
  if (S.followId) updateFollowCard();
  document.getElementById("liveDot").classList.add("on");
}

function bubbleFor(x) {
  const ag = S.agents.get(x.agent_id);
  if (!ag || !x.success) return;
  const p = x.payload ?? {};
  const talky = { say_public: p.message, talk_to: p.message, address: p.message, reply_to: p.message, teach: p.content };
  if (x.action_type in talky && talky[x.action_type]) {
    ag.bubble = { text: String(talky[x.action_type]).slice(0, 90), until: performance.now() + 9000 };
  } else if (x.action_type === "propose_decision") {
    ag.bubble = { text: p.quota_per_tick != null ? `propongo cuota ${p.quota_per_tick}` : "propongo una regla", until: performance.now() + 9000 };
  } else if (ICON[x.action_type]) {
    ag.bubble = { icon: ICON[x.action_type], until: performance.now() + 5500 };
  }
}

function agentName(id) { return S.agents.get(id)?.name ?? "¿?"; }
function agentFam(id) { return S.agents.get(id)?.fam ?? "gem"; }

function pushFeed(x) {
  if (S.feedIds.has(x.id)) return;
  const p = x.payload ?? {};
  let body = "", milestone = false;
  switch (x.action_type) {
    case "say_public": body = p.message ?? ""; milestone = true; break;
    case "propose_decision":
      body = (p.proposal ?? "") + (p.quota_per_tick != null ? ` (cuota: ${p.quota_per_tick})` : ""); break;
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
  el.dataset.agent = x.agent_id;
  el.innerHTML =
    `<div class="evt-head"><span>${ICON[x.action_type] ?? ""}</span>` +
    `<span class="evt-agent ${agentFam(x.agent_id)}" data-follow="${x.agent_id}">${agentName(x.agent_id)}</span>` +
    `<span class="evt-kind">${KIND_ES[x.action_type] ?? x.action_type}</span>` +
    `<span class="evt-tick">t${x.tick}</span></div>` +
    (body ? `<div class="evt-body"></div>` : "");
  if (body) el.querySelector(".evt-body").textContent = body.slice(0, 220);
  if (S.followId && x.agent_id !== S.followId) el.classList.add("hidden-by-follow");
  const feed = document.getElementById("feed");
  feed.prepend(el);
  while (feed.children.length > 90) feed.lastChild.remove();
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

// ---------- seguir a un agente ----------
function follow(id) {
  S.followId = id;
  document.getElementById("followCard").hidden = false;
  document.getElementById("feedTitle").textContent = `La vida de ${agentName(id)}`;
  for (const el of document.querySelectorAll(".evt"))
    el.classList.toggle("hidden-by-follow", el.dataset.agent !== id);
  updateFollowCard();
  cam.tzoom = Math.max(cam.tzoom, 1.9);
}
function unfollow() {
  S.followId = null;
  document.getElementById("followCard").hidden = true;
  document.getElementById("feedTitle").textContent = "La sociedad habla";
  for (const el of document.querySelectorAll(".evt")) el.classList.remove("hidden-by-follow");
}
function updateFollowCard() {
  const a = S.agents.get(S.followId);
  if (!a) return;
  document.getElementById("fName").textContent = a.name;
  document.getElementById("fSub").textContent = a.model.split("/").pop() + (a.alive ? "" : " · ✝");
  document.getElementById("fTrait").textContent = a.trait;
  document.getElementById("fHold").textContent = `${Math.round(a.holdings)} agua`;
  document.getElementById("fThought").textContent = a.thought ? `“${a.thought}”` : "…";
  const pc = document.getElementById("portrait");
  const px = pc.getContext("2d");
  px.imageSmoothingEnabled = false;
  px.clearRect(0, 0, pc.width, pc.height);
  drawSprite(px, 36, 74, 5, "s", 0, a, false);
}
document.getElementById("unfollow").addEventListener("click", unfollow);
document.getElementById("feed").addEventListener("click", (e) => {
  const id = e.target?.dataset?.follow;
  if (id) follow(id);
});

// ---------- luz de Ciudad de México ----------
function cdmxHour() {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Mexico_City", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date());
  return +p.find(x => x.type === "hour").value + (+p.find(x => x.type === "minute").value) / 60;
}
// [hora, tinte multiplicativo, alpha de oscuridad]
const LIGHT = [
  [0.0, "#8890c8", 0.42], [5.5, "#8890c8", 0.42], [6.8, "#f0b090", 0.12],
  [8.5, "#ffffff", 0.0], [16.0, "#fff6e0", 0.0], [18.0, "#ffc890", 0.10],
  [19.5, "#9088b8", 0.30], [21.0, "#8890c8", 0.42], [24.0, "#8890c8", 0.42],
];
function hex2(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
function lightAt(t) {
  let i = 0;
  while (i < LIGHT.length - 2 && LIGHT[i + 1][0] < t) i++;
  const [t0, c0, a0] = LIGHT[i], [t1, c1, a1] = LIGHT[i + 1];
  const k = Math.max(0, Math.min(1, (t - t0) / (t1 - t0 || 1)));
  const A = hex2(c0), B = hex2(c1);
  return {
    tint: `rgb(${A.map((v, j) => Math.round(v + (B[j] - v) * k)).join(",")})`,
    dark: a0 + (a1 - a0) * k,
  };
}

// ---------- lienzo ----------
const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  W = r.width; H = r.height;
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
new ResizeObserver(resize).observe(canvas);

const T = () => TILE * cam.zoom;
const sx = (wx) => (wx - cam.x) * T() + W / 2;
const sy = (wy) => (wy - cam.y) * T() + H / 2;
const wxOf = (px) => (px - W / 2) / T() + cam.x;
const wyOf = (py) => (py - H / 2) / T() + cam.y;

// árboles decorativos fijos (fuera del área de agentes)
const TREES = [];
for (let i = 0; i < 26; i++) {
  const ang = rnd(i * 3 + 1) * Math.PI * 2;
  const rad = 6.4 + rnd(i * 7 + 2) * 2.2;
  TREES.push({ x: Math.cos(ang) * rad, y: Math.sin(ang) * rad * 0.9, big: rnd(i * 13) > 0.5 });
}

function drawTree(x, y, big) {
  const t = T(), px = sx(x), py = sy(y);
  const s = t / 46;
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(px, py + 6 * s, 14 * s, 5 * s, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#6b4a2e";
  ctx.fillRect(px - 3 * s, py - 10 * s, 6 * s, 16 * s);
  const R = big ? 17 : 13;
  ctx.fillStyle = "#3e7434";
  ctx.beginPath(); ctx.arc(px, py - (14 + R * 0.4) * s, R * s, 0, 7); ctx.fill();
  ctx.fillStyle = "#4f8a3e";
  ctx.beginPath(); ctx.arc(px - R * 0.35 * s, py - (16 + R * 0.4) * s, R * 0.68 * s, 0, 7); ctx.fill();
}

function drawSprite(c, px, py, s, facing, step, a, shadow = true) {
  // avatar 12x16 "píxeles"; (px,py) = pies. s = tamaño de píxel.
  const P = PAL[a.fam];
  const X = (col) => px + (col - 6) * s;
  const Y = (row) => py + (row - 16) * s;
  const R = (col, row, w, h, color) => { c.fillStyle = color; c.fillRect(X(col), Y(row), w * s, h * s); };
  if (shadow) {
    c.fillStyle = "rgba(0,0,0,0.22)";
    c.beginPath(); c.ellipse(px, py + s, 5.5 * s, 2.2 * s, 0, 0, 7); c.fill();
  }
  const leg = a.moving ? Math.round(Math.sin(step * 10) * 1) : 0;
  const grey = !a.alive;
  const tun = grey ? "#8b8578" : P.tunic, tun2 = grey ? "#6f6a5e" : P.tunic2;
  // piernas
  R(4, 14 + (leg > 0 ? 0 : 0), 2, 2 - 0, "#4a3a2a");
  R(7, 14, 2, 2, "#4a3a2a");
  if (leg !== 0) { R(leg > 0 ? 4 : 7, 13, 2, 1, "#4a3a2a"); }
  // túnica
  R(3, 8, 7, 6, tun);
  R(3, 12, 7, 2, tun2);
  R(6, 8, 1, 6, tun2);
  // brazos
  const arm = a.moving ? leg : 0;
  R(2, 9 + (arm > 0 ? 1 : 0), 1, 4, tun2);
  R(10, 9 + (arm < 0 ? 1 : 0), 1, 4, tun2);
  R(2, 13 + (arm > 0 ? 1 : 0), 1, 1, a.skin);
  R(10, 13 + (arm < 0 ? 1 : 0), 1, 1, a.skin);
  // cabeza
  R(3.5, 2, 6, 5, a.skin);
  R(3.5, 1, 6, 1.6, a.hair);
  R(3.0, 2, 1, 2.4, a.hair);
  R(9.0, 2, 1, 2.4, a.hair);
  if (facing === "s") {
    R(5, 4, 1, 1, "#26221c"); R(7.4, 4, 1, 1, "#26221c");
  } else if (facing === "e") {
    R(7.6, 4, 1, 1, "#26221c");
  } else if (facing === "w") {
    R(4.2, 4, 1, 1, "#26221c");
  } else {
    R(3.5, 1.4, 6, 2.6, a.hair);
  }
  // cuello / adorno
  R(5, 7.2, 3, 0.8, P.trim ?? "#eee");
}

function wrapText(text, maxW) {
  const words = text.split(" ");
  const lines = []; let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = t;
    if (lines.length === 3) break;
  }
  if (lines.length < 3 && cur) lines.push(cur);
  if (lines.length === 3 && words.join(" ") !== lines.join(" ")) lines[2] += "…";
  return lines;
}

function draw(now) {
  requestAnimationFrame(draw);
  if (!W) resize();

  cam.zoom += (cam.tzoom - cam.zoom) * 0.12;
  if (S.followId) {
    const f = S.agents.get(S.followId);
    if (f) { cam.tx = f.vx; cam.ty = f.vy - 0.3; }
  }
  cam.x += (cam.tx - cam.x) * 0.10;
  cam.y += (cam.ty - cam.y) * 0.10;

  const t = cdmxHour();
  const L = lightAt(t);
  const night = L.dark > 0.25;

  // fuera del mundo
  ctx.fillStyle = "#5d7a4b";
  ctx.fillRect(0, 0, W, H);

  // suelo visible
  const x0 = Math.floor(wxOf(-TILE)), x1 = Math.ceil(wxOf(W + TILE));
  const y0 = Math.floor(wyOf(-TILE)), y1 = Math.ceil(wyOf(H + TILE));
  const ts = T();
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const inWorld = gx >= -8 && gx <= 8 && gy >= -8 && gy <= 8;
      const d = Math.hypot(gx, gy);
      const h = rnd(gx * 57 + gy * 131 + 7);
      let base;
      if (!inWorld) base = h > 0.5 ? "#55704511" : "#00000000";
      else if (d < 2.6) base = h > 0.5 ? "#c9a876" : "#c2a06e";       // tierra
      else base = h > 0.66 ? "#79a057" : h > 0.33 ? "#729a52" : "#6d954e"; // pasto
      if (base.length > 7) continue;
      ctx.fillStyle = base;
      ctx.fillRect(sx(gx) - ts / 2, sy(gy) - ts / 2, ts + 0.5, ts + 0.5);
      if (inWorld && h > 0.82 && d >= 2.6) {
        ctx.fillStyle = "rgba(40,70,30,0.25)";
        const ox = (rnd(gx * 31 + gy) - 0.5) * ts * 0.6, oy = (rnd(gx + gy * 31) - 0.5) * ts * 0.6;
        ctx.fillRect(sx(gx) + ox, sy(gy) + oy, ts * 0.07, ts * 0.14);
      }
    }
  }

  // borde del mundo
  ctx.strokeStyle = "rgba(30,45,25,0.35)"; ctx.lineWidth = 2;
  ctx.strokeRect(sx(-8) - ts / 2, sy(-8) - ts / 2, 17 * ts, 17 * ts);

  for (const tr of TREES) drawTree(tr.x, tr.y, tr.big);

  // el pozo (nivel = stock real)
  const frac = S.commons ? Math.max(0, Math.min(1, Number(S.commons.stock) / Number(S.commons.capacity))) : 1;
  const wpx = sx(0), wpy = sy(0), wr = ts * 1.15;
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath(); ctx.ellipse(wpx + ts * 0.08, wpy + ts * 0.1, wr, wr * 0.8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#8d8578";
  ctx.beginPath(); ctx.ellipse(wpx, wpy, wr, wr * 0.8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#6e675c";
  ctx.beginPath(); ctx.ellipse(wpx, wpy, wr * 0.8, wr * 0.62, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#241f18";
  ctx.beginPath(); ctx.ellipse(wpx, wpy, wr * 0.66, wr * 0.5, 0, 0, 7); ctx.fill();
  const wl = 0.2 + 0.8 * frac;
  ctx.fillStyle = night ? "#3d7fa3" : "#4a9ec4";
  ctx.beginPath(); ctx.ellipse(wpx, wpy + wr * 0.1 * (1 - frac), wr * 0.66 * wl, wr * 0.5 * wl, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  const sh = Math.sin(now / 650) * ts * 0.05;
  ctx.beginPath(); ctx.ellipse(wpx - wr * 0.15 + sh, wpy - wr * 0.04, wr * 0.2 * wl, wr * 0.07 * wl, 0, 0, 7); ctx.fill();

  // agentes: caminar hacia ancla; deambular suave alrededor
  const dt = 1 / 60;
  const list = [...S.agents.values()].sort((a, b) => a.vy - b.vy);
  for (const a of list) {
    const distAnchor = Math.hypot(a.ax - a.vx, a.ay - a.vy);
    let gx, gy;
    if (distAnchor > 0.55) { gx = a.ax; gy = a.ay; }
    else {
      if (now > a.nextWander) {
        const h = hash(a.id) + Math.floor(now / 1000);
        a.wx = a.ax + (rnd(h) - 0.5) * 0.9;
        a.wy = a.ay + (rnd(h * 7) - 0.5) * 0.9;
        a.nextWander = now + 2600 + rnd(h * 3) * 4500;
      }
      gx = a.wx; gy = a.wy;
    }
    const dx = gx - a.vx, dy = gy - a.vy;
    const d = Math.hypot(dx, dy);
    const speed = distAnchor > 0.55 ? 1.7 : 0.45;
    if (d > 0.03 && a.alive) {
      a.vx += (dx / d) * speed * dt;
      a.vy += (dy / d) * speed * dt;
      a.moving = true;
      a.walkPhase += dt * speed * 2.4;
      a.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "e" : "w") : (dy > 0 ? "s" : "n");
    } else a.moving = false;

    const px = sx(a.vx), py = sy(a.vy);
    const s = Math.max(1.6, (ts / 46) * 2.6);
    drawSprite(ctx, px, py, s, a.facing, a.walkPhase, a);

    if (a.holdings > 0) {
      ctx.fillStyle = "#2fbd8a";
      ctx.beginPath(); ctx.arc(px + 8 * s, py - 17 * s, 3.2 * s, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${Math.max(8, 3.4 * s)}px ui-sans-serif`; ctx.textAlign = "center";
      ctx.fillText(String(Math.round(a.holdings)), px + 8 * s, py - 15.9 * s);
    }

    ctx.font = `600 ${Math.max(9, 3.6 * s)}px ui-sans-serif`; ctx.textAlign = "center";
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,253,245,0.75)";
    ctx.strokeText(a.name, px, py + 4.5 * s);
    ctx.fillStyle = S.followId === a.id ? "#a33b1f" : "#333026";
    ctx.fillText(a.name, px, py + 4.5 * s);

    if (S.followId === a.id) {
      ctx.strokeStyle = "#d85a30"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(px, py + s, 6.5 * s, 2.8 * s, 0, 0, 7); ctx.stroke();
    }
  }

  // burbujas (encima de todos)
  for (const a of list) {
    if (!a.bubble) continue;
    if (a.bubble.until <= now) { a.bubble = null; continue; }
    const px = sx(a.vx), py = sy(a.vy);
    const s = Math.max(1.6, (ts / 46) * 2.6);
    const top = py - 19 * s;
    const life = (a.bubble.until - now) / (a.bubble.text ? 9000 : 5500);
    ctx.globalAlpha = life < 0.15 ? life / 0.15 : 1;
    if (a.bubble.text) {
      ctx.font = `500 ${Math.max(10, 3.5 * s)}px ui-sans-serif`;
      const lines = wrapText(a.bubble.text, 46 * s);
      const lh = Math.max(12, 4.2 * s);
      const bw = Math.min(50 * s, Math.max(...lines.map(l => ctx.measureText(l).width)) + 14);
      const bh = lines.length * lh + 10;
      ctx.fillStyle = "#fffdf7"; ctx.strokeStyle = "rgba(80,70,50,0.4)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(px - bw / 2, top - bh, bw, bh, 8); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px - 4, top); ctx.lineTo(px, top + 6); ctx.lineTo(px + 4, top); ctx.closePath();
      ctx.fillStyle = "#fffdf7"; ctx.fill();
      ctx.fillStyle = "#3d382c"; ctx.textAlign = "center";
      lines.forEach((l, i) => ctx.fillText(l, px, top - bh + lh * (i + 0.8)));
    } else {
      ctx.fillStyle = "#fffdf7"; ctx.strokeStyle = "rgba(80,70,50,0.4)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(px - 7 * s, top - 9 * s, 14 * s, 10 * s, 6); ctx.fill(); ctx.stroke();
      ctx.font = `${5.5 * s}px ui-sans-serif`; ctx.textAlign = "center"; ctx.fillStyle = "#333";
      ctx.fillText(a.bubble.icon, px, top - 2.4 * s);
    }
    ctx.globalAlpha = 1;
  }

  // luz del día de CDMX
  if (L.tint !== "rgb(255,255,255)") {
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = L.tint; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  }
  if (L.dark > 0.01) {
    ctx.fillStyle = `rgba(10,14,40,${L.dark * 0.55})`;
    ctx.fillRect(0, 0, W, H);
    // farol del pozo
    const g = ctx.createRadialGradient(wpx, wpy - wr, 0, wpx, wpy - wr, wr * 3);
    g.addColorStop(0, "rgba(255,200,110,0.30)"); g.addColorStop(1, "rgba(255,200,110,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
}

// ---------- cámara: arrastre, zoom, clic ----------
let drag = null;
canvas.addEventListener("pointerdown", (e) => {
  drag = { x: e.clientX, y: e.clientY, cx: cam.tx, cy: cam.ty, moved: false };
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add("dragging");
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag) {
    const hit = hitAgent(e);
    canvas.classList.toggle("pointing", !!hit);
    return;
  }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) > 4) drag.moved = true;
  if (drag.moved) {
    if (S.followId) unfollow();
    cam.tx = drag.cx - dx / T();
    cam.ty = drag.cy - dy / T();
  }
});
canvas.addEventListener("pointerup", (e) => {
  canvas.classList.remove("dragging");
  if (drag && !drag.moved) {
    const hit = hitAgent(e);
    if (hit) follow(hit.id);
  }
  drag = null;
});
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const k = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  const nz = Math.max(0.45, Math.min(3.4, cam.tzoom * k));
  const wx = wxOf(e.offsetX), wy = wyOf(e.offsetY);
  cam.tzoom = nz;
  cam.tx = wx - (e.offsetX - W / 2) / (TILE * nz);
  cam.ty = wy - (e.offsetY - H / 2) / (TILE * nz);
}, { passive: false });

function hitAgent(e) {
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  let best = null, bd = 30 * cam.zoom;
  for (const a of S.agents.values()) {
    const d = Math.hypot(sx(a.vx) - mx, sy(a.vy) - 10 * cam.zoom - my);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}
document.getElementById("zoomIn").onclick = () => cam.tzoom = Math.min(3.4, cam.tzoom * 1.3);
document.getElementById("zoomOut").onclick = () => cam.tzoom = Math.max(0.45, cam.tzoom / 1.3);
document.getElementById("camHome").onclick = () => { unfollow(); cam.tx = 0; cam.ty = 0; cam.tzoom = Math.min(1, (Math.min(W, H) / (13 * TILE))); };

// ---------- reloj ----------
function tickClock() {
  const f = new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hour12: false });
  document.getElementById("cdmxTime").textContent = f.format(new Date());
}

// ---------- arranque ----------
document.getElementById("expSelect").addEventListener("change", (e) => {
  S.expId = e.target.value;
  S.agents.clear(); S.seenActions.clear(); S.feedIds.clear();
  document.getElementById("feed").innerHTML = "";
  unfollow();
  poll().catch(console.error);
});

(async function main() {
  tickClock(); setInterval(tickClock, 5000);
  try { await loadExperiments(); await poll(); } catch (e) { console.error(e); }
  setTimeout(() => { cam.tzoom = Math.min(1.15, Math.max(0.7, Math.min(W, H) / (13 * TILE))); }, 60);
  setInterval(() => poll().catch(() => document.getElementById("liveDot").classList.remove("on")), POLL_MS);
  setInterval(() => loadExperiments().catch(() => {}), 60000);
  requestAnimationFrame(draw);
})();
