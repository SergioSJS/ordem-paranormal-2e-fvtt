/**
 * A leitura de uma ferramenta num ponto tem duas camadas, e o livro imprime as duas
 * juntas no setor do mestre: o que o personagem lê ("a lâmina está mais quente") e a
 * instrução de mesa ("envie o handout", "apenas se o Ídolo for quebrado", a solução
 * do rádio). Entregue inteira, a instrução vazava no card do jogador (achado em uso
 * real, Ato II). O montador marca a parte do mestre com `<p class="op2-mestre">`; a
 * ficha do ponto aceita a mesma marca em texto escrito à mão. Aqui se separa.
 */
const PARAGRAFO_DO_MESTRE = /<p\b[^>]*\bclass="[^"]*\bop2-mestre\b[^"]*"[^>]*>[\s\S]*?<\/p>/gi;

/** O que o jogador lê: a leitura sem os parágrafos do mestre. */
export function leituraParaJogador(html) {
  return String(html ?? "").replace(PARAGRAFO_DO_MESTRE, "").trim();
}

/** Só os parágrafos do mestre, na ordem — vazio quando não há. */
export function parteDoMestre(html) {
  return (String(html ?? "").match(PARAGRAFO_DO_MESTRE) ?? []).join("");
}

/** Chave estável de uma leitura feita: "<uuid do POI>:<ferramenta>" — como `chaveInfo`. */
export function chaveLeitura(poiUuid, chave) {
  return `${poiUuid}:${chave}`;
}

/** Envolve um trecho como parte do mestre, do jeito que `leituraParaJogador` tira. */
export function paragrafoDoMestre(html) {
  return `<p class="op2-mestre">${html}</p>`;
}
