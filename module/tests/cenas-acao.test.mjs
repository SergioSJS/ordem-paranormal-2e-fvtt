import { test } from "node:test";
import assert from "node:assert/strict";
import {
  folegoInicial, pontosDeAvanco, formulaDoEsforco, passosDoAvanco, regraDeCarregar, avancoDoCarregado,
  corteDaRodada, atingidosPeloCorte, chegouNoObstaculo, sortear,
} from "../vigilia/perseguicao.mjs";
import {
  dadosDeEsconderijo, maiorDado, aplicarProcura, formulaPorMaiorDado, dtQueEscala, chamarAtencao,
  equilibrado, dadosDeEquilibrio, passoDeEscalada, quedaPorMargem,
} from "../vigilia/furtividade.mjs";

test("fôlego é metade das faces de Vigor (p. 35)", () => {
  assert.equal(folegoInicial("d6"), 3);
  assert.equal(folegoInicial("d10"), 5);
  assert.equal(folegoInicial("d4"), 2);
});

test("avançar: RA se passa, RB se falha, crítico soma a segunda (p. 35)", () => {
  assert.equal(pontosDeAvanco({ sucesso: true, ra: 6, rb: 2 }), 6);
  assert.equal(pontosDeAvanco({ sucesso: false, ra: 6, rb: 2 }), 2);
  assert.equal(pontosDeAvanco({ sucesso: true, ra: 7, rb: 7, critico: true, segunda: 7 }), 14);
});

test("esforço extra custa cada vez mais, e anula o carregar (p. 35)", () => {
  assert.deepEqual([0, 1, 2].map(formulaDoEsforco), ["1d4", "2d4", "3d4"]);
  assert.equal(passosDoAvanco({ esforco: true }), 1);
  assert.equal(passosDoAvanco({ carregando: true }), -1);
  assert.equal(passosDoAvanco({ esforco: true, carregando: true }), 0);
  assert.equal(passosDoAvanco({ tropecou: true }), -2);
});

test("carregar: volta até o carregado, não carrega quem está na frente (p. 35)", () => {
  assert.deepEqual(regraDeCarregar(10, 4), { podeCarregar: true, base: 4 });
  assert.equal(regraDeCarregar(4, 10).podeCarregar, false);
  assert.equal(avancoDoCarregado(4, 9), 9);
  assert.equal(avancoDoCarregado(9, 4), 9);
});

test("cortes das duas missões: quem fica abaixo (p. 35, p. 73)", () => {
  const cortes = [{ rodada: 2, minimo: 5 }, { rodada: 3, minimo: 15 }];
  assert.equal(corteDaRodada(cortes, 1), null);
  assert.equal(corteDaRodada(cortes, 3).minimo, 15);
  const corredores = [{ id: "a", avanco: 4 }, { id: "b", avanco: 5 }, { id: "c", avanco: 3 }, { id: "d", avanco: 1, fora: true }];
  // Missão 1: todos abaixo são derrubados; quem já saiu não conta.
  assert.deepEqual(atingidosPeloCorte(corredores, 5, "derrubado").atingidos, ["a", "c"]);
  // Missão 2: só o menor.
  assert.deepEqual(atingidosPeloCorte(corredores, 5, "morte"), { atingidos: ["c"], empatados: [] });
  // Empate: teste oposto entre eles.
  const empate = [{ id: "a", avanco: 3 }, { id: "b", avanco: 3 }, { id: "c", avanco: 20 }];
  assert.deepEqual(atingidosPeloCorte(empate, 15, "morte"), { atingidos: [], empatados: ["a", "b"] });
  assert.deepEqual(atingidosPeloCorte(empate, 3, "morte"), { atingidos: [], empatados: [] });
});

test("a vala dispara uma vez, com 15 ou mais (p. 74)", () => {
  assert.equal(chegouNoObstaculo(14, 15, false), false);
  assert.equal(chegouNoObstaculo(15, 15, false), true);
  assert.equal(chegouNoObstaculo(20, 15, true), false);
  assert.equal(chegouNoObstaculo(20, 0, false), false);
});

test("sortear alvos distintos", () => {
  const acaso = () => 0;
  assert.deepEqual(sortear(["a", "b", "c"], 2, acaso), ["a", "b"]);
  assert.equal(sortear(["a"], 2, acaso).length, 1);
  assert.equal(new Set(sortear(["a", "b", "c", "d"], 3)).size, 3);
});

test("esconderijo: dado separado com o valor rolado (p. 55)", () => {
  const dados = [
    { dado: "d8", resultado: 5, contado: true }, { dado: "d6", resultado: 2, contado: true },
    { dado: "d6", resultado: 1, contado: true, pavor: true },
  ];
  assert.deepEqual(dadosDeEsconderijo(dados), [{ dado: "d8", valor: 5 }, { dado: "d6", valor: 2 }]);
  assert.equal(maiorDado([{ dado: "d8", valor: 1 }, { dado: "d12", valor: 1 }]), 12);
  assert.equal(maiorDado([]), 0);
});

test("procurar: o exemplo do livro, 3 e 5 descobrem os dois (p. 56)", () => {
  const esconderijo = [{ dado: "d8", valor: 3 }, { dado: "d6", valor: 5 }, { dado: "d6", valor: 2 }];
  const r = aplicarProcura(esconderijo, [3, 5]);
  assert.deepEqual(r.resta, [{ dado: "d6", valor: 2 }]);
  assert.equal(r.perdeu, 2);
  assert.equal(r.encontrado, false);
  assert.equal(aplicarProcura([{ dado: "d6", valor: 2 }], [2]).encontrado, true);
  assert.equal(aplicarProcura([], [2]).encontrado, false);
});

test("salto da criatura depende do maior dado (p. 56)", () => {
  const f = ["1d12", "2d10", "3d8"];
  assert.equal(formulaPorMaiorDado(12, f), "1d12");
  assert.equal(formulaPorMaiorDado(10, f), "2d10");
  assert.equal(formulaPorMaiorDado(8, f), "3d8");
  assert.equal(formulaPorMaiorDado(4, f), "3d8");
});

test("esconder e distrair escalam; chamar atenção custa dois para dar um (p. 55)", () => {
  assert.deepEqual([0, 1, 2].map(dtQueEscala), [7, 10, 13]);
  const r = chamarAtencao([{ valor: 1 }, { valor: 2 }, { valor: 3 }], [{ valor: 9 }]);
  assert.deepEqual(r.meus, [{ valor: 3 }]);
  assert.deepEqual(r.deles, [{ valor: 9 }, { valor: 1 }]);
  assert.equal(chamarAtencao([], []), null);
});

test("equilíbrio: os exemplos do livro (p. 17)", () => {
  assert.equal(equilibrado(5, 5), true);
  assert.equal(equilibrado(5, 6), true);
  assert.equal(equilibrado(5, 7), false);
  assert.equal(equilibrado(9, 7), false);
  assert.equal(equilibrado(9, 8), true);
  assert.equal(equilibrado(9, 11), false);
  assert.equal(dadosDeEquilibrio(6), 3);
  assert.equal(dadosDeEquilibrio(4), 2);
});

test("escalar: rápido soma RA, cauteloso RB, cair dói o acumulado (p. 41)", () => {
  assert.deepEqual(passoDeEscalada({ pontos: 4, alvo: 10, modo: "rapido", sucesso: true, ra: 6, rb: 2 }), { pontos: 10, dano: 0, chegou: true });
  assert.deepEqual(passoDeEscalada({ pontos: 4, alvo: 10, modo: "cauteloso", sucesso: true, ra: 6, rb: 2 }), { pontos: 6, dano: 0, chegou: false });
  assert.deepEqual(passoDeEscalada({ pontos: 7, alvo: 10, modo: "cauteloso", sucesso: false, ra: 6, rb: 2 }), { pontos: 0, dano: 7, chegou: false });
});

test("despencar da encosta só falhando por 3 ou mais (p. 59)", () => {
  assert.equal(quedaPorMargem({ total: 7, dt: 10, faltam: 2 }), "2d6");
  assert.equal(quedaPorMargem({ total: 8, dt: 10, faltam: 2 }), null);
  assert.equal(quedaPorMargem({ total: 4, dt: 7, faltam: 4 }), "4d6");
});

test("Escalar: crítico soma a segunda maior (beta §3)", () => {
  const r = passoDeEscalada({ pontos: 0, alvo: 20, modo: "cauteloso", sucesso: true, ra: 8, rb: 6, critico: true, segunda: 6 });
  assert.equal(r.pontos, 12);
});
