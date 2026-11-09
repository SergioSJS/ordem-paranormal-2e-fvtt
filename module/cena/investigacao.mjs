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

/**
 * Uma linha só é achável quando não é rascunho do mestre (`oculta`) nem já foi
 * entregue de bandeja (`aberta`). As duas somem das buscas pelo mesmo motivo:
 * não há nada a descobrir ali — uma porque não existe pro jogador, a outra
 * porque ele já leu.
 */
export function descobrivel(info) {
  return !info.oculta && !info.aberta && !contadaAoGrupo(info);
}

/** Um jogador contou esta linha ao grupo: a mesa inteira já sabe (como `aberta`). */
export function contadaAoGrupo(info) {
  return (info.contadaPor?.length ?? 0) > 0;
}

/**
 * As perícias que abrem uma linha: a principal e, se houver, a alternativa
 * ("Pesquisar ou Tecnologia", o Computador do Ato I). Tudo que compara a perícia do
 * teste com a da linha passa por aqui — antes a segunda ficava só no texto, e
 * Examinar com ela não achava nada (achado em uso real).
 * @returns {string[]}
 */
export function periciasDaLinha(info) {
  return info.periciaAlternativa ? [info.pericia, info.periciaAlternativa] : [info.pericia];
}

/** A linha sai com esta perícia? */
export function linhaAceita(info, chavePericia) {
  return periciasDaLinha(info).includes(chavePericia);
}

/** Perícias presentes no quadro (principais e alternativas), sem repetição, na ordem em que aparecem. */
export function periciasDoQuadro(informacoes) {
  return [...new Set(informacoes.flatMap(periciasDaLinha))];
}

/**
 * O quadro agrupado como o painel mostra: uma linha "Pesquisar ou Tecnologia" fica
 * num grupo só, com as duas no título, em vez de aparecer duas vezes.
 * @returns {{chave: string, chaves: string[], infos: object[]}[]}
 */
export function gruposDoQuadro(informacoes) {
  const grupos = new Map();
  for (const info of informacoes) {
    const chaves = periciasDaLinha(info);
    const chave = chaves.join("|");
    if (!grupos.has(chave)) grupos.set(chave, { chave, chaves, infos: [] });
    grupos.get(chave).infos.push(info);
  }
  return [...grupos.values()];
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
    .filter((info) => descobrivel(info) && linhaAceita(info, chavePericia)
      && info.dt <= valorPericia && !idsJaRevelados.has(info.id))
    .sort((a, b) => a.dt - b.dt)
    .map((info) => info.id);
}

/**
 * Por que Investigar não trouxe nada? "Nenhuma informação nova" sozinho não diz
 * se a perícia não serve ali, se o dado é pequeno demais ou se já se descobriu
 * tudo — e sem isso o jogador fica sem saber o que fazer (achado em uso real).
 *
 * Rascunho do mestre (`oculta`) conta como inexistente: o jogador não pode nem
 * suspeitar que existe algo ali esperando.
 *
 * @returns {{motivo: "sem-pericia"|"dado-pequeno"|"ja-revelado", dtMinima: number|null}}
 *   `dtMinima` só existe em "dado-pequeno" — é o que faltaria alcançar.
 */
export function motivoSemRevelacao(informacoes, chavePericia, valorPericia, idsJaRevelados = new Set()) {
  const daPericia = informacoes.filter((info) => descobrivel(info) && linhaAceita(info, chavePericia));
  if (!daPericia.length) return { motivo: "sem-pericia", dtMinima: null };

  const naoRevelados = daPericia.filter((info) => !idsJaRevelados.has(info.id));
  if (!naoRevelados.length) return { motivo: "ja-revelado", dtMinima: null };

  return { motivo: "dado-pequeno", dtMinima: Math.min(...naoRevelados.map((info) => info.dt)) };
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
    .filter((info) => descobrivel(info) && linhaAceita(info, chavePericia)
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
