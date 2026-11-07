/** A rolagem da ficha de NPC: "d8+d6", "2d10", como o livro imprime (beta §7). */
import { rolarTeste } from "../dice/teste.mjs";
import { stepDie } from "../dice/escada.mjs";

/**
 * "2d10+d6" → ["d10", "d10", "d6"]. O que não for dado fica de fora.
 * @param {string} formula
 * @returns {string[]}
 */
export function lerDadosDeNpc(formula) {
  return String(formula ?? "").split("+").flatMap((parte) => {
    const m = /^\s*(\d*)d(\d+)\s*$/.exec(parte);
    return m ? Array.from({ length: Number(m[1] || 1) }, () => `d${m[2]}`) : [];
  });
}

/**
 * Rola sem diálogo: o mestre já sabe o que o monstro faz, e a mesa não espera.
 * @param {Actor} npc
 * @param {string} formula
 * @param {object} [opcoes]
 * @param {string} [opcoes.atributo] de que atributo é o teste: "caído" só pesa no físico (beta §7.5)
 */
export function rolarDadosDeNpc(npc, formula, { dt, oposto = false, contexto, passos = 0, atributo = "fisico" } = {}) {
  const lista = lerDadosDeNpc(formula);
  // Passo de situação (alvo caído, ocultação) anda no primeiro dado da ficha.
  const componentes = lista.map((dado, i) => ({
    chave: `npc.${i}`, rotulo: npc.name, tipo: "extra", dado: i === 0 && passos ? stepDie(dado, passos) : dado,
  }));
  return rolarTeste(npc, {
    componentes, dt: oposto ? null : dt, oposto, semDT: oposto, contexto: contexto ?? npc.name,
    chavePericia: "luta", chaveAtributo: atributo, rapido: true,
  });
}
