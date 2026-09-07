/**
 * A barra de filtros que o painel e a janela de ações compartilham: monta o contexto
 * do partial `cena/partials/painel-filtros.hbs`, liga os campos e aplica os filtros
 * no DOM, sem rerrenderizar. O que cada chip significa e a ordem estão em
 * `filtros-painel.mjs`, puro.
 *
 * O jogador tem a mesma barra, com dois cortes para não vazar segredo: não filtra
 * por visibilidade (só vê o visível) e o progresso dele para em "com pistas" — o
 * "esgotado" do mestre entregaria que não há mais nada para achar ali. O seletor de
 * perícia lista só o que aparece nos cards de quem olha, então para o jogador são as
 * perícias das linhas que ele já vê.
 */
import { filtrosVazios, filtrando, casaFiltros, compararCards } from "./filtros-painel.mjs";
import { rotuloDePericia } from "../dice/teste.mjs";

/** As abordagens de um desafio, na ordem das tags do card e do seletor de filtro. */
export const ROTULOS_ABORDAGEM = {
  arrombar: "OP2.Desafio.Arrombar", destrancar: "OP2.Desafio.Destrancar",
  hackTecnico: "OP2.Desafio.HackTecnico", hackSocial: "OP2.Desafio.HackSocial",
  sustentar: "OP2.Desafio.Sustentar",
};

/** As chaves das abordagens ligadas num desafio, para o `data-abordagens` do card. */
export function chavesDasAbordagens(abordagens) {
  return [...Object.keys(ROTULOS_ABORDAGEM), "generico"].filter((chave) => abordagens?.[chave]).join(" ");
}

const CHIPS = {
  visibilidade: [["visiveis", "Visiveis"], ["ocultos", "Ocultos"]],
  progressoDoMestre: [["intocado", "Intocados"], ["andamento", "EmAndamento"], ["esgotado", "Esgotados"]],
  progressoDoJogador: [["intocado", "Intocados"], ["andamento", "ComPistas"]],
  estado: [["pendente", "Pendentes"], ["resolvido", "Resolvidos"]],
  mapa: [["com", "NoMapa"], ["sem", "SemMarcador"]],
};

/**
 * O contexto da barra de uma aba.
 * @param {"pontos"|"desafios"} aba
 * @param {object} filtros — o estado da aba (`filtrosVazios()`), que vive na janela.
 * @param {object} opcoes
 * @param {boolean} opcoes.ehGM
 * @param {string[]} [opcoes.pericias] — as perícias dos cards à vista (aba de pontos).
 */
export function contextoBarra(aba, filtros, { ehGM, pericias = [] }) {
  const l = (chave) => game.i18n.localize(`OP2.Painel.Filtro.${chave}`);
  const chips = (dimensao, valores) => valores.map(([valor, chave]) => ({
    aba, dimensao, valor, rotulo: l(chave),
    dica: game.i18n.has(`OP2.Painel.Filtro.${chave}Dica`) ? l(`${chave}Dica`) : "",
    ativo: filtros[dimensao] === valor,
  }));
  const grupos = [];
  if (ehGM) grupos.push(chips("visibilidade", CHIPS.visibilidade));
  if (aba === "pontos") grupos.push(chips("progresso", ehGM ? CHIPS.progressoDoMestre : CHIPS.progressoDoJogador));
  else grupos.push(chips("progresso", CHIPS.estado));
  grupos.push(chips("mapa", CHIPS.mapa));

  const seletor = aba === "pontos"
    ? {
      dimensao: "pericia", vazio: l("QualquerPericia"),
      opcoes: [...new Set(pericias)].filter(Boolean)
        .map((chave) => ({ valor: chave, rotulo: rotuloDePericia(chave), ativa: filtros.pericia === chave }))
        .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR")),
    }
    : {
      dimensao: "abordagem", vazio: l("QualquerAbordagem"),
      opcoes: [...Object.entries(ROTULOS_ABORDAGEM), ["generico", "OP2.Desafio.Generico"]]
        .map(([valor, chave]) => ({ valor, rotulo: game.i18n.localize(chave), ativa: filtros.abordagem === valor })),
    };
  const ordens = [["livro", "OrdemLivro"], ["nome", "OrdemNome"], ["progresso", "OrdemProgresso"]]
    .map(([valor, chave]) => ({ valor, rotulo: l(chave), ativa: filtros.ordem === valor }));
  return { aba, grupos, seletor, ordens };
}

/**
 * Liga os campos da barra (termo e seletores) de todas as abas de uma janela. Os
 * chips são `data-action="alternarChip"` e o limpar `data-action="limparFiltros"`:
 * cada janela os trata com `alternarChip()` e `limparBarra()`.
 * @param {HTMLElement} elemento — a raiz da janela.
 * @param {Record<string, object>} filtrosPorAba
 * @param {(aba: string) => void} aplicar
 */
export function ligarBarra(elemento, filtrosPorAba, aplicar) {
  for (const campo of elemento.querySelectorAll("[data-filtro-termo]")) {
    campo.addEventListener("input", () => {
      filtrosPorAba[campo.dataset.filtroTermo].termo = campo.value;
      aplicar(campo.dataset.filtroTermo);
    });
  }
  for (const seletor of elemento.querySelectorAll("[data-filtro-seletor]")) {
    seletor.addEventListener("change", () => {
      filtrosPorAba[seletor.dataset.aba][seletor.dataset.filtroSeletor] = seletor.value;
      aplicar(seletor.dataset.aba);
    });
  }
}

/** Liga o chip; clicar no que já está ligado desliga (volta a "todos"). */
export function alternarChip(filtros, chip) {
  const { dimensao, valor } = chip.dataset;
  filtros[dimensao] = filtros[dimensao] === valor ? "" : valor;
}

/**
 * Aplica os filtros de uma aba no DOM: esconde, marca o achado pela busca, reordena,
 * pinta os chips, conta e mostra o limpar.
 * @param {HTMLElement|null} secao — a aba.
 * @param {object} filtros — o estado da aba.
 * @param {object} alvo
 * @param {string} alvo.lista — o seletor da lista dentro da aba.
 * @param {string} alvo.card — o seletor de um card dentro da lista.
 * @param {string} alvo.classeAchado — a classe do card achado pela busca.
 */
export function aplicarBarra(secao, filtros, { lista, card, classeAchado }) {
  const ol = secao?.querySelector(lista);
  if (!ol) return;
  const cards = [...ol.querySelectorAll(`:scope > ${card}`)];
  const buscando = Boolean(filtros.termo.trim());
  let visiveis = 0;
  for (const el of cards) {
    const casa = casaFiltros(el.dataset, filtros);
    el.hidden = !casa;
    // Quem busca pelo nome quer ler: o card achado aparece aberto, sem mexer no que
    // está recolhido no navegador.
    el.classList.toggle(classeAchado, casa && buscando);
    if (casa) visiveis += 1;
  }
  // A ordem reordena os <li> no lugar: `append` move o nó, não duplica.
  const comparar = compararCards(filtros.ordem);
  for (const el of cards.sort((a, b) => comparar(a.dataset, b.dataset))) ol.append(el);

  const ligado = filtrando(filtros);
  for (const chip of secao.querySelectorAll("[data-action='alternarChip']")) {
    const ativo = filtros[chip.dataset.dimensao] === chip.dataset.valor;
    chip.classList.toggle("ativo", ativo);
    chip.setAttribute("aria-pressed", String(ativo));
  }
  const contagem = secao.querySelector("[data-filtro-contagem]");
  if (contagem) {
    contagem.textContent = game.i18n.format("OP2.Painel.Filtro.Contagem", { visiveis, total: cards.length });
    contagem.hidden = !ligado;
  }
  const limpar = secao.querySelector("[data-action='limparFiltros']");
  if (limpar) limpar.hidden = !ligado;
}

/**
 * Desliga tudo de uma aba menos a ordem e limpa os campos dela.
 * @returns {object} o estado novo da aba.
 */
export function limparBarra(secao, filtros) {
  for (const campo of secao?.querySelectorAll("[data-filtro-termo]") ?? []) campo.value = "";
  for (const seletor of secao?.querySelectorAll("[data-filtro-seletor]") ?? []) {
    if (seletor.dataset.filtroSeletor !== "ordem") seletor.value = "";
  }
  return { ...filtrosVazios(), ordem: filtros.ordem };
}
