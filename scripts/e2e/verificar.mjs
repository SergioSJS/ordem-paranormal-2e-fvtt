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
  ok("trilhas de PV e PD com 26 traços", (el?.querySelectorAll(".op2-traco").length ?? 0) === 26);

  // O core define `button { min-height: var(--button-size) }` (2em) sem camada — um
  // piso que `height` sozinho não derruba, porque são propriedades diferentes na
  // cascata. Sem zerar `min-height`, qualquer botão pequeno nosso (o traço, aqui)
  // saía grande demais mesmo com a altura certa declarada (achado em uso real).
  {
    const traco = el?.querySelector(".op2-traco");
    const altura = traco && parseFloat(getComputedStyle(traco).height);
    ok("traço de recurso não é inflado pelo min-height padrão de botão", altura < 16);
  }
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

  // O <ol> do log de chat do próprio Foundry carrega `.theme-light` sempre, mesmo
  // com a UI em modo escuro — sem forçar os tokens escuros, o card herdava (ou
  // casava direto com) o tema claro e o pergaminho padrão do core aparecia por trás.
  {
    const envelope = document.querySelector(".chat-message.op2");
    const corEnvelope = envelope && getComputedStyle(envelope).backgroundColor;
    const corCard = getComputedStyle(card).backgroundColor;
    ok("envelope da mensagem ganha a classe op2", Boolean(envelope));
    ok("card do chat fica escuro mesmo dentro do log (tema claro)", corCard === "rgb(22, 16, 14)");
    ok("envelope da mensagem também fica escuro", corEnvelope === "rgb(22, 16, 14)");
  }
  // O core tem `dl dd { color: var(--color-text-primary) }`, pensado para o fundo
  // claro do log — nossos `dd` (RA/RB) nunca declaravam a própria cor, e o texto
  // saía quase preto sobre o card quase preto (achado em uso real).
  {
    const dd = card.querySelector(".op2-card__leituras dd");
    const corDd = getComputedStyle(dd).color;
    ok("RA/RB legíveis (não herdam o cinza-escuro do core)", corDd !== "rgb(34, 34, 34)");
  }


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

  // `position: { height: "auto" }` cresce sem teto — numa cena cheia a janela
  // passava da tela e o conteúdo de baixo ficava cortado, sem como rolar até ele
  // nem arrastar um item ali (achado em uso real).
  {
    const wc = painelEl.querySelector(".window-content");
    ok("painel tem rolagem interna, não cresce sem teto", getComputedStyle(wc).overflowY === "auto");
  }

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

  /* ---------------------------------------------------- desafios de acesso -- */
  // Fase 3 M1 (spec §7.2/§7.4/§7.5). DT 0 e DT 999 forçam sucesso/falha
  // determinísticos — o teste não pode depender do valor exato rolado.
  {
    const fechadura = await Item.create({
      name: "Fechadura Emperrada", type: "desafio-acesso",
      system: { dtObjeto: 0, pontuacaoAlvo: 1, maxTentativas: 0 },
    });
    ok("desafio criado com data model próprio", fechadura?.system.constructor.name === "DesafioAcessoData");

    const pvAntes = ator.system.recursos.pv.value;
    const arrombou1 = await game.op2.arrombar(ator, fechadura.uuid, { rapido: true });
    await esperar(500);
    ok("arrombar cobra 1 PV por tentativa", ator.system.recursos.pv.value === pvAntes - 1);
    ok("DT 0 e PA 1 arrombam na primeira tentativa", arrombou1?.arrombou === true);
    ok("card de Arrombar mostra o resultado",
      Boolean([...document.querySelectorAll(".op2-card")].at(-1)?.textContent.includes(game.i18n.localize("OP2.Desafio.Arrombou"))));

    const cofre = await Item.create({
      name: "Cofre Blindado", type: "desafio-acesso",
      system: { dtObjeto: 999, pontuacaoAlvo: 999, maxTentativas: 1 },
    });
    const arrombou2 = await game.op2.arrombar(ator, cofre.uuid, { rapido: true });
    await esperar(500);
    ok("excedeu a única tentativa sem arrombar: quebra", arrombou2?.quebrado === true && cofre.system.quebrado === true);
    ok("desafio quebrado recusa nova tentativa", await game.op2.arrombar(ator, cofre.uuid, { rapido: true }) === null);

    // Painel: seção "Desafios" lista os itens vinculados à cena (mesmo padrão de
    // arrastar POI já testado acima), com progresso e botão de Arrombar.
    await canvas.scene.setFlag("ordem-paranormal-2e", "desafios", [fechadura.uuid, cofre.uuid]);
    await painel.render();
    await esperar(800);
    ok("painel lista os desafios vinculados à cena",
      Boolean(painel.element?.textContent.includes("Fechadura Emperrada"))
      && Boolean(painel.element?.textContent.includes("Cofre Blindado")));
    ok("painel mostra o progresso do desafio (1 / 1)", Boolean(painel.element?.textContent.includes("1 / 1")));
    {
      const botaoArrombarCofre = [...painel.element.querySelectorAll('[data-action="arrombar"]')]
        .find((b) => b.dataset.desafioUuid === cofre.uuid);
      ok("desafio quebrado desabilita o botão Arrombar no painel", botaoArrombarCofre?.disabled === true);
      // Achado junto: um botão desabilitado era visualmente idêntico a um clicável.
      ok("botão desabilitado parece desabilitado (opacidade reduzida)",
        parseFloat(getComputedStyle(botaoArrombarCofre).opacity) < 1);
    }

    // Ficha do desafio: campos + barra de progresso visual.
    await fechadura.sheet.render(true);
    await esperar(800);
    const desafioEl = fechadura.sheet.element;
    ok("ficha do desafio renderizou", Boolean(desafioEl));
    ok("barra de progresso reflete pontuacaoAtual/pontuacaoAlvo (100%)",
      desafioEl?.querySelector(".op2-progresso__preenchido")?.style.width === "100%");
    await fechadura.sheet.close();

    await fechadura.delete();
    await cofre.delete();

    // ALCANÇAR: DT 0 sempre passa nas duas ações do modo seguro; DT 999 nunca
    // alcança no arriscado e nunca aplica dano sozinho — só oferece o botão.
    const seguroOk = await game.op2.alcancar(ator, { modo: "seguro", dt: 0, rapido: true });
    ok("alcançar seguro com DT 0 passa nas duas ações em sequência", seguroOk?.sucesso === true);

    const arriscadoFalha = await game.op2.alcancar(ator, { modo: "arriscado", dt: 999, rapido: true });
    ok("alcançar arriscado com DT alta falha", arriscadoFalha?.sucesso === false);
    ok("falha no arriscado aponta dano = RA (spec §7.4)", Number.isInteger(arriscadoFalha?.dano));

    await esperar(500);
    const cardAlcancar = [...document.querySelectorAll(".op2-card")].at(-1);
    const botaoDanoAlcancar = cardAlcancar?.querySelector('[data-op2-acao="aplicar-dano"]');
    ok("card de Alcançar oferece botão de dano em vez de aplicar sozinho",
      Boolean(botaoDanoAlcancar) && Number(botaoDanoAlcancar.dataset.quantidade) === arriscadoFalha.dano);

    // SUSTENTAR: DT 0 garante início e a 1ª fadiga; sobe a DT e a 2ª fadiga solta.
    const dtOriginal = game.settings.get("ordem-paranormal-2e", "dtPadrao");
    await game.settings.set("ordem-paranormal-2e", "dtPadrao", 0);

    const iniciou = await game.op2.sustentar(ator, { rapido: true });
    ok("sustentar com DT 0 sempre começa", iniciou?.sustentando === true);
    ok("sustentar liga a flag no ator", ator.system.estado.sustentando.ativo === true);

    // A 1ª `avancarRodada()` só liga a rodada 1 (mesma guarda `encerrada >= 1` da
    // sobrecarga) — a fadiga só entra a partir da rodada seguinte, quando uma
    // rodada de verdade se encerra.
    await game.op2.avancarRodada();
    await esperar(500);
    ok("1ª chamada só liga a rodada, sem testar fadiga ainda", ator.system.estado.sustentando.fadiga === 0);

    await game.op2.avancarRodada();
    await esperar(500);
    ok("fadiga com DT 0 continua sustentando", ator.system.estado.sustentando.ativo === true);
    ok("fadiga acumula a cada rodada", ator.system.estado.sustentando.fadiga === 1);

    await game.settings.set("ordem-paranormal-2e", "dtPadrao", 999);
    await game.op2.avancarRodada();
    await esperar(500);
    ok("fadiga com DT alta solta o que era sustentado", ator.system.estado.sustentando.ativo === false);

    await game.settings.set("ordem-paranormal-2e", "dtPadrao", dtOriginal);
  }

  /* ---------------------------------------------------- ferramentas da Ordo -- */
  // Fase 3 M2 (spec §9). Câmera tem reação nesse POI, Termômetro não — "sem
  // reação" também é informação e precisa aparecer, nunca ficar em silêncio.
  {
    await poi.update({ "system.ferramentas.camera": "Uma foto revela uma sombra estranha atrás do quadro." });

    await ator.createEmbeddedDocuments("Item", [
      { name: "Câmera Modificada", type: "ferramenta", system: { subtipo: "camera" } },
      { name: "Termômetro Diferencial", type: "ferramenta", system: { subtipo: "termometro" } },
      { name: "Lanterna de Estouro UV", type: "ferramenta",
        system: { subtipo: "lanternaUV", cargas: { usa: true, value: 1, max: 3 } } },
      { name: "Laser de Varredura", type: "ferramenta", system: { subtipo: "laser" } },
    ]);

    const comReacao = await game.op2.usarFerramenta(ator, poi.uuid, "camera");
    await esperar(500);
    ok("ferramenta com reação retorna temReacao", comReacao?.temReacao === true);
    ok("card mostra o texto da reação",
      Boolean([...document.querySelectorAll(".op2-card")].at(-1)?.textContent.includes("sombra estranha")));

    const semReacao = await game.op2.usarFerramenta(ator, poi.uuid, "termometro");
    await esperar(500);
    ok("ferramenta sem reação também revela um card (é informação)", semReacao?.temReacao === false);
    ok("card avisa leitura normal, sem reação",
      Boolean([...document.querySelectorAll(".op2-card")].at(-1)?.textContent.includes(game.i18n.localize("OP2.Ferramenta.SemReacao"))));

    const lanternaItem = ator.items.getName("Lanterna de Estouro UV");
    await game.op2.usarFerramenta(ator, poi.uuid, "lanternaUV");
    await esperar(300);
    ok("usar ferramenta com carga consome 1", lanternaItem.system.cargas.value === 0);
    const semCargas = await game.op2.usarFerramenta(ator, poi.uuid, "lanternaUV");
    ok("sem cargas recusa o uso", semCargas === null);

    // LASER DE VARREDURA: marca o POI (que reage via Câmera) sem dizer qual ferramenta.
    ok("POI começa sem marca do laser", poi.system.reveladoPorLaser === false);
    const marcados = await game.op2.usarLaser(ator);
    await esperar(500);
    ok("laser marca o POI que reage a alguma ferramenta", marcados.includes("Quadro na Parede"));
    ok("flag reveladoPorLaser gravada no POI", poi.system.reveladoPorLaser === true);

    // Painel: botões de ferramenta aparecem para quem carrega o item; botão de
    // Laser aparece no grupo de ações; badge do laser aparece no card do POI.
    await painel.render();
    await esperar(800);
    ok("painel oferece Usar Laser de Varredura", Boolean(painel.element?.querySelector('[data-action="usarLaser"]')));
    // Laser também é um slot reativo de POI (spec de Fase 2), fora do gatilho
    // dedicado de cena — por isso conta junto com câmera/termômetro/lanterna.
    const botoesFerramenta = [...painel.element.querySelectorAll('[data-action="usarFerramenta"]')];
    ok("painel lista as ferramentas que o personagem carrega para aquele POI", botoesFerramenta.length === 4);
    ok("card do POI mostra o selo do laser", Boolean(painel.element?.querySelector(".op2-poi-card .fa-satellite-dish")));
  }

  /* -------------------------------------------------- destrancar (Mastermind) -- */
  // Fase 3 M3 (spec §7.1). A senha é lida direto do Item para montar palpites
  // certos/errados sob controle — o teste não pode depender de adivinhar sorte.
  {
    const fechadura = await Item.create({
      name: "Fechadura Numérica", type: "desafio-acesso", system: { maxTentativas: 0 },
    });

    ok("sem senha, tentar recusa (mestre precisa gerar antes)",
      await game.op2.tentarDestrancar(ator, fechadura.uuid, [1, 1, 1]) === null);

    const senha = await game.op2.gerarSenhaDestrancar(fechadura.uuid, { tamanho: 3, facesSenha: 6 });
    ok("gerar senha grava 3 posições de 1 a 6", senha.length === 3 && senha.every((v) => v >= 1 && v <= 6));
    ok("a senha gerada é a mesma gravada no Item", fechadura.system.senha.join(",") === senha.join(","));

    // Palpite garantidamente errado em toda posição: desvia +1 (ou -1 no teto).
    const palpiteErrado = senha.map((v) => (v >= 6 ? v - 1 : v + 1));
    const tentativaErrada = await game.op2.tentarDestrancar(ator, fechadura.uuid, palpiteErrado);
    await esperar(300);
    ok("palpite errado não vence", tentativaErrada?.venceu === false);
    ok("nenhuma posição sai exata quando todas desviam", !tentativaErrada.resultado.includes("exato"));
    ok("tentativa incrementa o contador do Destrancar", fechadura.system.destrancarTentativas === 1);

    const tentativaCerta = await game.op2.tentarDestrancar(ator, fechadura.uuid, senha);
    await esperar(300);
    ok("palpite igual à senha vence", tentativaCerta?.venceu === true);
    ok("Item marcado como destrancado", fechadura.system.destrancado === true);
    ok("tentar de novo depois de destrancado é recusado",
      await game.op2.tentarDestrancar(ator, fechadura.uuid, senha) === null);

    // Quebra por exceder tentativas: mesmo campo `quebrado` de Arrombar.
    const cofreDigital = await Item.create({
      name: "Cofre Digital", type: "desafio-acesso", system: { maxTentativas: 1 },
    });
    const senhaCofre = await game.op2.gerarSenhaDestrancar(cofreDigital.uuid, { tamanho: 2, facesSenha: 6 });
    const erradoCofre = senhaCofre.map((v) => (v >= 6 ? v - 1 : v + 1));
    await game.op2.tentarDestrancar(ator, cofreDigital.uuid, erradoCofre);
    await esperar(300);
    ok("excedeu a única tentativa de Destrancar: quebra", cofreDigital.system.quebrado === true);

    // App do Mastermind: histórico visível, senha só para o mestre, palpite editável.
    const appDestrancar = game.op2.abrirDestrancar(fechadura.uuid);
    await esperar(800);
    const appEl = appDestrancar.element;
    ok("app do Destrancar renderizou", Boolean(appEl));
    ok("histórico mostra as 2 tentativas", appEl?.querySelectorAll(".op2-destrancar__historico tr").length === 2);
    ok("mestre vê a senha na tela do app", Boolean(appEl?.textContent.includes(senha.join(" "))));
    ok("já destrancado não mostra mais o botão Tentar", !appEl?.querySelector('[data-action="tentar"]'));
    await appDestrancar.close();

    await fechadura.delete();
    await cofreDigital.delete();

    // Painel: botão Destrancar aparece junto do Arrombar em cada desafio da cena.
    const desafioVitrine = await Item.create({ name: "Porta do Fundo", type: "desafio-acesso" });
    await canvas.scene.setFlag("ordem-paranormal-2e", "desafios", [desafioVitrine.uuid]);
    await painel.render();
    await esperar(800);
    ok("painel oferece o botão Destrancar por desafio", Boolean(painel.element?.querySelector('[data-action="destrancar"]')));
    await desafioVitrine.delete();
  }

  /* ------------------------------------------------------ laboratório portátil -- */
  // Fase 3 M3, parte 2 (spec §9.1). A escada crescente já é testada como regra
  // pura em ferramentas.test.mjs; aqui só confere a ponte com o app de verdade.
  {
    const app = await game.op2.abrirLaboratorio(ator, 4);
    await esperar(600);
    ok("app do Laboratório renderizou", Boolean(app.element));
    ok("mostra as 4 posições da escada", app.element?.querySelectorAll(".op2-laboratorio__posicao").length === 4);
    ok("primeiro dado da escada é d4", app.resultados.length === 4 && app.sequenciaAlvo[0] === "d4");

    const mensagensAntes = game.messages.size;
    app.element.querySelector('[data-action="finalizar"]')?.click();
    await esperar(600);
    ok("encerrar publica um card no chat", game.messages.size > mensagensAntes);
    ok("botão some depois de encerrar", !app.element.querySelector('[data-action="finalizar"]'));
    await app.close();
  }

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
  /* ---------------------------------------------- regressão: bugs de uso real -- */
  // Achados numa sessão de uso manual, não pelos testes com dados fixos. Cada um vira
  // uma verificação permanente para não voltar em silêncio.

  // 1) `.op2 button { font-family: inherit }` batia com a camada do FontAwesome
  //    (Foundry declara a camada do core ANTES da "system"; em CSS Layers a ordem
  //    declarada decide, não a especificidade). Os ícones do chrome da janela
  //    (fechar, alternar controles) viravam caixa vazia.
  {
    const janela = ator.sheet.element.closest(".window-app") ?? ator.sheet.element.parentElement;
    const fechar = janela.querySelector('[data-action="close"]');
    const fonte = fechar ? getComputedStyle(fechar, "::before").fontFamily : "";
    ok("ícone de fechar a janela usa a fonte do FontAwesome", fonte.includes("Font Awesome"));
  }

  // 2) ApplicationV2.changeTab() exige a classe literal "tabs" no <nav> para achar o
  //    botão — sem ela, todo clique em Inventário/Notas lançava
  //    "No matching tab element found".
  {
    const painelAntes = el.querySelector(".op2-painel[data-tab='inventario']")?.classList.contains("active");
    el.querySelector("button.op2-aba[data-tab='inventario']")?.click();
    await esperar(400);
    const painelDepois = el.querySelector(".op2-painel[data-tab='inventario']")?.classList.contains("active");
    ok("clique na aba Inventário ativa o painel", !painelAntes && painelDepois);
  }

  // Indicador de equipado e controle de cargas na lista de inventário: visíveis sem
  // precisar abrir a ficha do item, com botões de +/- para as cargas.
  {
    const itemPeDeCabra = ator.items.getName("Pé de cabra");
    await itemPeDeCabra.update({ "system.cargas": { usa: true, value: 2, max: 3 } });
    await esperar(200);

    // Cada `actor.update()` troca o nó da linha inteira — uma referência de antes do
    // re-render fica presa ao DOM anterior (o mesmo problema já visto no teste do
    // pulso crítico). Reconsultar a cada passo, não guardar `linha` de uma vez só.
    const linhaDoItem = () => [...el.querySelectorAll(".op2-item")].find((li) => li.dataset.itemId === itemPeDeCabra.id);

    ok("item lista o botão de equipado", Boolean(linhaDoItem().querySelector(".op2-item__equipado")));
    ok("item começa desequipado (sem destaque ativo)",
      !linhaDoItem().querySelector(".op2-item__equipado").classList.contains("op2-item__equipado--ativo"));

    linhaDoItem().querySelector(".op2-item__equipado").click();
    await esperar(300);
    ok("clicar no escudo equipa o item", itemPeDeCabra.system.equipado === true);
    ok("linha do item ganha destaque quando equipado", linhaDoItem().classList.contains("op2-item--equipado"));

    ok("cargas aparecem como 2/3", linhaDoItem().querySelector(".op2-item__cargas-valor")?.textContent.trim() === "2/3");
    linhaDoItem().querySelector('[data-action="ajustarCarga"][data-delta="1"]').click();
    await esperar(300);
    ok("botão + aumenta a carga (2 → 3)", itemPeDeCabra.system.cargas.value === 3);
    linhaDoItem().querySelector('[data-action="ajustarCarga"][data-delta="1"]').click();
    await esperar(300);
    ok("carga não passa do máximo (trava em 3)", itemPeDeCabra.system.cargas.value === 3);
  }

  // O grid de 5 colunas do `.op2-item` do inventário (ícone·equipado·nome·cargas·apagar)
  // é a mesma classe usada por Habilidades, que só tem 3 filhos (ícone·nome·apagar) — sem
  // escopo, o nome da habilidade caía na coluna estreita de "equipado" (achado em uso real).
  {
    el.querySelector("button.op2-aba[data-tab='habilidades']")?.click();
    await esperar(300);
    const linhaHabilidade = [...el.querySelectorAll(".op2-item")]
      .find((li) => li.dataset.itemId === ator.items.getName("Foco Mental").id);
    const larguraNome = linhaHabilidade?.querySelector(".op2-item__nome")?.getBoundingClientRect().width ?? 0;
    ok("nome da habilidade não fica espremido na coluna de equipado", larguraNome > 100);
  }

  // Ferramenta é item do personagem: precisa aparecer no Inventário, não só no
  // painel de investigação (achado em uso real — a lista nunca filtrava por tipo).
  {
    el.querySelector("button.op2-aba[data-tab='inventario']")?.click();
    await esperar(300);
    // Cria com a aba já ativa: criar antes e trocar de aba depois corre risco de o
    // re-render disparado pela criação do item e o clique na aba colidirem (achado
    // em uso real, escrevendo este mesmo teste).
    await ator.createEmbeddedDocuments("Item", [
      { name: "Termômetro de Vitrine", type: "ferramenta",
        system: { subtipo: "termometro", cargas: { usa: true, value: 1, max: 3 } } },
    ]);
    await esperar(400);
    const linhaFerramenta = () => [...el.querySelectorAll(".op2-lista-itens--ferramentas .op2-item")]
      .find((li) => li.dataset.itemId === ator.items.getName("Termômetro de Vitrine").id);
    ok("ferramenta aparece na aba Inventário", Boolean(linhaFerramenta()));
    const larguraNomeFerramenta = linhaFerramenta()?.querySelector(".op2-item__nome")?.getBoundingClientRect().width ?? 0;
    ok("nome da ferramenta não fica espremido (grid sem coluna de equipado)", larguraNomeFerramenta > 100);
    ok("cargas da ferramenta aparecem no inventário",
      linhaFerramenta()?.querySelector(".op2-item__cargas-valor")?.textContent.trim() === "1/3");
  }

  // 3) Clicar num atributo puro (Físico/Mente/Emoção) pareava com ele mesmo
  //    (atributoDe() não encontra perícia e caía no fallback "fisico"), rolando o
  //    mesmo dado duas vezes. Um atributo não tem par: a regra é sempre perícia +
  //    atributo (spec §4.1).
  {
    let formulaAtributo = null;
    Hooks.once("createChatMessage", (msg) => { formulaAtributo = msg.rolls?.[0]?.formula ?? null; });
    el.querySelector(".op2-atributo__nome")?.click();
    await esperar(700);
    ok("clicar num atributo rola só o dado dele, sem pareamento", formulaAtributo === "1d6");
  }

  // 4) Shift+clique não existe em toque. Sem outro gatilho, não havia como abrir o
  //    diálogo completo no celular ou no tablet.
  {
    const antes = document.querySelectorAll(".op2-teste-dialog").length;
    el.querySelector(".op2-pericia .op2-abrir-dialogo")?.click();
    await esperar(500);
    const depois = document.querySelectorAll(".op2-teste-dialog").length;
    ok("botão dedicado abre o diálogo sem precisar de Shift", depois > antes);
    document.querySelector(".op2-teste-dialog")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await esperar(200);
  }

  // 5) A roda do mouse sobre o ícone de um dado mudava o valor mesmo sem foco — rolar a
  //    lista de perícias com o cursor de passagem sobre um ícone corrompia a ficha.
  {
    const controle = el.querySelector(".op2-pericia .op2-controle-dado[data-caminho]");
    const caminho = controle.dataset.caminho;
    document.activeElement?.blur();
    const antes = foundry.utils.getProperty(ator, caminho);
    controle.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true }));
    await esperar(200);
    const semFoco = foundry.utils.getProperty(ator, caminho);
    ok("roda do mouse sem foco não altera o dado", semFoco === antes);

    controle.querySelector(".op2-controle-dado__botao")?.focus();
    controle.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true }));
    await esperar(200);
    const comFoco = foundry.utils.getProperty(ator, caminho);
    ok("roda do mouse com foco altera o dado", comFoco !== antes);
  }


  // 6) O número e o traço sempre concordam: clicar no traço N muda o número, e o
  //    número editado à mão precisa refletir nos traços no próximo render.
  {
    await ator.update({ "system.recursos.pv": { value: 0, max: 10 } });
    await esperar(150);
    el.querySelector(".op2-recurso--pv .op2-traco[data-valor='5']")?.click();
    await esperar(400);
    ok("clicar no 5º traço de PV define o valor em 5", ator.system.recursos.pv.value === 5);
  }

  // 7) O grupo de Aptidão se confundia com a lista plana de perícias — sem borda, sem
  //    seta, o botão de novo campo parecia solto no meio da coluna.
  {
    const aptidao = el.querySelector(".op2-aptidao");
    ok("Aptidão é um <details> que abre e fecha", aptidao.tagName === "DETAILS" && aptidao.open);
    ok("Aptidão tem o card visualmente distinto (borda própria)", getComputedStyle(aptidao).borderStyle !== "none");
  }
  // 8) Abaixo de 30% do máximo, o traço preenchido pulsa em vermelho — aviso de
  //    recurso crítico, no estilo de barra de vida baixa de qualquer jogo.
  {
    await ator.update({ "system.recursos.pv.value": 6, "system.recursos.pv.max": 30 });
    await esperar(200);
    const tracos = el.querySelector(".op2-recurso--pv .op2-tracos");
    ok("PV a 20% do máximo entra em estado crítico", tracos.classList.contains("op2-tracos--critico"));
    const cheio = tracos.querySelector(".op2-traco--cheio");
    ok("traço preenchido crítico tem animação de pulso", getComputedStyle(cheio).animationName === "op2-pulso-critico");

    await ator.update({ "system.recursos.pv.value": 25 });
    await esperar(200);
    // Um novo render troca o nó — a referência antiga fica presa ao DOM anterior.
    const tracosDepois = el.querySelector(".op2-recurso--pv .op2-tracos");
    ok("PV acima de 30% não pulsa", !tracosDepois.classList.contains("op2-tracos--critico"));
  }
  // 9) PV e PD com valores muito diferentes (personagens do Ato II chegam a 32-34)
  //    ficavam desalinhados: um recurso quebrava linha, o outro não. Os traços agora
  //    sempre ficam na própria linha, os dois, para nunca desalinhar entre si.
  {
    await ator.update({ "system.recursos.pv": { value: 20, max: 34 }, "system.recursos.pd": { value: 2, max: 4 } });
    await esperar(200);
    const topoRotulo = (chave) => el.querySelector(`.op2-recurso--${chave} .op2-tag`).getBoundingClientRect().top;
    const topoTracos = (chave) => el.querySelector(`.op2-recurso--${chave} .op2-tracos`).getBoundingClientRect().top;
    ok("PV (34) quebra para a própria linha", topoTracos("pv") > topoRotulo("pv") + 5);
    ok("PD (4) quebra para a própria linha mesmo sendo curto", topoTracos("pd") > topoRotulo("pd") + 5);
    ok("nenhum teto esconde o traço em valor alto", el.querySelectorAll(".op2-recurso--pv .op2-traco").length === 34);
  }
  // 10) Cabeçalho reorganizado: nome em cima, retrato + identidade + atributos
  //     empilhados abaixo, PV/PD por último. Antes os três atributos dividiam uma
  //     única faixa horizontal e "EMOÇÃO" cortava contra o número do dado.
  {
    await ator.update({ "system.nex": 5 });
    await esperar(150);
    ok("campo de NEX existe no cabeçalho", Boolean(el.querySelector("input[name='system.nex']")));

    const ocupacao = el.querySelector(".op2-ocupacao");
    ok("Ocupação não estica a altura da coluna", ocupacao.getBoundingClientRect().height < 40);

    const emocao = [...el.querySelectorAll(".op2-atributo__nome")].find((b) => b.dataset.chave === "emocao");
    ok("EMOÇÃO não corta mesmo com o dado ao lado", emocao.scrollWidth <= emocao.getBoundingClientRect().width + 1);

    ok("nome ocupa a própria linha, acima do retrato", el.querySelector(".op2-cabecalho__nome").getBoundingClientRect().top
      < el.querySelector(".op2-cabecalho__retrato").getBoundingClientRect().top);
  }





  /* -------------------------------------------------------------------- npc -- */
  // As seções de Atributos/Perícias/Notas usavam a mesma classe das abas da ficha
  // de personagem (`.op2-painel`, que é `display:none` sem `.active`) — a ficha de
  // NPC inteira ficava invisível abaixo do cabeçalho. Regressão permanente.
  {
    const npc = await Actor.create({ name: "npc-regressao", type: "npc" });
    await npc.update({ "system.atributos.fisico.die": "d8", "system.pericias.luta": { rotulo: "Luta", die: "d8" } });
    await npc.sheet.render(true);
    await esperar(900);
    const elNpc = npc.sheet.element;

    const alturaVisivel = (sel) => elNpc.querySelector(sel)?.getBoundingClientRect().height ?? 0;
    ok("seção de atributos do NPC é visível", alturaVisivel(".op2-npc-secao") > 0);
    ok("NPC lista a perícia declarada", elNpc.querySelectorAll(".op2-pericia-npc").length === 1);

    let formula = null;
    Hooks.once("createChatMessage", (msg) => { formula = msg.rolls?.[0]?.formula ?? null; });
    elNpc.querySelector(".op2-atributo__nome")?.click();
    await esperar(700);
    ok("atributo do NPC rola sozinho, sem par", formula === "1d8");

    formula = null;
    Hooks.once("createChatMessage", (msg) => { formula = msg.rolls?.[0]?.formula ?? null; });
    elNpc.querySelector(".op2-pericia-npc__nome")?.click();
    await esperar(700);
    ok("perícia do NPC rola", formula === "1d8");

    await npc.delete();
  }

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
