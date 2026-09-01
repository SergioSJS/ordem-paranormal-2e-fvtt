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
    },
  };

  static TABS = {
    principal: {
      tabs: [{ id: "investigacao" }, { id: "mestre" }],
      initial: "investigacao",
      labelPrefix: "OP2.POI.Aba",
    },
  };

  async _prepareContext(opcoes) {
    const contexto = await super._prepareContext(opcoes);
    const ehGM = game.user.isGM;

    return {
      ...contexto,
      ehGM,
      // A aba do mestre some para jogadores — nem o rótulo pode vazar.
      tabs: ehGM ? contexto.tabs : contexto.tabs.filter((t) => t.id !== "mestre"),
      informacoes: this.item.system.informacoes.map((info, indice) => ({ ...info, indice })),
      // Perícias válidas no quadro: as 19 comuns + cada campo de Aptidão.
      opcoesPericia: [
        ...Object.keys(PERICIAS).filter((c) => !PERICIAS[c].especializada),
        ...APTIDOES_PADRAO.map((sub) => `aptidao.${sub}`),
      ].map((c) => ({ chave: c, rotulo: rotuloDePericia(c) })),
      ferramentas: FERRAMENTAS_POI.map((chave) => ({
        chave,
        rotulo: game.i18n.localize(`OP2.POI.Ferramenta.${chave}`),
        valor: this.item.system.ferramentas[chave] ?? "",
      })),
    };
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
}
