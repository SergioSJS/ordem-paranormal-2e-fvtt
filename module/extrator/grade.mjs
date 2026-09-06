/**
 * Do pdf.js para linhas de texto em colunas — a mesma forma que o `pdftotext -layout`
 * entrega e que os extratores foram escritos para ler.
 *
 * O pdf.js devolve cada pedaço de texto com posição (x, y) e altura da fonte. O que os
 * extratores precisam é o que o `pdftotext -layout` dá: uma linha por linha impressa,
 * recuo e colunas preservados em espaços, linhas em branco marcando os vãos verticais.
 * Este módulo faz essa conversão, e faz do mesmo jeito no navegador do mestre e no
 * Node dos testes — é o que deixa a extração rodar dentro do Foundry, sem Python nem
 * `pdftotext` instalados em lugar nenhum.
 *
 * Duas regras copiadas do pdftotext, medidas contra ele:
 * - a coluna 0 é o texto mais à esquerda DA PÁGINA, não a borda do papel;
 * - a largura da célula segue a fonte: cerca de 0,55 vez a altura mediana do texto.
 */

/** Um pedaço de texto posicionado, como o pdf.js entrega, já limpo. */
function pedacosDaPagina(conteudo) {
  const vistos = new Set();
  const pedacos = [];
  for (const item of conteudo.items) {
    if (!item.str || !item.str.trim()) continue;
    const pedaco = {
      // Os caracteres de controle C1 são o marcador de lista de uma fonte de ícones.
      // O pdftotext os deixa passar, e os extratores contam com eles: a linha "\x8a Dom
      // Caschute" NÃO começa com maiúscula, então "PRATELEIRA 1" não é título de
      // ponto. Aqui viram "•", que todo lugar do extrator já sabe tirar.
      texto: item.str.replace(/[\u0080-\u009f]/g, "•"),
      x: item.transform[4],
      y: item.transform[5],
      largura: item.width,
      altura: item.height || Math.abs(item.transform[3]) || 0,
      // Texto girado (os cabeçalhos da matriz de ferramentas do Ato II, escritos de
      // baixo para cima): a âncora é o pé do texto, e a "largura" corre na vertical.
      rotacionado: Math.abs(item.transform[1]) > 0.1 || Math.abs(item.transform[2]) > 0.1,
    };
    // O mesmo texto duas vezes no mesmo lugar (o número da página vinha em dobro).
    const chave = `${pedaco.texto}|${Math.round(pedaco.x)}|${Math.round(pedaco.y)}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    pedacos.push(pedaco);
  }
  return pedacos;
}

function mediana(valores) {
  if (!valores.length) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[Math.floor(ordenados.length / 2)];
}

/**
 * Agrupa os pedaços em linhas pelo y: dois pedaços estão na mesma linha se a
 * diferença de baseline for menor que metade da altura da fonte.
 */
function agruparEmLinhas(pedacos) {
  const ordenados = [...pedacos].sort((a, b) => b.y - a.y || a.x - b.x);
  const linhas = [];
  for (const pedaco of ordenados) {
    const ultima = linhas[linhas.length - 1];
    // Texto girado fica sozinho na própria linha, na coluna da âncora: é como o
    // pdftotext imprime os cabeçalhos girados da matriz, um por linha — e é pela
    // coluna de cada um que o extrator sabe a qual ferramenta cada ✘ pertence.
    // Agrupados pelo y, os nove cabeçalhos viravam uma linha só, colados.
    if (pedaco.rotacionado || ultima?.rotacionada) {
      linhas.push({ y: pedaco.y, altura: pedaco.altura, pedacos: [pedaco], rotacionada: pedaco.rotacionado });
      continue;
    }
    // Menos de METADE da menor fonte das duas — medido contra o pdftotext em cinco
    // casos: o rótulo "DESAFIO" da caixa (9 pt) fica 3,5 pt acima do texto ao lado e
    // junta; a perícia "Tecnologia" (9 pt) centralizada sobre a informação (8 pt)
    // fica 4,04 pt abaixo e separa — colada, o extrator lia "Tecnologia apoio
    // para…" como prosa; as duas caixas da maldição (10,5 pt), lado a lado com
    // entrelinhas diferentes, juntam a 4,6 pt e separam a 5,4 pt; e na narração
    // final, em duas colunas de 9 pt, a última linha da direita fica 4,46 pt acima
    // da linha da esquerda e junta — separada, ela partia o parágrafo da esquerda.
    // É a proporção da fonte, não um número fixo, que acerta os cinco.
    const alturas = [ultima?.altura, pedaco.altura].filter(Boolean);
    const tolerancia = Math.max(2, (alturas.length ? Math.min(...alturas) : 9) * 0.5);
    if (ultima && Math.abs(ultima.y - pedaco.y) < tolerancia) {
      ultima.pedacos.push(pedaco);
    } else {
      linhas.push({ y: pedaco.y, altura: pedaco.altura, pedacos: [pedaco] });
    }
  }
  for (const linha of linhas) {
    linha.pedacos.sort((a, b) => a.x - b.x);
    // A linha fica na altura do pedaço de fonte maior. O rótulo da perícia (9 pt) e a
    // informação ao lado (8 pt) dividem a linha a 2,8 pt de diferença; medindo o vão
    // pela informação, o rótulo seguinte parecia estar a uma entrelinha e meia e
    // abria linha em branco — e o extrator partia "(apenas se | o Ídolo for quebrado)".
    const dominante = linha.pedacos.reduce((m, p) => (p.altura > m.altura ? p : m), linha.pedacos[0]);
    linha.y = dominante.y;
    linha.altura = dominante.altura;
  }
  return linhas;
}

/**
 * Uma linha de pedaços vira texto em colunas: cada pedaço começa na coluna que a sua
 * posição x pede, e o que não cabe empurra para a frente com um espaço.
 */
function linhaEmColunas(linha, origem, celula, direita) {
  let texto = "";
  let fimAnterior = null;
  let alturaAnterior = null;
  for (const pedaco of linha.pedacos) {
    const coluna = Math.max(0, Math.round((pedaco.x - origem) / celula));
    // O vão real entre o fim do pedaço anterior e o começo deste, em células.
    const vao = fimAnterior === null ? Infinity : (pedaco.x - fimAnterior) / celula;
    // O número do ponto no mapa fica na margem direita, e os extratores o tiram pela
    // folga de três espaços ou mais — como sai no pdftotext. Quando a frase chega
    // perto dele, a folga aqui encolhia para um espaço e o número entrava no texto.
    const numeroNaMargem = fimAnterior !== null && /^\d{1,2}$/.test(pedaco.texto.trim())
      && (pedaco.altura >= 1.5 * (alturaAnterior || 9) || pedaco.x > direita - 12 * celula);
    if (fimAnterior !== null && vao < 0.15) {
      // Colado no anterior: é a mesma palavra, ou a pontuação que o pdf.js separou
      // ("bateria" + "."). Nada de espaço. O limiar é apertado de propósito: numa
      // coluna estreita e justificada o espaço entre palavras encolhe até um terço
      // de célula, e com 0,3 "o puzzle da" saía "opuzzleda".
    } else if (numeroNaMargem) {
      texto += " ".repeat(Math.max(3, coluna - texto.length));
    } else if (vao >= 2.2 && coluna - texto.length >= 2) {
      // Salto de coluna de verdade: preenche até a coluna que a posição pede. O
      // limiar é o que o pdftotext pratica, medido: "ACESSO PAINEL" no rótulo da
      // caixa tem 1,75 célula de vão e sai com um espaço; a DT para a informação do
      // quadro tem 2,4 e sai em colunas. A posição é absoluta de propósito: é o que
      // mantém a coluna da direita alinhada linha a linha, e é dela que os extratores
      // tiram o recuo.
      texto += " ".repeat(coluna - texto.length);
    } else if (texto.length && !texto.endsWith(" ") && !pedaco.texto.startsWith(" ")) {
      // Texto justificado vem picado com folgas pequenas: isso é um espaço só.
      texto += " ";
    }
    texto += pedaco.texto;
    fimAnterior = pedaco.x + pedaco.largura;
    alturaAnterior = pedaco.altura;
  }
  return texto.replace(/\s+$/, "");
}

/**
 * O fim do texto da linha anterior NA MESMA COLUNA em que a linha nova começa: os
 * pedaços da anterior em trechos contíguos (um salto de coluna separa dois trechos),
 * e o trecho que começa onde a nova linha começa — ou o último, se nenhum começa ali.
 */
function fimDaColuna(anterior, primeiro, celula) {
  if (!anterior || !primeiro) return "";
  const trechos = [];
  let fim = null;
  for (const pedaco of anterior.pedacos) {
    if (fim === null || (pedaco.x - fim) / celula >= 2.2) trechos.push([]);
    trechos[trechos.length - 1].push(pedaco);
    fim = pedaco.x + pedaco.largura;
  }
  const trecho = trechos.find((t) => Math.abs(t[0].x - primeiro.x) <= 2 * celula) ?? trechos[trechos.length - 1];
  return trecho[trecho.length - 1].texto.trimEnd();
}

/**
 * Uma página inteira em linhas de texto, com linhas em branco onde há vão vertical —
 * o `pdftotext -layout` põe uma linha vazia a cada altura de linha de espaço.
 *
 * @param {object} conteudo o `getTextContent()` do pdf.js
 * @returns {string[]} as linhas da página
 */
export function paginaEmLinhas(conteudo, { fonteDoDocumento = null } = {}) {
  const pedacos = pedacosDaPagina(conteudo);
  if (!pedacos.length) return [];
  const linhas = agruparEmLinhas(pedacos);
  const origem = Math.min(...pedacos.map((p) => p.x));
  const direita = Math.max(...pedacos.map((p) => p.x + p.largura));
  const fonteDaPagina = mediana(pedacos.map((p) => p.altura).filter(Boolean)) || 9;
  // A página de narração usa corpo maior (10,5 pt) e, com a célula seguindo a fonte
  // da página, as colunas dela saíam mais apertadas que no pdftotext — o corredor
  // entre as duas colunas de texto encolhia de treze colunas para duas e a leitura
  // embaralhava as colunas. O pdftotext não alarga a célula com a fonte: a régua
  // é o corpo do documento. Página de fonte menor (a matriz do Ato II) continua com a
  // sua, senão as colunas dela viram uma coisa só.
  const alturaDaFonte = fonteDoDocumento ? Math.min(fonteDaPagina, fonteDoDocumento) : fonteDaPagina;
  // A célula é 0,45 do corpo da fonte dominante da página — 4,0 pt para o corpo de
  // 9 pt, que é o que o pdftotext usa nestas páginas (medido). Com metade da fonte
  // as colunas saíam 11% mais apertadas e o texto corrido "avançava" sobre o corredor
  // entre duas colunas de narração até quebrá-lo; a largura média real dos glifos
  // era pior ainda. A fonte de cada linha, ou a menor da página, desalinhava a
  // coluna da DT entre o cabeçalho e as linhas do quadro.
  const celula = () => alturaDaFonte * 0.45;
  // Entre uma linha e a seguinte, o pdftotext conta o vão em passos de ~1,2 vez a
  // fonte (a entrelinha do corpo de texto). Medido nos casos que decidem a leitura
  // do quadro: linhas seguidas (12 pt) não abrem vazia; o rótulo da perícia
  // centralizado entre duas linhas (18 pt) abre uma; o vão de parágrafo (24 pt) abre
  // uma; o vão maior antes de uma nota do mestre (36 pt) abre duas — e três só no
  // rodapé, que é onde o quadro tem que acabar.
  // A entrelinha acompanha a fonte DA PÁGINA (a de abertura, em corpo maior, tem
  // entrelinha maior): medida pela fonte do documento, uma linha comum dela passava
  // por vão de parágrafo e o texto de abertura do Ato II saía partido ao meio.
  // Página que é quase só quadro (fonte mediana 8 pt) tem o texto corrido no corpo do
  // documento (9 pt) e a entrelinha dele: com o passo da página, um parágrafo de
  // 13 pt de entrelinha caía em vão de parágrafo. O corpo do documento é o piso.
  const passo = Math.max(fonteDaPagina, fonteDoDocumento ?? 0) * 1.2;

  const saida = [];
  let yAnterior = null;
  let linhaAnterior = null;
  let intercaladas = 0;
  let anteriorEraNumero = false;
  for (const linha of linhas) {
    // A DT do quadro é um número sozinho, centralizado na vertical sobre as linhas da
    // informação: fica encaixada logo abaixo de uma linha de texto (a menos de uma
    // entrelinha), e no pdftotext não abre linha em branco nem antes nem depois.
    // Medir o vão a partir dela abria uma vazia no meio da linha do quadro, e o
    // texto virava outra linha. Já os números da tabela da maldição vêm um embaixo
    // do outro, cada um na sua linha vazia de tabela — esses contam normalmente,
    // senão as rodadas 0, 1, 2 e 3 colavam num bloco só e o evento saía na 3.
    const numeroSozinho = linha.pedacos.length === 1 && /^\d{1,2}$/.test(linha.pedacos[0].texto.trim());
    const encaixada = numeroSozinho && yAnterior !== null && !anteriorEraNumero
      && (yAnterior - linha.y) < passo;
    const texto = linhaEmColunas(linha, origem, celula(linha), direita);
    if (yAnterior !== null && !encaixada) {
      // Teto de seis: o rodapé da página fica a dezenas de linhas do texto, e os
      // extratores só precisam saber que o bloco acabou (três vazias).
      let vazias = Math.min(6, Math.round((yAnterior - linha.y) / passo) - 1 - intercaladas);
      // Frase cortada no meio não é fim de parágrafo: linha que não termina em
      // pontuação seguida de linha que começa em minúscula é a mesma frase, por mais
      // que a entrelinha ali seja larga (rótulo de perícia em coluna estreita, texto
      // de corpo maior). O pdftotext não abre linha em branco aí; a régua por vão
      // abria, e o extrator partia a descrição e o rótulo. Três vazias ou mais é
      // fim de página e fica.
      // É pela COLUNA que se olha, não pela linha inteira: ao lado do rótulo partido
      // há a informação do quadro, que termina em ponto.
      const fimAnterior = fimDaColuna(linhaAnterior, linha.pedacos[0], celula(linha));
      const fraseContinua = vazias > 0 && vazias < 3 && fimAnterior
        && (/\p{L}-$/u.test(fimAnterior)
          || (!/[.!?…”"):;]$/.test(fimAnterior) && /^\p{Ll}/u.test(linha.pedacos[0].texto.trimStart())));
      if (fraseContinua) vazias = 0;
      for (let i = 0; i < vazias; i += 1) saida.push("");
    }
    saida.push(texto);
    if (encaixada) {
      intercaladas += 1;
    } else {
      yAnterior = linha.y;
      linhaAnterior = linha;
      intercaladas = 0;
    }
    anteriorEraNumero = numeroSozinho;
  }
  return saida;
}

/**
 * O documento inteiro, como o `pdftotext -layout` imprime: as páginas em sequência,
 * separadas por uma linha vazia (o form feed do pdftotext vira quebra de linha).
 *
 * @param {object} pdf o documento do pdf.js (`getDocument(...).promise`)
 * @param {(pagina: number, total: number) => void} [aoProgredir]
 */
export async function documentoEmLinhas(pdf, aoProgredir = () => {}) {
  // Duas passadas: a primeira lê as páginas e mede o corpo do documento, a segunda
  // monta as linhas com essa régua.
  const conteudos = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    conteudos.push(await (await pdf.getPage(i)).getTextContent());
    aoProgredir(i, pdf.numPages);
  }
  const alturas = conteudos.flatMap((c) => pedacosDaPagina(c).map((p) => p.altura)).filter(Boolean);
  const fonteDoDocumento = mediana(alturas) || 9;

  const linhas = [];
  for (const conteudo of conteudos) {
    // Três linhas em branco entre páginas: no pdftotext o rodapé vem seguido do vão
    // até a borda e do form feed, e os extratores fecham bloco em três vazias — sem
    // isso, a lista das prateleiras colava no texto da página anterior e o vão entre
    // as duas colunas dela deixava de atravessar o bloco inteiro.
    linhas.push(...paginaEmLinhas(conteudo, { fonteDoDocumento }), "", "", "");
  }
  return linhas;
}
