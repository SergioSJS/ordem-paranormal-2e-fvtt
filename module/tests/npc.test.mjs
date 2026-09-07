import test from "node:test";
import assert from "node:assert/strict";
import { instalarStubs } from "./stub-foundry.mjs";

instalarStubs();
const { periciaNpcEscolhida, opcoesDePericiaNpc } = await import("../sheets/actor-npc-sheet.mjs");

// O stub traduz devolvendo a própria chave: os rótulos abaixo são as chaves i18n.
test("NPC: a perícia do playtest entra com a chave do sistema e o rótulo traduzido", () => {
  const p = periciaNpcEscolhida({ chave: "acrobacia", rotulo: "", die: "d8" });
  assert.deepEqual(p, { chave: "acrobacia", rotulo: "OP2.Pericia.acrobacia", die: "d8" });
  // Aptidão: sem ponto na chave (ponto vira caminho aninhado no update).
  const a = periciaNpcEscolhida({ chave: "aptidao-humanas", rotulo: "", die: "d6" });
  assert.equal(a.chave, "aptidao-humanas");
  assert.equal(a.rotulo, "OP2.Pericia.aptidao (OP2.Aptidao.humanas)");
});

test("NPC: 'Outra' vira slug com o nome digitado; vazio ou dado inválido não passam", () => {
  const c = periciaNpcEscolhida({ chave: "__outra", rotulo: "  Culinária Regional ", die: "d20" });
  assert.deepEqual(c, { chave: "culinaria-regional", rotulo: "Culinária Regional", die: "d6" });
  assert.equal(periciaNpcEscolhida({ chave: "__outra", rotulo: "   ", die: "d6" }), null);
  assert.equal(periciaNpcEscolhida({ chave: "nao-existe", rotulo: "", die: "d6" }), null);
  const opcoes = opcoesDePericiaNpc();
  assert.equal(opcoes.pericias.length, 19);
  assert.equal(opcoes.aptidoes.length, 6);
  assert.ok(!opcoes.pericias.some((o) => o.chave === "aptidao"));
});
