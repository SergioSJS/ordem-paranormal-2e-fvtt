/**
 * Painel de investigação (spec §6) — atalho de ação rápida para a investigação
 * ativa: as ações de investigação com suas travas de 1×-por-investigação, a ordem
 * das rodadas — sem iniciativa rolada, os jogadores decidem e o mestre arrasta;
 * NPCs por último (spec §5.2) — e o disparo de nova rodada/sobrecarga mental
 * (spec §7.6).
 *
 * Nada aqui depende de Scene, token ou canvas: uma investigação pode atravessar
 * vários mapas (achado em uso real). A ficha da Investigação (Actor) é a
 * superfície de montagem — vincular POIs, desafios e participantes; este painel é
 * a superfície de jogo — testar, arrombar, destrancar, avançar rodada.
 *
 * O jogador vê o que o personagem dele já revelou; o mestre vê tudo, com as DTs e
 * quem revelou o quê. Nenhum dado de regra (DT, reação de ferramenta) vaza para o
 * lado do jogador.
 */
import { FERRAMENTAS_POI } from "../config.mjs";
import { periciasDoQuadro, chaveInfo, danoSobrecarga } from "./investigacao.mjs";
import { temFerramenta } from "./ferramentas.mjs";
import { usarFerramenta, usarLaser } from "./acoes-ferramenta.mjs";
import { abrirLaboratorio } from "./laboratorio-app.mjs";
import { personagensDaCenaAtiva, npcsDaCenaAtiva, encerrarCena } from "./encerrar-investigacao.mjs";
import {
  investigacaoAtiva, todasInvestigacoes, definirInvestigacaoAtiva, criarInvestigacao,
  adicionarParticipante, removerParticipante, definirOrdemParticipantes,
  vincularPoi, removerPoi, vincularDesafio, removerDesafio,
} from "./investigacao-ativa.mjs";
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
      selecionarInvestigacao: PainelInvestigacao.#selecionarInvestigacao,
      criarInvestigacao: PainelInvestigacao.#criarInvestigacao,
      abrirInvestigacao: PainelInvestigacao.#abrirInvestigacao,
      removerParticipante: PainelInvestigacao.#removerParticipante,
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
    const investigacao = investigacaoAtiva();
    const ehGM = game.user.isGM;
    const ator = this.atorDaVisao;
    const sobrecarga = sobrecargaDaCena(investigacao);
    const rodada = rodadaAtual(investigacao);

    return {
      temInvestigacao: Boolean(investigacao),
      nomeInvestigacao: investigacao?.name ?? "",
      investigacoes: todasInvestigacoes().map((i) => ({ uuid: i.uuid, nome: i.name })),
      investigacaoAtivaUuid: investigacao?.uuid ?? "",
      rodada,
      ehGM,
      temPersonagem: Boolean(ator),
      atorNome: ator?.name ?? null,
      sustentando: ator?.system.estado.sustentando?.ativo ?? false,
      temLaser: ator ? temFerramenta(ator.items, "laser") : false,
      pois: investigacao ? await this.#contextoPois(investigacao, ator, ehGM) : [],
      desafios: investigacao ? this.#contextoDesafios(investigacao) : [],
      ordem: this.#contextoOrdem(investigacao),
      npcs: npcsDaCenaAtiva().map((a) => ({ id: a.id, nome: a.name, img: a.img })),
      participantes: this.#contextoParticipantes(investigacao),
      recapitularUsado: investigacao?.system.recapitularUsado ?? null,
      compartilharUsado: investigacao?.system.compartilharUsado ?? null,
      sobrecarga: {
        ...sobrecarga,
        // O dano que aplica ao encerrar a rodada atual.
        proximoDano: danoSobrecarga(sobrecarga.tabela, Math.max(rodada, 1)),
        tabela: sobrecarga.tabela.map((linha, indice) => ({ ...linha, indice })),
      },
    };
  }

  /** Roster da investigação (spec §5.1) — não depende de token em Scene nenhuma. */
  #contextoParticipantes(investigacao) {
    return (investigacao?.system.participantes ?? []).map((uuid) => fromUuidSync(uuid)).filter(Boolean)
      .map((a) => ({ uuid: a.uuid, nome: a.name, img: a.img, tipo: a.type }));
  }

  async #contextoPois(investigacao, ator, ehGM) {
    const editor = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    const pois = [];
    for (const uuid of investigacao.system.pois) {
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

  #contextoDesafios(investigacao) {
    return investigacao.system.desafios.map((uuid) => fromUuidSync(uuid))
      .filter((desafio) => desafio?.type === "desafio-acesso")
      .map((desafio) => ({
        uuid: desafio.uuid,
        nome: desafio.name,
        img: desafio.img,
        pontuacaoAtual: desafio.system.pontuacaoAtual,
        pontuacaoAlvo: desafio.system.pontuacaoAlvo,
        quebrado: desafio.system.quebrado,
        destrancado: desafio.system.destrancado,
      }));
  }

  /**
   * Ordem das rodadas: a gravada na investigação, saneada contra o roster atual —
   * quem saiu do roster some, quem entrou aparece no fim. NPCs nunca entram: agem
   * por último (spec §5.2).
   */
  #contextoOrdem(investigacao) {
    const participantes = personagensDaCenaAtiva();
    const ids = new Set(participantes.map((a) => a.id));
    const gravada = (investigacao?.system.ordemParticipantes ?? [])
      .map((uuid) => fromUuidSync(uuid)?.id).filter((id) => id && ids.has(id));
    const final = [...gravada, ...participantes.map((a) => a.id).filter((id) => !gravada.includes(id))];
    return final.map((id) => game.actors.get(id)).filter(Boolean)
      .map((a) => ({ id: a.id, uuid: a.uuid, nome: a.name, img: a.img }));
  }

  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    if (!game.user.isGM) return;
    // O editor da tabela de sobrecarga grava na investigação a cada campo editado.
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
    evento.dataTransfer.setData("text/plain", JSON.stringify({ tipo: "ordem", atorUuid: linha.dataset.atorOrdem }));
  }

  async _onDrop(evento) {
    let dados;
    try {
      dados = JSON.parse(evento.dataTransfer.getData("text/plain"));
    } catch { return; }
    if (dados?.tipo === "ordem") return this.#reordenar(dados.atorUuid, evento);

    const investigacao = investigacaoAtiva();
    if (!investigacao) {
      ui.notifications.warn(game.i18n.localize("OP2.Painel.SemInvestigacao"));
      return;
    }
    if (dados?.type === "Actor") {
      const ator = await fromUuid(dados.uuid);
      if (["personagem", "npc"].includes(ator?.type)) await adicionarParticipante(investigacao, ator.uuid);
      return;
    }
    if (dados?.type === "Item") {
      const item = await fromUuid(dados.uuid);
      if (item?.type === "desafio-acesso") return vincularDesafio(investigacao, item.uuid);
      if (item?.type === "ponto-interesse") return vincularPoi(investigacao, item.uuid);
    }
  }

  async #reordenar(atorUuid, evento) {
    if (!game.user.isGM) return;
    const investigacao = investigacaoAtiva();
    if (!investigacao) return;

    const ordem = this.#contextoOrdem(investigacao).map((a) => a.uuid).filter((uuid) => uuid !== atorUuid);
    const alvo = evento.target.closest("[data-ator-ordem]");
    if (alvo && alvo.dataset.atorOrdem !== atorUuid) {
      const indice = ordem.indexOf(alvo.dataset.atorOrdem);
      const { top, height } = alvo.getBoundingClientRect();
      const depois = evento.clientY > top + height / 2;
      ordem.splice(indice + (depois ? 1 : 0), 0, atorUuid);
    } else {
      ordem.push(atorUuid);
    }
    await definirOrdemParticipantes(investigacao, ordem);
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
    const investigacao = investigacaoAtiva();
    if (investigacao) await removerPoi(investigacao, alvo.dataset.poiUuid);
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
    const investigacao = investigacaoAtiva();
    if (investigacao) await removerDesafio(investigacao, alvo.dataset.desafioUuid);
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

  static async #selecionarInvestigacao(_evento, alvo) {
    if (!game.user.isGM) return;
    await definirInvestigacaoAtiva(alvo.value);
    this.render();
  }

  static async #criarInvestigacao() {
    if (!game.user.isGM) return;
    const nome = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("OP2.Investigacao.Nova") },
      content: `
        <div class="form-group">
          <label>${game.i18n.localize("OP2.Investigacao.Nome")}</label>
          <input type="text" name="nome" value="">
        </div>`,
      ok: { callback: (_ev, botao) => botao.form.elements.nome.value },
      rejectClose: false,
    });
    if (nome === null) return;
    await criarInvestigacao(nome);
    this.render();
  }

  static async #abrirInvestigacao() {
    investigacaoAtiva()?.sheet?.render(true);
  }

  static async #removerParticipante(_evento, alvo) {
    const investigacao = investigacaoAtiva();
    if (investigacao) await removerParticipante(investigacao, alvo.dataset.participanteUuid);
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
  // Tokens não importam mais para o roster, mas atores mudam as revelações.
  for (const gatilho of ["updateActor", "createActor", "deleteActor"]) {
    Hooks.on(gatilho, atualizar);
  }
  for (const gatilho of ["createItem", "updateItem", "deleteItem"]) {
    Hooks.on(gatilho, (item) => {
      if (["ponto-interesse", "desafio-acesso", "ferramenta"].includes(item.type)) atualizar();
    });
  }
}
