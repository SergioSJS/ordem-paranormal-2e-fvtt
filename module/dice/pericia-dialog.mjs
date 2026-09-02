/**
 * Escolha de perícia — a lista da ficha, não um `<select>` cru.
 *
 * Duas razões. A primeira é visual: a ficha mostra perícia + dado como ícone, e um
 * menu nativo com 25 linhas de texto destoa de tudo (achado em uso real: "feio
 * demais um select contendo tudo"). A segunda é de jogo: a lista é SEMPRE a
 * completa, nunca só as perícias que o POI tem cadastradas — um menu filtrado
 * entrega de antemão quais perícias valem a pena ali, sem o personagem ter
 * investigado nada.
 */
import { PERICIAS } from "../config.mjs";
import { iconeDado } from "../ui/dice-icons.mjs";
import { rotuloDePericia } from "./teste.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PericiaDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "op2-pericia-dialog",
    classes: ["op2", "op2-dialog", "op2-pericia-dialog"],
    window: { title: "OP2.Dialog.Pericia.Titulo", icon: "fa-solid fa-magnifying-glass" },
    position: { width: 420, height: "auto" },
    actions: { escolher: PericiaDialog.#escolher },
  };

  static PARTS = {
    corpo: { template: "systems/ordem-paranormal-2e/templates/dialog/pericia.hbs" },
  };

  /**
   * @param {object} [config]
   * @param {string} [config.titulo]
   * @param {string} [config.ajuda]
   * @param {boolean} [config.mostrarAtributo] mostra o par perícia+atributo — só
   *   faz sentido quando a ação rola de verdade (Investigar não rola, spec §6.3)
   */
  constructor(ator, { titulo, ajuda, mostrarAtributo = false } = {}, opcoes = {}) {
    super(opcoes);
    this.ator = ator;
    this.titulo = titulo ?? null;
    this.ajuda = ajuda ?? null;
    this.mostrarAtributo = mostrarAtributo;
    this.escolhida = null;
    this.resolver = null;
  }

  get title() {
    return this.titulo ?? game.i18n.localize("OP2.Dialog.Pericia.Titulo");
  }

  /** @returns {Promise<string|null>} chave escolhida, ou null se fechou sem escolher */
  static abrir(ator, opcoes) {
    const app = new PericiaDialog(ator, opcoes);
    const promessa = new Promise((resolve) => { app.resolver = resolve; });
    app.render({ force: true });
    return promessa;
  }

  async _prepareContext() {
    const sistema = this.ator.system;

    // A mesma leitura da ficha: perícia, o dado dela, e o atributo pareado. Quem
    // vai rolar precisa ver o par antes de escolher (a troca do atributo em si
    // acontece no diálogo de teste, que abre em seguida — é lá que ela existe).
    const linha = (chave, rotulo) => {
      const resolvido = sistema.resolverChave(chave);
      const chaveAtributo = sistema.atributoDe(chave) ?? "fisico";
      const atributo = sistema.atributos[chaveAtributo];
      return {
        chave,
        rotulo: rotulo ?? rotuloDePericia(chave),
        icone: iconeDado(resolvido?.dado ?? "d4"),
        atributoRotulo: game.i18n.localize(`OP2.Atributo.${chaveAtributo}`),
        atributoIcone: iconeDado(atributo?.dadoEfetivo ?? "d4"),
      };
    };

    return {
      ajuda: this.ajuda,
      // O par só faz sentido quando a ação rola; Investigar compara o tamanho do
      // dado sem rolar (spec §6.3), e aí atributo nenhum entra na conta.
      mostrarAtributo: this.mostrarAtributo,
      // A lista completa, sempre: 19 perícias + as Aptidões que ESTE personagem tem.
      pericias: Object.keys(PERICIAS).filter((chave) => !PERICIAS[chave].especializada).map((chave) => linha(chave)),
      // Dentro do grupo "Aptidão" a linha mostra só o campo — repetir "Aptidão
      // (Artes)" embaixo do título "APTIDÃO" é redundante (achado em uso real).
      aptidoes: Object.entries(sistema.aptidoes ?? {}).map(([sub, dados]) => linha(
        `aptidao.${sub}`,
        dados?.rotulo?.trim() || game.i18n.localize(`OP2.Aptidao.${sub}`),
      )),
    };
  }

  static #escolher(_evento, alvo) {
    this.escolhida = alvo.dataset.chave;
    this.close();
  }

  _onClose(opcoes) {
    super._onClose(opcoes);
    this.resolver?.(this.escolhida);
  }
}

export function escolherPericia(ator, opcoes) {
  return PericiaDialog.abrir(ator, opcoes);
}
