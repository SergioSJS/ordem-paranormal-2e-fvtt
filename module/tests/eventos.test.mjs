import test from "node:test";
import assert from "node:assert/strict";
import { rodadaRelativa, linhaDaRodada, proximaRodadaDaCena, linhasDaRodada } from "../cena/eventos.mjs";

/** A maldição do Ato I: rodadas 0, 4, 7 contadas a partir do gatilho. */
const maldicao = (extras = {}) => ({
  disparado: false,
  rodadaInicial: -1,
  rodadas: [
    { rodada: 0, narracao: "<p>O Ídolo observa de volta.</p>", efeito: "<p>Disciplina DT 7.</p>" },
    { rodada: 4, narracao: "<p>O símbolo pulsa.</p>", efeito: "" },
    { rodada: 7, narracao: "<p>A angústia cresce.</p>", efeito: "" },
  ],
  ...extras,
});

test("evento parado não tem rodada relativa nem linha para tocar", () => {
  const evento = maldicao();
  assert.equal(rodadaRelativa(evento, 5), -1);
  assert.equal(linhaDaRodada(evento, 5), null);
  assert.equal(proximaRodadaDaCena(evento, 5), null);
});

test("a rodada do gatilho vira a rodada 0 do evento, seja a cena qual for", () => {
  const cedo = maldicao({ disparado: true, rodadaInicial: 1 });
  const tarde = maldicao({ disparado: true, rodadaInicial: 50 });
  assert.equal(rodadaRelativa(cedo, 1), 0);
  assert.equal(rodadaRelativa(tarde, 50), 0);
  assert.equal(rodadaRelativa(tarde, 54), 4);
  assert.equal(linhaDaRodada(tarde, 54).narracao, "<p>O símbolo pulsa.</p>");
  assert.equal(linhaDaRodada(tarde, 57).narracao, "<p>A angústia cresce.</p>");
});

test("rodada da cena sem linha correspondente não toca nada", () => {
  const evento = maldicao({ disparado: true, rodadaInicial: 12 });
  assert.equal(linhaDaRodada(evento, 15), null);
  assert.equal(linhaDaRodada(evento, 11), null, "antes do gatilho não existe");
});

test("a próxima rodada da CENA em que o evento fala", () => {
  const evento = maldicao({ disparado: true, rodadaInicial: 10 });
  assert.equal(proximaRodadaDaCena(evento, 10), 10, "a rodada 0 é agora");
  assert.equal(proximaRodadaDaCena(evento, 11), 14, "a rodada 4 do evento cai na 14 da cena");
  assert.equal(proximaRodadaDaCena(evento, 18), null, "acabou o roteiro");
});

test("dois eventos disparados em rodadas diferentes falam cada um na sua vez", () => {
  const um = maldicao({ disparado: true, rodadaInicial: 2 });
  const outro = maldicao({ disparado: true, rodadaInicial: 6 });
  assert.deepEqual(linhasDaRodada([um, outro], 6).map(({ linha }) => linha.rodada), [4, 0]);
  assert.deepEqual(linhasDaRodada([um, outro], 13).map(({ linha }) => linha.rodada), [7]);
  assert.deepEqual(linhasDaRodada([um, outro], 5), []);
});

test("linha sem narração nem efeito não vira card", () => {
  const vazio = { disparado: true, rodadaInicial: 0, rodadas: [{ rodada: 0, narracao: "", efeito: "  " }] };
  assert.deepEqual(linhasDaRodada([vazio], 0), []);
});
