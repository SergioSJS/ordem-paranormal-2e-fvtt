/**
 * Renderiza as fichas fora do Foundry, para iterar em CSS sem subir um mundo.
 *
 * Usa as classes de ficha *reais* com os stubs de teste, então o contexto vem do mesmo
 * `_prepareContext` que roda no jogo — o que o preview mostra é o que a ficha monta.
 * O que ele **não** reproduz: o chrome da janela do Foundry, o sistema de abas do core
 * e o tema do usuário. Serve para conferir layout e cor, não para dar por validado.
 *
 *   node scripts/preview.mjs [saida.html]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import { instalarStubs } from "../module/tests/stub-foundry.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = process.argv[2] ?? join(RAIZ, "preview.html");

instalarStubs();

/* ------------------------------------------------------------------ i18n -- */

const idioma = JSON.parse(readFileSync(join(RAIZ, "lang/pt-BR.json"), "utf8"));
const traduzir = (chave) =>
  String(chave).split(".").reduce((o, k) => o?.[k], idioma) ?? chave;

game.i18n.localize = traduzir;
game.i18n.format = (chave, dados = {}) =>
  traduzir(chave).replace(/\{(\w+)\}/g, (_, k) => dados[k] ?? "");

/* -------------------------------------------------------------- helpers -- */

const { registrarHelpers } = await import("../module/ui/handlebars.mjs");
const { registrarHelpersDeDado } = await import("../module/ui/dice-icons.mjs");

globalThis.Handlebars = Handlebars;
registrarHelpers();
registrarHelpersDeDado();
Handlebars.registerHelper("localize", traduzir);
Handlebars.registerHelper("formInput", (_campo, opcoes) =>
  new Handlebars.SafeString(
    `<div class="op2-prosemirror-fake">${opcoes?.hash?.value || "<em>vazio</em>"}</div>`));

// Os templates se referenciam por caminho absoluto do Foundry.
function arquivos(pasta, extensao) {
  const saida = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivos(caminho, extensao));
    else if (nome.endsWith(extensao)) saida.push(caminho);
  }
  return saida;
}

for (const caminho of arquivos(join(RAIZ, "templates"), ".hbs")) {
  const chave = `systems/ordem-paranormal-2e/${relative(RAIZ, caminho)}`;
  Handlebars.registerPartial(chave, readFileSync(caminho, "utf8"));
}

/* ----------------------------------------------------------- ator falso -- */

const { PersonagemData } = await import("../module/data/actor-personagem.mjs");
const { stepDie, faces } = await import("../module/dice/escada.mjs");
const { PERICIAS, APTIDOES_PADRAO, ATRIBUTOS } = await import("../module/config.mjs");

const dados = (die, atributo) => ({ die, atributo, stepMod: 0 });

/** Um agente plausível, com dados variados para o preview não ficar monótono. */
const sistema = {
  tipo: "agente",
  perfil: "executor",
  ocupacao: "Cientista",
  nivel: 2,
  nex: 0,
  atributos: {
    fisico: { die: "d6" },
    mente: { die: "d10" },
    emocao: { die: "d4" },
  },
  pericias: Object.fromEntries(
    Object.entries(PERICIAS).map(([chave, def], i) => [
      chave, dados(["d4", "d6", "d8", "d4", "d6"][i % 5], def.atributo),
    ])),
  aptidoes: Object.fromEntries(
    APTIDOES_PADRAO.map((c, i) => [c, { rotulo: "", die: ["d4", "d6", "d8"][i % 3] }])),
  recursos: { pv: { value: 6, max: 10 }, pd: { value: 11, max: 16 } },
  estado: {
    testesFerimento: 0,
    testesTrauma: 0,
    // Uma redução ativa para o preview mostrar o dado base riscado e o botão de cena.
    reducoesTemporarias: { fisico: 1, mente: 0, emocao: 0 },
    acoesUsadasNaCena: new Set(),
  },
  biografia: "<p>Perdeu o emprego no laboratório. Não perdeu o hábito de anotar tudo.</p>",
};

// Reaproveita o prepareDerivedData real em vez de recalcular à mão.
Object.setPrototypeOf(sistema, PersonagemData.prototype);
sistema.prepareDerivedData();
// A ficha lê `system.schema.fields` para alimentar o {{formInput}}.
sistema.schema = { fields: { biografia: {} } };

const habilidades = [
  { id: "h1", name: "Foco Mental", img: "", type: "habilidade",
    system: { origem: "perfil", custo: "2 PD" } },
  { id: "h2", name: "Ímpeto", img: "", type: "habilidade",
    system: { origem: "ocupacao", custo: "" } },
];
const equipamentos = [
  { id: "e1", name: "Pé de cabra", img: "", type: "equipamento",
    system: { quantidade: 1, arma: true, cargas: { usa: false } } },
  { id: "e2", name: "Lanterna de Estouro UV", img: "", type: "equipamento",
    system: { quantidade: 1, arma: false, cargas: { usa: true, value: 2, max: 3 } } },
];

const ator = {
  name: "Alan",
  img: "",
  system: sistema,
  isOwner: true,
  items: [...habilidades, ...equipamentos],
};
ator.items.filter = Array.prototype.filter.bind(ator.items);

/* ------------------------------------------------------------ renderizar -- */

const { PersonagemSheet } = await import("../module/sheets/actor-personagem-sheet.mjs");

// Construção real: campos privados da classe só existem em instâncias construídas.
const ficha = new PersonagemSheet({ document: ator });

const contexto = {
  ...(await ficha._prepareContext({})),
  actor: ator,
  tabs: {
    habilidades: { id: "habilidades", group: "principal", label: "OP2.Aba.habilidades", cssClass: "active", active: true },
    inventario: { id: "inventario", group: "principal", label: "OP2.Aba.inventario", cssClass: "", active: false },
    notas: { id: "notas", group: "principal", label: "OP2.Aba.notas", cssClass: "", active: false },
  },
};

const parte = (nome) =>
  Handlebars.compile(readFileSync(join(RAIZ, "templates", nome), "utf8"))(contexto);

/* ------------------------------------------------- diálogo e chat card -- */

const { iconeDado, iconeResultado } = await import("../module/ui/dice-icons.mjs");
const analise = await import("../module/dice/analise.mjs");

const componentesDoTeste = [
  { chave: "pericia.percepcao", rotulo: "Percepção", tipo: "pericia", dado: "d8" },
  { chave: "atributo.mente", rotulo: "Mente", tipo: "atributo", dado: "d10" },
  { chave: "extra.h1", rotulo: "Foco Mental", tipo: "extra", dado: "d6" },
  { chave: "extra.h2", rotulo: "Ímpeto", tipo: "extra", dado: "d6" },
];

const contextoDialogo = {
  estado: { dt: 7, oposto: false },
  atributos: Object.keys(ATRIBUTOS).map((chave) => ({
    chave,
    rotulo: traduzir(`OP2.Atributo.${chave}`),
    dado: sistema.atributos[chave].dadoEfetivo,
    selecionado: chave === "mente",
  })),
  componentes: componentesDoTeste.map((c) => ({ ...c, icone: iconeDado(c.dado) })),
  extras: habilidades.map((h, i) => ({
    id: h.id, nome: h.name, img: h.img,
    tipo: i === 0 ? "passo" : "dado-extra", passos: 1, dado: "d6", ativo: true,
  })),
  temExtras: true,
  excedeContagem: true,
  noTeto: true,
  maxContados: 3,
  maxRolados: 4,
};

// Uma rolagem plausível: 4 dados, 3 contados, com um par de 8 formando crítico.
const dadosRolados = [
  { indice: 0, dado: "d8", resultado: 8, contado: true, componente: componentesDoTeste[0] },
  { indice: 1, dado: "d10", resultado: 8, contado: true, componente: componentesDoTeste[1] },
  { indice: 2, dado: "d6", resultado: 5, contado: true, componente: componentesDoTeste[2] },
  { indice: 3, dado: "d6", resultado: 2, contado: false, componente: componentesDoTeste[3] },
];

const leitura = analise.analisar(dadosRolados, { dt: 7 });

const contextoSelecao = {
  dt: 7,
  maxContados: 3,
  completo: true,
  dados: dadosRolados.map((d) => ({ ...d, icone: iconeResultado(d) })),
  parcial: leitura,
};

const contextoCard = {
  rotulo: "Percepção",
  componentes: dadosRolados,
  ...leitura,
  atorId: "fake",
  ehGM: true,
};

const contextoFalha = {
  face: 2, chave: "machucado", efeito: "reducao", alvo: "fisico",
  aplicavel: true, atorId: "fake",
};

const parteCom = (nome, ctx) =>
  Handlebars.compile(readFileSync(join(RAIZ, "templates", nome), "utf8"))(ctx);

/* --------------------------------------------------------------- saída -- */

const css = readFileSync(join(RAIZ, "styles/op2.css"), "utf8")
  .replaceAll("../assets/fonts/", "assets/fonts/");

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Preview — Ordem Paranormal 2</title>
<style>
  body { margin: 0; padding: 2rem; background: #060404; font-family: system-ui; }
  .janela { width: 880px; margin: 0 auto; border: 1px solid #2a201d; border-radius: 6px;
            box-shadow: 0 20px 60px rgb(0 0 0 / 60%); overflow: hidden; }
  .janela--estreita { width: 420px; margin: 0; }
  .fileira { display: flex; flex-wrap: wrap; justify-content: center; gap: 1.5rem;
             max-width: 1360px; margin: 2rem auto 0; align-items: flex-start; }
  .window-content { padding: .8rem; background: #0d0908; }
  .barra { padding: .5rem .8rem; background: #120c0a; border-bottom: 1px solid #2a201d;
           color: #8a7f79; font-size: .8rem; }
  .op2-prosemirror-fake { padding: .5rem; border: 1px solid rgb(242 237 230 / 12%);
                          border-radius: 3px; min-height: 5rem; }
  .op2-cabecalho__retrato { background: #241a17; }
  ${css}
</style></head>
<body>
  <div class="janela op2 op2-ficha op2-ficha--personagem">
    <div class="barra">Agente: Alan — preview fora do Foundry</div>
    <form class="window-content">
      ${parte("actor/personagem-cabecalho.hbs")}
      ${parte("actor/personagem-abas.hbs")}
      ${parte("actor/personagem-habilidades.hbs")}
      ${parte("actor/personagem-inventario.hbs")}
      ${parte("actor/personagem-notas.hbs")}
      ${parte("actor/personagem-pericias.hbs")}
    </form>
  </div>

  <div class="fileira">
    <div class="janela janela--estreita op2 op2-dialog">
      <div class="barra">Diálogo de teste</div>
      <div class="window-content standard-form">${parteCom("dialog/teste.hbs", contextoDialogo)}</div>
    </div>

    <div class="janela janela--estreita op2 op2-dialog">
      <div class="barra">Escolha dos dados contabilizados</div>
      <div class="window-content standard-form">${parteCom("dialog/selecao-dados.hbs", contextoSelecao)}</div>
    </div>

    <div class="janela janela--estreita op2">
      <div class="barra">Chat</div>
      <div class="window-content" style="padding:.6rem;background:var(--op2-fundo)">
        ${parteCom("chat/teste.hbs", contextoCard)}
        <div style="height:.6rem"></div>
        ${parteCom("chat/falha-critica.hbs", contextoFalha)}
      </div>
    </div>
  </div>
</body></html>`;

writeFileSync(SAIDA, html);
console.log(`Preview escrito em ${SAIDA}`);
