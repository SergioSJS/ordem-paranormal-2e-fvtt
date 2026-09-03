import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { listarEntradas, extrairEntrada, crc32, slugDeArquivo, casarEntradas } from "../ui/zip.mjs";

/**
 * Monta um zip de verdade em memória, com cabeçalhos locais, diretório central e o
 * registro de fim — o mesmo formato que o pacote da editora usa. Assim o teste cobre o
 * leitor inteiro, não um mock dele.
 * @param {Array<{nome: string, conteudo: Uint8Array, guardar?: boolean}>} arquivos
 * @param {string} [comentario]
 */
function montarZip(arquivos, comentario = "") {
  const codificador = new TextEncoder();
  const partes = [];
  const centrais = [];
  let offset = 0;

  const u16 = (n) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
  const u32 = (n) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
  const juntar = (pedacos) => {
    const total = pedacos.reduce((n, p) => n + p.length, 0);
    const saida = new Uint8Array(total);
    let i = 0;
    for (const p of pedacos) { saida.set(p, i); i += p.length; }
    return saida;
  };

  for (const { nome, conteudo, guardar } of arquivos) {
    const nomeBytes = codificador.encode(nome);
    const dados = guardar ? conteudo : new Uint8Array(deflateRawSync(conteudo));
    const metodo = guardar ? 0 : 8;
    const crc = crc32(conteudo);
    const local = juntar([
      u32(0x04034b50), u16(20), u16(0x800), u16(metodo), u16(0), u16(0),
      u32(crc), u32(dados.length), u32(conteudo.length), u16(nomeBytes.length), u16(0),
      nomeBytes, dados,
    ]);
    centrais.push(juntar([
      u32(0x02014b50), u16(20), u16(20), u16(0x800), u16(metodo), u16(0), u16(0),
      u32(crc), u32(dados.length), u32(conteudo.length), u16(nomeBytes.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), nomeBytes,
    ]));
    partes.push(local);
    offset += local.length;
  }
  const diretorio = juntar(centrais);
  const comentarioBytes = codificador.encode(comentario);
  const eocd = juntar([
    u32(0x06054b50), u16(0), u16(0), u16(arquivos.length), u16(arquivos.length),
    u32(diretorio.length), u32(offset), u16(comentarioBytes.length), comentarioBytes,
  ]);
  const tudo = juntar([...partes, diretorio, eocd]);
  return tudo.buffer.slice(tudo.byteOffset, tudo.byteOffset + tudo.byteLength);
}

const texto = (s) => new TextEncoder().encode(s);

test("lista as entradas do zip com nome, tamanhos e método", () => {
  const zip = montarZip([
    { nome: "Tokens/Token - Antônio.png", conteudo: texto("png falso") },
    { nome: "Handouts/", conteudo: new Uint8Array(0), guardar: true },
    { nome: "Handouts/Audio EMF 1.mp3", conteudo: texto("mp3"), guardar: true },
  ]);
  const entradas = listarEntradas(zip);
  assert.deepEqual(entradas.map((e) => e.nome), ["Tokens/Token - Antônio.png", "Handouts/Audio EMF 1.mp3"]);
  assert.equal(entradas[0].metodo, 8);
  assert.equal(entradas[0].tamanho, texto("png falso").length);
  assert.equal(entradas[1].metodo, 0);
});

test("extrai o conteúdo, comprimido ou guardado, conferindo tamanho e CRC", async () => {
  const grande = new Uint8Array(200_000);
  for (let i = 0; i < grande.length; i += 1) grande[i] = (i * 7) % 251;
  const zip = montarZip([
    { nome: "a.bin", conteudo: grande },
    { nome: "b.txt", conteudo: texto("guardado"), guardar: true },
  ]);
  const [a, b] = listarEntradas(zip);
  assert.deepEqual(await extrairEntrada(zip, a), grande);
  assert.equal(new TextDecoder().decode(await extrairEntrada(zip, b)), "guardado");
});

test("acha o fim do diretório mesmo com comentário no zip", () => {
  const zip = montarZip([{ nome: "x.txt", conteudo: texto("x") }], "comentário da editora");
  assert.equal(listarEntradas(zip).length, 1);
});

test("recusa o que não é zip", () => {
  assert.throws(() => listarEntradas(new Uint8Array(100).buffer), /zip inválido/);
});

test("slug do nome: sem acento, minúsculas, sem a pasta", () => {
  assert.equal(slugDeArquivo("Fichas e históricos de personagem/Histórico - Antônio.jpg"), "historico-antonio.jpg");
  assert.equal(slugDeArquivo("Handouts/Handout 02A - Laser Porão.JPG"), "handout-02a-laser-porao.jpg");
  assert.equal(slugDeArquivo("Mapa/Mapa 01 - O Porão.jpg"), "mapa-01-o-porao.jpg");
});

test("casa as entradas do zip com o que a aventura espera, e diz o que faltou", () => {
  const entradas = [
    { nome: "Tokens/Token - Val.png" }, { nome: "Tokens/Personagem - Val.png" }, { nome: "extra/Leia-me.txt" },
  ];
  const esperados = [{ destino: "tokens/token-val.png" }, { destino: "tokens/token-raven.png" }];
  const { encontrados, faltando, ignorados } = casarEntradas(entradas, esperados);
  assert.equal(encontrados.length, 1);
  assert.equal(encontrados[0].entrada.nome, "Tokens/Token - Val.png");
  assert.deepEqual(faltando.map((f) => f.destino), ["tokens/token-raven.png"]);
  assert.deepEqual(ignorados.map((e) => e.nome), ["Tokens/Personagem - Val.png", "extra/Leia-me.txt"]);
});
