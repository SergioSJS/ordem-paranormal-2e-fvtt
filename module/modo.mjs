/**
 * Modo de jogo do mundo: `moderno` (playtest alpha) ou `vigilia` (playtest beta).
 *
 * Os dois vivem em paralelo. A ficha guarda as perícias de ambos, e o modo só decide o
 * que as telas mostram: trocar de modo não perde dado. Quem precisa da regra pura usa
 * `periciasDoModo` e companhia, de `config.mjs`, passando o modo.
 */
import { SYSTEM_ID, MODOS, MODO_PADRAO } from "./config.mjs";

/**
 * Troca o modo do mundo e recarrega a mesa inteira, o que o core só faz sozinho quando a
 * troca vem do formulário de configurações (`requiresReload`).
 */
export async function trocarModo(modo) {
  await game.settings.set(SYSTEM_ID, "modo", modo);
  game.socket.emit("reload");
  foundry.utils.debouncedReload();
}

/**
 * As regras de combate e de dano do beta valem aqui? Sempre no Vigília; no moderno, por
 * opção do mundo, ligada por padrão (docs/regras/alpha-para-beta.md).
 */
export function usaCombateNovo() {
  if (modoAtual() === "vigilia") return true;
  try {
    return game.settings.get(SYSTEM_ID, "combateNovoModerno") === true;
  } catch {
    return false;
  }
}

/** O modo deste mundo. Antes de o setting existir (carga, testes), vale o padrão. */
export function modoAtual() {
  try {
    const modo = game.settings.get(SYSTEM_ID, "modo");
    return MODOS.includes(modo) ? modo : MODO_PADRAO;
  } catch {
    return MODO_PADRAO;
  }
}

/**
 * Põe o modo no <body> (`op2-vigilia`): o tema do beta (styles/parciais/_vigilia.scss)
 * segue o modo do mundo, e a troca de modo recarrega a página, então basta marcar uma vez.
 */
export function marcarModoNaTela(modo = modoAtual()) {
  const corpo = globalThis.document?.body;
  if (!corpo) return;
  corpo.classList.toggle("op2-vigilia", modo === "vigilia");
  corpo.dataset.op2Modo = modo;
}
