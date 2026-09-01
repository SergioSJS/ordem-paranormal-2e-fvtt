/**
 * Botões dos cards de chat.
 *
 * Tudo que muda a ficha de alguém passa por aqui e exige clique — nenhum efeito do
 * playtest é aplicado automaticamente.
 */
import { SYSTEM_ID, CUSTO_PD_EXAMINAR } from "../config.mjs";
import { rolarFalhaCritica, aplicarFalhaCritica, aplicarDano } from "../dice/falha-critica.mjs";
import { testarCompartilhamento, registrarTravaDeCena } from "../cena/acoes-investigacao.mjs";
import { rolarSobrecarga } from "../cena/rodada.mjs";

/** @type {Record<string, (ator: Actor, dataset: DOMStringMap) => Promise<void>>} */
const ACOES = {
  async "rolar-falha-critica"(ator) {
    await rolarFalhaCritica(ator);
  },
  async "aplicar-falha-critica"(ator, dataset) {
    await aplicarFalhaCritica(ator, Number(dataset.face));
  },
  async "aplicar-dano"(ator, dataset) {
    const alvos = atoresSelecionados(ator);
    for (const alvo of alvos) await aplicarDano(alvo, Number(dataset.quantidade), dataset.recurso ?? "pv");
    ui.notifications.info(game.i18n.format("OP2.Chat.DanoAplicado", {
      quantidade: dataset.quantidade,
      alvos: alvos.map((a) => a.name).join(", "),
    }));
  },
  // Examinar é uma aposta (spec §6.3.1): não revelou nada novo, paga 1 PD.
  async "pagar-custo-examinar"(ator) {
    await aplicarDano(ator, CUSTO_PD_EXAMINAR, "pd");
    ui.notifications.info(game.i18n.format("OP2.Investigacao.PDPago", {
      ator: ator.name, custo: CUSTO_PD_EXAMINAR,
    }));
  },
  // O teste do aliado no Compartilhar é ação livre (spec §6.5).
  async "testar-compartilhar"(ator, dataset) {
    await testarCompartilhamento(ator, dataset.compartilhadorId);
  },
  // As travas de 1×-por-cena são registradas pelo mestre, que julga a interpretação.
  async "registrar-recapitular"(ator) {
    await registrarTravaDeCena("recapitularUsado", ator);
  },
  async "registrar-compartilhar"(ator) {
    await registrarTravaDeCena("compartilharUsado", ator);
  },
  // Sobrecarga mental: cada jogador rola o próprio dano; o mestre cobre ausentes.
  async "rolar-sobrecarga"(ator, dataset) {
    if (!game.user.isGM && !ator.isOwner) {
      ui.notifications.warn(game.i18n.localize("OP2.Aviso.SemPermissao"));
      return;
    }
    await rolarSobrecarga(ator, dataset.expressao);
  },
};

/**
 * Alvo do dano: os tokens selecionados, ou o próprio ator do card se nada estiver
 * selecionado. Evita o caso comum de aplicar dano no personagem errado.
 */
function atoresSelecionados(padrao) {
  const selecionados = canvas.tokens?.controlled?.map((t) => t.actor).filter(Boolean) ?? [];
  return selecionados.length ? selecionados : [padrao];
}

/** @param {HTMLElement} elemento */
function ligar(elemento) {
  for (const botao of elemento.querySelectorAll("[data-op2-acao]")) {
    botao.addEventListener("click", async (evento) => {
      evento.preventDefault();
      // currentTarget zera ao fim do dispatch: guardamos o botão antes do primeiro await.
      const clicado = evento.currentTarget;
      const { op2Acao, atorId } = clicado.dataset;
      const acao = ACOES[op2Acao];
      if (!acao) return;

      const ator = game.actors.get(atorId);
      if (!ator) return void ui.notifications.warn(game.i18n.localize("OP2.Aviso.AtorAusente"));

      clicado.disabled = true;
      try {
        await acao(ator, clicado.dataset);
      } finally {
        clicado.disabled = false;
      }
    });
  }
}

/**
 * O core pinta toda mensagem de chat com `--chat-message-background`, uma textura de
 * pergaminho fixa, e `--color-dark-4` no cabeçalho — pensados para um fundo claro,
 * ilegível contra o card escuro do sistema. Marcar o `<li>` com `.op2` dá a ele acesso
 * às mesmas variáveis `--op2-*` do card, e a CSS (`_chat.scss`) assume dali.
 * @param {HTMLElement} html
 */
function teatralizarEnvelope(html) {
  const li = html.classList?.contains("chat-message") ? html : html.closest?.(".chat-message");
  if (li?.querySelector(".op2-card")) li.classList.add("op2");
}

export function registrarChat() {
  // Só `renderChatMessageHTML`: o `renderChatMessage` está depreciado desde o v13 e
  // registrá-lo faz o core avisar a cada mensagem. O sistema exige v13 no mínimo.
  Hooks.on("renderChatMessageHTML", (msg, html) => {
    // Botões de mestre são removidos do DOM, não escondidos por CSS.
    if (msg.getFlag(SYSTEM_ID, "tipo") && !game.user.isGM) {
      for (const botao of html.querySelectorAll("[data-op2-gm]")) botao.remove();
    }
    teatralizarEnvelope(html);
    ligar(html);
  });
}
