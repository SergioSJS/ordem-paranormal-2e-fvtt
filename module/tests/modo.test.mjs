import { test } from "node:test";
import assert from "node:assert/strict";

import { instalarStubs } from "./stub-foundry.mjs";

instalarStubs();

const { PERICIAS, periciasDoModo, chaveDoRotuloDePericia, chaveDoRotuloDeOcupacao, aptidoesDoModo, aptidaoVisivel } = await import("../config.mjs");
const { modoAtual } = await import("../modo.mjs");

test("a ficha guarda as perícias dos dois modos, e nenhuma do alpha foi apagada", () => {
  assert.equal(Object.keys(PERICIAS).length, 22);
  for (const chave of ["maquinas", "tecnologia", "pesquisar", "ocultismo"]) assert.ok(PERICIAS[chave], chave);
});

test("cada modo mostra as suas perícias", () => {
  const moderno = periciasDoModo("moderno");
  const vigilia = periciasDoModo("vigilia");
  assert.ok(moderno.includes("tecnologia") && moderno.includes("maquinas"));
  assert.ok(!moderno.includes("animais") && !moderno.includes("oficio"));
  assert.ok(vigilia.includes("animais") && vigilia.includes("oficio"));
  assert.ok(!vigilia.includes("tecnologia") && !vigilia.includes("maquinas"));
});

test("a mesma chave muda de nome no Vigília (beta §2.2)", () => {
  assert.equal(chaveDoRotuloDePericia("pesquisar", "moderno"), "OP2.Pericia.pesquisar");
  assert.equal(chaveDoRotuloDePericia("pesquisar", "vigilia"), "OP2.Pericia.inspecionar");
  assert.equal(chaveDoRotuloDePericia("ocultismo", "vigilia"), "OP2.Pericia.bruxaria");
  assert.equal(chaveDoRotuloDePericia("luta", "vigilia"), "OP2.Pericia.luta");
});

test("Aptidões: de fábrica por modo; as criadas pela mesa aparecem em qualquer um", () => {
  assert.ok(aptidoesDoModo("moderno").includes("tatica"));
  assert.ok(aptidoesDoModo("vigilia").includes("guerra"));
  assert.ok(aptidaoVisivel("artes", "moderno") && aptidaoVisivel("artes", "vigilia"));
  assert.ok(!aptidaoVisivel("tatica", "vigilia"));
  assert.ok(!aptidaoVisivel("guerra", "moderno"));
  assert.ok(aptidaoVisivel("culinaria", "moderno") && aptidaoVisivel("culinaria", "vigilia"));
});

test("campo da mesa com a mesma chave de um de fábrica do outro modo não some", () => {
  assert.ok(!aptidaoVisivel("folclore", "moderno", ""));
  assert.ok(!aptidaoVisivel("folclore", "moderno", "   "));
  assert.ok(aptidaoVisivel("folclore", "moderno", "Folclore"));
  assert.ok(aptidaoVisivel("tatica", "vigilia", "Tática de cerco"));
});

test("Ocupação é Vocação no Vigília (beta §2.1)", () => {
  assert.equal(chaveDoRotuloDeOcupacao("moderno"), "OP2.Campo.Ocupacao");
  assert.equal(chaveDoRotuloDeOcupacao("vigilia"), "OP2.Campo.Vocacao");
});

test("modo inválido ou setting ausente cai no moderno", () => {
  const original = game.settings.get;
  game.settings.get = () => 7;
  assert.equal(modoAtual(), "moderno");
  game.settings.get = () => { throw new Error("não registrado"); };
  assert.equal(modoAtual(), "moderno");
  game.settings.get = () => "vigilia";
  assert.equal(modoAtual(), "vigilia");
  game.settings.get = original;
});
