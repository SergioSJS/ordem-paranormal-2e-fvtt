/**
 * Ficha do desafio de acesso — o objeto que Arrombar, Destrancar ou Hackear
 * tentam vencer (spec §7.1/§7.2/§7.3).
 */
import { OP2ItemSheet } from "./item-sheet.mjs";

export class DesafioAcessoSheet extends OP2ItemSheet {
  static DEFAULT_OPTIONS = {
    actions: {
      ajustarPontuacao: DesafioAcessoSheet.#ajustarPontuacao,
      ajustarTentativas: DesafioAcessoSheet.#ajustarTentativas,
      adicionarPerguntaHack: DesafioAcessoSheet.#adicionarPerguntaHack,
      removerPerguntaHack: DesafioAcessoSheet.#removerPerguntaHack,
      iniciarTimerHack: DesafioAcessoSheet.#iniciarTimerHack,
    },
  };

  /** Segundos restantes do timer do hack técnico — cliente-only, nunca persiste. */
  #timerId = null;

  async _prepareContext(opcoes) {
    const contexto = await super._prepareContext(opcoes);
    const { pontuacaoAtual, pontuacaoAlvo } = this.item.system;

    return {
      ...contexto,
      percentualProgresso: Math.min(100, Math.round((pontuacaoAtual / pontuacaoAlvo) * 100)),
      perguntasHack: this.item.system.hackSocial.perguntas.map((pergunta, indice) => ({ ...pergunta, indice })),
      // Sem nenhuma abordagem marcada a ficha não tem o que configurar — o aviso
      // substitui os blocos em vez de mostrar campos que não valem para nada.
      temAlgumaAbordagem: Object.values(this.item.system.abordagens).some(Boolean),
    };
  }

  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    clearInterval(this.#timerId);
    this.#timerId = null;
  }

  _onClose(opcoes) {
    super._onClose(opcoes);
    clearInterval(this.#timerId);
  }

  /**
   * Stepper do progresso — bookkeeping manual do mestre sem rolar Arrombar
   * (alguém forçou fora do sistema, correção de valor). Mesma trava em
   * [0, pontuacaoAlvo] da action `ajustarPontuacaoDesafio` do painel.
   */
  static async #ajustarPontuacao(_evento, alvo) {
    const { pontuacaoAtual, pontuacaoAlvo } = this.item.system;
    const novo = Math.max(0, Math.min(pontuacaoAlvo, pontuacaoAtual + Number(alvo.dataset.delta)));
    await this.item.update({ "system.pontuacaoAtual": novo });
  }

  /** Stepper das tentativas — trava em 0; `maxTentativas` 0 = sem limite (spec §7.2). */
  static async #ajustarTentativas(_evento, alvo) {
    const { tentativasUsadas, maxTentativas } = this.item.system;
    const teto = maxTentativas > 0 ? maxTentativas : Number.POSITIVE_INFINITY;
    const novo = Math.max(0, Math.min(teto, tentativasUsadas + Number(alvo.dataset.delta)));
    await this.item.update({ "system.tentativasUsadas": novo });
  }

  /** Banco de perguntas do hack social — mestre cadastra pergunta + gabarito. */
  static async #adicionarPerguntaHack() {
    const perguntas = [...this.item.system.hackSocial.perguntas, { pergunta: "", resposta: "" }];
    await this.item.update({ "system.hackSocial.perguntas": perguntas });
  }

  static async #removerPerguntaHack(_evento, alvo) {
    const perguntas = this.item.system.hackSocial.perguntas
      .filter((_pergunta, indice) => indice !== Number(alvo.dataset.indice));
    await this.item.update({ "system.hackSocial.perguntas": perguntas });
  }

  /**
   * Timer visual de 10s do hack técnico (spec §7.3) — cliente-only, nunca grava
   * no Item: é só o cronômetro que a spec pede como ferramenta de mestre, a
   * dificuldade do problema em si continua sendo julgamento da mesa
   * (docs/LACUNAS.md).
   */
  static #iniciarTimerHack(_evento, alvo) {
    clearInterval(this.#timerId);
    const mostrador = this.element.querySelector("[data-timer-hack]");
    if (!mostrador) return;

    let restante = 10;
    alvo.disabled = true;
    mostrador.textContent = restante;
    this.#timerId = setInterval(() => {
      restante -= 1;
      mostrador.textContent = Math.max(restante, 0);
      if (restante <= 0) {
        clearInterval(this.#timerId);
        this.#timerId = null;
        alvo.disabled = false;
      }
    }, 1000);
  }
}
