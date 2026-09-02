/** Combate simplificado e testes opostos (spec §4.6/§8.1). */
import test from "node:test";
import assert from "node:assert/strict";
import { vencedorDoOposto, danoDoAtaque, resolverAtaque } from "../cena/combate.mjs";

test("teste oposto: maior resultado vence, sem DT (spec §4.6)", () => {
  assert.equal(vencedorDoOposto(11, 7), "atacante");
  assert.equal(vencedorDoOposto(7, 11), "defensor");
  assert.equal(vencedorDoOposto(9, 9), "empate");
});

test("dano é RA com arma e RB desarmado (spec §8.1)", () => {
  const leitura = { ra: 8, rb: 3 };
  assert.equal(danoDoAtaque(leitura, { armado: true }), 8);
  assert.equal(danoDoAtaque(leitura, { armado: false }), 3);
});

test("na troca de golpes, quem vence causa dano no outro", () => {
  const base = { leituraAtacante: { ra: 8, rb: 3 }, leituraDefensor: { ra: 6, rb: 2 }, esquiva: false };
  assert.deepEqual(resolverAtaque({ ...base, vencedor: "atacante", armadoAtacante: true }),
    { dano: 8, alvo: "defensor" });
  assert.deepEqual(resolverAtaque({ ...base, vencedor: "defensor", armadoDefensor: false }),
    { dano: 2, alvo: "atacante" });
});

test("esquiva vencedora anula tudo: não sofre nem causa dano (spec §8.1)", () => {
  const r = resolverAtaque({
    vencedor: "defensor", esquiva: true,
    leituraAtacante: { ra: 8, rb: 3 }, leituraDefensor: { ra: 9, rb: 4 },
    armadoAtacante: true, armadoDefensor: true,
  });
  assert.deepEqual(r, { dano: 0, alvo: null });
});

test("esquiva perdida não impede o dano do atacante", () => {
  const r = resolverAtaque({
    vencedor: "atacante", esquiva: true,
    leituraAtacante: { ra: 8, rb: 3 }, leituraDefensor: { ra: 4, rb: 1 },
    armadoAtacante: true, armadoDefensor: false,
  });
  assert.deepEqual(r, { dano: 8, alvo: "defensor" });
});

test("empate não move nada", () => {
  assert.deepEqual(resolverAtaque({
    vencedor: "empate", esquiva: false,
    leituraAtacante: { ra: 5, rb: 2 }, leituraDefensor: { ra: 5, rb: 2 },
  }), { dano: 0, alvo: null });
});
