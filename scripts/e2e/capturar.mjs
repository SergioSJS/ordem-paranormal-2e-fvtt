/**
 * Prints do sistema rodando de verdade, para o README. Monta um mundo de
 * demonstração (pré-gerados do Ato I, um POI, um desafio) e fotografa cada tela.
 *
 *   node scripts/e2e/capturar.mjs
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

// `OP2_SAIDA` para fotografar em outro lugar (revisão), `OP2_TEMA=light|dark` para
// fixar o tema do Foundry antes — os prints do README são no escuro.
const SAIDA = process.env.OP2_SAIDA ?? "docs/img";
const PORTA = process.env.PORTA_FVTT ?? 30099;
const TEMA = process.env.OP2_TEMA ?? "dark";
await mkdir(SAIDA, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("[erro]", String(e).slice(0, 200)));

await page.goto(`http://localhost:${PORTA}/join`, { waitUntil: "networkidle" });
await page.selectOption("select[name='userid']", { label: "Gamemaster" });
await page.click("button[name='join'], button[type='submit']");
await page.waitForURL("**/game");
await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 60000 });
await page.waitForTimeout(2000);
// O tema é setting do cliente (uiConfig.colorScheme, v13 e v14): fixa e recarrega.
const temaAtual = await page.evaluate(() => game.settings.get("core", "uiConfig")?.colorScheme?.applications ?? "");
if (temaAtual !== TEMA) {
  await page.evaluate(async (tema) => {
    const cfg = foundry.utils.deepClone(game.settings.get("core", "uiConfig"));
    cfg.colorScheme = { applications: tema, interface: tema };
    await game.settings.set("core", "uiConfig", cfg);
  }, TEMA);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 60000 });
  await page.waitForTimeout(2000);
}

// Fecha avisos do navegador que sujam o print.
await page.evaluate(() => {
  for (const n of document.querySelectorAll("#notifications .notification")) n.remove();
});

const dados = await page.evaluate(async () => {
  // Apagar em lote: o mundo de teste acumula centenas de documentos das rodadas
  // anteriores do e2e, e um `delete()` por vez leva minutos.
  await Actor.deleteDocuments(game.actors
    .filter((a) => ["personagem", "npc", "investigacao"].includes(a.type)).map((a) => a.id));
  await Item.deleteDocuments(game.items
    .filter((i) => ["ponto-interesse", "desafio-acesso"].includes(i.type)).map((i) => i.id));
  await ChatMessage.deleteDocuments(game.messages.map((m) => m.id));

  // Os pré-gerados vêm do bundle da janela de aventuras, SEM as artes da editora: os
  // prints vão para o README e para a listagem do Foundry, e a Licença da Comunidade
  // não deixa reproduzir imagem do livro — retrato e token ficam no ícone do sistema.
  const fontes = await (await fetch("systems/ordem-paranormal-2e/assets/aventura/fontes-ato-i.json")).json();
  const ICONE = "icons/svg/mystery-man.svg"; // do próprio Foundry, não redistribuído
  const importar = async (nome) => {
    const doc = foundry.utils.deepClone(fontes.pregerados.find((a) => a.name === nome));
    doc.img = ICONE;
    foundry.utils.setProperty(doc, "prototypeToken.texture.src", ICONE);
    foundry.utils.setProperty(doc, "system.biografia", "");
    return Actor.create(doc);
  };
  const alan = await importar("Alan");
  const edgar = await importar("Edgar");
  await alan.update({ "system.recursos.pd.value": 12 });
  // A barra de Ímpeto é a habilidade: o estado mora nela.
  await alan.items.getName("Ímpeto")?.update({ "system.impeto.preenchidos": 1 });

  const npc = await Actor.create({ name: "Zelador", type: "npc" });

  const poi = await Item.create({
    name: "Estante de Livros", type: "ponto-interesse",
    system: {
      descricaoBasica: "<p>Uma estante alta, de madeira escura, com livros fora de ordem.</p>",
      descricaoContextual: "<p>Atrás da fileira de baixo há um cofre embutido.</p>",
      informacoes: [
        { id: "a", pericia: "percepcao", dt: 6, texto: "Um livro está fora de lugar.", aberta: true },
        { id: "b", pericia: "percepcao", dt: 9, texto: "A poeira foi remexida há pouco." },
        { id: "c", pericia: "aptidao.humanas", dt: 7, texto: "Os títulos são todos sobre arqueologia." },
        { id: "d", pericia: "ocultismo", dt: 11, texto: "Um dos volumes não tem título.", oculta: true },
      ],
    },
  });

  const desafio = await Item.create({
    name: "Cofre Embutido", type: "desafio-acesso",
    system: {
      abordagens: { arrombar: true, destrancar: true, hackTecnico: false, hackSocial: false, generico: false },
      dtObjeto: 9, pontuacaoAlvo: 10, pontuacaoAtual: 4, maxTentativas: 3, tentativasUsadas: 1,
    },
  });

  const inv = await game.op2.criarInvestigacao("O Porão");
  for (const a of [alan, edgar, npc]) await game.op2.adicionarParticipante(inv, a.uuid);
  await game.op2.vincularPoi(inv, poi.uuid, { oculto: false });
  await game.op2.vincularDesafio(inv, desafio.uuid, { oculto: false });
  await inv.update({ "system.rodada": 3, "system.sobrecarga.ativa": true });
  await game.user.update({ character: alan.id });

  await game.op2.examinar(alan, poi.uuid, "percepcao", { rapido: true });
  return { alanId: alan.id, poiUuid: poi.uuid, desafioUuid: desafio.uuid };
});
await page.waitForTimeout(1200);

async function fotografar(nome, seletor, { antes } = {}) {
  if (antes) await page.evaluate(antes, dados);
  // Janela que consulta o mundo antes de aparecer (a de aventuras confere as artes na
  // pasta) leva mais de um segundo: esperar pelo elemento, não por um tempo fixo.
  const apareceu = await page.waitForSelector(seletor, { timeout: 15000 }).catch(() => null);
  if (!apareceu) return console.log(`(sem elemento) ${nome}`);
  await page.waitForTimeout(1200);
  // Print da área do elemento, não do elemento: o print de elemento do Playwright espera
  // ele "estável" e falha se a janela se re-renderiza ou anima nesse meio tempo (o
  // handle de cima pode nem estar mais no DOM). A caixa é lida na hora.
  const caixa = await (await page.$(seletor))?.boundingBox();
  if (!caixa) return console.log(`(sem elemento) ${nome}`);
  await page.screenshot({ path: `${SAIDA}/${nome}.png`, clip: caixa });
  console.log(`${SAIDA}/${nome}.png`);
}

await fotografar("ficha-personagem", ".op2-ficha--personagem", {
  antes: ({ alanId }) => game.actors.get(alanId).sheet.render(true),
});
await page.evaluate(() => [...foundry.applications.instances.values()].forEach((a) => a.close?.()));

// A tela de boas-vindas e a janela de aventuras: o que o mestre vê ao entrar, e de onde
// as aventuras vêm. A janela mostra "guardada no mundo" quando o e2e já montou os atos.
await fotografar("boas-vindas", "#op2-boas-vindas", { antes: () => game.op2.boasVindas() });
await page.evaluate(() => [...foundry.applications.instances.values()].forEach((a) => a.close?.()));
await fotografar("aventuras-do-playtest", "#op2-aventuras", { antes: () => game.op2.aventuras() });
await page.evaluate(() => [...foundry.applications.instances.values()].forEach((a) => a.close?.()));

await page.evaluate(() => localStorage.setItem("op2.painel.aba", "pontos"));
await fotografar("painel-investigacao", "#op2-painel-investigacao", {
  antes: () => game.op2.painelInvestigacao(),
});
await page.evaluate(() => [...foundry.applications.instances.values()].forEach((a) => a.close?.()));

await fotografar("acoes-investigacao", "[id^=op2-acoes]", {
  antes: ({ alanId }) => game.op2.acoesInvestigacao(game.actors.get(alanId)),
});
await page.evaluate(() => [...foundry.applications.instances.values()].forEach((a) => a.close?.()));

await fotografar("ficha-poi", ".op2-ficha--poi", {
  antes: async ({ poiUuid }) => (await fromUuid(poiUuid)).sheet.render(true),
});
await page.evaluate(() => [...foundry.applications.instances.values()].forEach((a) => a.close?.()));

await fotografar("ficha-desafio", ".op2-ficha--desafio", {
  antes: async ({ desafioUuid }) => (await fromUuid(desafioUuid)).sheet.render(true),
});
await page.evaluate(() => [...foundry.applications.instances.values()].forEach((a) => a.close?.()));

await fotografar("dialogo-teste", "#op2-pericia-dialog", {
  antes: async ({ alanId }) => {
    const { escolherPericia } = await import("/systems/ordem-paranormal-2e/module/dice/pericia-dialog.mjs");
    escolherPericia(game.actors.get(alanId), { titulo: "Examinar — Estante de Livros", mostrarAtributo: true });
  },
});
await page.evaluate(() => [...foundry.applications.instances.values()].forEach((a) => a.close?.()));

// A sidebar do headless nasce recolhida (log com altura 0) e o popout do chat não
// abre sem canvas. Os cards são HTML puro: renderizar o conteúdo da mensagem numa
// página em branco com o CSS do sistema dá o mesmo pixel, sem depender da sidebar.
const cardsHtml = await page.evaluate(async ({ alanId }) => {
  const alan = game.actors.get(alanId);
  const alvo = game.actors.find((a) => a.type === "npc");
  await game.op2.atacar(alan, { alvoUuid: alvo.uuid, armado: false, rapido: true });
  await new Promise((r) => setTimeout(r, 800));

  const doTipo = (tipo) => game.messages.contents
    .filter((m) => m.getFlag("ordem-paranormal-2e", "tipo") === tipo).at(-1)?.content ?? null;
  return { examinar: doTipo("investigacao"), ataque: doTipo("ataque") };
}, dados);

const css = await page.evaluate(async () => {
  const resposta = await fetch("/systems/ordem-paranormal-2e/styles/op2.css");
  return resposta.text();
});

const folha = await browser.newPage({ viewport: { width: 460, height: 700 }, deviceScaleFactor: 2 });
for (const [nome, html] of Object.entries(cardsHtml)) {
  if (!html) { console.log(`(sem card) ${nome}`); continue; }
  await folha.setContent(`
    <style>${css}</style>
    <body class="op2 theme-dark" style="margin:0;padding:16px;background:#0d0908">
      <div style="max-width:400px">${html}</div>
    </body>`);
  await folha.waitForTimeout(400);
  const el = await folha.$(".op2-card");
  if (!el) { console.log(`(sem .op2-card) ${nome}`); continue; }
  await el.screenshot({ path: `${SAIDA}/card-${nome}.png` });
  console.log(`${SAIDA}/card-${nome}.png`);
}

await browser.close();
