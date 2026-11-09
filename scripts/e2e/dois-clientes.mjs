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
 * Achados que só apareceram aqui: nenhum de código — mas três do próprio teste, que
 * valem como aviso a quem mexer: o mundo do e2e tem os dois atos, com pontos de mesmo nome (procure
 * pelo vínculo com a investigação, não pelo nome); o Foundry entrega TODA mensagem a todos os clientes e
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
  // `game.ready` chega antes dos partials, e no servidor recém-ligado o intervalo é longo: a janela
  // abre sem conteúdo e tudo o que vem depois falha em cascata (aconteceu na primeira rodada).
  await page.waitForFunction(() => globalThis.game?.ready === true
    && globalThis.Handlebars?.partials?.["systems/ordem-paranormal-2e/templates/partials/controle-dado.hbs"], null, { timeout: 90000 });
  await page.waitForTimeout(1200);
  return page;
}
const gm = await entrar("Gamemaster");
await gm.evaluate(async () => {
  let user = game.users.find((u) => u.name === "Jogador E2E");
  if (!user) user = await User.create({ name: "Jogador E2E", role: CONST.USER_ROLES.PLAYER });
  const pack = game.packs.get("world.op2-aventuras");
  // `adv.import()` não espera os extras: reimportar em segundo plano sobrescreve o que vem abaixo.
  const { importarAventura } = await import("/systems/ordem-paranormal-2e/module/ui/extras-aventura.mjs");
  for (const adv of await pack.getDocuments()) if (adv.name.startsWith("Ato II")) await importarAventura(adv, { dialog: false });
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
  const idolo = game.items.find((i) => i.type === "ponto-interesse" && i.name === "O Ídolo de Pedra" && game.actors.find((a) => a.type === "investigacao" && a.name.includes("Ato II")).system.pois.includes(i.uuid));
  if (inv.system.poisOcultos.includes(idolo.uuid)) await game.op2.alternarOculto(inv, "pois", idolo.uuid);
  const painel = game.items.find((i) => i.type === "desafio-acesso" && i.name.includes("Painel Confuso") && game.actors.find((d) => d.type === "investigacao" && d.name.includes("Ato II")).system.desafios.includes(i.uuid));
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
  const idolo = game.items.find((i) => i.type === "ponto-interesse" && i.name === "O Ídolo de Pedra" && game.actors.find((a) => a.type === "investigacao" && a.name.includes("Ato II")).system.pois.includes(i.uuid));
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
  const painel = game.items.find((i) => i.type === "desafio-acesso" && i.name.includes("Painel Confuso") && game.actors.find((d) => d.type === "investigacao" && d.name.includes("Ato II")).system.desafios.includes(i.uuid));
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
  const painel = game.items.find((i) => i.type === "desafio-acesso" && i.name.includes("Painel Confuso") && game.actors.find((d) => d.type === "investigacao" && d.name.includes("Ato II")).system.desafios.includes(i.uuid));
  await painel.sheet.render(true); await new Promise((r) => setTimeout(r, 900));
  painel.sheet.element.querySelector("[data-action='liberarHack'][data-hack='hackTecnico']")?.click();
  await new Promise((r) => setTimeout(r, 600));
  await painel.sheet.close();
});
await esperar(800);
const r5 = await jog.evaluate(async () => {
  const painel = game.items.find((i) => i.type === "desafio-acesso" && i.name.includes("Painel Confuso") && game.actors.find((d) => d.type === "investigacao" && d.name.includes("Ato II")).system.desafios.includes(i.uuid));
  return { ultima: painel.system.hackTecnico.ultimaTentativaRodada, denovo: Boolean(await game.op2.hackTecnico(game.user.character, painel.uuid, { rapido: true })) };
});
ok("hack: 'Liberar tentativa' do mestre chega ao jogador e ele tenta de novo", r5.ultima === -1 && r5.denovo);

// 6. revelação pelo mestre, vista do jogador
await gm.evaluate(() => game.settings.set("ordem-paranormal-2e", "revelacaoPeloMestre", true));
await esperar(800);
const r6 = await jog.evaluate(async () => {
  const ator = game.user.character;
  const idolo = game.items.find((i) => i.type === "ponto-interesse" && i.name === "O Ídolo de Pedra" && game.actors.find((a) => a.type === "investigacao" && a.name.includes("Ato II")).system.pois.includes(i.uuid));
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

// O beta, do lado do jogador: quem não é dono de NPC nem da cena tem de conseguir jogar.
// Precisa de uma rodada do e2e antes, que deixa as missões no compêndio do mundo.
await gm.evaluate(() => game.settings.set("ordem-paranormal-2e", "modo", "vigilia"));
for (const pagina of [gm, jog]) {
  await pagina.reload({ waitUntil: "networkidle" });
  await pagina.waitForFunction(() => globalThis.game?.ready === true && globalThis.Handlebars?.partials?.["systems/ordem-paranormal-2e/templates/partials/controle-dado.hbs"], null, { timeout: 90000 });
  await pagina.waitForTimeout(1200);
}
const temMissao = await gm.evaluate(async () => {
  if (!game.actors.getName("Cena 1: Os Afogados")) return false; // o e2e deixa importada
  const user = game.users.find((u) => u.name === "Jogador E2E");
  // A cópia da Missão 1: cada missão traz a sua, e a cena de ação nasce vazia.
  const daM1 = game.folders.find((f) => f.type === "Actor" && f.name === "Pré-gerados" && f.folder?.name.startsWith("Missão 1"))?.contents ?? [];
  const rhiona = daM1.find((a) => a.name.startsWith("Rhiona"));
  await rhiona.update({ ownership: { ...rhiona.ownership, [user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER } });
  await user.update({ character: rhiona.id });
  const cena = game.actors.getName("Cena 1: Os Afogados");
  await game.scenes.getName("A Ilhota").view();
  await new Promise((r) => setTimeout(r, 2000));
  await game.op2.porNaCena(cena, daM1.map((a) => a.uuid));
  await game.op2.iniciarCena(cena);
  await game.op2.adicionarCriaturas(cena, cena.system.criaturas[0], 1);
  await new Promise((r) => setTimeout(r, 1000));
  await game.op2.avancarCena(cena);
  await game.op2.avancarCena(cena);
  return true;
});
ok("beta: as missões estão no compêndio do mundo", temMissao);
if (temMissao) {
  await esperar(1500);
  const r7 = await jog.evaluate(async () => {
    const fx = game.op2.vigilia;
    const cena = game.op2.cenaAcaoAtiva();
    const eu = game.user.character;
    const painel = game.op2.painelAcao(cena);
    await new Promise((r) => setTimeout(r, 1500));
    const el = painel.element;
    const linhas = [...el.querySelectorAll(".op2-linha-acao")];
    const minhaLinha = linhas.find((l) => l.dataset.ator === eu.uuid);
    const outraLinha = linhas.find((l) => l.dataset.ator !== eu.uuid);
    const npcUuid = cena.system.participantes.findLast((u) => fromUuidSync(u)?.type === "npc");
    const npc = fromUuidSync(npcUuid);
    const dados = {
      veLinhas: linhas.length,
      temMeusBotoes: minhaLinha?.querySelectorAll('[data-action="agir"]').length > 0,
      semBotoesDosOutros: outraLinha?.querySelectorAll('[data-action="agir"]').length === 0,
      semMestre: !el.querySelector(".op2-painel-acao__mestre"),
      semEditarOutro: !outraLinha?.querySelector("input[data-campo]"),
      pvVisivel: npc?.system.recursos.pv.value,
      numerosDoNpc: /PV \d/.test(linhas.find((l) => l.dataset.ator === npcUuid)?.querySelector(".op2-linha-acao__recursos")?.textContent ?? ""),
      efeitoVisivel: game.messages.contents.filter((m) => m.visible).some((m) => /sofrem .* dano emocional/i.test(m.content)),
    };
    // O botão de reagir do NPC é do mestre: o clique do jogador avisa e não rola.
    const antesDoClique = game.messages.size;
    const avisos = [];
    const aviso = ui.notifications.warn.bind(ui.notifications);
    ui.notifications.warn = (t, o) => { avisos.push(t); return aviso(t, o); };
    const card = await ChatMessage.create({ content: `<div class="op2-card"><button data-op2-acao="vigilia-revidar" data-ator-uuid="${npcUuid}" data-atacante-uuid="${eu.uuid}" data-total="9" data-ra="5" data-segunda="4" data-critico="0" data-bonus-dano="0">r</button></div>`, flags: { "ordem-paranormal-2e": { tipo: "vigilia" } } });
    await new Promise((r) => setTimeout(r, 500));
    document.querySelector(`[data-message-id="${card.id}"] [data-op2-acao="vigilia-revidar"]`)?.click();
    await new Promise((r) => setTimeout(r, 600));
    ui.notifications.warn = aviso;
    dados.guardaDeDono = avisos.some((t) => /joga com/.test(t)) && game.messages.size === antesDoClique + 1;
    // Age: ataque contra quem não é dele.
    const martelo = fx.ataquesDe(eu).find((a) => a.tipo === "corpo");
    const golpe = await fx.atacar(eu, martelo, { cena, rapido: true, escolha: { alvo: npcUuid } });
    await new Promise((r) => setTimeout(r, 900));
    dados.agiu = cena.system.agiram.some((a) => a.ator === eu.uuid);
    await fx.aplicarDanoDeCombate(npc, { quantidade: 4 });
    await new Promise((r) => setTimeout(r, 900));
    dados.pvDepois = npc.system.recursos.pv.value;
    dados.golpe = Boolean(golpe);
    // Edita o que é dele.
    painel.element.querySelector(`[data-action="alternarAgiu"][data-ator="${eu.uuid}"]`)?.click();
    await new Promise((r) => setTimeout(r, 800));
    dados.desmarcou = !cena.system.agiram.some((a) => a.ator === eu.uuid);
    const campo = painel.element.querySelector(`input[data-campo="system.recursos.pd.value"][data-ator="${eu.uuid}"]`);
    campo.value = "11";
    campo.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 700));
    dados.pdEditado = eu.system.recursos.pd.value;
    await painel.close();
    return dados;
  });
  console.log(JSON.stringify(r7));
  ok("beta: o jogador vê todas as linhas, com botões só na dele e sem controles de mestre",
    r7.veLinhas >= 7 && r7.temMeusBotoes && r7.semBotoesDosOutros && r7.semMestre && r7.semEditarOutro);
  ok("beta: o ataque do jogador marca que ele agiu, pela ponte do mestre", r7.golpe && r7.agiu);
  ok("beta: o jogador não vê PV nem PD da criatura", !r7.numerosDoNpc);
  ok("beta: o efeito da rodada não aparece para o jogador", !r7.efeitoVisivel);
  ok("beta: reagir pelo NPC é só do mestre: o clique avisa e não rola", r7.guardaDeDono);
  ok("beta: dano do jogador em NPC passa pelo mestre", r7.pvDepois === Math.max(0, r7.pvVisivel - 4));
  ok("beta: o jogador edita o próprio PD", r7.pdEditado === 11);
  ok("beta: o jogador desmarca o próprio 'já agiu', pela ponte do mestre", r7.desmarcou);

  const r8 = await gm.evaluate(async () => {
    const cena = game.op2.cenaAcaoAtiva();
    const antes = cena.system.fase;
    await game.op2.encerrarCenaAcao(cena);
    const mata = await Actor.create({ name: "Dois Clientes Mata", type: "cena-acao", system: {
      tipo: "furtividade", participantes: cena.system.participantes.filter((u) => fromUuidSync(u)?.type === "personagem").slice(0, 3),
      furtividade: { areas: [{ nome: "Área", avancos: 2, acoes: [] }], tabela: [{ valor: 3, tipo: "procura", formula: "1d1" }] },
    } });
    await game.op2.iniciarCena(mata);
    await new Promise((r) => setTimeout(r, 600));
    return { antes, participantes: mata.system.participantes };
  });
  await esperar(1000);
  const r9 = await jog.evaluate(async (participantes) => {
    const fx = game.op2.vigilia;
    const cena = game.op2.cenaAcaoAtiva();
    const eu = game.user.character;
    const aliado = participantes.map((u) => fromUuidSync(u)).find((a) => a.uuid !== eu.uuid);
    await fx.testeDeEsconderijo(eu, { rapido: true });
    const antes = aliado.system.estado.furtividade.esconderijo.length;
    await fx.chamarAtencaoPara(eu, aliado, cena);
    await new Promise((r) => setTimeout(r, 900));
    const depois = aliado.system.estado.furtividade.esconderijo.length;
    await fx.distrair(eu, cena, { rapido: true });
    await new Promise((r) => setTimeout(r, 900));
    await eu.update({ "system.estado.furtividade.esconderijo": [{ dado: "d6", valor: 1 }] });
    await new Promise((r) => setTimeout(r, 300));
    await fx.descartarIguais(eu, { alvos: [eu.uuid, aliado.uuid].join(","), valores: "1" });
    await new Promise((r) => setTimeout(r, 900));
    return { antes, depois, usos: cena.system.usosDistrair, restou: eu.system.estado.furtividade.esconderijo.length };
  }, r8.participantes);
  console.log(JSON.stringify(r9));
  ok("beta: chamar atenção dá o dado ao aliado, que não é do jogador", r9.depois === r9.antes + 1);
  ok("beta: distrair escala para o grupo, pela ponte do mestre", r9.usos === 1);
  ok("beta: o botão de descartar funciona no cliente do jogador", r9.restou === 0);
  await gm.evaluate(async () => {
    const mata = game.actors.getName("Dois Clientes Mata");
    await game.op2.encerrarCenaAcao(mata);
    await mata.delete();
    await game.settings.set("ordem-paranormal-2e", "modo", "moderno");
  });
}

// Modo transmissão: o jogador abre a tela do OBS; só o que ele poderia ver aparece.
await jog.goto(`http://localhost:${PORTA}/game?op2-transmissao`, { waitUntil: "networkidle" });
await jog.waitForFunction(() => globalThis.game?.ready === true && document.querySelector("#op2-transmissao .op2-transmissao__card"), null, { timeout: 60000 });
const tx1 = await jog.evaluate(() => {
  const meu = game.user.character;
  const card = document.querySelector(`#op2-transmissao [data-ator-id="${meu?.id}"]`);
  return {
    id: meu?.id, modo: document.body.classList.contains("op2-transmissao-modo"), temCard: Boolean(card),
    nome: card?.querySelector(".op2-transmissao__nome")?.textContent ?? "",
    jogador: card?.querySelector(".op2-transmissao__jogador")?.textContent ?? "",
    pv: card?.querySelector(".op2-transmissao__recurso--pv .op2-transmissao__numero")?.textContent ?? "",
    interfaceEscondida: getComputedStyle(document.getElementById("interface") ?? document.body).visibility === "hidden",
  };
});
console.log(JSON.stringify(tx1));
ok("transmissão: a tela vira só os cards, sem a interface do Foundry", tx1.modo && tx1.interfaceEscondida);
ok("transmissão: o card traz o personagem, quem joga e os PV", tx1.temCard && tx1.nome.length > 0 && /Jogador E2E/.test(tx1.jogador) && /\d+\/\d+/.test(tx1.pv));
await gm.evaluate(async (id) => {
  const ator = game.actors.get(id);
  const falar = ChatMessage.getSpeaker({ actor: ator });
  // Sussurro ao mestre e rolagem cega: a transmissão não pode mostrar nenhum dos dois.
  for (const extra of [{ whisper: [game.user.id] }, { whisper: [game.user.id], blind: true }]) {
    const roll = await new Roll("2d6").evaluate();
    await ChatMessage.create({ speaker: falar, rolls: [roll], content: "segredo", ...extra });
  }
}, tx1.id);
await new Promise((r) => setTimeout(r, 1500));
const tx2 = await jog.evaluate((id) => ({
  acendeu: Boolean(document.querySelector(`#op2-transmissao [data-ator-id="${id}"].op2-transmissao__card--rolou`)),
  // O sussurro chega ao cliente (o core mostra que houve uma rolagem secreta): o teste é real.
  chegou: game.messages.contents.some((m) => m.whisper.length && m.rolls.length && !m.isContentVisible),
}), tx1.id);
ok("transmissão: sussurro e rolagem cega chegam ao cliente e não aparecem", tx2.chegou && !tx2.acendeu);
await gm.evaluate(async (id) => { await game.op2.rolarTeste(game.actors.get(id), { chavePericia: "percepcao", rapido: true, dt: 7 }); }, tx1.id);
await new Promise((r) => setTimeout(r, 1500));
const tx3 = await jog.evaluate((id) => {
  const card = document.querySelector(`#op2-transmissao [data-ator-id="${id}"]`);
  return {
    acendeu: card?.classList.contains("op2-transmissao__card--rolou"),
    dados: card?.querySelectorAll(".op2-transmissao__rolagem .op2-dado").length ?? 0,
    total: card?.querySelector(".op2-transmissao__total")?.textContent ?? "",
    titulo: card?.querySelector(".op2-transmissao__rolagem-titulo")?.textContent ?? "",
    ra: card?.querySelectorAll(".op2-transmissao__dado--ra").length ?? 0,
    rb: card?.querySelectorAll(".op2-transmissao__dado--rb").length ?? 0,
    corRa: getComputedStyle(card?.querySelector(".op2-transmissao__dado--ra .op2-dado") ?? document.body).backgroundColor,
    corRb: getComputedStyle(card?.querySelector(".op2-transmissao__dado--rb .op2-dado") ?? document.body).backgroundColor,
    etiquetas: [...(card?.querySelectorAll(".op2-transmissao__dado small") ?? [])].map((s) => s.textContent).join(" "),
    // A rolagem fica NA FRENTE das informações: a camada cobre o nome e os PV, que somem por baixo.
    infoSome: getComputedStyle(card?.querySelector(".op2-transmissao__dados") ?? document.body).opacity === "0",
    naFrente: (() => {
      const vaga = card?.querySelector(".op2-transmissao__vaga")?.getBoundingClientRect();
      const nome = card?.querySelector(".op2-transmissao__nome")?.getBoundingClientRect();
      return Boolean(vaga && nome && vaga.top <= nome.top && vaga.bottom >= nome.bottom && vaga.left <= nome.left);
    })(),
  };
}, tx1.id);
console.log(JSON.stringify(tx3));
ok("transmissão: a rolagem pública acende o card, com os dados desenhados e o total", tx3.acendeu && tx3.dados >= 2 && /^\s*\d+\s*$/.test(tx3.total) && tx3.titulo.length > 0);
ok("transmissão: a RA sai em vermelho e a RB em azul, um dado cada, com a etiqueta embaixo",
  tx3.ra === 1 && tx3.rb === 1 && tx3.corRa !== tx3.corRb && /RA/.test(tx3.etiquetas) && /RB/.test(tx3.etiquetas));
ok("transmissão: a rolagem entra na frente do nome e dos PV, sem mudar o card", tx3.naFrente && tx3.infoSome);
if (process.env.FOTO_ROLAGEM) {
  const caixa = await (await jog.$("#op2-transmissao"))?.boundingBox();
  if (caixa) await jog.screenshot({ path: process.env.FOTO_ROLAGEM, clip: { x: Math.max(0, caixa.x - 12), y: Math.max(0, caixa.y - 12), width: caixa.width + 24, height: caixa.height + 24 } });
}
// Estilo sem fundo pela URL: avatar solto, PV e PD em texto, sem barra.
await jog.goto(`http://localhost:${PORTA}/game?op2-transmissao=livre`, { waitUntil: "networkidle" });
await jog.waitForFunction(() => globalThis.game?.ready === true && document.querySelector("#op2-transmissao .op2-transmissao__card"), null, { timeout: 60000 });
await jog.waitForTimeout(500);
const tx4 = await jog.evaluate((id) => {
  const el = document.getElementById("op2-transmissao");
  const card = el?.querySelector(`[data-ator-id="${id}"]`);
  return {
    estilo: el?.dataset.estilo, barras: card?.querySelectorAll(".op2-transmissao__barra").length ?? -1,
    texto: card?.querySelector(".op2-transmissao__recurso--pv")?.textContent.replace(/\s+/g, " ").trim() ?? "",
    fundo: card ? getComputedStyle(card).backgroundColor : "",
  };
}, tx1.id);
console.log(JSON.stringify(tx4));
ok("transmissão sem fundo pela URL: PV em texto, sem barra, card transparente",
  tx4.estilo === "livre" && tx4.barras === 0 && /PV \d+\/\d+/.test(tx4.texto) && /rgba\(0, 0, 0, 0\)|transparent/.test(tx4.fundo));
if (process.env.FOTO_TRANSMISSAO_LIVRE) {
  await gm.evaluate(async (id) => { await game.op2.rolarTeste(game.actors.get(id), { chavePericia: "percepcao", rapido: true, dt: 7 }); }, tx1.id);
  await jog.waitForTimeout(1500);
  const caixa = await (await jog.$("#op2-transmissao"))?.boundingBox();
  if (caixa) await jog.screenshot({ path: process.env.FOTO_TRANSMISSAO_LIVRE, clip: { x: Math.max(0, caixa.x - 12), y: Math.max(0, caixa.y - 12), width: caixa.width + 24, height: caixa.height + 24 } });
}
// Os dois estilos lado a lado: o mesmo personagem nas duas colunas, e a rolagem acende os dois.
await jog.goto(`http://localhost:${PORTA}/game?op2-transmissao=ambos`, { waitUntil: "networkidle" });
await jog.waitForFunction(() => globalThis.game?.ready === true && document.querySelector("#op2-transmissao .op2-transmissao__card"), null, { timeout: 60000 });
await gm.evaluate(async (id) => { await game.op2.rolarTeste(game.actors.get(id), { chavePericia: "percepcao", rapido: true, dt: 7 }); }, tx1.id);
await jog.waitForTimeout(1500);
const tx5 = await jog.evaluate((id) => ({
  colunas: document.querySelectorAll("#op2-transmissao .op2-transmissao__cards").length,
  livre: Boolean(document.querySelector("#op2-transmissao .op2-transmissao__cards--livre")),
  cartao: Boolean(document.querySelector("#op2-transmissao .op2-transmissao__cards--cartao")),
  acesos: document.querySelectorAll(`#op2-transmissao [data-ator-id="${id}"].op2-transmissao__card--rolou`).length,
  busto: document.querySelector("#op2-transmissao .op2-transmissao__cards--busto") !== null,
}), tx1.id);
console.log(JSON.stringify(tx5));
ok("transmissão com os dois estilos: duas colunas, avatar em busto, e a rolagem acende o card nas duas",
  tx5.colunas === 2 && tx5.livre && tx5.cartao && tx5.busto && tx5.acesos === 2);
if (process.env.FOTO_TRANSMISSAO_AMBOS) {
  const caixa = await (await jog.$("#op2-transmissao"))?.boundingBox();
  if (caixa) await jog.screenshot({ path: process.env.FOTO_TRANSMISSAO_AMBOS, clip: { x: Math.max(0, caixa.x - 12), y: Math.max(0, caixa.y - 12), width: caixa.width + 24, height: caixa.height + 24 } });
}
// Nada se move: quem monta o overlay recorta em volta dos cards uma vez. Começar a cena, mudar de
// fase, rolar, levar dano, ganhar pavor e condição não podem mexer um pixel em card nenhum (a cena
// empurrava tudo para baixo, e a rolagem esticava o card).
await jog.goto(`http://localhost:${PORTA}/game?op2-transmissao=ambos`, { waitUntil: "networkidle" });
await jog.waitForFunction(() => globalThis.game?.ready === true && document.querySelector("#op2-transmissao .op2-transmissao__card"), null, { timeout: 60000 });
await jog.waitForTimeout(800);
const caixas = () => jog.evaluate(() => [...document.querySelectorAll("#op2-transmissao, #op2-transmissao .op2-transmissao__cards, #op2-transmissao .op2-transmissao__card")]
  .map((el) => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].join(","); }).join(" | "));
const parado = await caixas();
const fixos = [];
await gm.evaluate(async (id) => {
  const ator = game.actors.get(id);
  const cena = await Actor.create({ name: "Transmissão Fixa", type: "cena-acao", system: { tipo: "combate", participantes: [ator.uuid] } });
  await game.op2.iniciarCena(cena);
}, tx1.id);
await jog.waitForTimeout(1500);
const comCena = await jog.evaluate(() => {
  const el = document.getElementById("op2-transmissao-cena");
  return { visivel: Boolean(el && !el.hidden && el.getBoundingClientRect().height > 0), texto: el?.textContent.replace(/\s+/g, " ").trim() ?? "", fora: !document.querySelector("#op2-transmissao #op2-transmissao-cena") };
});
console.log(JSON.stringify(comCena));
fixos.push(["começar a cena", await caixas()]);
await gm.evaluate(async () => { await game.op2.avancarCena(game.op2.cenaAcaoAtiva()); });
await jog.waitForTimeout(1200);
fixos.push(["mudar de fase", await caixas()]);
await gm.evaluate(async (id) => {
  const ator = game.actors.get(id);
  await ator.update({ "system.estado.pavor": "d6", "system.estado.condicoes": ["agarrado", "atordoado", "caido", "mirando", "defendendo"],
    "system.recursos.pv.value": Math.max(0, ator.system.recursos.pv.value - 1) });
}, tx1.id);
await jog.waitForTimeout(1200);
fixos.push(["pavor, condições e dano", await caixas()]);
await gm.evaluate(async (id) => { await game.op2.rolarTeste(game.actors.get(id), { chavePericia: "percepcao", rapido: true, dt: 7 }); }, tx1.id);
await jog.waitForTimeout(1500);
const acesoAgora = await jog.evaluate((id) => document.querySelectorAll(`#op2-transmissao [data-ator-id="${id}"].op2-transmissao__card--rolou .op2-transmissao__rolagem`).length, tx1.id);
fixos.push(["rolar", await caixas()]);
ok("transmissão: a cena aparece à parte, fora da coluna dos cards", comCena.visivel && comCena.fora && comCena.texto.length > 0);
for (const [quando, agora] of fixos) {
  if (agora !== parado) console.log(`  antes: ${parado}\n  depois: ${agora}`);
  ok(`transmissão: ${quando} não move nenhum card`, agora === parado);
}
ok("transmissão: a rolagem acende dentro da vaga, nas duas colunas", acesoAgora === 2);
await gm.evaluate(async (id) => {
  const cena = game.actors.getName("Transmissão Fixa");
  await game.op2.encerrarCenaAcao(cena);
  await cena.delete();
  const ator = game.actors.get(id);
  await ator.update({ "system.estado.pavor": "", "system.estado.condicoes": [], "system.recursos.pv.value": ator.system.recursos.pv.max });
}, tx1.id);
if (process.env.FOTO_TRANSMISSAO) {
  const caixa = await (await jog.$("#op2-transmissao"))?.boundingBox();
  if (caixa) await jog.screenshot({ path: process.env.FOTO_TRANSMISSAO, clip: { x: Math.max(0, caixa.x - 12), y: Math.max(0, caixa.y - 12), width: caixa.width + 24, height: caixa.height + 24 }, omitBackground: true });
}

// Guias de recorte: contorno no card, na área da rolagem e na faixa da cena (mesmo sem cena),
// e nada se move por isso.
await jog.goto(`http://localhost:${PORTA}/game?op2-transmissao=ambos&op2-guias`, { waitUntil: "networkidle" });
await jog.waitForFunction(() => globalThis.game?.ready === true && document.querySelector("#op2-transmissao .op2-transmissao__card"), null, { timeout: 60000 });
await jog.waitForTimeout(800);
const guias = await jog.evaluate(() => {
  const vaga = document.querySelector("#op2-transmissao .op2-transmissao__vaga");
  const cena = document.getElementById("op2-transmissao-cena");
  return {
    ligado: document.getElementById("op2-transmissao")?.dataset.guias === "1",
    contornoCard: getComputedStyle(document.querySelector("#op2-transmissao .op2-transmissao__card")).outlineStyle,
    contornoVaga: getComputedStyle(vaga).outlineStyle,
    rotulo: getComputedStyle(vaga, "::before").content,
    cenaVisivel: Boolean(cena && !cena.hidden && cena.getBoundingClientRect().height > 0),
  };
});
console.log(JSON.stringify(guias));
ok("transmissão com guias: tracejado no card, na área da rolagem (com o nome) e na faixa da cena",
  guias.ligado && guias.contornoCard === "dashed" && guias.contornoVaga === "dashed" && /rolagem/i.test(guias.rotulo) && guias.cenaVisivel);
ok("transmissão com guias: os cards ficam onde estavam", await caixas() === parado);
if (process.env.FOTO_GUIAS) await jog.screenshot({ path: process.env.FOTO_GUIAS });
if (process.env.FOTO) await jog.screenshot({ path: process.env.FOTO });
const falhas = globalThis.__falhas ?? 0;
await browser.close();
console.log(falhas ? `${falhas} verificação(ões) falharam.` : "tudo passou.");
process.exit(falhas ? 1 : 0);
