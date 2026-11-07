/**
 * Perseguição (beta §10), sem Foundry. Não é regra geral no livro: cada missão traz a sua.
 * O que é comum vive aqui; o que varia vem nos parâmetros da cena (`cena.system.perseguicao`).
 */
import { faces } from "../dice/escada.mjs";

/** Fôlego: d6 igual à metade das faces de Vigor (Vigor d6 = 3d6). */
export const folegoInicial = (dadoVigor) => Math.floor(faces(dadoVigor) / 2);

/** Avançar: passou soma RA, falhou soma RB; crítico soma as duas maiores (beta §3). */
export function pontosDeAvanco({ sucesso, ra, rb, critico = false, segunda = 0 }) {
  return (sucesso ? ra : rb) + (critico ? segunda : 0);
}

/** Esforço extra: quantos d4 de PV custa o próximo (1d4, depois 2d4…). */
export const formulaDoEsforco = (usosAnteriores) => `${usosAnteriores + 1}d4`;

/**
 * Passos deste avanço: esforço +1, carregar –1 (os dois se anulam), tropeço na vala –2.
 * Avisado pelo aliado o teste de perceber a vala ganha +1, não o avanço.
 */
export function passosDoAvanco({ esforco = false, carregando = false, tropecou = false } = {}) {
  return (esforco ? 1 : 0) - (carregando ? 1 : 0) - (tropecou ? 2 : 0);
}

/**
 * Carregar outro (Missão 1): quem carrega volta ao total do carregado antes do teste, e
 * depois o carregado iguala quem carrega.
 * @param {number} meu pontos de quem carrega
 * @param {number} dele pontos do carregado
 * @returns {{podeCarregar: boolean, base: number}}
 */
export function regraDeCarregar(meu, dele) {
  return { podeCarregar: meu >= dele, base: Math.min(meu, dele) };
}

/** O carregado iguala quem carrega, se ficou para trás. */
export const avancoDoCarregado = (dele, meuNovo) => Math.max(dele, meuNovo);

/** O corte que cai no fim desta rodada, se houver. */
export const corteDaRodada = (cortes, rodada) => cortes.find((c) => c.rodada === rodada) ?? null;

/**
 * Quem o corte pega (beta §10).
 * @param {{id: string, avanco: number, fora?: boolean}[]} corredores
 * @param {number} minimo
 * @param {"derrubado"|"morte"} consequencia `morte` é a Missão 2: só o de menor pontuação
 *   por corte; empate vai para teste oposto entre eles.
 * @returns {{atingidos: string[], empatados: string[]}}
 */
export function atingidosPeloCorte(corredores, minimo, consequencia) {
  const abaixo = corredores.filter((c) => !c.fora && c.avanco < minimo);
  if (consequencia !== "morte") return { atingidos: abaixo.map((c) => c.id), empatados: [] };
  if (!abaixo.length) return { atingidos: [], empatados: [] };
  const menor = Math.min(...abaixo.map((c) => c.avanco));
  const ultimos = abaixo.filter((c) => c.avanco === menor).map((c) => c.id);
  return ultimos.length > 1 ? { atingidos: [], empatados: ultimos } : { atingidos: ultimos, empatados: [] };
}

/** A vala da Missão 2: dispara na primeira ação de avanço já com 15 ou mais (beta §10). */
export const chegouNoObstaculo = (avanco, minimo, jaPassou) => !jaPassou && minimo > 0 && avanco >= minimo;

/**
 * Sorteia `quantos` alvos distintos, com uma fonte de acaso trocável para teste.
 * @template T
 * @param {T[]} lista
 * @param {number} quantos
 * @param {() => number} [acaso]
 * @returns {T[]}
 */
export function sortear(lista, quantos, acaso = Math.random) {
  const copia = [...lista];
  const saida = [];
  while (saida.length < quantos && copia.length) {
    saida.push(copia.splice(Math.floor(acaso() * copia.length), 1)[0]);
  }
  return saida;
}
