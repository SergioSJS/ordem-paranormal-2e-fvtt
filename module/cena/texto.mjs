/**
 * Texto de roteiro: HTML de um lado, textarea do outro.
 *
 * Narração e efeito são HTML no documento (o card do chat lê parágrafos), mas se
 * editam como texto simples — um editor rico por linha de roteiro seria pesado demais
 * para uma tabela de rodadas.
 */

/** `<p>a</p><p>b</p>` → "a\n\nb", para editar num textarea. */
export function textoPlano(html) {
  return String(html ?? "")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

/** "a\n\nb" → `<p>a</p><p>b</p>`. */
export function htmlDeTexto(texto) {
  const escapar = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return String(texto ?? "").split(/\n\s*\n/).map((par) => par.trim()).filter(Boolean)
    .map((par) => `<p>${escapar(par).replace(/\n/g, "<br>")}</p>`).join("");
}
