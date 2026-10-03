import test from "node:test";
import assert from "node:assert/strict";
import {
  leituraParaJogador, parteDoMestre, chaveLeitura, paragrafoDoMestre,
} from "../cena/leitura-ferramenta.mjs";

const LEITURA = '<p class="op2-mestre"><em>(apenas se o Ídolo for quebrado)</em></p>'
  + "<p>O material orgânico interno não é natural.</p>"
  + '<p class="op2-mestre">Envie o <a>handout</a>.</p>';

test("a parte do mestre sai do que o jogador lê, e só ela vai para o mestre", () => {
  assert.equal(leituraParaJogador(LEITURA), "<p>O material orgânico interno não é natural.</p>");
  assert.equal(parteDoMestre(LEITURA),
    '<p class="op2-mestre"><em>(apenas se o Ídolo for quebrado)</em></p><p class="op2-mestre">Envie o <a>handout</a>.</p>');
});

test("leitura só de instrução fica vazia para o jogador — leitura normal", () => {
  assert.equal(leituraParaJogador(paragrafoDoMestre("Informe mais quente.")), "");
  assert.equal(leituraParaJogador(null), "");
  assert.equal(parteDoMestre("<p>Só leitura.</p>"), "");
});

test("a marca escrita à mão na ficha vale igual, com outras classes junto", () => {
  assert.equal(leituraParaJogador('<p class="x op2-mestre y">nota</p><p>lida</p>'), "<p>lida</p>");
  assert.equal(chaveLeitura("Item.abc", "emf"), "Item.abc:emf");
});
