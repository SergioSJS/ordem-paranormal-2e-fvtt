/**
 * Investigação: quais estão em jogo agora, qual cada usuário está vendo, e as
 * operações de vincular/desvincular participantes, POIs e desafios (spec §5.1).
 *
 * Investigação é Actor, com ficha própria — a ficha e o painel flutuante chamam
 * as mesmas funções daqui, para não duplicar a regra de "não repete UUID" em dois
 * lugares. Nada aqui toca Scene, token ou canvas: uma investigação não depende de
 * qual mapa está em tela.
 *
 * O grupo pode se dividir em mais de uma investigação ao mesmo tempo (achado em
 * uso real) — por isso "em jogo" (`investigacoesAtivasUuids`, setting de mundo, o
 * mestre decide quais existem-mas-não-estão-em-jogo-ainda) é diferente de "o que
 * este usuário está vendo agora" (`investigacaoVisualizandoUuid`, setting de
 * cliente — cada jogador navega entre as suas próprias, o mestre entre todas).
 */
import { SYSTEM_ID } from "../config.mjs";
import { lerConfig } from "../settings/register.mjs";

/** @returns {Actor[]} todas as investigações do mundo, mais recente primeiro. */
export function todasInvestigacoes() {
  return game.actors.filter((a) => a.type === "investigacao").sort((a, b) => b.sort - a.sort);
}

/** @returns {Actor[]} as marcadas "em jogo" pelo mestre — todas, ativas ou não, seguem em `todasInvestigacoes()`. */
export function investigacoesAtivas() {
  return lerConfig("investigacoesAtivasUuids")
    .map((uuid) => fromUuidSync(uuid)).filter((a) => a?.type === "investigacao");
}

export function estaAtiva(investigacao) {
  return lerConfig("investigacoesAtivasUuids").includes(investigacao.uuid);
}

/** Liga/desliga uma investigação como "em jogo" — controla o que os jogadores podem navegar. */
export async function alternarAtiva(investigacao) {
  const uuids = lerConfig("investigacoesAtivasUuids");
  const novo = uuids.includes(investigacao.uuid)
    ? uuids.filter((uuid) => uuid !== investigacao.uuid)
    : [...uuids, investigacao.uuid];
  await game.settings.set(SYSTEM_ID, "investigacoesAtivasUuids", novo);
}

/**
 * O que o usuário atual pode navegar no painel: o mestre prepara e acompanha
 * qualquer uma (`todasInvestigacoes()`), sem precisar que esteja "em jogo" ainda;
 * o jogador só vê as em-jogo onde o personagem dele participa e não está oculto.
 */
export function investigacoesVisiveis() {
  if (game.user.isGM) return todasInvestigacoes();
  const personagem = game.user.character;
  if (!personagem) return [];
  return investigacoesAtivas().filter((investigacao) => investigacao.system.participantes.includes(personagem.uuid)
    && !investigacao.system.participantesOcultos.includes(personagem.uuid));
}

/** @returns {Actor|null} a investigação que o usuário atual está vendo agora no painel. */
export function investigacaoAtiva() {
  const visiveis = investigacoesVisiveis();
  const uuid = lerConfig("investigacaoVisualizandoUuid");
  const escolhida = visiveis.find((investigacao) => investigacao.uuid === uuid);
  return escolhida ?? visiveis[0] ?? null;
}

/** Define qual investigação O USUÁRIO ATUAL está vendo — ponteiro de cliente, não de mundo. */
export async function definirInvestigacaoAtiva(uuid) {
  await game.settings.set(SYSTEM_ID, "investigacaoVisualizandoUuid", uuid ?? "");
}

/** @returns {Promise<Actor>} a nova investigação, já em jogo e selecionada para quem criou. */
export async function criarInvestigacao(nome) {
  const ator = await Actor.create({
    name: nome || game.i18n.localize("OP2.Investigacao.NovaPadrao"),
    type: "investigacao",
  });
  await alternarAtiva(ator);
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
 * Sobe (`-1`) ou desce (`+1`) um UUID dentro de uma lista — pura, sem Foundry, pra
 * dar pra testar offline. Uma lista só, com personagens e NPCs misturados: a mesa
 * decide a ordem inteira. (A spec §5.2 sugere NPCs por último; prender o grupo de
 * NPCs no fim deixava a linha deles imóvel na prática — decisão de mesa, não do
 * sistema.)
 * @returns {string[]} nova ordem, ou a mesma se o UUID não estiver na lista ou já
 *   estiver na ponta pra onde `direcao` aponta.
 */
export function ordemAposMover(ordemAtual, uuid, direcao) {
  const ordem = [...ordemAtual];
  const indice = ordem.indexOf(uuid);
  const novoIndice = indice + direcao;
  if (indice === -1 || novoIndice < 0 || novoIndice >= ordem.length) return ordem;
  [ordem[indice], ordem[novoIndice]] = [ordem[novoIndice], ordem[indice]];
  return ordem;
}

/**
 * Alternativa ao drag-and-drop, mais fácil de acertar numa lista curta (achado em
 * uso real: mestre errando o alvo do drop). `ordem` é a ordem de EXIBIÇÃO da lista
 * inteira (roster + `ordemParticipantes` gravada, com quem entrou de novo no fim),
 * não o campo cru: esse começa vazio até o primeiro movimento, e aí mover a
 * primeira linha nunca acharia o UUID nele.
 */
export async function moverParticipante(investigacao, ordem, atorUuid, direcao) {
  await definirOrdemParticipantes(investigacao, ordemAposMover(ordem, atorUuid, direcao));
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
