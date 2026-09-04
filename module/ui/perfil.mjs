/**
 * A cor do perfil segue o personagem.
 *
 * O livro dá identidade visual a cada perfil (playtest, p. 14) e pinta a ficha
 * inteira com ela. Toda janela que nasce de um personagem — a de ações, o diálogo de
 * teste, a escolha de perícia, a seleção de dados, os minigames — veste a mesma cor,
 * senão o jogador abre uma janela azul e cai numa vermelha (achado em uso real).
 *
 * O CSS lê `data-perfil` no elemento raiz da janela e troca ali os tokens de cor.
 */

/** Carimba o perfil do personagem na janela. Sem perfil, a janela fica no tema padrão. */
export function vestirPerfil(elemento, ator) {
  const perfil = ator?.system?.perfil;
  if (!elemento || !perfil) return;
  elemento.dataset.perfil = perfil;
}

/**
 * O mesmo, para os diálogos do core: `DialogV2` chama `render` com o próprio diálogo.
 *
 *   DialogV2.prompt({ ..., render: renderDoPerfil(ator) })
 */
export function renderDoPerfil(ator) {
  return (_evento, dialogo) => vestirPerfil(dialogo?.element, ator);
}
