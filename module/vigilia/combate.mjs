/**
 * Combate por fases do beta (beta §7), sem Foundry.
 *
 * Três fases (beta 1.1, p. 18): geral (qualquer ação, exceto ataques, incluindo mover-se, fugir e
 * investigar no meio da luta), ataques à distância e ataques corpo a corpo. A 1.0 imprimia quatro
 * nas missões (suporte e final no lugar da geral); a 1.1 unificou.
 */
import {
  DT_ATAQUE, BONUS_DT_SITUACAO, DT_FERIMENTO_BASE, DT_FERIMENTO_INCREMENTO, DT_PADRAO,
} from "../config.mjs";

export const FASES = ["geral", "distancia", "corpo"];


export const CONDICOES = [
  "caido", "agarrado", "atordoado", "inconsciente", "moribundo",
  "coberturaLeve", "coberturaTotal", "ocultacaoLeve", "ocultacaoTotal", "atrapalhado", "apressado",
  "defendendo", "fintando", "mirando", "empurrado",
];

/** Condições que duram só a rodada: saem quando ela vira (beta §7.2). */
export const CONDICOES_DA_RODADA = ["atrapalhado", "apressado", "defendendo"];

/** Condições que valem até o fim da PRÓXIMA rodada: Fintar, Mirar, Empurrar (beta §7.2/§7.4). */
export const CONDICOES_DE_DUAS_RODADAS = ["fintando", "mirando", "empurrado"];

/**
 * A virada de rodada, sem Foundry. `vistas` é o que já estava de pé na virada anterior:
 * é assim que se sabe quem acabou de ficar moribundo (não testa nesta) e que condição de
 * duas rodadas já cumpriu a primeira (sai nesta).
 * @param {{id: string, condicoes: string[]}[]} atores
 * @param {string[]} vistas chaves "id|condicao" da virada anterior
 * @returns {{testam: string[], saem: {id: string, condicao: string}[], vistas: string[]}}
 */
export function virarRodada(atores, vistas = []) {
  const antes = new Set(vistas);
  const testam = [];
  const saem = [];
  const novas = [];
  for (const { id, condicoes } of atores) {
    for (const condicao of condicoes) {
      const chave = `${id}|${condicao}`;
      if (condicao === "moribundo") {
        if (antes.has(chave)) testam.push(id);
        novas.push(chave);
      } else if (CONDICOES_DE_DUAS_RODADAS.includes(condicao)) {
        if (antes.has(chave)) saem.push({ id, condicao });
        else novas.push(chave);
      } else if (CONDICOES_DA_RODADA.includes(condicao)) {
        saem.push({ id, condicao });
      }
    }
  }
  return { testam, saem, vistas: novas };
}

/**
 * Soltar-se de um agarre (beta §7.4; Afogar, p. 33): contra quem segura, só vencendo (empate
 * segura); sem quem segura conhecido (agarrado ligado à mão), a DT padrão.
 * @param {number} meu @param {number|undefined} [dele]
 */
export const venceuSoltura = (meu, dele) => (dele === undefined ? meu >= DT_PADRAO : meu > dele);

/** Passos de quem tenta soltar: a vítima sofre os do agarre (–1 no Afogar); quem ajuda, não. */
export const passosDaSoltura = (ehAVitima, passosDoAgarre) => (ehAVitima ? Number(passosDoAgarre) || 0 : 0);

/** A próxima fase, ou null se esta era a última da rodada. */
export function proximaFase(fase) {
  const i = FASES.indexOf(fase);
  return i >= 0 && i < FASES.length - 1 ? FASES[i + 1] : null;
}

/** Em que fase cai esse tipo de ataque. */
export const faseDoAtaque = (tipo) => (tipo === "distancia" ? "distancia" : "corpo");

/**
 * Quem agiu não age de novo na rodada (beta §7.1). Prontidão e ação extra são exceção, e
 * por isso o painel só avisa: quem decide é a mesa.
 * @param {{ator: string, fase: string}[]} agiram
 * @param {string} atorId
 */
export const jaAgiu = (agiram, atorId) => agiram.some((a) => a.ator === atorId);

/**
 * "atletismo -1, furtividade -1" → pares. Texto na ficha do item porque é raro e o mestre
 * escreve na mão; o que não dá para ler fica de fora, sem quebrar a ficha.
 * @returns {{chave: string, passos: number}[]}
 */
export function lerPassos(texto) {
  return String(texto ?? "").split(",").flatMap((parte) => {
    const m = /^\s*([a-zA-Zà-úÀ-Ú.]+)\s*([+-]\s*\d+)\s*$/.exec(parte);
    return m ? [{ chave: m[1].toLowerCase(), passos: Number(m[2].replace(/\s/g, "")) }] : [];
  });
}

/**
 * Os passos que a situação de quem testa já impõe: caído pesa em teste físico; atrapalhado
 * e quem usou ação livre apressada, em todos (beta §7.2/§7.5).
 */
export function passosDeCondicoes(condicoes, chaveAtributo) {
  let passos = 0;
  if (condicoes.includes("caido") && chaveAtributo === "fisico") passos -= 1;
  if (condicoes.includes("atrapalhado")) passos -= 1;
  if (condicoes.includes("apressado")) passos -= 1;
  if (condicoes.includes("empurrado")) passos -= 1;
  return passos;
}

/**
 * Monta o ataque: DT e passos, a partir de quem ataca e de quem apanha (beta §7.3/§7.5).
 * @param {object} ataque
 * @param {"corpo"|"distancia"} ataque.tipo
 * @param {boolean} [ataque.longe] alvo em alcance longo
 * @param {string[]} [ataque.condicoesAlvo]
 * @param {string[]} [ataque.condicoesAtacante]
 * @param {boolean} [ataque.alvoEmCorpoACorpo] atirar em quem lutou na rodada anterior
 * @param {boolean} [ataque.arriscar] ignora a penalidade e rola 1d6 para ver em quem pega
 * @param {boolean} [ataque.vantagem] vantagem tática, a critério do mestre
 * @param {boolean} [ataque.mirou]
 * @returns {{dt: number, passos: number, alvoProtegido: boolean, dadosExtras: string[], arriscando: boolean}}
 */
export function montarAtaque({
  tipo, longe = false, condicoesAlvo = [], condicoesAtacante = [],
  alvoEmCorpoACorpo = false, arriscar = false, vantagem = false, mirou = false,
}) {
  let dt = DT_ATAQUE;
  let passos = 0;
  const dadosExtras = [];
  if (longe) dt += BONUS_DT_SITUACAO;
  if (condicoesAlvo.includes("coberturaLeve")) dt += BONUS_DT_SITUACAO;
  if (condicoesAlvo.includes("caido")) {
    if (tipo === "distancia") dt += BONUS_DT_SITUACAO;
    else passos += 1;
  }
  if (condicoesAlvo.includes("ocultacaoLeve")) passos -= 1;
  if (condicoesAlvo.includes("ocultacaoTotal")) passos -= 2;
  if (condicoesAtacante.includes("agarrado")) passos -= 1;
  if (vantagem) passos += 1;
  if (mirou && tipo === "distancia") dadosExtras.push("d6");
  const arriscando = tipo === "distancia" && alvoEmCorpoACorpo && arriscar;
  if (tipo === "distancia" && alvoEmCorpoACorpo && !arriscar) passos -= 2;
  return { dt, passos, alvoProtegido: condicoesAlvo.includes("coberturaTotal"), dadosExtras, arriscando };
}

/**
 * Corpo a corpo cruzado (beta §7.3): vira teste oposto. Maior resultado acerta, empate os
 * dois acertam, e em todo caso é preciso atingir a DT básica.
 * @returns {{acertaA: boolean, acertaB: boolean}}
 */
export function resolverCruzado(totalA, totalB, dt = DT_ATAQUE) {
  const a = totalA >= dt && totalA >= totalB;
  const b = totalB >= dt && totalB >= totalA;
  return { acertaA: a, acertaB: b };
}

/**
 * Dano do acerto: RA + arma, e o crítico soma a segunda maior rolagem (beta §3/§7.3).
 * @param {{ra: number, segunda?: number, critico?: boolean}} leitura
 * @param {number} [bonusDano]
 */
export function danoDoAcerto(leitura, bonusDano = 0) {
  return leitura.ra + bonusDano + (leitura.critico ? (leitura.segunda ?? 0) : 0);
}

/**
 * Defender-se (beta §7.2): vence quem defende só se passar do ataque; empate fica com o
 * ataque, porque o texto pede "vencer".
 */
export const defesaVenceu = (totalDefesa, totalAtaque) => totalDefesa > totalAtaque;

/**
 * Empate em teste oposto: os dois rolam de novo, até haver vencedor (beta 1.1, p. 11). Não vale
 * para o corpo a corpo cruzado, em que o empate faz os dois acertarem (p. 19), nem para teste
 * contra DT (sem `dele`).
 */
export const empatou = (meu, dele) => dele !== undefined && dele !== null && Number(meu) === Number(dele);

/** Manobra: vence por 5 ou mais dá o efeito extra (beta §7.4). */
export function resolverManobra(totalAtacante, totalAlvo) {
  return { venceu: totalAtacante > totalAlvo, porCinco: totalAtacante - totalAlvo >= 5 };
}

export const MANOBRAS = ["agarrar", "derrubar", "desarmar", "empurrar", "quebrar"];

/** A DT que escala nos testes de lesão e de trauma: 7, 10, 13… (beta §8.2/§8.3). */
export const dtDeQueda = (testesFeitos) => DT_FERIMENTO_BASE + DT_FERIMENTO_INCREMENTO * testesFeitos;
