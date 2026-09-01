/**
 * Escolha dos dados contabilizados.
 *
 * Rola-se até 4, mas só 3 entram no resultado (spec §4.5). A escolha é manual de
 * propósito: a soma máxima nem sempre é a melhor jogada, porque RA e RB alimentam
 * efeitos posteriores — dano, pontuação de arrombamento, alcance.
 */
import { MAX_DADOS_CONTADOS } from "../config.mjs";
import { iconeResultado } from "../ui/dice-icons.mjs";
import * as analise from "./analise.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SelecaoDados extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "op2-selecao-dados",
    classes: ["op2", "op2-dialog", "op2-selecao-dados"],
    tag: "form",
    window: { title: "OP2.Dialog.Selecao.Titulo", icon: "fa-solid fa-hand-pointer", contentClasses: ["standard-form"] },
    position: { width: 420, height: "auto" },
    form: { handler: SelecaoDados.#enviar, closeOnSubmit: true },
    actions: { alternar: SelecaoDados.#alternar },
  };

  static PARTS = {
    corpo: { template: "systems/ordem-paranormal-2e/templates/dialog/selecao-dados.hbs" },
    rodape: { template: "templates/generic/form-footer.hbs" },
  };

  #resolver;

  constructor({ roll, resolver, ...opcoes } = {}) {
    super(opcoes);
    this.roll = roll;
    this.#resolver = resolver;
    this.selecionados = new Set(roll.selecaoSugerida());
  }

  /**
   * @param {import("./op2-roll.mjs").OP2Roll} roll
   * @returns {Promise<number[]>} índices escolhidos (a sugestão, se o jogador fechar)
   */
  static abrir(roll) {
    return new Promise((resolver) => new SelecaoDados({ roll, resolver }).render({ force: true }));
  }

  async _prepareContext() {
    const dados = this.roll.dados;
    const previa = dados.map((d) => ({ ...d, contado: this.selecionados.has(d.indice) }));
    const parcial = analise.analisar(previa, { dt: this.roll.dt, escopoCritico: this.roll.escopoCritico });

    return {
      dt: this.roll.dt,
      maxContados: MAX_DADOS_CONTADOS,
      completo: this.selecionados.size === MAX_DADOS_CONTADOS,
      dados: previa.map((d) => ({
        ...d,
        icone: iconeResultado({ dado: d.dado, resultado: d.resultado, contado: d.contado }),
      })),
      parcial,
      buttons: [{ type: "submit", icon: "fa-solid fa-check", label: "OP2.Dialog.Selecao.Confirmar" }],
    };
  }

  static #alternar(_evento, alvo) {
    const indice = Number(alvo.dataset.indice);
    if (this.selecionados.has(indice)) this.selecionados.delete(indice);
    else if (this.selecionados.size < MAX_DADOS_CONTADOS) this.selecionados.add(indice);
    else ui.notifications.warn(game.i18n.format("OP2.Aviso.TetoDeContados", { max: MAX_DADOS_CONTADOS }));
    this.render();
  }

  static async #enviar() {
    this.#resolver([...this.selecionados]);
    this.#resolver = null;
  }

  _onClose(opcoes) {
    super._onClose(opcoes);
    // Fechar sem escolher usa a sugestão — nunca deixa a rolagem sem resultado.
    this.#resolver?.([...this.selecionados]);
    this.#resolver = null;
  }
}
