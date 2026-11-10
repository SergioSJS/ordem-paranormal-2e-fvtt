/**
 * Atualiza as pistas dos pontos que já estão no mundo a partir da aventura guardada, lida de um PDF
 * mais novo (a revisão 1.1 do beta mudou DTs, corrigiu linhas trocadas e deu quadro aos nichos).
 *
 * O texto é do livro e só existe no mundo porque veio do PDF: por isso não há como corrigir ao
 * abrir o mundo, e o mestre escolhe o PDF novo e clica. Reimportar a aventura também serviria, mas
 * reescreveria cenas, fichas e tokens. Aqui só o quadro de cada ponto muda, e quem descobriu cada
 * pista continua com ela: a revelação é guardada pelo id da linha, e a linha casada com a antiga
 * (pelo texto) herda o id e o estado dela (rascunho, aberta, contada ao grupo).
 */
const palavras = (texto) => new Set(String(texto ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .split(/[^a-z0-9]+/).filter((w) => w.length > 2));

/** Semelhança entre dois textos (Jaccard das palavras). */
export function similaridade(a, b) {
  const A = palavras(a);
  const B = palavras(b);
  if (!A.size || !B.size) return 0;
  let comum = 0;
  for (const w of A) if (B.has(w)) comum += 1;
  return comum / (A.size + B.size - comum);
}

/** Abaixo disto, a linha nova é outra pista, não a antiga reescrita. */
export const SEMELHANCA_MINIMA = 0.5;

/**
 * As linhas novas, cada uma casada com a antiga de texto mais parecido (que ainda não foi usada).
 * A casada fica com o id e o estado da antiga; a sem par entra como veio, com id novo se o dela já
 * pertencia a uma linha antiga (senão herdaria a revelação de outra pista).
 * @param {object[]} antigas
 * @param {object[]} novas
 * @param {() => string} novoId
 * @returns {{informacoes: object[], casadas: number, novas: number, removidas: object[]}}
 */
export function mesclarInformacoes(antigas, novas, novoId) {
  const usadas = new Set();
  const idsAntigos = new Set(antigas.map((v) => v.id));
  let casadas = 0;
  const informacoes = novas.map((n) => {
    let melhor = null;
    let nota = 0;
    for (const v of antigas) {
      if (usadas.has(v.id)) continue;
      const s = similaridade(v.texto, n.texto);
      if (s > nota) { nota = s; melhor = v; }
    }
    if (melhor && nota >= SEMELHANCA_MINIMA) {
      usadas.add(melhor.id);
      casadas += 1;
      return { ...n, id: melhor.id, oculta: melhor.oculta, aberta: melhor.aberta, contadaPor: melhor.contadaPor ?? [] };
    }
    return { ...n, id: idsAntigos.has(n.id) ? novoId() : n.id };
  });
  return { informacoes, casadas, novas: informacoes.length - casadas, removidas: antigas.filter((v) => !usadas.has(v.id)) };
}

/** Os pontos da aventura guardada que também estão no mundo (mesmo id). */
export function pontosNoMundo(aventura) {
  return [...(aventura?.items ?? [])]
    .filter((i) => i.type === "ponto-interesse")
    .map((i) => ({ daAventura: i, doMundo: game.items.get(i._id ?? i.id) }))
    .filter((p) => p.doMundo);
}

/**
 * Reescreve o quadro de cada ponto do mundo pelo da aventura guardada.
 * @returns {Promise<{pontos: number, casadas: number, novas: number, removidas: number}>}
 */
export async function atualizarPontosDoMundo(aventura) {
  const total = { pontos: 0, casadas: 0, novas: 0, removidas: 0 };
  const atualizacoes = [];
  for (const { daAventura, doMundo } of pontosNoMundo(aventura)) {
    const fonte = daAventura.toObject ? daAventura.toObject() : daAventura;
    const novas = (fonte.system?.informacoes ?? []).map((i) => ({ ...i }));
    const r = mesclarInformacoes(doMundo.system.toObject().informacoes, novas, () => foundry.utils.randomID(16));
    atualizacoes.push({ _id: doMundo.id, "system.informacoes": r.informacoes });
    total.pontos += 1;
    total.casadas += r.casadas;
    total.novas += r.novas;
    total.removidas += r.removidas.length;
  }
  if (atualizacoes.length) await CONFIG.Item.documentClass.updateDocuments(atualizacoes);
  return total;
}
