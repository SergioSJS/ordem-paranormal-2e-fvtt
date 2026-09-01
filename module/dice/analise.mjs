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
 */

/** @param {DadoRolado[]} dados */
export const contados = (dados) => dados.filter((d) => d.contado);

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
export function valorCritico(dados, escopo = "todos") {
  const alvo = escopo === "contados" ? contados(dados) : dados;
  const contagem = new Map();
  for (const d of alvo) {
    if (d.resultado < VALOR_MINIMO_CRITICO) continue;
    contagem.set(d.resultado, (contagem.get(d.resultado) ?? 0) + 1);
  }
  const repetidos = [...contagem.entries()].filter(([, n]) => n >= 2).map(([v]) => v);
  return repetidos.length ? Math.max(...repetidos) : null;
}

/** Falha crítica: *todos* os dados em 1 (spec §4.3). @param {DadoRolado[]} dados */
export function ehFalhaCritica(dados, escopo = "todos") {
  const alvo = escopo === "contados" ? contados(dados) : dados;
  return alvo.length > 0 && alvo.every((d) => d.resultado === 1);
}

/**
 * Desfecho completo. Crítico e falha crítica têm precedência sobre a DT (spec §4.3).
 * @param {DadoRolado[]} dados
 * @param {{dt?: number|null, escopoCritico?: "todos"|"contados"}} [opcoes]
 */
export function analisar(dados, { dt = null, escopoCritico = "todos" } = {}) {
  const critico = valorCritico(dados, escopoCritico);
  const falhaCritica = ehFalhaCritica(dados, escopoCritico);
  const total = soma(dados);

  let sucesso = null;
  if (critico !== null) sucesso = true;
  else if (falhaCritica) sucesso = false;
  else if (dt !== null) sucesso = total >= dt;

  let desfecho = "indefinido";
  if (critico !== null) desfecho = "critico";
  else if (falhaCritica) desfecho = "falha-critica";
  else if (sucesso !== null) desfecho = sucesso ? "sucesso" : "falha";

  return {
    total, dt,
    ra: ra(dados), rb: rb(dados),
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
  return [...dados]
    .sort((a, b) => b.resultado - a.resultado)
    .slice(0, MAX_DADOS_CONTADOS)
    .map((d) => d.indice)
    .sort((a, b) => a - b);
}
