/**
 * Ficha do evento: o gatilho, a descrição e o roteiro rodada a rodada — contado a
 * partir do gatilho. Disparar é ato de mesa e mora no painel; aqui o mestre monta.
 */
import { OP2ItemSheet } from "./item-sheet.mjs";
import { rodadaRelativa } from "../cena/eventos.mjs";
import { rodadaAtual } from "../cena/rodada.mjs";
import { textoPlano, htmlDeTexto } from "../cena/texto.mjs";

/** O começo da narração, para o cabeçalho da rodada recolhida. */
function resumir(texto, limite = 90) {
  const linha = texto.replace(/\s+/g, " ").trim();
  return linha.length > limite ? `${linha.slice(0, limite - 1)}…` : linha;
}

export class EventoSheet extends OP2ItemSheet {
  static DEFAULT_OPTIONS = {
    classes: ["op2", "op2-ficha--evento"],
    position: { width: 580, height: 700 },
    actions: {
      adicionarRodada: EventoSheet.#adicionarRodada,
      removerRodada: EventoSheet.#removerRodada,
      expandirRodadas: EventoSheet.#expandirRodadas,
      recolherRodadas: EventoSheet.#recolherRodadas,
    },
  };

  // A janela tem altura fixa e o roteiro cresce sem fim: sem `scrollable` a ficha
  // ficava sem barra de rolagem e as últimas rodadas eram inalcançáveis (achado em
  // uso real). O corpo é quem rola, e a posição sobrevive ao respiro de cada campo
  // gravado — a ficha rerrenderiza a cada `change`.
  static PARTS = {
    corpo: {
      template: "systems/ordem-paranormal-2e/templates/item/evento.hbs",
      scrollable: [""],
    },
  };

  /** Quais rodadas estão abertas. Preferência de tela: vive na janela, não no item. */
  #abertas = null;

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
      rodadas: sistema.rodadas.map((linha, indice) => {
        const narracao = textoPlano(linha.narracao);
        const efeito = textoPlano(linha.efeito);
        return {
          indice,
          rodada: linha.rodada,
          narracao,
          efeito,
          // Em que rodada da cena esta linha cai, se o evento já foi disparado.
          naCena: sistema.disparado && sistema.rodadaInicial >= 0 ? sistema.rodadaInicial + linha.rodada : null,
          agora: sistema.disparado && relativa === linha.rodada,
          // O começo da narração no cabeçalho: dá para ler o roteiro inteiro com tudo
          // recolhido, sem abrir uma rodada de cada vez.
          resumo: resumir(narracao) || game.i18n.localize("OP2.Evento.LinhaVazia"),
          aberta: this.#estaAberta(indice, { agora: sistema.disparado && relativa === linha.rodada, narracao }),
        };
      }),
      estado: sistema.disparado
        ? game.i18n.format("OP2.Evento.EstadoDisparado", { rodada: sistema.rodadaInicial, relativa: Math.max(relativa, 0) })
        : game.i18n.localize("OP2.Evento.EstadoParado"),
    };
  }

  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);

    // Abrir/fechar uma rodada é preferência de tela, e a ficha rerrenderiza a cada
    // campo gravado: sem guardar, tudo se fechava no meio da edição.
    for (const linha of this.element.querySelectorAll("[data-rodada-linha]")) {
      linha.addEventListener("toggle", () => {
        this.#abertas ??= new Set();
        const indice = Number(linha.dataset.indice);
        if (linha.open) this.#abertas.add(indice);
        else this.#abertas.delete(indice);
      });
    }

    if (!this.isEditable) return;
    for (const campo of this.element.querySelectorAll("[data-rodada-campo]")) {
      campo.addEventListener("change", () => this.#gravarRodadas());
    }
  }

  /**
   * Sem escolha do usuário, abre o que interessa: a rodada que cai agora e as que
   * ainda não têm texto (acabaram de ser criadas).
   */
  #estaAberta(indice, { agora, narracao }) {
    if (this.#abertas) return this.#abertas.has(indice);
    return agora || !narracao.trim();
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
    // A nova entra aberta, e o que já estava aberto continua.
    this.#abertas = new Set([...(this.#abertas ?? []), rodadas.length]);
    await this.item.update({ "system.rodadas": [...rodadas, { rodada: ultima + 1, narracao: "", efeito: "" }] });
  }

  static async #expandirRodadas() {
    this.#abertas = new Set(this.item.system.rodadas.map((_r, i) => i));
    await this.render();
  }

  static async #recolherRodadas() {
    this.#abertas = new Set();
    await this.render();
  }

  static async #removerRodada(_evento, alvo) {
    const rodadas = this.item.system.rodadas.filter((_r, i) => i !== Number(alvo.dataset.indice));
    await this.item.update({ "system.rodadas": rodadas });
  }
}
