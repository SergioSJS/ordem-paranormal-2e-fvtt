/**
 * Ícones de dado.
 *
 * O livro não escreve "d8": desenha a forma com o número dentro. Cada tamanho tem uma
 * silhueta própria, e é isso que torna a ficha legível de relance — por isso aqui são
 * SVG inline coloridos por CSS, não `<select>` de texto.
 *
 *   d4 triângulo · d6 quadrado · d8 losango · d10 pipa · d12 octógono · d20 círculo
 */

/** Polígonos em viewBox 0 0 24 24. `null` = círculo. */
const FORMAS = {
  d4: "12,2.5 22.4,20.5 1.6,20.5",
  d6: "3.6,3.6 20.4,3.6 20.4,20.4 3.6,20.4",
  d8: "12,1.6 22.4,12 12,22.4 1.6,12",
  d10: "12,1.6 21.6,9 17.8,21 6.2,21 2.4,9",
  d12: "8.2,1.8 15.8,1.8 22.2,8.2 22.2,15.8 15.8,22.2 8.2,22.2 1.8,15.8 1.8,8.2",
  d20: null,
};

export const DADOS_CONHECIDOS = Object.keys(FORMAS);

/**
 * @param {string} dado          "d8"
 * @param {object} [opcoes]
 * @param {string|number} [opcoes.texto]    o que vai dentro; default é o número de faces
 * @param {string} [opcoes.classe]          classes extras no `<svg>`
 * @param {string} [opcoes.titulo]          rótulo acessível; sem ele o ícone é decorativo
 * @returns {string} SVG
 */
export function iconeDado(dado, { texto, classe = "", titulo } = {}) {
  const chave = FORMAS[dado] !== undefined ? dado : "d4";
  const pontos = FORMAS[chave];
  const conteudo = texto ?? chave.slice(1);

  const forma = pontos
    ? `<polygon points="${pontos}" />`
    : `<circle cx="12" cy="12" r="10.4" />`;

  const acessivel = titulo
    ? `role="img" aria-label="${foundry.utils.escapeHTML?.(titulo) ?? titulo}"`
    : `aria-hidden="true" focusable="false"`;

  const classes = `op2-dado op2-dado--${chave} ${classe}`.trim();
  // O texto do d4 desce: o centro visual de um triângulo não é o centro do viewBox.
  const linhaDeBase = chave === "d4" ? 16.6 : 12.4;

  return `<svg class="${classes}" viewBox="0 0 24 24" ${acessivel}>
  <g class="op2-dado__forma">${forma}</g>
  <text class="op2-dado__texto" x="12" y="${linhaDeBase}" text-anchor="middle" dominant-baseline="middle">${conteudo}</text>
</svg>`;
}

/**
 * Ícone de um dado já rolado: a forma do dado, o resultado dentro.
 * @param {{dado: string, resultado: number, contado: boolean}} lancamento
 */
export function iconeResultado({ dado, resultado, contado = true }) {
  return iconeDado(dado, {
    texto: resultado,
    classe: `op2-dado--resultado ${contado ? "" : "op2-dado--descartado"}`,
    titulo: `${dado}: ${resultado}`,
  });
}

/** Helpers de Handlebars: `{{dado "d8"}}` e `{{dadoResultado d}}`. */
export function registrarHelpersDeDado() {
  Handlebars.registerHelper("dado", (dado, opcoes) =>
    new Handlebars.SafeString(iconeDado(dado, opcoes?.hash ?? {})));
  Handlebars.registerHelper("dadoResultado", (lancamento) =>
    new Handlebars.SafeString(iconeResultado(lancamento)));
}
