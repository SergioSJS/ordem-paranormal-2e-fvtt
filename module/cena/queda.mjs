/**
 * Ferimentos e traumas — as regras puras (spec §8.2/§8.3), sem Foundry, para dar
 * pra testar offline. A orquestração (cards, rolagem, contadores) mora em
 * `acoes`/`ferimentos.mjs`, mesmo par de `desafios.mjs` e `acoes-desafio.mjs`.
 */
import { DT_FERIMENTO_BASE, DT_FERIMENTO_INCREMENTO } from "../config.mjs";

/**
 * DT do próximo teste: 7 + 3 por teste já realizado — 7, 10, 13, 16… (spec §8.2).
 * A escalada conta TESTES FEITOS, não falhas: quem passou hoje enfrenta uma DT
 * maior da próxima vez.
 */
export function dtDaQueda(testesJaFeitos) {
  return DT_FERIMENTO_BASE + DT_FERIMENTO_INCREMENTO * testesJaFeitos;
}

/**
 * O teste é devido sempre que o dano deixa o recurso em 0 — tanto ao ser reduzido
 * a 0 quanto ao "sofrer dano já estando em 0" (spec §8.2), que é o mesmo estado
 * final visto de fora. Cura e dano zero não pedem nada.
 */
export function devidoTesteDeQueda(valorDepois, danoAplicado) {
  return danoAplicado > 0 && valorDepois === 0;
}
