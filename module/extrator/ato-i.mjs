/**
 * Extrai o Ato I do texto do PDF do playtest — no navegador do mestre.
 *
 * É o porte, função por função, de `scripts/ato-i/extrair-aventura.py`, que lê o que o
 * `pdftotext -layout` imprime. Aqui as linhas vêm de `grade.mjs`, que faz a mesma coisa
 * a partir do pdf.js. O layout é regular: título em caixa alta, descrição, um bloco
 * opcional de desafio de acesso e a tabela `Perícia | DT | Informação`. As colunas são
 * fixas o bastante para fatiar por posição — o que evita adivinhar onde a informação
 * começa quando a perícia da linha está vazia (linha que continua a perícia anterior).
 *
 * O PDF é a fonte da verdade do texto, e não é nosso para redistribuir: nada do que
 * sai daqui vai para o pacote. Quem tem o PDF monta a aventura na própria máquina.
 */
import {
  ehMaiusculo, ehMinusculo, ehNumero, titulo, capitalizar, limpo, recuo, juntarHifenizacao, maisPerto,
} from "./texto.mjs";

// O trecho do porão: da lista de pontos até a narração final.
export const INICIO = /^PONTOS DE INTERESSE\s*$/;
export const FIM = /^NARRAÇÃO FINAL\s*$/;

// Os colchetes do "[EVIDÊNCIA-CHAVE]" fazem parte do título no livro — sem eles na
// classe, o Celular e o Computador de Gustavo não eram ponto nenhum.
// O recuo vai longe: numa página de duas colunas, o título da direita começa perto da
// coluna 55. E "“ALTAR” DE MADEIRA" abre com aspa — sem ela, o altar não era ponto.
const TITULO = /^(\s{0,60})([“"]?[A-ZÁÂÃÉÊÍÓÔÕÚÇ][A-ZÁÂÃÉÊÍÓÔÕÚÇ0-9 ,:[\]“”"–'-]{4,50}?)(\s{2,}\(([^)]{4,60})\))?\s*$/;
export const CABECALHO = /^(\s*)Perícia\s+DT\s+Informação\s*$/;
const RUIDO = /^\s*\d{1,3}\s*$|^\s*$/;
// Começo de frase: o que separa um título de ponto de um rótulo de caixa lateral.
const FRASE = /^\s*[A-ZÁÂÃÉÊÍÓÔÕÚÇ“"][a-záâãéêíóôõúçà]/;

// Cabeçalhos de caixa e de quadro do livro. Parecem título (caixa alta, linha própria),
// mas o que vem depois deles é conteúdo de outro ponto.
const NAO_E_TITULO = /^(CONTEÚDO|FERRAMENTAS|NOVAS DESCOBERTAS|A DÍVIDA PRECISA SER PAGA|PONTOS DE INTERESSE|O PORÃO)$/;

// Rótulos das caixas de desafio ao lado do ponto — nunca são títulos.
const DESAFIO_NA_CAIXA = /\(DT\s|\bPA\s|\b(ARROMBAR|DESTRANCAR|ALCANÇAR|HACKEAR|ITEM)\b/;
// Rótulo que abre a caixa lateral. Depois dele, tudo é da caixa até a tabela começar.
const ABRE_CAIXA = /\b(DESAFIO|BLOQUEIO|MECÂNICA DE|DE ACESSO|HACK (TÉCNICO|SOCIAL)|ROLAGEM|SUSTENTAR|RESOLVER O ENIGMA)\b|Requer realizar as duas ações/;

/**
 * Título de ponto de interesse, e não rótulo da caixa de desafio ao lado.
 *
 * As caixas laterais ("DESAFIO / DE ACESSO / PORTA TRANCADA") também são caixa alta.
 * O que as separa é o que vem depois: um título de ponto é seguido da descrição, uma
 * frase em caixa normal; um rótulo de caixa é seguido de outro rótulo.
 */
function ehTitulo(linhas, i) {
  const m = TITULO.exec(linhas[i]);
  if (!m || DESAFIO_NA_CAIXA.test(m[2]) || NAO_E_TITULO.test(m[2].trim())) return false;
  for (const proxima of linhas.slice(i + 1, i + 4)) {
    if (RUIDO.test(proxima)) continue;
    return FRASE.test(proxima);
  }
  return false;
}

/**
 * Reescreve as páginas de duas colunas como texto em uma coluna só.
 *
 * Algumas páginas do porão põem dois assuntos lado a lado — a Sala Secreta à esquerda
 * e a Mesa de Poker, um ponto INTEIRO com quadro próprio, à direita. Lido linha a
 * linha, o ponto da direita não existia e o da esquerda vinha embaralhado.
 *
 * O vão entre as colunas é uma faixa de espaços que atravessa todas as linhas do
 * trecho. Só conta como duas colunas se o vão estiver bem à direita (a partir da
 * coluna mínima) e os dois lados tiverem corpo — senão é a tabela do quadro, cujo vão
 * entre "Perícia" e "DT" fica bem antes disso.
 */
export function linearizarDuasColunas(linhas, colunaMinima = 44, { narracao = false } = {}) {
  const saida = [];
  let i = 0;
  while (i < linhas.length) {
    // Junta o trecho até três linhas em branco seguidas (fim de bloco na página).
    let fim = i, brancas = 0;
    while (fim < linhas.length) {
      if (!linhas[fim].trim()) {
        brancas += 1;
        if (brancas >= 3) break;
      } else brancas = 0;
      fim += 1;
    }

    const bloco = linhas.slice(i, fim);
    const corpo = bloco.filter((l) => l.trim());
    let vao = null;
    if (corpo.length >= 10) {
      const largura = Math.max(...corpo.map((l) => l.length));
      const cheias = corpo.map((l) => l.padEnd(largura));
      let atual = null;
      for (let coluna = colunaMinima; coluna < Math.min(largura, 78); coluna += 1) {
        if (cheias.every((l) => l[coluna] === " ")) {
          atual = atual ? [atual[0], coluna] : [coluna, coluna];
          if (!vao || (atual[1] - atual[0]) > (vao[1] - vao[0])) vao = atual;
        } else atual = null;
      }
      // Quatro colunas em branco, como no Python: com menos, a ponta do corredor entre
      // as duas caixas da maldição (que começa antes da coluna mínima) entrava na
      // conta, o bloco era partido e "FOI PAGA" virava título de ponto.
      if (vao && vao[1] - vao[0] < 3) vao = null;
      if (vao) {
        const corte = vao[0];
        const esquerda = bloco.filter((l) => l.slice(0, corte).trim());
        const direita = bloco.filter((l) => l.length > corte && l.slice(corte).trim());
        if (esquerda.length < 5 || direita.length < 5) vao = null;
      }
    }

    if (vao) {
      saida.push(...emDuasColunas(bloco, vao[0]));
    } else if (narracao && corpo.filter((l) => recuo(l) >= colunaMinima + 10).length >= 5) {
      // Duas colunas sem corredor reto: na página de narração do PDF gratuito a
      // coluna da esquerda alarga no meio da página e o título "TODOS MORREM", em
      // corpo grande, invade o corredor. Cada linha então se parte no seu próprio
      // vão de três espaços; linha só com texto à direita é da coluna da direita.
      // Só nas páginas de narração: no miolo dos pontos, a coluna da esquerda é
      // larga e cruza o corredor sem vão — e o texto dos pôsteres embaralhava.
      saida.push(...porLinha(bloco, colunaMinima));
    } else {
      saida.push(...bloco);
    }
    i = fim;
  }
  return saida;
}

function porLinha(bloco, colunaMinima) {
  const esquerda = [], direita = [];
  for (const l of bloco) {
    if (!l.trim()) { esquerda.push(""); direita.push(""); continue; }
    const vao = [...l.matchAll(/\s{3,}/g)].find((m) => m.index > recuo(l) && m.index + m[0].length >= colunaMinima);
    if (vao) {
      esquerda.push(l.slice(0, vao.index).trimEnd());
      direita.push(l.slice(vao.index + vao[0].length).trimEnd());
    } else if (recuo(l) >= colunaMinima) {
      direita.push(l.trim());
    } else {
      esquerda.push(l.trimEnd());
    }
  }
  return [...esquerda, "", "", ...direita, "", ""];
}

function emDuasColunas(bloco, corte) {
  return [
    ...bloco.filter((l) => l.slice(0, corte).trim()).map((l) => l.slice(0, corte).trimEnd()),
    "", "",
    // A coluna da direita mantém o recuo relativo dela, não o da página.
    ...bloco.filter((l) => l.length > corte && l.slice(corte).trim()).map((l) => l.slice(corte).trimEnd()),
    "", "",
  ];
}

// O roteiro do ato: a narração de abertura, as instruções de como começar e a narração
// final. Fica fora de "PONTOS DE INTERESSE", que é só o miolo da investigação.
const ABERTURA = /^INTRODUÇÃO\s*$/;
const CENA_INICIAL = /^O ÍDOLO DE PEDRA, ATO I\s*$/;
const NARRACAO_FINAL = /^NARRAÇÃO FINAL\s*$/;
const DEPOIS_DO_FIM = /^\s*DEPOIS DO FIM\s*$/;

function indiceDe(linhas, padrao, aPartir = 0) {
  for (let i = aPartir; i < linhas.length; i += 1) if (padrao.test(linhas[i])) return i;
  return -1;
}

function paragrafosLimpos(cru) {
  const texto = cru.filter((l) => l.trim()).map((l) => limpo(l));
  return juntarHifenizacao(texto.filter((t) => !/^[\d\s]{1,6}$/.test(t)).join("\n")).trim();
}

/** Abertura, instruções de início e narração final, na ordem em que o mestre usa. */
export function lerRoteiro(linhas) {
  const bloco = (inicio, fim) => {
    const a = indiceDe(linhas, inicio);
    const b = a < 0 ? -1 : indiceDe(linhas, fim, a + 1);
    if (a < 0 || b < 0) return "";
    return paragrafosLimpos(linearizarDuasColunas(linhas.slice(a + 1, b), 38, { narracao: true }));
  };

  // A introdução do Ato I é a SEGUNDA do PDF (a primeira abre o livro inteiro).
  const inicios = [];
  linhas.forEach((l, i) => { if (ABERTURA.test(l)) inicios.push(i); });
  const iniAto = inicios.length > 1 ? inicios[1] : (inicios[0] ?? 0);
  const resto = linhas.slice(iniAto);
  const blocoRelativo = (inicio, fim, colunaMinima = 38, corteFixo = null) => {
    const a = indiceDe(resto, inicio);
    const b = a < 0 ? -1 : indiceDe(resto, fim, a + 1);
    if (a < 0 || b < 0) return "";
    let bruto = resto.slice(a + 1, b);
    if (corteFixo) {
      // Caixa lateral sem vão perfeito (a dica da trilha na abertura): corta por
      // posição, lendo a página primeiro e a caixa depois.
      const esquerda = bruto.filter((l) => l.slice(0, corteFixo).trim()).map((l) => l.slice(0, corteFixo).trimEnd());
      const direita = bruto.filter((l) => l.length > corteFixo && l.slice(corteFixo).trim()).map((l) => l.slice(corteFixo).trimEnd());
      bruto = [...esquerda, "", "", ...direita];
    }
    // Página de narração: duas colunas mais estreitas que as do miolo.
    return paragrafosLimpos(linearizarDuasColunas(bruto, colunaMinima, { narracao: true }));
  };

  return {
    // Na abertura, a segunda "coluna" é uma caixinha lateral estreita ("use como
    // trilha de fundo a música O Porão") — ela começa bem mais à direita.
    introducao: blocoRelativo(ABERTURA, CENA_INICIAL, 38, 60),
    cenaInicial: blocoRelativo(CENA_INICIAL, INICIO),
    narracaoFinal: bloco(NARRACAO_FINAL, DEPOIS_DO_FIM),
  };
}

export function trechoDoPorao(linhas) {
  const ini = indiceDe(linhas, INICIO);
  const fim = indiceDe(linhas, FIM, ini + 1);
  if (ini < 0 || fim < 0) return [];
  return linearizarDuasColunas(linhas.slice(ini, fim));
}

/** Onde começam DT e Informação, para fatiar as linhas da tabela. */
export function colunas(cabecalho) {
  return [cabecalho.indexOf("DT"), cabecalho.indexOf("Informação")];
}

// Os nomes que a coluna da esquerda pode trazer — é o que separa rótulo de prosa.
const NOMES_DE_PERICIA = new RegExp("(" + [
  "Acrobacia", "Aptidão", "Atletismo", "Crime", "Disciplina", "Enganação", "Furtividade",
  "Intimidar", "Intuição", "Luta", "Máquinas", "Medicina", "Ocultismo", "Percepção",
  "Persuasão", "Pesquisar", "Pontaria", "Sobrevivência", "Tecnologia", "Vigor",
].join("|") + ")", "i");

/**
 * Lê a tabela até ela acabar. Devolve [informações, próximo índice, sobras].
 *
 * Uma linha da tabela ocupa VÁRIAS linhas de texto: o nome da perícia e a DT vêm
 * centralizados verticalmente sobre a informação, que quebra em quantas linhas
 * precisar. As linhas em branco separam um bloco do outro.
 *
 * E a perícia vale para o bloco inteiro em que aparece — inclusive para os blocos
 * ACIMA dela, já que a centralização pode colocá-la no meio.
 */
export function lerTabela(linhas, i, colDt, colInfo) {
  const blocos = [];
  let atual = [], vazias = 0;
  const prosa = [];
  while (i < linhas.length) {
    const linha = linhas[i];
    if (ehTitulo(linhas, i) || CABECALHO.test(linha)) break;

    // A DT encosta na coluna vizinha quando tem dois dígitos ("1|0"): folga de 2. E o
    // corte não parte palavra: um rótulo que termina em cima da coluna da DT
    // ("(apenas Eloísa)") fica inteiro na fatia da perícia, com o parêntese.
    // O número da página, sozinho no pé: não é linha do quadro nem linha em branco.
    // Como texto, entrava na última linha do quadro ("…escrito isso. 43"); como
    // vazia, fechava o quadro no fim da página — e o quadro continua na seguinte.
    // É número de página, e não DT, quando está longe das colunas do quadro — o
    // quadro de um pôster fica na coluna da direita, e a DT dele também tem trinta
    // espaços antes.
    if (/^\s*\d{1,3}\s*$/.test(linha) && (recuo(linha) > colInfo + 5 || recuo(linha) < colDt - 5)) { vazias = 0; i += 1; continue; }
    const corte = corteNaFolga(linha, Math.max(0, colDt - 2));
    const pericia = linha.slice(0, corte).trim();
    const meio = linha.slice(corte, Math.max(corte, colInfo)).trim();
    const info = linha.slice(Math.max(corte, colInfo)).trim();

    if (!pericia && !meio && !info) {
      vazias += 1;
      if (atual.length) { blocos.push(atual); atual = []; }
      if (vazias >= 3) break;          // fim da tabela: o texto de mestre vem depois
      i += 1;
      continue;
    }

    vazias = 0;
    // "6 ou" numa linha e "10" na seguinte: uma DT com alternativa (o Armário de
    // Ferramentas, "DT 6 ou 10"). Sem isso, "6 ou" tinha letra e virava prosa de
    // mestre, e o "10" abria uma linha do quadro só com o fim da frase.
    const ou = /^(\d+)\s+ou$/.exec(meio);
    if (ou) { atual.push([pericia, ou[1], info, linha, "ou", i]); i += 1; continue; }
    // O "10" pode vir duas linhas abaixo, com o resto da frase no meio (v1.1).
    const comOu = atual.slice(-2).find((e) => e[4] === "ou");
    if (ehNumero(meio) && comOu) {
      comOu[4] = Number(meio);
      atual.push([pericia, "", info, linha, undefined, i]);
      i += 1;
      continue;
    }
    // Numa linha de tabela, a coluna do meio só tem a DT. Se ela tem LETRAS, o texto
    // está atravessando as colunas: é prosa de mestre que a coluna estreita empurrou
    // para dentro da tabela (a Mesa de Poker, impressa ao lado da Sala Secreta).
    if (/[A-Za-zÀ-ÿ]/.test(meio)) {
      if (atual.length) { blocos.push(atual); atual = []; }
      prosa.push(linha.trim());
      i += 1;
      continue;
    }

    atual.push([pericia, meio, info, linha, undefined, i]);
    i += 1;
  }
  if (atual.length) blocos.push(atual);

  // Um bloco pode conter MAIS DE UMA linha do quadro: o livro só separa com linha em
  // branco quando muda de perícia. Cada célula de DT é uma linha; o texto sem DT vai
  // para a célula mais próxima (empate fica com a de cima). Bloco sem DT nenhuma não
  // é quadro: é o texto de mestre que vem depois da tabela.
  const infos = [];
  const sobras = prosa.length ? [limpo(prosa.join(" "))] : [];
  let pendente = [];
  for (const bloco of blocos) {
    const indicesDt = bloco.map(([, meio], k) => (ehNumero(meio) ? k : -1)).filter((k) => k >= 0);
    const inteiro = limpo(bloco.map(([, , , crua]) => crua.trim()).join(" "));
    if (!indicesDt.length) {
      // Sem DT e escrito SÓ na coluna de informação: é continuação da linha anterior
      // do quadro. Texto que invade a coluna da perícia é nota de mestre.
      const soInformacao = bloco.every(([pericia, meio]) => !pericia && !meio);
      const textoExtra = bloco.map(([, , info]) => info).filter(Boolean).join(" ").trim();
      if (soInformacao && textoExtra) pendente.push(textoExtra);
      else if (inteiro) sobras.push(inteiro);
      continue;
    }

    // O rótulo da perícia quebra em duas linhas ("Aptidão" / "(Humanas)"). Juntar antes
    // de distribuir: senão cada pedaço ia para uma linha do quadro diferente.
    const rotulos = new Map();
    let inicio = null;
    const prosaNaColuna = [];
    bloco.forEach(([pericia], k) => {
      if (!pericia) return;
      // Em coluna estreita, o texto de mestre invade a coluna da perícia. O que não
      // tem nome de perícia nem é continuação entre parênteses não é rótulo: é prosa.
      const ehRotulo = NOMES_DE_PERICIA.test(pericia);
      const aberto = inicio !== null && conta(rotulos.get(inicio), "(") > conta(rotulos.get(inicio), ")");
      const continuacao = pericia.startsWith("(") || aberto || (inicio !== null && ehMinusculo(pericia));
      if (ehRotulo) {
        inicio = k;
        rotulos.set(k, pericia);
      } else if (continuacao && inicio !== null && pericia.length < 40) {
        rotulos.set(inicio, `${rotulos.get(inicio)} ${pericia}`.trim());
      } else {
        prosaNaColuna.push(pericia);
      }
    });
    if (prosaNaColuna.length) sobras.push(limpo(prosaNaColuna.join(" ")));

    const linhasPorDt = new Map(indicesDt.map((k) => [k, []]));
    const rotulosPorDt = new Map(indicesDt.map((k) => [k, []]));
    const rotuloEmPorDt = new Map();
    bloco.forEach(([, , info], k) => {
      if (info) linhasPorDt.get(maisPerto(indicesDt, k)).push(info);
    });
    for (const [k, rotulo] of rotulos) {
      const alvo = maisPerto(indicesDt, k);
      rotulosPorDt.get(alvo).push(rotulo);
      if (!rotuloEmPorDt.has(alvo)) rotuloEmPorDt.set(alvo, bloco[k][5]);
    }

    for (const k of indicesDt) {
      const texto = linhasPorDt.get(k).join(" ").trim();
      if (!texto) continue;
      infos.push({
        pericia: rotulosPorDt.get(k).join(" ").trim(),
        dt: Number(bloco[k][1]),
        texto: [...pendente, texto].join(" ").trim(),
        ...(typeof bloco[k][4] === "number" ? { dtAlternativa: bloco[k][4] } : {}),
        // Posições no PDF (linha da DT e do rótulo), para decidir abaixo a quem
        // pertence um rótulo impresso entre duas linhas.
        linhaDt: bloco[k][5],
        rotuloEm: rotuloEmPorDt.get(k),
      });
      pendente = [];
    }
  }

  // Linha sem rótulo herda a perícia da linha de cima — a convenção do livro, e o
  // que o pdftotext/Python liam. A exceção é o rótulo impresso LONGE da linha a que
  // foi parar e no meio exato entre ela e a de cima sem rótulo: a Estante de Livros
  // no PDF gratuito, que reflui as colunas e deixa "Máquinas" a três linhas da DT 8
  // e a meio caminho da DT 6 — é o rótulo das duas, como no PDF completo. Rótulo a
  // uma ou duas linhas da sua DT (Molho de Chaves, Altar, Depósito B) é só dela.
  for (let n = 0; n + 1 < infos.length; n += 1) {
    const atual = infos[n], proximo = infos[n + 1];
    if (atual.pericia || !proximo.pericia || proximo.rotuloEm === undefined) continue;
    const j = proximo.rotuloEm;
    if (!(j > atual.linhaDt && j < proximo.linhaDt)) continue;
    const noMeio = Math.abs(j - (atual.linhaDt + proximo.linhaDt) / 2) <= 0.5;
    if (noMeio && proximo.linhaDt - j >= 3) atual.pericia = proximo.pericia;
  }
  for (const info of infos) { delete info.linhaDt; delete info.rotuloEm; }

  // Sobrou parágrafo depois da última linha do quadro: é continuação dela.
  if (pendente.length && infos.length) infos[infos.length - 1].texto = `${infos[infos.length - 1].texto} ${pendente.join(" ")}`.trim();
  else if (pendente.length) sobras.push(...pendente);

  // A etiqueta vale para a própria linha e para as de BAIXO, até a próxima etiqueta.
  // As linhas acima da primeira etiqueta são dela.
  let corrente = "";
  for (const info of infos) {
    if (info.pericia) corrente = info.pericia;
    else if (corrente) info.pericia = corrente;
  }
  const primeira = infos.find((i) => i.pericia)?.pericia ?? "";
  for (const info of infos) {
    if (info.pericia) break;
    info.pericia = primeira;
  }

  return [infos, i, sobras];
}

/**
 * A coluna de corte, empurrada até o próximo espaço quando cai no meio de uma
 * palavra — no máximo três colunas adiante, senão é a DT que estaria sendo engolida.
 */
function corteNaFolga(linha, coluna) {
  if (coluna <= 0 || coluna >= linha.length) return coluna;
  if (linha[coluna] === " " || linha[coluna - 1] === " ") return coluna;
  for (let c = coluna; c < Math.min(linha.length, coluna + 3); c += 1) {
    if (linha[c] === " ") return c;
  }
  return coluna;
}

function conta(texto, caractere) {
  return (texto ?? "").split(caractere).length - 1;
}

// As caixas de desafio ao lado do ponto trazem os números prontos.
const ARROMBAR = /ARROMBAR\s*(?:-\s*DT\s*Acumulada\s*(\d+)|\(DT\s*(\d+),\s*PA\s*(\d+)\))/i;
// Na caixa vem "DESTRANCAR (senha: 3d6, 3 tentativas)"; na prosa, sem os dois pontos.
const DESTRANCAR = /DESTRANCAR\s*\(senha:?\s*(\d+)d(\d+)\s*(?:,\s*(\d+)\s*tentativas)?/i;
const ALCANCAR = /ALCANÇAR\s*\(DT\s*(\d+)\)/i;

// Onde a caixa acaba e a página recomeça.
const FIM_DA_CAIXA = /CONTEÚDO|CONTINUAÇÃO|TESTE/;
const PALAVRA_CHAVE = /\b(ARROMBAR|DESTRANCAR|ALCANÇAR|HACKEAR|SUSTENTAR|RESOLVER|ITEM|Requer)\b/;

// Palavras do rótulo do quadro, não do obstáculo: o que sobra é o nome dele.
const COLA_DA_CAIXA = new Set(["DESAFIO", "BLOQUEIO", "MECÂNICA", "DE", "ACESSO", "HACK", "TÉCNICO",
  "SOCIAL", "ROLAGEM", "EQUAÇÃO", "REQUER", "ITEM"]);

/**
 * O que a caixa chama o obstáculo ("PORTA TRANCADA", "PAINEL CONFUSO").
 *
 * O rótulo mora na coluna da esquerda; a da direita traz a abordagem ou a tabela. Duas
 * colunas separadas por 2+ espaços, então basta ficar com o primeiro pedaço.
 */
function nomeDoObstaculo(linhas) {
  const palavras = [];
  for (const linha of linhas) {
    if (FIM_DA_CAIXA.test(linha)) break;
    // O rótulo mora na margem esquerda da caixa. Linha recuada é continuação da
    // coluna da direita ("• DE LIVROS", do enigma da estante) e não é nome de nada.
    if (recuo(linha) > 20) continue;
    let esquerda = linha.trim().split(/\s{2,}/)[0];
    // Caixa de uma coluna só: a abordagem vem na mesma fatia do rótulo.
    esquerda = esquerda.split(PALAVRA_CHAVE)[0];
    esquerda = esquerda.replace(/[-•\-–]/g, " ");
    if (!esquerda || !ehMaiusculo(esquerda)) continue;
    palavras.push(...esquerda.split(/\s+/).filter((p) => p && !COLA_DA_CAIXA.has(p) && !ehNumero(p)));
  }
  // "(HACK SOCIAL)" no rótulo é a abordagem, que já vira campo — fora do nome.
  let nome = titulo([...new Set(palavras)].join(" "));
  nome = nome.replace(/\(?\s*Hack\s+(Social|Técnico)\s*\)?/i, "").trim();
  return nome.replace(/\b(Do|Da|De|Dos|Das|E)\b/g, (m) => m.toLowerCase());
}

// Tabela do Hack Técnico. Duas formas no livro: faixa → equação (o painel do depósito)
// e faixa → tempo, com uma equação só impressa no cabeçalho (o computador).
const LINHA_DA_TABELA = /(\d+\s*\+|\d+\s*-\s*\d+)\s+(.+?=\s*[\d.,]+)\s*$/;
const LINHA_COM_TEMPO = /(\d+\s*\+|\d+\s*-\s*\d+|\d+\s*ou\s*$|menos)\s*(\d+)s\s*$/;
// "EQUAÇÃO 23*4-25=67" (v1) ou "TEMPO PARA RESOLVER A EQUAÇÃO: 23*4-25=67" (v1.1).
export const EQUACAO_NO_TOPO = /EQUAÇÃO:?\s+(.+?=\s*[\d.,]+)\s*$/;

/**
 * Faixa de rolagem → o que o painel devolve.
 *
 * O painel do depósito devolve uma equação por faixa. O computador devolve TEMPO: a
 * equação é uma só, impressa no alto da caixa, e a faixa diz quantos segundos o
 * jogador tem para resolvê-la.
 */
function lerTabelaDeHack(linhas) {
  let equacaoUnica = "";
  for (const l of linhas) {
    const m = EQUACAO_NO_TOPO.exec(l.trim());
    if (m) { equacaoUnica = m[1].trim(); break; }
  }
  const tabela = [];
  let pendente = null;
  for (const linha of linhas) {
    const crua = linha.trim();
    let m = LINHA_DA_TABELA.exec(crua);
    if (m) {
      tabela.push({ rolagem: m[1].replace(/\s+/g, ""), equacao: limpo(m[2]), segundos: 0 });
      continue;
    }
    // "6 ou / menos    10s": a faixa quebra em duas linhas.
    m = /(\d+)\s*ou\s*$/.exec(crua);
    if (m) { pendente = m[1]; continue; }
    m = /(\d+)s\s*$/.exec(crua);
    if (m && pendente) {
      tabela.push({ rolagem: `1-${pendente}`, equacao: equacaoUnica, segundos: Number(m[1]) });
      pendente = null;
      continue;
    }
    m = LINHA_COM_TEMPO.exec(crua);
    if (m) tabela.push({ rolagem: m[1].replace(/\s+/g, ""), equacao: equacaoUnica, segundos: Number(m[2]) });
  }
  return tabela;
}

// O banco do hack social: pergunta numa linha, resposta na seguinte; ou "rótulo: valor".
const PERGUNTA = /^(.+\?)$/;
const ROTULO_VALOR = /^([A-ZÁÂÃÉÊÍÓÔÕÚÇ][^:]{4,60}):\s+(.+)$/;

/**
 * Perguntas e respostas do hack social, como o livro imprime.
 *
 * Três formas na mesma caixa: pergunta numa linha e resposta na seguinte; "rótulo:
 * valor" na mesma linha; e um cabeçalho que termina em ":" seguido de uma lista solta.
 * O rótulo da caixa fica na coluna da esquerda, então cada linha é lida pelo último pedaço.
 */
function lerBancoDePerguntas(linhas) {
  const banco = [];
  let esperando = null, cabecalho = null;
  for (const linha of linhas) {
    const pedacos = linha.trim().split(/\s{2,}/).filter(Boolean);
    if (!pedacos.length) continue;
    const crua = pedacos[pedacos.length - 1];
    if (ehMaiusculo(crua) || crua.startsWith("(")) continue;
    if (esperando) {
      banco.push({ pergunta: esperando, resposta: crua });
      esperando = null;
      continue;
    }
    const m = ROTULO_VALOR.exec(crua);
    if (PERGUNTA.test(crua)) {
      esperando = crua;
      cabecalho = null;
    } else if (m) {
      banco.push({ pergunta: m[1].trim(), resposta: m[2].trim() });
    } else if (crua.endsWith(":")) {
      cabecalho = crua.replace(/:$/, "").trim();
    } else if (cabecalho && !/respostas?\s+corretas?/i.test(crua)) {
      banco.push({ pergunta: cabecalho, resposta: crua });
    }
  }
  return banco;
}

// Nem todo desafio está em caixa: as correntes de Edgar aparecem no texto de mestre.
const ABERTO_COM = /(?:^|\.)\s*(?:A|As|O|Os)\s+([a-zà-ú]+(?:\s+[a-zà-ú]+){0,2}?)\s+(?:pode|podem)\s+ser\s+(?:aberta|abertas|aberto|abertos)\s+com\b/i;

/** Desafio descrito no meio do texto, em caixa baixa, sem quadro lateral. */
function desafioNaProsa(linhas) {
  const texto = limpo(linhas.map((l) => l.trim()).join(" "));
  const m = ABERTO_COM.exec(texto);
  if (!m) return null;
  const d = lerDesafio([texto]);
  if (!d) return null;
  delete d.observacao;      // na prosa, a "caixa" é o texto do ponto inteiro
  d.rotulo = capitalizar(m[1].trim());
  delete d.item;            // "molho de chaves 1" aqui não vem entre parênteses
  const chave = /molho de chaves\s*(\d)/i.exec(texto);
  if (chave) d.item = `molho de chaves ${chave[1]}`;
  return d;
}

/** O texto corrido dentro da caixa — o que não é rótulo nem abordagem. */
export function prosaDaCaixa(linhas) {
  const partes = [];
  const soAbordagens = /\b(ARROMBAR|DESTRANCAR|ALCANÇAR|HACKEAR|SUSTENTAR|RESOLVER|ITEM)\b/;
  for (const linha of linhas) {
    if (FIM_DA_CAIXA.test(linha)) break;
    // O marcador de lista da fonte de ícones (na grade, "•") não é texto.
    let texto = limpo(linha.replace(/•/g, " "));
    // "Requer realizar as duas ações em sequência" é frase, não rótulo de abordagem.
    texto = soAbordagens.test(texto) ? texto.split(soAbordagens)[0] : texto;
    texto = texto.replace(/^[-–\s]+/, "");
    // Fora o que já virou campo: pergunta do banco, senha impressa, equação.
    if (texto.endsWith("?") || LINHA_DA_TABELA.test(texto)
        || /senha\s+\d|=\s*\d|respostas?\s+corretas?/i.test(texto)
        || ROTULO_VALOR.test(texto)) continue;
    if (texto.length > 25 && !ehMaiusculo(texto)) partes.push(texto);
  }

  let frase = limpo(partes.join(" "));
  // Os rótulos do quadro se infiltram no meio da frase, porque são impressos na coluna
  // da esquerda, na mesma linha.
  frase = frase.replace(/\b(DESAFIO DE|DESAFIO|BLOQUEIO|DE ACESSO|MECÂNICA DE|ROLAGEM|EQUAÇÃO|HACK TÉCNICO|HACK SOCIAL)\b/g, "");
  frase = frase.replace(/\(\s*\)|\([^)]{0,4}$/g, "");      // sobra de parêntese cortado
  frase = frase.replace(/\s{2,}/g, " ").replace(/^[ .,:;]+|[ .,:;]+$/g, "");
  return frase.length > 30 ? frase : "";
}

/** Lê a caixa de desafio de acesso que vem antes da tabela do ponto. */
export function lerDesafio(linhas) {
  const texto = linhas.join(" ");
  const d = {};
  let m = ARROMBAR.exec(texto);
  if (m) {
    const [, acumulada, dt, pa] = m;
    // "DT Acumulada 12" diz só quanto somar: o teste em si fica na DT padrão.
    d.arrombar = acumulada ? { dt: 7, pa: Number(acumulada) } : { dt: Number(dt), pa: Number(pa) };
  }
  m = DESTRANCAR.exec(texto);
  if (m) d.destrancar = { tamanho: Number(m[1]), faces: Number(m[2]), tentativas: m[3] ? Number(m[3]) : 0 };
  m = ALCANCAR.exec(texto);
  if (m) d.alcancar = { dt: Number(m[1]) };
  if (/HACK\s+TÉCNICO/i.test(texto)) d.hackTecnico = { tabela: lerTabelaDeHack(linhas) };
  if (/HACK\s+SOCIAL/i.test(texto)) {
    const respostas = /(\d+)\s+respostas?\s+corretas?/i.exec(texto);
    d.hackSocial = {
      respostasNecessarias: respostas ? Number(respostas[1]) : 3,
      perguntas: lerBancoDePerguntas(linhas),
    };
  }
  // A estante: enigma + Sustentar, uma pessoa por rodada.
  m = /SUSTENTAR\s*\(DT\s*(\d+)\)/i.exec(texto);
  if (m) d.sustentar = { dt: Number(m[1]) };
  // A porta de saída não tem minigame: a senha está impressa no livro.
  m = /Senha\s+(\d{4,8})\s*(\([^)]*\))?/.exec(texto);
  if (m) {
    d.senhaFixa = m[1];
    d.senhaNota = (m[2] ?? "").replace(/^\(|\)$/g, "");
  }
  if (Object.keys(d).length) {
    d.rotulo = nomeDoObstaculo(linhas);
    // A caixa também explica coisas que mudam a mesa. Sem isso, a regra sumia junto
    // com o quadro lateral.
    d.observacao = "hackSocial" in d ? "" : prosaDaCaixa(linhas);
    // "ITEM (molho de chaves 1)": a chave que dispensa o desafio.
    m = /ITEM\s*\(([^)]+)\)/i.exec(texto);
    if (m) d.item = limpo(m[1]);
  }
  return Object.keys(d).length ? d : null;
}

// "A DÍVIDA PRECISA SER PAGA": o que acontece no começo de cada rodada da cena.
const INICIO_MALDICAO = /^\s*A DÍVIDA PRECISA SER PAGA\s*$/;
const FIM_MALDICAO = /^\s*(FERRAMENTAS|PONTOS DE INTERESSE)\s*$/;
const LINHA_DE_RODADA = /^\s{0,12}(\d{1,2})(?:\s+em)?\s*$/;
const INICIO_REGRAS = /A Maldição do Ídolo de Pedra é uma mecânica especial/;
const CAIXA_LATERAL = /^(A DÍVIDA|ÍDOLO QUEBRADO)/;

/**
 * O que vem antes da tabela: a narração de ativação, o teste e as duas caixas.
 *
 * As caixas "A DÍVIDA FOI PAGA" e "ÍDOLO QUEBRADO" são impressas lado a lado, com a
 * segunda começando na coluna 41 — daí o corte por posição.
 */
export function lerRegrasDaMaldicao(linhas) {
  const ini = indiceDe(linhas, INICIO_REGRAS);
  const fim = ini < 0 ? -1 : indiceDe(linhas, INICIO_MALDICAO, ini + 1);
  if (ini < 0 || fim < 0) return {};

  const bloco = linhas.slice(ini, fim);
  const texto = limpo(bloco.map((l) => l.trim()).join(" "));
  const falas = [...texto.matchAll(/[“"]?(Ao observarem o Ídolo.+?chamado\.)/g)].map((m) => m[1]);
  const ativacao = /(Ao terminar a narração.+?)(?=A partir disso|$)/.exec(texto);

  const esquerda = [], direita = [];
  let dentro = false;
  for (const linha of bloco) {
    if (CAIXA_LATERAL.test(linha.trim())) dentro = true;
    if (!dentro) continue;
    esquerda.push(linha.slice(0, 41).trim());
    direita.push(linha.slice(41).trim());
  }

  const limpar = (partes) => {
    let t = limpo(partes.filter(Boolean).join(" "));
    // Coluna estreita quebra palavra no meio: "ape- nas" volta a ser "apenas".
    t = t.replace(/(\p{L})-\s+(\p{L})/gu, "$1$2");
    // O título da caixa vem em caixa alta na primeira linha; ele já é o `titulo`.
    return t.replace(/^[A-ZÁÂÃÉÊÍÓÔÕÚÇ ]{4,40}\s+(?=[A-ZÁ][a-zà-ú])/, "").trim();
  };
  return {
    narracao: falas.map((f) => f.trim()).join(" "),
    ativacao: ativacao ? ativacao[1].trim() : "",
    caixas: [
      { titulo: "A Dívida Foi Paga", texto: limpar(esquerda) },
      { titulo: "Ídolo Quebrado", texto: limpar(direita) },
    ].filter((c) => c.texto),
  };
}

/**
 * A tabela da maldição: rodada → narração para ler + efeito de regra.
 *
 * Mesma geometria do quadro dos pontos: o número da rodada é centralizado
 * VERTICALMENTE sobre o bloco. Blocos são separados por linha em branco, e rodada
 * sem texto (a maioria) não vira evento.
 */
export function lerMaldicao(linhas) {
  const ini = indiceDe(linhas, INICIO_MALDICAO);
  if (ini < 0) return [];

  const blocos = [];
  let atual = [];
  for (const linha of linhas.slice(ini + 1)) {
    if (FIM_MALDICAO.test(linha)) break;
    if (!linha.trim()) {
      if (atual.length) { blocos.push(atual); atual = []; }
      continue;
    }
    if (linha.trim().startsWith("Rodada")) continue;
    atual.push(linha);
  }
  if (atual.length) blocos.push(atual);

  const eventos = [];
  for (const bloco of blocos) {
    let rodada = null;
    const partes = [];
    for (const linha of bloco) {
      let resto = linha;
      let m = LINHA_DE_RODADA.exec(linha);
      if (m) { rodada = Number(m[1]); continue; }
      // O número pode dividir a linha com o texto ("  4       marcada. A dívida…").
      m = /^\s{0,12}(\d{1,2})(?:\s+em)?\s{2,}(.+)$/.exec(linha);
      if (m) { rodada = Number(m[1]); resto = m[2]; }
      const texto = limpo(resto);
      if (texto) partes.push(texto);
    }
    if (rodada === null || !partes.length) continue;
    // O que está entre aspas é o que o mestre lê em voz alta; o resto é regra.
    const inteiro = partes.join(" ");
    const falas = [...inteiro.matchAll(/[“"]([^”"]+)[”"]/g)].map((m) => m[1]);
    const efeito = inteiro.replace(/[“"][^”"]+[”"]/g, " ");
    eventos.push({ rodada, narracao: falas.map((f) => f.trim()).join(" ").trim(), efeito: limpo(efeito) });
  }
  return eventos;
}

// Itens que o livro descreve no meio da prosa: a faca de churrasco (arma) e os dois
// molhos de chaves, que dispensam desafios.
const ITEM_NA_PROSA = /^([A-ZÁÂÃÉÊÍÓÔÕÚÇ][A-ZÁÂÃÉÊÍÓÔÕÚÇ ]{4,40}):\s+(.+)$/;
const ENIGMA_DA_ESTANTE = /^PRATELEIRA\s+(\d)\s*[-–]\s*(.+)$/;

/**
 * Um bloco de duas colunas lido linha a linha embaralha as duas. O vão entre as
 * colunas é uma faixa de espaços que atravessa TODAS as linhas do bloco — achar essa
 * faixa é o que diz onde cortar.
 */
function desempilharColunas(cruas) {
  // O número do ponto no mapa é impresso na margem direita da linha.
  const linhas = cruas.filter((l) => l.trim()).map((l) => l.trimEnd().replace(/\s{3,}\d{1,2}\s*$/, ""));
  const simples = () => linhas.map((l) => limpo(l));
  if (linhas.length < 5) return simples();

  const largura = Math.max(...linhas.map((l) => l.length));
  const cheias = linhas.map((l) => l.padEnd(largura));
  let vao = null, atual = null;
  for (let coluna = 20; coluna < Math.min(largura, 80); coluna += 1) {
    if (cheias.every((l) => l[coluna] === " ")) {
      atual = atual ? [atual[0], coluna] : [coluna, coluna];
      if (!vao || (atual[1] - atual[0]) > (vao[1] - vao[0])) vao = atual;
    } else atual = null;
  }
  if (!vao || vao[1] - vao[0] < 4) return simples();

  const corte = vao[0];
  const esquerda = cheias.map((l) => l.slice(0, corte).trim()).filter(Boolean);
  const direita = cheias.map((l) => l.slice(corte).trim()).filter(Boolean);
  // Duas colunas de verdade têm as duas com corpo; senão é texto de uma coluna só.
  if (esquerda.length < 3 || direita.length < 3) return simples();
  return [limpo(esquerda.join(" ")), limpo(direita.join(" "))];
}

const PRATELEIRA = /^\s*PRATELEIRA\s+(\d)\s*$/;

/**
 * A lista completa dos livros de cada prateleira, para o mestre ler em voz alta.
 *
 * Cada livro pode ocupar duas linhas (o autor desce), e a continuação vem mais
 * recuada que o item.
 */
function lerPrateleiras(linhas) {
  const prateleiras = [];
  let atual = null, item = null;
  for (const linha of linhas) {
    const m = PRATELEIRA.exec(linha);
    if (m) {
      atual = { prateleira: Number(m[1]), livros: [] };
      prateleiras.push(atual);
      item = null;
      continue;
    }
    if (atual === null) continue;
    // O marcador de lista do PDF é um glifo de fonte de ícones (área privativa) ou
    // um byte solto de controle; fora os dois.
    const texto = limpo(linha.replace(/[--•]/g, " "));
    const r = recuo(linha);
    if (!texto) continue;
    // Título novo começa mais à esquerda; a linha mais recuada continua o anterior.
    if (item !== null && r > item.recuo) {
      item.texto += ` ${texto}`;
      continue;
    }
    // A prateleira 5 é a última: a lista acaba quando a página vira.
    if (prateleiras.length === 5 && (ehMaiusculo(texto) || CABECALHO.test(linha)
        || /^\d{1,3}$/.test(texto) || atual.livros.length >= 4)) break;
    item = { texto, recuo: r };
    atual.livros.push(item);
  }
  return prateleiras
    .filter((p) => p.livros.length)
    .map((p) => ({ prateleira: p.prateleira, livros: p.livros.map((l) => limpo(l.texto)) }));
}

/** Itens descritos no texto e o enigma da estante (qual livro puxar). */
export function lerItens(linhas, nomesDePontos = []) {
  const pontos = new Set(nomesDePontos.map((n) => n.toUpperCase()));
  const itens = [], livros = [];
  linhas.forEach((linha, i) => {
    const texto = limpo(linha);
    let m = ENIGMA_DA_ESTANTE.exec(texto);
    if (m) { livros.push({ prateleira: Number(m[1]), livro: m[2].trim() }); return; }
    m = ITEM_NA_PROSA.exec(texto);
    if (!m) return;
    const nome = m[1].trim().toUpperCase();
    if ([...pontos].some((n) => n.includes(nome) || n.startsWith(nome))) return;
    const corpo = [m[2]];
    for (const proxima of linhas.slice(i + 1, i + 4)) {
      const seguinte = limpo(proxima);
      if (!seguinte || ehMaiusculo(seguinte) || ITEM_NA_PROSA.test(seguinte)) break;
      corpo.push(seguinte);
    }
    const descricao = corpo.join(" ").trim();
    itens.push({ nome: titulo(m[1]), descricao: descricao[0].toUpperCase() + descricao.slice(1) });
  });
  // Os molhos de chaves: o livro lista o que cada um abre logo depois de "As chaves
  // abrem:", uma fechadura por linha, com o número do molho na frase anterior.
  linhas.forEach((linha, i) => {
    if (!linha.includes("As chaves abrem")) return;
    const contexto = linhas.slice(Math.max(0, i - 3), i + 1).map((l) => l.trim()).join(" ");
    const m = /molho de chaves\s*(\d)/.exec(contexto);
    if (!m) return;
    const abre = [];
    for (const proxima of linhas.slice(i + 1, i + 9)) {
      const seguinte = limpo(proxima.replace(/[-•]/g, " "));
      if (!seguinte) continue;
      if (ehMaiusculo(seguinte) || seguinte.endsWith(":") || seguinte.length > 60) break;
      if (/^\d{1,3}$/.test(seguinte)) continue;     // número de página na margem
      abre.push(seguinte.trim());
    }
    const nome = `Molho de Chaves ${m[1]}`;
    if (abre.length && !itens.some((it) => it.nome === nome)) {
      itens.push({ nome, descricao: `Abre: ${abre.join("; ")}.` });
    }
  });
  return { itens, enigmaDaEstante: livros, prateleiras: lerPrateleiras(linhas) };
}

/** Os pontos de interesse do porão, com quadro, caixa de desafio, notas e handouts. */
export function extrairPontos(linhas) {
  const pontos = [];
  let atual = null;
  let i = 0;
  while (i < linhas.length) {
    const linha = linhas[i];
    const cab = CABECALHO.test(linha);
    if (cab && atual !== null) {
      const [colDt, colInfo] = colunas(linha);
      const [novas, fim, sobras] = lerTabela(linhas, i + 1, colDt, colInfo);
      atual.informacoes.push(...novas);
      atual.notas.push(...sobras);
      atual.bruto.push(...linhas.slice(i, fim));
      i = fim;
      continue;
    }

    if (atual !== null) atual.bruto.push(linha);

    // A seção da maldição vem logo depois do Ídolo de Pedra e não é nota dele.
    if (atual !== null && (INICIO_REGRAS.test(linha) || INICIO_MALDICAO.test(linha))) {
      atual = null;
      i += 1;
      continue;
    }

    if (ehTitulo(linhas, i)) {
      const m = TITULO.exec(linha);
      const nome = m[2].trim(), condicao = (m[4] ?? "").trim();
      // "PONTO (CONTINUAÇÃO)" é a mesma tabela virando a página.
      if (nome.toUpperCase().includes("CONTINUAÇÃO") && atual) { i += 1; continue; }
      atual = {
        nome, condicao, descricao: [], informacoes: [], caixa: [], bruto: [], conteudo: [], notas: [],
        descricaoCruas: [], recuo: m[1].length, depoisDaCaixa: false, naCaixa: false, noConteudo: false,
      };
      pontos.push(atual);
    } else if (atual !== null && !RUIDO.test(linha) && atual.informacoes.length) {
      // Depois do quadro vem o texto de mestre do ponto.
      atual.notas.push(linha.trim());
    } else if (atual !== null && !RUIDO.test(linha) && !atual.informacoes.length) {
      const texto = linha.trim();
      const r = recuo(linha);
      // "CONTEÚDO" abre o que o mestre lê ao vencer o desafio.
      if (texto === "CONTEÚDO") {
        atual.noConteudo = true; atual.naCaixa = false;
        i += 1;
        continue;
      }
      if (atual.noConteudo) { atual.conteudo.push(texto); i += 1; continue; }
      // A coluna da direita da caixa às vezes é impressa ANTES do rótulo.
      if (ABRE_CAIXA.test(texto) || DESAFIO_NA_CAIXA.test(texto)) {
        atual.naCaixa = true;
      } else if (atual.naCaixa && Math.abs(r - atual.recuo) <= 4 && texto.length > 60 && ehMaiusculo(texto[0])
          && !/\S\s{2,}\S/.test(texto)) {
        // Linha longa alinhada com o TÍTULO: a caixa acabou e o texto do ponto voltou.
        // Linha em duas colunas ("SENHA DO CELULAR      Datas importantes…") é caixa
        // ainda, por mais alinhada que esteja — na grade do pdf.js ela cabia na folga.
        atual.naCaixa = false;
        atual.depoisDaCaixa = true;
      } else if (r >= atual.recuo + 20 && atual.descricao.length) {
        // Recuo MUITO maior que o do título é coluna da direita de caixa.
        atual.caixa.push(linha.trimEnd());
        i += 1;
        continue;
      }
      if (atual.naCaixa || ehMaiusculo(texto)) {
        // Guarda a linha COM o recuo: é ele que diz qual coluna da caixa é qual.
        atual.caixa.push(linha.trimEnd());
      } else if (atual.depoisDaCaixa) {
        // Ponto sem quadro (o duto): o que vem depois da caixa já é texto de mestre.
        atual.notas.push(texto);
      } else {
        atual.descricao.push(texto);
        atual.descricaoCruas.push(linha.trimEnd());
      }
    }
    i += 1;
  }

  for (const p of pontos) {
    let texto = desempilharColunas(p.descricaoCruas).join(" ");
    // O número do ponto no mapa é impresso na margem e cai no meio da frase.
    texto = texto.replace(/\s{3,}\d{1,2}\s+/g, " ").replace(/\s+\d{1,2}\s*$/, "");
    p.descricao = limpo(texto);
    delete p.recuo; delete p.depoisDaCaixa; delete p.naCaixa; delete p.noConteudo; delete p.descricaoCruas;
    // O conteúdo revelado é texto de mestre, não descrição do que se vê.
    const notas = p.notas.join(" ").replace(/\s{3,}\d{1,3}\s+/g, " ");
    p.notas = limpo(notas);
    p.conteudo = limpo(p.conteudo.join(" ").replace(/\s+\d{1,3}\s*$/, ""));
    const caixa = p.caixa; delete p.caixa;
    p.desafio = lerDesafio(caixa);
    // Sem caixa, o desafio ainda pode estar no texto.
    if (!p.desafio) p.desafio = desafioNaProsa(p.bruto);
    delete p.bruto;
    // Pelo texto já montado, não pelas linhas cruas: na grade, "HANDOUT" no fim de
    // uma linha e "14 FOTO…" na seguinte tinham a DT "6" no meio, e o número saía 6.
    const fontes = [p.descricao, ...p.informacoes.map((i) => `${i.pericia} ${i.texto}`), p.notas, p.conteudo,
      p.desafio ? JSON.stringify(p.desafio) : ""].join(" ");
    p.handouts = [...new Set([...fontes.matchAll(/HANDOUTS?\s*(\d+)/gi)].map((m) => Number(m[1])))].sort((a, b) => a - b);
  }
  // Ponto sem tabela ainda é ponto. O que não vale é o cabeçalho de seção.
  return pontos.filter((p) => p.informacoes.length || p.descricao);
}

// Nomes do PDF → chaves do sistema.
const PERICIAS = {
  "percepção": "percepcao", "pesquisar": "pesquisar", "intuição": "intuicao",
  "máquinas": "maquinas", "tecnologia": "tecnologia", "sobrevivência": "sobrevivencia",
  "medicina": "medicina", "ocultismo": "ocultismo", "atletismo": "atletismo",
  "acrobacia": "acrobacia", "crime": "crime", "disciplina": "disciplina",
  "enganação": "enganacao", "furtividade": "furtividade", "intimidar": "intimidar",
  "luta": "luta", "persuasão": "persuasao", "pontaria": "pontaria", "vigor": "vigor",
};

/** Fica só com a perícia (e a condição entre parênteses) dentro do rótulo lido. */
function limparRotulo(rotulo) {
  const texto = limpo(rotulo);
  const nomes = Object.keys(PERICIAS).sort((a, b) => b.length - a.length);
  const m = new RegExp(`(${nomes.join("|")})`, "i").exec(texto);
  if (!m) return texto;
  const inicio = m.index, fimNome = m.index + m[0].length;
  const resto = texto.slice(fimNome);
  // Mantém o que completa o rótulo: "(Humanas)", "ou Sobrevivência", "(apenas Victor)".
  const cauda = /^(\s*\([^)]*\)|\s+ou\s+\S+)+/.exec(resto);
  return (texto.slice(inicio, fimNome) + (cauda ? cauda[0] : "")).trim();
}

/** Devolve [chave, condição]. "Aptidão (Humanas)" vira aptidao.humanas. */
export function chaveDePericia(rotulo) {
  let texto = limparRotulo(rotulo);
  let condicao = "";
  const m = /^([^(]+?)\s*\(([^)]+)\)\s*$/.exec(texto);
  if (m) {
    const base = m[1].trim(), dentro = m[2].trim();
    if (base.toLowerCase().startsWith("aptidão")) {
      return [`aptidao.${dentro.toLowerCase().replace(/á/g, "a").replace(/ó/g, "o")}`, ""];
    }
    texto = base; condicao = dentro;
  }
  // "Medicina ou Sobrevivência": o sistema testa uma perícia por linha.
  if (texto.toLowerCase().includes(" ou ")) {
    const [primeira, ...resto] = texto.split(/\s+ou\s+/);
    condicao = `ou ${resto.join(" ou ")}` + (condicao ? `; ${condicao}` : "");
    texto = primeira;
  }
  return [PERICIAS[texto.trim().toLowerCase()] ?? "", condicao];
}

/**
 * Tudo do Ato I, no formato que `scripts/ato-i/gerar-aventura.mjs` consome:
 * `{ pontos, maldicao, itens, roteiro }` — os quatro arquivos que o Python escrevia.
 */
export function extrairAtoI(linhasDoPdf) {
  const porao = trechoDoPorao(linhasDoPdf);
  const pontos = extrairPontos(porao);
  for (const ponto of pontos) {
    for (const info of ponto.informacoes) [info.chave, info.condicao] = chaveDePericia(info.pericia);
  }
  return {
    pontos,
    maldicao: { regras: lerRegrasDaMaldicao(porao), eventos: lerMaldicao(porao) },
    itens: lerItens(porao, pontos.map((p) => p.nome)),
    roteiro: lerRoteiro(linhasDoPdf),
  };
}
