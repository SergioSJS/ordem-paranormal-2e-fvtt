/**
 * Rádio Modificado — minigame de ordenação de palavras (spec §9.2).
 *
 * O teste de Tecnologia já rolou antes de abrir (em `usarRadio`, acoes-ferramenta.mjs)
 * e decidiu quantos conjuntos falsos saem de jogo — este app só cuida da parte
 * objetiva que sobra: embaralhar as palavras de cada conjunto restante e deixar o
 * jogador reordenar até bater com a frase certa. Se o jogador ainda "confunde" um
 * falso que o teste não removeu com um verdadeiro, isso é interpretação de mesa,
 * não algo que o sistema julga (docs/LACUNAS.md).
 *
 * Sem Item nem persistência: como Laboratório e Alcançar, é ação avulsa — só o
 * resultado final vai para o chat.
 */
import { SYSTEM_ID } from "../config.mjs";
import { embaralhar, moverEmLista, ordemCorreta } from "./ferramentas.mjs";
import { renderizar } from "../dice/teste.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class RadioApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["op2", "op2-radio"],
    window: { title: "OP2.Ferramenta.Subtipo.radio", icon: "fa-solid fa-satellite-dish", resizable: true },
    position: { width: 520, height: "auto" },
    actions: {
      moverPalavra: RadioApp.#moverPalavra,
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
    this.conjuntos = resultado.conjuntos.map((conjunto, indice) => ({
      indice,
      frase: conjunto.frase,
      palavras: embaralhar(conjunto.frase.trim().split(/\s+/)),
    }));
    this.finalizado = false;
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
      conjuntos: this.conjuntos.map((conjunto) => ({
        indice: conjunto.indice,
        palavras: conjunto.palavras.map((palavra, i) => ({ palavra, i })),
        resolvido: this.finalizado ? ordemCorreta(conjunto.palavras, conjunto.frase) : null,
      })),
    };
  }

  static #moverPalavra(_evento, alvo) {
    const conjunto = this.conjuntos.find((c) => c.indice === Number(alvo.dataset.conjunto));
    if (!conjunto || this.finalizado) return;
    conjunto.palavras = moverEmLista(conjunto.palavras, Number(alvo.dataset.indice), Number(alvo.dataset.direcao));
    this.render();
  }

  static async #finalizar() {
    this.finalizado = true;

    const resultados = this.conjuntos.map((conjunto) => ({
      frase: conjunto.palavras.join(" "),
      resolvido: ordemCorreta(conjunto.palavras, conjunto.frase),
    }));

    const conteudo = await renderizar("systems/ordem-paranormal-2e/templates/chat/radio.hbs", {
      titulo: game.i18n.localize("OP2.Ferramenta.Subtipo.radio"),
      poiNome: this.poi.name,
      removidos: this.removidos,
      totalFalsos: this.totalFalsos,
      resultados,
      todasResolvidas: resultados.length > 0 && resultados.every((r) => r.resolvido),
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
