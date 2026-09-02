/**
 * Ajuda (spec §4.7) — regra pura, sem Foundry.
 *
 * Custa uma ação, exige perícia coerente com a ajuda e valor mínimo d6: com d4 não
 * dá para ajudar. d6/d8 valem +1 passo; d10/d12 valem +2. Se a coerência da perícia
 * com a situação é julgamento de mesa, o tamanho do dado não é — é isto aqui.
 */
import { PASSOS_DE_AJUDA } from "../config.mjs";

/** @returns {number} passos que este dado concede; 0 significa "não pode ajudar". */
export function passosDeAjuda(dado) {
  return PASSOS_DE_AJUDA[dado] ?? 0;
}

/** d4 não ajuda (spec §4.7). */
export function podeAjudar(dado) {
  return passosDeAjuda(dado) > 0;
}
