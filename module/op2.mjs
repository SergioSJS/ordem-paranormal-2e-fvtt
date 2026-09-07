/**
 * Ordem Paranormal 2 (Playtest Alpha) — sistema não-oficial para Foundry VTT.
 * Compatível com v13 e v14.
 */
import { SYSTEM_ID, OP2, ICONES_PADRAO } from "./config.mjs";
import { PersonagemData } from "./data/actor-personagem.mjs";
import { NpcData } from "./data/actor-npc.mjs";
import { HabilidadeData } from "./data/item-habilidade.mjs";
import { EquipamentoData } from "./data/item-equipamento.mjs";
import { FerramentaData } from "./data/item-ferramenta.mjs";
import { PontoInteresseData } from "./data/item-ponto-interesse.mjs";
import { DesafioAcessoData } from "./data/item-desafio-acesso.mjs";
import { EventoData } from "./data/item-evento.mjs";
import { OcupacaoData } from "./data/item-ocupacao.mjs";
import { InvestigacaoData } from "./data/actor-investigacao.mjs";
import { PersonagemSheet } from "./sheets/actor-personagem-sheet.mjs";
import { NpcSheet } from "./sheets/actor-npc-sheet.mjs";
import { InvestigacaoSheet } from "./sheets/actor-investigacao-sheet.mjs";
import { OP2ItemSheet } from "./sheets/item-sheet.mjs";
import { PontoInteresseSheet } from "./sheets/item-ponto-interesse-sheet.mjs";
import { DesafioAcessoSheet } from "./sheets/item-desafio-acesso-sheet.mjs";
import { EventoSheet } from "./sheets/item-evento-sheet.mjs";
import { OP2Roll } from "./dice/op2-roll.mjs";
import { rolarTeste } from "./dice/teste.mjs";
import { stepDie, faces } from "./dice/escada.mjs";
import { registrarSettings, lerConfig } from "./settings/register.mjs";
import { registrarHelpersDeDado } from "./ui/dice-icons.mjs";
import { registrarHelpers, precarregarTemplates } from "./ui/handlebars.mjs";
import { registrarChat } from "./ui/chat.mjs";
import { registrarSocket } from "./ui/socket.mjs";
import { registrarExtrasDeAventura } from "./ui/extras-aventura.mjs";
import { encerrarCena } from "./cena/encerrar-investigacao.mjs";
import { registrarPainelInvestigacao, abrirPainelInvestigacao } from "./cena/painel-investigacao.mjs";
import { avancarRodada, rodadaAtual } from "./cena/rodada.mjs";
import {
  investigacaoAtiva, todasInvestigacoes, definirInvestigacaoAtiva, criarInvestigacao,
  adicionarParticipante, removerParticipante, vincularPoi, removerPoi, vincularDesafio, removerDesafio,
  alternarJaAgiu, alternarOculto, moverParticipante, vincularDesafioAoPonto, removerDesafioDoPonto, pontoDoDesafio,
  vincularEvento, removerEvento, eventosDaInvestigacao, dispararEvento, reiniciarEvento,
} from "./cena/investigacao-ativa.mjs";
import {
  examinar, interagir, recapitular, compartilhar, dialogoExaminar, cicloVisibilidadeInfo,
  limparRevelacao, contarAoGrupo,
} from "./cena/acoes-investigacao.mjs";
import {
  arrombar, alcancar, sustentar, pararDeSustentar, gerarSenhaDestrancar, tentarDestrancar,
  hackTecnico, hackSocial, marcarHackSocialResolvido, marcarHackTecnicoResolvido, desafioGenerico,
} from "./cena/acoes-desafio.mjs";
import { iniciarHackTecnico, encerrarHackTecnico } from "./cena/timer-hack.mjs";
import { usarFerramenta, usarLaser, usarRadio } from "./cena/acoes-ferramenta.mjs";
import { abrirDestrancar } from "./cena/destrancar-app.mjs";
import { abrirLaboratorio } from "./cena/laboratorio-app.mjs";
import { abrirRadio } from "./cena/radio-app.mjs";
import { abrirAcoesInvestigacao } from "./cena/acoes-app.mjs";
import { registrarAtalhos } from "./ui/atalhos.mjs";
import { rolarTesteDeQueda, zerarContadoresDeQueda } from "./cena/ferimentos.mjs";
import { ajudar } from "./cena/acoes-ajuda.mjs";
import { registrarMarcadores, marcarNoMapa, desmarcarDoMapa, abrirMarcador } from "./cena/marcadores.mjs";
import { abrirAventurasApp, registrarAventuras } from "./aventura/aventuras-app.mjs";
import { abrirBoasVindas, abrirBoasVindasSeConfigurado, registrarBoasVindas } from "./ui/boas-vindas.mjs";
import { atacar, defender } from "./cena/acoes-combate.mjs";
import { usarHabilidadeOuItem, concederPasso } from "./cena/acoes-recurso.mjs";
import { migrarLinhasDoQuadro } from "./cena/texto-linha.mjs";

Hooks.once("init", () => {
  console.log(`${SYSTEM_ID} | inicializando`);

  CONFIG.OP2 = OP2;

  CONFIG.Actor.dataModels.personagem = PersonagemData;
  CONFIG.Actor.dataModels.npc = NpcData;
  CONFIG.Actor.dataModels.investigacao = InvestigacaoData;
  CONFIG.Item.dataModels.habilidade = HabilidadeData;
  CONFIG.Item.dataModels.equipamento = EquipamentoData;
  CONFIG.Item.dataModels.ferramenta = FerramentaData;
  CONFIG.Item.dataModels["ponto-interesse"] = PontoInteresseData;
  CONFIG.Item.dataModels["desafio-acesso"] = DesafioAcessoData;
  CONFIG.Item.dataModels.evento = EventoData;
  CONFIG.Item.dataModels.ocupacao = OcupacaoData;

  // `push`, não `unshift`: o primeiro da lista é a classe padrão de TODA rolagem do
  // jogo — `/r 1d8`, módulos de calculadora de dados. Com o OP2Roll na frente, uma
  // rolagem comum era renderizada pelo template do teste do sistema, sem o contexto
  // que ele espera: os dados 3D rolavam e a mensagem saía vazia (achado em uso real).
  // Registrado no fim, o OP2Roll continua sendo reconhecido ao reidratar mensagens.
  CONFIG.Dice.rolls.push(OP2Roll);

  // Ícone padrão por tipo de documento (ICONES_PADRAO), aplicado só quando a
  // criação não traz `img` — duplicar ou importar de compêndio mantém o ícone
  // original, e o usuário troca quando quiser pelo editImage das fichas.
  for (const documento of ["Actor", "Item"]) {
    Hooks.on(`preCreate${documento}`, (doc, data) => {
      const icone = ICONES_PADRAO[documento]?.[data.type];
      if (icone && !data.img) doc.updateSource({ img: icone });
    });
  }

  registrarSettings();
  aplicarIdiomaPadrao();
  registrarHelpersDeDado();
  registrarHelpers();
  registrarSheets();
  registrarChat();
  registrarSocket();
  registrarPainelInvestigacao();
  registrarMarcadores();
  registrarAventuras();
  registrarExtrasDeAventura();
  registrarBoasVindas();
  registrarAtalhos();

  // Sem iniciativa rolada: os jogadores decidem a ordem entre si (spec §5.2).
  CONFIG.Combat.initiative = { formula: "0", decimals: 0 };

  game.op2 = {
    migrarLinhasDoQuadro,
    rolarTeste, encerrarCena, stepDie, faces, OP2Roll,
    examinar, interagir, recapitular, compartilhar, dialogoExaminar, cicloVisibilidadeInfo,
    limparRevelacao, contarAoGrupo,
    painelInvestigacao: abrirPainelInvestigacao, acoesInvestigacao: abrirAcoesInvestigacao, avancarRodada,
    arrombar, alcancar, sustentar, pararDeSustentar,
    hackTecnico, hackSocial, marcarHackSocialResolvido, marcarHackTecnicoResolvido, desafioGenerico,
    iniciarHackTecnico, encerrarHackTecnico,
    gerarSenhaDestrancar, tentarDestrancar, abrirDestrancar,
    usarFerramenta, usarLaser, abrirLaboratorio, usarRadio, abrirRadio,
    rolarTesteDeQueda, zerarContadoresDeQueda, ajudar, atacar, defender,
    usarHabilidadeOuItem, concederPasso,
    investigacaoAtiva, todasInvestigacoes, definirInvestigacaoAtiva, criarInvestigacao,
    adicionarParticipante, removerParticipante, vincularPoi, removerPoi, vincularDesafio, removerDesafio,
    vincularEvento, removerEvento, eventosDaInvestigacao, dispararEvento, reiniciarEvento, rodadaAtual,
    vincularDesafioAoPonto, removerDesafioDoPonto, pontoDoDesafio,
    alternarJaAgiu, alternarOculto, moverParticipante,
    marcarNoMapa, desmarcarDoMapa, abrirMarcador,
    aventuras: abrirAventurasApp, boasVindas: abrirBoasVindas,
  };
});

Hooks.once("ready", async () => {
  // Linhas do quadro gravadas em HTML por versões antigas viram texto puro — só o
  // mestre grava, e só o que ainda tem tag.
  if (game.user.isGM) {
    const n = await migrarLinhasDoQuadro().catch((e) => { console.error(`${SYSTEM_ID} | migração das linhas`, e); return 0; });
    if (n) console.log(`${SYSTEM_ID} | linhas do quadro em texto puro: ${n} ponto(s) atualizado(s)`);
  }
});
Hooks.once("ready", () => {
  precarregarTemplates();
  migrarInvestigacoesAtivas();
  migrarImpetoParaHabilidade();
  abrirBoasVindasSeConfigurado();
});

/**
 * Migração pontual: mundos que já tinham investigação antes de "em jogo" existir
 * (`investigacoesAtivasUuids`, mundo) contavam com um único ponteiro global — toda
 * investigação era, na prática, visível a quem participava dela. Sem isto, elas
 * ficam invisíveis pros jogadores até o mestre marcar manualmente "Em jogo" uma por
 * uma (achado em uso real: jogador com personagem já participante via um mundo
 * criado antes desta mudança). Só roda se o setting nunca foi tocado (segue vazio,
 * o default) e existe pelo menos uma investigação — depois da primeira vez que o
 * mestre usa o checkbox, o setting deixa de estar vazio e isto nunca mais roda.
 */
async function migrarInvestigacoesAtivas() {
  if (!game.user.isGM) return;
  if (lerConfig("investigacoesAtivasUuids").length > 0) return;
  const todas = todasInvestigacoes();
  if (!todas.length) return;
  await game.settings.set(SYSTEM_ID, "investigacoesAtivasUuids", todas.map((i) => i.uuid));
  console.log(`${SYSTEM_ID} | migrou ${todas.length} investigação(ões) pré-existente(s) para "em jogo"`);
}

/**
 * Migração pontual: a barra de Ímpeto morava no personagem (`system.impeto`) e passou
 * a morar na habilidade que a concede — a barra É a habilidade, e guardada no ator ela
 * sobrevivia a apagar o item (achado em uso real).
 *
 * Fichas importadas antes da mudança ficariam sem barra nenhuma: o campo do ator saiu
 * do schema e a habilidade ainda não tem o dela. Isto move o estado para a habilidade
 * certa e limpa o campo antigo. Roda uma vez — depois não há mais `_source.system.impeto`
 * para achar.
 */
async function migrarImpetoParaHabilidade() {
  if (!game.user.isGM) return;

  const nomeDaBarra = game.i18n.localize("OP2.Impeto.Titulo").toLowerCase();

  for (const ator of game.actors) {
    if (ator.type !== "personagem") continue;

    const habilidades = ator.items.filter((i) => i.type === "habilidade");
    if (!habilidades.length) continue;
    // Já tem barra em alguma habilidade: nada a migrar.
    if (habilidades.some((i) => i.system.temBarraImpeto)) continue;

    // Mundos gravados antes da mudança ainda trazem o campo do ator no `_source`; nos
    // que já foram limpos, sobra o nome da habilidade — que é o da ficha do Ato I.
    const antigo = ator._source.system?.impeto;
    const alvo = habilidades.find((i) => i._source.system?.barraImpeto)
      ?? habilidades.find((i) => i.name.toLowerCase() === nomeDaBarra);
    if (!alvo) continue;

    const espacos = antigo?.espacos || 3;
    const atualizacao = {
      "system.impeto": { espacos, preenchidos: Math.min(antigo?.preenchidos ?? 0, espacos) },
    };
    // A descrição vinha com uma instrução de interface ("a barra fica no cabeçalho"),
    // que além de errada agora não é regra nenhuma — descrição carrega regra.
    const semInstrucao = alvo.system.descricao?.replace(/<p><em>A barra fica [^<]*<\/em><\/p>/g, "");
    if (semInstrucao !== alvo.system.descricao) atualizacao["system.descricao"] = semInstrucao;
    await alvo.update(atualizacao);
    if (antigo) await ator.update({ "system.-=impeto": null });
    console.log(`${SYSTEM_ID} | barra de ímpeto de ${ator.name} movida para a habilidade "${alvo.name}"`);
  }
}


/**
 * Faz o pt-BR ser o idioma de quem ainda não escolheu nenhum.
 *
 * Ordem Paranormal é um jogo brasileiro e o sistema é escrito em pt-BR primeiro, mas o
 * Foundry nasce em inglês — sem isto cada jogador precisaria trocar o idioma na mão
 * antes de a ficha aparecer traduzida.
 *
 * O caminho é a chave do próprio setting no `localStorage`, não o `default` do setting:
 * o core só registra `core.language` *depois* do hook `init`, e resolve o idioma logo
 * em seguida, sem hook no meio. Escrever a chave equivale a o jogador ter escolhido
 * pt-BR uma vez — e é o mesmo lugar que o menu de configurações usa, então trocar o
 * idioma por lá continua funcionando normalmente.
 *
 * Quem já escolheu um idioma mantém o seu. O mestre desliga em `idiomaPadraoPtBR`.
 */
function aplicarIdiomaPadrao() {
  if (!lerConfig("idiomaPadraoPtBR")) return;
  try {
    if (window.localStorage.getItem("core.language") === null) {
      window.localStorage.setItem("core.language", "pt-BR");
    }
  } catch (erro) {
    console.warn(`${SYSTEM_ID} | não foi possível definir o idioma padrão`, erro);
  }
}

/**
 * Registro de fichas. `foundry.documents.collections` e
 * `foundry.applications.sheets` existem no v13 e no v14 — é o caminho que mantém o
 * sistema compatível com as duas versões sem camada de adaptação.
 */
function registrarSheets() {
  const { Actors, Items } = foundry.documents.collections;

  Actors.unregisterSheet("core", foundry.appv1.sheets.ActorSheet);
  Actors.registerSheet(SYSTEM_ID, PersonagemSheet, {
    types: ["personagem"], makeDefault: true, label: "OP2.Ficha.Personagem",
  });
  Actors.registerSheet(SYSTEM_ID, NpcSheet, {
    types: ["npc"], makeDefault: true, label: "OP2.Ficha.Npc",
  });
  Actors.registerSheet(SYSTEM_ID, InvestigacaoSheet, {
    types: ["investigacao"], makeDefault: true, label: "OP2.Ficha.Investigacao",
  });

  Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);
  Items.registerSheet(SYSTEM_ID, OP2ItemSheet, {
    types: ["habilidade", "equipamento", "ferramenta", "ocupacao"], makeDefault: true, label: "OP2.Ficha.Item",
  });
  Items.registerSheet(SYSTEM_ID, PontoInteresseSheet, {
    types: ["ponto-interesse"], makeDefault: true, label: "OP2.Ficha.PontoInteresse",
  });
  Items.registerSheet(SYSTEM_ID, DesafioAcessoSheet, {
    types: ["desafio-acesso"], makeDefault: true, label: "OP2.Ficha.DesafioAcesso",
  });
  Items.registerSheet(SYSTEM_ID, EventoSheet, {
    types: ["evento"], makeDefault: true, label: "OP2.Ficha.Evento",
  });
}
