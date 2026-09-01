/**
 * Botões dos cards de chat.
 *
 * Tudo que muda a ficha de alguém passa por aqui e exige clique — nenhum efeito do
 * playtest é aplicado automaticamente.
 */
import { SYSTEM_ID } from "../config.mjs";
import { rolarFalhaCritica, aplicarFalhaCritica, aplicarDano } from "../dice/falha-critica.mjs";

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
      const { op2Acao, atorId } = evento.currentTarget.dataset;
      const acao = ACOES[op2Acao];
      if (!acao) return;

      const ator = game.actors.get(atorId);
      if (!ator) return void ui.notifications.warn(game.i18n.localize("OP2.Aviso.AtorAusente"));

      evento.currentTarget.disabled = true;
      try {
        await acao(ator, evento.currentTarget.dataset);
      } finally {
        evento.currentTarget.disabled = false;
      }
    });
  }
}

export function registrarChat() {
  // Só `renderChatMessageHTML`: o `renderChatMessage` está depreciado desde o v13 e
  // registrá-lo faz o core avisar a cada mensagem. O sistema exige v13 no mínimo.
  Hooks.on("renderChatMessageHTML", (msg, html) => {
    // Botões de mestre são removidos do DOM, não escondidos por CSS.
    if (msg.getFlag(SYSTEM_ID, "tipo") && !game.user.isGM) {
      for (const botao of html.querySelectorAll("[data-op2-gm]")) botao.remove();
    }
    ligar(html);
  });
}
