/**
 * Orquestra um teste do começo ao fim: monta os componentes, rola, resolve a escolha
 * dos dados contabilizados e publica o card no chat.
 */
import { SYSTEM_ID, chaveDoRotuloDePericia } from "../config.mjs";
import { modoAtual } from "../modo.mjs";
import { OP2Roll } from "./op2-roll.mjs";
import { TesteDialog } from "./teste-dialog.mjs";
import { SelecaoDados } from "./selecao-dados.mjs";
import { lerConfig } from "../settings/register.mjs";
import { stepDie } from "./escada.mjs";
import { comoMestre } from "../ui/socket.mjs";
import { cardVigilia } from "../vigilia/card.mjs";
import { consumirAjuda } from "../cena/acoes-ajuda.mjs";
import { gastarImpeto, podePreencherImpeto } from "../cena/impeto.mjs";
import { modificadorPermanente } from "../vigilia/dano.mjs";
import { passosDeCondicoes } from "../vigilia/combate.mjs";
import { PosRolagem, temReacaoPosRolagem } from "./pos-rolagem.mjs";

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
  semCard = false, dadosExtras = [], modificador = 0, minimoCritico = 0, passos = 0, componentes = null,
} = {}) {
  const sistema = ator.system;
  // `componentes`: quem já sabe os dados (o ataque do NPC, "d8+d6") passa direto.
  const pericia = componentes ? { dado: "d6", tipo: "atributo" } : sistema.resolverChave(chavePericia);
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
    rotuloPericia: componentes ? (contexto ?? "") : rotuloDePericia(chavePericia),
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
  // O que a ficha e a situação já decidem: lesão e trauma somam fixo; caído e companhia
  // andam na escada (beta §7.5/§8). Só no diálogo dá para mexer.
  // Rolagem de NPC vem com os dados prontos: quem chama diz o atributo, e a condição pesa igual.
  const chaveAtributoBase = componentes ? (chaveAtributo ?? null) : base.chaveAtributo;
  base.modificador = modificador + modificadorPermanente(sistema.estado ?? {}, chavePericia, chaveAtributoBase);
  base.passos = passos + passosDeCondicoes([...(sistema.estado?.condicoes ?? [])], chaveAtributoBase);
  base.pavor = sistema.estado?.pavor || "";

  const config = componentes
    ? {
      // Passo de condição anda no primeiro dado da ficha, como o de situação (`rolarDadosDeNpc`).
      componentes: componentes.map((c, i) => (i === 0 && base.passos ? { ...c, dado: stepDie(c.dado, base.passos) } : c)),
      dt: (oposto || semDT) ? null : (dt ?? lerConfig("dtPadrao")), oposto, modificador: base.modificador,
    }
    : (rapido ? configuracaoRapida(ator, base) : await TesteDialog.abrir({ ator, base }));
  if (!config) return null;

  // Habilidade com custo em PD ("gaste 2 PD para receber +d4"): cobra ao confirmar,
  // não ao marcar — desmarcar ou fechar o diálogo não pode custar nada.
  if (config.custoPD > 0) {
    await ator.update({
      "system.recursos.pd.value": Math.max(0, (ator.system.recursos?.pd?.value ?? 0) - config.custoPD),
    });
  }

  // O espaço de ímpeto só some depois de a rolagem ser confirmada.
  if (config.gastarImpeto) await gastarImpeto(ator, 1);

  // Controlar baixa o dado de vez; abraçar o troca por dado bônus e encerra o efeito
  // (beta §9.1). O dado de pavor vai por último e nunca conta para o teto de dados.
  const dadoDePavor = config.semPavor ? "" : (config.pavor?.dado ?? base.pavor);
  const pavorMudou = config.pavor && (config.pavor.abracar || config.pavor.dado !== base.pavor);
  if (pavorMudou) await ator.update({ "system.estado.pavor": config.pavor.abracar ? "" : config.pavor.dado });
  // O dado abraçado já vem em `config.componentes`: é dado bônus e respeita o teto (beta §3).
  const dados = [...config.componentes];
  if (dadoDePavor && !config.pavor?.abracar) {
    dados.push({ chave: "pavor", rotulo: game.i18n.localize("OP2.Pavor.Titulo"), tipo: "pavor", dado: dadoDePavor });
  }
  if (config.bonusUsados?.length) {
    const resta = (sistema.estado.bonus ?? []).filter((_b, i) => !config.bonusUsados.includes(i));
    await ator.update({ "system.estado.bonus": resta });
  }

  const roll = OP2Roll.paraComponentes(dados, {
    dt: config.dt,
    escopoCritico: lerConfig("escopoCritico"),
    rotulo: contexto ?? base.rotuloPericia,
    atorId: ator.id,
    modificador: config.modificador ?? 0,
    minimoCritico,
  });

  await roll.evaluate();

  // Rolou mais do que soma: mostra os dados 3D antes de pedir a escolha, senão o
  // jogador escolheria às cegas e veria a animação depois do resultado.
  // `semCard`: quem chamou publica o próprio card com os dados dentro. É o caso
  // de Examinar — o card genérico não tinha o que dizer (rola sem DT, então nem
  // sucesso nem falha) e ainda oferecia "Dano RA/RB", que não existe ali. A
  // animação dos dados continua acontecendo, só o card não sai.
  // Análise e Prontidão mexem nos dados depois de rolar (beta §12): a janela vem antes
  // do card, que já sai com o valor certo.
  const reage = !rapido && !componentes && ator.isOwner && temReacaoPosRolagem(ator);
  if (roll.precisaSelecao || reage) {
    await mostrarDados3D(roll);
    if (roll.precisaSelecao) roll.aplicarSelecao(await SelecaoDados.abrir(roll, ator));
    if (reage) {
      await PosRolagem.abrir(roll, ator);
      // Dado anulado que saiu de baixo do pavor volta a contar: pode passar do limite de somados.
      if (roll.precisaSelecao) roll.aplicarSelecao(await SelecaoDados.abrir(roll, ator));
    }
    if (!semCard) await enviarParaChat(roll, ator, { pularDados3D: true });
  } else if (semCard) {
    await mostrarDados3D(roll);
  } else {
    await enviarParaChat(roll, ator);
  }

  // Quem publica o próprio card não traz o aviso do pavor: um card curto, com o mesmo botão.
  if (semCard && roll.pavorVencido && sistema.estado?.pavor) {
    await cardVigilia(ator, {
      titulo: game.i18n.localize("OP2.Pavor.Titulo"),
      texto: game.i18n.localize("OP2.Pavor.Vencido"),
      botoes: [{ rotulo: game.i18n.localize("OP2.Pavor.Encerrar"), acao: "vigilia-fim-pavor", dados: { atorUuid: ator.uuid } }],
    });
  }

  // "Empurrado" vale só para o próximo teste (beta §7.4).
  if (sistema.estado?.condicoes?.has?.("empurrado")) {
    await comoMestre("vigilia-condicao", { atorUuid: ator.uuid, condicao: "empurrado", ligar: false });
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
  const passosDaAjuda = (tipo) => (base.ajuda && base.ajuda.alvo === tipo ? base.ajuda.passos : 0)
    + (tipo === "pericia" ? (base.passos ?? 0) : 0);

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
    modificador: base.modificador ?? 0,
  };
}

/** "aptidao.exatas" → "Aptidão (Exatas)". */
export function rotuloDePericia(chave) {
  if (!chave.startsWith("aptidao.")) return game.i18n.localize(chaveDoRotuloDePericia(chave, modoAtual()));
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
    podePreencherImpeto: !dados.resultado.sucesso && podePreencherImpeto(ator),
    pavorVencido: roll.pavorVencido && Boolean(ator.system.estado?.pavor),
    atorUuid: ator.uuid,
    atorId: ator.id,
    temPavor: roll.dados.some((d) => d.pavor),
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
    // Sem `rollMode`: o core aplica o modo do usuário nas duas versões (v13 lê
    // `core.rollMode`, v14 lê `core.messageMode`) — e no v14 a opção `rollMode` está
    // depreciada (até a 16), com aviso a cada rolagem.
    { create: true },
  );
}

/** `renderTemplate` mudou de lugar no v13; o fallback mantém o v12 utilizável em dev. */
export function renderizar(caminho, contexto) {
  const render = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
  return render(caminho, contexto);
}
