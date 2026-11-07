/**
 * A cena de ação em andamento: quem está nela, rodada e fase. O jogador não escreve em
 * documento de mundo, então o que muda a cena passa pelo mestre (`comoMestre`).
 */
import { SYSTEM_ID } from "../config.mjs";
import { comoMestre, registrarAcaoDeMestre } from "../ui/socket.mjs";
import { linhaDaRodada } from "../cena/eventos.mjs";
import { aplicarDano } from "../dice/falha-critica.mjs";
import { ZERADO_DO_BETA, ZERADO_DA_CENA } from "../cena/encerrar-investigacao.mjs";
import { esvaziarImpeto } from "../cena/impeto.mjs";
import { cardVigilia } from "./card.mjs";
import { pedirTesteBeta, botoesDeRecuperacao } from "./queda.mjs";
import { modoAtual } from "../modo.mjs";
import { FASES, proximaFase, virarRodada, CONDICOES_DE_DUAS_RODADAS } from "./combate.mjs";
import { folegoInicial } from "./perseguicao.mjs";
import { fimDaRodadaDaPerseguicao, sortearAtaquesDasCabecas } from "./acoes-perseguicao.mjs";
import { fimDaRodadaDaFurtividade } from "./acoes-furtividade.mjs";

/** A cena de ação ligada agora. Uma de cada vez: é o que o painel mostra. */
export const cenaAcaoAtiva = () => game.actors?.find((a) => a.type === "cena-acao" && a.system.ativa) ?? null;

/** Ator por uuid, tokens sem vínculo inclusive. */
export function atorDe(uuid) {
  const doc = fromUuidSync(uuid);
  return doc?.actor ?? doc ?? null;
}

export const participantesDe = (cena) => cena.system.participantes.map(atorDe).filter(Boolean);
export const personagensDe = (cena) => participantesDe(cena).filter((a) => a.type === "personagem");

/** Quem pode entrar numa cena de ação: personagem ou NPC, inclusive token sem vínculo. */
const PODE_ENTRAR = ["personagem", "npc"];

/**
 * Põe atores na cena e devolve quantos entraram. Personagem e token já em cena não repetem.
 * Criatura do diretório (o ator-modelo) não entra ela mesma: vira uma instância nova, com PV
 * próprio, a cada vez — pôr o Afogado duas vezes dá dois afogados.
 */
export async function porNaCena(cena, uuids) {
  let entraram = 0;
  const diretos = [];
  for (const uuid of [...new Set(uuids)].filter(Boolean)) {
    const ator = atorDe(uuid);
    if (!PODE_ENTRAR.includes(ator?.type)) continue;
    if (ator.type === "npc" && !ator.isToken && !ator.getFlag(SYSTEM_ID, "copiaDe")) {
      entraram += (await adicionarCriaturas(cena, uuid, 1)).length;
      continue;
    }
    if (!cena.system.participantes.includes(uuid)) diretos.push(uuid);
  }
  if (diretos.length) await cena.update({ "system.participantes": [...cena.system.participantes, ...diretos] });
  return entraram + diretos.length;
}

/** Tira um ator da cena (e da lista de quem já agiu). */
/**
 * Tira um ator da cena (e da lista de quem já agiu). Criatura que a própria cena criou (o
 * "Afogado 2") sai também do mapa ou da pasta; token ou ator que o mestre pôs fica onde está.
 */
export async function tirarDaCena(cena, uuid) {
  await cena.update({
    "system.participantes": cena.system.participantes.filter((u) => u !== uuid),
    "system.agiram": cena.system.agiram.filter((a) => a.ator !== uuid),
  });
  const ator = atorDe(uuid);
  if (ator?.isToken && ator.token?.getFlag(SYSTEM_ID, "daCena") === cena.id) await ator.token.delete();
  else if (!ator?.isToken && ator?.getFlag(SYSTEM_ID, "daCena") === cena.id) await ator.delete();
}

/**
 * Tira a cena do ar sem zerar nada: desfaz um "Iniciar" sem querer e volta à montagem. Quem
 * participa fica como estava; o próximo Iniciar recomeça na rodada 1.
 */
export function pararCena(cena) {
  return cena.update({ "system.ativa": false, "system.rodada": 0, "system.fase": "", "system.agiram": [] });
}

/** Quem pode entrar pela lista: personagens (fora os que já estão) e criaturas-modelo (sempre). */
export function candidatosParaCena(cena) {
  const naCena = new Set(cena?.system.participantes ?? []);
  const ordenar = (lista) => lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const lista = (tipo) => ordenar(game.actors
    .filter((a) => a.type === tipo && !a.getFlag(SYSTEM_ID, "copiaDe") && (tipo === "npc" || !naCena.has(a.uuid)))
    .map((a) => ({ uuid: a.uuid, nome: a.name })));
  return { pcs: lista("personagem"), npcs: lista("npc") };
}

/** Os personagens de quem joga: o escolhido de cada jogador e todo personagem com dono jogador. */
export function personagensDosJogadores() {
  const escolhidos = game.users.filter((u) => !u.isGM && u.character).map((u) => u.character);
  const comDono = game.actors.filter((a) => a.type === "personagem" && a.hasPlayerOwner);
  return [...new Set([...escolhidos, ...comDono])];
}

const FASE_INICIAL = { combate: "suporte", perseguicao: "", furtividade: "personagens" };

/** Liga a cena na rodada 1. As outras cenas de ação desligam. */
export async function iniciarCena(cena) {
  for (const outra of game.actors.filter((a) => a.type === "cena-acao" && a.system.ativa && a.id !== cena.id)) {
    await outra.update({ "system.ativa": false });
  }
  await cena.update({
    "system.ativa": true, "system.rodada": 1, "system.fase": FASE_INICIAL[cena.system.tipo],
    "system.agiram": [], "system.sacrificios": [], "system.usosDistrair": 0, "system.areaAtual": 0, "system.vistas": [],
  });
  const pcs = personagensDe(cena);
  if (cena.system.tipo === "perseguicao") {
    await Promise.all(pcs.map((a) => a.update({
      "system.estado.perseguicao": {
        avanco: 0, folego: folegoInicial(a.system.pericias.vigor.dadoEfetivo), esforcos: 0,
        periciasUsadas: [], derrubado: false, obstaculo: false, avisado: false,
      },
    })));
  }
  if (cena.system.tipo === "furtividade") {
    await Promise.all(pcs.map((a) => a.update({
      "system.estado.furtividade": { esconderijo: [], testou: false, avancos: 0, usosEsconder: 0, trilha: false, esperando: false },
    })));
  }
  // Roteiro: a rodada 1 do evento é a rodada 1 da cena.
  for (const uuid of cena.system.eventos) {
    const item = await fromUuid(uuid);
    if (item) await item.update({ "system.disparado": true, "system.rodadaInicial": 0 });
  }
  await anunciarRodada(cena, 1);
  return cena;
}

/**
 * O card da rodada para a mesa, com a narração; o efeito vai num sussurro ao mestre, porque
 * é instrução e às vezes solução (o mesmo corte de `chat/rodada.hbs` no roteiro do alpha).
 * Quem chama é o mestre: o sussurro nasce com ele de autor.
 */
async function anunciarRodada(cena, rodada, linhas = []) {
  const narracoes = [];
  const efeitos = [];
  for (const uuid of cena.system.eventos) {
    const item = fromUuidSync(uuid);
    if (!item?.system) continue;
    const linha = linhaDaRodada(item.system, rodada);
    if (!linha) continue;
    if (linha.narracao?.trim()) narracoes.push(`<em>${linha.narracao}</em>`);
    if (linha.efeito?.trim()) efeitos.push(linha.efeito);
  }
  const titulo = game.i18n.format("OP2.CenaAcao.Rodada", { n: rodada });
  if (efeitos.length) {
    await cardVigilia(null, { titulo, selo: cena.name, linhas: efeitos, whisper: game.users.filter((u) => u.isGM).map((u) => u.id) });
  }
  return cardVigilia(null, { titulo, selo: cena.name, linhas: [...linhas, ...narracoes] });
}

/** O avanço do mestre: fase seguinte ou rodada seguinte, conforme o tipo da cena. */
export async function avancarCena(cena) {
  const { tipo, fase, rodada } = cena.system;
  if (tipo === "combate") {
    const proxima = proximaFase(fase);
    if (proxima) return cena.update({ "system.fase": proxima });
    return novaRodada(cena, rodada + 1, FASES[0]);
  }
  if (tipo === "furtividade") {
    // A tabela das criaturas é botão: virar a fase não rola nada.
    if (fase === "personagens") return cena.update({ "system.fase": "criaturas" });
    await fimDaRodadaDaFurtividade(cena);
    return novaRodada(cena, rodada + 1, "personagens");
  }
  // O corte vira card com botões; quem encerra a cena é o mestre.
  await fimDaRodadaDaPerseguicao(cena);
  return novaRodada(cena, rodada + 1, "");
}

/** Mexer à mão em rodada e fase: o mestre sempre pode voltar ou pular. */
export function definirRodada(cena, rodada) {
  return cena.update({ "system.rodada": Math.max(0, rodada) });
}
export function definirFase(cena, fase) {
  return cena.update({ "system.fase": fase });
}
/** Marca ou desmarca "já agiu": a lista é ajuda de memória, não trava. */
export function alternarAgiu(cena, ator) {
  return comoMestre("vigilia-alternar-agiu", { cenaUuid: cena.uuid, ator: ator.uuid });
}

/** O corte alcançou alguém: quem clica é o mestre (Missão 1). */
export const marcarDerrubado = (ator) => comoMestre("vigilia-derrubado", { atorUuid: ator.uuid });
export const sortearCabecas = (cena) => sortearAtaquesDasCabecas(cena);

async function novaRodada(cena, rodada, fase) {
  const atores = participantesDe(cena);
  const virada = virarRodada(
    atores.map((a) => ({ id: a.uuid, condicoes: [...(a.system.estado?.condicoes ?? [])] })),
    cena.system.vistas,
  );
  await cena.update({ "system.rodada": rodada, "system.fase": fase, "system.agiram": [], "system.sacrificios": [], "system.vistas": virada.vistas });
  // O que dura só a rodada, ou que já cumpriu a seguinte, sai aqui.
  for (const ator of atores) {
    const saem = virada.saem.filter((s) => s.id === ator.uuid).map((s) => s.condicao);
    if (saem.length) await ator.update({ "system.estado.condicoes": [...ator.system.estado.condicoes].filter((c) => !saem.includes(c)) });
  }
  await anunciarRodada(cena, rodada);
  // Moribundo testa no fim de cada rodada, menos a em que ficou (beta §8.2). O card só pede.
  for (const uuid of virada.testam) {
    const ator = atorDe(uuid);
    if (ator?.type === "personagem") await pedirTesteBeta(ator, "lesao");
  }
  return cena;
}

/**
 * Fim da cena: o que o beta manda acabar some, e a cena desliga (beta §8, §12). Quem ficou
 * com 0 PV recupera 1 "se sobreviver", e quem sabe disso é a mesa: vira botão do mestre.
 */
export async function encerrarCenaAcao(cena) {
  const pcs = personagensDe(cena);
  // No moderno, o combate é um trecho da investigação: reduções só somem no fim dela (spec §5.1),
  // e o Ímpeto que esvazia é regra do beta (beta §12).
  const vigilia = modoAtual() === "vigilia";
  for (const ator of pcs) {
    await ator.update({ ...ZERADO_DO_BETA, ...(vigilia ? ZERADO_DA_CENA : {}) });
    if (vigilia) await esvaziarImpeto(ator);
  }
  await cena.update({ "system.ativa": false, "system.agiram": [], "system.vistas": [] });
  return cardVigilia(null, {
    titulo: game.i18n.localize("OP2.CenaAcao.Encerrada"),
    selo: cena.name,
    botoes: botoesDeRecuperacao(pcs),
  });
}

/** Marca que o ator agiu nesta rodada. */
export function registrarAcao(cena, ator, fase) {
  return comoMestre("vigilia-registrar-acao", { cenaUuid: cena.uuid, ator: ator.uuid, fase });
}

/** Põe ou tira uma condição em alguém, com a permissão de quem pode. */
export function mudarCondicao(ator, condicao, ligar) {
  return comoMestre("vigilia-condicao", { atorUuid: ator.uuid, condicao, ligar });
}

/** O ator-modelo por trás de uma instância: o do token sem vínculo, ou o da cópia. */
function modeloDe(ator) {
  if (!ator) return null;
  if (ator.isToken) return game.actors.get(ator.token?.actorId) ?? ator;
  return game.actors.get(ator.getFlag(SYSTEM_ID, "copiaDe")) ?? ator;
}

/**
 * Põe N criaturas na cena, cada uma com os SEUS PV e um nome numerado ("Afogado 1",
 * "Afogado 2"…). Criatura não é pessoa única: pôr o mesmo Afogado de novo é outro afogado.
 *
 * Com um mapa aberto, cada uma vira um token sem vínculo, no meio da vista. Sem mapa, uma
 * cópia do ator na pasta "Criaturas em cena". O ator-modelo nunca entra na cena.
 */
export async function adicionarCriaturas(cena, modeloUuid, quantos = 1) {
  const modelo = modeloDe(await fromUuid(modeloUuid));
  if (!modelo || modelo.type !== "npc") return [];
  const n = Math.max(1, Math.min(20, Number(quantos) || 1));
  const jaNaCena = participantesDe(cena).filter((a) => modeloDe(a)?.id === modelo.id).length;
  const nomes = Array.from({ length: n }, (_v, i) => `${modelo.name} ${jaNaCena + i + 1}`);
  const scene = canvas?.ready ? canvas.scene : null;
  let uuids;
  if (scene) {
    const tamanho = scene.grid.size;
    const centro = { x: canvas.stage.pivot.x, y: canvas.stage.pivot.y };
    const base = modelo.prototypeToken.toObject();
    const tokens = nomes.map((nome, i) => ({
      ...base, actorId: modelo.id, actorLink: false, name: nome, delta: { name: nome },
      flags: { ...(base.flags ?? {}), [SYSTEM_ID]: { ...(base.flags?.[SYSTEM_ID] ?? {}), daCena: cena.id } },
      x: Math.round(centro.x + (i - (n - 1) / 2) * tamanho * 1.2 - tamanho / 2),
      y: Math.round(centro.y - tamanho / 2),
    }));
    const criados = await scene.createEmbeddedDocuments("Token", tokens);
    uuids = criados.map((t) => t.actor?.uuid).filter(Boolean);
  } else {
    const pasta = game.folders.find((f) => f.type === "Actor" && f.name === game.i18n.localize("OP2.CenaAcao.PastaCriaturas"))
      ?? await CONFIG.Folder.documentClass.create({ type: "Actor", name: game.i18n.localize("OP2.CenaAcao.PastaCriaturas") });
    const dados = modelo.toObject();
    delete dados._id;
    const criados = await CONFIG.Actor.documentClass.createDocuments(nomes.map((nome) => ({
      ...dados, name: nome, folder: pasta.id,
      prototypeToken: { ...dados.prototypeToken, name: nome },
      flags: { ...(dados.flags ?? {}), [SYSTEM_ID]: { ...(dados.flags?.[SYSTEM_ID] ?? {}), copiaDe: modelo.id, daCena: cena.id } },
    })));
    uuids = criados.map((a) => a.uuid);
  }
  await cena.update({ "system.participantes": [...cena.system.participantes, ...uuids] });
  return uuids;
}

export function registrarCenaAcao() {
  registrarAcaoDeMestre("vigilia-registrar-acao", async ({ cenaUuid, ator, fase }) => {
    const cena = await fromUuid(cenaUuid);
    if (!cena) return;
    await cena.update({ "system.agiram": [...cena.system.agiram, { ator, fase: fase ?? "" }] });
  });
  registrarAcaoDeMestre("vigilia-alternar-agiu", async ({ cenaUuid, ator }) => {
    const cena = await fromUuid(cenaUuid);
    if (!cena) return;
    const agiu = cena.system.agiram.some((a) => a.ator === ator);
    await cena.update({ "system.agiram": agiu
      ? cena.system.agiram.filter((a) => a.ator !== ator)
      : [...cena.system.agiram, { ator, fase: cena.system.fase }] });
  });
  registrarAcaoDeMestre("vigilia-condicao", async ({ atorUuid, condicao, ligar }) => {
    const ator = atorDe(atorUuid);
    if (!ator?.system.estado) return;
    const atuais = new Set(ator.system.estado.condicoes);
    if (ligar) atuais.add(condicao);
    else atuais.delete(condicao);
    await ator.update({ "system.estado.condicoes": [...atuais] });
    // Fintar ou Mirar de novo renova: a contagem de duas rodadas recomeça.
    const cena = cenaAcaoAtiva();
    const chave = `${atorUuid}|${condicao}`;
    if (ligar && cena?.system.vistas.includes(chave) && CONDICOES_DE_DUAS_RODADAS.includes(condicao)) {
      await cena.update({ "system.vistas": cena.system.vistas.filter((v) => v !== chave) });
    }
  });
  registrarAcaoDeMestre("vigilia-dano", async ({ atorUuid, quantidade, recurso }) => {
    const ator = atorDe(atorUuid);
    if (ator) await aplicarDano(ator, quantidade, recurso ?? "pv");
  });
  registrarAcaoDeMestre("vigilia-derrubado", async ({ atorUuid }) => {
    const ator = atorDe(atorUuid);
    if (ator) await ator.update({ "system.estado.perseguicao.derrubado": true });
  });
  registrarAcaoDeMestre("vigilia-curar-pd", async ({ atorUuid, quantidade }) => {
    const ator = atorDe(atorUuid);
    if (!ator) return;
    const { value, max } = ator.system.recursos.pd;
    await ator.update({ "system.recursos.pd.value": Math.min(max, value + quantidade) });
  });
  registrarAcaoDeMestre("vigilia-sacrificio", async ({ cenaUuid, ator }) => {
    const cena = await fromUuid(cenaUuid);
    if (cena) await cena.update({ "system.sacrificios": [...cena.system.sacrificios, ator] });
  });
  registrarAcaoDeMestre("vigilia-distrair", async ({ cenaUuid }) => {
    const cena = await fromUuid(cenaUuid);
    if (cena) await cena.update({ "system.usosDistrair": cena.system.usosDistrair + 1 });
  });
  registrarAcaoDeMestre("vigilia-esconderijo", async ({ atorUuid, esconderijo }) => {
    const ator = atorDe(atorUuid);
    if (ator) await ator.update({ "system.estado.furtividade.esconderijo": esconderijo });
  });
}
