import test from "node:test";
import assert from "node:assert/strict";
import { paginaEmLinhas } from "../extrator/grade.mjs";
import { lerTabela, chaveDePericia, linearizarDuasColunas } from "../extrator/ato-i.mjs";
import { ident, tituloLegivel, arquivosDeHandout } from "../aventura/comum.mjs";

/**
 * Um `getTextContent()` de mentira: cada pedaço com texto, posição e corpo, como o
 * pdf.js entrega. O y cresce para cima, como no PDF.
 */
const pagina = (pedacos) => ({
  items: pedacos.map(([str, x, y, h = 9]) => ({
    str, transform: [h, 0, 0, h, x, y], width: str.length * h * 0.45, height: h, hasEOL: false,
  })),
});

test("grade: pedaços na mesma altura viram uma linha em colunas", () => {
  const linhas = paginaEmLinhas(pagina([
    ["Percepção", 74, 700], ["6", 150, 700], ["Há sangue nas chaves.", 170, 700],
  ]), { fonteDoDocumento: 9 });
  assert.equal(linhas.length, 1);
  assert.match(linhas[0], /^Percepção\s{3,}6\s{3,}Há sangue nas chaves\.$/);
});

test("grade: entrelinha larga abre linha em branco; frase cortada no meio não abre", () => {
  const [a, , c] = paginaEmLinhas(pagina([
    ["Primeiro parágrafo.", 74, 700], ["Segundo parágrafo, uma", 74, 676], ["entrelinha e meia abaixo", 74, 658],
  ]), { fonteDoDocumento: 9 });
  assert.equal(a, "Primeiro parágrafo.");
  // 24 pt (duas entrelinhas de 10,8) abre uma vazia entre o primeiro e o segundo…
  assert.equal(c, "Segundo parágrafo, uma");
  // …e os 18 pt seguintes, que abririam outra, não abrem: a frase continua em minúscula.
  const todas = paginaEmLinhas(pagina([
    ["Segundo parágrafo, uma", 74, 676], ["entrelinha e meia abaixo", 74, 658],
  ]), { fonteDoDocumento: 9 });
  assert.deepEqual(todas, ["Segundo parágrafo, uma", "entrelinha e meia abaixo"]);
});

test("grade: a linha fica na altura do pedaço de fonte maior", () => {
  // O rótulo (9 pt) 2,8 pt abaixo da informação (8 pt): uma linha só, e o vão até a
  // linha seguinte se mede pelo rótulo — 13 pt não é vão de parágrafo.
  const linhas = paginaEmLinhas(pagina([
    ["podre. É como se o Ídolo tivesse entranhas.", 170, 467.3, 8], ["(apenas se", 74, 464.5, 9],
    ["o Ídolo for", 74, 451.5, 9],
  ]), { fonteDoDocumento: 9 });
  assert.deepEqual(linhas.map((l) => l.trim().slice(0, 10)), ["(apenas se", "o Ídolo fo"]);
});

/** Linhas do quadro como a grade imprime: perícia na coluna 0, DT na 20, texto na 26. */
const quadro = (linhas) => linhas.map(([pericia = "", dt = "", info = ""]) => {
  if (!pericia && !dt && !info) return "";
  return `${pericia.padEnd(20)}${dt.padEnd(6)}${info}`.trimEnd();
});
const CABECALHO = "Perícia             DT    Informação";

test("lerTabela: linha sem rótulo herda a perícia de cima", () => {
  const linhas = [CABECALHO, "", ...quadro([
    ["Percepção", "6", "Há sangue nas chaves."],
    [],
    ["", "", "Duas chaves são iguais."],
    ["", "6", "Provavelmente cada uma"],
    ["", "", "abre um depósito diferente."],
    ["Pesquisar", "", ""],
    ["", "8", "A terceira abre um cadeado."],
  ]), "", "", "", "Nota do mestre."];
  const [informacoes] = lerTabela(linhas, 1, 20, 26);
  assert.deepEqual(informacoes.map((i) => [i.pericia, i.dt]), [["Percepção", 6], ["Percepção", 6], ["Pesquisar", 8]]);
});

test("lerTabela: rótulo longe da sua DT e no meio das duas vale para as duas", () => {
  const linhas = [CABECALHO, "", ...quadro([
    ["Intuição", "6", "Você tem a impressão de que isso não é só uma estante."],
    [],
    ["", "", "Há trilhos na parte traseira da estante,"],
    ["", "6", "indicando um mecanismo capaz de arrastá-la."],
    ["", "", "Um pedaço de tecido está enroscado nas engrenagens."],
    ["", "", "danificando o sistema."],
    ["Máquinas", "", ""],
    ["", "", "Analisando a parte traseira da estante,"],
    ["", "", "é possível enxergar que o motor se"],
    ["", "8", "conecta em quatro pontos."],
    ["", "", "Não há nada na primeira prateleira."],
  ]), "", "", ""];
  const [informacoes] = lerTabela(linhas, 1, 20, 26);
  assert.deepEqual(informacoes.map((i) => i.pericia), ["Intuição", "Máquinas", "Máquinas"]);
});

test("lerTabela: \"6 ou\" / \"10\" é uma DT com alternativa, não prosa", () => {
  const linhas = [CABECALHO, "", ...quadro([
    ["Pesquisar", "8", "A jaqueta tem três furos."],
    [],
    ["", "6 ou", "Os papéis parecem ser anotações de uma expedição"],
    ["", "10", "feita no Iraque."],
  ]), "", "", ""];
  const [informacoes, , sobras] = lerTabela(linhas, 1, 20, 26);
  assert.equal(informacoes.length, 2);
  assert.equal(informacoes[1].dt, 6);
  assert.equal(informacoes[1].dtAlternativa, 10);
  assert.equal(informacoes[1].texto, "Os papéis parecem ser anotações de uma expedição feita no Iraque.");
  assert.deepEqual(sobras, []);
});

test("lerTabela: número de página longe das colunas não é DT nem texto", () => {
  const linhas = [CABECALHO, "", ...quadro([
    ["Percepção", "8", "A letra desses documentos é sua."],
  ]), "", `${" ".repeat(52)}43`, "", "", "", "Nota."];
  const [informacoes] = lerTabela(linhas, 1, 20, 26);
  assert.equal(informacoes[0].texto, "A letra desses documentos é sua.");
});

test("chaveDePericia: condição entre parênteses e perícia alternativa", () => {
  assert.deepEqual(chaveDePericia("Percepção (apenas Alan)"), ["percepcao", "apenas Alan"]);
  assert.deepEqual(chaveDePericia("Pesquisar ou Tecnologia"), ["pesquisar", "ou Tecnologia"]);
  assert.deepEqual(chaveDePericia("Aptidão (Humanas)"), ["aptidao.humanas", ""]);
});

test("linearizarDuasColunas: página de narração sem corredor reto se parte linha a linha", () => {
  const esquerda = ["PERSONAGENS", "ESCAPAM", "As escadas levam a uma sala", "iluminada no andar de cima."];
  const direita = ["Após algumas horas de relatos e", "coleta de evidências, eles levam", "vocês até um ambiente seguro,", "TODOS MORREM"];
  // A coluna da direita começa uma linha antes da esquerda, e o título grande da
  // direita invade o corredor — nenhuma coluna em branco atravessa o bloco inteiro.
  const bloco = [
    `${" ".repeat(62)}${direita[0]}`,
    ...esquerda.map((e, i) => `${e.padEnd(i === 3 ? 50 : 62)}${direita[i + 1] ?? ""}`.trimEnd()),
    ...Array(6).fill(`${" ".repeat(62)}mais texto da direita`),
  ];
  const saida = linearizarDuasColunas(bloco, 38, { narracao: true }).filter(Boolean);
  assert.deepEqual(saida.slice(0, 4), esquerda);
  assert.equal(saida[4], direita[0]);
});

test("ident: estável, 16 hexadecimais, muda com a semente", () => {
  assert.match(ident("poi-ato-i-FREEZER"), /^[0-9a-f]{16}$/);
  assert.equal(ident("poi-ato-i-FREEZER"), ident("poi-ato-i-FREEZER"));
  assert.notEqual(ident("poi-ato-i-FREEZER"), ident("poi-ato-i-freezer"));
});

test("tituloLegivel e arquivosDeHandout", () => {
  assert.equal(tituloLegivel("DEPÓSITO A, MOLHO DE CHAVES"), "Depósito A, Molho de Chaves");
  assert.equal(tituloLegivel("“ALTAR” DE MADEIRA"), "“Altar” de Madeira");
  const mapa = arquivosDeHandout([{ pages: [
    { src: "systems/x/assets/ato-i/handouts/handout-02-simbolo-no-teto.jpg" },
    { src: "systems/x/assets/ato-i/handouts/handout-05a-conversa.png" },
    { src: "systems/x/assets/ato-i/handouts/handout-01-compendium.pdf" },
  ] }]);
  assert.deepEqual(mapa, { 2: ["handout-02-simbolo-no-teto.jpg"], 5: ["handout-05a-conversa.png"] });
});
