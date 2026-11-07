/**
 * O que se faz com os dados já rolados, antes de o card sair: Análise muda um dado em ±1
 * gastando marcador, Prontidão rola um dado de novo por 2 PD (beta §12).
 *
 * Prontidão em teste de OUTRO ser fica na mesa: exigiria mexer na rolagem de quem já
 * rolou, de outro cliente (docs/regras/LACUNAS.md).
 */
import { iconeResultado } from "../ui/dice-icons.mjs";
import { vestirPerfil } from "../ui/perfil.mjs";
import { CUSTO_PD_PRONTIDAO } from "../config.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const temMecanica = (ator, mecanica) => ator.items?.some((i) => i.type === "habilidade" && i.system.mecanica === mecanica);

/** Vale abrir a janela? Sem marcador nem Prontidão com PD, o teste segue reto. */
export function temReacaoPosRolagem(ator) {
  const estado = ator.system.estado;
  if (!estado) return false;
  if (estado.marcadores > 0) return true;
  return temMecanica(ator, "prontidao") && (ator.system.recursos?.pd?.value ?? 0) >= CUSTO_PD_PRONTIDAO;
}

export class PosRolagem extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "op2-pos-rolagem",
    classes: ["op2", "op2-dialog", "op2-pos-rolagem"],
    window: { title: "OP2.PosRolagem.Titulo", icon: "fa-solid fa-dice" },
    position: { width: 420, height: "auto" },
    actions: {
      ajustar: PosRolagem.#ajustar,
      rerrolar: PosRolagem.#rerrolar,
      concluir: PosRolagem.#concluir,
    },
  };

  static PARTS = { corpo: { template: "systems/ordem-paranormal-2e/templates/dialog/pos-rolagem.hbs" } };

  #resolver;
  #prontidaoUsada = false;

  constructor({ roll, ator, resolver, ...opcoes } = {}) {
    super(opcoes);
    this.roll = roll;
    this.ator = ator;
    this.#resolver = resolver;
  }

  static abrir(roll, ator) {
    return new Promise((resolver) => new PosRolagem({ roll, ator, resolver }).render({ force: true }));
  }

  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    vestirPerfil(this.element, this.ator);
  }

  async _prepareContext() {
    const marcadores = this.ator.system.estado.marcadores;
    const pd = this.ator.system.recursos?.pd?.value ?? 0;
    const prontidao = !this.#prontidaoUsada && temMecanica(this.ator, "prontidao") && pd >= CUSTO_PD_PRONTIDAO;
    return {
      marcadores,
      custoProntidao: CUSTO_PD_PRONTIDAO,
      resultado: this.roll.resultado,
      // O anulado entra: mudar o valor dele pode tirá-lo de baixo do pavor (beta §12 não exclui).
      dados: this.roll.dados.filter((d) => !d.pavor && (d.anulado || d.contado)).map((d) => ({
        ...d,
        icone: iconeResultado({ dado: d.dado, resultado: d.resultado, contado: true }),
        podeBaixar: marcadores > 0 && d.resultado > 1,
        podeSubir: marcadores > 0 && d.resultado < Number(d.dado.slice(1)),
        // "Um dos dados do teste cujo resultado não tenha sido 1" (ficha do vigilante).
        podeRerrolar: prontidao && d.resultado !== 1,
      })),
    };
  }

  static async #ajustar(_evento, alvo) {
    this.roll.ajustarDado(Number(alvo.dataset.indice), Number(alvo.dataset.delta));
    await this.ator.update({ "system.estado.marcadores": this.ator.system.estado.marcadores - 1 });
    this.render();
  }

  static async #rerrolar(_evento, alvo) {
    await this.ator.update({
      "system.recursos.pd.value": this.ator.system.recursos.pd.value - CUSTO_PD_PRONTIDAO,
    });
    await this.roll.rerrolarDado(Number(alvo.dataset.indice));
    this.#prontidaoUsada = true;
    this.render();
  }

  static #concluir() {
    return this.close();
  }

  _onClose(opcoes) {
    super._onClose(opcoes);
    this.#resolver?.();
    this.#resolver = null;
  }
}
