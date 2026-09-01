import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function arquivos(pasta, extensoes) {
  const saida = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivos(caminho, extensoes));
    else if (extensoes.some((e) => nome.endsWith(e))) saida.push(caminho);
  }
  return saida;
}

function achatar(objeto, prefixo = "") {
  const saida = new Set();
  for (const [chave, valor] of Object.entries(objeto)) {
    const caminho = prefixo ? `${prefixo}.${chave}` : chave;
    if (valor && typeof valor === "object") for (const c of achatar(valor, caminho)) saida.add(c);
    else saida.add(caminho);
  }
  return saida;
}

const ptBR = achatar(JSON.parse(readFileSync(join(RAIZ, "lang/pt-BR.json"), "utf8")));
const en = achatar(JSON.parse(readFileSync(join(RAIZ, "lang/en.json"), "utf8")));

/**
 * Chaves construídas em runtime (`OP2.Atributo.${chave}`, `op2Concat`) não aparecem
 * literais no fonte; são conferidas pelos testes de prefixo abaixo.
 */
function chavesUsadas() {
  const fontes = [
    ...arquivos(join(RAIZ, "templates"), [".hbs"]),
    ...arquivos(join(RAIZ, "module"), [".mjs"]).filter((f) => !f.includes("/tests/")),
  ];
  const usadas = new Map();
  const padrao = /["'`](OP2\.[A-Za-z0-9_.-]+)["'`]/g;

  for (const arquivo of fontes) {
    const texto = readFileSync(arquivo, "utf8");
    for (const [, chave] of texto.matchAll(padrao)) {
      if (chave.endsWith(".")) continue; // prefixo de op2Concat
      if (!usadas.has(chave)) usadas.set(chave, arquivo.replace(`${RAIZ}/`, ""));
    }
  }
  return usadas;
}

/** `labelPrefix` das abas aponta para um ramo, não para uma folha. */
const ehPrefixo = (chave) => [...ptBR].some((c) => c.startsWith(`${chave}.`));

test("toda chave OP2.* usada no código existe em pt-BR", () => {
  const faltando = [...chavesUsadas()]
    .filter(([chave]) => !ptBR.has(chave) && !ehPrefixo(chave))
    .map(([chave, arquivo]) => `${chave} (${arquivo})`);
  assert.deepEqual(faltando, []);
});

test("pt-BR e en têm exatamente as mesmas chaves", () => {
  assert.deepEqual([...ptBR].filter((c) => !en.has(c)), [], "faltando em en.json");
  assert.deepEqual([...en].filter((c) => !ptBR.has(c)), [], "sobrando em en.json");
});

test("os 3 atributos, as 20 perícias e as 6 aptidões estão traduzidos", async () => {
  const { ATRIBUTOS, PERICIAS, APTIDOES_PADRAO, PERFIS } = await import("../config.mjs");
  for (const chave of Object.keys(ATRIBUTOS)) assert.ok(ptBR.has(`OP2.Atributo.${chave}`), chave);
  for (const chave of Object.keys(PERICIAS)) assert.ok(ptBR.has(`OP2.Pericia.${chave}`), chave);
  for (const chave of APTIDOES_PADRAO) assert.ok(ptBR.has(`OP2.Aptidao.${chave}`), chave);
  for (const chave of PERFIS) assert.ok(ptBR.has(`OP2.Perfil.${chave}`), chave);
  assert.equal(Object.keys(PERICIAS).length, 20, "o playtest define exatamente 20 perícias");
});

test("cada linha da tabela de falha crítica tem nome e texto", async () => {
  const { TABELA_FALHA_CRITICA } = await import("../config.mjs");
  for (const { chave } of Object.values(TABELA_FALHA_CRITICA)) {
    assert.ok(ptBR.has(`OP2.FalhaCritica.${chave}.nome`), `${chave}.nome`);
    assert.ok(ptBR.has(`OP2.FalhaCritica.${chave}.texto`), `${chave}.texto`);
  }
});

test("todo template pré-carregado existe no disco", async () => {
  const modulo = readFileSync(join(RAIZ, "module/ui/handlebars.mjs"), "utf8");
  const caminhos = [...modulo.matchAll(/\$\{RAIZ\}\/([\w/-]+\.hbs)/g)].map(([, c]) => c);
  assert.ok(caminhos.length > 0, "nenhum template listado");
  for (const relativo of caminhos) {
    assert.doesNotThrow(() => statSync(join(RAIZ, "templates", relativo)), relativo);
  }
});
