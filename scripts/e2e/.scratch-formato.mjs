import { ClassicLevel } from "classic-level";
const RAIZ = `${process.env.HOME}/Library/Application Support/FoundryVTT/Data/worlds/op2/data`;
for (const banco of ["folders", "settings"]) {
  const db = new ClassicLevel(`${RAIZ}/${banco}`, { valueEncoding: "json" });
  await db.open();
  for await (const [chave, valor] of db.iterator()) {
    if (banco === "settings" && !String(valor.key).includes("compendiumConfiguration")) continue;
    if (banco === "folders" && valor.type !== "Compendium") continue;
    console.log(`[${banco}] chave=${chave}\n${JSON.stringify(valor).slice(0, 700)}\n`);
  }
  await db.close();
}
