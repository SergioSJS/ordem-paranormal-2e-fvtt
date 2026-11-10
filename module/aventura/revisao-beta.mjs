/**
 * A revisão 1.1 do playtest beta (novembro de 2026) para mundos montados com a 1.0.
 *
 * Só números nossos: o texto do livro não está aqui, e o que mudou nele (DTs dos quadros, o ponto
 * dos Nichos) só chega lendo o PDF novo. Cada correção mexe apenas no valor que ainda está como a
 * 1.0 deixou; o que o mestre editou fica. Cada ator recebe a correção uma vez (`revisaoBeta`).
 */
import { SYSTEM_ID } from "../config.mjs";

/** A marca no ator: a revisão do beta que ele já recebeu. */
export const MARCA_DA_REVISAO = "revisaoBeta";
export const REVISAO_ATUAL = "1.1";

/** A RD do aughisk que a 1.1 imprime (p. 45). A 1.0 não imprimia; a mesa tinha fixado 3. */
export const RD_DO_AUGHISK = 10;

/** O dado de perícia que as fichas 1.1 corrigiram, por pré-gerado (nome curto). */
export const PERICIAS_DA_REVISAO_1_1 = {
  rowan: { acrobacia: { de: "d6", para: "d4" }, animais: { de: "d6", para: "d8" } },
  muirenn: { pontaria: { de: "d6", para: "d4" } },
  cormac: { sobrevivencia: { de: "d8", para: "d4" } },
};

/** O nome completo de cada pré-gerado corrigido: só ele, para não mexer em personagem de jogador. */
const NOMES = { rowan: "Rowan Lobo Castanho", muirenn: "Muirenn da Lua Pálida", cormac: "Cormac Coluim" };

const jaRevisado = (ator) => ator?.flags?.[SYSTEM_ID]?.[MARCA_DA_REVISAO] === REVISAO_ATUAL;

/**
 * As mudanças da 1.1 num ator, como caminhos de update, ou `null`.
 * Aughisk: RD 3 (decisão antiga) ou 5 (montagem antiga) vira 10. Afogado: Atletismo d8 vira d6.
 * Pré-gerados: as perícias da tabela, quando ainda no dado da 1.0.
 * @param {{type?: string, name?: string, system?: object, flags?: object}} ator
 */
export function revisaoDoAtor(ator) {
  if (!ator?.system || jaRevisado(ator)) return null;
  const nome = ator.name ?? "";
  const mudancas = {};
  if (ator.type === "npc") {
    if (/^Aughisk( \d+)?$/.test(nome) && [3, 5].includes(ator.system.rd)) mudancas["system.rd"] = RD_DO_AUGHISK;
    if (/^Afogado( \d+)?$/.test(nome) && ator.system.pericias?.atletismo?.die === "d8") mudancas["system.pericias.atletismo.die"] = "d6";
  }
  if (ator.type === "personagem") {
    const chave = Object.keys(NOMES).find((k) => NOMES[k] === nome);
    for (const [pericia, { de, para }] of Object.entries(PERICIAS_DA_REVISAO_1_1[chave] ?? {})) {
      if (ator.system.pericias?.[pericia]?.die === de) mudancas[`system.pericias.${pericia}.die`] = para;
    }
  }
  return Object.keys(mudancas).length ? mudancas : null;
}

/** Aplica as mudanças num documento-fonte (objeto puro, como o da importação). */
export function aplicarNoFonte(ator, mudancas) {
  for (const [caminho, valor] of Object.entries(mudancas)) {
    const partes = caminho.split(".");
    let alvo = ator;
    for (const p of partes.slice(0, -1)) alvo = alvo[p] ??= {};
    alvo[partes.at(-1)] = valor;
  }
  ator.flags = { ...(ator.flags ?? {}), [SYSTEM_ID]: { ...(ator.flags?.[SYSTEM_ID] ?? {}), [MARCA_DA_REVISAO]: REVISAO_ATUAL } };
  return ator;
}

/** As fases da 1.0 que não existem mais: a cena no ar numa delas passa para a geral. */
export const FASE_DA_REVISAO = { suporte: "geral", final: "geral" };
