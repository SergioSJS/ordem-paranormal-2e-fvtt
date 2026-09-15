import test from "node:test";
import assert from "node:assert/strict";
import {
  chaveInfo, periciasDoQuadro, gruposDoQuadro, resolverInvestigacao, resolverExaminar, motivoSemRevelacao,
  danoSobrecarga,
} from "../cena/investigacao.mjs";
import { TABELA_SOBRECARGA_PADRAO } from "../config.mjs";

const QUADRO = [
  { id: "i1", pericia: "percepcao", dt: 6, texto: "marca de dedo no vidro" },
  { id: "i2", pericia: "percepcao", dt: 10, texto: "bilhete atrás do quadro" },
  { id: "i3", pericia: "ocultismo", dt: 8, texto: "símbolo riscado a carvão" },
];

test("investigar revela só o que a perícia alcança, sem rolar (spec §6.3)", () => {
  // d8 de Percepção: entrega a DT 6, mas não a DT 10.
  assert.deepEqual(resolverInvestigacao(QUADRO, "percepcao", 8), ["i1"]);
  // d12 de Percepção: as duas.
  assert.deepEqual(resolverInvestigacao(QUADRO, "percepcao", 12), ["i1", "i2"]);
  // d4 de Percepção: nada.
  assert.deepEqual(resolverInvestigacao(QUADRO, "percepcao", 4), []);
  // Ocultismo d8: a de ocultismo, não as de percepção.
  assert.deepEqual(resolverInvestigacao(QUADRO, "ocultismo", 8), ["i3"]);
});

test("investigar não repete o que o personagem já tem", () => {
  assert.deepEqual(resolverInvestigacao(QUADRO, "percepcao", 12, new Set(["i1"])), ["i2"]);
});

test("examinar compara a soma rolada contra a DT (spec §6.3.1)", () => {
  const { revelaveis, perdePD } = resolverExaminar(QUADRO, "percepcao", 11);
  assert.deepEqual(revelaveis, ["i1", "i2"]);
  assert.equal(perdePD, false);
});

test("examinar sem info nova custa 1 PD — por falhar na DT ou por não haver mais nada", () => {
  // Falhou na DT: soma 5 não alcança nada de Percepção.
  assert.equal(resolverExaminar(QUADRO, "percepcao", 5).perdePD, true);
  // Já tem tudo: não há mais nada a revelar.
  assert.equal(resolverExaminar(QUADRO, "percepcao", 12, new Set(["i1", "i2"])).perdePD, true);
  // O POI pode ser vazio de propósito (spec §6.2).
  assert.equal(resolverExaminar([], "percepcao", 12).perdePD, true);
  // Pista contada ao grupo é sabida por todos: Examinar não a acha de novo, e cobra o PD.
  const contada = QUADRO.map((i) => (i.id === "i1" ? { ...i, contadaPor: ["a1"] } : i));
  assert.equal(resolverExaminar(contada, "percepcao", 11).revelaveis.includes("i1"), false);
  assert.equal(resolverExaminar(contada.filter((i) => i.id === "i1"), "percepcao", 12).perdePD, true);
});

test("examinar com crítico ignora a DT e revela o que falta da perícia (spec §4.3)", () => {
  const { revelaveis, perdePD } = resolverExaminar(QUADRO, "percepcao", 5, new Set(), { ignorarDT: true });
  assert.deepEqual(revelaveis, ["i1", "i2"]);
  assert.equal(perdePD, false);
});

test("revelação vem em DT crescente", () => {
  const quadroInvertido = [QUADRO[1], QUADRO[0]];
  assert.deepEqual(resolverInvestigacao(quadroInvertido, "percepcao", 12), ["i1", "i2"]);
  assert.deepEqual(resolverExaminar(quadroInvertido, "percepcao", 12).revelaveis, ["i1", "i2"]);
});

test("periciasDoQuadro lista sem repetição, na ordem do quadro", () => {
  assert.deepEqual(periciasDoQuadro(QUADRO), ["percepcao", "ocultismo"]);
});

// O Computador do Ato I: "Pesquisar ou Tecnologia" — a linha sai com qualquer uma.
// Antes a segunda ficava só no texto, e Examinar com Tecnologia não achava nada e
// cobrava o PD (achado em uso real: "deu 10 mas deu falho").
const COMPUTADOR = [
  { id: "i1", pericia: "pesquisar", dt: 6, texto: "papéis de contabilidade" },
  { id: "i2", pericia: "pesquisar", periciaAlternativa: "tecnologia", dt: 10, texto: "e-mail de 12 de março" },
];

test("perícia alternativa: examinar com a segunda perícia acha a linha (Computador, Ato I)", () => {
  assert.deepEqual(resolverExaminar(COMPUTADOR, "tecnologia", 10).revelaveis, ["i2"]);
  assert.deepEqual(resolverExaminar(COMPUTADOR, "pesquisar", 10).revelaveis, ["i1", "i2"]);
  assert.equal(resolverExaminar(COMPUTADOR, "tecnologia", 10).perdePD, false);
  // A alternativa também vale para o passo sem rolar e para o motivo do custo.
  assert.deepEqual(resolverInvestigacao(COMPUTADOR, "tecnologia", 10), ["i2"]);
  assert.deepEqual(motivoSemRevelacao(COMPUTADOR, "tecnologia", 8), { motivo: "dado-pequeno", dtMinima: 10 });
  assert.deepEqual(motivoSemRevelacao(COMPUTADOR, "medicina", 8), { motivo: "sem-pericia", dtMinima: null });
});

test("perícia alternativa entra nas perícias do quadro e agrupa a linha uma vez só", () => {
  assert.deepEqual(periciasDoQuadro(COMPUTADOR), ["pesquisar", "tecnologia"]);
  const grupos = gruposDoQuadro(COMPUTADOR);
  assert.deepEqual(grupos.map((g) => g.chave), ["pesquisar", "pesquisar|tecnologia"]);
  assert.deepEqual(grupos[1].chaves, ["pesquisar", "tecnologia"]);
  assert.deepEqual(grupos[1].infos.map((i) => i.id), ["i2"]);
});

test("chaveInfo amarra a info ao POI", () => {
  assert.equal(chaveInfo("Item.abc", "i1"), "Item.abc:i1");
});

test("sobrecarga: tabela de referência do playtest (spec §7.6)", () => {
  assert.equal(danoSobrecarga(TABELA_SOBRECARGA_PADRAO, 1), "0");
  assert.equal(danoSobrecarga(TABELA_SOBRECARGA_PADRAO, 3), "1");
  assert.equal(danoSobrecarga(TABELA_SOBRECARGA_PADRAO, 5), "1d4");
  assert.equal(danoSobrecarga(TABELA_SOBRECARGA_PADRAO, 8), "1d6");
});

test("sobrecarga: '9 ou mais' vale a última linha (LACUNAS)", () => {
  assert.equal(danoSobrecarga(TABELA_SOBRECARGA_PADRAO, 9), "2d4");
  assert.equal(danoSobrecarga(TABELA_SOBRECARGA_PADRAO, 12), "2d4");
});

test("sobrecarga: a tabela editada pela cena é a que vale", () => {
  const tabela = [{ rodada: 1, dano: "1d4" }];
  assert.equal(danoSobrecarga(tabela, 1), "1d4");
  assert.equal(danoSobrecarga(tabela, 7), "1d4");
});
