/**
 * O palco: a cena de ação vista como teatro, não como grade. Uma faixa no rodapé da tela
 * com quem está em cena (personagens à esquerda, criaturas à direita), a fase e a rodada
 * no meio, e quem age dá um passo à frente com a legenda do que fez.
 *
 * É vista, não controle: o painel de ação continua sendo a mesa do mestre. Clicar no
 * próprio personagem abre as ações da fase atual (as mesmas do painel, por `agirNaCena`).
 * Todo mundo vê o palco quando há uma cena no ar; cada um recolhe o seu.
 */
import { SYSTEM_ID } from "../config.mjs";
import { usaCombateNovo } from "../modo.mjs";
import { cenaAcaoAtiva, participantesDe, atorDe } from "./cena-acao.mjs";
import { linhaDe, guiaDaCena, agirNaCena, abrirPainelAcao } from "./painel-acao.mjs";

const TEMPLATE = `systems/${SYSTEM_ID}/templates/vigilia/palco.hbs`;
const CHAVE_RECOLHIDO = `${SYSTEM_ID}.palco.recolhido`;
// Quanto tempo quem agiu fica à frente, com a legenda.
const TEMPO_DA_LEGENDA = 6000;

let elemento = null;
let pendente = null;

const recolhido = () => {
  try { return localStorage.getItem(CHAVE_RECOLHIDO) === "1"; } catch { return false; }
};

/** O que o template precisa: a cena no ar, a fase, e uma figura por participante. */
function contextoDoPalco(cena) {
  const { tipo, fase, rodada } = cena.system;
  const figuras = participantesDe(cena).map((ator) => {
    const linha = linhaDe(cena, ator);
    return {
      ...linha,
      condicoesAtivas: linha.condicoes.filter((c) => c.ativa).map((c) => c.rotulo),
      // Combate: as ações da fase abrem num menu sobre a figura. Fora dele, o painel.
      temMenu: linha.dono && tipo === "combate",
    };
  });
  const guia = guiaDaCena(tipo, fase);
  return {
    cena, rodada, recolhido: recolhido(),
    rotuloTipo: game.i18n.localize(`OP2.CenaAcao.Tipo.${tipo}`),
    faseRotulo: fase ? game.i18n.localize(`OP2.Fase.${fase}`) : "",
    guia,
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
  elemento.addEventListener("keydown", (evento) => {
    if ((evento.key === "Enter" || evento.key === " ") && evento.target.matches("[data-palco]")) {
      evento.preventDefault();
      evento.target.click();
    }
  });
  return elemento;
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
  // Quem está à frente agora continua à frente depois do redesenho.
  const aFrente = [...el.querySelectorAll(".op2-palco__figura--age")].map((f) => f.dataset.ator);
  const legendas = new Map([...el.querySelectorAll(".op2-palco__figura--age")]
    .map((f) => [f.dataset.ator, f.querySelector(".op2-palco__legenda")?.outerHTML ?? ""]));
  el.innerHTML = await render(TEMPLATE, contextoDoPalco(cena));
  el.classList.toggle("op2-palco--recolhido", recolhido());
  for (const uuid of aFrente) {
    const figura = el.querySelector(`.op2-palco__figura[data-ator="${CSS.escape(uuid)}"]`);
    if (!figura) continue;
    figura.classList.add("op2-palco__figura--age");
    if (legendas.get(uuid)) figura.insertAdjacentHTML("beforeend", legendas.get(uuid));
  }
}

async function aoClicar(evento) {
  const alvo = evento.target.closest("[data-palco]");
  if (!alvo) return;
  const cena = cenaAcaoAtiva();
  switch (alvo.dataset.palco) {
    case "recolher": {
      try { localStorage.setItem(CHAVE_RECOLHIDO, recolhido() ? "0" : "1"); } catch { /* sem storage: só nesta tela */ }
      elemento.classList.toggle("op2-palco--recolhido");
      return;
    }
    case "painel": return void abrirPainelAcao(cena);
    case "figura": {
      const figura = alvo.closest(".op2-palco__figura");
      const aberto = figura.classList.contains("op2-palco__figura--menu");
      for (const f of elemento.querySelectorAll(".op2-palco__figura--menu")) f.classList.remove("op2-palco__figura--menu");
      if (!figura.querySelector(".op2-palco__menu")) {
        // Fora do combate as ações moram no painel (placar de perseguição, dados de esconderijo).
        const painel = abrirPainelAcao(cena);
        setTimeout(() => painel.element?.querySelector(`.op2-linha-acao[data-ator="${CSS.escape(figura.dataset.ator)}"]`)
          ?.scrollIntoView({ block: "center" }), 400);
        return;
      }
      if (!aberto) figura.classList.add("op2-palco__figura--menu");
      return;
    }
    case "agir": {
      const figura = alvo.closest(".op2-palco__figura");
      figura?.classList.remove("op2-palco__figura--menu");
      return agirNaCena(cena, atorDe(figura?.dataset.ator), alvo.dataset);
    }
    default: return;
  }
}

/** Uma linha curta do card: título, total e desfecho — o que se lê de longe. */
function legendaDoCard(mensagem) {
  const doc = new DOMParser().parseFromString(mensagem.content ?? "", "text/html");
  const texto = (seletor) => doc.querySelector(seletor)?.textContent.replace(/\s+/g, " ").trim() ?? "";
  const titulo = texto(".op2-tag");
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
    for (const gatilho of ["updateActor", "createActor", "deleteActor", "createToken", "deleteToken", "updateToken", "canvasReady"]) {
      Hooks.on(gatilho, atualizarPalco);
    }
    Hooks.on("createChatMessage", aoChegarMensagem);
  });
}
