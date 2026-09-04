/**
 * Rodadas e sobrecarga mental (spec §5.2/§7.6).
 *
 * Não usamos o Combat do core: sem iniciativa rolada, a ordem é decidida pela mesa
 * e os NPCs agem por último. O contador mora no Actor da investigação (não em
 * Scene: uma investigação pode atravessar vários mapas, e o contador precisa
 * sobreviver à troca) e alimenta a sobrecarga — a pressão que faz os jogadores
 * decidirem quando parar de investigar. Nem toda investigação usa: o mestre liga e
 * desliga na ficha.
 */
import { SYSTEM_ID } from "../config.mjs";
import { danoSobrecarga } from "./investigacao.mjs";
import { personagensDaCenaAtiva } from "./encerrar-investigacao.mjs";
import { investigacaoAtiva } from "./investigacao-ativa.mjs";
import { renderizar } from "../dice/teste.mjs";
import { aplicarDano } from "../dice/falha-critica.mjs";
import { testarFadigaDeSustentar } from "./acoes-desafio.mjs";

export function rodadaAtual(investigacao = investigacaoAtiva()) {
  return investigacao?.system.rodada ?? 0;
}

/** Sobrecarga configurada na investigação — o schema já traz a tabela de referência. */
export function sobrecargaDaCena(investigacao = investigacaoAtiva()) {
  return investigacao?.system.sobrecarga ?? { ativa: false, tabela: [] };
}

export async function definirSobrecarga(sobrecarga, investigacao = investigacaoAtiva()) {
  await investigacao?.update({ "system.sobrecarga": sobrecarga });
}

/**
 * Encerra a rodada atual e anuncia a próxima. A sobrecarga pega no fim da rodada
 * (spec §7.6): ao encerrar a rodada N, aplica o dano da linha N da tabela — com um
 * botão por personagem, porque cada jogador rola o seu.
 */
export async function avancarRodada(investigacao = investigacaoAtiva()) {
  if (!investigacao) {
    ui.notifications.warn(game.i18n.localize("OP2.Painel.SemInvestigacao"));
    return null;
  }

  const encerrada = rodadaAtual(investigacao);
  const nova = encerrada + 1;
  // "Já agiu" é controle manual por rodada (spec §5.2 não automatiza turnos) —
  // zera a cada rodada nova.
  await investigacao.update({ "system.rodada": nova, "system.jaAgiram": [] });

  const sobrecarga = sobrecargaDaCena(investigacao);
  const dano = sobrecarga.ativa && encerrada >= 1 ? danoSobrecarga(sobrecarga.tabela, encerrada) : "0";

  // Fim de rodada também é quando quem está Sustentando (spec §7.5) testa de novo,
  // com a fadiga acumulada. Roda para todo mundo na cena, não só o dono do painel.
  if (encerrada >= 1) {
    for (const personagem of personagensDaCenaAtiva(investigacao)) {
      if (personagem.system.estado.sustentando?.ativo) await testarFadigaDeSustentar(personagem);
    }
  }

  // O roteiro da cena: se a rodada que começa tem evento, ele entra no mesmo card.
  const evento = (investigacao.system.eventos ?? []).find((e) => e.rodada === nova) ?? null;

  // O botão diz o que vai acontecer ao clicar: "rolar 1d4" ou "1 PD" fixo.
  const danoRola = /d/i.test(dano);
  const conteudo = await renderizar("systems/ordem-paranormal-2e/templates/chat/rodada.hbs", {
    nova,
    encerrada,
    evento: evento && {
      ...evento,
      narracao: await editorDeTexto().enrichHTML(evento.narracao ?? "", { relativeTo: investigacao }),
      efeito: await editorDeTexto().enrichHTML(evento.efeito ?? "", { relativeTo: investigacao }),
    },
    dano,
    danoRola,
    danoRotulo: danoRola
      ? game.i18n.format("OP2.Rodada.RolarDano", { dano })
      : game.i18n.format("OP2.Rodada.DanoFixo", { dano }),
    temDano: dano !== "0",
    personagens: personagensDaCenaAtiva(investigacao).map((a) => ({ id: a.id, nome: a.name })),
  });
  await ChatMessage.create({
    content: conteudo,
    flags: { [SYSTEM_ID]: { tipo: "rodada", rodada: nova } },
  });
  return nova;
}

function editorDeTexto() {
  return foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
}

/**
 * Cada jogador rola o próprio dano de sobrecarga (spec §7.6); o mestre cobre ausentes.
 * O card é o do sistema, com os dados como ícones e o que foi aplicado — a mensagem
 * crua do core ("1 = 1") não dizia nem de que se tratava (achado em uso real).
 */
export async function rolarSobrecarga(ator, expressao) {
  const roll = await new Roll(expressao).evaluate();
  await cardDeDano(ator, roll, {
    titulo: game.i18n.localize("OP2.Rodada.Sobrecarga"),
    recurso: "pd",
    flags: { tipo: "sobrecarga" },
  });
  if (roll.total > 0) await aplicarDano(ator, roll.total, "pd");
}

/**
 * Card de uma rolagem de dano avulsa (sobrecarga, acidente da falha crítica): os
 * dados rolados, o total e em que recurso cai. `rolls` vai junto, para o Dice So Nice
 * animar e para a mensagem guardar a rolagem de verdade.
 * @param {Actor} ator
 * @param {Roll} roll
 * @param {{titulo: string, recurso: "pv"|"pd", flags?: object}} opcoes
 */
export async function cardDeDano(ator, roll, { titulo, recurso, flags = {} }) {
  const dados = roll.dice.flatMap((termo) => termo.results.map((r) => ({
    dado: `d${termo.faces}`, resultado: r.result, contado: r.active !== false,
  })));
  const conteudo = await renderizar("systems/ordem-paranormal-2e/templates/chat/dano.hbs", {
    titulo,
    formula: roll.formula,
    dados,
    fixo: dados.length === 0,
    total: roll.total,
    recurso: game.i18n.localize(`OP2.Recurso.${recurso}`),
    semDano: roll.total <= 0,
  });
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: ator }),
    content: conteudo,
    rolls: [roll],
    flags: { [SYSTEM_ID]: { atorId: ator.id, ...flags } },
  });
}
