/**
 * USAR HABILIDADES E ITENS (spec §6.6).
 *
 * "Habilidades e itens podem ter efeitos em investigação... Jogadores podem propor
 * usos criativos. **O mestre decide** se cabe e qual o efeito — o padrão sugerido é
 * um aumento de passo no teste em questão."
 *
 * Ou seja: nada aqui é automático. O jogador declara o que usa e como; o card leva
 * a descrição do item para a mesa e dá ao mestre o botão de conceder o passo. O
 * passo concedido é o mesmo mecanismo pendente da Ajuda (§4.7) — entra no próximo
 * teste do personagem e some depois dele.
 */
import { SYSTEM_ID } from "../config.mjs";
import { renderizar } from "../dice/teste.mjs";
import { comoMestre } from "../ui/socket.mjs";

const TIPOS_USAVEIS = ["habilidade", "equipamento", "ferramenta"];

/** Declara o uso de uma habilidade ou item; o efeito fica com o mestre. */
export async function usarHabilidadeOuItem(ator) {
  const usaveis = ator.items.filter((i) => TIPOS_USAVEIS.includes(i.type));
  if (!usaveis.length) {
    ui.notifications.warn(game.i18n.localize("OP2.Recurso.SemItens"));
    return null;
  }

  const itemId = await escolherItem(usaveis);
  if (!itemId) return null;
  const item = ator.items.get(itemId);

  const editor = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
  const conteudo = await renderizar(`systems/${SYSTEM_ID}/templates/chat/recurso.hbs`, {
    titulo: game.i18n.localize("OP2.Recurso.Titulo"),
    texto: game.i18n.format("OP2.Recurso.Card", { ator: ator.name, item: item.name }),
    descricao: await editor.enrichHTML(item.system.descricao ?? "", { relativeTo: item }),
    atorId: ator.id,
    itemNome: item.name,
    // O padrão sugerido pela spec é +1 passo, mas quem decide é o mestre — daí o
    // botão em vez da aplicação direta.
    rotuloConceder: game.i18n.localize("OP2.Recurso.Conceder"),
  });

  await ChatMessage.create({
    content: conteudo,
    speaker: ChatMessage.getSpeaker({ actor: ator }),
    flags: { [SYSTEM_ID]: { tipo: "recurso", atorId: ator.id } },
  });

  return item;
}

/**
 * Mestre concede o passo: entra no próximo teste do personagem, pelo mesmo caminho
 * da Ajuda (spec §4.7) — um passo pendente, consumido na primeira rolagem.
 */
export async function concederPasso(ator, { passos = 1, origem }) {
  await comoMestre("registrarAjuda", {
    uuid: ator.uuid,
    ajuda: { passos, de: origem, pericia: "" },
  });
  ui.notifications.info(game.i18n.format("OP2.Recurso.Concedido", { ator: ator.name, passos }));
}

function escolherItem(itens) {
  const opcoes = itens
    .map((i) => `<option value="${i.id}">${foundry.utils.escapeHTML(i.name)}</option>`).join("");
  return foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("OP2.Recurso.Titulo") },
    content: `
      <div class="form-group">
        <label>${game.i18n.localize("OP2.Recurso.Escolha")}</label>
        <select name="item">${opcoes}</select>
      </div>
      <p class="notes">${game.i18n.localize("OP2.Recurso.Ajuda")}</p>`,
    ok: { callback: (_evento, botao) => botao.form.elements.item.value },
    rejectClose: false,
  });
}
