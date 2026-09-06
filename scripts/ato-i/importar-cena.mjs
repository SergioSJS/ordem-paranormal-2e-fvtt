/**
 * Puxa uma cena do seu mundo de volta para o compêndio do sistema.
 *
 * O caminho normal é o contrário — o compêndio gera a cena. Este script existe para
 * quando o trabalho é seu: você mura, ilumina e ajusta a cena dentro do Foundry, que é
 * onde dá para ver o resultado, e depois traz isso para `packs/sources/`.
 *
 *   npm run ato-i:cena -- --mundo op2-meu [--cena "O Porão — Ato I"]
 *   npm run ato-ii:cena -- --mundo op2-meu           # a mesma coisa para o Ato II
 *
 * Lê o banco do mundo direto. `fvtt package unpack` não serve aqui: ele escreve só o
 * documento da cena, e no v14 o mapa de fundo mora num documento de NÍVEL separado
 * (`!scenes.levels!…`) — a cena voltava sem imagem nenhuma (achado em uso real).
 *
 * Com o Foundry aberto o banco fica travado; nesse caso o script trabalha sobre uma
 * cópia, que é leitura consistente o bastante para exportar.
 *
 * Entra no compêndio: paredes, níveis (com o fundo), luzes, sons, ladrilhos, desenhos e
 * regiões. Fica de fora: tokens, notas e névoa explorada — apontam para documentos e
 * estado do SEU mundo, e não significariam nada em outro (marcadores e tokens vêm por
 * outro caminho, por nome: `npm run posicoes`). Som ambiente ou ladrilho que aponte
 * para a pasta do mundo (`worlds/<mundo>/ato-i/…`, onde o zip da editora foi parar)
 * volta para o prefixo do sistema, que o importador troca de novo em quem importar.
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, cpSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import { ClassicLevel } from "classic-level";

const args = process.argv.slice(2);
const opcao = (nome) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : null;
};
const ATO = opcao("ato") ?? "ato-i";
if (!["ato-i", "ato-ii"].includes(ATO)) throw new Error(`--ato ${ATO}? Só ato-i ou ato-ii.`);
const POR_ATO = {
  "ato-i": { fundo: "mapas/mapa-03-o-porao-sala-secreta-duto-de-ventilacao-completo.jpg", cena: "O Porão — Ato I" },
  "ato-ii": { fundo: "mapas/mapa-01-o-porao.jpg", cena: "O Porão — Ato II" },
};
const PREFIXO = `systems/ordem-paranormal-2e/assets/${ATO}/`;
const PASTA = `packs/sources/${ATO}-cenas`;
const DESTINO = `${PASTA}/porao.json`;
const FUNDO = `${PREFIXO}${POR_ATO[ATO].fundo}`;

/** Coleções embutidas que fazem sentido num compêndio. */
const LEVAR = ["walls", "lights", "sounds", "tiles", "drawings", "regions", "templates"];
/** Estado e referências do mundo de origem, que não viajam. */
const DEIXAR = ["tokens", "notes"];

const DATA = process.env.FOUNDRY_DATA
  ?? join(homedir(), "Library", "Application Support", "FoundryVTT", "Data");

async function lerDoMundo(mundo, procurado) {
  const original = join(DATA, "worlds", mundo, "data", "scenes");
  if (!existsSync(original)) {
    throw new Error(`Não achei as cenas de "${mundo}" em ${original}.`);
  }

  // O Foundry aberto segura o LOCK: a cópia deixa exportar sem fechar o programa.
  const temporario = mkdtempSync(join(tmpdir(), "op2-cena-"));
  const copia = join(temporario, "scenes");
  cpSync(original, copia, { recursive: true });
  rmSync(join(copia, "LOCK"), { force: true });

  const db = new ClassicLevel(copia, { valueEncoding: "json" });
  try {
    await db.open();
    const registros = new Map();
    for await (const [chave, valor] of db.iterator()) registros.set(chave, valor);

    const cenas = [...registros.entries()]
      .filter(([k]) => k.startsWith("!scenes!"))
      .map(([k, v]) => ({ id: k.slice("!scenes!".length), doc: v }));
    // Nome exato primeiro: com uma cópia no mundo ("… (Cópia)"), a busca por trecho
    // pega a errada — e a cópia costuma ser o backup, não o trabalho bom.
    const procura = (procurado ?? POR_ATO[ATO].cena).toLowerCase();
    const alvo = cenas.find((c) => c.doc.name?.toLowerCase() === procura)
      ?? cenas.find((c) => c.doc.name?.toLowerCase().includes(procura));
    if (!alvo) {
      throw new Error(`Nenhuma cena com "${procurado ?? POR_ATO[ATO].cena}" no nome. Achei: ${cenas.map((c) => c.doc.name).join(", ")}`);
    }

    const embutidos = {};
    for (const [chave, valor] of registros) {
      const m = /^!scenes\.([a-z]+)!([^.]+)\.(.+)$/.exec(chave);
      if (!m || m[2] !== alvo.id) continue;
      (embutidos[m[1]] ??= []).push(valor);
    }
    // O que aponta para a pasta do mundo volta para o prefixo do sistema.
    const doMundo = new RegExp(`worlds/${mundo}/(ato-i|ato-ii)/`, "g");
    const desmundar = (doc) => JSON.parse(JSON.stringify(doc).replace(doMundo, "systems/ordem-paranormal-2e/assets/$1/"));
    return { id: alvo.id, cena: desmundar(alvo.doc), embutidos: Object.fromEntries(Object.entries(embutidos).map(([k, v]) => [k, v.map(desmundar)])) };
  } finally {
    await db.close().catch(() => {});
    rmSync(temporario, { recursive: true, force: true });
  }
}

/**
 * Escreve a cena no formato que o banco do mundo usa: o registro da cena guarda ARRAYS
 * DE ID, e cada documento embutido é um registro próprio.
 *
 * Menos os níveis. No v14 o mapa de fundo mora num documento de nível, e o compêndio
 * simplesmente não carrega esses registros — o Foundry sintetiza um nível padrão e a
 * cena importa em branco (achado em uso real, testado com id próprio e com o
 * `defaultLevel0000`). O caminho que funciona é o campo legado `background` no registro
 * da cena, que o v14 migra para o nível ao carregar.
 */
function escrever({ id, cena, embutidos }, anterior) {
  const idDaCena = anterior?._id ?? id;
  const arquivos = [];

  const limpa = { ...cena };
  for (const fora of [...DEIXAR, "active", "navigation", "navOrder", "navName", "fog",
    "playlist", "playlistSound", "journal", "journalEntryPage", "folder", "thumb", "_stats",
    "levels", "initialLevel"]) {
    delete limpa[fora];
  }
  limpa._id = idDaCena;
  limpa._key = `!scenes!${idDaCena}`;
  limpa.ownership = { default: 0 };
  limpa.folder = null;
  limpa.sort = 0;

  // O fundo sai do nível e vira campo da cena; o caminho aponta para onde
  // `npm run ato-i` instala, e não para o caminho do seu mundo.
  const nivel = (embutidos.levels ?? [])[0];
  limpa.background = { ...(nivel?.background ?? {}), src: FUNDO };
  if (nivel?.foreground?.src) limpa.foreground = nivel.foreground.src;

  for (const colecao of LEVAR) {
    const docs = embutidos[colecao] ?? [];
    if (!docs.length) { delete limpa[colecao]; continue; }
    limpa[colecao] = docs.map((d) => d._id);
    for (const doc of docs) {
      arquivos.push([`porao-${colecao}-${doc._id}.json`,
        { ...doc, _key: `!scenes.${colecao}!${idDaCena}.${doc._id}` }]);
    }
  }
  arquivos.unshift(["porao.json", limpa]);
  return { cena: limpa, arquivos };
}

const anterior = existsSync(DESTINO) ? JSON.parse(readFileSync(DESTINO, "utf8")) : null;
const { cena, arquivos } = escrever(await lerDoMundo(opcao("mundo") ?? "op2-meu", opcao("cena")), anterior);

// Limpa a pasta antes: documento apagado no seu mundo não pode sobreviver no compêndio.
// `posicoes.json` (marcadores e tokens, de `npm run posicoes`) não é documento e fica.
for (const arquivo of readdirSync(PASTA)) {
  if (arquivo.endsWith(".json") && arquivo !== "posicoes.json") rmSync(join(PASTA, arquivo));
}
for (const [nome, doc] of arquivos) {
  writeFileSync(join(PASTA, nome), `${JSON.stringify(doc, null, 2)}\n`);
}

const conta = (c) => (Array.isArray(cena[c]) ? cena[c].length : 0);
const fundo = cena.background?.src;
console.log(`"${cena.name}" → ${PASTA}/ (${arquivos.length} arquivos)`);
console.log(`  ${cena.width}x${cena.height}, grade ${cena.grid?.size}, padding ${cena.padding}`);
console.log(`  paredes ${conta("walls")}, luzes ${conta("lights")}, `
  + `sons ${conta("sounds")}, ladrilhos ${conta("tiles")}`);
console.log(`  fundo: ${fundo ?? "NENHUM — a cena vai importar sem mapa"}`);
console.log("Agora: npm run pack:build");
