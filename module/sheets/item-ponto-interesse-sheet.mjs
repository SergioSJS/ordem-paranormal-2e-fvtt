/**
 * Ficha do Ponto de Interesse — ferramenta do mestre (spec §6.2).
 *
 * O quadro de informações, a descrição contextual e o setor de ferramentas são
 * só do mestre: o jogador nunca vê DT, reação de ferramenta nem a explicação
 * do POI. A revelação acontece pelas ações de investigação, não pela ficha.
 */
import { PERICIAS, APTIDOES_PADRAO, FERRAMENTAS_POI } from "../config.mjs";
import { OP2ItemSheet } from "./item-sheet.mjs";
import { rotuloDePericia } from "../dice/teste.mjs";
import { cicloVisibilidadeInfo, limparRevelacao } from "../cena/acoes-investigacao.mjs";
import { vincularDesafioAoPonto, removerDesafioDoPonto, todasInvestigacoes, alternarOculto } from "../cena/investigacao-ativa.mjs";
import { chaveInfo } from "../cena/investigacao.mjs";
import { textoPuroDaLinha } from "../cena/texto-linha.mjs";

export class PontoInteresseSheet extends OP2ItemSheet {
  static DEFAULT_OPTIONS = {
    classes: ["op2", "op2-ficha--poi"],
    position: { width: 560, height: "auto" },
    actions: {
      adicionarInformacao: PontoInteresseSheet.#adicionarInformacao,
      removerInformacao: PontoInteresseSheet.#removerInformacao,
      cicloVisibilidadeInfo: PontoInteresseSheet.#cicloVisibilidadeInfo,
      removerFerramenta: PontoInteresseSheet.#removerFerramenta,
      adicionarConjuntoRadio: PontoInteresseSheet.#adicionarConjuntoRadio,
      removerConjuntoRadio: PontoInteresseSheet.#removerConjuntoRadio,
      abrirDesafioVinculado: PontoInteresseSheet.#abrirDesafioVinculado,
      removerDesafioVinculado: PontoInteresseSheet.#removerDesafioVinculado,
      alternarOcultoNaInvestigacao: PontoInteresseSheet.#alternarOcultoNaInvestigacao,
      limparRevelacao: PontoInteresseSheet.#limparRevelacao,
    },
  };

  /**
   * Soltar um Desafio de acesso na ficha liga os dois. `dragDrop` em DEFAULT_OPTIONS é
   * do AppV1 e o V2 ignora: a instância é criada aqui e religada a cada render.
   */
  get _dragDrop() {
    return this.#dragDrop ??= new foundry.applications.ux.DragDrop.implementation({
      dropSelector: ".op2-poi__desafios",
      permissions: { drop: () => game.user.isGM && this.isEditable },
      callbacks: { drop: this._onDrop.bind(this) },
    });
  }

  #dragDrop = null;

  async _onDrop(evento) {
    let dados;
    try {
      dados = JSON.parse(evento.dataTransfer.getData("text/plain"));
    } catch { return; }
    if (dados?.type !== "Item") return;
    const item = await fromUuid(dados.uuid);
    if (item?.type === "desafio-acesso") await vincularDesafioAoPonto(this.item, item.uuid);
  }

  static async #alternarOcultoNaInvestigacao(_evento, alvo) {
    const investigacao = await fromUuid(alvo.dataset.investigacao);
    if (!investigacao) return;
    await alternarOculto(investigacao, "pois", this.item.uuid);
    await this.render();
  }

  static async #limparRevelacao(_evento, alvo) {
    await limparRevelacao(this.item.uuid, alvo.dataset.infoId);
    await this.render();
  }

  static async #abrirDesafioVinculado(_evento, alvo) {
    (await fromUuid(alvo.dataset.uuid))?.sheet?.render(true);
  }

  static async #removerDesafioVinculado(_evento, alvo) {
    await removerDesafioDoPonto(this.item, alvo.dataset.uuid);
  }

  static TABS = {
    principal: {
      tabs: [{ id: "investigacao" }, { id: "mestre" }],
      initial: "investigacao",
      labelPrefix: "OP2.POI.Aba",
    },
  };

  /**
   * Ferramentas recém-adicionadas ainda sem texto. O core limpa "" e " " para vazio,
   * então a linha nova vive aqui até o mestre escrever a reação — nada suja os dados.
   */
  #ferramentasNovas = new Set();

  // A ficha reflete a investigação e as revelações: quando um ator (investigação ou
  // personagem) muda, refaz — o painel faz o mesmo por outro caminho.
  #ganchoAtor = null;

  _onFirstRender(contexto, opcoes) {
    super._onFirstRender?.(contexto, opcoes);
    this.#ganchoAtor = Hooks.on("updateActor", (ator) => {
      if (["investigacao", "personagem"].includes(ator.type) && this.rendered) this.render();
    });
  }

  _onClose(opcoes) {
    super._onClose?.(opcoes);
    if (this.#ganchoAtor) { Hooks.off("updateActor", this.#ganchoAtor); this.#ganchoAtor = null; }
  }

  async _prepareContext(opcoes) {
    const contexto = await super._prepareContext(opcoes);
    const ehGM = game.user.isGM;
    const editor = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    const enriquecer = (html) => editor.enrichHTML(html ?? "", { relativeTo: this.item, secrets: this.item.isOwner });

    const ferramentas = this.item.system.ferramentas;
    const rotuloFerramenta = (chave) => game.i18n.localize(`OP2.POI.Ferramenta.${chave}`);
    // O texto salvou: não é mais "nova".
    for (const chave of [...this.#ferramentasNovas]) {
      if (ferramentas[chave]) this.#ferramentasNovas.delete(chave);
    }

    // O mestre chega aqui pelo marcador no mapa: os controles do card do painel
    // (oculto na investigação, quem já viu, limpar revelação) ficam aqui também,
    // sem precisar abrir o painel (pedido em uso real).
    const uuid = this.item.uuid;
    const investigacoes = ehGM ? todasInvestigacoes()
      .filter((inv) => inv.system.pois.includes(uuid))
      .map((inv) => ({ uuid: inv.uuid, nome: inv.name, oculto: inv.system.poisOcultos.includes(uuid) })) : [];
    const personagens = ehGM ? game.actors.filter((a) => a.type === "personagem") : [];
    const nomes = (ids) => ids.map((id) => game.actors.get(id)?.name ?? "?").join(", ");

    return {
      ...contexto,
      ehGM,
      investigacoes,
      // A aba do mestre some para jogadores — nem o rótulo pode vazar.
      tabs: ehGM ? contexto.tabs : contexto.tabs.filter((t) => t.id !== "mestre"),
      informacoes: this.item.system.informacoes.map((info, indice) => ({
        ...info,
        indice,
        // Linha antiga em HTML: mostra (e, ao salvar, grava) texto puro.
        texto: textoPuroDaLinha(info.texto),
        // Três estados por linha, um botão só (o mesmo do painel).
        estado: info.oculta ? "rascunho" : (info.aberta ? "aberta" : "descobrivel"),
        reveladoPor: ehGM ? personagens.filter((a) => a.system.estado?.infosReveladas?.has(chaveInfo(uuid, info.id))).map((a) => a.name).join(", ") : "",
        contadaPor: ehGM && info.contadaPor?.length ? nomes(info.contadaPor) : "",
      })).map((info) => ({ ...info, temRevelacao: Boolean(info.reveladoPor || info.contadaPor) })),
      descricaoBasicaEnriquecida: await enriquecer(this.item.system.descricaoBasica),
      descricaoContextualEnriquecida: await enriquecer(this.item.system.descricaoContextual),
      // Perícias válidas no quadro: as 19 comuns + cada campo de Aptidão.
      opcoesPericia: [
        ...Object.keys(PERICIAS).filter((c) => !PERICIAS[c].especializada),
        ...APTIDOES_PADRAO.map((sub) => `aptidao.${sub}`),
      ].map((c) => ({ chave: c, rotulo: rotuloDePericia(c) })),
      // Só as ferramentas com reação (ou recém-adicionadas) aparecem; as demais
      // ficam no seletor. Vazio (null ou "") = leitura normal (spec §9.3). Rádio
      // Modificado tem editor próprio (conjuntos), não texto livre (docs/LACUNAS.md).
      ferramentasConfiguradas: FERRAMENTAS_POI
        .filter((chave) => ferramentas[chave] || this.#ferramentasNovas.has(chave))
        .map((chave) => ({
          chave,
          rotulo: rotuloFerramenta(chave),
          ehRadio: chave === "radio",
          valor: chave === "radio" ? "" : (ferramentas[chave] || ""),
          conjuntos: chave === "radio"
            ? (ferramentas.radio?.conjuntos ?? []).map((conjunto, indice) => ({ ...conjunto, indice }))
            : [],
          radioTexto: chave === "radio" ? (ferramentas.radio?.texto ?? "") : "",
        })),
      ferramentasDisponiveis: FERRAMENTAS_POI
        .filter((chave) => !ferramentas[chave] && !this.#ferramentasNovas.has(chave))
        .map((chave) => ({ chave, rotulo: rotuloFerramenta(chave) })),
      // Os desafios deste ponto: a porta trancada do Depósito A é do Depósito A.
      desafiosVinculados: this.item.system.desafios.map((uuid) => fromUuidSync(uuid))
        .filter((d) => d?.type === "desafio-acesso")
        .map((d) => ({ uuid: d.uuid, nome: d.name, img: d.img })),
    };
  }

  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    if (!game.user.isGM || !this.isEditable) return;
    this._dragDrop.bind(this.element);
    // Adicionar uma ferramenta abre a linha vazia; o texto salva sozinho na edição.
    const seletor = this.element.querySelector("[data-seletor-ferramenta]");
    seletor?.addEventListener("change", async () => {
      if (!seletor.value) return;
      // Rádio Modificado não tem texto pra digitar — sem isto, a linha "nova"
      // nunca vira "configurada" (o filtro olha `ferramentas.radio` truthy).
      if (seletor.value === "radio") {
        await this.item.update({ "system.ferramentas.radio": { conjuntos: [] } });
        return;
      }
      this.#ferramentasNovas.add(seletor.value);
      this.render();
    });
  }

  static async #adicionarInformacao() {
    const informacoes = this.item.system.informacoes.map((i) => ({ ...i }));
    informacoes.push({ id: foundry.utils.randomID(), pericia: "percepcao", dt: 7, texto: "" });
    await this.item.update({ "system.informacoes": informacoes });
  }

  static async #removerInformacao(_evento, alvo) {
    const informacoes = this.item.system.informacoes
      .filter((info) => info.id !== alvo.dataset.infoId)
      .map((i) => ({ ...i }));
    await this.item.update({ "system.informacoes": informacoes });
  }

  /** Rascunho → descobrível → aberta → rascunho. Mesma regra do painel. */
  static async #cicloVisibilidadeInfo(_evento, alvo) {
    await cicloVisibilidadeInfo(this.item.uuid, alvo.dataset.infoId);
  }

  static async #removerFerramenta(_evento, alvo) {
    this.#ferramentasNovas.delete(alvo.dataset.ferramenta);
    await this.item.update({ [`system.ferramentas.${alvo.dataset.ferramenta}`]: null });
  }

  static async #adicionarConjuntoRadio() {
    const conjuntos = [...(this.item.system.ferramentas.radio?.conjuntos ?? []), { verdadeiro: true, frase: "" }];
    await this.item.update({ "system.ferramentas.radio.conjuntos": conjuntos });
  }

  static async #removerConjuntoRadio(_evento, alvo) {
    const conjuntos = (this.item.system.ferramentas.radio?.conjuntos ?? [])
      .filter((_conjunto, indice) => indice !== Number(alvo.dataset.indice));
    await this.item.update({ "system.ferramentas.radio.conjuntos": conjuntos });
  }
}
