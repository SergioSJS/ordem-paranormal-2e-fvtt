/**
 * Monta as missões do modo Vigília (beta §1): um `Adventure` por missão, a partir do que o
 * extrator tirou do PDF do mestre (`module/extrator/missoes.mjs`).
 *
 * Aqui só ficam números de regra e rótulos com as nossas palavras: parâmetros de perseguição
 * e furtividade, fichas de criatura, os itens que os pontos entregam. O texto (narração,
 * quadros, regras escritas nas páginas) vem do PDF, e as artes, do zip da editora.
 *
 * Os erros de cópia que o livro imprime entram como rascunho, com nota: o mestre decide
 * (docs/regras/LACUNAS.md, seção "Playtest beta").
 */
import { ident, arquivoPublico, tituloLegivel, pasta, em, posicionarNaCena, escapar } from "./comum.mjs";
import { slugDeArquivo } from "../ui/zip.mjs";

const ASSETS = "systems/ordem-paranormal-2e/assets";
/** Prefixo que os documentos usam; o importador troca pela pasta da missão no mundo. */
const PREFIXO = `${ASSETS}/vigilia/`;
const IMG = {
  poi: `${ASSETS}/icons/tipos/ponto-interesse.svg`,
  desafio: `${ASSETS}/icons/tipos/desafio.svg`,
  evento: `${ASSETS}/icons/tipos/evento.svg`,
  item: `${ASSETS}/icons/tipos/equipamento.svg`,
  npc: `${ASSETS}/icons/tipos/npc.svg`,
  investigacao: `${ASSETS}/icons/tipos/investigacao.svg`,
};

// Lados máximos ao importar: o zip traz mapa de 9930 px e token de 35 MB (docs/regras/alpha-para-beta.md).
const LADO = { mapa: 4096, token: 1024, handout: 2048 };

const imagem = (pastaZip, arquivo, sub, maxLado) => ({
  destino: `${sub}/${arquivoPublico(arquivo.replace(/\.\w+$/, ""))}.webp`,
  nome: `${pastaZip}/${arquivo}`,
  maxLado,
});
const direto = (pastaZip, arquivo, sub) => ({
  destino: `${sub}/${slugDeArquivo(arquivo)}`,
  nome: `${pastaZip}/${arquivo}`,
});
const caminho = (destino) => `${PREFIXO}${destino}`;

const COMUNS = [
  direto("Músicas", "Névoa (Exploração).mp3", "musicas"),
  direto("Músicas", "Trevas (Tensão).mp3", "musicas"),
];
const PERSONAGENS_BASE = ["Cavan", "Malik", "Muirenn", "Rhionna", "Rowan", "Sira"];
const token = (nome, arquivo = `Personagem - ${nome}.png`) => imagem("Tokens", arquivo, "tokens", LADO.token);

export const EXTRAS = {
  "missao-1": {
    zip: "Ordem-2-Playtest-Beta-Missao-1-Extras.zip",
    arquivos: [
      ...["ARBUSTO", "ARVORE", "CARROÇA", "ESQUELETO", "PILHA DE PEDRA"].map((h) => imagem("Handouts", `HANDOUT ${h}.jpg`, "handouts", LADO.handout)),
      imagem("Mapas", "MAPA 1 ILHOTA 1.jpg", "mapas", LADO.mapa),
      imagem("Mapas", "MAPA 1 ILHOTA 2.jpg", "mapas", LADO.mapa),
      ...COMUNS,
      ...["Afogado 1", "Afogado 2", "Aughisk"].map((n) => token(n, `${n}.png`)),
      ...PERSONAGENS_BASE.map((n) => token(n)),
      direto("Fichas de personagens", "Playtest beta - fichas de personagens.pdf", "fichas"),
    ],
  },
  "missao-2": {
    zip: "Ordem-2-Playtest-Beta-Missao-2-Extras-Elite.zip",
    arquivos: [
      ...["ALTAR", "BURACO CHAO", "ESCADA", "MONOLITO", "NICHO PAREDE SEM RUNAS", "NICHO PAREDE", "PILHA DE CINZAS", "PLATAFORMA ELEVADA E BAÚ", "POTES"]
        .map((h) => imagem("Handouts", `HANDOUT ${h}.jpg`, "handouts", LADO.handout)),
      imagem("Mapas", "MAPA 2 CAVERNA v1.jpg", "mapas", LADO.mapa),
      imagem("Mapas", "MAPA 2 CAVERNA v2.jpg", "mapas", LADO.mapa),
      ...COMUNS,
      ...["Cria da floresta 1", "Cria da floresta 2", "Ellen Trechend"].map((n) => token(n, `${n}.png`)),
      ...[...PERSONAGENS_BASE, "Sorcha", "Cormac"].map((n) => token(n)),
      direto("Fichas de personagens", "Playtest beta - fichas de personagens elite.pdf", "fichas"),
    ],
  },
};

const destinoDe = (missao, trecho) => EXTRAS[missao].arquivos.find((a) => a.destino.includes(trecho))?.destino;

/** Fichas de criatura e o que os pontos entregam: números de regra, sem o texto do livro. */
const NPC = (id, nome, tokenDestino, system) => ({
  _id: ident(`vigilia-npc-${id}`), name: nome, type: "npc", img: caminho(tokenDestino),
  system: {
    categoria: "Criatura", notas: "", rd: 0, ataques: [], pericias: {}, ...system,
    recursos: { pv: { value: system.pv, max: system.pv }, pd: { value: 0, max: 0 } },
    atributos: Object.fromEntries(Object.entries(system.atributos).map(([k, die]) => [k, { die }])),
  },
  // Sem vínculo: cada token da onda tem os próprios PV.
  prototypeToken: { name: nome, texture: { src: caminho(tokenDestino) }, depth: 1, actorLink: false, disposition: -1, sight: { enabled: false } },
  items: [], effects: [], folder: null, sort: 0, ownership: { default: 0 }, flags: {},
});
const PERICIA_NPC = (rotulo, die) => ({ rotulo, die });

const ITEM = (missao, nome, sistema = {}, descricao = "") => ({
  _id: ident(`vigilia-item-${missao}-${nome}`), name: nome, type: "equipamento", img: IMG.item,
  system: {
    quantidade: 1, equipado: false, descricao: descricao ? `<p>${escapar(descricao)}</p>` : "", arma: Boolean(sistema.ataque),
    ataque: { tipo: "", bonusDano: 0, bonusTeste: 0, minimoCritico: 0, ignoraRd: 0, pequena: false, ...(sistema.ataque ?? {}) },
    marcial: sistema.marcial ?? false, armadura: sistema.armadura ?? 0, passos: sistema.passos ?? "",
    cargas: { usa: false, value: 0, max: 0 },
    ...(sistema.quantidade ? { quantidade: sistema.quantidade } : {}),
  },
  effects: [], folder: null, sort: 0, ownership: { default: 0 }, flags: {},
});

const EVENTO = (missao, nome, gatilho, rodadas, { disparado = false } = {}) => ({
  _id: ident(`vigilia-evento-${missao}-${nome}`), name: nome, type: "evento", img: IMG.evento,
  system: {
    gatilho: `<p>${escapar(gatilho)}</p>`, descricao: "",
    rodadas: rodadas.map(([rodada, efeito]) => ({ rodada, narracao: "", efeito: `<p>${escapar(efeito)}</p>` })),
    disparado, rodadaInicial: disparado ? 0 : -1,
  },
  effects: [], folder: null, sort: 0, ownership: { default: 0 }, flags: {},
});

const DESAFIO = (missao, nome, sistema) => ({
  _id: ident(`vigilia-desafio-${missao}-${nome}`), name: nome, type: "desafio-acesso", img: IMG.desafio,
  system: {
    abordagens: {
      arrombar: false, destrancar: false, hackTecnico: false, hackSocial: false, sustentar: false, generico: false,
      escalar: false, equilibrar: false, alcancar: false, ...sistema.abordagens,
    },
    ...Object.fromEntries(Object.entries(sistema).filter(([k]) => k !== "abordagens")),
  },
  effects: [], folder: null, sort: 0, ownership: { default: 0 }, flags: {},
});

/** Parâmetros que o livro imprime por missão (beta §10, §11). */
export const PARAMETROS = {
  enxurrada: {
    rodadas: 4, cortes: [{ rodada: 2, minimo: 5 }, { rodada: 3, minimo: 15 }, { rodada: 4, minimo: 25 }],
    dt: 10, consequencia: "derrubado", danoPorRodada: "1d6", carregar: true,
  },
  fuga: {
    rodadas: 5, cortes: [{ rodada: 3, minimo: 15 }, { rodada: 4, minimo: 20 }, { rodada: 5, minimo: 30 }],
    dt: 10, consequencia: "morte", recuperar: true, sacrificio: true, ataquesPorRodada: "1d6",
    obstaculo: { minimo: 15, dt: 10 },
  },
  mata: {
    runa: true,
    areas: [
      { nome: "Bosque dos Espinheiros", avancos: 4, acoes: [
        { nome: "Atravessar as árvores", pericia: "acrobacia", dt: 10, avanca: 2, antes: true, danoFalha: "1d4", dica: "+2 avanços; Acrobacia DT 10, falha 1d4" },
        { nome: "Circundar as árvores", pericia: "acrobacia", dt: 7, avanca: 1, antes: true, danoFalha: "1d4", dica: "+1 avanço; Acrobacia DT 7, falha 1d4" },
        { nome: "Procurar trilhas", pericia: "sobrevivencia", dt: 7, trilha: true, dica: "Sobrevivência DT 7: +1 passo em Acrobacia aqui" },
      ] },
      { nome: "Rio de Brumas", avancos: 3, acoes: [
        { nome: "Caminhar pelo tronco", equilibrio: true, avanca: 1, danoFalha: "1d4", dica: "Teste de equilíbrio: +1 avanço; falha 1d4 e nada" },
        { nome: "Nadar", pericia: "atletismo", dt: 10, avanca: 1, danoFalha: "1", dica: "Atletismo DT 10: +1 avanço; falha 1 de dano" },
      ] },
      { nome: "Encosta Escura", avancos: 4, escuridao: 2, acoes: [
        { nome: "Descer caminhando", pericia: "atletismo", dt: 10, avanca: 2, danoFalha: "1d4", despenca: true, dica: "Atletismo DT 10: +2 avanços; falha 1d4; por 3+, despenca" },
        { nome: "Descer escalando", pericia: "atletismo", dt: 7, avanca: 1, danoFalha: "1d4", despenca: true, dica: "Atletismo DT 7: +1 avanço; falha 1d4; por 3+, despenca" },
        { nome: "Salto de fé", saltoDeFe: true, dica: "1d6 por avanço que falta; Acrobacia DT 7 reduz pela RB" },
      ] },
    ],
    tabela: [
      { valor: 1, tipo: "numeros" }, { valor: 2, tipo: "sopro" },
      { valor: 3, tipo: "procura", formula: "1d10" }, { valor: 4, tipo: "procura", formula: "2d8" },
      { valor: 5, tipo: "procura", formula: "3d6" }, { valor: 6, tipo: "procura", formula: "1d8" },
      { valor: 7, tipo: "procura", formula: "2d6" },
      { valor: 8, tipo: "alvo", formulas: ["1d12", "2d10", "3d8"] },
      { valor: 9, tipo: "alvo", formulas: ["1d10", "2d8", "3d6"] },
      { valor: 10, tipo: "nada" },
    ],
  },
};

const cenaDeAcao = (missao, nome, tipo, { participantes, criaturas = [], eventos = [], perseguicao = {}, furtividade = {} }, destino) => ({
  _id: ident(`vigilia-cena-${missao}-${nome}`), name: nome, type: "cena-acao", img: IMG.investigacao,
  system: {
    tipo, participantes, criaturas, eventos, perseguicao, furtividade,
    descricao: "", ativa: false, rodada: 0, fase: "", agiram: [], sacrificios: [], usosDistrair: 0, areaAtual: 0,
  },
  effects: [], folder: destino._id, sort: 0, ownership: { default: 0 }, flags: {},
});

/** As seções do roteiro: um parágrafo que casa abre a página do diário. */
const SECOES = {
  "missao-1": [
    ["Resumo", /^(RESUMO DA MISSÃO|PREPARAÇÃO)$/], ["Introdução", /^INTRODUÇÃO$/], ["Cena 1: Os Afogados", /^CENA 1/],
    ["Cena 2: A Enxurrada", /^CENA 2/], ["Fase 2: A Ilhota", /^FASE 2/], ["Fase 3: O Confronto", /^FASE 3/],
    ["Epílogo", /^EPÍLOGO$/], ["O que de fato aconteceu", /^O QUE DE FATO/],
  ],
  "missao-2": [
    ["Resumo", /^(RESUMO DA MISSÃO|PREPARAÇÃO)$/], ["Introdução", /^INTRODUÇÃO$/], ["Cena 1: Nas Profundezas da Mata", /^CENA 1/],
    ["Cena 2: Os Enigmas Druídicos", /^CENA 2/], ["Cena 3: As Crianças da Floresta", /^CENA 3/],
    ["Cena 4: As Três Cabeças da Morte", /^CENA 4/], ["Epílogo", /^EPÍLOGO$/],
  ],
};

/** O diário do roteiro: o texto do PDF, em ordem de leitura, dividido nas seções. */
function diarioDoRoteiro(missao, titulo, roteiro) {
  const secoes = [];
  const abrir = (nome) => { secoes.push({ nome, html: [] }); };
  abrir("Abertura");
  for (const { pagina, paragrafos } of roteiro) {
    for (const p of paragrafos) {
      const nova = SECOES[missao].find(([, re]) => re.test(p.texto.toUpperCase().trim()));
      if (nova && !secoes.some((s) => s.nome === nova[0])) abrir(nova[0]);
      const atual = secoes.at(-1);
      atual.html.push(p.titulo ? `<h3>${escapar(p.texto)}</h3>` : `<p>${escapar(p.texto)}</p>`);
    }
    secoes.at(-1).html.push(`<p class="op2-roteiro-pagina"><small>p. ${pagina}</small></p>`);
  }
  return {
    _id: ident(`vigilia-roteiro-${missao}`), name: `Roteiro — ${titulo}`, ownership: { default: 0 }, folder: null, sort: 0, flags: {},
    pages: secoes.filter((s) => s.html.length).map((s, i) => ({
      _id: ident(`vigilia-roteiro-${missao}-${s.nome}`), name: s.nome, type: "text", title: { show: true, level: 1 },
      text: { format: 1, content: s.html.join("") }, image: {}, video: {}, src: null, system: {},
      sort: (i + 1) * 100, ownership: { default: -1 }, flags: {},
    })),
  };
}

const paginaImagem = (nome, destino, ordem) => ({
  _id: ident(`vigilia-pagina-${destino}`), name: nome, type: "image", src: caminho(destino),
  title: { show: true, level: 1 }, image: { caption: nome }, sort: ordem * 100, ownership: { default: -1 }, flags: {},
});

/**
 * Do ponto do extrator para o Item. Linha com condição, e linha que o livro imprime
 * trocada, nasce rascunho: o mestre libera.
 * @returns {{item: object, avisos: string[]}}
 */
function itemDoPonto(missao, ponto, { handout, desafios = [], erros = {} }) {
  const avisos = [];
  const notasDeErro = [];
  const informacoes = ponto.informacoes.map((linha, i) => {
    const errada = (erros.linhas ?? []).find((e) => e.re.test(linha.texto));
    if (errada) {
      avisos.push(`${tituloLegivel(ponto.nome)}: ${errada.aviso}`);
      notasDeErro.push(`Linha de ${linha.rotulo} (DT ${linha.dt}): ${errada.aviso}`);
    }
    if (!linha.chaveConhecida) avisos.push(`${tituloLegivel(ponto.nome)}: perícia desconhecida em "${linha.rotulo}"`);
    return {
      id: ident(`vigilia-info-${missao}-${ponto.numero}-${i}`).slice(0, 16),
      pericia: linha.pericia, periciaAlternativa: linha.alternativa, dt: linha.dt,
      texto: `${linha.condicao ? `(${linha.condicao}) ` : ""}${linha.texto}`,
      oculta: Boolean(linha.condicao || errada), aberta: false, contadaPor: [],
    };
  });
  const contexto = [
    ...ponto.caixa, ...ponto.notas, ...notasDeErro.map((n) => `Nota: ${n}`), ...(erros.nota ? [`Nota: ${erros.nota}`] : []),
  ];
  return {
    avisos,
    item: {
      _id: ident(`vigilia-poi-${missao}-${ponto.numero}`), name: tituloLegivel(ponto.nome), type: "ponto-interesse",
      img: handout ? caminho(handout) : IMG.poi,
      system: {
        descricaoBasica: [
          ponto.descricao ? `<p>${escapar(ponto.descricao)}</p>` : "",
          handout ? `<p><img src="${caminho(handout)}" alt=""></p>` : "",
        ].join(""),
        descricaoContextual: contexto.map((t) => `<p>${escapar(t)}</p>`).join(""),
        informacoes,
        desafios: desafios.map((d) => `Item.${d._id}`),
      },
      effects: [], folder: null, sort: 0, ownership: { default: 0 }, flags: {},
    },
  };
}

/** O que as duas missões têm em comum. */
function montar({ missao, titulo, raiz, extraido, fontes, pregeradosNomes, escolherHandout, desafiosPorPonto, erros, extrasDePonto = [], npcs, itens, eventos, cenas, cenaPrincipal, descricao, investigacaoNome, eventoDaInvestigacao }) {
  const pastas = {
    atores: pasta("Actor", raiz), itens: pasta("Item", raiz), diarios: pasta("JournalEntry", raiz),
    cenas: pasta("Scene", raiz), trilhas: pasta("Playlist", raiz),
  };
  pastas.pregerados = pasta("Actor", "Pré-gerados", pastas.atores._id, 100);
  pastas.criaturas = pasta("Actor", "Criaturas", pastas.atores._id, 200);
  pastas.cenasDeAcao = pasta("Actor", "Cenas de ação", pastas.atores._id, 300);
  pastas.pontos = pasta("Item", "Pontos de Interesse", pastas.itens._id, 100);
  pastas.desafios = pasta("Item", "Desafios de Acesso", pastas.itens._id, 200);
  pastas.eventos = pasta("Item", "Roteiros", pastas.itens._id, 300);
  pastas.itensDeMesa = pasta("Item", "Itens de Mesa", pastas.itens._id, 400);

  const pregerados = (fontes.pregerados ?? [])
    .filter((a) => pregeradosNomes.some((n) => a.name.toLowerCase().includes(n)))
    .map(em(pastas.pregerados));
  const participantes = pregerados.map((a) => `Actor.${a._id}`);

  const avisos = [...(extraido.avisos ?? [])];
  const desafios = Object.values(desafiosPorPonto).flat().map(em(pastas.desafios));
  const pontos = [];
  for (const p of extraido.pontos) {
    const { item, avisos: deste } = itemDoPonto(missao, p, {
      handout: escolherHandout(p.numero), desafios: desafiosPorPonto[p.numero] ?? [], erros: erros[p.numero] ?? {},
    });
    avisos.push(...deste);
    pontos.push(em(pastas.pontos)(item));
  }
  for (const extra of extrasDePonto) pontos.push(em(pastas.pontos)(extra));
  const criaturas = npcs().map(em(pastas.criaturas));
  const eventosItens = eventos.map(em(pastas.eventos));
  const itensDeMesa = itens.map(em(pastas.itensDeMesa));

  const investigacao = {
    _id: ident(`vigilia-investigacao-${missao}`), name: investigacaoNome, type: "investigacao", img: IMG.investigacao,
    system: {
      participantes, pois: pontos.map((p) => `Item.${p._id}`), desafios: desafios.map((d) => `Item.${d._id}`),
      poisOcultos: pontos.map((p) => `Item.${p._id}`), desafiosOcultos: desafios.map((d) => `Item.${d._id}`),
      rodada: 0, sobrecarga: { ativa: false }, eventos: eventoDaInvestigacao ? [`Item.${eventoDaInvestigacao._id}`] : [],
    },
    effects: [], folder: pastas.atores._id, sort: 0, ownership: { default: 0 }, flags: {},
  };
  const cenasDeAcao = cenas({ participantes, criaturas, pastas });

  const handouts = EXTRAS[missao].arquivos.filter((a) => a.destino.startsWith("handouts/"));
  const fichasPdf = EXTRAS[missao].arquivos.find((a) => a.destino.startsWith("fichas/"));
  const diarios = [
    diarioDoRoteiro(missao, titulo, extraido.roteiro ?? []),
    {
      _id: ident(`vigilia-handouts-${missao}`), name: `Handouts — ${titulo}`, ownership: { default: 0 }, folder: null, sort: 0, flags: {},
      pages: handouts.map((h, i) => paginaImagem(tituloLegivel(h.nome.split("/").pop().replace(/\.\w+$/, "").replace(/^HANDOUT /, "")), h.destino, i + 1)),
    },
    {
      _id: ident(`vigilia-fichas-${missao}`), name: `Fichas e históricos — ${titulo}`, ownership: { default: 0 }, folder: null, sort: 0, flags: {},
      pages: [{
        _id: ident(`vigilia-fichas-pagina-${missao}`), name: "Fichas de personagens", type: "pdf", src: caminho(fichasPdf.destino),
        title: { show: true, level: 1 }, sort: 100, ownership: { default: -1 }, flags: {},
      }],
    },
  ].map(em(pastas.diarios));

  const trilha = [{
    _id: ident(`vigilia-trilha-${missao}`), name: `${titulo} — Trilha`, description: "", mode: 0, playing: false, fade: 2000,
    channel: "music", sort: 0, ownership: { default: 0 }, flags: {}, folder: pastas.trilhas._id,
    sounds: COMUNS.map((m, i) => ({
      _id: ident(`vigilia-som-${missao}-${m.destino}`), name: m.nome.split("/").pop().replace(/\.mp3$/, ""), description: "",
      path: caminho(m.destino), channel: "music", playing: false, repeat: true, volume: 0.7, fade: 2000, sort: (i + 1) * 100, flags: {},
    })),
  }];

  const principal = posicionarNaCena(cenaPrincipal(fontes), fontes.posicoes?.[missao] ?? null, {
    ato: missao, alvos: pontos, atores: pregerados,
  });
  const secundarias = (fontes.cenas ?? []).filter((c) => c.name !== principal?.name && c.name.startsWith(principal?.name ?? "\0"));

  return {
    avisos,
    aventura: {
      _id: ident(`aventura-${missao}`), name: raiz, img: IMG.investigacao,
      caption: `<p>${escapar(titulo)}: mapa, trilha, pré-gerados, handouts e as cenas de ação já montadas.</p>`,
      description: descricao,
      actors: [...pregerados, ...criaturas, investigacao, ...cenasDeAcao],
      items: [...pontos, ...desafios, ...eventosItens, ...itensDeMesa],
      journal: diarios,
      scenes: [principal, ...secundarias].filter(Boolean).map(em(pastas.cenas)),
      playlists: trilha,
      folders: Object.values(pastas), macros: [], tables: [], cards: [], combats: [],
      folder: null, sort: 0, ownership: { default: 0 },
      flags: { "ordem-paranormal-2e": { extras: { pasta: missao, prefixo: PREFIXO, zip: EXTRAS[missao].zip, arquivos: EXTRAS[missao].arquivos } } },
    },
  };
}

/** O texto da página onde a ficha da criatura está: vai nas notas dela. */
function notasDeCriatura(paginas, nome) {
  const pagina = paginas.find((p) => p.paragrafos.some((q) => q.texto.toUpperCase().trim() === nome));
  return pagina ? pagina.paragrafos.map((p) => (p.titulo ? `<h3>${escapar(p.texto)}</h3>` : `<p>${escapar(p.texto)}</p>`)).join("") : "";
}

/**
 * @param {{pontos: object[], roteiro: object[], avisos?: string[]}} extraido
 * @param {{pregerados: object[], cenas: object[], posicoes?: object}} fontes
 */
export function montarMissao1(extraido, fontes) {
  const m = "missao-1";
  const afogado = NPC("afogado", "Afogado", destinoDe(m, "afogado-1"), {
    pv: 10, atributos: { fisico: "d8", mente: "d4", emocao: "d4" },
    pericias: { atletismo: PERICIA_NPC("Atletismo", "d8"), luta: PERICIA_NPC("Luta", "d6") },
    ataques: [
      { nome: "Garras", tipo: "corpo", dados: "d8+d6", bonusDano: 1 },
      { nome: "Afogar", tipo: "corpo", dados: "d8+d6", bonusDano: 0 },
    ],
  });
  // O livro não imprime a RD do aughisk; as armas especiais ignoram 5 (docs/regras/LACUNAS.md).
  const aughisk = NPC("aughisk", "Aughisk", destinoDe(m, "aughisk"), {
    pv: 40, rd: 5, atributos: { fisico: "d10", mente: "d6", emocao: "d8" },
    pericias: { atletismo: PERICIA_NPC("Atletismo", "d10"), luta: PERICIA_NPC("Luta", "d10"), percepcao: PERICIA_NPC("Percepção", "d10") },
    ataques: [
      { nome: "Espada", tipo: "corpo", dados: "2d10", bonusDano: 4 },
      { nome: "Coice", tipo: "corpo", dados: "2d10", bonusDano: 3 },
      { nome: "Investida equina", tipo: "corpo", dados: "2d10", bonusDano: 3 },
    ],
  });

  const roteiroCena1 = EVENTO(m, "Cena 1, rodada a rodada", "Os afogados chegam.", [
    [1, "Todos sofrem 1d6 de dano emocional e testam Disciplina (DT 10): quem falhar recebe dado de pavor. Na fase corpo a corpo, cada afogado usa Garras."],
    [2, "Na fase corpo a corpo, cada afogado usa Afogar. No fim da rodada, quem está sendo afogado perde 1d6 PV."],
    [3, "Afogado afogando não age. A vítima testa Acrobacia ou Luta com um passo a menos para se soltar. No fim da rodada, quem segue sendo afogado perde 1d6 PV."],
  ]);
  const ciclo = [
    "O aughisk ataca em corpo a corpo.",
    "O aughisk usa Investida Equina (fase de suporte, resolve no corpo a corpo). Afogados surgem e vão para a ilhota.",
    "O aughisk começa a Enxurrada da Morte. Os afogados da onda atacam.",
    "O aughisk conclui a Enxurrada: Acrobacia DT 13; quem passa sofre 1d6, quem falha 2d6 e fica caído. Mais afogados surgem.",
  ];
  const roteiroConfronto = EVENTO(m, "O Confronto, rodada a rodada", "O aughisk chega à ilhota.", [
    [1, `${ciclo[0]} Presença: todos sofrem 2d6 de dano emocional; Disciplina DT 10 reduz à metade.`],
    ...Array.from({ length: 11 }, (_v, i) => [i + 2, ciclo[(i + 1) % 4]]),
  ]);
  const roteiroIlhota = EVENTO(m, "A Ilhota, rodada a rodada", "A fase dura 3 rodadas (4 se o crânio for destruído antes do confronto).", [
    [2, "No fim desta rodada, a silhueta do aughisk sobe a elevação."],
    [3, "Última rodada antes de a criatura chegar. Comece o confronto no fim dela."],
  ], { disparado: true });

  const desafiosPorPonto = {
    "01": [
      DESAFIO(m, "Consertar a balista", { abordagens: { generico: true }, generico: { pericia: "aptidao.guerra", rotulo: "Consertar", resolvido: false }, dtObjeto: 7 }),
      DESAFIO(m, "Municiar a balista", { abordagens: { generico: true }, generico: { pericia: "atletismo", rotulo: "Municiar", resolvido: false }, dtObjeto: 7 }),
    ],
    "03": [DESAFIO(m, "Erguer a carroça", { abordagens: { generico: true }, generico: { pericia: "atletismo", rotulo: "Erguer", resolvido: false }, dtObjeto: 10 })],
    4.2: [DESAFIO(m, "Escalar a pilha", { abordagens: { escalar: true }, escalar: { pericia: "atletismo", alvo: 10, dtRapido: 8, dtCauteloso: 6 } })],
  };
  const itens = [
    ITEM(m, "Balista", { ataque: { tipo: "distancia", bonusDano: 10, ignoraRd: 5 } }, "Arma de cerco: precisa de corda e virote. Deixa o alvo atordoado por 1 rodada."),
    ITEM(m, "Tocha paranormal", { ataque: { tipo: "corpo", bonusDano: 10, ignoraRd: 5 } }, "Contra criatura paranormal; atordoa por 1 rodada e se destrói no golpe."),
    ITEM(m, "Virote de ferro"), ITEM(m, "Corda de cânhamo"),
    ITEM(m, "Crucifixo de Broccan", {}, "Quem pega recebe 1d10 de bônus em um único teste até o fim da cena."),
    ITEM(m, "Bálsamo de confrei", { quantidade: 3 }, "Uma ação: cura 2d4 PV. Em aliado, ele precisa ficar parado na rodada."),
    ITEM(m, "Crânio do cavalo", {}, "5 PV, RD 5. Destruído, o aughisk fica atordoado por 1 rodada e perde a redução de dano."),
  ];
  return montar({
    missao: m, titulo: "O Pântano dos Afogados", raiz: "Missão 1 — O Pântano dos Afogados", extraido, fontes,
    pregeradosNomes: ["rhiona", "rowan", "muirenn", "cavan", "malik", "sira"],
    escolherHandout: (numero) => ({
      "01": destinoDe(m, "arbusto"), "02": destinoDe(m, "arvore"), "03": destinoDe(m, "carroca"),
      "04": destinoDe(m, "pilha-de-pedra"), 4.1: destinoDe(m, "esqueleto"),
    }[numero] ?? null),
    desafiosPorPonto,
    erros: {
      4.2: { nota: "O livro imprime dois blocos de Percepção; o segundo provavelmente é Inspecionar." },
      "02": { nota: "O quadro cita Pesquisar, que é Inspecionar neste modo." },
    },
    npcs: () => {
      afogado.system.notas = notasDeCriatura(extraido.roteiro ?? [], "AFOGADO");
      aughisk.system.notas = notasDeCriatura(extraido.roteiro ?? [], "AUGHISK");
      return [afogado, aughisk];
    },
    itens,
    eventos: [roteiroCena1, roteiroIlhota, roteiroConfronto],
    eventoDaInvestigacao: roteiroIlhota,
    investigacaoNome: "Fase 2: A Ilhota",
    cenaPrincipal: (f) => (f.cenas ?? []).find((c) => c.name === "A Ilhota") ?? null,
    cenas: ({ participantes, pastas }) => [
      cenaDeAcao(m, "Cena 1: Os Afogados", "combate", { participantes, criaturas: [`Actor.${afogado._id}`], eventos: [`Item.${roteiroCena1._id}`] }, pastas.cenasDeAcao),
      cenaDeAcao(m, "Fase 1: A Enxurrada", "perseguicao", { participantes, perseguicao: PARAMETROS.enxurrada }, pastas.cenasDeAcao),
      cenaDeAcao(m, "Fase 3: O Confronto", "combate", {
        participantes, criaturas: [`Actor.${aughisk._id}`, `Actor.${afogado._id}`], eventos: [`Item.${roteiroConfronto._id}`],
      }, pastas.cenasDeAcao),
    ],
    descricao: "<p>Missão gratuita do playtest beta: o combate contra os afogados, a fuga da enxurrada, a ilhota e o confronto com o aughisk.</p>"
      + "<p>O texto sai do seu PDF. Mapas, tokens, handouts e trilha estão no zip da editora, que o sistema pede ao importar.</p>"
      + "<p><strong>Por onde começar:</strong> abra o diário de roteiro e ligue as cenas no painel de ação, na ordem. A RD do aughisk é 5 por inferência: o livro não imprime o valor.</p>",
  });
}

/**
 * @param {{pontos: object[], roteiro: object[], avisos?: string[]}} extraido
 * @param {{pregerados: object[], cenas: object[], posicoes?: object}} fontes
 */
export function montarMissao2(lido, fontes) {
  const m = "missao-2";
  // Sem a senha, o baú não abre pelo jeito do livro: melhor avisar que descobrir na mesa.
  const senha = senhaDoBau(lido);
  const extraido = senha.length ? lido : {
    ...lido, avisos: [...(lido.avisos ?? []), "Baú romano: não achei a senha na caixa do desafio; preencha na ficha dele."],
  };
  const cria = NPC("cria", "Cria da Floresta", destinoDe(m, "cria-da-floresta-1"), {
    pv: 10, atributos: { fisico: "d6", mente: "d4", emocao: "d4" },
    pericias: {
      acrobacia: PERICIA_NPC("Acrobacia", "d6"), atletismo: PERICIA_NPC("Atletismo", "d6"),
      luta: PERICIA_NPC("Luta", "d6"), percepcao: PERICIA_NPC("Percepção", "d6"),
    },
    ataques: [{ nome: "Garras", tipo: "corpo", dados: "2d6", bonusDano: 1 }],
  });
  const ellen = NPC("ellen", "Ellén Trechend", destinoDe(m, "ellen-trechend"), {
    pv: 1, atributos: { fisico: "d12", mente: "d12", emocao: "d12" },
  });

  const roteiroGruta = EVENTO(m, "Os Enigmas, rodada a rodada", "A cena dura 8 rodadas.", [
    [6, "Primeiro sinal das crias: um cheiro. A descrição está no roteiro."],
    [7, "Segundo sinal: um som. A descrição está no roteiro."],
    [8, "Terceiro sinal: algo se vê. Rodada final; depois dela, passe à Cena 3."],
  ], { disparado: true });
  const roteiroOndas = EVENTO(m, "As Ondas, rodada a rodada", "As crias chegam; a primeira rodada é de preparação.", [
    [1, "Preparação: posicionar, sacar, atirar ou seguir investigando. Bloquear a entrada exige exatamente dois personagens."],
    [2, "Primeira onda: uma cria por personagem."],
    [5, "Segunda onda: mais uma cria por personagem. A partir daqui elas podem derrubar na fase de suporte."],
    [8, "Terceira onda, se a chama não acendeu. Intuição DT 10: matar não basta."],
    [11, "Quarta onda, se a chama não acendeu. Intuição DT 10: lembram do crânio e do ritual."],
    [14, "Nova onda, se a chama não acendeu."],
    [17, "Nova onda, se a chama não acendeu."],
  ]);

  const desafiosPorPonto = {
    "04": [DESAFIO(m, "Plataforma elevada", { abordagens: { alcancar: true }, alcancar: { pericia: "atletismo", dt: 7 } })],
    4.1: [DESAFIO(m, "Baú romano", {
      abordagens: { arrombar: true, destrancar: true }, dtObjeto: 10, pontuacaoAlvo: 20, tamanhoSenha: 4, facesSenha: 12,
      // A senha do baú é impressa no livro: sai do PDF, na hora (`senhaDoBau`).
      senha,
    })],
    "05": [DESAFIO(m, "Escadaria natural", { abordagens: { equilibrar: true }, equilibrar: { sucessos: 3, danoFalha: "1d4" } })],
    "06": [DESAFIO(m, "Monólito pesado", { abordagens: { sustentar: true }, sustentar: { dt: 10, aoFalhar: "2d6 em quem estiver embaixo" } })],
  };

  const nichos = {
    _id: ident(`vigilia-poi-${m}-07`), name: "Nichos na Parede", type: "ponto-interesse", img: caminho(destinoDe(m, "nicho-parede-sem-runas")),
    system: {
      descricaoBasica: `<p><img src="${caminho(destinoDe(m, "nicho-parede-sem-runas"))}" alt=""></p>`,
      // O livro lista o ponto e não traz quadro: o enigma está no diário, na abertura da Cena 2.
      descricaoContextual: `<p>O enigma das pedras rúnicas: veja o roteiro, Cena 2. Resolvido, mostre o handout com as runas no diário de handouts.</p><p><img src="${caminho(destinoDe(m, "handout-nicho-parede.webp"))}" alt=""></p>`,
      informacoes: [], desafios: [],
    },
    effects: [], folder: null, sort: 0, ownership: { default: 0 }, flags: {},
  };

  const itens = [
    ITEM(m, "Cota de malha", { armadura: 2, marcial: true, passos: "atletismo -1, furtividade -1" }, "Vestir gasta uma ação."),
    ITEM(m, "Gládio", { ataque: { tipo: "corpo", bonusDano: 4, bonusTeste: 1 }, marcial: true }),
    ITEM(m, "Elmo de legionário", { armadura: 1, passos: "percepcao -1" }),
    ITEM(m, "Corselete de couro", { armadura: 1 }, "Vestir gasta uma ação."),
    ITEM(m, "Flechas com pena de águia", { quantidade: 6 }, "Um passo a mais no ataque e +1 na rolagem de dano."),
    ITEM(m, "Bálsamo de confrei", { quantidade: 2 }, "Uma ação: cura 2d4 PV. Em aliado, ele precisa ficar parado na rodada."),
    ITEM(m, "Crânio de Muc Druídech"),
    ...["árvore", "rio", "sol", "nuvem", "terra", "montanha"].map((r) => ITEM(m, `Pedra rúnica (${r})`)),
  ];

  return montar({
    missao: m, titulo: "A Caverna de Cruachan", raiz: "Missão 2 — A Caverna de Cruachan", extraido, fontes,
    pregeradosNomes: ["rhiona", "rowan", "muirenn", "cavan", "malik", "sira", "sorcha", "cormac"],
    escolherHandout: (numero) => ({
      "01": destinoDe(m, "altar"), "02": destinoDe(m, "buraco"), "03": destinoDe(m, "pilha-de-cinzas"),
      "04": destinoDe(m, "plataforma"), 4.1: destinoDe(m, "plataforma"), "05": destinoDe(m, "escada"),
      5.2: destinoDe(m, "potes"), "06": destinoDe(m, "monolito"),
    }[numero] ?? null),
    desafiosPorPonto,
    erros: {
      "01": { linhas: [{ re: /virote de ferro/i, aviso: "o livro imprime aqui o texto do virote, de outra missão." }] },
      "02": { linhas: [{ re: /debaixo da carroça/i, aviso: "o livro imprime aqui o texto da carroça, de outra missão; a linha seguinte pressupõe um entalhe que esta revelaria." }] },
      5.1: { nota: "O livro repete aqui a descrição e o desafio da escadaria." },
    },
    extrasDePonto: [nichos],
    npcs: () => {
      cria.system.notas = notasDeCriatura(extraido.roteiro ?? [], "CRIAS DA FLORESTA");
      return [cria, ellen];
    },
    itens,
    eventos: [roteiroGruta, roteiroOndas],
    eventoDaInvestigacao: roteiroGruta,
    investigacaoNome: "Cena 2: Os Enigmas Druídicos",
    cenaPrincipal: (f) => (f.cenas ?? []).find((c) => c.name === "A Caverna") ?? null,
    cenas: ({ participantes, pastas }) => [
      cenaDeAcao(m, "Cena 1: Nas Profundezas da Mata", "furtividade", { participantes, furtividade: PARAMETROS.mata }, pastas.cenasDeAcao),
      cenaDeAcao(m, "Cena 3: As Crianças da Floresta", "combate", { participantes, criaturas: [`Actor.${cria._id}`], eventos: [`Item.${roteiroOndas._id}`] }, pastas.cenasDeAcao),
      cenaDeAcao(m, "Cena 4: As Três Cabeças da Morte", "perseguicao", { participantes, perseguicao: PARAMETROS.fuga }, pastas.cenasDeAcao),
    ],
    descricao: "<p>Missão de assinantes do playtest beta: furtividade na mata, os enigmas da gruta, o combate em ondas e a fuga do Ellén Trechend.</p>"
      + "<p>O texto sai do seu PDF. Mapas, tokens, handouts e trilha estão no zip da editora, que o sistema pede ao importar.</p>"
      + "<p><strong>Atenção:</strong> duas linhas do quadro vêm trocadas no livro e nascem em rascunho, com nota no ponto.</p>",
  });
}

/** "DESTRANCAR (4d12, senha 1-2-3-4)": a senha que o livro imprime na caixa do baú. */
export function senhaDoBau(extraido) {
  const bau = (extraido.pontos ?? []).find((p) => p.numero === "4.1");
  const m = /senha\s+([\d]+(?:-\d+)+)/i.exec((bau?.caixa ?? []).join(" "));
  return m ? m[1].split("-").map(Number) : [];
}

/** O resumo que a janela mostra. */
export function resumoDaMissao(extraido, aventura) {
  return {
    pontos: extraido.pontos.length,
    linhas: extraido.pontos.reduce((n, p) => n + p.informacoes.length, 0),
    cenas: aventura.actors.filter((a) => a.type === "cena-acao").length,
    personagens: aventura.actors.filter((a) => a.type === "personagem").length,
  };
}
