/**
 * A linha do quadro de informações é texto puro. Linhas gravadas por versões antigas
 * do gerador (ou coladas de fora) vinham em HTML — `<p><em>(condição)</em> texto</p>`
 * — e a ficha do ponto, que edita num textarea, mostrava as tags (achado em uso real,
 * duas vezes). Aqui o HTML vira texto: parágrafos separados por linha em branco,
 * quebras por quebra, o resto das tags fora, entidades decodificadas.
 */
const ENTIDADES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&apos;": "'", "&nbsp;": " " };

/** @param {string} texto */
export function temHtml(texto) {
  return typeof texto === "string" && /<\/?[a-z][^>]*>/i.test(texto);
}

/**
 * @param {string} texto  HTML ou texto puro
 * @returns {string} texto puro
 */
export function textoPuroDaLinha(texto) {
  if (typeof texto !== "string") return "";
  if (!temHtml(texto)) return texto;
  return texto
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTIDADES[m] ?? m)
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/**
 * Migra as linhas dos pontos de interesse do mundo para texto puro. Idempotente e
 * barata: só grava o que ainda tem tag. Roda no `ready`, pelo mestre.
 * @returns {Promise<number>} quantos pontos foram atualizados
 */
export async function migrarLinhasDoQuadro() {
  const atualizacoes = [];
  for (const item of game.items.filter((i) => i.type === "ponto-interesse")) {
    const linhas = item.system.informacoes ?? [];
    if (!linhas.some((l) => temHtml(l.texto))) continue;
    atualizacoes.push({ _id: item.id, "system.informacoes": linhas.map((l) => ({ ...l, texto: textoPuroDaLinha(l.texto) })) });
  }
  if (atualizacoes.length) await Item.updateDocuments(atualizacoes);
  return atualizacoes.length;
}
