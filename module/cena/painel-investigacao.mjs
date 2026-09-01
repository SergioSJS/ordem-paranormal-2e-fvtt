/**
 * Painel de investigação da cena (spec §6).
 *
 * Uma janela por mesa: lista os pontos de interesse vinculados à cena, as ações de
 * investigação com suas travas de 1×-por-cena, a ordem das rodadas — sem iniciativa
 * rolada, os jogadores decidem e o mestre arrasta; NPCs por último (spec §5.2) — e
 * o controle da sobrecarga mental (spec §7.6).
 *
 * O jogador vê o que o personagem dele já revelou; o mestre vê tudo, com as DTs e
 * quem revelou o quê. Nenhum dado de regra (DT, reação de ferramenta) vaza para o
 * lado do jogador.
 */
import { SYSTEM_ID, FERRAMENTAS_POI } from "../config.mjs";
import { periciasDoQuadro, chaveInfo, danoSobrecarga } from "./investigacao.mjs";
import { temFerramenta } from "./ferramentas.mjs";
import { usarFerramenta, usarLaser } from "./acoes-ferramenta.mjs";
import { abrirLaboratorio } from "./laboratorio-app.mjs";
import { personagensDaCenaAtiva, npcsDaCenaAtiva, encerrarCena } from "./encerrar-cena.mjs";
import { rodadaAtual, sobrecargaDaCena, definirSobrecarga, avancarRodada } from "./rodada.mjs";
import {
  dialogoInvestigar, investigar, examinar, interagir, recapitular, compartilhar, idsRevelados,
} from "./acoes-investigacao.mjs";
import { arrombar, alcancar, sustentar, pararDeSustentar } from "./acoes-desafio.mjs";
import { abrirDestrancar } from "./destrancar-app.mjs";
import { rotuloDePericia } from "../dice/teste.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PainelInvestigacao extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "op2-painel-investigacao",
    classes: ["op2", "op2-painel-investigacao"],
    window: {
      title: "OP2.Painel.Titulo",
      icon: "fa-solid fa-magnifying-glass",
      resizable: true,
    },
    position: { width: 640, height: "auto" },
    actions: {
      investigar: PainelInvestigacao.#investigar,
      examinar: PainelInvestigacao.#examinar,
      interagir: PainelInvestigacao.#interagir,
      recapitular: PainelInvestigacao.#recapitular,
      compartilhar: PainelInvestigacao.#compartilhar,
      abrirPoi: PainelInvestigacao.#abrirPoi,
      removerPoi: PainelInvestigacao.#removerPoi,
      arrombar: PainelInvestigacao.#arrombar,
      destrancar: PainelInvestigacao.#destrancar,
      abrirDesafio: PainelInvestigacao.#abrirDesafio,
      removerDesafio: PainelInvestigacao.#removerDesafio,
      alcancar: PainelInvestigacao.#alcancar,
      sustentar: PainelInvestigacao.#sustentar,
      pararDeSustentar: PainelInvestigacao.#pararDeSustentar,
      usarFerramenta: PainelInvestigacao.#usarFerramenta,
      usarLaser: PainelInvestigacao.#usarLaser,
      usarLaboratorio: PainelInvestigacao.#usarLaboratorio,
      novaRodada: PainelInvestigacao.#novaRodada,
      encerrarCena: PainelInvestigacao.#encerrarCena,
      alternarSobrecarga: PainelInvestigacao.#alternarSobrecarga,
      adicionarLinhaSobrecarga: PainelInvestigacao.#adicionarLinhaSobrecarga,
      removerLinhaSobrecarga: PainelInvestigacao.#removerLinhaSobrecarga,
    },
    dragDrop: [{ dragSelector: "[data-ator-ordem]", dropSelector: ".op2-painel-corpo" }],
  };

  static PARTS = {
    corpo: { template: "systems/ordem-paranormal-2e/templates/cena/painel-investigacao.hbs" },
  };

  /** O personagem através de quem o usuário age e lê as revelações. */
  get atorDaVisao() {
    return game.user.character;
  }

  async _prepareContext() {
    const cena = canvas.scene;
    const ehGM = game.user.isGM;
    const ator = this.atorDaVisao;
    const sobrecarga = sobrecargaDaCena(cena);
    const rodada = rodadaAtual(cena);

    return {
      temCena: Boolean(cena),
      nomeCena: cena?.name ?? "",
      rodada,
      ehGM,
      temPersonagem: Boolean(ator),
      atorNome: ator?.name ?? null,
      sustentando: ator?.system.estado.sustentando?.ativo ?? false,
      temLaser: ator ? temFerramenta(ator.items, "laser") : false,
      pois: cena ? await this.#contextoPois(cena, ator, ehGM) : [],
      desafios: cena ? await this.#contextoDesafios(cena) : [],
      ordem: this.#contextoOrdem(cena),
      npcs: npcsDaCenaAtiva().map((a) => ({ id: a.id, nome: a.name, img: a.img })),
      recapitularUsado: cena?.getFlag(SYSTEM_ID, "recapitularUsado") ?? null,
      compartilharUsado: cena?.getFlag(SYSTEM_ID, "compartilharUsado") ?? null,
      sobrecarga: {
        ...sobrecarga,
        // O dano que aplica ao encerrar a rodada atual.
        proximoDano: danoSobrecarga(sobrecarga.tabela, Math.max(rodada, 1)),
        tabela: sobrecarga.tabela.map((linha, indice) => ({ ...linha, indice })),
      },
    };
  }

  async #contextoPois(cena, ator, ehGM) {
    const editor = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    const pois = [];
    for (const uuid of cena.getFlag(SYSTEM_ID, "pois") ?? []) {
      const poi = await fromUuid(uuid);
      if (poi?.type !== "ponto-interesse") continue;

      const reveladas = ator ? idsRevelados(ator, uuid) : new Set();
      const investigado = ator?.system.estado.poisInvestigados.has(uuid) ?? false;
      const verQuadro = ehGM || investigado;

      // Ferramentas do jogador que valem a pena tentar neste POI (spec §9.3): a
      // reação em si fica oculta até o uso — só a lista do que ele carrega aparece.
      const ferramentasDisponiveis = (verQuadro && ator)
        ? FERRAMENTAS_POI.filter((chave) => temFerramenta(ator.items, chave))
          .map((chave) => ({ chave, rotulo: game.i18n.localize(`OP2.Ferramenta.Subtipo.${chave}`) }))
        : [];

      pois.push({
        uuid,
        nome: poi.name,
        img: poi.img,
        verQuadro,
        reveladoPorLaser: poi.system.reveladoPorLaser,
        ferramentasDisponiveis,
        descricaoBasica: verQuadro
          ? await editor.enrichHTML(poi.system.descricaoBasica, { relativeTo: poi })
          : null,
        quadro: verQuadro ? periciasDoQuadro(poi.system.informacoes).map((chave) => ({
          chave,
          rotulo: rotuloDePericia(chave),
          valor: ator?.system.resolverChave(chave)?.valor ?? null,
          infos: poi.system.informacoes
            .filter((info) => info.pericia === chave && (ehGM || reveladas.has(info.id)))
            .map((info) => ({
              ...info,
              // O mestre vê a DT e quem já descobriu cada informação.
              dt: ehGM ? info.dt : null,
              reveladoPor: ehGM
                ? personagensDaCenaAtiva()
                  .filter((a) => a.system.estado.infosReveladas.has(chaveInfo(uuid, info.id)))
                  .map((a) => a.name)
                : [],
            })),
        })) : [],
      });
    }
    return pois;
  }

  async #contextoDesafios(cena) {
    const desafios = [];
    for (const uuid of cena.getFlag(SYSTEM_ID, "desafios") ?? []) {
      const desafio = await fromUuid(uuid);
      if (desafio?.type !== "desafio-acesso") continue;
      desafios.push({
        uuid,
        nome: desafio.name,
        img: desafio.img,
        pontuacaoAtual: desafio.system.pontuacaoAtual,
        pontuacaoAlvo: desafio.system.pontuacaoAlvo,
        quebrado: desafio.system.quebrado,
        destrancado: desafio.system.destrancado,
      });
    }
    return desafios;
  }

  /**
   * Ordem das rodadas: a gravada na cena, saneada contra quem tem token agora —
   * quem saiu some, quem chegou entra no fim. NPCs nunca entram: agem por último.
   */
  #contextoOrdem(cena) {
    const naCena = personagensDaCenaAtiva();
    const ids = new Set(naCena.map((a) => a.id));
    const gravada = (cena?.getFlag(SYSTEM_ID, "ordemRodada") ?? []).filter((id) => ids.has(id));
    const final = [...gravada, ...naCena.map((a) => a.id).filter((id) => !gravada.includes(id))];
    return final.map((id) => game.actors.get(id)).filter(Boolean)
      .map((a) => ({ id: a.id, nome: a.name, img: a.img }));
  }

  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    if (!game.user.isGM) return;
    // O editor da tabela de sobrecarga grava na cena a cada campo editado.
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
    await definirSobrecarga({ ...sobrecargaDaCena(), tabela });
  }

  /* -- arrastar e soltar -------------------------------------------------- */

  _onDragStart(evento) {
    const linha = evento.target.closest("[data-ator-ordem]");
    if (!linha) return;
    evento.dataTransfer.setData("text/plain", JSON.stringify({ tipo: "ordem", atorId: linha.dataset.atorOrdem }));
  }

  async _onDrop(evento) {
    let dados;
    try {
      dados = JSON.parse(evento.dataTransfer.getData("text/plain"));
    } catch { return; }
    if (dados?.tipo === "ordem") return this.#reordenar(dados.atorId, evento);
    if (dados?.type === "Item") {
      const item = await fromUuid(dados.uuid);
      if (item?.type === "desafio-acesso") return this.#vincularDesafio(item.uuid);
      return this.#vincularPoi(dados.uuid);
    }
  }

  async #reordenar(atorId, evento) {
    if (!game.user.isGM) return;
    const cena = canvas.scene;
    if (!cena) return;

    const ordem = this.#contextoOrdem(cena).map((a) => a.id).filter((id) => id !== atorId);
    const alvo = evento.target.closest("[data-ator-ordem]");
    if (alvo && alvo.dataset.atorOrdem !== atorId) {
      const indice = ordem.indexOf(alvo.dataset.atorOrdem);
      const { top, height } = alvo.getBoundingClientRect();
      const depois = evento.clientY > top + height / 2;
      ordem.splice(indice + (depois ? 1 : 0), 0, atorId);
    } else {
      ordem.push(atorId);
    }
    await cena.setFlag(SYSTEM_ID, "ordemRodada", ordem);
  }

  async #vincularPoi(uuid) {
    if (!game.user.isGM) return;
    const poi = await fromUuid(uuid);
    if (poi?.type !== "ponto-interesse") {
      ui.notifications.warn(game.i18n.localize("OP2.Aviso.POIAusente"));
      return;
    }
    const cena = canvas.scene;
    if (!cena) return;
    const pois = cena.getFlag(SYSTEM_ID, "pois") ?? [];
    if (pois.includes(poi.uuid)) return;
    await cena.setFlag(SYSTEM_ID, "pois", [...pois, poi.uuid]);
  }

  async #vincularDesafio(uuid) {
    if (!game.user.isGM) return;
    const cena = canvas.scene;
    if (!cena) return;
    const desafios = cena.getFlag(SYSTEM_ID, "desafios") ?? [];
    if (desafios.includes(uuid)) return;
    await cena.setFlag(SYSTEM_ID, "desafios", [...desafios, uuid]);
  }

  /* -- ações --------------------------------------------------------------- */

  #atorOuAviso() {
    const ator = this.atorDaVisao;
    if (!ator) ui.notifications.warn(game.i18n.localize("OP2.Painel.SemPersonagem"));
    return ator;
  }

  static async #investigar(_evento, alvo) {
    const ator = this.#atorOuAviso();
    if (!ator) return;
    const { poiUuid, pericia } = alvo.dataset;
    if (pericia) await investigar(ator, poiUuid, pericia);
    else await dialogoInvestigar(ator, poiUuid);
  }

  static async #examinar(_evento, alvo) {
    const ator = this.#atorOuAviso();
    if (!ator) return;
    await examinar(ator, alvo.dataset.poiUuid, alvo.dataset.pericia);
  }

  static async #interagir(_evento, alvo) {
    const ator = this.#atorOuAviso();
    if (!ator) return;
    await interagir(ator, alvo.dataset.poiUuid);
  }

  static async #recapitular() {
    const ator = this.#atorOuAviso();
    if (ator) await recapitular(ator);
  }

  static async #compartilhar() {
    const ator = this.#atorOuAviso();
    if (ator) await compartilhar(ator);
  }

  static async #abrirPoi(_evento, alvo) {
    const poi = await fromUuid(alvo.dataset.poiUuid);
    poi?.sheet?.render(true);
  }

  static async #removerPoi(_evento, alvo) {
    const cena = canvas.scene;
    if (!cena) return;
    const pois = (cena.getFlag(SYSTEM_ID, "pois") ?? []).filter((uuid) => uuid !== alvo.dataset.poiUuid);
    await cena.setFlag(SYSTEM_ID, "pois", pois);
  }

  static async #arrombar(_evento, alvo) {
    const ator = this.#atorOuAviso();
    if (ator) await arrombar(ator, alvo.dataset.desafioUuid);
  }

  static async #destrancar(_evento, alvo) {
    if (!this.#atorOuAviso()) return;
    abrirDestrancar(alvo.dataset.desafioUuid);
  }

  static async #abrirDesafio(_evento, alvo) {
    const desafio = await fromUuid(alvo.dataset.desafioUuid);
    desafio?.sheet?.render(true);
  }

  static async #removerDesafio(_evento, alvo) {
    const cena = canvas.scene;
    if (!cena) return;
    const desafios = (cena.getFlag(SYSTEM_ID, "desafios") ?? [])
      .filter((uuid) => uuid !== alvo.dataset.desafioUuid);
    await cena.setFlag(SYSTEM_ID, "desafios", desafios);
  }

  static async #alcancar(_evento, alvo) {
    const ator = this.#atorOuAviso();
    if (ator) await alcancar(ator, { modo: alvo.dataset.modo });
  }

  static async #sustentar() {
    const ator = this.#atorOuAviso();
    if (ator) await sustentar(ator);
  }

  static async #pararDeSustentar() {
    const ator = this.#atorOuAviso();
    if (ator) await pararDeSustentar(ator);
  }

  static async #usarFerramenta(_evento, alvo) {
    const ator = this.#atorOuAviso();
    if (ator) await usarFerramenta(ator, alvo.dataset.poiUuid, alvo.dataset.ferramenta);
  }

  static async #usarLaser() {
    const ator = this.#atorOuAviso();
    if (ator) await usarLaser(ator);
  }

  /**
   * Laboratório Portátil é um minigame, não uma revelação de texto — pede quantos
   * dados o POI exige (spec §9.1: 4 a 6, decidido pelo mestre para aquele POI) e
   * abre o app dedicado em vez do card genérico de ferramenta.
   */
  static async #usarLaboratorio(_evento, alvo) {
    const ator = this.#atorOuAviso();
    if (!ator) return;

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

    await abrirLaboratorio(ator, qtdDados, alvo.dataset.poiUuid);
  }

  static async #novaRodada() {
    await avancarRodada();
  }

  static async #encerrarCena() {
    await encerrarCena();
  }

  static async #alternarSobrecarga(_evento, alvo) {
    await definirSobrecarga({ ...sobrecargaDaCena(), ativa: alvo.checked });
  }

  static async #adicionarLinhaSobrecarga() {
    const sobrecarga = sobrecargaDaCena();
    const ultima = sobrecarga.tabela.at(-1);
    await definirSobrecarga({
      ...sobrecarga,
      tabela: [...sobrecarga.tabela, { rodada: (ultima?.rodada ?? 0) + 1, dano: ultima?.dano ?? "0" }],
    });
  }

  static async #removerLinhaSobrecarga(_evento, alvo) {
    const sobrecarga = sobrecargaDaCena();
    const tabela = sobrecarga.tabela.filter((_linha, indice) => indice !== Number(alvo.dataset.indice));
    await definirSobrecarga({ ...sobrecarga, tabela });
  }
}

/* -- registro --------------------------------------------------------------- */

let instancia = null;

export function abrirPainelInvestigacao() {
  instancia ??= new PainelInvestigacao();
  instancia.render({ force: true });
  return instancia;
}

export function registrarPainelInvestigacao() {
  Hooks.on("getSceneControlButtons", (controles) => {
    if (Array.isArray(controles)) return; // v13+ entrega um objeto, não um array
    controles["op2-investigacao"] = {
      name: "op2-investigacao",
      title: "OP2.Painel.Controle",
      icon: "fa-solid fa-magnifying-glass",
      order: 99,
      activeTool: "painel",
      tools: {
        painel: {
          name: "painel",
          title: "OP2.Painel.Controle",
          icon: "fa-solid fa-magnifying-glass",
          button: true,
          visible: true,
          onClick: () => abrirPainelInvestigacao(),
        },
      },
    };
  });

  const atualizar = () => { if (instancia?.rendered) instancia.render(); };
  Hooks.on("updateScene", (cena) => { if (cena === canvas.scene) atualizar(); });
  // Tokens e atores mudam o tracker; atores mudam também as revelações.
  for (const gatilho of ["updateActor", "createActor", "deleteActor", "createToken", "deleteToken"]) {
    Hooks.on(gatilho, atualizar);
  }
  for (const gatilho of ["createItem", "updateItem", "deleteItem"]) {
    Hooks.on(gatilho, (item) => {
      if (["ponto-interesse", "desafio-acesso", "ferramenta"].includes(item.type)) atualizar();
    });
  }
  Hooks.on("canvasReady", atualizar);
}
