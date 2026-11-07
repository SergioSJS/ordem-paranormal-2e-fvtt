/**
 * Painel da cena de ação: combate por fases, perseguição e furtividade numa janela só.
 *
 * Cada linha é um participante; o dono dele vê os botões, e o mestre vê todos. Os botões
 * chamam as ações de `acoes-*.mjs`, e a tela se refaz sozinha pelos hooks do documento.
 */
import { SYSTEM_ID, MAX_MARCADORES } from "../config.mjs";
import { usaCombateNovo } from "../modo.mjs";
import { renderDoPerfil } from "../ui/perfil.mjs";
import { FASES, MANOBRAS, jaAgiu, CONDICOES } from "./combate.mjs";
import {
  cenaAcaoAtiva, iniciarCena, avancarCena, encerrarCenaAcao, participantesDe, adicionarCriaturas, atorDe,
  definirRodada, definirFase, alternarAgiu, mudarCondicao, sortearCabecas, porNaCena, personagensDosJogadores,
} from "./cena-acao.mjs";
import { atacar, ataquesDe, acaoOposta, acaoGeral, manobra } from "./acoes-combate.mjs";
import { avancar, recuperarFolego, sacrificio, avisarDaVala } from "./acoes-perseguicao.mjs";
import {
  testeDeEsconderijo, esconderSe, distrair, chamarAtencaoPara, acaoChamativa, acaoDeArea, faseDasCriaturas, usarRuna, testeDeEquilibrio,
} from "./acoes-furtividade.mjs";
import { analisar } from "./acoes-ficha.mjs";
import { abrirAcoesInvestigacao } from "../cena/acoes-app.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const ACOES_GERAIS = ["defender", "mirar", "preparar", "usar", "erguer", "erguerLivre", "sacar", "sacarLivre", "jogarSe"];
// Ação livre não ocupa a ação da rodada: aparece em qualquer fase, nas "outras ações".
const LIVRES = new Set(["erguerLivre", "sacarLivre", "jogarSe"]);

/**
 * Todo botão de combate de um ator, com a fase em que a regra o põe (beta §7.1): suporte
 * para as ações gerais, distância e corpo a corpo para os ataques (manobra é corpo a corpo),
 * final para investigar. O painel mostra primeiro os da fase atual; os outros ficam em
 * "outras ações", sem sumir — a mesa decide (manual sempre possível).
 */
function acoesDeCombate(ator, { temAnalise, ehPc }) {
  const t = (chave) => game.i18n.localize(chave);
  return [
    ...ataquesDe(ator).map((a) => ({ qual: "ataque", ataque: a.id, rotulo: a.nome, fase: a.tipo === "distancia" ? "distancia" : "corpo", destaque: true })),
    { qual: "atrapalhar", rotulo: t("OP2.Combate2.atrapalhar"), fase: "suporte" },
    { qual: "fintar", rotulo: t("OP2.Combate2.fintar"), fase: "suporte" },
    ...(temAnalise ? [{ qual: "analisar", rotulo: t("OP2.Analise.Titulo"), fase: "suporte" }] : []),
    ...ACOES_GERAIS.map((g) => ({ qual: "geral", geral: g, rotulo: t(`OP2.Combate2.${g}`), fase: LIVRES.has(g) ? "livre" : "suporte" })),
    ...MANOBRAS.map((m) => ({ qual: "manobra", manobra: m, rotulo: t(`OP2.Manobra.${m}.nome`), fase: "corpo" })),
    ...(ehPc ? [{ qual: "investigar", rotulo: t("OP2.CenaAcao.Investigar"), fase: "final" }] : []),
  ];
}

export function linhaDe(cena, ator) {
  const { tipo } = cena.system;
  const estado = ator.system.estado ?? {};
  const ehPc = ator.type === "personagem";
  const params = cena.system.perseguicao ?? {};
  const furtiva = cena.system.furtividade ?? {};
  const area = furtiva.areas?.[cena.system.areaAtual];
  const ativas = estado.condicoes ?? new Set();
  const condicoes = CONDICOES.map((chave) => ({
    chave, rotulo: game.i18n.localize(`OP2.Condicao.${chave}`), ativa: ativas.has(chave),
  }));
  const per = estado.perseguicao;
  const fur = estado.furtividade;
  const temAnalise = ator.items?.some((i) => i.type === "habilidade" && i.system.mecanica === "analise");
  // Fase atual primeiro; sem fase (cena parada) tudo vale.
  const faseAtual = cena.system.fase;
  const acoes = tipo === "combate" ? acoesDeCombate(ator, { temAnalise, ehPc }) : [];
  const daFase = (a) => !faseAtual || a.fase === faseAtual;
  const pv = ator.system.recursos.pv;
  return {
    uuid: ator.uuid,
    nome: ator.name,
    img: ator.img,
    ehPc,
    dono: ator.isOwner,
    agiu: jaAgiu(cena.system.agiram, ator.uuid),
    pv: ator.system.recursos.pv,
    pd: ator.system.recursos.pd,
    // Ficha de criatura é do mestre: o jogador vê que ela está de pé, não os números.
    veNumeros: ehPc || ator.isOwner,
    rd: ator.isOwner ? (ator.system.rd ?? 0) : 0,
    armadura: ator.system.armadura?.disponivel ?? 0,
    pavor: estado.pavor ?? "",
    marcadores: estado.marcadores ?? 0,
    temAnalise,
    maxMarcadores: MAX_MARCADORES,
    condicoes,
    derrotado: pv.value <= 0,
    // A barrinha do elenco: quanto de PV resta, em %.
    pvPct: pv.max ? Math.max(0, Math.min(100, Math.round((pv.value / pv.max) * 100))) : 0,
    nestaFase: acoes.filter(daFase),
    outrasAcoes: acoes.filter((a) => !daFase(a)),
    ataques: tipo === "combate" ? ataquesDe(ator).map((a) => ({ ...a, fase: a.tipo === "distancia" ? "distancia" : "corpo" })) : [],
    perseguicao: tipo === "perseguicao" && ehPc ? {
      avanco: per.avanco, folego: per.folego, derrubado: per.derrubado, esforcos: per.esforcos, obstaculo: per.obstaculo,
      podeRecuperar: Boolean(params.recuperar), podeSacrificar: Boolean(params.sacrificio),
      podeAvisar: Boolean(params.obstaculo) && per.obstaculo,
      chegou: per.avanco >= (params.cortes?.at(-1)?.minimo ?? Infinity),
    } : null,
    furtividade: tipo === "furtividade" && ehPc ? {
      testou: fur.testou, avancos: fur.avancos, esperando: fur.esperando, faltam: area ? Math.max(0, area.avancos - fur.avancos) : 0,
      dados: fur.esconderijo.map((d) => `${d.dado} [${d.valor}]`).join(", "),
      lista: fur.esconderijo.map((d, i) => ({ ...d, i })),
      runaDisponivel: Boolean(furtiva.runa) && !estado.runaUsada,
      encontrado: fur.testou && !fur.esconderijo.length,
      acoesDaArea: (area?.acoes ?? []).map((a, i) => ({ ...a, i })),
    } : null,
  };
}

/** O texto do guia da fase (ou da rodada, fora do combate). */
export function guiaDaCena(tipo, fase) {
  const chave = tipo === "combate" ? fase : (tipo === "perseguicao" ? "perseguicao" : fase);
  if (!chave) return null;
  return {
    titulo: game.i18n.localize(tipo === "perseguicao" ? "OP2.CenaAcao.Tipo.perseguicao" : `OP2.Fase.${chave}`),
    texto: game.i18n.localize(`OP2.Guia.${chave}`),
  };
}

export class PainelAcaoApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "op2-painel-acao",
    classes: ["op2", "op2-painel-acao"],
    window: { title: "OP2.CenaAcao.Painel", icon: "fa-solid fa-swords", resizable: true },
    position: { width: 760, height: 700 },
    actions: {
      iniciar: PainelAcaoApp.#iniciar,
      avancar: PainelAcaoApp.#avancar,
      encerrar: PainelAcaoApp.#encerrar,
      adicionar: PainelAcaoApp.#adicionar,
      novaCena: PainelAcaoApp.#novaCena,
      irPara: PainelAcaoApp.#irPara,
      proximaArea: PainelAcaoApp.#proximaArea,
      irParaFase: PainelAcaoApp.#irParaFase,
      ajustarRodada: PainelAcaoApp.#ajustarRodada,
      alternarAgiu: PainelAcaoApp.#alternarAgiu,
      alternarCondicao: PainelAcaoApp.#alternarCondicao,
      cabecas: PainelAcaoApp.#cabecas,
      criaturaEscolhida: PainelAcaoApp.#criaturaEscolhida,
      tirarDado: PainelAcaoApp.#tirarDado,
      porDado: PainelAcaoApp.#porDado,
      criaturas: PainelAcaoApp.#criaturas,
      agir: PainelAcaoApp.#agir,
      abrirFicha: PainelAcaoApp.#abrirFicha,
      montar: PainelAcaoApp.#montar,
      porJogadores: PainelAcaoApp.#porJogadores,
    },
  };

  static PARTS = { corpo: { template: `systems/${SYSTEM_ID}/templates/vigilia/painel-acao.hbs`, scrollable: [""] } };

  /** A cena mostrada: a pedida, senão a ativa, senão a primeira que o mestre tiver. */
  cenaUuid = null;

  #dragDrop = null;

  /** Arrastar um ator da barra lateral para o painel o põe na cena (só o mestre). */
  get _dragDrop() {
    return this.#dragDrop ??= new foundry.applications.ux.DragDrop.implementation({
      dropSelector: ".op2-painel-acao__corpo",
      permissions: { drop: () => game.user.isGM },
      callbacks: { drop: this.#aoSoltar.bind(this) },
    });
  }

  async #aoSoltar(evento) {
    const TE = foundry.applications.ux.TextEditor.implementation;
    const dados = TE.getDragEventData(evento);
    if (dados?.type !== "Actor" || !dados.uuid) return;
    let cena = this.cena;
    // Sem cena nenhuma: soltar alguém já cria um combate, parado, com ele dentro.
    if (!cena) {
      cena = await Actor.create({ name: game.i18n.localize("OP2.CenaAcao.NovaCenaPadrao"), type: "cena-acao", system: { tipo: "combate" } });
      this.cenaUuid = cena.uuid;
    }
    const entraram = await porNaCena(cena, [dados.uuid]);
    if (!entraram) ui.notifications.info(game.i18n.localize("OP2.CenaAcao.JaNaCena"));
    this.render();
  }

  get cena() {
    const pedida = this.cenaUuid ? fromUuidSync(this.cenaUuid) : null;
    return pedida ?? cenaAcaoAtiva() ?? (game.user.isGM ? game.actors.find((a) => a.type === "cena-acao") : null) ?? null;
  }

  /** As cenas que o mestre pode abrir aqui: a no ar primeiro, depois por nome. */
  #cenasParaEscolher(atual) {
    if (!game.user.isGM) return [];
    return game.actors.filter((a) => a.type === "cena-acao")
      .sort((a, b) => Number(b.system.ativa) - Number(a.system.ativa) || a.name.localeCompare(b.name, "pt-BR"))
      .map((a) => ({ uuid: a.uuid, nome: a.name, ativa: a.system.ativa, atual: a.uuid === atual?.uuid }));
  }

  async _prepareContext() {
    const cena = this.cena;
    if (!cena) return { semCena: true, ehGM: game.user.isGM, cenas: this.#cenasParaEscolher(null) };
    const { tipo, fase, rodada, ativa, areaAtual } = cena.system;
    const furtiva = cena.system.furtividade ?? {};
    const area = furtiva.areas?.[areaAtual];
    const participantes = participantesDe(cena);
    const linhas = participantes.map((a) => linhaDe(cena, a));
    const modelos = cena.system.criaturas.map((u) => fromUuidSync(u)).filter(Boolean).map((a) => ({ uuid: a.uuid, nome: a.name }));
    const fases = tipo === "combate" ? FASES : (tipo === "furtividade" ? ["personagens", "criaturas"] : []);
    return {
      cena, tipo, rodada, ativa,
      ehGM: game.user.isGM,
      ehCombate: tipo === "combate",
      ehPerseguicao: tipo === "perseguicao",
      ehFurtividade: tipo === "furtividade",
      rotuloTipo: game.i18n.localize(`OP2.CenaAcao.Tipo.${tipo}`),
      fases: fases.map((f) => ({ chave: f, rotulo: game.i18n.localize(`OP2.Fase.${f}`), atual: f === fase })),
      rodadas: cena.system.perseguicao?.rodadas ?? 0,
      proximoCorte: (cena.system.perseguicao?.cortes ?? []).find((c) => c.rodada >= rodada) ?? null,
      area: area ? { nome: area.nome, avancos: area.avancos, numero: areaAtual + 1, total: furtiva.areas.length } : null,
      temProximaArea: Boolean(furtiva.areas?.[areaAtual + 1]) && linhas.filter((l) => l.ehPc).every((l) => l.furtividade?.faltam === 0),
      linhas,
      gerais: ACOES_GERAIS.map((chave) => ({ chave, rotulo: game.i18n.localize(`OP2.Combate2.${chave}`) })),
      manobras: MANOBRAS.map((chave) => ({ chave, rotulo: game.i18n.localize(`OP2.Manobra.${chave}.nome`) })),
      temCabecas: Boolean(cena.system.perseguicao?.ataquesPorRodada),
      linhasDaTabela: (furtiva.tabela ?? []).map((l) => ({ valor: l.valor, rotulo: `${l.valor}. ${game.i18n.localize(`OP2.Furtividade.Linha.${l.tipo}`)}` })),
      rotuloAgir: game.i18n.localize(`OP2.CenaAcao.Tipo.${tipo}`),
      modelos,
      // Um modelo só: o nome dele no lugar da lista (uma lista de um item parecia campo solto).
      modeloUnico: modelos.length === 1 ? modelos[0] : null,
      quantosPadrao: Math.max(1, participantes.filter((a) => a.type === "personagem").length),
      cenas: this.#cenasParaEscolher(cena),
      guia: guiaDaCena(tipo, fase),
      // Combate: as quatro fases explicadas, para consulta sem abrir o livro.
      guiasDaRodada: tipo === "combate" ? FASES.map((f) => ({ rotulo: game.i18n.localize(`OP2.Fase.${f}`), texto: game.i18n.localize(`OP2.Guia.${f}`), atual: f === fase })) : [],
      elenco: { pcs: linhas.filter((l) => l.ehPc), criaturas: linhas.filter((l) => !l.ehPc) },
      podeArrastar: game.user.isGM,
      contagem: {
        pcs: participantes.filter((a) => a.type === "personagem").length,
        criaturas: participantes.filter((a) => a.type !== "personagem").length,
        total: participantes.length,
      },
    };
  }

  /** Campo editado direto na linha: PV, PD, avanço, fôlego, avanços da área. */
  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    this._dragDrop.bind(this.element);
    this.element.querySelector("[data-trocar-cena]")?.addEventListener("change", (evento) => {
      this.cenaUuid = evento.currentTarget.value;
      this.render();
    });
    // A fase é item de lista: o teclado precisa do mesmo clique que o mouse.
    for (const fase of this.element.querySelectorAll(".op2-fase[data-action]")) {
      fase.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter" || evento.key === " ") { evento.preventDefault(); fase.click(); }
      });
    }
    for (const campo of this.element.querySelectorAll("input[data-campo], select[data-campo]")) {
      campo.addEventListener("change", (evento) => {
        const alvo = evento.currentTarget;
        const ator = atorDe(alvo.dataset.ator);
        const valor = alvo.type === "checkbox" ? alvo.checked : (alvo.type === "number" ? Number(alvo.value) || 0 : alvo.value);
        if (ator?.isOwner) ator.update({ [alvo.dataset.campo]: valor });
      });
    }
  }

  static #irParaFase(_evento, alvo) {
    if (game.user.isGM) return definirFase(this.cena, alvo.dataset.fase);
    return null;
  }
  static #ajustarRodada(_evento, alvo) { return definirRodada(this.cena, this.cena.system.rodada + Number(alvo.dataset.delta)); }
  static #alternarAgiu(_evento, alvo) { return alternarAgiu(this.cena, atorDe(alvo.dataset.ator)); }
  static #alternarCondicao(_evento, alvo) {
    const ator = atorDe(alvo.dataset.ator);
    return mudarCondicao(ator, alvo.dataset.condicao, !ator.system.estado?.condicoes?.has(alvo.dataset.condicao));
  }
  static #cabecas() { return sortearCabecas(this.cena); }
  static #criaturaEscolhida() {
    const valor = Number(this.element.querySelector("[name=linhaCriatura]")?.value);
    return faseDasCriaturas(this.cena, { forcar: valor || undefined });
  }
  static #tirarDado(_evento, alvo) {
    const ator = atorDe(alvo.dataset.ator);
    const lista = ator.system.estado.furtividade.esconderijo.filter((_d, i) => i !== Number(alvo.dataset.indice));
    return ator.update({ "system.estado.furtividade.esconderijo": lista });
  }
  static #porDado(_evento, alvo) {
    const ator = atorDe(alvo.dataset.ator);
    const linha = alvo.closest("[data-novo-dado]");
    const dado = linha.querySelector("[name=novoDado]").value;
    const valor = Math.max(1, Number(linha.querySelector("[name=novoValor]").value) || 1);
    return ator.update({
      "system.estado.furtividade.esconderijo": [...ator.system.estado.furtividade.esconderijo, { dado, valor }],
      "system.estado.furtividade.testou": true,
    });
  }

  static #iniciar() { return iniciarCena(this.cena); }
  static #avancar() { return avancarCena(this.cena); }
  static async #encerrar() {
    const certo = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("OP2.CenaAcao.Encerrar") },
      content: `<p>${game.i18n.localize("OP2.CenaAcao.EncerrarPergunta")}</p>`,
      rejectClose: false,
    });
    return certo ? encerrarCenaAcao(this.cena) : null;
  }
  /**
   * Outra cena de ação, parada, para montar e iniciar: nome, tipo e, se quiser, já com os
   * tokens selecionados no mapa ou com os personagens dos jogadores. Nada de puxar o mapa
   * inteiro sem pedir.
   */
  static async #novaCena() {
    const selecionados = (canvas?.tokens?.controlled ?? []).map((t) => t.actor).filter((a) => ["personagem", "npc"].includes(a?.type));
    const t = (chave, dados) => foundry.utils.escapeHTML(dados ? game.i18n.format(chave, dados) : game.i18n.localize(chave));
    const tipos = ["combate", "perseguicao", "furtividade"]
      .map((tipo) => `<option value="${tipo}">${t(`OP2.CenaAcao.Tipo.${tipo}`)}</option>`).join("");
    const dados = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("OP2.CenaAcao.NovaCena") },
      content: `<div class="op2 op2-nova-cena">
        <label class="op2-campo"><span>${t("OP2.CenaAcao.NovaCenaNome")}</span>
          <input type="text" name="nome" value="${t("OP2.CenaAcao.NovaCenaPadrao")}" autofocus></label>
        <label class="op2-campo"><span>${t("OP2.CenaAcao.TipoRotulo")}</span><select name="tipo">${tipos}</select></label>
        <label class="op2-campo--inline"><input type="checkbox" name="jogadores" checked> ${t("OP2.CenaAcao.ComJogadores")}</label>
        ${selecionados.length ? `<label class="op2-campo--inline"><input type="checkbox" name="selecionados" checked> ${t("OP2.CenaAcao.ComSelecionados", { n: selecionados.length })}</label>` : ""}
      </div>`,
      ok: {
        label: game.i18n.localize("OP2.CenaAcao.Criar"),
        callback: (_e, botao) => {
          const f = botao.form.elements;
          return { nome: f.nome.value.trim(), tipo: f.tipo.value, jogadores: f.jogadores.checked, selecionados: f.selecionados?.checked ?? false };
        },
      },
      rejectClose: false,
    });
    if (!dados) return null;
    const uuids = [
      ...(dados.jogadores ? personagensDosJogadores().map((a) => a.uuid) : []),
      ...(dados.selecionados ? selecionados.map((a) => a.uuid) : []),
    ];
    const cena = await Actor.create({
      name: dados.nome || game.i18n.localize("OP2.CenaAcao.NovaCenaPadrao"), type: "cena-acao",
      system: { tipo: dados.tipo, participantes: [...new Set(uuids)] },
    });
    this.cenaUuid = cena.uuid;
    return this.render();
  }

  /** Clique no retrato do elenco: rola até a linha dele e a marca por um instante. */
  static #irPara(_evento, alvo) {
    const linha = this.element.querySelector(`.op2-linha-acao[data-ator="${alvo.dataset.ator}"]`);
    if (!linha) return;
    linha.scrollIntoView({ behavior: "smooth", block: "center" });
    linha.classList.add("op2-linha-acao--foco");
    setTimeout(() => linha.classList.remove("op2-linha-acao--foco"), 1200);
  }

  static #criaturas() { return faseDasCriaturas(this.cena); }
  static #proximaArea() {
    const cena = this.cena;
    return (async () => {
      for (const a of participantesDe(cena).filter((p) => p.type === "personagem")) {
        await a.update({ "system.estado.furtividade.avancos": 0, "system.estado.furtividade.trilha": false, "system.estado.furtividade.esperando": false, "system.estado.equilibrio": 0 });
      }
      await cena.update({ "system.areaAtual": cena.system.areaAtual + 1 });
    })();
  }

  static async #adicionar() {
    const uuid = this.element.querySelector("[name=modelo]")?.value;
    const quantos = Number(this.element.querySelector("[name=quantos]")?.value) || 1;
    if (uuid) await adicionarCriaturas(this.cena, uuid, quantos);
  }

  /** Montar a cena é na ficha dela: quem está, as ondas, os parâmetros. */
  static #montar() {
    this.cena?.sheet.render(true);
  }

  static async #porJogadores() {
    const cena = this.cena;
    if (!cena) return;
    const entraram = await porNaCena(cena, personagensDosJogadores().map((a) => a.uuid));
    if (!entraram) ui.notifications.info(game.i18n.localize("OP2.CenaAcao.NenhumJogador"));
  }

  static #abrirFicha(_evento, alvo) {
    atorDe(alvo.dataset.ator)?.sheet.render(true);
  }

  /** Um botão de linha só: `data-qual` diz o que fazer, `data-ator` quem faz. */
  static async #agir(_evento, alvo) {
    return agirNaCena(this.cena, atorDe(alvo.dataset.ator), alvo.dataset);
  }
}

/**
 * Executa uma ação de cena por um ator: o painel e o palco chamam daqui. `dados` é o
 * que o botão carrega (`qual`, e `ataque`, `geral`, `manobra` ou `indice` conforme o caso).
 */
export async function agirNaCena(cena, ator, dados) {
  if (!ator || !cena) return null;
  const { qual } = dados;
  const ataquePorId = () => ataquesDe(ator).find((a) => a.id === dados.ataque);

  switch (qual) {
    case "ataque": return atacar(ator, ataquePorId(), { cena });
    case "atrapalhar": case "fintar": return acaoOposta(ator, qual, { cena });
    case "geral": return acaoGeral(ator, dados.geral, { cena });
    case "manobra": return manobra(ator, dados.manobra, { cena });
    case "analisar": return analisar(ator);
    case "investigar": return abrirAcoesInvestigacao(ator);
    case "avancar": return avancar(ator, cena);
    case "recuperar": return recuperarFolego(ator, cena);
    case "sacrificio": return sacrificio(ator, cena);
    case "avisar": return avisarDaVala(ator, cena);
    case "esconderijo": return testeDeEsconderijo(ator);
    case "esconder": return esconderSe(ator, cena);
    case "distrair": {
      const aliado = await escolherAliado(ator, cena);
      return aliado ? distrair(ator, cena, { aliado }) : null;
    }
    case "chamar": {
      const aliado = await escolherAliado(ator, cena);
      return aliado ? chamarAtencaoPara(ator, aliado, cena) : null;
    }
    case "chamativa": return acaoChamativa(ator);
    case "runa": return usarRuna(ator);
    case "equilibrio": return testeDeEquilibrio(ator);
    case "area": return acaoDeArea(ator, cena, (cena.system.furtividade.areas[cena.system.areaAtual].acoes)[Number(dados.indice)]);
    default: return null;
  }
}

async function escolherAliado(ator, cena) {
  const outros = participantesDe(cena).filter((a) => a.type === "personagem" && a.uuid !== ator.uuid);
  if (!outros.length) return ator;
  const opcoes = [ator, ...outros].map((a) => `<option value="${a.uuid}">${foundry.utils.escapeHTML(a.name)}</option>`).join("");
  const uuid = await foundry.applications.api.DialogV2.prompt({
    window: { title: ator.name },
    content: `<div class="form-group"><select name="aliado">${opcoes}</select></div>`,
    ok: { callback: (_e, b) => b.form.elements.aliado.value },
    rejectClose: false,
    render: renderDoPerfil(ator),
  });
  return uuid ? atorDe(uuid) : null;
}

let instancia = null;

export function abrirPainelAcao(cena = null) {
  instancia ??= new PainelAcaoApp();
  if (cena) instancia.cenaUuid = cena.uuid;
  instancia.render({ force: true });
  return instancia;
}

/** Botão fixo na tela, como o do painel de investigação. */
function criarBotao() {
  if (!usaCombateNovo()) return;
  const botao = document.createElement("button");
  botao.type = "button";
  botao.id = "op2-botao-painel-acao";
  botao.className = "op2 op2-botao-flutuante op2-botao-flutuante--acao";
  botao.setAttribute("aria-label", game.i18n.localize("OP2.CenaAcao.Painel"));
  botao.dataset.tooltip = game.i18n.localize("OP2.CenaAcao.Painel");
  botao.dataset.tooltipDirection = "LEFT";
  const sidebar = document.getElementById("sidebar");
  botao.style.right = `${(sidebar?.getBoundingClientRect().width ?? 0) + 12}px`;
  botao.innerHTML = '<i class="fa-solid fa-swords" aria-hidden="true"></i>';
  botao.addEventListener("click", () => abrirPainelAcao());
  document.body.append(botao);
}

export function registrarPainelAcao() {
  Hooks.once("ready", criarBotao);
  const atualizar = () => {
    if (instancia?.rendered) instancia.render();
  };
  for (const gatilho of ["updateActor", "createActor", "deleteActor", "createToken", "deleteToken", "updateToken"]) {
    Hooks.on(gatilho, atualizar);
  }
}
