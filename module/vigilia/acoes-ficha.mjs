/** O que a aba "Condição" da ficha faz: relações, Análise, pavor (beta §9, §12). */
import { MAX_MARCADORES, MARCADORES_POR_ACAO } from "../config.mjs";
import { comoMestre } from "../ui/socket.mjs";
import { cardVigilia } from "./card.mjs";
import { beneficiosDoGrau, podeInvocar } from "./relacoes.mjs";
import { subirPavor } from "./queda.mjs";

/** ANÁLISE: uma ação dá 2 marcadores, até 4 (beta §12). */
export async function analisar(ator) {
  const novo = Math.min(MAX_MARCADORES, ator.system.estado.marcadores + MARCADORES_POR_ACAO);
  await ator.update({ "system.estado.marcadores": novo });
  return cardVigilia(ator, {
    titulo: game.i18n.localize("OP2.Analise.Titulo"),
    texto: game.i18n.format("OP2.Analise.Texto", { ator: foundry.utils.escapeHTML(ator.name), n: novo }),
  });
}

/** Receber pavor: d6, ou um passo a mais (beta §9.1). */
export const receberPavor = (ator) => ator.update({ "system.estado.pavor": subirPavor(ator.system.estado.pavor) });

/** A pessoa da relação, se ela estiver no mundo. */
const atorDaRelacao = (relacao) => (relacao.com?.trim()
  ? game.actors.find((a) => a.type === "personagem" && a.name.toLowerCase().includes(relacao.com.trim().toLowerCase()))
  : null);

/**
 * INVOCAR uma relação (beta §9.2): escolhe o benefício do grau; uma vez por missão. Bônus de
 * teste fica guardado na ficha, e o jogador marca no teste que quiser.
 */
export async function invocarRelacao(ator, indice, { escolha } = {}) {
  const relacoes = ator.system.relacoes.map((r) => ({ ...r }));
  const relacao = relacoes[indice];
  if (!relacao || !podeInvocar(relacao)) return null;
  const beneficios = beneficiosDoGrau(relacao.grau);
  const rotulo = (b) => game.i18n.format(`OP2.Relacao.Beneficio.${b.chave}`, { dado: b.dado ?? "", formula: b.formula ?? "", com: relacao.com });

  const chave = escolha ?? await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.format("OP2.Relacao.Invocar", { com: relacao.com }) },
    content: `<p>${game.i18n.localize("OP2.Relacao.InvocarAjuda")}</p>`,
    buttons: beneficios.map((b) => ({ action: b.chave, label: rotulo(b) })),
    rejectClose: false,
  });
  const beneficio = beneficios.find((b) => b.chave === chave);
  if (!beneficio) return null;

  relacao.invocada = true;
  const dados = { "system.relacoes": relacoes };
  if (beneficio.dado) {
    dados["system.estado.bonus"] = [...ator.system.estado.bonus, { dado: beneficio.dado, rotulo: relacao.com }];
  }
  await ator.update(dados);

  const linhas = [];
  if (beneficio.formula) {
    const alvo = atorDaRelacao(relacao);
    const roll = await new Roll(beneficio.formula).evaluate();
    if (alvo) await comoMestre("vigilia-curar-pd", { atorUuid: alvo.uuid, quantidade: roll.total });
    // Sem ninguém com esse nome no mundo, o card diz o número e a mesa aplica.
    linhas.push(game.i18n.format(alvo ? "OP2.Relacao.Motivou" : "OP2.Relacao.MotivouSemAlvo", { com: foundry.utils.escapeHTML(relacao.com), n: roll.total }));
  }
  return cardVigilia(ator, {
    titulo: game.i18n.format("OP2.Relacao.Invocar", { com: relacao.com }),
    texto: foundry.utils.escapeHTML(rotulo(beneficio)),
    linhas,
  });
}
