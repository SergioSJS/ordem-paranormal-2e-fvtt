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

/**
 * Sobe (`-1`) ou desce (`+1`) um participante na Ordem das Rodadas — alternativa ao
 * drag-and-drop, mais acessível e mais fácil de acertar em telas pequenas.
 *
 * Recebe `ordemAtual` já resolvida (quem chama sabe montar a ordem de exibição —
 * roster + `ordemParticipantes` gravada, com quem entrou de novo no fim) em vez de
 * ler `investigacao.system.ordemParticipantes` direto: cru, esse campo começa vazio
 * até o primeiro drag-and-drop, e mover a primeira linha nunca acharia o UUID nele.
 */
export async function moverParticipante(investigacao, ordemAtual, atorUuid, direcao) {
  const ordem = [...ordemAtual];
  const indice = ordem.indexOf(atorUuid);
  const novoIndice = indice + direcao;
  if (indice === -1 || novoIndice < 0 || novoIndice >= ordem.length) return;
  [ordem[indice], ordem[novoIndice]] = [ordem[novoIndice], ordem[indice]];
  await definirOrdemParticipantes(investigacao, ordem);
}

/**
 * Preparo antecipado (spec: mestre monta a investigação antes da mesa) não deveria
 * revelar na hora — `campo` é "pois" | "desafios" | "participantes", cada um com sua
 * própria lista `<campo>Ocultos` de UUIDs escondidos dos jogadores.
 */
export async function alternarOculto(investigacao, campo, uuid) {
  const chave = `${campo}Ocultos`;
  const ocultos = investigacao.system[chave];
  const novo = ocultos.includes(uuid)
    ? ocultos.filter((u) => u !== uuid)
    : [...ocultos, uuid];
  await investigacao.update({ [`system.${chave}`]: novo });
}

/**
 * Controle manual de quem já agiu na rodada corrente (spec §5.2 não automatiza
 * turnos). `avancarRodada()` zera a lista a cada rodada nova.
 */
export async function alternarJaAgiu(investigacao, atorUuid) {
  const jaAgiram = investigacao.system.jaAgiram;
  const novo = jaAgiram.includes(atorUuid)
    ? jaAgiram.filter((uuid) => uuid !== atorUuid)
    : [...jaAgiram, atorUuid];
  await investigacao.update({ "system.jaAgiram": novo });
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
