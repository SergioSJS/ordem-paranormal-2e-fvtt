/**
 * Combate simplificado (spec §8.1) — regras puras, sem Foundry.
 *
 * O playtest marca este módulo como temporário: o combate completo vem em
 * playtests futuros. Fica isolado de propósito, para ser trocado inteiro.
 */

/**
 * Teste oposto (spec §4.6): quem tirou mais vence, sem DT. Empate não é definido
 * pelo texto — tratamos como "ninguém vence", que preserva o status quo e é o que
 * a mesa costuma narrar (docs/LACUNAS.md).
 * @returns {"atacante"|"defensor"|"empate"}
 */
export function vencedorDoOposto(totalAtacante, totalDefensor) {
  if (totalAtacante > totalDefensor) return "atacante";
  if (totalDefensor > totalAtacante) return "defensor";
  return "empate";
}

/**
 * Dano do vencedor: RA empunhando arma, RB desarmado (spec §8.1).
 * @param {{ra: number, rb: number}} leitura
 */
export function danoDoAtaque(leitura, { armado }) {
  return armado ? leitura.ra : leitura.rb;
}

/**
 * Esquiva (spec §8.1): o defensor abre mão de causar dano e rola Acrobacia com um
 * d6 somado. Se vencer, ninguém sofre nem causa dano — não é contra-ataque.
 * @returns {{dano: number, alvo: "atacante"|"defensor"|null}}
 */
export function resolverAtaque({ vencedor, esquiva, leituraAtacante, leituraDefensor, armadoAtacante, armadoDefensor }) {
  if (vencedor === "empate") return { dano: 0, alvo: null };

  if (esquiva) {
    // Defesa pura: vencer só anula. Perder deixa o ataque acontecer normalmente.
    if (vencedor === "defensor") return { dano: 0, alvo: null };
    return { dano: danoDoAtaque(leituraAtacante, { armado: armadoAtacante }), alvo: "defensor" };
  }

  // Troca de golpes: quem vencer causa dano no outro.
  return vencedor === "atacante"
    ? { dano: danoDoAtaque(leituraAtacante, { armado: armadoAtacante }), alvo: "defensor" }
    : { dano: danoDoAtaque(leituraDefensor, { armado: armadoDefensor }), alvo: "atacante" };
}
