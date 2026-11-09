/** Benefícios por grau de relação (beta §9.2), sem Foundry. */
const POR_GRAU = {
  1: { dado: "d6" },
  2: { dado: "d8", motivar: "2d4" },
  3: { dado: "d12", motivar: "2d6", acaoExtra: true },
};

/**
 * O que invocar esta relação pode dar. Grau 0 (neutro) não dá nada.
 * @param {number} grau
 * @returns {Array<{chave: string, dado?: string, formula?: string}>}
 */
export function beneficiosDoGrau(grau) {
  const g = POR_GRAU[grau];
  if (!g) return [];
  return [
    { chave: "teste", dado: g.dado },
    { chave: "ajudar", dado: g.dado },
    ...(g.motivar ? [{ chave: "motivar", formula: g.motivar }] : []),
    ...(g.acaoExtra ? [{ chave: "acaoExtra" }] : []),
  ];
}

/** Uma vez por missão, e neutro não tem o que invocar. */
export const podeInvocar = (relacao) => relacao.grau > 0 && !relacao.invocada;
