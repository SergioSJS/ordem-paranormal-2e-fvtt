/**
 * Modo transmissão: uma tela só com os cards dos personagens, sobre fundo transparente,
 * para usar como fonte de navegador no OBS. Rosto, nome do personagem e de quem joga, PV,
 * PD, pavor e condições; quando a pessoa rola, o card acende e a rolagem aparece na faixa de
 * baixo, por cima, sem esconder nada: os dados na forma de cada um, com o valor dentro, a RA
 * em vermelho, a RB em azul, o total e o desfecho.
 *
 * Nada se move: o card tem tamanho fixo, com a vaga da rolagem e a linha do estado reservadas
 * mesmo vazias, e a cena de ação mora num elemento à parte, com posição própria. Quem monta o
 * overlay no OBS recorta em volta dos cards uma vez e nunca mais mexe (a cena empurrava tudo
 * para baixo quando começava, e a rolagem esticava o card).
 *
 * Entra no modo quem abre o jogo como o usuário de transmissão (escolhido na janela de
 * configuração, que também o cria) ou com `?op2-transmissao` na URL. A transmissão só vê
 * o que um jogador veria: sussurro e rolagem cega nunca aparecem, porque o filtro é o
 * `message.isContentVisible` do próprio usuário (não `visible`: ver `aoChegarMensagem`).
 */
import { SYSTEM_ID } from "../config.mjs";
import { iconeResultado } from "./dice-icons.mjs";
import { papeisDosDados } from "../dice/analise.mjs";
import { cenaAcaoAtiva, personagensDosJogadores } from "../vigilia/cena-acao.mjs";
import { jaAgiu } from "../vigilia/combate.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const CHAVE = "transmissao";
const TEMPLATE = `systems/${SYSTEM_ID}/templates/ui/transmissao.hbs`;
const PARAMETRO = "op2-transmissao";
const POSICOES = ["top-left", "top-right", "bottom-left", "bottom-right", "top-center", "bottom-center"];
// Quanto tempo o card fica aceso com a rolagem.
const TEMPO_DA_ROLAGEM = 9000;

const ESTILOS = ["cartao", "livre", "ambos"];
const ENQUADRAMENTOS = ["busto", "inteiro"];
// A cena de ação: um canto da tela, ou fora desta fonte (para pôr em outra, pela URL `=cena`).
const POSICOES_DA_CENA = [...POSICOES, "oculta"];
const PADRAO = {
  usuario: "", posicao: "top-left", direcao: "coluna", escala: 1, condicoes: true, estilo: "cartao", enquadramento: "busto",
  // A faixa da rodada fica num canto: o centro de cima é onde a câmera e o overlay disputam espaço.
  cena: "top-right", atores: [],
  // Contorno tracejado em volta de cada card, da área da rolagem e da faixa da cena: é para quem
  // monta o overlay no OBS ver onde recortar. Desliga antes de ir ao ar.
  guias: false,
};

export const configDaTransmissao = () => ({ ...PADRAO, ...(game.settings.get(SYSTEM_ID, CHAVE) ?? {}) });

let elemento = null;
let elementoCena = null;
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
 *   livre  — sem fundo nenhum: o avatar (PNG transparente) solto e PV/PD só em texto, com cor;
 *   ambos  — as duas colunas lado a lado: quem monta o overlay recorta a que quiser no OBS.
 */
const daUrl = () => new URLSearchParams(globalThis.location?.search ?? "").get(PARAMETRO);

/** Guias de recorte nesta tela: pela configuração ou por `&op2-guias` na URL. */
const comGuias = (cfg) => Boolean(cfg.guias) || new URLSearchParams(globalThis.location?.search ?? "").has("op2-guias");

/** `?op2-transmissao=cena`: esta fonte mostra só a cena de ação, sem cards. */
const soCena = () => daUrl() === "cena";

/** Onde a cena aparece nesta tela; `null` quando fica fora dela. */
function posicaoDaCena(cfg) {
  const pos = POSICOES_DA_CENA.includes(cfg.cena) ? cfg.cena : PADRAO.cena;
  if (soCena()) return pos === "oculta" ? PADRAO.cena : pos;
  return pos === "oculta" ? null : pos;
}

function estiloDaTela(cfg) {
  if (ESTILOS.includes(daUrl())) return daUrl();
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

/** A cena de ação no ar, ou `null`. */
function cenaNoAr() {
  const cena = cenaAcaoAtiva();
  return cena?.system.ativa ? cena : null;
}

function contexto() {
  const cfg = configDaTransmissao();
  const noAr = cenaNoAr();
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
      caido: (ator.system.recursos?.pv?.value ?? 1) <= 0,
      agiu: noAr ? jaAgiu(noAr.system.agiram, ator.uuid) : false,
    };
  });
  return {
    cards,
    colunas: estiloDaTela(cfg) === "ambos"
      ? [{ estilo: "cartao", livre: false }, { estilo: "livre", livre: true }]
      : [{ estilo: estiloDaTela(cfg), livre: estiloDaTela(cfg) === "livre" }],
    // Busto: o avatar recortado na cabeça e no tronco. Inteiro: a figura toda.
    enquadramento: ENQUADRAMENTOS.includes(cfg.enquadramento) ? cfg.enquadramento : PADRAO.enquadramento,
  };
}

/** A faixa da cena: tipo, fase e rodada, em caixa de tamanho fixo. Vazia fora da cena. */
function desenharCena(cfg) {
  if (!elementoCena) return;
  const pos = posicaoDaCena(cfg);
  const noAr = cenaNoAr();
  const guias = comGuias(cfg);
  // Com guias, a faixa aparece mesmo sem cena, vazia e contornada: é o lugar dela no recorte.
  elementoCena.hidden = !pos || (!noAr && !guias);
  if (!pos) return;
  elementoCena.dataset.posicao = pos;
  elementoCena.dataset.guias = guias ? "1" : "0";
  elementoCena.style.setProperty("--op2-transmissao-escala", String(Number(cfg.escala) || 1));
  if (!noAr) {
    elementoCena.textContent = guias ? game.i18n.localize("OP2.Transmissao.GuiaCena") : "";
    return;
  }
  const escapar = (t) => foundry.utils.escapeHTML(String(t ?? ""));
  const fase = noAr.system.fase ? game.i18n.localize(`OP2.Fase.${noAr.system.fase}`) : "";
  elementoCena.innerHTML = `<span class="op2-tag op2-tag--pequena">${escapar(game.i18n.localize(`OP2.CenaAcao.Tipo.${noAr.system.tipo}`))}</span>
    ${fase ? `<strong>${escapar(fase)}</strong>` : ""}
    <span>${escapar(game.i18n.format("OP2.CenaAcao.RodadaCurta", { n: noAr.system.rodada }))}</span>`;
}

function aplicarLayout(el, cfg) {
  el.dataset.posicao = POSICOES.includes(cfg.posicao) ? cfg.posicao : PADRAO.posicao;
  el.dataset.direcao = cfg.direcao === "linha" ? "linha" : "coluna";
  el.dataset.estilo = estiloDaTela(cfg);
  el.dataset.guias = comGuias(cfg) ? "1" : "0";
  el.style.setProperty("--op2-transmissao-escala", String(Number(cfg.escala) || 1));
}

export function atualizarTransmissao() {
  if ((!elemento && !elementoCena) || pendente) return;
  pendente = setTimeout(async () => {
    pendente = null;
    const cfg = configDaTransmissao();
    desenharCena(cfg);
    if (!elemento) return;
    const render = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
    elemento.innerHTML = await render(TEMPLATE, contexto());
    aplicarLayout(elemento, cfg);
    // O que estava aceso continua aceso depois do redesenho.
    for (const [id, html] of acesas) acender(id, html);
  }, 80);
}

/**
 * Os dados da rolagem, um registro por dado: forma, valor, se conta, se é o pavor. Do OP2Roll
 * vem pronto; de uma rolagem comum do core (`/r 2d6`), monta-se dos resultados.
 */
function dadosDaRolagem(roll) {
  if (Array.isArray(roll.dados) && roll.dados.length) return roll.dados;
  let indice = 0;
  return roll.dice.flatMap((termo) => termo.results.map((r) => ({
    indice: indice++, dado: `d${termo.faces}`, resultado: r.result, contado: r.active !== false,
  })));
}

/** Um dado desenhado, com a etiqueta embaixo: RA (vermelho), RB (azul), pavor. */
function dadoEmHtml(d, papeis) {
  const ehRa = papeis.ra === d.indice;
  const ehRb = papeis.rb === d.indice;
  const classes = ["op2-transmissao__dado"];
  if (ehRa) classes.push("op2-transmissao__dado--ra");
  if (ehRb && !ehRa) classes.push("op2-transmissao__dado--rb");
  if (d.pavor) classes.push("op2-transmissao__dado--pavor");
  const etiqueta = [ehRa && "RA", ehRb && "RB", d.pavor && game.i18n.localize("OP2.Transmissao.Pavor")].filter(Boolean).join("·");
  const icone = iconeResultado({ dado: d.dado, resultado: d.resultado, contado: d.pavor || (d.contado && !d.anulado) });
  return `<span class="${classes.join(" ")}">${icone}<small>${foundry.utils.escapeHTML(etiqueta)}</small></span>`;
}

/**
 * A rolagem no card: os dados na forma de cada um, com o valor dentro e a RA e a RB marcadas,
 * o total e o desfecho. Montada da rolagem, não do HTML do chat.
 */
export function rolagemEmHtml(mensagem) {
  const roll = mensagem.rolls?.[0];
  if (!roll?._evaluated && roll?.total === undefined) return "";
  const escapar = (t) => foundry.utils.escapeHTML(String(t ?? ""));
  const lista = dadosDaRolagem(roll);
  const papeis = papeisDosDados(lista);
  const dados = lista.map((d) => dadoEmHtml(d, papeis));
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
    <span class="op2-transmissao__rolagem-dados">${dados.join("")}</span>
    <span class="op2-transmissao__rolagem-fim">
      <span class="op2-transmissao__total">${escapar(roll.total)}</span>
      ${desfecho ? `<strong class="op2-transmissao__desfecho">${escapar(game.i18n.localize(`OP2.Transmissao.${desfecho}`))}</strong>` : ""}
    </span>
  </div>`;
}

/** Põe a rolagem na vaga reservada dos cards do ator (`html` vazio apaga). O card não muda de tamanho. */
function acender(id, html) {
  for (const card of elemento?.querySelectorAll(`[data-ator-id="${CSS.escape(id)}"]`) ?? []) {
    card.classList.toggle("op2-transmissao__card--rolou", Boolean(html));
    const vaga = card.querySelector(".op2-transmissao__vaga");
    if (vaga) vaga.innerHTML = html;
  }
}

function aoChegarMensagem(mensagem) {
  // Só o que esta tela pode LER: `visible` é verdadeiro para rolagem sussurrada (o jogador vê
  // que houve uma rolagem secreta, não o resultado) — o filtro é `isContentVisible`, que também
  // barra a rolagem cega. Achado pelo teste de dois clientes: o sussurro acendia o card.
  if (!elemento || !mensagem.isContentVisible || mensagem.blind || !mensagem.rolls?.length) return;
  const ator = ChatMessage.getSpeakerActor(mensagem.speaker);
  const id = ator?.isToken ? ator.token?.actorId ?? ator.id : ator?.id;
  // Um card por coluna: no estilo "os dois", o mesmo personagem aparece duas vezes.
  const cards = id ? [...elemento.querySelectorAll(`[data-ator-id="${CSS.escape(id)}"]`)] : [];
  if (!cards.length) return;
  const html = rolagemEmHtml(mensagem);
  if (!html) return;
  acesas.set(id, html);
  acender(id, html);
  setTimeout(() => {
    if (acesas.get(id) !== html) return;
    acesas.delete(id);
    acender(id, "");
  }, TEMPO_DA_ROLAGEM);
}

/** Liga o modo nesta tela: some a interface, sobram os cards. */
export function ativarTransmissao() {
  document.body.classList.add("op2-transmissao-modo");
  // Duas peças independentes: os cards e a cena. Uma nunca empurra a outra.
  if (!soCena()) {
    elemento = document.createElement("section");
    elemento.id = "op2-transmissao";
    elemento.className = "op2 op2-transmissao";
    document.body.append(elemento);
  }
  elementoCena = document.createElement("section");
  elementoCena.id = "op2-transmissao-cena";
  elementoCena.className = "op2 op2-transmissao-cena";
  elementoCena.hidden = true;
  document.body.append(elementoCena);
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

/** "Missão 1 — O Pântano dos Afogados / Pré-gerados": a pasta inteira, da raiz até o ator. */
function caminhoDaPasta(pasta) {
  const nomes = [];
  for (let p = pasta; p; p = p.folder) nomes.unshift(p.name);
  return nomes.join(" / ");
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
      enderecoAmbos: `${enderecoBase}/game?${PARAMETRO}=ambos`,
      enquadramentos: ENQUADRAMENTOS.map((e) => ({ valor: e, rotulo: game.i18n.localize(`OP2.Transmissao.Enquadramento.${e}`), atual: e === cfg.enquadramento })),
      posicoes: POSICOES.map((p) => ({ valor: p, rotulo: game.i18n.localize(`OP2.Transmissao.Posicao.${p}`), atual: p === cfg.posicao })),
      posicoesDaCena: POSICOES_DA_CENA.map((p) => ({ valor: p, rotulo: game.i18n.localize(`OP2.Transmissao.Posicao.${p}`), atual: p === cfg.cena })),
      enderecoCena: `${enderecoBase}/game?${PARAMETRO}=cena`,
      enderecoGuias: `${enderecoBase}/game?${PARAMETRO}&op2-guias`,
      // Com a pasta: os pré-gerados existem uma vez por aventura (Missão 1, Missão 2, Ato I), com o mesmo
      // nome. Escolher a cópia errada deixa o card parado (os PV são da outra) e a rolagem não acende.
      personagens: game.actors.filter((a) => a.type === "personagem")
        .map((a) => ({ id: a.id, nome: a.name, pasta: caminhoDaPasta(a.folder), marcado: marcados.has(a.id), jogadores: jogadoresDe(a, cfg).join(", ") }))
        .sort((a, b) => a.pasta.localeCompare(b.pasta, "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR")),
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
      enquadramento: ENQUADRAMENTOS.includes(d.enquadramento) ? d.enquadramento : PADRAO.enquadramento,
      cena: POSICOES_DA_CENA.includes(d.cena) ? d.cena : PADRAO.cena,
      guias: Boolean(d.guias),
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
