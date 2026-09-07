/**
 * Auditoria visual: abre cada tela do sistema num tema (OP2_TEMA=light|dark) e fotografa
 * em OP2_SAIDA. Usa o mundo do e2e (op2-teste), com os atos já importados.
 *   OP2_TEMA=light OP2_SAIDA=/tmp/auditoria node scripts/e2e/auditoria-visual.mjs
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
const SAIDA = process.env.OP2_SAIDA ?? "/tmp/op2-auditoria";
const TEMA = process.env.OP2_TEMA ?? "light";
const PORTA = process.env.PORTA_FVTT ?? 30099;
await mkdir(SAIDA, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
page.on("pageerror", (e) => console.log("[erro]", String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORTA}/join`, { waitUntil: "networkidle" });
await page.evaluate(() => { for (const o of document.querySelectorAll("select[name='userid'] option")) o.disabled = false; });
await page.selectOption("select[name='userid']", { label: "Gamemaster" });
await page.click("button[name='join'], button[type='submit']");
await page.waitForURL("**/game");
await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 90000 });
await page.waitForTimeout(1500);
const temaAtual = await page.evaluate(() => game.settings.get("core", "uiConfig")?.colorScheme?.applications ?? "");
if (temaAtual !== TEMA) {
  await page.evaluate(async (tema) => { const cfg = foundry.utils.deepClone(game.settings.get("core", "uiConfig")); cfg.colorScheme = { applications: tema, interface: tema }; await game.settings.set("core", "uiConfig", cfg); }, TEMA);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 90000 });
  await page.waitForTimeout(1500);
}
await page.evaluate(() => { for (const n of document.querySelectorAll("#notifications .notification")) n.remove(); });

const foto = async (nome, seletor, { antes, depois, espera = 1200 } = {}) => {
  try {
    if (antes) await page.evaluate(antes);
    const el = await page.waitForSelector(seletor, { timeout: 15000 }).catch(() => null);
    if (!el) { console.log(`(sem elemento) ${nome}`); return; }
    await page.waitForTimeout(espera);
    if (depois) await depois();
    const caixa = await (await page.$(seletor))?.boundingBox();
    if (!caixa) { console.log(`(sem caixa) ${nome}`); return; }
    await page.screenshot({ path: `${SAIDA}/${nome}.png`, clip: caixa });
    console.log(`${nome}.png`);
  } catch (e) { console.log(`(falhou) ${nome}: ${String(e).slice(0, 140)}`); }
  await page.evaluate(async () => { for (const app of foundry.applications.instances.values()) { if (app.id !== "sidebar" && !app.id?.startsWith("hotbar")) await app.close().catch(() => {}); } });
  await page.waitForTimeout(300);
};

// referências do mundo (atos importados pelo e2e)
const ref = await page.evaluate(() => {
  const alan = game.actors.getName("Alan"); const npc = game.actors.find((a) => a.type === "npc"); const inv = game.actors.find((a) => a.type === "investigacao");
  const tipo = (t) => game.items.find((i) => i.type === t);
  const desafio = (ab) => game.items.find((i) => i.type === "desafio-acesso" && i.system.abordagens?.[ab]);
  return {
    alan: alan?.uuid, npc: npc?.uuid, inv: inv?.uuid,
    poi: game.items.find((i) => i.type === "ponto-interesse" && i.system.informacoes?.length)?.uuid,
    poiRadio: game.items.find((i) => i.type === "ponto-interesse" && i.system.ferramentas?.radio?.conjuntos?.length)?.uuid,
    habilidade: tipo("habilidade")?.uuid, equipamento: tipo("equipamento")?.uuid, ferramenta: tipo("ferramenta")?.uuid, evento: tipo("evento")?.uuid,
    destrancar: desafio("destrancar")?.uuid, hack: desafio("hackTecnico")?.uuid, arrombar: desafio("arrombar")?.uuid,
  };
});
console.log("refs:", JSON.stringify(ref));

// settings do sistema (a aba do sistema, pelo título)
await foto("settings", "#settings-config, #client-settings", {
  antes: `(async () => { await game.settings.sheet.render({ force: true }); await new Promise((r) => setTimeout(r, 800)); const raiz = document.querySelector("#settings-config, #client-settings"); const aba = [...raiz.querySelectorAll("[data-tab], nav a, nav button")].find((e) => /Ordem Paranormal/.test(e.textContent) || /^(system|ordem-paranormal-2e)$/.test(e.dataset.tab ?? "")); aba?.click(); })()`,
});
await foto("extras-menu", ".op2-extras", { antes: async () => { const m = await import("/systems/ordem-paranormal-2e/module/ui/extras-aventura.mjs"); new m.ExtrasMenuApp().render({ force: true }); } });
await foto("aventuras", "#op2-aventuras", { antes: () => game.op2.aventuras() });
await foto("boas-vindas", "#op2-boas-vindas", { antes: () => game.op2.boasVindas() });
const abrirFicha = (uuid) => new Function("uuid", "return fromUuid(uuid).then((d) => d.sheet.render({ force: true }))");
for (const [nome, uuid] of [["ficha-personagem", ref.alan], ["ficha-npc", ref.npc], ["ficha-investigacao", ref.inv], ["item-poi", ref.poi], ["item-habilidade", ref.habilidade], ["item-equipamento", ref.equipamento], ["item-ferramenta", ref.ferramenta], ["item-evento", ref.evento], ["item-desafio", ref.destrancar]]) {
  if (!uuid) { console.log(`(sem doc) ${nome}`); continue; }
  await foto(nome, ".application.op2, .op2.application, .op2-ficha", { antes: `(async () => { const d = await fromUuid(${JSON.stringify(uuid)}); await d.sheet.render({ force: true }); })()` });
}
// ocupação vem do compêndio
await foto("item-ocupacao", ".application.op2, .op2.application, .op2-ficha", { antes: `(async () => { const p = game.packs.get("ordem-paranormal-2e.ocupacoes"); const d = await p.getDocument([...p.index][0]._id); await d.sheet.render({ force: true }); })()` });
// personagem: abas inventário e notas
await foto("ficha-personagem-inventario", ".op2-ficha--personagem", { antes: `(async () => { const d = await fromUuid(${JSON.stringify(ref.alan)}); await d.sheet.render({ force: true }); })()`, depois: async () => { await page.locator('.op2-ficha--personagem [data-tab="inventario"]').first().click().catch(() => {}); await page.waitForTimeout(400); } });
await foto("ficha-personagem-notas", ".op2-ficha--personagem", { antes: `(async () => { const d = await fromUuid(${JSON.stringify(ref.alan)}); await d.sheet.render({ force: true }); })()`, depois: async () => { await page.locator('.op2-ficha--personagem [data-tab="notas"]').first().click().catch(() => {}); await page.waitForTimeout(400); } });
// painel: três abas
for (const aba of ["preparacao", "pontos", "desafios"]) {
  await foto(`painel-${aba}`, "#op2-painel-investigacao", { antes: () => game.op2.painelInvestigacao(), depois: async () => { const b = page.locator(`#op2-painel-investigacao [data-tab="${aba}"], #op2-painel-investigacao [data-aba="${aba}"]`).first(); if (await b.count()) { await b.click(); await page.waitForTimeout(400); } else console.log(`  (aba ${aba} não achada)`); } });
}
await foto("acoes-investigacao", "[id^=op2-acoes]", { antes: `(async () => { const d = await fromUuid(${JSON.stringify(ref.alan)}); game.op2.acoesInvestigacao(d); })()` });
// diálogos (sem await: ficam esperando o usuário)
await foto("dialogo-teste", ".op2-dialog, .op2-dialogo, [id^=op2-teste], .application.dialog", { antes: `(async () => { const d = await fromUuid(${JSON.stringify(ref.alan)}); game.op2.rolarTeste(d, { chavePericia: "acrobacia" }); })()` });
await foto("dialogo-examinar", ".op2-dialog, .application.dialog", { antes: `(async () => { const d = await fromUuid(${JSON.stringify(ref.alan)}); game.op2.dialogoExaminar(d, ${JSON.stringify(ref.poi)}); })()` });
// ferramentas e minigames
if (ref.destrancar) await foto("destrancar", "[id^=op2-destrancar], .op2-destrancar", { antes: `game.op2.abrirDestrancar(${JSON.stringify(ref.destrancar)})` });
await foto("laboratorio", "[id^=op2-laboratorio], .op2-laboratorio", { antes: `(async () => { const d = await fromUuid(${JSON.stringify(ref.alan)}); game.op2.abrirLaboratorio(d, 6, ${JSON.stringify(ref.poi)}); })()` });
if (ref.poiRadio) await foto("radio", "[id^=op2-radio], .op2-radio", { antes: `(async () => { const d = await fromUuid(${JSON.stringify(ref.alan)}); await game.op2.usarRadio(d, ${JSON.stringify(ref.poiRadio)}, { rapido: true }); })()`, espera: 2500 });
if (ref.hack) await foto("timer-hack", "[id^=op2-timer], .op2-timer-hack", { antes: `(async () => { const d = await fromUuid(${JSON.stringify(ref.alan)}); await game.op2.iniciarHackTecnico(${JSON.stringify(ref.hack)}, d.id, 0, { segundos: 90 }); })()`, espera: 2000 });
// itens que não vivem soltos no mundo: habilidade do Alan, ferramenta do compêndio, equipamento novo
await foto("item-habilidade", ".application.op2, .op2-ficha", { antes: `(async () => { const a = game.actors.getName("Alan"); await a.items.find((i) => i.type === "habilidade").sheet.render({ force: true }); })()` });
await foto("item-ferramenta", ".application.op2, .op2-ficha", { antes: `(async () => { const p = game.packs.get("ordem-paranormal-2e.ferramentas"); const d = await p.getDocument([...p.index][0]._id); await d.sheet.render({ force: true }); })()` });
await foto("item-equipamento", ".application.op2, .op2-ficha", { antes: `(async () => { const a = game.actors.getName("Alan"); const e = a.items.find((i) => i.type === "equipamento") ?? (await a.createEmbeddedDocuments("Item", [{ name: "Lanterna", type: "equipamento" }]))[0]; await e.sheet.render({ force: true }); })()` });
// rádio: a janela recebe o resultado de usarRadio — aqui, um montado à mão
await foto("radio", ".op2-radio", { antes: `(async () => { const { abrirRadio } = await import("/systems/ordem-paranormal-2e/module/cena/radio-app.mjs"); const a = game.actors.getName("Alan"); const poi = game.items.getName("Rádio de teste") ?? await Item.create({ name: "Rádio de teste", type: "ponto-interesse" }); abrirRadio({ ator: a, poi, roll: { total: 7, ra: 4, rb: 3 }, removidos: 1, totalFalsos: 2, conjuntos: [{ verdadeiro: true, frase: "PENSE NA | SUA FILHA" }, { verdadeiro: false, frase: "O RITUAL" }, { verdadeiro: false, frase: "EDGAR" }] }); })()`, espera: 1500 });
await foto("timer-hack", "[id^=op2-timer], .op2-timer-hack, .op2-timer", { antes: `(async () => { const a = game.actors.getName("Alan"); const d = game.items.getName("Painel de teste") ?? await Item.create({ name: "Painel de teste", type: "desafio-acesso", system: { abordagens: { hackTecnico: true, arrombar: false, destrancar: false, hackSocial: false, generico: false }, dtObjeto: 9 } }); await game.op2.iniciarHackTecnico(d.uuid, a.id, 0, { segundos: 90 }); })()`, espera: 2000 });
// cards de chat
await page.evaluate(async (ref) => {
  await ChatMessage.deleteDocuments(game.messages.map((m) => m.id));
  const alan = await fromUuid(ref.alan);
  const tenta = async (f) => { try { await f(); } catch (e) { console.warn("card:", e.message); } };
  await tenta(() => game.op2.rolarTeste(alan, { chavePericia: "acrobacia", rapido: true }));
  await tenta(() => game.op2.examinar(alan, ref.poi, "percepcao", { rapido: true }));
  if (ref.arrombar) await tenta(() => game.op2.arrombar(alan, ref.arrombar, { rapido: true }));
  if (ref.npc) await tenta(() => game.op2.atacar(alan, { alvoUuid: ref.npc, armado: false, rapido: true }));
  await tenta(() => game.op2.avancarRodada());
}, ref);
await page.waitForTimeout(1500);
// O chat destacado (popout) mostra o log inteiro sem depender da barra lateral.
await foto("chat", "#chat-popout", { antes: () => ui.chat.renderPopout(), espera: 1200 });
await browser.close();
