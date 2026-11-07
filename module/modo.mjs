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

/** O modo deste mundo. Antes de o setting existir (carga, testes), vale o padrão. */
export function modoAtual() {
  try {
    const modo = game.settings.get(SYSTEM_ID, "modo");
    return MODOS.includes(modo) ? modo : MODO_PADRAO;
  } catch {
    return MODO_PADRAO;
  }
}
