/**
 * Destrancar — Mastermind numérico (spec §7.1).
 *
 * O jogador monta um palpite (um valor por posição, sem rolar) e recebe a resposta
 * posição a posição: exato, alto ou baixo. Nunca a contagem agregada — é ele quem
 * deduz a senha, não o sistema que entrega de bandeja. Esta tela é do jogador: a
 * senha e o histórico moram no cadastro do desafio, que é do mestre (achado em uso
 * real: "isso deveria estar no cadastro do desafio, não na tela de ações do
 * jogador"). `system.senha` nunca é renderizado aqui.
 *
 * A senha nasce sozinha na primeira abertura do app (ou na primeira tentativa):
 * exigir que o mestre fosse na ficha gerar à mão travava a mesa (achado em uso
 * real). O mestre continua podendo gerar outra — o que zera o histórico.
 */
import { gerarSenhaDestrancar, tentarDestrancar, carregarDesafio, posicoesDoPalpite } from "./acoes-desafio.mjs";
import { tentativasPorRodadaDeDestrancar, tentativasDeDestrancarNaRodada } from "./desafios.mjs";
import { rodadaAtual } from "./rodada.mjs";
import { vestirPerfil } from "../ui/perfil.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class DestrancarApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["op2", "op2-destrancar"],
    window: { title: "OP2.Desafio.Destrancar", icon: "fa-solid fa-key", resizable: true },
    position: { width: 420, height: "auto" },
    actions: {
      incrementar: DestrancarApp.#incrementar,
      decrementar: DestrancarApp.#decrementar,
      tentar: DestrancarApp.#tentar,
    },
  };

  static PARTS = {
    corpo: { template: "systems/ordem-paranormal-2e/templates/cena/destrancar.hbs" },
  };

  /** @param {string} desafioUuid */
  constructor(desafioUuid, opcoes = {}) {
    super({ id: `op2-destrancar-${desafioUuid.replace(/\W/g, "-")}`, ...opcoes });
    this.desafioUuid = desafioUuid;
    this.palpite = null;
  }

  /** Geração em andamento — não pedir duas vezes enquanto o socket não volta. */
  #gerando = false;

  /** A janela veste a cor do perfil de quem a abriu. */
  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    vestirPerfil(this.element, game.user.character);
  }

  async _prepareContext() {
    const desafio = await carregarDesafio(this.desafioUuid);
    if (!desafio) return { existe: false };

    const sistema = desafio.system;
    const temSenha = sistema.senha.length > 0;
    // O palpite vive só no app, nunca no Item — reseta se a senha mudou de tamanho
    // (senha nova) ou se ainda não existe.
    if (!this.palpite || this.palpite.length !== sistema.tamanhoSenha) {
      this.palpite = Array(sistema.tamanhoSenha).fill(1);
    }

    const encerrado = sistema.quebrado || sistema.destrancado;

    // Sem senha e ainda em jogo: gera agora. O mestre grava direto e o hook de
    // `updateItem` rerrenderiza; o jogador pede pelo socket e o mesmo hook traz a
    // senha quando ela chega.
    if (!temSenha && !encerrado && !this.#gerando) {
      this.#gerando = true;
      gerarSenhaDestrancar(this.desafioUuid).finally(() => { this.#gerando = false; });
    }

    // Teto por rodada pelo dado de Crime de quem vai tentar (spec §7.1).
    const ator = game.user.character;
    const dadoCrime = ator?.system?.pericias?.crime?.dadoEfetivo ?? "d4";
    const tetoRodada = tentativasPorRodadaDeDestrancar(dadoCrime);
    const naRodada = tentativasDeDestrancarNaRodada(sistema.historicoDestrancar, ator?.id, rodadaAtual());

    return {
      existe: true,
      gerando: !temSenha && !encerrado,
      naRodada, tetoRodada, dadoCrime,
      esgotouRodada: naRodada >= tetoRodada,
      ehGM: game.user.isGM,
      nome: desafio.name,
      temSenha,
      tamanhoSenha: sistema.tamanhoSenha,
      facesSenha: sistema.facesSenha,
      tentativas: sistema.destrancarTentativas,
      maxTentativas: sistema.maxTentativas,
      quebrado: sistema.quebrado,
      destrancado: sistema.destrancado,
      encerrado,
      palpite: this.palpite,
      historico: sistema.historicoDestrancar.map((linha, indice) => ({
        numero: indice + 1,
        posicoes: posicoesDoPalpite(linha.palpite, linha.resultado),
      })),
    };
  }

  static #incrementar(_evento, alvo) {
    const i = Number(alvo.dataset.indice);
    this.palpite[i] = Math.min(Number(alvo.dataset.faces), this.palpite[i] + 1);
    this.render();
  }

  static #decrementar(_evento, alvo) {
    const i = Number(alvo.dataset.indice);
    this.palpite[i] = Math.max(1, this.palpite[i] - 1);
    this.render();
  }

  static async #tentar() {
    const ator = game.user.character;
    if (!ator) {
      ui.notifications.warn(game.i18n.localize("OP2.Painel.SemPersonagem"));
      return;
    }
    await tentarDestrancar(ator, this.desafioUuid, [...this.palpite]);
    this.render();
  }

}

/* -- registro: reabre a mesma instância por desafio, e atualiza sozinha -- */

const instancias = new Map();

export function abrirDestrancar(desafioUuid) {
  let app = instancias.get(desafioUuid);
  if (!app) {
    app = new DestrancarApp(desafioUuid);
    instancias.set(desafioUuid, app);
  }
  app.render({ force: true });
  return app;
}

Hooks.on("updateItem", (item) => {
  const app = instancias.get(item.uuid);
  if (app?.rendered) app.render();
});
