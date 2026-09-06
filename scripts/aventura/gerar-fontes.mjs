/**
 * Empacota, para a janela de aventuras, o que cada ato precisa dos compêndios do
 * sistema: `assets/aventura/fontes-ato-i.json` (pré-gerados, cena, handouts, trilha)
 * e `fontes-ato-ii.json` (agentes, cena, ferramentas). É o mesmo JSON de
 * `packs/sources/`, já com os documentos embutidos remontados e sem `_key` — pronto
 * para entrar num `Adventure` (`fontes.mjs`).
 *
 * Por que um arquivo e não os compêndios: os packs do Ato II não existem (as fichas
 * dos agentes apontam para as artes do zip da editora, e um compêndio de fichas sem
 * retrato só confunde), e `packs/sources/` não vai no pacote publicado. O navegador
 * busca este JSON com um `fetch`. Roda no `pack:build`; não é versionado.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fontesDoAtoI, fontesDoAtoII } from "./fontes.mjs";

const DESTINO = "assets/aventura";

const fontes = {
  // Formato v14 da cena: é o cliente que cria o Adventure, e ele não migra o v13.
  "fontes-ato-i.json": fontesDoAtoI({ nivel: true }),
  "fontes-ato-ii.json": fontesDoAtoII({ nivel: true }),
};

mkdirSync(DESTINO, { recursive: true });
for (const [nome, dados] of Object.entries(fontes)) {
  writeFileSync(join(DESTINO, nome), JSON.stringify(dados));
  const resumo = Object.entries(dados).map(([k, v]) => `${k} ${Array.isArray(v) ? v.length : (v ? 1 : 0)}`).join(", ");
  console.log(`${nome}: ${resumo}`);
}
