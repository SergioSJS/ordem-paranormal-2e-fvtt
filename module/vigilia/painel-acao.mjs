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
  definirRodada, definirFase, alternarAgiu, mudarCondicao, sortearCabecas,
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

function linhaDe(cena, ator) {
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
    temAnalise: ator.items?.some((i) => i.type === "habilidade" && i.system.mecanica === "analise"),
    maxMarcadores: MAX_MARCADORES,
    condicoes,
    derrotado: ator.system.recursos.pv.value <= 0,
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
      novoCombate: PainelAcaoApp.#novoCombate,
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
    },
  };

  static PARTS = { corpo: { template: `systems/${SYSTEM_ID}/templates/vigilia/painel-acao.hbs`, scrollable: [""] } };

  /** A cena mostrada: a pedida, senão a ativa, senão a primeira que o mestre tiver. */
  cenaUuid = null;

  get cena() {
    const pedida = this.cenaUuid ? fromUuidSync(this.cenaUuid) : null;
    return pedida ?? cenaAcaoAtiva() ?? (game.user.isGM ? game.actors.find((a) => a.type === "cena-acao") : null) ?? null;
  }

  async _prepareContext() {
    const cena = this.cena;
    if (!cena) return { semCena: true, ehGM: game.user.isGM };
    const { tipo, fase, rodada, ativa, areaAtual } = cena.system;
    const furtiva = cena.system.furtividade ?? {};
    const area = furtiva.areas?.[areaAtual];
    const participantes = participantesDe(cena);
    const linhas = participantes.map((a) => linhaDe(cena, a));
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
      modelos: cena.system.criaturas.map((u) => fromUuidSync(u)).filter(Boolean).map((a) => ({ uuid: a.uuid, nome: a.name })),
      quantosPadrao: Math.max(1, participantes.filter((a) => a.type === "personagem").length),
    };
  }

  /** Campo editado direto na linha: PV, PD, avanço, fôlego, avanços da área. */
  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
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
  /** Sem cena no ar: um combate com os tokens da cena do mapa, para o mestre ajustar na ficha. */
  static async #novoCombate() {
    const atores = [...new Set((canvas?.scene?.tokens ?? []).map((t) => t.actor).filter((a) => ["personagem", "npc"].includes(a?.type)))];
    const cena = await Actor.create({
      name: game.i18n.localize("OP2.CenaAcao.NovoCombate"), type: "cena-acao",
      system: { tipo: "combate", participantes: atores.map((a) => a.uuid) },
    });
    if (!atores.length) ui.notifications.info(game.i18n.localize("OP2.CenaAcao.SemTokens"));
    this.cenaUuid = cena.uuid;
    await iniciarCena(cena);
    return this.render();
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

  static #abrirFicha(_evento, alvo) {
    atorDe(alvo.dataset.ator)?.sheet.render(true);
  }

  /** Um botão de linha só: `data-qual` diz o que fazer, `data-ator` quem faz. */
  static async #agir(_evento, alvo) {
    const cena = this.cena;
    const ator = atorDe(alvo.dataset.ator);
    if (!ator || !cena) return null;
    const { qual } = alvo.dataset;
    const ataquePorId = () => ataquesDe(ator).find((a) => a.id === alvo.dataset.ataque);

    switch (qual) {
      case "ataque": return atacar(ator, ataquePorId(), { cena });
      case "atrapalhar": case "fintar": return acaoOposta(ator, qual, { cena });
      case "geral": return acaoGeral(ator, alvo.dataset.geral, { cena });
      case "manobra": return manobra(ator, alvo.dataset.manobra, { cena });
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
      case "area": return acaoDeArea(ator, cena, (cena.system.furtividade.areas[cena.system.areaAtual].acoes)[Number(alvo.dataset.indice)]);
      default: return null;
    }
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
