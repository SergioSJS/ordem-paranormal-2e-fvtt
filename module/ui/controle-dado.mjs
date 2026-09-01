/**
 * Ligação compartilhada do controle de dado nas fichas de ator: a roda do mouse sobre o
 * ícone anda um passo na escada.
 */

/**
 * Só reage quando o controle está **focado**. Sem essa trava, rolar a lista de perícias
 * com o mouse ou o trackpad muda qualquer dado que o cursor cruzar no caminho, e uma
 * ficha inteira corrompe silenciosamente. O clique que abre o seletor força o foco no
 * botão (Safari não foca botão em clique por padrão); só depois disso a roda ajusta —
 * o mesmo padrão que `<input type="number">` já usa nos navegadores modernos.
 *
 * @param {HTMLElement} raiz  elemento cujos descendentes `.op2-controle-dado[data-caminho]`
 *                            recebem o listener
 * @param {(caminho: string, passos: number) => void} aplicarPasso
 */
export function ligarRodaDoMouse(raiz, aplicarPasso) {
  for (const controle of raiz.querySelectorAll(".op2-controle-dado[data-caminho]")) {
    controle.addEventListener("wheel", (evento) => {
      if (!controle.contains(document.activeElement)) return; // deixa a lista rolar normalmente
      evento.preventDefault();
      aplicarPasso(controle.dataset.caminho, evento.deltaY < 0 ? 1 : -1);
    }, { passive: false });
  }
}
