/**
 * Escolha de perícia — a lista da ficha, não um `<select>` cru.
 *
 * Duas razões. A primeira é visual: a ficha mostra perícia + dado como ícone, e um
 * menu nativo com 25 linhas de texto destoa de tudo (achado em uso real: "feio
 * demais um select contendo tudo"). A segunda é de jogo: a lista é SEMPRE a
 * completa, nunca só as perícias que o POI tem cadastradas — um menu filtrado
 * entrega de antemão quais perícias valem a pena ali, sem o personagem ter
 * investigado nada.
 */
import { PERICIAS } from "../config.mjs";
import { iconeDado } from "../ui/dice-icons.mjs";
import { rotuloDePericia } from "./teste.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PericiaDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "op2-pericia-dialog",
    classes: ["op2", "op2-dialog", "op2-pericia-dialog"],
    window: { title: "OP2.Dialog.Pericia.Titulo", icon: "fa-solid fa-magnifying-glass" },
    position: { width: 420, height: "auto" },
    actions: { escolher: PericiaDialog.#escolher },
  };

  static PARTS = {
    corpo: { template: "systems/ordem-paranormal-2e/templates/dialog/pericia.hbs" },
  };

  constructor(ator, { titulo, ajuda } = {}, opcoes = {}) {
    super(opcoes);
    this.ator = ator;
    this.titulo = titulo ?? null;
    this.ajuda = ajuda ?? null;
    this.escolhida = null;
    this.resolver = null;
  }

  get title() {
    return this.titulo ?? game.i18n.localize("OP2.Dialog.Pericia.Titulo");
  }

  /** @returns {Promise<string|null>} chave escolhida, ou null se fechou sem escolher */
  static abrir(ator, opcoes) {
    const app = new PericiaDialog(ator, opcoes);
    const promessa = new Promise((resolve) => { app.resolver = resolve; });
    app.render({ force: true });
    return promessa;
  }

  async _prepareContext() {
    const linha = (chave) => {
      const resolvido = this.ator.system.resolverChave(chave);
      const dado = resolvido?.dado ?? "d4";
      return { chave, rotulo: rotuloDePericia(chave), icone: iconeDado(dado), dado };
    };

    return {
      ajuda: this.ajuda,
      // A lista completa, sempre: 19 perícias + as Aptidões que ESTE personagem tem.
      pericias: Object.keys(PERICIAS).filter((chave) => !PERICIAS[chave].especializada).map(linha),
      aptidoes: Object.keys(this.ator.system.aptidoes ?? {}).map((sub) => linha(`aptidao.${sub}`)),
    };
  }

  static #escolher(_evento, alvo) {
    this.escolhida = alvo.dataset.chave;
    this.close();
  }

  _onClose(opcoes) {
    super._onClose(opcoes);
    this.resolver?.(this.escolhida);
  }
}

export function escolherPericia(ator, opcoes) {
  return PericiaDialog.abrir(ator, opcoes);
}
