/**
 * Extrai as missões do playtest beta das páginas do PDF do mestre (beta §1).
 *
 * O que o sistema sabe de antemão, e vem em `PONTOS`, é só a lista de pontos de cada missão:
 * são os títulos que ela procura. Perícia, DT e o texto de cada linha saem do PDF, na hora,
 * pela geometria da página: o quadro usa uma fonte própria e colunas fixas.
 */
import { emLinhas, textoDaLinha, juntarLinhas, paragrafosDaPagina } from "./paginas.mjs";
import { chaveDePericia } from "./ato-i.mjs";

/** Os pontos de interesse, na ordem do livro. `numero` é o que o mapa imprime. */
export const PONTOS = {
  "missao-1": [
    { numero: "01", nome: "ARBUSTO" }, { numero: "02", nome: "ÁRVORE" }, { numero: "03", nome: "CARROÇA" },
    { numero: "04", nome: "PILHA DE PEDRAS" }, { numero: "4.1", nome: "ESQUELETO" }, { numero: "4.2", nome: "TOCHA" },
  ],
  "missao-2": [
    { numero: "01", nome: "ALTAR DAS VINHAS" }, { numero: "02", nome: "BURACO DAS RAÍZES" },
    { numero: "03", nome: "PILHA DE CINZAS" }, { numero: "04", nome: "PLATAFORMA ELEVADA" },
    { numero: "4.1", nome: "BAÚ ROMANO" }, { numero: "4.2", nome: "NICHO DA NÉVOA" },
    { numero: "05", nome: "ESCADARIA NATURAL" }, { numero: "5.1", nome: "INSCRIÇÃO ANTIGA" },
    { numero: "5.2", nome: "POTES DE ARGILA" }, { numero: "06", nome: "MONÓLITO PESADO" },
  ],
};

/** Quantas linhas de quadro a revisão 1.0 tem: revisão nova com outro número pede conferência. */
const LINHAS_DO_LIVRO = { "missao-1": 16, "missao-2": 24 };

/** Onde cada missão começa e termina, pelo que o livro imprime na página. */
const LIMITES = {
  "missao-1": { inicio: /primeira missão do/i, fim: /segunda missão do/i },
  "missao-2": { inicio: /segunda missão do/i, fim: null },
};

const textoDaPagina = (pagina) => emLinhas(pagina.pedacos).map(textoDaLinha).join(" ");

/** As páginas de uma missão, ou [] se o PDF não traz (o gratuito só tem a primeira). */
export function paginasDaMissao(paginas, missao) {
  const { inicio, fim } = LIMITES[missao];
  // A carta e o sumário citam as missões; a abertura delas é que tem a frase inteira.
  const i = paginas.findIndex((p) => inicio.test(textoDaPagina(p)));
  if (i < 0) return [];
  const f = fim ? paginas.findIndex((p, k) => k > i && fim.test(textoDaPagina(p))) : -1;
  return paginas.slice(i, f < 0 ? undefined : f);
}

/** A fonte do quadro: é o corpo pequeno, o mais comum entre os menores da página. */
function fonteDoQuadro(pedacos) {
  const contagem = new Map();
  for (const p of pedacos) {
    if (p.altura >= 8.6) continue;
    contagem.set(p.fonte, (contagem.get(p.fonte) ?? 0) + 1);
  }
  return [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

const ehCabecalho = (p) => ["Perícia", "DT", "Informação"].includes(p.texto.trim());

/**
 * O quadro de uma região da página.
 * @returns {{linhas: object[], topo: number, fundo: number}|null}
 */
function lerQuadro(pedacos, avisos = []) {
  const fonte = fonteDoQuadro(pedacos);
  const celulas = pedacos.filter((p) => p.fonte === fonte && !ehCabecalho(p));
  if (!celulas.length) return null;
  const colInfo = Math.min(...celulas.map((p) => p.x));
  const fundoCelulas = Math.min(...celulas.map((p) => p.y));
  const topoCelulas = Math.max(...celulas.map((p) => p.y));
  // Negrito dentro da célula vem em outra fonte, na mesma coluna e na mesma faixa.
  const info = pedacos.filter((p) => !ehCabecalho(p) && p.x >= colInfo - 1 && p.y >= fundoCelulas - 2 && p.y <= topoCelulas + 2);
  const dts = pedacos.filter((p) => /^\d{1,2}$/.test(p.texto.trim()) && p.x < colInfo - 2 && p.x > colInfo - 45
    && p.y >= fundoCelulas - 12 && p.y <= topoCelulas + 12).sort((a, b) => b.y - a.y);
  if (!dts.length) return null;

  const linhasInfo = emLinhas(info);
  // A fronteira entre duas linhas do quadro é o maior vão entre os textos das duas DTs: a
  // DT fica centrada na célula, e as células têm alturas diferentes.
  const cortes = [];
  for (let k = 0; k < dts.length - 1; k += 1) {
    const entre = linhasInfo.filter((l) => l.y <= dts[k].y + 8 && l.y >= dts[k + 1].y - 8);
    let melhor = { vao: -1, y: (dts[k].y + dts[k + 1].y) / 2 };
    for (let m = 0; m < entre.length - 1; m += 1) {
      const vao = entre[m].y - entre[m + 1].y;
      const y = (entre[m].y + entre[m + 1].y) / 2;
      if (y < dts[k].y && y > dts[k + 1].y && vao > melhor.vao) melhor = { vao, y };
    }
    cortes.push(melhor.y);
  }
  const faixa = (k) => ({ topo: k === 0 ? Infinity : cortes[k - 1], fundo: k === dts.length - 1 ? -Infinity : cortes[k] });

  // Rótulos da perícia: à esquerda da DT. Célula mesclada fica centrada nas linhas que cobre.
  const colDt = Math.min(...dts.map((d) => d.x));
  const naColuna = (p) => !ehCabecalho(p) && p.x + p.largura <= colDt + 2 && p.altura < 11;
  // Abaixo do quadro pode haver texto curto na mesma coluna: só vale a fonte dos rótulos.
  const fontes = new Map();
  for (const p of pedacos.filter((q) => naColuna(q) && q.y >= fundoCelulas - 14 && q.y <= topoCelulas + 26)) {
    fontes.set(p.fonte, (fontes.get(p.fonte) ?? 0) + 1);
  }
  const fonteRotulo = [...fontes.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
  const rotulos = pedacos.filter((p) => naColuna(p) && p.fonte === fonteRotulo
    && p.y >= fundoCelulas - 30 && p.y <= topoCelulas + 26);
  const blocos = [];
  for (const l of emLinhas(rotulos)) {
    const ultimo = blocos.at(-1);
    const anterior = ultimo ? textoDaLinha(ultimo.linhas.at(-1)) : "";
    // Rótulo novo começa em maiúscula; "(caso não…" e "Sobrevivência" depois de "ou" continuam.
    const continua = ultimo && (!/^\p{Lu}/u.test(textoDaLinha(l)) || /\sou$/.test(anterior));
    if (continua) ultimo.linhas.push(l);
    else blocos.push({ linhas: [l] });
  }
  for (const b of blocos) {
    b.y = (b.linhas[0].y + b.linhas.at(-1).y) / 2;
    b.texto = juntarLinhas(b.linhas.map(textoDaLinha));
  }

  const linhas = dts.map((dt, k) => {
    const { topo, fundo } = faixa(k);
    const dela = linhasInfo.filter((l) => l.y < topo && l.y > fundo);
    return {
      dt: Number(dt.texto), texto: juntarLinhas(dela.map(textoDaLinha)),
      topo: dela[0]?.y ?? dt.y, fundo: dela.at(-1)?.y ?? dt.y,
    };
  });
  const donos = repartirRotulos(blocos, linhas, avisos);
  linhas.forEach((linha, k) => { linha.rotulo = donos[k]?.texto ?? ""; });
  return { linhas, topo: Math.max(topoCelulas, ...dts.map((d) => d.y)) + 12, fundo: Math.min(fundoCelulas, ...dts.map((d) => d.y)) - 4 };
}

/**
 * Célula mesclada fica centrada nas linhas que cobre. Reparte as linhas em grupos contíguos,
 * um por rótulo, deixando cada rótulo o mais perto possível do centro do seu grupo: olhar
 * linha a linha errava quando as células tinham alturas muito diferentes.
 * @returns {object[]} o bloco de cada linha
 */
function repartirRotulos(blocos, linhas, avisos = []) {
  if (!blocos.length) return [];
  const centro = (de, ate) => (linhas[de].topo + linhas[ate].fundo) / 2;
  const memo = new Map();
  const melhor = (b, l) => {
    if (b === blocos.length) return l === linhas.length ? { custo: 0, cortes: [] } : null;
    const chave = `${b}:${l}`;
    if (memo.has(chave)) return memo.get(chave);
    let resposta = null;
    // Cada bloco leva ao menos uma linha, e deixa ao menos uma para cada bloco seguinte.
    for (let ate = l; ate <= linhas.length - (blocos.length - b); ate += 1) {
      const resto = melhor(b + 1, ate + 1);
      if (!resto) continue;
      const custo = Math.abs(blocos[b].y - centro(l, ate)) + resto.custo;
      if (!resposta || custo < resposta.custo) resposta = { custo, cortes: [ate, ...resto.cortes] };
    }
    memo.set(chave, resposta);
    return resposta;
  };
  const r = melhor(0, 0);
  if (!r) {
    // Mais rótulos que linhas: o layout mudou. Melhor uma perícia errada avisada que quadro vazio.
    avisos.push(`Rótulos do quadro sem repartição; confira as perícias de "${blocos.map((b) => b.texto ?? "").join(" / ")}"`);
    return linhas.map(() => blocos[0]);
  }
  const donos = [];
  let inicio = 0;
  r.cortes.forEach((ate, b) => { for (let k = inicio; k <= ate; k += 1) donos[k] = blocos[b]; inicio = ate + 1; });
  return donos;
}

/**
 * "Aptidão (artes) (apenas se alguém tiver encontrado o mapa)" →
 * a chave e a condição. Rótulo com alternativa ("Acrobacia ou Sobrevivência") vira as duas.
 * @returns {{pericia: string, alternativa: string, condicao: string, rotulo: string, chaveConhecida: boolean}}
 */
export function lerRotulo(rotulo) {
  const limpo = String(rotulo).trim();
  const condicao = /\((apenas [^)]*|caso [^)]*)\)/i.exec(limpo)?.[1] ?? "";
  const semCondicao = limpo.replace(/\((apenas [^)]*|caso [^)]*)\)/i, "").trim();
  const [primeira, segunda] = semCondicao.split(/\s+ou\s+/i);
  const chave = (t) => {
    const n = t.trim();
    if (/^of[ií]cio/i.test(n)) return "oficio";
    if (/^bruxaria/i.test(n)) return "ocultismo";
    if (/^inspecionar/i.test(n)) return "pesquisar";
    const apt = /^apt[ií]d[aã]o\s*\(([^)]*)\)/i.exec(n);
    if (apt) {
      const sub = apt[1].split(/\s+ou\s+/i)[0].trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      return `aptidao.${sub}`;
    }
    return chaveDePericia(n)[0] ?? null;
  };
  // "Aptidão (artes ou folclore)": o "ou" está dentro do parêntese.
  const dentro = /^(apt[ií]d[aã]o)\s*\(([^)]*)\s+ou\s+([^)]*)\)/i.exec(semCondicao);
  const a = dentro ? chave(`${dentro[1]} (${dentro[2]})`) : chave(primeira);
  const b = dentro ? chave(`${dentro[1]} (${dentro[3]})`) : (segunda ? chave(segunda) : "");
  return { pericia: a ?? "percepcao", alternativa: b ?? "", condicao, rotulo: limpo, chaveConhecida: Boolean(a) };
}

/** Os títulos dos pontos numa página: corpo de título, texto igual ao nome da lista. */
function titulosNaPagina(pagina, pontos) {
  const achados = [];
  for (const l of emLinhas(pagina.pedacos)) {
    const texto = textoDaLinha(l).replace(/\s+/g, " ").trim().toUpperCase();
    const cand = pontos.find((p) => texto === p.nome || texto === `${p.nome} (CONTINUAÇÃO)`);
    if (cand) achados.push({ ponto: cand, y: l.y, continuacao: texto.includes("CONTINUA") });
  }
  return achados;
}

/**
 * Os pontos de interesse da missão.
 * @param {Array<{numero: number, pedacos: object[]}>} paginas só as da missão
 * @param {"missao-1"|"missao-2"} missao
 * @returns {{pontos: object[], avisos: string[]}}
 */
export function extrairPontosDaMissao(paginas, missao) {
  const lista = PONTOS[missao];
  const porNome = new Map(lista.map((p) => [p.nome, {
    numero: p.numero, nome: p.nome, pagina: null, descricao: "", informacoes: [], caixa: [], notas: [],
  }]));
  const avisos = [];
  let atual = null;
  for (const pagina of paginas) {
    const titulos = titulosNaPagina(pagina, lista);
    // Sem título nesta página, o ponto anterior acabou: o que vier é outro assunto (resumo
    // da cena, ficha de criatura). Quadro que vira a página repete o título, "(CONTINUAÇÃO)".
    if (!titulos.length) { atual = null; continue; }
    // Regiões: do topo até o primeiro título é do ponto anterior; depois, um por título.
    const cortes = [...titulos].sort((a, b) => b.y - a.y);
    const regioes = [];
    if (atual) regioes.push({ ponto: atual, topo: Infinity, fundo: cortes[0]?.y ?? -Infinity, titulo: false });
    cortes.forEach((t, i) => regioes.push({
      ponto: porNome.get(t.ponto.nome), topo: t.y, fundo: cortes[i + 1]?.y ?? -Infinity, titulo: !t.continuacao,
    }));
    for (const r of regioes) {
      const pedacos = pagina.pedacos.filter((p) => p.y < r.topo + (r.titulo ? -1 : 0) && p.y >= r.fundo + 1);
      if (!pedacos.length) continue;
      const quadro = lerQuadro(pedacos, avisos);
      if (r.titulo) r.ponto.pagina = pagina.numero;
      const acima = (quadro ? pedacos.filter((p) => p.y > quadro.topo) : (r.titulo ? pedacos : [])).filter((p) => !ehCabecalho(p));
      const abaixo = quadro ? pedacos.filter((p) => p.y < quadro.fundo) : (r.titulo ? [] : pedacos);
      if (r.titulo) {
        // O número grande na margem é do mapa; o texto em versalete é a descrição, e o
        // que vem depois disso, ainda acima do quadro, é a caixa do desafio.
        const semNumero = acima.filter((p) => !(/^\d(\.\d)?\d?$/.test(p.texto.trim()) && p.altura >= 14));
        const linhasDesc = emLinhas(semNumero);
        const ehVersalete = (l) => { const t = textoDaLinha(l); return t === t.toUpperCase(); };
        const fonteDaDescricao = linhasDesc[0]?.pedacos[0]?.fonte;
        const desc = [];
        let k = 0;
        for (; k < linhasDesc.length; k += 1) {
          const t = textoDaLinha(linhasDesc[k]);
          // A caixa do desafio também é em versalete; a fonte é que muda.
          if (!ehVersalete(linhasDesc[k]) || /^DESAFIO DE ACESSO/.test(t) || linhasDesc[k].pedacos[0].fonte !== fonteDaDescricao) break;
          desc.push(t);
        }
        r.ponto.descricao = juntarLinhas(desc);
        const caixa = linhasDesc.slice(k).map(textoDaLinha).filter(Boolean);
        if (caixa.length) r.ponto.caixa.push(juntarLinhas(caixa));
      }
      if (quadro) {
        for (const l of quadro.linhas) {
          r.ponto.informacoes.push({ ...lerRotulo(l.rotulo), dt: l.dt, texto: l.texto });
        }
      }
      r.ponto.notas.push(...paragrafosDaPagina(abaixo).map((p) => p.texto));
      atual = r.ponto;
    }
  }
  const pontos = [...porNome.values()];
  for (const p of pontos) if (p.pagina === null) avisos.push(`Ponto não encontrado no PDF: ${p.nome}`);
  const achados = pontos.filter((p) => p.pagina !== null);
  // Quadro que sumiu não dá erro nenhum: sem isto, o ponto entra vazio e a mesa descobre jogando.
  for (const p of achados) if (!p.informacoes.length) avisos.push(`Ponto sem linhas no quadro: ${p.nome}`);
  const total = achados.reduce((n, p) => n + p.informacoes.length, 0);
  if (achados.length === pontos.length && total !== LINHAS_DO_LIVRO[missao]) {
    avisos.push(`O quadro tem ${total} linhas, e a versão conferida tinha ${LINHAS_DO_LIVRO[missao]}: confira contra o livro.`);
  }
  return { pontos: achados, avisos };
}

/**
 * O texto de cada página da missão, em ordem de leitura, para o diário do roteiro. As
 * páginas de ponto ficam de fora: já viram Item.
 * @returns {Array<{pagina: number, paragrafos: Array<{texto: string, titulo: boolean}>}>}
 */
export function roteiroDaMissao(paginas, pontos = []) {
  const dePonto = new Set(pontos.flatMap((p) => (p.pagina ? [p.pagina] : [])));
  return paginas
    .filter((p) => !dePonto.has(p.numero))
    .map((p) => ({ pagina: p.numero, paragrafos: paragrafosDaPagina(p.pedacos) }))
    .filter((p) => p.paragrafos.length);
}
