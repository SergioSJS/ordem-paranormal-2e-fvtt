/**
 * Ícones de dado.
 *
 * O livro não escreve "d8": desenha a forma com o número dentro. Cada tamanho tem uma
 * silhueta própria, e é isso que torna a ficha legível de relance.
 *
 *   d4 triângulo · d6 quadrado · d8 losango · d10 pipa · d12 octógono · d20 círculo
 *
 * A forma vem de `clip-path` no CSS, não de SVG inline: o conteúdo das mensagens de chat
 * passa pelo sanitizador do Foundry, que remove `<svg>` e deixa só o texto solto. Um
 * `<span>` sobrevive, funciona igual na ficha e no chat, e economiza centenas de nós —
 * uma ficha chega a mostrar quase 200 dados de uma vez.
 */

export const DADOS_CONHECIDOS = ["d4", "d6", "d8", "d10", "d12", "d20"];

/**
 * @param {string} dado          "d8"
 * @param {object} [opcoes]
 * @param {string|number} [opcoes.texto]  o que vai dentro; default é o número de faces
 * @param {string} [opcoes.classe]        classes extras
 * @param {string} [opcoes.titulo]        rótulo acessível; sem ele o ícone é decorativo
 * @returns {string} HTML
 */
export function iconeDado(dado, { texto, classe = "", titulo } = {}) {
  const chave = DADOS_CONHECIDOS.includes(dado) ? dado : "d4";
  const conteudo = texto ?? chave.slice(1);
  const classes = `op2-dado op2-dado--${chave} ${classe}`.trim();

  const acessivel = titulo
    ? `role="img" aria-label="${escapar(titulo)}"`
    : `aria-hidden="true"`;

  return `<span class="${classes}" ${acessivel}><span class="op2-dado__texto">${escapar(conteudo)}</span></span>`;
}

/**
 * Ícone de um dado já rolado: a forma do dado, o resultado dentro.
 * @param {{dado: string, resultado: number, contado?: boolean}} lancamento
 */
export function iconeResultado({ dado, resultado, contado = true }) {
  return iconeDado(dado, {
    texto: resultado,
    classe: `op2-dado--resultado${contado ? "" : " op2-dado--descartado"}`,
    titulo: `${dado}: ${resultado}`,
  });
}

function escapar(valor) {
  return String(valor).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/**
 * Helpers de Handlebars: `{{op2Dado "d8"}}` e `{{op2DadoResultado d}}`.
 *
 * O prefixo não é cosmético. Um helper chamado `dado` sequestra `{{dado}}` em qualquer
 * contexto que tenha uma propriedade `dado` — e o markup inteiro acaba injetado dentro
 * de um `aria-label`, quebrando a tag.
 */
export function registrarHelpersDeDado() {
  Handlebars.registerHelper("op2Dado", (dado, opcoes) =>
    new Handlebars.SafeString(iconeDado(dado, opcoes?.hash ?? {})));
  Handlebars.registerHelper("op2DadoResultado", (lancamento) =>
    new Handlebars.SafeString(iconeResultado(lancamento)));
}
