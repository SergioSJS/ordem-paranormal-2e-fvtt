/** Ficha de item. Uma classe, um template por tipo. */
import { ESCADA, ATRIBUTOS, PERICIAS } from "../config.mjs";
import { ORIGENS_HABILIDADE, EFEITOS_HABILIDADE } from "../data/item-habilidade.mjs";
import { iconeDado } from "../ui/dice-icons.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class OP2ItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["op2", "op2-ficha", "op2-ficha--item"],
    position: { width: 520, height: "auto" },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: { escolherDado: OP2ItemSheet.#escolherDado, abrirSeletor: OP2ItemSheet.#abrirSeletor },
  };

  /** O template segue o tipo do item. */
  static PARTS = {
    corpo: { template: "systems/ordem-paranormal-2e/templates/item/item.hbs" },
  };

  _configureRenderParts(opcoes) {
    const partes = super._configureRenderParts(opcoes);
    partes.corpo.template = `systems/ordem-paranormal-2e/templates/item/${this.item.type}.hbs`;
    return partes;
  }

  async _prepareContext(opcoes) {
    const contexto = await super._prepareContext(opcoes);
    const editor = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;

    return {
      ...contexto,
      item: this.item,
      sistema: this.item.system,
      // `fields` alimenta o {{formInput}}; sem ele o editor de texto rico não sobe.
      fields: this.item.system.schema.fields,
      editavel: this.isEditable,
      escada: ESCADA.map((dado) => ({ dado, icone: iconeDado(dado) })),
      origens: ORIGENS_HABILIDADE.map((v) => ({ v, rotulo: game.i18n.localize(`OP2.Habilidade.Origem.${v}`) })),
      efeitos: EFEITOS_HABILIDADE.map((v) => ({ v, rotulo: game.i18n.localize(`OP2.Habilidade.Efeito.${v}`) })),
      chaves: [
        ...Object.keys(ATRIBUTOS).map((c) => ({ c, rotulo: game.i18n.localize(`OP2.Atributo.${c}`), grupo: "atributo" })),
        ...Object.keys(PERICIAS).map((c) => ({ c, rotulo: game.i18n.localize(`OP2.Pericia.${c}`), grupo: "pericia" })),
      ],
      descricao: await editor.enrichHTML(this.item.system.descricao ?? "", {
        relativeTo: this.item, secrets: this.item.isOwner,
      }),
    };
  }

  static async #abrirSeletor(_evento, alvo) {
    alvo.closest(".op2-controle-dado")?.classList.toggle("aberto");
  }

  static async #escolherDado(_evento, alvo) {
    alvo.closest(".op2-controle-dado")?.classList.remove("aberto");
    await this.item.update({ [alvo.dataset.caminho]: alvo.dataset.dado });
  }
}
