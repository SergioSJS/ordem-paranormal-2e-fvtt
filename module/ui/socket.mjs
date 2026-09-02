/**
 * Ponte para o mestre executar o que o jogador não tem permissão de escrever.
 *
 * Desafio de acesso, POI e a própria Investigação são documentos de mundo: o
 * jogador não é dono de nenhum deles. Sem isto, clicar em Arrombar/Hackear rolava
 * o teste e depois estourava "User X lacks permission to update Item" na tela
 * (achado em uso real) — o teste é do personagem, mas gravar o resultado no
 * obstáculo é escrita de mundo.
 *
 * Só o GM "designado" (`game.users.activeGM`) executa: com dois mestres online,
 * os dois receberiam o pedido e a atualização aconteceria duas vezes.
 */
import { SYSTEM_ID } from "../config.mjs";

const CANAL = `system.${SYSTEM_ID}`;

/** @type {Record<string, (dados: object) => Promise<unknown>>} */
const ACOES = {};

/** Registra o que o mestre sabe executar em nome de um jogador. */
export function registrarAcaoDeMestre(nome, executar) {
  ACOES[nome] = executar;
}

export function registrarSocket() {
  game.socket.on(CANAL, async ({ acao, dados } = {}) => {
    if (game.users.activeGM?.id !== game.user.id) return;
    const executar = ACOES[acao];
    if (!executar) return void console.warn(`${SYSTEM_ID} | ação de mestre desconhecida: ${acao}`);
    await executar(dados);
  });
}

/**
 * Executa direto se quem chamou é o mestre; senão pede pro mestre fazer.
 *
 * Quem pede não recebe resposta: o efeito volta pelo próprio documento, que o
 * Foundry sincroniza sozinho (a UI re-renderiza no `updateItem`/`updateActor`).
 */
export async function comoMestre(nome, dados) {
  if (game.user.isGM) return ACOES[nome]?.(dados);
  if (!game.users.activeGM) {
    ui.notifications.warn(game.i18n.localize("OP2.Aviso.SemMestreOnline"));
    return null;
  }
  game.socket.emit(CANAL, { acao: nome, dados });
  return null;
}
