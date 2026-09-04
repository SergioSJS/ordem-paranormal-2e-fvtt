/**
 * Ficha do desafio de acesso — o objeto que Arrombar, Destrancar ou Hackear
 * tentam vencer (spec §7.1/§7.2/§7.3).
 */
import { PERICIAS } from "../config.mjs";
import { rotuloDePericia } from "../dice/teste.mjs";
import { OP2ItemSheet } from "./item-sheet.mjs";
import { gerarSenhaDestrancar, posicoesDoPalpite } from "../cena/acoes-desafio.mjs";

export class DesafioAcessoSheet extends OP2ItemSheet {
  static DEFAULT_OPTIONS = {
    // `height: "auto"` (o padrão da ficha de item) cresce sem teto: com as
    // abordagens ligadas a janela passava da tela e o fim do formulário ficava
    // inalcançável, sem barra de rolagem (achado em uso real — o mesmo problema
    // que o painel já teve). Altura numérica dá ao core o que clampar.
    position: { width: 560, height: 720 },
    classes: ["op2-ficha--desafio"],
    actions: {
      ajustarPontuacao: DesafioAcessoSheet.#ajustarPontuacao,
      ajustarTentativas: DesafioAcessoSheet.#ajustarTentativas,
      adicionarPerguntaHack: DesafioAcessoSheet.#adicionarPerguntaHack,
      removerPerguntaHack: DesafioAcessoSheet.#removerPerguntaHack,
      iniciarTimerHack: DesafioAcessoSheet.#iniciarTimerHack,
      adicionarLinhaHack: DesafioAcessoSheet.#adicionarLinhaHack,
      gerarSenha: DesafioAcessoSheet.#gerarSenha,
      limparSenha: DesafioAcessoSheet.#limparSenha,
    },
  };

  /** Segundos restantes do timer do hack técnico — cliente-only, nunca persiste. */
  #timerId = null;

  /** Sorteia a senha com o tamanho e as faces do cadastro; zera o histórico. */
  static async #gerarSenha() {
    if (!this.isEditable) return;
    await gerarSenhaDestrancar(this.item.uuid);
  }

  static async #limparSenha() {
    if (!this.isEditable) return;
    await this.item.update({
      "system.senha": [], "system.historicoDestrancar": [], "system.destrancarTentativas": 0, "system.destrancado": false,
    });
  }

  async _prepareContext(opcoes) {
    const contexto = await super._prepareContext(opcoes);
    const { pontuacaoAtual, pontuacaoAlvo } = this.item.system;

    const { senha, historicoDestrancar } = this.item.system;

    return {
      ...contexto,
      percentualProgresso: Math.min(100, Math.round((pontuacaoAtual / pontuacaoAlvo) * 100)),
      // A senha do Destrancar e o histórico de palpites são do mestre: moram aqui, no
      // cadastro do desafio, não na tela de ações do jogador (achado em uso real).
      senha,
      temSenha: senha.length > 0,
      historicoDestrancar: historicoDestrancar.map((linha, indice) => ({
        numero: indice + 1,
        posicoes: posicoesDoPalpite(linha.palpite, linha.resultado),
        quem: game.actors.get(linha.atorId)?.name ?? "",
      })),
      perguntasHack: this.item.system.hackSocial.perguntas.map((pergunta, indice) => ({ ...pergunta, indice })),
      // Sem nenhuma abordagem marcada a ficha não tem o que configurar — o aviso
      // substitui os blocos em vez de mostrar campos que não valem para nada.
      temAlgumaAbordagem: Object.values(this.item.system.abordagens).some(Boolean),
      // Qualquer perícia serve para a abordagem genérica — é justamente o ponto.
      opcoesPericia: Object.keys(PERICIAS)
        .filter((chave) => !PERICIAS[chave].especializada)
        .map((chave) => ({ chave, rotulo: rotuloDePericia(chave) })),
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
  /** Uma faixa a mais na tabela do painel ("10+ → 16 x 5 = 80"). */
  static async #adicionarLinhaHack() {
    const tabela = [...this.item.system.hackTecnico.tabela, { rolagem: "", desafio: "" }];
    await this.item.update({ "system.hackTecnico.tabela": tabela });
  }

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

    // A faixa da tabela pode dar mais (ou menos) tempo que os 10s padrão.
    const escolhido = Number(this.element.querySelector("[data-timer-segundos]")?.value);
    let restante = Number.isInteger(escolhido) && escolhido > 0 ? escolhido : 10;
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
