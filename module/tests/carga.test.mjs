import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import { instalarStubs } from "./stub-foundry.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..");

instalarStubs();

function arquivos(pasta, extensao) {
  const saida = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivos(caminho, extensao));
    else if (nome.endsWith(extensao)) saida.push(caminho);
  }
  return saida;
}

const modulos = arquivos(join(RAIZ, "module"), ".mjs").filter((f) => !f.includes(`${"tests"}/`));

test("todo módulo do sistema carrega sem erro", async (t) => {
  for (const caminho of modulos) {
    await t.test(relative(RAIZ, caminho), async () => {
      await assert.doesNotReject(() => import(caminho));
    });
  }
});

test("todo template compila como Handlebars válido", async (t) => {
  const templates = arquivos(join(RAIZ, "templates"), ".hbs");
  assert.ok(templates.length > 0, "nenhum template encontrado");

  // Helpers do sistema e do core, registrados só para a compilação passar.
  for (const nome of ["localize", "formInput", "op2Caminho", "op2Concat", "op2Eq", "op2Vezes", "op2Dado", "op2DadoResultado"]) {
    Handlebars.registerHelper(nome, () => "");
  }

  for (const caminho of templates) {
    await t.test(relative(RAIZ, caminho), () => {
      // `compile()` é preguiçoso: só parseia quando o template roda, então um bloco
      // desbalanceado passava batido e só estourava no Foundry (achado em uso real).
      // `precompile()` parseia na hora.
      assert.doesNotThrow(() => Handlebars.precompile(readFileSync(caminho, "utf8")));
    });
  }
});

test("system.json declara um data model para cada tipo de documento", async () => {
  const manifesto = JSON.parse(readFileSync(join(RAIZ, "system.json"), "utf8"));
  const entrada = readFileSync(join(RAIZ, "module/op2.mjs"), "utf8");

  // Tipos com hífen ("ponto-interesse") são registrados com colchetes, não com ponto.
  const registrado = (colecao, tipo) =>
    new RegExp(`CONFIG\\.${colecao}\\.dataModels(\\.${tipo}|\\["${tipo}"\\])\\s*=`);

  for (const tipo of Object.keys(manifesto.documentTypes.Actor)) {
    assert.match(entrada, registrado("Actor", tipo), `Actor ${tipo}`);
  }
  for (const tipo of Object.keys(manifesto.documentTypes.Item)) {
    assert.match(entrada, registrado("Item", tipo), `Item ${tipo}`);
  }
});

test("o system.json aponta para arquivos que existem", () => {
  const manifesto = JSON.parse(readFileSync(join(RAIZ, "system.json"), "utf8"));
  for (const caminho of [...manifesto.esmodules, ...manifesto.styles, ...manifesto.languages.map((l) => l.path)]) {
    assert.doesNotThrow(() => statSync(join(RAIZ, caminho)), caminho);
  }
});

test("compatibilidade declarada cobre v13 e v14", () => {
  const { compatibility } = JSON.parse(readFileSync(join(RAIZ, "system.json"), "utf8"));
  assert.equal(compatibility.minimum, "13");
  assert.equal(compatibility.verified, "14");
});

// Sem `"socket": true` no manifesto, o servidor não relaia o canal `system.<id>`: o
// jogador pede ao mestre para gravar no desafio e nada acontece, o card só do mestre
// nunca nasce, o contador do hack não abre na tela de ninguém. Como o mestre executa
// tudo direto (sem passar pelo socket), o bug só aparecia com dois clientes — e os
// testes rodam como mestre (achado em uso real, na terceira rodada de teste manual).
test("system.json declara o canal de socket usado por comoMestre/paraTodos", () => {
  const manifesto = JSON.parse(readFileSync(join(RAIZ, "system.json"), "utf8"));
  assert.equal(manifesto.socket, true, "o sistema fala pelo socket: declare \"socket\": true");
});
