/**
 * Compila os compêndios de `packs/sources/<nome>/` para `packs/<nome>/`.
 * Lê a lista do próprio `system.json`, então não há uma segunda fonte de verdade.
 */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

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
  console.log(`Compilando ${pack.name}…`);
  execFileSync("npx", [
    "fvtt", "package", "pack",
    "--type", "System",
    "--id", manifesto.id,
    "-n", pack.name,
    "--in", fonte,
    "--out", pack.path,
  ], { stdio: "inherit" });
}
