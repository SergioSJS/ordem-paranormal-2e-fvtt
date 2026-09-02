/**
 * Monta a aventura do Ato I: um documento `Adventure` que traz cena, trilha,
 * pré-gerados, handouts, pontos de interesse, desafios e a investigação — tudo numa
 * importação só, já amarrado.
 *
 * O que é publicado e o que não é
 * ------------------------------
 * Os arquivos liberados do Ato I trazem mapas, handouts, trilha e fichas prontas. O
 * TEXTO da aventura não é público: as DTs, as perícias de cada linha do quadro e o que
 * cada pista revela estão no material do mestre, que não é nosso para redistribuir.
 *
 * Então os pontos de interesse vêm com nome, descrição do que se vê e o handout já
 * ligado — e com o quadro de informações VAZIO, para o mestre preencher com o texto
 * dele. Os desafios idem: existem porque o mapa mostra a sala secreta e o duto, com as
 * abordagens que fazem sentido no desenho, e DT padrão para o mestre ajustar.
 *
 *   node scripts/ato-i/gerar-aventura.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const FONTES = "packs/sources";
const DESTINO = join(FONTES, "ato-i-aventura", "ato-i.json");
const ident = (semente) => createHash("sha1").update(semente).digest("hex").slice(0, 16);

const ler = (pasta) => readdirSync(join(FONTES, pasta))
  .filter((a) => a.endsWith(".json"))
  .map((a) => JSON.parse(readFileSync(join(FONTES, pasta, a), "utf8")));

/** Remonta a cena: a fonte guarda arrays de id e os documentos em arquivos à parte. */
function cenaCompleta() {
  const arquivos = ler("ato-i-cenas");
  const cena = arquivos.find((d) => d._key.startsWith("!scenes!"));
  const embutidos = {};
  for (const doc of arquivos) {
    const m = /^!scenes\.([a-z]+)!/.exec(doc._key);
    if (m) (embutidos[m[1]] ??= []).push(semChave(doc));
  }
  return { ...semChave(cena), ...embutidos };
}

const semChave = ({ _key, ...resto }) => resto;

const EXTRAIDOS = "build/ato-i-pontos.json";

/** Handout pelo número que o texto cita ("Mostre o HANDOUT 02 - …"). */
const HANDOUTS = readdirSync("docs/Arquivos para o público - Ato I/Handouts")
  .filter((a) => /\.(png|jpg|jpeg)$/i.test(a))
  .reduce((mapa, arquivo) => {
    const n = /^Handout (\d+)/i.exec(arquivo)?.[1];
    if (n) (mapa[Number(n)] ??= []).push(arquivo);
    return mapa;
  }, {});

const semAcento = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Palavras que distinguem um ponto do outro — o resto é cola. */
const CHAVES_FRACAS = new Set(["de", "do", "da", "dos", "das", "e", "o", "a", "os", "as",
  "no", "na", "em", "um", "uma", "poster", "handout", "foto", "conversa"]);
const palavras = (t) => new Set(semAcento(t).toLowerCase().split(/[^a-z0-9]+/)
  .filter((w) => w.length > 2 && !CHAVES_FRACAS.has(w)));
/** Quanto o título impresso do handout combina com o nome do ponto. */
function afinidade(arquivo, nome) {
  const alvo = palavras(nome);
  return [...palavras(arquivo.replace(/^Handout \d+[A-C]?\s*-?\s*/i, "").replace(/\.\w+$/, ""))]
    .filter((w) => alvo.has(w)).length;
}
const arquivoPublico = (nome) => semAcento(nome).toLowerCase()
  .replace(/[^a-z0-9.]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

/**
 * Pontos de interesse do porão, extraídos do PDF do playtest.
 *
 * O texto é da editora: `pontos-extraidos.json` não vai para o repositório (ver
 * `.gitignore`), e quem tem o PDF gera com `npm run ato-i:extrair`.
 */
function pontosBrutos() {
  if (!existsSync(EXTRAIDOS)) {
    console.warn("Sem build/ato-i-pontos.json — rode `npm run ato-i:extrair` com o PDF em docs/.");
    return [];
  }
  return JSON.parse(readFileSync(EXTRAIDOS, "utf8"))
    // "Os Personagens" e "A Sala Secreta" são cabeçalhos de seção do livro, não pontos.
    .filter((p) => !["OS PERSONAGENS", "A SALA SECRETA"].includes(p.nome.toUpperCase()))
    .filter((p) => p.informacoes.length || p.descricao);
}

function pontosDoPorao() {
  const extraidos = pontosBrutos();
  // Quem mais cita cada handout: só há disputa quando dois pontos citam o mesmo.
  const disputam = {};
  for (const p of extraidos) for (const n of p.handouts ?? []) (disputam[n] ??= []).push(p.nome);
  return extraidos
    .map((ponto) => {
      const _id = ident(`poi-ato-i-${ponto.nome}`);
      // "Mostre o HANDOUT 02 - …" no texto da informação vira a imagem na descrição
      // de mestre, que é onde o mestre a encontra na hora de entregar.
      // A citação pode cair no ponto vizinho: a página põe dois pôsteres lado a lado.
      // Quando o título impresso do handout combina melhor com OUTRO ponto, é dele.
      const numeros = (ponto.handouts ?? []).filter((n) => (HANDOUTS[n] ?? []).every((arquivo) => {
        const meu = afinidade(arquivo, ponto.nome);
        const melhor = Math.max(...(disputam[n] ?? [ponto.nome]).map((o) => afinidade(arquivo, o)));
        return meu >= melhor;
      }));
      const imagens = numeros.flatMap((n) => HANDOUTS[n] ?? [])
        .map((a) => `<p><img src="op2-ato-i/handouts/${arquivoPublico(a)}" alt="${a}"></p>`);

      return {
        _id, name: tituloLegivel(ponto.nome), type: "ponto-interesse",
        img: "systems/ordem-paranormal-2e/assets/icons/tipos/ponto-interesse.svg",
        system: {
          descricaoBasica: `<p>${ponto.descricao}</p>`,
          descricaoContextual: imagens.join("\n"),
          informacoes: ponto.informacoes.map((info, indice) => ({
            id: `i${indice + 1}`,
            pericia: info.chave,
            dt: info.dt,
            // A condição da linha ("apenas Victor", "se o ídolo for quebrado") não tem
            // campo no sistema: fica no começo do texto, onde o mestre lê antes de
            // liberar a linha.
            texto: info.condicao ? `<p><em>(${info.condicao})</em> ${info.texto}</p>` : `<p>${info.texto}</p>`,
            oculta: false, aberta: false,
          })),
        },
        effects: [], folder: null, sort: 0, ownership: { default: 0 }, flags: {},
      };
    });
}

/** "DEPÓSITO A, MOLHO DE CHAVES" → "Depósito A, Molho de Chaves". */
function tituloLegivel(nome) {
  // "a" e "o" sozinhos podem ser artigo ou identificador ("Depósito A"): só viram
  // minúscula quando há mais de uma letra.
  const minusculas = new Set(["de", "do", "da", "dos", "das", "no", "na", "em", "ou", "e"]);
  return nome.toLowerCase().split(/\s+/)
    .map((palavra, i) => (i > 0 && minusculas.has(palavra.replace(/[^a-zà-ú]/g, ""))
      ? palavra
      : palavra.charAt(0).toUpperCase() + palavra.slice(1)))
    .join(" ");
}

/**
 * Desafios de acesso do porão, das caixas laterais do PDF.
 *
 * A caixa traz tudo pronto: `ARROMBAR (DT 10, PA 10)`, `DESTRANCAR (senha: 3d6, 3
 * tentativas)`. A senha em si NÃO vem gravada — quem sorteia é o mestre na mesa, com
 * `gerarSenhaDestrancar()`, senão ela viajaria no compêndio à vista de todos.
 *
 * Alcançar não é abordagem de desafio de acesso (spec §7.4: é ação avulsa contra a DT
 * do ambiente), então caixa que só tem Alcançar não vira desafio — a DT fica na nota
 * do mestre do próprio ponto.
 */
function desafioDoPonto(ponto) {
  const d = ponto.desafio;
  if (!d?.arrombar && !d?.destrancar) return null;

  // "Freezer — Cadeado do Freezer" repete: quando o rótulo já cita o ponto, ele basta.
  const ponto_ = tituloLegivel(ponto.nome);
  const rotulo = d.rotulo || "Acesso";
  const nome = rotulo.toLowerCase().includes(ponto_.toLowerCase())
    ? rotulo : `${ponto_} — ${rotulo}`;
  const notas = [
    `<p>${ponto.descricao}</p>`,
    d.item ? `<p>Dispensa o desafio: <em>${d.item}</em>.</p>` : "",
    d.alcancar ? `<p>Antes de arrombar é preciso <strong>Alcançar (DT ${d.alcancar.dt})</strong>.</p>` : "",
    d.destrancar?.tentativas
      ? `<p>Estourar as ${d.destrancar.tentativas} tentativas quebra a fechadura.</p>` : "",
    "<p>A senha ainda não foi sorteada: use <em>Gerar senha</em> na ficha do desafio.</p>",
  ].filter(Boolean).join("\n");

  return {
    _id: ident(`desafio-ato-i-${ponto.nome}`),
    name: nome, type: "desafio-acesso",
    img: "systems/ordem-paranormal-2e/assets/icons/tipos/desafio.svg",
    system: {
      abordagens: {
        arrombar: Boolean(d.arrombar), destrancar: Boolean(d.destrancar),
        hackTecnico: false, hackSocial: false, generico: false,
      },
      generico: { pericia: "atletismo", rotulo: "", resolvido: false },
      dtObjeto: d.arrombar?.dt ?? 7,
      pontuacaoAlvo: d.arrombar?.pa ?? 10,
      pontuacaoAtual: 0,
      // O teto de tentativas do playtest é da fechadura, não do arrombamento.
      maxTentativas: d.destrancar?.tentativas ?? 0,
      tentativasUsadas: 0,
      quebrado: false,
      tamanhoSenha: d.destrancar?.tamanho ?? 4,
      facesSenha: d.destrancar?.faces ?? 6,
      senha: [], destrancarTentativas: 0, destrancado: false, historicoDestrancar: [],
    },
    effects: [], folder: null, sort: 0, ownership: { default: 0 },
    flags: { "ordem-paranormal-2e": { notaDoMestre: notas } },
  };
}

function pontoDeInteresse([nome, handout, descricao]) {
  const _id = ident(`poi-ato-i-${nome}`);
  return {
    _id, name: nome, type: "ponto-interesse",
    img: "systems/ordem-paranormal-2e/assets/icons/tipos/ponto-interesse.svg",
    system: {
      descricaoBasica: descricao,
      // O handout é o que o mestre mostra quando a pista aparece.
      descricaoContextual: `<p>Handout: <em>${handout}</em></p>`
        + `<p><img src="op2-ato-i/handouts/${handout}" alt="${nome}"></p>`,
      informacoes: [],
    },
    effects: [], folder: null, sort: 0, ownership: { default: 0 }, flags: {},
  };
}

function desafio([nome, descricao, abordagens]) {
  const _id = ident(`desafio-ato-i-${nome}`);
  return {
    _id, name: nome, type: "desafio-acesso",
    img: "systems/ordem-paranormal-2e/assets/icons/tipos/desafio.svg",
    system: {
      abordagens,
      dtObjeto: 7, pontuacaoAlvo: 10, pontuacaoAtual: 0,
      maxTentativas: 0, tentativasUsadas: 0, quebrado: false,
      generico: { pericia: "atletismo", rotulo: "Forçar a grade", resolvido: false },
    },
    // A descrição do obstáculo vive no próprio nome e no que o mapa mostra; o resto é
    // texto de mestre.
    effects: [], folder: null, sort: 0, ownership: { default: 0 },
    flags: { "ordem-paranormal-2e": { notaDoMestre: descricao } },
  };
}

const pontos = pontosDoPorao();
const desafios = pontosBrutos().map(desafioDoPonto).filter(Boolean);
const pregerados = ler("ato-i-personagens").map(semChave);
const diarios = ler("ato-i-handouts").map(semChave);
const trilha = ler("ato-i-musicas").map(semChave);
const cena = cenaCompleta();

const investigacao = {
  _id: ident("investigacao-ato-i"),
  name: "O Porão — Ato I",
  type: "investigacao",
  img: "systems/ordem-paranormal-2e/assets/icons/tipos/investigacao.svg",
  system: {
    // Tudo já vinculado: importar a aventura entrega a mesa montada.
    participantes: pregerados.map((a) => `Actor.${a._id}`),
    pois: pontos.map((p) => `Item.${p._id}`),
    desafios: desafios.map((d) => `Item.${d._id}`),
    rodada: 0,
    // "Progressão de referência (a do porão do Ato I/II)" — spec §7.6. A tabela padrão
    // do schema é exatamente essa, então basta ligar.
    sobrecarga: { ativa: true },
  },
  effects: [], folder: null, sort: 0, ownership: { default: 0 }, flags: {},
};

const linhasDeQuadro = pontos.reduce((n, p) => n + p.system.informacoes.length, 0);

const _id = ident("aventura-ato-i");
const aventura = {
  _id, _key: `!adventures!${_id}`,
  name: "Ato I — O Porão",
  img: "op2-ato-i/handouts/handout-02-simbolo-no-teto.jpg",
  caption: "<p>A cena do porão montada: mapa, trilha, pré-gerados, handouts e a investigação já vinculada.</p>",
  description: [
    "<p>Importa a mesa inteira do Ato I: a cena do porão com muros e portas secretas, a",
    "trilha, os cinco pré-gerados, os handouts, os pontos de interesse com o quadro",
    `preenchido, os ${desafios.length} desafios de acesso e uma investigação vinculando tudo.</p>`,
    `<p><strong>${pontos.length} pontos de interesse, ${linhasDeQuadro} linhas de quadro.</strong> Perícia, DT e`,
    "texto de cada pista saem do seu PDF do playtest. As três visibilidades por linha",
    "(rascunho, descobrível, aberta) vêm no padrão: só a descobrível, que é o que",
    "Examinar acha.</p>",
    "<p>Os desafios trazem os números das caixas do livro — DT do objeto, pontuação alvo",
    "e o tamanho da senha. <strong>A senha não vem sorteada</strong>, senão viajaria à",
    "vista dos jogadores: abra a ficha do desafio e use <em>Gerar senha</em>.</p>",
    "<p><strong>Antes de importar, instale as artes.</strong> Mapa, handouts e trilha são",
    "arquivos do pacote público do playtest e não cabem dentro do sistema — quem os copia",
    "para o seu Foundry é <code>npm run ato-i</code>. Sem esse passo, a cena e os",
    "handouts importam sem imagem e a playlist aponta para faixas que não existem.</p>",
  ].join("\n"),
  actors: [...pregerados, investigacao],
  items: [...pontos, ...desafios],
  journal: diarios,
  scenes: [cena],
  playlists: trilha,
  folders: [], macros: [], tables: [], cards: [], combats: [],
  folder: null, sort: 0, ownership: { default: 0 }, flags: {},
};

writeFileSync(DESTINO, `${JSON.stringify(aventura, null, 2)}\n`);
console.log(`${aventura.name} → ${DESTINO}`);
console.log(`  atores ${aventura.actors.length} (${pregerados.length} pré-gerados + investigação)`);
console.log(`  itens ${aventura.items.length} (${pontos.length} pontos, ${desafios.length} desafios)`);
console.log(`  cenas ${aventura.scenes.length}, diários ${aventura.journal.length}, trilhas ${aventura.playlists.length}`);
