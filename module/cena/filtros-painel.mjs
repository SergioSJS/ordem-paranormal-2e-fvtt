/**
 * Os filtros das abas de Pontos de interesse e Desafios do painel: o que cada chip
 * significa sobre os dados do card e em que ordem a lista fica. Puro, para o teste
 * offline — o painel aplica no DOM, sem rerrenderizar (achado em uso real: "tô
 * sentindo falta de filtros e ferramentas de navegação… como podem ter vários, tá
 * ruim; a busca ajuda, mas poderiam ter mais opções").
 *
 * Cada card leva o que o filtro lê em `data-*`: `nome`, `oculto` e `marcado` ("1"/"0"),
 * `progresso` (intocado/andamento/esgotado para o ponto; pendente/resolvido para o
 * desafio), `pericias` e `abordagens` (chaves separadas por espaço) e `indice` (a
 * ordem original).
 */

export const ORDENS = ["livro", "nome", "progresso"];

/** Nenhum filtro ligado; a lista na ordem original. */
export function filtrosVazios() {
  return { termo: "", visibilidade: "", progresso: "", mapa: "", pericia: "", abordagem: "", ordem: "livro" };
}

/** Há algum filtro ligado? A ordem não conta: ela não esconde nada. */
export function filtrando(filtros) {
  return Boolean(filtros.termo.trim() || filtros.visibilidade || filtros.progresso
    || filtros.mapa || filtros.pericia || filtros.abordagem);
}

/**
 * O card passa por todos os filtros ligados?
 * @param {Record<string, string>} dados — os `data-*` do card (`DOMStringMap` serve).
 */
export function casaFiltros(dados, filtros) {
  const termo = normalizar(filtros.termo);
  if (termo && !normalizar(dados.nome).includes(termo)) return false;
  if (filtros.visibilidade && (filtros.visibilidade === "ocultos") !== (dados.oculto === "1")) return false;
  if (filtros.progresso && dados.progresso !== filtros.progresso) return false;
  if (filtros.mapa && (filtros.mapa === "com") !== (dados.marcado === "1")) return false;
  if (filtros.pericia && !lista(dados.pericias).includes(filtros.pericia)) return false;
  if (filtros.abordagem && !lista(dados.abordagens).includes(filtros.abordagem)) return false;
  return true;
}

const PESO_PROGRESSO = { intocado: 0, pendente: 0, andamento: 1, esgotado: 2, resolvido: 2 };

/**
 * Comparador dos `data-*` de dois cards para a ordem pedida. Empate volta à ordem
 * original, que na aventura montada do livro é a ordem do livro.
 */
export function compararCards(ordem) {
  const original = (a, b) => Number(a.indice) - Number(b.indice);
  if (ordem === "nome") {
    return (a, b) => String(a.nome ?? "").localeCompare(String(b.nome ?? ""), "pt-BR", { sensitivity: "base" })
      || original(a, b);
  }
  if (ordem === "progresso") {
    return (a, b) => (PESO_PROGRESSO[a.progresso] ?? 0) - (PESO_PROGRESSO[b.progresso] ?? 0) || original(a, b);
  }
  return original;
}

/**
 * O progresso de um ponto pelo que já chegou a alguém: nada (intocado), parte
 * (andamento) ou tudo (esgotado). Rascunho não conta: ele nunca chega a ninguém, e
 * um ponto com um rascunho sobrando nunca ficaria esgotado.
 *
 * Para o jogador para em "andamento": o "esgotado" entregaria que não há mais nada
 * para achar ali — e nem no `data-*` do card ele pode aparecer.
 * @param {{ oculta?: boolean }[]} informacoes — as linhas do quadro.
 * @param {number} visiveis — quantas já chegaram a alguém (ou a quem olha).
 * @param {{ mestre?: boolean }} [opcoes]
 */
export function progressoDoPonto(informacoes, visiveis, { mestre = true } = {}) {
  if (visiveis <= 0) return "intocado";
  if (!mestre) return "andamento";
  const jogaveis = informacoes.filter((info) => !info.oculta).length;
  return visiveis >= jogaveis ? "esgotado" : "andamento";
}

/** Comparação de nomes sem acento nem caixa, para a busca. */
export function normalizar(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function lista(texto) {
  return String(texto ?? "").split(" ").filter(Boolean);
}
