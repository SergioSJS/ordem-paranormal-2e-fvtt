/**
 * Extrai o Ato II do texto do PDF do playtest — no navegador do mestre.
 *
 * Porte, função por função, de `scripts/ato-ii/extrair-aventura.py`. Reaproveita o
 * leitor de quadro do Ato I: o quadro Perícia · DT · Informação é o mesmo. O que o
 * Ato II acrescenta é o setor FERRAMENTAS de cada ponto — rótulo da ferramenta na
 * coluna da esquerda, centralizado sobre a leitura na coluna da direita, como a DT do
 * quadro — mais o roteiro do ato, as mecânicas das ferramentas para o mestre e a
 * matriz "Locais de uso de cada ferramenta", que serve de conferência: cada ponto
 * reage exatamente às ferramentas que o texto descreve.
 *
 * O texto é da editora: nada do que sai daqui vai para o pacote.
 */
import { ehMaiusculo, limpo, recuo, semAcento, juntarHifenizacao } from "./texto.mjs";
import {
  CABECALHO, EQUACAO_NO_TOPO, linearizarDuasColunas, colunas, lerTabela, lerDesafio, prosaDaCaixa, chaveDePericia,
} from "./ato-i.mjs";

/* ------------------------------------------------------------------ utilidades -- */

/** Linhas do PDF → parágrafos: linha em branco separa, hifenização volta a juntar. */
function paragrafos(linhas) {
  const blocos = [];
  let atual = [];
  for (const l of linhas) {
    if (l.trim()) atual.push(l.trim());
    else if (atual.length) { blocos.push(atual); atual = []; }
  }
  if (atual.length) blocos.push(atual);
  return juntarQuebras(blocos.map((b) => juntarHifenizacao(b.join("\n")).replace(/\n/g, " ")));
}

/**
 * Parágrafo que não termina em pontuação seguido de um que começa em minúscula é a
 * mesma frase, cortada pela quebra de coluna ou de página.
 */
function juntarQuebras(pars) {
  const saida = [];
  for (const par of pars) {
    const anterior = saida[saida.length - 1];
    if (anterior !== undefined && !/[.!?…”:;)]$/.test(anterior) && /^\p{Ll}/u.test(par)) {
      saida[saida.length - 1] = `${anterior} ${par}`;
    } else saida.push(par);
  }
  return saida;
}

function indice(linhas, padrao, aPartir = 0) {
  const rx = padrao instanceof RegExp ? padrao : new RegExp(padrao);
  for (let i = aPartir; i < linhas.length; i += 1) if (rx.test(linhas[i])) return i;
  throw new Error(`não achei ${padrao} no texto do Ato II`);
}

function entre(linhas, inicio, fim, aPartir = 0) {
  const a = indice(linhas, inicio, aPartir);
  const b = indice(linhas, fim, a + 1);
  return [linhas.slice(a + 1, b), a, b];
}

const PAGINA = /^\s{30,}\d{1,3}\s*$/;
// Título de handout em caixa alta: palavras inteiras em maiúscula, até a primeira que
// não é ("…DE MADEIRA Caso não consiga" para em MADEIRA).
const TITULO_CAPS = "(?:\\s*[A-ZÁ-Ú0-9][A-ZÁ-Ú0-9'’\\-]*(?![a-zá-ú]))+";
const HANDOUT_NO_TEXTO = new RegExp(`\\[((?:HANDOUT|Handout)[^\\]]+)\\]|\\b(HANDOUTS?\\s+\\d+[A-C]?\\s*-${TITULO_CAPS})`, "g");
// A citação: "Handout 16A - Varredura Porão" (v1), "handout: HANDOUT 03 - FOTO DO
// ALTAR" (v1.1), "handouts 12A, 12B e 12C" e "handouts: HANDOUT 12A, HANDOUT 12B e
// HANDOUT 12C" (os do Ato I). Sem a bandeira i de propósito: é a caixa alta que
// delimita o título.
const HANDOUT_CITADO = new RegExp(
  "(?:[Hh]andouts?|HANDOUTS?):?\\s+(?:HANDOUT\\s+)?(\\d+[A-C]?(?:,\\s*(?:HANDOUT\\s+)?\\d+[A-C]?)*(?:\\s+[eE]\\s+(?:HANDOUT\\s+)?\\d+[A-C]?)?)"
  + `(\\s*-\\s*(?:${TITULO_CAPS}|[^.\\]]+))?`, "g");
const semPaginas = (linhas) => linhas.filter((l) => !PAGINA.test(l));

/* ---------------------------------------------------------- o trecho do ato -- */

function trechoDoAtoII(linhasDoPdf) {
  const ini = linhasDoPdf.findIndex((l) => l.startsWith("O Ato II continua e conclui"));
  if (ini < 0) throw new Error("este PDF não traz o Ato II");
  // O título "ATO / II" vem em duas linhas logo antes.
  return linhasDoPdf.slice(Math.max(0, ini - 4));
}

/* ----------------------------------------------------------------- roteiro -- */

function textoDe(linhas, colunaMinima = 44) {
  return paragrafos(linearizarDuasColunas(semPaginas(linhas), colunaMinima));
}

function lerPreparacao(linhas) {
  const [primeiro, a] = entre(linhas, /^\s*PREPARAÇÃO\b/, /^MECÂNICAS DE\s*$/);
  // A caixa lateral ("Se você é jogador, PARE DE LER AGORA") começa na linha do título.
  let bloco = [linhas[a].replace("PREPARAÇÃO", " ".repeat(10)), ...primeiro];
  // Os nomes dos pré-gerados ficam soltos embaixo das fichas ilustradas.
  bloco = bloco.filter((l) => !/^\s*(Amanda|Heitor|Val|Raven|Antônio)\s*$/.test(l));
  return textoDe(bloco, 60);
}

const TITULOS_DE_FERRAMENTA = {
  "COMPÊNDIO DA ORDEM": "compendio", "LABORATÓRIO PORTÁTIL": "laboratorio",
  "CÂMERA MODIFICADA": "camera", "LANTERNA DE ESTOURO ULTRAVIOLETA": "lanternaUV",
  "LASER DE VARREDURA": "laser", "MEDIDOR EMF": "emf", "LEITOR INFRAVERMELHO": "infravermelho",
  "PÓ REVELADOR": "poRevelador", "RÁDIO MODIFICADO": "radio", "TERMÔMETRO DIFERENCIAL": "termometro",
};

/** Instruções de mestre por ferramenta (p. 74 e 76), na ordem do livro. */
function lerMecanicas(linhas) {
  const a = indice(linhas, /^MECÂNICAS DE\s*$/);
  // A matriz da p. 75 começa onde aparecer primeiro: o cabeçalho girado ("Lanterna
  // de", bem à direita — é assim que o pdftotext o imprime) ou o título "LOCAIS DE
  // USO" (na grade do pdf.js os cabeçalhos girados vêm depois do título).
  const candidatos = [/^\s{40,}Lanterna de\s*$/, /^\s*LOCAIS DE USO\s*$/]
    .map((rx) => linhas.findIndex((l, i) => i > a && rx.test(l))).filter((i) => i >= 0);
  if (!candidatos.length) throw new Error("não achei a matriz de ferramentas no texto do Ato II");
  const b = Math.min(...candidatos);
  const c = indice(linhas, /^LASER DE VARREDURA\b/, b);
  const d = indice(linhas, /^VITÓRIA E DERROTA\s*$/, c);
  // O título "MECÂNICAS DE / FERRAMENTAS" vem em duas linhas, em fonte grande: o
  // número de linhas em branco que a grade põe entre elas varia. A introdução vai
  // da segunda linha do título até a primeira seção de ferramenta; o Python
  // contava linhas (a+2 até a+12) e isso só valia para o pdftotext.
  const tituloDois = linhas.findIndex((l, i) => i > a && l.trim() === "FERRAMENTAS");
  // A primeira seção pode dividir a linha com a segunda ("COMPÊNDIO DA ORDEM" à
  // esquerda, "LABORATÓRIO PORTÁTIL" à direita): procurar o título DENTRO da linha.
  const titulos = [...Object.keys(TITULOS_DE_FERRAMENTA), "LANTERNA DE"];
  const inicioDoCorpo = linhas.findIndex((l, i) => i > tituloDois && i < b && titulos.some((tt) => l.includes(tt)));
  const intro = paragrafos(linearizarDuasColunas(semPaginas(linhas.slice(tituloDois + 1, inicioDoCorpo)), 44));
  // Cada página tem duas colunas; linearizar antes de cortar por título.
  const corpo = [
    ...linearizarDuasColunas(semPaginas(linhas.slice(inicioDoCorpo, b)), 44),
    ...linearizarDuasColunas(semPaginas(linhas.slice(c, d)), 44),
  ];
  const secoes = [];
  let atual = null;
  let i = 0;
  while (i < corpo.length) {
    const l = corpo[i].trim();
    let tituloDaSecao = l;
    // "LANTERNA DE" / "ESTOURO ULTRAVIOLETA": título em duas linhas.
    if (l === "LANTERNA DE" && i + 1 < corpo.length) { tituloDaSecao = `${l} ${corpo[i + 1].trim()}`; i += 1; }
    if (tituloDaSecao in TITULOS_DE_FERRAMENTA) {
      atual = { chave: TITULOS_DE_FERRAMENTA[tituloDaSecao], titulo: tituloCapitalizado(tituloDaSecao), linhas: [] };
      secoes.push(atual);
    } else if (atual !== null) {
      atual.linhas.push(corpo[i]);
    }
    i += 1;
  }
  for (const s of secoes) {
    let pars = paragrafos(s.linhas);
    delete s.linhas;
    if (s.chave === "laser") pars = pars.filter((par) => !/^(Lista de pontos|PORÃO|SALA SECRETA|\d+ - )/.test(par));
    if (s.chave === "radio") pars = pars.filter((par) => !/^(Resultado\s+Efeito|\d+(\s*-\s*\d+)? |\d+ ou (menos|mais))/.test(par));
    s.paragrafos = pars;
  }
  // A tabela do Rádio vem repetida como título dentro da própria seção: já é a mesma
  // seção, não abre outra.
  const unidas = [];
  for (const s of secoes) {
    const ultima = unidas[unidas.length - 1];
    if (ultima && ultima.chave === s.chave) ultima.paragrafos.push(...s.paragrafos);
    else unidas.push(s);
  }
  return [intro, unidas];
}

/** Como `str.title()` do Python, que é o que o script usava nos títulos das seções. */
function tituloCapitalizado(texto) {
  return texto.toLowerCase().replace(/(^|[^\p{L}\p{N}'])(\p{L})/gu, (_m, antes, letra) => antes + letra.toUpperCase());
}

const FERRAMENTAS_DA_MATRIZ = [
  ["Câmera", "camera"], ["Laboratório", "laboratorio"], ["Estouro Ultravioleta", "lanternaUV"],
  ["Laser de Varredura", "laser"], ["Infravermelho", "infravermelho"], ["Medidor EMF", "emf"],
  ["Pó Revelador", "poRevelador"], ["Rádio Modificado", "radio"], ["Ter", "termometro"],
];

/**
 * "Locais de uso de cada ferramenta" (p. 75): ✘ é leitura normal; célula vazia reage.
 * Devolve [{número do ponto: [chaves das ferramentas que reagem]}, pontos em que
 * "todas as ferramentas resultam em leitura normal"].
 */
function lerMatriz(linhas) {
  const a = indice(linhas, /^\s*LOCAIS DE USO\s*$/) - 6;
  const b = indice(linhas, /^LASER DE VARREDURA\b/, a);
  const bloco = linhas.slice(a, b);
  const centros = {};
  // Os cabeçalhos são girados. O pdftotext os imprime deitados, vários por linha, e o
  // centro é o meio do rótulo; a grade do pdf.js põe cada um sozinho na sua linha,
  // na coluna da âncora — e é essa coluna, sem deslocar, que bate com os ✘.
  for (const l of bloco) {
    if (/^\s*\d{1,2}\.\s/.test(l)) break;     // começaram as linhas dos pontos
    for (const [rotulo, chave] of FERRAMENTAS_DA_MATRIZ) {
      const pos = l.indexOf(rotulo);
      if (pos < 0 || chave in centros) continue;
      const sozinho = l.trim().length <= rotulo.length + 2;
      centros[chave] = sozinho ? pos : pos + rotulo.length / 2;
    }
  }
  if (Object.keys(centros).length !== 9) throw new Error(`matriz das ferramentas: achei ${Object.keys(centros).length} de 9 cabeçalhos`);
  const matriz = {};
  for (const l of bloco) {
    const m = /^(\d{1,2})\.\s+(.+?)\s{2,}/.exec(l);
    if (!m || !l.includes("✘")) continue;
    const marcadas = new Set();
    [...l].forEach((ch, i) => {
      if (ch !== "✘") return;
      let melhor = null;
      for (const c of Object.keys(centros)) if (melhor === null || Math.abs(centros[c] - i) < Math.abs(centros[melhor] - i)) melhor = c;
      marcadas.add(melhor);
    });
    matriz[Number(m[1])] = FERRAMENTAS_DA_MATRIZ.map(([, c]) => c).filter((c) => !marcadas.has(c));
  }
  const normais = bloco.map((l) => /^\s{40,}(\d{1,2}) - /.exec(l)).filter(Boolean).map((m) => Number(m[1]));
  return [matriz, normais];
}

/** Os pontos que a varredura do laser identifica, por ambiente (p. 76). */
function lerLaser(linhas) {
  const a = indice(linhas, /^LASER DE VARREDURA\b/);
  const b = indice(linhas, /^LEITOR INFRAVERMELHO\b/, a);
  // A lista fica na coluna da esquerda; a da direita (o Medidor EMF) começa onde
  // houver três espaços ou mais. O Python cortava na coluna 58, medida no pdftotext.
  const esquerda = linhas.slice(a, b).map((l) => l.trim().split(/\s{3,}/)[0]);
  const saida = { porao: [], salaSecreta: [] };
  let ambiente = null;
  for (const l of esquerda) {
    const t = l.trim();
    if (t === "PORÃO") ambiente = "porao";
    else if (t === "SALA SECRETA") ambiente = "salaSecreta";
    else if (ambiente) {
      const m = /^(\d{1,2}) - /.exec(t);
      if (m) saida[ambiente].push(Number(m[1]));
    }
  }
  return saida;
}

function lerVitoria(linhas) {
  const [bloco] = entre(linhas, /^VITÓRIA E DERROTA\s*$/, /^\s*SOBRECARGA MENTAL\s*$/);
  return paragrafos(semPaginas(bloco));
}

function lerIntroducao(linhas) {
  const a = indice(linhas, /^VITÓRIA E DERROTA\s*$/);
  const [bloco] = entre(linhas, /^INTRODUÇÃO\s*$/, /^O ÍDOLO DE PEDRA, ATO II\s*$/, a);
  return paragrafos(semPaginas(bloco));
}

function lerCenaInicial(linhas) {
  const a = indice(linhas, /^O ÍDOLO DE PEDRA, ATO II\s*$/);
  const b = indice(linhas, /^\s*Porão\s{4,}/, a);
  // A narração vem em coluna diagonal (recuo crescente): só o texto interessa.
  const bruto = linhas.slice(a + 1, b).filter((l) => l.trim() && !/^[\s\d()noteto]+$/.test(l));
  return paragrafos(bruto);
}

function lerLegenda(linhas) {
  const a = indice(linhas, /^\s*Porão\s{4,}/);
  const b = indice(linhas, /^PONTOS DE INTERESSE\s*$/, a);
  const legenda = {};
  const bloco = linhas.slice(a, b);
  bloco.forEach((l, k) => {
    for (const m of l.matchAll(/(\d{1,2})\.\s+([^\d]+?)(?=\s{2,}|\s*$)/g)) legenda[Number(m[1])] = limpo(m[2]);
    // O número numa linha e o nome na de baixo: o algarismo é de outra fonte, e a
    // grade do pdf.js às vezes não o põe na mesma linha que o nome (o pdftotext põe).
    // O nome é o pedaço da linha seguinte que começa perto da coluna do número.
    for (const m of l.matchAll(/(\d{1,2})\.(?=\s{2,}|\s*$)/g)) {
      const n = Number(m[1]);
      if (legenda[n]) continue;
      const proxima = bloco[k + 1] ?? "";
      const pedaco = /^\s*([^\d]+?)(?=\s{2,}|\s*$)/.exec(proxima.slice(Math.max(0, m.index - 2)));
      if (pedaco) legenda[n] = limpo(pedaco[1]);
    }
  });
  return legenda;
}

function lerSecao(linhas, inicio, fim, aPartir = 0) {
  const [bloco] = entre(linhas, inicio, fim, aPartir);
  return paragrafos(semPaginas(bloco));
}

function lerNarracaoFinal(linhas) {
  const a = indice(linhas, /^NARRAÇÃO FINAL\s*$/);
  const b = indice(linhas, /^A RESPOSTA CORRETA\s*$/, a);
  const bruto = semPaginas(linhas.slice(a + 1, b));
  // A caixa "FUGINDO" fica na coluna da direita, a partir da coluna 62 — e só a
  // partir da linha do título dela; antes disso a página é de uma coluna só.
  const corte = 62;
  let k = bruto.findIndex((l) => l.trim() === "FUGINDO" || l.slice(corte).trim() === "FUGINDO");
  if (k < 0) k = bruto.length;
  const esquerda = [...bruto.slice(0, k), ...bruto.slice(k).map((l) => l.slice(0, corte).trimEnd())];
  const direita = bruto.slice(k + 1).filter((l) => l.length > corte && l.slice(corte).trim()).map((l) => l.slice(corte).trim());
  return [paragrafos(esquerda), paragrafos(direita)];
}

function lerResposta(linhas) {
  const a = indice(linhas, /^A RESPOSTA CORRETA\s*$/);
  const b = indice(linhas, /^PRÓXIMOS PASSOS\s*$/, a);
  return paragrafos(linearizarDuasColunas(semPaginas(linhas.slice(a + 1, b)), 44));
}

/* ------------------------------------------------------------------ pontos -- */

const TITULO_DE_PONTO = /^(\s*)([A-ZÁÂÃÉÊÍÓÔÕÚÇ“”][A-ZÁÂÃÉÊÍÓÔÕÚÇ0-9 ,“”\-–()]{2,60}?)\s*$/;
const NUMERO_NA_MARGEM = /\s{2,}(\d{2})\s*$/;
const SECOES = { "PORÃO": "porao", "A SALA SECRETA": "salaSecreta", "A MALDIÇÃO DO ÍDOLO DE PEDRA": "caixaMaldicao" };
const FIM_DOS_PONTOS = /^NARRAÇÃO FINAL\s*$/;
// Também a linha de equação da tabela do hack ("7 - 9   192 ÷ 8 = 24"): na grade do
// pdf.js a caixa do painel elétrico se parte em dois blocos, e o segundo só tem a
// tabela — sem isso ele ficava no ponto como se fosse nota de mestre.
const ABRE_CAIXA = /^\s{0,4}DESAFIO\s*$|\(DT\s*\d|\bPA\s*\d|\bROLAGEM\b|\bEQUAÇÃO\b|HACK\s+TÉCNICO|=\s*\d+\s*$/;

function ehTituloDePonto(linhas, i) {
  const m = TITULO_DE_PONTO.exec(linhas[i]);
  if (!m || m[2].trim() in SECOES || linhas[i].includes("CONTINUAÇÃO")) return false;
  for (const proxima of linhas.slice(i + 1, i + 5)) {
    if (NUMERO_NA_MARGEM.test(proxima) && !ehMaiusculo(proxima.trim())) return true;
  }
  return false;
}

/** [[inicio, fim]] de cada bloco de linhas não vazias, com índices relativos. */
function blocosPorLinhaVazia(linhas, base = 0) {
  const saida = [];
  let ini = null;
  [...linhas, ""].forEach((l, k) => {
    if (l.trim() && ini === null) ini = k;
    else if (!l.trim() && ini !== null) { saida.push([base + ini, base + k]); ini = null; }
  });
  return saida;
}

const COLA_DA_CAIXA = new Set(["DESAFIO", "DE ACESSO", "DE ACESSO:", "ROLAGEM", "EQUAÇÃO"]);

/**
 * O nome do obstáculo na coluna da esquerda da caixa, juntando as sílabas que o
 * livro quebra com hífen ("COMPUTA- / DOR DESOR- / GANIZADO").
 */
function rotuloDaCaixa(caixa) {
  let nome = "";
  for (const l of caixa) {
    if (recuo(l) > 4 || !l.trim()) continue;
    // O hífen fica: é ele que diz que "COMPUTA-" continua em "DOR".
    let pedaco = l.trim().split(/\s{2,}/)[0].replace(/•/g, "").trim();
    pedaco = pedaco.replace(/\s*\(HACK.*$/, "").trim();
    if (!pedaco || COLA_DA_CAIXA.has(pedaco) || !ehMaiusculo(pedaco) || pedaco.includes("(") || pedaco.includes(")")) continue;
    nome = nome.endsWith("-") ? nome.slice(0, -1) + pedaco : `${nome} ${pedaco}`.trim();
  }
  return tituloCapitalizado(nome.replace(/-+$/, ""));
}

/**
 * Tira do meio do ponto o quadro lateral de desafio, que é impresso dentro da tabela
 * (o símbolo no teto, a grade do duto) ou logo antes dela (o painel, o computador).
 * Devolve [linhas sem a caixa, linhas da caixa].
 */
function separarCaixa(linhas) {
  let caixa = [];
  const resto = [...linhas];
  const blocos = blocosPorLinhaVazia(linhas);
  for (const [a, b] of [...blocos].reverse()) {
    const bloco = linhas.slice(a, b);
    if (!bloco.some((l) => ABRE_CAIXA.test(l))) continue;
    // No primeiro bloco do ponto a descrição pode vir colada acima da caixa e fica;
    // nos outros, tudo antes do marcador é da caixa. O cabeçalho do quadro fica sempre.
    const ehPrimeiro = a === blocos[0][0] && b === blocos[0][1];
    const inicio = ehPrimeiro ? bloco.findIndex((l) => ABRE_CAIXA.test(l)) : 0;
    const antes = bloco.slice(0, inicio), dentro = bloco.slice(inicio);
    const fica = [...antes, ...dentro.filter((l) => CABECALHO.test(l))];
    caixa = [...dentro.filter((l) => !CABECALHO.test(l)), ...caixa];
    resto.splice(a, b - a, ...fica);
  }
  return [resto, caixa];
}

const ROTULOS_DE_FERRAMENTA = {
  "laboratório": "laboratorio", "lanterna": "lanternaUV", "leitor": "infravermelho",
  "câmera": "camera", "medidor emf": "emf", "pó revelador": "poRevelador", "rádio": "radio",
  "termômetro": "termometro",
};
const PEDACO_DE_ROTULO = /^(Laboratório|Portátil|Sequência|[Mm]ínima:|exigida:|Lanterna|de Estouro|Ultravioleta|Leitor|Infravermelho|Câmera|Modificad[ao]|Medidor EMF|Pó Revelador|Rádio|Termômetro|Diferencial|\(apenas se|o Ídolo for|quebrado\))/;

/**
 * O setor FERRAMENTAS de um ponto → [[{chave, texto, …}], leitura normal, sobra].
 *
 * Os rótulos moram na coluna mais à esquerda do setor e a leitura numa coluna à
 * direita; o texto de mestre que vem depois volta para a margem do ponto — e, quando
 * não volta (o computador), é largo demais para a coluna da leitura.
 */
function lerFerramentas(linhas) {
  if (linhas.slice(0, 6).join(" ").includes("Todas as ferramentas")) {
    const ini = linhas.findIndex((l) => l.includes("Todas as ferramentas"));
    let fim = ini;
    while (fim < linhas.length && linhas[fim].trim()) fim += 1;
    return [[], limpo(linhas.slice(ini, fim).join(" ")), linhas.slice(fim)];
  }

  const candidatos = linhas.filter((l) => l.trim() && PEDACO_DE_ROTULO.test(l.trim())).map(recuo);
  const colRotulo = candidatos.length ? Math.min(...candidatos) : 0;
  const ehRotulo = (l) => Boolean(l.trim()) && recuo(l) <= colRotulo + 2 && PEDACO_DE_ROTULO.test(l.trim());
  const inicioDoTexto = (l) => {
    if (ehRotulo(l)) {
      const m = /^\s*\S.*?\s{2,}(?=\S)/.exec(l);
      return m ? m[0].length : null;
    }
    return recuo(l);
  };

  let colTexto = null, fim = linhas.length;
  for (const [a, b] of blocosPorLinhaVazia(linhas)) {
    const bloco = linhas.slice(a, b);
    if (colTexto === null) {
      const longas = bloco.filter((l) => l.trim().length >= 30).map(inicioDoTexto).filter((v) => v !== null);
      if (longas.length) colTexto = Math.min(...longas);
    }
    if (bloco.some(ehRotulo)) continue;
    if (colTexto === null) continue;
    const recuado = Math.min(...bloco.map(recuo)) >= colTexto - 3;
    const estreito = Math.max(...bloco.map((l) => l.trimEnd().length)) < 92;
    if (recuado && estreito) continue;
    fim = a;
    break;
  }
  const setor = linhas.slice(0, fim), sobra = linhas.slice(fim);

  const partes = [];
  for (const l of setor) {
    if (!l.trim()) { partes.push([null, null]); continue; }
    if (ehRotulo(l)) {
      const pedacos = l.trim().split(/\s{2,}/);
      partes.push([pedacos[0], pedacos.length > 1 ? pedacos.slice(1).join("  ") : null]);
    } else partes.push([null, l.trim()]);
  }

  const rotulos = [];
  partes.forEach(([pedaco], k) => {
    if (pedaco === null) return;
    const nomeNovo = Object.keys(ROTULOS_DE_FERRAMENTA).some((n) => pedaco.toLowerCase().startsWith(n));
    if (nomeNovo || !rotulos.length) rotulos.push({ pedacos: [pedaco], linhas: [k] });
    else { rotulos[rotulos.length - 1].pedacos.push(pedaco); rotulos[rotulos.length - 1].linhas.push(k); }
  });

  // O rótulo é centralizado sobre a leitura: a leitura vai do fim da anterior até o
  // espelho desse começo em torno do centro do rótulo.
  const centros = rotulos.map((r) => r.linhas.reduce((s, v) => s + v, 0) / r.linhas.length);
  const ferramentas = [];
  let inicio = 0;
  rotulos.forEach((r, n) => {
    let ultimo;
    if (n === rotulos.length - 1) {
      ultimo = partes.length - 1;
    } else {
      let primeiroTexto = inicio;
      for (let k = inicio; k < partes.length; k += 1) if (partes[k][1]) { primeiroTexto = k; break; }
      ultimo = Math.min(Math.max(Math.round(2 * centros[n] - primeiroTexto), Math.max(...r.linhas)), partes.length - 1);
      // O espelho erra por uma linha quando o rótulo não está exatamente no meio:
      // segue até o fim do sub-bloco, enquanto a linha ainda estiver mais perto
      // deste rótulo do que do próximo.
      const proximo = rotulos[n + 1];
      let k = ultimo + 1;
      while (k < partes.length && !(partes[k][0] === null && partes[k][1] === null) && !proximo.linhas.includes(k)
          && Math.abs(k - centros[n]) <= Math.abs(k - centros[n + 1])) {
        ultimo = k;
        k += 1;
      }
    }
    const texto = [];
    for (let k = inicio; k <= ultimo; k += 1) if (partes[k][1]) texto.push(partes[k][1]);
    ferramentas.push({ rotulo: r.pedacos.join(" "), linhas: texto });
    inicio = ultimo + 1;
  });

  const saida = [];
  for (const f of ferramentas) {
    const rotulo = f.rotulo;
    const chave = Object.entries(ROTULOS_DE_FERRAMENTA).find(([n]) => rotulo.toLowerCase().startsWith(n))?.[1] ?? null;
    const item = { chave, rotulo };
    let m = /Sequência\s+(?:[Mm]ínima|exigida):\s*(\d)/.exec(rotulo);
    if (m) item.dados = Number(m[1]);
    if (/\(apenas se o Ídolo for quebrado\)/.test(rotulo)) item.condicao = "apenas se o Ídolo for quebrado";
    let texto = f.linhas.join("\n");
    // Nota de rodapé do livro ("E de Edgar.³"): o número solto no começo da linha é
    // o marcador; a nota em si vem no texto de mestre, começando pelo mesmo número.
    m = /^(\d)\s{2,}(?=\S)/m.exec(texto);
    if (m) {
      item.notaDeRodape = Number(m[1]);
      texto = texto.replace(/^(\d)\s{2,}(?=\S)/gm, "");
    }
    item.texto = texto;
    saida.push(item);
  }
  return [saida, "", sobra];
}

/**
 * Faixa → segundos ou equação. O Ato II imprime "10 ou mais" e "6 ou menos" na
 * mesma linha, que o leitor do Ato I não conhece.
 */
function tabelaDeHack(caixa) {
  const texto = caixa.map((l) => limpo(l)).join(" ");
  let equacao = "";
  for (const l of caixa) {
    const m = EQUACAO_NO_TOPO.exec(l.trim());
    if (m) { equacao = m[1].trim(); break; }
  }
  const linhas = [];
  for (const m of texto.matchAll(/(\d+\s*ou\s*mais|\d+\s*-\s*\d+|\d+\s*ou\s*menos|\d+\+)\s+([^\s]+(?:\s*[×÷=²√*+-]\s*[^\s]+)*)/g)) {
    const [, faixa, valor] = m;
    let rolagem;
    let f = /(\d+)\s*ou\s*mais/.exec(faixa);
    if (f) rolagem = `${f[1]}+`;
    else if ((f = /(\d+)\s*ou\s*menos/.exec(faixa))) rolagem = `1-${f[1]}`;
    else rolagem = faixa.replace(/\s+/g, "");
    const segundos = /^(\d+)s$/.exec(valor);
    if (segundos) linhas.push({ rolagem, equacao, segundos: Number(segundos[1]) });
    else if (valor.includes("=")) linhas.push({ rolagem, equacao: limpo(valor), segundos: 0 });
  }
  return linhas;
}

const ERRATAS_DE_EXTRACAO = [
  // Espaço engolido e primeira letra perdida na conversão do PDF, não no livro. A
  // v1.1 já vem com o "A": sem o lookbehind, ela ganhava dois ("AAnalisar").
  [/altarmolhado/g, "altar molhado"],
  [/(?<!A)nalisar o sangue congelado/g, "Analisar o sangue congelado"],
];

function aplicarErratas(obj) {
  if (typeof obj === "string") {
    let s = obj;
    for (const [de, para] of ERRATAS_DE_EXTRACAO) s = s.replace(de, para);
    return s;
  }
  if (Array.isArray(obj)) return obj.map(aplicarErratas);
  if (obj && typeof obj === "object") return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, aplicarErratas(v)]));
  return obj;
}

/**
 * "Conjuntos de palavras (vermelhos indicam conjuntos falsos): A – B – …" e
 * "Solução: …" → {conjuntos, solucao}. O vermelho se perde na extração; o que está
 * na solução é verdadeiro, o resto é falso.
 */
function desmontarRadio(texto) {
  const m = /Conjuntos de palavras \(vermelhos indicam conjuntos falsos\):\s*([\s\S]+?)\s*Solução:\s*([\s\S]+)$/.exec(texto.replace(/\n/g, " "));
  if (!m) return null;
  const conjuntos = m[1].split(/\s+–\s+|\s+-\s+(?=[“A-Z])/).map((c) => limpo(c)).filter(Boolean);
  return { conjuntos, solucao: limpo(m[2]) };
}

/**
 * Como `paragrafos`, mas um bloco de linhas curtas depois de um parágrafo que termina
 * em ":" é lista (as chaves do molho: "Porta do Depósito A", …), separada por ";".
 */
function paragrafosComListas(linhas) {
  const saida = [];
  const blocos = [];
  let atual = [];
  for (const l of linhas) {
    if (l.trim()) atual.push(l.trim());
    else if (atual.length) { blocos.push(atual); atual = []; }
  }
  if (atual.length) blocos.push(atual);
  for (const b of blocos) {
    const anterior = saida[saida.length - 1];
    const ehLista = anterior !== undefined && anterior.endsWith(":") && b.length >= 2 && b.every((x) => x.length <= 40);
    // O marcador de lista do livro vira "•" na grade; separado por ";", ele sobra.
    if (ehLista) saida[saida.length - 1] = `${anterior} ${b.map((x) => x.replace(/^•\s*/, "")).join("; ")}.`;
    else saida.push(juntarHifenizacao(b.join("\n")).replace(/\n/g, " "));
  }
  return saida;
}

function lerPontos(linhas, legenda) {
  const a = indice(linhas, /^\s*PERTENCES DE ALAN\s*$/);
  const b = indice(linhas, FIM_DOS_PONTOS, a);
  const trecho = linhas.slice(a, b);
  const pontos = [], secoes = {};
  let atual = null;
  let i = 0;
  while (i < trecho.length) {
    const l = trecho[i];
    const t = l.trim();
    if (t in SECOES) {
      // Seção entre pontos: "PORÃO", "A SALA SECRETA", a caixa da maldição.
      let fim = trecho.length;
      for (let k = i + 1; k < trecho.length; k += 1) {
        if (ehTituloDePonto(trecho, k) || trecho[k].trim() in SECOES) { fim = k; break; }
      }
      secoes[SECOES[t]] = paragrafos(semPaginas(trecho.slice(i + 1, fim)));
      i = fim;
      continue;
    }
    if (ehTituloDePonto(trecho, i)) {
      atual = { nome: limpo(t), recuo: recuo(l), linhas: [] };
      pontos.push(atual);
    } else if (t.includes("CONTINUAÇÃO") && atual !== null) {
      // a mesma tabela virando a página
    } else if (atual !== null) {
      atual.linhas.push(l);
    }
    i += 1;
  }

  const usados = new Set();
  for (const p of pontos) {
    montarPonto(p, legenda);
    // O livro imprime o título do Símbolo no Teto no lugar do Duto de Ventilação
    // (ponto 18): o número da margem e a legenda dizem quem é.
    if (usados.has(p.numero) && !usados.has(p.numeroImpresso)) {
      p.tituloImpresso = p.nome;
      p.numero = p.numeroImpresso;
      p.nome = (legenda[p.numero] ?? p.nome).toUpperCase();
    }
    usados.add(p.numero);
  }
  return [pontos, secoes];
}

function montarPonto(p, legenda) {
  let linhas = semPaginas(p.linhas);
  delete p.linhas;
  delete p.recuo;
  // O número do ponto, impresso na margem direita da descrição.
  let numero = null;
  for (let k = 0; k < Math.min(5, linhas.length); k += 1) {
    const m = NUMERO_NA_MARGEM.exec(linhas[k]);
    if (m) { numero = Number(m[1]); linhas[k] = linhas[k].slice(0, m.index); break; }
  }
  p.numeroImpresso = numero;
  const meu = semAcento(p.nome).toLowerCase();
  const casam = Object.entries(legenda)
    .filter(([, nome]) => meu.includes(semAcento(nome).toLowerCase()) || semAcento(nome).toLowerCase().includes(meu))
    .map(([n, nome]) => [nome.length, Number(n)]);
  p.numero = casam.length ? casam.sort((x, y) => y[0] - x[0] || y[1] - x[1])[0][1] : numero;

  const [semCaixa, caixa] = separarCaixa(linhas);
  linhas = semCaixa;
  p.desafio = caixa.length ? lerDesafio(caixa) : null;
  // "(HACK / 1-4 √2209 = 47 / TÉCNICO)": a tabela se imprime no meio do rótulo, e o
  // leitor do Ato I procura "HACK TÉCNICO" junto.
  const textoDaCaixa = caixa.join(" ");
  if (caixa.length && /\bHACK\b/.test(textoDaCaixa) && /\bTÉCNICO\b/.test(textoDaCaixa)) {
    p.desafio = p.desafio ?? {};
    p.desafio.hackTecnico = { tabela: [] };
    p.desafio.observacao ??= prosaDaCaixa(caixa);
  }
  if (p.desafio && caixa.length) p.desafio.rotulo = rotuloDaCaixa(caixa) || p.desafio.rotulo || "";

  // Onde cada parte começa.
  const iCab = linhas.findIndex((l) => CABECALHO.test(l));
  const iFer = linhas.map((l, k) => (l.trim() === "FERRAMENTAS" ? k : -1)).filter((k) => k >= 0);
  const marcos = [iCab, ...iFer].filter((k) => k >= 0);
  const fimDesc = marcos.length ? Math.min(...marcos) : linhas.length;
  // A descrição é o primeiro bloco de linhas, na margem do ponto. Texto de mestre
  // antes do quadro vem depois de uma linha em branco, ou recuado para dentro.
  const margem = linhas.length && linhas[0].trim() ? recuo(linhas[0]) : 0;
  let fimBloco = fimDesc;
  for (let k = 0; k < fimDesc; k += 1) {
    if (!linhas[k].trim() && linhas.slice(0, k).some((l) => l.trim())) { fimBloco = k; break; }
  }
  let corte = fimBloco;
  for (let k = 1; k < fimBloco; k += 1) {
    if (linhas[k].trim() && recuo(linhas[k]) >= margem + 2) { corte = k; break; }
  }
  const notasAntes = linhas.slice(corte, fimDesc);
  p.descricao = limpo(linhas.slice(0, corte).map((l) => l.trim()).join(" "));

  let infos = [], sobras = [];
  p.celulasDT = 0;
  if (iCab >= 0) {
    const fimTab = iFer.length ? iFer[0] : linhas.length;
    const [colDt] = colunas(linhas[iCab]);
    // A coluna "Informação" do cabeçalho está 1 coluna à direita do texto nas
    // páginas do Ato II; medir pela DT (2 dígitos + folga) em vez do cabeçalho.
    [infos, , sobras] = lerTabela([...linhas.slice(iCab + 1, fimTab), "", "", ""], 0, colDt, colDt + 3);
    p.celulasDT = linhas.slice(iCab + 1, fimTab)
      .filter((l) => /^\d+$/.test(l.slice(Math.max(0, colDt - 2), colDt + 3).trim())).length;
  }
  for (const info of infos) {
    [info.chave, info.condicao] = chaveDePericia(info.pericia);
    // A v1.1 imprime a condição na coluna da informação, acima do texto: "(Apenas ao
    // usar a Câmera Modificada)". Na v1 ela estava no rótulo da perícia.
    const condicaoNoTexto = /^\((apenas [^)]+)\)\s*/i.exec(info.texto);
    if (condicaoNoTexto && !info.condicao) {
      info.condicao = condicaoNoTexto[1][0].toLowerCase() + condicaoNoTexto[1].slice(1);
      info.pericia = `${info.pericia} (${info.condicao})`;
      info.texto = info.texto.slice(condicaoNoTexto[0].length);
    }
    // "3 ou 4 Eloísa não parecia…" / "5 Kênia e Eloísa…": os ícones de contagem de
    // jogadores do livro viram só o número na extração.
    if (/\b3\s+ou 4\s+[A-ZÁ-Ú]/.test(info.texto)) {
      info.texto = info.texto.replace(/\b(\d)\s+ou\s+(\d)\s+(?=[A-ZÁ-Ú])/g, "($1 ou $2 jogadores) ");
      info.texto = info.texto.replace(/\.\s+(\d)\s+(?=[A-ZÁ-Ú])/g, ". ($1 jogadores) ");
    }
  }
  p.informacoes = infos;

  const ferramentas = [];
  let leituraNormal = "", notas = [];
  if (iFer.length) {
    // Setor em duas páginas (o Ídolo, o Altar, o Computador): junta os pedaços.
    iFer.forEach((k, n) => {
      const fim = n + 1 < iFer.length ? iFer[n + 1] : linhas.length;
      const [f, normal, sobra] = lerFerramentas(linhas.slice(k + 1, fim));
      ferramentas.push(...f);
      leituraNormal = leituraNormal || normal;
      notas.push(...sobra);
    });
  } else {
    notas = iCab < 0 ? linhas.slice(fimDesc) : [];
  }
  notas = [...notasAntes, ...notas];
  p.leituraNormal = leituraNormal;
  // O livro imprime "Laboratório" nos quatro rótulos do freezer; a leitura diz qual
  // ferramenta é cada uma.
  const vistas = new Set();
  for (const f of ferramentas) {
    if (vistas.has(f.chave) && !f.dados) {
      const t = f.texto.toLowerCase();
      if (t.includes("estouro da lanterna") || t.includes("luz uv")) { f.chave = "lanternaUV"; f.rotuloCorrigido = true; }
      else if (t.includes("áudio emf")) { f.chave = "emf"; f.rotuloCorrigido = true; }
      else if (/mais frio|mais quente|temperatura/.test(t)) { f.chave = "termometro"; f.rotuloCorrigido = true; }
    }
    vistas.add(f.chave);
    // "(leia Percepção [ícone] acima)": o ícone da DT some na extração.
    f.texto = f.texto.replace(/Percepção\s{3,}acima/, "Percepção (apenas se o Ídolo for quebrado) acima");
  }
  p.ferramentas = ferramentas;
  if (p.desafio && p.desafio.hackTecnico) p.desafio.hackTecnico.tabela = tabelaDeHack(caixa);
  for (const f of ferramentas) {
    if (f.chave === "radio") {
      const r = desmontarRadio(f.texto);
      if (r) f.radio = r;
    }
    const m = /ÁUDIO EMF (\d)/.exec(f.texto);
    if (m) f.audio = Number(m[1]);
    // "[HANDOUT 01 - FOTO DO ALTAR]" na v1; "handout: HANDOUT 03 - FOTO DO ALTAR DE
    // MADEIRA Caso não consiga…" na v1.1 — sem colchete nem ponto, o título acaba
    // onde acaba a caixa alta.
    f.handouts = [...f.texto.matchAll(HANDOUT_NO_TEXTO)].map((h) => limpo(h[1] ?? h[2]));
  }
  p.notas = paragrafosComListas(notas).filter(Boolean);
  p.notas.push(...sobras.filter(Boolean));
  const citados = new Set([...linhas.join(" ").matchAll(HANDOUT_CITADO)]
    .map((m) => limpo(`${m[1]}${m[2] ?? ""}`.replace(/HANDOUT\s+/g, ""))));
  p.handoutsCitados = [...citados].sort();
}

/* ------------------------------------------------------------- conferência -- */

const DISCREPANCIAS_DO_LIVRO = { 7: new Set(["lanternaUV"]) };

/** Provas estruturais: o que sai bate com o que o livro imprime. */
export function conferir(dados) {
  const problemas = [];
  const pontos = Object.fromEntries(dados.pontos.map((p) => [p.numero, p]));
  const faltam = Object.keys(dados.legenda).map(Number).filter((n) => !(n in pontos));
  if (faltam.length) problemas.push(`pontos da legenda sem ponto extraído: ${faltam.join(", ")}`);

  for (const [n, esperadas] of Object.entries(dados.matriz)) {
    const p = pontos[n];
    if (!p) { problemas.push(`ponto ${n} da matriz não existe`); continue; }
    let lidas = new Set(p.ferramentas.map((f) => f.chave).filter((c) => c !== "laser"));
    const laser = [...dados.laser.porao, ...dados.laser.salaSecreta].includes(Number(n));
    const esperado = new Set(esperadas);
    if (laser !== esperado.has("laser")) problemas.push(`ponto ${n}: laser na matriz ${esperado.has("laser")}, na lista ${laser}`);
    esperado.delete("laser");
    // O livro se contradiz no Ídolo: o texto dá reação à Lanterna UV, a matriz não.
    // …e a v1.1 corrigiu a matriz: a discrepância conhecida não conta de nenhum lado.
    lidas = new Set([...lidas].filter((c) => !DISCREPANCIAS_DO_LIVRO[n]?.has(c)));
    for (const c of DISCREPANCIAS_DO_LIVRO[n] ?? []) esperado.delete(c);
    const a = [...lidas].sort().join(","), b = [...esperado].sort().join(",");
    if (a !== b) problemas.push(`ponto ${n} (${p.nome}): texto lê [${a}], matriz diz [${b}]`);
  }
  for (const n of dados.leituraNormal) {
    const p = pontos[n];
    if (p && p.ferramentas.length) problemas.push(`ponto ${n} (${p.nome}): devia ser leitura normal`);
  }
  for (const p of dados.pontos) {
    if (p.celulasDT !== p.informacoes.length) {
      problemas.push(`${p.nome}: ${p.celulasDT} células de DT no livro, ${p.informacoes.length} linhas extraídas`);
    }
  }
  for (const p of dados.pontos) {
    for (const f of p.ferramentas) {
      if (!f.radio) continue;
      const norm = (t) => semAcento(t).toLowerCase().replace(/[^a-z0-9 ]/g, "");
      const sol = norm(f.radio.solucao);
      const verdadeiros = f.radio.conjuntos.filter((c) => norm(c) && sol.includes(norm(c)));
      if (verdadeiros.length < 3) problemas.push(`${p.nome}: rádio com só ${verdadeiros.length} conjuntos na solução`);
    }
  }
  return problemas;
}

/** Tudo do Ato II, no formato de `build/ato-ii.json`, mais os problemas da conferência. */
export function extrairAtoII(linhasDoPdf) {
  const linhas = trechoDoAtoII(linhasDoPdf);
  const [mecanicasIntro, mecanicas] = lerMecanicas(linhas);
  const [matriz, leituraNormal] = lerMatriz(linhas);
  const legenda = lerLegenda(linhas);
  const [pontos, secoes] = lerPontos(linhas, legenda);
  const [narracaoFinal, fugindo] = lerNarracaoFinal(linhas);
  const dados = aplicarErratas({
    aberturaDoAto: paragrafos(semPaginas(linhas.slice(4, indice(linhas, /^\s*PREPARAÇÃO\b/)))),
    preparacao: lerPreparacao(linhas),
    mecanicasIntro,
    mecanicas,
    matriz,
    leituraNormal,
    laser: lerLaser(linhas),
    vitoria: lerVitoria(linhas),
    introducao: lerIntroducao(linhas),
    cenaInicial: lerCenaInicial(linhas),
    legenda,
    pontosIntro: lerSecao(linhas, /^PONTOS DE INTERESSE\s*$/, /^NOVAS DESCOBERTAS\s*$/),
    novasDescobertas: lerSecao(linhas, /^NOVAS DESCOBERTAS\s*$/, /^PERTENCES SEPARADOS PELA ORDEM\s*$/),
    pertencesIntro: lerSecao(linhas, /^PERTENCES SEPARADOS PELA ORDEM\s*$/, /^\s*PERTENCES DE ALAN\s*$/),
    ...secoes,
    pontos,
    narracaoFinal,
    fugindo,
    respostaCorreta: lerResposta(linhas),
  });
  return { dados, problemas: conferir(dados) };
}
