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
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { montarZip } from "../../module/tests/zip-fixture.mjs";

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

  // DT 0 não garante sucesso: dois 1 são falha crítica, e falha crítica ignora a
  // DT (spec §4.4). Isso fazia os testes "com DT 0 sempre passa" falharem ~1 em 16
  // execuções — flake real, que já enganou mais de uma sessão. `randomUniform`
  // alimenta todo dado do core (`mapRandomFace`), então travar o gerador é o jeito
  // honesto de testar a regra sem depender de sorte.
  const aleatorioOriginal = CONFIG.Dice.randomUniform;
  const comDadosNoMaximo = async (fn) => {
    CONFIG.Dice.randomUniform = () => 0; // face máxima em qualquer dado
    try { return await fn(); } finally { CONFIG.Dice.randomUniform = aleatorioOriginal; }
  };

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

  // Ícone padrão por tipo de documento (ICONES_PADRAO): aplicado na criação quando
  // nenhum img é passado; uma escolha explícita prevalece (duplicar, importar).
  ok("personagem nasce com o ícone padrão do tipo", ator.img === "icons/svg/mystery-man.svg");
  ok("habilidade e equipamento nascem com os ícones do sistema",
    ator.items.getName("Foco Mental")?.img === "systems/ordem-paranormal-2e/assets/icons/tipos/habilidade.svg"
    && ator.items.getName("Pé de cabra")?.img === "systems/ordem-paranormal-2e/assets/icons/tipos/equipamento.svg");
  {
    const npcIcone = await Actor.create({ name: "icone-npc", type: "npc" });
    ok("npc nasce com o ícone padrão do tipo", npcIcone.img === "icons/svg/cowled.svg");
    await npcIcone.delete();

    const escolhido = await Actor.create({ name: "icone-escolhido", type: "npc", img: "icons/svg/skull.svg" });
    ok("img explícito na criação prevalece sobre o padrão", escolhido.img === "icons/svg/skull.svg");
    await escolhido.delete();

    const itensIcone = await Item.createDocuments([
      { name: "i-ferramenta", type: "ferramenta" },
      { name: "i-poi", type: "ponto-interesse" },
      { name: "i-desafio", type: "desafio-acesso" },
    ]);
    // Por tipo, nunca por índice: `createDocuments` não devolve na ordem de
    // entrada (achado em uso real — a asserção por índice passava por sorte).
    const imgPorTipo = Object.fromEntries(itensIcone.map((i) => [i.type, i.img]));
    ok("ferramenta/poi/desafio nascem com os ícones do sistema",
      imgPorTipo.ferramenta === "systems/ordem-paranormal-2e/assets/icons/tipos/ferramenta.svg"
      && imgPorTipo["ponto-interesse"] === "systems/ordem-paranormal-2e/assets/icons/tipos/ponto-interesse.svg"
      && imgPorTipo["desafio-acesso"] === "systems/ordem-paranormal-2e/assets/icons/tipos/desafio.svg");
    await Item.deleteDocuments(itensIcone.map((i) => i.id));
  }

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
    const estilo = traco && getComputedStyle(traco);
    ok("traço de recurso não é inflado pelo min-height padrão de botão", parseFloat(estilo.height) < 16);
    // O traço é um <button>, e o core arredonda todo botão: numa caixa de 8×12px
    // o raio do core virava um oval, contra a gramática do livro
    // (docs/ESTILO-VISUAL.md). Achado em uso real.
    ok("traço de recurso não é arredondado",
      estilo.borderTopLeftRadius === "0px" && estilo.borderBottomRightRadius === "0px");
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
  // Fase 3: investigação é Actor, com ficha própria — nada aqui depende de Scene,
  // token ou canvas. Uma investigação pode atravessar vários mapas ao mesmo tempo
  // (achado em uso real: o time se move entre cômodos, mas continua na mesma
  // investigação), e POI/Desafio se vinculam a ela, não a uma Scene.

  const investigacao = await game.op2.criarInvestigacao("Mansão de Teste");
  ok("investigação criada com data model próprio", investigacao?.system.constructor.name === "InvestigacaoData");
  ok("investigação é Actor, não Item", investigacao instanceof Actor);
  ok("investigação recém-criada já fica ativa", game.op2.investigacaoAtiva()?.uuid === investigacao.uuid);
  ok("investigação nasce com o ícone do sistema",
    investigacao.img === "systems/ordem-paranormal-2e/assets/icons/tipos/investigacao.svg");
  await game.op2.adicionarParticipante(investigacao, ator.uuid);

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

  await game.op2.vincularPoi(investigacao, poi.uuid, { oculto: false });
  ok("vincular POI grava o UUID no schema da investigação", investigacao.system.pois.includes(poi.uuid));

  // Não existe ação "Investigar": investigar um ponto é Examinar ou Interagir
  // (spec §6.3 — a ação se resolve nas duas sub-ações). A API não expõe outra.
  ok("não existe ação Investigar exposta na API",
    game.op2.investigar === undefined && game.op2.dialogoInvestigar === undefined);

  // Examinar faz os dois passos com a mesma perícia (spec §6.3): Percepção d8
  // entrega a DT 6 de graça, sem rolar, e o teste tenta a DT 10.
  const examinou = await game.op2.examinar(ator, poi.uuid, "percepcao", { rapido: true });
  dados.examinar = examinou && { total: examinou.roll.total, dt: examinou.roll.dt, perdePD: examinou.perdePD };
  ok("examinar rolou sem DT", examinou && examinou.roll.dt === null);
  ok("examinar entrega de graça a DT ≤ tamanho do dado",
    ator.system.estado.infosReveladas.has(`${poi.uuid}:i1`));
  ok("POI marcado como investigado ao examinar", ator.system.estado.poisInvestigados.has(poi.uuid));
  ok("o que veio sem rolar não custa PD", examinou?.perdePD === false);

  await esperar(800);
  const msgs = [...game.messages.values()];
  ok("revelação é sussurrada (dono + mestre)",
    msgs.some((m) => m.getFlag("ordem-paranormal-2e", "tipo") === "investigacao" && m.whisper.length > 0));
  // O card genérico de teste rola sem DT e por isso não dizia nem sucesso nem
  // falha — "veio só os valores" (achado em uso real) — e ainda oferecia Dano
  // RA/RB, que não existe em Examinar. Agora é um card só, com tudo dentro.
  {
    const conteudo = game.messages.contents.at(-1)?.content ?? "";
    ok("o card de Examinar traz os dados rolados", conteudo.includes("op2-card__dados"));
    ok("o card de Examinar diz o desfecho", conteudo.includes("op2-card__desfecho"));
    ok("o card de Examinar não oferece Dano RA/RB",
      !conteudo.includes(game.i18n.localize("OP2.Chat.DanoRA")));
    ok("Examinar não publica também o card genérico de teste",
      game.messages.contents.at(-1)?.getFlag("ordem-paranormal-2e", "tipo") !== "teste");
  }

  ok("o card marca a linha que caiu sem rolar",
    [...document.querySelectorAll(".op2-card")].some((c) => c.querySelector(".op2-card__info-marca")));

  // O último card DESTA chamada — o chat guarda cards de execuções anteriores no
  // mesmo mundo, então contar `.op2-card` na tela inteira dá falso positivo.
  const ultimoCard = game.messages.contents.at(-1)?.content ?? "";
  ok("com algo revelado, o card é de revelação e não o de custo de PD",
    !ultimoCard.includes(game.i18n.localize("OP2.Investigacao.ExaminarSemInfo")));

  // Perícia sem nada no quadro: aí sim é aposta perdida — paga 1 PD e o card diz
  // por quê, em vez de só "nenhuma informação nova" (achado em uso real).
  const semNada = await game.op2.examinar(ator, poi.uuid, "luta", { rapido: true });
  ok("examinar com perícia sem correspondência custa 1 PD", semNada?.perdePD === true);

  // "Amor pela Descoberta" (Antônio, Ato II): informação nova ao Examinar devolve 1 PD,
  // sem passar do máximo. Ponto novo, com uma linha que o dado alcança sem rolar.
  {
    const [amor] = await ator.createEmbeddedDocuments("Item", [{
      name: "Amor pela Descoberta", type: "habilidade",
      system: { efeito: { tipo: "nenhum", pdAoDescobrir: 1 } },
    }]);
    const poiAmor = await Item.create({
      name: "Quadro do Amor", type: "ponto-interesse",
      system: { informacoes: [{ id: "a1", pericia: "percepcao", dt: 5, texto: "<p>Nova.</p>" }] },
    });
    const pdAntes = ator.system.recursos.pd.value;
    const pdMax = ator.system.recursos.pd.max;
    await ator.update({ "system.recursos.pd.value": pdMax - 1 });
    const achou = await game.op2.examinar(ator, poiAmor.uuid, "percepcao", { rapido: true });
    ok("informação nova ao Examinar devolve 1 PD a quem tem Amor pela Descoberta",
      achou?.pdRecuperado === 1 && ator.system.recursos.pd.value === pdMax);
    const deNovo = await game.op2.examinar(ator, poiAmor.uuid, "percepcao", { rapido: true });
    ok("sem informação nova, nada volta (e o PD não passa do máximo)",
      (deNovo?.pdRecuperado ?? 0) === 0 && ator.system.recursos.pd.value <= pdMax);
    await ator.update({ "system.recursos.pd.value": pdAntes });
    await amor.delete();
    await poiAmor.delete();
  }
  await esperar(600);
  ok("o card de custo explica o motivo",
    [...document.querySelectorAll(".op2-card--falha")].some((c) => c.querySelector(".op2-ajuda")));

  /* ------------------------------------------------------------ fase 4 ------ */

  // Ferimentos e traumas (spec §8.2/§8.3): o dano que zera o recurso pede o teste,
  // com DT que escala. Antes disso os contadores existiam sem nada que os movesse.
  {
    const vitima = await Actor.create({ name: "Vítima de Teste", type: "personagem" });
    await vitima.update({
      "system.recursos.pv.max": 4, "system.recursos.pv.value": 3,
      "system.recursos.pd.max": 4, "system.recursos.pd.value": 2,
    });
    const { aplicarDano } = await import("/systems/ordem-paranormal-2e/module/dice/falha-critica.mjs");

    await aplicarDano(vitima, 3, "pv");
    await esperar(600);
    const cardFerimento = game.messages.contents.at(-1)?.content ?? "";
    ok("zerar PV pede teste de ferimento", cardFerimento.includes("rolar-teste-queda"));

    const res = await game.op2.rolarTesteDeQueda(vitima, "ferimento", { rapido: true });
    await esperar(500);
    ok("teste de ferimento usa a DT 7 do primeiro teste", res?.dt === 7);
    ok("o contador sobe mesmo passando (a escalada é por teste feito)",
      vitima.system.estado.testesFerimento === 1 && vitima.system.estado.dtProximoFerimento === 10);

    await aplicarDano(vitima, 2, "pd");
    await esperar(600);
    const cardTrauma = game.messages.contents.at(-1)?.content ?? "";
    ok("zerar PD pede teste de trauma", cardTrauma.includes('data-tipo="trauma"'));

    // Ajuda (spec §4.7): passo pendente que o próximo teste consome.
    const { passosDeAjuda, podeAjudar } = await import("/systems/ordem-paranormal-2e/module/cena/ajuda.mjs");
    ok("d4 não ajuda; d10 dá dois passos", !podeAjudar("d4") && passosDeAjuda("d10") === 2);

    await vitima.update({ "system.pericias.vigor.die": "d6" });
    await vitima.update({ "system.estado.ajuda": { passos: 2, de: "Aliado", pericia: "Medicina" } });
    const comAjuda = await game.op2.rolarTeste(vitima, { chavePericia: "vigor", dt: 7, rapido: true });
    ok("a ajuda sobe o dado da perícia antes de rolar",
      comAjuda.dados.some((d) => (d.componente?.dado ?? d.dado) === "d10"));
    ok("a ajuda é consumida pela rolagem", vitima.system.estado.ajuda.passos === 0);

    // Ímpeto (fichas do Ato I): a barra é a habilidade, e o estado mora nela.
    await vitima.createEmbeddedDocuments("Item", [{
      name: "Ímpeto", type: "habilidade", system: { impeto: { espacos: 3, preenchidos: 1 } },
    }]);
    const { barraDeImpeto, impetoDisponivel } = await import("/systems/ordem-paranormal-2e/module/cena/impeto.mjs");
    ok("a barra é achada pela habilidade, não por campo do personagem",
      barraDeImpeto(vitima)?.name === "Ímpeto" && impetoDisponivel(vitima) === 1);

    // Combate (spec §8.1): teste oposto, esquiva com +d6 somado.
    const bruto = await Actor.create({ name: "Bruto de Teste", type: "personagem" });
    await bruto.update({ "system.pericias.luta.die": "d10" });
    const ataque = await game.op2.atacar(bruto, { alvoUuid: vitima.uuid, armado: true, rapido: true });
    await esperar(400);
    ok("o ataque rola sem DT (teste oposto, spec §4.6)", ataque?.dt === null);
    ok("o card do ataque oferece revidar e esquivar",
      (game.messages.contents.at(-1)?.content ?? "").includes('data-esquiva="true"'));

    const defesa = await game.op2.defender(vitima, {
      atacanteId: bruto.id, totalAtaque: ataque.total, raAtaque: ataque.ra, rbAtaque: ataque.rb,
      armadoAtacante: true, esquiva: true, rapido: true,
    });
    ok("a esquiva soma um d6 aos dados da Acrobacia (única exceção aditiva)",
      defesa.roll.dados.filter((d) => (d.componente?.dado ?? d.dado) === "d6").length >= 1);
    ok("esquiva vencedora não causa dano nenhum",
      defesa.vencedor !== "defensor" || defesa.dano === 0);

    await vitima.delete();
    await bruto.delete();
  }

  // Alvo de ação entre personagens: o roster acumula gente de sessões antigas, e
  // participante oculto não está em cena. Ajudar e Compartilhar são de jogador para
  // jogador — personagem sem dono conectado não é alvo (achado em uso real: "lista
  // todos os personagens cadastrados no Foundry").
  {
    const { alvosDaCenaAtiva } = await import("/systems/ordem-paranormal-2e/module/cena/encerrar-investigacao.mjs");
    const naCena = await Actor.create({ name: "Alvo Em Cena", type: "personagem" });
    const oculto = await Actor.create({ name: "Alvo Oculto", type: "personagem" });
    const npcEmCena = await Actor.create({ name: "NPC Em Cena", type: "npc" });
    const foraDaCena = await Actor.create({ name: "Alvo Fora", type: "personagem" });
    for (const a of [naCena, oculto, npcEmCena]) await game.op2.adicionarParticipante(investigacao, a.uuid);
    await game.op2.alternarOculto(investigacao, "participantes", oculto.uuid);
    await esperar(400);

    const nomes = (opcoes) => alvosDaCenaAtiva(opcoes).map((a) => a.name);
    const paraAtacar = nomes({ exceto: ator, comNpcs: true });
    ok("alvo fora da investigação não é oferecido", !paraAtacar.includes(foraDaCena.name));
    ok("participante oculto não é oferecido", !paraAtacar.includes(oculto.name));
    ok("quem age não aparece na própria lista", !paraAtacar.includes(ator.name));
    ok("NPC em cena é alvo de ataque", paraAtacar.includes(npcEmCena.name));
    ok("NPC não é alvo de Ajudar", !nomes({ exceto: ator }).includes(npcEmCena.name));
    // A mira do Foundry manda: marcou o token, é nele — mesmo fora da investigação.
    // Antes a lista era a única entrada, e marcar o alvo no mapa não fazia nada
    // (achado em uso real).
    {
      const { alvosMarcados } = await import("/systems/ordem-paranormal-2e/module/cena/encerrar-investigacao.mjs");
      const cena = game.scenes.find((c) => c.name === "Alvos") ?? await Scene.create({ name: "Alvos", width: 1000, height: 1000 });
      await cena.activate();
      const [token] = await cena.createEmbeddedDocuments("Token", [{
        name: foraDaCena.name, actorId: foraDaCena.id, x: 500, y: 500, actorLink: true,
      }]);
      await esperar(700);
      canvas.tokens.get(token.id)?.setTarget(true, { releaseOthers: true });
      await esperar(400);

      ok("alvo marcado no mapa vale mesmo fora da investigação",
        alvosMarcados({ exceto: ator }).map((a) => a.name).includes(foraDaCena.name));
      ok("quem age nunca é o próprio alvo marcado",
        !alvosMarcados({ exceto: foraDaCena }).map((a) => a.name).includes(foraDaCena.name));

      await game.op2.atacar(ator, { armado: false, rapido: true });
      await esperar(800);
      ok("com alvo marcado, atacar não pergunta em quem",
        !document.querySelector("select[name='alvo']")
        && (game.messages.contents.at(-1)?.content ?? "").includes(foraDaCena.name));

      canvas.tokens.placeables.forEach((t) => t.setTarget(false, { releaseOthers: false }));
      await cena.deleteEmbeddedDocuments("Token", [token.id]);
    }

    for (const a of [naCena, oculto, npcEmCena, foraDaCena]) {
      await game.op2.removerParticipante(investigacao, a.uuid);
      await a.delete();
    }
  }

  // Habilidade com custo escrito em texto ("2 PD") cobra igual: fichas importadas
  // antes do campo numérico existir não podem sair de graça (achado em uso real).
  {
    const dono = await Actor.create({ name: "Custo Escrito", type: "personagem" });
    await dono.createEmbeddedDocuments("Item", [
      { name: "Foco por texto", type: "habilidade", system: { custo: "2 PD" } },
      { name: "Foco por número", type: "habilidade", system: { custoPD: 3 } },
      { name: "Sem custo", type: "habilidade", system: { custo: "Ação importante" } },
    ]);
    ok("custo em PD é lido do texto quando o número está vazio",
      dono.items.getName("Foco por texto").system.custoEmPD === 2);
    ok("o número preenchido prevalece",
      dono.items.getName("Foco por número").system.custoEmPD === 3);
    ok("custo que não fala em PD não cobra nada",
      dono.items.getName("Sem custo").system.custoEmPD === 0);
    await dono.delete();
  }

  // Limpar a descoberta vale para qualquer personagem que a tenha, não só para quem
  // está no roster da investigação em foco — senão o Examinar seguinte diz "já
  // revelado" para quem ficou de fora (achado em uso real).
  {
    const forasteiro = await Actor.create({ name: "Forasteiro", type: "personagem" });
    await forasteiro.update({ "system.estado.infosReveladas": [`${poi.uuid}:i1`] });
    const antesDoAtor = [...ator.system.estado.infosReveladas];

    const limpos = await game.op2.limparRevelacao(poi.uuid, "i1");
    ok("limpar descoberta alcança quem está fora do roster",
      limpos.includes(forasteiro.name)
      && !forasteiro.system.estado.infosReveladas.has(`${poi.uuid}:i1`));

    // Limpar é global por linha: devolve o que o roteiro seguinte espera encontrar.
    await ator.update({ "system.estado.infosReveladas": antesDoAtor });
    await forasteiro.delete();
  }

  // Botões que envolvem outro personagem: sem alvo possível, não são oferecidos —
  // avisar depois do clique deixava o jogador procurando o que não existe (achado em
  // uso real). E o dano de um card cai em quem o card é, não em quem está selecionado.
  {
    const solitario = await Actor.create({ name: "Solitário", type: "personagem" });
    await game.op2.adicionarParticipante(investigacao, solitario.uuid);
    const app = game.op2.acoesInvestigacao(solitario);
    await esperar(1000);
    const estado = () => Object.fromEntries([...app.element.querySelectorAll("[data-action]")]
      .map((b) => [b.dataset.action, b.disabled]));

    // `ator` já é participante desta investigação, então há um aliado; o que falta ao
    // solitário são itens para usar.
    const semItens = estado();
    ok("Usar habilidade ou item fica desligado sem nada para usar", semItens.usarRecurso === true);

    await solitario.createEmbeddedDocuments("Item", [{ name: "Pé de cabra", type: "equipamento" }]);
    await app.render();
    await esperar(700);
    ok("com item na mochila, a ação liga", estado().usarRecurso === false);

    // Dano do card: Alcançar arriscado com DT impossível sempre falha e oferece o dano.
    await solitario.update({ "system.recursos.pv.max": 10, "system.recursos.pv.value": 10 });
    const pvDoOutro = ator.system.recursos.pv.value;
    await game.op2.alcancar(solitario, { modo: "arriscado", dt: 30, rapido: true });
    await esperar(900);
    const card = game.messages.contents.at(-1);
    const botao = document.querySelector(`[data-message-id="${card.id}"] [data-op2-acao="aplicar-dano"]`);
    ok("card de Alcançar oferece o dano da queda", Boolean(botao));
    botao?.click();
    await esperar(900);
    ok("o dano cai em quem caiu, não no token selecionado",
      solitario.system.recursos.pv.value < 10 && ator.system.recursos.pv.value === pvDoOutro);

    await app.close();
    await game.op2.removerParticipante(investigacao, solitario.uuid);
    await solitario.delete();
  }

  // Dano improvisado a partir de um teste qualquer usa a seleção da cena — e por isso
  // é botão de mestre.
  {
    const conteudo = game.messages.contents
      .filter((m) => m.getFlag("ordem-paranormal-2e", "tipo") === "teste").at(-1)?.content ?? "";
    ok("dano avulso do card de teste é marcado como conteúdo de mestre",
      conteudo.includes('data-op2-acao="aplicar-dano-selecionado"') && conteudo.includes("data-op2-gm"));
  }

  // Dice So Nice: quando os dados já rolaram em 3D antes da escolha (4 rolados → 3
  // contados), a mensagem não pode animar de novo. O DSN decide pela flag `skip` —
  // `dsnHide` nas opções do `toMessage` não existe e era ignorada em silêncio, então
  // a animação rodava duas vezes (achado em uso real).
  {
    const { enviarParaChat } = await import("/systems/ordem-paranormal-2e/module/dice/teste.mjs");
    const { OP2Roll } = await import("/systems/ordem-paranormal-2e/module/dice/op2-roll.mjs");
    const r = OP2Roll.paraComponentes(
      [{ chave: "pericia.percepcao", rotulo: "Percepção", tipo: "pericia", dado: "d8" }],
      { dt: 7, escopoCritico: "todos", rotulo: "Teste", atorId: ator.id },
    );
    await r.evaluate();
    const jaRolou = await enviarParaChat(r, ator, { pularDados3D: true });
    const primeiraVez = await enviarParaChat(r, ator);
    ok("card de dados já animados marca `skip` para o Dice So Nice",
      jaRolou.flags?.["dice-so-nice"]?.skip === true);
    ok("card comum não pede skip — a animação dele é a única",
      primeiraVez.flags?.["dice-so-nice"] === undefined);
  }

  // Editor `toggled` fechado mostra o HTML enriquecido: sem passar `enriched`, o texto
  // salvava e a ficha aparecia vazia (achado em uso real, nas notas do NPC).
  {
    const npc = await Actor.create({ name: "NPC de Notas", type: "npc" });
    await npc.update({ "system.notas": "<p>Chave do porão no bolso.</p>" });
    await npc.sheet.render(true);
    await esperar(900);
    ok("notas do NPC aparecem na ficha depois de salvas",
      (npc.sheet.element.textContent ?? "").includes("Chave do porão"));
    await npc.delete();
  }

  // Layout da ficha: o cabeçalho não pode comer a faixa de conteúdo, e a barra de
  // Ímpeto pertence à habilidade que a concede — no cabeçalho ela aparecia até para
  // quem não tem Ímpeto nenhum (achado em uso real).
  {
    const pack = game.packs.get("ordem-paranormal-2e.ato-i-personagens");
    const entrada = [...pack.index].find((i) => i.name === "Alan");
    const alan = await Actor.create((await pack.getDocument(entrada._id)).toObject());
    await alan.items.getName("Ímpeto").update({ "system.impeto.preenchidos": 2 });
    await alan.sheet.render(true);
    await esperar(900);
    const el = alan.sheet.element;
    const altura = (sel) => Math.round(el.querySelector(sel)?.getBoundingClientRect().height ?? 0);

    ok("retrato não estica com a coluna inteira", altura(".op2-cabecalho__retrato") <= 160);
    ok("a faixa de habilidades/inventário/notas tem espaço de uso", altura(".op2-painel.active") >= 240);
    ok("barra de Ímpeto sai do cabeçalho", !el.querySelector(".op2-cabecalho .op2-impeto"));
    ok("barra de Ímpeto mora na habilidade que a concede",
      el.querySelectorAll(".op2-item--com-barra .op2-impeto__espaco").length === 3);
    ok("a barra mostra o estado gravado na própria habilidade",
      el.querySelectorAll(".op2-item--com-barra .op2-impeto__espaco--cheio").length === 2);
    ok("a descrição da habilidade aparece na ficha",
      (el.textContent ?? "").includes("barra de ímpeto com três espaços"));
    // Descrição carrega regra, não instrução de interface.
    ok("a descrição não explica onde fica a barra",
      !(el.textContent ?? "").includes("A barra fica"));

    // A ficha da habilidade precisa do campo: sem ele não há como transformar uma
    // habilidade em barra, nem conferir os espaços (achado em uso real).
    {
      const barra = alan.items.getName("Ímpeto");
      await barra.sheet.render(true);
      await esperar(800);
      const campo = barra.sheet.element.querySelector('[name="system.impeto.espacos"]');
      ok("ficha da habilidade tem o campo de espaços da barra", Number(campo?.value) === 3);
      ok("ficha da habilidade tem o campo de custo em PD",
        Boolean(barra.sheet.element.querySelector('[name="system.custoPD"]')));
      await barra.sheet.close();
    }

    // A barra É a habilidade: apagar a habilidade tem de levar a barra junto — com o
    // estado no ator, ela sobrevivia ao item (achado em uso real).
    await alan.items.getName("Ímpeto").delete();
    await alan.sheet.render(true);
    await esperar(700);
    ok("apagar a habilidade Ímpeto tira a barra da ficha",
      alan.sheet.element.querySelectorAll(".op2-impeto__espaco").length === 0);

    const npc = await Actor.create({ name: "NPC de Layout", type: "npc" });
    await npc.sheet.render(true);
    await esperar(900);
    const elNpc = npc.sheet.element;
    const larguraNome = elNpc.querySelector(".op2-nome")?.getBoundingClientRect().width ?? 0;
    const larguraFicha = elNpc.querySelector(".window-content")?.getBoundingClientRect().width ?? 1;
    // A grade de três colunas do personagem jogava a identidade na coluna do meio.
    ok("campo de nome do NPC ocupa a linha, não um terço dela",
      larguraNome / larguraFicha > 0.55);

    await alan.delete();
    await npc.delete();
  }

  // Habilidade que vale por atributo, não por perícia: "quando faz um teste mental"
  // (Foco Mental, ficha do Ato I). Casar só a chave da perícia fazia a habilidade
  // nunca aparecer no diálogo (achado em uso real).
  {
    const dono = await Actor.create({ name: "Dono de Habilidade", type: "personagem" });
    await dono.update({ "system.recursos.pd.max": 10, "system.recursos.pd.value": 10 });
    await dono.createEmbeddedDocuments("Item", [{
      name: "Foco Mental", type: "habilidade",
      system: { custoPD: 2, efeito: { tipo: "dado-extra", dado: "d4", chaves: ["mente"] } },
    }]);
    const foco = dono.items.getName("Foco Mental");
    ok("habilidade de atributo se oferece no teste daquele atributo",
      foco.system.aplicavelA("percepcao", "mente") === true);
    ok("e não se oferece quando o atributo pareado é outro",
      foco.system.aplicavelA("atletismo", "fisico") === false);

    const antes = dono.system.recursos.pd.value;
    const roll = await game.op2.rolarTeste(dono, {
      chavePericia: "percepcao", dt: 7, rapido: true,
      // o modo rápido não passa pelo diálogo: o custo é cobrado por quem confirma
    });
    ok("teste rápido não cobra PD de habilidade não escolhida",
      dono.system.recursos.pd.value === antes && Boolean(roll));

    // Ímpeto: os três espaços viram um passo de atributo que o dado precisa sentir.
    await dono.createEmbeddedDocuments("Item", [{
      name: "Ímpeto", type: "habilidade", system: { impeto: { espacos: 3, preenchidos: 3 } },
    }]);
    const barra = dono.items.getName("Ímpeto");
    ok("barra cheia libera o gasto", barra.system.impetoCheio === true);
    await barra.update({ "system.impeto.preenchidos": 0 });
    await dono.update({ "system.estado.aumentosTemporarios.mente": 1 });
    ok("aumento temporário sobe o dado do atributo (era descartado pelo min: 0)",
      dono.system.atributos.mente.dadoEfetivo === "d8"
      && dono.system.atributos.mente.aumentado === true);
    const comAumento = await game.op2.rolarTeste(dono, { chavePericia: "percepcao", dt: 7, rapido: true });
    ok("o dado aumentado entra na rolagem de verdade",
      comAumento.dados.some((d) => (d.componente?.dado ?? d.dado) === "d8"));

    await dono.delete();
  }

  // Sobrecarga mental (spec §7.6): ao encerrar a rodada N vale a linha N da tabela.
  {
    const sobrecarga = investigacao.system.sobrecarga;
    ok("a tabela de sobrecarga vem com a progressão de referência do playtest",
      sobrecarga.tabela.map((l) => `${l.rodada}:${l.dano}`).join(",")
        === "1:0,2:0,3:1,4:1,5:1d4,6:1d4,7:1d6,8:1d6,9:2d4");
    const { danoSobrecarga } = await import("/systems/ordem-paranormal-2e/module/cena/investigacao.mjs");
    ok("rodada 3 cobra 1 de PD, rodada 5 cobra 1d4, rodada 9+ cobra 2d4",
      danoSobrecarga(sobrecarga.tabela, 3) === "1"
      && danoSobrecarga(sobrecarga.tabela, 5) === "1d4"
      && danoSobrecarga(sobrecarga.tabela, 12) === "2d4");
  }

  // Compêndios: o que o mestre importa precisa bater com a ficha publicada.
  {
    const pack = game.packs.get("ordem-paranormal-2e.ato-i-personagens");
    ok("compêndio de pré-gerados do Ato I existe e tem os cinco", pack?.index.size === 5);
    if (pack) {
      const entrada = [...pack.index].find((i) => i.name === "Alan");
      const alan = entrada && await pack.getDocument(entrada._id);
      ok("Alan importa com os valores da ficha publicada",
        alan?.system.atributos.mente.die === "d8"
        && alan?.system.recursos.pd.max === 16
        && alan?.system.pericias.percepcao.die === "d8"
        && alan?.items.find((i) => i.name === "Ímpeto")?.system.impeto.espacos === 3);
      ok("as habilidades vêm junto do pré-gerado",
        alan?.items.map((i) => i.name).sort().join() === "Foco Mental,Ímpeto");
    }
    ok("compêndio de habilidades tem as oito do Ato I e as oito do Ato II",
      game.packs.get("ordem-paranormal-2e.habilidades")?.index.size === 16);
    // Ocupação é texto livre na ficha e concede uma habilidade (spec §2.1): o Item é o
    // atalho que guarda as duas coisas juntas.
    const ocupacoes = game.packs.get("ordem-paranormal-2e.ocupacoes");
    ok("compêndio traz as ocupações das fichas do Ato I", ocupacoes?.index.size === 5);
    if (ocupacoes) {
      const entrada = [...ocupacoes.index].find((i) => i.name === "Operário");
      const ocupacao = entrada && await ocupacoes.getDocument(entrada._id);
      ok("a ocupação declara a habilidade que concede",
        ocupacao?.system.habilidade === "Esforço e Suor");
      ok("e aponta para ela no compêndio de habilidades",
        Boolean(await fromUuid(ocupacao?.system.habilidadeUuid ?? "")));

      const recruta = await Actor.create({ name: "Recruta de Teste", type: "personagem" });
      await recruta.sheet.render(true);
      await esperar(700);

      // Drop de verdade na ficha, com o payload que o Foundry monta ao arrastar do
      // compêndio — chamar `_onDropItem` direto não provaria que o arraste chega lá.
      const soltar = () => {
        const dados = new DataTransfer();
        dados.setData("text/plain", JSON.stringify({ type: "Item", uuid: ocupacao.uuid }));
        recruta.sheet.element.dispatchEvent(
          new DragEvent("drop", { dataTransfer: dados, bubbles: true, cancelable: true }),
        );
      };
      soltar();
      await esperar(1000);
      ok("arrastar a ocupação preenche o campo da ficha", recruta.system.ocupacao === "Operário");
      ok("e traz a habilidade dela, marcada como de ocupação",
        recruta.items.getName("Esforço e Suor")?.system.origem === "ocupacao");
      ok("a ocupação não vira item solto no inventário", recruta.items.size === 1);

      soltar();
      await esperar(900);
      ok("arrastar de novo não duplica a habilidade", recruta.items.size === 1);
      await recruta.delete();
    }

    // Uma cena só, com muros, no lugar dos três mapas: trocar de mapa no meio da
    // sessão perde tokens e estado. As paredes saem da diferença entre os arquivos.
    const cenas = game.packs.get("ordem-paranormal-2e.ato-i-cenas");
    ok("compêndio traz uma cena do Porão, não três", cenas?.index.size === 1);
    if (cenas) {
      const cena = await cenas.getDocument([...cenas.index][0]._id);
      ok("a cena usa o mapa completo", cena._source.background?.src?.includes("completo") === true);
      ok("a cena vem murada", cena.walls.size >= 30);
      ok("e com portas secretas nas passagens escondidas",
        cena.walls.filter((p) => p.door === 2).length >= 4);
      // Com padding, o Foundry desloca o fundo e as paredes caem fora da arte.
      ok("sem padding, para as paredes baterem com a arte", cena.padding === 0);
      ok("visão por token ligada — é o que faz a parede valer", cena.tokenVision === true);

      const importada = await Scene.create(cena.toObject());
      // No v14 o fundo vira documento de nível na carga; se ele não chegar, a cena
      // importa em branco — foi o que aconteceu com o fundo escrito como nível no
      // compêndio, que o Foundry ignora (achado em uso real).
      ok("o mapa chega até a cena importada",
        importada.levels.contents[0]?.background?.src?.includes("completo") === true);

      // Uma casa de tolerância: parede desenhada na mão encosta um pouco fora da borda.
      const tolerancia = importada.grid.size;
      const fora = importada.walls.filter((p) => {
        const [x1, y1, x2, y2] = p.c;
        return Math.min(x1, x2) < -tolerancia || Math.min(y1, y2) < -tolerancia
          || Math.max(x1, x2) > importada.width + tolerancia
          || Math.max(y1, y2) > importada.height + tolerancia;
      });
      ok("nenhuma parede cai longe do mapa", fora.length === 0);
      await importada.delete();
    }

    // A aventura: uma importação entrega a mesa montada. As referências entre os
    // documentos precisam fechar DENTRO do pacote — se um POI da investigação não
    // estiver na aventura, o mestre importa e acha um vínculo quebrado.
    // A aventura é gerada do PDF do playtest, que não vem no repositório: numa cópia
    // limpa o pack existe vazio, e aí não há o que verificar.
    const aventuras = game.packs.get("ordem-paranormal-2e.ato-i-aventura");
    if (aventuras?.index.size) {
      const aventura = await aventuras.getDocument([...aventuras.index][0]._id);
      ok("a aventura traz cena, trilha, handouts, pré-gerados e a investigação",
        aventura.scenes.size === 1 && aventura.playlists.size === 1
        && aventura.journal.size === 4 && aventura.actors.size === 6);
      ok("e os pontos de interesse e desafios do porão", aventura.items.size >= 10);

      // A descrição é a primeira coisa que o mestre lê ao importar: ela não pode
      // descrever uma aventura que não é mais essa.
      ok("a descrição da aventura bate com o que ela traz",
        aventura.description.includes(`${[...aventura.items].filter((i) => i.type === "desafio-acesso").length} desafios`)
        && !/quadro de informações de cada ponto vem vazio/i.test(aventura.description));
      // Quem lê essa tela é o mestre, dentro do Foundry: nada de comando de terminal, e
      // nada de mandar instalar arte — ela viaja no sistema.
      ok("e não manda o mestre instalar nem baixar nada",
        !/npm run|<code>|instal|baix|User Data/i.test(aventura.description));

      // O quadro sai do PDF: perícia, DT e o texto da pista.
      const comQuadro = [...aventura.items].filter((i) => i.type === "ponto-interesse"
        && i.system.informacoes.length);
      ok("os pontos trazem o quadro de informações preenchido", comQuadro.length >= 20);
      // Depois do quadro o livro explica o ponto para o mestre; isso também entra.
      const comNotaDeMestre = [...aventura.items].filter((i) => i.type === "ponto-interesse"
        && i.system.descricaoContextual.length > 80);
      ok("e a leitura de mestre que vem depois do quadro", comNotaDeMestre.length >= 25);
      const linhas = comQuadro.flatMap((i) => i.system.informacoes);
      ok("com perícia válida e DT em toda linha",
        linhas.length >= 60 && linhas.every((l) => l.pericia && Number.isInteger(l.dt) && l.dt > 0));
      ok("e as perícias traduzidas para as chaves do sistema",
        linhas.some((l) => l.pericia.startsWith("aptidao."))
        && linhas.every((l) => l.pericia === "aptidao" || !l.pericia.includes(" ")));

      const investigacao = [...aventura.actors].find((a) => a.type === "investigacao");
      const idsDeItens = new Set([...aventura.items].map((i) => i.id));
      const idsDeAtores = new Set([...aventura.actors].map((a) => a.id));
      const resolve = (uuids, conjunto) => uuids.every((u) => conjunto.has(u.split(".").pop()));
      ok("a investigação já vem com os pontos de interesse vinculados",
        investigacao.system.pois.length >= 31
        && resolve(investigacao.system.pois, idsDeItens));
      ok("com os desafios vinculados",
        investigacao.system.desafios.length >= 10
        && resolve(investigacao.system.desafios, idsDeItens));

      // As caixas laterais do PDF trazem os números prontos — nada é chutado aqui.
      const acessos = [...aventura.items].filter((i) => i.type === "desafio-acesso");
      const deposito = acessos.find((i) => i.name.startsWith("Depósito A"));
      ok("os desafios saem das caixas do PDF com DT, PA e senha",
        deposito?.system.dtObjeto === 10 && deposito.system.pontuacaoAlvo === 10
        && deposito.system.tamanhoSenha === 3 && deposito.system.maxTentativas === 3);
      ok("e a senha não viaja no compêndio: o mestre sorteia na mesa",
        acessos.every((i) => i.system.senha.length === 0));
      const freezer = acessos.find((i) => i.name.includes("Freezer"));
      ok("\"DT Acumulada 12\" vira pontuação alvo, não DT do teste",
        freezer?.system.pontuacaoAlvo === 12 && freezer.system.dtObjeto === 7);
      ok("e com os cinco pré-gerados como participantes",
        investigacao.system.participantes.length === 5
        && resolve(investigacao.system.participantes, idsDeAtores));
      ok("a sobrecarga do porão vem ligada (spec §7.6)",
        investigacao.system.sobrecarga.ativa === true);

      // "Mostre o HANDOUT 02" no texto da pista vira a imagem na descrição de mestre.
      const comHandout = [...aventura.items].filter((i) => i.type === "ponto-interesse"
        && i.system.descricaoContextual.includes("systems/ordem-paranormal-2e/assets/ato-i/handouts/"));
      ok("os pontos que citam handout trazem a imagem na descrição do mestre",
        comHandout.length >= 10);

      /* ---- o import de verdade: o compêndio certo não garante mundo certo ---- */
      // Importar é o único jeito de saber se os UUIDs sobrevivem à travessia: no
      // compêndio eles apontam para dentro da aventura, no mundo têm que apontar para
      // os documentos criados.
      const conteudo = {
        Actor: [...aventura.actors], Item: [...aventura.items],
        Scene: [...aventura.scenes], JournalEntry: [...aventura.journal],
        Playlist: [...aventura.playlists], Folder: [...aventura.folders],
      };
      const colecao = {
        Actor: game.actors, Item: game.items, Scene: game.scenes,
        JournalEntry: game.journal, Playlist: game.playlists, Folder: game.folders,
      };
      // O import é `keepId`: limpar antes e depois deixa o teste repetível e não
      // enche o mundo de teste a cada execução.
      const limpar = async () => {
        for (const [nome, docs] of Object.entries(conteudo)) {
          for (const doc of docs) await colecao[nome].get(doc.id)?.delete().catch(() => {});
        }
      };
      const noMundo = (nome) => conteudo[nome].map((d) => colecao[nome].get(d.id)).filter(Boolean);

      await limpar();
      await aventura.import({ dialog: false });
      ok("importar a aventura cria tudo no mundo",
        noMundo("Actor").length === 6 && noMundo("Item").length === 44
        && noMundo("Scene").length === 1 && noMundo("JournalEntry").length === 4
        && noMundo("Playlist").length === 1);

      // Sem pastas o import despeja 28 itens soltos na raiz do diretório.
      const pastas = noMundo("Folder");
      const raizes = pastas.filter((f) => !f.folder);
      ok("e organiza o que importou em pastas, uma raiz por diretório",
        pastas.length === 8 && raizes.length === 5
        && raizes.every((f) => f.name === "Ato I — O Porão")
        && new Set(raizes.map((f) => f.type)).size === 5);
      const naPasta = (nome) => {
        const alvo = pastas.find((f) => f.name === nome);
        return noMundo("Item").concat(noMundo("Actor")).filter((d) => d.folder?.id === alvo?.id);
      };
      ok("com pontos, desafios e pré-gerados cada um na sua",
        naPasta("Pontos de Interesse").length === 31
        && naPasta("Desafios de Acesso").length === 10
        && naPasta("Pré-gerados").length === 5);
      ok("e nada solto fora de pasta",
        [...noMundo("Actor"), ...noMundo("Item"), ...noMundo("Scene"),
          ...noMundo("JournalEntry"), ...noMundo("Playlist")].every((d) => d.folder));

      const pontosNoMundo = noMundo("Item").filter((i) => i.type === "ponto-interesse");
      const linhasNoMundo = pontosNoMundo.flatMap((i) => i.system.informacoes);
      ok("os pontos chegam ao mundo com o quadro preenchido",
        pontosNoMundo.length === 31 && linhasNoMundo.length === 86
        && linhasNoMundo.every((l) => l.pericia && l.dt > 0 && l.texto.length > 10));
      // Linha com condição no livro ("apenas Victor", "se o ídolo for quebrado") entra
      // como rascunho: Examinar não alcança, o mestre libera quando a condição acontece.
      ok("e as linhas condicionais entram como rascunho, o resto descobrível",
        linhasNoMundo.filter((l) => l.oculta).length === 6
        && linhasNoMundo.every((l) => l.aberta === false)
        && linhasNoMundo.filter((l) => l.oculta).every((l) => /<em>\(/.test(l.texto)));

      const desafiosNoMundo = noMundo("Item").filter((i) => i.type === "desafio-acesso");
      ok("os dez desafios de acesso chegam com os números do livro",
        desafiosNoMundo.length === 10
        && desafiosNoMundo.every((d) => d.system.dtObjeto > 0 && d.system.pontuacaoAlvo > 0
          && Object.values(d.system.abordagens).some(Boolean)));
      // Os dois pontos-chave têm "[EVIDÊNCIA-CHAVE]" no título: sem colchete no regex
      // do extrator, eles não existiam e o quadro deles caía no ponto anterior.
      ok("as duas evidências-chave do porão estão entre os pontos",
        ["Celular de Gustavo", "Computador"].every((n) => pontosNoMundo.some((p) => p.name.includes(n))));

      const celular = desafiosNoMundo.find((d) => d.name.includes("Celular"));
      ok("o celular chega como Hack Social, com o banco de perguntas do livro",
        celular?.system.abordagens.hackSocial === true
        && celular.system.hackSocial.respostasNecessarias === 4
        && celular.system.hackSocial.perguntas.length === 6
        && celular.system.hackSocial.perguntas.some((p) => /Gustavo Alves de Campos/.test(p.resposta)));

      const computador = desafiosNoMundo.find((d) => d.name.includes("Computador"));
      ok("e o computador, com a faixa dizendo quantos segundos o jogador tem",
        computador?.system.hackTecnico.tabela.length === 3
        && computador.system.hackTecnico.tabela[0].segundos === 20
        && computador.system.hackTecnico.tabela.every((l) => /23 x 4 - 25 = 67/.test(l.desafio)));

      // Itens que o livro descreve na prosa, não em quadro nenhum.
      const itensDeMesa = noMundo("Item").filter((i) => i.type === "equipamento");
      const faca = itensDeMesa.find((i) => i.name.includes("Faca"));
      ok("a faca de churrasco e os dois molhos de chaves viram itens",
        itensDeMesa.length === 3 && faca?.system.arma === true
        && itensDeMesa.filter((i) => i.name.startsWith("Molho")).length === 2);

      // As correntes de Edgar: desafio que o livro descreve em caixa baixa, no texto.
      const correntes = desafiosNoMundo.find((d) => d.name.includes("Correntes"));
      ok("as correntes de Edgar viram desafio, mesmo sem caixa no livro",
        correntes?.system.dtObjeto === 10 && correntes.system.pontuacaoAlvo === 10
        && correntes.system.tamanhoSenha === 4 && correntes.system.facesSenha === 4
        && correntes.system.maxTentativas === 2);

      // A estante é enigma + Sustentar: abordagem genérica, não arrombamento.
      // Os vinte livros das cinco prateleiras: é neles que os jogadores caçam os quatro.
      const estantePonto = pontosNoMundo.find((p) => p.name === "Estante de Livros");
      ok("a estante traz as cinco prateleiras com os vinte livros",
        (estantePonto?.system.descricaoContextual.match(/<li>/g) ?? []).length === 20
        && /Prateleira 5/.test(estantePonto.system.descricaoContextual));

      const estante = desafiosNoMundo.find((d) => d.name.startsWith("Estante"));
      ok("a estante entra como obstáculo de Sustentar, com DT, consequência e o enigma",
        /Prateleira 2/.test(estante?.flags["ordem-paranormal-2e"]?.notaDoMestre ?? "")
        && estante?.system.abordagens.sustentar === true
        && estante.system.sustentar.dt === 7
        && /1d4 PV/.test(estante.system.sustentar.aoFalhar));

      // A senha impressa do painel da saída é informação de mestre, não minigame.
      const saida = pontosNoMundo.find((p) => p.name === "Porta de Saída");
      ok("e a senha impressa da porta de saída fica na descrição do mestre",
        /160322/.test(saida?.system.descricaoContextual ?? "")
        && !desafiosNoMundo.some((d) => d.name.includes("Saída")));

      // O painel do Depósito A é Hack Técnico, não arrombamento — a caixa do livro diz.
      const painel = desafiosNoMundo.find((d) => d.name.includes("Painel"));
      ok("e o painel elétrico chega como Hack Técnico, com a tabela do livro em dado",
        painel?.system.abordagens.hackTecnico === true
        && !painel.system.abordagens.arrombar
        && painel.system.hackTecnico.tabela.length === 4
        && painel.system.hackTecnico.tabela[0].desafio === "16 x 5 = 80");

      const investigacaoNoMundo = noMundo("Actor").find((a) => a.type === "investigacao");
      const links = [
        ...investigacaoNoMundo.system.pois,
        ...investigacaoNoMundo.system.desafios,
        ...investigacaoNoMundo.system.participantes,
      ];
      const alvosDoLink = await Promise.all(links.map((uuid) => fromUuid(uuid)));
      ok("a investigação importada resolve pontos, desafios e participantes no mundo",
        links.length === pontosNoMundo.length + desafiosNoMundo.length + 5
        && alvosDoLink.every((d) => d && !d.pack));

      // O roteiro da cena: "A Dívida Precisa Ser Paga" avisa o mestre na rodada certa.
      // O que o mestre lê para abrir e fechar o ato ficava fora do compêndio.
      const roteiro = noMundo("JournalEntry").find((j) => j.name.startsWith("Roteiro"));
      ok("o roteiro do ato traz introdução, cena inicial e narração final",
        roteiro?.pages.size === 3
        && /O Paranormal não vem para nossa Realidade/.test(roteiro.pages.getName("Introdução")?.text.content ?? "")
        && /Alan, Victor e Eloísa acordam/.test(roteiro.pages.getName("O Ídolo de Pedra, Ato I")?.text.content ?? "")
        && /TODOS MORREM/.test(roteiro.pages.getName("Narração final")?.text.content ?? ""));

      const diarioMaldicao = noMundo("JournalEntry").find((j) => j.name.includes("Maldição"));
      ok("o diário da maldição vem com ativação, tabela e as duas caixas do livro",
        diarioMaldicao?.pages.size === 4
        && /teste de Disciplina \(DT 7\)/.test(diarioMaldicao.pages.contents
          .map((pg) => pg.text.content).join(" "))
        && ["A Dívida Foi Paga", "Ídolo Quebrado"].every((n) => diarioMaldicao.pages.getName(n)));

      ok("a investigação traz os eventos de rodada da maldição",
        investigacaoNoMundo.system.eventos.length === 6
        && investigacaoNoMundo.system.eventos.map((e) => e.rodada).join() === "0,4,7,10,13,14"
        && investigacaoNoMundo.system.eventos.every((e) => e.narracao || e.efeito)
        // A rodada 0 é a ativação: o texto completo, não a célula "efeitos descritos acima".
        && /teste de Disciplina \(DT 7\)/.test(
          investigacaoNoMundo.system.eventos.find((e) => e.rodada === 0)?.efeito ?? ""));


      const cenaNoMundo = noMundo("Scene")[0];
      ok("a cena importada tem mapa e as paredes do porão",
        Boolean(cenaNoMundo._source.background?.src) && cenaNoMundo.walls.size >= 30);

      await limpar();
      ok("e apagar o que foi importado devolve o mundo ao estado anterior",
        noMundo("Item").length === 0 && noMundo("Actor").length === 0);
    }

    // O Ato II: a mesma estrutura, mais o setor de ferramentas de cada ponto e as artes
    // que vêm do zip da editora (`module/ui/extras-aventura.mjs`). Gerado do PDF, como o
    // Ato I: numa cópia limpa o pack existe vazio.
    const atoII = game.packs.get("ordem-paranormal-2e.ato-ii-aventura");
    if (atoII?.index.size) {
      const aventura = await atoII.getDocument([...atoII.index][0]._id);
      ok("o Ato II traz cena, os áudios EMF, cinco diários, cinco agentes e a investigação",
        aventura.scenes.size === 1 && aventura.playlists.size === 1
        && aventura.journal.size === 5 && aventura.actors.size === 6);
      const pontos = [...aventura.items].filter((i) => i.type === "ponto-interesse");
      const desafios = [...aventura.items].filter((i) => i.type === "desafio-acesso");
      const ferramentas = [...aventura.items].filter((i) => i.type === "ferramenta");
      ok("com os 25 pontos da legenda do mapa, 3 desafios e as 10 ferramentas da Ordem",
        pontos.length === 25 && desafios.length === 3 && ferramentas.length === 10);
      const linhas = pontos.flatMap((p) => p.system.informacoes);
      ok("as 63 células de DT do livro viram 63 linhas de quadro, com perícia válida",
        linhas.length === 63 && linhas.every((l) => l.pericia && Number.isInteger(l.dt) && l.dt > 0));
      // Cada ponto reage exatamente às ferramentas que a tabela "Locais de uso" (p. 75)
      // diz, e a leitura mora no setor de ferramentas do ponto.
      const chavesDe = (p) => Object.entries(p.system.ferramentas)
        .filter(([k, v]) => k !== "laser" && (typeof v === "string" ? v.trim() : (v?.conjuntos?.length || v?.texto?.trim())))
        .map(([k]) => k).sort().join();
      const porNome = (n) => pontos.find((p) => p.name === n);
      ok("o Freezer lê Câmera, Laboratório, Lanterna UV, EMF e Termômetro (os quatro rótulos 'Laboratório' do livro, corrigidos pela leitura)",
        chavesDe(porNome("Freezer")) === "camera,emf,laboratorio,lanternaUV,termometro");
      ok("o Ídolo lê sete ferramentas, com a Lanterna UV que a tabela do livro esquece",
        chavesDe(porNome("O Ídolo de Pedra")) === "emf,infravermelho,laboratorio,lanternaUV,poRevelador,radio,termometro");
      ok("os pontos de leitura normal não têm reação nenhuma",
        ["Depósito A", "Pôsteres", "Porta de Saída", "Mesa de Sinuca"].every((n) => chavesDe(porNome(n)) === ""));
      ok("o laser identifica exatamente os dez pontos da lista do livro",
        pontos.filter((p) => p.system.ferramentas.laser?.trim()).length === 10
        && Boolean(porNome("Faca de Churrasco").system.ferramentas.laser)
        && !porNome("Pertences de Eloísa").system.ferramentas.laser);
      ok("a sequência mínima do Laboratório vira o número de dados do ponto",
        porNome("O Ídolo de Pedra").system.laboratorioDados === 6
        && porNome("Pertences de Eloísa").system.laboratorioDados === 5);
      const radioAltar = porNome("“Altar” de Madeira").system.ferramentas.radio.conjuntos;
      ok("o rádio do altar traz a solução em oito peças e sete conjuntos falsos",
        radioAltar.length === 8 && radioAltar[0].verdadeiro && radioAltar[0].frase.split(" | ").length === 8
        && radioAltar.filter((c) => !c.verdadeiro).length === 7);
      ok("o do computador, o diálogo em sete falas e cinco falsos",
        porNome("Computador").system.ferramentas.radio.conjuntos[0].frase.split(" | ").length === 7
        && porNome("Computador").system.ferramentas.radio.conjuntos.filter((c) => !c.verdadeiro).length === 5);
      // Erros de diagramação do livro, tratados sem apagar texto (docs/LACUNAS.md).
      ok("o ponto 18 é o Duto de Ventilação, não um segundo 'Símbolo no Teto'",
        Boolean(porNome("Duto de Ventilação")) && pontos.filter((p) => p.name === "Símbolo no Teto").length === 1);
      ok("linha que o livro repete de outro ponto entra como rascunho",
        porNome("Armário de Roupas").system.informacoes.every((l) => l.oculta)
        && porNome("Depósito B").system.informacoes.filter((l) => l.oculta).length === 2);
      ok("o Depósito A recebe a descrição do Ato I no lugar da do Símbolo repetida",
        /grade divisória/.test(porNome("Depósito A").system.descricaoBasica));
      // A caixa do painel vem colada na descrição, e a nota de Edgar vem colada e recuada:
      // nem uma nem outra podem sumir ou vazar para o jogador.
      ok("o Painel Elétrico tem descrição, e a nota de Edgar fica com o mestre",
        /painel de luz antigo/.test(porNome("Depósito A, Painel Elétrico").system.descricaoBasica)
        && porNome("Pertences de Edgar").system.descricaoBasica.length < 80
        && /Não há nenhuma informação relevante/.test(porNome("Pertences de Edgar").system.descricaoContextual));
      // "Todos os jogadores têm livre acesso a todas as informações dos agentes" (p. 73).
      const agentes = [...aventura.actors].filter((a) => a.type === "personagem");
      ok("os cinco agentes vêm legíveis por todo jogador, e Antônio recupera PD ao descobrir",
        agentes.length === 5 && agentes.every((a) => a.ownership.default === 2)
        && agentes.find((a) => a.name === "Antônio")?.items.find((i) => i.name === "Amor pela Descoberta")?.system.efeito.pdAoDescobrir === 1);
      const painel = desafios.find((d) => d.name.includes("Painel"));
      const computador = desafios.find((d) => d.name.includes("Computador"));
      const duto = desafios.find((d) => d.name.includes("Duto"));
      ok("painel, computador e grade do duto viram desafios com os números do livro",
        painel?.system.hackTecnico.tabela.length === 4 && painel.system.hackTecnico.tabela[0].desafio === "16 × 5 = 80"
        && computador?.system.hackTecnico.tabela.map((l) => l.segundos).join() === "20,15,10"
        && duto?.system.abordagens.arrombar === true && duto.system.dtObjeto === 7 && duto.system.pontuacaoAlvo === 10);
      // As pastas dos dois atos não podem dividir id: import é keepId, e a pasta de
      // um ato "roubada" pelo outro levava os pontos junto ao apagar (achado em uso real).
      const atoIParaPastas = game.packs.get("ordem-paranormal-2e.ato-i-aventura");
      if (atoIParaPastas?.index.size) {
        const aventuraI = await atoIParaPastas.getDocument([...atoIParaPastas.index][0]._id);
        const idsI = new Set([...aventuraI.folders].map((f) => f.id));
        ok("as pastas do Ato II não repetem id de pasta do Ato I", ![...aventura.folders].some((f) => idsI.has(f.id)));
      }
      const extras = aventura.flags["ordem-paranormal-2e"]?.extras;
      ok("a aventura declara os arquivos que vêm do zip da editora, com prefixo e pasta",
        extras?.arquivos.length === 31 && extras.pasta === "ato-ii" && extras.prefixo.endsWith("/assets/ato-ii/"));
      const json = JSON.stringify(aventura.toObject());
      ok("todo caminho de arte do Ato II usa esse prefixo — nada do User Data no compêndio",
        !/worlds\//.test(json) && (json.match(/assets\/ato-ii\//g) ?? []).length > 40);
      ok("a descrição da aventura explica o zip e não manda instalar nada",
        /zip/i.test(aventura.description) && !/npm run|instal/i.test(aventura.description));
    }

    // Compêndio organizado em pastas: sem isso vira uma lista solta de sete packs.
    const nossos = game.packs.filter((c) => c.metadata.packageName === "ordem-paranormal-2e");
    ok("todo compêndio do sistema mora numa pasta", nossos.every((c) => Boolean(c.folder)));
    const nomesDePasta = new Set((game.packs.folders ?? []).map((f) => f.name));
    ok("com a hierarquia Regras / Ato I / Ato II dentro do sistema",
      nomesDePasta.has("Ordem Paranormal 2") && nomesDePasta.has("Regras")
      && [...nomesDePasta].some((n) => n.startsWith("Ato I ")) && [...nomesDePasta].some((n) => n.startsWith("Ato II")));

    // As duas faixas liberadas, como playlist pronta.
    const musicas = game.packs.get("ordem-paranormal-2e.ato-i-musicas");
    ok("compêndio traz a trilha do Ato I", musicas?.index.size === 1);
    if (musicas) {
      const trilha = await musicas.getDocument([...musicas.index][0]._id);
      ok("a trilha tem as duas faixas", trilha.sounds.size === 2);
      ok("as faixas moram dentro do sistema",
        trilha.sounds.every((s) => s.path.startsWith("systems/ordem-paranormal-2e/assets/ato-i/musicas/")));
    }

    ok("compêndio de handouts do Ato I existe",
      game.packs.get("ordem-paranormal-2e.ato-i-handouts")?.index.size === 2);

    // As 10 ferramentas da Ordo Realitas (spec §9), prontas para o mestre distribuir.
    const ferramentas = game.packs.get("ordem-paranormal-2e.ferramentas");
    ok("compêndio traz as dez ferramentas da Ordo Realitas", ferramentas?.index.size === 10);

    // Toda imagem de compêndio precisa existir de verdade: caminho errado só aparece
    // como quadro quebrado na sidebar, nunca como erro (achado em uso real).
    {
      const caminhos = new Set();
      for (const nome of ["habilidades", "ferramentas", "ato-i-personagens", "ato-i-handouts"]) {
        const p = game.packs.get(`ordem-paranormal-2e.${nome}`);
        if (!p) continue;
        for (const entrada of p.index) {
          const doc = await p.getDocument(entrada._id);
          if (doc.img) caminhos.add(doc.img);
          for (const item of doc.items ?? []) if (item.img) caminhos.add(item.img);
          if (doc.prototypeToken?.texture?.src) caminhos.add(doc.prototypeToken.texture.src);
          for (const pagina of doc.pages ?? []) if (pagina.src) caminhos.add(pagina.src);
        }
      }
      const quebradas = [];
      for (const caminho of caminhos) {
        const resposta = await fetch(`/${caminho}`, { method: "HEAD" }).catch(() => null);
        if (!resposta?.ok) quebradas.push(caminho);
      }
      // As artes do Ato I passaram a viajar no sistema: acabou a exceção, toda imagem
      // que um compêndio cita tem que carregar.
      ok("nenhuma imagem de compêndio do sistema está quebrada", quebradas.length === 0);
      const doAtoI = [...caminhos].filter((c) => c.includes("/assets/ato-i/"));
      ok("e as do Ato I vêm do próprio sistema, não do User Data",
        doAtoI.length >= 20 && doAtoI.every((c) => c.startsWith("systems/ordem-paranormal-2e/")));

      const icones = [...caminhos].filter((c) => c.includes("/assets/icons/"));
      ok("ferramentas e habilidades têm ícone próprio, não o padrão do tipo",
        icones.length >= 18 && new Set(icones).size === icones.length);
    }
    if (ferramentas) {
      const entrada = [...ferramentas.index].find((i) => i.name === "Pó Revelador");
      const po = entrada && await ferramentas.getDocument(entrada._id);
      ok("Pó Revelador vem com as 5 cargas da regra",
        po?.system.cargas.usa === true && po?.system.cargas.max === 5);
      const semCarga = [...ferramentas.index].find((i) => i.name === "Laser de Varredura");
      const laser = semCarga && await ferramentas.getDocument(semCarga._id);
      ok("ferramenta de uso ilimitado não vem com carga", laser?.system.cargas.usa === false);
    }
  }

  /* ------------------------------------------------------- painel e rodadas -- */

  const painel = game.op2.painelInvestigacao();
  await esperar(1200);
  const painelEl = painel.element;
  ok("painel renderizou", Boolean(painelEl));
  ok("painel lista o POI", Boolean(painelEl?.textContent.includes("Quadro na Parede")));

  // Desfazer uma descoberta sem encerrar a cena — antes disso, uma pista revelada
  // por engano só saía encerrando a investigação inteira (achado em uso real).
  {
    ok("painel mostra quem descobriu a linha",
      Boolean(painelEl?.querySelector(".op2-poi-card__revelado-por")?.textContent.includes(ator.name)));
    const desfazer = painelEl?.querySelector('[data-action="limparRevelacao"]');
    ok("linha descoberta ganha o botão de desfazer", Boolean(desfazer));
    desfazer?.click();
    await esperar(700);
    ok("desfazer tira a revelação da ficha do personagem",
      !ator.system.estado.infosReveladas.has(`${poi.uuid}:i1`));
    ok("desfazer não encerra a cena nem apaga o resto",
      investigacao.system.pois.includes(poi.uuid) && ator.system.estado.poisInvestigados.has(poi.uuid));
  }
  ok("mestre vê as DTs no quadro", Boolean(painelEl?.textContent.includes("DT 10")));

  // Visibilidade da linha do quadro, direto do painel — sem abrir a ficha do POI
  // (achado em uso real: mestre preparando tudo numa tela só). São TRÊS estados:
  // com só "oculta/visível" não existia o do meio, e nada ficava achável — ou a
  // linha estava trancada até pro Examinar, ou já aparecia pronta pro jogador
  // ("não volta a ficar disponível para procurar").
  {
    // O módulo de regras puro, dentro da página: a asserção precisa ser sobre o
    // que Examinar realmente enxerga, não sobre os campos soltos.
    const { resolverInvestigacao } = await import("/systems/ordem-paranormal-2e/module/cena/investigacao.mjs");
    const linha = () => poi.system.informacoes.find((info) => info.id === "i1");
    const botao = () => painelEl?.querySelector('[data-action="cicloVisibilidadeInfo"][data-info-id="i1"]');
    ok("painel tem o botão de visibilidade por informação do quadro", Boolean(botao()));
    ok("o padrão de uma linha nova é descobrível", !linha().oculta && !linha().aberta);

    botao()?.click();
    await esperar(500);
    ok("um clique abre a linha para todos (sem gastar ação)", linha().aberta === true);
    ok("linha aberta some das buscas — não há o que descobrir nela",
      resolverInvestigacao(poi.system.informacoes, "percepcao", 12, new Set()).includes("i1") === false);

    botao()?.click();
    await esperar(500);
    ok("outro clique vira rascunho do mestre", linha().oculta === true && linha().aberta === false);
    await painel.render();
    await esperar(400);
    ok("linha em rascunho ganha a marcação visual no painel",
      Boolean(painelEl?.querySelector(".op2-poi-card__info--oculta")));

    botao()?.click();
    await esperar(500);
    ok("o ciclo fecha de volta em descobrível", !linha().oculta && !linha().aberta);
    ok("descobrível é o único estado que Examinar encontra",
      resolverInvestigacao(poi.system.informacoes, "percepcao", 12, new Set()).includes("i1"));
  }
  ok("painel lista a investigação ativa", Boolean(painelEl?.textContent.includes("Mansão de Teste")));
  ok("participante do roster aparece na seção de Participantes", Boolean(painelEl?.textContent.includes("Alan")));
  ok("tracker de rodadas também lista o participante", Boolean(painelEl?.querySelector(".op2-painel-ordem")?.textContent.includes("Alan")));

  // Participantes repete o mesmo roster da Ordem das Rodadas logo abaixo — vira
  // <details> recolhível pra não rolar a janela duas vezes pela mesma lista.
  ok("seção Participantes é um <details> recolhível",
    painelEl?.querySelector(".op2-painel-secao[data-secao='participantes']")?.tagName === "DETAILS");

  // NPC extra só pra Ordem das Rodadas deixar de ter a seção de NPCs vazia neste
  // roteiro — sem ele não dá pra testar o checkbox de já agiu na linha de NPC.
  const npcInvestigacao = await Actor.create({ name: "Zelador", type: "npc" });
  await game.op2.adicionarParticipante(investigacao, npcInvestigacao.uuid);
  const beto = await Actor.create({ name: "Beto", type: "personagem" });
  await game.op2.adicionarParticipante(investigacao, beto.uuid);
  await painel.render();
  await esperar(400);

  ok("NPC participante aparece na Ordem das Rodadas",
    Boolean(painelEl?.querySelector(".op2-painel-ordem__linha--npc")?.textContent.includes("Zelador")));
  ok("NPC também tem checkbox de já agiu (antes só personagem tinha)",
    [...painelEl.querySelectorAll(".op2-painel-ordem__linha--npc input[data-action='alternarJaAgiu']")].length > 0);

  // Setinhas de subir/descer — alternativa ao drag-and-drop, mais fácil de acertar
  // numa lista curta (achado em uso real: mestre errando o alvo do drop).
  {
    const linhas = () => [...painelEl.querySelectorAll("[data-ator-ordem]")];
    const nomes = () => linhas().map((li) => li.querySelector("span")?.textContent.trim());
    const ordemAntes = linhas().map((li) => li.dataset.atorOrdem);
    ok("Ordem das Rodadas é uma lista só, com personagens e NPCs juntos",
      ordemAntes.length === 3 && linhas().some((li) => li.classList.contains("op2-painel-ordem__linha--npc")));
    ok("primeira linha não tem seta para cima (já é a primeira)",
      linhas()[0]?.querySelector('[data-action="moverParticipante"][data-direcao="-1"]')?.disabled === true);

    linhas()[0]?.querySelector('[data-action="moverParticipante"][data-direcao="1"]')?.click();
    await esperar(500);
    ok("seta para baixo troca a ordem gravada na investigação",
      investigacao.system.ordemParticipantes[0] === ordemAntes[1]
      && investigacao.system.ordemParticipantes[1] === ordemAntes[0]);

    // Separar NPCs num grupo próprio deixava a linha deles imóvel: com um NPC só,
    // as duas setas nasciam desabilitadas (achado em uso real: "os NPCs estão
    // inativos, não dá pra mover").
    const linhaNpc = () => linhas().find((li) => li.classList.contains("op2-painel-ordem__linha--npc"));
    ok("linha de NPC é arrastável como qualquer outra", linhaNpc()?.getAttribute("draggable") === "true");
    ok("NPC não fica com as duas setas desabilitadas",
      [...linhaNpc().querySelectorAll('[data-action="moverParticipante"]')].some((b) => !b.disabled));
    const bordaDireita = (li) => Math.round(li.querySelector(".op2-painel-ordem__setas").getBoundingClientRect().left);
    ok("setas de mover ficam na mesma coluna em toda linha",
      new Set(linhas().map(bordaDireita)).size === 1);

    const nomeNpc = linhaNpc()?.querySelector("span")?.textContent.trim();
    const posicaoAntes = nomes().indexOf(nomeNpc);
    linhaNpc()?.querySelector('[data-action="moverParticipante"][data-direcao="-1"]')?.click();
    await esperar(600);
    ok("NPC sobe na ordem, passando na frente de um personagem",
      nomes().indexOf(nomeNpc) === posicaoAntes - 1);

    // `dragDrop` em DEFAULT_OPTIONS é opção do ApplicationV1 — o V2 ignora, e o
    // painel ficava com `draggable="true"` sem handler nenhum: arrastar não
    // reordenava nada (achado em uso real).
    ok("o painel cria a instância de DragDrop do ApplicationV2",
      typeof painel._dragDrop?.bind === "function"
      && typeof painelEl.querySelector("[data-ator-ordem]")?.ondragstart === "function");

    // Soltar de verdade: o NPC no fim da lista.
    {
      const alvo = linhas().at(-1);
      const uuidNpc = linhaNpc().dataset.atorOrdem;
      const dt = new DataTransfer();
      dt.setData("text/plain", JSON.stringify({ tipo: "ordem", atorUuid: uuidNpc }));
      const caixa = alvo.getBoundingClientRect();
      alvo.dispatchEvent(new DragEvent("drop", {
        dataTransfer: dt, bubbles: true, cancelable: true, clientY: caixa.bottom - 2,
      }));
      await esperar(600);
      ok("arrastar reordena a lista, NPC incluído",
        investigacao.system.ordemParticipantes.at(-1) === uuidNpc);
    }
  }

  await game.op2.removerParticipante(investigacao, beto.uuid);
  await beto.delete();
  await painel.render();
  await esperar(400);

  // Mostrar/ocultar: o mestre prepara POI/desafio/participante com antecedência sem
  // revelar na hora aos jogadores (achado em uso real).
  await game.op2.alternarOculto(investigacao, "pois", poi.uuid);
  await game.op2.alternarOculto(investigacao, "participantes", npcInvestigacao.uuid);
  await painel.render();
  await esperar(400);
  ok("mestre ainda vê o POI oculto, só marcado", Boolean(painelEl?.querySelector(".op2-poi-card--oculto")));
  ok("mestre ainda vê o NPC oculto na Ordem das Rodadas", painelEl?.textContent.includes("Zelador"));

  {
    // Sem segundo usuário disponível neste roteiro headless: simula a visão do
    // jogador virando `game.user.isGM` por um render e desfazendo depois — o
    // `_prepareContext()` só lê esse valor na hora de renderizar.
    Object.defineProperty(game.user, "isGM", { value: false, configurable: true });
    await painel.render();
    await esperar(400);

    ok("POI oculto some da tela do jogador", !painelEl?.textContent.includes("Quadro na Parede"));
    ok("jogador não tem a aba Preparação — só Pontos de interesse e Desafios",
      [...painelEl.querySelectorAll(".op2-abas [data-tab]")].map((b) => b.dataset.tab).join(",") === "pontos,desafios"
      && !painelEl.querySelector(".op2-painel-aba[data-tab='preparacao']")
      && Boolean(painelEl.querySelector(".op2-painel-aba.active")));

    // O quadro na tela do jogador é só o que o mestre abriu + o que ESTE
    // personagem descobriu. Antes bastava não ser rascunho pra linha aparecer
    // pronta, e aí não sobrava nada pra procurar (achado em uso real).
    {
      const visivel = await Item.create({ name: "Vitrine", type: "ponto-interesse", system: {
        informacoes: [
          { id: "va", pericia: "percepcao", dt: 6, texto: "PISTA-ABERTA" },
          { id: "vb", pericia: "percepcao", dt: 6, texto: "PISTA-DESCOBRIVEL" },
        ],
      } });
      await game.op2.vincularPoi(investigacao, visivel.uuid, { oculto: false });
      // Abrir a linha é ato de mestre e passa pela ponte `comoMestre`: com o
      // `isGM` fingido de falso ela sairia pelo socket e não voltaria para este
      // mesmo cliente. Vira mestre só para o preparo.
      Object.defineProperty(game.user, "isGM", { value: true, configurable: true });
      await game.op2.cicloVisibilidadeInfo(visivel.uuid, "va");
      await esperar(400);
      Object.defineProperty(game.user, "isGM", { value: false, configurable: true });
      await painel.render();
      await esperar(400);
      const texto = painelEl?.textContent ?? "";
      ok("jogador vê a linha que o mestre abriu", texto.includes("PISTA-ABERTA"));
      ok("jogador NÃO vê a linha descobrível antes de descobrir", !texto.includes("PISTA-DESCOBRIVEL"));

      await game.op2.examinar(ator, visivel.uuid, "percepcao", { rapido: true });
      await esperar(600);
      await painel.render();
      await esperar(400);
      ok("depois de Examinar, a linha descoberta aparece pro jogador",
        (painelEl?.textContent ?? "").includes("PISTA-DESCOBRIVEL"));
      ok("linha descoberta vem marcada como descoberta na tela do jogador",
        Boolean(painelEl?.querySelector(".op2-poi-card__info--descoberta")));

      await game.op2.removerPoi(investigacao, visivel.uuid);
      await visivel.delete();
    }
    ok("NPC oculto some da tela do jogador", !painelEl?.textContent.includes("Zelador"));
    // Marcar "já agiu" grava na Investigação, e o jogador não é dono desse Actor —
    // o clique gerava um erro de permissão visível no core (achado em uso real).
    // O checkbox vem desabilitado pro jogador pra nem parecer clicável.
    const checkboxesJaAgiu = [...painelEl.querySelectorAll("input[data-action='alternarJaAgiu']")];
    ok("checkbox de já agiu vem desabilitado para o jogador", checkboxesJaAgiu.length > 0 && checkboxesJaAgiu.every((cb) => cb.disabled));
    // O nome da investigação aparecia duas vezes na tela do jogador: uma no
    // seletor (que devia mostrar isso só pro mestre) e outra no cabeçalho.
    const ocorrenciasNome = [...painelEl.querySelectorAll(".op2-tag--pequena")]
      .filter((tag) => tag.textContent.trim() === investigacao.name).length;
    ok("nome da investigação não repete na tela do jogador", ocorrenciasNome === 1);

    delete game.user.isGM;
    await painel.render();
    await esperar(400);
  }

  // Desfaz a ocultação: os testes de ficha/painel logo abaixo esperam o POI
  // "Quadro na Parede" visível de novo.
  await game.op2.alternarOculto(investigacao, "pois", poi.uuid);
  await game.op2.alternarOculto(investigacao, "participantes", npcInvestigacao.uuid);
  await painel.render();
  await esperar(400);

  /* ------------------------------------- investigações múltiplas em jogo ----- */
  // O grupo pode se dividir em mais de uma investigação "em jogo" ao mesmo tempo
  // (achado em uso real). "Em jogo" é ponteiro de MUNDO (só o mestre marca); "vendo
  // agora" é ponteiro de CLIENTE (cada um navega entre as suas).
  {
    // Quem só usa uma investigação não pode precisar entender o checkbox: criar já
    // marca "em jogo" e já seleciona para quem criou — o fluxo de antes não muda.
    ok("investigação recém-criada já está em jogo",
      game.settings.get("ordem-paranormal-2e", "investigacoesAtivasUuids").includes(investigacao.uuid));
    ok("checkbox Em jogo já vem marcado para o mestre",
      painelEl.querySelector('[data-action="alternarAtiva"]')?.checked === true);

    const delegacia = await game.op2.criarInvestigacao("Delegacia de Teste");
    await game.op2.adicionarParticipante(delegacia, ator.uuid);
    // criarInvestigacao aponta o mestre para a nova; este roteiro segue na Mansão.
    await game.op2.definirInvestigacaoAtiva(investigacao.uuid);
    await painel.render();
    await esperar(400);
    // Pelas duas DESTA rodada, não pelo total do mundo: o mundo descartável
    // acumula investigações de execuções anteriores que morreram no meio, e uma
    // contagem global vira falha fantasma (achado em uso real).
    {
      const valores = [...painelEl.querySelectorAll("[data-seletor-investigacao] option[value]:not([value=''])")]
        .map((o) => o.value);
      ok("seletor do mestre lista as duas investigações desta rodada",
        valores.includes(investigacao.uuid) && valores.includes(delegacia.uuid));
    }

    // Jogador com personagem participante das duas navega sozinho entre elas.
    Object.defineProperty(game.user, "isGM", { value: false, configurable: true });
    await painel.render();
    await esperar(400);
    const seletorJogador = painelEl.querySelector("[data-seletor-investigacao]");
    ok("jogador participante também tem seletor", Boolean(seletorJogador));
    {
      const valoresJogador = [...(seletorJogador?.querySelectorAll("option") ?? [])].map((o) => o.value);
      ok("jogador vê as duas investigações em jogo em que participa",
        valoresJogador.includes(investigacao.uuid) && valoresJogador.includes(delegacia.uuid));
    }
    // Marcar "em jogo" grava num setting de mundo — bastidor do mestre, como todo
    // o resto do painel; o checkbox nem renderiza para o jogador.
    ok("checkbox Em jogo não aparece para o jogador (mestre-only)",
      !painelEl.querySelector('[data-action="alternarAtiva"]'));

    seletorJogador.value = delegacia.uuid;
    seletorJogador.dispatchEvent(new Event("change"));
    await esperar(600);
    ok("jogador troca a investigação que está vendo (ponteiro de cliente)",
      game.settings.get("ordem-paranormal-2e", "investigacaoVisualizandoUuid") === delegacia.uuid);
    ok("painel do jogador passa a mostrar a investigação escolhida",
      Boolean(painelEl.textContent.includes("Delegacia de Teste")));
    ok("conteúdo da outra investigação não vaza na visão trocada",
      !painelEl.textContent.includes("Quadro na Parede"));

    // Sem personagem atribuído: nada visível — aviso amigável, painel íntegro.
    // `character` é propriedade PRÓPRIA da instância de User, não um getter no
    // protótipo — `delete` a removeria de vez; guarda o descritor e restaura.
    const descCharacter = Object.getOwnPropertyDescriptor(game.user, "character");
    Object.defineProperty(game.user, "character", { value: null, configurable: true });
    await painel.render();
    await esperar(400);
    ok("jogador sem personagem vê o aviso de nenhuma investigação",
      Boolean(painelEl.textContent.includes(game.i18n.localize("OP2.Painel.SemInvestigacao"))));
    ok("sem investigação visível o painel não renderiza seções de jogo",
      !painelEl.querySelector("[data-seletor-investigacao]") && !painelEl.querySelector(".op2-painel-ordem"));
    // Achado em uso real: o texto de ajuda era o mesmo pro mestre e pro jogador —
    // "escolha uma investigação ou crie uma nova", que o jogador não tem como fazer
    // (nem seletor nem botão de criar aparecem pra ele). Cada situação tem seu aviso.
    ok("jogador sem personagem vê o aviso de atribuir personagem, não o texto do mestre",
      painelEl.textContent.includes(game.i18n.localize("OP2.Painel.SemPersonagem"))
      && !painelEl.textContent.includes(game.i18n.localize("OP2.Painel.SemInvestigacaoAjudaGM")));
    Object.defineProperty(game.user, "character", descCharacter);

    // Personagem atribuído, mas fora de qualquer investigação em jogo: outro aviso,
    // também sem o texto do mestre.
    {
      const semParticipacao = await Actor.create({ name: "Sem Investigação", type: "personagem" });
      const descCharacter2 = Object.getOwnPropertyDescriptor(game.user, "character");
      Object.defineProperty(game.user, "character", { value: semParticipacao, configurable: true });
      await painel.render();
      await esperar(400);
      ok("jogador com personagem fora de qualquer investigação em jogo vê aviso específico",
        painelEl.textContent.includes(game.i18n.localize("OP2.Painel.SemInvestigacaoAjudaJogador"))
        && !painelEl.textContent.includes(game.i18n.localize("OP2.Painel.SemInvestigacaoAjudaGM")));
      Object.defineProperty(game.user, "character", descCharacter2);
      await semParticipacao.delete();
    }

    // O mestre tirando de jogo é o que tira a investigação do seletor do jogador.
    delete game.user.isGM;
    await game.op2.definirInvestigacaoAtiva(delegacia.uuid);
    await painel.render();
    await esperar(400);
    painelEl.querySelector('[data-action="alternarAtiva"]')?.click();
    await esperar(400);
    ok("desmarcar Em jogo tira a investigação do setting de mundo",
      !game.settings.get("ordem-paranormal-2e", "investigacoesAtivasUuids").includes(delegacia.uuid));

    Object.defineProperty(game.user, "isGM", { value: false, configurable: true });
    await painel.render();
    await esperar(400);
    ok("investigação fora de jogo some do seletor do jogador",
      ![...painelEl.querySelectorAll("[data-seletor-investigacao] option")]
        .map((o) => o.value).includes(delegacia.uuid));
    delete game.user.isGM;

    await delegacia.delete();
    await game.op2.definirInvestigacaoAtiva(investigacao.uuid);
    await painel.render();
    await esperar(400);
  }

  dados.controles = Object.keys(ui.controls?.controls ?? {});
  // O framework de scene controls do core nunca redispara o clique de uma tool já
  // ativa (`if (tool === this.tool) return` em #onChangeTool) — um botão flutuante
  // fora desse ciclo abre o painel de verdade, toda vez (achado em uso real).
  ok("botão flutuante do painel existe fora do controle de cena", Boolean(document.getElementById("op2-botao-painel")));
  ok("seletor de investigação lista a criada", Boolean(painelEl?.querySelector('[data-seletor-investigacao] option[value]:not([value=""])')));
  // O select usava data-action, que liga no framework de ações e reage ao clique
  // de abrir o dropdown — o próprio ato de abrir já disparava um re-render que
  // fechava o menu nativo no meio, "piscando" as opções sem deixar escolher
  // (achado em uso real). Trocado por listener manual de change, como os outros
  // <select> do sistema.
  ok("select de investigação não usa data-action (evita o re-render no clique de abrir)",
    !painelEl?.querySelector('[data-seletor-investigacao]')?.dataset.action);
  ok("botão de nova investigação existe", Boolean(painelEl?.querySelector('[data-action="criarInvestigacao"]')));

  await investigacao.sheet.render(true);
  await esperar(600);
  ok("ficha da investigação renderizou", Boolean(investigacao.sheet.element));
  // Achado em uso real: TYPES.Actor.investigacao só existia como TYPES.Item — o
  // título da janela mostrava a chave crua em vez do nome traduzido.
  ok("título da janela não vaza a chave de tradução crua",
    !investigacao.sheet.element?.closest(".application")?.querySelector(".window-title")?.textContent.includes("TYPES."));

  // A ficha de investigação sem overflow-y crescia sem teto, igual o painel já
  // tinha corrigido antes — e os botões de editar/desvincular por linha saíam
  // afastados um do outro em vez de colados na borda (dois `margin-left: auto`
  // dividem o espaço livre ao meio) — os dois achados em uso real.
  {
    const wc = investigacao.sheet.element.querySelector(".window-content");
    ok("ficha da investigação tem rolagem interna", getComputedStyle(wc).overflowY === "auto");

    // A ficha é a mesma tela do painel (achado em uso real: "não rola colocar essa
    // mesma tela no cadastro?"): coluna da ordem à esquerda, as três abas à direita,
    // e o nome editável no lugar do seletor.
    const fichaEl = investigacao.sheet.element;
    ok("a ficha da investigação é a mesma tela do painel: ordem à esquerda, três abas e o nome editável",
      Boolean(fichaEl.querySelector(".op2-painel-lateral .op2-painel-ordem"))
      && [...fichaEl.querySelectorAll(".op2-abas [data-tab]")].map((b) => b.dataset.tab).join(",") === "preparacao,pontos,desafios"
      && Boolean(fichaEl.querySelector(".op2-painel-lateral input[name='name']"))
      && Boolean(fichaEl.querySelector(".op2-painel-aba[data-tab='preparacao'] [data-evento-linha], .op2-painel-aba[data-tab='preparacao'] [data-action='adicionarEvento']")));
    investigacao.sheet.changeTab("pontos", "principal");
    const cardPoi = [...fichaEl.querySelectorAll("[data-poi-card]")]
      .find((li) => li.textContent.includes("Quadro na Parede"));
    // Os três últimos botões do card: ocultar/mostrar, editar, desvincular.
    const botoes = [...(cardPoi?.querySelectorAll(".op2-poi-card__acoes-gm .op2-botao") ?? [])].slice(-3).map((b) => b.getBoundingClientRect());
    ok("a ficha mostra o ponto como card, com ocultar/editar/desvincular colados",
      botoes.length === 3 && botoes[0].width > 0
      && (botoes[1].left - botoes[0].right) < 12
      && (botoes[2].left - botoes[1].right) < 12);

    const botaoOcultar = cardPoi?.querySelector('[data-action="alternarOculto"]');
    ok("ficha da investigação tem botão de ocultar/mostrar por POI, com o campo certo",
      botaoOcultar?.dataset.campo === "pois" && botaoOcultar?.dataset.uuid === poi.uuid);
  }

  await investigacao.sheet.close();

  // `position: { height: "auto" }` cresce sem teto — numa cena cheia a janela
  // passava da tela e o conteúdo de baixo ficava cortado, sem como rolar até ele
  // nem arrastar um item ali (achado em uso real).
  {
    const wc = painelEl.querySelector(".window-content");
    ok("painel tem rolagem interna, não cresce sem teto", getComputedStyle(wc).overflowY === "auto");
  }

  await investigacao.update({ "system.sobrecarga": { ativa: true, tabela: [{ rodada: 1, dano: "1" }] } });
  await game.op2.avancarRodada();
  await game.op2.avancarRodada(); // encerra a rodada 1 → dano "1"
  await esperar(1000);
  ok("rodada avançou", investigacao.system.rodada === 2);
  const botaoSobrecarga = document.querySelector('[data-op2-acao="rolar-sobrecarga"]');
  ok("card de sobrecarga tem botão por personagem", Boolean(botaoSobrecarga));

  const pdAntes = ator.system.recursos.pd.value;
  botaoSobrecarga?.click();
  await esperar(800);
  dados.sobrecarga = { pdAntes, pdDepois: ator.system.recursos.pd.value };
  ok("sobrecarga aplicou 1 de dano emocional", ator.system.recursos.pd.value === pdAntes - 1);

  // Trava de 1×-por-investigação: no painel ela é estado (quem usou), não botão —
  // quem usa Recapitular é um personagem, pela ficha dele.
  await investigacao.update({ "system.recapitularUsado": { usado: true, atorId: ator.id, nome: ator.name } });
  await painel.render();
  await esperar(800);
  ok("painel mostra a trava de Recapitular com quem usou",
    Boolean(painel.element?.querySelector(".op2-painel-travas")?.textContent.includes(ator.name)));
  ok("trava aparece como estado, não como botão no painel",
    !painel.element?.querySelector('[data-action="recapitular"]'));

  {
    // E nas ações da ficha o botão vem desabilitado pela trava.
    const app = game.op2.acoesInvestigacao(ator);
    await esperar(700);
    const botao = document.getElementById(`op2-acoes-${ator.id}`)?.querySelector('[data-action="recapitular"]');
    ok("trava desabilita Recapitular nas ações da ficha", botao?.disabled === true);
    await app.close();
  }

  // Encerrar a investigação limpa revelações, travas e o contador de rodadas —
  // mas não o roster de participantes, nem os POIs/desafios vinculados, nem a
  // investigação em si (ela continua existindo, só "zerada" para a próxima sessão).
  // O aumento do Ímpeto também vale "até o fim da cena": encerrar precisa zerar.
  await ator.update({ "system.estado.aumentosTemporarios.mente": 1 });
  await game.op2.encerrarCena({ avisar: false });
  await esperar(500);
  ok("encerrar investigação desfaz o aumento temporário do Ímpeto",
    ator.system.estado.aumentosTemporarios.mente === 0);
  dados.encerrar = {
    infos: ator.system.estado.infosReveladas.size,
    rodada: investigacao.system.rodada,
    trava: investigacao.system.recapitularUsado.usado,
  };
  ok("encerrar investigação limpa revelações do actor", ator.system.estado.infosReveladas.size === 0);
  ok("encerrar investigação limpa rodada e travas", dados.encerrar.rodada === 0 && dados.encerrar.trava === false);
  ok("encerrar investigação não desvincula POI nem tira participante",
    investigacao.system.pois.includes(poi.uuid) && investigacao.system.participantes.includes(ator.uuid));

  // Trocar de Scene não deveria afetar nada da investigação (motivo da mudança:
  // uma investigação pode atravessar vários mapas ao mesmo tempo).
  await Scene.create({ name: "Sala 2", active: true });
  await esperar(1500);
  ok("trocar de Scene mantém a investigação ativa", game.op2.investigacaoAtiva()?.uuid === investigacao.uuid);
  ok("participantes sobrevivem à troca de Scene", investigacao.system.participantes.includes(ator.uuid));
  ok("POIs vinculados sobrevivem à troca de Scene", investigacao.system.pois.includes(poi.uuid));

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
    const arrombou1 = await comDadosNoMaximo(() => game.op2.arrombar(ator, fechadura.uuid, { rapido: true }));
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

    // Painel: seção "Desafios" lista os itens vinculados à investigação (mesmo
    // padrão de vincular POI já testado acima), com progresso e botão de Arrombar.
    await game.op2.vincularDesafio(investigacao, fechadura.uuid, { oculto: false });
    await game.op2.vincularDesafio(investigacao, cofre.uuid, { oculto: false });
    await painel.render();
    await esperar(800);
    ok("painel lista os desafios vinculados à investigação",
      Boolean(painel.element?.textContent.includes("Fechadura Emperrada"))
      && Boolean(painel.element?.textContent.includes("Cofre Blindado")));
    ok("painel mostra o progresso do desafio (1 / 1)", Boolean(painel.element?.textContent.includes("1 / 1")));

    // Ajuste fino da pontuação pelo painel, sem abrir a ficha nem rolar Arrombar
    // (bookkeeping do mestre — pedido de uso real). Trava em [0, pontuacaoAlvo].
    {
      // Cada update re-renderiza o painel e troca os nós — consultar de novo a
      // cada clique, não guardar o botão de um render anterior.
      const botao = (delta) => [...painel.element.querySelectorAll('[data-action="ajustarPontuacaoDesafio"]')]
        .find((b) => b.dataset.desafioUuid === fechadura.uuid && b.dataset.delta === String(delta));
      ok("painel tem os botões +/- de pontuação por desafio", Boolean(botao(-1) && botao(1)));

      botao(1).click();
      await esperar(400);
      ok("botão + não passa da pontuação alvo (trava em 1/1)", fechadura.system.pontuacaoAtual === 1);
      botao(-1).click();
      await esperar(400);
      ok("botão − diminui a pontuação (1 → 0)", fechadura.system.pontuacaoAtual === 0);
      botao(-1).click();
      await esperar(400);
      ok("botão − não desce de zero", fechadura.system.pontuacaoAtual === 0);
      botao(1).click();
      await esperar(400);
      ok("botão + aumenta a pontuação (0 → 1)", fechadura.system.pontuacaoAtual === 1);
    }

    // Ajuste é bastidor do mestre: para o jogador os botões nem renderizam — só
    // o texto do progresso, como antes.
    {
      Object.defineProperty(game.user, "isGM", { value: false, configurable: true });
      await painel.render();
      await esperar(400);
      ok("botões +/- de pontuação não aparecem para o jogador",
        !painel.element.querySelector('[data-action="ajustarPontuacaoDesafio"]'));
      ok("jogador ainda vê o progresso como texto", Boolean(painel.element?.textContent.includes("1 / 1")));
      delete game.user.isGM;
      await painel.render();
      await esperar(400);
    }
    // Arrombar mora nas ações da ficha, não no painel — o painel é só gestão.
    {
      ok("painel não tem mais botão de ação de personagem (Arrombar)",
        !painel.element.querySelector('[data-action="arrombar"]'));

      const appAcoes = game.op2.acoesInvestigacao(ator);
      await esperar(700);
      const elAcoes = document.getElementById(`op2-acoes-${ator.id}`);
      const botaoArrombarCofre = [...elAcoes.querySelectorAll('[data-action="arrombar"]')]
        .find((b) => b.dataset.desafioUuid === cofre.uuid);
      ok("ações da ficha oferecem Arrombar por desafio", Boolean(botaoArrombarCofre));
      ok("desafio quebrado desabilita o botão Arrombar", botaoArrombarCofre?.disabled === true);
      // Achado junto: um botão desabilitado era visualmente idêntico a um clicável.
      ok("botão desabilitado parece desabilitado (opacidade reduzida)",
        parseFloat(getComputedStyle(botaoArrombarCofre).opacity) < 1);
      await appAcoes.close();
    }

    // Mostrar/ocultar também vale para desafios de acesso, não só POI.
    await game.op2.alternarOculto(investigacao, "desafios", fechadura.uuid);
    await painel.render();
    await esperar(400);
    ok("desafio oculto ganha a marcação visual para o mestre",
      Boolean([...painel.element.querySelectorAll(".op2-poi-card--oculto")]
        .find((card) => card.textContent.includes("Fechadura Emperrada"))));
    await game.op2.alternarOculto(investigacao, "desafios", fechadura.uuid);
    await painel.render();
    await esperar(400);

    // Ficha do desafio: campos + barra de progresso visual.
    await fechadura.sheet.render(true);
    await esperar(800);
    const desafioEl = fechadura.sheet.element;
    ok("ficha do desafio renderizou", Boolean(desafioEl));
    ok("barra de progresso reflete pontuacaoAtual/pontuacaoAlvo (100%)",
      desafioEl?.querySelector(".op2-progresso__preenchido")?.style.width === "100%");

    // Steppers de +/- ao lado dos campos numéricos (pedido de uso real: ajustar
    // pela ficha tinha que ser tão simples quanto pelo painel). O input continua
    // editável à mão — o botão é atalho, não substituto.
    {
      const passo = (acao, delta) => desafioEl.querySelector(`[data-action="${acao}"][data-delta="${delta}"]`);
      ok("ficha tem stepper de pontuação ao lado do input editável",
        Boolean(passo("ajustarPontuacao", -1) && passo("ajustarPontuacao", 1)
          && desafioEl.querySelector("input[name='system.pontuacaoAtual']")));

      passo("ajustarPontuacao", 1).click();
      await esperar(400);
      ok("stepper da ficha não passa da alvo (trava em 1)", fechadura.system.pontuacaoAtual === 1);
      passo("ajustarPontuacao", -1).click();
      await esperar(400);
      ok("stepper da ficha diminui (1 → 0) e a barra acompanha",
        fechadura.system.pontuacaoAtual === 0
        && desafioEl.querySelector(".op2-progresso__preenchido")?.style.width === "0%");
      passo("ajustarPontuacao", 1).click();
      await esperar(400);
      ok("stepper da ficha aumenta (0 → 1)", fechadura.system.pontuacaoAtual === 1);

      // tentativasUsadas: maxTentativas 0 = sem limite — só trava no zero.
      const tentAntes = fechadura.system.tentativasUsadas;
      passo("ajustarTentativas", 1).click();
      await esperar(400);
      passo("ajustarTentativas", 1).click();
      await esperar(400);
      ok("stepper de tentativas sobe sem teto quando maxTentativas = 0",
        fechadura.system.tentativasUsadas === tentAntes + 2);
      passo("ajustarTentativas", -1).click();
      await esperar(400);
      ok("stepper de tentativas desce", fechadura.system.tentativasUsadas === tentAntes + 1);
    }

    // A ficha segue as abordagens: bloco de hack só existe se o mestre marcou a
    // abordagem naquele obstáculo (achado em uso real — a ficha despejava tudo).
    ok("ficha não mostra bloco de hack num desafio que não é de hackear",
      !desafioEl.querySelector('[data-action="iniciarTimerHack"]')
      && !desafioEl.querySelector('[data-action="adicionarPerguntaHack"]'));

    await fechadura.update({ "system.abordagens.hackTecnico": true, "system.abordagens.hackSocial": true });
    await esperar(600);

    // Hackear na ficha: banco de perguntas do hack social + timer visual do
    // hack técnico (spec §7.3 pede "ferramenta de GM: timer + banco de perguntas").
    {
      desafioEl.querySelector('[data-action="adicionarPerguntaHack"]')?.click();
      await esperar(500);
      ok("nova pergunta do hack social tem campo de pergunta e de resposta",
        Boolean(desafioEl.querySelector("input[name='system.hackSocial.perguntas.0.pergunta']"))
        && Boolean(desafioEl.querySelector("input[name='system.hackSocial.perguntas.0.resposta']")));

      desafioEl.querySelector('[data-action="removerPerguntaHack"][data-indice="0"]')?.click();
      await esperar(500);
      ok("remover pergunta tira a linha do banco", fechadura.system.hackSocial.perguntas.length === 0);

      const botaoTimer = desafioEl.querySelector('[data-action="iniciarTimerHack"]');
      ok("ficha tem botão de iniciar o timer do hack técnico", Boolean(botaoTimer));
      botaoTimer?.click();
      await esperar(200);
      ok("timer começa em 10 e desabilita o botão (evita reiniciar no meio)",
        desafioEl.querySelector("[data-timer-hack]")?.textContent === "10" && botaoTimer.disabled === true);

      // Painel com tabela: a ficha edita as faixas, e o teste devolve o problema em vez
      // de abrir sozinho.
      desafioEl.querySelector('[data-action="adicionarLinhaHack"]')?.click();
      await esperar(500);
      ok("ficha edita a tabela do painel (faixa e problema)",
        Boolean(desafioEl.querySelector("input[name='system.hackTecnico.tabela.0.rolagem']"))
        && Boolean(desafioEl.querySelector("input[name='system.hackTecnico.tabela.0.desafio']")));
      await fechadura.update({
        "system.hackTecnico.tabela": [{ rolagem: "1+", desafio: "16 x 5 = 80" }],
        "system.hackTecnico.ultimaTentativaRodada": -1,
      });
      const hack = await comDadosNoMaximo(() => game.op2.hackTecnico(ator, fechadura.uuid, { rapido: true }));
      ok("com tabela, o hack devolve a linha da faixa alcançada",
        hack?.linha?.desafio === "16 x 5 = 80");
      ok("e o desafio NÃO se resolve sozinho: quem confere a conta é o mestre",
        fechadura.system.hackTecnico.resolvido === false);
      const cardHack = game.messages.contents.at(-1);
      ok("o card traz o problema e o botão de marcar resolvido",
        /16 x 5 = 80/.test(cardHack?.content ?? "")
        && /marcar-hack-tecnico-resolvido/.test(cardHack?.content ?? ""));
      await game.op2.marcarHackTecnicoResolvido(fechadura.uuid);
      ok("marcar resolvido fecha o painel", fechadura.system.hackTecnico.resolvido === true);
      await fechadura.update({ "system.hackTecnico.tabela": [], "system.hackTecnico.resolvido": false });

    }
    await fechadura.sheet.close();

    await fechadura.delete();
    await cofre.delete();

    // ALCANÇAR: DT 0 sempre passa nas duas ações do modo seguro; DT 999 nunca
    // alcança no arriscado e nunca aplica dano sozinho — só oferece o botão.
    const seguroOk = await comDadosNoMaximo(() => game.op2.alcancar(ator, { modo: "seguro", dt: 0, rapido: true }));
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

    const iniciou = await comDadosNoMaximo(() => game.op2.sustentar(ator, { rapido: true }));
    ok("sustentar com DT 0 sempre começa", iniciou?.sustentando === true);
    ok("sustentar liga a flag no ator", ator.system.estado.sustentando.ativo === true);

    // Roteiro da cena: a rodada que começa com evento entra no card.
    {
      const invEvento = await Actor.create({
        name: "Cena com roteiro", type: "investigacao",
        system: {
          eventos: [{ rodada: 2, narracao: "<p>O símbolo pulsa.</p>", efeito: "<p>Todos perdem 1 PD.</p>" }],
          sobrecarga: { ativa: false },
        },
      });
      const { alternarAtiva, definirInvestigacaoAtiva } =
        await import("/systems/ordem-paranormal-2e/module/cena/investigacao-ativa.mjs");
      const antiga = game.settings.get("ordem-paranormal-2e", "investigacaoVisualizandoUuid");
      await alternarAtiva(invEvento);
      await definirInvestigacaoAtiva(invEvento.uuid);
      await game.op2.avancarRodada();          // rodada 1: nada
      const semEvento = game.messages.contents.at(-1)?.content ?? "";

      // O painel mostra o roteiro ao mestre, com a próxima rodada marcada em destaque.
      const painelRoteiro = await game.op2.painelInvestigacao();
      await esperar(600);
      const elRoteiro = painelRoteiro?.element ?? document.querySelector("#op2-painel-investigacao");
      ok("o painel lista o roteiro da cena para o mestre",
        elRoteiro?.querySelectorAll(".op2-eventos__item").length === 1
        && /símbolo pulsa/i.test(elRoteiro.querySelector(".op2-eventos__narracao")?.textContent ?? ""));
      ok("e destaca a próxima rodada com evento",
        Boolean(elRoteiro?.querySelector(".op2-eventos__item--proximo")));
      // O painel é um só (singleton): fechar aqui derrubava o `painel` que as
      // verificações do laser, mais adiante, ainda usam.
      await game.op2.avancarRodada();          // rodada 2: o evento
      const comEvento = game.messages.contents.at(-1)?.content ?? "";
      ok("card da rodada sem evento não inventa nada", !/símbolo pulsa/i.test(semEvento));
      ok("e a rodada com evento traz narração e efeito no card",
        /O símbolo pulsa/.test(comEvento) && /Todos perdem 1 PD/.test(comEvento));
      await alternarAtiva(invEvento);
      await definirInvestigacaoAtiva(antiga);
      await invEvento.delete();
    }

    // Sustentar um obstáculo (a estante-porta do Ato I): a DT vem do desafio.
    await game.op2.pararDeSustentar(ator);
    const estanteE2E = await Item.create({
      name: "Estante-porta", type: "desafio-acesso",
      system: {
        abordagens: { arrombar: false, destrancar: false, hackTecnico: false, hackSocial: false, sustentar: true, generico: false },
        sustentar: { dt: 0, aoFalhar: "Quem passa perde 1d4 PV." },
      },
    });
    const segurou = await comDadosNoMaximo(() => game.op2.sustentar(ator, { rapido: true, desafioUuid: estanteE2E.uuid }));
    ok("sustentar aceita a DT do obstáculo e começa", segurou?.sustentando === true);
    ok("e o card nomeia o obstáculo, não só a ação",
      /Estante-porta/.test(game.messages.contents.at(-1)?.content ?? ""));
    await game.op2.pararDeSustentar(ator);
    await estanteE2E.delete();
    // Devolve o estado: as verificações de fadiga logo abaixo contam com ele sustentando.
    await comDadosNoMaximo(() => game.op2.sustentar(ator, { rapido: true }));

    // A 1ª `avancarRodada()` só liga a rodada 1 (mesma guarda `encerrada >= 1` da
    // sobrecarga) — a fadiga só entra a partir da rodada seguinte, quando uma
    // rodada de verdade se encerra.
    await comDadosNoMaximo(() => game.op2.avancarRodada());
    await esperar(500);
    ok("1ª chamada só liga a rodada, sem testar fadiga ainda", ator.system.estado.sustentando.fadiga === 0);

    await comDadosNoMaximo(() => game.op2.avancarRodada());
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

    // O painel mostra o selo do laser (estado do POI); usar ferramenta é ação de
    // personagem e mora nas ações da ficha.
    await painel.render();
    await esperar(800);
    ok("card do POI mostra o selo do laser", Boolean(painel.element?.querySelector(".op2-poi-card .fa-satellite-dish")));
    ok("painel não tem botão de usar ferramenta", !painel.element?.querySelector('[data-action="usarFerramenta"]'));

    {
      const app = game.op2.acoesInvestigacao(ator);
      await esperar(700);
      const elAcoes = document.getElementById(`op2-acoes-${ator.id}`);
      ok("ações da ficha oferecem Usar Laser de Varredura",
        Boolean(elAcoes?.querySelector('[data-action="usarLaser"]')));
      // Laser também é um slot reativo de POI (spec de Fase 2), fora do gatilho
      // dedicado de cena — por isso conta junto com câmera/termômetro/lanterna.
      ok("ações listam as ferramentas que o personagem carrega para aquele POI",
        [...elAcoes.querySelectorAll('[data-action="usarFerramenta"]')].length === 4);
      await app.close();
    }
  }

  /* -------------------------------------------------- destrancar (Mastermind) -- */
  // Fase 3 M3 (spec §7.1). A senha é lida direto do Item para montar palpites
  // certos/errados sob controle — o teste não pode depender de adivinhar sorte.
  {
    const fechadura = await Item.create({
      name: "Fechadura Numérica", type: "desafio-acesso", system: { maxTentativas: 0 },
    });

    // A senha nasce sozinha na primeira tentativa (achado em uso real: exigir que
    // o mestre fosse na ficha gerar à mão travava a mesa).
    const primeiraSemSenha = await game.op2.tentarDestrancar(ator, fechadura.uuid, [1, 1, 1, 1]);
    await esperar(300);
    ok("sem senha, a primeira tentativa gera a senha sozinha e já responde",
      primeiraSemSenha?.resultado?.length === 4 && fechadura.system.senha.length === 4);
    const cardDestrancar = [...game.messages].at(-1)?.content ?? "";
    ok("o card do Destrancar mostra o palpite posição a posição, e a senha só para o mestre",
      /op2-destrancar__pos--/.test(cardDestrancar) && /data-op2-gm/.test(cardDestrancar)
      && cardDestrancar.includes(fechadura.system.senha.join(" ")));

    // Teto por rodada pelo dado de Crime (spec §7.1): com d4, uma tentativa por
    // rodada. Testado num ator próprio para não travar o fluxo abaixo, que precisa de
    // duas tentativas seguidas — o `ator` do teste sobe para d12 (cinco por rodada).
    {
      const ladrao = await Actor.create({
        name: "Ladrão de d4", type: "personagem", system: { pericias: { crime: { die: "d4" } } },
      });
      const cadeadinho = await Item.create({ name: "Cadeadinho", type: "desafio-acesso" });
      await game.op2.gerarSenhaDestrancar(cadeadinho.uuid, { tamanho: 2, facesSenha: 6 });
      const primeira = await game.op2.tentarDestrancar(ladrao, cadeadinho.uuid, [7, 7]);
      ok("Crime d4 dá uma tentativa por rodada, e a primeira passa",
        primeira?.tetoRodada === 1 && primeira.naRodada === 1);
      ok("a segunda na mesma rodada é recusada",
        await game.op2.tentarDestrancar(ladrao, cadeadinho.uuid, [7, 7]) === null);
      ok("o histórico guarda quem tentou e em que rodada",
        cadeadinho.system.historicoDestrancar.length === 1
        && cadeadinho.system.historicoDestrancar[0].atorId === ladrao.id);
      await cadeadinho.delete();
      await ladrao.delete();
    }
    await ator.update({ "system.pericias.crime.die": "d12" });

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

    // Destrancar aparece junto do Arrombar nas ações da ficha, por desafio.
    const desafioVitrine = await Item.create({ name: "Porta do Fundo", type: "desafio-acesso" });
    await game.op2.vincularDesafio(investigacao, desafioVitrine.uuid, { oculto: false });
    {
      const app = game.op2.acoesInvestigacao(ator);
      await esperar(700);
      ok("ações da ficha oferecem o botão Destrancar por desafio",
        Boolean(document.getElementById(`op2-acoes-${ator.id}`)?.querySelector('[data-action="destrancar"]')));
      await app.close();
    }
    await game.op2.removerDesafio(investigacao, desafioVitrine.uuid);
    await desafioVitrine.delete();
  }

  /* -------------------------------------------------------------- hackear -- */
  // Spec §7.3. Só o teste (Tecnologia/Intuição vs DT) e o gate de rodada são
  // automatizados (docs/LACUNAS.md) — o problema matemático e conferir as
  // respostas exigem input humano, a spec é explícita sobre isso.
  {
    // Abordagens: nem todo obstáculo aceita toda abordagem (achado em uso real —
    // "e se a porra do desafio não for sobre hackear?"). Hackear nasce desligado.
    {
      const porta = await Item.create({ name: "Porta Emperrada", type: "desafio-acesso" });
      ok("desafio novo já vem com hackear desligado e arrombar ligado",
        porta.system.abordagens.hackTecnico === false
        && porta.system.abordagens.hackSocial === false
        && porta.system.abordagens.arrombar === true);

      await game.op2.vincularDesafio(investigacao, porta.uuid, { oculto: false });
      const app = game.op2.acoesInvestigacao(ator);
      await esperar(700);
      const el = document.getElementById(`op2-acoes-${ator.id}`);
      ok("ações não mostram Hackear num desafio que não é de hackear",
        !el.querySelector('[data-action="hackTecnico"]') && !el.querySelector('[data-action="hackSocial"]'));
      ok("ações mostram Arrombar nesse mesmo desafio", Boolean(el.querySelector('[data-action="arrombar"]')));

      await porta.update({ "system.abordagens.hackTecnico": true, "system.abordagens.arrombar": false });
      await esperar(400);
      await app.render();
      await esperar(500);
      const el2 = document.getElementById(`op2-acoes-${ator.id}`);
      ok("ligar hackear no obstáculo faz o botão aparecer", Boolean(el2.querySelector('[data-action="hackTecnico"]')));
      ok("desligar arrombar tira o botão dele", !el2.querySelector('[data-action="arrombar"]'));
      await app.close();
      await game.op2.removerDesafio(investigacao, porta.uuid);
      await porta.delete();
    }

    const painelFacil = await Item.create({
      name: "Painel Fácil", type: "desafio-acesso",
      system: { dtObjeto: 0, abordagens: { hackTecnico: true, hackSocial: true } },
    });
    const hackOk = await comDadosNoMaximo(() => game.op2.hackTecnico(ator, painelFacil.uuid, { rapido: true }));
    ok("hack técnico com DT 0 sempre passa", hackOk?.sucesso === true);
    ok("sucesso marca resolvido no Item", painelFacil.system.hackTecnico.resolvido === true);
    ok("hack técnico já resolvido recusa nova tentativa",
      await game.op2.hackTecnico(ator, painelFacil.uuid, { rapido: true }) === null);
    await painelFacil.delete();

    const painelDificil = await Item.create({ name: "Painel Impossível", type: "desafio-acesso", system: { dtObjeto: 999 } });
    const rodadaDoTeste = investigacao.system.rodada;
    const hackFalhou = await game.op2.hackTecnico(ator, painelDificil.uuid, { rapido: true });
    ok("hack técnico com DT 999 falha", hackFalhou?.sucesso === false);
    ok("falha grava a rodada da tentativa", painelDificil.system.hackTecnico.ultimaTentativaRodada === rodadaDoTeste);
    ok("mesma rodada recusa nova tentativa (spec: só libera na rodada seguinte)",
      await game.op2.hackTecnico(ator, painelDificil.uuid, { rapido: true }) === null);

    await game.op2.avancarRodada();
    await esperar(500);
    const novaTentativa = await game.op2.hackTecnico(ator, painelDificil.uuid, { rapido: true });
    ok("rodada seguinte libera nova tentativa", novaTentativa !== null);
    await painelDificil.delete();

    // Hack social: sucesso revela o banco de perguntas pro mestre (elemento
    // `data-op2-gm`, removido do DOM do jogador — mesmo mecanismo de todo botão
    // de bastidor do sistema) e as chances de erro calculadas.
    const segurancaSocial = await Item.create({
      name: "Segurança Social", type: "desafio-acesso",
      system: {
        dtObjeto: 0,
        hackSocial: {
          respostasNecessarias: 2,
          perguntas: [
            { pergunta: "Nome completo?", resposta: "João da Silva" },
            { pergunta: "Ano de nascimento?", resposta: "1990" },
          ],
        },
      },
    });
    const resultadoSocial = await comDadosNoMaximo(() => game.op2.hackSocial(ator, segurancaSocial.uuid, { rapido: true }));
    ok("hack social com DT 0 sempre passa", resultadoSocial?.sucesso === true);
    ok("chances de erro calculadas (base 1 ou mais)", resultadoSocial.chancesDeErro >= 1);

    await esperar(600);
    const cardHack = [...document.querySelectorAll(".op2-card")].at(-1);
    ok("card do hack social mostra o banco de perguntas pro mestre",
      Boolean(cardHack?.textContent.includes("João da Silva")));
    const botaoMarcarResolvido = cardHack?.querySelector('[data-op2-acao="marcar-hack-social-resolvido"]');
    ok("card tem o botão de marcar resolvido", Boolean(botaoMarcarResolvido));
    botaoMarcarResolvido?.click();
    await esperar(500);
    ok("marcar resolvido grava no Item", segurancaSocial.system.hackSocial.resolvido === true);
    await segurancaSocial.delete();

    // Painel: os dois botões de Hackear aparecem junto de Arrombar/Destrancar.
    // Hackear só aparece se o mestre marcar a abordagem naquele obstáculo.
    const desafioComPainel = await Item.create({
      name: "Cofre com Painel", type: "desafio-acesso",
      system: { abordagens: { hackTecnico: true, hackSocial: true } },
    });
    await game.op2.vincularDesafio(investigacao, desafioComPainel.uuid, { oculto: false });
    {
      const app = game.op2.acoesInvestigacao(ator);
      await esperar(700);
      const elAcoes = document.getElementById(`op2-acoes-${ator.id}`);
      ok("ações da ficha oferecem Hackear (técnico) por desafio",
        Boolean(elAcoes?.querySelector('[data-action="hackTecnico"]')));
      ok("ações da ficha oferecem Hackear (social) por desafio",
        Boolean(elAcoes?.querySelector('[data-action="hackSocial"]')));
      await app.close();
    }
    await game.op2.removerDesafio(investigacao, desafioComPainel.uuid);
    await desafioComPainel.delete();
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

  /* --------------------------------------------------------- rádio modificado -- */
  // Fase 3 M3, parte 3 (spec §9.2). A tabela de remoção já é regra pura testada em
  // ferramentas.test.mjs; aqui confere a ponte com o app de verdade. O teste de
  // Tecnologia é `rapido` (dado real, aleatório) — as asserções checam invariantes
  // (nunca remove um verdadeiro, nunca remove mais falsos do que existem), não um
  // total exato.
  {
    const poiRadio = await Item.create({
      name: "Rádio Enigmático", type: "ponto-interesse",
      system: {
        ferramentas: {
          radio: {
            conjuntos: [
              { verdadeiro: true, frase: "so" },
              { verdadeiro: true, frase: "duas palavras" },
              { verdadeiro: false, frase: "falso um" },
              { verdadeiro: false, frase: "falso dois" },
            ],
          },
        },
      },
    });
    await ator.createEmbeddedDocuments("Item", [
      { name: "Rádio do Alan", type: "ferramenta", system: { subtipo: "radio" } },
    ]);

    ok("usarFerramenta genérico recusa o subtipo radio (tem app e ação próprios)",
      await game.op2.usarFerramenta(ator, poiRadio.uuid, "radio") === null);

    // Regressão: o Laser varria `Object.values(ferramentas).some(t => t.trim())` —
    // quebraria ao encontrar o campo estruturado do Rádio Modificado no meio da
    // varredura (achado ao escrever este mesmo lote, antes de existir o app).
    await game.op2.vincularPoi(investigacao, poiRadio.uuid, { oculto: false });
    let laserQuebrou = false;
    try { await game.op2.usarLaser(ator); } catch { laserQuebrou = true; }
    ok("laser não quebra ao varrer um POI com Rádio Modificado configurado", !laserQuebrou);
    await game.op2.removerPoi(investigacao, poiRadio.uuid);

    const resultado = await game.op2.usarRadio(ator, poiRadio.uuid, { rapido: true });
    ok("usarRadio rola Tecnologia e devolve os conjuntos que sobram", Boolean(resultado));
    ok("nunca remove um conjunto verdadeiro", resultado.conjuntos.filter((c) => c.verdadeiro).length === 2);
    ok("nunca remove mais falsos do que existiam", resultado.removidos <= 2);

    const appRadio = game.op2.abrirRadio(resultado);
    await esperar(600);
    const elRadio = appRadio.element;
    ok("app do Rádio renderizou", Boolean(elRadio));

    // Um monte só: as peças de todos os conjuntos que sobraram, verdadeiros e falsos,
    // sem marca — separar é parte do jogo (spec §9.2).
    const esperadas = resultado.conjuntos.flatMap((c) => c.frase.split(/\s+/)).length;
    ok("o monte tem as peças de todos os conjuntos restantes, misturadas",
      appRadio.pecas.length === esperadas && elRadio.querySelectorAll(".op2-radio__peca").length === esperadas);

    // Ordem conhecida: "duas" antes de "so" (errado), depois "palavras", depois os falsos.
    const peca = (t) => appRadio.pecas.find((p) => p.texto === t && p.verdadeiro);
    appRadio.pecas = [peca("duas"), peca("so"), peca("palavras"), ...appRadio.pecas.filter((p) => !p.verdadeiro)];
    await appRadio.render();
    await esperar(400);
    elRadio.querySelector('[data-action="moverPeca"][data-indice="1"][data-direcao="-1"]')?.click();
    await esperar(400);
    ok("a seta reordena as peças por clique de verdade",
      appRadio.pecas.slice(0, 3).map((p) => p.texto).join(" ") === "so duas palavras");
    // Descarta os falsos, um clique por peça.
    for (const [i, p] of appRadio.pecas.entries()) {
      if (p.verdadeiro) continue;
      elRadio.querySelector(`[data-action="alternarPeca"][data-indice="${i}"]`)?.click();
      await esperar(200);
    }
    ok("descartar marca a peça sem tirar do monte",
      appRadio.pecas.filter((p) => p.descartada).length === appRadio.pecas.filter((p) => !p.verdadeiro).length
      && elRadio.querySelectorAll(".op2-radio__peca--descartada").length === appRadio.pecas.filter((p) => !p.verdadeiro).length);

    const mensagensAntesRadio = game.messages.size;
    elRadio.querySelector('[data-action="finalizar"]')?.click();
    await esperar(600);
    ok("finalizar publica um card no chat", game.messages.size > mensagensAntesRadio);
    ok("peças certas na ordem certa, falsos fora: resolvido",
      appRadio.resolvido === true && Boolean(elRadio.querySelector(".op2-radio__pecas--resolvido")));
    ok("botão finalizar some depois de encerrar", !elRadio.querySelector('[data-action="finalizar"]'));
    await appRadio.close();

    await ator.items.getName("Rádio do Alan")?.delete();
    await poiRadio.delete();
  }

  /* ------------------------------------------------------------ ficha do POI -- */

  await poi.sheet.render(true);
  await esperar(800);
  const poiEl = poi.sheet.element;
  ok("ficha do POI renderizou", Boolean(poiEl));
  ok("quadro tem as 2 informações", (poiEl?.querySelectorAll(".op2-poi__info").length ?? 0) === 2);
  ok("descrição contextual visível para o mestre", Boolean(poiEl?.textContent.includes("cofre")));

  // Editor do Rádio Modificado na ficha do POI: campo estruturado (conjuntos), não
  // o textarea de texto livre das outras ferramentas (docs/LACUNAS.md).
  {
    const seletorFerramenta = poiEl.querySelector("[data-seletor-ferramenta]");
    seletorFerramenta.value = "radio";
    seletorFerramenta.dispatchEvent(new Event("change"));
    await esperar(500);
    ok("selecionar Rádio Modificado cria o campo estruturado (não null)", poi.system.ferramentas.radio !== null);

    poiEl.querySelector('[data-action="adicionarConjuntoRadio"]')?.click();
    await esperar(500);
    ok("novo conjunto do Rádio tem checkbox de verdadeiro e campo de frase",
      Boolean(poiEl.querySelector('input[name="system.ferramentas.radio.conjuntos.0.verdadeiro"]'))
      && Boolean(poiEl.querySelector('input[name="system.ferramentas.radio.conjuntos.0.frase"]')));

    poiEl.querySelector('[data-action="removerConjuntoRadio"][data-indice="0"]')?.click();
    await esperar(500);
    ok("remover conjunto tira a linha do Rádio", poi.system.ferramentas.radio.conjuntos.length === 0);
  }

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

// Clique de verdade do Playwright, fora do page.evaluate: o framework de scene
// controls do core nunca redispara o clique numa tool já ativa, então esse
// achado só aparece com uma interação real de mouse, não uma chamada de função
// simulada dentro da página.
{
  // Num mundo descartável recém-criado o tour de boas-vindas do core abre sozinho
  // e o overlay cobre a tela inteira, interceptando o clique real abaixo.
  await page.evaluate(async () => { await globalThis.Tour?.activeTour?.exit(); });
  await page.waitForTimeout(300);

  // `ui.windows` não rastreia este tipo de app (achado em uso real, depurando
  // este mesmo teste) — checar pela existência no DOM é o jeito certo.
  const existeNoDOM = () => page.evaluate(() => Boolean(document.getElementById("op2-painel-investigacao")));

  const botao = "#op2-botao-painel";
  await page.click(botao);
  await page.waitForTimeout(800);
  relato.passos.push([await existeNoDOM(), "botão flutuante abre o painel no primeiro clique"]);

  await page.evaluate(async () => { await game.op2.painelInvestigacao().close(); });
  await page.waitForTimeout(500);
  relato.passos.push([!(await existeNoDOM()), "painel fecha de fato (some do DOM)"]);

  await page.click(botao);
  await page.waitForTimeout(800);
  relato.passos.push([await existeNoDOM(), "botão flutuante reabre o painel depois de fechado (não some após o 1º clique)"]);
}

// Ações de investigação na ficha do personagem + o diálogo de teste com DT 0.
// Precisa de clique real: o `rapido: true` que o resto da suíte usa pula o
// diálogo, e era justamente dentro dele que o bug morava.
{
  const alvo = await page.evaluate(async () => {
    await globalThis.Tour?.activeTour?.exit();
    const inv = await game.op2.criarInvestigacao("Ações e DT 0");
    const ator = await Actor.create({ name: "Agente Ações", type: "personagem" });
    await ator.update({ "system.recursos.pv": { value: 10, max: 10 } });
    await game.op2.adicionarParticipante(inv, ator.uuid);
    // DT 0: o objeto exige a ação, não a dificuldade.
    const desafio = await Item.create({ name: "Painel DT 0", type: "desafio-acesso", system: { dtObjeto: 0 } });
    await game.op2.vincularDesafio(inv, desafio.uuid, { oculto: false });

    await ator.sheet.render(true);
    await new Promise((r) => setTimeout(r, 700));
    return { atorId: ator.id, desafioId: desafio.id, invId: inv.id, pvAntes: ator.system.recursos.pv.value };
  });

  const fichaBotao = `[data-action="abrirAcoesInvestigacao"]`;
  relato.passos.push([
    await page.evaluate((sel) => Boolean(game.actors.get(sel.id).sheet.element.querySelector(sel.q)),
      { id: alvo.atorId, q: fichaBotao }),
    "ficha do personagem tem o botão de ações de investigação",
  ]);

  await page.click(`#PersonagemSheet-Actor-${alvo.atorId} ${fichaBotao}, .op2-ficha ${fichaBotao}`);
  await page.waitForTimeout(900);
  const appId = `#op2-acoes-${alvo.atorId}`;
  relato.passos.push([await page.locator(appId).count() > 0, "botão da ficha abre as ações daquele personagem"]);

  relato.passos.push([
    await page.locator(`${appId} [data-action="arrombar"]`).count() > 0,
    "ações listam o desafio vinculado com Arrombar",
  ]);

  await page.click(`${appId} [data-action="arrombar"]`);
  await page.waitForTimeout(900);
  relato.passos.push([await page.locator("#op2-teste-dialog").count() > 0, "Arrombar pela ficha abre o diálogo de teste"]);

  // O bug: `min="1"` no campo DT fazia o navegador barrar o submit sem avisar —
  // com DT 0 o botão Rolar não fazia nada, e nada nos testes pegava isso porque
  // todos usavam `rapido: true` (achado em uso real).
  await page.click("#op2-teste-dialog button[type='submit']");
  await page.waitForTimeout(2500);
  const depois = await page.evaluate(async ({ atorId, desafioId, invId }) => {
    const ator = game.actors.get(atorId);
    const desafio = game.items.get(desafioId);
    const resultado = {
      tentativas: desafio.system.tentativasUsadas,
      pv: ator.system.recursos.pv.value,
      dialogoAberto: Boolean(document.getElementById("op2-teste-dialog")),
    };
    await ator.sheet.close();
    document.getElementById(`op2-acoes-${atorId}`)?.remove();
    await desafio.delete();
    await ator.delete();
    await game.actors.get(invId)?.delete();
    return resultado;
  }, alvo);

  relato.passos.push([depois.tentativas === 1, "DT 0 rola de verdade pelo diálogo (o botão Rolar não fica inerte)"]);
  relato.passos.push([depois.pv === alvo.pvAntes - 1, "Arrombar pela ficha cobra 1 PV do personagem daquela ficha"]);
  relato.passos.push([!depois.dialogoAberto, "diálogo fecha depois de rolar"]);
}

// Ato II com o zip da editora: o importador pede o zip, descompacta no navegador, sobe
// os arquivos para a pasta do mundo e reescreve os caminhos. O zip é material da
// editora e não vem no repositório: sem ele em docs/, o bloco não roda.
{
  const zipPath = "docs/Ordem-2-Playtest-Alpha-Ato-II-Extras.zip";
  const worldId = await page.evaluate(() => game.world.id);
  // Com o User Data à mão (OP2_E2E_DATA), zera a pasta para exercitar o upload de verdade.
  if (process.env.OP2_E2E_DATA) {
    rmSync(join(process.env.OP2_E2E_DATA, "Data", "worlds", worldId, "ato-ii"), { recursive: true, force: true });
  }
  const limparAtoII = async () => page.evaluate(async () => {
    const doAtoII = (d) => d.folder?.name === "Ato II — O Porão" || d.folder?.folder?.name === "Ato II — O Porão";
    for (const colecao of [game.actors, game.items, game.scenes, game.journal, game.playlists]) {
      for (const doc of [...colecao].filter(doAtoII)) await doc.delete().catch(() => {});
    }
    for (const pasta of [...game.folders].filter((f) => f.name === "Ato II — O Porão" || f.folder?.name === "Ato II — O Porão")) {
      await pasta.delete().catch(() => {});
    }
  });

  if (existsSync(zipPath) && await page.evaluate(() => Boolean(game.packs.get("ordem-paranormal-2e.ato-ii-aventura")?.index.size))) {
    await limparAtoII();
    const primeira = await page.evaluate(async () => {
      const pack = game.packs.get("ordem-paranormal-2e.ato-ii-aventura");
      const aventura = await pack.getDocument([...pack.index][0]._id);
      const r = await aventura.import({ dialog: false });
      // Cancelada pelo hook: `created` volta como array vazio; criada de verdade, como registro.
      return { cancelou: Array.isArray(r.created) && r.created.length === 0 };
    });
    relato.passos.push([primeira.cancelou, "importar o Ato II sem os arquivos no mundo segura a importação e pede o zip"]);

    await page.waitForSelector(".op2-extras input[type=file]", { timeout: 20000 });

    // O zip errado primeiro: nada do que a aventura espera está nele, e a janela tem
    // que dizer isso e continuar pedindo — não importar às cegas nem travar.
    const zipErrado = join(SAIDA, "zip-errado.zip");
    writeFileSync(zipErrado, Buffer.from(montarZip([
      { nome: "Leia-me.txt", conteudo: new TextEncoder().encode("não é o pacote da editora") },
      { nome: "Fotos/Ferias 2024.png", conteudo: new TextEncoder().encode("png falso") },
    ])));
    await page.setInputFiles(".op2-extras input[type=file]", zipErrado);
    await page.waitForSelector(".op2-extras__erro", { timeout: 60000 });
    const errado = await page.evaluate(() => ({
      mensagem: document.querySelector(".op2-extras__erro")?.textContent ?? "",
      aindaPede: Boolean(document.querySelector(".op2-extras input[type=file]")),
      concluir: Boolean(document.querySelector('.op2-extras [data-action="concluir"]')),
    }));
    relato.passos.push([/Nenhum dos 31 arquivos/.test(errado.mensagem) && /2 arquivo/.test(errado.mensagem) && errado.aindaPede && !errado.concluir,
      "zip errado: a janela diz que nenhum arquivo esperado está nele e continua pedindo"]);

    await page.setInputFiles(".op2-extras input[type=file]", zipPath);
    await page.waitForSelector('.op2-extras [data-action="concluir"]', { timeout: 300000 });
    const envio = await page.evaluate(() => ({
      ok: Boolean(document.querySelector(".op2-extras__ok")),
      listas: document.querySelectorAll(".op2-extras__lista li").length,
      texto: document.querySelector(".op2-extras__ok")?.textContent ?? "",
    }));
    relato.passos.push([envio.ok && envio.listas === 0 && /31 arquivo/.test(envio.texto),
      "o zip da editora traz todos os 31 arquivos que a aventura espera — nada aproximado, faltando ou recusado"]);
    await page.click('.op2-extras [data-action="concluir"]');
    // O import cria as pastas por último: esperar só pelos documentos deixava o filtro
    // por pasta vazio (achado ao escrever este mesmo bloco).
    await page.waitForFunction(() => game.actors.getName("Amanda")?.folder && game.scenes.getName("O Porão — Ato II")?.folder
      && game.items.getName("Freezer")?.folder && game.playlists.getName("Ato II — Áudios EMF")?.folder
      && game.folders.getName("Ferramentas da Ordem"), null, { timeout: 180000 });

    const mundo = await page.evaluate(async (worldId) => {
      const raiz = `worlds/${worldId}/ato-ii`;
      const r = {};
      const amanda = game.actors.getName("Amanda");
      r.atorImg = amanda.img === `${raiz}/tokens/personagem-amanda.png`
        && amanda.prototypeToken.texture.src === `${raiz}/tokens/token-amanda.png`
        && amanda.system.biografia.includes(`${raiz}/historicos/historico-amanda.jpg`);
      const cena = game.scenes.getName("O Porão — Ato II");
      r.cena = cena._source.background.src === `${raiz}/mapas/mapa-01-o-porao.jpg`
        && cena.width === 3537 && cena.height === 4101 && cena.walls.size === 39
        && cena.walls.filter((w) => w.door).length === 6;
      const trilha = game.playlists.getName("Ato II — Áudios EMF");
      r.trilha = trilha.sounds.size === 3 && trilha.sounds.every((s) => s.path.startsWith(`${raiz}/musicas/audio-emf-`));
      const handouts = game.journal.getName("Handouts — Ato II");
      r.handouts = handouts.pages.size === 7
        && handouts.pages.filter((p) => p.type === "image").every((p) => p.src.startsWith(`${raiz}/handouts/`))
        && handouts.pages.find((p) => p.type === "pdf")?.src === `${raiz}/handouts/handout-01-compendium-playtest-preenchivel.pdf`;
      const freezer = game.items.getName("Freezer");
      r.freezer = freezer.system.ferramentas.camera.includes(`${raiz}/handouts/handout-06-foto-do-freezer.png`)
        && /@UUID\[Playlist\./.test(freezer.system.ferramentas.emf);
      const docsAtoII = [game.actors, game.items, game.scenes, game.journal, game.playlists]
        .flatMap((c) => [...c].filter((d) => d.folder?.name === "Ato II — O Porão" || d.folder?.folder?.name === "Ato II — O Porão"));
      const comPrefixo = docsAtoII.filter((d) => JSON.stringify(d.toObject()).includes("assets/ato-ii/"))
        .map((d) => `${d.documentName} ${d.name}`);
      const tudo = docsAtoII.map((d) => JSON.stringify(d.toObject())).join("");
      r.semPrefixo = docsAtoII.length >= 45 && comPrefixo.length === 0 && tudo.includes(raiz);
      r.comPrefixo = comPrefixo;
      r.docsAtoII = docsAtoII.length;
      const picker = foundry.applications.apps.FilePicker.implementation;
      const { files: tokens } = await picker.browse("data", `${raiz}/tokens`);
      r.arquivosNoMundo = tokens.length === 10;
      const cabecas = await Promise.all([
        `${raiz}/mapas/mapa-01-o-porao.jpg`, `${raiz}/tokens/token-val.png`, `${raiz}/musicas/audio-emf-3.mp3`,
        `${raiz}/handouts/handout-01-compendium-playtest-preenchivel.pdf`, `${raiz}/handouts/handout-02a-laser-porao.jpg`,
      ].map((c) => fetch(`/${c}`, { method: "HEAD" }).then((resp) => resp.ok).catch(() => false)));
      r.servidos = cabecas.every(Boolean);
      const inv = game.actors.getName("O Porão — Ato II");
      const links = [...inv.system.pois, ...inv.system.desafios, ...inv.system.participantes];
      const alvos = await Promise.all(links.map((u) => fromUuid(u)));
      r.investigacao = inv.system.pois.length === 25 && inv.system.desafios.length === 3
        && inv.system.participantes.length === 5 && alvos.every((d) => d && !d.pack) && inv.system.sobrecarga.ativa === true;

      // O laser com a lista explícita do livro: dez pontos, e não "quem reage a algo".
      const agente = await Actor.create({ name: "Agente do Laser", type: "personagem", system: { tipo: "agente" } });
      await agente.createEmbeddedDocuments("Item", ["Laser de Varredura", "Rádio Modificado"]
        .map((n) => game.items.getName(n).toObject()));
      const ativaAntes = game.settings.get("ordem-paranormal-2e", "investigacoesAtivasUuids");
      await game.op2.definirInvestigacaoAtiva(inv.uuid);
      const marcados = await game.op2.usarLaser(agente);
      r.laser = marcados.length === 10 && marcados.includes("Faca de Churrasco") && marcados.includes("Freezer")
        && !marcados.includes("Pertences de Eloísa") && !marcados.includes("Depósito A");

      // O rádio do Depósito B, no modelo do livro: peças em blocos.
      const depositoB = game.items.getName("Depósito B");
      const resultado = await game.op2.usarRadio(agente, depositoB.uuid, { rapido: true });
      const app = game.op2.abrirRadio(resultado);
      await new Promise((res) => setTimeout(res, 500));
      const verdadeiras = app.pecas.filter((p) => p.verdadeiro).map((p) => p.texto);
      r.radio = verdadeiras.join(" | ") !== "" && app.pecas.filter((p) => p.verdadeiro).length === 6
        && app.pecas.every((p) => p.texto !== "MATAR" && p.texto !== "ELE " )
        && verdadeiras.includes("FAZER ISSO");
      await app.close();

      // A tela do mestre com a mesa inteira: o painel lista os 25 pontos, e a ficha do
      // Ídolo mostra o setor com as sete ferramentas e o rádio em texto.
      const painel = game.op2.painelInvestigacao();
      await painel.render(true);
      await new Promise((res) => setTimeout(res, 1500));
      // Duas listas com o mesmo cartão: a primeira é a dos pontos, a segunda a dos desafios.
      const listas = painel.element?.querySelectorAll(".op2-painel-pois") ?? [];
      r.painel = listas[0]?.querySelectorAll(".op2-poi-card").length === 25
        && listas[1]?.querySelectorAll(".op2-poi-card").length === 3;
      const idolo = game.items.getName("O Ídolo de Pedra");
      await idolo.sheet.render(true);
      await new Promise((res) => setTimeout(res, 1200));
      const fichaIdolo = idolo.sheet.element;
      r.fichaIdolo = fichaIdolo?.querySelectorAll(".op2-poi__ferramenta").length === 8
        && fichaIdolo.querySelector('textarea[name="system.ferramentas.radio.texto"]')?.value.includes("gritos")
        && fichaIdolo.querySelector('input[name="system.laboratorioDados"]')?.value === "6";
      await idolo.sheet.close();

      await game.settings.set("ordem-paranormal-2e", "investigacoesAtivasUuids", ativaAntes);
      await agente.delete();
      return r;
    }, worldId);

    relato.passos.push([mundo.atorImg, "os agentes chegam ao mundo apontando para a pasta do mundo (retrato, token, histórico)"]);
    relato.passos.push([mundo.cena, "a cena do Ato II vem com o mapa do zip, 39 paredes e 6 portas"]);
    relato.passos.push([mundo.trilha, "a playlist dos áudios EMF aponta para os mp3 enviados"]);
    relato.passos.push([mundo.handouts, "o diário de handouts traz as imagens e o PDF do Compêndio da Ordem"]);
    relato.passos.push([mundo.freezer, "a leitura da Câmera no Freezer traz o handout, e a do EMF o link para a playlist"]);
    relato.passos.push([mundo.semPrefixo, `nenhum dos ${mundo.docsAtoII} documentos importados ficou com o prefixo do compêndio${mundo.comPrefixo?.length ? ` (${mundo.comPrefixo.join(", ")})` : ""}`]);
    relato.passos.push([mundo.arquivosNoMundo, "os dez tokens estão na pasta do mundo"]);
    relato.passos.push([mundo.servidos, "mapa, token, áudio, PDF e handout são servidos pelo Foundry"]);
    relato.passos.push([mundo.investigacao, "a investigação do Ato II resolve 25 pontos, 3 desafios e 5 agentes no mundo"]);
    relato.passos.push([mundo.laser, "o laser marca exatamente os dez pontos da lista do livro"]);
    relato.passos.push([mundo.radio, "o rádio do Depósito B joga em blocos, como o livro"]);
    relato.passos.push([mundo.painel, "o painel do mestre lista os 25 pontos e os 3 desafios do Ato II"]);
    relato.passos.push([mundo.fichaIdolo, "a ficha do Ídolo mostra as sete ferramentas mais o laser, o rádio em texto e os 6 dados do Laboratório"]);

    // Segunda importação, com os arquivos já no lugar: nada de pedir o zip de novo.
    await limparAtoII();
    const segunda = await page.evaluate(async () => {
      const pack = game.packs.get("ordem-paranormal-2e.ato-ii-aventura");
      const aventura = await pack.getDocument([...pack.index][0]._id);
      await aventura.import({ dialog: false });
      await new Promise((res) => setTimeout(res, 3000));
      return { dialogo: Boolean(document.querySelector(".op2-extras")), amanda: Boolean(game.actors.getName("Amanda")) };
    });
    await page.waitForFunction(() => game.actors.getName("Amanda")?.folder && game.items.getName("Freezer")?.folder, null, { timeout: 180000 });
    relato.passos.push([!segunda.dialogo, "com os arquivos já no mundo, importar de novo não pede o zip"]);
    await limparAtoII();
  } else {
    console.log("(sem docs/Ordem-2-Playtest-Alpha-Ato-II-Extras.zip ou sem o pack do Ato II: importação com zip não verificada)");
  }
}

// O que a primeira rodada de teste manual apontou (2026-09-03): rolagem comum sem
// mensagem, falha crítica que passava em branco no Examinar, "FALHA" com pista na tela,
// <p> cru no card da rodada, cards gigantes no painel, pontos visíveis de cara.
{
  const uso = await page.evaluate(async () => {
    const passos = [];
    const ok = (titulo, condicao) => passos.push([Boolean(condicao), titulo]);
    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
    const aleatorioOriginal = CONFIG.Dice.randomUniform;
    const comDados = async (valor, fn) => {
      CONFIG.Dice.randomUniform = () => valor;
      try { return await fn(); } finally { CONFIG.Dice.randomUniform = aleatorioOriginal; }
    };
    const ultimaMensagem = () => [...game.messages].at(-1);

    // 1. Uma rolagem comum do jogo continua sendo do core: `/r 1d8`, calculadoras de
    //    dados. Com o OP2Roll na frente da lista, o card saía vazio.
    const comum = Roll.create("1d8");
    ok("Roll.create dá a classe do core, não o OP2Roll", comum.constructor.name === "Roll" && !(comum instanceof game.op2.OP2Roll));
    await comum.evaluate();
    await comum.toMessage({ speaker: { alias: "e2e" } });
    await esperar(400);
    // O conteúdo gravado é só o total; o card de dados do core é montado ao exibir.
    const htmlComum = await ultimaMensagem()?.renderHTML?.();
    ok("a mensagem de uma rolagem comum traz o card de dados do core",
      ultimaMensagem()?.rolls?.length === 1 && ultimaMensagem().rolls[0].constructor.name === "Roll"
      && Boolean(htmlComum?.querySelector?.(".dice-roll, .dice-total")));
    ok("e o OP2Roll segue registrado para reidratar cards de teste", CONFIG.Dice.rolls.some((c) => c.name === "OP2Roll"));

    // 2. Examinar com todos os dados em 1: falha crítica, com o botão do mestre no card.
    const inv = await game.op2.criarInvestigacao("Uso real");
    const ator = await Actor.create({ name: "Examinadora", type: "personagem", system: {
      "atributos.mente.die": "d6", "pericias.percepcao.die": "d6", "recursos.pd": { value: 10, max: 10 },
    } });
    await game.user.update({ character: ator.id });
    await game.op2.adicionarParticipante(inv, ator.uuid);
    const poi = await Item.create({ name: "Cofre Marcado", type: "ponto-interesse", system: {
      descricaoContextual: "<p>SEGREDO-DO-MESTRE</p>",
      informacoes: [
        { id: "c1", pericia: "percepcao", dt: 5, texto: "<p>Arranhões na porta.</p>" },
        { id: "c2", pericia: "percepcao", dt: 20, texto: "<p>Um compartimento falso.</p>" },
      ],
    } });
    await game.op2.vincularPoi(inv, poi.uuid);
    ok("vincular um ponto o deixa oculto dos jogadores por padrão", inv.system.poisOcultos.includes(poi.uuid));
    const poiVisivel = await Item.create({ name: "Placa da Rua", type: "ponto-interesse" });
    await game.op2.vincularPoi(inv, poiVisivel.uuid, { oculto: false });
    ok("… a não ser que quem vincula peça visível", !inv.system.poisOcultos.includes(poiVisivel.uuid));
    await game.op2.definirInvestigacaoAtiva(inv.uuid);

    const critica = await comDados(0.9999, () => game.op2.examinar(ator, poi.uuid, "luta", { rapido: true }));
    await esperar(400);
    ok("todos os dados em 1 ao Examinar é falha crítica", critica?.roll?.falhaCritica === true);
    ok("e o card traz o botão de rolar a tabela de falha crítica",
      /rolar-falha-critica/.test(ultimaMensagem()?.content ?? "") && /op2-card__desfecho--falha-critica/.test(ultimaMensagem()?.content ?? ""));

    // 3. Pista pelo dado, rolagem que não soma: nem "FALHA", nem custo — "pelo dado".
    // Dados no meio da escala: nem todos em 1 (falha crítica), nem no máximo.
    const peloDado = await comDados(0.5, () => game.op2.examinar(ator, poi.uuid, "percepcao", { rapido: true }));
    await esperar(400);
    ok("o dado d6 entrega a linha de DT 5 sem rolar", peloDado?.revelaveis?.includes("c1") && peloDado.perdePD === false);
    // Achou uma linha: é SUCESSO, com a nota de que veio pelo tamanho do dado e de
    // que a rolagem não alcançou o resto (achado em uso real: "pelo dado" lia como falha).
    ok("o card diz SUCESSO e explica que a linha veio pelo tamanho do dado",
      /op2-card__desfecho--sucesso/.test(ultimaMensagem()?.content ?? "")
      && !/op2-card__desfecho--falha"/.test(ultimaMensagem()?.content ?? "")
      && (ultimaMensagem()?.content ?? "").includes(game.i18n.format("OP2.Investigacao.ExaminarSoGratis", { quantidade: 1 })));

    // 4. Card da rodada com o roteiro em HTML (nada de <p> cru) e botão que diz o dado.
    await inv.update({ "system.eventos": [{ rodada: 1, narracao: "<p>O símbolo pulsa.</p>", efeito: "<p>Cada um perde 1 PD.</p>" }],
      "system.sobrecarga": { ativa: true, tabela: [{ rodada: 1, dano: "1d4" }] } });
    await game.op2.avancarRodada();
    await esperar(400);
    const cardRodada = ultimaMensagem()?.content ?? "";
    ok("a narração do roteiro entra como HTML no card da rodada", /<p>O símbolo pulsa\.<\/p>/.test(cardRodada) && !/&lt;p&gt;/.test(cardRodada));
    await game.op2.avancarRodada();
    await esperar(400);
    const cardRodada2 = ultimaMensagem()?.content ?? "";
    ok("o botão de sobrecarga diz o que vai rolar", /rolar 1d4/.test(cardRodada2) && /rolar-sobrecarga/.test(cardRodada2));
    const pdAntes = ator.system.recursos.pd.value;
    await comDados(0, async () => { const { rolarSobrecarga } = await import("/systems/ordem-paranormal-2e/module/cena/rodada.mjs"); await rolarSobrecarga(ator, "1d4"); });
    await esperar(400);
    const cardDano = ultimaMensagem();
    ok("a sobrecarga rolada vira card do sistema, com a rolagem guardada e o dano aplicado",
      /op2-card/.test(cardDano?.content ?? "") && cardDano?.rolls?.length === 1 && ator.system.recursos.pd.value === pdAntes - 4);

    // 5. Painel: duas colunas (controles + ordem | cena em abas), seções da
    //    Preparação recolhidas por padrão, cards recolhíveis, notas do mestre, filtro.
    localStorage.removeItem("op2.painel.secoes"); localStorage.removeItem("op2.painel.aba");
    const painel = game.op2.painelInvestigacao();
    await painel.render(true);
    await esperar(1200);
    const el = painel.element;
    ok("a coluna da esquerda tem o seletor, os botões de rodada e a ordem das rodadas — e só isso",
      Boolean(el.querySelector(".op2-painel-lateral [data-seletor-investigacao]"))
      && Boolean(el.querySelector(".op2-painel-lateral [data-action='novaRodada']"))
      && Boolean(el.querySelector(".op2-painel-lateral [data-action='encerrarCena']"))
      && Boolean(el.querySelector(".op2-painel-lateral .op2-painel-ordem [data-ator-ordem]"))
      && !el.querySelector(".op2-painel-lateral [data-poi-card]") && !el.querySelector(".op2-painel-lateral details"));
    const abas = [...el.querySelectorAll(".op2-abas [data-tab]")].map((b) => b.dataset.tab);
    ok(`a cena fica em três abas, Preparação primeiro (${abas.join(", ")})`, abas.join(",") === "preparacao,pontos,desafios");
    ok("sem preferência guardada o painel abre em Pontos de interesse",
      el.querySelector(".op2-painel-aba[data-tab='pontos']")?.classList.contains("active") === true
      && el.querySelector(".op2-painel-aba[data-tab='preparacao']")?.classList.contains("active") === false);
    ok("as colunas ficam lado a lado de verdade: a ordem à esquerda dos cards",
      el.querySelector(".op2-painel-lateral").getBoundingClientRect().right
        <= el.querySelector(".op2-painel-principal").getBoundingClientRect().left
      && el.querySelector(".op2-painel-lateral .op2-painel-ordem").getBoundingClientRect().height > 0);
    const temRoteiro = (inv.system.eventos?.length ?? 0) > 0;
    ok("pontos e desafios deixaram de ser seções; participantes, roteiro e sobrecarga moram na Preparação",
      !el.querySelector("details[data-secao='pontos']") && !el.querySelector("details[data-secao='ordem']")
      && ["participantes", "sobrecarga", ...(temRoteiro ? ["eventos"] : [])]
        .every((n) => el.querySelector(`.op2-painel-aba[data-tab='preparacao'] details[data-secao='${n}']`)));
    const secoes = [...el.querySelectorAll("details[data-secao]")];
    ok("toda seção da Preparação nasce fechada", secoes.length === (temRoteiro ? 3 : 2) && secoes.every((d) => !d.open));
    el.querySelector('details[data-secao="participantes"]').open = true;
    el.querySelector('details[data-secao="participantes"]').dispatchEvent(new Event("toggle"));
    painel.changeTab("desafios", "principal");
    await painel.render();
    await esperar(800);
    ok("seção aberta e aba escolhida continuam depois de rerrenderizar (guardadas no navegador)",
      painel.element.querySelector('details[data-secao="participantes"]')?.open === true
      && painel.element.querySelector('details[data-secao="sobrecarga"]')?.open === false
      && painel.element.querySelector(".op2-painel-aba[data-tab='desafios']")?.classList.contains("active") === true
      && localStorage.getItem("op2.painel.aba") === "desafios");
    painel.changeTab("pontos", "principal");
    const elPainel = painel.element;
    const card = elPainel?.querySelector(`[data-poi-card="${poi.uuid}"]`);
    ok(`o card do ponto tem o corpo, o resumo de linhas (1 descoberta de 2) e o botão de notas do mestre (${card?.querySelector(".op2-poi-card__resumo")?.textContent?.trim()})`,
      Boolean(card?.querySelector(".op2-poi-card__corpo")) && /1\/2/.test(card?.querySelector(".op2-poi-card__resumo")?.textContent ?? "")
      && Boolean(card?.querySelector('[data-action="alternarNotasMestre"]')));
    ok("as linhas do quadro são compactas: uma linha por informação, com a DT num selo",
      card?.querySelectorAll(".op2-poi-card__info").length === 2 && card.querySelectorAll(".op2-poi-card__info .op2-poi-card__dt").length === 2);
    ok("as notas do mestre ficam escondidas até ele pedir", !card?.classList.contains("op2-poi-card--notas") && /SEGREDO-DO-MESTRE/.test(card?.querySelector(".op2-poi-card__contextual")?.textContent ?? ""));
    card?.querySelector('[data-action="alternarNotasMestre"]')?.click();
    await esperar(200);
    ok("um clique abre as notas do mestre no próprio card", card?.classList.contains("op2-poi-card--notas"));
    card?.querySelector('[data-action="alternarRecolhido"]')?.click();
    await esperar(200);
    ok("recolher esconde o corpo e fica guardado no navegador",
      card?.classList.contains("op2-poi-card--recolhido") && (localStorage.getItem("op2.painel.recolhidos") ?? "").includes(poi.uuid));
    el?.querySelector('[data-action="expandirTodos"]')?.click();
    await esperar(200);
    ok("expandir todos reabre", !card?.classList.contains("op2-poi-card--recolhido"));
    el?.querySelector('[data-action="recolherTodos"]')?.click();
    await esperar(200);
    ok("recolher todos recolhe todos", [...el.querySelectorAll("[data-poi-card]")].every((c) => c.classList.contains("op2-poi-card--recolhido")));
    const filtro = el?.querySelector("[data-filtro-pois]");
    filtro.value = "placa"; filtro.dispatchEvent(new Event("input"));
    await esperar(200);
    ok("o filtro esconde os pontos que não casam com o nome",
      card?.hidden === true && el.querySelector(`[data-poi-card="${poiVisivel.uuid}"]`)?.hidden === false);
    filtro.value = ""; filtro.dispatchEvent(new Event("input"));
    await painel.render();
    await esperar(800);
    ok("o painel rerrenderizado lembra o que estava recolhido", el?.querySelector(`[data-poi-card="${poi.uuid}"]`)?.classList.contains("op2-poi-card--recolhido"));
    el?.querySelector('[data-action="expandirTodos"]')?.click();

    // 6. Desafios: só Arrombar tem pontuação; um hack mostra pendente/resolvido.
    const hack = await Item.create({ name: "Painel Hackeável", type: "desafio-acesso", system: {
      abordagens: { arrombar: false, hackTecnico: true }, hackTecnico: { tabela: [{ rolagem: "10+", desafio: "2+2=4", segundos: 0 }] },
    }, flags: { "ordem-paranormal-2e": { notaDoMestre: "<p>NOTA-DO-DESAFIO</p>" } } });
    const porta = await Item.create({ name: "Porta Forçável", type: "desafio-acesso", system: { abordagens: { arrombar: true } } });
    await game.op2.vincularDesafio(inv, hack.uuid);
    await game.op2.vincularDesafio(inv, porta.uuid);
    ok("vincular um desafio o deixa oculto por padrão", inv.system.desafiosOcultos.includes(hack.uuid));
    await painel.render();
    await esperar(1000);
    const cardHack = painel.element?.querySelector(`[data-poi-card="${hack.uuid}"]`);
    const cardPorta = painel.element?.querySelector(`[data-poi-card="${porta.uuid}"]`);
    ok(`um desafio de hack não mostra pontuação 0/10, mostra o estado (${cardHack ? cardHack.textContent.replace(/\s+/g, " ").trim().slice(0, 90) : "card ausente"})`,
      Boolean(cardHack) && !cardHack.querySelector(".op2-stepper") && /Pendente/.test(cardHack.textContent) && /hack/i.test(cardHack.textContent));
    ok("um desafio de arrombar mostra a pontuação com o passo a passo", Boolean(cardPorta?.querySelector(".op2-stepper")));
    ok("a nota do mestre do desafio está no card, escondida até pedir",
      /NOTA-DO-DESAFIO/.test(cardHack?.querySelector(".op2-poi-card__contextual")?.textContent ?? "") && !cardHack?.classList.contains("op2-poi-card--notas"));

    // 7. O roteiro da cena se edita na ficha da investigação.
    await inv.sheet.render(true);
    await esperar(1000);
    const ficha = inv.sheet.element;
    ok("a ficha da investigação lista os eventos do roteiro", ficha?.querySelectorAll("[data-evento-linha]").length === 1
      && ficha.querySelector("[data-evento-campo='narracao']")?.value === "O símbolo pulsa.");
    ficha?.querySelector('[data-action="adicionarEvento"]')?.click();
    await esperar(600);
    ok("novo evento entra na rodada seguinte", inv.system.eventos.length === 2 && inv.system.eventos[1].rodada === 2);
    const campo = inv.sheet.element?.querySelectorAll("[data-evento-campo='narracao']")[1];
    if (campo) { campo.value = "Primeiro parágrafo.\n\nSegundo."; campo.dispatchEvent(new Event("change")); }
    await esperar(600);
    ok("o texto digitado vira parágrafos HTML no roteiro", inv.system.eventos[1]?.narracao === "<p>Primeiro parágrafo.</p><p>Segundo.</p>");
    await inv.sheet.close();

    // 8. Um ícone por ponto na aventura do Ato I.
    const pack = game.packs.get("ordem-paranormal-2e.ato-i-aventura");
    if (pack?.index.size) {
      const aventura = await pack.getDocument([...pack.index][0]._id);
      const imgs = [...aventura.items].filter((i) => i.type === "ponto-interesse").map((i) => i.img);
      ok("os pontos do Ato I têm ícone próprio: retrato, handout ou ícone do core", new Set(imgs).size >= 20
        && !imgs.some((i) => i.endsWith("tipos/ponto-interesse.svg")) && imgs.some((i) => i.includes("personagem-alan")));
      const invAtoI = [...aventura.actors].find((a) => a.type === "investigacao");
      ok("e a investigação do Ato I chega com todos os pontos e desafios ocultos",
        invAtoI.system.poisOcultos.length === invAtoI.system.pois.length && invAtoI.system.desafiosOcultos.length === invAtoI.system.desafios.length);
    }

    localStorage.removeItem("op2.painel.recolhidos"); localStorage.removeItem("op2.painel.notas"); localStorage.removeItem("op2.painel.secoes"); localStorage.removeItem("op2.painel.aba");
    await game.user.update({ character: null });
    for (const d of [hack, porta, poi, poiVisivel, ator, inv]) await d.delete().catch(() => {});
    return passos;
  });
  relato.passos.push(...uso);
}

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
