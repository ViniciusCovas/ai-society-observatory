// Núcleo compartido del observatorio: datos + render de la escena.
// Lo usan la pantalla pública (modo director) y la consola de investigación.
// Solo lectura: consulta la API pública con la clave anon. No puede escribir.

export const SUPABASE_URL = "https://rxjwoigrzudcttnjaaul.supabase.co";
export const ANON_KEY = "sb_publishable_hLFAPII9PUqvcnvxzQMdiA_SC9PfyzC";
export const TILE = 46;

export async function rest(pathQ) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${pathQ}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!r.ok) throw new Error(`${r.status} ${pathQ}`);
  return r.json();
}

export const FAMILY = {
  google: "Gemini", openai: "GPT", anthropic: "Claude", "x-ai": "Grok",
  nvidia: "NVIDIA", qwen: "Qwen", moonshotai: "Kimi", "z-ai": "GLM",
  "meta-llama": "Llama", mistralai: "Mistral", deepseek: "DeepSeek",
};
export const famOf = (model) => FAMILY[String(model).split("/")[0]] ?? "otro";

// Nombres públicos de las sociedades permanentes (capa editorial, Doc 9 §1 del
// laboratorio): la procedencia no se toca — en la base siguen siendo
// naciones-2.1 y perenne-2.1; aquí se muestran con su nombre de pila.
export const PUBLIC_SOCIETY = {
  "naciones-2.1": { name: "BABEL", subKey: "soc_babel_sub", era: true },
  "perenne-2.1": { name: "ESPEJO", subKey: "soc_espejo_sub", era: true },
};

// Paleta por familia: color = identidad de arquitectura, no ranking.
export const PAL = {
  Gemini: "#3d8bde", GPT: "#f07a3e", Claude: "#c9873f", Grok: "#5d5d68",
  NVIDIA: "#5aa02c", Qwen: "#8a5cd6", Kimi: "#1f9d8f", GLM: "#d64a6a",
  Llama: "#2f6fb0", Mistral: "#e0a417", DeepSeek: "#7a4fd6", otro: "#8b8578",
};

export const ICON = {
  say_public: "📣", address: "🗣", reply_to: "↩", propose_decision: "📜", endorse: "🤝",
  talk_to: "💬", gift: "🎁", teach: "📖", consult_theory: "📚",
  gather: "💧", move_to: "🧭", eat: "🍽", rest: "😴", reflect: "💭",
};
export const KIND_ES = {
  say_public: "habló en público", propose_decision: "propuso una regla", endorse: "endosó",
  talk_to: "habló en privado", reply_to: "respondió", address: "se dirigió a",
  gather: "extrajo del pozo", gift: "regaló", teach: "enseñó", consult_theory: "consultó teoría",
  move_to: "se movió", reflect: "reflexionó", rest: "descansó", eat: "comió",
};

export const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
export const rnd = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

// --- luz de Ciudad de México (America/Mexico_City) ---
export function cdmxHour() {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Mexico_City", hour: "numeric", minute: "numeric", hour12: false,
  }).formatToParts(new Date());
  return +p.find(x => x.type === "hour").value + (+p.find(x => x.type === "minute").value) / 60;
}
export function cdmxClock() {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date());
}
const LIGHT = [
  [0.0, "#8890c8", 0.42], [5.5, "#8890c8", 0.42], [6.8, "#f0b090", 0.12],
  [8.5, "#ffffff", 0.0], [16.0, "#fff6e0", 0.0], [18.0, "#ffc890", 0.10],
  [19.5, "#9088b8", 0.30], [21.0, "#8890c8", 0.42], [24.0, "#8890c8", 0.42],
];
const hx = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
export function lightAt(t) {
  let i = 0;
  while (i < LIGHT.length - 2 && LIGHT[i + 1][0] < t) i++;
  const [t0, c0, a0] = LIGHT[i], [t1, c1, a1] = LIGHT[i + 1];
  const k = Math.max(0, Math.min(1, (t - t0) / (t1 - t0 || 1)));
  const A = hx(c0), B = hx(c1);
  return {
    tint: `rgb(${A.map((v, j) => Math.round(v + (B[j] - v) * k)).join(",")})`,
    dark: a0 + (a1 - a0) * k,
  };
}

// --- estado de una sociedad ---
export function newWorld() {
  return { exp: null, commons: null, agents: new Map(), seen: new Set() };
}

export async function loadWorld(W, expId, { actionLimit = 40 } = {}) {
  const [exps, commons, agents, actions] = await Promise.all([
    rest(`v2_experiments?id=eq.${expId}&select=*`),
    rest(`v2_commons?experiment_id=eq.${expId}&select=*`),
    rest(`v2_agents?experiment_id=eq.${expId}&select=id,name,model,personality,alive,v2_agent_state(x,y,holdings,last_thought)`),
    rest(`v2_actions?experiment_id=eq.${expId}&select=id,tick,action_type,payload,success,decision_status,agent_id,created_at&order=created_at.desc&limit=${actionLimit}`),
  ]);
  W.exp = exps[0] ?? null;
  W.commons = commons[0] ?? null;

  for (const a of agents) {
    const st = a.v2_agent_state ?? {};
    let ag = W.agents.get(a.id);
    if (!ag) {
      const h = hash(a.id);
      ag = {
        id: a.id, name: a.name, model: a.model, fam: famOf(a.model),
        trait: a.personality?.trait ?? "—",
        ax: st.x ?? 0, ay: st.y ?? 0, vx: st.x ?? 0, vy: st.y ?? 0,
        wx: st.x ?? 0, wy: st.y ?? 0, nextWander: 0, walkPhase: rnd(h) * 6,
        facing: "s", moving: false, holdings: 0, alive: a.alive, thought: null,
        skin: ["#f2c9a0", "#e0ac7e", "#c98d5f", "#a96f45"][h % 4],
        hair: ["#2f2a24", "#4a3320", "#7a5230", "#1d1d22", "#5c5c66", "#8a6440"][(h >> 3) % 6],
        bubble: null, lastActive: 0,
      };
      W.agents.set(a.id, ag);
    }
    ag.ax = st.x ?? ag.ax; ag.ay = st.y ?? ag.ay;
    ag.holdings = Number(st.holdings ?? 0);
    ag.alive = a.alive;
    ag.thought = st.last_thought ?? ag.thought;
  }
  return actions.filter(x => !W.seen.has(x.id)).reverse();
}

export function applyBubble(W, x) {
  const ag = W.agents.get(x.agent_id);
  if (!ag || !x.success) return;
  ag.lastActive = performance.now();
  const p = x.payload ?? {};
  const said = { say_public: p.message, talk_to: p.message, address: p.message, reply_to: p.message, teach: p.content };
  if (x.action_type in said && said[x.action_type]) {
    ag.bubble = { text: String(said[x.action_type]).slice(0, 110), until: performance.now() + 10000 };
  } else if (x.action_type === "propose_decision") {
    ag.bubble = { text: p.quota_per_tick != null ? `propongo cuota ${p.quota_per_tick}` : "propongo una regla", until: performance.now() + 10000 };
  } else if (ICON[x.action_type]) {
    ag.bubble = { icon: ICON[x.action_type], until: performance.now() + 5500 };
  }
}

// --- render de la escena ---
export function makeCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  const S = { W: 0, H: 0, DPR: 1 };
  function resize() {
    S.DPR = window.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    S.W = r.width; S.H = r.height;
    canvas.width = S.W * S.DPR; canvas.height = S.H * S.DPR;
    ctx.setTransform(S.DPR, 0, 0, S.DPR, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  return { ctx, S, resize };
}

function drawSprite(c, px, py, s, a) {
  const X = (col) => px + (col - 6) * s;
  const Y = (row) => py + (row - 16) * s;
  const R = (col, row, w, h, color) => { c.fillStyle = color; c.fillRect(X(col), Y(row), w * s, h * s); };
  c.fillStyle = "rgba(0,0,0,0.22)";
  c.beginPath(); c.ellipse(px, py + s, 5.5 * s, 2.2 * s, 0, 0, 7); c.fill();
  const leg = a.moving ? Math.round(Math.sin(a.walkPhase * 10)) : 0;
  const col = a.alive ? (PAL[a.fam] ?? "#8b8578") : "#8b8578";
  const dark = a.alive ? shade(col, -0.25) : "#6f6a5e";
  R(4, 14, 2, 2, "#4a3a2a"); R(7, 14, 2, 2, "#4a3a2a");
  if (leg !== 0) R(leg > 0 ? 4 : 7, 13, 2, 1, "#4a3a2a");
  R(3, 8, 7, 6, col); R(3, 12, 7, 2, dark); R(6, 8, 1, 6, dark);
  const arm = a.moving ? leg : 0;
  R(2, 9 + (arm > 0 ? 1 : 0), 1, 4, dark);
  R(10, 9 + (arm < 0 ? 1 : 0), 1, 4, dark);
  R(2, 13 + (arm > 0 ? 1 : 0), 1, 1, a.skin);
  R(10, 13 + (arm < 0 ? 1 : 0), 1, 1, a.skin);
  R(3.5, 2, 6, 5, a.skin);
  R(3.5, 1, 6, 1.6, a.hair);
  R(3.0, 2, 1, 2.4, a.hair); R(9.0, 2, 1, 2.4, a.hair);
  if (a.facing === "s") { R(5, 4, 1, 1, "#26221c"); R(7.4, 4, 1, 1, "#26221c"); }
  else if (a.facing === "e") R(7.6, 4, 1, 1, "#26221c");
  else if (a.facing === "w") R(4.2, 4, 1, 1, "#26221c");
  else R(3.5, 1.4, 6, 2.6, a.hair);
}
function shade(hexc, amt) {
  const [r, g, b] = hx(hexc);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + amt))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

const TREES = Array.from({ length: 30 }, (_, i) => {
  const ang = rnd(i * 3 + 1) * Math.PI * 2, rad = 6.6 + rnd(i * 7 + 2) * 2.4;
  return { x: Math.cos(ang) * rad, y: Math.sin(ang) * rad * 0.9, big: rnd(i * 13) > 0.5 };
});

/** Dibuja el mundo completo. cam = {x,y,zoom}. */
export function drawWorld(ctx, S, W, cam, now, opts = {}) {
  const { W: cw, H: ch } = S;
  const T = TILE * cam.zoom;
  const sx = (wx) => (wx - cam.x) * T + cw / 2;
  const sy = (wy) => (wy - cam.y) * T + ch / 2;
  const L = lightAt(cdmxHour());
  const night = L.dark > 0.25;

  ctx.fillStyle = "#5d7a4b"; ctx.fillRect(0, 0, cw, ch);
  const x0 = Math.floor((0 - cw / 2) / T + cam.x) - 1, x1 = Math.ceil((cw - cw / 2) / T + cam.x) + 1;
  const y0 = Math.floor((0 - ch / 2) / T + cam.y) - 1, y1 = Math.ceil((ch - ch / 2) / T + cam.y) + 1;
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const inW = gx >= -8 && gx <= 8 && gy >= -8 && gy <= 8;
      if (!inW) continue;
      const d = Math.hypot(gx, gy), h = rnd(gx * 57 + gy * 131 + 7);
      ctx.fillStyle = d < 2.6 ? (h > 0.5 ? "#c9a876" : "#c2a06e")
        : (h > 0.66 ? "#79a057" : h > 0.33 ? "#729a52" : "#6d954e");
      ctx.fillRect(sx(gx) - T / 2, sy(gy) - T / 2, T + 0.5, T + 0.5);
    }
  }
  ctx.strokeStyle = "rgba(30,45,25,0.35)"; ctx.lineWidth = 2;
  ctx.strokeRect(sx(-8) - T / 2, sy(-8) - T / 2, 17 * T, 17 * T);

  for (const tr of TREES) {
    const px = sx(tr.x), py = sy(tr.y), s = T / 46;
    if (px < -60 || px > cw + 60 || py < -60 || py > ch + 60) continue;
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath(); ctx.ellipse(px, py + 6 * s, 14 * s, 5 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#6b4a2e"; ctx.fillRect(px - 3 * s, py - 10 * s, 6 * s, 16 * s);
    const R0 = tr.big ? 17 : 13;
    ctx.fillStyle = "#3e7434";
    ctx.beginPath(); ctx.arc(px, py - (14 + R0 * 0.4) * s, R0 * s, 0, 7); ctx.fill();
    ctx.fillStyle = "#4f8a3e";
    ctx.beginPath(); ctx.arc(px - R0 * 0.35 * s, py - (16 + R0 * 0.4) * s, R0 * 0.68 * s, 0, 7); ctx.fill();
  }

  // el pozo: el nivel del agua ES el stock
  const frac = W.commons ? Math.max(0, Math.min(1, Number(W.commons.stock) / Number(W.commons.capacity))) : 1;
  const wx = sx(0), wy = sy(0), wr = T * 1.15;
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath(); ctx.ellipse(wx + T * 0.08, wy + T * 0.1, wr, wr * 0.8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#8d8578";
  ctx.beginPath(); ctx.ellipse(wx, wy, wr, wr * 0.8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#6e675c";
  ctx.beginPath(); ctx.ellipse(wx, wy, wr * 0.8, wr * 0.62, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#241f18";
  ctx.beginPath(); ctx.ellipse(wx, wy, wr * 0.66, wr * 0.5, 0, 0, 7); ctx.fill();
  const wl = 0.2 + 0.8 * frac;
  ctx.fillStyle = night ? "#3d7fa3" : "#4a9ec4";
  ctx.beginPath(); ctx.ellipse(wx, wy + wr * 0.1 * (1 - frac), wr * 0.66 * wl, wr * 0.5 * wl, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath(); ctx.ellipse(wx - wr * 0.15 + Math.sin(now / 650) * T * 0.05, wy - wr * 0.04, wr * 0.2 * wl, wr * 0.07 * wl, 0, 0, 7); ctx.fill();

  // agentes
  const dt = 1 / 60;
  const list = [...W.agents.values()].sort((a, b) => a.vy - b.vy);
  for (const a of list) {
    const distA = Math.hypot(a.ax - a.vx, a.ay - a.vy);
    let gx, gy;
    if (distA > 0.55) { gx = a.ax; gy = a.ay; }
    else {
      if (now > a.nextWander) {
        const h = hash(a.id) + Math.floor(now / 1000);
        a.wx = a.ax + (rnd(h) - 0.5) * 0.9;
        a.wy = a.ay + (rnd(h * 7) - 0.5) * 0.9;
        a.nextWander = now + 2600 + rnd(h * 3) * 4500;
      }
      gx = a.wx; gy = a.wy;
    }
    const dx = gx - a.vx, dy = gy - a.vy, d = Math.hypot(dx, dy);
    const speed = distA > 0.55 ? 1.7 : 0.45;
    if (d > 0.03 && a.alive) {
      a.vx += (dx / d) * speed * dt; a.vy += (dy / d) * speed * dt;
      a.moving = true; a.walkPhase += dt * speed * 2.4;
      a.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "e" : "w") : (dy > 0 ? "s" : "n");
    } else a.moving = false;

    const px = sx(a.vx), py = sy(a.vy);
    if (px < -80 || px > cw + 80 || py < -100 || py > ch + 80) continue;
    const s = Math.max(1.6, (T / 46) * 2.6);
    drawSprite(ctx, px, py, s, a);

    if (a.holdings > 0) {
      ctx.fillStyle = "#2fbd8a";
      ctx.beginPath(); ctx.arc(px + 8 * s, py - 17 * s, 3.2 * s, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${Math.max(8, 3.4 * s)}px ui-sans-serif`; ctx.textAlign = "center";
      ctx.fillText(String(Math.round(a.holdings)), px + 8 * s, py - 15.9 * s);
    }
    if (opts.names !== false) {
      ctx.font = `600 ${Math.max(9, 3.6 * s)}px ui-sans-serif`; ctx.textAlign = "center";
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,253,245,0.75)";
      ctx.strokeText(a.name, px, py + 4.5 * s);
      ctx.fillStyle = opts.highlight === a.id ? "#a33b1f" : "#333026";
      ctx.fillText(a.name, px, py + 4.5 * s);
    }
    if (opts.highlight === a.id) {
      ctx.strokeStyle = "#d85a30"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(px, py + s, 6.5 * s, 2.8 * s, 0, 0, 7); ctx.stroke();
    }
  }

  // burbujas encima de todo. En modo director se limitan las simultáneas:
  // con 32 agentes hablando a la vez el plano se vuelve ilegible.
  let bubbleBudget = opts.maxBubbles ?? Infinity;
  const speaking = list.filter(a => a.bubble && a.bubble.until > now)
    .sort((a, b) => b.bubble.until - a.bubble.until);
  for (const a of speaking) {
    if (bubbleBudget-- <= 0) break;
    const px = sx(a.vx), py = sy(a.vy);
    const s = Math.max(1.6, (T / 46) * 2.6);
    const top = py - 19 * s;
    const life = (a.bubble.until - now) / (a.bubble.text ? 10000 : 5500);
    ctx.globalAlpha = life < 0.15 ? life / 0.15 : 1;
    if (a.bubble.text) {
      ctx.font = `500 ${Math.max(10, 3.5 * s)}px ui-sans-serif`;
      const words = a.bubble.text.split(" "); const lines = []; let cur = "";
      for (const w of words) {
        const t2 = cur ? cur + " " + w : w;
        if (ctx.measureText(t2).width > 46 * s && cur) { lines.push(cur); cur = w; } else cur = t2;
        if (lines.length === 3) break;
      }
      if (lines.length < 3 && cur) lines.push(cur);
      const lh = Math.max(12, 4.2 * s);
      const bw = Math.min(50 * s, Math.max(...lines.map(l => ctx.measureText(l).width)) + 14);
      const bh = lines.length * lh + 10;
      ctx.fillStyle = "#fffdf7"; ctx.strokeStyle = "rgba(80,70,50,0.4)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(px - bw / 2, top - bh, bw, bh, 8); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px - 4, top); ctx.lineTo(px, top + 6); ctx.lineTo(px + 4, top);
      ctx.closePath(); ctx.fillStyle = "#fffdf7"; ctx.fill();
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

  if (L.tint !== "rgb(255,255,255)") {
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = L.tint; ctx.fillRect(0, 0, cw, ch);
    ctx.globalCompositeOperation = "source-over";
  }
  if (L.dark > 0.01) {
    ctx.fillStyle = `rgba(10,14,40,${L.dark * 0.55})`; ctx.fillRect(0, 0, cw, ch);
    const g = ctx.createRadialGradient(wx, wy - wr, 0, wx, wy - wr, wr * 3);
    g.addColorStop(0, "rgba(255,200,110,0.30)"); g.addColorStop(1, "rgba(255,200,110,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
  }
  return { sx, sy, T };
}
