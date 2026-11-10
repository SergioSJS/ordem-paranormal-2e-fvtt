/**
 * Leitura de um teste, isolada do Foundry.
 *
 * Fica separada de `OP2Roll` de propósito: são as regras mais sutis do playtest
 * (spec §4.2–4.5) e precisam ser testáveis sem subir o Foundry.
 */
import { MAX_DADOS_CONTADOS, VALOR_MINIMO_CRITICO } from "../config.mjs";

/**
 * @typedef {object} DadoRolado
 * @property {number} indice
 * @property {string} dado       "d8"
 * @property {number} resultado
 * @property {boolean} contado   entra na soma?
 * @property {boolean} [pavor]    é o dado de pavor: rola junto, nunca soma (beta §9.1)
 * @property {boolean} [anulado]  o pavor anulou este dado
 */

/**
 * Aplica o dado de pavor (beta §9.1): anula os dados com resultado MENOR que ele; empate
 * não anula. Dado anulado sai só da soma: para RA, RB e crítico ele continua valendo (beta 1.1,
 * p. 24, "Apenas em Testes"; a 1.0 não dizia, e o sistema tirava de tudo).
 * @param {DadoRolado[]} dados
 * @returns {DadoRolado[]}
 */
export function marcarPavor(dados) {
  const pavor = dados.find((d) => d.pavor);
  if (!pavor) return dados;
  return dados.map((d) => {
    if (d.pavor) return { ...d, contado: false };
    if (d.resultado < pavor.resultado) return { ...d, anulado: true, contado: false };
    return d;
  });
}

/** Os dados do teste em si, sem o de pavor. */
const doTeste = (dados) => dados.filter((d) => !d.pavor);

/** @param {DadoRolado[]} dados */
export const contados = (dados) => dados.filter((d) => d.contado && !d.pavor && !d.anulado);

/** Os dados que valem para os efeitos do teste (RA, RB, crítico): os contados e os que o pavor anulou. */
export const paraEfeitos = (dados) => dados.filter((d) => !d.pavor && (d.contado || d.anulado));

/** @param {DadoRolado[]} dados */
export const soma = (dados) => contados(dados).reduce((s, d) => s + d.resultado, 0);

/**
 * Rolagem Alta — o maior *valor* rolado, não o maior dado. Um d8 que saiu 3 ao lado de
 * um d6 que saiu 6 dá RA 6 (spec §4.2).
 * @param {DadoRolado[]} dados
 */
export function ra(dados) {
  const v = paraEfeitos(dados).map((d) => d.resultado);
  return v.length ? Math.max(...v) : 0;
}

/** Rolagem Baixa — o menor valor rolado. @param {DadoRolado[]} dados */
export function rb(dados) {
  const v = paraEfeitos(dados).map((d) => d.resultado);
  return v.length ? Math.min(...v) : 0;
}

/**
 * O valor repetido que gera o crítico, ou null.
 *
 * Crítico é dois ou mais dados com o mesmo valor, e esse valor ≥ 6 (spec §4.3). Par de
 * 5 não conta; par de 1 é falha crítica, nunca crítico.
 *
 * @param {DadoRolado[]} dados
 * @param {"todos"|"contados"|"semMenor"} [escopo] o alpha não define se descartados contam (spec
 *   §4.5); o beta 1.1 manda, com 4 dados, descartar o menor antes de ver o crítico (p. 11): `semMenor`.
 */
export function valorCritico(dados, escopo = "todos", minimo = VALOR_MINIMO_CRITICO) {
  const rolados = doTeste(dados);
  // "Se rolar 4 dados": conta o que rolou, mesmo o que o pavor anulou.
  if (escopo === "semMenor" && rolados.length >= 4) {
    const menor = rolados.reduce((m, d) => (d.resultado < m.resultado ? d : m));
    rolados.splice(rolados.indexOf(menor), 1);
  }
  const alvo = escopo === "contados" ? contados(dados) : rolados;
  const contagem = new Map();
  for (const d of alvo) {
    if (d.resultado < minimo) continue;
    contagem.set(d.resultado, (contagem.get(d.resultado) ?? 0) + 1);
  }
  const repetidos = [...contagem.entries()].filter(([, n]) => n >= 2).map(([v]) => v);
  return repetidos.length ? Math.max(...repetidos) : null;
}

/**
 * Falha crítica: *todos* os dados em 1 (spec §4.3), ou todos anulados pelo pavor
 * (beta §9.1). @param {DadoRolado[]} dados
 */
export function ehFalhaCritica(dados, escopo = "todos") {
  const doTesteTodos = doTeste(dados);
  if (doTesteTodos.length < dados.length && doTesteTodos.every((d) => d.anulado)) return true;
  const alvo = escopo === "contados" ? contados(dados) : doTesteTodos;
  return alvo.length > 0 && alvo.every((d) => d.resultado === 1);
}

/**
 * O que um teste estendido soma à pontuação: a RA ou a RB, conforme o desafio, e no crítico
 * também a segunda maior (beta §3).
 * @param {{ra: number, rb?: number, critico?: boolean, segunda?: number}} r
 */
export const pontosDoEstendido = (r, { base = r.ra, somaCritico = false } = {}) => base + (somaCritico && r.critico ? (r.segunda ?? 0) : 0);

/** A segunda maior rolagem: é o que o crítico soma ao dano e à pontuação (beta §3). */
export function segundaRolagem(dados) {
  return paraEfeitos(dados).map((d) => d.resultado).sort((a, b) => b - a)[1] ?? 0;
}

/**
 * Desfecho completo. Crítico e falha crítica têm precedência sobre a DT (spec §4.3).
 * @param {DadoRolado[]} dados
 * @param {{dt?: number|null, escopoCritico?: "todos"|"contados", modificador?: number,
 *   minimoCritico?: number}} [opcoes] `modificador`: o fixo do beta (`+1`, `–2`), que
 *   só soma ao resultado (beta §3); `minimoCritico`: arma que critica com valores
 *   menores (a espada de Cormac critica com par de 5).
 */
export function analisar(dados, {
  dt = null, escopoCritico = "todos", modificador = 0, minimoCritico = VALOR_MINIMO_CRITICO,
} = {}) {
  const falhaCritica = ehFalhaCritica(dados, escopoCritico);
  // O pavor que anula todos os dados faz falha crítica (beta §9.1): aí não há crítico, mesmo
  // com os anulados valendo para os outros efeitos.
  const tudoAnulado = contados(dados).length === 0 && dados.some((d) => d.anulado);
  const critico = tudoAnulado ? null : valorCritico(dados, escopoCritico, minimoCritico);
  // Tudo anulado pelo pavor vale 0, com ou sem modificador (beta §9.1).
  const total = contados(dados).length ? soma(dados) + modificador : 0;

  let sucesso = null;
  if (critico !== null) sucesso = true;
  else if (falhaCritica) sucesso = false;
  else if (dt !== null) sucesso = total >= dt;

  let desfecho = "indefinido";
  if (critico !== null) desfecho = "critico";
  else if (falhaCritica) desfecho = "falha-critica";
  else if (sucesso !== null) desfecho = sucesso ? "sucesso" : "falha";

  return {
    total, dt, modificador,
    ra: ra(dados), rb: rb(dados),
    segunda: segundaRolagem(dados),
    critico: critico !== null, valorCritico: critico,
    falhaCritica, sucesso, desfecho,
  };
}

/**
 * Qual dado é a RA e qual é a RB, para desenhar (a transmissão pinta um de vermelho e o outro
 * de azul). Um dado por papel: o primeiro com o maior valor e o primeiro com o menor; com dois
 * dados iguais, cada um fica com um papel. Com um dado contado só, ele é os dois.
 * @param {DadoRolado[]} dados
 * @returns {{ra: number|null, rb: number|null}} os `indice`s
 */
export function papeisDosDados(dados) {
  const vivos = paraEfeitos(dados);
  if (!vivos.length) return { ra: null, rb: null };
  const maior = Math.max(...vivos.map((d) => d.resultado));
  const menor = Math.min(...vivos.map((d) => d.resultado));
  const ra = vivos.find((d) => d.resultado === maior);
  const rb = vivos.find((d) => d.resultado === menor && d !== ra) ?? ra;
  return { ra: ra.indice, rb: rb.indice };
}

/**
 * Atalho de seleção quando se rola mais dados do que se soma: os maiores valores.
 * É só um default — a escolha ótima nem sempre é a soma máxima, porque RA e RB
 * alimentam efeitos posteriores (spec §4.5).
 * @param {DadoRolado[]} dados
 */
export function selecaoSugerida(dados) {
  return dados.filter((d) => !d.pavor && !d.anulado)
    .sort((a, b) => b.resultado - a.resultado)
    .slice(0, MAX_DADOS_CONTADOS)
    .map((d) => d.indice)
    .sort((a, b) => a - b);
}
