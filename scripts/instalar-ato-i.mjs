/**
 * Copia os arquivos públicos do Ato I para dentro do User Data do Foundry, no
 * caminho que os compêndios do sistema esperam (`op2-ato-i/`).
 *
 * Os arquivos NÃO são distribuídos com o sistema: são material da editora, liberado
 * de graça para o playtest, mas não nosso para redistribuir — mesma política do PDF
 * (ver `.gitignore`). Quem tem os arquivos roda isto uma vez e os compêndios passam
 * a achar as imagens.
 *
 *   FOUNDRY_DATA="$HOME/Library/Application Support/FoundryVTT/Data" npm run ato-i
 */
import { cp, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";

const ORIGEM = "docs/Arquivos para o público - Ato I";
const DATA = process.env.FOUNDRY_DATA
  ?? join(process.env.HOME, "Library", "Application Support", "FoundryVTT", "Data");
const DESTINO = join(DATA, "op2-ato-i");

/** "Handout 01 - Conversa Eloísa.png" → "handout-01-conversa-eloisa.png" */
function slug(nome) {
  const semExt = nome.slice(0, nome.length - extname(nome).length);
  return semExt
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + extname(nome).toLowerCase();
}

const PASTAS = [
  ["Handouts", "handouts"],
  ["Históricos de personagem", "historicos"],
  ["Tokens", "tokens"],
  ["Mapas", "mapas"],
  ["Músicas", "musicas"],
  ["Fichas de personagem", "fichas"],
];

if (!existsSync(ORIGEM)) {
  console.error(`Não achei "${ORIGEM}". Coloque a pasta liberada do playtest ali e rode de novo.`);
  process.exit(1);
}

let total = 0;
for (const [pasta, alvo] of PASTAS) {
  const de = join(ORIGEM, pasta);
  if (!existsSync(de)) continue;
  const para = join(DESTINO, alvo);
  await mkdir(para, { recursive: true });

  for (const arquivo of await readdir(de)) {
    if (arquivo.startsWith(".")) continue;
    await cp(join(de, arquivo), join(para, slug(arquivo)));
    total += 1;
  }
  console.log(`${pasta} → ${para}`);
}

console.log(`\n${total} arquivo(s) instalado(s) em ${DESTINO}.`);
console.log("Agora importe os compêndios do sistema: Pré-gerados do Ato I, Handouts e Habilidades.");
