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
import { investigacaoAtiva, investigacoesVisiveis, definirInvestigacaoAtiva } from "./investigacao-ativa.mjs";
import { temFerramenta } from "./ferramentas.mjs";
import { alvosDaCenaAtiva } from "./encerrar-investigacao.mjs";
import {
  dialogoExaminar, examinar, interagir, recapitular, compartilhar,
} from "./acoes-investigacao.mjs";
import {
  arrombar, alcancar, sustentar, pararDeSustentar, hackTecnico, hackSocial, desafioGenerico,
} from "./acoes-desafio.mjs";
import { usarFerramenta, usarLaser, usarRadio } from "./acoes-ferramenta.mjs";
import { ajudar } from "./acoes-ajuda.mjs";
import { atacar } from "./acoes-combate.mjs";
import { usarHabilidadeOuItem } from "./acoes-recurso.mjs";
import { abrirDestrancar } from "./destrancar-app.mjs";
import { abrirLaboratorio } from "./laboratorio-app.mjs";
import { abrirRadio } from "./radio-app.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class AcoesInvestigacaoApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["op2", "op2-acoes"],
    window: { title: "OP2.Acoes.Titulo", icon: "fa-solid fa-magnifying-glass", resizable: true },
    // Larga: é a mesa de ações do personagem, e vai receber mais grupos além dos
    // de investigação.
    position: { width: 620, height: 680 },
    actions: {
      ajudar: AcoesInvestigacaoApp.#ajudar,
      atacar: AcoesInvestigacaoApp.#atacar,
      usarRecurso: AcoesInvestigacaoApp.#usarRecurso,
      recapitular: AcoesInvestigacaoApp.#recapitular,
      compartilhar: AcoesInvestigacaoApp.#compartilhar,
      alcancar: AcoesInvestigacaoApp.#alcancar,
      sustentar: AcoesInvestigacaoApp.#sustentar,
      pararDeSustentar: AcoesInvestigacaoApp.#pararDeSustentar,
      usarLaser: AcoesInvestigacaoApp.#usarLaser,
      examinar: AcoesInvestigacaoApp.#examinar,
      interagir: AcoesInvestigacaoApp.#interagir,
      usarFerramenta: AcoesInvestigacaoApp.#usarFerramenta,
      usarLaboratorio: AcoesInvestigacaoApp.#usarLaboratorio,
      usarRadio: AcoesInvestigacaoApp.#usarRadio,
      arrombar: AcoesInvestigacaoApp.#arrombar,
      destrancar: AcoesInvestigacaoApp.#destrancar,
      hackTecnico: AcoesInvestigacaoApp.#hackTecnico,
      hackSocial: AcoesInvestigacaoApp.#hackSocial,
      desafioGenerico: AcoesInvestigacaoApp.#desafioGenerico,
    },
  };

  static PARTS = {
    corpo: { template: "systems/ordem-paranormal-2e/templates/actor/acoes-investigacao.hbs" },
  };

  /** Hook de `updateActor`, para soltar no fechamento. */
  #hookAtor = null;

  /** @param {Actor} ator */
  constructor(ator, opcoes = {}) {
    super({ id: `op2-acoes-${ator.id}`, ...opcoes });
    this.ator = ator;

    // Investigar grava `estado.poisInvestigados` no personagem, e é isso que
    // libera Examinar/Interagir naquele ponto. Sem reagir ao update do ator os
    // botões ficavam travados até fechar e reabrir a janela (achado em uso real).
    this.#hookAtor = Hooks.on("updateActor", (documento) => {
      if (documento.id === this.ator.id) this.render();
    });
  }

  _onClose(opcoes) {
    super._onClose(opcoes);
    if (this.#hookAtor) Hooks.off("updateActor", this.#hookAtor);
    this.#hookAtor = null;
  }

  get title() {
    return `${game.i18n.localize("OP2.Acoes.Titulo")} — ${this.ator.name}`;
  }

  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    // `data-action` num <select> reage ao próprio clique de abrir e fecha o menu
    // nativo no meio (achado em uso real, no painel) — listener manual, como todo
    // outro <select> do sistema.
    const seletor = this.element.querySelector("[data-seletor-investigacao]");
    seletor?.addEventListener("change", async () => {
      await definirInvestigacaoAtiva(seletor.value);
      this.render();
    });
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
      .map((desafio) => {
        // Só as abordagens que o mestre ligou naquele objeto: porta emperrada não
        // se hackeia, painel eletrônico não se arromba no braço (achado em uso
        // real — os quatro botões apareciam em todo desafio).
        const { abordagens } = desafio.system;
        return {
          uuid: desafio.uuid,
          nome: desafio.name,
          img: desafio.img,
          quebrado: desafio.system.quebrado,
          destrancado: desafio.system.destrancado,
          hackTecnicoResolvido: desafio.system.hackTecnico.resolvido,
          hackSocialResolvido: desafio.system.hackSocial.resolvido,
          genericoResolvido: desafio.system.generico.resolvido,
          genericoRotulo: desafio.system.generico.rotulo?.trim()
            || game.i18n.localize("OP2.Desafio.Generico"),
          abordagens,
          temAlgumaAbordagem: Object.values(abordagens).some(Boolean),
        };
      });

    return {
      atorNome: ator.name,
      temInvestigacao: Boolean(investigacao),
      nomeInvestigacao: investigacao?.name ?? "",
      // O grupo pode estar em mais de uma investigação ao mesmo tempo — dá pra
      // trocar aqui sem voltar pro painel.
      investigacoes: investigacoesVisiveis().map((i) => ({ uuid: i.uuid, nome: i.name })),
      investigacaoAtualUuid: investigacao?.uuid ?? "",
      sustentando: ator.system.estado.sustentando?.ativo ?? false,
      // Ação sem alvo possível não é oferecida: avisar só depois do clique deixa o
      // jogador procurando o que não existe (achado em uso real).
      temAliados: alvosDaCenaAtiva({ exceto: ator, soConectados: true }).length > 0,
      temAlvosDeAtaque: alvosDaCenaAtiva({ exceto: ator, comNpcs: true }).length > 0,
      temRecursos: ator.items.some((i) => ["habilidade", "equipamento", "ferramenta"].includes(i.type)),
      temLaser: temFerramenta(ator.items, "laser"),
      recapitularUsado: investigacao?.system.recapitularUsado ?? null,
      compartilharUsado: investigacao?.system.compartilharUsado ?? null,
      pois,
      desafios,
    };
  }

  /* -- ações ---------------------------------------------------------------- */

  static async #ajudar() { await ajudar(this.ator); }
  static async #atacar() { await atacar(this.ator); }
  static async #usarRecurso() { await usarHabilidadeOuItem(this.ator); }
  static async #recapitular() { await recapitular(this.ator); }
  static async #compartilhar() { await compartilhar(this.ator); }
  static async #alcancar(_evento, alvo) { await alcancar(this.ator, { modo: alvo.dataset.modo }); }
  static async #sustentar() { await sustentar(this.ator); this.render(); }
  static async #pararDeSustentar() { await pararDeSustentar(this.ator); this.render(); }
  static async #usarLaser() { await usarLaser(this.ator); }

  /** Sub-ação de Investigar: mesma lista do quadro, e aqui rola (spec §6.3.1). */
  static async #examinar(_evento, alvo) {
    if (alvo.dataset.pericia) return void await examinar(this.ator, alvo.dataset.poiUuid, alvo.dataset.pericia);
    await dialogoExaminar(this.ator, alvo.dataset.poiUuid);
  }
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
  static async #desafioGenerico(_evento, alvo) { await desafioGenerico(this.ator, alvo.dataset.desafioUuid); this.render(); }
}

export function abrirAcoesInvestigacao(ator) {
  const app = new AcoesInvestigacaoApp(ator);
  app.render({ force: true });
  return app;
}
