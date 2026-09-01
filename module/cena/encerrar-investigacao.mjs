/**
 * Fim de investigação.
 *
 * A investigação é a unidade estrutural do jogo, não uma unidade de tempo (spec §5.1).
 * Encerrar é um evento explícito do mestre, e é o único momento em que as reduções
 * temporárias de atributo somem e as ações travadas do grupo voltam a ficar
 * disponíveis. O roster (`participantes`), os POIs e os desafios vinculados são
 * estrutura da investigação e não são zerados — só rodada, sobrecarga e as travas,
 * que são estado de sessão.
 */
import { investigacaoAtiva } from "./investigacao-ativa.mjs";

/**
 * @param {object} [opcoes]
 * @param {Actor[]} [opcoes.atores] default: todos os participantes da investigação ativa
 * @param {boolean} [opcoes.avisar]
 */
export async function encerrarCena({ atores, avisar = true } = {}) {
  const alvos = atores ?? personagensDaCenaAtiva();
  if (!alvos.length) {
    if (avisar) ui.notifications.warn(game.i18n.localize("OP2.Cena.SemPersonagens"));
    return [];
  }

  const zerado = {
    "system.estado.reducoesTemporarias.fisico": 0,
    "system.estado.reducoesTemporarias.mente": 0,
    "system.estado.reducoesTemporarias.emocao": 0,
    "system.estado.acoesUsadasNaCena": [],
    // A revelação é por investigação: encerrada, o que foi descoberto nela é
    // conhecimento da mesa, não estado do sistema.
    "system.estado.poisInvestigados": [],
    "system.estado.infosReveladas": [],
  };

  const atualizacoes = alvos.map((ator) => ({ _id: ator.id, ...zerado }));
  await Actor.updateDocuments(atualizacoes);

  // O contador de rodadas alimenta a sobrecarga mental (spec §7.6) e reinicia junto.
  // Travas de 1×-por-investigação e a ordem das rodadas também são da sessão que
  // terminou — o roster e os vínculos de POI/desafio continuam.
  const investigacao = investigacaoAtiva();
  if (investigacao) {
    await investigacao.update({
      "system.rodada": 0,
      "system.recapitularUsado": { usado: false, atorId: "", nome: "" },
      "system.compartilharUsado": { usado: false, atorId: "", nome: "" },
      "system.ordemParticipantes": [],
    });
  }

  if (avisar) {
    ui.notifications.info(game.i18n.format("OP2.Cena.Encerrada", { total: alvos.length }));
  }
  return alvos;
}

/** Personagens no roster da investigação ativa. */
export function personagensDaCenaAtiva() {
  return participantesDaInvestigacao("personagem");
}

/** NPCs no roster da investigação ativa — agem por último (spec §5.2). */
export function npcsDaCenaAtiva() {
  return participantesDaInvestigacao("npc");
}

function participantesDaInvestigacao(tipo) {
  const uuids = investigacaoAtiva()?.system.participantes ?? [];
  const atores = [];
  for (const uuid of uuids) {
    const ator = fromUuidSync(uuid);
    if (ator?.type === tipo) atores.push(ator);
  }
  return atores;
}
