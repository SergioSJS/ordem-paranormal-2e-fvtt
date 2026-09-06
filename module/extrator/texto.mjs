/**
 * Miudezas de texto que os extratores usam o tempo todo, com o comportamento das
 * funções de string do Python de onde eles vieram (`isupper`, `title`, `isdigit`).
 */

/** Como `str.isupper()`: tem letra, e toda letra é maiúscula. */
export function ehMaiusculo(texto) {
  const letras = texto.replace(/[^\p{L}]/gu, "");
  return letras.length > 0 && letras === letras.toUpperCase();
}

/** Como `str.islower()`. */
export function ehMinusculo(texto) {
  const letras = texto.replace(/[^\p{L}]/gu, "");
  return letras.length > 0 && letras === letras.toLowerCase();
}

/** Como `str.isdigit()`: só dígitos, pelo menos um. */
export function ehNumero(texto) {
  return /^\d+$/.test(texto);
}

/** Como `str.title()`: primeira letra de cada palavra em maiúscula, o resto em minúscula. */
export function titulo(texto) {
  return texto.toLowerCase().replace(/(^|[^\p{L}\p{N}'])(\p{L})/gu, (_m, antes, letra) => antes + letra.toUpperCase());
}

/** Como `str.capitalize()`. */
export function capitalizar(texto) {
  return texto ? texto[0].toUpperCase() + texto.slice(1).toLowerCase() : texto;
}

/** Espaços em sequência viram um só, sem sobras nas pontas. */
export function limpo(texto) {
  return texto.replace(/\s{2,}/g, " ").trim();
}

/** O recuo da linha: quantos espaços antes do primeiro caractere. */
export function recuo(linha) {
  return linha.length - linha.trimStart().length;
}

/** Coluna estreita quebra palavra no fim da linha: "ilu- minada" volta a ser uma. */
export function juntarHifenizacao(texto) {
  return texto.replace(/(\p{L})-\s*\n\s*(\p{L})/gu, "$1$2");
}

/** Sem acentos, para comparar nomes. */
export function semAcento(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Escapa um trecho para entrar numa RegExp. */
export function escapar(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Como `min(indices, key=lambda d: (abs(d - k), d > k))` do Python: o índice mais
 * perto de `k`; empate fica com o de cima.
 */
export function maisPerto(indices, k) {
  let melhor = null;
  for (const d of indices) {
    if (melhor === null) { melhor = d; continue; }
    const distancia = Math.abs(d - k), atual = Math.abs(melhor - k);
    if (distancia < atual || (distancia === atual && d < melhor)) melhor = d;
  }
  return melhor;
}
