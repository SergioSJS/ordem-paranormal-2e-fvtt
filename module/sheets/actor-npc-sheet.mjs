/** Ficha reduzida de NPC: só os atributos e as perícias que o mestre declarou. */
import { ATRIBUTOS, ESCADA } from "../config.mjs";
import { stepDie } from "../dice/escada.mjs";
import { iconeDado } from "../ui/dice-icons.mjs";
import { ligarRodaDoMouse } from "../ui/controle-dado.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class NpcSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["op2", "op2-ficha", "op2-ficha--npc"],
    position: { width: 480, height: 620 },
    window: { resizable: true, icon: "fa-solid fa-ghost" },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      escolherDado: NpcSheet.#escolherDado,
      abrirSeletor: NpcSheet.#abrirSeletor,
      adicionarPericia: NpcSheet.#adicionarPericia,
      removerPericia: NpcSheet.#removerPericia,
    },
  };

  static PARTS = {
    corpo: { template: "systems/ordem-paranormal-2e/templates/actor/npc.hbs" },
  };

  async _prepareContext(opcoes) {
    const contexto = await super._prepareContext(opcoes);
    const sistema = this.actor.system;

    return {
      ...contexto,
      actor: this.actor,
      sistema,
      // `fields` alimenta o {{formInput}}; sem ele o editor de texto rico não sobe.
      fields: this.actor.system.schema.fields,
      editavel: this.isEditable,
      escada: ESCADA.map((dado) => ({ dado, icone: iconeDado(dado) })),
      atributos: Object.keys(ATRIBUTOS).map((chave) => ({
        chave,
        rotulo: game.i18n.localize(`OP2.Atributo.${chave}`),
        icone: iconeDado(sistema.atributos[chave].die),
        caminho: `system.atributos.${chave}.die`,
      })),
      pericias: Object.entries(sistema.pericias ?? {}).map(([sub, p]) => ({
        sub,
        rotulo: p.rotulo || sub,
        icone: iconeDado(p.die),
        caminho: `system.pericias.${sub}.die`,
      })),
    };
  }

  static async #abrirSeletor(_evento, alvo) {
    alvo.closest(".op2-controle-dado")?.classList.toggle("aberto");
    // Alguns navegadores (Safari) não focam botão em clique por padrão; forçamos aqui
    // porque a roda do mouse só ajusta o dado quando o controle está focado.
    alvo.focus();
  }

  static async #escolherDado(_evento, alvo) {
    alvo.closest(".op2-controle-dado")?.classList.remove("aberto");
    await this.actor.update({ [alvo.dataset.caminho]: alvo.dataset.dado });
  }

  static async #adicionarPericia() {
    const rotulo = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("OP2.Npc.AdicionarPericia") },
      content: `<input type="text" name="rotulo" autofocus>`,
      ok: { callback: (_e, botao) => botao.form.elements.rotulo.value.trim() },
    });
    if (!rotulo) return;
    await this.actor.update({ [`system.pericias.${rotulo.slugify({ strict: true })}`]: { rotulo, die: "d6" } });
  }

  static async #removerPericia(_evento, alvo) {
    await this.actor.update({ [`system.pericias.-=${alvo.dataset.sub}`]: null });
  }

  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    if (!this.isEditable) return;
    ligarRodaDoMouse(this.element, (caminho, passos) => {
      const atual = foundry.utils.getProperty(this.actor, caminho);
      this.actor.update({ [caminho]: stepDie(atual, passos) });
    });
  }
}
