/**
 * Traz as artes do pacote público do Ato I para dentro do sistema.
 *
 *   npm run ato-i:assets
 *
 * O material do Ato I é liberado para uso, então ele mora em `assets/ato-i/` e viaja no
 * sistema — o mestre não instala nada à parte. Este script só refaz a cópia quando o
 * pacote da editora mudar; os nomes viram slug (minúsculas, sem acento) porque é assim
 * que os compêndios apontam.
 */
import { cp, mkdir, readdir } from "node:fs/promises";
import { join, extname } from "node:path";
const ORIGEM = "docs/Arquivos para o público - Ato I";
const DESTINO = "assets/ato-i";
const slug = (nome) => {
  const semExt = nome.slice(0, nome.length - extname(nome).length);
  return semExt.normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + extname(nome).toLowerCase();
};
// Só o que os compêndios referenciam: os mapas 01 e 02 são etapas do mesmo desenho (a
// cena é uma só, com paredes) e as fichas prontas não entram em documento nenhum.
const PASTAS = [["Handouts", "handouts"], ["Tokens", "tokens"],
  ["Históricos de personagem", "historicos"], ["Músicas", "musicas"],
  ["Mapas", "mapas", (a) => a.startsWith("Mapa 03")]];
let n = 0;
for (const [de, para, filtro] of PASTAS) {
  await mkdir(join(DESTINO, para), { recursive: true });
  for (const arquivo of await readdir(join(ORIGEM, de))) {
    if (arquivo.startsWith(".") || (filtro && !filtro(arquivo))) continue;
    await cp(join(ORIGEM, de, arquivo), join(DESTINO, para, slug(arquivo)));
    n += 1;
  }
}
console.log(`${n} arquivos em ${DESTINO}`);
