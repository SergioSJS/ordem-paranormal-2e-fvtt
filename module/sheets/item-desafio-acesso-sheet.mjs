/** Ficha do desafio de acesso — o objeto que Arrombar tenta vencer (spec §7.2). */
import { OP2ItemSheet } from "./item-sheet.mjs";

export class DesafioAcessoSheet extends OP2ItemSheet {
  async _prepareContext(opcoes) {
    const contexto = await super._prepareContext(opcoes);
    const { pontuacaoAtual, pontuacaoAlvo } = this.item.system;

    return {
      ...contexto,
      percentualProgresso: Math.min(100, Math.round((pontuacaoAtual / pontuacaoAlvo) * 100)),
    };
  }
}
