/**
 * A janela de aventuras: o mestre escolhe o PDF do playtest e os atos entram no
 * mundo. É o único passo que o sistema pede — e ele acontece dentro do Foundry.
 *
 * Por que existe (`module/aventura/mundo.mjs` explica o resto): o conteúdo dos atos
 * é texto do livro, que a Licença da Comunidade não deixa redistribuir. O pacote
 * leva o extrator; o texto vem do PDF de quem já tem o material.
 */
import { SYSTEM_ID } from "../config.mjs";
import { LICENCA, SELO } from "../ui/licenca.mjs";
import { linhasDoPdf } from "./pdf.mjs";
import { ATOS, montarEGuardar, aventuraNoMundo, documentoDaAventura } from "./mundo.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class AventurasApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "op2-aventuras",
    classes: ["op2", "op2-aventuras"],
    window: { title: "OP2.Aventuras.Titulo", icon: "fa-solid fa-book-skull", resizable: true },
    position: { width: 640, height: "auto" },
    actions: {
      escolherPdf: AventurasApp.#escolherPdf,
      importar: AventurasApp.#importar,
      abrirAventura: AventurasApp.#abrirAventura,
    },
  };

  static PARTS = {
    corpo: { template: `systems/${SYSTEM_ID}/templates/aventura/aventuras.hbs`, scrollable: [""] },
  };

  /** Estado da tela: o que aconteceu com o último PDF escolhido. */
  #estado = { lendo: false, progresso: "", resultados: null };

  async _prepareContext(opcoes) {
    const contexto = await super._prepareContext(opcoes);
    const atos = ATOS.map((ato) => {
      const resultado = this.#estado.resultados?.find((r) => r.nome === ato.nome);
      const resumo = resultado?.resumo
        ? game.i18n.format(`OP2.Aventuras.Resumo.${ato.nome}`, resultado.resumo) : "";
      return {
        ...ato,
        rotulo: game.i18n.localize(ato.rotulo),
        noMundo: Boolean(aventuraNoMundo(ato.aventura)),
        montado: Boolean(resultado?.ok),
        motivo: resultado && !resultado.ok ? resultado.motivo : null,
        resumo,
        // A conferência do Ato II (o texto de cada ponto contra a tabela de locais de
        // uso): aviso, não erro — o mestre confere no livro.
        problemas: resultado?.problemas ?? [],
      };
    });
    return { ...contexto, atos, ...this.#estado, licenca: LICENCA, selo: SELO };
  }

  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    const campo = this.element.querySelector("[data-pdf]");
    campo?.addEventListener("change", () => this.#lerPdf(campo.files?.[0]));
  }

  static #escolherPdf() {
    this.element.querySelector("[data-pdf]")?.click();
  }

  /** Lê o PDF, monta o que ele traz e guarda no compêndio do mundo. */
  async #lerPdf(arquivo) {
    if (!arquivo) return;
    this.#estado = { lendo: true, progresso: game.i18n.localize("OP2.Aventuras.Lendo"), resultados: null };
    await this.render();

    try {
      const linhas = await linhasDoPdf(arquivo, (pagina, total) => {
        // Um PDF de cem páginas leva alguns segundos: a janela conta em voz alta.
        this.#dizer(game.i18n.format("OP2.Aventuras.Progresso", { pagina, total }));
      });
      this.#dizer(game.i18n.localize("OP2.Aventuras.Montando"));
      this.#estado = { lendo: false, progresso: "", resultados: await montarEGuardar(linhas) };
    } catch (erro) {
      console.error(`${SYSTEM_ID} | aventuras`, erro);
      ui.notifications.error(game.i18n.localize("OP2.Aventuras.ErroLeitura"));
      this.#estado = { lendo: false, progresso: "", resultados: null };
    }
    await this.render();
  }

  #dizer(texto) {
    const barra = this.element?.querySelector("[data-progresso]");
    if (barra) barra.textContent = texto;
  }

  /** Importa a aventura guardada — daqui em diante é o fluxo do próprio Foundry. */
  static async #importar(_evento, alvo) {
    const ato = ATOS.find((a) => a.nome === alvo.dataset.ato);
    const aventura = await documentoDaAventura(ato.aventura);
    if (!aventura) return;
    // Sem o diálogo do core: quem clicou aqui já disse que quer o ato no mundo, e o
    // aviso de sobrescrita do core só aparece quando há o que sobrescrever.
    await aventura.import({ dialog: false });
    ui.notifications.info(game.i18n.format("OP2.Aventuras.Importado", { nome: aventura.name }));
    await this.render();
  }

  /** Abre a ficha da aventura guardada, para quem quiser conferir antes. */
  static async #abrirAventura(_evento, alvo) {
    const ato = ATOS.find((a) => a.nome === alvo.dataset.ato);
    const aventura = await documentoDaAventura(ato.aventura);
    aventura?.sheet.render(true);
  }
}

let instancia = null;

export function abrirAventurasApp() {
  if (!game.user.isGM) return null;
  instancia ??= new AventurasApp();
  instancia.render({ force: true });
  return instancia;
}

/** O menu de configurações: o caminho de volta para quem fechou a janela. */
export function registrarAventuras() {
  game.settings.registerMenu(SYSTEM_ID, "aventuras", {
    name: "OP2.Aventuras.MenuNome",
    label: "OP2.Aventuras.MenuBotao",
    hint: "OP2.Aventuras.MenuAjuda",
    icon: "fa-solid fa-book-skull",
    type: AventurasApp,
    restricted: true,
  });
}
