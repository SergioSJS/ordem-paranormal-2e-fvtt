/**
 * O que a importação de uma aventura acerta, mesmo numa aventura guardada antes da regra.
 *
 * A aventura fica no compêndio do mundo como estava quando o PDF foi lido. Corrigir só a
 * montagem não basta: quem importa a guardada recebia o jeito antigo (achado em uso real, os
 * dois pedidos abaixo vieram duas vezes cada). Então, no `preImportAdventure`:
 *
 *   - a cor das pastas segue o playtest: vermelho nos Atos, verde nas Missões;
 *   - numa Missão guardada antes das cópias, cada pré-gerado vira a cópia da missão (o mesmo
 *     id que a montagem nova dá), os vínculos de investigação e cenas acompanham, e as cenas de
 *     ação chegam vazias. Sem isso, importar a segunda Missão levava os pré-gerados da primeira;
 *   - as criaturas da Missão 1 chegam com o Afogar que agarra e a RD 3 do aughisk.
 *
 * E, ao abrir o mundo, as pastas das Missões que ainda estão vermelhas ficam verdes e as
 * criaturas já importadas recebem a mesma correção.
 */
import { SYSTEM_ID } from "../config.mjs";
import { COR_DAS_PASTAS } from "./comum.mjs";
import { ATOS } from "./mundo.mjs";
import { idDaCopia, RD_DO_AUGHISK, AFOGAR } from "./missoes.mjs";

/** Marca no ator de que a correção das criaturas já passou: depois dela, vale o que o mestre editar. */
const MARCA_DA_CORRECAO = "criaturaCorrigida";

/** O modo de uma aventura pelo nome (o da lista de atos), ou pela pasta dos extras. */
export function modoDaAventura(adventure) {
  const doNome = ATOS.find((a) => a.aventura === adventure?.name)?.modo;
  if (doNome) return doNome;
  const pasta = adventure?.flags?.[SYSTEM_ID]?.extras?.pasta ?? "";
  return pasta.startsWith("missao") ? "vigilia" : null;
}

/** Pinta as pastas que a importação vai criar ou atualizar. Devolve quantas mudou. */
export function pintarPastasDaImportacao(adventure, toCreate, toUpdate) {
  const modo = modoDaAventura(adventure);
  if (!modo) return 0;
  let mudou = 0;
  for (const pasta of [...(toCreate?.Folder ?? []), ...(toUpdate?.Folder ?? [])]) {
    if (pasta.color === COR_DAS_PASTAS[modo]) continue;
    pasta.color = COR_DAS_PASTAS[modo];
    mudou += 1;
  }
  return mudou;
}

/**
 * Missão guardada antes das cópias: os pré-gerados vêm com o id do compêndio, o mesmo nas duas
 * missões. Troca pelo id da cópia desta missão em todo documento da importação, e o que era
 * atualização (o ator da outra missão) vira criação. Devolve quantos trocou.
 * @param {(id: string) => boolean} [existe] se o ator já está no mundo (teste injeta)
 */
export function separarPregeradosDaImportacao(adventure, toCreate, toUpdate, existe = (id) => game.actors.has(id)) {
  const missao = adventure?.flags?.[SYSTEM_ID]?.extras?.pasta ?? "";
  if (!missao.startsWith("missao")) return 0;
  const pastas = [...(toCreate?.Folder ?? []), ...(toUpdate?.Folder ?? [])];
  const pastaDosPregerados = pastas.find((f) => f.type === "Actor" && f.name === "Pré-gerados")?._id;
  if (!pastaDosPregerados) return 0;

  const velhos = [...(toCreate?.Actor ?? []), ...(toUpdate?.Actor ?? [])]
    .filter((a) => a.type === "personagem" && a.folder === pastaDosPregerados && !a.flags?.[SYSTEM_ID]?.copiaDaMissao);
  if (!velhos.length) return 0;
  const mapa = new Map(velhos.map((a) => [a._id, idDaCopia(missao, a._id)]));

  const trocar = (doc) => {
    let texto = JSON.stringify(doc);
    for (const [velho, novo] of mapa) texto = texto.replaceAll(velho, novo);
    return JSON.parse(texto);
  };
  for (const lista of [toCreate, toUpdate]) {
    for (const [tipo, docs] of Object.entries(lista ?? {})) lista[tipo] = docs.map(trocar);
  }
  // A cópia que ainda não existe no mundo é criação, não atualização.
  const mover = (toUpdate?.Actor ?? []).filter((a) => [...mapa.values()].includes(a._id) && !existe(a._id));
  if (mover.length) {
    toUpdate.Actor = toUpdate.Actor.filter((a) => !mover.includes(a));
    toCreate.Actor = [...(toCreate.Actor ?? []), ...mover];
  }
  // Marca a cópia, e as cenas de ação chegam vazias, como na montagem nova.
  for (const a of [...(toCreate?.Actor ?? []), ...(toUpdate?.Actor ?? [])]) {
    if ([...mapa.values()].includes(a._id)) {
      a.flags = { ...(a.flags ?? {}), [SYSTEM_ID]: { ...(a.flags?.[SYSTEM_ID] ?? {}), copiaDaMissao: missao } };
    }
    if (a.type === "cena-acao" && a.system) a.system.participantes = [];
  }
  return mapa.size;
}

/**
 * As criaturas da Missão 1 guardadas antes de duas decisões: o Afogar agarra em vez de ferir
 * (p. 33) e a RD do aughisk é 3 (LACUNAS). Devolve as mudanças (`system.ataques`, `system.rd`)
 * ou `null`. Só mexe no afogado e no aughisk (pelo nome, numerado ou não), só no que ainda está
 * como a montagem antiga deixou (o Afogar sem efeito, a RD 5 exata) e só uma vez por ator: quem
 * já tem a marca fica como o mestre deixou, mesmo que ele volte o Afogar para dano.
 * @param {{type?: string, name?: string, system?: {ataques?: object[], rd?: number}, flags?: object}} ator
 */
export function correcaoDaCriatura(ator) {
  if (ator?.type !== "npc" || !ator.system || ator.flags?.[SYSTEM_ID]?.[MARCA_DA_CORRECAO]) return null;
  const mudancas = {};
  const ataques = ator.system.ataques ?? [];
  if (/^Afogado( \d+)?$/.test(ator.name ?? "") && ataques.some((a) => a.nome === "Afogar" && !a.efeito)) {
    mudancas["system.ataques"] = ataques.map((a) => (a.nome === "Afogar" && !a.efeito ? { ...a, ...AFOGAR } : a));
  }
  if (/^Aughisk( \d+)?$/.test(ator.name ?? "") && ator.system.rd === 5) mudancas["system.rd"] = RD_DO_AUGHISK;
  return Object.keys(mudancas).length ? mudancas : null;
}

/** Na importação: aplica a correção no próprio documento que vai entrar. Devolve quantos mudou. */
export function corrigirCriaturasDaImportacao(toCreate, toUpdate) {
  let n = 0;
  for (const ator of [...(toCreate?.Actor ?? []), ...(toUpdate?.Actor ?? [])]) {
    const mudancas = correcaoDaCriatura(ator);
    if (!mudancas) continue;
    if (mudancas["system.ataques"]) ator.system.ataques = mudancas["system.ataques"];
    if (mudancas["system.rd"] !== undefined) ator.system.rd = mudancas["system.rd"];
    ator.flags = { ...(ator.flags ?? {}), [SYSTEM_ID]: { ...(ator.flags?.[SYSTEM_ID] ?? {}), [MARCA_DA_CORRECAO]: true } };
    n += 1;
  }
  return n;
}

/** Ao abrir o mundo: as criaturas já importadas (modelos e cópias em cena) recebem a correção. */
export async function corrigirCriaturasDoMundo() {
  if (!game.user?.isGM) return 0;
  const atualizacoes = game.actors.filter((a) => a.type === "npc")
    .map((a) => ({ a, mudancas: correcaoDaCriatura({ type: a.type, name: a.name, system: a._source.system, flags: a._source.flags }) }))
    .filter(({ mudancas }) => mudancas)
    .map(({ a, mudancas }) => ({ _id: a.id, ...mudancas, [`flags.${SYSTEM_ID}.${MARCA_DA_CORRECAO}`]: true }));
  if (atualizacoes.length) await CONFIG.Actor.documentClass.updateDocuments(atualizacoes);
  return atualizacoes.length;
}

/** As pastas de uma Missão já no mundo: a raiz tem o nome da aventura, e tudo abaixo dela. */
function pastasDasMissoes() {
  const raizes = new Set(ATOS.filter((a) => a.modo === "vigilia").map((a) => a.aventura));
  return game.folders.filter((pasta) => {
    let raiz = pasta;
    while (raiz.folder) raiz = raiz.folder;
    return raizes.has(raiz.name);
  });
}

/** Ao abrir o mundo: as pastas das Missões que ainda não estão verdes ficam verdes. */
export async function pintarPastasDasMissoes() {
  if (!game.user?.isGM) return 0;
  const cor = COR_DAS_PASTAS.vigilia;
  const fora = pastasDasMissoes().filter((p) => p.color?.toString().toLowerCase() !== cor);
  if (!fora.length) return 0;
  await CONFIG.Folder.documentClass.updateDocuments(fora.map((p) => ({ _id: p.id, color: cor })));
  return fora.length;
}

export function registrarAjustesDeImportacao() {
  // Antes do hook dos extras: no passe que importa de verdade, os dois mexem no que entra.
  Hooks.on("preImportAdventure", (adventure, _options, toCreate, toUpdate) => {
    const separados = separarPregeradosDaImportacao(adventure, toCreate, toUpdate);
    if (separados) console.log(`${SYSTEM_ID} | importação: ${separados} pré-gerado(s) viraram a cópia desta missão`);
    pintarPastasDaImportacao(adventure, toCreate, toUpdate);
    if (modoDaAventura(adventure) === "vigilia") corrigirCriaturasDaImportacao(toCreate, toUpdate);
    return true;
  });
  Hooks.once("ready", () => {
    pintarPastasDasMissoes().catch((erro) => console.error(`${SYSTEM_ID} | cores das pastas`, erro));
    corrigirCriaturasDoMundo()
      .then((n) => { if (n) console.log(`${SYSTEM_ID} | ${n} criatura(s) da Missão 1 corrigida(s): Afogar agarra, RD do aughisk 3`); })
      .catch((erro) => console.error(`${SYSTEM_ID} | criaturas da missão`, erro));
  });
}
