/**
 * Verificação de ponta a ponta dentro de um Foundry rodando de verdade.
 *
 * É o único teste que enxerga o que os testes offline não alcançam: sanitização do
 * chat, contexto real das fichas, hooks depreciados, CSS aplicado e texto cortado.
 * Foi ele que encontrou o sanitizador removendo SVG dos cards e o `{{actor.name}}`
 * vazio na ficha.
 *
 * Pré-requisitos e uso: `scripts/e2e/README.md`.
 *
 *   node scripts/e2e/verificar.mjs [url] [pasta-de-saida]
 */
import { chromium } from "playwright";

const URL = process.argv[2] ?? "http://localhost:30099";
const SAIDA = process.argv[3] ?? ".";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });

const erros = [];
page.on("pageerror", (e) => erros.push(`pageerror: ${e.stack ?? e.message}`));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const texto = m.text();
  // Ruído do headless, não do sistema.
  if (texto.includes("hardware acceleration")) return;
  erros.push(texto.split("\n")[0]);
});

await page.goto(`${URL}/join`, { waitUntil: "networkidle" });
await page.selectOption("select[name='userid']", { label: "Gamemaster" });
await page.click("button[name='join'], button[type='submit']");
await page.waitForURL("**/game");
await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 60000 });

const relato = await page.evaluate(async () => {
  const passos = [];
  const dados = {};
  const ok = (titulo, condicao) => passos.push([Boolean(condicao), titulo]);
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------------------------------------------------------- carregamento -- */

  ok("system carregado", game.system.id === "ordem-paranormal-2e");
  ok("api game.op2 exposta", typeof game.op2?.rolarTeste === "function");
  ok("data models registrados", CONFIG.Actor.dataModels.personagem && CONFIG.Item.dataModels.habilidade);
  ok("OP2Roll em CONFIG.Dice.rolls", CONFIG.Dice.rolls.some((c) => c.name === "OP2Roll"));

  // O sistema é pt-BR primeiro: um cliente novo, que nunca escolheu idioma, entra em
  // português mesmo com o servidor configurado em inglês.
  dados.idioma = { lang: game.i18n.lang, servidor: game.data.options?.language };
  ok("cliente novo entra em pt-BR", game.i18n.lang === "pt-BR");
  ok("perícias traduzidas", game.i18n.localize("OP2.Pericia.percepcao") === "Percepção");
  ok("tipos de documento traduzidos", game.i18n.localize("TYPES.Actor.personagem") === "Personagem");

  /* ------------------------------------------------------------ data model -- */

  const ator = await Actor.create({ name: "Alan", type: "personagem" });
  await game.user.update({ character: ator.id });
  await ator.update({
    "system.ocupacao": "Cientista", "system.nivel": 2,
    "system.atributos.fisico.die": "d6",
    "system.atributos.mente.die": "d10",
    "system.atributos.emocao.die": "d4",
    "system.pericias.percepcao.die": "d8",
    "system.recursos.pv.value": 6, "system.recursos.pv.max": 10,
    "system.recursos.pd.value": 11, "system.recursos.pd.max": 16,
    "system.estado.reducoesTemporarias.fisico": 1,
  });

  const fisico = ator.system.atributos.fisico;
  ok("redução baixa um degrau (d6 → d4)", fisico.dadoEfetivo === "d4" && fisico.reduzido);
  ok("valor da perícia é o número de faces", ator.system.pericias.percepcao.valor === 8);
  ok("aptidões padrão criadas com o ator", Object.keys(ator.system.aptidoes ?? {}).length === 6);
  ok("DT de ferimento parte de 7", ator.system.estado.dtProximoFerimento === 7);

  await ator.createEmbeddedDocuments("Item", [
    { name: "Foco Mental", type: "habilidade",
      system: { origem: "perfil", custo: "2 PD", efeito: { tipo: "passo", passos: 1 } } },
    { name: "Pé de cabra", type: "equipamento", system: { arma: true } },
  ]);
  ok("itens embutidos criados", ator.items.size === 2);

  /* ------------------------------------------------------------------ ficha -- */

  await ator.sheet.render(true);
  await esperar(1500);
  const el = ator.sheet.element;
  ok("ficha renderizou", Boolean(el));

  const campoNome = el?.querySelector("input[name='name']");
  ok("campo de nome traz o nome do ator", campoNome?.value === "Alan");

  const linhas = el?.querySelectorAll(".op2-pericia").length ?? 0;
  ok("19 perícias + 6 aptidões = 25 linhas", linhas === 25);
  ok("ícones de dado renderizados", (el?.querySelectorAll(".op2-dado").length ?? 0) > 20);
  ok("trilhas de PV e PD com 26 pips", (el?.querySelectorAll(".op2-pip").length ?? 0) === 26);
  ok("faixa de estado aparece com redução ativa", Boolean(el?.querySelector(".op2-estado")));

  // Nome de atributo cortado é regressão de layout — em inglês a caixa é mais apertada.
  const nomeAtributo = el?.querySelector(".op2-atributo__nome");
  const larguraOk = nomeAtributo && nomeAtributo.scrollWidth <= nomeAtributo.getBoundingClientRect().width + 1;
  dados.atributo = nomeAtributo && {
    texto: nomeAtributo.textContent.trim(),
    caixa: Math.round(nomeAtributo.getBoundingClientRect().width),
    conteudo: nomeAtributo.scrollWidth,
  };
  ok("nome do atributo cabe na caixa", larguraOk);

  /* ----------------------------------------------------------------- teste -- */

  const roll = await game.op2.rolarTeste(ator, { chavePericia: "percepcao", rapido: true, dt: 7 });
  dados.rolagem = roll && {
    formula: roll.formula, total: roll.total, ra: roll.ra, rb: roll.rb, desfecho: roll.desfecho,
    dados: roll.dados.map((d) => `${d.dado}=${d.resultado}`),
  };
  ok("rolagem produziu resultado", Boolean(roll));
  ok("fórmula é perícia + atributo pareado", roll?.formula === "1d8 + 1d10");
  ok("RA ≥ RB", roll && roll.ra >= roll.rb);
  ok("card publicado no chat", game.messages.size > 0);

  await esperar(800);
  const card = document.querySelector(".op2-card");
  dados.card = card && {
    temClasseOp2: card.classList.contains("op2"),
    icones: card.querySelectorAll(".op2-dado").length,
    temRA: card.textContent.includes(game.i18n.localize("OP2.RA")),
  };
  // O conteúdo do chat passa pelo sanitizador do Foundry: `<svg>` não sobrevive.
  ok("card mantém os ícones de dado", dados.card?.icones === 2);
  ok("card carrega a classe op2 (tokens de cor)", Boolean(dados.card?.temClasseOp2));
  ok("card mostra a Rolagem Alta", Boolean(dados.card?.temRA));

  /* ---------------------------------------------------------- investigação -- */

  const cena = await Scene.create({ name: "Porão", active: true });
  await esperar(2000); // o canvas reinicia ao ativar a cena

  const poi = await Item.create({
    name: "Quadro na Parede", type: "ponto-interesse",
    system: {
      descricaoBasica: "Um quadro torto na parede.",
      descricaoContextual: "Atrás dele há um cofre.",
      informacoes: [
        { id: "i1", pericia: "percepcao", dt: 6, texto: "Marca de dedo no vidro." },
        { id: "i2", pericia: "percepcao", dt: 10, texto: "Bilhete atrás da moldura." },
      ],
    },
  });
  ok("POI criado com data model próprio", poi?.system.constructor.name === "PontoInteresseData");

  await canvas.scene.setFlag("ordem-paranormal-2e", "pois", [poi.uuid]);
  await canvas.scene.createEmbeddedDocuments("Token", [
    { actorId: ator.id, actorLink: true, x: 200, y: 200 },
  ]);
  await esperar(1000);

  // Investigar: Percepção d8 entrega a DT 6 de graça, mas não a DT 10 — sem rolar.
  const reveladas = await game.op2.investigar(ator, poi.uuid, "percepcao");
  ok("investigar revela só DT ≤ tamanho do dado", reveladas?.length === 1 && reveladas[0] === "i1");
  ok("revelação gravada no actor", ator.system.estado.infosReveladas.has(`${poi.uuid}:i1`));
  ok("POI marcado como investigado", ator.system.estado.poisInvestigados.has(poi.uuid));

  await esperar(800);
  const msgs = [...game.messages.values()];
  ok("revelação é sussurrada (dono + mestre)",
    msgs.some((m) => m.getFlag("ordem-paranormal-2e", "tipo") === "investigacao" && m.whisper.length > 0));

  // Examinar: rola sem DT — o card não pode vazar a DT das informações.
  const examinou = await game.op2.examinar(ator, poi.uuid, "percepcao", { confirmar: false, rapido: true });
  dados.examinar = examinou && { total: examinou.roll.total, dt: examinou.roll.dt, perdePD: examinou.perdePD };
  ok("examinar rolou sem DT", examinou && examinou.roll.dt === null);
  await esperar(800);
  const revelouI2 = ator.system.estado.infosReveladas.has(`${poi.uuid}:i2`);
  const cardCusto = [...document.querySelectorAll(".op2-card")]
    .some((c) => c.textContent.includes(game.i18n.localize("OP2.Investigacao.ExaminarSemInfo")));
  ok("examinar revelou a DT 10 ou abriu o card de custo de PD", revelouI2 || cardCusto);

  /* ------------------------------------------------------- painel e rodadas -- */

  const painel = game.op2.painelInvestigacao();
  await esperar(1200);
  const painelEl = painel.element;
  ok("painel renderizou", Boolean(painelEl));
  ok("painel lista o POI", Boolean(painelEl?.textContent.includes("Quadro na Parede")));
  ok("mestre vê as DTs no quadro", Boolean(painelEl?.textContent.includes("DT 10")));
  ok("tracker lista o personagem", Boolean(painelEl?.textContent.includes("Alan")));
  dados.controles = Object.keys(ui.controls?.controls ?? {});
  ok("controle de cena do painel registrado", Boolean(ui.controls?.controls?.["op2-investigacao"]));

  await canvas.scene.setFlag("ordem-paranormal-2e", "sobrecarga", { ativa: true, tabela: [{ rodada: 1, dano: "1" }] });
  await game.op2.avancarRodada();
  await game.op2.avancarRodada(); // encerra a rodada 1 → dano "1"
  await esperar(1000);
  ok("rodada avançou", canvas.scene.getFlag("ordem-paranormal-2e", "rodada") === 2);
  const botaoSobrecarga = document.querySelector('[data-op2-acao="rolar-sobrecarga"]');
  ok("card de sobrecarga tem botão por personagem", Boolean(botaoSobrecarga));

  const pdAntes = ator.system.recursos.pd.value;
  botaoSobrecarga?.click();
  await esperar(800);
  dados.sobrecarga = { pdAntes, pdDepois: ator.system.recursos.pd.value };
  ok("sobrecarga aplicou 1 de dano emocional", ator.system.recursos.pd.value === pdAntes - 1);

  // Trava de 1×-por-cena: o botão some desabilitado para o grupo.
  await canvas.scene.setFlag("ordem-paranormal-2e", "recapitularUsado", { ator: ator.id, nome: ator.name });
  await painel.render();
  await esperar(800);
  const botaoRecapitular = painel.element?.querySelector('[data-action="recapitular"]');
  ok("trava desabilita Recapitular no painel", Boolean(botaoRecapitular?.disabled));

  // Encerrar a cena limpa revelações, travas e o contador de rodadas.
  await game.op2.encerrarCena({ avisar: false });
  await esperar(500);
  dados.encerrar = {
    infos: ator.system.estado.infosReveladas.size,
    rodada: canvas.scene.getFlag("ordem-paranormal-2e", "rodada"),
    trava: canvas.scene.getFlag("ordem-paranormal-2e", "recapitularUsado"),
  };
  ok("encerrar cena limpa revelações do actor", ator.system.estado.infosReveladas.size === 0);
  ok("encerrar cena limpa rodada e travas", dados.encerrar.rodada === undefined && dados.encerrar.trava === undefined);

  /* ------------------------------------------------------------ ficha do POI -- */

  await poi.sheet.render(true);
  await esperar(800);
  const poiEl = poi.sheet.element;
  ok("ficha do POI renderizou", Boolean(poiEl));
  ok("quadro tem as 2 informações", (poiEl?.querySelectorAll(".op2-poi__info").length ?? 0) === 2);
  ok("descrição contextual visível para o mestre", Boolean(poiEl?.textContent.includes("cofre")));

  await game.user.update({ character: null });
  await poi.sheet.close();
  await poi.delete();
  await ator.delete();
  return { passos, dados };
});

const falhas = relato.passos.filter(([ok]) => !ok);
for (const [ok, titulo] of relato.passos) console.log(`${ok ? "ok   " : "FALHA"} ${titulo}`);
console.log("\ndetalhes:", JSON.stringify(relato.dados, null, 1));
console.log("erros do console:", erros.length ? [...new Set(erros)] : "nenhum");

await page.screenshot({ path: `${SAIDA}/e2e-foundry.png` });
await browser.close();

if (falhas.length || erros.length) {
  console.error(`\n${falhas.length} verificação(ões) falharam, ${erros.length} erro(s) no console.`);
  process.exit(1);
}
console.log(`\n${relato.passos.length} verificações passaram.`);
