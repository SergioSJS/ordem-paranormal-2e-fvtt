/**
 * Orquestra um teste do começo ao fim: monta os componentes, rola, resolve a escolha
 * dos dados contabilizados e publica o card no chat.
 */
import { SYSTEM_ID } from "../config.mjs";
import { OP2Roll } from "./op2-roll.mjs";
import { TesteDialog } from "./teste-dialog.mjs";
import { SelecaoDados } from "./selecao-dados.mjs";
import { lerConfig } from "../settings/register.mjs";

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
export async function rolarTeste(ator, { chavePericia, chaveAtributo, dt, oposto = false, semDT = false, contexto, rapido = false } = {}) {
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
  };

  const config = rapido ? configuracaoRapida(ator, base) : await TesteDialog.abrir({ ator, base });
  if (!config) return null;

  const roll = OP2Roll.paraComponentes(config.componentes, {
    dt: config.dt,
    escopoCritico: lerConfig("escopoCritico"),
    rotulo: contexto ?? base.rotuloPericia,
    atorId: ator.id,
  });

  await roll.evaluate();

  // Rolou mais do que soma: mostra os dados 3D antes de pedir a escolha, senão o
  // jogador escolheria às cegas e veria a animação depois do resultado.
  if (roll.precisaSelecao) {
    await mostrarDados3D(roll);
    roll.aplicarSelecao(await SelecaoDados.abrir(roll));
    await enviarParaChat(roll, ator, { pularDados3D: true });
  } else {
    await enviarParaChat(roll, ator);
  }

  return roll;
}

/** Configuração sem diálogo: perícia + atributo pareado, DT padrão. */
function configuracaoRapida(ator, base) {
  const componentes = [
    { chave: `pericia.${base.chavePericia}`, rotulo: base.rotuloPericia, tipo: "pericia", dado: base.pericia.dado },
  ];

  if (!base.somenteAtributo) {
    const atributo = ator.system.atributos[base.chaveAtributo];
    componentes.push({
      chave: `atributo.${base.chaveAtributo}`,
      rotulo: game.i18n.localize(`OP2.Atributo.${base.chaveAtributo}`),
      tipo: "atributo",
      dado: atributo.dadoEfetivo,
    });
  }

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
  });

  return roll.toMessage(
    {
      speaker: ChatMessage.getSpeaker({ actor: ator }),
      content: conteudo,
      flags: { [SYSTEM_ID]: { tipo: "teste", atorId: ator.id, desfecho: roll.desfecho } },
    },
    { rollMode: game.settings.get("core", "rollMode"), create: true, ...(pularDados3D ? { dsnHide: true } : {}) },
  );
}

/** `renderTemplate` mudou de lugar no v13; o fallback mantém o v12 utilizável em dev. */
export function renderizar(caminho, contexto) {
  const render = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
  return render(caminho, contexto);
}
