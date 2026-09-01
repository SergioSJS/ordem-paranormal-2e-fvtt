/**
 * Tabela de falha crítica (spec §4.4).
 *
 * Rola 1d8 e mostra o efeito, mas nunca aplica sozinho: o texto é explícito em deixar a
 * decisão com o mestre, que pode trocar o efeito se não fizer sentido na situação.
 */
import { SYSTEM_ID, TABELA_FALHA_CRITICA } from "../config.mjs";
import { renderizar } from "./teste.mjs";

/**
 * @param {Actor} ator
 * @returns {Promise<{face: number, entrada: object}>}
 */
export async function rolarFalhaCritica(ator) {
  const roll = await new Roll("1d8").evaluate();
  const face = roll.total;
  const entrada = TABELA_FALHA_CRITICA[face];

  const conteudo = await renderizar("systems/ordem-paranormal-2e/templates/chat/falha-critica.hbs", {
    face,
    chave: entrada.chave,
    efeito: entrada.efeito,
    alvo: entrada.alvo,
    formula: entrada.formula,
    aplicavel: entrada.efeito === "reducao" || entrada.efeito === "dano",
    atorId: ator.id,
  });

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: ator }),
    content: conteudo,
    flags: { [SYSTEM_ID]: { tipo: "falha-critica", face, atorId: ator.id } },
  });

  return { face, entrada };
}

/**
 * Aplica o efeito sorteado. Só o mestre chega aqui — o botão do card é dele.
 * @param {Actor} ator
 * @param {number} face
 */
export async function aplicarFalhaCritica(ator, face) {
  const entrada = TABELA_FALHA_CRITICA[face];
  if (!entrada) return;

  if (entrada.efeito === "reducao") {
    // Redução "até o fim da cena": incrementa o contador, que é zerado ao encerrar a cena.
    const caminho = `system.estado.reducoesTemporarias.${entrada.alvo}`;
    await ator.update({ [caminho]: foundry.utils.getProperty(ator, caminho) + 1 });
    ui.notifications.info(game.i18n.format("OP2.FalhaCritica.Aplicada", {
      ator: ator.name,
      efeito: game.i18n.localize(`OP2.FalhaCritica.${entrada.chave}.nome`),
    }));
    return;
  }

  if (entrada.efeito === "dano") {
    const roll = await new Roll(entrada.formula).evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: ator }),
      flavor: game.i18n.localize(`OP2.FalhaCritica.${entrada.chave}.nome`),
    });
    await aplicarDano(ator, roll.total, entrada.alvo);
  }
}

/**
 * @param {Actor} ator
 * @param {number} quantidade
 * @param {"pv"|"pd"} recurso
 */
export async function aplicarDano(ator, quantidade, recurso = "pv") {
  const atual = ator.system.recursos[recurso].value;
  await ator.update({ [`system.recursos.${recurso}.value`]: Math.max(0, atual - quantidade) });
}
