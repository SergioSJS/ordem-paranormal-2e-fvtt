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
import { resolverInvestigacao, resolverExaminar, chaveInfo, motivoSemRevelacao } from "./investigacao.mjs";
import { personagensDaCenaAtiva, alvosDaCenaAtiva } from "./encerrar-investigacao.mjs";
import { investigacaoAtiva } from "./investigacao-ativa.mjs";
import { rolarTeste, rotuloDePericia, renderizar } from "../dice/teste.mjs";
import { escolherPericia } from "../dice/pericia-dialog.mjs";
import { comoMestre, registrarAcaoDeMestre } from "../ui/socket.mjs";
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

/**
 * Gira a visibilidade de uma linha do quadro entre os três estados, em ciclo:
 *
 *   rascunho (oculta) → descobrível (padrão) → aberta → rascunho…
 *
 * Um botão só porque é um clique no meio da mesa, não um formulário. Grava no
 * Item do POI, não na investigação — o painel é só o atalho pra não precisar
 * abrir a ficha do POI (achado em uso real).
 * @returns {Promise<"rascunho"|"descobrivel"|"aberta"|null>} o estado novo
 */
export async function cicloVisibilidadeInfo(poiUuid, infoId) {
  const poi = await carregarPoi(poiUuid);
  if (!poi) return null;

  const proximo = (info) => {
    if (info.oculta) return { oculta: false, aberta: false };
    if (!info.aberta) return { oculta: false, aberta: true };
    return { oculta: true, aberta: false };
  };

  let estado = null;
  const informacoes = poi.system.informacoes.map((info) => {
    if (info.id !== infoId) return info;
    const novo = proximo(info);
    estado = novo.oculta ? "rascunho" : (novo.aberta ? "aberta" : "descobrivel");
    return { ...info, ...novo };
  });
  // Botão de mestre, mas POI é documento de mundo: passa pela ponte por
  // segurança, do mesmo jeito que o resultado do desafio.
  await comoMestre("atualizarPoi", { uuid: poi.uuid, dados: { "system.informacoes": informacoes } });
  return estado;
}

registrarAcaoDeMestre("atualizarPoi", async ({ uuid, dados }) => {
  const poi = await fromUuid(uuid);
  if (poi?.type === "ponto-interesse") await poi.update(dados);
});

/** Ids das infos deste POI que este personagem já revelou. */
export function idsRevelados(ator, poiUuid) {
  const prefixo = `${poiUuid}:`;
  return new Set([...ator.system.estado.infosReveladas]
    .filter((chave) => chave.startsWith(prefixo))
    .map((chave) => chave.slice(prefixo.length)));
}

/**
 * Desfaz a revelação de uma linha do quadro — para todos os personagens da cena.
 *
 * Sem isto, uma pista revelada por engano (ou num teste de mesa) só saía
 * encerrando a cena inteira, que zera tudo (achado em uso real: "e se eu quiser
 * resetar? preciso encerrar a cena?"). Escreve nos personagens, então é ato de
 * mestre — o jogador não tem permissão de atualizar a ficha dos outros.
 * @returns {Promise<string[]>} nomes de quem perdeu a revelação
 */
export async function limparRevelacao(poiUuid, infoId) {
  if (!game.user.isGM) return [];
  const chave = chaveInfo(poiUuid, infoId);
  const afetados = personagensDaCenaAtiva()
    .filter((ator) => ator.system.estado.infosReveladas.has(chave));

  for (const ator of afetados) {
    await ator.update({
      "system.estado.infosReveladas": [...ator.system.estado.infosReveladas].filter((c) => c !== chave),
    });
  }
  return afetados.map((ator) => ator.name);
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
 * EXAMINAR (spec §6.3.1) — uma das duas coisas que se faz ao investigar um ponto
 * (a outra é Interagir). Não existe uma ação "Investigar" separada: investigar É
 * examinar ou interagir.
 *
 * Dois passos, com a mesma perícia, como a spec descreve em §6.3:
 *
 * 1. **De graça, sem rolar** — toda informação daquela perícia com DT ≤ ao tamanho
 *    do dado do personagem. "Um personagem com Percepção d8 já recebe de graça
 *    toda info de Percepção com DT ≤ 8" (spec §6.3, nota de implementação).
 * 2. **Rolando** — o teste tenta o que ficou acima do dado ("e rola para tentar as
 *    de DT 9+"). Crítico ignora a DT e revela o que falta da perícia (spec §4.3).
 *
 * Só custa 1 PD quando os DOIS passos vêm vazios — se o tamanho do dado já
 * entregou algo, não houve aposta perdida.
 * O aviso da aposta de 1 PD mora na tela de escolha da perícia, não num modal de
 * confirmação à parte: eram duas janelas seguidas dizendo a mesma coisa antes de
 * qualquer coisa acontecer (achado em uso real).
 * @param {object} [opcoes]
 * @param {boolean} [opcoes.rapido]     rola sem o diálogo de teste
 * @returns {Promise<{roll: OP2Roll, revelaveis: string[], perdePD: boolean}|null>}
 */
export async function examinar(ator, poiUuid, chavePericia, { rapido = false } = {}) {
  const poi = await carregarPoi(poiUuid);
  if (!poi) return null;

  const resolvido = ator.system.resolverChave(chavePericia);
  if (!resolvido) {
    ui.notifications.error(game.i18n.format("OP2.Aviso.PericiaDesconhecida", { chave: chavePericia }));
    return null;
  }

  const primeiraVez = !ator.system.estado.poisInvestigados.has(poiUuid);

  // Passo 1: o que o tamanho do dado alcança, sem rolar. Vai gravado antes do
  // teste porque não depende dele — é o que o personagem percebe ao olhar.
  const gratis = resolverInvestigacao(
    poi.system.informacoes, chavePericia, resolvido.valor, idsRevelados(ator, poiUuid),
  );
  await gravarRevelacoes(ator, poiUuid, gratis, { investigado: true });

  const roll = await rolarTeste(ator, {
    chavePericia,
    semDT: true,
    rapido,
    // Um card só, com os dados e o desfecho dentro: o card genérico de teste rola
    // sem DT e por isso não dizia nem sucesso nem falha — "veio só os valores"
    // (achado em uso real) — e ainda oferecia Dano RA/RB, que não existe aqui.
    semCard: true,
    contexto: `${game.i18n.localize("OP2.Investigacao.Examinar")} — ${rotuloDePericia(chavePericia)}`,
  });
  if (!roll) return null;

  // Passo 2: o teste tenta o que ficou acima do dado.
  const { revelaveis } = resolverExaminar(
    poi.system.informacoes, chavePericia, roll.total, idsRevelados(ator, poiUuid),
    { ignorarDT: roll.critico },
  );
  await gravarRevelacoes(ator, poiUuid, revelaveis);

  // Os dados vão no card da própria ação, não num card de teste à parte.
  const rolagem = {
    componentes: roll.dados,
    total: roll.total,
    ra: roll.ra,
    rb: roll.rb,
    critico: roll.critico,
    falhaCritica: roll.falhaCritica,
  };

  const perdePD = gratis.length === 0 && revelaveis.length === 0;
  if (perdePD) {
    const sem = motivoSemRevelacao(
      poi.system.informacoes, chavePericia, resolvido.valor, idsRevelados(ator, poiUuid),
    );
    await enviarCard(ator, "examinar-custo", {
      titulo: `${game.i18n.localize("OP2.Investigacao.Examinar")} — ${rotuloDePericia(chavePericia)}`,
      poiNome: poi.name,
      atorId: ator.id,
      ...rolagem,
      rotuloCusto: game.i18n.format("OP2.Investigacao.PerderPD", { custo: CUSTO_PD_EXAMINAR }),
      // Sem isto o card só diz "nada novo", e o jogador não sabe se insiste com
      // outro dado, troca de perícia ou desiste do ponto (achado em uso real).
      motivo: game.i18n.format(`OP2.Investigacao.SemRevelacao.${sem.motivo}`, {
        pericia: rotuloDePericia(chavePericia),
        dado: `d${resolvido.valor}`,
      }),
      // A DT que falta é dado de mestre: o jogador vê que o dado é pequeno, não o
      // número exato de que precisaria.
      dtMinima: sem.dtMinima ?? null,
    });
    return { roll, revelaveis: [], perdePD: true };
  }

  const marcar = (ids, semRolar) => infosPorId(poi, ids)
    .map((info) => ({ ...info, rotuloPericia: rotuloDePericia(info.pericia), semRolar }));

  await enviarCard(ator, "revelacao", {
    titulo: `${game.i18n.localize("OP2.Investigacao.Examinar")} — ${rotuloDePericia(chavePericia)}`,
    poiNome: poi.name,
    primeiraVez,
    descricaoBasica: primeiraVez
      ? await editorDeTexto().enrichHTML(poi.system.descricaoBasica, { relativeTo: poi })
      : null,
    infos: [...marcar(gratis, true), ...marcar(revelaveis, false)],
    temInfos: true,
    ...rolagem,
    // O desfecho de Examinar não é o dado contra uma DT: é ter achado algo ou
    // não. Só o teste (`revelaveis`) conta como sucesso — o que veio de graça
    // pelo tamanho do dado já era do personagem antes de rolar.
    desfechoTeste: revelaveis.length ? "sucesso" : "falha",
    quantidadeTeste: revelaveis.length,
    quantidadeGratis: gratis.length,
  }, { whisper: sussurroPara(ator) });

  return { roll, revelaveis: [...gratis, ...revelaveis], perdePD: false };
}

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
export async function recapitular(ator, { confirmar = true, rapido = false } = {}) {
  if (investigacaoAtiva()?.system.recapitularUsado.usado) {
    ui.notifications.warn(game.i18n.localize("OP2.Investigacao.AcaoTravada"));
    return null;
  }

  if (confirmar) {
    const confirmou = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("OP2.Investigacao.Recapitular") },
      content: `<p>${game.i18n.format("OP2.Investigacao.RecapitularAviso", { dt: DT_RECAPITULAR })}</p>`,
    });
    if (!confirmou) return null;
  }

  const roll = await rolarTeste(ator, {
    chavePericia: "intuicao",
    dt: DT_RECAPITULAR,
    rapido,
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
export async function compartilhar(ator, { aliadoId = null } = {}) {
  if (investigacaoAtiva()?.system.compartilharUsado.usado) {
    ui.notifications.warn(game.i18n.localize("OP2.Investigacao.AcaoTravada"));
    return null;
  }

  const aliados = alvosDaCenaAtiva({ exceto: ator });
  if (!aliados.length) {
    ui.notifications.warn(game.i18n.localize("OP2.Investigacao.SemAliados"));
    return null;
  }

  let aliado = aliados.find((a) => a.id === aliadoId);
  if (!aliado) {
    const escolhido = await foundry.applications.api.DialogV2.prompt({
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
    aliado = aliados.find((a) => a.id === escolhido);
  }
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
  const investigacao = investigacaoAtiva();
  if (!investigacao) return;
  await investigacao.update({ [`system.${trava}`]: { usado: true, atorId: ator.id, nome: ator.name } });
  ui.notifications.info(game.i18n.format("OP2.Investigacao.TravaRegistrada", {
    acao: game.i18n.localize(trava === "recapitularUsado"
      ? "OP2.Investigacao.Recapitular" : "OP2.Investigacao.Compartilhar"),
  }));
}

/**
 * EXAMINAR com escolha de perícia (spec §6.3.1). A lista é a COMPLETA — Examinar
 * rola um teste, e nada na regra manda testar só as perícias do quadro: o jogador
 * pode tentar a que quiser. Quem filtra é Investigar, e só porque a regra dela
 * manda o mestre listar o quadro (spec §6.3 passo 2).
 */
export async function dialogoExaminar(ator, poiUuid) {
  const poi = await carregarPoi(poiUuid);
  if (!poi) return null;

  const chavePericia = await escolherPericia(ator, {
    titulo: `${game.i18n.localize("OP2.Investigacao.Examinar")} — ${poi.name}`,
    ajuda: game.i18n.format("OP2.Investigacao.ExaminarEscolhaAjuda", { custo: CUSTO_PD_EXAMINAR }),
    mostrarAtributo: true,
  });
  if (!chavePericia) return null;
  return examinar(ator, poiUuid, chavePericia);
}

