/**
 * Regras das ferramentas da Ordo Realitas, isoladas do Foundry (spec §9).
 *
 * As duas com minigame dedicado (Laboratório Portátil, Rádio Modificado) têm a
 * conta pura aqui, prontas para o app de UI — que ainda não existe (roadmap M3).
 * Até lá, essas ferramentas funcionam como as demais: revelam o texto de
 * `ferramentas.<chave>` do POI, sem a camada extra do minigame.
 */

/** @param {Array<{type: string, system?: {subtipo?: string}}>} itens */
export function temFerramenta(itens, subtipo) {
  return itens.some((item) => item.type === "ferramenta" && item.system?.subtipo === subtipo);
}

/** @param {{usa: boolean, value: number}} cargas */
export function podeUsarCarga(cargas) {
  return !cargas?.usa || cargas.value > 0;
}

/**
 * LABORATÓRIO PORTÁTIL (spec §9.1): escada crescente d4→teto, um dado por rolagem.
 * O teto é o dado de Aptidão (Exatas); atingido, repete-se esse dado.
 * @param {number} qtdDados 4 a 6, definido pelo POI
 * @param {string} aptidaoExatas dado efetivo de Aptidão (Exatas), ex.: "d10"
 * @param {string[]} escada a ladder do sistema (`ESCADA` de config.mjs)
 * @returns {string[]} um dado por rolagem, na ordem
 */
export function sequenciaLaboratorio(qtdDados, aptidaoExatas, escada) {
  const teto = escada.indexOf(aptidaoExatas);
  return Array.from({ length: qtdDados }, (_, i) => escada[Math.min(i, teto)]);
}

/** Rerrolagens disponíveis: metade das faces do atributo Mente (spec §9.1). */
export function rerrolagensLaboratorio(facesMente) {
  return facesMente / 2;
}

/** A sequência quebra na primeira rolagem menor que a anterior (spec §9.1). */
export function sequenciaValida(resultados) {
  return resultados.every((valor, i) => i === 0 || valor >= resultados[i - 1]);
}

/**
 * RÁDIO MODIFICADO (spec §9.2): o teste de Tecnologia decide quantos conjuntos
 * falsos somem, até o total de conjuntos falsos que existirem de fato.
 */
export function conjuntosFalsosRemovidos(total, totalConjuntosFalsos) {
  if (total >= 13) return totalConjuntosFalsos;
  if (total >= 10) return Math.min(3, totalConjuntosFalsos);
  if (total >= 7) return Math.min(2, totalConjuntosFalsos);
  return 0;
}
