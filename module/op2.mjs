/**
 * Ordem Paranormal 2 (Playtest Alpha) — sistema não-oficial para Foundry VTT.
 * Compatível com v13 e v14.
 */
import { SYSTEM_ID, OP2 } from "./config.mjs";
import { PersonagemData } from "./data/actor-personagem.mjs";
import { NpcData } from "./data/actor-npc.mjs";
import { HabilidadeData } from "./data/item-habilidade.mjs";
import { EquipamentoData } from "./data/item-equipamento.mjs";
import { FerramentaData } from "./data/item-ferramenta.mjs";
import { PontoInteresseData } from "./data/item-ponto-interesse.mjs";
import { DesafioAcessoData } from "./data/item-desafio-acesso.mjs";
import { InvestigacaoData } from "./data/actor-investigacao.mjs";
import { PersonagemSheet } from "./sheets/actor-personagem-sheet.mjs";
import { NpcSheet } from "./sheets/actor-npc-sheet.mjs";
import { InvestigacaoSheet } from "./sheets/actor-investigacao-sheet.mjs";
import { OP2ItemSheet } from "./sheets/item-sheet.mjs";
import { PontoInteresseSheet } from "./sheets/item-ponto-interesse-sheet.mjs";
import { DesafioAcessoSheet } from "./sheets/item-desafio-acesso-sheet.mjs";
import { OP2Roll } from "./dice/op2-roll.mjs";
import { rolarTeste } from "./dice/teste.mjs";
import { stepDie, faces } from "./dice/escada.mjs";
import { registrarSettings, lerConfig } from "./settings/register.mjs";
import { registrarHelpersDeDado } from "./ui/dice-icons.mjs";
import { registrarHelpers, precarregarTemplates } from "./ui/handlebars.mjs";
import { registrarChat } from "./ui/chat.mjs";
import { encerrarCena } from "./cena/encerrar-investigacao.mjs";
import { registrarPainelInvestigacao, abrirPainelInvestigacao } from "./cena/painel-investigacao.mjs";
import { avancarRodada } from "./cena/rodada.mjs";
import {
  investigacaoAtiva, todasInvestigacoes, definirInvestigacaoAtiva, criarInvestigacao,
  adicionarParticipante, removerParticipante, vincularPoi, removerPoi, vincularDesafio, removerDesafio,
  alternarJaAgiu,
} from "./cena/investigacao-ativa.mjs";
import {
  investigar, examinar, interagir, recapitular, compartilhar, dialogoInvestigar,
} from "./cena/acoes-investigacao.mjs";
import {
  arrombar, alcancar, sustentar, pararDeSustentar, gerarSenhaDestrancar, tentarDestrancar,
} from "./cena/acoes-desafio.mjs";
import { usarFerramenta, usarLaser } from "./cena/acoes-ferramenta.mjs";
import { abrirDestrancar } from "./cena/destrancar-app.mjs";
import { abrirLaboratorio } from "./cena/laboratorio-app.mjs";

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

  CONFIG.Dice.rolls.unshift(OP2Roll);

  registrarSettings();
  aplicarIdiomaPadrao();
  registrarHelpersDeDado();
  registrarHelpers();
  registrarSheets();
  registrarChat();
  registrarPainelInvestigacao();

  // Sem iniciativa rolada: os jogadores decidem a ordem entre si (spec §5.2).
  CONFIG.Combat.initiative = { formula: "0", decimals: 0 };

  game.op2 = {
    rolarTeste, encerrarCena, stepDie, faces, OP2Roll,
    investigar, examinar, interagir, recapitular, compartilhar, dialogoInvestigar,
    painelInvestigacao: abrirPainelInvestigacao, avancarRodada,
    arrombar, alcancar, sustentar, pararDeSustentar,
    gerarSenhaDestrancar, tentarDestrancar, abrirDestrancar,
    usarFerramenta, usarLaser, abrirLaboratorio,
    investigacaoAtiva, todasInvestigacoes, definirInvestigacaoAtiva, criarInvestigacao,
    adicionarParticipante, removerParticipante, vincularPoi, removerPoi, vincularDesafio, removerDesafio,
    alternarJaAgiu,
  };
});

Hooks.once("ready", () => precarregarTemplates());

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
    types: ["habilidade", "equipamento", "ferramenta"], makeDefault: true, label: "OP2.Ficha.Item",
  });
  Items.registerSheet(SYSTEM_ID, PontoInteresseSheet, {
    types: ["ponto-interesse"], makeDefault: true, label: "OP2.Ficha.PontoInteresse",
  });
  Items.registerSheet(SYSTEM_ID, DesafioAcessoSheet, {
    types: ["desafio-acesso"], makeDefault: true, label: "OP2.Ficha.DesafioAcesso",
  });
}
