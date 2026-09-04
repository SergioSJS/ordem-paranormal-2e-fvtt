/**
 * O que o Painel de investigação e a ficha da Investigação têm em comum — que é
 * quase tudo (achado em uso real: "não rola colocar essa mesma tela no cadastro?").
 *
 * Uma tela, duas portas. O painel mostra a investigação ativa deste usuário e troca
 * entre as investigações; a ficha mostra o próprio documento e edita nome, imagem e
 * notas. Contexto, ações, abas, arrastar-e-soltar e preferências de tela moram
 * aqui; cada porta só diz qual investigação é (`get investigacao()`).
 *
 * Duas colunas: à esquerda o que muda a cada rodada (em jogo, rodada, ordem de quem
 * age); à direita a cena em abas — Preparação (participantes, roteiro, sobrecarga),
 * Pontos de interesse e Desafios.
 *
 * O jogador vê o que o personagem dele já revelou; o mestre vê tudo, com as DTs e
 * quem revelou o quê. Nenhum dado de regra (DT, reação de ferramenta) vaza para o
 * lado do jogador.
 */
import { SYSTEM_ID } from "../config.mjs";
import { periciasDoQuadro, chaveInfo, danoSobrecarga } from "./investigacao.mjs";
import { semPrefixoDoPonto } from "./desafios.mjs";
import { rodadaRelativa, proximaRodadaDaCena, linhaDaRodada } from "./eventos.mjs";
import { personagensDaCenaAtiva, npcsDaCenaAtiva, encerrarCena } from "./encerrar-investigacao.mjs";
import {
  estaAtiva, alternarAtiva,
  adicionarParticipante, removerParticipante, definirOrdemParticipantes, alternarJaAgiu,
  vincularPoi, removerPoi, vincularDesafio, removerDesafio, alternarOculto, moverParticipante, pontoDoDesafio,
  vincularEvento, removerEvento, eventosDaInvestigacao, dispararEvento, reiniciarEvento,
} from "./investigacao-ativa.mjs";
import { rodadaAtual, sobrecargaDaCena, definirSobrecarga, avancarRodada, publicarLinhaDoEvento } from "./rodada.mjs";
import { cicloVisibilidadeInfo, limparRevelacao } from "./acoes-investigacao.mjs";
import { rotuloDePericia } from "../dice/teste.mjs";
import { guardarRolagem, restaurarRolagem, esquecerRolagem } from "../ui/rolagem.mjs";

/**
 * Toda janela aberta que mostra uma investigação — o painel e as fichas — para
 * rerrenderizar quando um ponto, um desafio ou um ator muda.
 * @type {Set<import("../../foundry").ApplicationV2>}
 */
export const janelasDeInvestigacao = new Set();

export function rerrenderizarJanelasDeInvestigacao() {
  for (const janela of janelasDeInvestigacao) {
    if (janela.rendered) janela.render();
  }
}

/**
 * @template {typeof foundry.applications.api.ApplicationV2} Base
 * @param {Base} Base
 */
/**
 * Os contêineres que rolam nesta tela: as duas colunas quando a janela é larga, e a
 * própria raiz da parte quando ela empilha (container query abaixo de ~42rem).
 */
const ROLAGEM = ["", ".op2-painel-lateral", ".op2-painel-principal"];

export function PainelInvestigacaoMixin(Base) {
  class PainelInvestigacaoComum extends Base {
    static DEFAULT_OPTIONS = {
      // Duas colunas (controles + ordem | cena em abas) pedem largura; abaixo de
      // ~42rem o CSS empilha as colunas de novo.
      position: { width: 940, height: 720 },
      // Só gestão: vincular, revelar, ordenar, rodada, sobrecarga. Ação de
      // personagem (investigar, arrombar, ferramenta…) mora na ficha dele
      // (`acoes-app.mjs`) — aqui não dá pra saber quem age.
      actions: {
        abrirPoi: PainelInvestigacaoComum.#abrirPoi,
        removerPoi: PainelInvestigacaoComum.#removerPoi,
        abrirDesafio: PainelInvestigacaoComum.#abrirDesafio,
        removerDesafio: PainelInvestigacaoComum.#removerDesafio,
        ajustarPontuacaoDesafio: PainelInvestigacaoComum.#ajustarPontuacaoDesafio,
        novaRodada: PainelInvestigacaoComum.#novaRodada,
        encerrarCena: PainelInvestigacaoComum.#encerrarCena,
        alternarSobrecarga: PainelInvestigacaoComum.#alternarSobrecarga,
        adicionarLinhaSobrecarga: PainelInvestigacaoComum.#adicionarLinhaSobrecarga,
        removerLinhaSobrecarga: PainelInvestigacaoComum.#removerLinhaSobrecarga,
        criarEvento: PainelInvestigacaoComum.#criarEvento,
        abrirEvento: PainelInvestigacaoComum.#abrirEvento,
        desvincularEvento: PainelInvestigacaoComum.#desvincularEvento,
        dispararEvento: PainelInvestigacaoComum.#dispararEvento,
        reiniciarEvento: PainelInvestigacaoComum.#reiniciarEvento,
        alternarAtiva: PainelInvestigacaoComum.#alternarAtiva,
        removerParticipante: PainelInvestigacaoComum.#removerParticipante,
        alternarJaAgiu: PainelInvestigacaoComum.#alternarJaAgiu,
        alternarOculto: PainelInvestigacaoComum.#alternarOculto,
        cicloVisibilidadeInfo: PainelInvestigacaoComum.#cicloVisibilidadeInfo,
        limparRevelacao: PainelInvestigacaoComum.#limparRevelacao,
        moverParticipante: PainelInvestigacaoComum.#moverParticipante,
        alternarRecolhido: PainelInvestigacaoComum.#alternarRecolhido,
        alternarNotasMestre: PainelInvestigacaoComum.#alternarNotasMestre,
        recolherTodos: PainelInvestigacaoComum.#recolherTodos,
        expandirTodos: PainelInvestigacaoComum.#expandirTodos,
        irParaCard: PainelInvestigacaoComum.#irParaCard,
      },
    };

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

    constructor(...args) {
      super(...args);
      this.tabGroups.principal = abaInicial(game.user.isGM);
    }

    /**
     * A investigação que esta janela mostra. O painel devolve a ativa deste
     * usuário; a ficha, o próprio documento.
     * @returns {Actor|null}
     */
    get investigacao() {
      return null;
    }

    /** O personagem através de quem o usuário age e lê as revelações. */
    get atorDaVisao() {
      return game.user.character;
    }

    /** O filtro por nome vive na instância: sobrevive a rerrenderizações. */
    #filtro = "";

    /** @type {DragDrop|null} */
    #dragDrop = null;

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

    /* -- contexto ---------------------------------------------------------- */

    async _prepareContext(opcoes) {
      const base = await super._prepareContext(opcoes);
      const investigacao = this.investigacao;
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

      // Os eventos com roteiro próprio (só o mestre): cada um conta as rodadas a
      // partir do gatilho, então o que importa aqui é se já foi disparado e o que vem
      // na próxima rodada DA CENA.
      const eventos = ehGM
        ? eventosDaInvestigacao(investigacao).map((item) => {
          const relativa = rodadaRelativa(item.system, rodada);
          const proxima = proximaRodadaDaCena(item.system, rodada);
          return {
            uuid: item.uuid,
            nome: item.name,
            img: item.img,
            disparado: item.system.disparado,
            rodadaInicial: item.system.rodadaInicial,
            relativa: Math.max(relativa, 0),
            totalRodadas: item.system.rodadas.length,
            proximaDaCena: proxima,
            proximaEhAgora: proxima === rodada,
          };
        })
        : [];

      const contexto = {
        ...base,
        temInvestigacao: Boolean(investigacao),
        // Os desafios vêm antes: o card de cada ponto lista os seus (`poi.system.desafios`).
        pois: [],
        nomeInvestigacao: investigacao?.name ?? "",
        investigacaoEstaEmJogo: investigacao ? estaAtiva(investigacao) : false,
        rodada,
        ehGM,
        travas,
        temPersonagem: Boolean(this.atorDaVisao),
        filtro: this.#filtro,
        // Toda seção nasce recolhida; o que o usuário abriu fica guardado no navegador.
        secoes: lerSecoes(),
        tabs: this._prepareTabs("principal"),
        desafios: investigacao ? await this.#contextoDesafios(investigacao, ehGM) : [],
        ordem: this.#contextoOrdem(investigacao, ehGM),
        participantes: this.#contextoParticipantes(investigacao, ehGM),
        sobrecarga: {
          ...sobrecarga,
          // O dano que aplica ao encerrar a rodada atual.
          proximoDano: danoSobrecarga(sobrecarga.tabela, Math.max(rodada, 1)),
          tabela: sobrecarga.tabela.map((linha, indice) => ({ ...linha, indice })),
        },
        eventos,
        // O que a próxima rodada traz, na coluna dos controles: os eventos moram na
        // aba de Preparação, mas "Nova rodada" se decide à esquerda.
        proximoEvento: eventos.map((e) => e.proximaDaCena).filter((r) => r !== null).sort((a, b) => a - b)[0] ?? null,
      };
      contexto.pois = investigacao ? await this.#contextoPois(investigacao, ehGM, contexto.desafios) : [];
      contexto.contagens = { pontos: contexto.pois.length, desafios: contexto.desafios.length };
      return contexto;
    }

    /**
     * Preparo antecipado (mestre vincula antes da mesa) não deveria aparecer para
     * os jogadores na hora — oculto some da visão deles em toda seção, não só
     * marca um badge (achado em uso real).
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

    async #contextoPois(investigacao, ehGM, desafios = []) {
      const editor = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
      const pois = [];
      const desafioPorUuid = new Map(desafios.map((d) => [d.uuid, d]));
      const recolhidos = lerLista(CHAVE_RECOLHIDOS);
      const notas = lerLista(CHAVE_NOTAS);
      const personagens = personagensDaCenaAtiva(investigacao);
      for (const uuid of investigacao.system.pois) {
        const oculto = investigacao.system.poisOcultos.includes(uuid);
        if (oculto && !ehGM) continue;

        const poi = await fromUuid(uuid);
        if (poi?.type !== "ponto-interesse") continue;

        // O resumo do card recolhido: quantas linhas já chegaram a alguém, sobre o
        // total. Para o mestre, é o que está aberto ou que algum personagem
        // descobriu; para o jogador, o que ele mesmo vê.
        const descobertaPorAlguem = (info) => personagens
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
          // Os desafios deste ponto que estão na investigação (e visíveis para quem vê).
          desafios: (poi.system.desafios ?? []).map((d) => desafioPorUuid.get(d)).filter(Boolean),
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
                  ? personagens
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
        const ponto = pontoDoDesafio(investigacao, desafio.uuid);
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
          // O ponto a que pertence, se algum ponto da investigação o lista.
          poiNome: ponto?.name ?? "",
          poiUuid: ponto?.uuid ?? "",
          // Os desafios se chamam "<Ponto> — <Coisa>": com o ponto logo acima, o
          // prefixo só repete. O nome inteiro fica na dica e no filtro.
          nomeCurto: semPrefixoDoPonto(desafio.name, ponto?.name),
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
          // A senha é do mestre: aparece no card dele para acompanhar os palpites.
          senha: ehGM && abordagens.destrancar ? desafio.system.senha.join(" ") : "",
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
      const roster = [...personagensDaCenaAtiva(investigacao), ...npcsDaCenaAtiva(investigacao)];
      const ids = new Set(roster.map((a) => a.id));
      const gravada = (investigacao?.system.ordemParticipantes ?? [])
        .map((uuid) => fromUuidSync(uuid)?.id).filter((id) => id && ids.has(id));
      const final = [...gravada, ...roster.map((a) => a.id).filter((id) => !gravada.includes(id))];
      const ocultos = investigacao?.system.participantesOcultos ?? [];
      return final.map((id) => game.actors.get(id)).filter(Boolean)
        .filter((a) => ehGM || !ocultos.includes(a.uuid))
        .map((a) => this.#linhaParticipante(a, investigacao));
    }

    /* -- render ------------------------------------------------------------ */

    /**
     * Toda ação de mestre aqui grava no documento e rerrenderiza a janela: sem guardar
     * a rolagem, mostrar/esconder um ponto jogava a lista de volta ao topo (achado em
     * uso real).
     */
    _preSyncPartState(partId, newElement, priorElement, state) {
      super._preSyncPartState(partId, newElement, priorElement, state);
      guardarRolagem(this, priorElement, state, ROLAGEM);
    }

    _syncPartState(partId, newElement, priorElement, state) {
      super._syncPartState(partId, newElement, priorElement, state);
      restaurarRolagem(this);
    }

    /**
     * `dragDrop` em `DEFAULT_OPTIONS` é opção do ApplicationV1 — o ApplicationV2
     * ignora, e o painel ficava com `draggable="true"` no HTML sem nenhum handler
     * ligado: arrastar não reordenava nada (achado em uso real). O caminho do V2 é
     * este, o mesmo das fichas do core: uma instância de DragDrop criada aqui e
     * religada a cada render. Na ficha, este getter substitui o do ActorSheetV2 —
     * senão o drop disparava duas vezes, uma por instância.
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

    _onRender(contexto, opcoes) {
      super._onRender(contexto, opcoes);
      janelasDeInvestigacao.add(this);
      this._dragDrop.bind(this.element);

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

      if (game.user.isGM) {
        // A tabela de sobrecarga e o roteiro gravam na investigação a cada campo editado.
        for (const campo of this.element.querySelectorAll("[data-sobrecarga-campo]")) {
          campo.addEventListener("change", () => this.#gravarTabela());
        }
        }

      // De novo no fim: o filtro e as classes acima mudam a altura do conteúdo, e a
      // rolagem restaurada na troca do HTML seria cortada pela altura antiga.
      restaurarRolagem(this);
    }

    _onClose(opcoes) {
      janelasDeInvestigacao.delete(this);
      esquecerRolagem(this);
      return super._onClose(opcoes);
    }

    #aplicarFiltro() {
      const termo = normalizar(this.#filtro);
      for (const card of this.element.querySelectorAll(".op2-painel-pontos [data-poi-card]")) {
        card.hidden = Boolean(termo) && !normalizar(card.dataset.nome).includes(termo);
      }
    }

    async #gravarTabela() {
      const investigacao = this.investigacao;
      if (!investigacao) return;
      const tabela = [...this.element.querySelectorAll("[data-sobrecarga-linha]")]
        .map((linha) => ({
          rodada: Number(linha.querySelector("[data-sobrecarga-campo='rodada']")?.value),
          dano: linha.querySelector("[data-sobrecarga-campo='dano']")?.value.trim() || "0",
        }))
        .filter((linha) => linha.rodada > 0);
      await definirSobrecarga({ ...sobrecargaDaCena(investigacao), tabela }, investigacao);
    }

    /* -- preferências de tela ---------------------------------------------- */

    /** Recolher/expandir é preferência de tela: fica no cliente, sem tocar o documento. */
    static #alternarRecolhido(_evento, alvo) {
      const { uuid } = alvo.dataset;
      const recolhido = alternarNaLista(CHAVE_RECOLHIDOS, uuid);
      this.element.querySelector(`[data-poi-card="${uuid}"]`)?.classList.toggle("op2-poi-card--recolhido", recolhido);
    }

    static #alternarNotasMestre(_evento, alvo) {
      const { uuid } = alvo.dataset;
      const aberto = alternarNaLista(CHAVE_NOTAS, uuid);
      const card = this.element.querySelector(`[data-poi-card="${uuid}"]`);
      card?.classList.toggle("op2-poi-card--notas", aberto);
      alvo.classList.toggle("ativo", aberto);
      // Abrir as notas num card recolhido expande o card: as notas ficam no corpo,
      // e sem isto o clique parecia não fazer nada (achado em uso real).
      if (aberto && card?.classList.contains("op2-poi-card--recolhido")) {
        const recolhidos = lerLista(CHAVE_RECOLHIDOS);
        recolhidos.delete(uuid);
        gravarLista(CHAVE_RECOLHIDOS, recolhidos);
        card.classList.remove("op2-poi-card--recolhido");
      }
    }

    static #recolherTodos() {
      const cards = [...this.element.querySelectorAll("[data-poi-card]")];
      gravarLista(CHAVE_RECOLHIDOS, new Set([...lerLista(CHAVE_RECOLHIDOS), ...cards.map((c) => c.dataset.poiCard)]));
      for (const card of cards) card.classList.add("op2-poi-card--recolhido");
    }

    /**
     * Do card do ponto ao card do desafio dele (e vice-versa): troca de aba, expande o
     * card e leva até ele com um destaque — em vez de abrir a ficha (achado em uso
     * real: "seria possível mudar para a aba de desafios e dar foco no desafio?").
     */
    static #irParaCard(_evento, alvo) {
      const { aba, uuid } = alvo.dataset;
      if (aba && this.tabGroups.principal !== aba) this.changeTab(aba, "principal");
      const card = this.element.querySelector(`[data-poi-card="${uuid}"]`);
      if (!card) return;
      if (card.classList.contains("op2-poi-card--recolhido")) {
        const recolhidos = lerLista(CHAVE_RECOLHIDOS);
        recolhidos.delete(uuid);
        gravarLista(CHAVE_RECOLHIDOS, recolhidos);
        card.classList.remove("op2-poi-card--recolhido");
      }
      card.hidden = false;
      esquecerRolagem(this);
      card.scrollIntoView({ block: "center", behavior: "smooth" });
      card.classList.remove("op2-poi-card--foco");
      void card.offsetWidth; // reinicia a animação se o card já estava em foco
      card.classList.add("op2-poi-card--foco");
      setTimeout(() => card.classList.remove("op2-poi-card--foco"), 2500);
    }

    static #expandirTodos() {
      const cards = [...this.element.querySelectorAll("[data-poi-card]")];
      const lista = lerLista(CHAVE_RECOLHIDOS);
      for (const card of cards) { lista.delete(card.dataset.poiCard); card.classList.remove("op2-poi-card--recolhido"); }
      gravarLista(CHAVE_RECOLHIDOS, lista);
    }

    /* -- arrastar e soltar ------------------------------------------------- */

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

      const investigacao = this.investigacao;
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
        if (item?.type === "evento") return vincularEvento(investigacao, item.uuid);
      }
    }

    /** Solta a linha arrastada na posição do alvo, na lista única da rodada. */
    async #reordenar(atorUuid, evento) {
      if (!game.user.isGM) return;
      const investigacao = this.investigacao;
      if (!investigacao) return;

      // `ehGM: true` — arrastar já exige ser mestre, e a ordem gravada não pode
      // perder quem está oculto só porque a leitura de contexto filtraria a linha.
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

    /* -- gestão ------------------------------------------------------------ */

    static async #abrirPoi(_evento, alvo) {
      const poi = await fromUuid(alvo.dataset.poiUuid);
      poi?.sheet?.render(true);
    }

    static async #removerPoi(_evento, alvo) {
      const investigacao = this.investigacao;
      if (investigacao) await removerPoi(investigacao, alvo.dataset.poiUuid);
    }

    static async #abrirDesafio(_evento, alvo) {
      const desafio = await fromUuid(alvo.dataset.desafioUuid);
      desafio?.sheet?.render(true);
    }

    static async #removerDesafio(_evento, alvo) {
      const investigacao = this.investigacao;
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
      await avancarRodada(this.investigacao);
    }

    static async #encerrarCena() {
      await encerrarCena({ investigacao: this.investigacao });
    }

    static async #alternarSobrecarga(_evento, alvo) {
      const investigacao = this.investigacao;
      if (investigacao) await definirSobrecarga({ ...sobrecargaDaCena(investigacao), ativa: alvo.checked }, investigacao);
    }

    static async #adicionarLinhaSobrecarga() {
      const investigacao = this.investigacao;
      if (!investigacao) return;
      const sobrecarga = sobrecargaDaCena(investigacao);
      const ultima = sobrecarga.tabela.at(-1);
      await definirSobrecarga({
        ...sobrecarga,
        tabela: [...sobrecarga.tabela, { rodada: (ultima?.rodada ?? 0) + 1, dano: ultima?.dano ?? "0" }],
      }, investigacao);
    }

    static async #removerLinhaSobrecarga(_evento, alvo) {
      const investigacao = this.investigacao;
      if (!investigacao) return;
      const sobrecarga = sobrecargaDaCena(investigacao);
      const tabela = sobrecarga.tabela.filter((_linha, indice) => indice !== Number(alvo.dataset.indice));
      await definirSobrecarga({ ...sobrecarga, tabela }, investigacao);
    }

    /** Um evento novo, já vinculado — o mestre escreve o roteiro na ficha dele. */
    static async #criarEvento() {
      if (!game.user.isGM) return;
      const investigacao = this.investigacao;
      if (!investigacao) return;
      const [item] = await Item.createDocuments([{
        name: game.i18n.localize("OP2.Evento.Novo"),
        type: "evento",
        img: `systems/${SYSTEM_ID}/assets/icons/tipos/ponto-interesse.svg`,
      }]);
      await vincularEvento(investigacao, item.uuid);
      item.sheet.render(true);
    }

    static async #abrirEvento(_evento, alvo) {
      (await fromUuid(alvo.dataset.uuid))?.sheet?.render(true);
    }

    static async #desvincularEvento(_evento, alvo) {
      const investigacao = this.investigacao;
      if (investigacao) await removerEvento(investigacao, alvo.dataset.uuid);
    }

    /**
     * O gatilho é ato de mesa: o mestre decide que o grupo achou o Ídolo, e a rodada
     * de agora vira a rodada 0 DO EVENTO (achado em uso real).
     */
    static async #dispararEvento(_evento, alvo) {
      if (!game.user.isGM) return;
      const item = await fromUuid(alvo.dataset.uuid);
      if (item?.type !== "evento") return;
      const rodada = rodadaAtual(this.investigacao);
      await dispararEvento(item, rodada);
      // A rodada 0 é o próprio gatilho: vai para o chat agora, não na rodada seguinte.
      await publicarLinhaDoEvento(item, linhaDaRodada(item.system, rodada));
      ui.notifications.info(game.i18n.format("OP2.Evento.Disparado", { nome: item.name, rodada }));
    }

    static async #reiniciarEvento(_evento, alvo) {
      if (!game.user.isGM) return;
      const item = await fromUuid(alvo.dataset.uuid);
      if (item?.type === "evento") await reiniciarEvento(item);
    }

    /** Liga/desliga se a investigação sendo vista agora está "em jogo" pros jogadores. */
    static async #alternarAtiva() {
      if (!game.user.isGM) return;
      const investigacao = this.investigacao;
      if (investigacao) await alternarAtiva(investigacao);
    }

    static async #removerParticipante(_evento, alvo) {
      const investigacao = this.investigacao;
      if (investigacao) await removerParticipante(investigacao, alvo.dataset.participanteUuid);
    }

    static async #alternarJaAgiu(_evento, alvo) {
      // Grava na Investigação, não no personagem — jogador não é dono desse Actor
      // (achado em uso real: clique de jogador batia em `Actor#update` sem
      // permissão e gerava erro visível). Mesmo dono das outras ações de bastidor
      // (mover na ordem, ocultar) — marcar "já agiu" é bookkeeping do mestre.
      if (!game.user.isGM) return;
      const investigacao = this.investigacao;
      if (investigacao) await alternarJaAgiu(investigacao, alvo.dataset.atorUuid);
    }

    static async #alternarOculto(_evento, alvo) {
      if (!game.user.isGM) return;
      const investigacao = this.investigacao;
      if (investigacao) await alternarOculto(investigacao, alvo.dataset.campo, alvo.dataset.uuid);
    }

    /**
     * Visibilidade de uma linha do quadro — direto daqui, sem abrir a ficha do
     * POI (achado em uso real: mestre preparando tudo numa tela só). Um clique
     * gira rascunho → descobrível → aberta.
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
      const investigacao = this.investigacao;
      if (!investigacao) return;
      // A ordem EXIBIDA (roster + gravada, com quem entrou de novo no fim), não o
      // campo cru: esse começa vazio até o primeiro movimento.
      const ordem = this.#contextoOrdem(investigacao, true).map((a) => a.uuid);
      await moverParticipante(investigacao, ordem, alvo.dataset.atorUuid, Number(alvo.dataset.direcao));
    }
  }

  return PainelInvestigacaoComum;
}

/* ---------------------------------------------------- preferências de tela -- */

const CHAVE_RECOLHIDOS = "op2.painel.recolhidos";
const CHAVE_NOTAS = "op2.painel.notas";
const CHAVE_SECOES = "op2.painel.secoes";
const CHAVE_ABA = "op2.painel.aba";

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
  return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

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
