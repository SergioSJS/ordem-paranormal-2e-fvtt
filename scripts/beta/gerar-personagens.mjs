/**
 * Gera os pré-gerados do modo Vigília a partir da leitura das fichas
 * (`jambo-arquivos/playtest2/v1/extraido/dados/fichas.json`).
 *
 * Grava em `packs/sources/`, versionado como os do alpha: entram só números, nomes e as
 * habilidades com as nossas palavras. O histórico não: é texto do livro, e o PDF das fichas
 * vem no zip da editora. Atributo de cada perícia sai da p. 9 do livro, não da ficha impressa,
 * que erra em Cavan e Cormac (docs/regras/LACUNAS.md).
 *
 *   node scripts/beta/gerar-personagens.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { ident } from "../../module/aventura/comum.mjs";
import { PERICIAS } from "../../module/config.mjs";

const FICHAS = "jambo-arquivos/playtest2/v1/extraido/dados/fichas.json";
const SAIDA = "packs/sources/vigilia-personagens";
const SAIDA_HAB = "packs/sources/habilidades-vigilia";
const ASSETS = "systems/ordem-paranormal-2e/assets";

/** As habilidades, com as nossas palavras (beta §12). `efeito` é o que o motor oferece no teste. */
const HABILIDADES = {
  "ANÁLISE": { nome: "Análise", origem: "perfil", perfil: "analista", mecanica: "analise",
    descricao: "<p>Gaste uma ação para ganhar <strong>2 marcadores</strong> (máximo 4; somem no fim da cena). Depois de rolar um teste, cada marcador gasto muda um dado em +1 ou –1, até o máximo dele.</p>" },
  "LEITURA DE COMBATE": { nome: "Leitura de Combate", origem: "ocupacao", mecanica: "leitura-combate",
    descricao: "<p>Em combate, gastar uma ação para se defender dá 1 marcador de análise.</p>" },
  "SEGREDO DO AÇO": { nome: "Segredo do Aço", origem: "ocupacao", mecanica: "segredo-aco",
    descricao: "<p>Sabe usar equipamento marcial. Item vestido que dá pontos de armadura dá 1 ponto a mais.</p>" },
  "PRONTIDÃO": { nome: "Prontidão", origem: "perfil", perfil: "vigilante", mecanica: "prontidao",
    descricao: "<p>Uma vez por rodada, por 2 PD: rola de novo um dado que não tenha dado 1, num teste seu ou de outro ser em alcance curto. Em combate, pode agir na fase da ação ou em fases posteriores, depois de qualquer ação daquela fase já rolada.</p>" },
  "ESQUIVA": { nome: "Esquiva", origem: "ocupacao",
    descricao: "<p>Uma vez por rodada, ao sofrer um ataque, como ação livre: teste de Acrobacia oposto ao de ataque. Vencendo, evita o ataque.</p>" },
  "ESPECTRO, O LOBO": { nome: "Parceiro lobo", origem: "ocupacao", efeito: { tipo: "dado-extra", dado: "d6", chaves: ["luta"] },
    descricao: "<p>Um lobo companheiro dá +d6 nos ataques corpo a corpo. Se esse dado der 1, o lobo se machuca e não ajuda mais até o fim da cena.</p>" },
  "ÍMPETO": { nome: "Ímpeto", origem: "perfil", perfil: "executor", impeto: { espacos: 5, preenchidos: 0 },
    descricao: "<p>Uma barra de cinco espaços, que enche um a cada teste falho. Ação livre: 1 espaço dá +d4 num teste; 3 espaços sobem um atributo em um passo até o fim da cena; 3 espaços dão uma ação extra em cena de conflito. A barra esvazia no fim da cena.</p>" },
  "ÍMPETO FERVILHANTE": { nome: "Ímpeto Fervilhante", origem: "ocupacao",
    descricao: "<p>No início de cada cena, a barra de ímpeto ganha um espaço.</p>" },
  "ANTECIPAÇÃO TÁTICA": { nome: "Antecipação Tática", origem: "ocupacao",
    descricao: "<p>No início de um combate, por 2 PD: uma rodada para agir antes de todos.</p>" },
  "SORRATEIRO": { nome: "Sorrateiro", origem: "ocupacao", custo: "3 PD", custoPD: 3, efeito: { tipo: "dado-extra", dado: "d8", chaves: ["crime", "furtividade"] },
    descricao: "<p>Em teste de Crime ou Furtividade, por 3 PD: +d8.</p>" },
  "GUARDIÃ": { nome: "Guardiã", origem: "ocupacao",
    descricao: "<p>+1 PV por patamar (já na ficha). Uma vez por rodada, por 2 PD: toma para si o ataque contra um aliado em alcance curto.</p>" },
  "INSTINTO DE SOBREVIVÊNCIA": { nome: "Instinto de Sobrevivência", origem: "ocupacao", efeito: { tipo: "passo", passos: 1 },
    descricao: "<p>Com metade ou menos dos PV máximos, um passo a mais em todos os testes. Marque no teste.</p>" },
  "CURANDEIRO": { nome: "Curandeiro", origem: "ocupacao",
    descricao: "<p>Ação e 2 PD: teste de Medicina DT 7 para curar o aliado em PV iguais à RA. Uma vez por alvo na cena.</p>" },
  "MENTORIA": { nome: "Mentoria", origem: "ocupacao",
    descricao: "<p>Ao ajudar, teste a mesma perícia contra DT 7. Passando, o ajudado troca um dado dele pela sua rolagem alta.</p>" },
  "HERANÇA": { nome: "Herança", origem: "ocupacao",
    descricao: "<p>Categoria de riqueza +1. A compra de itens ainda não saiu; por ora, o equipamento da ficha já conta com isso.</p>" },
  "PLANO ESTRATÉGICO": { nome: "Plano Estratégico", origem: "ocupacao",
    descricao: "<p>Ação e 3 PD: teste de Aptidão (Guerra) DT 7. Passando, o grupo ganha d6, mais d6 a cada 3 de excedente, para gastar em qualquer teste até o fim da cena.</p>" },
  "ARSENAL DE HERBORISTA": { nome: "Arsenal de Herborista", origem: "ocupacao",
    descricao: "<p>Bolsa de preparados de uso único; aplicar gasta uma ação.</p><ul><li><strong>Tônico:</strong> o alvo sobe Físico um passo por uma cena.</li><li><strong>Bálsamo:</strong> recupera 2d4 PV (outro ser precisa ficar parado na rodada).</li><li><strong>Pote de vespas:</strong> ataque à distância com Sobrevivência, dano RA+1; o alvo vivo perde a próxima ação.</li></ul>" },
};

/** O equipamento de cada um, em campos (beta §12). */
const EQUIPAMENTOS = {
  rhiona: [{ nome: "Martelo de forja", ataque: { tipo: "corpo", bonusDano: 3 } }, { nome: "Tenaz de ferreiro" }],
  rowan: [{ nome: "Arco curto de teixo", ataque: { tipo: "distancia", bonusDano: 1 } }, { nome: "Lança de javali", ataque: { tipo: "corpo", bonusDano: 2 }, nota: "Um passo a mais no primeiro ataque da cena." }],
  muirenn: [{ nome: "Faca ritualística", ataque: { tipo: "corpo", bonusDano: 0, pequena: true } }, { nome: "Maleta de medicamentos" }],
  cavan: [{ nome: "Porrete", ataque: { tipo: "corpo", bonusDano: 1 } }],
  malik: [{ nome: "Arco composto", ataque: { tipo: "distancia", bonusDano: 1 } }, { nome: "Diário de viagem" }],
  sira: [{ nome: "Machado de batalha", ataque: { tipo: "corpo", bonusDano: 3 } }],
  sorcha: [
    { nome: "Lança", ataque: { tipo: "corpo", bonusDano: 2 }, nota: "Um passo a mais no primeiro ataque contra quem ainda não a atacou." },
    { nome: "Escudo", nota: "Perdendo teste oposto de ataque com 7 ou mais no seu, reduz o dano pela sua rolagem baixa." },
    { nome: "Elmo aberto", armadura: 1, passos: "percepcao -1" },
  ],
  cormac: [
    { nome: "Espada forjada em castelo", ataque: { tipo: "corpo", bonusDano: 3, minimoCritico: 5 } },
    { nome: "Cota de malha", armadura: 2, passos: "furtividade -1" },
  ],
};

const CHAVE_PERICIA = {
  ACROBACIA: "acrobacia", ANIMAIS: "animais", ATLETISMO: "atletismo", CRIME: "crime", DISCIPLINA: "disciplina",
  "ENGANAÇÃO": "enganacao", FURTIVIDADE: "furtividade", INSPECIONAR: "pesquisar", INTIMIDAR: "intimidar",
  "INTUIÇÃO": "intuicao", LUTA: "luta", MEDICINA: "medicina", OCULTISMO: "ocultismo", "OFÍCIO": "oficio",
  "PERCEPÇÃO": "percepcao", "PERSUASÃO": "persuasao", PONTARIA: "pontaria", "SOBREVIVÊNCIA": "sobrevivencia", VIGOR: "vigor",
};
const SEM_ACENTO = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");

const curto = (nome) => {
  const n = nome.replace(/^Irmão\s+/, "").split(/\s+/)[0];
  return SEM_ACENTO(n).toLowerCase();
};
const ARQUIVO_TOKEN = { rhiona: "rhionna" };

const fichas = JSON.parse(readFileSync(FICHAS, "utf8"));
mkdirSync(SAIDA, { recursive: true });
mkdirSync(SAIDA_HAB, { recursive: true });
const iconeHab = `${ASSETS}/icons/tipos/habilidade.svg`;
const vistas = new Map();

function habilidadeDe(chave) {
  const h = HABILIDADES[chave];
  if (!h) throw new Error(`habilidade sem texto próprio: ${chave}`);
  return {
    _id: ident(`hab-vigilia-${chave}`),
    name: h.nome, type: "habilidade", img: iconeHab,
    system: {
      origem: h.origem, perfil: h.perfil ?? "", custo: h.custo ?? "", custoPD: h.custoPD ?? 0, descricao: h.descricao,
      mecanica: h.mecanica ?? "",
      efeito: { tipo: "nenhum", passos: 1, dado: "d6", chaves: [], permitirD20: false, pdAoDescobrir: 0, ...(h.efeito ?? {}) },
      impeto: h.impeto ?? { espacos: 0, preenchidos: 0 },
      usoEmInvestigacao: "",
    },
    effects: [], folder: null, sort: 0, ownership: { default: 0 }, flags: {},
  };
}

/**
 * O que a revisão 1.1 das fichas corrigiu (Fichas dos Personagens 1.1, no zip da editora): o dado
 * da perícia. A leitura das fichas é da 1.0; o resto não mudou. Mundos já importados recebem o
 * mesmo por `correcaoDoPregerado` (module/aventura/importacao.mjs), que usa esta tabela.
 */
import { PERICIAS_DA_REVISAO_1_1 } from "../../module/aventura/revisao-beta.mjs";

for (const f of fichas) {
  const nomeCurto = curto(f.nome);
  const pericias = Object.fromEntries(Object.entries(PERICIAS).map(([chave, def]) => [chave, { die: "d4", atributo: def.atributo, stepMod: 0 }]));
  const aptidoes = Object.fromEntries(["artes", "erudicao", "folclore", "guerra", "nobreza", "religiao"].map((s) => [s, { rotulo: "", die: "d4" }]));
  for (const p of f.pericias) {
    const m = /^APTIDÃO \((.+)\)$/.exec(p.nome.trim());
    if (m) {
      const sub = SEM_ACENTO(m[1]).toLowerCase();
      if (!aptidoes[sub]) throw new Error(`${f.nome}: Aptidão desconhecida: ${m[1]}`);
      aptidoes[sub].die = p.dado;
      continue;
    }
    // "APTIDÃO" sem campo é a linha de quem não tem nenhuma: d4 em todas, que é o padrão.
    if (p.nome.trim() === "APTIDÃO") continue;
    const chave = CHAVE_PERICIA[p.nome.replace(/\s*\(.*$/, "").trim()];
    if (!chave) throw new Error(`${f.nome}: perícia desconhecida: ${p.nome}`);
    pericias[chave].die = p.dado;
  }
  for (const [chave, { de, para }] of Object.entries(PERICIAS_DA_REVISAO_1_1[nomeCurto] ?? {})) {
    if (pericias[chave].die !== de) throw new Error(`${f.nome}: ${chave} era ${pericias[chave].die}, a correção 1.1 espera ${de}`);
    pericias[chave].die = para;
  }
  const nomesHab = [...f.habilidades.map((h) => h.nome), ...Object.keys(f.outros_blocos ?? {})];
  const habilidades = nomesHab.map(habilidadeDe);
  for (const h of habilidades) vistas.set(h._id, h);
  const equipamentos = (EQUIPAMENTOS[nomeCurto] ?? []).map((e) => ({
    _id: ident(`equip-vigilia-${nomeCurto}-${e.nome}`),
    name: e.nome, type: "equipamento", img: `${ASSETS}/icons/tipos/equipamento.svg`,
    system: {
      quantidade: 1, equipado: true, arma: Boolean(e.ataque), descricao: e.nota ? `<p>${e.nota}</p>` : "",
      ataque: { tipo: "", bonusDano: 0, bonusTeste: 0, minimoCritico: 0, ignoraRd: 0, pequena: false, ...(e.ataque ?? {}) },
      marcial: false, armadura: e.armadura ?? 0, passos: e.passos ?? "",
      cargas: { usa: false, value: 0, max: 0 },
    },
    effects: [], folder: null, sort: 0, ownership: { default: 0 }, flags: {},
  }));
  const retrato = `${ASSETS}/vigilia/tokens/personagem-${ARQUIVO_TOKEN[nomeCurto] ?? nomeCurto}.webp`;
  const nome = f.nome.split(" — ")[0];
  const _id = ident(`vigilia-pc-${nomeCurto}`);
  const ator = {
    _id, name: nome, type: "personagem", img: retrato,
    system: {
      tipo: "sobrevivente", perfil: f.perfil, ocupacao: f.vocacao.replace(/^./, (l) => l.toUpperCase()), nivel: f.nivel, nex: 0,
      atributos: Object.fromEntries(Object.entries(f.atributos).map(([k, die]) => [k, { die }])),
      pericias, aptidoes,
      recursos: { pv: { value: f.pv, max: f.pv }, pd: { value: f.pd, max: f.pd } },
      patamar: "iniciante",
      // Só o grau e o rótulo: a frase de cada relação é texto do livro, e está no PDF das fichas.
      relacoes: f.relacoes.map((r) => ({ com: r.com, grau: r.grau, rotulo: r.rotulo, invocada: false })),
      biografia: "",
    },
    items: [...habilidades, ...equipamentos],
    prototypeToken: { name: nome, texture: { src: retrato }, depth: 1, actorLink: true, disposition: 1, sight: { enabled: false } },
    effects: [], folder: null, sort: 0, ownership: { default: 0 }, flags: {},
    _key: `!actors!${_id}`,
  };
  writeFileSync(`${SAIDA}/${nomeCurto}.json`, `${JSON.stringify(ator, null, 2)}\n`);
  console.log(`${nome}: ${f.perfil}, ${habilidades.length} habilidades, ${equipamentos.length} itens, ${f.relacoes.length} relações`);
}
for (const h of vistas.values()) {
  const nomeArquivo = SEM_ACENTO(h.name).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  writeFileSync(`${SAIDA_HAB}/${nomeArquivo}.json`, `${JSON.stringify({ ...h, _key: `!items!${h._id}` }, null, 2)}\n`);
}
console.log(`${vistas.size} habilidades no compêndio`);
