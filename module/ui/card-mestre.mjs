/**
 * Card que só o mestre vê.
 *
 * Um sussurro criado no cliente do jogador tem o jogador como autor, e o Foundry
 * mostra toda mensagem ao próprio autor, esteja ele ou não na lista de sussurro —
 * o "só o mestre vê" do Interagir aparecia inteiro na tela do jogador (achado em
 * uso real). Bastidor (descrição contextual, perguntas e respostas do hack social,
 * botões de mestre) nunca pode nascer no cliente do jogador: o card é criado no
 * cliente do mestre pela ponte de socket, com ele como autor.
 *
 * Sem mestre online a ponte avisa e o card não sai — o público (sem segredo) já
 * saiu pelo caminho normal.
 */
import { SYSTEM_ID } from "../config.mjs";
import { renderizar } from "../dice/teste.mjs";
import { comoMestre, registrarAcaoDeMestre } from "./socket.mjs";

const CHAT = `systems/${SYSTEM_ID}/templates/chat`;

registrarAcaoDeMestre("cardDoMestre", async ({ atorId, template, contexto, tipo }) => {
  const ator = atorId ? game.actors.get(atorId) : null;
  const conteudo = await renderizar(`${CHAT}/${template}.hbs`, contexto);
  await ChatMessage.create({
    speaker: ator ? ChatMessage.getSpeaker({ actor: ator }) : ChatMessage.getSpeaker(),
    content: conteudo,
    whisper: game.users.filter((u) => u.isGM).map((u) => u.id),
    flags: { [SYSTEM_ID]: { tipo, atorId: atorId ?? "", soMestre: true } },
  });
});

/**
 * @param {Actor|null} ator          quem age (vira o speaker do card)
 * @param {string} template          nome do template em `templates/chat/`
 * @param {object} contexto          contexto do template — só o que serializa em JSON
 * @param {{ tipo?: string }} [opcoes]
 */
export function enviarCardAoMestre(ator, template, contexto, { tipo = "investigacao" } = {}) {
  return comoMestre("cardDoMestre", { atorId: ator?.id ?? null, template, contexto, tipo });
}
