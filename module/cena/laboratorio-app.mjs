/**
 * Laboratório Portátil — escada crescente (spec §9.1).
 *
 * Rola-se a sequência inteira de uma vez (não dado a dado): a versão "revelada uma
 * a uma" que a spec sugere é só flavor de apresentação, a regra em si (cada rolagem
 * ≥ a anterior) não muda se todas aparecem juntas. O jogador então escolhe quais
 * posições quebradas rerrolar, até o limite de metade das faces de Mente.
 *
 * Sem Item nem persistência: é uma ação avulsa, como Alcançar — só o resultado final
 * vai para o chat.
 */
import { ESCADA, SYSTEM_ID } from "../config.mjs";
import { sequenciaLaboratorio, rerrolagensLaboratorio, sequenciaValida } from "./ferramentas.mjs";
import { renderizar } from "../dice/teste.mjs";
import { vestirPerfil } from "../ui/perfil.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class LaboratorioApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["op2", "op2-laboratorio"],
    window: { title: "OP2.Ferramenta.Subtipo.laboratorio", icon: "fa-solid fa-flask", resizable: true },
    position: { width: 460, height: "auto" },
    actions: {
      alternarSelecao: LaboratorioApp.#alternarSelecao,
      rerrolar: LaboratorioApp.#rerrolar,
      finalizar: LaboratorioApp.#finalizar,
    },
  };

  static PARTS = {
    corpo: { template: "systems/ordem-paranormal-2e/templates/cena/laboratorio.hbs" },
  };

  /**
   * @param {Actor} ator
   * @param {number} qtdDados 4 a 6, definido pelo POI (spec §9.1)
   * @param {string} [poiUuid] se veio de um POI, o sucesso revela `ferramentas.laboratorio`
   */
  constructor(ator, qtdDados, poiUuid = null, opcoes = {}) {
    super(opcoes);
    this.ator = ator;
    this.poiUuid = poiUuid;
    this.aptidaoExatas = ator.system.aptidoes?.exatas?.dadoEfetivo ?? "d4";
    this.sequenciaAlvo = sequenciaLaboratorio(qtdDados, this.aptidaoExatas, ESCADA);
    this.rerrolagensRestantes = rerrolagensLaboratorio(ator.system.atributos.mente.valor);
    this.resultados = [];
    this.selecionados = new Set();
    this.finalizado = false;
  }

  static async abrir(ator, qtdDados, poiUuid = null) {
    const app = new LaboratorioApp(ator, qtdDados, poiUuid);
    await app.rolarTudo();
    app.render({ force: true });
    return app;
  }

  /** Rola a escada inteira de uma vez — cada dado é um termo, não uma soma. */
  async rolarTudo() {
    const formula = this.sequenciaAlvo.map((d) => `1${d}`).join(" + ");
    const roll = await new Roll(formula).evaluate();
    this.resultados = roll.dice.map((termo) => termo.results[0].result);
    this.selecionados.clear();
  }

  /** A janela veste a cor do perfil de quem a abriu. */
  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    vestirPerfil(this.element, this.ator);
  }

  async _prepareContext() {
    const posicoes = this.resultados.map((resultado, i) => {
      const quebrou = i > 0 && resultado < this.resultados[i - 1];
      return {
        indice: i,
        dado: this.sequenciaAlvo[i],
        resultado,
        contado: !quebrou,
        quebrou,
        selecionado: this.selecionados.has(i),
      };
    });

    return {
      atorNome: this.ator.name,
      aptidaoExatas: this.aptidaoExatas,
      posicoes,
      valido: sequenciaValida(this.resultados),
      rerrolagensRestantes: this.rerrolagensRestantes,
      podeRerrolar: this.rerrolagensRestantes > 0 && !this.finalizado,
      temSelecao: this.selecionados.size > 0,
      finalizado: this.finalizado,
    };
  }

  static #alternarSelecao(_evento, alvo) {
    const i = Number(alvo.dataset.indice);
    if (this.selecionados.has(i)) this.selecionados.delete(i);
    else if (this.selecionados.size < this.rerrolagensRestantes) this.selecionados.add(i);
    this.render();
  }

  static async #rerrolar() {
    if (!this.selecionados.size) return;
    const indices = [...this.selecionados];
    const formula = indices.map((i) => `1${this.sequenciaAlvo[i]}`).join(" + ");
    const roll = await new Roll(formula).evaluate();
    roll.dice.forEach((termo, k) => { this.resultados[indices[k]] = termo.results[0].result; });

    this.rerrolagensRestantes -= indices.length;
    this.selecionados.clear();
    this.render();
  }

  static async #finalizar() {
    this.finalizado = true;
    const sucesso = sequenciaValida(this.resultados);

    // Sucesso é o que faz o equipamento entregar a leitura do POI — falhar na
    // escada é falhar em operar o Laboratório, não em interpretar o resultado.
    let resultadoPoi = null;
    if (sucesso && this.poiUuid) {
      const poi = await fromUuid(this.poiUuid);
      const texto = poi?.system.ferramentas?.laboratorio;
      const editor = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
      resultadoPoi = texto?.trim() ? await editor.enrichHTML(texto, { relativeTo: poi }) : null;
    }

    const conteudo = await renderizar("systems/ordem-paranormal-2e/templates/chat/laboratorio.hbs", {
      titulo: game.i18n.localize("OP2.Ferramenta.Subtipo.laboratorio"),
      sucesso,
      resultadoPoi,
      sequencia: this.resultados.map((resultado, i) => ({
        dado: this.sequenciaAlvo[i],
        resultado,
        contado: i === 0 || resultado >= this.resultados[i - 1],
      })),
    });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.ator }),
      content: conteudo,
      whisper: game.users.filter((u) => u.isGM || this.ator.testUserPermission(u, "OWNER")).map((u) => u.id),
      flags: { [SYSTEM_ID]: { tipo: "laboratorio", atorId: this.ator.id } },
    });

    this.render();
  }
}

export function abrirLaboratorio(ator, qtdDados, poiUuid = null) {
  return LaboratorioApp.abrir(ator, qtdDados, poiUuid);
}
