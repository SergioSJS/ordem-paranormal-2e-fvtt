/**
 * Regras dos desafios de acesso físico, isoladas do Foundry (spec §7.2/§7.4).
 *
 * Arrombar acumula Rolagem Alta numa pontuação até estourar a Pontuação Alvo (PA)
 * do objeto; o teto de tentativas é opcional — só fechaduras do playtest têm um.
 * Alcançar não guarda estado: o dano de queda depende só do modo e do resultado.
 */

/**
 * ARROMBAR — acumula RA na pontuação, sem passar da PA (spec §7.2).
 * @param {{pontuacaoAtual: number, pontuacaoAlvo: number}} desafio
 * @param {number} ra
 * @returns {number} nova pontuação
 */
export function acumularArrombar(desafio, ra) {
  return Math.min(desafio.pontuacaoAlvo, desafio.pontuacaoAtual + ra);
}

/** @returns {boolean} a pontuação já atingiu a PA. */
export function arrombou(desafio) {
  return desafio.pontuacaoAtual >= desafio.pontuacaoAlvo;
}

/** @returns {boolean} 0 tentativas = sem teto; caso contrário, estourou o teto. */
export function excedeuTentativas(desafio) {
  return desafio.maxTentativas > 0 && desafio.tentativasUsadas >= desafio.maxTentativas;
}

/**
 * ALCANÇAR (spec §7.4): seguro falha com dano = RB (recomeça do zero); arriscado
 * falha com dano = RA (uma ação só, DT+3).
 * @param {"seguro"|"arriscado"} modo
 * @param {{ra: number, rb: number}} resultado
 * @returns {number}
 */
export function danoDeAlcancar(modo, resultado) {
  return modo === "arriscado" ? resultado.ra : resultado.rb;
}

/**
 * DESTRANCAR (spec §7.1): Mastermind numérico — cada posição do palpite é
 * comparada contra a mesma posição da senha, não contra o conjunto inteiro.
 * @param {number[]} senha oculta, gerada pelo mestre
 * @param {number[]} palpite mesmo tamanho da senha
 * @returns {("exato"|"alto"|"baixo")[]}
 */
export function avaliarPalpite(senha, palpite) {
  return senha.map((valor, i) => {
    if (palpite[i] === valor) return "exato";
    return palpite[i] > valor ? "alto" : "baixo";
  });
}

/** @param {("exato"|"alto"|"baixo")[]} resultado */
export function venceuDestrancar(resultado) {
  return resultado.length > 0 && resultado.every((r) => r === "exato");
}

/**
 * HACKEAR (spec §7.3): falhar num hack só libera nova tentativa na rodada seguinte
 * — nunca duas vezes na mesma rodada. `ultimaTentativaRodada` é `-1` até a primeira
 * tentativa (nunca bloqueia a primeira vez).
 */
export function podeTentarHackNestaRodada(ultimaTentativaRodada, rodadaAtual) {
  return ultimaTentativaRodada < 0 || ultimaTentativaRodada < rodadaAtual;
}

/**
 * HACK SOCIAL (spec §7.3): "a cada 3 pontos de excedente sobre a DT, ganha 1 chance
 * adicional de errar" — o texto não dá a base; 1 é o mínimo que faz "adicional" fazer
 * sentido (docs/LACUNAS.md). Excedente negativo (falhou o teste) não soma nada.
 * @param {number} total do teste de Intuição
 * @param {number} dt do dispositivo
 */
export function chancesDeErroHackSocial(total, dt) {
  return 1 + Math.max(0, Math.floor((total - dt) / 3));
}
