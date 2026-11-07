/** Ficha da cena de ação: quem está nela e o botão que abre o painel. */
import { SYSTEM_ID } from "../config.mjs";
import { abrirPainelAcao } from "../vigilia/painel-acao.mjs";
import { atorDe } from "../vigilia/cena-acao.mjs";
import { TIPOS_DE_CENA } from "../data/actor-cena-acao.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class CenaAcaoSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["op2", "op2-ficha-cena-acao"],
    position: { width: 520, height: "auto" },
    form: { submitOnChange: true },
    actions: {
      abrirPainel: CenaAcaoSheet.#abrirPainel,
      tirar: CenaAcaoSheet.#tirar,
    },
  };

  static PARTS = { corpo: { template: `systems/${SYSTEM_ID}/templates/actor/cena-acao.hbs` } };

  async _prepareContext(opcoes) {
    const contexto = await super._prepareContext(opcoes);
    return {
      ...contexto,
      actor: this.actor,
      sistema: this.actor.system,
      editavel: this.isEditable,
      tipos: TIPOS_DE_CENA.map((t) => ({ chave: t, rotulo: game.i18n.localize(`OP2.CenaAcao.Tipo.${t}`), atual: t === this.actor.system.tipo })),
      participantes: this.actor.system.participantes.map((uuid) => ({ uuid, nome: atorDe(uuid)?.name ?? uuid })),
      // Todo parâmetro de missão é editável: a mesa pode jogar com outros números.
      parametros: JSON.stringify(this.actor.system.tipo === "furtividade" ? this.actor.system.furtividade : this.actor.system.perseguicao, null, 2),
      temParametros: this.actor.system.tipo !== "combate",
    };
  }

  /** Grava o JSON dos parâmetros; texto inválido avisa e não apaga o que havia. */
  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    this.element.querySelector("[data-parametros]")?.addEventListener("change", (evento) => {
      try {
        const dados = JSON.parse(evento.currentTarget.value || "{}");
        const campo = this.actor.system.tipo === "furtividade" ? "furtividade" : "perseguicao";
        // Trocar o objeto inteiro, sem fundir: o v14 tem operador para isso, e estranha o `==`.
        const { operators } = foundry.data;
        this.actor.update(operators?.ForcedReplacement
          ? { [`system.${campo}`]: operators.ForcedReplacement.create(dados) }
          : { [`system.==${campo}`]: dados });
      } catch {
        ui.notifications.error(game.i18n.localize("OP2.CenaAcao.ParametrosInvalidos"));
      }
    });
  }

  /** Arrastar um ator para a ficha o põe na cena. */
  async _onDropActor(_evento, ator) {
    const lista = this.actor.system.participantes;
    if (lista.includes(ator.uuid) || !["personagem", "npc"].includes(ator.type)) return false;
    await this.actor.update({ "system.participantes": [...lista, ator.uuid] });
    return false;
  }

  static #abrirPainel() {
    abrirPainelAcao(this.actor);
  }

  static #tirar(_evento, alvo) {
    return this.actor.update({ "system.participantes": this.actor.system.participantes.filter((u) => u !== alvo.dataset.uuid) });
  }
}
