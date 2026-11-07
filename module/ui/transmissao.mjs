/**
 * Modo transmissão: uma tela só com os cards dos personagens, sobre fundo transparente,
 * para usar como fonte de navegador no OBS. Rosto, nome do personagem e de quem joga, PV,
 * PD, pavor e condições; quando a pessoa rola, o card acende com os dados desenhados, o
 * total e o desfecho.
 *
 * Entra no modo quem abre o jogo como o usuário de transmissão (escolhido na janela de
 * configuração, que também o cria) ou com `?op2-transmissao` na URL. A transmissão só vê
 * o que um jogador veria: sussurro e rolagem cega nunca aparecem, porque o filtro é o
 * `message.isContentVisible` do próprio usuário (não `visible`: ver `aoChegarMensagem`).
 */
import { SYSTEM_ID } from "../config.mjs";
import { iconeResultado } from "./dice-icons.mjs";
import { cenaAcaoAtiva, personagensDosJogadores } from "../vigilia/cena-acao.mjs";
import { jaAgiu } from "../vigilia/combate.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const CHAVE = "transmissao";
const TEMPLATE = `systems/${SYSTEM_ID}/templates/ui/transmissao.hbs`;
const PARAMETRO = "op2-transmissao";
const POSICOES = ["top-left", "top-right", "bottom-left", "bottom-right", "top-center", "bottom-center"];
// Quanto tempo o card fica aceso com a rolagem.
const TEMPO_DA_ROLAGEM = 9000;

const ESTILOS = ["cartao", "livre"];
const PADRAO = { usuario: "", posicao: "top-left", direcao: "coluna", escala: 1, condicoes: true, estilo: "cartao", atores: [] };

export const configDaTransmissao = () => ({ ...PADRAO, ...(game.settings.get(SYSTEM_ID, CHAVE) ?? {}) });

let elemento = null;
let pendente = null;
const acesas = new Map();

/** Esta tela é a transmissão? Pela URL ou por ser o usuário escolhido. */
export function ehTransmissao() {
  if (new URLSearchParams(globalThis.location?.search ?? "").has(PARAMETRO)) return true;
  const { usuario } = configDaTransmissao();
  return Boolean(usuario) && game.user?.id === usuario;
}

/**
 * O estilo desta tela: o da URL (`?op2-transmissao=livre`) ganha do configurado, para o OBS ter
 * duas fontes, uma de cada estilo, ao mesmo tempo.
 *   cartao — o card com fundo, borda e barras de PV/PD;
 *   livre  — sem fundo nenhum: o avatar (PNG transparente) solto e PV/PD só em texto.
 */
function estiloDaTela(cfg) {
  const daUrl = new URLSearchParams(globalThis.location?.search ?? "").get(PARAMETRO);
  if (ESTILOS.includes(daUrl)) return daUrl;
  return ESTILOS.includes(cfg.estilo) ? cfg.estilo : PADRAO.estilo;
}

/** Quem aparece: os escolhidos, ou os personagens de quem joga. */
function atoresDaTransmissao(cfg) {
  const escolhidos = (cfg.atores ?? []).map((id) => game.actors.get(id)).filter(Boolean);
  return escolhidos.length ? escolhidos : personagensDosJogadores();
}

/** Quem joga com o ator: quem o escolheu como personagem ou é dono dele (fora o mestre e a transmissão). */
export function jogadoresDe(ator, cfg = configDaTransmissao()) {
  return game.users
    .filter((u) => !u.isGM && u.id !== cfg.usuario
      && (u.character?.id === ator.id || ator.testUserPermission(u, "OWNER")))
    .map((u) => u.name);
}

const barra = (recurso) => {
  const { value = 0, max = 0 } = recurso ?? {};
  return { value, max, pct: max ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0 };
};

function contexto() {
  const cfg = configDaTransmissao();
  const cena = cenaAcaoAtiva();
  const noAr = cena?.system.ativa ? cena : null;
  const cards = atoresDaTransmissao(cfg).map((ator) => {
    const estado = ator.system.estado ?? {};
    const condicoes = cfg.condicoes ? [...(estado.condicoes ?? [])].map((c) => game.i18n.localize(`OP2.Condicao.${c}`)) : [];
    return {
      id: ator.id,
      nome: ator.name,
      img: ator.img,
      jogadores: jogadoresDe(ator, cfg).join(", "),
      pv: barra(ator.system.recursos?.pv),
      pd: barra(ator.system.recursos?.pd),
      pavor: cfg.condicoes ? (estado.pavor ?? "") : "",
      condicoes,
      temEstado: Boolean(cfg.condicoes && (estado.pavor || condicoes.length)),
      caido: (ator.system.recursos?.pv?.value ?? 1) <= 0,
      agiu: noAr ? jaAgiu(noAr.system.agiram, ator.uuid) : false,
    };
  });
  return {
    cards,
    livre: estiloDaTela(cfg) === "livre",
    cena: noAr ? {
      tipo: game.i18n.localize(`OP2.CenaAcao.Tipo.${noAr.system.tipo}`),
      fase: noAr.system.fase ? game.i18n.localize(`OP2.Fase.${noAr.system.fase}`) : "",
      rodada: noAr.system.rodada,
    } : null,
  };
}

function aplicarLayout(el, cfg) {
  el.dataset.posicao = POSICOES.includes(cfg.posicao) ? cfg.posicao : PADRAO.posicao;
  el.dataset.direcao = cfg.direcao === "linha" ? "linha" : "coluna";
  el.dataset.estilo = estiloDaTela(cfg);
  el.style.setProperty("--op2-transmissao-escala", String(Number(cfg.escala) || 1));
}

export function atualizarTransmissao() {
  if (!elemento || pendente) return;
  pendente = setTimeout(async () => {
    pendente = null;
    const render = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
    elemento.innerHTML = await render(TEMPLATE, contexto());
    aplicarLayout(elemento, configDaTransmissao());
    // O que estava aceso continua aceso depois do redesenho.
    for (const [id, html] of acesas) {
      const card = elemento.querySelector(`[data-ator-id="${CSS.escape(id)}"]`);
      if (!card) continue;
      card.classList.add("op2-transmissao__card--rolou");
      card.querySelector(".op2-transmissao__rolagem")?.remove();
      card.insertAdjacentHTML("beforeend", html);
    }
  }, 80);
}

/** Uma linha da rolagem: os dados desenhados, o total e o desfecho. Montada da rolagem, não do HTML do chat. */
export function rolagemEmHtml(mensagem) {
  const roll = mensagem.rolls?.[0];
  if (!roll?._evaluated && roll?.total === undefined) return "";
  const escapar = (t) => foundry.utils.escapeHTML(String(t ?? ""));
  const dados = Array.isArray(roll.dados) && roll.dados.length
    ? roll.dados.map((d) => iconeResultado({ dado: d.dado, resultado: d.resultado, contado: d.contado && !d.anulado }))
    : roll.dice.flatMap((termo) => termo.results.map((r) => iconeResultado({ dado: `d${termo.faces}`, resultado: r.result, contado: r.active !== false })));
  let desfecho = "";
  if (roll.critico) desfecho = "Critico";
  else if (roll.falhaCritica) desfecho = "FalhaCritica";
  else if (roll.sucesso === true) desfecho = "Sucesso";
  else if (roll.sucesso === false) desfecho = "Falha";
  // O título é o rótulo do card, lido como texto: nada do HTML da mensagem entra na tela.
  const titulo = new DOMParser().parseFromString(mensagem.content ?? "", "text/html")
    .querySelector(".op2-tag")?.textContent.replace(/\s+/g, " ").trim() || mensagem.flavor || roll.formula;
  return `<div class="op2-transmissao__rolagem${desfecho ? ` op2-transmissao__rolagem--${desfecho.toLowerCase()}` : ""}">
    <span class="op2-transmissao__rolagem-titulo">${escapar(titulo)}</span>
    <span class="op2-transmissao__rolagem-dados">${dados.join("")}<span class="op2-transmissao__total">= ${escapar(roll.total)}</span></span>
    ${desfecho ? `<strong class="op2-transmissao__desfecho">${escapar(game.i18n.localize(`OP2.Transmissao.${desfecho}`))}</strong>` : ""}
  </div>`;
}

function aoChegarMensagem(mensagem) {
  // Só o que esta tela pode LER: `visible` é verdadeiro para rolagem sussurrada (o jogador vê
  // que houve uma rolagem secreta, não o resultado) — o filtro é `isContentVisible`, que também
  // barra a rolagem cega. Achado pelo teste de dois clientes: o sussurro acendia o card.
  if (!elemento || !mensagem.isContentVisible || mensagem.blind || !mensagem.rolls?.length) return;
  const ator = ChatMessage.getSpeakerActor(mensagem.speaker);
  const id = ator?.isToken ? ator.token?.actorId ?? ator.id : ator?.id;
  const card = id && elemento.querySelector(`[data-ator-id="${CSS.escape(id)}"]`);
  if (!card) return;
  const html = rolagemEmHtml(mensagem);
  if (!html) return;
  acesas.set(id, html);
  card.querySelector(".op2-transmissao__rolagem")?.remove();
  card.insertAdjacentHTML("beforeend", html);
  card.classList.add("op2-transmissao__card--rolou");
  clearTimeout(card._op2Timer);
  setTimeout(() => {
    if (acesas.get(id) !== html) return;
    acesas.delete(id);
    const atual = elemento?.querySelector(`[data-ator-id="${CSS.escape(id)}"]`);
    atual?.classList.remove("op2-transmissao__card--rolou");
    atual?.querySelector(".op2-transmissao__rolagem")?.remove();
  }, TEMPO_DA_ROLAGEM);
}

/** Liga o modo nesta tela: some a interface, sobram os cards. */
export function ativarTransmissao() {
  document.body.classList.add("op2-transmissao-modo");
  elemento = document.createElement("section");
  elemento.id = "op2-transmissao";
  elemento.className = "op2 op2-transmissao";
  document.body.append(elemento);
  for (const gatilho of ["updateActor", "createActor", "deleteActor", "updateUser", "createToken", "deleteToken", "updateToken"]) {
    Hooks.on(gatilho, atualizarTransmissao);
  }
  Hooks.on("createChatMessage", aoChegarMensagem);
  atualizarTransmissao();
  console.log(`${SYSTEM_ID} | modo transmissão ativo`);
}

/** O usuário "Transmissão", que o OBS usa para entrar. */
async function criarUsuario() {
  const nome = game.i18n.localize("OP2.Transmissao.NomeUsuario");
  const existente = game.users.find((u) => !u.isGM && u.name === nome);
  return existente ?? CONFIG.User.documentClass.create({ name: nome, role: CONST.USER_ROLES.PLAYER });
}

/** Dá à transmissão permissão de observador nos personagens que ela mostra. */
async function darAcesso(cfg) {
  const usuario = game.users.get(cfg.usuario);
  if (!usuario) return 0;
  const alvos = atoresDaTransmissao(cfg).filter((a) => !a.testUserPermission(usuario, "OBSERVER"));
  for (const ator of alvos) await ator.update({ [`ownership.${usuario.id}`]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER });
  return alvos.length;
}

/** A janela de configuração: usuário, posição, direção, escala, o que mostrar, quem aparece. */
export class TransmissaoApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "op2-transmissao-config",
    classes: ["op2", "op2-transmissao-config"],
    tag: "form",
    window: { title: "OP2.Transmissao.Titulo", icon: "fa-solid fa-tower-broadcast" },
    position: { width: 520, height: "auto" },
    form: { handler: TransmissaoApp.#salvar, closeOnSubmit: false, submitOnChange: false },
    actions: { criarUsuario: TransmissaoApp.#criarUsuario, darAcesso: TransmissaoApp.#darAcesso },
  };

  static PARTS = { corpo: { template: `systems/${SYSTEM_ID}/templates/ui/transmissao-config.hbs` } };

  async _prepareContext() {
    const cfg = configDaTransmissao();
    const marcados = new Set(cfg.atores);
    const enderecoBase = `${globalThis.location?.origin ?? ""}`;
    return {
      cfg,
      direcaoLinha: cfg.direcao === "linha",
      usuarios: game.users.filter((u) => !u.isGM).map((u) => ({ id: u.id, nome: u.name, atual: u.id === cfg.usuario })),
      estilos: ESTILOS.map((e) => ({ valor: e, rotulo: game.i18n.localize(`OP2.Transmissao.Estilo.${e}`), atual: e === cfg.estilo })),
      enderecoLivre: `${enderecoBase}/game?${PARAMETRO}=livre`,
      posicoes: POSICOES.map((p) => ({ valor: p, rotulo: game.i18n.localize(`OP2.Transmissao.Posicao.${p}`), atual: p === cfg.posicao })),
      personagens: game.actors.filter((a) => a.type === "personagem")
        .map((a) => ({ id: a.id, nome: a.name, marcado: marcados.has(a.id), jogadores: jogadoresDe(a, cfg).join(", ") }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      enderecoLogin: `${enderecoBase}/join`,
      enderecoDireto: `${enderecoBase}/game?${PARAMETRO}`,
    };
  }

  static async #salvar(_evento, _form, dados) {
    const d = foundry.utils.expandObject(dados.object);
    const atores = Object.entries(d.atores ?? {}).filter(([, v]) => v).map(([id]) => id);
    await game.settings.set(SYSTEM_ID, CHAVE, {
      usuario: d.usuario ?? "", posicao: d.posicao ?? PADRAO.posicao, direcao: d.direcao ?? PADRAO.direcao,
      escala: Math.min(2, Math.max(0.5, Number(d.escala) || 1)), condicoes: Boolean(d.condicoes), atores,
      estilo: ESTILOS.includes(d.estilo) ? d.estilo : PADRAO.estilo,
    });
    ui.notifications.info(game.i18n.localize("OP2.Transmissao.Salvo"));
    this.render();
  }

  static async #criarUsuario() {
    const usuario = await criarUsuario();
    await game.settings.set(SYSTEM_ID, CHAVE, { ...configDaTransmissao(), usuario: usuario.id });
    this.render();
  }

  static async #darAcesso() {
    const n = await darAcesso(configDaTransmissao());
    ui.notifications.info(game.i18n.format("OP2.Transmissao.AcessoDado", { n }));
  }
}

export function registrarTransmissao() {
  game.settings.register(SYSTEM_ID, CHAVE, {
    scope: "world", config: false, type: Object, default: PADRAO,
    onChange: () => atualizarTransmissao(),
  });
  game.settings.registerMenu(SYSTEM_ID, "transmissaoMenu", {
    name: "OP2.Transmissao.MenuNome",
    label: "OP2.Transmissao.MenuBotao",
    hint: "OP2.Transmissao.MenuAjuda",
    icon: "fa-solid fa-tower-broadcast",
    type: TransmissaoApp,
    restricted: true,
  });
  Hooks.once("ready", () => {
    if (ehTransmissao()) ativarTransmissao();
  });
}
