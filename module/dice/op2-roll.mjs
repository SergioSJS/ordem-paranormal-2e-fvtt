/**
 * Roll de Ordem Paranormal 2.
 *
 * Um teste é a soma de N dados de tamanhos diferentes (spec §4.1), mas o total é só
 * parte do resultado: várias mecânicas leem a Rolagem Alta e a Rolagem Baixa, o maior
 * e o menor *valor individual* (spec §4.2). A leitura em si vive em `analise.mjs`,
 * que é testável sem Foundry; esta classe só faz a ponte com o Roll do core.
 */
import { MAX_DADOS_CONTADOS } from "../config.mjs";
import * as analise from "./analise.mjs";

/**
 * @typedef {object} ComponenteTeste
 * @property {string} chave       ex.: "pericia.percepcao"
 * @property {string} rotulo      texto já localizado
 * @property {"atributo"|"pericia"|"extra"} tipo
 * @property {string} dado        "d8"
 */

export class OP2Roll extends Roll {
  static CHAT_TEMPLATE = "systems/ordem-paranormal-2e/templates/chat/teste.hbs";
  static TOOLTIP_TEMPLATE = "systems/ordem-paranormal-2e/templates/chat/teste-tooltip.hbs";

  /**
   * @param {ComponenteTeste[]} componentes um dado por componente, na ordem exibida
   * @param {{dt?: number|null, escopoCritico?: "todos"|"contados", rotulo?: string, atorId?: string}} [opcoes]
   */
  static paraComponentes(componentes, opcoes = {}) {
    const formula = componentes.map((c) => `1${c.dado}`).join(" + ");
    return new this(formula, {}, {
      dt: null,
      escopoCritico: "todos",
      ...opcoes,
      componentes: componentes.map((c) => ({ ...c })),
    });
  }

  /** @returns {ComponenteTeste[]} */
  get componentes() {
    return this.options.componentes ?? [];
  }

  /** O total do core soma todo dado da fórmula; o nosso desconta pavor e anulados. */
  async evaluate(opcoes) {
    await super.evaluate(opcoes);
    this._total = this.resultado.total;
    return this;
  }

  /** @returns {number|null} null num teste oposto */
  get dt() {
    return this.options.dt ?? null;
  }

  get escopoCritico() {
    return this.options.escopoCritico ?? "todos";
  }

  /**
   * Um registro por dado rolado, na ordem da fórmula, casado com seu componente.
   * @returns {Array<analise.DadoRolado & {componente: ComponenteTeste}>}
   */
  get dados() {
    if (!this._evaluated) return [];
    return analise.marcarPavor(this.dice.map((termo, i) => ({
      indice: i,
      dado: `d${termo.faces}`,
      resultado: termo.results[0].result,
      contado: termo.results[0].active !== false,
      pavor: this.componentes[i]?.tipo === "pavor",
      componente: this.componentes[i] ?? { rotulo: `d${termo.faces}`, tipo: "extra" },
    })));
  }

  get contados() {
    return this.dados.filter((d) => d.contado);
  }

  /** Rolou mais dados do que pode somar? Então o jogador precisa escolher (spec §4.5). */
  get precisaSelecao() {
    const elegiveis = this.dados.filter((d) => !d.pavor && !d.anulado);
    return elegiveis.length > MAX_DADOS_CONTADOS && elegiveis.every((d) => d.contado);
  }

  /** @returns {ReturnType<typeof analise.analisar>} */
  get resultado() {
    return analise.analisar(this.dados, {
      dt: this.dt,
      escopoCritico: this.escopoCritico,
      modificador: this.options.modificador ?? 0,
      ...(this.options.minimoCritico ? { minimoCritico: this.options.minimoCritico } : {}),
    });
  }

  /** O dado de pavor saiu 1: o efeito acaba (beta §9.1). */
  get pavorVencido() {
    return this.dados.find((d) => d.pavor)?.resultado === 1;
  }

  get ra() { return this.resultado.ra; }
  get rb() { return this.resultado.rb; }
  get critico() { return this.resultado.critico; }
  get falhaCritica() { return this.resultado.falhaCritica; }
  get sucesso() { return this.resultado.sucesso; }
  get desfecho() { return this.resultado.desfecho; }

  /**
   * Aplica a escolha do jogador sobre quais dados contam. Os descartados continuam
   * visíveis e riscados: ainda alimentam a detecção de crítico no escopo "todos".
   * @param {number[]} indices
   */
  aplicarSelecao(indices) {
    const escolhidos = new Set(indices.slice(0, MAX_DADOS_CONTADOS));
    this.dice.forEach((termo, i) => {
      if (this.componentes[i]?.tipo === "pavor") return;
      const ativo = escolhidos.has(i);
      for (const r of termo.results) {
        r.active = ativo;
        r.discarded = !ativo;
      }
    });
    this._total = this.resultado.total;
    return this;
  }

  /**
   * Muda o valor de um dado já rolado: os marcadores da Análise (beta §12), em ±1 e até
   * o máximo do dado.
   * @param {number} indice
   * @param {number} delta
   */
  ajustarDado(indice, delta) {
    const termo = this.dice[indice];
    const r = termo.results[0];
    r.result = Math.min(termo.faces, Math.max(1, r.result + delta));
    this._total = this.resultado.total;
    return this;
  }

  /** Rola um dado de novo: Prontidão (beta §12). Só vale para dado que não deu 1. */
  async rerrolarDado(indice) {
    const termo = this.dice[indice];
    const novo = await new Roll(`1d${termo.faces}`).evaluate();
    termo.results[0].result = novo.total;
    this._total = this.resultado.total;
    return this;
  }

  selecaoSugerida() {
    return analise.selecaoSugerida(this.dados);
  }
}
