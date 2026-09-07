import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filtrosVazios, filtrando, casaFiltros, compararCards, progressoDoPonto, normalizar,
} from "../cena/filtros-painel.mjs";

const cards = [
  { indice: "0", nome: "Zebra Intocada", oculto: "0", marcado: "1", progresso: "intocado", pericias: "percepcao pesquisar" },
  { indice: "1", nome: "Mesa em Andamento", oculto: "1", marcado: "0", progresso: "andamento", pericias: "percepcao tecnologia" },
  { indice: "2", nome: "Armário Esgotado", oculto: "0", marcado: "0", progresso: "esgotado", pericias: "percepcao" },
];

const nomes = (lista) => lista.map((c) => c.nome);
const com = (parcial) => ({ ...filtrosVazios(), ...parcial });

test("sem filtro ligado tudo passa, e a ordem não conta como filtro", () => {
  assert.equal(filtrando(filtrosVazios()), false);
  assert.equal(filtrando(com({ ordem: "nome" })), false);
  assert.equal(filtrando(com({ termo: "  " })), false);
  assert.equal(filtrando(com({ visibilidade: "ocultos" })), true);
  assert.deepEqual(nomes(cards.filter((c) => casaFiltros(c, filtrosVazios()))), nomes(cards));
});

test("o termo casa sem acento nem caixa", () => {
  assert.deepEqual(nomes(cards.filter((c) => casaFiltros(c, com({ termo: "ARMARIO" })))), ["Armário Esgotado"]);
  assert.equal(normalizar("Ação Ébria"), "acao ebria");
});

test("visibilidade, progresso e mapa lêem os data-* do card", () => {
  assert.deepEqual(nomes(cards.filter((c) => casaFiltros(c, com({ visibilidade: "ocultos" })))), ["Mesa em Andamento"]);
  assert.deepEqual(nomes(cards.filter((c) => casaFiltros(c, com({ visibilidade: "visiveis" })))), ["Zebra Intocada", "Armário Esgotado"]);
  assert.deepEqual(nomes(cards.filter((c) => casaFiltros(c, com({ progresso: "esgotado" })))), ["Armário Esgotado"]);
  assert.deepEqual(nomes(cards.filter((c) => casaFiltros(c, com({ mapa: "sem" })))), ["Mesa em Andamento", "Armário Esgotado"]);
});

test("perícia e abordagem casam por chave dentro da lista separada por espaço", () => {
  assert.deepEqual(nomes(cards.filter((c) => casaFiltros(c, com({ pericia: "tecnologia" })))), ["Mesa em Andamento"]);
  assert.deepEqual(nomes(cards.filter((c) => casaFiltros(c, com({ pericia: "percepcao" })))), nomes(cards));
  const desafios = [
    { indice: "0", nome: "Porta", abordagens: "arrombar destrancar" },
    { indice: "1", nome: "Terminal", abordagens: "hackTecnico" },
  ];
  assert.deepEqual(nomes(desafios.filter((c) => casaFiltros(c, com({ abordagem: "hackTecnico" })))), ["Terminal"]);
  assert.deepEqual(nomes(desafios.filter((c) => casaFiltros(c, com({ abordagem: "sustentar" })))), []);
});

test("os filtros se somam", () => {
  assert.deepEqual(nomes(cards.filter((c) => casaFiltros(c, com({ visibilidade: "visiveis", pericia: "pesquisar" })))), ["Zebra Intocada"]);
  assert.deepEqual(nomes(cards.filter((c) => casaFiltros(c, com({ visibilidade: "ocultos", progresso: "esgotado" })))), []);
});

test("ordem: original, por nome (sem acento) e por progresso com empate na original", () => {
  const embaralhado = [cards[2], cards[0], cards[1]];
  assert.deepEqual(nomes([...embaralhado].sort(compararCards("livro"))), ["Zebra Intocada", "Mesa em Andamento", "Armário Esgotado"]);
  assert.deepEqual(nomes([...embaralhado].sort(compararCards("nome"))), ["Armário Esgotado", "Mesa em Andamento", "Zebra Intocada"]);
  assert.deepEqual(nomes([...embaralhado].sort(compararCards("progresso"))), ["Zebra Intocada", "Mesa em Andamento", "Armário Esgotado"]);
  const desafios = [
    { indice: "0", nome: "B", progresso: "resolvido" }, { indice: "1", nome: "A", progresso: "pendente" }, { indice: "2", nome: "C", progresso: "pendente" },
  ];
  assert.deepEqual(nomes([...desafios].sort(compararCards("progresso"))), ["A", "C", "B"]);
});

test("progresso do ponto: nada, parte, tudo — e o rascunho não segura o esgotado", () => {
  const linhas = [{ oculta: false }, { oculta: false }, { oculta: true }];
  assert.equal(progressoDoPonto(linhas, 0), "intocado");
  assert.equal(progressoDoPonto(linhas, 1), "andamento");
  assert.equal(progressoDoPonto(linhas, 2), "esgotado");
  assert.equal(progressoDoPonto([], 0), "intocado");
  // o jogador nunca vê "esgotado", nem quando já achou tudo
  assert.equal(progressoDoPonto(linhas, 2, { mestre: false }), "andamento");
  assert.equal(progressoDoPonto(linhas, 0, { mestre: false }), "intocado");
});
