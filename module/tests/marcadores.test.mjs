import test from "node:test";
import assert from "node:assert/strict";
import { liberadoNas } from "../cena/marcadores.mjs";

/** Uma investigação como o painel a enxerga: listas de uuid e listas de ocultos. */
const investigacao = (extras = {}) => ({
  system: {
    pois: ["Item.poi1", "Item.poi2"],
    poisOcultos: ["Item.poi2"],
    desafios: ["Item.des1"],
    desafiosOcultos: [],
    ...extras,
  },
});

test("o marcador acende no ponto revelado e some no oculto", () => {
  const inv = [investigacao()];
  assert.equal(liberadoNas("Item.poi1", inv), true);
  assert.equal(liberadoNas("Item.poi2", inv), false, "oculto não acende");
  assert.equal(liberadoNas("Item.des1", inv), true, "desafio segue a mesma regra");
});

test("ponto fora de qualquer investigação visível não acende", () => {
  assert.equal(liberadoNas("Item.poi1", []), false);
  assert.equal(liberadoNas("Item.solto", [investigacao()]), false);
});

test("basta uma investigação visível liberar", () => {
  const escondendo = investigacao({ poisOcultos: ["Item.poi1", "Item.poi2"] });
  const liberando = investigacao({ poisOcultos: [] });
  assert.equal(liberadoNas("Item.poi1", [escondendo]), false);
  assert.equal(liberadoNas("Item.poi1", [escondendo, liberando]), true);
});

test("desafio oculto não acende mesmo com o ponto revelado", () => {
  const inv = [investigacao({ desafiosOcultos: ["Item.des1"] })];
  assert.equal(liberadoNas("Item.des1", inv), false);
  assert.equal(liberadoNas("Item.poi1", inv), true);
});
