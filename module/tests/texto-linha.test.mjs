import test from "node:test";
import assert from "node:assert/strict";
import { textoPuroDaLinha, temHtml } from "../cena/texto-linha.mjs";

test("linha do quadro: HTML antigo vira texto puro; texto puro passa intacto", () => {
  assert.equal(textoPuroDaLinha("<p><em>(apenas Victor)</em> Você não sabe por quê.</p>"), "(apenas Victor) Você não sabe por quê.");
  assert.equal(textoPuroDaLinha("<p>Primeiro.</p><p>Segundo &amp; terceiro.</p>"), "Primeiro.\n\nSegundo & terceiro.");
  assert.equal(textoPuroDaLinha("Um livro está fora de lugar."), "Um livro está fora de lugar.");
  assert.equal(textoPuroDaLinha("DT 6 ou 10 — 3 < 4"), "DT 6 ou 10 — 3 < 4");
  assert.equal(textoPuroDaLinha(""), "");
  assert.equal(temHtml("<p>x</p>"), true);
  assert.equal(temHtml("3 < 4 e 5 > 2"), false);
});
