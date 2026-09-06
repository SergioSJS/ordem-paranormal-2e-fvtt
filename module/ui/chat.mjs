/**
 * Botões dos cards de chat.
 *
 * Tudo que muda a ficha de alguém passa por aqui e exige clique — nenhum efeito do
 * playtest é aplicado automaticamente.
 */
import { SYSTEM_ID, CUSTO_PD_EXAMINAR } from "../config.mjs";
import { rolarFalhaCritica, aplicarFalhaCritica, aplicarDano } from "../dice/falha-critica.mjs";
import { testarCompartilhamento, registrarTravaDeCena, contarAoGrupo } from "../cena/acoes-investigacao.mjs";
import { rolarSobrecarga } from "../cena/rodada.mjs";
import { marcarHackSocialResolvido, marcarHackTecnicoResolvido } from "../cena/acoes-desafio.mjs";
import { iniciarHackTecnico, encerrarHackTecnico } from "../cena/timer-hack.mjs";
import { rolarTesteDeQueda } from "../cena/ferimentos.mjs";
import { defender } from "../cena/acoes-combate.mjs";
import { concederPasso } from "../cena/acoes-recurso.mjs";
import { preencherImpeto } from "../cena/impeto.mjs";

/** @type {Record<string, (ator: Actor, dataset: DOMStringMap) => Promise<void>>} */
const ACOES = {
  async "rolar-falha-critica"(ator) {
    await rolarFalhaCritica(ator);
  },
  async "contar-ao-grupo"(ator, dataset) {
    await contarAoGrupo(ator, dataset.poiUuid, dataset.infoId);
  },
  async "aplicar-falha-critica"(ator, dataset) {
    await aplicarFalhaCritica(ator, Number(dataset.face));
  },
  // Dano de quem o card é: o dano de Alcançar é de quem caiu, o de Arrombar é de quem
  // forçou. Antes isto ia para os tokens selecionados, então cair de um telhado
  // machucava quem o mestre tivesse clicado na cena (achado em uso real).
  async "aplicar-dano"(ator, dataset) {
    await aplicarDano(ator, Number(dataset.quantidade), dataset.recurso ?? "pv");
    ui.notifications.info(game.i18n.format("OP2.Chat.DanoAplicado", {
      quantidade: dataset.quantidade, alvos: ator.name,
    }));
  },
  // Dano improvisado a partir de um teste qualquer: aí sim vale a seleção da cena,
  // porque o card não sabe em quem cai. É julgamento de mestre, e só ele vê o botão.
  async "aplicar-dano-selecionado"(ator, dataset) {
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
  // Teste oposto de Luta (spec §8.1): o card do ataque espera a resposta do
  // defensor — revidar, ou só se defender com Acrobacia +d6.
  async "defender-ataque"(ator, dataset) {
    if (!game.user.isGM && !ator.isOwner) {
      ui.notifications.warn(game.i18n.localize("OP2.Aviso.SemPermissao"));
      return;
    }
    await defender(ator, {
      atacanteId: dataset.atacanteId,
      totalAtaque: Number(dataset.total),
      raAtaque: Number(dataset.ra),
      rbAtaque: Number(dataset.rb),
      armadoAtacante: dataset.armado === "true",
      esquiva: dataset.esquiva === "true",
    });
  },
  // O dano do combate já sabe em quem cai — não usa a seleção de tokens.
  async "aplicar-dano-alvo"(ator, dataset) {
    await aplicarDano(ator, Number(dataset.quantidade), dataset.recurso ?? "pv");
    ui.notifications.info(game.i18n.format("OP2.Chat.DanoAplicado", {
      quantidade: dataset.quantidade, alvos: ator.name,
    }));
  },
  // Habilidade ou item na investigação (spec §6.6): o efeito é decisão do mestre,
  // e o padrão sugerido pelo texto é um aumento de passo.
  async "conceder-passo"(ator, dataset) {
    if (!game.user.isGM) return;
    await concederPasso(ator, { passos: Number(dataset.passos), origem: dataset.origem });
  },
  // Ímpeto: cada falha preenche um espaço (ficha do Ato I).
  async "preencher-impeto"(ator) {
    const estado = await preencherImpeto(ator);
    if (!estado) {
      ui.notifications.info(game.i18n.localize("OP2.Impeto.Cheia"));
      return;
    }
    ui.notifications.info(game.i18n.format("OP2.Impeto.Preenchido", {
      ator: ator.name, preenchidos: estado.preenchidos, espacos: estado.espacos,
    }));
  },
  // Zerou PV ou PD: Vigor ou Disciplina contra a DT que escala (spec §8.2/§8.3).
  // O sistema pede o teste; matar o personagem continua sendo decisão de mesa.
  async "rolar-teste-queda"(ator, dataset) {
    if (!game.user.isGM && !ator.isOwner) {
      ui.notifications.warn(game.i18n.localize("OP2.Aviso.SemPermissao"));
      return;
    }
    await rolarTesteDeQueda(ator, dataset.tipo);
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
  // Comparar a resposta falada do jogador com o gabarito é julgamento de mesa —
  // o botão só existe pro mestre (`data-op2-gm`, removido do DOM pro jogador).
  async "marcar-hack-social-resolvido"(_ator, dataset) {
    await marcarHackSocialResolvido(dataset.desafioUuid);
  },

  // O problema do hack técnico na mesa: o mestre revela e inicia o contador em toda
  // tela, depois dá o veredito (spec §7.3).
  async "iniciar-hack-tecnico"(_ator, dataset) {
    await iniciarHackTecnico(dataset.desafioUuid, dataset.atorId || null, Number(dataset.faixa ?? -1));
  },
  async "hack-tecnico-acertou"(_ator, dataset) {
    await encerrarHackTecnico(dataset.desafioUuid, dataset.atorId || null, true);
  },
  async "hack-tecnico-errou"(_ator, dataset) {
    await encerrarHackTecnico(dataset.desafioUuid, dataset.atorId || null, false);
  },
  async "marcar-hack-tecnico-resolvido"(_ator, dataset) {
    await marcarHackTecnicoResolvido(dataset.desafioUuid);
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
