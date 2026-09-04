/**
 * Rolagem preservada entre rerrenderizações.
 *
 * Quase toda ação de mestre no painel grava no documento (mostrar/esconder um ponto,
 * abrir uma linha do quadro, marcar quem já agiu), e o hook de update rerrenderiza a
 * janela inteira: sem isto, a lista voltava ao topo a cada clique — com trinta pontos
 * na tela, um inferno (achado em uso real).
 *
 * O `scrollable` do HandlebarsApplicationMixin só alcança seletores DENTRO da parte,
 * e o `.window-content` fica fora dela. Aqui vão os dois: os contêineres da parte
 * entram em `state.scrollPositions` (o core restaura) e o `.window-content` viaja à
 * parte. A restauração acontece duas vezes — logo após a troca do HTML, para não
 * piscar, e no fim do render, depois de filtros e classes que mudam a altura.
 */

/** @type {WeakMap<object, {janela: number, alvos: [string, number, number][]}>} */
const ULTIMA = new WeakMap();

/**
 * @param {ApplicationV2} app
 * @param {HTMLElement} priorElement  a parte que vai ser substituída
 * @param {object} state              o objeto de estado do core (`scrollPositions`)
 * @param {string[]} seletores        contêineres de rolagem dentro da parte ("" = a raiz)
 */
export function guardarRolagem(app, priorElement, state, seletores = []) {
  const alvos = [];
  for (const seletor of seletores) {
    const el = seletor === "" ? priorElement : priorElement.querySelector(seletor);
    if (el?.scrollTop) alvos.push([seletor, el.scrollTop, el.scrollLeft]);
  }
  state.scrollPositions ??= [];
  state.scrollPositions.push(...alvos);
  const janela = app.element?.querySelector(".window-content")?.scrollTop ?? 0;
  ULTIMA.set(app, { janela, alvos });
}

/** Devolve a rolagem guardada. Chame depois de trocar o HTML e no fim do render. */
export function restaurarRolagem(app) {
  const guardado = ULTIMA.get(app);
  if (!guardado) return;
  const raiz = app.element;
  if (!raiz) return;
  for (const [seletor, scrollTop, scrollLeft] of guardado.alvos) {
    const el = seletor === "" ? raiz.querySelector("[data-application-part]") : raiz.querySelector(seletor);
    if (el) Object.assign(el, { scrollTop, scrollLeft });
  }
  const janela = raiz.querySelector(".window-content");
  if (janela && guardado.janela) janela.scrollTop = guardado.janela;
}

/** Esquece o que foi guardado — ao fechar, ou quando a rolagem é intencional. */
export function esquecerRolagem(app) {
  ULTIMA.delete(app);
}
