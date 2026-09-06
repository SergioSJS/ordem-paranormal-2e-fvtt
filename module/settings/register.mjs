/**
 * Settings do sistema.
 *
 * Quase todos existem porque o playtest deixa a regra em aberto ou se contradiz
 * (spec §11). O default é sempre a leitura recomendada; a mesa ajusta se discordar.
 */
import { SYSTEM_ID, DT_PADRAO } from "../config.mjs";

/** @type {Record<string, object>} */
const SETTINGS = {
  dtPadrao: {
    scope: "world", config: true, type: Number, default: DT_PADRAO,
    range: { min: 2, max: 20, step: 1 },
  },
  // O playtest não diz se dados descartados alimentam a detecção de crítico (spec §4.5).
  escopoCritico: {
    scope: "world", config: true, type: String, default: "todos",
    choices: { todos: "OP2.Config.escopoCritico.todos", contados: "OP2.Config.escopoCritico.contados" },
  },
  // O corpo do texto diz Pesquisar; a tabela-resumo diz Intuição (spec §6.5).
  compartilharPericia: {
    scope: "world", config: true, type: String, default: "pesquisar",
    choices: { pesquisar: "OP2.Pericia.pesquisar", intuicao: "OP2.Pericia.intuicao" },
  },
  // A ajuda dá "um aumento de passo" sem dizer em qual dado (spec §4.7).
  ajudaAlvo: {
    scope: "world", config: true, type: String, default: "pericia",
    choices: { pericia: "OP2.Config.ajudaAlvo.pericia", atributo: "OP2.Config.ajudaAlvo.atributo" },
  },
  // O texto avisa que morrer por PD não será tão fácil na versão final (spec §8.3).
  falhaTrauma: {
    scope: "world", config: true, type: String, default: "morte",
    choices: { morte: "OP2.Config.falhaTrauma.morte", colapso: "OP2.Config.falhaTrauma.colapso" },
  },
  // Ordem Paranormal é um jogo brasileiro; o Foundry nasce em inglês.
  idiomaPadraoPtBR: {
    scope: "world", config: true, type: Boolean, default: true, requiresReload: true,
  },
  // A tela de boas-vindas ao entrar no mundo: o mestre desliga quando não quiser mais
  // (na própria tela ou aqui). "Sobre e licença", no menu, abre a mesma janela sempre.
  boasVindas: {
    scope: "world", config: true, type: Boolean, default: true,
  },
  // Clique simples rola direto; Shift abre o diálogo. Invertível por preferência.
  cliqueAbreDialogo: {
    scope: "client", config: true, type: Boolean, default: false,
  },
  // Quais investigações o mestre marcou "em jogo" — o grupo pode se dividir em
  // mais de uma ao mesmo tempo (achado em uso real). Ponteiro de sessão, não
  // escolha de regra: `config: false`, não aparece no menu de settings.
  investigacoesAtivasUuids: {
    scope: "world", config: false, type: Array, default: [],
  },
  // Qual investigação O USUÁRIO ATUAL está vendo no painel — por cliente, não por
  // mundo: cada jogador navega entre as suas, o mestre entre todas.
  investigacaoVisualizandoUuid: {
    scope: "client", config: false, type: String, default: "",
  },
};

export function registrarSettings() {
  for (const [chave, definicao] of Object.entries(SETTINGS)) {
    game.settings.register(SYSTEM_ID, chave, {
      name: `OP2.Config.${chave}.name`,
      hint: `OP2.Config.${chave}.hint`,
      ...definicao,
    });
  }
}

/** @param {keyof SETTINGS} chave */
export function lerConfig(chave) {
  return game.settings.get(SYSTEM_ID, chave);
}
