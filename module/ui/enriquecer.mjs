/**
 * Enriquece HTML de campo de texto rico. `TextEditor` mudou de lugar no v13 — o
 * fallback mantém o v12 utilizável em dev.
 *
 * Todo `{{formInput}}` com `toggled=true` precisa disso: fechado, o editor mostra o
 * HTML enriquecido, e sem ele a ficha aparece vazia mesmo com o texto salvo.
 */
export function enriquecerHtml(html, documento) {
  const editor = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
  return editor.enrichHTML(html ?? "", {
    relativeTo: documento,
    secrets: documento?.isOwner ?? false,
  });
}
