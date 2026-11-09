/**
 * Efeitos de mesa: som e luz quando algo acontece. O dado de pavor bate como um coração e
 * escurece a borda da tela; crítico toca um sino e doura o card; falha crítica desafina e
 * treme; dano é um baque e um clarão vermelho em quem apanhou; a cena que começa rufa um
 * tambor, e cada fase nova atravessa a tela com o nome dela e um gongo.
 *
 * Tudo é local: cada cliente toca o seu, a partir do que chega (a mensagem do chat, o update
 * da cena e do ator). Rolagem que o cliente não pode ler não dispara nada — o filtro é o
 * `isContentVisible`, como na transmissão. O som é sintetizado no navegador (Web Audio): nenhum
 * arquivo, nada a licenciar. Cada pessoa liga, desliga e regula o volume; quem pede menos
 * movimento no sistema fica sem tremer e sem pulsar.
 */
import { SYSTEM_ID } from "../config.mjs";

const AJUSTES = {
  efeitosVisuais: { type: Boolean, default: true },
  efeitosSonoros: { type: Boolean, default: true },
  volumeEfeitos: { type: Number, default: 0.6, range: { min: 0, max: 1, step: 0.05 } },
};

const ler = (chave) => {
  try { return game.settings.get(SYSTEM_ID, chave); } catch { return AJUSTES[chave].default; }
};
const menosMovimento = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

// ── Som ──────────────────────────────────────────────────────────────────────────────────
let contexto = null;

function audio() {
  if (!ler("efeitosSonoros") || ler("volumeEfeitos") <= 0) return null;
  const Classe = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Classe) return null;
  contexto ??= new Classe();
  if (contexto.state === "suspended") contexto.resume().catch(() => {});
  return contexto;
}

/** Um tom com envelope: ataque curto, queda exponencial. */
function tom(ctx, destino, { freq, freqFinal, tipo = "sine", inicio = 0, duracao = 0.5, ganho = 0.5 }) {
  const t = ctx.currentTime + inicio;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, t);
  if (freqFinal) osc.frequency.exponentialRampToValueAtTime(freqFinal, t + duracao);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(ganho, t + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duracao);
  osc.connect(env).connect(destino);
  osc.start(t);
  osc.stop(t + duracao + 0.05);
}

/** Um sopro de ruído filtrado: pele de tambor, baque. */
function ruido(ctx, destino, { inicio = 0, duracao = 0.2, corte = 600, ganho = 0.4 }) {
  const t = ctx.currentTime + inicio;
  const tamanho = Math.ceil(ctx.sampleRate * duracao);
  const buffer = ctx.createBuffer(1, tamanho, ctx.sampleRate);
  const canal = buffer.getChannelData(0);
  for (let i = 0; i < tamanho; i++) canal[i] = (Math.random() * 2 - 1) * (1 - i / tamanho);
  const fonte = ctx.createBufferSource();
  fonte.buffer = buffer;
  const filtro = ctx.createBiquadFilter();
  filtro.type = "lowpass";
  filtro.frequency.value = corte;
  const env = ctx.createGain();
  env.gain.setValueAtTime(ganho, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duracao);
  fonte.connect(filtro).connect(env).connect(destino);
  fonte.start(t);
}

const SONS = {
  // Pavor: um coração, tum-tum, duas vezes.
  coracao(ctx, saida) {
    for (const base of [0, 0.75]) {
      tom(ctx, saida, { freq: 70, freqFinal: 40, inicio: base, duracao: 0.22, ganho: 0.9 });
      tom(ctx, saida, { freq: 60, freqFinal: 35, inicio: base + 0.2, duracao: 0.2, ganho: 0.6 });
    }
  },
  // Pavor vencido: um respiro claro.
  alivio(ctx, saida) {
    tom(ctx, saida, { freq: 523, duracao: 0.9, ganho: 0.18 });
    tom(ctx, saida, { freq: 784, inicio: 0.08, duracao: 1.1, ganho: 0.14 });
  },
  sino(ctx, saida) {
    for (const [freq, ganho] of [[880, 0.3], [1320, 0.18], [1760, 0.12], [2640, 0.06]]) {
      tom(ctx, saida, { freq, duracao: 1.6, ganho });
    }
  },
  dissonante(ctx, saida) {
    tom(ctx, saida, { freq: 196, freqFinal: 150, tipo: "sawtooth", duracao: 0.9, ganho: 0.12 });
    tom(ctx, saida, { freq: 208, freqFinal: 158, tipo: "sawtooth", duracao: 0.9, ganho: 0.12 });
    ruido(ctx, saida, { duracao: 0.3, corte: 300, ganho: 0.25 });
  },
  impacto(ctx, saida) {
    ruido(ctx, saida, { duracao: 0.25, corte: 500, ganho: 0.6 });
    tom(ctx, saida, { freq: 130, freqFinal: 45, duracao: 0.3, ganho: 0.7 });
  },
  tambor(ctx, saida) {
    for (const inicio of [0, 0.22, 0.44]) {
      ruido(ctx, saida, { inicio, duracao: 0.18, corte: 250, ganho: 0.5 });
      tom(ctx, saida, { freq: 95, freqFinal: 55, inicio, duracao: 0.25, ganho: 0.6 });
    }
  },
  gongo(ctx, saida) {
    for (const [freq, ganho] of [[110, 0.35], [166, 0.18], [221, 0.12], [331, 0.06]]) {
      tom(ctx, saida, { freq, duracao: 2.2, ganho });
    }
  },
};

export function tocar(nome) {
  const ctx = audio();
  if (!ctx || !SONS[nome]) return;
  const saida = ctx.createGain();
  saida.gain.value = ler("volumeEfeitos");
  saida.connect(ctx.destination);
  SONS[nome](ctx, saida);
}

// ── Luz ──────────────────────────────────────────────────────────────────────────────────
function camada() {
  let el = document.getElementById("op2-efeitos");
  if (!el) {
    el = document.createElement("div");
    el.id = "op2-efeitos";
    el.className = "op2 op2-efeitos";
    el.setAttribute("aria-hidden", "true");
    document.body.append(el);
  }
  return el;
}

/** Um efeito de tela inteira que se apaga sozinho. */
function tela(classe, { texto = "", duracao = 1800 } = {}) {
  if (!ler("efeitosVisuais")) return;
  const el = document.createElement("div");
  el.className = `op2-efeito ${classe}${menosMovimento() ? " op2-efeito--quieto" : ""}`;
  if (texto) {
    const faixa = document.createElement("span");
    faixa.textContent = texto;
    el.append(faixa);
  }
  camada().append(el);
  setTimeout(() => el.remove(), duracao);
}

/** Marca um elemento por um instante (o card do chat, a figura do palco, o card da transmissão). */
function marcar(elementos, classe, duracao = 1400) {
  if (!ler("efeitosVisuais")) return;
  for (const el of elementos) {
    el.classList.remove(classe);
    void el.offsetWidth;
    el.classList.add(classe);
    if (menosMovimento()) el.classList.add("op2-efeito--quieto");
    setTimeout(() => el.classList.remove(classe, "op2-efeito--quieto"), duracao);
  }
}

// ── Quando ───────────────────────────────────────────────────────────────────────────────
/** As mensagens criadas depois do carregamento: só elas disparam (o histórico não toca). */
const novas = new Map();

/** O que uma rolagem pede, lido da própria rolagem. */
export function efeitosDaRolagem(roll) {
  if (!roll) return [];
  const efeitos = [];
  const dados = Array.isArray(roll.dados) ? roll.dados : [];
  if (dados.some((d) => d.pavor)) efeitos.push(roll.pavorVencido ? "pavorVencido" : "pavor");
  if (roll.critico) efeitos.push("critico");
  else if (roll.falhaCritica) efeitos.push("falhaCritica");
  return efeitos;
}

function aoChegarMensagem(mensagem) {
  if (!mensagem.isContentVisible) return;
  const efeitos = efeitosDaRolagem(mensagem.rolls?.[0]);
  if (mensagem.getFlag(SYSTEM_ID, "tipo") === "falha-critica" && !efeitos.includes("falhaCritica")) efeitos.push("falhaCritica");
  if (!efeitos.length) return;
  novas.set(mensagem.id, efeitos);
  if (efeitos.includes("pavor")) { tocar("coracao"); tela("op2-efeito--pavor", { duracao: 1800 }); }
  if (efeitos.includes("pavorVencido")) { tocar("alivio"); tela("op2-efeito--alivio", { duracao: 1400 }); }
  if (efeitos.includes("critico")) tocar("sino");
  if (efeitos.includes("falhaCritica")) tocar("dissonante");
}

/** O card aparece no chat depois do hook de criação: o brilho e o tremor entram aqui. */
function aoDesenharMensagem(mensagem, html) {
  const efeitos = novas.get(mensagem.id);
  if (!efeitos) return;
  novas.delete(mensagem.id);
  const raiz = html instanceof HTMLElement ? html : html?.[0];
  const card = raiz?.querySelector?.(".op2-card") ?? raiz;
  if (!card) return;
  if (efeitos.includes("critico")) marcar([card], "op2-efeito--critico", 2200);
  if (efeitos.includes("falhaCritica")) marcar([card], "op2-efeito--falha", 900);
}

/** PV de quem já foi visto, para saber se o update foi dano. */
const pvs = new Map();

function aoMudarPv(ator) {
  if (!ator?.system?.recursos?.pv) return;
  const atual = ator.system.recursos.pv.value;
  const antes = pvs.get(ator.uuid);
  pvs.set(ator.uuid, atual);
  if (antes === undefined || atual >= antes) return;
  tocar("impacto");
  const id = CSS.escape(ator.uuid);
  const idDoAtor = CSS.escape(ator.isToken ? ator.token?.actorId ?? ator.id : ator.id);
  // O mesmo update redesenha o painel, o palco e a transmissão, e o redesenho troca os
  // elementos: marcar na hora perdia o pisca. Marca depois que eles se refazem.
  setTimeout(() => marcar([
    ...document.querySelectorAll(`.op2-palco__figura[data-ator="${id}"]`),
    ...document.querySelectorAll(`.op2-linha-acao[data-ator="${id}"]`),
    ...document.querySelectorAll(`#op2-transmissao [data-ator-id="${idDoAtor}"]`),
  ], "op2-efeito--dano", 900), 250);
}

const lembrarPv = (ator) => {
  if (ator?.system?.recursos?.pv) pvs.set(ator.uuid, ator.system.recursos.pv.value);
};

function aoMudarCena(cena, mudou) {
  const sistema = mudou.system ?? {};
  if (sistema.ativa === true) {
    tocar("tambor");
    const fase = cena.system.fase ? ` · ${game.i18n.localize(`OP2.Fase.${cena.system.fase}`)}` : "";
    tela("op2-efeito--faixa", { texto: `${game.i18n.localize(`OP2.CenaAcao.Tipo.${cena.system.tipo}`)}${fase}`, duracao: 2200 });
    return;
  }
  if (!cena.system.ativa) return;
  if (sistema.fase !== undefined && cena.system.fase) {
    tocar("gongo");
    const rodada = game.i18n.format("OP2.CenaAcao.RodadaCurta", { n: cena.system.rodada });
    tela("op2-efeito--faixa", { texto: `${game.i18n.localize(`OP2.Fase.${cena.system.fase}`)} · ${rodada}`, duracao: 2000 });
  } else if (sistema.rodada !== undefined && cena.system.tipo !== "combate") {
    tocar("gongo");
    tela("op2-efeito--faixa", { texto: game.i18n.format("OP2.CenaAcao.RodadaCurta", { n: cena.system.rodada }), duracao: 2000 });
  }
}

export function registrarEfeitos() {
  for (const [chave, dados] of Object.entries(AJUSTES)) {
    game.settings.register(SYSTEM_ID, chave, {
      name: `OP2.Efeitos.${chave}.nome`, hint: `OP2.Efeitos.${chave}.ajuda`,
      scope: "client", config: true, ...dados,
    });
  }
  Hooks.once("ready", () => {
    for (const ator of game.actors) lembrarPv(ator);
    for (const token of canvas?.scene?.tokens ?? []) lembrarPv(token.actor);
    // Ator criado depois de a tela abrir: sem o PV de antes, o primeiro dano passava em branco.
    Hooks.on("createActor", lembrarPv);
    Hooks.on("canvasReady", () => { for (const token of canvas.scene?.tokens ?? []) lembrarPv(token.actor); });
    Hooks.on("createChatMessage", aoChegarMensagem);
    Hooks.on("renderChatMessageHTML", aoDesenharMensagem);
    Hooks.on("updateActor", (ator, mudou) => {
      if (ator.type === "cena-acao") return aoMudarCena(ator, mudou);
      if (mudou.system?.recursos?.pv !== undefined) aoMudarPv(ator);
    });
    // Token sem vínculo: o PV muda no delta do token.
    Hooks.on("updateToken", (token, mudou) => {
      if (mudou.delta?.system?.recursos?.pv !== undefined && token.actor) aoMudarPv(token.actor);
    });
    Hooks.on("createToken", (token) => lembrarPv(token.actor));
  });
}
