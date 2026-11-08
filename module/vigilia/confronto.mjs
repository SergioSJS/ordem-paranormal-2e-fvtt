/**
 * Card de confronto do combate (beta §7): quem agiu em quem, o veredito grande e o dano em
 * número grande, com os dados de cada lado dentro do próprio card. Antes eram dois cards
 * por ataque (a rolagem genérica, com "Dano RA/RB" que não sabia o alvo, e uma frase com o
 * resultado), e a mesa não lia quem tinha acertado quem.
 *
 * A rolagem vai na mensagem (`rolls`): os efeitos de mesa, a transmissão e o Dice So Nice
 * leem dela. Os dados 3D já rolaram antes do card (`rolarTeste` com `semCard`), então a
 * mensagem pede ao Dice So Nice para não rolar de novo.
 */
import { SYSTEM_ID } from "../config.mjs";
import { renderizar } from "../dice/teste.mjs";

const escapar = (v) => foundry.utils.escapeHTML(String(v ?? ""));

/** `{atorUuid: "x", dt: 7}` → `data-ator-uuid="x" data-dt="7"`. */
function atributosDe(dados = {}) {
  return Object.entries(dados)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `data-${k.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`)}="${escapar(v)}"`)
    .join(" ");
}

/** Um lado do confronto: retrato, nome e, se rolou, os dados e o total. */
export function lado(ator, roll = null, { venceu = false } = {}) {
  return {
    nome: ator?.name ?? "",
    img: ator?.img ?? "icons/svg/mystery-man.svg",
    venceu,
    total: roll?.total ?? null,
    dados: roll?.dados ?? [],
    modificador: roll?.options?.modificador ?? 0,
  };
}

/** Um golpe que entra: o número grande e "de dano em Fulano". */
export const golpe = (dano, alvo) => ({
  dano,
  texto: game.i18n.format("OP2.Confronto.DanoEm", { alvo: escapar(alvo?.name) }),
});

/** O veredito do teste de quem age: crítico e falha crítica ganham do resto. */
export function vereditoDoTeste(roll, { acertou, rotuloAcerto = "Acertou", rotuloErro = "Errou" } = {}) {
  const r = roll?.resultado ?? {};
  if (r.critico && acertou) return { classe: "critico", rotulo: game.i18n.localize("OP2.Confronto.Critico") };
  if (r.falhaCritica) return { classe: "falha-critica", rotulo: game.i18n.localize("OP2.Confronto.FalhaCritica") };
  return acertou
    ? { classe: "acerto", rotulo: game.i18n.localize(`OP2.Confronto.${rotuloAcerto}`) }
    : { classe: "erro", rotulo: game.i18n.localize(`OP2.Confronto.${rotuloErro}`) };
}

/**
 * Publica o card.
 * @param {Actor} ator quem fala (o card sai em nome dele)
 * @param {object} card
 * @param {string} card.titulo
 * @param {string} [card.selo] o canto direito do topo (DT, "oposto")
 * @param {object} card.esquerda `lado()` de quem age
 * @param {object} card.direita `lado()` de quem recebe
 * @param {object} card.veredito `{classe, rotulo}`
 * @param {Array<{dano:number, texto:string}>} [card.golpes]
 * @param {string[]} [card.linhas] HTML do sistema
 * @param {Array} [card.botoes] como no `cardVigilia`
 * @param {boolean} [card.distancia] a seta vira flecha
 * @param {OP2Roll[]} [card.rolls]
 */
export async function cardConfronto(ator, {
  titulo, selo, esquerda, direita, veredito, golpes = [], linhas = [], botoes = [], distancia = false, rolls = [],
} = {}) {
  const r = rolls[0]?.resultado ?? {};
  const estilo = { critico: "sucesso", acerto: "sucesso", "falha-critica": "falha", erro: "falha" }[veredito.classe] ?? "investigacao";
  const danoTexto = golpes.map((g) => `${g.dano} ${new DOMParser().parseFromString(g.texto, "text/html").body.textContent}`);
  const content = await renderizar(`systems/${SYSTEM_ID}/templates/vigilia/confronto.hbs`, {
    titulo, selo, esquerda, direita, veredito, golpes, linhas, estilo,
    icone: distancia ? "fa-bow-arrow" : "fa-swords",
    falhaCritica: Boolean(r.falhaCritica),
    atorId: ator?.id,
    // A legenda do palco: o que se lê da figura que deu o passo à frente.
    legenda: [veredito.rotulo, ...danoTexto].join(" · "),
    botoes: botoes.map((b) => ({ ...b, atributos: atributosDe(b.dados) })),
  });
  return ChatMessage.create({
    content,
    speaker: ator ? ChatMessage.getSpeaker({ actor: ator }) : ChatMessage.getSpeaker(),
    ...(rolls.length ? { rolls } : {}),
    flags: {
      [SYSTEM_ID]: { tipo: "vigilia" },
      ...(rolls.length ? { "dice-so-nice": { skip: true } } : {}),
    },
  });
}
