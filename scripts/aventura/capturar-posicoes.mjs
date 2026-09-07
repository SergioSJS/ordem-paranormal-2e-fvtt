/**
 * Captura, de uma cena do seu mundo, ONDE ficam os marcadores dos pontos de interesse e
 * os tokens dos personagens — e traz isso para `packs/sources/<ato>-cenas/posicoes.json`,
 * para o gerador recriar tudo na cena de quem monta a aventura do PDF.
 *
 *   npm run posicoes -- --ato ato-i --mundo op2-meu [--cena "O Porão — Ato I"]
 *   npm run posicoes -- --ato ato-ii --mundo op2-meu
 *
 * O fluxo: importe o ato no seu mundo, arraste os pontos para o mapa (vira marcador) e
 * posicione os tokens onde a aventura começa. O que sai daqui é só posição POR NOME
 * ("Molho de Chaves" em x/y, "Alan" em x/y, a câmera inicial) — nada de id do seu mundo
 * e nada da editora. Na montagem, `module/aventura/ato-*.mjs` casa cada nome com o ponto
 * e o pré-gerado daquela geração e cria as notas e os tokens com os ids certos.
 *
 * Lê o banco do mundo numa cópia, como `scripts/ato-i/importar-cena.mjs`: com o Foundry
 * aberto o banco fica travado, e a cópia é leitura consistente o bastante.
 */
import { writeFileSync, existsSync, mkdtempSync, rmSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import { ClassicLevel } from "classic-level";

const args = process.argv.slice(2);
const opcao = (nome) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : null;
};
const ato = opcao("ato");
const mundo = opcao("mundo");
if (!["ato-i", "ato-ii"].includes(ato) || !mundo) {
  console.error("Uso: node scripts/aventura/capturar-posicoes.mjs --ato ato-i|ato-ii --mundo <id do mundo> [--cena <nome>]");
  process.exit(1);
}
const NOME_DA_CENA = { "ato-i": "O Porão — Ato I", "ato-ii": "O Porão — Ato II" };
const procurado = (opcao("cena") ?? NOME_DA_CENA[ato]).toLowerCase();
const DESTINO = `packs/sources/${ato}-cenas/posicoes.json`;
const DATA = process.env.FOUNDRY_DATA ?? join(homedir(), "Library", "Application Support", "FoundryVTT", "Data");

const original = join(DATA, "worlds", mundo, "data", "scenes");
if (!existsSync(original)) throw new Error(`Não achei as cenas de "${mundo}" em ${original}.`);
const temporario = mkdtempSync(join(tmpdir(), "op2-posicoes-"));
const copia = join(temporario, "scenes");
cpSync(original, copia, { recursive: true });
rmSync(join(copia, "LOCK"), { force: true });

const db = new ClassicLevel(copia, { valueEncoding: "json" });
let saida;
try {
  await db.open();
  const registros = new Map();
  for await (const [chave, valor] of db.iterator()) registros.set(chave, valor);
  const cenas = [...registros.entries()].filter(([k]) => k.startsWith("!scenes!"))
    .map(([k, v]) => ({ id: k.slice("!scenes!".length), doc: v }));
  const alvo = cenas.find((c) => c.doc.name?.toLowerCase() === procurado)
    ?? cenas.find((c) => c.doc.name?.toLowerCase().includes(procurado));
  if (!alvo) throw new Error(`Nenhuma cena "${procurado}" em ${mundo}. Achei: ${cenas.map((c) => c.doc.name).join(", ")}`);

  const embutidos = (colecao) => [...registros.entries()]
    .filter(([k]) => k.startsWith(`!scenes.${colecao}!${alvo.id}.`)).map(([, v]) => v);

  // Marcadores: as notas que o sistema criou pelo painel (a flag guarda o uuid do ponto
  // no SEU mundo; o texto da nota é o nome do ponto, e é pelo nome que se casa).
  // O id do Item também: os ids desta geração são estáveis (`ident`), então no mesmo ato
  // o marcador casa pelo id — nomes se repetem entre os atos ("Depósito A" existe nos
  // dois) e podem se repetir dentro de um. O nome fica para o outro ato e para quando
  // a geração mudar de id.
  const marcadores = embutidos("notes")
    .filter((n) => n.flags?.["ordem-paranormal-2e"]?.marcador)
    .map((n) => ({ nome: n.text, id: String(n.flags["ordem-paranormal-2e"].marcador).replace(/^Item\./, ""), x: Math.round(n.x), y: Math.round(n.y) }))
    .sort((a, b) => a.nome.localeCompare(b.nome) || a.x - b.x || a.y - b.y);
  // Tokens: pelo nome do token (o nome do pré-gerado). Elevação, rotação e escondido
  // também, para o começo da aventura sair como você deixou.
  const tokens = embutidos("tokens")
    .map((t) => ({
      nome: t.name, x: Math.round(t.x), y: Math.round(t.y),
      ...(t.elevation ? { elevation: t.elevation } : {}),
      ...(t.rotation ? { rotation: t.rotation } : {}),
      ...(t.hidden ? { hidden: true } : {}),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  const { x, y, scale } = alvo.doc.initial ?? {};
  saida = {
    cena: alvo.doc.name,
    ...(x != null && y != null ? { initial: { x: Math.round(x), y: Math.round(y), scale: scale ?? 1 } } : {}),
    marcadores, tokens,
  };
} finally {
  await db.close().catch(() => {});
  rmSync(temporario, { recursive: true, force: true });
}

writeFileSync(DESTINO, `${JSON.stringify(saida, null, 2)}\n`);
console.log(`${DESTINO}: ${saida.marcadores.length} marcador(es), ${saida.tokens.length} token(s)${saida.initial ? ", câmera inicial" : ""} — da cena "${saida.cena}" de ${mundo}`);
if (!saida.marcadores.length) console.warn("  (nenhum marcador: arraste os pontos de interesse para o mapa pelo painel antes de capturar)");
