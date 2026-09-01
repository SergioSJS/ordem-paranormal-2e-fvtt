/**
 * Investigação: qual está ativa agora, e as operações de vincular/desvincular
 * participantes, POIs e desafios (spec §5.1).
 *
 * Investigação é Actor, com ficha própria — a ficha e o painel flutuante chamam
 * as mesmas funções daqui, para não duplicar a regra de "não repete UUID" em dois
 * lugares. Nada aqui toca Scene, token ou canvas: uma investigação não depende de
 * qual mapa está em tela.
 */
import { SYSTEM_ID } from "../config.mjs";
import { lerConfig } from "../settings/register.mjs";

/** @returns {Actor[]} todas as investigações do mundo, mais recente primeiro. */
export function todasInvestigacoes() {
  return game.actors.filter((a) => a.type === "investigacao").sort((a, b) => b.sort - a.sort);
}

/** @returns {Actor|null} */
export function investigacaoAtiva() {
  const uuid = lerConfig("investigacaoAtivaUuid");
  if (!uuid) return null;
  const ator = fromUuidSync(uuid);
  return ator?.type === "investigacao" ? ator : null;
}

export async function definirInvestigacaoAtiva(uuid) {
  await game.settings.set(SYSTEM_ID, "investigacaoAtivaUuid", uuid ?? "");
}

/** @returns {Promise<Actor>} a nova investigação, já marcada como ativa. */
export async function criarInvestigacao(nome) {
  const ator = await Actor.create({
    name: nome || game.i18n.localize("OP2.Investigacao.NovaPadrao"),
    type: "investigacao",
  });
  await definirInvestigacaoAtiva(ator.uuid);
  return ator;
}

/** Participar não depende de token em Scene nenhuma — é um roster explícito. */
export async function adicionarParticipante(investigacao, atorUuid) {
  const participantes = investigacao.system.participantes;
  if (participantes.includes(atorUuid)) return;
  await investigacao.update({ "system.participantes": [...participantes, atorUuid] });
}

export async function removerParticipante(investigacao, atorUuid) {
  const participantes = investigacao.system.participantes.filter((uuid) => uuid !== atorUuid);
  await investigacao.update({ "system.participantes": participantes });
}

export async function definirOrdemParticipantes(investigacao, ordem) {
  await investigacao.update({ "system.ordemParticipantes": ordem });
}

export async function vincularPoi(investigacao, poiUuid) {
  const pois = investigacao.system.pois;
  if (pois.includes(poiUuid)) return;
  await investigacao.update({ "system.pois": [...pois, poiUuid] });
}

export async function removerPoi(investigacao, poiUuid) {
  await investigacao.update({ "system.pois": investigacao.system.pois.filter((uuid) => uuid !== poiUuid) });
}

export async function vincularDesafio(investigacao, desafioUuid) {
  const desafios = investigacao.system.desafios;
  if (desafios.includes(desafioUuid)) return;
  await investigacao.update({ "system.desafios": [...desafios, desafioUuid] });
}

export async function removerDesafio(investigacao, desafioUuid) {
  await investigacao.update({ "system.desafios": investigacao.system.desafios.filter((uuid) => uuid !== desafioUuid) });
}
