/**
 * Lesões e traumas do beta (beta §8), sem Foundry.
 *
 * Substituem o "falhou, morreu" do alpha (spec §8.2/§8.3). As tabelas guardam só a chave e
 * a mecânica; o nome e o efeito por extenso ficam no i18n (`OP2.Lesao.*`, `OP2.TraumaBeta.*`).
 */
import { REDUCAO_POR_PONTO_DE_ARMADURA } from "../config.mjs";

export const PATAMARES = ["iniciante", "veterano", "elite", "lenda"];

/** +1 por patamar acima de iniciante, na rolagem de lesão e de trauma (beta §8.2). */
export const bonusDePatamar = (patamar) => Math.max(0, PATAMARES.indexOf(patamar));

/**
 * `perm`: fica na ficha. `mod`: modificador fixo em perícia (`{percepcao: -1}`) ou atributo
 * (`{mente: -1}`), que entra em todo teste. `pvMax`/`pdMax`: perda do máximo.
 */
export const LESOES = [
  { de: 1, ate: 4, chave: "morteSubita", morte: true },
  { de: 5, ate: 9, chave: "morteLenta", recupera: 1, acorda: true },
  { de: 10, ate: 10, chave: "laceracao", perm: true, pvMax: -2, acumula: true },
  { de: 11, ate: 11, chave: "semOlho", perm: true, mod: { percepcao: -1, pontaria: -1 } },
  { de: 12, ate: 12, chave: "semMao", perm: true },
  { de: 13, ate: 13, chave: "semPe", perm: true },
  { de: 14, ate: 14, chave: "tendao", perm: true, mod: { acrobacia: -2 } },
  { de: 15, ate: 15, chave: "musculo", perm: true, mod: { atletismo: -2 } },
  { de: 16, ate: 16, chave: "orgaoInterno", perm: true, mod: { vigor: -2 } },
  { de: 17, ate: 17, chave: "orgaoSensorial", perm: true, mod: { percepcao: -2 } },
  { de: 18, ate: 18, chave: "cicatriz", perm: true, mod: { persuasao: -2, intimidar: 1 } },
  { de: 19, ate: 19, chave: "contusao", reduz: "fisico" },
  { de: 20, ate: Infinity, chave: "surto", recupera: 1 },
];

export const TRAUMAS = [
  { de: 1, ate: 4, chave: "colapso", morte: true },
  { de: 5, ate: 6, chave: "estresse", perm: true, danoEmocional: 1 },
  { de: 7, ate: 8, chave: "cognitiva", perm: true, mod: { mente: -1 } },
  { de: 9, ate: 10, chave: "macula", perm: true, mod: { emocao: -1 } },
  { de: 11, ate: 12, chave: "chaga", perm: true, pdMax: -2 },
  { de: 13, ate: 14, chave: "retracao", perm: true, mod: { persuasao: -2, intuicao: -2 } },
  { de: 15, ate: 17, chave: "panico", pavor: true },
  { de: 18, ate: 19, chave: "estupor" },
  { de: 20, ate: Infinity, chave: "animo", recuperaPd: 1 },
];

/** A linha da tabela para esta rolagem, já com o bônus de patamar somado. */
export const linhaDaTabela = (tabela, valor) => tabela.find((l) => valor >= l.de && valor <= l.ate) ?? tabela[0];

/** Lesão ou trauma que o personagem já tem rola de novo, menos o que acumula (beta §8.2). */
export function precisaRolarDeNovo(linha, jaTem = []) {
  return Boolean(linha.perm && !linha.acumula && jaTem.includes(linha.chave));
}

/** O que cada desfecho do teste de lesão manda (beta §8.2). */
export function efeitoDoTesteDeLesao(desfecho) {
  if (desfecho === "critico") return { recupera: 1, sai: ["inconsciente", "moribundo"] };
  if (desfecho === "sucesso") return { condicoes: ["inconsciente", "moribundo"] };
  if (desfecho === "falha-critica") return { morte: true };
  return { lesao: true };
}

/**
 * Soma dos modificadores fixos que lesões e traumas põem neste teste.
 * @param {{lesoes?: string[], traumas?: string[]}} estado
 * @param {string} chavePericia
 * @param {string} [chaveAtributo]
 */
export function modificadorPermanente({ lesoes = [], traumas = [] } = {}, chavePericia, chaveAtributo) {
  const linhas = [
    ...lesoes.map((c) => LESOES.find((l) => l.chave === c)),
    ...traumas.map((c) => TRAUMAS.find((l) => l.chave === c)),
  ].filter(Boolean);
  return linhas.reduce((total, l) => total + (l.mod?.[chavePericia] ?? 0) + (l.mod?.[chaveAtributo] ?? 0), 0);
}

/**
 * O que anotar ou curar uma linha muda nos máximos: Laceração tira PV, Chaga tira PD.
 * @param {"lesoes"|"traumas"} lista
 * @param {string} chave
 * @returns {{pv: number, pd: number}} a perda, em número negativo
 */
export function maximosDaLinha(lista, chave) {
  const linha = (lista === "lesoes" ? LESOES : TRAUMAS).find((l) => l.chave === chave);
  return { pv: linha?.pvMax ?? 0, pd: linha?.pdMax ?? 0 };
}

/** Dano emocional a mais do Estresse pós-traumático. */
export const extraDeDanoEmocional = ({ traumas = [] } = {}) => (traumas.includes("estresse") ? 1 : 0);

/**
 * Quanto do dano chega depois de RD e armadura (beta §8.4/§8.5). Um ponto de armadura
 * reduz 10; a RD desconta antes, e arma especial ignora parte dela.
 * @param {number} dano
 * @param {{rd?: number, ignoraRd?: number, gastarArmadura?: boolean}} [protecao]
 */
export function danoDepoisDaProtecao(dano, { rd = 0, ignoraRd = 0, gastarArmadura = false } = {}) {
  const depoisDaRd = Math.max(0, dano - Math.max(0, rd - ignoraRd));
  return Math.max(0, depoisDaRd - (gastarArmadura ? REDUCAO_POR_PONTO_DE_ARMADURA : 0));
}
