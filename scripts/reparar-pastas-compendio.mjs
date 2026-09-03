/**
 * Recria as pastas de compêndio de um mundo a partir do `packFolders` do manifesto.
 *
 *   npm run reparar-pastas -- <mundo>
 *   FOUNDRY_DATA="$HOME/FoundryV13/Data" npm run reparar-pastas -- <mundo>
 *
 * As pastas que agrupam os compêndios na barra lateral são documentos `Folder` do tipo
 * "Compendium" no banco do MUNDO, e o vínculo pack→pasta mora na configuração
 * `core.compendiumConfiguration`. O `packFolders` do manifesto é só a receita.
 *
 * O Foundry aplica essa receita uma vez só: dentro de `World#updateActivePacks`, e apenas
 * quando a lista de packs muda (um entra ou sai). Num mundo que já conhece todos os packs,
 * apagar as pastas deixa a configuração apontando para IDs mortos — os compêndios voltam
 * para a raiz e não se reorganizam sozinhos. Este script refaz as duas pontas.
 *
 * O Foundry precisa estar FECHADO: o LevelDB do mundo aceita um processo por vez.
 */
import { ClassicLevel } from "classic-level";
import { readFileSync, existsSync } from "node:fs";

const MUNDO = process.argv[2];
const DATA = process.env.FOUNDRY_DATA
  ?? `${process.env.HOME}/Library/Application Support/FoundryVTT/Data`;
const RAIZ = `${DATA}/worlds/${MUNDO}/data`;
// Sem esta conferência o `classic-level` cria os bancos que faltam e o script "conserta"
// um mundo que não existe — foi o que aconteceu quando passei o dataPath no lugar do Data/.
if (!existsSync(`${RAIZ}/settings`)) {
  console.error(`Não achei o mundo em ${RAIZ}.\n`
    + "Aponte FOUNDRY_DATA para a pasta *Data* do Foundry (a que tem worlds/ dentro).");
  process.exit(1);
}

const sistema = JSON.parse(readFileSync("system.json", "utf8"));
const ID = sistema.id;
const agora = Date.now();
const CARACTERES = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const novoId = () => Array.from({ length: 16 }, () => CARACTERES[Math.floor(Math.random() * CARACTERES.length)]).join("");

const pastas = [];
const config = {};
let ordem = 1;
const percorrer = (no, pai) => {
  const _id = novoId();
  pastas.push({
    _id, name: no.name, type: "Compendium", sorting: no.sorting ?? "a",
    sort: 100000 * ordem++, color: no.color ?? null, folder: pai, description: "", flags: {},
    _stats: {
      coreVersion: "14.363", systemId: ID, systemVersion: sistema.version,
      createdTime: agora, modifiedTime: agora, lastModifiedBy: null,
      compendiumSource: null, duplicateSource: null, exportSource: null,
    },
  });
  for (const pack of no.packs ?? []) config[`${ID}.${pack}`] = { folder: _id };
  for (const filha of no.folders ?? []) percorrer(filha, _id);
};
for (const raiz of sistema.packFolders ?? []) percorrer(raiz, null);

const bancoPastas = new ClassicLevel(`${RAIZ}/folders`, { valueEncoding: "json" });
await bancoPastas.open();
// Fora as antigas de compêndio: recriar por cima duplicaria a árvore.
const velhas = [];
for await (const [chave, valor] of bancoPastas.iterator()) if (valor.type === "Compendium") velhas.push(chave);
await bancoPastas.batch([
  ...velhas.map((key) => ({ type: "del", key })),
  ...pastas.map((f) => ({ type: "put", key: `!folders!${f._id}`, value: f })),
]);
await bancoPastas.close();

const bancoSettings = new ClassicLevel(`${RAIZ}/settings`, { valueEncoding: "json" });
await bancoSettings.open();
let chaveConfig = null, atual = {};
for await (const [chave, valor] of bancoSettings.iterator()) {
  if (valor.key === "core.compendiumConfiguration") { chaveConfig = chave; atual = JSON.parse(valor.value || "{}"); }
}
// Preserva o que for de outro pacote; reescreve só o que é nosso.
for (const chave of Object.keys(atual)) if (chave.startsWith(`${ID}.`)) delete atual[chave];
const valor = { ...atual, ...config };
const _id = chaveConfig ? chaveConfig.split("!").pop() : novoId();
await bancoSettings.put(chaveConfig ?? `!settings!${_id}`, {
  key: "core.compendiumConfiguration", value: JSON.stringify(valor), _id, user: null,
  _stats: { coreVersion: "14.363", systemId: ID, systemVersion: sistema.version,
    createdTime: agora, modifiedTime: agora, lastModifiedBy: null,
    compendiumSource: null, duplicateSource: null, exportSource: null },
});
await bancoSettings.close();

console.log(`${MUNDO}: ${velhas.length} pasta(s) antiga(s) fora, ${pastas.length} recriada(s)`);
for (const f of pastas) console.log(`  ${f.name}${f.folder ? " (dentro de outra)" : ""}`);
console.log(`packs configurados: ${Object.keys(config).length}`);
