/**
 * O que os geradores de aventura (Ato I e Ato II) têm em comum: ids determinísticos,
 * nomes legíveis, pastas e o casamento de handouts com pontos.
 */
import { createHash } from "node:crypto";

/** Id estável a partir de uma semente — regenerar não troca id, e importar de novo atualiza. */
export const ident = (semente) => createHash("sha1").update(semente).digest("hex").slice(0, 16);

export const semAcento = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Nome de arquivo como os compêndios apontam (mesma regra do importador de extras). */
export const arquivoPublico = (nome) => semAcento(nome).toLowerCase()
  .replace(/[^a-z0-9.]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

/** Palavras que distinguem um ponto do outro — o resto é cola. */
const CHAVES_FRACAS = new Set(["de", "do", "da", "dos", "das", "e", "o", "a", "os", "as",
  "no", "na", "em", "um", "uma", "poster", "handout", "foto", "conversa"]);
export const palavras = (t) => new Set(semAcento(t).toLowerCase().split(/[^a-z0-9]+/)
  .filter((w) => w.length > 2 && !CHAVES_FRACAS.has(w)));

/** Quanto o título impresso do handout combina com o nome do ponto. */
export function afinidade(arquivo, nome) {
  const alvo = palavras(nome);
  return [...palavras(arquivo.replace(/^Handout \d+[A-C]?\s*-?\s*/i, "").replace(/\.\w+$/, ""))]
    .filter((w) => alvo.has(w)).length;
}

/** "DEPÓSITO A, MOLHO DE CHAVES" → "Depósito A, Molho de Chaves". */
export function tituloLegivel(nome) {
  // "a" e "o" sozinhos podem ser artigo ou identificador ("Depósito A"): só viram
  // minúscula quando há mais de uma letra.
  const minusculas = new Set(["de", "do", "da", "dos", "das", "no", "na", "em", "ou", "e"]);
  return nome.toLowerCase().split(/\s+/)
    .map((palavra, i) => (i > 0 && minusculas.has(palavra.replace(/[^a-zà-ú]/g, ""))
      ? palavra
      // A primeira LETRA: "“altar”" começa com aspas.
      : palavra.replace(/\p{L}/u, (letra) => letra.toUpperCase())))
    .join(" ");
}

/**
 * Pastas da aventura: sem elas o import despeja tudo na raiz do diretório. O Foundry
 * cria as pastas junto com o conteúdo, uma árvore por tipo.
 */
export function pasta(tipo, nome, pai = null, sort = 0) {
  return {
    _id: ident(`pasta-${tipo}-${nome}`),
    name: nome, type: tipo, folder: pai,
    sorting: "m", sort, color: "#7f1d1d", description: "", flags: {},
  };
}

/** Põe o documento na pasta e devolve ele — o import respeita o campo `folder`. */
export const em = (destino) => (doc) => ({ ...doc, folder: destino._id });

/** Parágrafos de texto → HTML, escapando o que precisa. */
export const escapar = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const html = (paragrafos) => paragrafos.filter(Boolean).map((p) => `<p>${escapar(p)}</p>`).join("");

/**
 * Ícone de um ponto de interesse. Um ícone por ponto, não o genérico em todos: o
 * retrato de quem o ponto é ("Alan e seus pertences"), senão o handout que o ponto
 * cita (a foto da estante, o pôster), senão um ícone do próprio Foundry escolhido pela
 * palavra-chave do nome — nenhum asset novo, funciona sem instalar nada.
 */
const RETRATOS_ATO_I = Object.fromEntries(["alan", "victor", "eloisa", "edgar", "kenia"]
  .map((n) => [n, `systems/ordem-paranormal-2e/assets/ato-i/tokens/personagem-${n}.png`]));
const ICONE = (nome) => `icons/svg/${nome}.svg`;
const ICONE_POR_PALAVRA = [
  [/cadaver|o corpo/, ICONE("skull")],
  [/simbolo|tatuad/, "systems/ordem-paranormal-2e/assets/ato-i/handouts/handout-02-simbolo-no-teto.jpg"],
  [/idolo/, ICONE("statue")],
  [/faca/, ICONE("sword")],
  [/altar/, ICONE("temple")],
  [/tigela/, ICONE("tankard")],
  [/chave/, ICONE("padlock")],
  [/painel|eletric/, ICONE("lightning")],
  [/computador|celular/, ICONE("clockwork")],
  [/porta/, ICONE("door-exit")],
  [/duto/, ICONE("cave")],
  [/estante|livro/, ICONE("book")],
  [/poster/, ICONE("hanging-sign")],
  [/poker/, ICONE("card-hand")],
  [/sinuca/, ICONE("target")],
  [/churras|grelha/, ICONE("fire")],
  [/freezer/, ICONE("frozen")],
  [/armario/, ICONE("chest")],
  [/rabisco/, ICONE("ruins")],
  [/deposito/, ICONE("barrel")],
  [/sala secreta/, ICONE("door-secret-outline")],
  [/pertences|mochila|bolsa|carteira/, ICONE("item-bag")],
  [/personagens/, ICONE("mystery-man")],
];

/**
 * @param {string} nome do ponto, como o livro imprime
 * @param {{handouts?: string[], padrao: string}} opcoes caminhos dos handouts que o ponto cita
 */
export function iconeDoPonto(nome, { handouts = [], padrao }) {
  // "[EVIDÊNCIA-CHAVE]" não é chave nem cadeado: a etiqueta sai antes de casar.
  const limpo = nome.replace(/\[[^\]]*\]/g, "").trim();
  const chave = semAcento(limpo).toLowerCase();
  const retrato = Object.keys(RETRATOS_ATO_I).find((n) => chave.includes(n));
  if (retrato) return RETRATOS_ATO_I[retrato];
  // O handout só vira ícone quando é DO ponto (o título dele fala do mesmo objeto): a
  // foto da estante na estante, o pôster no pôster — não o RG achado dentro do armário.
  const imagem = handouts.find((h) => /\.(png|jpe?g|webp)$/i.test(h) && afinidade(h.split("/").pop(), limpo) > 0);
  if (imagem) return imagem;
  const regra = ICONE_POR_PALAVRA.find(([re]) => re.test(chave));
  return regra ? regra[1] : padrao;
}
