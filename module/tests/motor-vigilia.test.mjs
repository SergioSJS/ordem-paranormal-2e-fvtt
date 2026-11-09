import { pontosDoEstendido } from "../dice/analise.mjs";
import { virarRodada, passosDeCondicoes as passosDasCondicoes } from "../vigilia/combate.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { analisar, marcarPavor, segundaRolagem, selecaoSugerida } from "../dice/analise.mjs";
import {
  LESOES, TRAUMAS, linhaDaTabela, efeitoDoTesteDeLesao, modificadorPermanente, maximosDaLinha,
  danoDepoisDaProtecao, precisaRolarDeNovo, bonusDePatamar, extraDeDanoEmocional,
} from "../vigilia/dano.mjs";
import { beneficiosDoGrau, podeInvocar } from "../vigilia/relacoes.mjs";

const dado = (resultado, extra = {}) => ({ indice: 0, dado: "d8", resultado, contado: true, ...extra });
const comPavor = (valores, pavor) => marcarPavor([...valores.map((v) => dado(v)), dado(pavor, { pavor: true })]);

test("modificador fixo soma ao resultado, e pode virar a DT (beta §3)", () => {
  assert.equal(analisar([dado(3), dado(3)], { dt: 7, modificador: 1 }).total, 7);
  assert.equal(analisar([dado(3), dado(3)], { dt: 7, modificador: 1 }).sucesso, true);
  assert.equal(analisar([dado(4), dado(3)], { dt: 7, modificador: -2 }).sucesso, false);
  assert.equal(analisar([dado(3), dado(3)], { dt: 7 }).modificador, 0);
});

test("pavor: os três exemplos do livro (beta §9.1)", () => {
  // 7 e 2 com pavor 4: anula o 2, vale 7.
  const a = analisar(comPavor([7, 2], 4));
  assert.equal(a.total, 7);
  assert.equal(a.falhaCritica, false);
  // 3 e 1 com pavor 5: anula os dois, vale 0, falha crítica.
  const b = analisar(comPavor([3, 1], 5), { dt: 7 });
  assert.equal(b.total, 0);
  assert.equal(b.falhaCritica, true);
  assert.equal(b.desfecho, "falha-critica");
  // 6 e 5 com pavor 3: não anula nada, vale 11.
  assert.equal(analisar(comPavor([6, 5], 3)).total, 11);
});

test("pavor: empate não anula, e o dado de pavor não soma nem conta em RA", () => {
  const a = analisar(comPavor([4, 2], 4));
  assert.equal(a.total, 4);
  assert.equal(a.ra, 4);
  assert.equal(a.rb, 4);
  const b = analisar(comPavor([6, 5], 8));
  assert.equal(b.falhaCritica, true);
  assert.equal(b.ra, 0);
});

test("pavor: dado anulado não forma crítico", () => {
  // 6 e 6 com pavor 8: os dois somem, é falha crítica e não crítico.
  const a = analisar(comPavor([6, 6], 8));
  assert.equal(a.critico, false);
  assert.equal(a.falhaCritica, true);
  // O próprio pavor não faz par: 6 e 3 com pavor 6.
  assert.equal(analisar(comPavor([6, 3], 6)).critico, false);
});

test("pavor em 1 não anula nada: é o que encerra o efeito", () => {
  assert.equal(analisar(comPavor([2, 3], 1)).total, 5);
});

test("sem dado de pavor, tudo como antes", () => {
  const dados = [dado(1), dado(1)];
  assert.deepEqual(marcarPavor(dados), dados);
  assert.equal(analisar(dados).falhaCritica, true);
});

test("seleção sugerida ignora pavor e anulados", () => {
  const dados = [dado(9, { indice: 0, pavor: true }), dado(5, { indice: 1 }), dado(4, { indice: 2 }),
    dado(3, { indice: 3 }), dado(2, { indice: 4 })];
  assert.deepEqual(selecaoSugerida(dados), [1, 2, 3]);
});

test("crítico: mínimo por arma e segunda rolagem para o dano", () => {
  assert.equal(analisar([dado(5), dado(5)]).critico, false);
  assert.equal(analisar([dado(5), dado(5)], { minimoCritico: 5 }).critico, true);
  assert.equal(segundaRolagem([dado(7), dado(6), dado(2)]), 6);
  assert.equal(analisar([dado(7), dado(7)]).segunda, 7);
});

test("tabelas de lesão e trauma cobrem de 1 a 20+, sem buraco", () => {
  for (const tabela of [LESOES, TRAUMAS]) {
    for (let v = 1; v <= 24; v += 1) {
      const linhas = tabela.filter((l) => v >= l.de && v <= l.ate);
      assert.equal(linhas.length, 1, `${v}`);
    }
  }
  assert.equal(linhaDaTabela(LESOES, 4).chave, "morteSubita");
  assert.equal(linhaDaTabela(LESOES, 5).chave, "morteLenta");
  assert.equal(linhaDaTabela(LESOES, 20).chave, "surto");
  assert.equal(linhaDaTabela(LESOES, 23).chave, "surto");
  assert.equal(linhaDaTabela(TRAUMAS, 16).chave, "panico");
});

test("patamar soma na rolagem", () => {
  assert.deepEqual(["iniciante", "veterano", "elite", "lenda"].map(bonusDePatamar), [0, 1, 2, 3]);
});

test("teste de lesão: cada desfecho (beta §8.2)", () => {
  assert.deepEqual(efeitoDoTesteDeLesao("sucesso").condicoes, ["inconsciente", "moribundo"]);
  assert.equal(efeitoDoTesteDeLesao("falha").lesao, true);
  assert.equal(efeitoDoTesteDeLesao("falha-critica").morte, true);
  assert.equal(efeitoDoTesteDeLesao("critico").recupera, 1);
});

test("lesão repetida rola de novo, menos Laceração (beta §8.2)", () => {
  const semOlho = LESOES.find((l) => l.chave === "semOlho");
  const laceracao = LESOES.find((l) => l.chave === "laceracao");
  assert.equal(precisaRolarDeNovo(semOlho, ["semOlho"]), true);
  assert.equal(precisaRolarDeNovo(semOlho, []), false);
  assert.equal(precisaRolarDeNovo(laceracao, ["laceracao"]), false);
});

test("modificador permanente soma perícia e atributo; máximos e estresse", () => {
  assert.equal(modificadorPermanente({ lesoes: ["semOlho", "orgaoSensorial"] }, "percepcao", "mente"), -3);
  assert.equal(modificadorPermanente({ traumas: ["cognitiva"] }, "percepcao", "mente"), -1);
  assert.equal(modificadorPermanente({ lesoes: ["cicatriz"] }, "intimidar", "emocao"), 1);
  assert.equal(modificadorPermanente({}, "luta", "fisico"), 0);
  assert.deepEqual(maximosDaLinha("lesoes", "laceracao"), { pv: -2, pd: 0 });
  assert.deepEqual(maximosDaLinha("traumas", "chaga"), { pv: 0, pd: -2 });
  assert.deepEqual(maximosDaLinha("lesoes", "inexistente"), { pv: 0, pd: 0 });
  assert.equal(extraDeDanoEmocional({ traumas: ["estresse"] }), 1);
});

test("proteção: RD, arma que ignora RD e ponto de armadura (beta §8.4/§8.5)", () => {
  assert.equal(danoDepoisDaProtecao(12, { rd: 5 }), 7);
  assert.equal(danoDepoisDaProtecao(12, { rd: 5, ignoraRd: 5 }), 12);
  assert.equal(danoDepoisDaProtecao(12, { gastarArmadura: true }), 2);
  assert.equal(danoDepoisDaProtecao(4, { gastarArmadura: true }), 0);
  assert.equal(danoDepoisDaProtecao(3, { rd: 5 }), 0);
});

test("relações: benefícios por grau, uma vez por missão (beta §9.2)", () => {
  assert.deepEqual(beneficiosDoGrau(0), []);
  assert.deepEqual(beneficiosDoGrau(1).map((b) => b.chave), ["teste", "ajudar"]);
  assert.equal(beneficiosDoGrau(1)[0].dado, "d6");
  assert.equal(beneficiosDoGrau(2).find((b) => b.chave === "motivar").formula, "2d4");
  assert.equal(beneficiosDoGrau(3)[0].dado, "d12");
  assert.ok(beneficiosDoGrau(3).some((b) => b.chave === "acaoExtra"));
  assert.equal(podeInvocar({ grau: 1, invocada: false }), true);
  assert.equal(podeInvocar({ grau: 1, invocada: true }), false);
  assert.equal(podeInvocar({ grau: 0, invocada: false }), false);
});

test("combate: fases, ataque e cruzado (beta §7)", async () => {
  const {
    FASES, proximaFase, jaAgiu, lerPassos, passosDeCondicoes, montarAtaque, resolverCruzado,
    danoDoAcerto, defesaVenceu, resolverManobra, dtDeQueda, faseDoAtaque,
  } = await import("../vigilia/combate.mjs");
  assert.deepEqual(FASES, ["suporte", "distancia", "corpo", "final"]);
  assert.equal(proximaFase("corpo"), "final");
  assert.equal(proximaFase("final"), null);
  assert.equal(faseDoAtaque("distancia"), "distancia");
  assert.equal(jaAgiu([{ ator: "a", fase: "suporte" }], "a"), true);
  assert.equal(jaAgiu([{ ator: "a", fase: "suporte" }], "b"), false);
  assert.deepEqual(lerPassos("atletismo -1, furtividade -1"), [{ chave: "atletismo", passos: -1 }, { chave: "furtividade", passos: -1 }]);
  assert.deepEqual(lerPassos("lixo, percepcao +2"), [{ chave: "percepcao", passos: 2 }]);
  assert.deepEqual(lerPassos(""), []);
  assert.equal(passosDeCondicoes(["caido"], "fisico"), -1);
  assert.equal(passosDeCondicoes(["caido"], "mente"), 0);
  assert.equal(passosDeCondicoes(["caido", "atrapalhado", "apressado"], "fisico"), -3);
  // DT: base, longe, cobertura, caído à distância.
  assert.equal(montarAtaque({ tipo: "corpo" }).dt, 7);
  assert.equal(montarAtaque({ tipo: "distancia", longe: true }).dt, 10);
  assert.equal(montarAtaque({ tipo: "distancia", longe: true, condicoesAlvo: ["coberturaLeve"] }).dt, 13);
  assert.equal(montarAtaque({ tipo: "distancia", condicoesAlvo: ["caido"] }).dt, 10);
  assert.equal(montarAtaque({ tipo: "corpo", condicoesAlvo: ["caido"] }).passos, 1);
  assert.equal(montarAtaque({ tipo: "corpo", condicoesAlvo: ["ocultacaoTotal"] }).passos, -2);
  assert.equal(montarAtaque({ tipo: "corpo", condicoesAlvo: ["coberturaTotal"] }).alvoProtegido, true);
  // Atirar em corpo a corpo: -2 passos, ou arrisca.
  assert.equal(montarAtaque({ tipo: "distancia", alvoEmCorpoACorpo: true }).passos, -2);
  const arrisca = montarAtaque({ tipo: "distancia", alvoEmCorpoACorpo: true, arriscar: true });
  assert.equal(arrisca.passos, 0);
  assert.equal(arrisca.arriscando, true);
  assert.deepEqual(montarAtaque({ tipo: "distancia", mirou: true }).dadosExtras, ["d6"]);
  assert.deepEqual(montarAtaque({ tipo: "corpo", mirou: true }).dadosExtras, []);
  // Cruzado: maior acerta, empate acerta os dois, abaixo de 7 ninguém.
  assert.deepEqual(resolverCruzado(9, 8), { acertaA: true, acertaB: false });
  assert.deepEqual(resolverCruzado(8, 8), { acertaA: true, acertaB: true });
  assert.deepEqual(resolverCruzado(5, 6), { acertaA: false, acertaB: false });
  assert.deepEqual(resolverCruzado(6, 8), { acertaA: false, acertaB: true });
  assert.equal(danoDoAcerto({ ra: 6, segunda: 5, critico: false }, 3), 9);
  assert.equal(danoDoAcerto({ ra: 6, segunda: 6, critico: true }, 3), 15);
  assert.equal(defesaVenceu(8, 8), false);
  assert.deepEqual(resolverManobra(12, 7), { venceu: true, porCinco: true });
  assert.deepEqual(resolverManobra(8, 7), { venceu: true, porCinco: false });
  assert.deepEqual(resolverManobra(7, 7), { venceu: false, porCinco: false });
  assert.deepEqual([0, 1, 2].map(dtDeQueda), [7, 10, 13]);
});

test("virada de rodada: moribundo não testa na rodada em que caiu (beta §8.2)", () => {
  const caiu = virarRodada([{ id: "a", condicoes: ["moribundo"] }], []);
  assert.deepEqual(caiu.testam, []);
  const seguinte = virarRodada([{ id: "a", condicoes: ["moribundo"] }], caiu.vistas);
  assert.deepEqual(seguinte.testam, ["a"]);
});

test("virada de rodada: o que dura a rodada sai; Fintar, Mirar e Empurrar duram mais uma (beta §7.2/§7.4)", () => {
  const primeira = virarRodada([{ id: "a", condicoes: ["atrapalhado", "fintando", "caido"] }], []);
  assert.deepEqual(primeira.saem, [{ id: "a", condicao: "atrapalhado" }]);
  const segunda = virarRodada([{ id: "a", condicoes: ["fintando", "caido"] }], primeira.vistas);
  assert.deepEqual(segunda.saem, [{ id: "a", condicao: "fintando" }]);
  assert.deepEqual(segunda.vistas, []);
});

test("empurrado pesa um passo em qualquer teste (beta §7.4)", () => {
  assert.equal(passosDasCondicoes(["empurrado"], "mente"), -1);
});

test("teste estendido: crítico soma a segunda maior, só no beta (beta §3)", () => {
  const r = { ra: 8, critico: true, segunda: 6 };
  assert.equal(pontosDoEstendido(r), 8, "o Arrombar do alpha soma só a RA");
  assert.equal(pontosDoEstendido(r, { somaCritico: true }), 14);
  assert.equal(pontosDoEstendido({ ra: 8, critico: false, segunda: 6 }, { somaCritico: true }), 8);
});

test("soltar-se: contra quem segura só vencendo; sem quem segura, DT padrão; o passo é da vítima", async () => {
  const { venceuSoltura, passosDaSoltura } = await import("../vigilia/combate.mjs");
  assert.equal(venceuSoltura(9, 8), true);
  assert.equal(venceuSoltura(8, 8), false); // empate segura
  assert.equal(venceuSoltura(7), true);
  assert.equal(venceuSoltura(6), false);
  assert.equal(passosDaSoltura(true, -1), -1);
  assert.equal(passosDaSoltura(false, -1), 0); // quem ajuda testa sem a penalidade (p. 33)
  assert.equal(passosDaSoltura(true, ""), 0);
});
