/**
 * Atalhos de teclado do sistema. `I` abre e fecha o painel de investigação, como o
 * `C` do core faz com a ficha; `Shift+I`, a janela de ações do personagem. O core
 * não usa o I em nenhuma versão (v13 e v14 ligam C, A, Z, X, W, V, U, T, S, R, Q, F,
 * E, D), e o jogador troca as teclas em Configurar controles. Com o foco num campo
 * de texto o `KeyboardManager` do core nem chama isto: I continua sendo letra.
 */
import { SYSTEM_ID } from "../config.mjs";
import { alternarPainelInvestigacao } from "../cena/painel-investigacao.mjs";
import { alternarAcoesInvestigacao } from "../cena/acoes-app.mjs";

/** Chamar no `init`: o core só aceita registro de atalho antes do `ready`. */
export function registrarAtalhos() {
  game.keybindings.register(SYSTEM_ID, "painel", {
    name: "OP2.Atalhos.Painel",
    hint: "OP2.Atalhos.PainelDica",
    editable: [{ key: "KeyI" }],
    onDown: () => {
      alternarPainelInvestigacao();
      return true;
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
  });
  game.keybindings.register(SYSTEM_ID, "acoes", {
    name: "OP2.Atalhos.Acoes",
    hint: "OP2.Atalhos.AcoesDica",
    editable: [{ key: "KeyI", modifiers: ["Shift"] }],
    onDown: () => {
      alternarAcoesInvestigacao();
      return true;
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
  });
}
