/**
 * Rádio Modificado — minigame de ordenação de palavras (spec §9.2).
 *
 * O teste de Tecnologia já rolou antes de abrir (em `usarRadio`, acoes-ferramenta.mjs)
 * e decidiu quantos conjuntos falsos saem de jogo — este app só cuida da parte
 * objetiva que sobra: mistura as peças de todos os conjuntos que restaram num monte
 * só e deixa o jogador ordenar e descartar até bater com a frase certa. É o jogo do
 * livro: "você entrega vários conjuntos de palavras para o jogador e ele precisa
 * ordená-los corretamente para formar frases. Contudo, nem todos os conjuntos serão
 * utilizados: alguns são falsos". Separar os falsos que o teste não removeu é parte
 * do desafio — por isso eles entram no mesmo monte, sem marca.
 *
 * Sem Item nem persistência: como Laboratório e Alcançar, é ação avulsa — só o
 * resultado final vai para o chat.
 */
import { SYSTEM_ID } from "../config.mjs";
import { embaralhar, moverEmLista, montarPecas, pecasResolvidas } from "./ferramentas.mjs";
import { renderizar } from "../dice/teste.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class RadioApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["op2", "op2-radio"],
    window: { title: "OP2.Ferramenta.Subtipo.radio", icon: "fa-solid fa-satellite-dish", resizable: true },
    position: { width: 560, height: "auto" },
    actions: {
      moverPeca: RadioApp.#moverPeca,
      alternarPeca: RadioApp.#alternarPeca,
      finalizar: RadioApp.#finalizar,
    },
  };

  static PARTS = {
    corpo: { template: "systems/ordem-paranormal-2e/templates/cena/radio.hbs" },
  };

  /**
   * @param {{ator: Actor, poi: Item, roll: object, conjuntos: Array<{verdadeiro: boolean, frase: string}>,
   *   removidos: number, totalFalsos: number}} resultado de `usarRadio`
   */
  constructor(resultado, opcoes = {}) {
    super(opcoes);
    this.ator = resultado.ator;
    this.poi = resultado.poi;
    this.roll = resultado.roll;
    this.removidos = resultado.removidos;
    this.totalFalsos = resultado.totalFalsos;
    this.conjuntos = resultado.conjuntos;
    this.pecas = embaralhar(montarPecas(this.conjuntos)).map((peca) => ({ ...peca, descartada: false }));
    this.finalizado = false;
    this.resolvido = null;
  }

  static abrir(resultado) {
    const app = new RadioApp(resultado);
    app.render({ force: true });
    return app;
  }

  async _prepareContext() {
    return {
      atorNome: this.ator.name,
      poiNome: this.poi.name,
      totalRolado: this.roll.total,
      removidos: this.removidos,
      totalFalsos: this.totalFalsos,
      finalizado: this.finalizado,
      resolvido: this.resolvido,
      pecas: this.pecas.map((peca, i) => ({ ...peca, i, primeira: i === 0, ultima: i === this.pecas.length - 1 })),
      temPecas: this.pecas.length > 0,
    };
  }

  static #moverPeca(_evento, alvo) {
    if (this.finalizado) return;
    this.pecas = moverEmLista(this.pecas, Number(alvo.dataset.indice), Number(alvo.dataset.direcao));
    this.render();
  }

  static #alternarPeca(_evento, alvo) {
    if (this.finalizado) return;
    const peca = this.pecas[Number(alvo.dataset.indice)];
    if (peca) peca.descartada = !peca.descartada;
    this.render();
  }

  static async #finalizar() {
    this.finalizado = true;
    this.resolvido = pecasResolvidas(this.pecas, this.conjuntos);

    const mantidas = this.pecas.filter((p) => !p.descartada).map((p) => p.texto);
    const descartadas = this.pecas.filter((p) => p.descartada).map((p) => p.texto);
    const conteudo = await renderizar("systems/ordem-paranormal-2e/templates/chat/radio.hbs", {
      titulo: game.i18n.localize("OP2.Ferramenta.Subtipo.radio"),
      poiNome: this.poi.name,
      removidos: this.removidos,
      totalFalsos: this.totalFalsos,
      mantidas: mantidas.join(" "),
      descartadas: descartadas.join(" · "),
      resolvido: this.resolvido,
    });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.ator }),
      content: conteudo,
      whisper: game.users.filter((u) => u.isGM || this.ator.testUserPermission(u, "OWNER")).map((u) => u.id),
      flags: { [SYSTEM_ID]: { tipo: "radio", atorId: this.ator.id } },
    });

    this.render();
  }
}

export function abrirRadio(resultado) {
  return RadioApp.abrir(resultado);
}
