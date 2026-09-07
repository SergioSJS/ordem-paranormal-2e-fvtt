/**
 * Deriva a cena do Ato II da cena murada do Ato I.
 *
 *   node scripts/ato-ii/gerar-cena.mjs
 *
 * O mapa do Ato II é o mesmo porão, redesenhado 3,9% maior e com a escada mais longa
 * (3537×4101 contra 3537×3750). As vigas das paredes foram medidas nos dois mapas
 * (detecção de cor, `scripts/ato-ii/README.md`): a transformação é uma escala uniforme
 * a partir do canto superior esquerdo — x' = 1,0392·x − 2, y' = 1,0383·y. As 39
 * paredes muradas à mão no Ato I viajam por ela.
 *
 * O que muda de estado, pelo texto do livro (p. 81 e p. 95): a estante está deslocada
 * e a passagem para a sala secreta, aberta; a porta de saída está aberta. A grade do
 * duto continua sendo desafio ("Grade Alta"). As portas dos depósitos ficam fechadas e
 * destrancadas — "todos os desafios de acesso que foram solucionados no Ato I seguem
 * resolvidos" depende de cada mesa, e destrancar é um clique.
 *
 * O fundo aponta para o prefixo `assets/ato-ii/`, que o importador troca pela pasta do
 * mundo quando o mestre entrega o zip da editora.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const ORIGEM = "packs/sources/ato-i-cenas";
const DESTINO = "packs/sources/ato-ii-cenas";
const PREFIXO = "systems/ordem-paranormal-2e/assets/ato-ii";

const ESCALA_X = 1.0392;
const ESCALA_Y = 1.0383;
const DESLOCAMENTO_X = -2;

const ident = (semente) => createHash("sha1").update(semente).digest("hex").slice(0, 16);
const ler = (arquivo) => JSON.parse(readFileSync(join(ORIGEM, arquivo), "utf8"));

const cenaAtoI = ler("porao.json");
const paredesAtoI = readdirSync(ORIGEM)
  .filter((a) => a.startsWith("porao-walls-"))
  .map(ler)
  .sort((a, b) => a._id.localeCompare(b._id));

const ponto = (x, y) => [Math.round(x * ESCALA_X + DESLOCAMENTO_X), Math.round(y * ESCALA_Y)];
const transformar = ([x1, y1, x2, y2]) => [...ponto(x1, y1), ...ponto(x2, y2)];

// As luzes do Ato I (do mundo de quem as pôs, por `npm run ato-i:cena`) viajam pela
// mesma transformação: mesmo porão, mesmos cantos. O raio fica em metros e a grade tem
// o mesmo tamanho nos dois mapas, então só a posição muda.
const luzes = readdirSync(ORIGEM)
  .filter((a) => a.startsWith("porao-lights-"))
  .map(ler)
  .sort((a, b) => a._id.localeCompare(b._id))
  .map(({ _key, _id, levels, x, y, ...resto }) => {
    const [nx, ny] = ponto(x, y);
    return { ...resto, x: nx, y: ny, _id: ident(`luz-ato-ii-${_id}`) };
  });

/**
 * As portas do Ato I, pelo lugar onde estão. Identificar pelo desenho, não pelo id:
 * se a cena do Ato I for murada de novo os ids mudam, a geometria não.
 */
function estadoDaPorta(parede) {
  if (!parede.door) return { door: 0, ds: 0 };
  const [x1, y1, x2, y2] = parede.c;
  const vertical = x1 === x2;
  // Passagem da estante: parede vertical entre porão e sala secreta, embaixo.
  if (vertical && x1 > 2500 && x1 < 2700 && y1 > 1900) return { door: 1, ds: 1 };
  // Porta de saída: horizontal no muro de baixo, no canto esquerdo (escada).
  if (!vertical && y1 > 2200 && y1 < 2300 && x2 < 700) return { door: 1, ds: 1 };
  // Grade do duto (porão) e saída do duto (sala secreta): seguem trancadas.
  if (!vertical && y1 >= 2200 && x1 > 1000) return { door: 2, ds: 2 };
  // Portas dos depósitos: fechadas, destrancadas.
  if (vertical && x1 > 1500 && x1 < 1700) return { door: 1, ds: 0 };
  return { door: parede.door, ds: parede.ds };
}

const paredes = paredesAtoI.map((parede) => {
  const { _key, _id, ...resto } = parede;
  const semTexto = { ...resto, ...estadoDaPorta(parede), c: transformar(parede.c) };
  return { ...semTexto, _id: ident(`parede-ato-ii-${_id}`) };
});

// Os embutidos da cena do Ato I são arrays de id de arquivos que só existem lá: fora.
// O que fica — grade, escuridão, névoa, visão — é o que o mestre configurou no Ato I e
// vale igual no Ato II.
const { _key, walls, lights, sounds, tiles, drawings, regions, templates, ...cena } = cenaAtoI;
const _id = ident("cena-ato-ii-porao");
const cenaAtoII = {
  ...cena,
  _id,
  _key: `!scenes!${_id}`,
  name: "O Porão — Ato II",
  width: 3537,
  height: 4101,
  background: { ...cena.background, src: `${PREFIXO}/mapas/mapa-01-o-porao.jpg` },
  walls: paredes,
  ...(luzes.length ? { lights: luzes } : {}),
};

mkdirSync(DESTINO, { recursive: true });
writeFileSync(join(DESTINO, "porao.json"), `${JSON.stringify(cenaAtoII, null, 2)}\n`);

// Os marcadores dos pontos, pelas posições capturadas no Ato I (`npm run posicoes`):
// mesma transformação, e casam no Ato II pelo NOME do ponto — sem id (é de outra
// geração) e sem tokens (os agentes do Ato II começam onde a mesa decidir).
const posicoesAtoI = join(ORIGEM, "posicoes.json");
let marcadores = 0;
if (existsSync(posicoesAtoI)) {
  const p = JSON.parse(readFileSync(posicoesAtoI, "utf8"));
  const posicoesAtoII = {
    cena: cenaAtoII.name,
    ...(p.initial ? { initial: { ...p.initial, ...(() => { const [x, y] = ponto(p.initial.x, p.initial.y); return { x, y }; })() } } : {}),
    marcadores: (p.marcadores ?? []).map(({ nome, x, y }) => { const [nx, ny] = ponto(x, y); return { nome, x: nx, y: ny }; }),
    tokens: [],
  };
  marcadores = posicoesAtoII.marcadores.length;
  writeFileSync(join(DESTINO, "posicoes.json"), `${JSON.stringify(posicoesAtoII, null, 2)}\n`);
}

const portas = paredes.filter((p) => p.door);
console.log(`${cenaAtoII.name}: ${paredes.length} paredes (${portas.length} portas), ${luzes.length} luzes, ${marcadores} marcadores, grade tipo ${cenaAtoII.grid?.type} → ${DESTINO}/porao.json`);
for (const p of portas) console.log(`  porta ${p.c.join(",")} tipo ${p.door} estado ${p.ds}`);
