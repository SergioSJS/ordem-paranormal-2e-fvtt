/**
 * Ficha do Ponto de Interesse — ferramenta do mestre (spec §6.2).
 *
 * O quadro de informações, a descrição contextual e o setor de ferramentas são
 * só do mestre: o jogador nunca vê DT, reação de ferramenta nem a explicação
 * do POI. A revelação acontece pelas ações de investigação, não pela ficha.
 */
import { PERICIAS, APTIDOES_PADRAO, FERRAMENTAS_POI } from "../config.mjs";
import { OP2ItemSheet } from "./item-sheet.mjs";
import { rotuloDePericia } from "../dice/teste.mjs";

export class PontoInteresseSheet extends OP2ItemSheet {
  static DEFAULT_OPTIONS = {
    classes: ["op2-ficha--poi"],
    position: { width: 560, height: "auto" },
    actions: {
      adicionarInformacao: PontoInteresseSheet.#adicionarInformacao,
      removerInformacao: PontoInteresseSheet.#removerInformacao,
      removerFerramenta: PontoInteresseSheet.#removerFerramenta,
    },
  };

  static TABS = {
    principal: {
      tabs: [{ id: "investigacao" }, { id: "mestre" }],
      initial: "investigacao",
      labelPrefix: "OP2.POI.Aba",
    },
  };

  /**
   * Ferramentas recém-adicionadas ainda sem texto. O core limpa "" e " " para vazio,
   * então a linha nova vive aqui até o mestre escrever a reação — nada suja os dados.
   */
  #ferramentasNovas = new Set();

  async _prepareContext(opcoes) {
    const contexto = await super._prepareContext(opcoes);
    const ehGM = game.user.isGM;
    const editor = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    const enriquecer = (html) => editor.enrichHTML(html ?? "", { relativeTo: this.item, secrets: this.item.isOwner });

    const ferramentas = this.item.system.ferramentas;
    const rotuloFerramenta = (chave) => game.i18n.localize(`OP2.POI.Ferramenta.${chave}`);
    // O texto salvou: não é mais "nova".
    for (const chave of [...this.#ferramentasNovas]) {
      if (ferramentas[chave]) this.#ferramentasNovas.delete(chave);
    }

    return {
      ...contexto,
      ehGM,
      // A aba do mestre some para jogadores — nem o rótulo pode vazar.
      tabs: ehGM ? contexto.tabs : contexto.tabs.filter((t) => t.id !== "mestre"),
      informacoes: this.item.system.informacoes.map((info, indice) => ({ ...info, indice })),
      descricaoBasicaEnriquecida: await enriquecer(this.item.system.descricaoBasica),
      descricaoContextualEnriquecida: await enriquecer(this.item.system.descricaoContextual),
      // Perícias válidas no quadro: as 19 comuns + cada campo de Aptidão.
      opcoesPericia: [
        ...Object.keys(PERICIAS).filter((c) => !PERICIAS[c].especializada),
        ...APTIDOES_PADRAO.map((sub) => `aptidao.${sub}`),
      ].map((c) => ({ chave: c, rotulo: rotuloDePericia(c) })),
      // Só as ferramentas com reação (ou recém-adicionadas) aparecem; as demais
      // ficam no seletor. Vazio (null ou "") = leitura normal (spec §9.3).
      ferramentasConfiguradas: FERRAMENTAS_POI
        .filter((chave) => ferramentas[chave] || this.#ferramentasNovas.has(chave))
        .map((chave) => ({ chave, rotulo: rotuloFerramenta(chave), valor: ferramentas[chave] || "" })),
      ferramentasDisponiveis: FERRAMENTAS_POI
        .filter((chave) => !ferramentas[chave] && !this.#ferramentasNovas.has(chave))
        .map((chave) => ({ chave, rotulo: rotuloFerramenta(chave) })),
    };
  }

  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    if (!game.user.isGM || !this.isEditable) return;
    // Adicionar uma ferramenta abre a linha vazia; o texto salva sozinho na edição.
    const seletor = this.element.querySelector("[data-seletor-ferramenta]");
    seletor?.addEventListener("change", () => {
      if (!seletor.value) return;
      this.#ferramentasNovas.add(seletor.value);
      this.render();
    });
  }

  static async #adicionarInformacao() {
    const informacoes = this.item.system.informacoes.map((i) => ({ ...i }));
    informacoes.push({ id: foundry.utils.randomID(), pericia: "percepcao", dt: 7, texto: "" });
    await this.item.update({ "system.informacoes": informacoes });
  }

  static async #removerInformacao(_evento, alvo) {
    const informacoes = this.item.system.informacoes
      .filter((info) => info.id !== alvo.dataset.infoId)
      .map((i) => ({ ...i }));
    await this.item.update({ "system.informacoes": informacoes });
  }

  static async #removerFerramenta(_evento, alvo) {
    this.#ferramentasNovas.delete(alvo.dataset.ferramenta);
    await this.item.update({ [`system.ferramentas.${alvo.dataset.ferramenta}`]: null });
  }
}
