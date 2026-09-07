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
import { ExtrasApp, extrasDaAventura, arquivosPresentes, pastaDosExtras } from "../ui/extras-aventura.mjs";
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
      enviarZip: AventurasApp.#enviarZip,
    },
  };

  static PARTS = {
    corpo: { template: `systems/${SYSTEM_ID}/templates/aventura/aventuras.hbs`, scrollable: [""] },
  };

  /** Estado da tela: o que aconteceu com o último PDF escolhido. */
  #estado = { lendo: false, progresso: "", resultados: null };

  async _prepareContext(opcoes) {
    const contexto = await super._prepareContext(opcoes);
    // Os dois atos de uma vez: conferir as artes na pasta do mundo é I/O (o documento do
    // compêndio e o FilePicker), e em série a janela demorava para aparecer.
    const atos = await Promise.all(ATOS.map(async (ato) => {
      const resultado = this.#estado.resultados?.find((r) => r.nome === ato.nome);
      const resumo = resultado?.resumo
        ? game.i18n.format(`OP2.Aventuras.Resumo.${ato.nome}`, resultado.resumo) : "";
      const noMundo = Boolean(aventuraNoMundo(ato.aventura));
      return {
        ...ato,
        rotulo: game.i18n.localize(ato.rotulo),
        noMundo,
        montado: Boolean(resultado?.ok),
        falhou: Boolean(resultado && !resultado.ok && resultado.motivo !== "ausente"),
        motivo: resultado && !resultado.ok ? resultado.motivo : null,
        erro: resultado?.erro ?? "",
        resumo,
        // A conferência do Ato II (o texto de cada ponto contra a tabela de locais de
        // uso) e os avisos da montagem: aviso, não erro — o mestre confere no livro.
        problemas: resultado?.problemas ?? [],
        // As artes vêm do zip da editora: dizer aqui o que já está na pasta do mundo
        // e oferecer o envio, em vez de só pedir na hora de importar.
        artes: noMundo ? await this.#artesDe(ato) : null,
      };
    }));
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

  /** O que a aventura espera do zip, e o que já está na pasta do mundo. */
  async #artesDe(ato) {
    const aventura = await documentoDaAventura(ato.aventura);
    const extras = extrasDaAventura(aventura);
    if (!extras) return null;
    const presentes = await arquivosPresentes(extras);
    const faltam = extras.arquivos.filter((a) => !presentes.has(a.destino)).length;
    return { total: extras.arquivos.length, faltam, zip: extras.zip, pasta: pastaDosExtras(extras) };
  }

  /** Sobe o zip das artes antes de importar — a mesma janela que a importação pede. */
  static async #enviarZip(_evento, alvo) {
    const ato = ATOS.find((a) => a.nome === alvo.dataset.ato);
    const aventura = await documentoDaAventura(ato.aventura);
    const extras = extrasDaAventura(aventura);
    if (!aventura || !extras) return;
    const presentes = await arquivosPresentes(extras);
    const faltam = extras.arquivos.filter((a) => !presentes.has(a.destino));
    await ExtrasApp.pedir(aventura, extras, faltam.length ? faltam : extras.arquivos, { permitirPular: false });
    await this.render();
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
      // Quem mais mostra o estado das aventuras (a tela de boas-vindas, aberta atrás)
      // se refaz — senão fica com o que viu ao entrar no mundo.
      Hooks.callAll("op2.aventurasMudaram");
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
    Hooks.callAll("op2.aventurasMudaram");
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
