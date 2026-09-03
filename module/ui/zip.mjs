/**
 * Leitor de zip mínimo, sem dependência — só o que o importador de extras precisa.
 *
 * Lê o diretório central (no fim do arquivo) e descomprime cada entrada com o
 * `DecompressionStream("deflate-raw")` do próprio navegador. Não trata zip64 nem
 * arquivo cifrado: o pacote de extras da editora é um zip comum (deflate, nomes em
 * UTF-8), e é só ele que este leitor precisa abrir. Puro: nada de Foundry aqui, para
 * ser testável fora dele (`module/tests/zip.test.mjs`).
 */

const ASSINATURA_EOCD = 0x06054b50;
const ASSINATURA_CENTRAL = 0x02014b50;
const ASSINATURA_LOCAL = 0x04034b50;
const TAMANHO_EOCD = 22;
const COMENTARIO_MAXIMO = 0xffff;

/**
 * @typedef {object} EntradaZip
 * @property {string} nome            caminho dentro do zip, como gravado ("Tokens/Token - Val.png")
 * @property {number} metodo          0 = guardado sem compressão, 8 = deflate
 * @property {number} crc             CRC-32 do conteúdo original
 * @property {number} tamanho         bytes depois de extrair
 * @property {number} tamanhoComprimido
 * @property {number} offsetLocal     onde começa o cabeçalho local da entrada
 */

/**
 * Lista as entradas (arquivos, não pastas) de um zip.
 * @param {ArrayBuffer} buffer
 * @returns {EntradaZip[]}
 */
export function listarEntradas(buffer) {
  const bytes = new Uint8Array(buffer);
  const vista = new DataView(buffer);
  if (bytes.length < TAMANHO_EOCD) throw new Error("zip inválido: arquivo curto demais");

  // O registro de fim do diretório central fica no fim, antes de um comentário
  // opcional de até 64 KiB — por isso a busca de trás para a frente.
  let eocd = -1;
  const limite = Math.max(0, bytes.length - TAMANHO_EOCD - COMENTARIO_MAXIMO);
  for (let i = bytes.length - TAMANHO_EOCD; i >= limite; i -= 1) {
    if (vista.getUint32(i, true) === ASSINATURA_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("zip inválido: fim do diretório central não encontrado");

  const total = vista.getUint16(eocd + 10, true);
  const inicioDiretorio = vista.getUint32(eocd + 16, true);
  if (total === 0xffff || inicioDiretorio === 0xffffffff) throw new Error("zip64 não é suportado");

  const decodificador = new TextDecoder("utf-8");
  const entradas = [];
  let p = inicioDiretorio;
  for (let n = 0; n < total; n += 1) {
    if (p + 46 > bytes.length || vista.getUint32(p, true) !== ASSINATURA_CENTRAL) {
      throw new Error("zip inválido: diretório central corrompido");
    }
    const flags = vista.getUint16(p + 8, true);
    const metodo = vista.getUint16(p + 10, true);
    const crc = vista.getUint32(p + 16, true);
    const tamanhoComprimido = vista.getUint32(p + 20, true);
    const tamanho = vista.getUint32(p + 24, true);
    const tamNome = vista.getUint16(p + 28, true);
    const tamExtra = vista.getUint16(p + 30, true);
    const tamComentario = vista.getUint16(p + 32, true);
    const offsetLocal = vista.getUint32(p + 42, true);
    const nome = decodificador.decode(bytes.subarray(p + 46, p + 46 + tamNome));
    p += 46 + tamNome + tamExtra + tamComentario;

    if (nome.endsWith("/")) continue;
    if (flags & 0x1) throw new Error(`zip cifrado não é suportado: ${nome}`);
    entradas.push({ nome, metodo, crc, tamanho, tamanhoComprimido, offsetLocal });
  }
  return entradas;
}

/**
 * Extrai o conteúdo de uma entrada.
 * @param {ArrayBuffer} buffer
 * @param {EntradaZip} entrada
 * @returns {Promise<Uint8Array>}
 */
export async function extrairEntrada(buffer, entrada) {
  const vista = new DataView(buffer);
  const p = entrada.offsetLocal;
  if (vista.getUint32(p, true) !== ASSINATURA_LOCAL) {
    throw new Error(`zip inválido: cabeçalho local de ${entrada.nome}`);
  }
  // Os tamanhos vêm do diretório central: o cabeçalho local pode trazer zeros quando
  // o zip foi gravado em fluxo (descritor de dados depois do conteúdo).
  const tamNome = vista.getUint16(p + 26, true);
  const tamExtra = vista.getUint16(p + 28, true);
  const inicio = p + 30 + tamNome + tamExtra;
  const dados = new Uint8Array(buffer, inicio, entrada.tamanhoComprimido);

  let saida;
  if (entrada.metodo === 0) {
    saida = dados;
  } else if (entrada.metodo === 8) {
    if (typeof DecompressionStream !== "function") {
      throw new Error("este navegador não descomprime zip (sem DecompressionStream)");
    }
    const fluxo = new Blob([dados]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    saida = new Uint8Array(await new Response(fluxo).arrayBuffer());
  } else {
    throw new Error(`método de compressão ${entrada.metodo} não é suportado (${entrada.nome})`);
  }

  if (saida.length !== entrada.tamanho) {
    throw new Error(`${entrada.nome}: esperava ${entrada.tamanho} bytes, saíram ${saida.length}`);
  }
  if (crc32(saida) !== entrada.crc) throw new Error(`${entrada.nome}: conteúdo corrompido (CRC)`);
  return saida;
}

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

/** @param {Uint8Array} bytes */
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = TABELA_CRC[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Nome de arquivo como os compêndios apontam: minúsculas, sem acento, sem espaço.
 * É a mesma regra de `scripts/ato-i/copiar-assets.mjs` — o pacote da editora tem
 * "Histórico - Antônio.jpg", o compêndio aponta "historico-antonio.jpg".
 * @param {string} nome caminho ou nome de arquivo
 */
export function slugDeArquivo(nome) {
  const base = nome.split("/").pop();
  const ponto = base.lastIndexOf(".");
  const semExt = ponto > 0 ? base.slice(0, ponto) : base;
  const ext = ponto > 0 ? base.slice(ponto).toLowerCase() : "";
  return semExt.normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ext;
}

/**
 * Palavras que identificam um arquivo dentro do slug — sem a numeração de handout, que
 * é o que a editora mais troca entre versões ("Handout 04" vira "Handout 06").
 * @param {string} slug "handout-06-foto-do-freezer.png"
 */
export function palavrasDoSlug(slug) {
  const semExt = slug.replace(/\.[a-z0-9]+$/, "");
  const cola = new Set(["de", "do", "da", "dos", "das", "e", "o", "a", "os", "as"]);
  return semExt.replace(/^handout-\d+[a-z]?-/, "").split("-").filter((w) => w && !cola.has(w));
}

const FAMILIA = { png: "imagem", jpg: "imagem", jpeg: "imagem", webp: "imagem", gif: "imagem",
  mp3: "audio", ogg: "audio", wav: "audio", pdf: "pdf", webm: "video", mp4: "video" };
const familiaDe = (nome) => FAMILIA[nome.split(".").pop().toLowerCase()] ?? "outro";

/**
 * Casa o que o zip traz com o que a aventura espera. Primeiro pelo slug exato do nome
 * do arquivo (pasta e codificação não importam); o que sobrar, por aproximação: mesma
 * família (imagem, áudio, PDF) e todas as palavras do nome esperado presentes no nome
 * do zip — "Handout 04 - Foto do Freezer" ainda é a foto do freezer se virar "Handout
 * 06". Quem casou por aproximação vem marcado, para o mestre conferir.
 * @param {EntradaZip[]} entradas
 * @param {Array<{destino: string}>} esperados `destino` é "pasta/slug.ext"
 * @returns {{encontrados: Array<{esperado: object, entrada: EntradaZip, aproximado: boolean}>,
 *   faltando: object[], ignorados: EntradaZip[]}}
 */
export function casarEntradas(entradas, esperados) {
  const slugs = entradas.map((e) => ({ entrada: e, slug: slugDeArquivo(e.nome) }));
  const usados = new Set();
  const encontrados = [];
  const semExato = [];
  for (const esperado of esperados) {
    const slug = esperado.destino.split("/").pop();
    const exato = slugs.find((s) => s.slug === slug && !usados.has(s.entrada));
    if (exato) { encontrados.push({ esperado, entrada: exato.entrada, aproximado: false }); usados.add(exato.entrada); }
    else semExato.push(esperado);
  }
  const faltando = [];
  for (const esperado of semExato) {
    const slug = esperado.destino.split("/").pop();
    const palavras = palavrasDoSlug(slug);
    const candidatos = slugs
      .filter((s) => !usados.has(s.entrada) && familiaDe(s.slug) === familiaDe(slug))
      .map((s) => ({ ...s, dele: palavrasDoSlug(s.slug) }))
      .filter((s) => palavras.every((w) => s.dele.includes(w)))
      // Quanto menos palavra sobrando, melhor o casamento.
      .sort((a, b) => (a.dele.length - palavras.length) - (b.dele.length - palavras.length) || a.slug.localeCompare(b.slug));
    const melhor = candidatos[0];
    // Empate no melhor casamento é ambiguidade: não adivinha.
    const ambiguo = candidatos.length > 1 && candidatos[1].dele.length === melhor?.dele.length;
    if (melhor && !ambiguo) { encontrados.push({ esperado, entrada: melhor.entrada, aproximado: true }); usados.add(melhor.entrada); }
    else faltando.push(esperado);
  }
  return { encontrados, faltando, ignorados: entradas.filter((e) => !usados.has(e)) };
}
