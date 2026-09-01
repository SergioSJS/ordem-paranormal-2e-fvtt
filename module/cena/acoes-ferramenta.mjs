/**
 * Ações das ferramentas da Ordo Realitas (spec §9). Só agentes as usam — a spec não
 * dá um gate mecânico além disso, então não bloqueamos por `tipo` do personagem
 * (sobreviventes simplesmente não têm o Item; é uma restrição de conteúdo, não de
 * código, e a mesa pode ter exceções narrativas).
 */
import { SYSTEM_ID } from "../config.mjs";
import { podeUsarCarga, temReacaoFerramenta, conjuntosFalsosRemovidos, conjuntosRestantes } from "./ferramentas.mjs";
import { investigacaoAtiva } from "./investigacao-ativa.mjs";
import { rolarTeste, renderizar } from "../dice/teste.mjs";

const CHAT = "systems/ordem-paranormal-2e/templates/chat";

async function carregarPoi(poiUuid) {
  const poi = await fromUuid(poiUuid);
  if (poi?.type !== "ponto-interesse") {
    ui.notifications.warn(game.i18n.localize("OP2.Aviso.POIAusente"));
    return null;
  }
  return poi;
}

/** A descoberta é de quem usou a ferramenta (spec §6.2): sussurro para dono + mestre. */
function sussurroPara(ator) {
  return game.users
    .filter((u) => u.isGM || ator.testUserPermission(u, "OWNER"))
    .map((u) => u.id);
}

function editorDeTexto() {
  return foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
}

async function enviarCard(ator, contexto, whisper) {
  const conteudo = await renderizar(`${CHAT}/ferramenta.hbs`, contexto);
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: ator }),
    content: conteudo,
    whisper,
    flags: { [SYSTEM_ID]: { tipo: "ferramenta", atorId: ator.id } },
  });
}

/**
 * USAR FERRAMENTA (spec §9/§9.3): revela o que a ferramenta encontra naquele POI.
 * `null`/vazio é "leitura normal, sem reação" — que também é informação, por isso
 * revela um card de qualquer jeito, nunca fica em silêncio. Consome 1 carga quando
 * a ferramenta controla carga (Lanterna UV, Pó Revelador).
 * @returns {Promise<{temReacao: boolean}|null>}
 */
export async function usarFerramenta(ator, poiUuid, subtipo) {
  // Rádio Modificado guarda conjuntos estruturados, não texto — tem app e ação
  // próprios (`usarRadio`/`radio-app.mjs`), não o card genérico de texto revelado.
  if (subtipo === "radio") return null;

  const poi = await carregarPoi(poiUuid);
  if (!poi) return null;

  const rotulo = game.i18n.localize(`OP2.Ferramenta.Subtipo.${subtipo}`);
  const ferramentaItem = ator.items.find((i) => i.type === "ferramenta" && i.system.subtipo === subtipo);
  if (!ferramentaItem) {
    ui.notifications.warn(game.i18n.format("OP2.Aviso.SemFerramenta", { ferramenta: rotulo }));
    return null;
  }
  if (!podeUsarCarga(ferramentaItem.system.cargas)) {
    ui.notifications.warn(game.i18n.format("OP2.Ferramenta.SemCargas", { ferramenta: rotulo }));
    return null;
  }
  if (ferramentaItem.system.cargas.usa) {
    await ferramentaItem.update({ "system.cargas.value": ferramentaItem.system.cargas.value - 1 });
  }

  const textoReacao = poi.system.ferramentas[subtipo];
  const temReacao = Boolean(textoReacao?.trim());

  await enviarCard(ator, {
    titulo: rotulo,
    poiNome: poi.name,
    temReacao,
    resultado: temReacao ? await editorDeTexto().enrichHTML(textoReacao, { relativeTo: poi }) : null,
  }, sussurroPara(ator));

  return { temReacao };
}

/**
 * LASER DE VARREDURA (spec §9): ativado no ambiente, não num POI específico — marca
 * quais POIs da investigação reagem a alguma ferramenta, para economizar tentativas.
 */
export async function usarLaser(ator) {
  const investigacao = investigacaoAtiva();
  if (!investigacao) {
    ui.notifications.warn(game.i18n.localize("OP2.Painel.SemInvestigacao"));
    return null;
  }

  const rotulo = game.i18n.localize("OP2.Ferramenta.Subtipo.laser");
  const temLaser = ator.items.some((i) => i.type === "ferramenta" && i.system.subtipo === "laser");
  if (!temLaser) {
    ui.notifications.warn(game.i18n.format("OP2.Aviso.SemFerramenta", { ferramenta: rotulo }));
    return null;
  }

  const marcados = [];
  for (const uuid of investigacao.system.pois) {
    const poi = await fromUuid(uuid);
    if (poi?.type !== "ponto-interesse" || poi.system.reveladoPorLaser) continue;
    const reage = Object.values(poi.system.ferramentas).some(temReacaoFerramenta);
    if (!reage) continue;
    await poi.update({ "system.reveladoPorLaser": true });
    marcados.push(poi.name);
  }

  await enviarCard(ator, {
    titulo: rotulo,
    laser: true,
    marcados,
    temMarcados: marcados.length > 0,
  }, sussurroPara(ator));

  return marcados;
}

/**
 * RÁDIO MODIFICADO (spec §9.2): rola Tecnologia (sem DT — o resultado é lido pela
 * tabela de faixas, não passa/falha) e decide quantos conjuntos falsos saem de jogo
 * antes de abrir o app de ordenação (`radio-app.mjs`). Uso ilimitado — não está em
 * `FERRAMENTAS_COM_CARGA`, então não consome nada.
 * @returns {Promise<{ator: Actor, poi: Item, roll: object, conjuntos: object[],
 *   removidos: number, totalFalsos: number}|null>}
 */
export async function usarRadio(ator, poiUuid, { rapido = false } = {}) {
  const poi = await carregarPoi(poiUuid);
  if (!poi) return null;

  const rotulo = game.i18n.localize("OP2.Ferramenta.Subtipo.radio");
  const temRadio = ator.items.some((i) => i.type === "ferramenta" && i.system.subtipo === "radio");
  if (!temRadio) {
    ui.notifications.warn(game.i18n.format("OP2.Aviso.SemFerramenta", { ferramenta: rotulo }));
    return null;
  }

  const conjuntos = poi.system.ferramentas.radio?.conjuntos ?? [];
  if (!conjuntos.length) {
    ui.notifications.warn(game.i18n.localize("OP2.Ferramenta.RadioSemConjuntos"));
    return null;
  }

  const roll = await rolarTeste(ator, {
    chavePericia: "tecnologia",
    semDT: true,
    rapido,
    contexto: `${rotulo} — ${poi.name}`,
  });
  if (!roll) return null;

  const totalFalsos = conjuntos.filter((conjunto) => !conjunto.verdadeiro).length;
  const removidos = conjuntosFalsosRemovidos(roll.total, totalFalsos);

  return { ator, poi, roll, conjuntos: conjuntosRestantes(conjuntos, removidos), removidos, totalFalsos };
}
