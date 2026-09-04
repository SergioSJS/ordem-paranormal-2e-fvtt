/**
 * Painel de investigação (spec §6) — a porta de jogo para a investigação ativa
 * deste usuário: troca entre as investigações visíveis, cria uma nova, e mostra a
 * tela comum de `painel-comum.mjs` (rodada, ordem de quem age, pontos, desafios,
 * preparação). A ficha da Investigação é a outra porta para a mesma tela.
 *
 * Nada aqui depende de Scene, token ou canvas: uma investigação pode atravessar
 * vários mapas (achado em uso real).
 */
import { PainelInvestigacaoMixin, rerrenderizarJanelasDeInvestigacao } from "./painel-comum.mjs";
import {
  investigacaoAtiva, todasInvestigacoes, investigacoesVisiveis, definirInvestigacaoAtiva, criarInvestigacao,
} from "./investigacao-ativa.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PainelInvestigacao extends PainelInvestigacaoMixin(HandlebarsApplicationMixin(ApplicationV2)) {
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
    // número (em `painel-comum.mjs`) dá ao core uma altura de verdade pra
    // clampar/redimensionar em vez de brigar com CSS por cima.
    actions: {
      criarInvestigacao: PainelInvestigacao.#criarInvestigacao,
      abrirInvestigacao: PainelInvestigacao.#abrirInvestigacao,
    },
  };

  static PARTS = {
    corpo: { template: "systems/ordem-paranormal-2e/templates/cena/painel-investigacao.hbs" },
  };

  /** A investigação ativa deste usuário — o painel navega entre as visíveis. */
  get investigacao() {
    return investigacaoAtiva();
  }

  async _prepareContext(opcoes) {
    const contexto = await super._prepareContext(opcoes);
    const ehGM = game.user.isGM;
    return {
      ...contexto,
      // Mestre navega/prepara qualquer investigação; jogador só as que o mestre
      // marcou em jogo e onde o personagem dele participa (spec: grupo pode se
      // dividir em investigações diferentes ao mesmo tempo).
      investigacoes: (ehGM ? todasInvestigacoes() : investigacoesVisiveis()).map((i) => ({ uuid: i.uuid, nome: i.name })),
      investigacaoAtivaUuid: this.investigacao?.uuid ?? "",
    };
  }

  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);

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

  /** A ficha é a mesma tela, com nome, imagem e notas editáveis. */
  static async #abrirInvestigacao() {
    this.investigacao?.sheet?.render(true);
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

  // O painel e toda ficha de investigação aberta: são a mesma tela.
  const atualizar = rerrenderizarJanelasDeInvestigacao;
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
