/**
 * O palco: a cena de ação vista como teatro, não como grade. Uma faixa no rodapé da tela
 * com quem está em cena (personagens à esquerda, criaturas à direita), as fases e a rodada
 * embaixo, e quem age dá um passo à frente com a legenda do que fez.
 *
 * Dá para conduzir a cena toda daqui, sem abrir o painel:
 *   - a barra: o mestre clica numa fase para ir até ela, mexe na rodada, avança, para e encerra;
 *   - a figura: o clique abre o menu dela — ficha, alvo, já agiu, PV, condições, as ações da
 *     fase e, para o mestre, tirar da cena; o duplo clique abre a ficha;
 *   - `T` com o mouse sobre a figura mira nela, como sobre o token (`Shift+T` soma alvos).
 *     Com token no mapa, é a mira do Foundry; sem, a do palco (`alvos.mjs`). O ataque lê as duas.
 * O painel continua lá, com o que não cabe aqui (montagem, perseguição, furtividade).
 */
import { SYSTEM_ID } from "../config.mjs";
import { usaCombateNovo } from "../modo.mjs";
import { FASES } from "./combate.mjs";
import {
  cenaAcaoAtiva, participantesDe, atorDe, avancarCena, definirFase, definirRodada, alternarAgiu, mudarCondicao,
  pararCena, encerrarCenaAcao, tirarDaCena,
} from "./cena-acao.mjs";
import { linhaDe, guiaDaCena, agirNaCena, abrirPainelAcao } from "./painel-acao.mjs";
import { ehAlvo, alternarAlvo } from "./alvos.mjs";

const TEMPLATE = `systems/${SYSTEM_ID}/templates/vigilia/palco.hbs`;
const CHAVE_RECOLHIDO = `${SYSTEM_ID}.palco.recolhido`;
// Quanto tempo quem agiu fica à frente, com a legenda.
const TEMPO_DA_LEGENDA = 6000;

let elemento = null;
let pendente = null;

const recolhido = () => {
  try { return localStorage.getItem(CHAVE_RECOLHIDO) === "1"; } catch { return false; }
};

/** O que o template precisa: a cena no ar, as fases, e uma figura por participante. */
function contextoDoPalco(cena) {
  const { tipo, fase, rodada } = cena.system;
  const figuras = participantesDe(cena).map((ator) => {
    const linha = linhaDe(cena, ator);
    return {
      ...linha,
      condicoesAtivas: linha.condicoes.filter((c) => c.ativa).map((c) => c.rotulo),
      alvo: ehAlvo(ator),
      podeFicha: ator.testUserPermission(game.user, "OBSERVER"),
      // Combate: as ações da fase moram no menu. Fora dele, um atalho para a linha no painel.
      temAcoes: linha.dono && tipo === "combate",
      acoesNoPainel: linha.dono && tipo !== "combate",
    };
  });
  const fases = tipo === "combate" ? FASES : (tipo === "furtividade" ? ["personagens", "criaturas"] : []);
  return {
    cena, rodada, recolhido: recolhido(),
    rotuloTipo: game.i18n.localize(`OP2.CenaAcao.Tipo.${tipo}`),
    faseRotulo: fase ? game.i18n.localize(`OP2.Fase.${fase}`) : "",
    fases: fases.map((f) => ({ chave: f, rotulo: game.i18n.localize(`OP2.Fase.${f}`), atual: f === fase })),
    proximo: game.i18n.localize(tipo === "perseguicao" ? "OP2.CenaAcao.ProximaRodada" : "OP2.CenaAcao.ProximaFase"),
    guia: guiaDaCena(tipo, fase),
    pcs: figuras.filter((f) => f.ehPc),
    criaturas: figuras.filter((f) => !f.ehPc),
    ehGM: game.user.isGM,
  };
}

/** Onde o palco mora: acima da hotbar, dentro da interface do core, para acompanhar a UI. */
function montarElemento() {
  if (elemento?.isConnected) return elemento;
  elemento = document.createElement("section");
  elemento.id = "op2-palco";
  elemento.className = "op2 op2-palco";
  elemento.setAttribute("aria-label", game.i18n.localize("OP2.Palco.Titulo"));
  const fundo = document.getElementById("ui-bottom");
  if (fundo) fundo.prepend(elemento);
  else document.body.append(elemento);
  elemento.addEventListener("click", aoClicar);
  elemento.addEventListener("dblclick", (evento) => {
    const retrato = evento.target.closest(".op2-palco__retrato");
    if (!retrato) return;
    fecharMenus();
    abrirFicha(retrato.closest(".op2-palco__figura")?.dataset.ator);
  });
  elemento.addEventListener("keydown", (evento) => {
    if ((evento.key === "Enter" || evento.key === " ") && evento.target.matches("[data-palco]:not(button)")) {
      evento.preventDefault();
      evento.target.click();
    }
    if (evento.key === "Escape") fecharMenus();
  });
  return elemento;
}

/** Clique fora do palco fecha o menu aberto. */
function aoClicarFora(evento) {
  if (!elemento?.isConnected || elemento.contains(evento.target)) return;
  fecharMenus();
}

function fecharMenus() {
  for (const f of elemento?.querySelectorAll(".op2-palco__figura--menu") ?? []) f.classList.remove("op2-palco__figura--menu");
}

/** Redesenha o palco, juntando os pedidos que chegam em rajada (um update por token). */
export function atualizarPalco() {
  if (pendente) return;
  pendente = setTimeout(async () => {
    pendente = null;
    await desenhar();
  }, 60);
}

async function desenhar() {
  const cena = cenaAcaoAtiva();
  if (!cena?.system.ativa || !participantesDe(cena).length) {
    elemento?.remove();
    elemento = null;
    return;
  }
  const el = montarElemento();
  const render = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
  // O que estava aberto continua aberto depois do redesenho: quem está à frente (com a
  // legenda), o menu (clicar em PV+ redesenha o palco, e o menu não pode fechar na cara) e
  // as seções abertas dele.
  const aFrente = [...el.querySelectorAll(".op2-palco__figura--age")].map((f) => f.dataset.ator);
  const legendas = new Map([...el.querySelectorAll(".op2-palco__figura--age")]
    .map((f) => [f.dataset.ator, f.querySelector(".op2-palco__legenda")?.outerHTML ?? ""]));
  const comMenu = el.querySelector(".op2-palco__figura--menu")?.dataset.ator;
  const abertos = [...el.querySelectorAll(".op2-palco__figura--menu details[open]")].map((d) => d.dataset.detalhe);
  el.innerHTML = await render(TEMPLATE, contextoDoPalco(cena));
  el.classList.toggle("op2-palco--recolhido", recolhido());
  const figuraDe = (uuid) => el.querySelector(`.op2-palco__figura[data-ator="${CSS.escape(uuid)}"]`);
  for (const uuid of aFrente) {
    const figura = figuraDe(uuid);
    if (!figura) continue;
    figura.classList.add("op2-palco__figura--age");
    if (legendas.get(uuid)) figura.insertAdjacentHTML("beforeend", legendas.get(uuid));
  }
  const menu = comMenu && figuraDe(comMenu);
  if (menu) {
    menu.classList.add("op2-palco__figura--menu");
    for (const chave of abertos) menu.querySelector(`details[data-detalhe="${chave}"]`)?.setAttribute("open", "");
  }
}

function abrirFicha(uuid) {
  const ator = atorDe(uuid);
  if (ator?.testUserPermission(game.user, "OBSERVER")) ator.sheet.render(true);
}

/**
 * O ator sob o mouse no palco: é nele que o `T` mira. Só o mouse, não o foco — o foco fica na
 * figura depois do clique, e o `T` sobre um token do mapa iria parar nela.
 */
export function atorSobOMouse() {
  const figura = elemento?.isConnected ? elemento.querySelector(".op2-palco__figura:hover") : null;
  return figura ? atorDe(figura.dataset.ator) : null;
}

async function aoClicar(evento) {
  const alvo = evento.target.closest("[data-palco]");
  if (!alvo) return;
  const cena = cenaAcaoAtiva();
  const figura = alvo.closest(".op2-palco__figura");
  const ator = figura ? atorDe(figura.dataset.ator) : null;
  switch (alvo.dataset.palco) {
    case "recolher": {
      try { localStorage.setItem(CHAVE_RECOLHIDO, recolhido() ? "0" : "1"); } catch { /* sem storage: só nesta tela */ }
      elemento.classList.toggle("op2-palco--recolhido");
      return;
    }
    case "painel": return void abrirPainelAcao(cena);
    case "figura": {
      const aberto = figura.classList.contains("op2-palco__figura--menu");
      fecharMenus();
      if (!aberto) figura.classList.add("op2-palco__figura--menu");
      return;
    }
    case "agir": {
      fecharMenus();
      return agirNaCena(cena, ator, alvo.dataset);
    }
    case "painelDoAtor": {
      fecharMenus();
      const painel = abrirPainelAcao(cena);
      setTimeout(() => painel.element?.querySelector(`.op2-linha-acao[data-ator="${CSS.escape(figura.dataset.ator)}"]`)
        ?.scrollIntoView({ block: "center" }), 400);
      return;
    }
    case "ficha": fecharMenus(); return abrirFicha(figura?.dataset.ator);
    case "alvo": return alternarAlvo(ator, { somar: evento.shiftKey });
    case "agiu": return ator ? alternarAgiu(cena, ator) : null;
    case "condicao": {
      if (!ator?.isOwner) return null;
      const chave = alvo.dataset.condicao;
      return mudarCondicao(ator, chave, !ator.system.estado?.condicoes?.has(chave));
    }
    case "pv": {
      if (!ator?.isOwner) return null;
      const { value, max } = ator.system.recursos.pv;
      return ator.update({ "system.recursos.pv.value": Math.max(0, Math.min(max, value + Number(alvo.dataset.delta))) });
    }
    case "tirar": {
      if (!game.user.isGM || !ator) return null;
      fecharMenus();
      return tirarDaCena(cena, ator.uuid);
    }
    // A barra: só o mestre conduz.
    case "fase": return game.user.isGM ? definirFase(cena, alvo.dataset.fase) : null;
    case "rodada": return game.user.isGM ? definirRodada(cena, cena.system.rodada + Number(alvo.dataset.delta)) : null;
    case "avancar": return game.user.isGM ? avancarCena(cena) : null;
    case "parar": return game.user.isGM ? pararCena(cena) : null;
    case "encerrar": {
      if (!game.user.isGM) return null;
      const certo = await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize("OP2.CenaAcao.Encerrar") },
        content: `<p>${game.i18n.localize("OP2.CenaAcao.EncerrarPergunta")}</p>`,
        rejectClose: false,
      });
      return certo ? encerrarCenaAcao(cena) : null;
    }
    default: return null;
  }
}

/** Uma linha curta do card: título, total e desfecho — o que se lê de longe. */
function legendaDoCard(mensagem) {
  const doc = new DOMParser().parseFromString(mensagem.content ?? "", "text/html");
  const texto = (seletor) => doc.querySelector(seletor)?.textContent.replace(/\s+/g, " ").trim() ?? "";
  const titulo = texto(".op2-tag");
  const doCard = doc.querySelector("[data-legenda]")?.dataset.legenda;
  if (doCard) return [titulo, doCard].filter(Boolean).join(" · ").slice(0, 120);
  const total = texto(".op2-card__total");
  const desfecho = texto(".op2-card__desfecho");
  const corpo = texto(".op2-card p");
  const partes = [titulo, total && `= ${total}`, desfecho || (!total ? corpo : "")].filter(Boolean);
  const linha = partes.join(" · ");
  return linha.length > 120 ? `${linha.slice(0, 117)}…` : linha;
}

/** Card do sistema de alguém em cena: ele dá um passo à frente, com a legenda. */
function aoChegarMensagem(mensagem) {
  // `isContentVisible`, não `visible`: rolagem sussurrada é "visível" (aparece que houve), mas o
  // conteúdo não — a legenda de um NPC rolado às escondidas contaria o resultado aos jogadores.
  if (!elemento?.isConnected || !mensagem.isContentVisible) return;
  if (!mensagem.getFlag(SYSTEM_ID, "tipo") && !/op2-card/.test(mensagem.content ?? "")) return;
  const ator = ChatMessage.getSpeakerActor(mensagem.speaker);
  if (!ator) return;
  const figura = elemento.querySelector(`.op2-palco__figura[data-ator="${CSS.escape(ator.uuid)}"]`);
  if (!figura) return;
  const linha = legendaDoCard(mensagem);
  figura.querySelector(".op2-palco__legenda")?.remove();
  if (linha) {
    const legenda = document.createElement("span");
    legenda.className = "op2-palco__legenda";
    legenda.textContent = linha;
    figura.append(legenda);
  }
  figura.classList.add("op2-palco__figura--age");
  clearTimeout(figura._op2Timer);
  figura._op2Timer = setTimeout(() => {
    const atual = elemento?.querySelector(`.op2-palco__figura[data-ator="${CSS.escape(ator.uuid)}"]`);
    atual?.classList.remove("op2-palco__figura--age");
    atual?.querySelector(".op2-palco__legenda")?.remove();
  }, TEMPO_DA_LEGENDA);
}

export function registrarPalco() {
  Hooks.once("ready", () => {
    if (!usaCombateNovo()) return;
    atualizarPalco();
    for (const gatilho of ["updateActor", "createActor", "deleteActor", "createToken", "deleteToken", "updateToken", "canvasReady", "targetToken", "op2AlvosMudaram"]) {
      Hooks.on(gatilho, atualizarPalco);
    }
    Hooks.on("createChatMessage", aoChegarMensagem);
    document.addEventListener("pointerdown", aoClicarFora);
  });
}
