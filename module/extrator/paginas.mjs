/**
 * Do pdf.js para páginas com pedaços posicionados, e daí para texto em ordem de leitura.
 *
 * O PDF do beta é diagramado com colunas, caixas e barras laterais, e a ordem do arquivo não
 * é a de leitura. A grade de `grade.mjs`, que emula o `pdftotext -layout`, serve aos atos; as
 * missões leem a geometria direto, que é mais simples e não depende de contar espaços.
 */

/** A página como o extrator usa. O número do rodapé sai, para não entrar no texto. */
export async function paginaDoPdf(pagina) {
  const conteudo = await pagina.getTextContent();
  const pedacos = [];
  for (const item of conteudo.items) {
    if (!item.str?.trim()) continue;
    const y = item.transform[5];
    // O número da página fica sozinho no pé.
    if (y < 45 && /^\d{1,3}$/.test(item.str.trim())) continue;
    pedacos.push({
      // O ícone de dado vem como "8_on_d8": escreve-se só o dado.
      texto: item.str.replace(/\b\d+_on_(d\d+)\b/g, "$1").replace(/[\u0080-\u009f]/g, "•"),
      x: item.transform[4], y, largura: item.width, altura: item.height || Math.abs(item.transform[3]) || 0,
      fonte: item.fontName,
    });
  }
  return { numero: pagina.pageNumber, pedacos };
}

/** @returns {Promise<Array<{numero: number, pedacos: object[]}>>} */
export async function paginasDoPdf(pdf, aoProgredir = () => {}) {
  const paginas = [];
  for (let n = 1; n <= pdf.numPages; n += 1) {
    aoProgredir(n, pdf.numPages);
    paginas.push(await paginaDoPdf(await pdf.getPage(n)));
  }
  return paginas;
}

/** Pedaços na mesma linha (o y varia por causa de ícone e versalete), da esquerda para a direita. */
export function emLinhas(pedacos) {
  const ordenados = [...pedacos].sort((a, b) => b.y - a.y || a.x - b.x);
  const linhas = [];
  for (const p of ordenados) {
    const ultima = linhas.at(-1);
    if (ultima && Math.abs(ultima.y - p.y) <= Math.max(2, Math.min(ultima.altura, p.altura) * 0.45)) ultima.pedacos.push(p);
    else linhas.push({ y: p.y, altura: p.altura, pedacos: [p] });
  }
  for (const l of linhas) l.pedacos.sort((a, b) => a.x - b.x);
  return linhas;
}

/** O texto de uma linha: espaço onde há vão, cola o que veio picado. */
export function textoDaLinha(linha) {
  let texto = "";
  let fim = null;
  for (const p of linha.pedacos) {
    const vao = fim === null ? 0 : p.x - fim;
    if (fim !== null && vao > 0.6 && !texto.endsWith(" ") && !p.texto.startsWith(" ")) texto += " ";
    texto += p.texto;
    fim = p.x + p.largura;
  }
  return texto.trim();
}

const caixa = (p) => ({ x0: p.x, x1: p.x + p.largura, y0: p.y, y1: p.y + p.altura });

/** O maior vão entre os intervalos, e onde ele cai. */
function maiorVao(intervalos) {
  const ordenados = [...intervalos].sort((a, b) => a[0] - b[0]);
  let fim = ordenados[0][1];
  let melhor = { tamanho: 0, posicao: null };
  for (const [ini, f] of ordenados) {
    if (ini - fim > melhor.tamanho) melhor = { tamanho: ini - fim, posicao: (ini + fim) / 2 };
    fim = Math.max(fim, f);
  }
  return melhor;
}

/**
 * Ordem de leitura por cortes recursivos (XY-cut): uma calha vertical separa colunas; um vão
 * horizontal separa blocos. Cada folha é um trecho contínuo de texto.
 * @returns {object[][]} os blocos, em ordem
 */
export function cortarEmBlocos(pedacos, profundidade = 0) {
  if (pedacos.length <= 1 || profundidade > 24) return pedacos.length ? [pedacos] : [];
  // A mediana: um título grande na página não pode esconder a calha das colunas.
  const alturas = pedacos.map((p) => p.altura).sort((x, y) => x - y);
  const altura = alturas[Math.floor(alturas.length / 2)] || 9;
  const calha = maiorVao(pedacos.map((p) => { const c = caixa(p); return [c.x0, c.x1]; }));
  if (calha.tamanho >= Math.max(8, altura * 0.9)) {
    const esquerda = pedacos.filter((p) => p.x + p.largura / 2 < calha.posicao);
    const direita = pedacos.filter((p) => p.x + p.largura / 2 >= calha.posicao);
    if (esquerda.length && direita.length) {
      return [...cortarEmBlocos(esquerda, profundidade + 1), ...cortarEmBlocos(direita, profundidade + 1)];
    }
  }
  const vao = maiorVao(pedacos.map((p) => { const c = caixa(p); return [c.y0, c.y1]; }));
  if (vao.tamanho >= altura * 0.6) {
    const cima = pedacos.filter((p) => p.y + p.altura / 2 >= vao.posicao);
    const baixo = pedacos.filter((p) => p.y + p.altura / 2 < vao.posicao);
    if (cima.length && baixo.length) {
      return [...cortarEmBlocos(cima, profundidade + 1), ...cortarEmBlocos(baixo, profundidade + 1)];
    }
  }
  return [pedacos];
}

const ENCLISE = /^(?:o|a|os|as|lo|la|los|las|no|na|nos|nas|se|me|te|lhe|lhes|vos)(?![\p{L}])/u;

/** Junta palavra hifenizada na quebra de linha e o que é a mesma frase. */
export function juntarLinhas(linhas) {
  return linhas.reduce((texto, linha) => {
    if (!texto) return linha;
    // "acessá-" + "lo" tem hífen de verdade: é ênclise, não palavra partida.
    if (/\p{L}-$/u.test(texto) && /^\p{Ll}/u.test(linha)) {
      return ENCLISE.test(linha) ? texto + linha : texto.slice(0, -1) + linha;
    }
    return `${texto} ${linha}`;
  }, "");
}

/**
 * Os parágrafos de uma página, em ordem de leitura.
 * @returns {Array<{texto: string, titulo: boolean}>}
 */
export function paragrafosDaPagina(pedacos) {
  const paragrafos = [];
  for (const bloco of cortarEmBlocos(pedacos)) {
    const linhas = emLinhas(bloco);
    let atual = [];
    let anterior = null;
    const fechar = () => {
      if (!atual.length) return;
      const texto = juntarLinhas(atual.map(textoDaLinha)).trim();
      const alturaMax = Math.max(...atual.flatMap((l) => l.pedacos.map((p) => p.altura)));
      if (texto) paragrafos.push({ texto, titulo: alturaMax >= 12 || (texto.length < 60 && texto === texto.toUpperCase() && /\p{Lu}/u.test(texto)) });
      atual = [];
    };
    for (const linha of linhas) {
      if (anterior) {
        const salto = anterior.y - linha.y;
        const novaFonte = Math.abs(anterior.altura - linha.altura) > 1.5;
        // Marcador de lista abre item.
        if (salto > Math.max(anterior.altura, linha.altura) * 1.6 || novaFonte || /^[•◆]/.test(textoDaLinha(linha))) fechar();
      }
      atual.push(linha);
      anterior = linha;
    }
    fechar();
  }
  return paragrafos;
}
