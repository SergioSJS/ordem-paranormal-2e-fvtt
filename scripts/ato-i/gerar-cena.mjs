/**
 * Gera a cena do Porão (Ato I) com as paredes derivadas da própria arte.
 *
 * Os três mapas publicados são o mesmo desenho com áreas reveladas em etapas: porão,
 * porão + sala secreta, e completo com o duto de ventilação. Três cenas para o mesmo
 * lugar obrigam o mestre a trocar de mapa no meio da sessão e perder tokens e estado —
 * uma cena só, com muros, faz o mesmo trabalho melhor.
 *
 * As paredes não são desenhadas na mão: a diferença entre os três arquivos DIZ onde
 * cada área começa. Este script compara os três, acha a borda de cada região e escreve
 * a cena — perímetro como parede comum, e a fronteira entre porão, sala secreta e duto
 * como porta secreta, que o mestre abre quando o grupo descobre a passagem.
 *
 *   node scripts/ato-i/gerar-cena.mjs
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
execFileSync("python3", [join(AQUI, "gerar-cena.py")], { stdio: "inherit" });
