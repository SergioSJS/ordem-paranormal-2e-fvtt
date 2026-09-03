/**
 * Regras das ferramentas da Ordo Realitas, isoladas do Foundry (spec §9).
 *
 * Laboratório Portátil e Rádio Modificado têm minigame dedicado, com a conta pura
 * aqui e o app de UI em `laboratorio-app.mjs`/`radio-app.mjs`.
 */

/** @param {Array<{type: string, system?: {subtipo?: string}}>} itens */
export function temFerramenta(itens, subtipo) {
  return itens.some((item) => item.type === "ferramenta" && item.system?.subtipo === subtipo);
}

/** @param {{usa: boolean, value: number}} cargas */
export function podeUsarCarga(cargas) {
  return !cargas?.usa || cargas.value > 0;
}

/**
 * LABORATÓRIO PORTÁTIL (spec §9.1): escada crescente d4→teto, um dado por rolagem.
 * O teto é o dado de Aptidão (Exatas); atingido, repete-se esse dado.
 * @param {number} qtdDados 4 a 6, definido pelo POI
 * @param {string} aptidaoExatas dado efetivo de Aptidão (Exatas), ex.: "d10"
 * @param {string[]} escada a ladder do sistema (`ESCADA` de config.mjs)
 * @returns {string[]} um dado por rolagem, na ordem
 */
export function sequenciaLaboratorio(qtdDados, aptidaoExatas, escada) {
  const teto = escada.indexOf(aptidaoExatas);
  return Array.from({ length: qtdDados }, (_, i) => escada[Math.min(i, teto)]);
}

/** Rerrolagens disponíveis: metade das faces do atributo Mente (spec §9.1). */
export function rerrolagensLaboratorio(facesMente) {
  return facesMente / 2;
}

/** A sequência quebra na primeira rolagem menor que a anterior (spec §9.1). */
export function sequenciaValida(resultados) {
  return resultados.every((valor, i) => i === 0 || valor >= resultados[i - 1]);
}

/**
 * RÁDIO MODIFICADO (spec §9.2): o teste de Tecnologia decide quantos conjuntos
 * falsos somem, até o total de conjuntos falsos que existirem de fato.
 */
export function conjuntosFalsosRemovidos(total, totalConjuntosFalsos) {
  if (total >= 13) return totalConjuntosFalsos;
  if (total >= 10) return Math.min(3, totalConjuntosFalsos);
  if (total >= 7) return Math.min(2, totalConjuntosFalsos);
  return 0;
}

/**
 * Quais conjuntos sobram pro jogador embaralhar, depois do teste tirar
 * `quantidadeRemovida` falsos de jogo. Sem critério narrativo para escolher um
 * falso em vez de outro, remove sempre os primeiros na ordem cadastrada pelo
 * mestre — determinístico (docs/LACUNAS.md).
 * @param {Array<{verdadeiro: boolean, frase: string}>} conjuntos
 * @param {number} quantidadeRemovida
 */
export function conjuntosRestantes(conjuntos, quantidadeRemovida) {
  let restam = quantidadeRemovida;
  return conjuntos.filter((conjunto) => {
    if (conjunto.verdadeiro) return true;
    if (restam > 0) { restam -= 1; return false; }
    return true;
  });
}

/** Sobe (`-1`) ou desce (`+1`) um índice numa lista qualquer — usado pra reordenar
 * as palavras embaralhadas do Rádio Modificado. */
export function moverEmLista(lista, indice, direcao) {
  const nova = [...lista];
  const novoIndice = indice + direcao;
  if (novoIndice < 0 || novoIndice >= nova.length) return nova;
  [nova[indice], nova[novoIndice]] = [nova[novoIndice], nova[indice]];
  return nova;
}

/**
 * As peças de um conjunto. O livro entrega blocos de palavras ("PENSE NA", "SUA FILHA,")
 * que o jogador ordena em frases: um conjunto escrito com " | " entre os blocos é lido
 * bloco a bloco; sem o separador, palavra a palavra.
 */
export function pecasDoConjunto(frase, modoBlocos = String(frase ?? "").includes("|")) {
  const texto = String(frase ?? "").trim();
  if (!texto) return [];
  return modoBlocos
    ? texto.split("|").map((p) => p.trim()).filter(Boolean)
    : texto.split(/\s+/);
}

/**
 * Um ponto escrito em blocos ("A | B") lê TODOS os conjuntos como blocos: o falso
 * "MATAR ELE" é uma peça só, não duas palavras.
 */
const modoBlocosDe = (conjuntos) => conjuntos.some((c) => String(c.frase ?? "").includes("|"));

/** A ordem de peças bate com a frase correta? */
export function ordemCorreta(ordemAtual, frase) {
  const alvo = pecasDoConjunto(frase);
  return ordemAtual.length === alvo.length && ordemAtual.every((peca, i) => peca === alvo[i]);
}

/**
 * O monte de peças que o jogador vê: todas as peças de todos os conjuntos que sobraram
 * depois do teste, misturadas (spec §9.2: "nem todos os conjuntos serão utilizados").
 * @param {Array<{verdadeiro: boolean, frase: string}>} conjuntos
 * @returns {Array<{texto: string, verdadeiro: boolean, conjunto: number, posicao: number}>}
 */
export function montarPecas(conjuntos) {
  const blocos = modoBlocosDe(conjuntos);
  return conjuntos.flatMap((c, conjunto) => pecasDoConjunto(c.frase, blocos)
    .map((texto, posicao) => ({ texto, verdadeiro: Boolean(c.verdadeiro), conjunto, posicao })));
}

/** A solução: as peças dos conjuntos verdadeiros, na ordem em que o mestre cadastrou. */
export function solucaoDasPecas(conjuntos) {
  const blocos = modoBlocosDe(conjuntos);
  return conjuntos.filter((c) => c.verdadeiro).flatMap((c) => pecasDoConjunto(c.frase, blocos));
}

/**
 * As peças mantidas, na ordem em que o jogador deixou, formam a solução? Descartar
 * uma peça verdadeira ou manter uma falsa erra do mesmo jeito que a ordem errada.
 * @param {Array<{texto: string, descartada?: boolean}>} pecas
 */
export function pecasResolvidas(pecas, conjuntos) {
  const mantidas = pecas.filter((p) => !p.descartada).map((p) => p.texto);
  const alvo = solucaoDasPecas(conjuntos);
  return mantidas.length === alvo.length && mantidas.every((texto, i) => texto === alvo[i]);
}

/** Fisher-Yates — `aleatorio` injetável pra dar determinismo em teste. */
export function embaralhar(lista, aleatorio = Math.random) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Uma ferramenta de POI "reage" quando tem conteúdo — texto não vazio pras ferramentas
 * comuns, ou ao menos um conjunto cadastrado no Rádio Modificado (spec §9.3: até "sem
 * reação" é informação, mas só existe reação de fato pra revelar se algo foi escrito).
 * @param {string|{conjuntos: unknown[]}|null} valor
 */
export function temReacaoFerramenta(valor) {
  if (valor == null) return false;
  if (typeof valor === "string") return Boolean(valor.trim());
  return (Array.isArray(valor.conjuntos) && valor.conjuntos.length > 0) || Boolean(valor.texto?.trim());
}
