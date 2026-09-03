/**
 * Monta a aventura do Ato II: um `Adventure` com a cena, os cinco agentes, os handouts,
 * os 25 pontos de interesse com quadro e setor de ferramentas, os desafios, as
 * ferramentas da Ordem, o roteiro do ato e a investigação já vinculada.
 *
 *   npm run ato-ii:extrair && npm run ato-ii:gerar-aventura
 *
 * O que muda em relação ao Ato I
 * ------------------------------
 * O Ato II não é público: o texto sai do PDF (como no Ato I) e as artes ficam no zip
 * que a editora entrega a quem assina. O compêndio aponta para o prefixo
 * `assets/ato-ii/`, que não existe no sistema; na importação, o mestre entrega o zip e
 * o importador (`module/ui/extras-aventura.mjs`) sobe os arquivos para a pasta do mundo
 * e troca o prefixo. A lista do que a aventura espera vai em `flags.extras`.
 *
 * Erros do próprio livro
 * ----------------------
 * A diagramação do Ato II repete blocos de outros pontos: a descrição do Símbolo no
 * Teto impressa no Depósito A, no Molho de Chaves e no Duto (que ainda leva o título
 * "Símbolo no Teto"); linhas do quadro do Molho de Chaves no Depósito B e no Armário
 * de Roupas; a linha da cadeira caída da Mesa de Poker na Churrasqueira. Nada é
 * apagado: descrição repetida recebe a do Ato I (mesmo porão, mesmo objeto) com a
 * nota do que o livro imprime; linha repetida entra como rascunho, com a nota de onde
 * ela é. O mestre decide num clique. Tudo isso está em docs/LACUNAS.md.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ident, semAcento, tituloLegivel, pasta, em, escapar, html, iconeDoPonto } from "../aventura/comum.mjs";

const FONTES = "packs/sources";
const DESTINO = join(FONTES, "ato-ii-aventura", "ato-ii.json");
const EXTRAIDO = "build/ato-ii.json";
const ATO_I_PONTOS = "build/ato-i-pontos.json";
const ATO_I_MALDICAO = "build/ato-i-maldicao.json";
const PASTA_EXTRAS = "ato-ii";
const PREFIXO = `systems/ordem-paranormal-2e/assets/${PASTA_EXTRAS}/`;
const ATO_I = "systems/ordem-paranormal-2e/assets/ato-i/";
const ICONES = "systems/ordem-paranormal-2e/assets/icons";
const ZIP = "Ordem-2-Playtest-Alpha-Ato-II-Extras.zip";

if (!existsSync(EXTRAIDO)) {
  console.error(`Sem ${EXTRAIDO} — rode \`npm run ato-ii:extrair\` com o PDF em docs/.`);
  process.exit(1);
}
const dados = JSON.parse(readFileSync(EXTRAIDO, "utf8"));
const lerJson = (arquivo) => JSON.parse(readFileSync(arquivo, "utf8"));
const lerPasta = (nome) => readdirSync(join(FONTES, nome)).filter((a) => a.endsWith(".json"))
  .map((a) => lerJson(join(FONTES, nome, a)));
const semChave = ({ _key, ...resto }) => resto;

/* ------------------------------------------------------------- os arquivos do zip -- */

const AGENTES = ["amanda", "antonio", "heitor", "raven", "val"];
const NOMES = { amanda: "Amanda", antonio: "Antônio", heitor: "Heitor", raven: "Raven", val: "Val" };

/** O que a aventura espera do zip: destino na pasta do mundo e o nome que a editora dá. */
const EXTRAS = [
  ...AGENTES.flatMap((a) => [
    { destino: `tokens/personagem-${a}.png`, nome: `Tokens/Personagem - ${NOMES[a]}.png` },
    { destino: `tokens/token-${a}.png`, nome: `Tokens/Token - ${NOMES[a]}.png` },
    { destino: `historicos/historico-${a}.jpg`, nome: `Fichas e históricos de personagem/Histórico - ${NOMES[a]}.jpg` },
    { destino: `fichas/ficha-${a}.jpg`, nome: `Fichas e históricos de personagem/Ficha - ${NOMES[a]}.jpg` },
  ]),
  { destino: "handouts/handout-02a-laser-porao.jpg", nome: "Handouts/Handout 02A - Laser Porão.jpg" },
  { destino: "handouts/handout-02b-laser-sala-secreta.jpg", nome: "Handouts/Handout 02B - Laser Sala Secreta.jpg" },
  { destino: "handouts/handout-03-foto-do-altar-de-madeira.png", nome: "Handouts/Handout 03 - Foto do Altar de Madeira.png" },
  { destino: "handouts/handout-04-foto-dentro-do-deposito-b.png", nome: "Handouts/Handout 04 - Foto Dentro do Depósito B.png" },
  { destino: "handouts/handout-05-ritual-de-alterar-memoria.jpg", nome: "Handouts/Handout 05 - Ritual de Alterar Memória.jpg" },
  { destino: "handouts/handout-06-foto-do-freezer.png", nome: "Handouts/Handout 06 - Foto do Freezer.png" },
  { destino: "handouts/handout-01-compendium-playtest-preenchivel.pdf", nome: "Handouts/Handout 01 - Compendium Playtest preenchível.pdf" },
  { destino: "mapas/mapa-01-o-porao.jpg", nome: "Mapa/Mapa 01 - O Porão.jpg" },
  { destino: "musicas/audio-emf-1.mp3", nome: "Handouts/Audio EMF 1.mp3" },
  { destino: "musicas/audio-emf-2.mp3", nome: "Handouts/Audio EMF 2.mp3" },
  { destino: "musicas/audio-emf-3.mp3", nome: "Handouts/Audio EMF 3.mp3" },
];
const caminho = (destino) => `${PREFIXO}${destino}`;

/**
 * Handouts do Ato II. A numeração do zip não é a do livro: o texto cita "HANDOUT 01 -
 * FOTO DO ALTAR" e o arquivo chama "Handout 03 - Foto do Altar de Madeira". Casar por
 * título, nunca por número.
 */
const HANDOUTS = [
  { chave: /altar/i, destino: "handouts/handout-03-foto-do-altar-de-madeira.png", titulo: "Foto do Altar de Madeira", noLivro: "Handout 01" },
  { chave: /dep[oó]sito b/i, destino: "handouts/handout-04-foto-dentro-do-deposito-b.png", titulo: "Foto Dentro do Depósito B", noLivro: "Handout 03" },
  { chave: /freezer/i, destino: "handouts/handout-06-foto-do-freezer.png", titulo: "Foto do Freezer", noLivro: "Handout 04" },
  { chave: /ritual/i, destino: "handouts/handout-05-ritual-de-alterar-memoria.jpg", titulo: "Ritual de Alterar Memória", noLivro: "Handout 05" },
  { chave: /varredura por[aã]o|laser por[aã]o/i, destino: "handouts/handout-02a-laser-porao.jpg", titulo: "Varredura do Laser — Porão", noLivro: "Handout 16A" },
  { chave: /varredura sala|laser sala/i, destino: "handouts/handout-02b-laser-sala-secreta.jpg", titulo: "Varredura do Laser — Sala Secreta", noLivro: "Handout 16B" },
];
const handoutPorTitulo = (titulo) => HANDOUTS.find((h) => h.chave.test(titulo));
const imagem = (destino, alt) => `<p><img src="${caminho(destino)}" alt="${escapar(alt)}"></p>`;

/** Handouts do Ato I que o texto do Ato II cita ("Handout 02 - Símbolo no Teto", "12A, 12B e 12C"). */
const HANDOUTS_ATO_I = {
  "02": "handout-02-simbolo-no-teto.jpg",
  "12A": "handout-12a-e-mail-de-gustavo-1.png",
  "12B": "handout-12b-email-de-gustavo-2.png",
  "12C": "handout-12c-e-mail-de-gustavo-3.png",
};
function imagensDoAtoI(citacoes) {
  const numeros = new Set();
  for (const c of citacoes) for (const n of c.match(/\d+[A-C]?/g) ?? []) numeros.add(n);
  return [...numeros].filter((n) => HANDOUTS_ATO_I[n])
    .map((n) => `<p><img src="${ATO_I}handouts/${HANDOUTS_ATO_I[n]}" alt="Handout ${n} (Ato I)"></p>`);
}

/* ---------------------------------------------------------------------- pastas -- */

const RAIZ = "Ato II — O Porão";
const pastas = {
  atores: pasta("Actor", RAIZ),
  itens: pasta("Item", RAIZ),
  diarios: pasta("JournalEntry", RAIZ),
  cenas: pasta("Scene", RAIZ),
  trilhas: pasta("Playlist", RAIZ),
};
pastas.agentes = pasta("Actor", "Agentes", pastas.atores._id, 100);
pastas.pontos = pasta("Item", "Pontos de Interesse", pastas.itens._id, 100);
pastas.desafios = pasta("Item", "Desafios de Acesso", pastas.itens._id, 200);
pastas.ferramentas = pasta("Item", "Ferramentas da Ordem", pastas.itens._id, 300);

/* --------------------------------------------------------------------- trilha -- */

const playlist = {
  _id: ident("playlist-ato-ii-emf"),
  name: "Ato II — Áudios EMF",
  description: "<p>Os três padrões de bipes do Medidor EMF. Toque o que o ponto de interesse indicar; o jogador compara com as formas de onda do Compêndio.</p>",
  mode: 0, playing: false, fade: 0, channel: "environment",
  sounds: [1, 2, 3].map((n) => ({
    _id: ident(`som-emf-${n}`),
    name: `Áudio EMF ${n}`,
    description: "",
    path: caminho(`musicas/audio-emf-${n}.mp3`),
    channel: "environment", playing: false, repeat: false, volume: 0.8, fade: 0, sort: n * 100, flags: {},
  })),
  folder: null, sort: 0, ownership: { default: 0 }, flags: {},
};
const linkPlaylist = `@UUID[Playlist.${playlist._id}]{${playlist.name}}`;

/* ---------------------------------------------------------------------- pontos -- */

const atoIPontos = existsSync(ATO_I_PONTOS) ? lerJson(ATO_I_PONTOS) : [];
const descricaoDoAtoI = (nome) => atoIPontos.find((p) => p.nome === nome)?.descricao ?? "";

const simbolo = dados.pontos.find((p) => p.numero === 9);

/** Linhas do quadro que o livro imprime em mais de um ponto: quem é o dono de cada uma. */
const DONOS_DE_LINHA_REPETIDA = [{ numero: 11, chave: /chave/i }, { numero: 20, chave: /cadeira/i }];
const ocorrenciasDeLinha = new Map();
for (const p of dados.pontos) for (const i of p.informacoes) {
  ocorrenciasDeLinha.set(i.texto, [...(ocorrenciasDeLinha.get(i.texto) ?? []), p.numero]);
}
function linhaRepetidaDeOutro(ponto, info) {
  const onde = ocorrenciasDeLinha.get(info.texto) ?? [];
  if (onde.length < 2) return null;
  const dono = DONOS_DE_LINHA_REPETIDA.find((d) => d.chave.test(info.texto) && onde.includes(d.numero));
  if (!dono || dono.numero === ponto.numero) return null;
  return dados.pontos.find((p) => p.numero === dono.numero);
}

const paragrafosHtml = (texto) => html(texto.split(/\n\s*\n/).map((t) => t.replace(/\s*\n\s*/g, " ").trim()));

/** A leitura de uma ferramenta, como o mestre vê no ponto. */
function leituraDaFerramenta(f, ponto) {
  const partes = [];
  if (f.condicao) partes.push(`<p><em>(${escapar(f.condicao)})</em></p>`);
  if (f.dados) partes.push(`<p><strong>Sequência mínima: ${f.dados} dados.</strong></p>`);
  // O texto, com os "[HANDOUT …]" trocados pela imagem certa.
  let texto = escapar(f.texto);
  for (const titulo of f.handouts ?? []) {
    const h = handoutPorTitulo(titulo);
    const troca = h ? `${imagem(h.destino, h.titulo)}<p><em>${escapar(titulo)} — no arquivo, "${h.titulo}"</em></p>` : "";
    texto = texto.replace(`[${escapar(titulo)}]`, `</p>${troca}<p>`);
  }
  if (f.audio) texto = texto.replace(/ÁUDIO EMF \d/, (m) => `${m} (${linkPlaylist})`);
  partes.push(`<p>${texto.replace(/\n\s*\n/g, "</p><p>").replace(/\n/g, " ")}</p>`);
  if (f.notaDeRodape) partes.push(`<p><sup>${f.notaDeRodape}</sup> ${escapar(notaDeRodape(ponto, f.notaDeRodape))}</p>`);
  if (f.rotuloCorrigido) partes.push("<p><em>O livro imprime este rótulo como \"Laboratório\"; a leitura e a tabela da p. 75 dizem de que ferramenta se trata.</em></p>");
  if (f.chave === "radio" && f.radio) partes.push(`<p><strong>Solução:</strong> ${escapar(f.radio.solucao)}</p>`);
  return partes.join("").replace(/<p>\s*<\/p>/g, "");
}

function notaDeRodape(ponto, numero) {
  const nota = ponto.notas.find((n) => n.startsWith(`${numero} `));
  return nota ? nota.slice(2) : "";
}

/**
 * Os conjuntos do Rádio Modificado, no modelo do sistema: cada bloco de palavras do
 * livro é uma peça; as peças da solução, na ordem, formam o conjunto verdadeiro
 * (separadas por " | "); o resto são conjuntos falsos, um por peça. A cor vermelha que
 * marca os falsos no livro se perde na extração: o que não está na solução é falso.
 */
function conjuntosDoRadio({ conjuntos, solucao }) {
  const norm = (t) => semAcento(t).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const pecas = conjuntos.map((original) => ({ original, norm: norm(original) }));
  let resto = norm(solucao.replace(/\b(Alan|Gustavo):/g, " "));
  const ordem = [];
  while (resto.length) {
    const peca = pecas
      .filter((c) => c.norm && (resto === c.norm || resto.startsWith(`${c.norm} `)))
      .sort((a, b) => b.norm.length - a.norm.length)[0];
    if (!peca) throw new Error(`rádio: a solução não casa com os conjuntos em "${resto.slice(0, 40)}…"`);
    ordem.push(peca.original);
    resto = resto.slice(peca.norm.length).trim();
  }
  const verdadeiras = new Set(ordem);
  return [
    { verdadeiro: true, frase: ordem.join(" | ") },
    ...conjuntos.filter((c) => !verdadeiras.has(c)).map((c) => ({ verdadeiro: false, frase: c })),
  ];
}

const noLaser = (n) => dados.laser.porao.includes(n) || dados.laser.salaSecreta.includes(n);

function pontoDeInteresse(ponto) {
  const _id = ident(`poi-ato-ii-${ponto.numero}-${ponto.nome}`);
  const notas = [];

  // Descrição: a do livro, exceto onde o livro imprime a do Símbolo no Teto em outro ponto.
  let descricao = ponto.descricao;
  if (ponto.numero !== 9 && simbolo && ponto.descricao === simbolo.descricao) {
    const doAtoI = descricaoDoAtoI(ponto.nome);
    notas.push(`<p><em>O livro imprime aqui, por engano, a descrição do Símbolo no Teto${
      doAtoI ? "; esta é a descrição do mesmo objeto no Ato I" : ""}.</em></p>`);
    descricao = doAtoI || descricao;
  }
  if (ponto.tituloImpresso) {
    notas.push(`<p><em>O livro imprime o título "${tituloLegivel(ponto.tituloImpresso)}" neste ponto; o número (${ponto.numero}) e a legenda do mapa dizem que é o ${tituloLegivel(ponto.nome)}.</em></p>`);
  }

  // Quadro: linha condicional é rascunho; linha repetida de outro ponto também, com a nota.
  const repetidas = [];
  const informacoes = ponto.informacoes.map((info, indice) => {
    const dono = linhaRepetidaDeOutro(ponto, info);
    if (dono) repetidas.push(`"${info.texto.slice(0, 40)}…" (${tituloLegivel(dono.nome)})`);
    const condicional = Boolean(info.condicao) && !/^ou /i.test(info.condicao);
    return {
      id: `i${indice + 1}`,
      pericia: info.chave,
      dt: info.dt,
      texto: info.condicao ? `<p><em>(${escapar(info.condicao)})</em> ${escapar(info.texto)}</p>` : `<p>${escapar(info.texto)}</p>`,
      oculta: condicional || Boolean(dono),
      aberta: false,
    };
  });
  if (repetidas.length) {
    notas.push(`<p><em>Linha(s) que o livro repete de outro ponto, deixada(s) como rascunho: ${repetidas.join("; ")}.</em></p>`);
  }

  // Setor de ferramentas.
  const ferramentas = {};
  let laboratorioDados = 4;
  for (const f of ponto.ferramentas) {
    if (!f.chave) continue;
    if (f.chave === "radio") {
      // Com conjuntos, é o enigma (e a leitura inteira fica na nota do mestre, com a
      // solução); sem conjuntos, é uma leitura como as outras — o Ídolo só grita.
      ferramentas.radio = f.radio
        ? { conjuntos: conjuntosDoRadio(f.radio), texto: "" }
        : { conjuntos: [], texto: leituraDaFerramenta(f, ponto) };
      if (f.radio) notas.push(`<p><strong>Rádio Modificado:</strong></p>${leituraDaFerramenta(f, ponto)}`);
      continue;
    }
    ferramentas[f.chave] = (ferramentas[f.chave] ?? "") + leituraDaFerramenta(f, ponto);
    if (f.dados) laboratorioDados = f.dados;
  }
  if (noLaser(ponto.numero)) {
    const ambiente = dados.laser.porao.includes(ponto.numero) ? "Porão" : "Sala Secreta";
    const h = ambiente === "Porão" ? HANDOUTS[4] : HANDOUTS[5];
    ferramentas.laser = `<p>Identificado pela varredura do laser (${ambiente}). ${imagem(h.destino, h.titulo)}</p>`;
  }
  if (ponto.leituraNormal) notas.push(`<p><em>${escapar(ponto.leituraNormal)}</em></p>`);
  else if (!ponto.ferramentas.length) notas.push("<p><em>Todas as ferramentas resultam em leitura normal ou sem reação (tabela da p. 75).</em></p>");

  // Desafio só com Alcançar (o símbolo alto) não vira item: a explicação fica aqui.
  if (ponto.desafio?.alcancar && !ponto.desafio.arrombar && !ponto.desafio.hackTecnico) {
    notas.push(`<p><strong>Alcançar (DT ${ponto.desafio.alcancar.dt}):</strong> ${escapar(ponto.desafio.observacao || "")}.</p>`);
  }

  // O texto de mestre que vem depois do quadro (menos a nota de rodapé, que vai na ferramenta).
  const rodapes = new Set(ponto.ferramentas.map((f) => f.notaDeRodape).filter(Boolean));
  const textoDeMestre = ponto.notas.filter((n) => !rodapes.has(Number(n[0])) || !/^\d /.test(n));
  const citados = imagensDoAtoI(ponto.handoutsCitados ?? []);

  // Handouts que o ponto cita, para o ícone: os do zip (pela ferramenta que os entrega)
  // e os do Ato I que o texto menciona.
  const caminhosDeHandout = [
    ...ponto.ferramentas.flatMap((f) => (f.handouts ?? []).map(handoutPorTitulo).filter(Boolean).map((h) => caminho(h.destino))),
    ...citados.map((html) => /src="([^"]+)"/.exec(html)?.[1]).filter(Boolean),
  ];

  return {
    _id, name: tituloLegivel(ponto.nome), type: "ponto-interesse",
    img: iconeDoPonto(ponto.nome, { handouts: caminhosDeHandout, padrao: `${ICONES}/tipos/ponto-interesse.svg` }),
    system: {
      descricaoBasica: `<p>${escapar(descricao)}</p>`,
      descricaoContextual: [...notas, html(textoDeMestre), ...citados].filter(Boolean).join("\n"),
      informacoes,
      ferramentas,
      laboratorioDados,
      reveladoPorLaser: false,
    },
    effects: [], folder: null, sort: ponto.numero * 10, ownership: { default: 0 },
    flags: { "ordem-paranormal-2e": { numeroNoMapa: ponto.numero } },
  };
}

/* -------------------------------------------------------------------- desafios -- */

function desafioDoPonto(ponto) {
  const d = ponto.desafio;
  if (!d?.arrombar && !d?.hackTecnico) return null;
  const nome = `${tituloLegivel(ponto.nome)} — ${d.rotulo || "Acesso"}`;
  const notas = [
    `<p>${escapar(ponto.descricao)}</p>`,
    d.observacao ? `<p>${escapar(d.observacao)}.</p>` : "",
    d.alcancar ? `<p>Antes de arrombar é preciso <strong>Alcançar (DT ${d.alcancar.dt})</strong>.</p>` : "",
    html(ponto.notas),
  ].filter(Boolean).join("\n");
  return {
    _id: ident(`desafio-ato-ii-${ponto.numero}`),
    name: nome, type: "desafio-acesso",
    img: `${ICONES}/tipos/desafio.svg`,
    system: {
      abordagens: {
        arrombar: Boolean(d.arrombar), destrancar: false,
        hackTecnico: Boolean(d.hackTecnico), hackSocial: false, sustentar: false, generico: false,
      },
      generico: { pericia: "atletismo", rotulo: "", resolvido: false },
      sustentar: { dt: 7, aoFalhar: "" },
      hackTecnico: {
        tabela: (d.hackTecnico?.tabela ?? []).map((l) => ({
          rolagem: l.rolagem, desafio: l.equacao, segundos: l.segundos ?? 0,
        })),
        ultimaTentativaRodada: -1, resolvido: false,
      },
      hackSocial: { respostasNecessarias: 3, perguntas: [], ultimaTentativaRodada: -1, resolvido: false },
      dtObjeto: d.arrombar?.dt ?? 7,
      pontuacaoAlvo: d.arrombar?.pa ?? 10,
      pontuacaoAtual: 0, maxTentativas: 0, tentativasUsadas: 0, quebrado: false,
      tamanhoSenha: 4, facesSenha: 6, senha: [], destrancarTentativas: 0, destrancado: false, historicoDestrancar: [],
    },
    effects: [], folder: null, sort: ponto.numero * 10, ownership: { default: 0 },
    flags: { "ordem-paranormal-2e": { notaDoMestre: notas } },
  };
}

/* ---------------------------------------------------------------------- diários -- */

const pagina = (semente, nome, conteudo, ordem, tipo = "text", extra = {}) => ({
  _id: ident(`pagina-ato-ii-${semente}`),
  name: nome, type: tipo, title: { show: true, level: 1 },
  text: tipo === "text" ? { format: 1, content: conteudo } : {},
  image: {}, video: {}, src: null, system: {},
  sort: ordem * 100, ownership: { default: -1 }, flags: {},
  ...extra,
});
const paginaImagem = (semente, nome, destino, ordem, legenda = nome) => pagina(semente, nome, "", ordem, "image", {
  src: caminho(destino), image: { caption: legenda },
});

function diarioDoRoteiro() {
  const legenda = Object.entries(dados.legenda).sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([n, nome]) => `<li>${n}. ${escapar(nome)}</li>`).join("");
  const sobrecarga = "<p><em>A sobrecarga mental do porão (spec §7.6) é a tabela padrão do sistema e já vem ligada na investigação: nenhum dano nas rodadas 1 e 2, 1 ponto no fim da 3ª e da 4ª, 1d4 na 5ª e na 6ª, 1d6 na 7ª e na 8ª, 2d4 da 9ª em diante.</em></p>";
  return {
    _id: ident("diario-roteiro-ato-ii"),
    name: "Roteiro do Ato II",
    ownership: { default: 0 },
    pages: [
      pagina("abertura", "O Ato II", html(dados.aberturaDoAto), 1),
      pagina("preparacao", "Preparação", html(dados.preparacao), 2),
      pagina("vitoria", "Vitória e derrota", html(dados.vitoria) + sobrecarga, 3),
      pagina("introducao", "Introdução", html(dados.introducao), 4),
      pagina("cena-inicial", "O Ídolo de Pedra, Ato II", `${html(dados.cenaInicial)}<h3>Legenda do mapa</h3><ol class="op2-legenda">${legenda}</ol>`, 5),
      pagina("pontos", "Pontos de interesse", [
        html(dados.pontosIntro), "<h3>Novas descobertas</h3>", html(dados.novasDescobertas),
        "<h3>Pertences separados pela Ordem</h3>", html(dados.pertencesIntro),
        "<h3>Porão</h3>", html(dados.porao ?? []),
        "<h3>A Sala Secreta</h3>", html(dados.salaSecreta ?? []),
      ].join(""), 6),
      pagina("maldicao-caixa", "A Maldição do Ídolo de Pedra", html(dados.caixaMaldicao ?? []), 7),
      pagina("narracao-final", "Narração final", `${html(dados.narracaoFinal)}<h3>Fugindo</h3>${html(dados.fugindo)}`, 8),
      pagina("resposta", "A resposta correta", html(dados.respostaCorreta), 9),
    ],
    folder: null, sort: 0, flags: {},
  };
}

const ROTULO = {
  compendio: "Compêndio da Ordem", camera: "Câmera Modificada", laboratorio: "Laboratório Portátil",
  lanternaUV: "Lanterna de Estouro Ultravioleta", laser: "Laser de Varredura", infravermelho: "Leitor Infravermelho",
  emf: "Medidor EMF", poRevelador: "Pó Revelador", radio: "Rádio Modificado", termometro: "Termômetro Diferencial",
};
const COLUNAS_DA_MATRIZ = ["camera", "laboratorio", "lanternaUV", "laser", "infravermelho", "emf", "poRevelador", "radio", "termometro"];

function diarioDasMecanicas() {
  const secoes = dados.mecanicas.map((m) => {
    let corpo = html(m.paragrafos);
    if (m.chave === "laser") {
      const lista = (ns) => `<ul>${ns.map((n) => `<li>${n} — ${escapar(dados.legenda[n] ?? "")}</li>`).join("")}</ul>`;
      corpo += `<p><strong>Pontos identificados pela varredura:</strong></p><p><em>Porão</em></p>${lista(dados.laser.porao)}<p><em>Sala Secreta</em></p>${lista(dados.laser.salaSecreta)}`;
      corpo += imagem(HANDOUTS[4].destino, HANDOUTS[4].titulo) + imagem(HANDOUTS[5].destino, HANDOUTS[5].titulo);
    }
    if (m.chave === "radio") {
      corpo += "<table><thead><tr><th>Resultado</th><th>Efeito</th></tr></thead><tbody>"
        + "<tr><td>6 ou menos</td><td>Nenhum</td></tr><tr><td>7–9</td><td>2</td></tr>"
        + "<tr><td>10–12</td><td>3</td></tr><tr><td>13 ou mais</td><td>Todos</td></tr></tbody></table>";
    }
    return `<h3>${escapar(m.titulo)}</h3>${corpo}`;
  }).join("");

  const cabecalho = COLUNAS_DA_MATRIZ.map((c) => `<th>${escapar(ROTULO[c])}</th>`).join("");
  const linhas = Object.entries(dados.matriz).sort((a, b) => Number(a[0]) - Number(b[0])).map(([n, reagem]) =>
    `<tr><td>${n}. ${escapar(dados.legenda[n] ?? "")}</td>${COLUNAS_DA_MATRIZ.map((c) => `<td>${reagem.includes(c) ? "✔" : "—"}</td>`).join("")}</tr>`).join("");
  const normais = dados.leituraNormal.map((n) => `<li>${n} — ${escapar(dados.legenda[n] ?? "")}</li>`).join("");
  const matriz = `<h3>Locais de uso de cada ferramenta</h3><p>✔ reage; — leitura normal ou sem reação. Cada ponto de interesse traz as leituras no seu setor de ferramentas.</p>`
    + `<div class="op2-tabela-rolagem"><table><thead><tr><th>Ponto</th>${cabecalho}</tr></thead><tbody>${linhas}</tbody></table></div>`
    + `<p><strong>Leitura normal.</strong> Todas as ferramentas resultam em leitura normal ou sem reação nos seguintes pontos de interesse:</p><ul>${normais}</ul>`;

  return {
    _id: ident("diario-mecanicas-ato-ii"),
    name: "Mecânicas de ferramentas",
    ownership: { default: 0 },
    pages: [
      pagina("mecanicas-intro", "Instruções ao mestre", html(dados.mecanicasIntro) + secoes, 1),
      pagina("mecanicas-matriz", "Locais de uso", matriz, 2),
    ],
    folder: null, sort: 0, flags: {},
  };
}

function diarioDeHandouts() {
  const paginas = HANDOUTS.map((h, i) => paginaImagem(`handout-${h.destino}`, `${h.titulo} (${h.noLivro})`, h.destino, i + 1, `${h.noLivro} — ${h.titulo}`));
  paginas.push(pagina("compendio-pdf", "Compêndio da Ordem (Handout 01)", "", HANDOUTS.length + 1, "pdf", {
    src: caminho("handouts/handout-01-compendium-playtest-preenchivel.pdf"),
  }));
  return {
    _id: ident("diario-handouts-ato-ii"),
    name: "Handouts — Ato II",
    ownership: { default: 0 },
    pages: paginas,
    folder: null, sort: 0, flags: {},
  };
}

function diarioDosAgentes() {
  const paginas = AGENTES.flatMap((a, i) => [
    paginaImagem(`ficha-${a}`, `Ficha — ${NOMES[a]}`, `fichas/ficha-${a}.jpg`, i * 2 + 1),
    paginaImagem(`historico-${a}`, `Histórico — ${NOMES[a]}`, `historicos/historico-${a}.jpg`, i * 2 + 2),
  ]);
  return {
    _id: ident("diario-agentes-ato-ii"),
    name: "Agentes — fichas e históricos",
    // No Ato II todo jogador tem acesso a tudo dos agentes.
    ownership: { default: 2 },
    pages: paginas.map((p) => ({ ...p, ownership: { default: -1 } })),
    folder: null, sort: 0, flags: {},
  };
}

/** As regras da maldição do Ato I, para quando os agentes quebram o Ídolo (p. 87). */
function diarioDaMaldicao() {
  if (!existsSync(ATO_I_MALDICAO)) return null;
  const { regras, eventos } = lerJson(ATO_I_MALDICAO);
  if (!regras?.ativacao) return null;
  const linhas = eventos.map((e) => `<tr><td>${e.rodada}</td><td>${
    [e.narracao && `<em>“${e.narracao}”</em>`, e.efeito].filter(Boolean).join("<br>")}</td></tr>`).join("");
  return {
    _id: ident("diario-maldicao-ato-ii"),
    name: "A Maldição do Ídolo de Pedra (regras do Ato I)",
    ownership: { default: 0 },
    pages: [
      pagina("maldicao-aviso", "Quando vale", html(dados.caixaMaldicao ?? []), 1),
      pagina("maldicao-ativacao", "Ativação", `<p><em>“${regras.narracao}”</em></p><p>${regras.ativacao}</p>`, 2),
      pagina("maldicao-rodadas", "Rodada a rodada", `<table><thead><tr><th>Rodada</th><th>O que acontece</th></tr></thead><tbody>${linhas}</tbody></table>`, 3),
      ...(regras.caixas ?? []).map((c, i) => pagina(`maldicao-caixa-${i}`, c.titulo, `<p>${c.texto}</p>`, 4 + i)),
    ],
    folder: null, sort: 0, flags: {},
  };
}

/* --------------------------------------------------------------------- montagem -- */

const pontosOrdenados = [...dados.pontos].sort((a, b) => a.numero - b.numero);
const pontos = pontosOrdenados.map(pontoDeInteresse).map(em(pastas.pontos));
const desafios = pontosOrdenados.map(desafioDoPonto).filter(Boolean).map(em(pastas.desafios));
const ferramentas = lerPasta("ferramentas").map(semChave).map((f) => ({
  ...f, _id: ident(`ferramenta-ato-ii-${f.system.subtipo}`),
})).map(em(pastas.ferramentas));
const agentes = lerPasta("ato-ii-personagens").map(semChave).map(em(pastas.agentes));
const { _key: _k, ...cenaFonte } = lerJson(join(FONTES, "ato-ii-cenas", "porao.json"));
const cena = em(pastas.cenas)(cenaFonte);
const diarios = [diarioDoRoteiro(), diarioDasMecanicas(), diarioDeHandouts(), diarioDosAgentes(), diarioDaMaldicao()]
  .filter(Boolean).map(em(pastas.diarios));
const trilha = em(pastas.trilhas)(playlist);

const investigacao = {
  _id: ident("investigacao-ato-ii"),
  name: "O Porão — Ato II",
  type: "investigacao",
  img: `${ICONES}/tipos/investigacao.svg`,
  system: {
    participantes: agentes.map((a) => `Actor.${a._id}`),
    pois: pontos.map((p) => `Item.${p._id}`),
    desafios: desafios.map((d) => `Item.${d._id}`),
    // Tudo começa oculto dos jogadores; o mestre revela ponto a ponto.
    poisOcultos: pontos.map((p) => `Item.${p._id}`),
    desafiosOcultos: desafios.map((d) => `Item.${d._id}`),
    rodada: 0,
    // "Este Ato II introduz uma importante regra: a sobrecarga mental" (p. 77) — a
    // progressão do porão é a tabela padrão do sistema (spec §7.6).
    sobrecarga: { ativa: true },
    // Os agentes não estão amaldiçoados: a Dívida só volta se quebrarem o Ídolo (p. 87),
    // e aí o mestre segue o diário da maldição.
    eventos: [],
  },
  effects: [], folder: pastas.atores._id, sort: 0, ownership: { default: 0 }, flags: {},
};

const linhasDeQuadro = pontos.reduce((n, p) => n + p.system.informacoes.length, 0);
const leituras = pontos.reduce((n, p) => n + Object.values(p.system.ferramentas).filter(Boolean).length, 0);

const _id = ident("aventura-ato-ii");
const aventura = {
  _id, _key: `!adventures!${_id}`,
  name: "Ato II — O Porão",
  img: `${ATO_I}handouts/handout-02-simbolo-no-teto.jpg`,
  caption: "<p>Os agentes da Ordem voltam ao porão com as ferramentas da Ordo Realitas: cena, agentes, handouts, pontos com setor de ferramentas e a investigação já vinculada.</p>",
  description: [
    "<p>Importa a mesa inteira do Ato II: a cena do porão, os cinco agentes prontos, os",
    "handouts e o Compêndio da Ordem, os áudios do Medidor EMF, as dez ferramentas da",
    `Ordem para distribuir, os ${pontos.length} pontos de interesse com o quadro e o setor de`,
    `ferramentas preenchidos, os ${desafios.length} desafios de acesso, o roteiro do ato com as`,
    "instruções de mestre de cada ferramenta e uma investigação vinculando tudo.</p>",
    `<p><strong>${pontos.length} pontos de interesse, ${linhasDeQuadro} linhas de quadro, ${leituras} leituras de ferramenta.</strong>`,
    "Perícia, DT, texto e reação de cada ferramenta saem do livro do playtest, conferidos",
    "contra a tabela \"Locais de uso de cada ferramenta\".</p>",
    "<p><strong>As imagens, o mapa e os áudios não vêm no sistema:</strong> a editora os",
    "entrega no zip do Ato II a quem tem o material. Ao importar, o sistema pede esse zip,",
    "descompacta no navegador e guarda os arquivos na pasta deste mundo. Nada entra na",
    "pasta do sistema.</p>",
  ].join("\n"),
  actors: [...agentes, investigacao],
  items: [...pontos, ...desafios, ...ferramentas],
  journal: diarios,
  scenes: [cena],
  playlists: [trilha],
  folders: Object.values(pastas), macros: [], tables: [], cards: [], combats: [],
  folder: null, sort: 0, ownership: { default: 0 },
  flags: {
    "ordem-paranormal-2e": {
      extras: { pasta: PASTA_EXTRAS, prefixo: PREFIXO, zip: ZIP, arquivos: EXTRAS },
    },
  },
};

mkdirSync(join(FONTES, "ato-ii-aventura"), { recursive: true });
writeFileSync(DESTINO, `${JSON.stringify(aventura, null, 2)}\n`);
console.log(`${aventura.name} → ${DESTINO}`);
console.log(`  atores ${aventura.actors.length} (${agentes.length} agentes + investigação)`);
console.log(`  itens ${aventura.items.length} (${pontos.length} pontos, ${desafios.length} desafios, ${ferramentas.length} ferramentas)`);
console.log(`  linhas de quadro ${linhasDeQuadro}, leituras de ferramenta ${leituras}`);
console.log(`  cenas ${aventura.scenes.length}, diários ${aventura.journal.length}, trilhas ${aventura.playlists.length}, pastas ${aventura.folders.length}`);
console.log(`  extras esperados do zip: ${EXTRAS.length}`);
