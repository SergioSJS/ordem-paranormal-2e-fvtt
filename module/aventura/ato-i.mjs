/**
 * Monta a aventura do Ato I: um documento `Adventure` que traz cena, trilha,
 * pré-gerados, handouts, pontos de interesse, desafios e a investigação — tudo numa
 * importação só, já amarrado.
 *
 * O texto vem do PDF do próprio mestre (`module/extrator/ato-i.mjs`); o resto — a
 * cena com as paredes, os pré-gerados, os handouts, a trilha — vem dos compêndios que
 * o sistema embarca. Esta função só junta: roda no navegador, na janela de aventuras,
 * e no Node, em `scripts/ato-i/gerar-aventura.mjs`.
 *
 * O texto da aventura não é público: as DTs, as perícias de cada linha do quadro e o
 * que cada pista revela são material do livro, que a Licença da Comunidade não deixa
 * redistribuir — por isso a aventura nunca vem pronta no pacote.
 */
import {
  ident, palavras, afinidade, arquivoPublico, tituloLegivel, pasta, em, iconeDoPonto, eventoDaMaldicao,
  arquivosDeHandout,
} from "./comum.mjs";

const RAIZ = "Ato I — O Porão";
const ASSETS = "systems/ordem-paranormal-2e/assets";

/**
 * @param {{pontos?: object[], maldicao?: object|null, itens?: object|null, roteiro?: object|null}} extraido
 *   o que `extrairAtoI` devolve
 * @param {{pregerados: object[], cena: object|null, handouts: object[], trilha: object[]}} fontes
 *   documentos dos compêndios do sistema, sem `_key`
 * @returns {object} o `Adventure`, sem `_key`
 */
export function montarAtoI(extraido, fontes) {
  const { maldicao: dadosDaMaldicao = null, itens: extras = null, roteiro = null } = extraido;
  // Até "Os Personagens" e "A Sala Secreta" entram: parecem cabeçalho de seção, mas o
  // livro põe texto de mesa neles (os corpos como parte da investigação; as
  // instruções de revelar a sala secreta com ou sem luz).
  const extraidos = (extraido.pontos ?? []).filter((p) => p.informacoes.length || p.descricao);
  /** Handout pelo número que o texto cita ("Mostre o HANDOUT 02 - …"). */
  const HANDOUTS = arquivosDeHandout(fontes.handouts ?? []);

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
  // A maldição e a faca de churrasco caíam soltas na raiz do diretório, no meio das
  // duas pastas — ninguém adivinha o que "Molho de Chaves 2" faz ali (achado em uso
  // real). Uma aventura pode ter vários eventos, e cada tipo merece a sua pasta.
  pastas.eventos = pasta("Item", "Eventos", pastas.itens._id, 300);
  pastas.itensDeMesa = pasta("Item", "Itens de Mesa", pastas.itens._id, 400);

  /** As cinco prateleiras inteiras — a lista que o mestre lê em voz alta. */
  function prateleirasDaEstante() {
    const prateleiras = extras?.prateleiras ?? [];
    if (!prateleiras.length) return "";
    return `<p><strong>Os livros de cada prateleira:</strong></p>${prateleiras
      .map((p) => `<p><em>Prateleira ${p.prateleira}</em></p><ul>${p.livros
        .map((l) => `<li>${l}</li>`).join("")}</ul>`).join("")}`;
  }

  /** O enigma da estante: quais livros abrem a passagem. */
  function enigmaDaEstante() {
    const livros = extras?.enigmaDaEstante ?? [];
    if (!livros.length) return "";
    return `<p><strong>Livros que abrem a passagem:</strong></p><ul>${livros
      .map((l) => `<li>Prateleira ${l.prateleira} — ${l.livro}</li>`).join("")}</ul>`;
  }

  /**
   * Desafios de acesso do porão, das caixas laterais do PDF.
   *
   * A caixa traz tudo pronto: `ARROMBAR (DT 10, PA 10)`, `DESTRANCAR (senha: 3d6, 3
   * tentativas)`. A senha em si NÃO vem gravada — quem sorteia é o mestre na mesa, com
   * `gerarSenhaDestrancar()`, senão ela viajaria no compêndio à vista de todos.
   *
   * Alcançar não é abordagem de desafio de acesso (spec §7.4: é ação avulsa contra a
   * DT do ambiente), então caixa que só tem Alcançar não vira desafio — a DT fica na
   * nota do mestre do próprio ponto.
   */
  // O extrator nomeia o desafio pelo ponto; "Edgar e Kênia" é um ponto só, mas só
  // Edgar está acorrentado (achado em uso real).
  const NOMES_DE_DESAFIO = { "Edgar e Kênia — Correntes": "Edgar — Correntes" };

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
      // O que a caixa explica além dos números: arrombar o armário quebra o Ídolo e
      // piora a DT de Pesquisar; o símbolo no teto exige subir no altar molhado.
      d.observacao ? `<p>${d.observacao}.</p>` : "",
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
      name: NOMES_DE_DESAFIO[nome] ?? nome, type: "desafio-acesso",
      img: `${ASSETS}/icons/tipos/desafio.svg`,
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
          // A tabela do livro entra como dado: o total do teste escolhe a faixa, e ela
          // diz qual conta o painel devolve — ou quanto tempo o jogador tem para a conta.
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

  function pontosDoPorao() {
    // Quem mais cita cada handout: só há disputa quando dois pontos citam o mesmo.
    const disputam = {};
    for (const p of extraidos) for (const n of p.handouts ?? []) (disputam[n] ??= []).push(p.nome);
    return extraidos.map((ponto) => {
      const _id = ident(`poi-ato-i-${ponto.nome}`);
      // "FREEZER, O CORPO (requer ter destrancado o freezer)": a condição do ponto
      // inteiro, que o livro imprime ao lado do título.
      const condicaoDoPonto = ponto.condicao
        ? `<p><strong>Requer:</strong> ${ponto.condicao}.</p>` : "";
      // "Mostre o HANDOUT 02 - …" no texto da informação vira a imagem na descrição
      // de mestre, que é onde o mestre a encontra na hora de entregar.
      // A citação pode cair no ponto vizinho: a página põe dois pôsteres lado a lado.
      // Quando o título impresso do handout combina melhor com OUTRO ponto, é dele.
      const numeros = (ponto.handouts ?? []).filter((n) => (HANDOUTS[n] ?? []).every((arquivo) => {
        const meu = afinidade(arquivo, ponto.nome);
        const melhor = Math.max(...(disputam[n] ?? [ponto.nome]).map((o) => afinidade(arquivo, o)));
        return meu >= melhor;
      }));
      const caminhosDeHandout = numeros.flatMap((n) => HANDOUTS[n] ?? [])
        .map((a) => `${ASSETS}/ato-i/handouts/${arquivoPublico(a)}`);
      const imagens = numeros.flatMap((n) => HANDOUTS[n] ?? [])
        .map((a) => `<p><img src="${ASSETS}/ato-i/handouts/${arquivoPublico(a)}" alt="${a}"></p>`);

      // O painel da porta de saída tem senha impressa no livro — não é o minigame de
      // Destrancar, é informação de mestre. Fica na descrição que só ele lê.
      // "CONTEÚDO": o que o mestre lê quando o desafio cai (o corpo no freezer, o
      // ídolo no armário) — com o handout e o teste que vêm junto.
      const conteudo = ponto.conteudo
        ? `<p><strong>Ao abrir:</strong> ${ponto.conteudo}</p>` : "";

      // O texto que o livro põe DEPOIS do quadro: por que aquilo está ali e o que o
      // grupo pode concluir. É leitura de mestre, então vai na descrição contextual.
      const notas = ponto.notas ? `<p>${ponto.notas}</p>` : "";

      // A lista completa dos livros só faz sentido na estante.
      const prateleiras = /estante de livros/i.test(ponto.nome) ? prateleirasDaEstante() : "";

      // Alcançar não vira desafio de acesso (spec §7.4), mas a caixa dele explica o que
      // a mesa precisa saber ("subir no altar molhado e escorregadio") — e essa
      // explicação não pode morrer com a caixa.
      const soAlcancar = ponto.desafio?.observacao
        && !(ponto.desafio.arrombar || ponto.desafio.destrancar || ponto.desafio.hackTecnico
          || ponto.desafio.hackSocial || ponto.desafio.sustentar);
      // Com a DT na frente, como no Ato II: só a explicação deixava o mestre sem o
      // número que a caixa do livro dá (achado na conferência contra o PDF).
      const daCaixa = soAlcancar
        ? `<p>${ponto.desafio.alcancar ? `<strong>Alcançar (DT ${ponto.desafio.alcancar.dt}):</strong> ` : ""}${ponto.desafio.observacao}.</p>`
        : "";

      const senha = ponto.desafio?.senhaFixa
        ? `<p><strong>Senha do painel:</strong> ${ponto.desafio.senhaFixa}`
          + `${ponto.desafio.senhaNota ? ` <em>(${ponto.desafio.senhaNota})</em>` : ""}.</p>`
        : "";

      return {
        _id, name: tituloLegivel(ponto.nome), type: "ponto-interesse",
        // Retrato de quem é, handout do ponto, ou ícone pela palavra-chave: um ícone
        // por ponto, reconhecível numa lista de 31 (achado em uso real).
        img: iconeDoPonto(ponto.nome, {
          handouts: caminhosDeHandout,
          padrao: `${ASSETS}/icons/tipos/ponto-interesse.svg`,
        }),
        system: {
          // A porta do Depósito A é do Depósito A: o ponto lista o próprio desafio.
          desafios: desafioDoPonto(ponto) ? [`Item.${ident(`desafio-ato-i-${ponto.nome}`)}`] : [],
          descricaoBasica: `<p>${ponto.descricao}</p>`,
          descricaoContextual: [condicaoDoPonto, daCaixa, notas, prateleiras, conteudo, senha, ...imagens]
            .filter(Boolean).join("\n"),
          informacoes: ponto.informacoes.map((info, indice) => ({
            id: `i${indice + 1}`,
            pericia: info.chave,
            dt: info.dt,
            // A condição da linha ("apenas Victor", "se o ídolo for quebrado") não
            // tem campo no sistema: fica no começo do texto, onde o mestre lê antes
            // de liberar a linha. "DT 6 ou 10" (o Armário de Ferramentas) idem: o
            // campo guarda a primeira, o texto avisa da segunda.
            texto: prefixoDaLinha(info) + `${info.texto}</p>`,
            // "Só pode ser acessada após cumprir uma condição" (o símbolo do livro):
            // entra como rascunho, que é o estado que Examinar não alcança — o mestre
            // libera quando a condição acontecer. "ou Tecnologia" não é condição de
            // acesso: é perícia alternativa, e a linha segue descobrível.
            oculta: Boolean(info.condicao) && !/^ou /i.test(info.condicao),
            aberta: false,
          })),
        },
        effects: [], folder: null, sort: 0, ownership: { default: 0 }, flags: {},
      };
    });
  }

  /** A faca de churrasco e os dois molhos de chaves, do texto do livro. */
  function itensDoPorao() {
    return (extras?.itens ?? []).map((item) => ({
      _id: ident(`item-ato-i-${item.nome}`),
      name: tituloLegivel(item.nome), type: "equipamento",
      img: `${ASSETS}/icons/tipos/equipamento.svg`,
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

  /**
   * O roteiro do ato — o que o mestre lê para abrir e para fechar a sessão, e como
   * começar. Fica fora de "Pontos de Interesse" no livro, e ficava fora do compêndio.
   */
  function diarioDoRoteiro() {
    const r = roteiro;
    if (!r || (!r.introducao && !r.cenaInicial && !r.narracaoFinal)) return null;

    // O texto vem com uma linha por linha do PDF; parágrafo é o que o livro separa.
    const html = (texto) => texto.split(/\n/).map((l) => l.trim()).filter(Boolean)
      .reduce((ps, linha) => {
        // Linha em CAIXA ALTA curta é subtítulo ("PERSONAGENS ESCAPAM", "TODOS MORREM") —
        // e o livro parte o subtítulo em duas linhas ("PERSONAGENS" / "ESCAPAM"), que
        // são um título só.
        const ultimo = ps[ps.length - 1];
        if (/^[A-ZÁÂÃÉÊÍÓÔÕÚÇ ]{4,40}$/.test(linha)) {
          if (ultimo?.startsWith("<h3")) { ps[ps.length - 1] = ultimo.replace(/<\/h3>$/, ` ${linha}</h3>`); return ps; }
          return [...ps, `<h3>${linha}</h3>`];
        }
        if (ultimo && !ultimo.startsWith("<h3") && !/[.!?…”:]$/.test(ultimo.replace(/<\/p>$/, ""))) {
          ps[ps.length - 1] = ultimo.replace(/<\/p>$/, ` ${linha}</p>`);
          return ps;
        }
        return [...ps, `<p>${linha}</p>`];
      }, []).join("");

    const pagina = (nome, texto, ordem) => ({
      _id: ident(`pagina-roteiro-${nome}`),
      name: nome, type: "text", title: { show: true, level: 1 },
      text: { format: 1, content: html(texto) },
      image: {}, video: {}, src: null, system: {},
      sort: ordem * 100, ownership: { default: -1 }, flags: {},
    });

    return {
      _id: ident("diario-roteiro"),
      name: "Roteiro do Ato I",
      ownership: { default: 0 },
      pages: [
        r.introducao && pagina("Introdução", r.introducao, 1),
        r.cenaInicial && pagina("O Ídolo de Pedra, Ato I", r.cenaInicial, 2),
        r.narracaoFinal && pagina("Narração final", r.narracaoFinal, 3),
      ].filter(Boolean),
      folder: null, sort: 0, flags: {},
    };
  }

  /**
   * A maldição como Item `evento`: as rodadas contam a partir do gatilho, não do
   * começo da cena. No livro ela só começa quando o grupo observa o Ídolo de Pedra —
   * pode ser na rodada 1 ou na 20 (achado em uso real).
   */
  function maldicaoDoAtoI() {
    if (!dadosDaMaldicao) return null;
    return eventoDaMaldicao({
      id: "evento-ato-i-maldicao",
      gatilho: "<p>Quando o grupo <strong>observar o Ídolo de Pedra</strong>. Nesse momento, leia a"
        + " narração da rodada 0 e dispare o evento: a rodada de agora vira a rodada 0 dele.</p>",
      dados: dadosDaMaldicao,
    });
  }

  /** As regras da maldição que não cabem em campo nenhum: um diário só do mestre. */
  function diarioDaMaldicao() {
    const { regras, eventos } = dadosDaMaldicao ?? {};
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
        pagina("Rodada a rodada", "<table><thead><tr><th>Rodada</th><th>O que acontece</th></tr></thead>"
          + `<tbody>${linhas}</tbody></table>`, 2),
        ...(regras.caixas ?? []).map((c, i) => pagina(c.titulo, `<p>${c.texto}</p>`, 3 + i)),
      ],
      folder: null, sort: 0, flags: {},
    };
  }

  const pontos = pontosDoPorao().map(em(pastas.pontos));
  const desafios = extraidos.map(desafioDoPonto).filter(Boolean).map(em(pastas.desafios));
  const itens = itensDoPorao().map(em(pastas.itensDeMesa));
  const maldicao = maldicaoDoAtoI();
  const pregerados = (fontes.pregerados ?? []).map(em(pastas.pregerados));
  const diarios = [...(fontes.handouts ?? []), diarioDoRoteiro(), diarioDaMaldicao()]
    .filter(Boolean).map(em(pastas.diarios));
  const trilha = (fontes.trilha ?? []).map(em(pastas.trilhas));
  const cenas = fontes.cena ? [em(pastas.cenas)(fontes.cena)] : [];

  const investigacao = {
    _id: ident("investigacao-ato-i"),
    name: "O Porão — Ato I",
    type: "investigacao",
    img: `${ASSETS}/icons/tipos/investigacao.svg`,
    system: {
      // Tudo já vinculado: importar a aventura entrega a mesa montada.
      participantes: pregerados.map((a) => `Actor.${a._id}`),
      pois: pontos.map((p) => `Item.${p._id}`),
      desafios: desafios.map((d) => `Item.${d._id}`),
      // Tudo começa oculto dos jogadores: o mestre revela cada ponto quando o grupo
      // chega nele — importado visível, a lista inteira do porão aparecia de cara
      // (achado em uso real).
      poisOcultos: pontos.map((p) => `Item.${p._id}`),
      desafiosOcultos: desafios.map((d) => `Item.${d._id}`),
      rodada: 0,
      // "Progressão de referência (a do porão do Ato I/II)" — spec §7.6. A tabela
      // padrão do schema é exatamente essa, então basta ligar.
      sobrecarga: { ativa: true },
      // "A Dívida Precisa Ser Paga" é um Item de evento: o roteiro conta a partir do
      // gatilho (o grupo observar o Ídolo), não do começo da cena.
      eventos: maldicao ? [`Item.${maldicao._id}`] : [],
    },
    effects: [], folder: pastas.atores._id, sort: 0, ownership: { default: 0 }, flags: {},
  };

  const linhasDeQuadro = pontos.reduce((n, p) => n + p.system.informacoes.length, 0);

  return {
    _id: ident("aventura-ato-i"),
    name: "Ato I — O Porão",
    img: `${ASSETS}/ato-i/handouts/handout-02-simbolo-no-teto.jpg`,
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
    ].join("\n"),
    actors: [...pregerados, investigacao],
    items: [...pontos, ...desafios, ...itens, ...(maldicao ? [em(pastas.eventos)(maldicao)] : [])],
    journal: diarios,
    scenes: cenas,
    playlists: trilha,
    folders: Object.values(pastas), macros: [], tables: [], cards: [], combats: [],
    folder: null, sort: 0, ownership: { default: 0 }, flags: {},
  };
}

/** O começo da linha do quadro: a condição e a segunda DT, quando há. */
function prefixoDaLinha(info) {
  const avisos = [];
  if (info.dtAlternativa) avisos.push(`DT ${info.dt} ou ${info.dtAlternativa}`);
  if (info.condicao) avisos.push(info.condicao);
  return avisos.length ? `<p><em>(${avisos.join("; ")})</em> ` : "<p>";
}
