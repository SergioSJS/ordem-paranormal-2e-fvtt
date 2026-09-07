/**
 * Ficha do desafio de acesso — o objeto que Arrombar, Destrancar ou Hackear
 * tentam vencer (spec §7.1/§7.2/§7.3).
 */
import { PERICIAS } from "../config.mjs";
import { rotuloDePericia } from "../dice/teste.mjs";
import { OP2ItemSheet } from "./item-sheet.mjs";
import { gerarSenhaDestrancar, posicoesDoPalpite } from "../cena/acoes-desafio.mjs";
import { iniciarHackTecnico } from "../cena/timer-hack.mjs";

export class DesafioAcessoSheet extends OP2ItemSheet {
  static DEFAULT_OPTIONS = {
    // `height: "auto"` (o padrão da ficha de item) cresce sem teto: com as
    // abordagens ligadas a janela passava da tela e o fim do formulário ficava
    // inalcançável, sem barra de rolagem (achado em uso real — o mesmo problema
    // que o painel já teve). Altura numérica dá ao core o que clampar.
    position: { width: 560, height: 720 },
    classes: ["op2", "op2-ficha--desafio"],
    actions: {
      ajustarPontuacao: DesafioAcessoSheet.#ajustarPontuacao,
      ajustarTentativas: DesafioAcessoSheet.#ajustarTentativas,
      adicionarPerguntaHack: DesafioAcessoSheet.#adicionarPerguntaHack,
      removerPerguntaHack: DesafioAcessoSheet.#removerPerguntaHack,
      iniciarHackFaixa: DesafioAcessoSheet.#iniciarHackFaixa,
      adicionarLinhaHack: DesafioAcessoSheet.#adicionarLinhaHack,
      gerarSenha: DesafioAcessoSheet.#gerarSenha,
      limparSenha: DesafioAcessoSheet.#limparSenha,
    },
  };

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
   * Revela o problema e inicia o contador na tela de todo mundo (`timer-hack.mjs`):
   * por faixa da tabela, ou um timer avulso com os segundos do campo, para o mestre
   * ditar a conta em voz alta.
   */
  static async #iniciarHackFaixa(_evento, alvo) {
    const indice = Number(alvo.dataset.indice);
    const segundos = Number(this.element.querySelector("[data-timer-segundos]")?.value) || undefined;
    await iniciarHackTecnico(this.item.uuid, null, indice >= 0 ? indice : -1, { segundos: indice >= 0 ? undefined : segundos });
  }
}
