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
import { SYSTEM_ID } from "../config.mjs";
import { periciasDoQuadro, chaveInfo, danoSobrecarga } from "./investigacao.mjs";
import { personagensDaCenaAtiva, npcsDaCenaAtiva, encerrarCena } from "./encerrar-investigacao.mjs";
import {
  investigacaoAtiva, todasInvestigacoes, investigacoesVisiveis, estaAtiva, alternarAtiva,
  definirInvestigacaoAtiva, criarInvestigacao,
  adicionarParticipante, removerParticipante, definirOrdemParticipantes, alternarJaAgiu,
  vincularPoi, removerPoi, vincularDesafio, removerDesafio, alternarOculto, moverParticipante,
} from "./investigacao-ativa.mjs";
import { rodadaAtual, sobrecargaDaCena, definirSobrecarga, avancarRodada } from "./rodada.mjs";
import { cicloVisibilidadeInfo, limparRevelacao } from "./acoes-investigacao.mjs";
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
    // `height: "auto"` deixa o core esticar a janela pelo conteúdo sem limite —
    // com uma investigação cheia a janela passava da tela e nada rolava. Um
    // número, como as fichas de ator já usam, dá ao core uma altura de verdade
    // pra clampar/redimensionar em vez de brigar com CSS por cima.
    // Duas colunas (controles + ordem | cena em abas) pedem largura; abaixo de
    // ~42rem o CSS empilha as colunas de novo.
    position: { width: 940, height: 720 },
    // Só gestão: vincular, revelar, ordenar, rodada, sobrecarga. Ação de
    // personagem (investigar, arrombar, ferramenta…) mora na ficha dele
    // (`acoes-app.mjs`) — no painel não dá pra saber quem age.
    actions: {
      abrirPoi: PainelInvestigacao.#abrirPoi,
      removerPoi: PainelInvestigacao.#removerPoi,
      abrirDesafio: PainelInvestigacao.#abrirDesafio,
      removerDesafio: PainelInvestigacao.#removerDesafio,
      ajustarPontuacaoDesafio: PainelInvestigacao.#ajustarPontuacaoDesafio,
      novaRodada: PainelInvestigacao.#novaRodada,
      encerrarCena: PainelInvestigacao.#encerrarCena,
      alternarSobrecarga: PainelInvestigacao.#alternarSobrecarga,
      adicionarLinhaSobrecarga: PainelInvestigacao.#adicionarLinhaSobrecarga,
      removerLinhaSobrecarga: PainelInvestigacao.#removerLinhaSobrecarga,
      criarInvestigacao: PainelInvestigacao.#criarInvestigacao,
      abrirInvestigacao: PainelInvestigacao.#abrirInvestigacao,
      alternarAtiva: PainelInvestigacao.#alternarAtiva,
      removerParticipante: PainelInvestigacao.#removerParticipante,
      alternarJaAgiu: PainelInvestigacao.#alternarJaAgiu,
      alternarOculto: PainelInvestigacao.#alternarOculto,
      cicloVisibilidadeInfo: PainelInvestigacao.#cicloVisibilidadeInfo,
      limparRevelacao: PainelInvestigacao.#limparRevelacao,
      moverParticipante: PainelInvestigacao.#moverParticipante,
      alternarRecolhido: PainelInvestigacao.#alternarRecolhido,
      alternarNotasMestre: PainelInvestigacao.#alternarNotasMestre,
      recolherTodos: PainelInvestigacao.#recolherTodos,
      expandirTodos: PainelInvestigacao.#expandirTodos,
    },
  };

  /** O filtro por nome vive na instância: sobrevive a rerrenderizações do painel. */
  #filtro = "";

  /**
   * A cena em abas, Preparação primeiro: o mestre monta (participantes, roteiro,
   * sobrecarga) antes de jogar. O jogador não tem Preparação — o que ele vê de
   * participantes já está na ordem das rodadas, à esquerda.
   */
  static TABS = {
    principal: {
      tabs: [{ id: "preparacao" }, { id: "pontos" }, { id: "desafios" }],
      initial: "pontos",
      labelPrefix: "OP2.Painel.Aba",
    },
  };

  constructor(opcoes) {
    super(opcoes);
    this.tabGroups.principal = abaInicial(game.user.isGM);
  }

  /** @override — jogador não vê a aba de preparação. */
  _prepareTabs(grupo) {
    if (!game.user.isGM && this.tabGroups[grupo] === "preparacao") this.tabGroups[grupo] = "pontos";
    const abas = super._prepareTabs(grupo);
    if (!game.user.isGM) delete abas.preparacao;
    return abas;
  }

  /** @override — a aba escolhida é preferência de tela: fica no navegador. */
  changeTab(aba, grupo, opcoes) {
    super.changeTab(aba, grupo, opcoes);
    if (grupo === "principal") gravarAba(aba);
  }

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
    const sobrecarga = sobrecargaDaCena(investigacao);
    const rodada = rodadaAtual(investigacao);

    // Travas de 1×-por-investigação (spec §6.4/§6.5) aparecem como estado, não
    // como botão: quem usa Recapitular/Compartilhar é um personagem, pela ficha.
    const travas = [
      ["recapitularUsado", "OP2.Investigacao.Recapitular"],
      ["compartilharUsado", "OP2.Investigacao.Compartilhar"],
    ]
      .map(([campo, chave]) => ({ trava: investigacao?.system[campo], rotulo: game.i18n.localize(chave) }))
      .filter(({ trava }) => trava?.usado)
      .map(({ trava, rotulo }) => ({ rotulo, nome: trava.nome }));

    const contexto = {
      temInvestigacao: Boolean(investigacao),
      nomeInvestigacao: investigacao?.name ?? "",
      // Mestre navega/prepara qualquer investigação; jogador só as que o mestre
      // marcou em jogo e onde o personagem dele participa (spec: grupo pode se
      // dividir em investigações diferentes ao mesmo tempo).
      investigacoes: (ehGM ? todasInvestigacoes() : investigacoesVisiveis()).map((i) => ({ uuid: i.uuid, nome: i.name })),
      investigacaoAtivaUuid: investigacao?.uuid ?? "",
      investigacaoEstaEmJogo: investigacao ? estaAtiva(investigacao) : false,
      rodada,
      ehGM,
      travas,
      // Só para escolher o aviso certo quando não há investigação: jogador sem
      // personagem atribuído vê um texto, jogador com personagem fora de
      // qualquer investigação em jogo vê outro.
      temPersonagem: Boolean(this.atorDaVisao),
      filtro: this.#filtro,
      // Toda seção nasce recolhida; o que o usuário abriu fica guardado no navegador.
      secoes: lerSecoes(),
      tabs: this._prepareTabs("principal"),
      pois: investigacao ? await this.#contextoPois(investigacao, ehGM) : [],
      desafios: investigacao ? await this.#contextoDesafios(investigacao, ehGM) : [],
      ordem: this.#contextoOrdem(investigacao, ehGM),
      participantes: this.#contextoParticipantes(investigacao, ehGM),
      sobrecarga: {
        ...sobrecarga,
        // O dano que aplica ao encerrar a rodada atual.
        proximoDano: danoSobrecarga(sobrecarga.tabela, Math.max(rodada, 1)),
        tabela: sobrecarga.tabela.map((linha, indice) => ({ ...linha, indice })),
      },
      // O roteiro da cena (só o mestre vê): o que acontece em cada rodada marcada, com
      // a próxima em destaque — para ele ver o que vem antes de apertar "Nova rodada".
      eventos: ehGM
        ? [...(investigacao?.system.eventos ?? [])]
          .sort((a, b) => a.rodada - b.rodada)
          .map((e) => ({
            ...e,
            passado: e.rodada < rodada,
            proximo: e.rodada === [...(investigacao?.system.eventos ?? [])]
              .map((x) => x.rodada).filter((r) => r >= rodada).sort((a, b) => a - b)[0],
          }))
        : [],
    };
    // O que a próxima rodada traz, na coluna dos controles: o roteiro mora na aba
    // de Preparação, mas "Nova rodada" se decide à esquerda.
    contexto.proximoEvento = contexto.eventos.find((e) => e.proximo)?.rodada ?? null;
    contexto.contagens = { pontos: contexto.pois.length, desafios: contexto.desafios.length };
    return contexto;
  }

  /**
   * Preparo antecipado (mestre vincula antes da mesa) não deveria aparecer para os
   * jogadores na hora — oculto some da visão deles em toda seção, não só marca um
   * badge (achado em uso real).
   */
  #linhaParticipante(ator, investigacao) {
    const oculto = (investigacao?.system.participantesOcultos ?? []).includes(ator.uuid);
    const jaAgiu = (investigacao?.system.jaAgiram ?? []).includes(ator.uuid);
    return {
      id: ator.id, uuid: ator.uuid, nome: ator.name, img: ator.img, tipo: ator.type,
      ehNpc: ator.type === "npc", jaAgiu, oculto,
    };
  }

  /** Roster da investigação (spec §5.1) — não depende de token em Scene nenhuma. */
  #contextoParticipantes(investigacao, ehGM) {
    const ocultos = investigacao?.system.participantesOcultos ?? [];
    return (investigacao?.system.participantes ?? []).map((uuid) => fromUuidSync(uuid)).filter(Boolean)
      .filter((a) => ehGM || !ocultos.includes(a.uuid))
      .map((a) => this.#linhaParticipante(a, investigacao));
  }

  async #contextoPois(investigacao, ehGM) {
    const editor = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    const pois = [];
    const recolhidos = lerLista(CHAVE_RECOLHIDOS);
    const notas = lerLista(CHAVE_NOTAS);
    for (const uuid of investigacao.system.pois) {
      const oculto = investigacao.system.poisOcultos.includes(uuid);
      if (oculto && !ehGM) continue;

      const poi = await fromUuid(uuid);
      if (poi?.type !== "ponto-interesse") continue;

      // O resumo do card recolhido: quantas linhas já chegaram a alguém, sobre o
      // total. Para o mestre, é o que está aberto ou que algum personagem descobriu;
      // para o jogador, o que ele mesmo vê.
      const descobertaPorAlguem = (info) => personagensDaCenaAtiva()
        .some((a) => a.system.estado.infosReveladas.has(chaveInfo(uuid, info.id)));
      const linhasTotal = poi.system.informacoes.length;
      const linhasVisiveis = poi.system.informacoes.filter((info) => (ehGM
        ? (info.aberta || descobertaPorAlguem(info))
        : (info.aberta || this.#jaDescobriu(uuid, info.id)))).length;

      pois.push({
        uuid,
        nome: poi.name,
        img: poi.img,
        oculto,
        recolhido: recolhidos.has(uuid),
        notasAbertas: notas.has(uuid),
        linhasTotal,
        linhasVisiveis,
        descricaoContextual: ehGM && poi.system.descricaoContextual?.trim()
          ? await editor.enrichHTML(poi.system.descricaoContextual, { relativeTo: poi })
          : "",
        reveladoPorLaser: poi.system.reveladoPorLaser,
        // O mestre controla visibilidade direto pelo olho — deste POI e de cada
        // linha do quadro abaixo — sem depender de o jogador ter investigado
        // antes (achado em uso real: "marco visível e não aparece pro jogador" —
        // o gate de `poisInvestigados` competia com o toggle e escondia o que
        // devia mostrar).
        descricaoBasica: await editor.enrichHTML(poi.system.descricaoBasica, { relativeTo: poi }),
        quadro: periciasDoQuadro(poi.system.informacoes).map((chave) => ({
          chave,
          rotulo: rotuloDePericia(chave),
          infos: poi.system.informacoes
            // O jogador lê o que o mestre abriu e o que o personagem DELE
            // descobriu — nada mais. Antes bastava não ser rascunho pra linha
            // aparecer pronta na tela, e aí não sobrava nada pra procurar
            // (achado em uso real).
            .filter((info) => info.pericia === chave
              && (ehGM || info.aberta || this.#jaDescobriu(uuid, info.id)))
            .map((info) => ({
              ...info,
              // O mestre vê a DT e quem já descobriu cada informação.
              dt: ehGM ? info.dt : null,
              estado: info.oculta ? "rascunho" : (info.aberta ? "aberta" : "descobrivel"),
              // Linha que o jogador só está vendo porque descobriu: marca no card
              // dele também, senão não dá pra distinguir do que o mestre abriu.
              descoberta: !ehGM && !info.aberta,
              reveladoPor: ehGM
                ? personagensDaCenaAtiva()
                  .filter((a) => a.system.estado.infosReveladas.has(chaveInfo(uuid, info.id)))
                  .map((a) => a.name)
                : [],
            })),
        }))
          // Perícia sem nenhuma linha liberada não existe para o jogador: só a
          // presença dela na tela já entregaria que há algo ali para aquela
          // perícia (achado em uso real). O mestre continua vendo o quadro todo.
          .filter((grupo) => ehGM || grupo.infos.length > 0),
      });
    }
    return pois;
  }

  async #contextoDesafios(investigacao, ehGM) {
    const ocultos = investigacao.system.desafiosOcultos;
    const recolhidos = lerLista(CHAVE_RECOLHIDOS);
    const notas = lerLista(CHAVE_NOTAS);
    const editor = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    const rotulos = {
      arrombar: "OP2.Desafio.Arrombar", destrancar: "OP2.Desafio.Destrancar",
      hackTecnico: "OP2.Desafio.HackTecnico", hackSocial: "OP2.Desafio.HackSocial",
      sustentar: "OP2.Desafio.Sustentar",
    };
    const desafios = investigacao.system.desafios.map((uuid) => fromUuidSync(uuid))
      .filter((desafio) => desafio?.type === "desafio-acesso")
      .filter((desafio) => ehGM || !ocultos.includes(desafio.uuid));
    const saida = [];
    for (const desafio of desafios) {
      const { abordagens, generico, hackTecnico, hackSocial } = desafio.system;
      const nota = desafio.flags?.[SYSTEM_ID]?.notaDoMestre ?? "";
      const resolvido = (abordagens.arrombar && desafio.system.pontuacaoAtual >= desafio.system.pontuacaoAlvo)
        || (abordagens.destrancar && desafio.system.destrancado)
        || (abordagens.hackTecnico && hackTecnico.resolvido)
        || (abordagens.hackSocial && hackSocial.resolvido)
        || (abordagens.generico && generico.resolvido);
      saida.push({
        uuid: desafio.uuid,
        nome: desafio.name,
        img: desafio.img,
        oculto: ocultos.includes(desafio.uuid),
        recolhido: recolhidos.has(desafio.uuid),
        notasAbertas: notas.has(desafio.uuid),
        abordagens: Object.entries(rotulos).filter(([chave]) => abordagens[chave]).map(([, chave]) => game.i18n.localize(chave))
          .concat(abordagens.generico ? [generico.rotulo || game.i18n.localize("OP2.Desafio.Generico")] : []),
        temArrombar: abordagens.arrombar,
        temDestrancar: abordagens.destrancar,
        temHackTecnico: abordagens.hackTecnico,
        temHackSocial: abordagens.hackSocial,
        temSustentar: abordagens.sustentar,
        temGenerico: abordagens.generico,
        genericoRotulo: generico.rotulo || game.i18n.localize("OP2.Desafio.Generico"),
        genericoResolvido: generico.resolvido,
        dtObjeto: desafio.system.dtObjeto,
        sustentarDt: desafio.system.sustentar?.dt,
        pontuacaoAtual: desafio.system.pontuacaoAtual,
        pontuacaoAlvo: desafio.system.pontuacaoAlvo,
        destrancarTentativas: desafio.system.destrancarTentativas,
        maxTentativas: desafio.system.maxTentativas,
        quebrado: desafio.system.quebrado,
        destrancado: desafio.system.destrancado,
        hackTecnicoResolvido: hackTecnico.resolvido,
        hackSocialResolvido: hackSocial.resolvido,
        resolvido,
        nota: ehGM && nota.trim() ? await editor.enrichHTML(nota, { relativeTo: desafio }) : "",
      });
    }
    return saida;
  }

  /** O personagem desta visão já descobriu esta linha? */
  #jaDescobriu(poiUuid, infoId) {
    return Boolean(this.atorDaVisao?.system.estado.infosReveladas.has(chaveInfo(poiUuid, infoId)));
  }

  /**
   * Ordem das rodadas: a gravada em `ordemParticipantes`, saneada contra o roster
   * atual — quem saiu some, quem entrou aparece no fim.
   *
   * Uma lista só, personagens e NPCs misturados. Separar por tipo (NPCs sempre
   * depois, spec §5.2) deixava a linha do NPC imóvel na prática — com um NPC só,
   * as duas setas dele nasciam desabilitadas e ele não saía do lugar (achado em
   * uso real: "os NPCs estão inativos, não é possível mover na ordem"). Quem age
   * quando é decisão de mesa; o sistema guarda a ordem que a mesa montou.
   */
  #contextoOrdem(investigacao, ehGM) {
    const roster = [...personagensDaCenaAtiva(), ...npcsDaCenaAtiva()];
    const ids = new Set(roster.map((a) => a.id));
    const gravada = (investigacao?.system.ordemParticipantes ?? [])
      .map((uuid) => fromUuidSync(uuid)?.id).filter((id) => id && ids.has(id));
    const final = [...gravada, ...roster.map((a) => a.id).filter((id) => !gravada.includes(id))];
    const ocultos = investigacao?.system.participantesOcultos ?? [];
    return final.map((id) => game.actors.get(id)).filter(Boolean)
      .filter((a) => ehGM || !ocultos.includes(a.uuid))
      .map((a) => this.#linhaParticipante(a, investigacao));
  }

  /**
   * `dragDrop` em `DEFAULT_OPTIONS` é opção do ApplicationV1 — o ApplicationV2
   * ignora, e o painel ficava com `draggable="true"` no HTML sem nenhum handler
   * ligado: arrastar não reordenava nada (achado em uso real). O caminho do V2 é
   * este, o mesmo das fichas do core: uma instância de DragDrop criada aqui e
   * religada a cada render.
   */
  get _dragDrop() {
    return this.#dragDrop ??= new foundry.applications.ux.DragDrop.implementation({
      dragSelector: "[data-ator-ordem]",
      dropSelector: ".op2-painel-corpo",
      // Reordenar e vincular POI/desafio/participante são atos de mestre — e
      // gravam na investigação, que o jogador não tem permissão de atualizar.
      permissions: {
        dragstart: () => game.user.isGM,
        drop: () => game.user.isGM,
      },
      callbacks: {
        dragstart: this._onDragStart.bind(this),
        drop: this._onDrop.bind(this),
      },
    });
  }

  /** @type {DragDrop|null} */
  #dragDrop = null;

  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    this._dragDrop.bind(this.element);

    // `data-action` liga no framework de ações do ApplicationV2, que reage ao
    // próprio clique de abrir o <select> — o dropdown nativo se fecha sozinho no
    // meio, "piscando" as opções sem deixar escolher (achado em uso real). Todo
    // outro <select> do sistema evita isso com listener manual de `change`; este
    // segue o mesmo caminho.
    // Cada usuário navega entre as investigações visíveis pra ele — o grupo pode
    // se dividir em mais de uma investigação "em jogo" ao mesmo tempo (achado em
    // uso real: dono do ponteiro passou de mundo/GM para cliente/cada usuário).
    const seletor = this.element.querySelector("[data-seletor-investigacao]");
    seletor?.addEventListener("change", async () => {
      await definirInvestigacaoAtiva(seletor.value);
      this.render();
    });

    // Abrir/fechar uma seção é preferência de tela: fica no cliente, por seção.
    for (const secao of this.element.querySelectorAll("details[data-secao]")) {
      secao.addEventListener("toggle", () => gravarSecao(secao.dataset.secao, secao.open));
    }

    // Filtro por nome: só esconde/mostra cards no DOM, sem rerrenderizar.
    const filtro = this.element.querySelector("[data-filtro-pois]");
    filtro?.addEventListener("input", () => {
      this.#filtro = filtro.value;
      this.#aplicarFiltro();
    });
    this.#aplicarFiltro();

    if (!game.user.isGM) return;
    // O editor da tabela de sobrecarga grava na investigação a cada campo editado.
    for (const campo of this.element.querySelectorAll("[data-sobrecarga-campo]")) {
      campo.addEventListener("change", () => this.#gravarTabela());
    }
  }

  #aplicarFiltro() {
    const termo = normalizar(this.#filtro);
    for (const card of this.element.querySelectorAll(".op2-painel-pontos [data-poi-card]")) {
      card.hidden = Boolean(termo) && !normalizar(card.dataset.nome).includes(termo);
    }
  }

  /** Recolher/expandir é preferência de tela: fica no cliente, sem tocar o documento. */
  static #alternarRecolhido(_evento, alvo) {
    const { uuid } = alvo.dataset;
    const recolhido = alternarNaLista(CHAVE_RECOLHIDOS, uuid);
    this.element.querySelector(`[data-poi-card="${uuid}"]`)?.classList.toggle("op2-poi-card--recolhido", recolhido);
  }

  static #alternarNotasMestre(_evento, alvo) {
    const { uuid } = alvo.dataset;
    const aberto = alternarNaLista(CHAVE_NOTAS, uuid);
    this.element.querySelector(`[data-poi-card="${uuid}"]`)?.classList.toggle("op2-poi-card--notas", aberto);
    alvo.classList.toggle("ativo", aberto);
  }

  static #recolherTodos() {
    const cards = [...this.element.querySelectorAll("[data-poi-card]")];
    gravarLista(CHAVE_RECOLHIDOS, new Set([...lerLista(CHAVE_RECOLHIDOS), ...cards.map((c) => c.dataset.poiCard)]));
    for (const card of cards) card.classList.add("op2-poi-card--recolhido");
  }

  static #expandirTodos() {
    const cards = [...this.element.querySelectorAll("[data-poi-card]")];
    const lista = lerLista(CHAVE_RECOLHIDOS);
    for (const card of cards) { lista.delete(card.dataset.poiCard); card.classList.remove("op2-poi-card--recolhido"); }
    gravarLista(CHAVE_RECOLHIDOS, lista);
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

  /** Solta a linha arrastada na posição do alvo, na lista única da rodada. */
  async #reordenar(atorUuid, evento) {
    if (!game.user.isGM) return;
    const investigacao = investigacaoAtiva();
    if (!investigacao) return;

    // `ehGM: true` — arrastar já exige ser mestre, e a ordem gravada não pode perder
    // quem está oculto só porque a leitura de contexto filtraria a linha dele.
    const ordem = this.#contextoOrdem(investigacao, true).map((a) => a.uuid)
      .filter((uuid) => uuid !== atorUuid);

    const alvo = evento.target.closest("[data-ator-ordem]");
    const alvoUuid = alvo?.dataset.atorOrdem;
    if (alvoUuid === atorUuid) return;

    if (alvoUuid) {
      const indice = ordem.indexOf(alvoUuid);
      const { top, height } = alvo.getBoundingClientRect();
      const depois = evento.clientY > top + height / 2;
      ordem.splice(indice + (depois ? 1 : 0), 0, atorUuid);
    } else {
      ordem.push(atorUuid);
    }
    await definirOrdemParticipantes(investigacao, ordem);
  }

  /* -- gestão -------------------------------------------------------------- */

  static async #abrirPoi(_evento, alvo) {
    const poi = await fromUuid(alvo.dataset.poiUuid);
    poi?.sheet?.render(true);
  }

  static async #removerPoi(_evento, alvo) {
    const investigacao = investigacaoAtiva();
    if (investigacao) await removerPoi(investigacao, alvo.dataset.poiUuid);
  }

  static async #abrirDesafio(_evento, alvo) {
    const desafio = await fromUuid(alvo.dataset.desafioUuid);
    desafio?.sheet?.render(true);
  }

  static async #removerDesafio(_evento, alvo) {
    const investigacao = investigacaoAtiva();
    if (investigacao) await removerDesafio(investigacao, alvo.dataset.desafioUuid);
  }

  /**
   * Ajuste rápido de PONTUAÇÃO sem precisar abrir a ficha do desafio nem rolar
   * Arrombar de verdade — bookkeeping de mestre (ex.: alguém arrombou fora do
   * sistema, ou o mestre quer corrigir um valor). Trava em [0, pontuacaoAlvo].
   */
  static async #ajustarPontuacaoDesafio(_evento, alvo) {
    if (!game.user.isGM) return;
    const desafio = await fromUuid(alvo.dataset.desafioUuid);
    if (!desafio) return;
    const novo = Math.max(0, Math.min(desafio.system.pontuacaoAlvo,
      desafio.system.pontuacaoAtual + Number(alvo.dataset.delta)));
    await desafio.update({ "system.pontuacaoAtual": novo });
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

  /** Liga/desliga se a investigação sendo vista agora está "em jogo" pros jogadores. */
  static async #alternarAtiva() {
    if (!game.user.isGM) return;
    const investigacao = investigacaoAtiva();
    if (investigacao) await alternarAtiva(investigacao);
  }

  static async #removerParticipante(_evento, alvo) {
    const investigacao = investigacaoAtiva();
    if (investigacao) await removerParticipante(investigacao, alvo.dataset.participanteUuid);
  }

  static async #alternarJaAgiu(_evento, alvo) {
    // Grava na Investigação, não no personagem — jogador não é dono desse Actor
    // (achado em uso real: clique de jogador batia em `Actor#update` sem permissão
    // e gerava erro visível). Mesmo dono das outras ações de bastidor do painel
    // (mover na ordem, ocultar) — marcar "já agiu" é bookkeeping do mestre.
    if (!game.user.isGM) return;
    const investigacao = investigacaoAtiva();
    if (investigacao) await alternarJaAgiu(investigacao, alvo.dataset.atorUuid);
  }

  static async #alternarOculto(_evento, alvo) {
    if (!game.user.isGM) return;
    const investigacao = investigacaoAtiva();
    if (investigacao) await alternarOculto(investigacao, alvo.dataset.campo, alvo.dataset.uuid);
  }

  /**
   * Visibilidade de uma linha do quadro — direto do painel, sem abrir a ficha do
   * POI (achado em uso real: mestre preparando tudo numa tela só). Um clique gira
   * rascunho → descobrível → aberta.
   */
  static async #cicloVisibilidadeInfo(_evento, alvo) {
    if (!game.user.isGM) return;
    await cicloVisibilidadeInfo(alvo.dataset.poiUuid, alvo.dataset.infoId);
  }

  /**
   * Devolve uma linha do quadro ao estado de não-descoberta, para todo mundo.
   * Antes disso, o único jeito de desfazer era encerrar a cena, que zera tudo
   * (achado em uso real).
   */
  static async #limparRevelacao(_evento, alvo) {
    if (!game.user.isGM) return;
    const nomes = await limparRevelacao(alvo.dataset.poiUuid, alvo.dataset.infoId);
    if (nomes.length) {
      ui.notifications.info(game.i18n.format("OP2.Painel.RevelacaoLimpa", { nomes: nomes.join(", ") }));
    }
    this.render();
  }

  static async #moverParticipante(_evento, alvo) {
    if (!game.user.isGM) return;
    const investigacao = investigacaoAtiva();
    if (!investigacao) return;
    // A ordem EXIBIDA (roster + gravada, com quem entrou de novo no fim), não o
    // campo cru: esse começa vazio até o primeiro movimento.
    const ordem = this.#contextoOrdem(investigacao, true).map((a) => a.uuid);
    await moverParticipante(investigacao, ordem, alvo.dataset.atorUuid, Number(alvo.dataset.direcao));
  }
}

/* -- registro --------------------------------------------------------------- */

let instancia = null;

export function abrirPainelInvestigacao() {
  instancia ??= new PainelInvestigacao();
  instancia.render({ force: true });
  return instancia;
}

/**
 * Botão flutuante que abre o painel — não um controle de cena.
 *
 * O core do v13 nunca dispara o clique de uma tool já ativa: `#onChangeTool`
 * tem `if (tool === this.tool) return` antes de chamar `onChange`/`onClick`
 * (achado em uso real, lendo o fonte do core) — um grupo de controle com uma
 * tool só, marcada como `activeTool`, só dispara na primeiríssima troca de
 * camada e nunca mais, nem trocando `onClick` por `onChange`. Não é bug deste
 * sistema, é como o framework de scene controls é desenhado: pensado pra
 * ferramentas que ficam selecionadas, não pra um botão de ação clicável toda
 * hora. Um elemento próprio, fora do ciclo de controles de cena, não tem esse
 * problema.
 */
/**
 * A barra lateral (#sidebar) expande/recolhe com largura própria em CSS — um
 * `right` fixo em px ou fica embaixo dela expandida, ou sobra vazio com ela
 * recolhida (achado em uso real). Reposiciona contra a borda de verdade da
 * sidebar sempre que ela muda de estado, em vez de chutar um valor fixo.
 */
function reposicionarBotaoFlutuante() {
  const botao = document.getElementById("op2-botao-painel");
  const sidebar = document.getElementById("sidebar");
  if (!botao) return;
  const largura = sidebar?.getBoundingClientRect().width ?? 0;
  botao.style.right = `${largura + 12}px`;
}

function criarBotaoFlutuante() {
  if (document.getElementById("op2-botao-painel")) return;
  const botao = document.createElement("button");
  botao.id = "op2-botao-painel";
  botao.type = "button";
  botao.className = "op2 op2-botao-flutuante";
  botao.dataset.tooltip = game.i18n.localize("OP2.Painel.Controle");
  botao.dataset.tooltipDirection = "LEFT";
  botao.innerHTML = `<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>`;
  botao.addEventListener("click", () => abrirPainelInvestigacao());
  document.body.appendChild(botao);
  reposicionarBotaoFlutuante();

  // A sidebar anima a largura via CSS transition — um atraso fixo lia a largura
  // no meio da animação, não a final (achado em uso real: um `setTimeout(250)`
  // pegava ~48px de uma transição de mais de 250ms e o botão saía por baixo da
  // sidebar aberta). `transitionend` no próprio elemento é a hora certa.
  document.getElementById("sidebar")?.addEventListener("transitionend", reposicionarBotaoFlutuante);
  Hooks.on("collapseSidebar", () => setTimeout(reposicionarBotaoFlutuante, 400));
  Hooks.on("renderSidebar", () => setTimeout(reposicionarBotaoFlutuante, 50));
}

export function registrarPainelInvestigacao() {
  Hooks.once("ready", criarBotaoFlutuante);

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

/* ---------------------------------------------------- preferências de tela -- */

const CHAVE_RECOLHIDOS = "op2.painel.recolhidos";
const CHAVE_NOTAS = "op2.painel.notas";

/** @returns {Set<string>} uuids guardados no navegador deste usuário. */
function lerLista(chave) {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(chave) ?? "[]"));
  } catch {
    return new Set();
  }
}

function gravarLista(chave, lista) {
  try {
    window.localStorage.setItem(chave, JSON.stringify([...lista]));
  } catch {
    // Navegador sem storage: a preferência dura só esta tela.
  }
}

/** Liga/desliga o uuid na lista e devolve o estado novo. */
function alternarNaLista(chave, uuid) {
  const lista = lerLista(chave);
  const ligado = !lista.has(uuid);
  if (ligado) lista.add(uuid); else lista.delete(uuid);
  gravarLista(chave, lista);
  return ligado;
}

/** Comparação de nomes sem acento nem caixa, para o filtro. */
function normalizar(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const CHAVE_ABA = "op2.painel.aba";

/** A última aba escolhida; sem registro, Pontos de interesse. Jogador nunca cai em Preparação. */
function abaInicial(ehGM) {
  let aba = null;
  try {
    aba = window.localStorage.getItem(CHAVE_ABA);
  } catch {
    // Sem storage: começa em Pontos de interesse.
  }
  if (!["preparacao", "pontos", "desafios"].includes(aba)) aba = "pontos";
  return aba === "preparacao" && !ehGM ? "pontos" : aba;
}

function gravarAba(aba) {
  try {
    window.localStorage.setItem(CHAVE_ABA, aba);
  } catch {
    // Sem storage: dura só esta tela.
  }
}

const CHAVE_SECOES = "op2.painel.secoes";

/** @returns {Record<string, boolean>} seção → aberta. Sem registro, fechada. */
function lerSecoes() {
  try {
    const lido = JSON.parse(window.localStorage.getItem(CHAVE_SECOES) ?? "{}");
    return lido && typeof lido === "object" ? lido : {};
  } catch {
    return {};
  }
}

function gravarSecao(nome, aberta) {
  try {
    window.localStorage.setItem(CHAVE_SECOES, JSON.stringify({ ...lerSecoes(), [nome]: aberta }));
  } catch {
    // Sem storage: dura só esta tela.
  }
}
