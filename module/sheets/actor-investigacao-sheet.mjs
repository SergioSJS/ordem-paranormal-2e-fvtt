/**
 * Ficha da Investigação (spec §5.1) — a outra porta para a tela comum de
 * `painel-comum.mjs` (achado em uso real: "não rola colocar essa mesma tela no
 * cadastro?"). O que muda em relação ao Painel: a investigação é o próprio
 * documento, e nome, imagem e notas se editam aqui.
 */
import { PainelInvestigacaoMixin } from "../cena/painel-comum.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class InvestigacaoSheet extends PainelInvestigacaoMixin(HandlebarsApplicationMixin(ActorSheetV2)) {
  static DEFAULT_OPTIONS = {
    // `op2-painel-investigacao` traz o CSS da tela comum (colunas, abas, rolagem).
    classes: ["op2", "op2-ficha", "op2-ficha--investigacao", "op2-painel-investigacao"],
    window: { resizable: true, icon: "fa-solid fa-folder-open" },
    form: { submitOnChange: true, closeOnSubmit: false },
  };

  static PARTS = {
    corpo: { template: "systems/ordem-paranormal-2e/templates/actor/investigacao.hbs" },
  };

  /** A investigação desta ficha é o próprio documento. */
  get investigacao() {
    return this.actor;
  }

  async _prepareContext(opcoes) {
    const contexto = await super._prepareContext(opcoes);
    const sistema = this.actor.system;
    const editor = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    return {
      ...contexto,
      ehFicha: true,
      actor: this.actor,
      sistema,
      fields: sistema.schema.fields,
      editavel: this.isEditable,
      descricao: await editor.enrichHTML(sistema.descricao ?? "", { relativeTo: this.actor }),
    };
  }
}
