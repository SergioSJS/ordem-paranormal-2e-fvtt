/**
 * Destrancar — Mastermind numérico (spec §7.1).
 *
 * O jogador monta um palpite (um valor por posição, sem rolar) e recebe a resposta
 * posição a posição: exato, alto ou baixo. Nunca a contagem agregada — é ele quem
 * deduz a senha, não o sistema que entrega de bandeja. O mestre gera a senha e ela
 * fica oculta em `system.senha`; a UI simplesmente nunca renderiza esse campo para
 * quem não é o mestre (o mesmo nível de confiança informal que o resto do sistema
 * usa para segredos de POI — ver docs/ARQUITETURA.md).
 */
import { gerarSenhaDestrancar, tentarDestrancar, carregarDesafio } from "./acoes-desafio.mjs";
import { tentativasPorRodadaDeDestrancar, tentativasDeDestrancarNaRodada } from "./desafios.mjs";
import { rodadaAtual } from "./rodada.mjs";

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
      gerarSenha: DestrancarApp.#gerarSenha,
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

    // Teto por rodada pelo dado de Crime de quem vai tentar (spec §7.1).
    const ator = game.user.character;
    const dadoCrime = ator?.system?.pericias?.crime?.dadoEfetivo ?? "d4";
    const tetoRodada = tentativasPorRodadaDeDestrancar(dadoCrime);
    const naRodada = tentativasDeDestrancarNaRodada(sistema.historicoDestrancar, ator?.id, rodadaAtual());

    return {
      existe: true,
      naRodada, tetoRodada, dadoCrime,
      esgotouRodada: naRodada >= tetoRodada,
      ehGM: game.user.isGM,
      nome: desafio.name,
      temSenha,
      senha: game.user.isGM ? sistema.senha : null,
      tamanhoSenha: sistema.tamanhoSenha,
      facesSenha: sistema.facesSenha,
      tentativas: sistema.destrancarTentativas,
      maxTentativas: sistema.maxTentativas,
      quebrado: sistema.quebrado,
      destrancado: sistema.destrancado,
      encerrado,
      palpite: this.palpite,
      historico: sistema.historicoDestrancar.map((linha) => ({
        palpite: linha.palpite,
        resultado: linha.resultado.map((r) => ({
          valor: r,
          icone: r === "exato" ? "fa-check" : r === "alto" ? "fa-arrow-down" : "fa-arrow-up",
        })),
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

  static async #gerarSenha() {
    if (!game.user.isGM) return;
    const desafio = await carregarDesafio(this.desafioUuid);
    if (!desafio) return;

    const config = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("OP2.Desafio.GerarSenha") },
      content: `
        <div class="form-group">
          <label>${game.i18n.localize("OP2.Desafio.TamanhoSenha")}</label>
          <input type="number" name="tamanho" value="${desafio.system.tamanhoSenha}" min="1" max="8">
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("OP2.Desafio.FacesSenha")}</label>
          <input type="number" name="faces" value="${desafio.system.facesSenha}" min="2" max="12">
        </div>`,
      ok: {
        callback: (_evento, botao) => ({
          tamanho: Number(botao.form.elements.tamanho.value),
          facesSenha: Number(botao.form.elements.faces.value),
        }),
      },
      rejectClose: false,
    });
    if (!config) return;

    await gerarSenhaDestrancar(this.desafioUuid, config);
    this.palpite = null;
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
