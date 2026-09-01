import test from "node:test";
import assert from "node:assert/strict";
import {
  temFerramenta, podeUsarCarga, sequenciaLaboratorio, rerrolagensLaboratorio,
  sequenciaValida, conjuntosFalsosRemovidos,
} from "../cena/ferramentas.mjs";
import { ESCADA } from "../config.mjs";

test("temFerramenta olha o subtipo, não só o tipo do item", () => {
  const itens = [
    { type: "equipamento", system: { subtipo: "lanternaUV" } },
    { type: "ferramenta", system: { subtipo: "camera" } },
  ];
  assert.equal(temFerramenta(itens, "camera"), true);
  assert.equal(temFerramenta(itens, "lanternaUV"), false);
});

test("podeUsarCarga: sem controle de carga sempre pode", () => {
  assert.equal(podeUsarCarga({ usa: false, value: 0 }), true);
  assert.equal(podeUsarCarga({ usa: true, value: 0 }), false);
  assert.equal(podeUsarCarga({ usa: true, value: 1 }), true);
});

test("sequenciaLaboratorio: escada crescente até o teto da Aptidão (Exatas) (spec §9.1)", () => {
  // Exemplo do próprio playtest: Aptidão (Exatas) d10, 6 dados.
  assert.deepEqual(sequenciaLaboratorio(6, "d10", ESCADA), ["d4", "d6", "d8", "d10", "d10", "d10"]);
  assert.deepEqual(sequenciaLaboratorio(4, "d12", ESCADA), ["d4", "d6", "d8", "d10"]);
  assert.deepEqual(sequenciaLaboratorio(3, "d4", ESCADA), ["d4", "d4", "d4"]);
});

test("rerrolagensLaboratorio: metade das faces de Mente (spec §9.1)", () => {
  assert.equal(rerrolagensLaboratorio(6), 3);
  assert.equal(rerrolagensLaboratorio(12), 6);
});

test("sequenciaValida: quebra na primeira rolagem menor que a anterior", () => {
  assert.equal(sequenciaValida([2, 4, 4, 6]), true);
  assert.equal(sequenciaValida([2, 5, 3, 6]), false);
  assert.equal(sequenciaValida([]), true);
});

test("conjuntosFalsosRemovidos: tabela do Rádio Modificado (spec §9.2)", () => {
  assert.equal(conjuntosFalsosRemovidos(5, 5), 0);
  assert.equal(conjuntosFalsosRemovidos(6, 5), 0);
  assert.equal(conjuntosFalsosRemovidos(7, 5), 2);
  assert.equal(conjuntosFalsosRemovidos(9, 5), 2);
  assert.equal(conjuntosFalsosRemovidos(10, 5), 3);
  assert.equal(conjuntosFalsosRemovidos(12, 5), 3);
  assert.equal(conjuntosFalsosRemovidos(13, 5), 5);
  assert.equal(conjuntosFalsosRemovidos(20, 5), 5);
});

test("conjuntosFalsosRemovidos nunca passa do total de falsos existentes", () => {
  assert.equal(conjuntosFalsosRemovidos(10, 1), 1);
  assert.equal(conjuntosFalsosRemovidos(7, 1), 1);
});
