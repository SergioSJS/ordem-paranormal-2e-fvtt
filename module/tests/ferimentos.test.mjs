/** Ferimentos e traumas (spec §8.2/§8.3): escalada da DT e quando o teste é devido. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { dtDaQueda, devidoTesteDeQueda } from "../cena/queda.mjs";

test("a DT começa em 7 e sobe de 3 em 3 por teste já feito", () => {
  assert.equal(dtDaQueda(0), 7);
  assert.equal(dtDaQueda(1), 10);
  assert.equal(dtDaQueda(2), 13);
  assert.equal(dtDaQueda(3), 16);
});

test("zerar o recurso pede teste", () => {
  assert.equal(devidoTesteDeQueda(0, 3), true);
});

test("tomar dano já estando em 0 pede teste de novo (spec §8.2)", () => {
  assert.equal(devidoTesteDeQueda(0, 1), true);
});

test("dano que não zera não pede teste", () => {
  assert.equal(devidoTesteDeQueda(4, 3), false);
});

test("cura ou dano zero não pede teste", () => {
  assert.equal(devidoTesteDeQueda(0, 0), false);
});

/* -- ajuda (spec §4.7) ------------------------------------------------------ */

test("d4 não ajuda; d6/d8 dão 1 passo; d10/d12 dão 2", async () => {
  const { passosDeAjuda, podeAjudar } = await import("../cena/ajuda.mjs");
  assert.equal(passosDeAjuda("d4"), 0);
  assert.equal(podeAjudar("d4"), false);
  assert.equal(passosDeAjuda("d6"), 1);
  assert.equal(passosDeAjuda("d8"), 1);
  assert.equal(passosDeAjuda("d10"), 2);
  assert.equal(passosDeAjuda("d12"), 2);
  assert.equal(podeAjudar("d12"), true);
});
