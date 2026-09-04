/** Helpers e pré-carregamento de templates. */
import { SYSTEM_ID } from "../config.mjs";

const RAIZ = `systems/${SYSTEM_ID}/templates`;

const TEMPLATES = [
  `${RAIZ}/actor/personagem-cabecalho.hbs`,
  `${RAIZ}/actor/personagem-abas.hbs`,
  `${RAIZ}/actor/personagem-habilidades.hbs`,
  `${RAIZ}/actor/personagem-inventario.hbs`,
  `${RAIZ}/actor/personagem-notas.hbs`,
  `${RAIZ}/actor/personagem-pericias.hbs`,
  `${RAIZ}/actor/npc.hbs`,
  `${RAIZ}/actor/investigacao.hbs`,
  `${RAIZ}/item/habilidade.hbs`,
  `${RAIZ}/item/equipamento.hbs`,
  `${RAIZ}/item/ponto-interesse.hbs`,
  `${RAIZ}/item/desafio-acesso.hbs`,
  `${RAIZ}/item/evento.hbs`,
  `${RAIZ}/item/ferramenta.hbs`,
  `${RAIZ}/partials/controle-dado.hbs`,
  `${RAIZ}/partials/linha-pericia.hbs`,
  `${RAIZ}/partials/trilha-recurso.hbs`,
  `${RAIZ}/partials/abrir-dialogo.hbs`,
  `${RAIZ}/partials/falha-critica.hbs`,
  `${RAIZ}/dialog/teste.hbs`,
  `${RAIZ}/dialog/pericia.hbs`,
  `${RAIZ}/dialog/selecao-dados.hbs`,
  `${RAIZ}/chat/teste.hbs`,
  `${RAIZ}/chat/falha-critica.hbs`,
  `${RAIZ}/chat/revelacao.hbs`,
  `${RAIZ}/chat/examinar-custo.hbs`,
  `${RAIZ}/chat/acao-cena.hbs`,
  `${RAIZ}/chat/interagir.hbs`,
  `${RAIZ}/chat/rodada.hbs`,
  `${RAIZ}/chat/dano.hbs`,
  `${RAIZ}/chat/arrombar.hbs`,
  `${RAIZ}/chat/alcancar.hbs`,
  `${RAIZ}/chat/ferramenta.hbs`,
  `${RAIZ}/chat/destrancar.hbs`,
  `${RAIZ}/chat/laboratorio.hbs`,
  `${RAIZ}/chat/radio.hbs`,
  `${RAIZ}/cena/painel-investigacao.hbs`,
  `${RAIZ}/cena/partials/investigacao-lateral.hbs`,
  `${RAIZ}/cena/partials/investigacao-abas.hbs`,
  `${RAIZ}/cena/destrancar.hbs`,
  `${RAIZ}/cena/laboratorio.hbs`,
  `${RAIZ}/cena/radio.hbs`,
  `${RAIZ}/cena/timer-hack.hbs`,
  `${RAIZ}/chat/hack-timer.hbs`,
  `${RAIZ}/actor/acoes-investigacao.hbs`,
  `${RAIZ}/actor/partials/acoes-desafio.hbs`,
];

export function precarregarTemplates() {
  const carregar = foundry.applications?.handlebars?.loadTemplates ?? globalThis.loadTemplates;
  return carregar(TEMPLATES);
}

export function registrarHelpers() {
  /** `{{op2Partial "partials/linha-pericia"}}` — evita repetir o caminho do sistema. */
  Handlebars.registerHelper("op2Caminho", (relativo) => `${RAIZ}/${relativo}.hbs`);

  Handlebars.registerHelper("op2Concat", (...args) => args.slice(0, -1).join(""));

  Handlebars.registerHelper("op2Eq", (a, b) => a === b);
  Handlebars.registerHelper("op2Ou", (...args) => args.slice(0, -1).some(Boolean));
  Handlebars.registerHelper("op2Maior", (a, b) => Number(a) > Number(b));

  /** Repete N vezes, para trilhas de pips. */
  Handlebars.registerHelper("op2Vezes", (n, opcoes) => {
    let saida = "";
    for (let i = 0; i < n; i += 1) saida += opcoes.fn({ i, n: i + 1 });
    return saida;
  });
}
