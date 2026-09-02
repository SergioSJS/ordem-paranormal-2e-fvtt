/**
 * Ações de desafio de acesso físico (spec §7.2–§7.5).
 *
 * Arrombar cobra 1 PV por tentativa e grava a pontuação direto no Item — como
 * Investigar grava revelação sem confirmação extra, a atualização do contador não é
 * uma decisão de mesa. Alcançar não guarda estado: dano de queda vai pro card com
 * botão, nunca automático. Sustentar liga uma flag no ator; o desgaste por rodada
 * é aplicado por `avancarRodada()` (module/cena/rodada.mjs). Hackear automatiza só
 * o teste e o gate de rodada — o problema matemático (técnico) e conferir as
 * respostas (social) exigem input humano, a spec é explícita sobre isso
 * (docs/LACUNAS.md).
 */
import { SYSTEM_ID, CUSTO_PV_ARROMBAR, CUSTO_PV_SUSTENTAR, BONUS_DT_ALCANCAR_ARRISCADO } from "../config.mjs";
import {
  acumularArrombar, arrombou, excedeuTentativas, danoDeAlcancar, avaliarPalpite, venceuDestrancar,
  podeTentarHackNestaRodada, chancesDeErroHackSocial,
} from "./desafios.mjs";
import { rolarTeste, renderizar, enviarParaChat, rotuloDePericia } from "../dice/teste.mjs";
import { aplicarDano } from "../dice/falha-critica.mjs";
import { stepDie } from "../dice/escada.mjs";
import { OP2Roll } from "../dice/op2-roll.mjs";
import { lerConfig } from "../settings/register.mjs";
import { rodadaAtual } from "./rodada.mjs";
import { comoMestre, registrarAcaoDeMestre } from "../ui/socket.mjs";

const CHAT = "systems/ordem-paranormal-2e/templates/chat";

/**
 * O obstáculo é documento de mundo: o teste é do personagem, mas gravar o
 * resultado nele é escrita que o jogador não tem permissão de fazer (achado em
 * uso real: rolava e estourava "lacks permission to update Item"). O mestre
 * grava por ele.
 */
registrarAcaoDeMestre("atualizarDesafio", async ({ uuid, dados }) => {
  const desafio = await fromUuid(uuid);
  if (desafio?.type === "desafio-acesso") await desafio.update(dados);
});

function gravarNoDesafio(desafio, dados) {
  return comoMestre("atualizarDesafio", { uuid: desafio.uuid, dados });
}

/** @returns {Promise<Item|null>} */
export async function carregarDesafio(desafioUuid) {
  const desafio = await fromUuid(desafioUuid);
  if (desafio?.type !== "desafio-acesso") {
    ui.notifications.warn(game.i18n.localize("OP2.Aviso.DesafioAusente"));
    return null;
  }
  return desafio;
}

function sussurroPara(ator) {
  return game.users
    .filter((u) => u.isGM || ator.testUserPermission(u, "OWNER"))
    .map((u) => u.id);
}

async function enviarCard(ator, template, contexto, { whisper } = {}) {
  const conteudo = await renderizar(`${CHAT}/${template}.hbs`, contexto);
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: ator }),
    content: conteudo,
    whisper,
    flags: { [SYSTEM_ID]: { tipo: "desafio", atorId: ator.id } },
  });
}

/**
 * ARROMBAR (spec §7.2): 1 PV por tentativa, Atletismo vs DT do objeto. Sucesso
 * acumula RA na pontuação; ao atingir a PA, arromba. Excedeu o teto de
 * tentativas sem arrombar? Fica quebrado — só resta achar a chave.
 * @returns {Promise<{roll: OP2Roll, desafio: Item, arrombou: boolean, quebrado: boolean}|null>}
 */
export async function arrombar(ator, desafioUuid, { rapido = false } = {}) {
  const desafio = await carregarDesafio(desafioUuid);
  if (!desafio) return null;
  if (desafio.system.quebrado) {
    ui.notifications.warn(game.i18n.localize("OP2.Desafio.JaQuebrado"));
    return null;
  }

  const roll = await rolarTeste(ator, {
    chavePericia: "atletismo",
    dt: desafio.system.dtObjeto,
    rapido,
    contexto: `${game.i18n.localize("OP2.Desafio.Arrombar")} — ${desafio.name}`,
  });
  if (!roll) return null;

  // Custa 1 PV por tentativa — só depois de o teste rodar de fato, nunca por um
  // diálogo cancelado (spec §7.2).
  await aplicarDano(ator, CUSTO_PV_ARROMBAR, "pv");

  const tentativasUsadas = desafio.system.tentativasUsadas + 1;
  const pontuacaoAtual = roll.sucesso
    ? acumularArrombar(desafio.system, roll.ra)
    : desafio.system.pontuacaoAtual;
  const estadoAtualizado = { ...desafio.system, pontuacaoAtual, tentativasUsadas };

  const conseguiu = arrombou(estadoAtualizado);
  const quebrado = !conseguiu && excedeuTentativas(estadoAtualizado);

  await gravarNoDesafio(desafio, {
    "system.pontuacaoAtual": pontuacaoAtual,
    "system.tentativasUsadas": tentativasUsadas,
    "system.quebrado": quebrado,
  });

  await enviarCard(ator, "arrombar", {
    titulo: game.i18n.localize("OP2.Desafio.Arrombar"),
    desafioNome: desafio.name,
    sucesso: roll.sucesso,
    conseguiu,
    quebrado,
    pontuacaoAtual,
    pontuacaoAlvo: desafio.system.pontuacaoAlvo,
  }, { whisper: sussurroPara(ator) });

  return { roll, desafio, arrombou: conseguiu, quebrado };
}

/**
 * ALCANÇAR (spec §7.4): pede a DT do ambiente e resolve o modo escolhido.
 * Seguro: duas ações de Acrobacia em sequência imediata (LACUNAS: o playtest não
 * detalha o que pode acontecer entre elas); falhar qualquer uma aplica RB e
 * recomeça — a M1 já resolve as duas na mesma chamada, então "recomeçar" só
 * importa para saber que a segunda ação não roda. Arriscado: uma ação, DT+3,
 * falha aplica RA.
 * @param {"seguro"|"arriscado"} modo
 * @returns {Promise<{modo: string, sucesso: boolean, dano: number|null}|null>}
 */
export async function alcancar(ator, { modo, dt, rapido = false } = {}) {
  if (dt === undefined || dt === null) {
    dt = await pedirDtAmbiente();
    if (dt === null) return null;
  }

  const contexto = `${game.i18n.localize("OP2.Desafio.Alcancar")} — ${game.i18n.localize(`OP2.Desafio.Modo.${modo}`)}`;

  if (modo === "arriscado") {
    const roll = await rolarTeste(ator, { chavePericia: "acrobacia", dt: dt + BONUS_DT_ALCANCAR_ARRISCADO, rapido, contexto });
    if (!roll) return null;
    return publicarAlcancar(ator, modo, roll.sucesso ? [roll] : [roll], roll.sucesso);
  }

  // Seguro: duas ações em sequência imediata; a segunda só roda se a primeira passar.
  const primeira = await rolarTeste(ator, { chavePericia: "acrobacia", dt, rapido, contexto: `${contexto} (1/2)` });
  if (!primeira) return null;
  if (!primeira.sucesso) return publicarAlcancar(ator, modo, [primeira], false);

  const segunda = await rolarTeste(ator, { chavePericia: "acrobacia", dt, rapido, contexto: `${contexto} (2/2)` });
  if (!segunda) return null;
  return publicarAlcancar(ator, modo, [primeira, segunda], segunda.sucesso);
}

async function pedirDtAmbiente() {
  const dt = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("OP2.Desafio.Alcancar") },
    content: `
      <div class="form-group">
        <label>${game.i18n.localize("OP2.Desafio.DtAmbiente")}</label>
        <input type="number" name="dt" value="7" min="0">
      </div>`,
    ok: { callback: (_evento, botao) => Number(botao.form.elements.dt.value) },
    rejectClose: false,
  });
  return dt ?? null;
}

// Nunca aplica dano sozinho — o botão do card reaproveita a ação genérica
// "aplicar-dano" (já registrada em ui/chat.mjs), do mesmo jeito que o card de
// teste comum oferece "Dano RA"/"Dano RB" (spec: nada se aplica sem clique).
async function publicarAlcancar(ator, modo, rolls, sucesso) {
  const ultima = rolls.at(-1);
  const dano = sucesso ? null : danoDeAlcancar(modo, ultima.resultado);

  await enviarCard(ator, "alcancar", {
    titulo: game.i18n.localize("OP2.Desafio.Alcancar"),
    modo: game.i18n.localize(`OP2.Desafio.Modo.${modo}`),
    sucesso,
    dano,
    atorId: ator.id,
  }, { whisper: sussurroPara(ator) });

  return { modo, sucesso, dano };
}

/**
 * SUSTENTAR (spec §7.5): 1 PV + teste de Atletismo inicial. Liga `estado.sustentando`
 * no ator; o desgaste de cada rodada é aplicado por `avancarRodada()`. O "efeito
 * final" (o que se solta ao falhar) não é modelado — descrição textual, mesa resolve.
 */
export async function sustentar(ator, { rapido = false } = {}) {
  if (ator.system.estado.sustentando?.ativo) {
    ui.notifications.warn(game.i18n.localize("OP2.Desafio.JaSustentando"));
    return null;
  }

  const roll = await rolarTeste(ator, { chavePericia: "atletismo", rapido, contexto: game.i18n.localize("OP2.Desafio.Sustentar") });
  if (!roll) return null;

  // Custo inicial de 1 PV — só depois de o teste rodar, nunca por um diálogo
  // cancelado (spec §7.5).
  await aplicarDano(ator, CUSTO_PV_SUSTENTAR, "pv");

  if (!roll.sucesso) {
    await enviarCard(ator, "acao-cena", {
      titulo: game.i18n.localize("OP2.Desafio.Sustentar"),
      texto: game.i18n.format("OP2.Desafio.SustentarFalhouInicio", { ator: ator.name }),
      atorId: ator.id,
    });
    return { roll, sustentando: false };
  }

  await ator.update({ "system.estado.sustentando": { ativo: true, fadiga: 0 } });
  await enviarCard(ator, "acao-cena", {
    titulo: game.i18n.localize("OP2.Desafio.Sustentar"),
    texto: game.i18n.format("OP2.Desafio.SustentarSucesso", { ator: ator.name }),
    atorId: ator.id,
  });
  return { roll, sustentando: true };
}

/** Para de sustentar por decisão do jogador — sem teste, sem custo. */
export async function pararDeSustentar(ator) {
  await ator.update({ "system.estado.sustentando": { ativo: false, fadiga: 0 } });
}

/**
 * Fadiga de fim de rodada (spec §7.5): quem está sustentando testa Atletismo de novo,
 * com redução de passo cumulativa a cada rodada — o dado de Atletismo desce um passo
 * por rodada sustentada, só para este teste (não é `reducoesTemporarias`: aquilo é o
 * efeito "até o fim da cena" da falha crítica, esta é fadiga própria de sustentar, e
 * as duas não deviam se somar por engano). Falhar solta o que era sustentado — o card
 * avisa, a mesa decide o que isso significa. Chamado por `avancarRodada()`.
 */
export async function testarFadigaDeSustentar(ator) {
  const estado = ator.system.estado.sustentando;
  if (!estado?.ativo) return null;

  const fadiga = estado.fadiga + 1;
  const pericia = ator.system.pericias.atletismo;
  const atributo = ator.system.atributos[pericia.atributo];
  const rotulo = `${game.i18n.localize("OP2.Desafio.Sustentar")} — ${game.i18n.localize("OP2.Desafio.Fadiga")} ${fadiga}`;

  const roll = OP2Roll.paraComponentes([
    { chave: "pericia.atletismo", rotulo: rotuloDePericia("atletismo"), tipo: "pericia", dado: stepDie(pericia.dadoEfetivo, -fadiga) },
    { chave: `atributo.${pericia.atributo}`, rotulo: game.i18n.localize(`OP2.Atributo.${pericia.atributo}`), tipo: "atributo", dado: atributo.dadoEfetivo },
  ], { dt: lerConfig("dtPadrao"), escopoCritico: lerConfig("escopoCritico"), rotulo, atorId: ator.id });
  await roll.evaluate();
  await enviarParaChat(roll, ator);

  if (!roll.sucesso) {
    await ator.update({ "system.estado.sustentando": { ativo: false, fadiga: 0 } });
    await enviarCard(ator, "acao-cena", {
      titulo: game.i18n.localize("OP2.Desafio.Sustentar"),
      texto: game.i18n.format("OP2.Desafio.SustentarSoltou", { ator: ator.name }),
      atorId: ator.id,
    });
    return { roll, continua: false };
  }

  await ator.update({ "system.estado.sustentando.fadiga": fadiga });
  return { roll, continua: true };
}

/**
 * DESTRANCAR — gerar senha (spec §7.1): o mestre rola a senha e mantém oculta.
 * Zera tentativas e histórico anteriores — é uma fechadura nova.
 * @returns {Promise<number[]>} a senha, só para quem gerou (o mestre) ver na hora
 */
export async function gerarSenhaDestrancar(desafioUuid, { tamanho, facesSenha } = {}) {
  const desafio = await carregarDesafio(desafioUuid);
  if (!desafio) return null;

  const tam = tamanho ?? desafio.system.tamanhoSenha;
  const faces = facesSenha ?? desafio.system.facesSenha;
  const roll = await new Roll(`${tam}d${faces}`).evaluate();
  const senha = roll.dice[0].results.map((r) => r.result);

  await gravarNoDesafio(desafio, {
    "system.tamanhoSenha": tam,
    "system.facesSenha": faces,
    "system.senha": senha,
    "system.destrancarTentativas": 0,
    "system.destrancado": false,
    "system.quebrado": false,
    "system.historicoDestrancar": [],
  });

  return senha;
}

/**
 * DESTRANCAR — tentar (spec §7.1): um palpite por chamada. Resposta posição a
 * posição (exato/alto/baixo), nunca a contagem agregada — o jogador deduz sozinho.
 * Exceder o teto de tentativas quebra a fechadura (mesmo campo `quebrado` de
 * Arrombar: as duas abordagens levam ao mesmo "só resta achar a chave").
 * @returns {Promise<{resultado: string[], venceu: boolean, quebrado: boolean}|null>}
 */
export async function tentarDestrancar(ator, desafioUuid, palpite) {
  const desafio = await carregarDesafio(desafioUuid);
  if (!desafio) return null;
  if (desafio.system.quebrado) {
    ui.notifications.warn(game.i18n.localize("OP2.Desafio.JaQuebrado"));
    return null;
  }
  if (desafio.system.destrancado) {
    ui.notifications.warn(game.i18n.localize("OP2.Desafio.JaDestrancado"));
    return null;
  }
  if (!desafio.system.senha.length) {
    ui.notifications.warn(game.i18n.localize("OP2.Desafio.SenhaAusente"));
    return null;
  }

  const resultado = avaliarPalpite(desafio.system.senha, palpite);
  const venceu = venceuDestrancar(resultado);
  const destrancarTentativas = desafio.system.destrancarTentativas + 1;
  const quebrado = !venceu && excedeuTentativas({
    maxTentativas: desafio.system.maxTentativas, tentativasUsadas: destrancarTentativas,
  });
  const historicoDestrancar = [...desafio.system.historicoDestrancar, { palpite, resultado }];

  await gravarNoDesafio(desafio, {
    "system.destrancarTentativas": destrancarTentativas,
    "system.destrancado": venceu,
    "system.quebrado": quebrado,
    "system.historicoDestrancar": historicoDestrancar,
  });

  await enviarCard(ator, "destrancar", {
    titulo: game.i18n.localize("OP2.Desafio.Destrancar"),
    desafioNome: desafio.name,
    venceu,
    quebrado,
  }, { whisper: sussurroPara(ator) });

  return { resultado, venceu, quebrado };
}

/**
 * HACK TÉCNICO (spec §7.3): Tecnologia vs DT do objeto. Sem curva automática pro
 * problema matemático em si (docs/LACUNAS.md) — o card mostra o resultado (quanto
 * maior, mais fácil deveria ser o problema que o mestre escolhe) e um timer visual
 * de 10s fica disponível na ficha do desafio para o mestre iniciar. Falha só libera
 * nova tentativa na rodada seguinte.
 * @returns {Promise<{roll: OP2Roll, sucesso: boolean}|null>}
 */
export async function hackTecnico(ator, desafioUuid, { rapido = false } = {}) {
  const desafio = await carregarDesafio(desafioUuid);
  if (!desafio) return null;
  if (desafio.system.hackTecnico.resolvido) {
    ui.notifications.warn(game.i18n.localize("OP2.Desafio.HackJaResolvido"));
    return null;
  }
  const rodada = rodadaAtual();
  if (!podeTentarHackNestaRodada(desafio.system.hackTecnico.ultimaTentativaRodada, rodada)) {
    ui.notifications.warn(game.i18n.localize("OP2.Desafio.HackEsperaRodada"));
    return null;
  }

  const roll = await rolarTeste(ator, {
    chavePericia: "tecnologia",
    dt: desafio.system.dtObjeto,
    rapido,
    contexto: `${game.i18n.localize("OP2.Desafio.HackTecnico")} — ${desafio.name}`,
  });
  if (!roll) return null;

  await gravarNoDesafio(desafio, {
    "system.hackTecnico.ultimaTentativaRodada": rodada,
    "system.hackTecnico.resolvido": roll.sucesso,
  });

  await enviarCard(ator, "hackear", {
    titulo: game.i18n.localize("OP2.Desafio.HackTecnico"),
    desafioNome: desafio.name,
    sucesso: roll.sucesso,
    tecnico: true,
  }, { whisper: sussurroPara(ator) });

  return { roll, sucesso: roll.sucesso };
}

/**
 * HACK SOCIAL (spec §7.3): Intuição vs DT do objeto. Sucesso revela o banco de
 * perguntas (mestre-only) e quantas "chances de errar" o excedente sobre a DT
 * concede (`chancesDeErroHackSocial`) — contar acertos/erros contra
 * `respostasNecessarias` é julgamento de mesa (comparar resposta falada com o
 * gabarito não é string match), por isso `marcarHackSocialResolvido` é manual.
 * @returns {Promise<{roll: OP2Roll, sucesso: boolean, chancesDeErro: number}|null>}
 */
export async function hackSocial(ator, desafioUuid, { rapido = false } = {}) {
  const desafio = await carregarDesafio(desafioUuid);
  if (!desafio) return null;
  if (desafio.system.hackSocial.resolvido) {
    ui.notifications.warn(game.i18n.localize("OP2.Desafio.HackJaResolvido"));
    return null;
  }
  const rodada = rodadaAtual();
  if (!podeTentarHackNestaRodada(desafio.system.hackSocial.ultimaTentativaRodada, rodada)) {
    ui.notifications.warn(game.i18n.localize("OP2.Desafio.HackEsperaRodada"));
    return null;
  }

  const roll = await rolarTeste(ator, {
    chavePericia: "intuicao",
    dt: desafio.system.dtObjeto,
    rapido,
    contexto: `${game.i18n.localize("OP2.Desafio.HackSocial")} — ${desafio.name}`,
  });
  if (!roll) return null;

  const chancesDeErro = roll.sucesso ? chancesDeErroHackSocial(roll.total, desafio.system.dtObjeto) : 0;

  await gravarNoDesafio(desafio, { "system.hackSocial.ultimaTentativaRodada": rodada });

  await enviarCard(ator, "hackear", {
    titulo: game.i18n.localize("OP2.Desafio.HackSocial"),
    desafioNome: desafio.name,
    atorId: ator.id,
    desafioUuid: desafio.uuid,
    sucesso: roll.sucesso,
    social: true,
    chancesDeErro,
    respostasNecessarias: desafio.system.hackSocial.respostasNecessarias,
    perguntas: roll.sucesso ? desafio.system.hackSocial.perguntas : [],
  }, { whisper: sussurroPara(ator) });

  return { roll, sucesso: roll.sucesso, chancesDeErro };
}

/**
 * O mestre marca o hack social como resolvido depois de conferir as respostas na
 * mesa — não dá pra automatizar comparar o que o jogador falou com o gabarito.
 */
export async function marcarHackSocialResolvido(desafioUuid) {
  const desafio = await carregarDesafio(desafioUuid);
  if (!desafio) return null;
  await gravarNoDesafio(desafio, { "system.hackSocial.resolvido": true });
}
