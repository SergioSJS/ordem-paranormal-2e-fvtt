import { test } from "node:test";
import assert from "node:assert/strict";
import "./stub-foundry.mjs";
import { efeitosDaRolagem } from "../ui/efeitos.mjs";

const dado = (resultado, pavor = false) => ({ dado: "d6", resultado, contado: true, pavor });

test("efeitos: dado de pavor bate o coração; saindo 1, é alívio", () => {
  assert.deepEqual(efeitosDaRolagem({ dados: [dado(4), dado(3, true)], pavorVencido: false }), ["pavor"]);
  assert.deepEqual(efeitosDaRolagem({ dados: [dado(4), dado(1, true)], pavorVencido: true }), ["pavorVencido"]);
});

test("efeitos: crítico e falha crítica, nunca os dois", () => {
  assert.deepEqual(efeitosDaRolagem({ dados: [dado(6), dado(6)], critico: true, falhaCritica: false }), ["critico"]);
  assert.deepEqual(efeitosDaRolagem({ dados: [dado(1), dado(1)], critico: false, falhaCritica: true }), ["falhaCritica"]);
});

test("efeitos: teste comum e rolagem do core não disparam nada", () => {
  assert.deepEqual(efeitosDaRolagem({ dados: [dado(3), dado(5)] }), []);
  assert.deepEqual(efeitosDaRolagem({ total: 12 }), []);
  assert.deepEqual(efeitosDaRolagem(null), []);
});
