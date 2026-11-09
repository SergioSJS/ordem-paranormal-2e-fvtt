/**
 * Roda o extrator das missões (`module/extrator/missoes.mjs`) num PDF do beta, pelo Node, e grava o
 * resultado para `comparar-extrator.py`. A saída é texto do livro: fica em `build/`, fora do git.
 *
 *   node scripts/beta/rodar-extrator.mjs <pdf> build/beta.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { paginasDoPdf } from "../../module/extrator/paginas.mjs";
import { extrairPontosDaMissao, paginasDaMissao, roteiroDaMissao } from "../../module/extrator/missoes.mjs";

const [pdfCaminho, saidaCaminho = "build/beta.json"] = process.argv.slice(2);
if (!pdfCaminho) throw new Error("Uso: node scripts/beta/rodar-extrator.mjs <pdf> [saida.json]");

const SUFIXO = "Contents/Resources/app/node_modules/@foundryvtt/pdfjs/build/pdf.mjs";
const PDFJS = process.env.OP2_PDFJS ?? [
  "Foundry Virtual Tabletop.app", "Foundry Virtual Tabletop-14.app", "Foundry Virtual Tabletop-13.app",
].map((app) => `/Applications/${app}/${SUFIXO}`).find(existsSync);
if (!PDFJS) throw new Error("pdf.js do Foundry não encontrado: aponte OP2_PDFJS.");

const { getDocument } = await import(PDFJS);
const pdf = await getDocument({ data: new Uint8Array(readFileSync(pdfCaminho)) }).promise;
const paginas = await paginasDoPdf(pdf);
const saida = {};
for (const missao of ["missao-1", "missao-2"]) {
  const daMissao = paginasDaMissao(paginas, missao);
  const { pontos, avisos } = extrairPontosDaMissao(daMissao, missao);
  saida[missao] = {
    paginas: daMissao.map((p) => p.numero),
    pontos,
    avisos,
    roteiro: roteiroDaMissao(daMissao, pontos),
  };
  const linhas = pontos.reduce((n, p) => n + p.informacoes.length, 0);
  console.log(`${missao}: p. ${daMissao[0]?.numero}–${daMissao.at(-1)?.numero}, ${pontos.length} pontos, ${linhas} linhas, ${avisos.length} avisos`);
}
mkdirSync(dirname(saidaCaminho), { recursive: true });
writeFileSync(saidaCaminho, JSON.stringify(saida, null, 1));
await pdf.destroy?.();
