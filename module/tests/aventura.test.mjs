import test from "node:test";
import assert from "node:assert/strict";
import { montarAtoI } from "../aventura/ato-i.mjs";
import { montarAtoII } from "../aventura/ato-ii.mjs";
import { alinharNiveis } from "../aventura/niveis.mjs";

/** Um Ato I mínimo, no formato que `extrairAtoI` devolve. */
const extraidoAtoI = () => ({
  pontos: [
    {
      nome: "DEPÓSITO A, MOLHO DE CHAVES", descricao: "Um molho com três chaves.", notas: "Este é o molho 1.",
      conteudo: "", condicao: "", handouts: [2],
      informacoes: [
        { pericia: "Percepção", chave: "percepcao", dt: 6, texto: "Há sangue nas chaves.", condicao: "" },
        { pericia: "Pesquisar", chave: "pesquisar", dt: 6, dtAlternativa: 10, texto: "Duas são iguais.", condicao: "ou Tecnologia" },
      ],
      desafio: { rotulo: "PORTA TRANCADA", arrombar: { dt: 10, pa: 10 }, observacao: "" },
    },
    {
      nome: "SÍMBOLO NO TETO", descricao: "Um símbolo enorme.", notas: "", conteudo: "", condicao: "", handouts: [2],
      informacoes: [{ pericia: "Percepção (apenas Alan)", chave: "percepcao", dt: 8, texto: "É o da tatuagem.", condicao: "apenas Alan" }],
      desafio: null,
    },
  ],
  maldicao: {
    regras: { narracao: "Você sente a dívida.", ativacao: "Teste de Disciplina.", caixas: [{ titulo: "A DÍVIDA FOI PAGA", texto: "Acabou." }] },
    eventos: [{ rodada: 0, narracao: "", efeito: "" }, { rodada: 1, narracao: "Um sussurro.", efeito: "Perde 1 PD." }],
  },
  itens: { itens: [{ nome: "FACA DE CHURRASCO", descricao: "Pode ser usada como arma." }], prateleiras: [], enigmaDaEstante: [] },
  roteiro: { introducao: "Bem-vindos.", cenaInicial: "Vocês acordam.", narracaoFinal: "PERSONAGENS ESCAPAM\nAs escadas levam.\nFim." },
});

const fontesAtoI = () => ({
  pregerados: [{ _id: "a1", name: "Alan", type: "personagem", system: {}, items: [] }],
  cena: { _id: "c1", name: "O Porão", walls: [] },
  handouts: [{ _id: "j1", name: "Handouts", pages: [{ _id: "p1", src: "systems/ordem-paranormal-2e/assets/ato-i/handouts/handout-02-simbolo-no-teto.jpg", type: "image" }] }],
  trilha: [{ _id: "t1", name: "Trilha", sounds: [] }],
});

test("montarAtoI: pontos, desafios, evento, itens de mesa e a investigação amarrada", () => {
  const aventura = montarAtoI(extraidoAtoI(), fontesAtoI());
  const pontos = aventura.items.filter((i) => i.type === "ponto-interesse");
  const desafios = aventura.items.filter((i) => i.type === "desafio-acesso");
  const eventos = aventura.items.filter((i) => i.type === "evento");
  assert.equal(pontos.length, 2);
  assert.equal(desafios.length, 1);
  assert.equal(eventos.length, 1);
  assert.equal(aventura.items.filter((i) => i.type === "equipamento").length, 1);
  assert.equal(pontos[0].name, "Depósito A, Molho de Chaves");
  // O ponto lista o próprio desafio, e a investigação lista tudo — oculto de saída.
  assert.deepEqual(pontos[0].system.desafios, [`Item.${desafios[0]._id}`]);
  const investigacao = aventura.actors.find((a) => a.type === "investigacao");
  assert.deepEqual(investigacao.system.pois, pontos.map((p) => `Item.${p._id}`));
  assert.deepEqual(investigacao.system.poisOcultos, investigacao.system.pois);
  assert.deepEqual(investigacao.system.eventos, [`Item.${eventos[0]._id}`]);
  assert.deepEqual(investigacao.system.participantes, ["Actor.a1"]);
  // Cena, trilha, handouts e os dois diários montados (roteiro e maldição).
  assert.equal(aventura.scenes.length, 1);
  assert.equal(aventura.playlists.length, 1);
  assert.equal(aventura.journal.length, 3);
  // Todo documento numa pasta da aventura.
  const pastas = new Set(aventura.folders.map((f) => f._id));
  for (const doc of [...aventura.actors, ...aventura.items, ...aventura.journal, ...aventura.scenes]) {
    assert.ok(pastas.has(doc.folder), `${doc.name} sem pasta`);
  }
});

test("montarAtoI: a linha do quadro leva condição e DT alternativa no texto, e a condição a esconde", () => {
  const aventura = montarAtoI(extraidoAtoI(), fontesAtoI());
  const [molho, simbolo] = aventura.items.filter((i) => i.type === "ponto-interesse");
  assert.equal(molho.system.informacoes[1].pericia, "pesquisar");
  assert.equal(molho.system.informacoes[1].texto, "(DT 6 ou 10; ou Tecnologia) Duas são iguais.");
  // "ou Tecnologia" é perícia alternativa, não condição: a linha segue descobrível.
  assert.equal(molho.system.informacoes[1].oculta, false);
  assert.equal(simbolo.system.informacoes[0].oculta, true);
  // O handout citado vai para a descrição de mestre do ponto que combina com ele.
  assert.match(simbolo.system.descricaoContextual, /handout-02-simbolo-no-teto\.jpg/);
  assert.doesNotMatch(molho.system.descricaoContextual, /handout-02/);
});

test("montarAtoI: as artes vêm do zip gratuito da editora, declarado nos flags", () => {
  const aventura = montarAtoI(extraidoAtoI(), fontesAtoI());
  const extras = aventura.flags["ordem-paranormal-2e"].extras;
  assert.equal(extras.pasta, "ato-i");
  assert.equal(extras.prefixo, "systems/ordem-paranormal-2e/assets/ato-i/");
  assert.equal(extras.arquivos.length, 36);
  assert.ok(extras.arquivos.some((a) => a.destino === "mapas/mapa-03-o-porao-sala-secreta-duto-de-ventilacao-completo.jpg"));
  assert.ok(extras.arquivos.every((a) => a.nome && !a.destino.startsWith("/")));
  // A imagem da aventura não depende do zip: aparece no compêndio antes dele.
  assert.match(aventura.img, /assets\/icons\//);
});

test("montarAtoI: posições capturadas viram marcadores e tokens na cena, com os ids desta geração", () => {
  const fontes = {
    ...fontesAtoI(),
    pregerados: [{ _id: "a1", name: "Alan", type: "personagem", system: {}, items: [],
      prototypeToken: { name: "Alan", texture: { src: "systems/ordem-paranormal-2e/assets/ato-i/tokens/token-alan.png" }, actorLink: true, disposition: 1 } }],
    posicoes: {
      initial: { x: 1000, y: 900, scale: 0.6 },
      marcadores: [{ nome: "Depósito A, Molho de Chaves", x: 120, y: 340 }, { nome: "Depósito A, Molho de Chaves — PORTA TRANCADA", x: 50, y: 60 }, { nome: "Não Existe", x: 1, y: 1 },
        // Do outro ato ou de outra geração: id que não existe aqui, casa pelo nome — e o
        // mesmo ponto pode ter dois marcadores.
        { nome: "Depósito A, Molho de Chaves", id: "0000000000000000", x: 900, y: 910 }],
      tokens: [{ nome: "Alan", x: 700, y: 800, elevation: 0 }, { nome: "Ninguém", x: 0, y: 0 }],
    },
  };
  const aventura = montarAtoI(extraidoAtoI(), fontes);
  const cena = aventura.scenes[0];
  const molho = aventura.items.find((i) => i.name === "Depósito A, Molho de Chaves");
  const porta = aventura.items.find((i) => i.type === "desafio-acesso");
  assert.deepEqual(cena.initial, { x: 1000, y: 900, scale: 0.6 });
  // Ponto e desafio casam pelo id ou pelo nome; o que não existe nesta geração fica de fora.
  assert.equal(cena.notes.length, 3);
  assert.equal(new Set(cena.notes.map((n) => n._id)).size, 3);
  assert.equal(cena.notes.filter((n) => n.text === molho.name).length, 2);
  const nota = cena.notes.find((n) => n.text === molho.name);
  assert.equal(nota.flags["ordem-paranormal-2e"].marcador, `Item.${molho._id}`);
  assert.equal(nota.author, null);
  assert.equal(nota.global, true);
  assert.equal(nota.texture.src, molho.img);
  assert.deepEqual([nota.x, nota.y], [120, 340]);
  assert.equal(cena.notes.find((n) => n.text === porta.name).flags["ordem-paranormal-2e"].marcador, `Item.${porta._id}`);
  assert.equal(cena.tokens.length, 1);
  assert.equal(cena.tokens[0].actorId, "a1");
  assert.equal(cena.tokens[0].actorLink, true);
  assert.deepEqual([cena.tokens[0].x, cena.tokens[0].y], [700, 800]);
  assert.match(cena.tokens[0].texture.src, /token-alan\.png$/);
  // Ids estáveis: capturar de novo não duplica marcador nem token.
  assert.equal(montarAtoI(extraidoAtoI(), fontes).scenes[0].notes[0]._id, cena.notes[0]._id);
  // Pelo id desta geração, mesmo com o nome diferente do que está gravado.
  const porId = montarAtoI(extraidoAtoI(), { ...fontes, posicoes: { marcadores: [{ nome: "nome velho", id: molho._id, x: 5, y: 6 }] } }).scenes[0];
  assert.equal(porId.notes.length, 1);
  assert.equal(porId.notes[0].text, molho.name);
});

test("montarAtoI: ids estáveis entre duas montagens", () => {
  const a = montarAtoI(extraidoAtoI(), fontesAtoI());
  const b = montarAtoI(extraidoAtoI(), fontesAtoI());
  assert.equal(a._id, b._id);
  assert.deepEqual(a.items.map((i) => i._id), b.items.map((i) => i._id));
});

/** Um Ato II mínimo, no formato de `extrairAtoII().dados`. */
const dadosAtoII = () => ({
  aberturaDoAto: ["O Ato II continua."], preparacao: ["Prepare."], vitoria: ["Vença."], introducao: ["Intro."],
  cenaInicial: ["Cena."], pontosIntro: [], novasDescobertas: [], pertencesIntro: [], porao: [], salaSecreta: [],
  caixaMaldicao: ["Se quebrarem o Ídolo…"], narracaoFinal: ["Fim."], fugindo: [], respostaCorreta: ["Zumbi."],
  mecanicasIntro: [], mecanicas: [
    { chave: "camera", titulo: "CÂMERA MODIFICADA", paragrafos: ["Ao tirar uma foto, envie ao jogador o handout: HANDOUT 03 - FOTO DO ALTAR DE MADEIRA Caso não consiga."] },
    { chave: "laser", titulo: "LASER DE VARREDURA", paragrafos: ["Entregue o Handout 02A - Laser Porão ou o Handout 02B - Laser Sala Secreta."] },
  ],
  matriz: { 7: ["camera", "laser"] }, leituraNormal: [8], laser: { porao: [7], salaSecreta: [] },
  legenda: { 7: "O ÍDOLO DE PEDRA", 8: "DEPÓSITO A" },
  pontos: [
    {
      numero: 7, nome: "O ÍDOLO DE PEDRA", descricao: "Uma estatueta.", notas: ["Nota."], desafio: null,
      informacoes: [{ pericia: "Ocultismo", chave: "ocultismo", dt: 10, texto: "É antiga.", condicao: "" }],
      ferramentas: [{ chave: "camera", rotulo: "Câmera Modificada", texto: "Envie ao jogador o handout: HANDOUT 03 - FOTO DO ALTAR DE MADEIRA Caso não consiga, descreva.", handouts: ["HANDOUT 03 - FOTO DO ALTAR DE MADEIRA"] }],
      handoutsCitados: [], leituraNormal: "",
    },
    { numero: 8, nome: "DEPÓSITO A", descricao: "Um depósito.", notas: [], desafio: null, informacoes: [], ferramentas: [], handoutsCitados: [], leituraNormal: "Todas as ferramentas resultam em leitura normal." },
  ],
});

const fontesAtoII = () => ({
  atoIPontos: [], atoIMaldicao: null,
  ferramentas: [{ _id: "f1", name: "Câmera Modificada", type: "ferramenta", system: { subtipo: "camera" } }],
  agentes: [{ _id: "g1", name: "Amanda", type: "personagem", system: {}, items: [] }],
  cena: { _id: "c2", name: "O Porão", walls: [] },
});

test("montarAtoII: o Rádio da revisão 1.1 se contradiz (\"SEU FILHO,\" vs \"sua filha\") — aviso, não erro", () => {
  const dados = dadosAtoII();
  const conjuntos = ["SEU FILHO,", "ELOÍSA", "ESTAMOS APENAS NOS DEFENDENDO", "NÃO TEMOS ESCOLHA"];
  dados.pontos[0].ferramentas.push({
    chave: "radio", rotulo: "Rádio Modificado", texto: "", handouts: [],
    radio: { conjuntos, solucao: "Alan: sua filha Eloísa, estamos apenas nos defendendo." },
  });
  const avisos = [];
  const aventura = montarAtoII(dados, fontesAtoII(), { avisos });
  const radio = aventura.items.find((i) => i.name === "O Ídolo de Pedra").system.ferramentas.radio;
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /O Ídolo de Pedra: o Rádio imprime "SEU FILHO," no conjunto e "sua filha" na solução/);
  assert.equal(radio.conjuntos[0].verdadeiro, true);
  assert.equal(radio.conjuntos[0].frase, "SEU FILHO, | ELOÍSA | ESTAMOS APENAS NOS DEFENDENDO");
  assert.deepEqual(radio.conjuntos.filter((c) => !c.verdadeiro).map((c) => c.frase), ["NÃO TEMOS ESCOLHA"]);
  // Sem a contradição, nenhum aviso — e a mesma ordem.
  const limpos = [];
  dados.pontos[0].ferramentas.at(-1).radio.solucao = "Alan: seu filho, Eloísa, estamos apenas nos defendendo.";
  montarAtoII(dados, fontesAtoII(), { avisos: limpos });
  assert.deepEqual(limpos, []);
});

test("montarAtoII: o handout citado solto no texto ganha a imagem, com o número desta revisão do livro", () => {
  const aventura = montarAtoII(dadosAtoII(), fontesAtoII());
  const idolo = aventura.items.find((i) => i.name === "O Ídolo de Pedra");
  assert.match(idolo.system.ferramentas.camera, /handout-03-foto-do-altar-de-madeira\.png/);
  assert.match(idolo.system.ferramentas.laser, /handout-02a-laser-porao\.jpg/);
  const handouts = aventura.journal.find((j) => j.name === "Handouts — Ato II");
  const altar = handouts.pages.find((p) => p.name.startsWith("Foto do Altar"));
  assert.equal(altar.name, "Foto do Altar de Madeira (Handout 03)");
  const laser = handouts.pages.find((p) => p.name.startsWith("Varredura do Laser — Porão"));
  assert.equal(laser.name, "Varredura do Laser — Porão (Handout 02A)");
  // As artes vêm do zip: a aventura declara o que espera.
  const extras = aventura.flags["ordem-paranormal-2e"].extras;
  assert.equal(extras.pasta, "ato-ii");
  assert.ok(extras.arquivos.some((a) => a.destino === "mapas/mapa-01-o-porao.jpg"));
  // Os handouts do Ato I que o Ato II cita: o importador troca o prefixo deles também.
  assert.deepEqual(extras.tambem, [{ prefixo: "systems/ordem-paranormal-2e/assets/ato-i/", pasta: "ato-i" }]);
});

test("alinharNiveis: a cena que chega usa o nível da cena que já existe, e parede presa a nível inexistente vai para ele", () => {
  const cena = () => ({
    levels: [{ _id: "novo", name: "Porão" }],
    initialLevel: "defaultLevel0000",
    walls: [{ _id: "a", levels: ["defaultLevel0000"] }, { _id: "b", levels: [] }, { _id: "c", levels: ["novo"] }],
    lights: [{ _id: "l", levels: ["outro"] }],
    tokens: [{ _id: "t", levels: ["novo", "defaultLevel0000"] }],
  });
  // Reimportação: o mundo tem a cena no `defaultLevel0000` (o mestre vê por ele).
  const c1 = cena();
  assert.deepEqual(alinharNiveis(c1, ["defaultLevel0000"]), { niveis: 1, referencias: 3 });
  assert.equal(c1.levels[0]._id, "defaultLevel0000");
  assert.deepEqual(c1.walls.map((w) => w.levels), [["defaultLevel0000"], [], ["defaultLevel0000"]]);
  assert.deepEqual(c1.lights[0].levels, ["defaultLevel0000"]);
  assert.deepEqual(c1.tokens[0].levels, ["defaultLevel0000"]);
  assert.equal(c1.initialLevel, "defaultLevel0000");
  // Primeira importação: o nível é o que chega; só a referência solta muda.
  const c2 = cena();
  assert.deepEqual(alinharNiveis(c2, []), { niveis: 0, referencias: 3 });
  assert.equal(c2.levels[0]._id, "novo");
  assert.deepEqual(c2.walls.map((w) => w.levels), [["novo"], [], ["novo"]]);
  assert.equal(c2.initialLevel, "novo");
  // Cena sem níveis (o servidor sintetiza): referência a nível vira "todos".
  const c3 = { walls: [{ _id: "a", levels: ["defaultLevel0000"] }] };
  assert.deepEqual(alinharNiveis(c3, ["x"]), { niveis: 0, referencias: 1 });
  assert.deepEqual(c3.walls[0].levels, []);
});
