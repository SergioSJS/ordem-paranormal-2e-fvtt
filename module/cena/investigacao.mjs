/**
 * Regras de investigação, isoladas do Foundry (spec §6).
 *
 * A coluna DT do quadro de informações é lida de duas formas diferentes: Investigar
 * compara o *tamanho do dado* da perícia, sem rolar; Examinar rola e compara a soma.
 * São camadas distintas sobre a mesma coluna — um personagem com Percepção d8 recebe
 * de graça toda info de DT ≤ 8 e rola para tentar as de DT 9+ (spec §6.3).
 */

/** Chave estável de uma informação revelada: "<uuid do POI>:<id da info>". */
export function chaveInfo(poiUuid, infoId) {
  return `${poiUuid}:${infoId}`;
}

/** Perícias presentes no quadro, sem repetição, na ordem em que aparecem. */
export function periciasDoQuadro(informacoes) {
  return [...new Set(informacoes.map((info) => info.pericia))];
}

/**
 * INVESTIGAR (spec §6.3): entrega toda informação da perícia com DT ≤ valor da
 * perícia (o tamanho do dado: 4/6/8/10/12). Determinístico, sem rolagem.
 *
 * @param {Array<{id: string, pericia: string, dt: number}>} informacoes quadro do POI
 * @param {string} chavePericia ex.: "percepcao" ou "aptidao.artes"
 * @param {number} valorPericia tamanho do dado da perícia
 * @param {Set<string>} idsJaRevelados ids já revelados *deste POI* por este personagem
 * @returns {string[]} ids das informações novas, em DT crescente
 */
export function resolverInvestigacao(informacoes, chavePericia, valorPericia, idsJaRevelados = new Set()) {
  return informacoes
    .filter((info) => info.pericia === chavePericia && info.dt <= valorPericia && !idsJaRevelados.has(info.id))
    .sort((a, b) => a.dt - b.dt)
    .map((info) => info.id);
}

/**
 * EXAMINAR (spec §6.3.1): rola a perícia e compara a *soma* contra a DT. Se nada
 * novo for revelado — por não atingir a DT ou por não haver mais nada — perde 1 PD.
 * Um crítico ignora a DT e revela tudo que falta daquela perícia: é a "informação
 * adicional" do crítico em cena de investigação (spec §4.3).
 *
 * @param {Array<{id: string, pericia: string, dt: number}>} informacoes
 * @param {string} chavePericia
 * @param {number} total soma dos dados contabilizados
 * @param {Set<string>} idsJaRevelados
 * @param {object} [opcoes]
 * @param {boolean} [opcoes.ignorarDT] crítico: revela o que falta, sem comparar DT
 * @returns {{revelaveis: string[], perdePD: boolean}}
 */
export function resolverExaminar(informacoes, chavePericia, total, idsJaRevelados = new Set(), { ignorarDT = false } = {}) {
  const revelaveis = informacoes
    .filter((info) => info.pericia === chavePericia
      && !idsJaRevelados.has(info.id)
      && (ignorarDT || info.dt <= total))
    .sort((a, b) => a.dt - b.dt)
    .map((info) => info.id);
  return { revelaveis, perdePD: revelaveis.length === 0 };
}

/**
 * Sobrecarga mental (spec §7.6): o dano emocional do fim da rodada. A tabela é
 * editável por cena; a última linha cobre "9 ou mais", então vale a maior rodada
 * da tabela que não passa da atual.
 *
 * @param {Array<{rodada: number, dano: string}>} tabela
 * @param {number} rodada
 * @returns {string} expressão de dano: "0", "1", "1d4"…
 */
export function danoSobrecarga(tabela, rodada) {
  const ordenada = [...tabela].sort((a, b) => a.rodada - b.rodada);
  let dano = "0";
  for (const linha of ordenada) {
    if (linha.rodada > rodada) break;
    dano = linha.dano;
  }
  return dano;
}
