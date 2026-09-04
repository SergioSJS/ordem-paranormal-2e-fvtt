/**
 * Ficha do evento: o gatilho, a descrição e o roteiro rodada a rodada — contado a
 * partir do gatilho. Disparar é ato de mesa e mora no painel; aqui o mestre monta.
 */
import { OP2ItemSheet } from "./item-sheet.mjs";
import { rodadaRelativa } from "../cena/eventos.mjs";
import { rodadaAtual } from "../cena/rodada.mjs";
import { textoPlano, htmlDeTexto } from "../cena/texto.mjs";

export class EventoSheet extends OP2ItemSheet {
  static DEFAULT_OPTIONS = {
    classes: ["op2-ficha--evento"],
    position: { width: 560, height: 700 },
    actions: {
      adicionarRodada: EventoSheet.#adicionarRodada,
      removerRodada: EventoSheet.#removerRodada,
    },
  };

  async _prepareContext(opcoes) {
    const contexto = await super._prepareContext(opcoes);
    const sistema = this.item.system;
    const editor = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    const cena = rodadaAtual();
    const relativa = rodadaRelativa(sistema, cena);

    return {
      ...contexto,
      sistema,
      fields: sistema.schema.fields,
      gatilhoEnriquecido: await editor.enrichHTML(sistema.gatilho ?? "", { relativeTo: this.item }),
      descricaoEnriquecida: await editor.enrichHTML(sistema.descricao ?? "", { relativeTo: this.item }),
      // O roteiro se edita como texto: os parágrafos viram linhas em branco e voltam a
      // ser <p> ao gravar — sem um editor rico por linha.
      rodadas: sistema.rodadas.map((linha, indice) => ({
        indice,
        rodada: linha.rodada,
        narracao: textoPlano(linha.narracao),
        efeito: textoPlano(linha.efeito),
        // Em que rodada da cena esta linha cai, se o evento já foi disparado.
        naCena: sistema.disparado && sistema.rodadaInicial >= 0 ? sistema.rodadaInicial + linha.rodada : null,
        agora: relativa === linha.rodada,
      })),
      estado: sistema.disparado
        ? game.i18n.format("OP2.Evento.EstadoDisparado", { rodada: sistema.rodadaInicial, relativa: Math.max(relativa, 0) })
        : game.i18n.localize("OP2.Evento.EstadoParado"),
    };
  }

  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    if (!this.isEditable) return;
    for (const campo of this.element.querySelectorAll("[data-rodada-campo]")) {
      campo.addEventListener("change", () => this.#gravarRodadas());
    }
  }

  async #gravarRodadas() {
    const rodadas = [...this.element.querySelectorAll("[data-rodada-linha]")]
      .map((linha) => ({
        rodada: Number(linha.querySelector("[data-rodada-campo='rodada']")?.value ?? 0),
        narracao: htmlDeTexto(linha.querySelector("[data-rodada-campo='narracao']")?.value ?? ""),
        efeito: htmlDeTexto(linha.querySelector("[data-rodada-campo='efeito']")?.value ?? ""),
      }))
      .sort((a, b) => a.rodada - b.rodada);
    await this.item.update({ "system.rodadas": rodadas });
  }

  static async #adicionarRodada() {
    const rodadas = this.item.system.rodadas.map((r) => ({ ...r }));
    const ultima = rodadas.length ? Math.max(...rodadas.map((r) => r.rodada)) : -1;
    await this.item.update({ "system.rodadas": [...rodadas, { rodada: ultima + 1, narracao: "", efeito: "" }] });
  }

  static async #removerRodada(_evento, alvo) {
    const rodadas = this.item.system.rodadas.filter((_r, i) => i !== Number(alvo.dataset.indice));
    await this.item.update({ "system.rodadas": rodadas });
  }
}
