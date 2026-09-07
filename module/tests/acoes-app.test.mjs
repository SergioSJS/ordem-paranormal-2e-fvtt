import test from "node:test";
import assert from "node:assert/strict";
import { instalarStubs } from "./stub-foundry.mjs";

instalarStubs();
const { fechaDepois } = await import("../cena/acoes-app.mjs");

test("janela de ações: fecha depois de a ação rolar, fica quando a ação é cancelada", async () => {
  const janela = { fechamentos: 0, async close() { this.fechamentos += 1; } };
  await fechaDepois(async () => ({ total: 9 })).call(janela);
  await fechaDepois(async () => true).call(janela);
  await fechaDepois(async () => undefined).call(janela); // ação sem retorno: rolou, fecha
  assert.equal(janela.fechamentos, 3);
  await fechaDepois(async () => null).call(janela); // diálogo cancelado, sem alvo
  await fechaDepois(async () => false).call(janela);
  assert.equal(janela.fechamentos, 3);
});
