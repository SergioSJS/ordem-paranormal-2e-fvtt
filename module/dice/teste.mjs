/**
 * Orquestra um teste do começo ao fim: monta os componentes, rola, resolve a escolha
 * dos dados contabilizados e publica o card no chat.
 */
import { SYSTEM_ID } from "../config.mjs";
import { OP2Roll } from "./op2-roll.mjs";
import { TesteDialog } from "./teste-dialog.mjs";
import { SelecaoDados } from "./selecao-dados.mjs";
import { lerConfig } from "../settings/register.mjs";
import { stepDie } from "./escada.mjs";
import { consumirAjuda } from "../cena/acoes-ajuda.mjs";

/**
 * @param {Actor} ator
 * @param {object} opcoes
 * @param {string} opcoes.chavePericia   "percepcao" ou "aptidao.exatas"
 * @param {string} [opcoes.chaveAtributo] default: o atributo pareado na ficha
 * @param {number|null} [opcoes.dt]
 * @param {boolean} [opcoes.oposto]
 * @param {boolean} [opcoes.semDT]       teste sem DT e sem sucesso/falha — Examinar
 *                                       compara o total contra várias DTs (spec §6.3.1)
 * @param {string} [opcoes.contexto]     título do card (default: nome da perícia)
 * @param {boolean} [opcoes.rapido]      pula o diálogo e usa os defaults
 * @returns {Promise<OP2Roll|null>}
 */
export async function rolarTeste(ator, {
  chavePericia, chaveAtributo, dt, oposto = false, semDT = false, contexto, rapido = false,
  semCard = false, dadosExtras = [],
} = {}) {
  const sistema = ator.system;
  const pericia = sistema.resolverChave(chavePericia);
  if (!pericia) {
    ui.notifications.error(game.i18n.format("OP2.Aviso.PericiaDesconhecida", { chave: chavePericia }));
    return null;
  }

  // Clicar direto num atributo (Físico/Mente/Emoção) não tem par natural — a regra do
  // playtest é sempre perícia + atributo (spec §4.1), e um atributo não pareia consigo
  // mesmo. `atributoDe()` só sabe o pareamento de perícias; para um atributo puro o
  // teste é o dado dele sozinho, sem segundo componente automático.
  const somenteAtributo = pericia.tipo === "atributo";

  const base = {
    chavePericia,
    rotuloPericia: rotuloDePericia(chavePericia),
    pericia: { ...pericia, dadoEfetivo: pericia.dado },
    chaveAtributo: somenteAtributo ? null : (chaveAtributo ?? sistema.atributoDe(chavePericia) ?? "fisico"),
    somenteAtributo,
    dt: semDT ? null : (dt ?? lerConfig("dtPadrao")),
    oposto,
    semDT,
    // Dados somados que não vêm da ficha — hoje só o +d6 da esquiva (spec §8.1),
    // a única exceção aditiva do playtest.
    dadosExtras,
    // Ajuda recebida e ainda não usada (spec §4.7): entra como passo já aplicado
    // no dado que o setting `ajudaAlvo` indica, e some depois desta rolagem.
    ajuda: ator.system.estado?.ajuda?.passos
      ? { ...ator.system.estado.ajuda, alvo: lerConfig("ajudaAlvo") }
      : null,
  };

  const config = rapido ? configuracaoRapida(ator, base) : await TesteDialog.abrir({ ator, base });
  if (!config) return null;

  // Habilidade com custo em PD ("gaste 2 PD para receber +d4"): cobra ao confirmar,
  // não ao marcar — desmarcar ou fechar o diálogo não pode custar nada.
  if (config.custoPD > 0) {
    await ator.update({
      "system.recursos.pd.value": Math.max(0, (ator.system.recursos?.pd?.value ?? 0) - config.custoPD),
    });
  }

  // O espaço de ímpeto só some depois de a rolagem ser confirmada.
  if (config.gastarImpeto) {
    await ator.update({
      "system.impeto.preenchidos": Math.max(0, (ator.system.impeto?.preenchidos ?? 0) - 1),
    });
  }

  const roll = OP2Roll.paraComponentes(config.componentes, {
    dt: config.dt,
    escopoCritico: lerConfig("escopoCritico"),
    rotulo: contexto ?? base.rotuloPericia,
    atorId: ator.id,
  });

  await roll.evaluate();

  // Rolou mais do que soma: mostra os dados 3D antes de pedir a escolha, senão o
  // jogador escolheria às cegas e veria a animação depois do resultado.
  // `semCard`: quem chamou publica o próprio card com os dados dentro. É o caso
  // de Examinar — o card genérico não tinha o que dizer (rola sem DT, então nem
  // sucesso nem falha) e ainda oferecia "Dano RA/RB", que não existe ali. A
  // animação dos dados continua acontecendo, só o card não sai.
  if (roll.precisaSelecao) {
    await mostrarDados3D(roll);
    roll.aplicarSelecao(await SelecaoDados.abrir(roll));
    if (!semCard) await enviarParaChat(roll, ator, { pularDados3D: true });
  } else if (semCard) {
    await mostrarDados3D(roll);
  } else {
    await enviarParaChat(roll, ator);
  }

  // Ajuda é para UMA rolagem: usada, acabou (spec §4.7 — custa a ação do aliado
  // para aquele teste, não é um efeito com duração).
  if (base.ajuda) await consumirAjuda(ator);

  return roll;
}

/** Configuração sem diálogo: perícia + atributo pareado, DT padrão. */
function configuracaoRapida(ator, base) {
  // Sem diálogo, a ajuda pendente precisa entrar aqui — senão o modo rápido
  // (macros, cards, testes) ignoraria silenciosamente o passo do aliado.
  const passosDaAjuda = (tipo) => (base.ajuda && base.ajuda.alvo === tipo ? base.ajuda.passos : 0);

  const componentes = [
    {
      chave: `pericia.${base.chavePericia}`,
      rotulo: base.rotuloPericia,
      tipo: "pericia",
      dado: stepDie(base.pericia.dado, passosDaAjuda("pericia")),
    },
  ];

  if (!base.somenteAtributo) {
    const atributo = ator.system.atributos[base.chaveAtributo];
    componentes.push({
      chave: `atributo.${base.chaveAtributo}`,
      rotulo: game.i18n.localize(`OP2.Atributo.${base.chaveAtributo}`),
      tipo: "atributo",
      dado: stepDie(atributo.dadoEfetivo, passosDaAjuda("atributo")),
    });
  }

  componentes.push(...(base.dadosExtras ?? []));

  return {
    dt: (base.oposto || base.semDT) ? null : base.dt,
    oposto: base.oposto,
    componentes,
  };
}

/** "aptidao.exatas" → "Aptidão (Exatas)". */
export function rotuloDePericia(chave) {
  if (!chave.startsWith("aptidao.")) return game.i18n.localize(`OP2.Pericia.${chave}`);
  const sub = chave.slice("aptidao.".length);
  const rotuloSub = game.i18n.localize(`OP2.Aptidao.${sub}`);
  return `${game.i18n.localize("OP2.Pericia.aptidao")} (${rotuloSub})`;
}

async function mostrarDados3D(roll) {
  if (!game.dice3d) return;
  try {
    await game.dice3d.showForRoll(roll, game.user, true);
  } catch (erro) {
    console.warn(`${SYSTEM_ID} | Dice So Nice falhou, seguindo sem animação`, erro);
  }
}

/**
 * @param {OP2Roll} roll
 * @param {Actor} ator
 */
export async function enviarParaChat(roll, ator, { pularDados3D = false } = {}) {
  const dados = { roll, ator, resultado: roll.resultado };
  const conteudo = await renderizar("systems/ordem-paranormal-2e/templates/chat/teste.hbs", {
    rotulo: roll.options.rotulo,
    componentes: roll.dados,
    ...dados.resultado,
    ehGM: game.user.isGM,
    // "Sempre que falha em um teste, você preenche um espaço" (ficha do Ato I).
    // É botão, não automático: a mesa às vezes reinterpreta o que foi uma falha, e
    // nenhum outro efeito do sistema se aplica sozinho.
    podePreencherImpeto: !dados.resultado.sucesso
      && (ator.system.impeto?.espacos ?? 0) > (ator.system.impeto?.preenchidos ?? 0),
  });

  return roll.toMessage(
    {
      speaker: ChatMessage.getSpeaker({ actor: ator }),
      content: conteudo,
      flags: {
        [SYSTEM_ID]: { tipo: "teste", atorId: ator.id, desfecho: roll.desfecho },
        // Quando os dados já rolaram em 3D antes da escolha (4 rolados → 3 contados),
        // a mensagem não pode animar de novo. O Dice So Nice decide isso pela flag
        // `skip` — `dsnHide` nas opções do `toMessage` não existe e era ignorada em
        // silêncio, então a animação acontecia duas vezes (achado em uso real).
        ...(pularDados3D ? { "dice-so-nice": { skip: true } } : {}),
      },
    },
    { rollMode: game.settings.get("core", "rollMode"), create: true },
  );
}

/** `renderTemplate` mudou de lugar no v13; o fallback mantém o v12 utilizável em dev. */
export function renderizar(caminho, contexto) {
  const render = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
  return render(caminho, contexto);
}
