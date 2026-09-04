import test from "node:test";
import assert from "node:assert/strict";
import {
  separarProblema,
  acumularArrombar, arrombou, excedeuTentativas, danoDeAlcancar, avaliarPalpite, venceuDestrancar,
  podeTentarHackNestaRodada, chancesDeErroHackSocial,
  linhaDaTabelaDeHack, tentativasPorRodadaDeDestrancar, tentativasDeDestrancarNaRodada,
} from "../cena/desafios.mjs";

test("arrombar acumula RA na pontuação, sem passar da PA (spec §7.2)", () => {
  const desafio = { pontuacaoAtual: 5, pontuacaoAlvo: 10 };
  assert.equal(acumularArrombar(desafio, 3), 8);
  assert.equal(acumularArrombar(desafio, 8), 10);
});

test("arrombou compara a pontuação contra a PA", () => {
  assert.equal(arrombou({ pontuacaoAtual: 9, pontuacaoAlvo: 10 }), false);
  assert.equal(arrombou({ pontuacaoAtual: 10, pontuacaoAlvo: 10 }), true);
  assert.equal(arrombou({ pontuacaoAtual: 12, pontuacaoAlvo: 10 }), true);
});

test("excedeuTentativas: 0 é sem teto — só fechaduras do playtest têm limite", () => {
  assert.equal(excedeuTentativas({ maxTentativas: 0, tentativasUsadas: 999 }), false);
  assert.equal(excedeuTentativas({ maxTentativas: 3, tentativasUsadas: 2 }), false);
  assert.equal(excedeuTentativas({ maxTentativas: 3, tentativasUsadas: 3 }), true);
});

test("alcançar seguro falha com dano = RB, arriscado falha com dano = RA (spec §7.4)", () => {
  const resultado = { ra: 6, rb: 2 };
  assert.equal(danoDeAlcancar("seguro", resultado), 2);
  assert.equal(danoDeAlcancar("arriscado", resultado), 6);
});

test("avaliarPalpite compara posição a posição, não o conjunto (spec §7.1)", () => {
  assert.deepEqual(avaliarPalpite([3, 5, 1, 6], [3, 2, 4, 6]), ["exato", "baixo", "alto", "exato"]);
});

test("venceuDestrancar exige exato em toda posição", () => {
  assert.equal(venceuDestrancar(["exato", "exato", "exato"]), true);
  assert.equal(venceuDestrancar(["exato", "alto", "exato"]), false);
  assert.equal(venceuDestrancar([]), false);
});

test("podeTentarHackNestaRodada: falha só libera nova tentativa na rodada seguinte (spec §7.3)", () => {
  assert.equal(podeTentarHackNestaRodada(-1, 0), true, "nunca tentou ainda");
  assert.equal(podeTentarHackNestaRodada(2, 2), false, "mesma rodada da última tentativa");
  assert.equal(podeTentarHackNestaRodada(2, 3), true, "rodada seguinte");
  assert.equal(podeTentarHackNestaRodada(2, 1), false, "rodada não avançou (não devia acontecer, mas não libera)");
});

test("chancesDeErroHackSocial: 1 base + 1 a cada 3 pontos de excedente sobre a DT (spec §7.3)", () => {
  assert.equal(chancesDeErroHackSocial(7, 7), 1, "bateu exato a DT, sem excedente");
  assert.equal(chancesDeErroHackSocial(9, 7), 1, "excedente 2, não fecha os 3");
  assert.equal(chancesDeErroHackSocial(10, 7), 2, "excedente 3");
  assert.equal(chancesDeErroHackSocial(16, 7), 4, "excedente 9 = +3 chances");
  assert.equal(chancesDeErroHackSocial(5, 7), 1, "abaixo da DT não desconta a base");
});

// A tabela do painel do Ato I, como o livro imprime.
const TABELA_DO_PAINEL = [
  { rolagem: "10+", desafio: "16 x 5 = 80" },
  { rolagem: "7-9", desafio: "192 ÷ 8 = 24" },
  { rolagem: "5-6", desafio: "13² = 169" },
  { rolagem: "1-4", desafio: "√2209 = 47" },
];

test("tabela do hack: faixa aberta pega tudo dali para cima", () => {
  assert.equal(linhaDaTabelaDeHack(TABELA_DO_PAINEL, 10).desafio, "16 x 5 = 80");
  assert.equal(linhaDaTabelaDeHack(TABELA_DO_PAINEL, 23).desafio, "16 x 5 = 80");
});

test("tabela do hack: faixa fechada pega os dois extremos", () => {
  assert.equal(linhaDaTabelaDeHack(TABELA_DO_PAINEL, 7).desafio, "192 ÷ 8 = 24");
  assert.equal(linhaDaTabelaDeHack(TABELA_DO_PAINEL, 9).desafio, "192 ÷ 8 = 24");
  assert.equal(linhaDaTabelaDeHack(TABELA_DO_PAINEL, 5).desafio, "13² = 169");
  assert.equal(linhaDaTabelaDeHack(TABELA_DO_PAINEL, 4).desafio, "√2209 = 47");
});

test("tabela do hack: abaixo da menor faixa o painel não devolve nada", () => {
  assert.equal(linhaDaTabelaDeHack(TABELA_DO_PAINEL, 0), null);
});

test("sem tabela não há linha — é hack comum, resolvido pela DT", () => {
  assert.equal(linhaDaTabelaDeHack([], 12), null);
  assert.equal(linhaDaTabelaDeHack(undefined, 12), null);
});

test("tentativas por rodada de Destrancar seguem o dado de Crime (spec §7.1)", () => {
  assert.deepEqual(["d4", "d6", "d8", "d10", "d12"].map(tentativasPorRodadaDeDestrancar), [1, 2, 3, 4, 5]);
  assert.equal(tentativasPorRodadaDeDestrancar(undefined), 1);
});

test("a contagem da rodada é o histórico do desafio, por ator e rodada", () => {
  const historico = [
    { atorId: "a", rodada: 2 }, { atorId: "a", rodada: 2 },
    { atorId: "b", rodada: 2 }, { atorId: "a", rodada: 1 },
  ];
  assert.equal(tentativasDeDestrancarNaRodada(historico, "a", 2), 2);
  assert.equal(tentativasDeDestrancarNaRodada(historico, "b", 2), 1);
  assert.equal(tentativasDeDestrancarNaRodada(historico, "a", 3), 0);
  assert.equal(tentativasDeDestrancarNaRodada(undefined, "a", 1), 0);
});

test("separarProblema: a conta do painel vai sem a resposta; sem '=' vai inteira", () => {
  assert.deepEqual(separarProblema("16 x 5 = 80"), { enunciado: "16 x 5", resposta: "80" });
  assert.deepEqual(separarProblema("23 x 4 - 25 = 67"), { enunciado: "23 x 4 - 25", resposta: "67" });
  assert.deepEqual(separarProblema("Qual a raiz de 144?"), { enunciado: "Qual a raiz de 144?", resposta: "" });
  assert.deepEqual(separarProblema(""), { enunciado: "", resposta: "" });
});
