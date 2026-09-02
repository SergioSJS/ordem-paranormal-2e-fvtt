/**
 * AJUDAR (spec §4.7): gasta uma ação para dar passos no teste de um aliado.
 *
 * O passo fica pendurado no aliado (`estado.ajuda`) e é consumido pelo próximo
 * teste dele — não é um efeito com duração, é "alguém segurou a lanterna pra
 * você nesta rolagem". Em qual dado o passo entra (perícia ou atributo) a spec
 * não fecha; o setting `ajudaAlvo` decide, com a perícia como padrão, que é a
 * leitura mais natural do texto.
 */
import { SYSTEM_ID } from "../config.mjs";
import { escolherPericia } from "../dice/pericia-dialog.mjs";
import { rotuloDePericia, renderizar } from "../dice/teste.mjs";
import { lerConfig } from "../settings/register.mjs";
import { alvosDaCenaAtiva, alvosMarcados } from "./encerrar-investigacao.mjs";
import { passosDeAjuda, podeAjudar } from "./ajuda.mjs";
import { comoMestre, registrarAcaoDeMestre } from "../ui/socket.mjs";

/**
 * Escolhe o aliado e a perícia com que se ajuda, valida o mínimo d6 e registra os
 * passos no aliado.
 */
export async function ajudar(ator) {
  // Marcou alguém no mapa? É ele. Ajuda é entre personagens.
  const marcados = alvosMarcados({ exceto: ator, tipos: ["personagem"] });
  const aliados = marcados.length ? marcados : alvosDaCenaAtiva({ exceto: ator });
  if (!aliados.length) {
    ui.notifications.warn(game.i18n.localize("OP2.Ajuda.SemAliados"));
    return null;
  }

  const alvoId = aliados.length === 1 ? aliados[0].id : await escolherAliado(aliados);
  if (!alvoId) return null;

  const chavePericia = await escolherPericia(ator, {
    titulo: game.i18n.localize("OP2.Ajuda.Titulo"),
    ajuda: game.i18n.localize("OP2.Ajuda.EscolhaAjuda"),
  });
  if (!chavePericia) return null;

  const resolvido = ator.system.resolverChave(chavePericia);
  if (!podeAjudar(resolvido?.dado)) {
    ui.notifications.warn(game.i18n.format("OP2.Ajuda.DadoPequeno", {
      pericia: rotuloDePericia(chavePericia),
      dado: resolvido?.dado ?? "d4",
    }));
    return null;
  }

  const passos = passosDeAjuda(resolvido.dado);
  const alvo = aliados.find((a) => a.id === alvoId);

  // O aliado costuma ser de outro jogador, que não tem permissão de escrever na
  // ficha dele — a ponte grava pelo mestre, como no desafio e no POI.
  await comoMestre("registrarAjuda", {
    uuid: alvo.uuid,
    ajuda: { passos, de: ator.name, pericia: rotuloDePericia(chavePericia) },
  });

  const conteudo = await renderizar(`systems/${SYSTEM_ID}/templates/chat/ajuda.hbs`, {
    titulo: game.i18n.localize("OP2.Ajuda.Titulo"),
    texto: game.i18n.format("OP2.Ajuda.Card", {
      ajudante: ator.name,
      alvo: alvo.name,
      pericia: rotuloDePericia(chavePericia),
      dado: resolvido.dado,
      passos,
    }),
    alvoDoPasso: game.i18n.localize(`OP2.Config.ajudaAlvo.${lerConfig("ajudaAlvo")}`),
  });
  await ChatMessage.create({
    content: conteudo,
    speaker: ChatMessage.getSpeaker({ actor: ator }),
    flags: { [SYSTEM_ID]: { tipo: "ajuda", atorId: ator.id } },
  });

  return { alvo, passos };
}

registrarAcaoDeMestre("registrarAjuda", async ({ uuid, ajuda }) => {
  const ator = await fromUuid(uuid);
  if (ator?.type === "personagem") await ator.update({ "system.estado.ajuda": ajuda });
});

/** Limpa a ajuda pendente — o teste que a consumiu já rolou. */
export async function consumirAjuda(ator) {
  if (!ator.system.estado?.ajuda?.passos) return;
  await comoMestre("registrarAjuda", { uuid: ator.uuid, ajuda: { passos: 0, de: "", pericia: "" } });
}

function escolherAliado(aliados) {
  const opcoes = aliados
    .map((a) => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`)
    .join("");
  return foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("OP2.Ajuda.Titulo") },
    content: `
      <div class="form-group">
        <label>${game.i18n.localize("OP2.Ajuda.Aliado")}</label>
        <select name="alvo">${opcoes}</select>
      </div>`,
    ok: { callback: (_evento, botao) => botao.form.elements.alvo.value },
    rejectClose: false,
  });
}
