/**
 * As aventuras do playtest dentro do jogo: o mestre escolhe o PDF dele, o sistema
 * extrai o texto (`module/extrator/`), monta o `Adventure` (`module/aventura/ato-*`)
 * e guarda num compêndio DO MUNDO — de onde ele importa como qualquer aventura do
 * Foundry, com a ficha do core, os avisos de sobrescrita e o pedido do zip de artes
 * do Ato II funcionando sem gambiarra.
 *
 * Nada do livro vem no pacote: a Licença da Comunidade não permite reproduzir o
 * texto, e o PDF é de quem já o tem. O arquivo é lido no navegador e não vai para
 * lugar nenhum.
 */
import { SYSTEM_ID } from "../config.mjs";
import { extrairAtoI } from "../extrator/ato-i.mjs";
import { extrairAtoII } from "../extrator/ato-ii.mjs";
import { montarAtoI } from "./ato-i.mjs";
import { montarAtoII } from "./ato-ii.mjs";
import { paginasDaMissao, extrairPontosDaMissao, roteiroDaMissao } from "../extrator/missoes.mjs";
import { montarMissao1, montarMissao2, resumoDaMissao } from "./missoes.mjs";

const PACK_DO_MUNDO = "op2-aventuras";

/** Os atos que o sistema sabe montar. */
export const ATOS = [
  { nome: "ato-i", modo: "moderno", rotulo: "OP2.Aventuras.AtoI", aventura: "Ato I — O Porão" },
  { nome: "ato-ii", modo: "moderno", rotulo: "OP2.Aventuras.AtoII", aventura: "Ato II — O Porão" },
  { nome: "missao-1", modo: "vigilia", rotulo: "OP2.Aventuras.Missao1", aventura: "Missão 1 — O Pântano dos Afogados" },
  { nome: "missao-2", modo: "vigilia", rotulo: "OP2.Aventuras.Missao2", aventura: "Missão 2 — A Caverna de Cruachan" },
];

/** O que cada ato precisa dos compêndios do sistema (`scripts/aventura/gerar-fontes.mjs`). */
export async function fontesDoSistema(ato) {
  const resposta = await fetch(`systems/${SYSTEM_ID}/assets/aventura/fontes-${ato}.json`);
  if (!resposta.ok) throw new Error(`fontes-${ato}.json: ${resposta.status}`);
  return resposta.json();
}

/**
 * Do texto do PDF às aventuras montadas. O Ato I existe em todo PDF do playtest; o
 * Ato II só no completo — sem ele, o resultado diz isso em vez de falhar.
 *
 * @param {string[]} linhas as linhas do PDF (`linhasDoPdf`)
 * @returns {Promise<Array<{nome: string, ok: boolean, motivo?: string, aventura?: object, resumo?: object, problemas?: string[]}>>}
 */
export async function montarAventuras(linhas) {
  const resultados = [];

  let atoI = null;
  try {
    atoI = extrairAtoI(linhas);
    if (!atoI.pontos.length) throw new Error("nenhum ponto de interesse no PDF");
    const aventura = montarAtoI(atoI, await fontesDoSistema("ato-i"));
    resultados.push({ ...ATOS[0], ok: true, aventura, resumo: resumoDoAtoI(atoI) });
  } catch (erro) {
    console.error(`${SYSTEM_ID} | aventuras: Ato I`, erro);
    // O PDF do beta no grupo errado: dizer isso, e não só que falta o Ato I.
    const ehBeta = linhas.some((l) => /primeira missão do|segunda missão do/i.test(l));
    resultados.push({ ...ATOS[0], ok: false, motivo: ehBeta ? "ehBeta" : "trecho", erro: ehBeta ? "" : erro.message });
  }

  try {
    const { dados, problemas } = extrairAtoII(linhas);
    const avisos = [];
    const aventura = montarAtoII(dados, {
      atoIPontos: atoI?.pontos ?? [], atoIMaldicao: atoI?.maldicao ?? null,
      ...(await fontesDoSistema("ato-ii")),
    }, { avisos });
    resultados.push({ ...ATOS[1], ok: true, aventura, resumo: resumoDoAtoII(dados), problemas: [...problemas, ...avisos] });
  } catch (erro) {
    // O PDF gratuito para no Ato I: não é erro, é o que ele traz.
    const semAtoII = /não traz o Ato II|não achei/i.test(erro.message);
    if (!semAtoII) console.error(`${SYSTEM_ID} | aventuras: Ato II`, erro);
    resultados.push({ ...ATOS[1], ok: false, motivo: semAtoII ? "ausente" : "falha", erro: semAtoII ? "" : erro.message });
  }
  return resultados;
}

/**
 * As missões do modo Vigília, das páginas do PDF. A Missão 1 está em todo PDF do beta; a
 * Missão 2, só no de assinantes: sem ela, o resultado diz isso em vez de falhar.
 * @param {Array<{numero: number, pedacos: object[]}>} paginas
 */
export async function montarMissoes(paginas) {
  const fontes = await fontesDoSistema("vigilia");
  const montadores = { "missao-1": montarMissao1, "missao-2": montarMissao2 };
  const resultados = [];
  for (const ato of ATOS.filter((a) => a.modo === "vigilia")) {
    try {
      const daMissao = paginasDaMissao(paginas, ato.nome);
      if (!daMissao.length) {
        resultados.push({ ...ato, ok: false, motivo: "ausenteMissao", erro: "" });
        continue;
      }
      const { pontos, avisos } = extrairPontosDaMissao(daMissao, ato.nome);
      const extraido = { pontos, avisos, roteiro: roteiroDaMissao(daMissao, pontos) };
      if (!pontos.length) throw new Error("nenhum ponto de interesse no PDF");
      const { aventura, avisos: daMontagem } = montadores[ato.nome](extraido, fontes);
      resultados.push({ ...ato, ok: true, aventura, resumo: resumoDaMissao(extraido, aventura), problemas: daMontagem });
    } catch (erro) {
      console.error(`${SYSTEM_ID} | aventuras: ${ato.nome}`, erro);
      resultados.push({ ...ato, ok: false, motivo: "falha", erro: erro.message });
    }
  }
  // Nenhuma das duas: não é o PDF do beta (ou a editora mudou a abertura das missões).
  if (resultados.every((r) => r.motivo === "ausenteMissao")) {
    for (const r of resultados) r.motivo = "naoEhBeta";
  }
  return resultados;
}

function resumoDoAtoI({ pontos, maldicao, itens }) {
  return {
    pontos: pontos.length,
    linhas: pontos.reduce((n, p) => n + p.informacoes.length, 0),
    // Só o que vira Item de desafio: caixa só de Alcançar fica na nota do ponto.
    desafios: pontos.filter((p) => ["arrombar", "destrancar", "hackTecnico", "hackSocial", "sustentar"].some((a) => p.desafio?.[a])).length,
    rodadas: maldicao?.eventos?.length ?? 0,
    itens: itens?.itens?.length ?? 0,
  };
}

function resumoDoAtoII({ pontos }) {
  return {
    pontos: pontos.length,
    linhas: pontos.reduce((n, p) => n + p.informacoes.length, 0),
    desafios: pontos.filter((p) => p.desafio?.arrombar || p.desafio?.hackTecnico).length,
    leituras: pontos.reduce((n, p) => n + p.ferramentas.length, 0),
  };
}

/** O compêndio de mundo onde as aventuras montadas ficam guardadas. */
export async function packDeAventuras() {
  const existente = game.packs.get(`world.${PACK_DO_MUNDO}`);
  if (existente) return existente;
  const { CompendiumCollection } = foundry.documents.collections;
  return CompendiumCollection.createCompendium({
    type: "Adventure",
    label: game.i18n.localize("OP2.Aventuras.PackRotulo"),
    name: PACK_DO_MUNDO,
    package: "world",
  });
}

/**
 * Guarda a aventura no compêndio do mundo (substituindo a anterior) e devolve o
 * documento, pronto para importar.
 */
export async function guardarAventura(dados) {
  const pack = await packDeAventuras();
  const anterior = pack.index.get(dados._id) ? await pack.getDocument(dados._id) : null;
  if (anterior) await anterior.delete();
  const documento = await Adventure.create(dados, { pack: pack.collection, keepId: true });
  // Sem reler o índice, a tela redesenha antes de o compêndio saber que a aventura
  // existe — e o botão de importar não aparecia (achado no teste do fluxo inteiro).
  await pack.getIndex();
  return documento;
}

/**
 * Monta e já guarda no mundo; a importação em si é decisão do mestre.
 * @param {string[]|object[]} entrada as linhas (moderno) ou as páginas (Vigília) do PDF
 * @param {string} [modo]
 */
export async function montarEGuardar(entrada, modo = "moderno") {
  const resultados = modo === "vigilia" ? await montarMissoes(entrada) : await montarAventuras(entrada);
  for (const resultado of resultados) {
    if (!resultado.ok) continue;
    resultado.documento = await guardarAventura(resultado.aventura);
  }
  return resultados;
}

/** A aventura deste ato guardada no mundo, se houver. */
export function aventuraNoMundo(nomeDaAventura) {
  const pack = game.packs.get(`world.${PACK_DO_MUNDO}`);
  return [...(pack?.index ?? [])].find((entrada) => entrada.name === nomeDaAventura) ?? null;
}

/** O documento guardado, para importar ou abrir. */
export async function documentoDaAventura(nomeDaAventura) {
  const entrada = aventuraNoMundo(nomeDaAventura);
  if (!entrada) return null;
  return game.packs.get(`world.${PACK_DO_MUNDO}`).getDocument(entrada._id);
}
