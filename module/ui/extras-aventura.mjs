/**
 * Extras de aventura: as artes que a editora só entrega a quem comprou.
 *
 * O Ato II não é público. O sistema traz o texto da aventura no compêndio, mas as
 * imagens, o mapa e os áudios ficam com o mestre, no zip que ele baixou do site da
 * editora. Este módulo fecha a ponta: na hora de importar a aventura, pede o zip,
 * descompacta no navegador, sobe cada arquivo para a pasta do mundo
 * (`worlds/<mundo>/<pasta>/`) e troca, nos documentos importados, o prefixo que o
 * compêndio usa pelo caminho real. Nada da editora entra no sistema; o que vai para o
 * User Data é do mestre.
 *
 * Como o Foundry chama: `Adventure#import` dispara `preImportAdventure` — um hook
 * síncrono, que não dá para esperar upload nenhum. Então na primeira passagem o hook
 * cancela a importação e dispara o fluxo assíncrono (conferir a pasta, pedir o zip,
 * subir); no fim, o fluxo chama `import()` de novo com a marca `op2ExtrasResolvidos`, e
 * aí o hook só reescreve os caminhos e deixa passar. Funciona com qualquer sheet de
 * Adventure, a V1 (padrão do core no v13 e no v14) ou a V2.
 *
 * A aventura declara o que espera em `flags.ordem-paranormal-2e.extras`:
 *   { pasta, prefixo, zip, arquivos: [{ destino, nome }], tambem?: [{ prefixo, pasta }] }
 * `tambem` são prefixos de OUTRO ato que esta aventura cita (o Ato II mostra handouts do
 * Ato I): só são reescritos para a pasta do mundo, sem pedir zip.
 * `destino` é "subpasta/slug.ext" dentro da pasta do mundo; `nome` é como a editora
 * chama o arquivo, para a mensagem de erro. O casamento com o zip é pelo slug do nome
 * (`zip.mjs`), então a codificação do nome no zip tanto faz.
 */
import { SYSTEM_ID } from "../config.mjs";
import { listarEntradas, extrairEntrada, casarEntradas } from "./zip.mjs";
import { alinharNiveis } from "../aventura/niveis.mjs";

const MARCA_RESOLVIDO = "op2ExtrasResolvidos";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const MIME = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav",
  ".pdf": "application/pdf", ".webm": "video/webm", ".mp4": "video/mp4",
};

function filePicker() {
  return foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
}

/** @returns {{pasta: string, prefixo: string, zip: string, arquivos: Array<{destino: string, nome: string}>}|null} */
export function extrasDaAventura(adventure) {
  const extras = adventure?.flags?.[SYSTEM_ID]?.extras;
  return extras?.arquivos?.length ? extras : null;
}

/** A pasta do mundo onde os arquivos ficam — por mundo, para sobreviver a atualização do sistema. */
export function pastaDosExtras(extras) {
  return `worlds/${game.world.id}/${extras.pasta}`;
}

/**
 * Troca o prefixo do compêndio pelo caminho da pasta do mundo em todo documento a criar
 * ou atualizar. Puro texto: os documentos ainda são objetos crus, então basta uma
 * passada pelo JSON. Mantém os mesmos arrays — o import lê deles.
 */
export function reescreverCaminhos(prefixo, destino, ...colecoes) {
  let trocas = 0;
  for (const colecao of colecoes) {
    for (const lista of Object.values(colecao ?? {})) {
      if (!Array.isArray(lista) || !lista.length) continue;
      const texto = JSON.stringify(lista);
      const antes = texto.split(prefixo).length - 1;
      if (!antes) continue;
      trocas += antes;
      lista.splice(0, lista.length, ...JSON.parse(texto.replaceAll(prefixo, destino)));
    }
  }
  return trocas;
}

/** O que já está na pasta do mundo, como `destino` ("tokens/token-val.png"). */
export async function arquivosPresentes(extras) {
  const raiz = pastaDosExtras(extras);
  const subpastas = new Set(extras.arquivos.map((a) => a.destino.split("/").slice(0, -1).join("/")));
  const presentes = new Set();
  // As subpastas de uma vez: cada browse é uma ida ao servidor.
  await Promise.all([...subpastas].map(async (sub) => {
    const caminho = sub ? `${raiz}/${sub}` : raiz;
    try {
      const { files = [] } = await filePicker().browse("data", caminho);
      for (const arquivo of files) {
        const relativo = decodeURIComponent(arquivo).split(`${raiz}/`).pop();
        presentes.add(relativo);
      }
    } catch {
      // A pasta ainda não existe: nada presente.
    }
  }));
  return presentes;
}

async function garantirPasta(caminho) {
  const partes = caminho.split("/");
  for (let i = 1; i <= partes.length; i += 1) {
    const parcial = partes.slice(0, i).join("/");
    // "worlds/<mundo>" já existe; o que falta é criado degrau a degrau. Erro de "já
    // existe" é o caso normal e não interessa.
    if (i < 3) continue;
    try { await filePicker().createDirectory("data", parcial); } catch { /* já existe */ }
  }
}

/**
 * Sobe para a pasta do mundo os arquivos do zip que a aventura espera.
 * @param {ArrayBuffer} zip
 * @param {object} extras
 * @param {Array<{destino: string, nome: string}>} esperados
 * @param {(feito: number, total: number, arquivo: string) => void} [progresso]
 * @returns {Promise<{enviados: string[], faltando: object[]}>}
 */
export async function enviarDoZip(zip, extras, esperados, progresso = () => {}) {
  const entradas = listarEntradas(zip);
  const { encontrados, faltando } = casarEntradas(entradas, esperados);
  const raiz = pastaDosExtras(extras);
  const enviados = [];
  const aproximados = [];
  const falhas = [];
  let n = 0;
  for (const { esperado, entrada, aproximado } of encontrados) {
    const [pasta, nome] = [esperado.destino.split("/").slice(0, -1).join("/"), esperado.destino.split("/").pop()];
    const destino = pasta ? `${raiz}/${pasta}` : raiz;
    // Um arquivo que falha (corrompido no zip, recusado pelo servidor) não segura os
    // outros: entra na lista de falhas e o envio segue.
    try {
      const bytes = await extrairEntrada(zip, entrada);
      const ext = nome.slice(nome.lastIndexOf(".")).toLowerCase();
      const arquivo = new File([bytes], nome, { type: MIME[ext] ?? "application/octet-stream" });
      await garantirPasta(destino);
      const resposta = await filePicker().upload("data", destino, arquivo, {}, { notify: false });
      if (!resposta?.path) throw new Error(game.i18n.localize("OP2.Extras.RecusadoPeloServidor"));
      enviados.push(esperado.destino);
      if (aproximado) aproximados.push({ esperado, noZip: entrada.nome });
    } catch (erro) {
      console.warn(`${SYSTEM_ID} | extras: ${esperado.nome} não subiu`, erro);
      falhas.push({ esperado, noZip: entrada.nome, motivo: erro.message });
    }
    n += 1;
    progresso(n, encontrados.length, esperado.nome);
  }
  return { enviados, aproximados, faltando, falhas, encontrados: encontrados.length, entradas: entradas.length };
}

/**
 * Janela que pede o zip. Resolve com "enviado" (arquivos no lugar), "pular" (importar
 * mesmo sem eles) ou null (cancelou).
 */
export class ExtrasApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["op2", "op2-extras"],
    window: { title: "OP2.Extras.Titulo", icon: "fa-solid fa-file-zipper", resizable: false },
    position: { width: 540, height: "auto" },
    actions: {
      pular: ExtrasApp.#pular,
      cancelar: ExtrasApp.#cancelar,
      concluir: ExtrasApp.#concluir,
    },
  };

  static PARTS = {
    corpo: { template: `systems/${SYSTEM_ID}/templates/ui/extras-aventura.hbs` },
  };

  /**
   * @param {Adventure} adventure
   * @param {object} extras
   * @param {Array<{destino: string, nome: string}>} faltam
   * @param {{permitirPular?: boolean}} [opcoes]
   */
  constructor(adventure, extras, faltam, { permitirPular = true } = {}) {
    super({ id: `op2-extras-${adventure.id}` });
    this.adventure = adventure;
    this.extras = extras;
    this.faltam = faltam;
    this.permitirPular = permitirPular;
    this.estado = {
      fase: "pedir", feito: 0, total: 0, atual: "", erro: "",
      enviados: 0, aproximados: [], faltando: [], falhas: [],
    };
    this.#resolver = null;
  }

  #resolver;

  /** @returns {Promise<"enviado"|"pular"|null>} */
  static pedir(adventure, extras, faltam, opcoes) {
    const app = new ExtrasApp(adventure, extras, faltam, opcoes);
    app.render({ force: true });
    return new Promise((resolve) => { app.#resolver = resolve; });
  }

  async _prepareContext() {
    return {
      ...this.estado,
      aventura: this.adventure.name,
      zip: this.extras.zip,
      pasta: pastaDosExtras(this.extras),
      faltam: this.faltam.length,
      // `total` é o da aventura; o do envio vai em `envio`, senão um pisa no outro.
      total: this.extras.arquivos.length,
      envio: { feito: this.estado.feito, total: this.estado.total, atual: this.estado.atual },
      permitirPular: this.permitirPular,
    };
  }

  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    this.element.querySelector("input[type=file]")?.addEventListener("change", (evento) => {
      const arquivo = evento.currentTarget.files?.[0];
      if (arquivo) this.#enviar(arquivo);
    });
  }

  async #enviar(arquivo) {
    this.estado = { ...this.estado, fase: "enviando", erro: "", atual: arquivo.name };
    await this.render();
    try {
      const zip = await arquivo.arrayBuffer();
      const resultado = await enviarDoZip(zip, this.extras, this.faltam, (feito, total, atual) => {
        this.estado = { ...this.estado, feito, total, atual };
        this.#atualizarProgresso();
      });
      // Zip errado: nada do que a aventura espera está nele. Volta a pedir, dizendo isso.
      if (resultado.encontrados === 0) {
        this.estado = {
          ...this.estado, fase: "pedir",
          erro: game.i18n.format("OP2.Extras.NenhumArquivo", { arquivo: arquivo.name, total: this.faltam.length, entradas: resultado.entradas }),
        };
      } else {
        this.estado = {
          ...this.estado, fase: "pronto",
          enviados: resultado.enviados.length, aproximados: resultado.aproximados,
          faltando: resultado.faltando, falhas: resultado.falhas,
        };
        if (resultado.faltando.length || resultado.falhas.length) {
          ui.notifications.warn(game.i18n.format("OP2.Extras.AvisoIncompleto", {
            enviados: resultado.enviados.length, total: this.faltam.length,
          }));
        }
      }
    } catch (erro) {
      console.error(`${SYSTEM_ID} | extras`, erro);
      this.estado = { ...this.estado, fase: "pedir", erro: erro.message };
    }
    await this.render();
  }

  /** Só a barra e o nome do arquivo: rerrenderizar a janela a cada upload pisca. */
  #atualizarProgresso() {
    const barra = this.element?.querySelector("progress");
    const rotulo = this.element?.querySelector("[data-progresso]");
    if (barra) { barra.max = this.estado.total; barra.value = this.estado.feito; }
    if (rotulo) rotulo.textContent = `${this.estado.feito}/${this.estado.total} — ${this.estado.atual}`;
  }

  #fechar(resultado) {
    const resolver = this.#resolver;
    this.#resolver = null;
    resolver?.(resultado);
    return this.close();
  }

  static #pular() { return this.#fechar("pular"); }
  static #cancelar() { return this.#fechar(null); }
  static #concluir() { return this.#fechar("enviado"); }

  _onClose(opcoes) {
    super._onClose(opcoes);
    this.#resolver?.(null);
    this.#resolver = null;
  }
}

/**
 * O fluxo completo, a partir do que o hook cancelou: confere a pasta do mundo, pede o
 * zip se faltar algo e importa de novo com a marca que libera o hook.
 */
async function resolverEImportar(adventure, options) {
  const extras = extrasDaAventura(adventure);
  const presentes = await arquivosPresentes(extras);
  const faltam = extras.arquivos.filter((a) => !presentes.has(a.destino));
  if (faltam.length) {
    const resultado = await ExtrasApp.pedir(adventure, extras, faltam);
    if (!resultado) return null;
  }
  return adventure.import({ ...options, [MARCA_RESOLVIDO]: true });
}

/**
 * Menu de configurações: reenviar o zip de qualquer aventura com extras — para quem
 * importou sem os arquivos, ou trocou de mundo.
 */
export class ExtrasMenuApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "op2-extras-menu",
    classes: ["op2", "op2-extras"],
    window: { title: "OP2.Extras.MenuTitulo", icon: "fa-solid fa-file-zipper" },
    position: { width: 540, height: "auto" },
    actions: { enviar: ExtrasMenuApp.#enviar },
  };

  static PARTS = {
    corpo: { template: `systems/${SYSTEM_ID}/templates/ui/extras-menu.hbs` },
  };

  async _prepareContext() {
    const aventuras = [];
    for (const pack of game.packs) {
      // As aventuras montadas do PDF vivem no compêndio do mundo; as dos scripts, no do sistema.
      if (pack.metadata.type !== "Adventure") continue;
      if (pack.metadata.packageName !== SYSTEM_ID && pack.metadata.packageType !== "world") continue;
      const indice = await pack.getIndex({ fields: ["flags"] });
      for (const entrada of indice) {
        const extras = extrasDaAventura(entrada);
        if (!extras) continue;
        const presentes = await arquivosPresentes(extras);
        aventuras.push({
          uuid: entrada.uuid, nome: entrada.name, zip: extras.zip, pasta: pastaDosExtras(extras),
          presentes: extras.arquivos.filter((a) => presentes.has(a.destino)).length,
          total: extras.arquivos.length,
        });
      }
    }
    return { aventuras, semAventura: !aventuras.length };
  }

  static async #enviar(_evento, alvo) {
    const adventure = await fromUuid(alvo.dataset.uuid);
    const extras = extrasDaAventura(adventure);
    // Reenviar tudo: quem abre este menu quer os arquivos no lugar, presentes ou não.
    const resultado = await ExtrasApp.pedir(adventure, extras, extras.arquivos, { permitirPular: false });
    if (resultado === "enviado") ui.notifications.info(game.i18n.format("OP2.Extras.Enviados", { pasta: pastaDosExtras(extras) }));
    this.render();
  }
}

export function registrarExtrasDeAventura() {
  Hooks.on("preImportAdventure", (adventure, options, toCreate, toUpdate) => {
    const extras = extrasDaAventura(adventure);
    if (!extras) return true;
    if (options?.[MARCA_RESOLVIDO]) {
      let trocas = reescreverCaminhos(extras.prefixo, `${pastaDosExtras(extras)}/`, toCreate, toUpdate);
      for (const outro of extras.tambem ?? []) {
        trocas += reescreverCaminhos(outro.prefixo, `worlds/${game.world.id}/${outro.pasta}/`, toCreate, toUpdate);
      }
      console.log(`${SYSTEM_ID} | extras: ${trocas} caminho(s) apontados para ${pastaDosExtras(extras)}`);
      // Cena que já existe no mundo mantém os ids de nível dela (o mestre pode estar
      // vendo por eles); referência a nível inexistente vai para o primeiro nível.
      let ajustes = { niveis: 0, referencias: 0 };
      for (const cena of toUpdate?.Scene ?? []) {
        const existente = game.scenes.get(cena._id);
        // No v13 a cena não tem níveis: nada a alinhar além das referências soltas.
        const r = alinharNiveis(cena, existente?.levels ? [...existente.levels].map((n) => n.id) : []);
        ajustes = { niveis: ajustes.niveis + r.niveis, referencias: ajustes.referencias + r.referencias };
      }
      for (const cena of toCreate?.Scene ?? []) {
        const r = alinharNiveis(cena, []);
        ajustes = { niveis: ajustes.niveis + r.niveis, referencias: ajustes.referencias + r.referencias };
      }
      if (ajustes.niveis || ajustes.referencias) {
        console.log(`${SYSTEM_ID} | extras: níveis da cena alinhados (${ajustes.niveis} id(s) de nível, ${ajustes.referencias} referência(s))`);
      }
      return true;
    }
    if (!game.user.isGM) return true;
    resolverEImportar(adventure, options ?? {}).catch((erro) => {
      console.error(`${SYSTEM_ID} | extras`, erro);
      ui.notifications.error(game.i18n.format("OP2.Extras.ErroGeral", { erro: erro.message }));
    });
    return false;
  });

  game.settings.registerMenu(SYSTEM_ID, "extrasDeAventura", {
    name: "OP2.Extras.MenuNome",
    label: "OP2.Extras.MenuBotao",
    hint: "OP2.Extras.MenuAjuda",
    icon: "fa-solid fa-file-zipper",
    type: ExtrasMenuApp,
    restricted: true,
  });
}
