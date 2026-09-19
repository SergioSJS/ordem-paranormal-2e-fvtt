/**
 * Dois clientes: o que o JOGADOR vê. O e2e () roda inteiro como mestre; aqui
 * um mestre prepara o mundo (Ato II importado, Amanda de um jogador de verdade) e um
 * jogador age — ferramentas, painel, áudio, hack travado, revelação pelo mestre — e o que
 * chega a cada lado é conferido dos dois lados. Roda contra o mesmo Foundry descartável,
 * depois de uma rodada do e2e (que deixa os atos no compêndio do mundo):
 *
 *   node scripts/e2e/dois-clientes.mjs            # porta 30099
 *   FOTO=/tmp/jogador.png node scripts/e2e/dois-clientes.mjs
 *
 * Achados que só apareceram aqui: nenhum de código — mas dois do próprio teste, que
 * valem como aviso a quem mexer: o Foundry entrega TODA mensagem a todos os clientes e
 * esconde pelo `ChatMessage#visible` (um sussurro "só do mestre" está em
 * `game.messages` do jogador; o que conta é `visible` e o log); e um stub de
 * `AudioHelper.play` no jogador engole a difusão para a mesa — embrulhe o original.
 */
import { chromium } from "playwright";
const PORTA = process.env.PORTA_FVTT ?? 30099;
const browser = await chromium.launch();
const ok = (n, c) => { if (!c) globalThis.__falhas = (globalThis.__falhas ?? 0) + 1; console.log((c ? "ok    " : "FALHA ") + n); };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function entrar(label) {
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  page.on("pageerror", (e) => { const t = String(e); if (!/namespaced under/.test(t)) console.log("[erro página]", t.slice(0, 200)); });
  await page.goto(`http://localhost:${PORTA}/join`, { waitUntil: "networkidle" });
  await page.evaluate(() => { for (const o of document.querySelectorAll("select[name='userid'] option")) o.disabled = false; });
  await page.selectOption("select[name='userid']", { label });
  await page.click("button[name='join'], button[type='submit']");
  await page.waitForURL("**/game");
  await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 90000 });
  await page.waitForTimeout(1200);
  return page;
}
const gm = await entrar("Gamemaster");
await gm.evaluate(async () => {
  let user = game.users.find((u) => u.name === "Jogador E2E");
  if (!user) user = await User.create({ name: "Jogador E2E", role: CONST.USER_ROLES.PLAYER });
  const pack = game.packs.get("world.op2-aventuras");
  for (const adv of await pack.getDocuments()) if (adv.name.startsWith("Ato II")) await adv.import({ dialog: false });
  await new Promise((r) => setTimeout(r, 1500));
  const amanda = game.actors.find((a) => a.type === "personagem" && a.name === "Amanda");
  await amanda.update({ ownership: { ...amanda.ownership, [user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER } });
  await user.update({ character: amanda.id });
  for (const sub of ["emf", "termometro", "laboratorio", "infravermelho"]) {
    if (!amanda.items.some((i) => i.type === "ferramenta" && i.system.subtipo === sub)) await amanda.createEmbeddedDocuments("Item", [{ name: sub, type: "ferramenta", system: { subtipo: sub } }]);
  }
  await amanda.update({ "system.estado.ferramentasReveladas": [], "system.estado.infosReveladas": [] });
  const inv = game.actors.find((a) => a.type === "investigacao" && a.name.includes("Ato II"));
  const { alternarAtiva } = await import("/systems/ordem-paranormal-2e/module/cena/investigacao-ativa.mjs");
  if (!game.settings.get("ordem-paranormal-2e", "investigacoesAtivasUuids").includes(inv.uuid)) await alternarAtiva(inv);
  await game.op2.definirInvestigacaoAtiva(inv.uuid);
  const idolo = game.items.find((i) => i.type === "ponto-interesse" && i.name === "O Ídolo de Pedra");
  if (inv.system.poisOcultos.includes(idolo.uuid)) await game.op2.alternarOculto(inv, "pois", idolo.uuid);
  const painel = game.items.find((i) => i.type === "desafio-acesso" && i.name.includes("Painel Confuso"));
  if (inv.system.desafiosOcultos.includes(painel.uuid)) await game.op2.alternarOculto(inv, "desafios", painel.uuid);
  await painel.update({ "system.hackTecnico.ultimaTentativaRodada": -1, "system.hackTecnico.resolvido": false });
  await game.settings.set("ordem-paranormal-2e", "revelacaoPeloMestre", false);
});
const jog = await entrar("Jogador E2E");
await jog.evaluate(async () => {
  const inv = game.actors.find((a) => a.type === "investigacao" && a.name.includes("Ato II"));
  await game.op2.definirInvestigacaoAtiva(inv.uuid);
});
// O mestre só registra o que recebe; o jogador registra E difunde de verdade (sem tocar localmente).
await gm.evaluate(() => { window.__tocados = []; foundry.audio.AudioHelper.play = (d, s) => { window.__tocados.push({ src: d.src, s }); return Promise.resolve(null); }; });
await jog.evaluate(() => { window.__tocados = []; const orig = foundry.audio.AudioHelper.play.bind(foundry.audio.AudioHelper); foundry.audio.AudioHelper.play = (d, s) => { window.__tocados.push({ src: d.src, s }); return orig({ ...d, autoplay: false }, s); }; });

// 1. jogador usa EMF (pelo botão) e termômetro no Ídolo
const r1 = await jog.evaluate(async () => {
  const ator = game.user.character;
  const idolo = game.items.find((i) => i.type === "ponto-interesse" && i.name === "O Ídolo de Pedra");
  const antes = game.messages.size;
  game.op2.acoesInvestigacao(ator);
  await new Promise((r) => setTimeout(r, 900));
  const el = document.getElementById(`op2-acoes-${ator.id}`);
  el.querySelector("[data-action='tab'][data-tab='pontos']")?.click();
  await new Promise((r) => setTimeout(r, 300));
  const botaoEmf = el.querySelector(`[data-action="usarFerramenta"][data-ferramenta="emf"][data-poi-uuid="${idolo.uuid}"]`);
  botaoEmf?.click();
  await new Promise((r) => setTimeout(r, 1200));
  const r = await game.op2.usarFerramenta(ator, idolo.uuid, "termometro");
  await new Promise((r) => setTimeout(r, 1200));
  const txt = (m) => new DOMParser().parseFromString(m.content, "text/html").body.textContent.replace(/\s+/g, " ");
  return {
    temBotaoEmf: Boolean(botaoEmf),
    cards: game.messages.contents.slice(antes).filter((m) => m.visible).map((m) => ({ soMestre: Boolean(m.getFlag("ordem-paranormal-2e", "soMestre")), texto: txt(m).slice(0, 160) })),
    invisiveis: game.messages.contents.slice(antes).filter((m) => !m.visible).length,
    noLog: [...document.querySelectorAll("#chat .chat-message, #chat-log .chat-message")].slice(-6).map((li) => li.textContent.replace(/\s+/g, " ").slice(0, 80)),
    gravou: [...ator.system.estado.ferramentasReveladas], termometro: r,
  };
});
console.log(JSON.stringify(r1));
ok("jogador: botão do EMF no ponto, card com o link de ouvir e sem a instrução do mestre", r1.temBotaoEmf && r1.cards.some((c) => /Ouvir o Medidor EMF/.test(c.texto)) && !r1.cards.some((c) => /Envie ou toque|1 - 1 - 3/i.test(c.texto)));
ok("jogador: nenhum card só-do-mestre é visível para o jogador (nem no log)", !r1.cards.some((c) => c.soMestre) && r1.invisiveis >= 2 && !r1.noLog.some((t) => /Só você vê/.test(t)));
ok("jogador: termômetro sem o parêntese do mestre", r1.cards.some((c) => /leituras quentes/.test(c.texto)) && !r1.cards.some((c) => /jogador precisa descrever/.test(c.texto)));
ok("jogador: leituras gravadas no personagem dele", r1.gravou.some((k) => k.endsWith(":emf")) && r1.gravou.some((k) => k.endsWith(":termometro")));
const rgm = await gm.evaluate(() => {
  const txt = (m) => new DOMParser().parseFromString(m.content, "text/html").body.textContent.replace(/\s+/g, " ");
  return game.messages.contents.slice(-6).map((m) => ({ soMestre: Boolean(m.getFlag("ordem-paranormal-2e", "soMestre")), texto: txt(m).slice(0, 200) }));
});
ok("mestre: recebeu o card só dele com a instrução do EMF e o parêntese do termômetro",
  rgm.some((c) => c.soMestre && /Envie ou toque/.test(c.texto)) && rgm.some((c) => c.soMestre && /jogador precisa descrever/.test(c.texto)));

// 2. painel do jogador
const r2 = await jog.evaluate(async () => {
  const app = await game.op2.painelInvestigacao();
  await new Promise((r) => setTimeout(r, 1500));
  const el = app?.element ?? document.getElementById("op2-painel-investigacao");
  el.querySelector("[data-action='tab'][data-tab='pontos']")?.click();
  await new Promise((r) => setTimeout(r, 400));
  const card = [...el.querySelectorAll(".op2-poi-card")].find((c) => c.textContent.includes("Ídolo de Pedra"));
  const setor = card?.querySelector(".op2-poi-card__ferramentas");
  const leituras = [...(setor?.querySelectorAll(".op2-poi-card__leitura") ?? [])].map((li) => li.textContent.replace(/\s+/g, " ").trim().slice(0, 120));
  return { temCard: Boolean(card), leituras, temOlho: Boolean(setor?.querySelector("[data-action='alternarFerramentaOculta']")), temLimpar: Boolean(setor?.querySelector("[data-action='limparLeitura']")), temAudio: Boolean(setor?.querySelector("[data-op2-audio]")), textoCard: card?.textContent.replace(/\s+/g, " ") ?? "" };
});
console.log(JSON.stringify({ leituras: r2.leituras, olho: r2.temOlho, limpar: r2.temLimpar, audio: r2.temAudio }));
ok("painel do jogador: só as duas leituras que ele fez, sem o Laboratório em rascunho nem as outras", r2.temCard && r2.leituras.length === 2 && !r2.leituras.some((l) => /Laborat/.test(l)));
ok("painel do jogador: sem olho, sem limpar, com o link de áudio", !r2.temOlho && !r2.temLimpar && r2.temAudio);
ok("painel do jogador: nada de DT nem instrução de mestre no card", !/DT \d/.test(r2.textoCard) && !/Envie ou toque|jogador precisa/.test(r2.textoCard));

// 3. áudio pelo painel do jogador
const r3 = await jog.evaluate(async () => {
  const el = document.getElementById("op2-painel-investigacao");
  const links = [...el.querySelectorAll(".op2-poi-card__ferramentas [data-op2-audio]")];
  links[0]?.click(); await new Promise((r) => setTimeout(r, 200));
  links[1]?.click(); await new Promise((r) => setTimeout(r, 800));
  return { n: links.length, tocados: window.__tocados };
});
await esperar(800);
const r3gm = await gm.evaluate(() => window.__tocados);
console.log("jogador tocou:", JSON.stringify(r3), "| mestre recebeu:", JSON.stringify(r3gm));
ok("áudio: 'ouvir' fica no jogador; 'tocar para a mesa' chega ao mestre", r3.tocados.length === 2 && r3.tocados[0].s === false && r3.tocados[1].s === true && r3gm.length === 1);

// 4. hack travado, do lado do jogador
const r4 = await jog.evaluate(async () => {
  const ator = game.user.character;
  const painel = game.items.find((i) => i.type === "desafio-acesso" && i.name.includes("Painel Confuso"));
  const avisos = [];
  const orig = ui.notifications.warn.bind(ui.notifications);
  ui.notifications.warn = (m, o) => { avisos.push(String(m)); return orig(m, o); };
  const primeira = await game.op2.hackTecnico(ator, painel.uuid, { rapido: true });
  await new Promise((r) => setTimeout(r, 800));
  const segunda = await game.op2.hackTecnico(ator, painel.uuid, { rapido: true });
  game.op2.acoesInvestigacao(ator);
  await new Promise((r) => setTimeout(r, 900));
  const el = document.getElementById(`op2-acoes-${ator.id}`);
  el.querySelector("[data-action='tab'][data-tab='desafios']")?.click();
  await new Promise((r) => setTimeout(r, 300));
  const botao = el.querySelector(`[data-action="hackTecnico"][data-desafio-uuid="${painel.uuid}"]`);
  ui.notifications.warn = orig;
  return { primeira: Boolean(primeira), segunda, avisos, botao: botao?.textContent.replace(/\s+/g, " ").trim() };
});
console.log(JSON.stringify(r4));
ok("hack: primeira tentativa do jogador roda; a segunda na mesma rodada é barrada com o aviso que diz a saída", r4.primeira && r4.segunda === null && r4.avisos.some((a) => /libera a tentativa na ficha do desafio/.test(a)));
ok("hack: o botão do jogador mostra 'nesta rodada' antes do clique", /nesta rodada/.test(r4.botao ?? ""));

// 5. mestre libera na ficha
await gm.evaluate(async () => {
  const painel = game.items.find((i) => i.type === "desafio-acesso" && i.name.includes("Painel Confuso"));
  await painel.sheet.render(true); await new Promise((r) => setTimeout(r, 900));
  painel.sheet.element.querySelector("[data-action='liberarHack'][data-hack='hackTecnico']")?.click();
  await new Promise((r) => setTimeout(r, 600));
  await painel.sheet.close();
});
await esperar(800);
const r5 = await jog.evaluate(async () => {
  const painel = game.items.find((i) => i.type === "desafio-acesso" && i.name.includes("Painel Confuso"));
  return { ultima: painel.system.hackTecnico.ultimaTentativaRodada, denovo: Boolean(await game.op2.hackTecnico(game.user.character, painel.uuid, { rapido: true })) };
});
ok("hack: 'Liberar tentativa' do mestre chega ao jogador e ele tenta de novo", r5.ultima === -1 && r5.denovo);

// 6. revelação pelo mestre, vista do jogador
await gm.evaluate(() => game.settings.set("ordem-paranormal-2e", "revelacaoPeloMestre", true));
await esperar(800);
const r6 = await jog.evaluate(async () => {
  const ator = game.user.character;
  const idolo = game.items.find((i) => i.type === "ponto-interesse" && i.name === "O Ídolo de Pedra");
  const antes = game.messages.size;
  const ex = await game.op2.examinar(ator, idolo.uuid, "percepcao", { rapido: true });
  await game.op2.usarFerramenta(ator, idolo.uuid, "infravermelho");
  await new Promise((r) => setTimeout(r, 1500));
  const txt = (m) => new DOMParser().parseFromString(m.content, "text/html").body.textContent.replace(/\s+/g, " ");
  return { aguarda: ex?.aguardaMestre, perdePD: ex?.perdePD, novos: game.messages.contents.slice(antes).filter((m) => m.visible).map((m) => ({ soMestre: Boolean(m.getFlag("ordem-paranormal-2e", "soMestre")), texto: txt(m).slice(0, 160), botao: /entregar-/.test(m.content) })), ferr: [...ator.system.estado.ferramentasReveladas] };
});
console.log(JSON.stringify(r6));
ok("gate: o jogador vê só 'o mestre recebeu', nenhum botão de entregar, nada gravado", r6.novos.some((n) => /mestre recebeu/.test(n.texto)) && !r6.novos.some((n) => n.botao || n.soMestre) && !r6.ferr.some((k) => k.endsWith(":infravermelho")));
const r6gm = await gm.evaluate(async () => {
  const cards = game.messages.contents.slice(-6).filter((m) => /entregar-(revelacao|leitura)/.test(m.content));
  const ator = game.actors.find((a) => a.name === "Amanda");
  for (const m of cards) {
    const b = new DOMParser().parseFromString(m.content, "text/html").querySelector("[data-op2-acao^='entregar-']");
    if (b.dataset.op2Acao === "entregar-leitura") await game.op2.entregarLeituraDoMestre(ator, { ...b.dataset });
    else await game.op2.entregarRevelacao(ator, { ...b.dataset });
  }
  await new Promise((r) => setTimeout(r, 800));
  return cards.length;
});
await esperar(1000);
const r6b = await jog.evaluate(() => {
  const txt = (m) => new DOMParser().parseFromString(m.content, "text/html").body.textContent.replace(/\s+/g, " ");
  return { ferr: [...game.user.character.system.estado.ferramentasReveladas], ultimos: game.messages.contents.filter((m) => m.visible).slice(-3).map((m) => txt(m).slice(0, 120)) };
});
console.log(JSON.stringify({ cardsMestre: r6gm, r6b }));
ok("gate: depois de o mestre entregar, o jogador recebe a leitura e ela fica gravada", r6gm >= 1 && r6b.ferr.some((k) => k.endsWith(":infravermelho")) && r6b.ultimos.some((t) => /fluxos quentes|coração pulsando/.test(t)));
await gm.evaluate(() => game.settings.set("ordem-paranormal-2e", "revelacaoPeloMestre", false));
if (process.env.FOTO) await jog.screenshot({ path: process.env.FOTO });
const falhas = globalThis.__falhas ?? 0;
await browser.close();
console.log(falhas ? `${falhas} verificação(ões) falharam.` : "tudo passou.");
process.exit(falhas ? 1 : 0);
