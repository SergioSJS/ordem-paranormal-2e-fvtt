/**
 * Combate simplificado (spec §8.1) — orquestração.
 *
 * Dois passos, porque é teste oposto: o atacante rola Luta e o card fica esperando
 * o defensor escolher entre revidar (Luta) ou esquivar (Acrobacia +d6). Só depois
 * das duas rolagens o sistema compara e oferece o dano — que, como todo efeito no
 * sistema, precisa de um clique.
 *
 * O playtest marca este módulo como temporário (§8): o combate completo vem depois.
 */
import { SYSTEM_ID } from "../config.mjs";
import { rolarTeste, renderizar } from "../dice/teste.mjs";
import { vencedorDoOposto, resolverAtaque } from "./combate.mjs";
import { alvosDaCenaAtiva, alvosMarcados } from "./encerrar-investigacao.mjs";

/** Rola o ataque e publica o card que espera a resposta do defensor. */
export async function atacar(ator, { alvoUuid, armado, rapido = false } = {}) {
  const alvo = alvoUuid ? await fromUuid(alvoUuid) : await escolherAlvo(ator);
  if (!alvo) return null;

  const usaArma = armado ?? await perguntarSeArmado(game.i18n.localize("OP2.Combate.Atacar"));
  if (usaArma === null) return null;

  const roll = await rolarTeste(ator, {
    chavePericia: "luta",
    oposto: true,
    rapido,
    contexto: game.i18n.format("OP2.Combate.AtaqueContexto", { alvo: alvo.name }),
  });
  if (!roll) return null;

  const conteudo = await renderizar(`systems/${SYSTEM_ID}/templates/chat/ataque.hbs`, {
    titulo: game.i18n.localize("OP2.Combate.Atacar"),
    texto: game.i18n.format("OP2.Combate.Ataque", {
      atacante: ator.name, alvo: alvo.name, total: roll.total,
    }),
    atacanteId: ator.id,
    alvoId: alvo.id,
    total: roll.total,
    ra: roll.ra,
    rb: roll.rb,
    armado: usaArma,
    // O defensor escolhe: revidar (troca de golpes) ou só se defender (esquiva).
    dicaEsquiva: game.i18n.localize("OP2.Combate.EsquivaDica"),
  });

  await ChatMessage.create({
    content: conteudo,
    speaker: ChatMessage.getSpeaker({ actor: ator }),
    flags: { [SYSTEM_ID]: { tipo: "ataque", atorId: ator.id } },
  });

  return roll;
}

/**
 * Resposta do defensor. `esquiva` troca Luta por Acrobacia e soma um d6 — a única
 * exceção aditiva do playtest (spec §8.1) — e abre mão de causar dano.
 */
export async function defender(defensor, { atacanteId, totalAtaque, raAtaque, rbAtaque, armadoAtacante, esquiva, rapido = false }) {
  const atacante = game.actors.get(atacanteId);
  if (!atacante) return null;

  const armadoDefensor = esquiva
    ? false
    : await perguntarSeArmado(game.i18n.localize("OP2.Combate.Defender"));
  if (armadoDefensor === null) return null;

  const roll = await rolarTeste(defensor, {
    chavePericia: esquiva ? "acrobacia" : "luta",
    oposto: true,
    rapido,
    // O +d6 da esquiva é somado, não é passo (spec §8.1).
    dadosExtras: esquiva
      ? [{ chave: "esquiva", rotulo: game.i18n.localize("OP2.Combate.Esquivar"), tipo: "extra", dado: "d6" }]
      : [],
    contexto: game.i18n.format("OP2.Combate.DefesaContexto", { atacante: atacante.name }),
  });
  if (!roll) return null;

  const vencedor = vencedorDoOposto(totalAtaque, roll.total);
  const { dano, alvo } = resolverAtaque({
    vencedor,
    esquiva,
    leituraAtacante: { ra: raAtaque, rb: rbAtaque },
    leituraDefensor: { ra: roll.ra, rb: roll.rb },
    armadoAtacante,
    armadoDefensor,
  });

  const quemSofre = alvo === "defensor" ? defensor : (alvo === "atacante" ? atacante : null);
  const conteudo = await renderizar(`systems/${SYSTEM_ID}/templates/chat/ataque-resultado.hbs`, {
    titulo: game.i18n.localize("OP2.Combate.Resultado"),
    totalAtaque,
    totalDefesa: roll.total,
    esquiva,
    texto: textoDoDesfecho({ vencedor, esquiva, atacante, defensor, dano }),
    temDano: dano > 0 && Boolean(quemSofre),
    dano,
    quemSofreId: quemSofre?.id ?? "",
    quemSofreNome: quemSofre?.name ?? "",
  });

  await ChatMessage.create({
    content: conteudo,
    speaker: ChatMessage.getSpeaker({ actor: defensor }),
    flags: { [SYSTEM_ID]: { tipo: "ataque-resultado", atorId: defensor.id } },
  });

  return { roll, vencedor, dano, alvo };
}

function textoDoDesfecho({ vencedor, esquiva, atacante, defensor, dano }) {
  if (vencedor === "empate") return game.i18n.localize("OP2.Combate.Empate");
  if (esquiva && vencedor === "defensor") {
    return game.i18n.format("OP2.Combate.EsquivouTexto", { defensor: defensor.name });
  }
  const vence = vencedor === "atacante" ? atacante : defensor;
  const perde = vencedor === "atacante" ? defensor : atacante;
  return game.i18n.format("OP2.Combate.Venceu", { vencedor: vence.name, perdedor: perde.name, dano });
}

/**
 * Quem apanha. A mira do Foundry manda: marcou um token, é nele — sem lista, sem
 * exigir que esteja na investigação. Sem marcação, oferece quem está em cena.
 */
async function escolherAlvo(ator) {
  const marcados = alvosMarcados({ exceto: ator });
  if (marcados.length === 1) return marcados[0];

  const candidatos = marcados.length > 1 ? marcados : alvosDaCenaAtiva({ exceto: ator, comNpcs: true });
  if (!candidatos.length) {
    ui.notifications.warn(game.i18n.localize("OP2.Combate.SemAlvos"));
    return null;
  }
  const opcoes = candidatos
    .map((a) => `<option value="${a.uuid}">${foundry.utils.escapeHTML(a.name)}</option>`).join("");
  const uuid = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("OP2.Combate.Atacar") },
    content: `
      <div class="form-group">
        <label>${game.i18n.localize("OP2.Combate.Alvo")}</label>
        <select name="alvo">${opcoes}</select>
      </div>`,
    ok: { callback: (_evento, botao) => botao.form.elements.alvo.value },
    rejectClose: false,
  });
  return uuid ? fromUuid(uuid) : null;
}

/**
 * Arma na mão decide entre RA e RB (spec §8.1). É pergunta, não leitura do
 * inventário: o playtest não define "empunhando", e a mesa resolve isso narrando.
 */
async function perguntarSeArmado(titulo) {
  const resposta = await foundry.applications.api.DialogV2.wait({
    window: { title: titulo },
    content: `<p>${game.i18n.localize("OP2.Combate.ArmadoPergunta")}</p>`,
    buttons: [
      { action: "sim", label: "OP2.Combate.Armado", icon: "fa-solid fa-khanda" },
      { action: "nao", label: "OP2.Combate.Desarmado", icon: "fa-solid fa-hand-fist" },
    ],
    rejectClose: false,
  });
  if (!resposta) return null;
  return resposta === "sim";
}
