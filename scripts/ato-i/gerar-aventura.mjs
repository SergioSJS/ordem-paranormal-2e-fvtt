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
const MALDICAO = "build/ato-i-maldicao.json";
const EXTRAS = "build/ato-i-itens.json";

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
        .map((a) => `<p><img src="systems/ordem-paranormal-2e/assets/ato-i/handouts/${arquivoPublico(a)}" alt="${a}"></p>`);

      // O painel da porta de saída tem senha impressa no livro — não é o minigame de
      // Destrancar, é informação de mestre. Fica na descrição que só ele lê.
      const senha = ponto.desafio?.senhaFixa
        ? `<p><strong>Senha do painel:</strong> ${ponto.desafio.senhaFixa}`
          + `${ponto.desafio.senhaNota ? ` <em>(${ponto.desafio.senhaNota})</em>` : ""}.</p>`
        : "";

      return {
        _id, name: tituloLegivel(ponto.nome), type: "ponto-interesse",
        img: "systems/ordem-paranormal-2e/assets/icons/tipos/ponto-interesse.svg",
        system: {
          descricaoBasica: `<p>${ponto.descricao}</p>`,
          descricaoContextual: [senha, ...imagens].filter(Boolean).join("\n"),
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
  // Alcançar é ação avulsa (spec §7.4) e a senha impressa do painel da saída não é
  // minigame nenhum: nem toda caixa do livro vira desafio de acesso.
  if (!d?.arrombar && !d?.destrancar && !d?.hackTecnico && !d?.hackSocial && !d?.sustentar) {
    return null;
  }

  // "Freezer — Cadeado do Freezer" repete: quando o rótulo já diz de que objeto se
  // trata, ele basta sozinho.
  const ponto_ = tituloLegivel(ponto.nome);
  const rotulo = d.rotulo || "Acesso";
  const repete = [...palavras(rotulo)].some((w) => palavras(ponto_).has(w));
  const nome = repete ? rotulo : `${ponto_} — ${rotulo}`;
  const notas = [
    `<p>${ponto.descricao}</p>`,
    d.item ? `<p>Dispensa o desafio: <em>${d.item}</em>.</p>` : "",
    d.alcancar ? `<p>Antes de arrombar é preciso <strong>Alcançar (DT ${d.alcancar.dt})</strong>.</p>` : "",
    d.destrancar?.tentativas
      ? `<p>Estourar as ${d.destrancar.tentativas} tentativas quebra a fechadura.</p>` : "",
    d.destrancar
      ? "<p>A senha ainda não foi sorteada: use <em>Gerar senha</em> na ficha do desafio.</p>" : "",
    // O painel do Depósito A: o que a rolagem entrega é uma conta para o jogador resolver.
    d.sustentar
      ? "<p>Uma pessoa passa por rodada. Quem sustenta pode passar junto — e o enigma da "
        + `estante precisa ser resolvido antes.</p>${enigmaDaEstante()}` : "",
  ].filter(Boolean).join("\n");

  return {
    _id: ident(`desafio-ato-i-${ponto.nome}`),
    name: nome, type: "desafio-acesso",
    img: "systems/ordem-paranormal-2e/assets/icons/tipos/desafio.svg",
    system: {
      abordagens: {
        arrombar: Boolean(d.arrombar), destrancar: Boolean(d.destrancar),
        hackTecnico: Boolean(d.hackTecnico), hackSocial: Boolean(d.hackSocial),
        sustentar: Boolean(d.sustentar),
        generico: false,
      },
      generico: { pericia: "atletismo", rotulo: "", resolvido: false },
      sustentar: {
        dt: d.sustentar?.dt ?? 7,
        aoFalhar: d.sustentar
          ? "Quem estiver passando é esmagado pela estante e perde 1d4 PV." : "",
      },
      hackTecnico: {
        // A tabela do livro entra como dado: o total do teste escolhe a faixa, e ela diz
        // qual conta o painel devolve — ou quanto tempo o jogador tem para a conta.
        tabela: (d.hackTecnico?.tabela ?? []).map((l) => ({
          rolagem: l.rolagem, desafio: l.equacao, segundos: l.segundos ?? 0,
        })),
        ultimaTentativaRodada: -1, resolvido: false,
      },
      hackSocial: {
        respostasNecessarias: d.hackSocial?.respostasNecessarias ?? 3,
        // O banco de perguntas do celular de Gustavo, direto do livro.
        perguntas: d.hackSocial?.perguntas ?? [],
        ultimaTentativaRodada: -1, resolvido: false,
      },
      dtObjeto: d.arrombar?.dt ?? d.sustentar?.dt ?? 7,
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

/**
 * Pastas da aventura: sem elas o import despeja 28 itens e 6 atores na raiz do
 * diretório. O Foundry cria as pastas junto com o conteúdo, uma árvore por tipo.
 */
const RAIZ = "Ato I — O Porão";
function pasta(tipo, nome, pai = null, sort = 0) {
  return {
    _id: ident(`pasta-${tipo}-${nome}`),
    name: nome, type: tipo, folder: pai,
    sorting: "m", sort, color: "#7f1d1d", description: "", flags: {},
  };
}

const pastas = {
  atores: pasta("Actor", RAIZ),
  itens: pasta("Item", RAIZ),
  diarios: pasta("JournalEntry", RAIZ),
  cenas: pasta("Scene", RAIZ),
  trilhas: pasta("Playlist", RAIZ),
};
pastas.pregerados = pasta("Actor", "Pré-gerados", pastas.atores._id, 100);
pastas.pontos = pasta("Item", "Pontos de Interesse", pastas.itens._id, 100);
pastas.desafios = pasta("Item", "Desafios de Acesso", pastas.itens._id, 200);

/** Põe o documento na pasta e devolve ele — o import respeita o campo `folder`. */
const em = (destino) => (doc) => ({ ...doc, folder: destino._id });

/** A faca de churrasco e os dois molhos de chaves, do texto do livro. */
function itensDoPorao() {
  if (!existsSync(EXTRAS)) return [];
  return JSON.parse(readFileSync(EXTRAS, "utf8")).itens.map((item) => ({
    _id: ident(`item-ato-i-${item.nome}`),
    name: tituloLegivel(item.nome), type: "equipamento",
    img: "systems/ordem-paranormal-2e/assets/icons/tipos/equipamento.svg",
    system: {
      quantidade: 1, equipado: false,
      descricao: `<p>${item.descricao}</p>`,
      // "Se acertar um ataque com ela, você causa dano igual à sua RA +2": é arma.
      arma: /pode ser usada como arma/i.test(item.descricao),
      cargas: { usa: false, value: 0, max: 0 },
    },
    effects: [], folder: null, sort: 0, ownership: { default: 0 }, flags: {},
  }));
}

function regrasDaMaldicao() {
  if (!existsSync(MALDICAO)) return null;
  return JSON.parse(readFileSync(MALDICAO, "utf8")).regras ?? null;
}

/** As regras da maldição que não cabem em campo nenhum: um diário só do mestre. */
function diarioDaMaldicao() {
  if (!existsSync(MALDICAO)) return null;
  const { regras, eventos } = JSON.parse(readFileSync(MALDICAO, "utf8"));
  if (!regras?.ativacao) return null;

  const pagina = (nome, texto, ordem) => ({
    _id: ident(`pagina-maldicao-${nome}`),
    name: nome, type: "text", title: { show: true, level: 1 },
    text: { format: 1, content: texto },
    image: {}, video: {}, src: null, system: {},
    sort: ordem * 100, ownership: { default: -1 }, flags: {},
  });

  const linhas = eventos.map((e) => `<tr><td>${e.rodada}</td><td>${
    [e.narracao && `<em>“${e.narracao}”</em>`, e.efeito].filter(Boolean).join("<br>")}</td></tr>`).join("");

  return {
    _id: ident("diario-maldicao"),
    name: "A Maldição do Ídolo de Pedra",
    // Só o mestre: é a mecânica que ele dispara, não material de jogador.
    ownership: { default: 0 },
    pages: [
      pagina("Ativação", `<p><em>“${regras.narracao}”</em></p><p>${regras.ativacao}</p>`, 1),
      pagina("Rodada a rodada", `<table><thead><tr><th>Rodada</th><th>O que acontece</th></tr></thead>`
        + `<tbody>${linhas}</tbody></table>`, 2),
      ...(regras.caixas ?? []).map((c, i) => pagina(c.titulo, `<p>${c.texto}</p>`, 3 + i)),
    ],
    folder: null, sort: 0, flags: {},
  };
}

/** O enigma da estante: quais livros abrem a passagem. */
function enigmaDaEstante() {
  if (!existsSync(EXTRAS)) return "";
  const livros = JSON.parse(readFileSync(EXTRAS, "utf8")).enigmaDaEstante ?? [];
  if (!livros.length) return "";
  return `<p><strong>Livros que abrem a passagem:</strong></p><ul>${livros
    .map((l) => `<li>Prateleira ${l.prateleira} — ${l.livro}</li>`).join("")}</ul>`;
}

const pontos = pontosDoPorao().map(em(pastas.pontos));
const desafios = pontosBrutos().map(desafioDoPonto).filter(Boolean).map(em(pastas.desafios));
const itens = itensDoPorao().map(em(pastas.itens));
const pregerados = ler("ato-i-personagens").map(semChave).map(em(pastas.pregerados));
const diarios = [...ler("ato-i-handouts").map(semChave), diarioDaMaldicao()]
  .filter(Boolean).map(em(pastas.diarios));
const trilha = ler("ato-i-musicas").map(semChave).map(em(pastas.trilhas));
const cena = em(pastas.cenas)(cenaCompleta());

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
    // "A Dívida Precisa Ser Paga": o que o mestre lê e aplica em cada rodada marcada.
    eventos: existsSync(MALDICAO)
      ? JSON.parse(readFileSync(MALDICAO, "utf8")).eventos.map((e) => ({
        rodada: e.rodada,
        narracao: e.narracao ? `<p>${e.narracao}</p>` : "",
        // A rodada 0 é a ativação: o efeito completo está no texto que vem antes da
        // tabela ("teste de Disciplina (DT 7)…"), não na célula.
        efeito: e.rodada === 0 && regrasDaMaldicao()?.ativacao
          ? `<p>${regrasDaMaldicao().ativacao}</p>`
          : (e.efeito ? `<p>${e.efeito}</p>` : ""),
      }))
      : [],
  },
  effects: [], folder: pastas.atores._id, sort: 0, ownership: { default: 0 }, flags: {},
};

const linhasDeQuadro = pontos.reduce((n, p) => n + p.system.informacoes.length, 0);

const _id = ident("aventura-ato-i");
const aventura = {
  _id, _key: `!adventures!${_id}`,
  name: "Ato I — O Porão",
  img: "systems/ordem-paranormal-2e/assets/ato-i/handouts/handout-02-simbolo-no-teto.jpg",
  caption: "<p>A cena do porão montada: mapa, trilha, pré-gerados, handouts e a investigação já vinculada.</p>",
  description: [
    "<p>Importa a mesa inteira do Ato I: a cena do porão com muros e portas secretas, a",
    "trilha, os cinco pré-gerados, os handouts, os pontos de interesse com o quadro",
    `preenchido, os ${desafios.length} desafios de acesso e uma investigação vinculando tudo.</p>`,
    `<p><strong>${pontos.length} pontos de interesse, ${linhasDeQuadro} linhas de quadro.</strong> Perícia, DT e`,
    "texto de cada pista saem do livro do playtest. As três visibilidades por linha",
    "(rascunho, descobrível, aberta) vêm no padrão: só a descobrível, que é o que",
    "Examinar acha.</p>",
    "<p>Os desafios trazem os números das caixas do livro — DT do objeto, pontuação alvo",
    "e o tamanho da senha. <strong>A senha não vem sorteada</strong>, senão viajaria à",
    "vista dos jogadores: abra a ficha do desafio e use <em>Gerar senha</em>.</p>",
  ].join("\n"),
  actors: [...pregerados, investigacao],
  items: [...pontos, ...desafios, ...itens],
  journal: diarios,
  scenes: [cena],
  playlists: trilha,
  folders: Object.values(pastas), macros: [], tables: [], cards: [], combats: [],
  folder: null, sort: 0, ownership: { default: 0 }, flags: {},
};

writeFileSync(DESTINO, `${JSON.stringify(aventura, null, 2)}\n`);
console.log(`${aventura.name} → ${DESTINO}`);
console.log(`  atores ${aventura.actors.length} (${pregerados.length} pré-gerados + investigação)`);
console.log(`  itens ${aventura.items.length} (${pontos.length} pontos, ${desafios.length} desafios, ${itens.length} de mesa)`);
console.log(`  cenas ${aventura.scenes.length}, diários ${aventura.journal.length}, trilhas ${aventura.playlists.length}`);
console.log(`  pastas ${aventura.folders.length} (${RAIZ} em cada diretório)`);
