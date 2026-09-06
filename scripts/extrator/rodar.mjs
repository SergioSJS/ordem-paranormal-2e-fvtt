/**
 * Roda o extrator JavaScript (o mesmo que o Foundry usa) contra um PDF no Node, e
 * compara com o gabarito do extrator Python.
 *
 *   node scripts/extrator/rodar.mjs <pdf> [pasta-do-gabarito] [--texto]
 *
 * Escreve em `build/js/` o que o Foundry montaria; com `--texto`, escreve também
 * `build/js/texto.txt` (as linhas em colunas, para olhar). Lê o PDF com o pdf.js que
 * o Foundry embarca — é o que garante que o texto sai igual no navegador.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { documentoEmLinhas } from "../../module/extrator/grade.mjs";
import { extrairAtoI } from "../../module/extrator/ato-i.mjs";
import { extrairAtoII } from "../../module/extrator/ato-ii.mjs";
import { montarAtoI } from "../../module/aventura/ato-i.mjs";
import { montarAtoII } from "../../module/aventura/ato-ii.mjs";
import { fontesDoAtoI, fontesDoAtoII } from "../aventura/fontes.mjs";

const PDFJS = process.env.OP2_PDFJS
  ?? "/Applications/Foundry Virtual Tabletop.app/Contents/Resources/app/node_modules/@foundryvtt/pdfjs/build/pdf.mjs";
const SAIDA = "build/js";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const pdfCaminho = args[0];
const gabarito = args[1] ?? "build";
const querTexto = process.argv.includes("--texto");
if (!pdfCaminho) throw new Error("Uso: node scripts/extrator/rodar.mjs <pdf> [pasta-do-gabarito] [--texto]");

const { getDocument } = await import(PDFJS);
const pdf = await getDocument({ data: new Uint8Array(readFileSync(pdfCaminho)) }).promise;
const linhas = await documentoEmLinhas(pdf);
mkdirSync(SAIDA, { recursive: true });
if (querTexto) writeFileSync(join(SAIDA, "texto.txt"), linhas.join("\n"));

const atoI = extrairAtoI(linhas);
const arquivos = {
  "ato-i-pontos.json": atoI.pontos,
  "ato-i-maldicao.json": atoI.maldicao,
  "ato-i-itens.json": atoI.itens,
  "ato-i-roteiro.json": atoI.roteiro,
};
// O Ato II só existe no PDF completo; o gratuito para no Ato I.
let atoII = null;
try {
  atoII = extrairAtoII(linhas);
  arquivos["ato-ii.json"] = atoII.dados;
} catch (erro) {
  console.log(`Ato II: ${erro.message}`);
}
for (const [nome, dados] of Object.entries(arquivos)) {
  writeFileSync(join(SAIDA, nome), `${JSON.stringify(dados, null, 2)}\n`);
}

// A montagem também — é o que a janela faz depois de extrair, e é onde uma
// contradição do livro (o rádio da v1.1) derrubava a aventura inteira sem a
// comparação da extração acusar nada.
try {
  const a1 = montarAtoI(atoI, fontesDoAtoI());
  console.log(`montagem Ato I: ${a1.items.length} itens, ${a1.scenes.length} cena(s) — ok`);
} catch (erro) {
  console.log(`montagem Ato I: FALHOU — ${erro.message}`);
  process.exitCode = 1;
}
if (atoII) {
  const avisos = [];
  try {
    const a2 = montarAtoII(atoII.dados, { atoIPontos: atoI.pontos, atoIMaldicao: atoI.maldicao, ...fontesDoAtoII() }, { avisos });
    console.log(`montagem Ato II: ${a2.items.length} itens — ok${avisos.length ? `, ${avisos.length} aviso(s)` : ""}`);
    for (const a of avisos) console.log(`   !! ${a}`);
  } catch (erro) {
    console.log(`montagem Ato II: FALHOU — ${erro.message}`);
    process.exitCode = 1;
  }
}
const linhasDeQuadro = atoI.pontos.reduce((n, p) => n + p.informacoes.length, 0);
const desafios = atoI.pontos.filter((p) => p.desafio).length;
console.log(`JS: ${atoI.pontos.length} pontos, ${linhasDeQuadro} linhas de quadro, ${desafios} com desafio, `
  + `${atoI.maldicao.eventos.length} rodadas da maldição, ${atoI.itens.itens.length} itens`);
if (atoII) {
  const q = atoII.dados.pontos.reduce((n, p) => n + p.informacoes.length, 0);
  const f = atoII.dados.pontos.reduce((n, p) => n + p.ferramentas.length, 0);
  console.log(`JS Ato II: ${atoII.dados.pontos.length} pontos, ${q} linhas de quadro, ${f} leituras de ferramenta`
    + (atoII.problemas.length ? ` | conferência: ${atoII.problemas.length} problema(s)` : " | conferência limpa"));
  for (const p of atoII.problemas) console.log(`   !! ${p}`);
}

/* ---------------------------------------------------------------- comparação -- */

// O pdftotext deixa espaço antes de vírgula ("4d4 ,") e dois espaços onde havia o
// marcador de lista; o texto certo não tem nenhum dos dois. Comparar sem isso.
// O marcador de lista sai do pdftotext como caractere de controle (\x8a), que o
// gabarito carrega; na grade do pdf.js ele vira "•". Nenhum dos dois conta.
const norm = (v) => (typeof v === "string"
  ? v.replace(/[\u0080-\u009f\u{e000}-\u{f8ff}•]/gu, " ").replace(/\s+([,.;:!?)])/g, "$1").replace(/\s+/g, " ").trim()
  : v);
// O Python deixava a matéria-prima da descrição no JSON; o gerador não a usa.
const IGNORAR = new Set(["descricao_cruas"]);
// Onde o GABARITO está errado e o JS certo — conferido no PDF. O pdftotext perdeu um
// pedaço de frase na Sala Secreta ("grande sala de [jogos, com as] paredes") e deixou
// uma DT solta ("10") no meio das notas do Computador. Ficam registrados aqui para o
// comparativo não acusar o que já foi lido no livro.
const ACEITAS = new Set([
  "ato-i-pontos[23].descricao",
  // …e essa DT solta é a quinta linha do quadro do Computador ("Pesquisar ou
  // Tecnologia, DT 10: o e-mail de 12 de março…"), que o JS lê inteira.
  "ato-i-pontos[28].informacoes",
  "ato-i-pontos[28].notas",
  // O Armário de Ferramentas tem uma linha de "DT 6 ou 10": o pdftotext partiu em
  // "6 ou" (prosa, foi para as notas) e "10" (linha só com o fim da frase). O JS lê
  // a linha inteira com DT 6 e a alternativa 10.
  "ato-i-pontos[13].informacoes[4]",
  "ato-i-pontos[13].notas",
  // Handouts citados sem a palavra "HANDOUT" em caixa alta ("os handouts 05A, 05B e
  // 05C", "handouts 12A, 12B e 12C", "HANDOUTS 13"): o Python não os contava.
  "ato-i-pontos[14].handouts",
  "ato-i-pontos[28].handouts",
  "ato-i-pontos[29].handouts",

  // A legenda do mapa, que o livro imprime no fim da cena inicial: o gabarito guarda
  // o "7" solto de "7. Símbolo (no teto)", o JS não. Lixo nos dois; o texto certo
  // termina em "Bom jogo!".
  "ato-i-roteiro.cenaInicial",
  // Ato II: o pdftotext não pôs linha em branco entre parágrafos da abertura e de
  // "Vitória e derrota", e o Python os colou num parágrafo só. A grade separa como o
  // livro imprime.
  "ato-ii.aberturaDoAto",
  "ato-ii.vitoria",
  // O Ídolo: o Python deu ao Rádio a primeira frase da leitura do Termômetro ("A
  // estatueta desperta leituras quentes…"). Conferido no livro: é do Termômetro.
  "ato-ii.pontos[6].ferramentas[5].texto",
  "ato-ii.pontos[6].ferramentas[6].texto",
  // O Ídolo, de novo: o pdftotext partiu o rótulo "Ocultismo (apenas se o Ídolo for
  // quebrado)" e o Python deixou "quebrado)" solto nas notas do mestre.
  "ato-ii.pontos[6].informacoes[7].pericia",
  "ato-ii.pontos[6].informacoes[7].condicao",
  "ato-ii.pontos[6].notas",
]);
const aceita = (caminho) => [...ACEITAS].some((c) => caminho === c || caminho.startsWith(`${c}[`) || caminho.startsWith(`${c}.`));
function diferencas(a, b, caminho = "", saida = []) {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (aceita(caminho)) return saida;
    if (a.length !== b.length) saida.push(`${caminho}: gabarito ${a.length} vs JS ${b.length} itens`);
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i += 1) diferencas(a[i], b[i], `${caminho}[${i}]`, saida);
  } else if (a && b && typeof a === "object" && typeof b === "object") {
    for (const chave of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (IGNORAR.has(chave)) continue;
      if (aceita(`${caminho}.${chave}`)) continue;
      if (!(chave in a)) saida.push(`${caminho}.${chave}: só no JS`);
      else if (!(chave in b)) saida.push(`${caminho}.${chave}: só no gabarito`);
      else diferencas(a[chave], b[chave], `${caminho}.${chave}`, saida);
    }
  } else if (norm(a) !== norm(b)) {
    if (aceita(caminho)) return saida;
    if (typeof a === "string" && typeof b === "string") {
      // Onde as duas divergem, com um pouco de contexto de cada lado.
      const na = norm(a), nb = norm(b);
      let i = 0;
      while (i < Math.min(na.length, nb.length) && na[i] === nb[i]) i += 1;
      const janela = (s) => JSON.stringify(s.slice(Math.max(0, i - 40), i + 60));
      saida.push(`${caminho} (difere no caractere ${i} de ${nb.length}/${na.length}): ${janela(nb)} ≠ gabarito ${janela(na)}`);
    } else {
      saida.push(`${caminho}: ${JSON.stringify(b)} ≠ gabarito ${JSON.stringify(a)}`);
    }
  }
  return saida;
}

let total = 0;
for (const nome of Object.keys(arquivos)) {
  const referencia = join(gabarito, nome);
  if (!existsSync(referencia)) { console.log(`(sem gabarito para ${nome})`); continue; }
  const esperado = JSON.parse(readFileSync(referencia, "utf8"));
  const difs = diferencas(esperado, arquivos[nome], nome.replace(".json", ""));
  total += difs.length;
  console.log(`${nome}: ${difs.length ? `${difs.length} diferença(s)` : "idêntico ao gabarito"}`);
  for (const d of difs.slice(0, Number(process.env.OP2_MAX_DIFS ?? 25))) console.log(`   ${d}`);
  if (difs.length > 25) console.log(`   … e mais ${difs.length - 25}`);
}
process.exitCode = total ? 1 : 0;
