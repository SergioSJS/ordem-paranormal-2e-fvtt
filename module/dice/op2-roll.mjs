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
    return this.dice.map((termo, i) => ({
      indice: i,
      dado: `d${termo.faces}`,
      resultado: termo.results[0].result,
      contado: termo.results[0].active !== false,
      componente: this.componentes[i] ?? { rotulo: `d${termo.faces}`, tipo: "extra" },
    }));
  }

  get contados() {
    return this.dados.filter((d) => d.contado);
  }

  /** Rolou mais dados do que pode somar? Então o jogador precisa escolher (spec §4.5). */
  get precisaSelecao() {
    return this.dados.length > MAX_DADOS_CONTADOS && this.contados.length === this.dados.length;
  }

  /** @returns {ReturnType<typeof analise.analisar>} */
  get resultado() {
    return analise.analisar(this.dados, { dt: this.dt, escopoCritico: this.escopoCritico });
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
      const ativo = escolhidos.has(i);
      for (const r of termo.results) {
        r.active = ativo;
        r.discarded = !ativo;
      }
    });
    this._total = analise.soma(this.dados);
    return this;
  }

  selecaoSugerida() {
    return analise.selecaoSugerida(this.dados);
  }
}
