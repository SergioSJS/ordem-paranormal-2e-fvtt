/**
 * O que cada ato precisa dos compêndios do sistema, lido de `packs/sources/` e pronto
 * para entrar num `Adventure`: documentos sem `_key`, cena com os embutidos remontados
 * e no formato do Foundry v14.
 *
 * Usado por `gerar-fontes.mjs` (que grava `assets/aventura/fontes-ato-*.json` para a
 * janela de aventuras) e pelos scripts `gerar-aventura.mjs` de `scripts/ato-i` e `scripts/ato-ii`.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ident } from "../../module/aventura/comum.mjs";

const FONTES = "packs/sources";

export const semChave = ({ _key, ...resto }) => resto;

/** As posições de marcadores e tokens capturadas de um mundo, se já houver. */
const posicoes = (pasta) => {
  const arquivo = join(FONTES, pasta, "posicoes.json");
  return existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, "utf8")) : null;
};
export const ler = (pasta) => readdirSync(join(FONTES, pasta))
  .filter((a) => a.endsWith(".json"))
  .map((a) => JSON.parse(readFileSync(join(FONTES, pasta, a), "utf8")));

/**
 * O fundo da cena como NÍVEL, que é como o v14 guarda (`Scene#levels`). A fonte está
 * no formato do v13 (`background.src` na raiz); o servidor migra isso ao abrir um
 * compêndio, mas `Adventure.create` no cliente não — a cena chegava sem mapa (achado
 * no e2e da janela de aventuras). O mapa segue `BaseScene._LEVELS_PROPERTY_MAP`.
 *
 * Só para o bundle da janela: no pack LevelDB (`build-packs.mjs`) o servidor ignora
 * `levels` inline e cria um nível padrão vazio — ali o formato v13 é o que funciona.
 */
export function comNivel(cena) {
  if (cena.levels?.length) return cena;
  const { background = {}, foreground, foregroundElevation, backgroundColor, fog, ...resto } = cena;
  const { anchorX, anchorY, fit, scaleX, scaleY, rotation, ...fundo } = background;
  const texturas = Object.fromEntries(Object.entries({ anchorX, anchorY, fit, scaleX, scaleY, rotation })
    .filter(([, v]) => v !== undefined));
  const nivel = {
    _id: ident(`nivel-${cena._id}`),
    name: cena.name,
    elevation: { bottom: 0, top: foregroundElevation ?? 20 },
    background: { ...fundo, ...(backgroundColor ? { color: backgroundColor } : {}) },
    foreground: { src: foreground ?? null },
    fog: { src: fog?.overlay ?? null },
    ...(Object.keys(texturas).length ? { textures: texturas } : {}),
  };
  // O v13 não conhece `levels` e lê o fundo pelos campos legados; o v14 lê o nível e
  // descarta o legado (`BaseScene.shimData`). Os dois juntos, e o mesmo bundle serve às
  // duas versões — `minimum: 13` no manifesto.
  const legado = { background, ...(foreground !== undefined ? { foreground } : {}),
    ...(foregroundElevation !== undefined ? { foregroundElevation } : {}), ...(backgroundColor ? { backgroundColor } : {}) };
  // Parede (luz, som…) presa a um nível que não existe na cena não aparece. As fontes
  // vêm do mundo de quem capturou, onde o nível era outro (`defaultLevel0000`): toda
  // referência a nível passa a ser este — o único — e a sem nível continua sem
  // (achado em uso real: 36 das 39 paredes do Porão invisíveis depois de importar).
  const noNivel = (docs) => docs?.map((d) => (Array.isArray(d.levels)
    ? { ...d, levels: d.levels.length ? [nivel._id] : [] } : d));
  const embutidos = Object.fromEntries(["walls", "lights", "sounds", "tiles", "drawings", "regions", "templates", "notes", "tokens"]
    .filter((c) => Array.isArray(resto[c])).map((c) => [c, noNivel(resto[c])]));
  return { ...resto, ...legado, ...embutidos, ...(fog ? { fog } : {}), levels: [nivel] };
}

/** Remonta a cena: a fonte guarda arrays de id e os documentos embutidos em arquivos à parte. */
export function cenaCompleta(pasta, { nivel = false } = {}) {
  // `posicoes.json` não é documento: é o que `capturar-posicoes.mjs` escreve.
  const arquivos = ler(pasta).filter((d) => d._key);
  const cena = arquivos.find((d) => d._key.startsWith("!scenes!"));
  if (!cena) return null;
  const embutidos = {};
  for (const doc of arquivos) {
    const m = /^!scenes\.([a-z]+)!/.exec(doc._key);
    if (m) (embutidos[m[1]] ??= []).push(semChave(doc));
  }
  const completa = { ...semChave(cena), ...embutidos };
  return nivel ? comNivel(completa) : completa;
}

/**
 * @param {{nivel?: boolean}} [opcoes] `nivel: true` para o formato v14 da cena (o bundle
 *   da janela); os packs locais ficam no v13, que o servidor migra.
 * @returns {{pregerados: object[], cena: object|null, handouts: object[], trilha: object[]}}
 */
export function fontesDoAtoI(opcoes = {}) {
  return {
    pregerados: ler("ato-i-personagens").map(semChave),
    cena: cenaCompleta("ato-i-cenas", opcoes),
    handouts: ler("ato-i-handouts").map(semChave),
    trilha: ler("ato-i-musicas").map(semChave),
    posicoes: posicoes("ato-i-cenas"),
  };
}

/** @returns {{agentes: object[], cena: object|null, ferramentas: object[]}} */
export function fontesDoAtoII(opcoes = {}) {
  return {
    agentes: ler("ato-ii-personagens").map(semChave),
    cena: cenaCompleta("ato-ii-cenas", opcoes),
    ferramentas: ler("ferramentas").map(semChave),
    posicoes: posicoes("ato-ii-cenas"),
  };
}
