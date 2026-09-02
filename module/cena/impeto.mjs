/**
 * Barra de Ímpeto (fichas do Ato I) — o estado mora na habilidade, não no personagem.
 *
 * A barra É a habilidade: apagar a habilidade tem de levar a barra junto. Estas
 * funções são o único caminho para achá-la e mexer nela, para que ninguém volte a
 * guardar esse estado no ator.
 */

/** @returns {Item|null} a habilidade que carrega a barra, se houver. */
export function barraDeImpeto(ator) {
  return ator?.items?.find((i) => i.type === "habilidade" && i.system.temBarraImpeto) ?? null;
}

/** Espaços preenchidos disponíveis para gastar. */
export function impetoDisponivel(ator) {
  return barraDeImpeto(ator)?.system.impeto.preenchidos ?? 0;
}

/** Ainda cabe preencher (falha em teste)? */
export function podePreencherImpeto(ator) {
  const barra = barraDeImpeto(ator);
  return Boolean(barra) && barra.system.impeto.preenchidos < barra.system.impeto.espacos;
}

/** Gasta `quantos` espaços; devolve quantos foram gastos de fato. */
export async function gastarImpeto(ator, quantos = 1) {
  const barra = barraDeImpeto(ator);
  if (!barra) return 0;
  const atual = barra.system.impeto.preenchidos;
  const gasto = Math.min(quantos, atual);
  if (gasto > 0) await barra.update({ "system.impeto.preenchidos": atual - gasto });
  return gasto;
}

/** Preenche um espaço; devolve o estado novo, ou null se não há barra/espaço. */
export async function preencherImpeto(ator) {
  const barra = barraDeImpeto(ator);
  if (!barra) return null;
  const { preenchidos, espacos } = barra.system.impeto;
  if (preenchidos >= espacos) return null;
  await barra.update({ "system.impeto.preenchidos": preenchidos + 1 });
  return { preenchidos: preenchidos + 1, espacos };
}
