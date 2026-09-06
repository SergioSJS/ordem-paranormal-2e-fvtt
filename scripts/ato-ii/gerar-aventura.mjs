/**
 * Monta a aventura do Ato II no Node, com o mesmo gerador que a janela de aventuras
 * usa no navegador (`module/aventura/ato-ii.mjs`), e grava em
 * `packs/sources/ato-ii-aventura/ato-ii.json` para o `pack:build` e o e2e.
 *
 *   node scripts/extrator/rodar.mjs <pdf>      # extrai o texto para build/js/
 *   node scripts/ato-ii/gerar-aventura.mjs     # monta a aventura
 *
 * O Ato II só existe no PDF completo do playtest. As artes não vêm no sistema: a
 * aventura declara em `flags.extras` o que espera do zip da editora.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { montarAtoII } from "../../module/aventura/ato-ii.mjs";
import { fontesDoAtoII } from "../aventura/fontes.mjs";

const DESTINO = join("packs/sources", "ato-ii-aventura", "ato-ii.json");
const EXTRAIDOS = existsSync("build/js/ato-ii.json") ? "build/js" : "build";

const lerJson = (arquivo) => JSON.parse(readFileSync(arquivo, "utf8"));
const lerSeExiste = (arquivo) => (existsSync(arquivo) ? lerJson(arquivo) : null);

const dados = lerSeExiste(join(EXTRAIDOS, "ato-ii.json"));
if (!dados) {
  console.error(`Sem ${EXTRAIDOS}/ato-ii.json — rode \`node scripts/extrator/rodar.mjs <pdf completo>\` primeiro.`);
  process.exit(1);
}

const avisos = [];
const aventura = montarAtoII(dados, {
  atoIPontos: lerSeExiste(join(EXTRAIDOS, "ato-i-pontos.json")) ?? [],
  atoIMaldicao: lerSeExiste(join(EXTRAIDOS, "ato-i-maldicao.json")),
  ...fontesDoAtoII(),
}, { avisos });
for (const a of avisos) console.warn(`  !! ${a}`);
aventura._key = `!adventures!${aventura._id}`;

mkdirSync(join("packs/sources", "ato-ii-aventura"), { recursive: true });
writeFileSync(DESTINO, `${JSON.stringify(aventura, null, 2)}\n`);
const porTipo = (tipo) => aventura.items.filter((i) => i.type === tipo);
const pontos = porTipo("ponto-interesse");
const linhasDeQuadro = pontos.reduce((n, p) => n + p.system.informacoes.length, 0);
const leituras = pontos.reduce((n, p) => n + Object.values(p.system.ferramentas).filter(Boolean).length, 0);
console.log(`${aventura.name} → ${DESTINO}`);
console.log(`  atores ${aventura.actors.length} (${aventura.actors.length - 1} agentes + investigação)`);
console.log(`  itens ${aventura.items.length} (${pontos.length} pontos, ${porTipo("desafio-acesso").length} desafios, ${porTipo("ferramenta").length} ferramentas, ${porTipo("evento").length} evento)`);
console.log(`  linhas de quadro ${linhasDeQuadro}, leituras de ferramenta ${leituras}`);
console.log(`  cenas ${aventura.scenes.length}, diários ${aventura.journal.length}, trilhas ${aventura.playlists.length}, pastas ${aventura.folders.length}`);
console.log(`  extras esperados do zip: ${aventura.flags["ordem-paranormal-2e"].extras.arquivos.length}`);
