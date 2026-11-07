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
 * não anula. Dado anulado não conta para soma, RA, RB nem crítico (docs/regras/LACUNAS.md).
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

/** @param {DadoRolado[]} dados */
export const soma = (dados) => contados(dados).reduce((s, d) => s + d.resultado, 0);

/**
 * Rolagem Alta — o maior *valor* rolado, não o maior dado. Um d8 que saiu 3 ao lado de
 * um d6 que saiu 6 dá RA 6 (spec §4.2).
 * @param {DadoRolado[]} dados
 */
export function ra(dados) {
  const v = contados(dados).map((d) => d.resultado);
  return v.length ? Math.max(...v) : 0;
}

/** Rolagem Baixa — o menor valor rolado. @param {DadoRolado[]} dados */
export function rb(dados) {
  const v = contados(dados).map((d) => d.resultado);
  return v.length ? Math.min(...v) : 0;
}

/**
 * O valor repetido que gera o crítico, ou null.
 *
 * Crítico é dois ou mais dados com o mesmo valor, e esse valor ≥ 6 (spec §4.3). Par de
 * 5 não conta; par de 1 é falha crítica, nunca crítico.
 *
 * @param {DadoRolado[]} dados
 * @param {"todos"|"contados"} [escopo] o playtest não define se descartados contam (spec §4.5)
 */
export function valorCritico(dados, escopo = "todos", minimo = VALOR_MINIMO_CRITICO) {
  const alvo = escopo === "contados" ? contados(dados) : doTeste(dados).filter((d) => !d.anulado);
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
  return contados(dados).map((d) => d.resultado).sort((a, b) => b - a)[1] ?? 0;
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
  const critico = valorCritico(dados, escopoCritico, minimoCritico);
  const falhaCritica = ehFalhaCritica(dados, escopoCritico);
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
