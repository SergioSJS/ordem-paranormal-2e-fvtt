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

/**
 * Linha da tabela de um hack que não abre sozinho (o painel do Ato I): o total do teste
 * escolhe a faixa, e a faixa entrega o problema que o jogador tem que resolver.
 *
 * As faixas vêm como o livro imprime: `10+`, `7-9`, `5-6`, `1-4`. Nada abaixo da menor
 * faixa devolve nada — o painel não deu resposta nenhuma.
 * @param {{rolagem: string, desafio: string}[]} tabela
 * @param {number} total  o total do teste
 * @returns {{rolagem: string, desafio: string}|null}
 */
export function linhaDaTabelaDeHack(tabela, total) {
  for (const linha of tabela ?? []) {
    const texto = String(linha.rolagem ?? "").replace(/\s/g, "");
    const aberta = /^(\d+)\+$/.exec(texto);
    if (aberta && total >= Number(aberta[1])) return linha;
    const faixa = /^(\d+)-(\d+)$/.exec(texto);
    if (faixa && total >= Number(faixa[1]) && total <= Number(faixa[2])) return linha;
    const exato = /^(\d+)$/.exec(texto);
    if (exato && total === Number(exato[1])) return linha;
  }
  return null;
}


/**
 * Tentativas de Destrancar por rodada, pelo dado de Crime (spec §7.1):
 * d4 = 1, d6 = 2, d8 = 3, d10 = 4, d12 = 5.
 * @param {string} dadoCrime  "d4" … "d12"
 */
export function tentativasPorRodadaDeDestrancar(dadoCrime) {
  const faces = Number(String(dadoCrime ?? "d4").replace(/^d/, ""));
  return Math.max(1, Math.min(5, Math.round(faces / 2) - 1));
}

/**
 * Quantas tentativas este ator já gastou nesta rodada, contando pelo histórico do
 * desafio — não há contador à parte para dessincronizar.
 * @param {{atorId?: string, rodada?: number}[]} historico
 */
export function tentativasDeDestrancarNaRodada(historico, atorId, rodada) {
  return (historico ?? []).filter((h) => h.atorId === atorId && h.rodada === rodada).length;
}
