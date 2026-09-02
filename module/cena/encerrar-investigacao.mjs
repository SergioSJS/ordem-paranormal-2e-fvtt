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
    // O aumento do Ímpeto também vale "até o fim da cena".
    "system.estado.aumentosTemporarios.fisico": 0,
    "system.estado.aumentosTemporarios.mente": 0,
    "system.estado.aumentosTemporarios.emocao": 0,
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

/**
 * Quem pode ser alvo de uma ação que envolve outro personagem (Ajudar, Compartilhar,
 * Atacar).
 *
 * Não é "todo ator do mundo", nem sequer todo participante: quem o mestre escondeu
 * (`participantesOcultos`) não está em cena, e oferecê-lo como alvo entrega que ele
 * existe (achado em uso real: "lista tudo, não faz sentido algum"). Quem chama diz se
 * NPC entra — Ajudar é entre personagens, Atacar não.
 *
 * @param {object} [opcoes]
 * @param {Actor}  [opcoes.exceto]   quem está agindo, fora da própria lista
 * @param {boolean} [opcoes.comNpcs] inclui os NPCs do roster
 */
export function alvosDaCenaAtiva({ exceto, comNpcs = false } = {}) {
  const investigacao = investigacaoAtiva();
  const ocultos = investigacao?.system.participantesOcultos ?? [];
  const roster = comNpcs
    ? [...personagensDaCenaAtiva(), ...npcsDaCenaAtiva()]
    : personagensDaCenaAtiva();

  return roster
    .filter((ator) => !ocultos.includes(ator.uuid))
    .filter((ator) => ator.id !== exceto?.id);
}

/**
 * O alvo marcado no mapa (a mira do Foundry), que é como a mesa já diz "é nele".
 *
 * Quando existe um alvo marcado, ele manda: não faz sentido abrir uma lista para
 * escolher de novo quem você já apontou, nem exigir que ele esteja no roster da
 * investigação (achado em uso real). Só entram tipos que o sistema conhece.
 *
 * @param {object} [opcoes]
 * @param {Actor}  [opcoes.exceto]   quem está agindo nunca é o próprio alvo
 * @param {string[]} [opcoes.tipos]  tipos aceitos; default personagem e NPC
 * @returns {Actor[]}
 */
export function alvosMarcados({ exceto, tipos = ["personagem", "npc"] } = {}) {
  const marcados = [...(game.user?.targets ?? [])]
    .map((token) => token.actor)
    .filter((ator) => ator && tipos.includes(ator.type) && ator.id !== exceto?.id);
  return [...new Set(marcados)];
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
