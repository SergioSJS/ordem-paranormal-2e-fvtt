/**
 * Ações de investigação de UM personagem (spec §6.3–§6.5, §7, §9).
 *
 * Mora na ficha, não no painel: aqui o personagem que age é este, sem ambiguidade.
 * No painel um jogador com mais de um personagem não teria como escolher por qual
 * deles o botão agiria, e o painel do jogador virou só leitura do que o mestre
 * revelou (achado em uso real).
 *
 * Nada de novo em regra: cada botão chama a mesma função que o painel do mestre já
 * chamava — só o dono da ação mudou de lugar.
 */
import { FERRAMENTAS_POI } from "../config.mjs";
import { investigacaoAtiva } from "./investigacao-ativa.mjs";
import { temFerramenta } from "./ferramentas.mjs";
import {
  dialogoInvestigar, examinar, interagir, recapitular, compartilhar,
} from "./acoes-investigacao.mjs";
import {
  arrombar, alcancar, sustentar, pararDeSustentar, hackTecnico, hackSocial,
} from "./acoes-desafio.mjs";
import { usarFerramenta, usarLaser, usarRadio } from "./acoes-ferramenta.mjs";
import { abrirDestrancar } from "./destrancar-app.mjs";
import { abrirLaboratorio } from "./laboratorio-app.mjs";
import { abrirRadio } from "./radio-app.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class AcoesInvestigacaoApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["op2", "op2-acoes"],
    window: { title: "OP2.Acoes.Titulo", icon: "fa-solid fa-magnifying-glass", resizable: true },
    position: { width: 460, height: 620 },
    actions: {
      recapitular: AcoesInvestigacaoApp.#recapitular,
      compartilhar: AcoesInvestigacaoApp.#compartilhar,
      alcancar: AcoesInvestigacaoApp.#alcancar,
      sustentar: AcoesInvestigacaoApp.#sustentar,
      pararDeSustentar: AcoesInvestigacaoApp.#pararDeSustentar,
      usarLaser: AcoesInvestigacaoApp.#usarLaser,
      investigar: AcoesInvestigacaoApp.#investigar,
      examinar: AcoesInvestigacaoApp.#examinar,
      interagir: AcoesInvestigacaoApp.#interagir,
      usarFerramenta: AcoesInvestigacaoApp.#usarFerramenta,
      usarLaboratorio: AcoesInvestigacaoApp.#usarLaboratorio,
      usarRadio: AcoesInvestigacaoApp.#usarRadio,
      arrombar: AcoesInvestigacaoApp.#arrombar,
      destrancar: AcoesInvestigacaoApp.#destrancar,
      hackTecnico: AcoesInvestigacaoApp.#hackTecnico,
      hackSocial: AcoesInvestigacaoApp.#hackSocial,
    },
  };

  static PARTS = {
    corpo: { template: "systems/ordem-paranormal-2e/templates/actor/acoes-investigacao.hbs" },
  };

  /** @param {Actor} ator */
  constructor(ator, opcoes = {}) {
    super({ id: `op2-acoes-${ator.id}`, ...opcoes });
    this.ator = ator;
  }

  get title() {
    return `${game.i18n.localize("OP2.Acoes.Titulo")} — ${this.ator.name}`;
  }

  async _prepareContext() {
    const investigacao = investigacaoAtiva();
    const ator = this.ator;

    // POI e desafio que o mestre escondeu não existem para quem age: a lista de
    // alvos aqui é a mesma que o painel mostra para o jogador.
    const ocultosPoi = investigacao?.system.poisOcultos ?? [];
    const ocultosDesafio = investigacao?.system.desafiosOcultos ?? [];

    const pois = (investigacao?.system.pois ?? [])
      .filter((uuid) => !ocultosPoi.includes(uuid))
      .map((uuid) => fromUuidSync(uuid))
      .filter((poi) => poi?.type === "ponto-interesse")
      .map((poi) => ({
        uuid: poi.uuid,
        nome: poi.name,
        img: poi.img,
        // Só as ferramentas que ESTE personagem carrega — a reação do POI segue
        // escondida até o uso (spec §9.3).
        ferramentas: FERRAMENTAS_POI
          .filter((chave) => temFerramenta(ator.items, chave))
          .map((chave) => ({ chave, rotulo: game.i18n.localize(`OP2.Ferramenta.Subtipo.${chave}`) })),
      }));

    const desafios = (investigacao?.system.desafios ?? [])
      .filter((uuid) => !ocultosDesafio.includes(uuid))
      .map((uuid) => fromUuidSync(uuid))
      .filter((desafio) => desafio?.type === "desafio-acesso")
      .map((desafio) => ({
        uuid: desafio.uuid,
        nome: desafio.name,
        img: desafio.img,
        quebrado: desafio.system.quebrado,
        destrancado: desafio.system.destrancado,
        hackTecnicoResolvido: desafio.system.hackTecnico.resolvido,
        hackSocialResolvido: desafio.system.hackSocial.resolvido,
      }));

    return {
      atorNome: ator.name,
      temInvestigacao: Boolean(investigacao),
      nomeInvestigacao: investigacao?.name ?? "",
      sustentando: ator.system.estado.sustentando?.ativo ?? false,
      temLaser: temFerramenta(ator.items, "laser"),
      recapitularUsado: investigacao?.system.recapitularUsado ?? null,
      compartilharUsado: investigacao?.system.compartilharUsado ?? null,
      pois,
      desafios,
    };
  }

  /* -- ações ---------------------------------------------------------------- */

  static async #recapitular() { await recapitular(this.ator); }
  static async #compartilhar() { await compartilhar(this.ator); }
  static async #alcancar(_evento, alvo) { await alcancar(this.ator, { modo: alvo.dataset.modo }); }
  static async #sustentar() { await sustentar(this.ator); this.render(); }
  static async #pararDeSustentar() { await pararDeSustentar(this.ator); this.render(); }
  static async #usarLaser() { await usarLaser(this.ator); }

  static async #investigar(_evento, alvo) { await dialogoInvestigar(this.ator, alvo.dataset.poiUuid); }
  static async #examinar(_evento, alvo) { await examinar(this.ator, alvo.dataset.poiUuid, alvo.dataset.pericia); }
  static async #interagir(_evento, alvo) { await interagir(this.ator, alvo.dataset.poiUuid); }

  static async #usarFerramenta(_evento, alvo) {
    await usarFerramenta(this.ator, alvo.dataset.poiUuid, alvo.dataset.ferramenta);
  }

  /** Laboratório Portátil é minigame: pede quantos dados o POI exige (spec §9.1). */
  static async #usarLaboratorio(_evento, alvo) {
    const qtdDados = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("OP2.Ferramenta.Subtipo.laboratorio") },
      content: `
        <div class="form-group">
          <label>${game.i18n.localize("OP2.Ferramenta.QtdDados")}</label>
          <input type="number" name="qtd" value="4" min="4" max="6">
        </div>`,
      ok: { callback: (_ev, botao) => Number(botao.form.elements.qtd.value) },
      rejectClose: false,
    });
    if (!qtdDados) return;
    await abrirLaboratorio(this.ator, qtdDados, alvo.dataset.poiUuid);
  }

  static async #usarRadio(_evento, alvo) {
    const resultado = await usarRadio(this.ator, alvo.dataset.poiUuid);
    if (resultado) abrirRadio(resultado);
  }

  static async #arrombar(_evento, alvo) { await arrombar(this.ator, alvo.dataset.desafioUuid); this.render(); }
  static async #destrancar(_evento, alvo) { abrirDestrancar(alvo.dataset.desafioUuid); }
  static async #hackTecnico(_evento, alvo) { await hackTecnico(this.ator, alvo.dataset.desafioUuid); this.render(); }
  static async #hackSocial(_evento, alvo) { await hackSocial(this.ator, alvo.dataset.desafioUuid); this.render(); }
}

export function abrirAcoesInvestigacao(ator) {
  const app = new AcoesInvestigacaoApp(ator);
  app.render({ force: true });
  return app;
}
