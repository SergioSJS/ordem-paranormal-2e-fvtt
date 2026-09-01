import test from "node:test";
import assert from "node:assert/strict";
import {
  acumularArrombar, arrombou, excedeuTentativas, danoDeAlcancar, avaliarPalpite, venceuDestrancar,
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
