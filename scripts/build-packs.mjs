/**
 * Compila os compêndios de `packs/sources/<nome>/` para `packs/<nome>/`.
 * Lê a lista do próprio `system.json`, então não há uma segunda fonte de verdade.
 *
 * Escreve o LevelDB direto, em vez de chamar `fvtt package pack`. O CLI resolve o caso
 * simples e tropeça no resto: ele não sabe empacotar documento embutido guardado em
 * arquivo próprio (a cena do Porão saiu com o banco vazio), e no v14 o mapa de fundo é
 * um documento de NÍVEL separado. Escrever aqui é uma volta a menos e o formato exato
 * que o mundo usa — chave é o `_key`, valor é o documento sem ele.
 */
import { readFileSync, existsSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ClassicLevel } from "classic-level";

/**
 * Grava um documento e separa as coleções embutidas, que é como o Foundry guarda:
 * o registro do pai fica com um ARRAY DE IDS e cada filho vira registro próprio, sob
 * `!<colecao>.<sub>!<idDoPai>.<idDoFilho>`.
 *
 * Sem isso o ator do compêndio chega sem as habilidades e a cena sem as paredes: o
 * Foundry simplesmente ignora a lista de objetos embutida (achado em uso real, com os
 * pré-gerados perdendo os itens).
 */
function gravar(lote, doc) {
  const { _key, ...valor } = doc;
  const [, colecao, id] = /^!([^!]+)!(.+)$/.exec(_key) ?? [];
  if (!colecao || !id) throw new Error(`_key inválido: ${_key}`);
  let escritos = 1;

  for (const [campo, conteudo] of Object.entries(valor)) {
    const ehColecao = Array.isArray(conteudo) && conteudo.length
      && conteudo.every((f) => f && typeof f === "object" && typeof f._id === "string");
    if (!ehColecao) continue;

    valor[campo] = conteudo.map((filho) => filho._id);
    for (const filho of conteudo) {
      const { _key: _ignorado, ...corpo } = filho;
      escritos += gravar(lote, { ...corpo, _key: `!${colecao}.${campo}!${id}.${filho._id}` });
    }
  }

  lote.put(_key, valor);
  return escritos;
}

const manifesto = JSON.parse(readFileSync("system.json", "utf8"));
const packs = manifesto.packs ?? [];

if (!packs.length) {
  console.log("Nenhum pack declarado em system.json — nada a fazer.");
  process.exit(0);
}

for (const pack of packs) {
  const fonte = `packs/sources/${pack.name}`;
  if (!existsSync(fonte)) {
    console.warn(`Pulando "${pack.name}": ${fonte} não existe.`);
    continue;
  }

  const documentos = readdirSync(fonte)
    .filter((a) => a.endsWith(".json"))
    .map((a) => JSON.parse(readFileSync(join(fonte, a), "utf8")));

  const semChave = documentos.filter((d) => !d._key);
  if (semChave.length) {
    throw new Error(`${pack.name}: ${semChave.length} documento(s) sem "_key" — o Foundry não os acha.`);
  }

  // Apaga antes: documento removido da fonte não pode sobreviver no compêndio, e um
  // `unpack` errado deixa subpasta órfã lá dentro.
  if (existsSync(pack.path)) rmSync(pack.path, { recursive: true, force: true });

  const db = new ClassicLevel(pack.path, { valueEncoding: "json" });
  await db.open();
  let escritos = 0;
  try {
    const lote = db.batch();
    for (const doc of documentos) escritos += gravar(lote, doc);
    await lote.write();
  } finally {
    await db.close();
  }

  console.log(`${pack.name}: ${documentos.length} arquivo(s), ${escritos} registro(s) → ${pack.path}`);
}
