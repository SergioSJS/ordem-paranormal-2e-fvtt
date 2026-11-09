/**
 * Furtividade (beta §11), sem Foundry. No livro é a Cena 1 da Missão 2; as áreas e a tabela
 * das criaturas vêm nos parâmetros da cena (`cena.system.furtividade`).
 */
import { DT_ESCONDER, DT_ESCONDER_INCREMENTO } from "../config.mjs";
import { pontosDoEstendido } from "../dice/analise.mjs";

/**
 * Os dados do teste de esconderijo: não soma, cada dado fica com o valor rolado.
 * @param {{dado: string, resultado: number, contado: boolean, pavor?: boolean}[]} dados
 * @returns {{dado: string, valor: number}[]}
 */
export function dadosDeEsconderijo(dados) {
  return dados.filter((d) => d.contado && !d.pavor && !d.anulado).map((d) => ({ dado: d.dado, valor: d.resultado }));
}

/** O maior DADO que o personagem rolou (não o maior valor): é o que a tabela consulta. */
export function maiorDado(esconderijo) {
  return esconderijo.reduce((maior, d) => Math.max(maior, Number(d.dado.slice(1))), 0);
}

/**
 * Procurar: descarta os dados de esconderijo de valor igual a algum dos rolados. Soma não
 * entra: rolar 3 e 5 descobre os esconderijos de valor 3 ou 5.
 * @param {{dado: string, valor: number}[]} esconderijo
 * @param {number[]} valores
 * @returns {{resta: object[], perdeu: number, encontrado: boolean}}
 */
export function aplicarProcura(esconderijo, valores) {
  const resta = esconderijo.filter((d) => !valores.includes(d.valor));
  return {
    resta,
    perdeu: esconderijo.length - resta.length,
    encontrado: esconderijo.length > 0 && resta.length === 0,
  };
}

/**
 * A fórmula de quem salta em um personagem só: depende do maior dado que ele rolou
 * (linhas 8 e 9 da tabela).
 * @param {number} facesDoMaior
 * @param {[string, string, string]} formulas para d12, d10 e d8 ou menor
 */
export function formulaPorMaiorDado(facesDoMaior, [d12, d10, menor]) {
  if (facesDoMaior >= 12) return d12;
  if (facesDoMaior >= 10) return d10;
  return menor;
}

/** Esconder-se e Distrair ficam mais difíceis a cada uso: DT 7, 10, 13… */
export const dtQueEscala = (usos) => DT_ESCONDER + DT_ESCONDER_INCREMENTO * usos;

/** Chamar atenção: passa um dado para o aliado e descarta outro. */
export function chamarAtencao(meus, deles) {
  if (!meus.length) return null;
  const [transferido, ...resto] = meus;
  return { meus: resto.slice(1), deles: [...deles, transferido] };
}

/**
 * Teste de equilíbrio (beta §6): 2d10 sem somar; iguais ou com 1 de diferença equilibra.
 */
export const equilibrado = (a, b) => Math.abs(a - b) <= 1;

/** Dados de equilíbrio: d4 igual à metade das faces de Acrobacia. */
export const dadosDeEquilibrio = (facesAcrobacia) => Math.floor(facesAcrobacia / 2);

/**
 * Escalar (beta §6): rápido soma RA, cauteloso soma RB; falhou, cai e sofre dano igual ao
 * que já tinha acumulado.
 * Crítico soma também a segunda maior (beta §3).
 * @param {{pontos: number, alvo: number, modo: "rapido"|"cauteloso", sucesso: boolean, ra: number, rb: number, critico?: boolean, segunda?: number}} p
 */
export function passoDeEscalada({ pontos, alvo, modo, sucesso, ra, rb, critico = false, segunda = 0 }) {
  if (!sucesso) return { pontos: 0, dano: pontos, chegou: false };
  const novo = pontos + pontosDoEstendido({ ra, critico, segunda }, { base: modo === "rapido" ? ra : rb, somaCritico: true });
  return { pontos: Math.min(novo, alvo), dano: 0, chegou: novo >= alvo };
}

/**
 * Descer a encosta: falhar por 3 ou mais despenca, 1d6 por avanço que faltava, e chega.
 * @returns {string|null} a fórmula do dano da queda, ou null se não caiu
 */
export function quedaPorMargem({ total, dt, faltam }) {
  return dt - total >= 3 && faltam > 0 ? `${faltam}d6` : null;
}
