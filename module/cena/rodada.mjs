/**
 * Rodadas e sobrecarga mental (spec §5.2/§7.6).
 *
 * Não usamos o Combat do core: sem iniciativa rolada, a ordem é decidida pela mesa
 * e os NPCs agem por último. O contador mora em flag da cena e alimenta a
 * sobrecarga — a pressão que faz os jogadores decidirem quando parar de
 * investigar. Nem toda cena usa: o mestre liga e desliga no painel.
 */
import { SYSTEM_ID, TABELA_SOBRECARGA_PADRAO } from "../config.mjs";
import { danoSobrecarga } from "./investigacao.mjs";
import { personagensDaCenaAtiva } from "./encerrar-cena.mjs";
import { renderizar } from "../dice/teste.mjs";
import { aplicarDano } from "../dice/falha-critica.mjs";
import { testarFadigaDeSustentar } from "./acoes-desafio.mjs";

export function rodadaAtual(cena = canvas.scene) {
  return cena?.getFlag(SYSTEM_ID, "rodada") ?? 0;
}

/** Tabela da cena, ou a de referência do playtest se a cena nunca editou. */
export function sobrecargaDaCena(cena = canvas.scene) {
  const gravada = cena?.getFlag(SYSTEM_ID, "sobrecarga");
  return {
    ativa: gravada?.ativa ?? false,
    tabela: gravada?.tabela ?? TABELA_SOBRECARGA_PADRAO.map((linha) => ({ ...linha })),
  };
}

export async function definirSobrecarga(sobrecarga, cena = canvas.scene) {
  await cena?.setFlag(SYSTEM_ID, "sobrecarga", sobrecarga);
}

/**
 * Encerra a rodada atual e anuncia a próxima. A sobrecarga pega no fim da rodada
 * (spec §7.6): ao encerrar a rodada N, aplica o dano da linha N da tabela — com um
 * botão por personagem, porque cada jogador rola o seu.
 */
export async function avancarRodada() {
  const cena = canvas.scene;
  if (!cena) {
    ui.notifications.warn(game.i18n.localize("OP2.Painel.SemCena"));
    return null;
  }

  const encerrada = rodadaAtual(cena);
  const nova = encerrada + 1;
  await cena.setFlag(SYSTEM_ID, "rodada", nova);

  const sobrecarga = sobrecargaDaCena(cena);
  const dano = sobrecarga.ativa && encerrada >= 1 ? danoSobrecarga(sobrecarga.tabela, encerrada) : "0";

  // Fim de rodada também é quando quem está Sustentando (spec §7.5) testa de novo,
  // com a fadiga acumulada. Roda para todo mundo na cena, não só o dono do painel.
  if (encerrada >= 1) {
    for (const personagem of personagensDaCenaAtiva()) {
      if (personagem.system.estado.sustentando?.ativo) await testarFadigaDeSustentar(personagem);
    }
  }

  const conteudo = await renderizar("systems/ordem-paranormal-2e/templates/chat/rodada.hbs", {
    nova,
    encerrada,
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
