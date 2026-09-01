/**
 * Fim de cena.
 *
 * A cena é a unidade estrutural do jogo, não uma unidade de tempo (spec §5.1). Encerrar
 * é um evento explícito do mestre, e é o único momento em que as reduções temporárias
 * de atributo somem e as ações travadas do grupo voltam a ficar disponíveis.
 */
import { SYSTEM_ID } from "../config.mjs";

/**
 * @param {object} [opcoes]
 * @param {Actor[]} [opcoes.atores] default: todos os personagens com token na cena ativa
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
    // A revelação é por cena: encerrada a cena, o que foi descoberto nela é
    // conhecimento da mesa, não estado do sistema.
    "system.estado.poisInvestigados": [],
    "system.estado.infosReveladas": [],
  };

  const atualizacoes = alvos.map((ator) => ({ _id: ator.id, ...zerado }));
  await Actor.updateDocuments(atualizacoes);

  // O contador de rodadas alimenta a sobrecarga mental (spec §7.6) e reinicia junto.
  // Travas de 1×-por-cena e a ordem das rodadas também são da cena que terminou.
  const cena = canvas.scene;
  if (cena) {
    await cena.unsetFlag(SYSTEM_ID, "rodada");
    await cena.unsetFlag(SYSTEM_ID, "recapitularUsado");
    await cena.unsetFlag(SYSTEM_ID, "compartilharUsado");
    await cena.unsetFlag(SYSTEM_ID, "ordemRodada");
  }

  if (avisar) {
    ui.notifications.info(game.i18n.format("OP2.Cena.Encerrada", { total: alvos.length }));
  }
  return alvos;
}

/** Personagens com token na cena ativa. */
export function personagensDaCenaAtiva() {
  return atoresDaCenaAtiva("personagem");
}

/** NPCs com token na cena ativa — agem por último (spec §5.2). */
export function npcsDaCenaAtiva() {
  return atoresDaCenaAtiva("npc");
}

function atoresDaCenaAtiva(tipo) {
  const tokens = canvas.scene?.tokens ?? [];
  const atores = new Map();
  for (const token of tokens) {
    const ator = token.actor;
    if (ator?.type === tipo) atores.set(ator.id, ator);
  }
  return [...atores.values()];
}
