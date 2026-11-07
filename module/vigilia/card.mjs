/** Um card só para o beta: título, texto, lista e botões, sem um template por ação. */
import { SYSTEM_ID } from "../config.mjs";
import { renderizar } from "../dice/teste.mjs";

const escapar = (v) => foundry.utils.escapeHTML(String(v));

/** `{atorUuid: "x", dt: 7}` → `data-ator-uuid="x" data-dt="7"`. */
function atributosDe(dados = {}) {
  return Object.entries(dados)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `data-${k.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`)}="${escapar(v)}"`)
    .join(" ");
}

/**
 * @param {Actor|null} ator
 * @param {object} card
 * @param {string} card.titulo
 * @param {string} [card.texto] HTML do sistema: quem escreve escapa o que veio de fora
 * @param {string[]} [card.linhas]
 * @param {Array<{rotulo: string, acao: string, soMestre?: boolean, perigo?: boolean, dados?: object}>} [card.botoes]
 * @param {string} [card.selo]
 * @param {string} [card.estilo]
 * @param {string[]} [card.whisper]
 */
export async function cardVigilia(ator, { titulo, texto, linhas = [], botoes = [], selo, estilo, whisper, rolls } = {}) {
  const content = await renderizar(`systems/${SYSTEM_ID}/templates/vigilia/card.hbs`, {
    titulo, texto, linhas, selo, estilo,
    botoes: botoes.map((b) => ({ ...b, atributos: atributosDe(b.dados) })),
  });
  return ChatMessage.create({
    content,
    speaker: ator ? ChatMessage.getSpeaker({ actor: ator }) : ChatMessage.getSpeaker(),
    ...(whisper ? { whisper } : {}),
    ...(rolls ? { rolls } : {}),
    flags: { [SYSTEM_ID]: { tipo: "vigilia" } },
  });
}

/** Dono e mestres: o que só interessa a quem joga com o personagem. */
export const donosDe = (ator) => game.users.filter((u) => u.isGM || ator.testUserPermission(u, "OWNER")).map((u) => u.id);
