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
export async function avancarRodada() {
  const investigacao = investigacaoAtiva();
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
    for (const personagem of personagensDaCenaAtiva()) {
      if (personagem.system.estado.sustentando?.ativo) await testarFadigaDeSustentar(personagem);
    }
  }

  // O roteiro da cena: se a rodada que começa tem evento, ele entra no mesmo card.
  const evento = (investigacao.system.eventos ?? []).find((e) => e.rodada === nova) ?? null;

  const conteudo = await renderizar("systems/ordem-paranormal-2e/templates/chat/rodada.hbs", {
    nova,
    encerrada,
    evento,
    dano,
    temDano: dano !== "0",
    personagens: personagensDaCenaAtiva().map((a) => ({ id: a.id, nome: a.name })),
  });
  await ChatMessage.create({
    content: conteudo,
    flags: { [SYSTEM_ID]: { tipo: "rodada", rodada: nova } },
  });
  return nova;
}

/** Cada jogador rola o próprio dano de sobrecarga (spec §7.6); o mestre cobre ausentes. */
export async function rolarSobrecarga(ator, expressao) {
  const roll = await new Roll(expressao).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: ator }),
    flavor: game.i18n.localize("OP2.Rodada.Sobrecarga"),
  });
  if (roll.total > 0) await aplicarDano(ator, roll.total, "pd");
}
