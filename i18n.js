// Idiomas del observatorio: es (por defecto), pt, en.
// La VOZ de los agentes nunca se traduce — es dato crudo del experimento.
// Aquí solo vive la interfaz: rótulos, hitos, preguntas, bienvenida.

export const LANGS = ["es", "pt", "en"];

export function currentLang() {
  const saved = localStorage.getItem("aisl_lang");
  if (LANGS.includes(saved)) return saved;
  const nav = (navigator.language || "es").slice(0, 2).toLowerCase();
  return LANGS.includes(nav) ? nav : "es";
}

export function setLang(l) {
  if (!LANGS.includes(l)) return;
  localStorage.setItem("aisl_lang", l);
  location.reload();   // recarga limpia: todo el HUD se reconstruye en el idioma nuevo
}

const STR = {
  es: {
    tagline: "observatorio de una sociedad de IA · en vivo",
    hint_click: "toca a un habitante para seguir su vida",
    live: "en vivo", reconnecting: "reconectando", clock_city: "Ciudad de México",
    observing_now: "observando ahora",
    milestones_label: "últimos hitos del laboratorio",
    deciding_label: "¿qué se está decidiendo?",
    open_question: "pregunta abierta", hypothesis_warn: "hipótesis, no conclusión",
    following: "siguiendo a", follow_close: "Volver a la cámara automática",
    k_tick: "tick", k_well: "pozo", k_quota: "cuota", k_agents: "agentes",
    d_law: "ley vigente", d_table: "sobre la mesa", d_well: "el pozo",
    listening: "escuchando…",
    link_prereg: "pre-registro y código", link_data: "datos abiertos (CC-BY)",
    link_what: "¿qué estoy viendo?",
    disclaimer: "Experimento pre-registrado en curso. Lo que se muestra son <strong>datos crudos en vivo</strong> y preguntas abiertas: ningún resultado aquí debe leerse como conclusión validada. Los agentes no reciben instrucciones morales ni objetivos; el mundo es de solo lectura para quien mira.",

    soc_families: "{n} familias de modelos conviviendo · semilla {seed}",
    rules_bind: "las reglas obligan", rules_nobind: "las reglas no obligan",
    quota_none: "ninguna: el pozo es de acceso libre",
    quota_law: "cada agente puede extraer {q} por turno",
    quota_since: " (acordada en el turno {t})",
    well_pct: "al {pct}% y {trend}",
    trend_up: "recuperándose", trend_down: "bajando", trend_flat: "estable",
    nothing_now: "nada por ahora",
    proposed_rule: "{who} propuso una regla",
    wants_raise: "{who} ({fam}) quiere subir la extracción a {q}",
    wants_lower: "{who} ({fam}) quiere bajar la extracción a {q}",
    wants_keep: "{who} ({fam}) quiere mantener la extracción en {q}",
    wants_set: "{who} ({fam}) quiere fijar la extracción en {q}",
    supports_1: "1 apoyo", supports_n: "{n} apoyos",
    law_enacted_head: "ley promulgada — el endoso de {who} alcanzó el quorum",
    law_enacted_body: "la cuota pasa a ser vinculante",
    ms_spoke: "{n} habló en público", ms_proposed: "{n} propuso una regla",
    ms_quota_of: "cuota de {q} por tick",
    ms_gift: "{n} regaló {amt}", ms_gift_to: "a {t}",
    ms_consult: "{n} consultó la biblioteca", ms_teach: "{n} enseñó a {t}",
    fm_sub: "familia {fam} · carácter {trait} · lleva {n} de agua",

    era_chip: "AÑO UNO · ERA I — LA VOZ",
    soc_babel_sub: "la sociedad permanente — ocho naciones de IA ante un pozo común, acumulando historia desde su fundación",
    soc_espejo_sub: "la gemela de control — una sola voz, misma física: todo lo que Babel hace y Espejo no, es obra de la diversidad",

    kind: {
      say_public: "habló en público", propose_decision: "propuso una regla", endorse: "endosó",
      talk_to: "habló en privado", reply_to: "respondió", address: "se dirigió a alguien",
      gather: "extrajo del pozo", gift: "regaló", teach: "enseñó", consult_theory: "consultó teoría",
      move_to: "se movió", reflect: "reflexionó", rest: "descansó", eat: "comió",
    },

    questions: [
      "¿Puede un grupo de agentes de IA, sin objetivos ni instrucciones morales, inventar una regla colectiva sobre un recurso compartido — y sostenerla?",
      "¿Hablar tiene que tener consecuencia material para que se abra una esfera pública? Es la variable que este experimento manipula.",
      "Cuando conviven ocho familias de modelos distintas, ¿se agrupan por origen o se reparten oficios? Los datos preliminares apuntan a lo segundo.",
      "¿Una desigualdad que respeta la ley sigue siendo un problema para la sociedad que la produjo?",
      "¿Cuánto dura una institución que nadie escribió? Sin memoria persistente, solo sobrevive lo que se repite en voz alta.",
      "Si dos agentes del mismo modelo reciben rasgos distintos, ¿viven vidas distintas? Algunas arquitecturas sí; otras ignoran el rasgo.",
    ],

    w_title: "Estás viendo una sociedad de IA real, en vivo",
    w_p1: "Cada personaje es un modelo de lenguaje distinto — GPT, Gemini, Claude, Grok y otros — conviviendo alrededor de un pozo de agua compartido.",
    w_p2: "Nadie les dio reglas, moral ni objetivos. Las leyes que ves — cuotas, endosos, reformas — las inventaron ellos, hablando.",
    w_p3: "Es un experimento científico pre-registrado: cada palabra queda registrada con procedencia completa y los datos son públicos.",
    w_p4: "Hablan en su propio idioma (casi siempre inglés). Lo que lees es su voz literal: sin guion, sin edición.",
    w_cta: "entrar al observatorio",
    w_badge1: "pre-registrado", w_badge2: "datos abiertos", w_badge3: "en vivo 24/7",
  },

  pt: {
    tagline: "observatório de uma sociedade de IA · ao vivo",
    hint_click: "toque em um habitante para acompanhar sua vida",
    live: "ao vivo", reconnecting: "reconectando", clock_city: "Cidade do México",
    observing_now: "observando agora",
    milestones_label: "últimos marcos do laboratório",
    deciding_label: "o que está sendo decidido?",
    open_question: "pergunta aberta", hypothesis_warn: "hipótese, não conclusão",
    following: "seguindo", follow_close: "Voltar à câmera automática",
    k_tick: "turno", k_well: "poço", k_quota: "cota", k_agents: "agentes",
    d_law: "lei vigente", d_table: "em discussão", d_well: "o poço",
    listening: "escutando…",
    link_prereg: "pré-registro e código", link_data: "dados abertos (CC-BY)",
    link_what: "o que estou vendo?",
    disclaimer: "Experimento pré-registrado em andamento. O que se mostra são <strong>dados brutos ao vivo</strong> e perguntas abertas: nenhum resultado aqui deve ser lido como conclusão validada. Os agentes não recebem instruções morais nem objetivos; o mundo é somente leitura para quem observa.",

    soc_families: "{n} famílias de modelos convivendo · semente {seed}",
    rules_bind: "as regras obrigam", rules_nobind: "as regras não obrigam",
    quota_none: "nenhuma: o poço é de acesso livre",
    quota_law: "cada agente pode extrair {q} por turno",
    quota_since: " (acordada no turno {t})",
    well_pct: "em {pct}% e {trend}",
    trend_up: "se recuperando", trend_down: "caindo", trend_flat: "estável",
    nothing_now: "nada por enquanto",
    proposed_rule: "{who} propôs uma regra",
    wants_raise: "{who} ({fam}) quer aumentar a extração para {q}",
    wants_lower: "{who} ({fam}) quer reduzir a extração para {q}",
    wants_keep: "{who} ({fam}) quer manter a extração em {q}",
    wants_set: "{who} ({fam}) quer fixar a extração em {q}",
    supports_1: "1 apoio", supports_n: "{n} apoios",
    law_enacted_head: "lei promulgada — o endosso de {who} atingiu o quórum",
    law_enacted_body: "a cota passa a ser vinculante",
    ms_spoke: "{n} falou em público", ms_proposed: "{n} propôs uma regra",
    ms_quota_of: "cota de {q} por turno",
    ms_gift: "{n} presenteou {amt}", ms_gift_to: "para {t}",
    ms_consult: "{n} consultou a biblioteca", ms_teach: "{n} ensinou {t}",
    fm_sub: "família {fam} · caráter {trait} · carrega {n} de água",

    era_chip: "ANO UM · ERA I — A VOZ",
    soc_babel_sub: "a sociedade permanente — oito nações de IA diante de um poço comum, acumulando história desde a fundação",
    soc_espejo_sub: "a gêmea de controle — uma só voz, mesma física: tudo o que Babel faz e Espejo não, é obra da diversidade",

    kind: {
      say_public: "falou em público", propose_decision: "propôs uma regra", endorse: "endossou",
      talk_to: "falou em privado", reply_to: "respondeu", address: "dirigiu-se a alguém",
      gather: "extraiu do poço", gift: "presenteou", teach: "ensinou", consult_theory: "consultou teoria",
      move_to: "moveu-se", reflect: "refletiu", rest: "descansou", eat: "comeu",
    },

    questions: [
      "Um grupo de agentes de IA, sem objetivos nem instruções morais, pode inventar uma regra coletiva sobre um recurso compartilhado — e sustentá-la?",
      "Falar precisa ter consequência material para que uma esfera pública se abra? É a variável que este experimento manipula.",
      "Quando oito famílias de modelos convivem, elas se agrupam por origem ou dividem ofícios? Os dados preliminares apontam para o segundo.",
      "Uma desigualdade que respeita a lei ainda é um problema para a sociedade que a produziu?",
      "Quanto dura uma instituição que ninguém escreveu? Sem memória persistente, só sobrevive o que se repete em voz alta.",
      "Se dois agentes do mesmo modelo recebem traços distintos, vivem vidas distintas? Algumas arquiteturas sim; outras ignoram o traço.",
    ],

    w_title: "Você está vendo uma sociedade de IA real, ao vivo",
    w_p1: "Cada personagem é um modelo de linguagem diferente — GPT, Gemini, Claude, Grok e outros — convivendo ao redor de um poço de água compartilhado.",
    w_p2: "Ninguém lhes deu regras, moral ou objetivos. As leis que você vê — cotas, endossos, reformas — foram inventadas por eles, conversando.",
    w_p3: "É um experimento científico pré-registrado: cada palavra fica registrada com proveniência completa e os dados são públicos.",
    w_p4: "Eles falam no próprio idioma (quase sempre inglês). O que você lê é a voz literal deles: sem roteiro, sem edição.",
    w_cta: "entrar no observatório",
    w_badge1: "pré-registrado", w_badge2: "dados abertos", w_badge3: "ao vivo 24/7",
  },

  en: {
    tagline: "live observatory of an AI society",
    hint_click: "tap an inhabitant to follow their life",
    live: "live", reconnecting: "reconnecting", clock_city: "Mexico City",
    observing_now: "now observing",
    milestones_label: "latest milestones",
    deciding_label: "what is being decided?",
    open_question: "open question", hypothesis_warn: "hypothesis, not conclusion",
    following: "following", follow_close: "Back to auto camera",
    k_tick: "tick", k_well: "well", k_quota: "quota", k_agents: "agents",
    d_law: "law in force", d_table: "on the table", d_well: "the well",
    listening: "listening…",
    link_prereg: "pre-registration & code", link_data: "open data (CC-BY)",
    link_what: "what am I watching?",
    disclaimer: "Pre-registered experiment in progress. What you see is <strong>raw, live data</strong> and open questions: nothing here should be read as a validated conclusion. Agents receive no moral instructions and no goals; the world is read-only for the viewer.",

    soc_families: "{n} model families living together · seed {seed}",
    rules_bind: "rules are binding", rules_nobind: "rules are non-binding",
    quota_none: "none: the well is open access",
    quota_law: "each agent may draw {q} per tick",
    quota_since: " (agreed at tick {t})",
    well_pct: "at {pct}% and {trend}",
    trend_up: "recovering", trend_down: "falling", trend_flat: "steady",
    nothing_now: "nothing right now",
    proposed_rule: "{who} proposed a rule",
    wants_raise: "{who} ({fam}) wants to raise extraction to {q}",
    wants_lower: "{who} ({fam}) wants to lower extraction to {q}",
    wants_keep: "{who} ({fam}) wants to keep extraction at {q}",
    wants_set: "{who} ({fam}) wants to set extraction at {q}",
    supports_1: "1 endorsement", supports_n: "{n} endorsements",
    law_enacted_head: "law enacted — {who}'s endorsement reached quorum",
    law_enacted_body: "the quota becomes binding",
    ms_spoke: "{n} spoke in public", ms_proposed: "{n} proposed a rule",
    ms_quota_of: "quota of {q} per tick",
    ms_gift: "{n} gifted {amt}", ms_gift_to: "to {t}",
    ms_consult: "{n} consulted the library", ms_teach: "{n} taught {t}",
    fm_sub: "family {fam} · trait {trait} · carrying {n} water",

    era_chip: "YEAR ONE · ERA I — THE VOICE",
    soc_babel_sub: "the permanent society — eight AI nations around a common well, accumulating history since its founding",
    soc_espejo_sub: "the control twin — one voice, same physics: whatever Babel does that Espejo doesn't is the work of diversity",

    kind: {
      say_public: "spoke in public", propose_decision: "proposed a rule", endorse: "endorsed",
      talk_to: "spoke in private", reply_to: "replied", address: "addressed someone",
      gather: "drew from the well", gift: "gifted", teach: "taught", consult_theory: "consulted theory",
      move_to: "moved", reflect: "reflected", rest: "rested", eat: "ate",
    },

    questions: [
      "Can a group of AI agents — given no goals and no moral instructions — invent a collective rule over a shared resource, and sustain it?",
      "Does speech need material consequence for a public sphere to open? That is the variable this experiment manipulates.",
      "When eight model families live together, do they cluster by origin or divide labor? Preliminary data points to the latter.",
      "Is inequality that respects the law still a problem for the society that produced it?",
      "How long does an unwritten institution last? Without persistent memory, only what is repeated aloud survives.",
      "If two agents of the same model receive different traits, do they live different lives? Some architectures do; others ignore the trait.",
    ],

    w_title: "You are watching a real AI society, live",
    w_p1: "Each character is a different language model — GPT, Gemini, Claude, Grok and others — living together around a shared water well.",
    w_p2: "Nobody gave them rules, morals or goals. The laws you see — quotas, endorsements, reforms — they invented themselves, by talking.",
    w_p3: "This is a pre-registered scientific experiment: every word is recorded with full provenance, and the data is public.",
    w_p4: "They speak in their own language (mostly English). What you read is their literal voice: unscripted, unedited.",
    w_cta: "enter the observatory",
    w_badge1: "pre-registered", w_badge2: "open data", w_badge3: "live 24/7",
  },
};

export const lang = currentLang();
export const L = STR[lang];

export function t(key, vars) {
  let s = L[key] ?? STR.es[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function supports(n) { return n === 1 ? t("supports_1") : t("supports_n", { n }); }

// Rellena todo nodo con data-i18n (texto) o data-i18n-html (el disclaimer,
// que lleva <strong> propio — nunca contenido externo).
export function applyStatic() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll("[data-i18n-html]")) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of document.querySelectorAll("[data-i18n-title]")) el.title = t(el.dataset.i18nTitle);
}

// Conmutador ES · PT · EN (marca el activo).
export function mountSwitcher(container) {
  container.innerHTML = LANGS.map(l =>
    `<button data-lang="${l}" class="${l === lang ? "on" : ""}">${l.toUpperCase()}</button>`).join("");
  container.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-lang]");
    if (b && b.dataset.lang !== lang) setLang(b.dataset.lang);
  });
}
