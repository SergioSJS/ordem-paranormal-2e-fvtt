/**
 * A escada de dados é a primitiva central do sistema: em Ordem Paranormal 2 quase
 * nada é `+N`, tudo é subir ou descer um degrau (spec §3).
 */
import { ESCADA, DADO_SOBRE_HUMANO } from "../config.mjs";

/** @typedef {"d4"|"d6"|"d8"|"d10"|"d12"|"d20"} Dado */

/**
 * Número de faces de um dado. Vale por si só: em cenas de investigação o tamanho do
 * dado é comparado direto contra a DT, sem rolagem (spec §6.3).
 * @param {Dado} dado
 * @returns {number}
 */
export function faces(dado) {
  return Number.parseInt(String(dado).slice(1), 10);
}

/** @param {Dado} dado @returns {boolean} */
export function naEscada(dado) {
  return ESCADA.includes(dado);
}

/**
 * Sobe ou desce degraus na escada.
 *
 * Piso d4, teto d12. O d20 é exceção: só se o efeito declarar `permitirD20`, e uma vez
 * em d20 só se desce de volta para d12.
 *
 * @param {Dado} dado
 * @param {number} passos  positivo sobe, negativo desce
 * @param {{permitirD20?: boolean}} [opcoes]
 * @returns {Dado}
 */
export function stepDie(dado, passos = 0, { permitirD20 = false } = {}) {
  if (dado === DADO_SOBRE_HUMANO) {
    return passos < 0 ? ESCADA[ESCADA.length - 1] : DADO_SOBRE_HUMANO;
  }

  const base = ESCADA.indexOf(dado);
  if (base === -1) return ESCADA[0];

  const alvo = base + Math.trunc(passos);
  if (alvo >= ESCADA.length) return permitirD20 ? DADO_SOBRE_HUMANO : ESCADA[ESCADA.length - 1];
  return ESCADA[Math.max(0, alvo)];
}

/**
 * Quantos degraus separam dois dados. Positivo = `destino` é maior.
 * @param {Dado} origem @param {Dado} destino @returns {number}
 */
export function distanciaEmPassos(origem, destino) {
  return ESCADA.indexOf(destino) - ESCADA.indexOf(origem);
}

/**
 * Passos que o dado de um ajudante concede ao aliado: d6/d8 dão 1, d10/d12 dão 2,
 * e com d4 não é possível ajudar (spec §4.7).
 * @param {Dado} dadoDoAjudante @returns {number}
 */
export function passosDeAjuda(dadoDoAjudante) {
  const n = faces(dadoDoAjudante);
  if (n <= 4) return 0;
  return n <= 8 ? 1 : 2;
}

/**
 * Rótulo curto para UI e chat: "d8".
 * @param {Dado} dado @returns {string}
 */
export function rotulo(dado) {
  return naEscada(dado) || dado === DADO_SOBRE_HUMANO ? dado : ESCADA[0];
}
