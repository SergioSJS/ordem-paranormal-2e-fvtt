import test from "node:test";
import assert from "node:assert/strict";
import { stepDie, faces, passosDeAjuda, distanciaEmPassos, naEscada } from "../dice/escada.mjs";

test("sobe e desce um degrau", () => {
  assert.equal(stepDie("d6", 1), "d8");
  assert.equal(stepDie("d8", -1), "d6");
  assert.equal(stepDie("d6", 0), "d6");
});

test("piso é d4", () => {
  assert.equal(stepDie("d4", -1), "d4");
  assert.equal(stepDie("d6", -5), "d4");
});

test("teto normal é d12", () => {
  assert.equal(stepDie("d12", 1), "d12");
  assert.equal(stepDie("d4", 10), "d12");
});

test("d20 só com permissão explícita do efeito", () => {
  assert.equal(stepDie("d12", 1), "d12");
  assert.equal(stepDie("d12", 1, { permitirD20: true }), "d20");
  assert.equal(stepDie("d10", 5, { permitirD20: true }), "d20");
});

test("do d20 só se desce de volta para d12", () => {
  assert.equal(stepDie("d20", -1), "d12");
  assert.equal(stepDie("d20", 1), "d20");
  assert.equal(stepDie("d20", 0), "d20");
});

test("passos compostos andam o total de uma vez", () => {
  assert.equal(stepDie("d4", 3), "d10");
  assert.equal(stepDie("d12", -3), "d6");
});

test("dado desconhecido cai no piso", () => {
  assert.equal(stepDie("d7", 1), "d4");
  assert.equal(naEscada("d20"), false);
});

test("faces devolve o número comparado contra a DT na investigação", () => {
  assert.equal(faces("d4"), 4);
  assert.equal(faces("d12"), 12);
});

test("ajuda: d4 não ajuda, d6/d8 dão um passo, d10/d12 dão dois", () => {
  assert.equal(passosDeAjuda("d4"), 0);
  assert.equal(passosDeAjuda("d6"), 1);
  assert.equal(passosDeAjuda("d8"), 1);
  assert.equal(passosDeAjuda("d10"), 2);
  assert.equal(passosDeAjuda("d12"), 2);
});

test("distância em passos entre dois dados", () => {
  assert.equal(distanciaEmPassos("d4", "d10"), 3);
  assert.equal(distanciaEmPassos("d12", "d6"), -3);
});
