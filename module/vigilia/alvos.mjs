/**
 * Alvos da cena de ação. Quem tem token no mapa usa a mira do próprio Foundry (`T` sobre o
 * token, ou sobre a figura no palco): aparece no mapa e para todo mundo, como sempre. Quem
 * não tem token (a cena sem mapa, as criaturas que a cena criou na pasta) ganha uma mira
 * só desta tela, guardada aqui — o ataque lê as duas do mesmo jeito.
 *
 * Como o core: `T` troca a mira e solta as outras; `Shift+T` soma à mira que já existe.
 */
import { atorDe } from "./cena-acao.mjs";

/** Uuids mirados sem token, nesta tela. */
const semToken = new Set();

/** O token do ator no mapa aberto, se houver. Sintético (sem vínculo): o próprio; com vínculo: o primeiro. */
export function tokenDe(ator) {
  if (!ator || !globalThis.canvas?.ready) return null;
  if (ator.isToken) return ator.token?.object ?? null;
  return ator.getActiveTokens?.()[0] ?? null;
}

/** Este usuário mira o ator? */
export function ehAlvo(ator) {
  if (!ator) return false;
  const token = tokenDe(ator);
  return token ? token.isTargeted : semToken.has(ator.uuid);
}

/** Solta toda a mira deste usuário: a do Foundry e a do palco. */
function soltarTudo({ exceto } = {}) {
  for (const token of [...game.user.targets]) if (token !== exceto) token.setTarget(false, { releaseOthers: false });
  semToken.clear();
}

/** Liga ou desliga a mira no ator. `somar`: mantém os outros alvos (Shift). */
export function alternarAlvo(ator, { somar = false } = {}) {
  if (!ator) return;
  const token = tokenDe(ator);
  const ligar = !ehAlvo(ator);
  if (!somar) soltarTudo({ exceto: token });
  if (token) token.setTarget(ligar, { releaseOthers: false });
  else if (ligar) semToken.add(ator.uuid);
  else semToken.delete(ator.uuid);
  Hooks.callAll("op2AlvosMudaram");
}

/** Todos os alvos deste usuário, como atores: a mira do Foundry e a do palco. */
export function alvosMarcados() {
  const dosTokens = [...game.user.targets].map((t) => t.actor).filter(Boolean);
  const doPalco = [...semToken].map((uuid) => atorDe(uuid)).filter(Boolean);
  return [...new Map([...dosTokens, ...doPalco].map((a) => [a.uuid, a])).values()];
}
