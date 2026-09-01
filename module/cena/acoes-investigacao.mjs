/**
 * Ações de investigação (spec §6.3–§6.5).
 *
 * Investigar compara o tamanho do dado contra a DT, sem rolar. Examinar rola e
 * compara a soma — e custa 1 PD se não trouxer informação nova. Interagir não tem
 * teste: abre a descrição contextual para o mestre resolver. Recapitular e
 * Compartilhar travam para o grupo após um sucesso, e a trava é registrada pelo
 * mestre no chat — o texto exige que ele julgue a interpretação antes.
 */
import { SYSTEM_ID, DT_RECAPITULAR, DT_COMPARTILHAR, CUSTO_PD_EXAMINAR } from "../config.mjs";
import { resolverInvestigacao, resolverExaminar, periciasDoQuadro, chaveInfo } from "./investigacao.mjs";
import { personagensDaCenaAtiva } from "./encerrar-cena.mjs";
import { rolarTeste, rotuloDePericia, renderizar } from "../dice/teste.mjs";
import { lerConfig } from "../settings/register.mjs";

const CHAT = "systems/ordem-paranormal-2e/templates/chat";

/** @returns {Promise<Item|null>} */
async function carregarPoi(poiUuid) {
  const poi = await fromUuid(poiUuid);
  if (poi?.type !== "ponto-interesse") {
    ui.notifications.warn(game.i18n.localize("OP2.Aviso.POIAusente"));
    return null;
  }
  return poi;
}

/** Ids das infos deste POI que este personagem já revelou. */
function idsRevelados(ator, poiUuid) {
  const prefixo = `${poiUuid}:`;
  return new Set([...ator.system.estado.infosReveladas]
    .filter((chave) => chave.startsWith(prefixo))
    .map((chave) => chave.slice(prefixo.length)));
}

async function gravarRevelacoes(ator, poiUuid, idsNovos, { investigado = false } = {}) {
  const estado = ator.system.estado;
  const atualizacao = {
    "system.estado.infosReveladas": [...estado.infosReveladas, ...idsNovos.map((id) => chaveInfo(poiUuid, id))],
  };
  if (investigado && !estado.poisInvestigados.has(poiUuid)) {
    atualizacao["system.estado.poisInvestigados"] = [...estado.poisInvestigados, poiUuid];
  }
  await ator.update(atualizacao);
}

/** A informação é de quem descobriu (spec §6.2): sussurro para o dono e o mestre. */
function sussurroPara(ator) {
  return game.users
    .filter((u) => u.isGM || ator.testUserPermission(u, "OWNER"))
    .map((u) => u.id);
}

function editorDeTexto() {
  return foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
}

async function enviarCard(ator, template, contexto, { whisper } = {}) {
  const conteudo = await renderizar(`${CHAT}/${template}.hbs`, contexto);
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: ator }),
    content: conteudo,
    whisper,
    flags: { [SYSTEM_ID]: { tipo: "investigacao", atorId: ator.id } },
  });
}

function infosPorId(poi, ids) {
  return poi.system.informacoes.filter((info) => ids.includes(info.id));
}

/**
 * INVESTIGAR (spec §6.3): entrega as informações da perícia com DT ≤ tamanho do
 * dado, sem rolagem. Na primeira vez, revela também a descrição básica do POI.
 * @returns {Promise<string[]|null>} ids revelados desta vez
 */
export async function investigar(ator, poiUuid, chavePericia) {
  const poi = await carregarPoi(poiUuid);
  if (!poi) return null;

  const resolvido = ator.system.resolverChave(chavePericia);
  if (!resolvido) {
    ui.notifications.error(game.i18n.format("OP2.Aviso.PericiaDesconhecida", { chave: chavePericia }));
    return null;
  }

  const primeiraVez = !ator.system.estado.poisInvestigados.has(poiUuid);
  const idsNovos = resolverInvestigacao(poi.system.informacoes, chavePericia, resolvido.valor, idsRevelados(ator, poiUuid));
  await gravarRevelacoes(ator, poiUuid, idsNovos, { investigado: true });

  const infos = infosPorId(poi, idsNovos).map((info) => ({ ...info, rotuloPericia: rotuloDePericia(info.pericia) }));
  await enviarCard(ator, "revelacao", {
    titulo: `${game.i18n.localize("OP2.Investigacao.Investigar")} — ${rotuloDePericia(chavePericia)}`,
    poiNome: poi.name,
    primeiraVez,
    descricaoBasica: primeiraVez ? await editorDeTexto().enrichHTML(poi.system.descricaoBasica, { relativeTo: poi }) : null,
    infos,
    temInfos: infos.length > 0,
  }, { whisper: sussurroPara(ator) });

  return idsNovos;
}

/**
 * EXAMINAR (spec §6.3.1): rola a perícia e compara a soma contra a DT. Sem info
 * nova — por não atingir a DT ou por não haver mais nada — custa 1 PD. A aposta é
 * avisada antes de confirmar. Crítico ignora a DT e revela o que falta da perícia
 * (a "informação adicional" do crítico em investigação, spec §4.3).
 * @returns {Promise<string[]|null>} ids revelados, [] se pagou PD, null se cancelou
 */
export async function examinar(ator, poiUuid, chavePericia) {
  const poi = await carregarPoi(poiUuid);
  if (!poi) return null;

  const confirmou = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize("OP2.Investigacao.Examinar") },
    content: `<p>${game.i18n.format("OP2.Investigacao.ExaminarAviso", { custo: CUSTO_PD_EXAMINAR })}</p>`,
  });
  if (!confirmou) return null;

  const roll = await rolarTeste(ator, {
    chavePericia,
    semDT: true,
    contexto: `${game.i18n.localize("OP2.Investigacao.Examinar")} — ${rotuloDePericia(chavePericia)}`,
  });
  if (!roll) return null;

  const { revelaveis, perdePD } = resolverExaminar(
    poi.system.informacoes, chavePericia, roll.total, idsRevelados(ator, poiUuid),
    { ignorarDT: roll.critico },
  );

  if (perdePD) {
    await enviarCard(ator, "examinar-custo", {
      titulo: game.i18n.localize("OP2.Investigacao.Examinar"),
      poiNome: poi.name,
      atorId: ator.id,
      rotuloCusto: game.i18n.format("OP2.Investigacao.PerderPD", { custo: CUSTO_PD_EXAMINAR }),
    });
    return [];
  }

  await gravarRevelacoes(ator, poiUuid, revelaveis);
  const infos = infosPorId(poi, revelaveis).map((info) => ({ ...info, rotuloPericia: rotuloDePericia(info.pericia) }));
  await enviarCard(ator, "revelacao", {
    titulo: `${game.i18n.localize("OP2.Investigacao.Examinar")} — ${rotuloDePericia(chavePericia)}`,
    poiNome: poi.name,
    infos,
    temInfos: true,
  }, { whisper: sussurroPara(ator) });

  return revelaveis;
}

/**
 * INTERAGIR (spec §6.3.2): ação livre descrita pelo jogador, resolvida pelo mestre
 * pela descrição contextual. Sem teste, sem custo — o card vai só para o mestre.
 */
export async function interagir(ator, poiUuid) {
  const poi = await carregarPoi(poiUuid);
  if (!poi) return null;

  await enviarCard(ator, "interagir", {
    poiNome: poi.name,
    quemInterage: game.i18n.format("OP2.Investigacao.InteragirQuem", { ator: ator.name }),
    descricaoContextual: await editorDeTexto().enrichHTML(poi.system.descricaoContextual, { relativeTo: poi }),
  }, { whisper: game.users.filter((u) => u.isGM).map((u) => u.id) });
}

/**
 * RECAPITULAR (spec §6.4): o jogador interpreta a recapitulação; se o mestre julgar
 * coerente, teste de Intuição DT 10. Sucesso trava a ação para o grupo na cena.
 */
export async function recapitular(ator) {
  if (canvas.scene?.getFlag(SYSTEM_ID, "recapitularUsado")) {
    ui.notifications.warn(game.i18n.localize("OP2.Investigacao.AcaoTravada"));
    return null;
  }

  const confirmou = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize("OP2.Investigacao.Recapitular") },
    content: `<p>${game.i18n.format("OP2.Investigacao.RecapitularAviso", { dt: DT_RECAPITULAR })}</p>`,
  });
  if (!confirmou) return null;

  const roll = await rolarTeste(ator, {
    chavePericia: "intuicao",
    dt: DT_RECAPITULAR,
    contexto: game.i18n.localize("OP2.Investigacao.Recapitular"),
  });
  if (!roll?.sucesso) return roll;

  await enviarCard(ator, "acao-cena", {
    titulo: game.i18n.localize("OP2.Investigacao.Recapitular"),
    texto: game.i18n.format("OP2.Investigacao.RecapitularSucesso", { ator: ator.name }),
    atorId: ator.id,
    acaoGM: "registrar-recapitular",
    rotuloGM: game.i18n.localize("OP2.Investigacao.RegistrarPista"),
  });
  return roll;
}

/**
 * COMPARTILHAR (spec §6.5): ação importante do compartilhador; o aliado escolhido
 * testa a perícia de Compartilhar (setting `compartilharPericia`, DT 10) como ação
 * livre. Sucesso trava a ação para o grupo na cena.
 */
export async function compartilhar(ator) {
  if (canvas.scene?.getFlag(SYSTEM_ID, "compartilharUsado")) {
    ui.notifications.warn(game.i18n.localize("OP2.Investigacao.AcaoTravada"));
    return null;
  }

  const aliados = personagensDaCenaAtiva().filter((a) => a.id !== ator.id);
  if (!aliados.length) {
    ui.notifications.warn(game.i18n.localize("OP2.Investigacao.SemAliados"));
    return null;
  }

  const aliadoId = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("OP2.Investigacao.Compartilhar") },
    content: `
      <div class="form-group">
        <label>${game.i18n.localize("OP2.Investigacao.EscolherAliado")}</label>
        <select name="aliado">${aliados.map((a) => `<option value="${a.id}">${a.name}</option>`).join("")}</select>
      </div>
      <p class="op2-ajuda">${game.i18n.format("OP2.Investigacao.CompartilharAjuda", { dt: DT_COMPARTILHAR })}</p>`,
    ok: { callback: (_evento, botao) => botao.form.elements.aliado.value },
    rejectClose: false,
  });
  const aliado = aliados.find((a) => a.id === aliadoId);
  if (!aliado) return null;

  const pericia = lerConfig("compartilharPericia");
  await enviarCard(ator, "acao-cena", {
    titulo: game.i18n.localize("OP2.Investigacao.Compartilhar"),
    texto: game.i18n.format("OP2.Investigacao.CompartilharTexto", { ator: ator.name, aliado: aliado.name }),
    atorId: ator.id,
    botaoAliado: {
      atorId: aliado.id,
      compartilhadorId: ator.id,
      rotulo: game.i18n.format("OP2.Investigacao.TestarCompartilhar", {
        pericia: rotuloDePericia(pericia), dt: DT_COMPARTILHAR,
      }),
    },
  });
}

/** O teste do aliado no Compartilhar, disparado pelo botão do card (ação livre). */
export async function testarCompartilhamento(aliado, compartilhadorId) {
  if (!game.user.isGM && !aliado.isOwner) {
    ui.notifications.warn(game.i18n.localize("OP2.Aviso.SemPermissao"));
    return null;
  }

  const compartilhador = game.actors.get(compartilhadorId);
  const pericia = lerConfig("compartilharPericia");
  const roll = await rolarTeste(aliado, {
    chavePericia: pericia,
    dt: DT_COMPARTILHAR,
    contexto: `${game.i18n.localize("OP2.Investigacao.Compartilhar")} — ${rotuloDePericia(pericia)}`,
  });
  if (!roll?.sucesso) return roll;

  await enviarCard(aliado, "acao-cena", {
    titulo: game.i18n.localize("OP2.Investigacao.Compartilhar"),
    texto: game.i18n.format("OP2.Investigacao.CompartilharSucesso", {
      aliado: aliado.name, ator: compartilhador?.name ?? "?",
    }),
    atorId: aliado.id,
    acaoGM: "registrar-compartilhar",
    rotuloGM: game.i18n.localize("OP2.Investigacao.RegistrarPista"),
  });
  return roll;
}

/**
 * Trava de 1×-por-cena. Só o mestre chega aqui — o botão do card é dele, porque é
 * ele quem julga se a interpretação valeu a pista (spec §6.4/§6.5).
 */
export async function registrarTravaDeCena(trava, ator) {
  const cena = canvas.scene;
  if (!cena) return;
  await cena.setFlag(SYSTEM_ID, trava, { ator: ator.id, nome: ator.name });
  ui.notifications.info(game.i18n.format("OP2.Investigacao.TravaRegistrada", {
    acao: game.i18n.localize(trava === "recapitularUsado"
      ? "OP2.Investigacao.Recapitular" : "OP2.Investigacao.Compartilhar"),
  }));
}

/**
 * Escolha da perícia do quadro — a primeira Investigação de um POI passa por aqui
 * (spec §6.3 passo 3: o jogador escolhe uma perícia e declara seu valor).
 */
export async function dialogoInvestigar(ator, poiUuid) {
  const poi = await carregarPoi(poiUuid);
  if (!poi) return null;

  const pericias = periciasDoQuadro(poi.system.informacoes);
  if (!pericias.length) {
    ui.notifications.warn(game.i18n.localize("OP2.Investigacao.POIVazio"));
    return null;
  }

  const opcoes = pericias.map((chave) => {
    const valor = ator.system.resolverChave(chave)?.valor ?? 0;
    return `<option value="${chave}">${rotuloDePericia(chave)} — d${valor}</option>`;
  }).join("");

  const chavePericia = await foundry.applications.api.DialogV2.prompt({
    window: { title: `${game.i18n.localize("OP2.Investigacao.Investigar")} — ${poi.name}` },
    content: `
      <div class="form-group">
        <label>${game.i18n.localize("OP2.Investigacao.EscolherPericia")}</label>
        <select name="pericia">${opcoes}</select>
      </div>
      <p class="op2-ajuda">${game.i18n.localize("OP2.Investigacao.EscolherPericiaAjuda")}</p>`,
    ok: { callback: (_evento, botao) => botao.form.elements.pericia.value },
    rejectClose: false,
  });
  if (!chavePericia) return null;
  return investigar(ator, poiUuid, chavePericia);
}
