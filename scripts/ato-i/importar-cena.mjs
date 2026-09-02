/**
 * Puxa uma cena do seu mundo de volta para o compêndio do sistema.
 *
 * O caminho normal é o contrário — o compêndio gera a cena. Este script existe para
 * quando o trabalho é seu: você mura, ilumina e ajusta a cena dentro do Foundry, que é
 * onde dá para ver o resultado, e depois traz isso para `packs/sources/` para virar
 * compêndio de novo.
 *
 * Duas entradas:
 *
 *   npm run ato-i:cena -- --mundo op2-meu --cena "O Porão"     # lê o banco do mundo
 *   npm run ato-i:cena -- --de ~/Downloads/fvtt-Scene-porao.json  # export da interface
 *
 * O banco do mundo fica travado enquanto o Foundry está aberto: feche antes, ou use o
 * export (clique direito na cena → Export Data).
 *
 * O que entra no compêndio: paredes, luzes, sons de ambiente, ladrilhos, desenhos e a
 * configuração da cena. O que fica de fora: tokens, notas e a névoa já explorada — tudo
 * isso aponta para documentos e estado do SEU mundo, e não significaria nada em outro.
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";

const DESTINO = "packs/sources/ato-i-cenas/porao.json";
const FUNDO = "op2-ato-i/mapas/mapa-03-o-porao-sala-secreta-duto-de-ventilacao-completo.jpg";

const args = process.argv.slice(2);
const opcao = (nome) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : null;
};

const DATA = process.env.FOUNDRY_DATA
  ?? join(homedir(), "Library", "Application Support", "FoundryVTT", "Data");

function doArquivo(caminho) {
  return JSON.parse(readFileSync(caminho, "utf8"));
}

/** Lê a cena direto do banco do mundo — sem passar pela interface. */
function doMundo(mundo, nomeDaCena) {
  const pasta = join(DATA, "worlds", mundo, "data");
  if (!existsSync(join(pasta, "scenes"))) {
    throw new Error(`Não achei as cenas de "${mundo}" em ${pasta}. Confira o nome da pasta do mundo.`);
  }
  const saida = mkdtempSync(join(tmpdir(), "op2-cena-"));
  try {
    execFileSync("npx", [
      "fvtt", "package", "unpack", "--type", "World", "--id", mundo,
      "-n", "scenes", "--in", pasta, "--out", saida,
    ], { stdio: ["ignore", "ignore", "inherit"] });

    const arquivos = readdirSync(saida).filter((a) => a.endsWith(".json"));
    const cenas = arquivos.map((a) => doArquivo(join(saida, a)));
    const achada = nomeDaCena
      ? cenas.find((c) => c.name?.toLowerCase().includes(nomeDaCena.toLowerCase()))
      : cenas.find((c) => c.name?.toLowerCase().includes("porão"));
    if (!achada) {
      throw new Error(`Nenhuma cena com "${nomeDaCena ?? "porão"}" no nome. Achei: ${cenas.map((c) => c.name).join(", ")}`);
    }
    return achada;
  } finally {
    rmSync(saida, { recursive: true, force: true });
  }
}

function limpar(cena, anterior) {
  // Mantém a identidade da entrada: o compêndio atualiza em vez de ganhar uma cópia.
  const id = anterior?._id ?? cena._id;

  // Estado e referências do mundo de origem não viajam.
  const fora = ["tokens", "notes", "fog", "active", "navigation", "navOrder", "navName",
    "playlist", "playlistSound", "journal", "journalEntryPage", "ownership", "folder"];
  const limpa = Object.fromEntries(Object.entries(cena).filter(([k]) => !fora.includes(k)));

  limpa._id = id;
  limpa._key = `!scenes!${id}`;
  limpa.name = anterior?.name ?? cena.name;
  limpa.ownership = { default: 0 };
  limpa.folder = null;
  limpa.sort = 0;
  // O fundo aponta para onde `npm run ato-i` instala, não para o caminho do seu mundo.
  limpa.background = { ...(cena.background ?? {}), src: FUNDO };

  // Cada documento embutido precisa da própria chave para o compêndio compilar.
  for (const colecao of ["walls", "lights", "sounds", "tiles", "drawings", "templates", "regions"]) {
    if (!Array.isArray(limpa[colecao])) continue;
    limpa[colecao] = limpa[colecao].map((doc) => ({
      ...doc, _key: `!scenes.${colecao}!${id}.${doc._id}`,
    }));
  }
  return limpa;
}

const bruta = opcao("de") ? doArquivo(opcao("de")) : doMundo(opcao("mundo") ?? "op2", opcao("cena"));
const anterior = existsSync(DESTINO) ? doArquivo(DESTINO) : null;
const cena = limpar(bruta, anterior);
writeFileSync(DESTINO, `${JSON.stringify(cena, null, 2)}\n`);

const conta = (c) => (Array.isArray(cena[c]) ? cena[c].length : 0);
console.log(`"${cena.name}" → ${DESTINO}`);
console.log(`  ${cena.width}x${cena.height}, grade ${cena.grid?.size}, padding ${cena.padding}`);
console.log(`  paredes ${conta("walls")} (${(cena.walls ?? []).filter((p) => p.door === 2).length} secretas)`
  + `, luzes ${conta("lights")}, sons ${conta("sounds")}, ladrilhos ${conta("tiles")}`);
console.log("Agora: npm run pack:build");
