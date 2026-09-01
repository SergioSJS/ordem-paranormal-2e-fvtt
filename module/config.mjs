/**
 * Constantes de Ordem Paranormal 2 (Playtest Alpha).
 * Todas as chaves em pt-BR; rótulos vêm do i18n.
 */

export const SYSTEM_ID = "ordem-paranormal-2e";
export const I18N = "OP2";

/** Escada de dados. A ordem é a própria mecânica: subir/descer é andar no índice. */
export const ESCADA = ["d4", "d6", "d8", "d10", "d12"];

/** Fora da escada. Só alcançável por efeito paranormal explícito (spec §3). */
export const DADO_SOBRE_HUMANO = "d20";

export const ATRIBUTOS = {
  fisico: { ordem: 1 },
  mente: { ordem: 2 },
  emocao: { ordem: 3 },
};

/** As 20 perícias, com o atributo-base sugerido (trocável no teste — spec §2.3). */
export const PERICIAS = {
  acrobacia: { atributo: "fisico" },
  aptidao: { atributo: "mente", especializada: true },
  atletismo: { atributo: "fisico" },
  crime: { atributo: "fisico" },
  disciplina: { atributo: "emocao" },
  enganacao: { atributo: "emocao" },
  furtividade: { atributo: "fisico" },
  intimidar: { atributo: "emocao" },
  intuicao: { atributo: "emocao" },
  luta: { atributo: "fisico" },
  maquinas: { atributo: "mente" },
  medicina: { atributo: "mente" },
  ocultismo: { atributo: "mente" },
  percepcao: { atributo: "mente" },
  persuasao: { atributo: "emocao" },
  pesquisar: { atributo: "mente" },
  pontaria: { atributo: "fisico" },
  sobrevivencia: { atributo: "mente" },
  tecnologia: { atributo: "mente" },
  vigor: { atributo: "fisico" },
};

/**
 * Campos de Aptidão que existem por padrão. A lista é aberta — o texto fala em
 * "conhecimento em um campo específico", então o jogador pode criar outros.
 */
export const APTIDOES_PADRAO = ["artes", "atualidades", "burocracia", "exatas", "humanas", "tatica"];

export const PERFIS = ["executor", "analista", "vigilante"];

/** Agentes têm acesso às ferramentas da Ordo Realitas; sobreviventes não (spec §9). */
export const TIPOS_PERSONAGEM = ["agente", "sobrevivente"];

/** Dificuldade padrão do playtest (spec §4.1). Configurável em settings. */
export const DT_PADRAO = 7;

/** Tetos rígidos do motor de teste (spec §4.5). */
export const MAX_DADOS_ROLADOS = 4;
export const MAX_DADOS_CONTADOS = 3;

/** Um crítico exige valores repetidos a partir deste número (spec §4.3). */
export const VALOR_MINIMO_CRITICO = 6;

/**
 * Efeitos de falha crítica (spec §4.4). `efeito` diz ao chat card o que oferecer;
 * nada é aplicado sem confirmação do mestre.
 */
export const TABELA_FALHA_CRITICA = {
  1: { chave: "vexame", efeito: "narrativo" },
  2: { chave: "machucado", efeito: "reducao", alvo: "fisico" },
  3: { chave: "desatencao", efeito: "reducao", alvo: "mente" },
  4: { chave: "irritacao", efeito: "reducao", alvo: "emocao" },
  5: { chave: "acidente", efeito: "dano", alvo: "pv", formula: "1d4" },
  6: { chave: "frustracao", efeito: "dano", alvo: "pd", formula: "1d4" },
  7: { chave: "perda", efeito: "manual" },
  8: { chave: "nenhum", efeito: "nenhum" },
};

/** Ajuda: quanto o dado do ajudante concede ao aliado (spec §4.7). */
export const PASSOS_DE_AJUDA = { d4: 0, d6: 1, d8: 1, d10: 2, d12: 2 };

/** Escalada de DT dos testes de ferimento e trauma: 7, 10, 13, 16… (spec §8.2/§8.3). */
export const DT_FERIMENTO_BASE = 7;
export const DT_FERIMENTO_INCREMENTO = 3;

/** Ações de investigação travadas para o grupo após um sucesso (spec §6.4/§6.5). */
export const DT_RECAPITULAR = 10;
export const DT_COMPARTILHAR = 10;

/** Examinar é uma aposta: não revelar nada novo custa 1 PD (spec §6.3.1). */
export const CUSTO_PD_EXAMINAR = 1;

/** Desafios de acesso físico (spec §7.2/§7.4/§7.5). */
export const CUSTO_PV_ARROMBAR = 1;
export const CUSTO_PV_SUSTENTAR = 1;
/** Alcançar arriscado: uma ação, DT do ambiente +3 (spec §7.4). */
export const BONUS_DT_ALCANCAR_ARRISCADO = 3;

/**
 * Setor de ferramentas de um POI (spec §6.2/§9.3). `null` = leitura normal, sem reação
 * — que também é informação, e por isso só se revela depois da investigação.
 */
export const FERRAMENTAS_POI = [
  "camera", "laboratorio", "lanternaUV", "laser", "infravermelho",
  "emf", "poRevelador", "radio", "termometro",
];

/**
 * Sobrecarga mental de referência (spec §7.6): dano emocional ao fim de cada rodada.
 * A última linha cobre "9 ou mais" — a diagramação da tabela admite outra leitura,
 * então a tabela é editável por cena (docs/LACUNAS.md). `dano` é uma expressão de
 * rolagem: "0" não machuca, "1" é fixo, "1d4" rola.
 */
export const TABELA_SOBRECARGA_PADRAO = [
  { rodada: 1, dano: "0" },
  { rodada: 2, dano: "0" },
  { rodada: 3, dano: "1" },
  { rodada: 4, dano: "1" },
  { rodada: 5, dano: "1d4" },
  { rodada: 6, dano: "1d4" },
  { rodada: 7, dano: "1d6" },
  { rodada: 8, dano: "1d6" },
  { rodada: 9, dano: "2d4" },
];

export const OP2 = {
  SYSTEM_ID, I18N, ESCADA, DADO_SOBRE_HUMANO, ATRIBUTOS, PERICIAS, APTIDOES_PADRAO,
  PERFIS, TIPOS_PERSONAGEM, DT_PADRAO, MAX_DADOS_ROLADOS, MAX_DADOS_CONTADOS,
  VALOR_MINIMO_CRITICO, TABELA_FALHA_CRITICA, PASSOS_DE_AJUDA,
  DT_FERIMENTO_BASE, DT_FERIMENTO_INCREMENTO,
  DT_RECAPITULAR, DT_COMPARTILHAR, CUSTO_PD_EXAMINAR, FERRAMENTAS_POI,
  TABELA_SOBRECARGA_PADRAO,
};
