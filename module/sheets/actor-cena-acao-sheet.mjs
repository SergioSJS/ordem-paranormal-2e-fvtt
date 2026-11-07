/**
 * Ficha da cena de ação: onde o mestre monta a cena. Quem está nela (personagens e
 * criaturas), os modelos das ondas de criaturas, os parâmetros e o botão do painel.
 *
 * Tudo entra por mais de um caminho, nenhum obrigatório: escolher na lista, os tokens
 * selecionados no mapa, os personagens de quem joga ou arrastar da barra de atores.
 */
import { SYSTEM_ID } from "../config.mjs";
import { abrirPainelAcao } from "../vigilia/painel-acao.mjs";
import { atorDe, porNaCena, tirarDaCena, personagensDosJogadores, adicionarCriaturas } from "../vigilia/cena-acao.mjs";
import { TIPOS_DE_CENA } from "../data/actor-cena-acao.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const ordenar = (lista) => lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

export class CenaAcaoSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["op2", "op2-ficha-cena-acao"],
    position: { width: 560, height: "auto" },
    form: { submitOnChange: true },
    actions: {
      abrirPainel: CenaAcaoSheet.#abrirPainel,
      abrirAtor: CenaAcaoSheet.#abrirAtor,
      tirar: CenaAcaoSheet.#tirar,
      porEscolhido: CenaAcaoSheet.#porEscolhido,
      porSelecionados: CenaAcaoSheet.#porSelecionados,
      porJogadores: CenaAcaoSheet.#porJogadores,
      porModelo: CenaAcaoSheet.#porModelo,
      tirarModelo: CenaAcaoSheet.#tirarModelo,
    },
  };

  static PARTS = { corpo: { template: `systems/${SYSTEM_ID}/templates/actor/cena-acao.hbs` } };

  async _prepareContext(opcoes) {
    const contexto = await super._prepareContext(opcoes);
    const sistema = this.actor.system;
    const linha = (uuid) => {
      const ator = atorDe(uuid);
      return {
        uuid, nome: ator?.name ?? uuid, img: ator?.img ?? "icons/svg/mystery-man.svg",
        ehPc: ator?.type === "personagem",
        // Token sem vínculo (uma criatura da onda) diz de onde veio.
        token: Boolean(ator?.isToken),
        tipo: game.i18n.localize(ator?.type === "personagem" ? "OP2.CenaAcao.Personagem" : "OP2.CenaAcao.Criatura"),
        ausente: !ator,
      };
    };
    const participantes = sistema.participantes.map(linha);
    const naCena = new Set(sistema.participantes);
    // Criatura do diretório é modelo: nunca "está na cena" (cada vez que entra é outra instância).
    // As cópias que a cena criou (pasta "Criaturas em cena") não aparecem como modelo.
    const candidatos = (tipo) => ordenar(game.actors
      .filter((a) => a.type === tipo && !a.getFlag(SYSTEM_ID, "copiaDe") && (tipo === "npc" || !naCena.has(a.uuid)))
      .map((a) => ({ uuid: a.uuid, nome: a.name })));
    const modelos = new Set(sistema.criaturas);
    return {
      ...contexto,
      actor: this.actor,
      sistema,
      editavel: this.isEditable,
      tipos: TIPOS_DE_CENA.map((t) => ({ chave: t, rotulo: game.i18n.localize(`OP2.CenaAcao.Tipo.${t}`), atual: t === sistema.tipo })),
      temParticipantes: participantes.length > 0,
      grupos: [
        { titulo: game.i18n.localize("OP2.CenaAcao.Personagens"), linhas: participantes.filter((p) => p.ehPc) },
        { titulo: game.i18n.localize("OP2.CenaAcao.Criaturas"), linhas: participantes.filter((p) => !p.ehPc) },
      ],
      candidatosPc: candidatos("personagem"),
      candidatosNpc: candidatos("npc"),
      temSelecionados: Boolean(canvas?.ready),
      modelos: sistema.criaturas.map(linha),
      candidatosModelo: ordenar(game.actors.filter((a) => a.type === "npc" && !modelos.has(a.uuid)).map((a) => ({ uuid: a.uuid, nome: a.name }))),
      // Todo parâmetro de missão é editável: a mesa pode jogar com outros números.
      parametros: JSON.stringify(sistema.tipo === "furtividade" ? sistema.furtividade : sistema.perseguicao, null, 2),
      temParametros: sistema.tipo !== "combate",
    };
  }

  /** Grava o JSON dos parâmetros; texto inválido avisa e não apaga o que havia. */
  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    this.element.querySelector("[data-parametros]")?.addEventListener("change", (evento) => {
      try {
        const dados = JSON.parse(evento.currentTarget.value || "{}");
        const campo = this.actor.system.tipo === "furtividade" ? "furtividade" : "perseguicao";
        // Trocar o objeto inteiro, sem fundir: o v14 tem operador para isso, e estranha o `==`.
        const { operators } = foundry.data;
        this.actor.update(operators?.ForcedReplacement
          ? { [`system.${campo}`]: operators.ForcedReplacement.create(dados) }
          : { [`system.==${campo}`]: dados });
      } catch {
        ui.notifications.error(game.i18n.localize("OP2.CenaAcao.ParametrosInvalidos"));
      }
    });
  }

  /** Arrastar um ator para a ficha o põe na cena. */
  async _onDropActor(_evento, ator) {
    await porNaCena(this.actor, [ator.uuid]);
    return false;
  }

  static #abrirPainel() {
    abrirPainelAcao(this.actor);
  }

  static #abrirAtor(_evento, alvo) {
    atorDe(alvo.dataset.uuid)?.sheet.render(true);
  }

  static #tirar(_evento, alvo) {
    return tirarDaCena(this.actor, alvo.dataset.uuid);
  }

  /** O ator escolhido na lista ao lado do botão; criatura entra na quantidade pedida. */
  static async #porEscolhido(_evento, alvo) {
    const linha = alvo.closest("[data-escolha]");
    const uuid = linha?.querySelector("select")?.value;
    if (!uuid) return;
    const quantos = Number(linha.querySelector("[name=quantos]")?.value) || 1;
    if (atorDe(uuid)?.type === "npc") await adicionarCriaturas(this.actor, uuid, quantos);
    else await porNaCena(this.actor, [uuid]);
  }

  static async #porSelecionados() {
    const uuids = (canvas?.tokens?.controlled ?? []).map((t) => t.actor?.uuid).filter(Boolean);
    const entraram = await porNaCena(this.actor, uuids);
    if (!entraram) ui.notifications.info(game.i18n.localize("OP2.CenaAcao.NenhumSelecionado"));
  }

  static async #porJogadores() {
    const entraram = await porNaCena(this.actor, personagensDosJogadores().map((a) => a.uuid));
    if (!entraram) ui.notifications.info(game.i18n.localize("OP2.CenaAcao.NenhumJogador"));
  }

  static async #porModelo(_evento, alvo) {
    const uuid = alvo.closest("[data-escolha]")?.querySelector("select")?.value;
    if (!uuid || this.actor.system.criaturas.includes(uuid)) return;
    await this.actor.update({ "system.criaturas": [...this.actor.system.criaturas, uuid] });
  }

  static #tirarModelo(_evento, alvo) {
    return this.actor.update({ "system.criaturas": this.actor.system.criaturas.filter((u) => u !== alvo.dataset.uuid) });
  }
}
