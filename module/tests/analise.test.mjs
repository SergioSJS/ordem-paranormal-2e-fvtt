import test from "node:test";
import assert from "node:assert/strict";
import * as a from "../dice/analise.mjs";

/** Helper: `d("d8:3", "d6:6")` monta os dados na ordem, todos contabilizados. */
const d = (...specs) =>
  specs.map((s, i) => {
    const [dado, valor, contado] = s.split(":");
    return { indice: i, dado, resultado: Number(valor), contado: contado !== "off" };
  });

test("RA e RB olham o valor rolado, não o tamanho do dado", () => {
  // d8 saiu 3, d6 saiu 6 -> RA 6, RB 3 (spec §4.2)
  const dados = d("d8:3", "d6:6");
  assert.equal(a.ra(dados), 6);
  assert.equal(a.rb(dados), 3);
});

test("soma conta apenas os dados contabilizados", () => {
  assert.equal(a.soma(d("d8:5", "d6:4", "d6:6", "d4:3:off")), 15);
});

test("RA e RB ignoram os dados descartados", () => {
  const dados = d("d8:5", "d6:4", "d6:6", "d12:12:off");
  assert.equal(a.ra(dados), 6);
  assert.equal(a.rb(dados), 4);
});

test("crítico exige valores repetidos a partir de 6", () => {
  assert.equal(a.valorCritico(d("d8:6", "d6:6")), 6);
  assert.equal(a.valorCritico(d("d10:8", "d8:8")), 8);
  assert.equal(a.valorCritico(d("d8:5", "d6:5")), null, "par de 5 não é crítico");
  assert.equal(a.valorCritico(d("d8:7", "d6:6")), null, "valores diferentes não são crítico");
});

test("com dois dados, um d4 nunca alcança o crítico", () => {
  assert.equal(a.valorCritico(d("d4:4", "d4:4")), null);
});

test("crítico devolve o maior valor quando há mais de um par", () => {
  assert.equal(a.valorCritico(d("d12:6", "d12:6", "d10:9", "d10:9")), 9);
});

test("escopo do crítico decide se dados descartados contam", () => {
  const dados = d("d8:6", "d6:2", "d6:3", "d12:6:off");
  assert.equal(a.valorCritico(dados, "todos"), 6);
  assert.equal(a.valorCritico(dados, "contados"), null);
});

test("falha crítica exige todos os dados em 1", () => {
  assert.equal(a.ehFalhaCritica(d("d8:1", "d6:1")), true);
  assert.equal(a.ehFalhaCritica(d("d8:1", "d6:2")), false);
  assert.equal(a.ehFalhaCritica([]), false);
});

test("par de 1 é falha crítica, nunca crítico", () => {
  const r = a.analisar(d("d8:1", "d6:1"), { dt: 2 });
  assert.equal(r.critico, false);
  assert.equal(r.falhaCritica, true);
  assert.equal(r.desfecho, "falha-critica");
});

test("crítico ignora a DT", () => {
  const r = a.analisar(d("d6:6", "d6:6"), { dt: 20 });
  assert.equal(r.total, 12);
  assert.equal(r.sucesso, true);
  assert.equal(r.desfecho, "critico");
});

test("falha crítica ignora a DT mesmo com DT baixa", () => {
  const r = a.analisar(d("d12:1", "d12:1"), { dt: 2 });
  assert.equal(r.sucesso, false);
  assert.equal(r.desfecho, "falha-critica");
});

test("sem crítico, compara a soma com a DT", () => {
  assert.equal(a.analisar(d("d8:4", "d6:3"), { dt: 7 }).desfecho, "sucesso");
  assert.equal(a.analisar(d("d8:4", "d6:2"), { dt: 7 }).desfecho, "falha");
});

test("teste oposto não tem DT e fica indefinido", () => {
  const r = a.analisar(d("d8:4", "d6:3"));
  assert.equal(r.sucesso, null);
  assert.equal(r.desfecho, "indefinido");
});

test("seleção sugerida devolve os três maiores em ordem de índice", () => {
  assert.deepEqual(a.selecaoSugerida(d("d4:2", "d8:7", "d6:5", "d12:9")), [1, 2, 3]);
});
