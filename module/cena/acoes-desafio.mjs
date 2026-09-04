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
  podeTentarHackNestaRodada, chancesDeErroHackSocial, linhaDaTabelaDeHack,
  tentativasPorRodadaDeDestrancar, tentativasDeDestrancarNaRodada,
} from "./desafios.mjs";
import { rolarTeste, renderizar, enviarParaChat, rotuloDePericia } from "../dice/teste.mjs";
import { enviarCardAoMestre } from "../ui/card-mestre.mjs";
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
    // Um card só, com os dados dentro: o card genérico de teste ainda oferecia
    // "Dano RA/RB", que não existe aqui, e o de Arrombar vinha depois sem os dados
    // (achado em uso real: "as lógicas de desafio estão estranhas").
    semCard: true,
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
    atorId: ator.id,
    componentes: roll.dados,
    total: roll.total,
    ra: roll.ra,
    critico: roll.critico,
    falhaCritica: roll.falhaCritica,
    dt: desafio.system.dtObjeto,
    custoPv: CUSTO_PV_ARROMBAR,
    sucesso: roll.sucesso,
    conseguiu,
    quebrado,
    pontuacaoAtual,
    pontuacaoAlvo: desafio.system.pontuacaoAlvo,
    tentativasUsadas,
    maxTentativas: desafio.system.maxTentativas,
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
export async function sustentar(ator, { rapido = false, desafioUuid = null } = {}) {
  if (ator.system.estado.sustentando?.ativo) {
    ui.notifications.warn(game.i18n.localize("OP2.Desafio.JaSustentando"));
    return null;
  }

  // Sustentar um obstáculo concreto (a estante-porta do Ato I) usa a DT dele; solto,
  // é a DT padrão da mesa.
  const desafio = desafioUuid ? await carregarDesafio(desafioUuid) : null;
  const contexto = desafio
    ? `${game.i18n.localize("OP2.Desafio.Sustentar")} — ${desafio.name}`
    : game.i18n.localize("OP2.Desafio.Sustentar");

  const roll = await rolarTeste(ator, {
    chavePericia: "atletismo", rapido, contexto,
    ...(desafio ? { dt: desafio.system.sustentar.dt } : {}),
  });
  if (!roll) return null;

  // Custo inicial de 1 PV — só depois de o teste rodar, nunca por um diálogo
  // cancelado (spec §7.5).
  await aplicarDano(ator, CUSTO_PV_SUSTENTAR, "pv");

  if (!roll.sucesso) {
    await enviarCard(ator, "acao-cena", {
      titulo: contexto,
      texto: [game.i18n.format("OP2.Desafio.SustentarFalhouInicio", { ator: ator.name }),
        desafio?.system.sustentar.aoFalhar].filter(Boolean).join(" "),
      atorId: ator.id,
    });
    return { roll, sustentando: false };
  }

  await ator.update({ "system.estado.sustentando": { ativo: true, fadiga: 0 } });
  await enviarCard(ator, "acao-cena", {
    titulo: contexto,
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
  let desafio = await carregarDesafio(desafioUuid);
  if (!desafio) return null;
  if (desafio.system.quebrado) {
    ui.notifications.warn(game.i18n.localize("OP2.Desafio.JaQuebrado"));
    return null;
  }
  if (desafio.system.destrancado) {
    ui.notifications.warn(game.i18n.localize("OP2.Desafio.JaDestrancado"));
    return null;
  }
  // A senha nasce sozinha na primeira tentativa: exigir que o mestre fosse na ficha
  // gerar à mão travava a mesa (achado em uso real). O mestre grava na hora; o
  // jogador pede pelo socket e a senha chega em seguida — tenta de novo.
  if (!desafio.system.senha.length) {
    await gerarSenhaDestrancar(desafioUuid);
    desafio = await carregarDesafio(desafioUuid);
    if (!desafio?.system.senha.length) {
      ui.notifications.info(game.i18n.localize("OP2.Desafio.DestrancarGerando"));
      return null;
    }
  }

  // Teto por rodada pelo dado de Crime (spec §7.1): d4 = 1 … d12 = 5. O histórico do
  // desafio guarda quem tentou em que rodada, então a contagem é ele mesmo.
  const rodada = rodadaAtual();
  const dadoCrime = ator?.system?.pericias?.crime?.dadoEfetivo ?? "d4";
  const tetoRodada = tentativasPorRodadaDeDestrancar(dadoCrime);
  const naRodada = tentativasDeDestrancarNaRodada(desafio.system.historicoDestrancar, ator?.id, rodada);
  if (naRodada >= tetoRodada) {
    ui.notifications.warn(game.i18n.format("OP2.Desafio.DestrancarTetoRodada", {
      teto: tetoRodada, dado: dadoCrime,
    }));
    return null;
  }

  const resultado = avaliarPalpite(desafio.system.senha, palpite);
  const venceu = venceuDestrancar(resultado);
  const destrancarTentativas = desafio.system.destrancarTentativas + 1;
  const quebrado = !venceu && excedeuTentativas({
    maxTentativas: desafio.system.maxTentativas, tentativasUsadas: destrancarTentativas,
  });
  const historicoDestrancar = [...desafio.system.historicoDestrancar,
    { palpite, resultado, atorId: ator?.id ?? "", rodada }];

  await gravarNoDesafio(desafio, {
    "system.destrancarTentativas": destrancarTentativas,
    "system.destrancado": venceu,
    "system.quebrado": quebrado,
    "system.historicoDestrancar": historicoDestrancar,
  });

  // O card mostra o palpite posição a posição com a resposta (exato/alto/baixo):
  // "tentativa registrada, veja o histórico" não dizia nada (achado em uso real).
  // A senha NÃO vai no card: ele nasce no cliente do jogador. O mestre a vê no app.
  await enviarCard(ator, "destrancar", {
    titulo: game.i18n.localize("OP2.Desafio.Destrancar"),
    desafioNome: desafio.name,
    venceu,
    quebrado,
    posicoes: posicoesDoPalpite(palpite, resultado),
    tentativas: destrancarTentativas,
    maxTentativas: desafio.system.maxTentativas,
    naRodada: naRodada + 1,
    tetoRodada,
    dadoCrime,
  }, { whisper: sussurroPara(ator) });

  return { resultado, venceu, quebrado, naRodada: naRodada + 1, tetoRodada };
}

/**
 * HACK TÉCNICO (spec §7.3): Tecnologia vs DT do objeto. Sem curva automática pro
 * problema matemático em si (docs/LACUNAS.md) — o card mostra o resultado (quanto
 * maior, mais fácil deveria ser o problema que o mestre escolhe) e um timer visual
 * de 10s fica disponível na ficha do desafio para o mestre iniciar. Falha só libera
 * nova tentativa na rodada seguinte.
 * @returns {Promise<{roll: OP2Roll, sucesso: boolean}|null>}
 */
/** Cada posição do palpite com a resposta, para o card e para o histórico do app. */
export function posicoesDoPalpite(palpite, resultado) {
  const icones = { exato: "fa-check", alto: "fa-arrow-down", baixo: "fa-arrow-up" };
  return resultado.map((valor, i) => ({
    valor,
    palpite: palpite[i],
    icone: icones[valor],
    rotulo: game.i18n.localize(`OP2.Desafio.DestrancarResultado.${valor}`),
  }));
}

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

  // Painel com tabela (o do Ato I) não abre pelo teste: o total escolhe a faixa, e a
  // faixa entrega o problema. Quem resolve é o jogador, na mesa — então o desafio só
  // fica resolvido quando o mestre marca (mesmo caminho do hack social).
  const linha = linhaDaTabelaDeHack(desafio.system.hackTecnico.tabela, roll.total);
  const temTabela = desafio.system.hackTecnico.tabela.length > 0;

  await gravarNoDesafio(desafio, {
    "system.hackTecnico.ultimaTentativaRodada": rodada,
    "system.hackTecnico.resolvido": temTabela ? false : roll.sucesso,
  });

  const sucesso = temTabela ? Boolean(linha) : roll.sucesso;
  const cartao = {
    titulo: game.i18n.localize("OP2.Desafio.HackTecnico"),
    desafioNome: desafio.name,
    atorId: ator.id,
    desafioUuid: desafio.uuid,
    total: roll.total,
    sucesso,
    tecnico: true,
    comTabela: temTabela,
    // Sem faixa alcançada o painel não devolveu nada — nem por isso o hack falhou de
    // vez: dá para tentar de novo na rodada seguinte.
    semResposta: temTabela && !linha,
  };
  // Com tabela, o jogador não recebe veredito nem a conta: o mestre prepara a mesa,
  // revela o problema e inicia o contador (`timer-hack.mjs`). Antes o card do jogador
  // já vinha com "sucesso" e a conta com a resposta (achado em uso real).
  await enviarCard(ator, "hackear", { ...cartao, aguardaMestre: temTabela && Boolean(linha) }, { whisper: sussurroPara(ator) });
  if (sucesso) {
    await enviarCardAoMestre(ator, "hackear", {
      ...cartao,
      soMestre: true,
      faixa: linha?.rolagem ?? "",
      problema: linha?.desafio ?? "",
      segundos: linha?.segundos > 0 ? linha.segundos : 10,
      indiceFaixa: linha ? desafio.system.hackTecnico.tabela.indexOf(linha) : -1,
    }, { tipo: "desafio" });
  }

  return { roll, sucesso, linha };
}

/** O painel abriu: quem confere a resposta do jogador é o mestre (spec §7.3). */
export async function marcarHackTecnicoResolvido(desafioUuid) {
  const desafio = await carregarDesafio(desafioUuid);
  if (!desafio) return null;
  await gravarNoDesafio(desafio, { "system.hackTecnico.resolvido": true });
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

  const cartao = {
    titulo: game.i18n.localize("OP2.Desafio.HackSocial"),
    desafioNome: desafio.name,
    atorId: ator.id,
    desafioUuid: desafio.uuid,
    sucesso: roll.sucesso,
    social: true,
  };
  await enviarCard(ator, "hackear", cartao, { whisper: sussurroPara(ator) });
  // Perguntas, respostas e o botão de marcar são bastidor: nascem no cliente do
  // mestre — num card do jogador, ele veria as respostas (achado em uso real).
  if (roll.sucesso) {
    await enviarCardAoMestre(ator, "hackear", {
      ...cartao,
      soMestre: true,
      chancesDeErro,
      respostasNecessarias: desafio.system.hackSocial.respostasNecessarias,
      perguntas: desafio.system.hackSocial.perguntas,
    }, { tipo: "desafio" });
  }

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

/**
 * DESAFIO GENÉRICO — a escapatória para o que o playtest não nomeia: uma tábua
 * pregada, um portão enferrujado, uma janela alta. O mestre escolhe a perícia e o
 * rótulo na ficha; aqui é só um teste contra a DT do objeto, e o sucesso resolve.
 * Sem gate de rodada: quem inventa o obstáculo decide se cabe tentar de novo.
 * @returns {Promise<{roll: OP2Roll, sucesso: boolean}|null>}
 */
export async function desafioGenerico(ator, desafioUuid, { rapido = false } = {}) {
  const desafio = await carregarDesafio(desafioUuid);
  if (!desafio) return null;
  if (desafio.system.generico.resolvido) {
    ui.notifications.warn(game.i18n.localize("OP2.Desafio.GenericoJaResolvido"));
    return null;
  }

  const rotulo = desafio.system.generico.rotulo?.trim()
    || game.i18n.localize("OP2.Desafio.Generico");

  const roll = await rolarTeste(ator, {
    chavePericia: desafio.system.generico.pericia,
    dt: desafio.system.dtObjeto,
    rapido,
    contexto: `${rotulo} — ${desafio.name}`,
  });
  if (!roll) return null;

  if (roll.sucesso) await gravarNoDesafio(desafio, { "system.generico.resolvido": true });

  await enviarCard(ator, "hackear", {
    titulo: rotulo,
    desafioNome: desafio.name,
    sucesso: roll.sucesso,
  }, { whisper: sussurroPara(ator) });

  return { roll, sucesso: roll.sucesso };
}
