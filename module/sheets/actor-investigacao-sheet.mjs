/**
 * Ficha da Investigação (spec §5.1) — participantes, POIs, desafios de acesso e a
 * configuração de sobrecarga mental, tudo num documento que não depende de Scene.
 * O Painel de investigação lê os mesmos dados para as ações do dia a dia; esta
 * ficha é a superfície de montagem/gestão, como a ficha de POI é para o quadro de
 * informações.
 */
import {
  adicionarParticipante, removerParticipante, vincularPoi, removerPoi, vincularDesafio, removerDesafio,
  alternarOculto,
} from "../cena/investigacao-ativa.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class InvestigacaoSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["op2", "op2-ficha", "op2-ficha--investigacao"],
    position: { width: 620, height: 760 },
    window: { resizable: true, icon: "fa-solid fa-folder-open" },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      removerParticipante: InvestigacaoSheet.#removerParticipante,
      abrirDocumento: InvestigacaoSheet.#abrirDocumento,
      removerPoi: InvestigacaoSheet.#removerPoi,
      removerDesafio: InvestigacaoSheet.#removerDesafio,
      alternarOculto: InvestigacaoSheet.#alternarOculto,
      adicionarLinhaSobrecarga: InvestigacaoSheet.#adicionarLinhaSobrecarga,
      removerLinhaSobrecarga: InvestigacaoSheet.#removerLinhaSobrecarga,
    },
    dragDrop: [{ dropSelector: ".op2-investigacao-corpo" }],
  };

  static PARTS = {
    corpo: { template: "systems/ordem-paranormal-2e/templates/actor/investigacao.hbs" },
  };

  async _prepareContext(opcoes) {
    const contexto = await super._prepareContext(opcoes);
    const sistema = this.actor.system;
    const editor = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;

    // `campo` identifica a lista de ocultos correspondente (`<campo>Ocultos`) — o
    // mestre pode vincular com antecedência e só revelar aos jogadores depois.
    const resolverDocs = (uuids, campo, tipo) => uuids.map((uuid) => fromUuidSync(uuid))
      .filter((doc) => doc && (tipo ? doc.type === tipo : true))
      .map((doc) => ({
        uuid: doc.uuid, nome: doc.name, img: doc.img, tipo: doc.type, campo,
        oculto: sistema[`${campo}Ocultos`].includes(doc.uuid),
      }));

    return {
      ...contexto,
      actor: this.actor,
      sistema,
      fields: sistema.schema.fields,
      editavel: this.isEditable,
      descricao: await editor.enrichHTML(sistema.descricao ?? "", { relativeTo: this.actor }),
      participantes: resolverDocs(sistema.participantes, "participantes"),
      pois: resolverDocs(sistema.pois, "pois", "ponto-interesse"),
      desafios: resolverDocs(sistema.desafios, "desafios", "desafio-acesso"),
      sobrecarga: {
        ...sistema.sobrecarga,
        tabela: sistema.sobrecarga.tabela.map((linha, indice) => ({ ...linha, indice })),
      },
    };
  }

  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    if (!this.isEditable) return;
    for (const campo of this.element.querySelectorAll("[data-sobrecarga-campo]")) {
      campo.addEventListener("change", () => this.#gravarTabela());
    }
  }

  async #gravarTabela() {
    const tabela = [...this.element.querySelectorAll("[data-sobrecarga-linha]")]
      .map((linha) => ({
        rodada: Number(linha.querySelector("[data-sobrecarga-campo='rodada']")?.value),
        dano: linha.querySelector("[data-sobrecarga-campo='dano']")?.value.trim() || "0",
      }))
      .filter((linha) => linha.rodada > 0);
    await this.actor.update({ "system.sobrecarga.tabela": tabela });
  }

  async _onDrop(evento) {
    let dados;
    try {
      dados = JSON.parse(evento.dataTransfer.getData("text/plain"));
    } catch { return; }

    if (dados?.type === "Actor") {
      const ator = await fromUuid(dados.uuid);
      if (["personagem", "npc"].includes(ator?.type)) await adicionarParticipante(this.actor, ator.uuid);
      return;
    }
    if (dados?.type === "Item") {
      const item = await fromUuid(dados.uuid);
      if (item?.type === "ponto-interesse") await vincularPoi(this.actor, item.uuid);
      else if (item?.type === "desafio-acesso") await vincularDesafio(this.actor, item.uuid);
    }
  }

  static async #removerParticipante(_evento, alvo) {
    await removerParticipante(this.actor, alvo.dataset.uuid);
  }

  static async #abrirDocumento(_evento, alvo) {
    (await fromUuid(alvo.dataset.uuid))?.sheet?.render(true);
  }

  static async #removerPoi(_evento, alvo) {
    await removerPoi(this.actor, alvo.dataset.uuid);
  }

  static async #removerDesafio(_evento, alvo) {
    await removerDesafio(this.actor, alvo.dataset.uuid);
  }

  static async #alternarOculto(_evento, alvo) {
    await alternarOculto(this.actor, alvo.dataset.campo, alvo.dataset.uuid);
  }

  static async #adicionarLinhaSobrecarga() {
    const tabela = this.actor.system.sobrecarga.tabela;
    const ultima = tabela.at(-1);
    await this.actor.update({
      "system.sobrecarga.tabela": [...tabela, { rodada: (ultima?.rodada ?? 0) + 1, dano: ultima?.dano ?? "0" }],
    });
  }

  static async #removerLinhaSobrecarga(_evento, alvo) {
    const tabela = this.actor.system.sobrecarga.tabela.filter((_l, i) => i !== Number(alvo.dataset.indice));
    await this.actor.update({ "system.sobrecarga.tabela": tabela });
  }
}
