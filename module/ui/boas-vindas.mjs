/**
 * A tela de boas-vindas — e de "Sobre e licença", que é a mesma janela pelo menu de
 * configurações.
 *
 * Abre para o mestre ao entrar no mundo, enquanto ele não desmarcar "mostrar ao
 * entrar" (setting de mundo, também no menu de configurações). Diz o que o sistema
 * traz, de onde vêm as aventuras (do PDF do próprio mestre — nada do livro vem no
 * pacote), como o Ato II chega (PDF completo e zip da editora, para assinantes), e leva
 * os links que a Licença da Comunidade pede: o aviso de conteúdo não oficial, a
 * licença, o site e a loja da editora.
 */
import { SYSTEM_ID } from "../config.mjs";
import { lerConfig } from "../settings/register.mjs";
import { abrirAventurasApp, LICENCA } from "../aventura/aventuras-app.mjs";
import { ATOS, aventuraNoMundo } from "../aventura/mundo.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Os links oficiais que a licença lista. */
export const LINKS = {
  licenca: LICENCA.url,
  site: "https://ordemparanormal.com.br",
  loja: "https://loja.ordemparanormal.com.br",
};

/** O selo da Licença da Comunidade, quando baixado do Drive da editora para `assets/licenca/`. */
const PASTA_DO_SELO = `systems/${SYSTEM_ID}/assets/licenca`;
const SELO = `${PASTA_DO_SELO}/selo-comunidade.png`;
let temSelo = null;
async function haSelo() {
  if (temSelo === null) {
    // Pela listagem da pasta, não por um `fetch` do arquivo: sem o selo, o 404 do fetch
    // vira erro no console a cada abertura (achado no e2e).
    try {
      const FilePicker = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
      const { files = [] } = await FilePicker.browse("data", PASTA_DO_SELO);
      temSelo = files.some((f) => decodeURIComponent(f).endsWith("/selo-comunidade.png"));
    } catch { temSelo = false; }
  }
  return temSelo;
}

export class BoasVindasApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "op2-boas-vindas",
    classes: ["op2", "op2-boas-vindas"],
    window: { title: "OP2.BoasVindas.Titulo", icon: "fa-solid fa-eye", resizable: true },
    position: { width: 680, height: "auto" },
    actions: {
      abrirAventuras: BoasVindasApp.#abrirAventuras,
      fechar: BoasVindasApp.#fechar,
    },
  };

  static PARTS = {
    corpo: { template: `systems/${SYSTEM_ID}/templates/ui/boas-vindas.hbs`, scrollable: [""] },
  };

  async _prepareContext(opcoes) {
    const contexto = await super._prepareContext(opcoes);
    const sistema = game.system;
    return {
      ...contexto,
      versao: sistema.version,
      changelog: sistema.changelog ?? sistema.url,
      repositorio: sistema.url,
      links: LINKS,
      selo: (await haSelo()) ? SELO : null,
      aviso: LICENCA.aviso,
      mestre: game.user.isGM,
      mostrarAoEntrar: lerConfig("boasVindas"),
      atos: ATOS.map((ato) => ({
        rotulo: game.i18n.localize(ato.rotulo),
        noMundo: Boolean(aventuraNoMundo(ato.aventura)),
      })),
      compendios: game.packs.filter((p) => p.metadata.packageName === SYSTEM_ID).length,
    };
  }

  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    const caixa = this.element.querySelector("[data-mostrar-ao-entrar]");
    caixa?.addEventListener("change", () => game.settings.set(SYSTEM_ID, "boasVindas", caixa.checked));
  }

  static #abrirAventuras() {
    abrirAventurasApp();
  }

  static #fechar() {
    return this.close();
  }
}

let instancia = null;

export function abrirBoasVindas() {
  instancia ??= new BoasVindasApp();
  instancia.render({ force: true });
  return instancia;
}

/** No `ready`: só para o mestre, e só enquanto ele quiser. */
export function abrirBoasVindasSeConfigurado() {
  if (!game.user.isGM || !lerConfig("boasVindas")) return null;
  return abrirBoasVindas();
}

/** O menu de configurações: "Sobre e licença" abre a mesma janela, para qualquer um. */
export function registrarBoasVindas() {
  game.settings.registerMenu(SYSTEM_ID, "sobre", {
    name: "OP2.BoasVindas.MenuNome",
    label: "OP2.BoasVindas.MenuBotao",
    hint: "OP2.BoasVindas.MenuAjuda",
    icon: "fa-solid fa-circle-info",
    type: BoasVindasApp,
    restricted: false,
  });
}
