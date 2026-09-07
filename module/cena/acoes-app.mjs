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
import {
  investigacaoAtiva, investigacoesVisiveis, definirInvestigacaoAtiva, pontoDoDesafio,
} from "./investigacao-ativa.mjs";
import { temFerramenta } from "./ferramentas.mjs";
import { alvosDaCenaAtiva, alvosMarcados } from "./encerrar-investigacao.mjs";
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
import { guardarRolagem, restaurarRolagem, esquecerRolagem } from "../ui/rolagem.mjs";
import { semPrefixoDoPonto } from "./desafios.mjs";
import { abrirLaboratorio } from "./laboratorio-app.mjs";
import { abrirRadio } from "./radio-app.mjs";
import { renderDoPerfil } from "../ui/perfil.mjs";
import { janelasDeInvestigacao } from "./painel-comum.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Só as abordagens que o mestre ligou naquele objeto: porta emperrada não se
 * hackeia, painel eletrônico não se arromba no braço (achado em uso real — os
 * quatro botões apareciam em todo desafio).
 */
function contextoDoDesafio(desafio, investigacao) {
  const { abordagens } = desafio.system;
  const ponto = pontoDoDesafio(investigacao, desafio.uuid);
  return {
    uuid: desafio.uuid,
    nome: desafio.name,
    img: desafio.img,
    // O ponto a que pertence vem como rótulo acima do nome, e o nome perde o prefixo
    // repetido — a mesma leitura do painel.
    poiNome: ponto?.name ?? "",
    nomeCurto: semPrefixoDoPonto(desafio.name, ponto?.name),
    quebrado: desafio.system.quebrado,
    destrancado: desafio.system.destrancado,
    hackTecnicoResolvido: desafio.system.hackTecnico.resolvido,
    hackSocialResolvido: desafio.system.hackSocial.resolvido,
    genericoResolvido: desafio.system.generico.resolvido,
    sustentarDt: desafio.system.sustentar.dt,
    genericoRotulo: desafio.system.generico.rotulo?.trim() || game.i18n.localize("OP2.Desafio.Generico"),
    abordagens,
    temAlgumaAbordagem: Object.values(abordagens).some(Boolean),
  };
}

const CHAVE_ABA = "op2.acoes.aba";

/** A última aba escolhida; sem registro, os pontos de interesse. */
function abaInicial() {
  try {
    const aba = window.localStorage.getItem(CHAVE_ABA);
    return ["livres", "pontos", "desafios"].includes(aba) ? aba : "pontos";
  } catch {
    return "pontos";
  }
}

/** O corpo da janela de ações rola dentro do `.window-content`, fora da parte. */
/**
 * Depois de a ação rolar, a janela fecha — o jogador escolheu, rolou, acabou (pedido em
 * uso real). Ação cancelada (diálogo fechado, sem alvo: as funções devolvem `null`)
 * deixa a janela onde estava. Navegação e "parar de sustentar" não passam por aqui.
 */
export function fechaDepois(acao) {
  return async function (evento, alvo) {
    const resultado = await acao.call(this, evento, alvo);
    if (resultado !== null && resultado !== false) await this.close();
  };
}

export class AcoesInvestigacaoApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["op2", "op2-acoes"],
    window: { title: "OP2.Acoes.Titulo", icon: "fa-solid fa-magnifying-glass", resizable: true },
    // Larga: é a mesa de ações do personagem, e vai receber mais grupos além dos
    // de investigação.
    position: { width: 640, height: 700 },
    actions: {
      ajudar: fechaDepois(AcoesInvestigacaoApp.#ajudar),
      atacar: fechaDepois(AcoesInvestigacaoApp.#atacar),
      usarRecurso: fechaDepois(AcoesInvestigacaoApp.#usarRecurso),
      recapitular: fechaDepois(AcoesInvestigacaoApp.#recapitular),
      compartilhar: fechaDepois(AcoesInvestigacaoApp.#compartilhar),
      alcancar: fechaDepois(AcoesInvestigacaoApp.#alcancar),
      sustentar: fechaDepois(AcoesInvestigacaoApp.#sustentar),
      sustentarDesafio: fechaDepois(AcoesInvestigacaoApp.#sustentarDesafio),
      pararDeSustentar: AcoesInvestigacaoApp.#pararDeSustentar,
      usarLaser: fechaDepois(AcoesInvestigacaoApp.#usarLaser),
      examinar: fechaDepois(AcoesInvestigacaoApp.#examinar),
      interagir: fechaDepois(AcoesInvestigacaoApp.#interagir),
      irParaDesafios: AcoesInvestigacaoApp.#irParaDesafios,
      usarFerramenta: fechaDepois(AcoesInvestigacaoApp.#usarFerramenta),
      usarLaboratorio: fechaDepois(AcoesInvestigacaoApp.#usarLaboratorio),
      usarRadio: fechaDepois(AcoesInvestigacaoApp.#usarRadio),
      arrombar: fechaDepois(AcoesInvestigacaoApp.#arrombar),
      destrancar: fechaDepois(AcoesInvestigacaoApp.#destrancar),
      hackTecnico: fechaDepois(AcoesInvestigacaoApp.#hackTecnico),
      hackSocial: fechaDepois(AcoesInvestigacaoApp.#hackSocial),
      desafioGenerico: fechaDepois(AcoesInvestigacaoApp.#desafioGenerico),
    },
  };

  static PARTS = {
    corpo: { template: "systems/ordem-paranormal-2e/templates/actor/acoes-investigacao.hbs" },
  };

  /**
   * Três abas: o que o personagem pode fazer agora (livres), os pontos e os desafios.
   * Tudo numa lista só virava uma rolagem sem fim conforme a mesa revela coisas, com
   * desafio misturado no meio dos pontos (achado em uso real).
   */
  static TABS = {
    principal: {
      tabs: [{ id: "livres" }, { id: "pontos" }, { id: "desafios" }],
      initial: "pontos",
      labelPrefix: "OP2.Acoes.Aba",
    },
  };

  /** Filtro por nome, como o do painel: vive na instância. */
  #filtro = "";

  /** @override — a aba escolhida é preferência de tela. */
  changeTab(aba, grupo, opcoes) {
    super.changeTab(aba, grupo, opcoes);
    if (grupo !== "principal") return;
    try {
      window.localStorage.setItem(CHAVE_ABA, aba);
    } catch {
      // Sem storage: dura só esta tela.
    }
  }

  /** Hook de `updateActor`, para soltar no fechamento. */
  #hookAtor = null;

  /** @param {Actor} ator */
  constructor(ator, opcoes = {}) {
    super({ id: `op2-acoes-${ator.id}`, ...opcoes });
    this.tabGroups.principal = abaInicial();
    this.ator = ator;

    // Investigar grava `estado.poisInvestigados` no personagem, e é isso que
    // libera Examinar/Interagir naquele ponto. Sem reagir ao update do ator os
    // botões ficavam travados até fechar e reabrir a janela (achado em uso real).
    this.#hookAtor = Hooks.on("updateActor", (documento) => {
      if (documento.id === this.ator.id) this.render();
    });
    // E o que o mestre libera no painel — ponto ou desafio que deixa de ser oculto,
    // linha aberta, participante novo — chega aqui pelo mesmo conjunto de janelas
    // que o painel usa; antes o jogador fechava e abria de novo (achado em uso real).
    janelasDeInvestigacao.add(this);
  }

  _onClose(opcoes) {
    super._onClose(opcoes);
    esquecerRolagem(this);
    if (this.#hookAtor) Hooks.off("updateActor", this.#hookAtor);
    this.#hookAtor = null;
    janelasDeInvestigacao.delete(this);
  }

  get title() {
    return `${game.i18n.localize("OP2.Acoes.Titulo")} — ${this.ator.name}`;
  }

  /** Agir rerrenderiza a janela — sem isto a lista de pontos voltava ao topo. */
  _preSyncPartState(partId, newElement, priorElement, state) {
    super._preSyncPartState(partId, newElement, priorElement, state);
    guardarRolagem(this, priorElement, state, [""]);
  }

  _syncPartState(partId, newElement, priorElement, state) {
    super._syncPartState(partId, newElement, priorElement, state);
    restaurarRolagem(this);
  }

  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    // A janela é a tela daquele personagem: veste a cor do perfil dele, como a ficha.
    this.element.dataset.perfil = this.ator.system.perfil ?? "";
    restaurarRolagem(this);

    // Filtro por nome: esconde linhas no DOM, sem rerrenderizar. As abas têm um campo
    // cada, e os dois andam juntos.
    for (const campo of this.element.querySelectorAll("[data-filtro-acoes]")) {
      campo.addEventListener("input", () => {
        this.#filtro = campo.value;
        for (const outro of this.element.querySelectorAll("[data-filtro-acoes]")) {
          if (outro !== campo) outro.value = campo.value;
        }
        this.#aplicarFiltro();
      });
    }
    this.#aplicarFiltro();
    // `data-action` num <select> reage ao próprio clique de abrir e fecha o menu
    // nativo no meio (achado em uso real, no painel) — listener manual, como todo
    // outro <select> do sistema.
    const seletor = this.element.querySelector("[data-seletor-investigacao]");
    seletor?.addEventListener("change", async () => {
      await definirInvestigacaoAtiva(seletor.value);
      this.render();
    });
  }

  #aplicarFiltro() {
    const termo = normalizar(this.#filtro);
    for (const linha of this.element.querySelectorAll("[data-acao-card]")) {
      linha.hidden = Boolean(termo) && !normalizar(linha.dataset.nome).includes(termo);
    }
  }

  /**
   * Leva até o card de um ponto (ou desafio): troca de aba, tira o filtro e destaca.
   * O marcador do mapa chama isto quando quem clica é jogador.
   */
  async focarCard(uuid, aba) {
    // Só renderiza quando a janela ainda não está na tela (é o caso do marcador do
    // mapa): rerrenderizar a cada atalho perdia a posição da rolagem e o card em foco.
    if (!this.rendered) await this.render({ force: true });
    if (aba && this.tabGroups.principal !== aba) this.changeTab(aba, "principal");
    this.#filtro = "";
    for (const campo of this.element.querySelectorAll("[data-filtro-acoes]")) campo.value = "";
    this.#aplicarFiltro();
    const card = this.element.querySelector(`[data-acao-card][data-uuid="${uuid}"]`);
    if (!card) return;
    card.hidden = false;
    card.scrollIntoView({ block: "center", behavior: "smooth" });
    card.classList.remove("op2-acoes__linha--foco");
    void card.offsetWidth; // reinicia a animação se o card já estava em foco
    card.classList.add("op2-acoes__linha--foco");
    setTimeout(() => card.classList.remove("op2-acoes__linha--foco"), 2500);
  }

  /** Do ponto para os desafios dele: troca de aba e filtra pelo nome do ponto. */
  static #irParaDesafios(_evento, alvo) {
    this.#filtro = alvo.dataset.nome ?? "";
    this.changeTab("desafios", "principal");
    for (const campo of this.element.querySelectorAll("[data-filtro-acoes]")) campo.value = this.#filtro;
    this.#aplicarFiltro();
  }

  async _prepareContext() {
    const investigacao = investigacaoAtiva();
    const ator = this.ator;

    // POI e desafio que o mestre escondeu não existem para quem age: a lista de
    // alvos aqui é a mesma que o painel mostra para o jogador.
    const ocultosPoi = investigacao?.system.poisOcultos ?? [];
    const ocultosDesafio = investigacao?.system.desafiosOcultos ?? [];

    const desafios = (investigacao?.system.desafios ?? [])
      .filter((uuid) => !ocultosDesafio.includes(uuid))
      .map((uuid) => fromUuidSync(uuid))
      .filter((desafio) => desafio?.type === "desafio-acesso")
      .map((d) => contextoDoDesafio(d, investigacao));
    const desafioPorUuid = new Map(desafios.map((d) => [d.uuid, d]));

    const pois = (investigacao?.system.pois ?? [])
      .filter((uuid) => !ocultosPoi.includes(uuid))
      .map((uuid) => fromUuidSync(uuid))
      .filter((poi) => poi?.type === "ponto-interesse")
      .map((poi) => ({
        uuid: poi.uuid,
        nome: poi.name,
        img: poi.img,
        // Quantos desafios deste ponto estão à vista: um atalho leva à aba Desafios já
        // filtrada por ele. Com os botões do desafio dentro do ponto, as duas coisas se
        // embaralhavam (achado em uso real).
        totalDesafios: (poi.system.desafios ?? []).filter((d) => desafioPorUuid.has(d)).length,
        // Só as ferramentas que ESTE personagem carrega — a reação do POI segue
        // escondida até o uso (spec §9.3).
        ferramentas: FERRAMENTAS_POI
          .filter((chave) => temFerramenta(ator.items, chave))
          .map((chave) => ({ chave, rotulo: game.i18n.localize(`OP2.Ferramenta.Subtipo.${chave}`) })),
      }));


    return {
      atorNome: ator.name,
      temInvestigacao: Boolean(investigacao),
      nomeInvestigacao: investigacao?.name ?? "",
      // O grupo pode estar em mais de uma investigação ao mesmo tempo — dá pra
      // trocar aqui sem voltar pro painel.
      investigacoes: investigacoesVisiveis().map((i) => ({ uuid: i.uuid, nome: i.name })),
      investigacaoAtualUuid: investigacao?.uuid ?? "",
      desafios,
      sustentando: ator.system.estado.sustentando?.ativo ?? false,
      // Ação sem alvo possível não é oferecida: avisar só depois do clique deixa o
      // jogador procurando o que não existe (achado em uso real).
      temAliados: alvosMarcados({ exceto: ator, tipos: ["personagem"] }).length > 0
        || alvosDaCenaAtiva({ exceto: ator }).length > 0,
      temAlvosDeAtaque: alvosMarcados({ exceto: ator }).length > 0
        || alvosDaCenaAtiva({ exceto: ator, comNpcs: true }).length > 0,
      temRecursos: ator.items.some((i) => ["habilidade", "equipamento", "ferramenta"].includes(i.type)),
      temLaser: temFerramenta(ator.items, "laser"),
      recapitularUsado: investigacao?.system.recapitularUsado ?? null,
      compartilharUsado: investigacao?.system.compartilharUsado ?? null,
      pois,
      tabs: this._prepareTabs("principal"),
      contagens: { pontos: pois.length, desafios: desafios.length },
      filtro: this.#filtro,
    };
  }

  /* -- ações ---------------------------------------------------------------- */

  static async #ajudar() { return ajudar(this.ator); }
  static async #atacar() { return atacar(this.ator); }
  static async #usarRecurso() { return usarHabilidadeOuItem(this.ator); }
  static async #recapitular() { return recapitular(this.ator); }
  static async #compartilhar() { return compartilhar(this.ator); }
  static async #alcancar(_evento, alvo) { return alcancar(this.ator, { modo: alvo.dataset.modo }); }
  static async #sustentar() { const r = await sustentar(this.ator); this.render(); return r; }

  /** Sustentar um obstáculo da cena: a DT é a dele (a estante-porta do Ato I). */
  static async #sustentarDesafio(_evento, alvo) {
    const r = await sustentar(this.ator, { desafioUuid: alvo.dataset.desafioUuid });
    this.render();
    return r;
  }
  static async #pararDeSustentar() { await pararDeSustentar(this.ator); this.render(); }
  static async #usarLaser() { return usarLaser(this.ator); }

  /** Sub-ação de Investigar: mesma lista do quadro, e aqui rola (spec §6.3.1). */
  static async #examinar(_evento, alvo) {
    if (alvo.dataset.pericia) return examinar(this.ator, alvo.dataset.poiUuid, alvo.dataset.pericia);
    return dialogoExaminar(this.ator, alvo.dataset.poiUuid);
  }
  static async #interagir(_evento, alvo) { return interagir(this.ator, alvo.dataset.poiUuid); }

  static async #usarFerramenta(_evento, alvo) {
    return usarFerramenta(this.ator, alvo.dataset.poiUuid, alvo.dataset.ferramenta);
  }

  /**
   * Laboratório Portátil é minigame: pede quantos dados o POI exige (spec §9.1). O
   * padrão vem do próprio ponto (`laboratorioDados`, a "sequência mínima" do livro);
   * o mestre ainda pode mudar na hora.
   */
  static async #usarLaboratorio(_evento, alvo) {
    const poi = alvo.dataset.poiUuid ? fromUuidSync(alvo.dataset.poiUuid) : null;
    const padrao = poi?.system?.laboratorioDados ?? 4;
    const qtdDados = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("OP2.Ferramenta.Subtipo.laboratorio") },
      content: `
        <div class="form-group">
          <label>${game.i18n.localize("OP2.Ferramenta.QtdDados")}</label>
          <input type="number" name="qtd" value="${padrao}" min="4" max="6">
        </div>`,
      ok: { callback: (_ev, botao) => Number(botao.form.elements.qtd.value) },
      rejectClose: false,
      render: renderDoPerfil(this.ator),
    });
    if (!qtdDados) return null;
    await abrirLaboratorio(this.ator, qtdDados, alvo.dataset.poiUuid);
    return true;
  }

  static async #usarRadio(_evento, alvo) {
    const resultado = await usarRadio(this.ator, alvo.dataset.poiUuid);
    if (!resultado) return null;
    abrirRadio(resultado);
    return resultado;
  }

  static async #arrombar(_evento, alvo) { const r = await arrombar(this.ator, alvo.dataset.desafioUuid); this.render(); return r; }
  static async #destrancar(_evento, alvo) { abrirDestrancar(alvo.dataset.desafioUuid); return true; }
  static async #hackTecnico(_evento, alvo) { const r = await hackTecnico(this.ator, alvo.dataset.desafioUuid); this.render(); return r; }
  static async #hackSocial(_evento, alvo) { const r = await hackSocial(this.ator, alvo.dataset.desafioUuid); this.render(); return r; }
  static async #desafioGenerico(_evento, alvo) { const r = await desafioGenerico(this.ator, alvo.dataset.desafioUuid); this.render(); return r; }
}

export function abrirAcoesInvestigacao(ator) {
  const app = new AcoesInvestigacaoApp(ator);
  app.render({ force: true });
  return app;
}

/** Comparação de nomes sem acento nem caixa, para o filtro. */
function normalizar(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
