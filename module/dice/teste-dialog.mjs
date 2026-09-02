/**
 * Diálogo de teste.
 *
 * Monta os componentes antes de rolar: a perícia, o atributo pareado — que o mestre pode
 * trocar, porque o atributo-base é sugestão e não trava (spec §2.3) — os passos vindos
 * de ajuda e habilidades, e os dados extras. O teto de 4 dados rolados é imposto aqui
 * (spec §4.5).
 */
import { MAX_DADOS_ROLADOS, MAX_DADOS_CONTADOS, ATRIBUTOS } from "../config.mjs";
import { stepDie } from "./escada.mjs";
import { iconeDado } from "../ui/dice-icons.mjs";
import { lerConfig } from "../settings/register.mjs";
import { impetoDisponivel } from "../cena/impeto.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class TesteDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "op2-teste-dialog",
    classes: ["op2", "op2-dialog", "op2-teste-dialog"],
    tag: "form",
    window: { title: "OP2.Dialog.Teste.Titulo", icon: "fa-solid fa-dice-d20", contentClasses: ["standard-form"] },
    position: { width: 460, height: "auto" },
    form: { handler: TesteDialog.#enviar, closeOnSubmit: true },
    actions: {
      passo: TesteDialog.#ajustarPasso,
      alternarExtra: TesteDialog.#alternarExtra,
      alternarImpeto: TesteDialog.#alternarImpeto,
    },
  };

  static PARTS = {
    corpo: { template: "systems/ordem-paranormal-2e/templates/dialog/teste.hbs" },
    rodape: { template: "templates/generic/form-footer.hbs" },
  };

  /** @type {(resultado: object|null) => void} */
  #resolver;

  constructor({ ator, base, resolver, ...opcoes } = {}) {
    super(opcoes);
    this.ator = ator;
    this.base = base;
    this.#resolver = resolver;
    // A ajuda do aliado (spec §4.7) entra como passo já marcado no dado que o
    // setting `ajudaAlvo` indica — visível e ajustável, não um bônus escondido.
    const ajuda = base.ajuda;
    this.estado = {
      chaveAtributo: base.chaveAtributo,
      somenteAtributo: base.somenteAtributo ?? false,
      ajuda,
      // Ímpeto: apagar um espaço dá +d4 no teste (ficha do Ato I). É escolha do
      // jogador na hora, então mora aqui e não numa ação separada.
      impetoDisponivel: impetoDisponivel(ator),
      gastarImpeto: false,
      passos: {
        pericia: ajuda?.alvo === "pericia" ? ajuda.passos : 0,
        atributo: ajuda?.alvo === "atributo" ? ajuda.passos : 0,
      },
      extras: new Set(),
      dt: base.dt ?? lerConfig("dtPadrao"),
      oposto: base.oposto ?? false,
      // Examinar não tem DT única: cada informação do quadro tem a sua (spec §6.3.1).
      semDT: base.semDT ?? false,
    };
  }

  /**
   * Abre o diálogo e resolve com a configuração escolhida, ou `null` se cancelado.
   * @returns {Promise<object|null>}
   */
  static abrir({ ator, base }) {
    return new Promise((resolver) => new TesteDialog({ ator, base, resolver }).render({ force: true }));
  }

  get title() {
    return `${this.ator.name} — ${this.base.rotuloPericia}`;
  }

  /**
   * Habilidades do ator que se oferecem para este teste (spec §4.5/§6.6). O atributo
   * pareado entra na conta: "quando faz um teste mental" é sobre o atributo, e o
   * jogador pode ter trocado o par no próprio diálogo.
   */
  get extrasDisponiveis() {
    const pd = this.ator.system.recursos?.pd?.value ?? 0;
    return this.ator.items
      .filter((i) => i.type === "habilidade"
        && i.system.aplicavelA?.(this.base.chavePericia, this.estado.chaveAtributo))
      .map((i) => ({
        id: i.id,
        nome: i.name,
        img: i.img,
        tipo: i.system.efeito.tipo,
        passos: i.system.efeito.passos,
        dado: i.system.efeito.dado,
        custoPD: i.system.custoPD ?? 0,
        // Sem PD suficiente a habilidade aparece, mas não deixa marcar: esconder
        // faria parecer que ela não existe naquele teste.
        semPD: (i.system.custoPD ?? 0) > pd,
        ativo: this.estado.extras.has(i.id),
      }));
  }

  /** PD que as habilidades marcadas vão cobrar nesta rolagem. */
  get custoDeExtras() {
    let total = 0;
    for (const id of this.estado.extras) total += this.ator.items.get(id)?.system.custoPD ?? 0;
    return total;
  }

  /** Os dados que serão rolados com a configuração atual. */
  componentes() {
    const perfilPericia = this.base.pericia;

    let passosPericia = this.estado.passos.pericia;
    const extras = [];

    for (const item of this.ator.items) {
      if (!this.estado.extras.has(item.id)) continue;
      const efeito = item.system.efeito;
      if (efeito.tipo === "passo") passosPericia += efeito.passos;
      else if (efeito.tipo === "dado-extra") {
        extras.push({ chave: `extra.${item.id}`, rotulo: item.name, tipo: "extra", dado: efeito.dado });
      }
    }

    const permitirD20 = this.#algumExtraPermiteD20();

    const lista = [
      {
        chave: `pericia.${this.base.chavePericia}`,
        rotulo: this.base.rotuloPericia,
        tipo: "pericia",
        dado: stepDie(perfilPericia.dadoEfetivo, passosPericia, { permitirD20 }),
      },
    ];

    // Um atributo puro não pareia com outro atributo (spec §4.1): o teste é o dado
    // dele sozinho, sem o segundo componente automático.
    if (!this.estado.somenteAtributo) {
      const atributo = this.ator.system.atributos[this.estado.chaveAtributo];
      lista.push({
        chave: `atributo.${this.estado.chaveAtributo}`,
        rotulo: game.i18n.localize(`OP2.Atributo.${this.estado.chaveAtributo}`),
        tipo: "atributo",
        dado: stepDie(atributo.dadoEfetivo, this.estado.passos.atributo, { permitirD20 }),
      });
    }

    if (this.estado.gastarImpeto) {
      extras.unshift({
        chave: "impeto",
        rotulo: game.i18n.localize("OP2.Impeto.Titulo"),
        tipo: "extra",
        dado: "d4",
      });
    }

    // Dados que a ação já traz (o +d6 da esquiva, spec §8.1) entram antes dos
    // extras opcionais: eles são parte do teste, não uma escolha do jogador.
    lista.push(...(this.base.dadosExtras ?? []), ...extras);
    return lista.slice(0, MAX_DADOS_ROLADOS);
  }

  #algumExtraPermiteD20() {
    for (const id of this.estado.extras) {
      if (this.ator.items.get(id)?.system.efeito.permitirD20) return true;
    }
    return false;
  }

  async _prepareContext() {
    const componentes = this.componentes();
    const extras = this.extrasDisponiveis;

    return {
      ator: this.ator,
      estado: this.estado,
      // Sem atributo pareado para trocar quando o teste já É de um atributo puro.
      atributos: this.estado.somenteAtributo ? [] : Object.keys(ATRIBUTOS).map((chave) => ({
        chave,
        rotulo: game.i18n.localize(`OP2.Atributo.${chave}`),
        dado: this.ator.system.atributos[chave].dadoEfetivo,
        selecionado: chave === this.estado.chaveAtributo,
      })),
      componentes: componentes.map((c) => ({ ...c, icone: iconeDado(c.dado) })),
      extras,
      temExtras: extras.length > 0,
      // Rolar mais do que se soma obriga a escolher depois da rolagem (spec §4.5).
      excedeContagem: componentes.length > MAX_DADOS_CONTADOS,
      noTeto: componentes.length >= MAX_DADOS_ROLADOS,
      maxContados: MAX_DADOS_CONTADOS,
      maxRolados: MAX_DADOS_ROLADOS,
      buttons: [
        { type: "submit", icon: "fa-solid fa-dice", label: "OP2.Dialog.Teste.Rolar" },
      ],
    };
  }

  static #ajustarPasso(_evento, alvo) {
    const alvoPasso = alvo.dataset.alvo;
    const delta = Number(alvo.dataset.delta);
    this.estado.passos[alvoPasso] = Math.clamp(this.estado.passos[alvoPasso] + delta, -4, 4);
    this.render();
  }

  static #alternarImpeto() {
    this.estado.gastarImpeto = !this.estado.gastarImpeto;
    this.render();
  }

  static #alternarExtra(_evento, alvo) {
    const id = alvo.dataset.itemId;
    const item = this.ator.items.get(id);
    const custo = item?.system.custoPD ?? 0;
    if (this.estado.extras.has(id)) this.estado.extras.delete(id);
    else if (custo > (this.ator.system.recursos?.pd?.value ?? 0) - this.custoDeExtras) {
      ui.notifications.warn(game.i18n.format("OP2.Aviso.SemPD", { nome: item.name, custo }));
    }
    else if (this.componentes().length < MAX_DADOS_ROLADOS) this.estado.extras.add(id);
    else ui.notifications.warn(game.i18n.format("OP2.Aviso.TetoDeDados", { max: MAX_DADOS_ROLADOS }));
    this.render();
  }

  static async #enviar(_evento, _form, dadosDoForm) {
    const { dt, oposto, chaveAtributo } = dadosDoForm.object;
    this.estado.chaveAtributo = chaveAtributo ?? this.estado.chaveAtributo;
    this.#resolver({
      componentes: this.componentes(),
      dt: (oposto || this.estado.semDT) ? null : Number(dt),
      oposto: Boolean(oposto),
      gastarImpeto: this.estado.gastarImpeto,
      custoPD: this.custoDeExtras,
    });
    this.#resolver = null;
  }

  async _onChangeForm(_config, evento) {
    // O atributo pareado muda o dado exibido no preview, então re-renderiza na hora.
    if (evento.target?.name === "chaveAtributo") {
      this.estado.chaveAtributo = evento.target.value;
      this.render();
    }
  }

  _onClose(opcoes) {
    super._onClose(opcoes);
    this.#resolver?.(null);
    this.#resolver = null;
  }
}
