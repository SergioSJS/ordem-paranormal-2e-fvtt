/**
 * Monta a aventura do Ato I no Node, com o mesmo gerador que a janela de aventuras
 * usa no navegador (`module/aventura/ato-i.mjs`), e grava em
 * `packs/sources/ato-i-aventura/ato-i.json` para o `pack:build` e o e2e.
 *
 *   node scripts/extrator/rodar.mjs <pdf>      # extrai o texto para build/js/
 *   node scripts/ato-i/gerar-aventura.mjs      # monta a aventura
 *
 * O texto é da editora: nem o extraído nem a aventura vão para o repositório (ver
 * `.gitignore`). No pacote publicado a aventura não existe — quem monta é o mestre,
 * com o PDF dele, dentro do Foundry.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { montarAtoI } from "../../module/aventura/ato-i.mjs";
import { fontesDoAtoI } from "../aventura/fontes.mjs";

const DESTINO = join("packs/sources", "ato-i-aventura", "ato-i.json");
// O extrator JavaScript escreve em build/js/; o Python antigo, em build/.
const EXTRAIDOS = existsSync("build/js/ato-i-pontos.json") ? "build/js" : "build";
const lerSeExiste = (arquivo) => (existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, "utf8")) : null);

const pontos = lerSeExiste(join(EXTRAIDOS, "ato-i-pontos.json"));
if (!pontos) {
  console.warn(`Sem ${EXTRAIDOS}/ato-i-pontos.json — rode \`node scripts/extrator/rodar.mjs <pdf>\` primeiro.`);
}

const aventura = montarAtoI({
  pontos: pontos ?? [],
  maldicao: lerSeExiste(join(EXTRAIDOS, "ato-i-maldicao.json")),
  itens: lerSeExiste(join(EXTRAIDOS, "ato-i-itens.json")),
  roteiro: lerSeExiste(join(EXTRAIDOS, "ato-i-roteiro.json")),
}, fontesDoAtoI());
aventura._key = `!adventures!${aventura._id}`;

mkdirSync(join("packs/sources", "ato-i-aventura"), { recursive: true });
writeFileSync(DESTINO, `${JSON.stringify(aventura, null, 2)}\n`);
const pregerados = aventura.actors.filter((a) => a.type === "personagem").length;
const porTipo = (tipo) => aventura.items.filter((i) => i.type === tipo).length;
console.log(`${aventura.name} → ${DESTINO}`);
console.log(`  atores ${aventura.actors.length} (${pregerados} pré-gerados + investigação)`);
console.log(`  itens ${aventura.items.length} (${porTipo("ponto-interesse")} pontos, ${porTipo("desafio-acesso")} desafios, ${porTipo("equipamento")} de mesa)`);
console.log(`  cenas ${aventura.scenes.length}, diários ${aventura.journal.length}, trilhas ${aventura.playlists.length}`);
console.log(`  pastas ${aventura.folders.length}`);
