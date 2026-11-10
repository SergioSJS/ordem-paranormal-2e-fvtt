import { test } from "node:test";
import assert from "node:assert/strict";
import { emLinhas, textoDaLinha, juntarLinhas, cortarEmBlocos, paragrafosDaPagina } from "../extrator/paginas.mjs";
import { lerRotulo, extrairPontosDaMissao, paginasDaMissao, roteiroDaMissao } from "../extrator/missoes.mjs";
import { montarMissao1, montarMissao2, PARAMETROS, EXTRAS, senhaDoBau } from "../aventura/missoes.mjs";

const p = (texto, x, y, extra = {}) => ({ texto, x, y, largura: texto.length * 4, altura: 9, fonte: "corpo", ...extra });

test("linhas e o texto delas", () => {
  const linhas = emLinhas([p("mundo", 60, 100), p("olá", 40, 100), p("depois", 40, 80)]);
  assert.equal(linhas.length, 2);
  assert.equal(textoDaLinha(linhas[0]), "olá mundo");
});

test("palavra partida na linha volta inteira; ênclise fica com hífen", () => {
  assert.equal(juntarLinhas(["esco-", "lha"]), "escolha");
  assert.equal(juntarLinhas(["acessá-", "lo agora"]), "acessá-lo agora");
  assert.equal(juntarLinhas(["uma", "coisa"]), "uma coisa");
});

test("duas colunas: lê a esquerda inteira antes da direita, mesmo com título largo", () => {
  const pedacos = [
    p("TITULO GRANDE", 40, 300, { altura: 25 }),
    p("esquerda um", 40, 260), p("esquerda dois", 40, 245),
    p("direita um", 240, 260), p("direita dois", 240, 245),
  ];
  const blocos = cortarEmBlocos(pedacos);
  const ordem = blocos.flatMap((b) => emLinhas(b).map(textoDaLinha));
  assert.deepEqual(ordem, ["TITULO GRANDE", "esquerda um", "esquerda dois", "direita um", "direita dois"]);
  assert.equal(paragrafosDaPagina(pedacos)[0].titulo, true);
});

test("rótulo do quadro vira chave do sistema (beta §2.2)", () => {
  assert.equal(lerRotulo("Percepção").pericia, "percepcao");
  assert.equal(lerRotulo("Inspecionar").pericia, "pesquisar");
  assert.equal(lerRotulo("Pesquisar").pericia, "pesquisar");
  assert.equal(lerRotulo("Ocultismo").pericia, "ocultismo");
  assert.equal(lerRotulo("Bruxaria").pericia, "ocultismo");
  assert.equal(lerRotulo("Ofício (metalurgia)").pericia, "oficio");
  const ou = lerRotulo("Acrobacia ou Sobrevivência");
  assert.deepEqual([ou.pericia, ou.alternativa], ["acrobacia", "sobrevivencia"]);
  const apt = lerRotulo("Aptidão (guerra) ou Ofício");
  assert.deepEqual([apt.pericia, apt.alternativa], ["aptidao.guerra", "oficio"]);
  const dentro = lerRotulo("Aptidão (artes ou folclore)");
  assert.deepEqual([dentro.pericia, dentro.alternativa], ["aptidao.artes", "aptidao.folclore"]);
  const cond = lerRotulo("Aptidão (erudição) (apenas se alguém tiver achado o mapa)");
  assert.equal(cond.pericia, "aptidao.erudicao");
  assert.match(cond.condicao, /^apenas se/);
  assert.equal(lerRotulo("Ocultismo (caso já tenham visto a marca)").condicao, "caso já tenham visto a marca");
  assert.equal(lerRotulo("Inventada").chaveConhecida, false);
});

/** Um quadro no formato do livro: título, descrição, cabeçalho, duas DTs, texto do mestre. */
function paginaDeQuadro(numero) {
  const mono = { altura: 8, fonte: "mono" };
  const rotulo = { fonte: "negrito" };
  return {
    numero,
    pedacos: [
      p("ÁRVORE", 100, 700, { altura: 10, fonte: "titulo" }),
      p("UMA ÁRVORE SECA", 100, 688, { fonte: "versal" }),
      p("Perícia", 70, 660), p("DT", 140, 660), p("Informação", 170, 660),
      p("Percepção", 70, 620, rotulo),
      p("6", 150, 640), p("Sensação ruim.", 170, 640, mono),
      p("8", 150, 610), p("Há uma fonte aqui.", 170, 616, mono), p("Se destruída, enfraquece.", 170, 604, mono),
      p("Inspecionar", 70, 570, rotulo),
      p("6", 150, 570), p("Um buraco.", 170, 570, mono),
      p("No buraco está um crânio.", 110, 530),
    ],
  };
}

test("quadro: DT, perícia de célula mesclada, texto e o resto como nota", () => {
  const { pontos, avisos } = extrairPontosDaMissao([paginaDeQuadro(38)], "missao-1");
  const arvore = pontos.find((q) => q.nome === "ÁRVORE");
  assert.equal(arvore.numero, "02");
  assert.equal(arvore.descricao, "UMA ÁRVORE SECA");
  assert.deepEqual(arvore.informacoes.map((l) => [l.pericia, l.dt]), [["percepcao", 6], ["percepcao", 8], ["pesquisar", 6]]);
  assert.equal(arvore.informacoes[1].texto, "Há uma fonte aqui. Se destruída, enfraquece.");
  assert.deepEqual(arvore.notas, ["No buraco está um crânio."]);
  assert.ok(avisos.some((a) => /ARBUSTO/.test(a)), "ponto que falta vira aviso, não erro");
});

test("o PDF sem a segunda missão não quebra", () => {
  const paginas = [
    { numero: 28, pedacos: [p("Esta é a primeira missão do playtest", 40, 500)] },
    { numero: 29, pedacos: [p("texto", 40, 500)] },
  ];
  assert.equal(paginasDaMissao(paginas, "missao-1").length, 2);
  assert.equal(paginasDaMissao(paginas, "missao-2").length, 0);
});

const FONTES = {
  pregerados: ["Rhiona", "Rowan", "Muirenn", "Irmão Cavan", "Malik", "Sira", "Sorcha", "Cormac"].map((n, i) => ({ _id: `pc${i}`, name: n, type: "personagem", system: {}, items: [] })),
  cenas: [
    { _id: "c1", name: "A Ilhota" }, { _id: "c2", name: "A Ilhota (outro ângulo)" },
    { _id: "c3", name: "A Caverna" }, { _id: "c4", name: "A Caverna (penumbra)" },
  ],
  posicoes: { "missao-1": { marcadores: [{ nome: "Árvore", x: 10, y: 20 }], tokens: [] }, "missao-2": null },
};

const ponto = (numero, nome, informacoes = [], extra = {}) => ({ numero, nome, pagina: 1, descricao: "DESC", informacoes, caixa: [], notas: ["nota"], ...extra });
const linha = (rotulo, dt, texto) => ({ ...lerRotulo(rotulo), dt, texto });

test("Missão 1: tudo amarrado, sem caminho fora do prefixo dos extras", () => {
  const { aventura, avisos } = montarMissao1({
    pontos: [ponto("02", "ÁRVORE", [linha("Percepção", 6, "pista")]), ponto("4.2", "TOCHA", [linha("Percepção", 6, "x")])],
    roteiro: [{ pagina: 30, paragrafos: [{ texto: "INTRODUÇÃO", titulo: true }, { texto: "Era uma vez", titulo: false }] }],
  }, FONTES);
  assert.equal(aventura.name, "Missão 1 — O Pântano dos Afogados");
  assert.equal(aventura.actors.filter((a) => a.type === "personagem").length, 6);
  assert.equal(aventura.actors.filter((a) => a.type === "cena-acao").length, 3);
  const enxurrada = aventura.actors.find((a) => a.name === "Fase 1: A Enxurrada");
  assert.deepEqual(enxurrada.system.perseguicao, PARAMETROS.enxurrada);
  const aughisk = aventura.actors.find((a) => a.name === "Aughisk");
  // RD 10, a que a revisão 1.1 imprime (p. 45).
  assert.equal(aughisk.system.rd, 10);
  assert.equal(aughisk.system.recursos.pv.max, 40);
  // Afogar agarra em vez de ferir: dano no fim da rodada, um passo a menos para se soltar (p. 33).
  const afogar = aventura.actors.find((a) => a.name === "Afogado").system.ataques.find((a) => a.nome === "Afogar");
  assert.deepEqual([afogar.efeito, afogar.danoPorRodada, afogar.passosSoltar], ["agarrar", "1d6", -1]);
  // Vínculos: tudo que a investigação e as cenas citam existe na aventura.
  const idsItens = new Set(aventura.items.map((i) => `Item.${i._id}`));
  const idsAtores = new Set(aventura.actors.map((a) => `Actor.${a._id}`));
  const investigacao = aventura.actors.find((a) => a.type === "investigacao");
  for (const u of [...investigacao.system.pois, ...investigacao.system.desafios, ...investigacao.system.eventos]) assert.ok(idsItens.has(u), u);
  for (const a of aventura.actors.filter((x) => x.type === "cena-acao")) {
    for (const u of [...a.system.participantes, ...a.system.criaturas]) assert.ok(idsAtores.has(u), u);
    for (const u of a.system.eventos) assert.ok(idsItens.has(u), u);
  }
  // O marcador do ponto entra na cena principal, pelo nome.
  const cena = aventura.scenes.find((c) => c.name === "A Ilhota");
  assert.equal(cena.notes.length, 1);
  assert.equal(aventura.scenes.length, 2);
  const roteiro = aventura.journal.find((j) => j.name.startsWith("Roteiro"));
  assert.ok(roteiro.pages.some((q) => q.name === "Introdução" && q.text.content.includes("Era uma vez")));
  assert.ok(Array.isArray(avisos));
  // Todo destino de extra aparece na lista que o importador usa.
  const destinos = new Set(aventura.flags["ordem-paranormal-2e"].extras.arquivos.map((a) => a.destino));
  const usados = [...JSON.stringify(aventura).matchAll(/assets\/vigilia\/([^"\\]+?)(?=["\\])/g)].map((m) => m[1]);
  assert.ok(usados.length > 5);
  for (const u of usados) assert.ok(destinos.has(u) || u.startsWith("tokens/personagem"), u);
});

test("Missão 2: erro do livro nasce rascunho com nota; senha do baú sai do PDF; ponto 7 existe", () => {
  const extraido = {
    pontos: [
      ponto("01", "ALTAR DAS VINHAS", [
        linha("Percepção", 4, "virote de ferro"), linha("Percepção", 6, "pergaminho"),
        linha("Aptidão (erudição) (apenas se alguém tiver achado o mapa)", 10, "tradução"),
      ]),
      ponto("02", "BURACO DAS RAÍZES", [linha("Percepção", 8, "debaixo da carroça")]),
      ponto("4.1", "BAÚ ROMANO", [linha("Ofício (metalurgia)", 8, "construção")], { caixa: ["ARROMBAR (DT 10, PA 20) DESTRANCAR (4d12, senha 1-2-3-4)"] }),
    ],
    roteiro: [],
  };
  assert.deepEqual(senhaDoBau(extraido), [1, 2, 3, 4]);
  assert.deepEqual(senhaDoBau({ pontos: [] }), []);
  const { aventura, avisos } = montarMissao2(extraido, FONTES);
  assert.equal(aventura.actors.filter((a) => a.type === "personagem").length, 8);
  const altar = aventura.items.find((i) => i.name === "Altar das Vinhas");
  assert.equal(altar.system.informacoes[0].oculta, true, "virote trocado");
  assert.equal(altar.system.informacoes[1].oculta, false);
  assert.equal(altar.system.informacoes[2].oculta, true, "linha com condição");
  assert.match(altar.system.informacoes[2].texto, /^\(apenas se/);
  assert.match(altar.system.descricaoContextual, /outra missão/);
  assert.equal(aventura.items.find((i) => i.name === "Buraco das Raízes").system.informacoes[0].oculta, true);
  assert.ok(avisos.length >= 2);
  const bau = aventura.items.find((i) => i.name === "Baú romano");
  assert.deepEqual(bau.system.senha, [1, 2, 3, 4]);
  assert.equal(bau.system.pontuacaoAlvo, 20);
  assert.ok(aventura.items.some((i) => i.name === "Nichos na Parede"));
  const mata = aventura.actors.find((a) => a.name === "Cena 1: Nas Profundezas da Mata");
  assert.equal(mata.system.furtividade.tabela.length, 10);
  assert.deepEqual(mata.system.furtividade.areas.map((a) => a.avancos), [4, 3, 4]);
  const fuga = aventura.actors.find((a) => a.name === "Cena 4: As Três Cabeças da Morte");
  assert.equal(fuga.system.perseguicao.consequencia, "morte");
});

test("Os extras esperam os arquivos que o zip traz, e mapa e token encolhem", () => {
  for (const missao of Object.keys(EXTRAS)) {
    const nomes = EXTRAS[missao].arquivos;
    assert.ok(nomes.every((a) => a.destino && a.nome));
    assert.equal(new Set(nomes.map((a) => a.destino)).size, nomes.length, "destino repetido");
    assert.ok(nomes.filter((a) => a.destino.startsWith("mapas/")).every((a) => a.maxLado && a.destino.endsWith(".webp")));
    assert.ok(nomes.filter((a) => a.destino.startsWith("musicas/")).every((a) => !a.maxLado));
  }
});

test("roteiro deixa de fora as páginas de ponto", () => {
  const paginas = [{ numero: 30, pedacos: [p("texto", 40, 500)] }, { numero: 31, pedacos: [p("quadro", 40, 500)] }];
  assert.deepEqual(roteiroDaMissao(paginas, [{ pagina: 31 }]).map((r) => r.pagina), [30]);
});

test("extrator: ponto sem quadro e total diferente do conferido viram aviso, não silêncio", () => {
  const paginas = [
    { numero: 28, pedacos: [p("Esta é a primeira missão do playtest", 40, 700)] },
    { numero: 29, pedacos: [p("ÁRVORE", 40, 700, { altura: 12 })] },
  ];
  const { avisos } = extrairPontosDaMissao(paginasDaMissao(paginas, "missao-1"), "missao-1");
  assert.ok(avisos.some((a) => /não encontrado/.test(a)), "o que falta aparece");
});

test("Missão 2 sem senha na caixa avisa", () => {
  const { avisos } = montarMissao2({ pontos: [], roteiro: [] }, FONTES);
  assert.ok(avisos.some((a) => /senha/.test(a)));
});

// Importação de missão guardada antes das cópias dos pré-gerados.
{
  const { separarPregeradosDaImportacao, pintarPastasDaImportacao } = await import("../aventura/importacao.mjs");
  const { idDaCopia } = await import("../aventura/missoes.mjs");
  const { COR_DAS_PASTAS } = await import("../aventura/comum.mjs");
  const aventura = { name: "Missão 1 — O Pântano dos Afogados", flags: { "ordem-paranormal-2e": { extras: { pasta: "missao-1" } } } };
  const montar = () => ({
    toCreate: {
      Folder: [{ _id: "pastaRaiz", type: "Actor", name: "Missão 1 — O Pântano dos Afogados", color: "#7f1d1d" },
        { _id: "pastaPg", type: "Actor", name: "Pré-gerados", folder: "pastaRaiz", color: "#7f1d1d" }],
      Actor: [
        { _id: "aaaaaaaaaaaaaaaa", type: "personagem", name: "Rhiona", folder: "pastaPg", flags: {} },
        { _id: "inv0000000000001", type: "investigacao", name: "Fase 2", system: { participantes: ["Actor.aaaaaaaaaaaaaaaa", "Actor.bbbbbbbbbbbbbbbb"] } },
        { _id: "cena000000000001", type: "cena-acao", name: "Cena 1", system: { participantes: ["Actor.aaaaaaaaaaaaaaaa"] } },
      ],
    },
    // Rowan já existe no mundo (veio com a outra missão): o core manda atualizar.
    toUpdate: { Actor: [{ _id: "bbbbbbbbbbbbbbbb", type: "personagem", name: "Rowan", folder: "pastaPg", flags: {} }] },
  });

  test("importação: troca pelo id da cópia da missão, refaz os vínculos e cria em vez de atualizar", () => {
    const { toCreate, toUpdate } = montar();
    assert.equal(separarPregeradosDaImportacao(aventura, toCreate, toUpdate, () => false), 2);
    const rhiona = idDaCopia("missao-1", "aaaaaaaaaaaaaaaa");
    const rowan = idDaCopia("missao-1", "bbbbbbbbbbbbbbbb");
    const ids = toCreate.Actor.map((a) => a._id);
    assert.ok(ids.includes(rhiona) && ids.includes(rowan), "as duas cópias são criadas");
    assert.equal(toUpdate.Actor.length, 0, "nada atualiza o ator da outra missão");
    const inv = toCreate.Actor.find((a) => a.type === "investigacao");
    assert.deepEqual(inv.system.participantes, [`Actor.${rhiona}`, `Actor.${rowan}`]);
    assert.deepEqual(toCreate.Actor.find((a) => a.type === "cena-acao").system.participantes, [], "cena de ação chega vazia");
    assert.equal(toCreate.Actor.find((a) => a._id === rhiona).flags["ordem-paranormal-2e"].copiaDaMissao, "missao-1");
  });

  test("importação: aventura montada já com as cópias passa sem mexer", () => {
    const { toCreate, toUpdate } = montar();
    for (const a of [...toCreate.Actor, ...toUpdate.Actor]) a.flags = { "ordem-paranormal-2e": { copiaDaMissao: "missao-1" } };
    assert.equal(separarPregeradosDaImportacao(aventura, toCreate, toUpdate, () => false), 0);
  });

  test("importação: as pastas da Missão entram verdes, mesmo vindas vermelhas da aventura guardada", () => {
    const { toCreate, toUpdate } = montar();
    assert.equal(pintarPastasDaImportacao(aventura, toCreate, toUpdate), 2);
    assert.ok(toCreate.Folder.every((f) => f.color === COR_DAS_PASTAS.vigilia));
    assert.equal(COR_DAS_PASTAS.vigilia, "#2f6b3a");
  });
}

// Criaturas guardadas antes das decisões da mesa: o Afogar agarra; a RD da montagem antiga vira a da 1.1.
{
  const { correcaoDaCriatura, corrigirCriaturasDaImportacao } = await import("../aventura/importacao.mjs");
  const afogadoVelho = () => ({ type: "npc", name: "Afogado 2", system: { rd: 0, ataques: [{ nome: "Garras", bonusDano: 1 }, { nome: "Afogar", bonusDano: 0 }] } });
  test("criatura velha: o Afogar ganha o agarre, o aughisk passa à RD da revisão 1.1", () => {
    const m = correcaoDaCriatura(afogadoVelho());
    assert.equal(m["system.ataques"][1].efeito, "agarrar");
    assert.equal(m["system.ataques"][0].efeito, undefined);
    assert.deepEqual(correcaoDaCriatura({ type: "npc", name: "Aughisk", system: { rd: 5, ataques: [] } }), { "system.rd": 10 });
  });
  test("criatura já corrigida ou editada à mão fica como está", () => {
    assert.equal(correcaoDaCriatura({ type: "npc", name: "Aughisk", system: { rd: 8, ataques: [] } }), null);
    assert.equal(correcaoDaCriatura({ type: "npc", name: "Afogado", system: { rd: 0, ataques: [{ nome: "Afogar", efeito: "agarrar" }] } }), null);
    assert.equal(correcaoDaCriatura({ type: "personagem", name: "Aughisk", system: { rd: 5 } }), null);
    // Uma vez só: com a marca, o mestre pode voltar a RD a 5 ou o Afogar a dano, e fica.
    assert.equal(correcaoDaCriatura({ type: "npc", name: "Aughisk", system: { rd: 5, ataques: [] }, flags: { "ordem-paranormal-2e": { criaturaCorrigida: true } } }), null);
    // Outro NPC com um ataque chamado Afogar não é o afogado da missão.
    assert.equal(correcaoDaCriatura({ type: "npc", name: "Kelpie", system: { rd: 0, ataques: [{ nome: "Afogar" }] } }), null);
  });
  test("na importação, a correção entra no documento que vai ser criado", () => {
    const toCreate = { Actor: [afogadoVelho(), { type: "npc", name: "Aughisk", system: { rd: 5, ataques: [] } }] };
    assert.equal(corrigirCriaturasDaImportacao(toCreate, {}), 2);
    assert.equal(toCreate.Actor[0].system.ataques[1].danoPorRodada, "1d6");
    assert.equal(toCreate.Actor[1].system.rd, 10);
    assert.equal(toCreate.Actor[1].flags["ordem-paranormal-2e"].criaturaCorrigida, true);
  });
}

// Revisão 1.1 do beta em mundo montado com a 1.0: só números nossos, uma vez, sem tocar o editado.
{
  const { revisaoDoAtor, aplicarNoFonte, PERICIAS_DA_REVISAO_1_1 } = await import("../aventura/revisao-beta.mjs");
  const { corrigirCriaturasDaImportacao } = await import("../aventura/importacao.mjs");
  test("revisão 1.1: a RD 3 (decisão antiga) e a 5 (montagem antiga) do aughisk viram 10", () => {
    assert.deepEqual(revisaoDoAtor({ type: "npc", name: "Aughisk", system: { rd: 3 } }), { "system.rd": 10 });
    assert.deepEqual(revisaoDoAtor({ type: "npc", name: "Aughisk 2", system: { rd: 5 } }), { "system.rd": 10 });
    assert.equal(revisaoDoAtor({ type: "npc", name: "Aughisk", system: { rd: 7 } }), null);
  });
  test("revisão 1.1: o Atletismo do afogado e as perícias corrigidas dos pré-gerados", () => {
    assert.deepEqual(revisaoDoAtor({ type: "npc", name: "Afogado", system: { pericias: { atletismo: { die: "d8" } } } }),
      { "system.pericias.atletismo.die": "d6" });
    const rowan = { type: "personagem", name: "Rowan Lobo Castanho", system: { pericias: { acrobacia: { die: "d6" }, animais: { die: "d10" } } } };
    // Animais editado à mão (d10) fica; Acrobacia ainda no dado da 1.0 é corrigida.
    assert.deepEqual(revisaoDoAtor(rowan), { "system.pericias.acrobacia.die": "d4" });
    assert.equal(revisaoDoAtor({ type: "personagem", name: "Rowan", system: { pericias: { acrobacia: { die: "d6" } } } }), null);
    assert.ok(PERICIAS_DA_REVISAO_1_1.cormac.sobrevivencia);
  });
  test("revisão 1.1: uma vez só, com a marca no ator", () => {
    const ator = aplicarNoFonte({ type: "npc", name: "Aughisk", system: { rd: 3 } }, { "system.rd": 10 });
    assert.equal(ator.system.rd, 10);
    ator.system.rd = 3;
    assert.equal(revisaoDoAtor(ator), null);
  });
  test("revisão 1.1 na importação: a aventura guardada com a 1.0 entra corrigida", () => {
    const toCreate = { Actor: [
      { type: "personagem", name: "Muirenn da Lua Pálida", system: { pericias: { pontaria: { die: "d6" } } } },
      { type: "npc", name: "Aughisk", system: { rd: 3, ataques: [] }, flags: { "ordem-paranormal-2e": { criaturaCorrigida: true } } },
    ] };
    assert.equal(corrigirCriaturasDaImportacao(toCreate, {}), 2);
    assert.equal(toCreate.Actor[0].system.pericias.pontaria.die, "d4");
    assert.equal(toCreate.Actor[1].system.rd, 10);
  });
}

// Revisão 1.1 do livro no extrator: condição no texto, Aptidão com dois campos, repetidos.
{
  const { condicaoNoTexto, lerRotulo, mesmoNumero } = await import("../extrator/missoes.mjs");
  const { marcarRepetidos } = await import("../aventura/missoes.mjs");
  test("extrator 1.1: a condição impressa no começo do texto vira condição", () => {
    assert.deepEqual(condicaoNoTexto("Apenas se alguém tiver encontrado o pergaminho esfarelado O pergaminho traz"),
      { condicao: "Apenas se alguém tiver encontrado o pergaminho esfarelado", texto: "O pergaminho traz" });
    assert.deepEqual(condicaoNoTexto("Caso já tenham encontrado uma ou mais runas “As inscrições”"),
      { condicao: "Caso já tenham encontrado uma ou mais runas", texto: "“As inscrições”" });
    assert.deepEqual(condicaoNoTexto("Há algo entalhado no piso."), { condicao: "", texto: "Há algo entalhado no piso." });
  });
  test("extrator 1.1: \"Aptidão (artes) ou (folclore)\" são dois campos da Aptidão", () => {
    const r = lerRotulo("Aptidão (artes) ou (folclore)");
    assert.deepEqual([r.pericia, r.alternativa], ["aptidao.artes", "aptidao.folclore"]);
  });
  test("extrator 1.1: o número do mapa sem o zero é o mesmo ponto", () => {
    assert.ok(mesmoNumero("01", "1"));
    assert.ok(mesmoNumero("5.1", "5.1"));
    assert.ok(!mesmoNumero("5.1", "5.2"));
  });
  test("ponto com a descrição de outro ganha a nota", () => {
    const [a, b] = marcarRepetidos([{ nome: "PILHA DE CINZAS", descricao: "X" }, { nome: "INSCRIÇÃO ANTIGA", descricao: "X" }]);
    assert.equal(a.repete, undefined);
    assert.match(b.repete, /Pilha de Cinzas/);
  });
}

// "Atualizar as pistas no mundo": o quadro novo, com a revelação de quem já achou.
{
  const { mesclarInformacoes, similaridade } = await import("../aventura/atualizar-pontos.mjs");
  const linha = (id, texto, extra = {}) => ({ id, pericia: "percepcao", dt: 8, texto, oculta: false, aberta: false, contadaPor: [], ...extra });
  test("atualizar pistas: a linha reescrita fica com o id e o estado da antiga", () => {
    // O Altar das Vinhas na 1.0: a linha do virote (trocada no livro, em rascunho) e a do pergaminho.
    const antigas = [
      linha("a0", "O virote de ferro não é a munição de uma besta comum", { oculta: true }),
      linha("a1", "Em cima do altar, escondido pela vegetação, há um pergaminho esfarelado.", { contadaPor: ["x"] }),
    ];
    // A 1.1 tira o virote e muda a DT do pergaminho; o id que a montagem dá é por posição ("a0").
    const novas = [linha("a0", "Em cima do altar, escondido pela vegetação, há um pergaminho esfarelado. Nele, seis formas.", { dt: 6 })];
    let n = 0;
    const r = mesclarInformacoes(antigas, novas, () => `novo${n++}`);
    assert.equal(r.informacoes.length, 1);
    assert.equal(r.informacoes[0].id, "a1");
    assert.equal(r.informacoes[0].dt, 6);
    assert.deepEqual(r.informacoes[0].contadaPor, ["x"]);
    assert.deepEqual(r.removidas.map((v) => v.id), ["a0"]);
  });
  test("atualizar pistas: pista nova não herda a revelação de outra pelo id", () => {
    const antigas = [linha("b0", "Há algumas mercadorias debaixo da carroça.")];
    const novas = [linha("b0", "Há algo entalhado no próprio piso à frente do buraco.")];
    const r = mesclarInformacoes(antigas, novas, () => "fresco");
    assert.equal(r.informacoes[0].id, "fresco");
    assert.equal(r.casadas, 0);
    assert.ok(similaridade("um dois três quatro", "um dois três quatro") === 1);
  });
}
