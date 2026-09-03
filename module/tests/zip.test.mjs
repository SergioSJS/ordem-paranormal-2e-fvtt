import test from "node:test";
import assert from "node:assert/strict";
import { listarEntradas, extrairEntrada, slugDeArquivo, casarEntradas, palavrasDoSlug } from "../ui/zip.mjs";
import { montarZip } from "./zip-fixture.mjs";

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
  assert.equal(encontrados[0].aproximado, false);
  assert.deepEqual(faltando.map((f) => f.destino), ["tokens/token-raven.png"]);
  assert.deepEqual(ignorados.map((e) => e.nome), ["Tokens/Personagem - Val.png", "extra/Leia-me.txt"]);
});

test("palavrasDoSlug: ignora a numeração do handout e as palavras de cola", () => {
  assert.deepEqual(palavrasDoSlug("handout-06-foto-do-freezer.png"), ["foto", "freezer"]);
  assert.deepEqual(palavrasDoSlug("token-amanda.png"), ["token", "amanda"]);
  assert.deepEqual(palavrasDoSlug("audio-emf-1.mp3"), ["audio", "emf", "1"]);
});

test("casa por aproximação quando a editora renumera ou reescreve o nome, e marca", () => {
  const entradas = [
    { nome: "Handouts/Handout 09 - Foto do Freezer (v2).png" },
    { nome: "Tokens/Token Amanda final.png" },
    { nome: "Audio/Audio EMF 2.mp3" },
    { nome: "Audio/Audio EMF 3.mp3" },
  ];
  const esperados = [
    { destino: "handouts/handout-06-foto-do-freezer.png" },
    { destino: "tokens/token-amanda.png" },
    { destino: "musicas/audio-emf-1.mp3" },
    { destino: "musicas/audio-emf-3.mp3" },
  ];
  const { encontrados, faltando } = casarEntradas(entradas, esperados);
  const por = Object.fromEntries(encontrados.map((e) => [e.esperado.destino, e]));
  assert.equal(por["handouts/handout-06-foto-do-freezer.png"].entrada.nome, "Handouts/Handout 09 - Foto do Freezer (v2).png");
  assert.equal(por["handouts/handout-06-foto-do-freezer.png"].aproximado, true);
  assert.equal(por["tokens/token-amanda.png"].entrada.nome, "Tokens/Token Amanda final.png");
  assert.equal(por["musicas/audio-emf-3.mp3"].aproximado, false, "o exato ganha do aproximado");
  // EMF 1 não existe; EMF 2 não serve no lugar dele (o número identifica).
  assert.deepEqual(faltando.map((f) => f.destino), ["musicas/audio-emf-1.mp3"]);
});

test("aproximação não adivinha entre dois candidatos iguais, nem cruza família", () => {
  const entradas = [{ nome: "a/Foto do Freezer X.png" }, { nome: "b/Foto do Freezer Y.png" }, { nome: "Mapa 01 do Porão.mp3" }];
  const esperados = [{ destino: "handouts/handout-06-foto-do-freezer.png" }, { destino: "mapas/mapa-01-o-porao.jpg" }];
  const { encontrados, faltando } = casarEntradas(entradas, esperados);
  assert.equal(encontrados.length, 0);
  assert.equal(faltando.length, 2);
});
