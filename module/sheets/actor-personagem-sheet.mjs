/**
 * Ficha do personagem.
 *
 * Segue a diagramação da ficha oficial do playtest: cada perícia mostra o *par* de
 * dados que será rolado — o dado da perícia e o do atributo pareado — em vez de um
 * seletor de texto. É a leitura que o livro usa e a que torna a ficha escaneável.
 */
import { ESCADA, ATRIBUTOS, PERICIAS, PERFIS, APTIDOES_PADRAO } from "../config.mjs";
import { stepDie } from "../dice/escada.mjs";
import { rolarTeste } from "../dice/teste.mjs";
import { iconeDado } from "../ui/dice-icons.mjs";
import { lerConfig } from "../settings/register.mjs";
import { encerrarCena } from "../cena/encerrar-investigacao.mjs";
import { ligarRodaDoMouse } from "../ui/controle-dado.mjs";
import { abrirAcoesInvestigacao } from "../cena/acoes-app.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class PersonagemSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["op2", "op2-ficha", "op2-ficha--personagem"],
    position: { width: 880, height: 860 },
    window: { resizable: true, icon: "fa-solid fa-user-secret" },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      rolar: PersonagemSheet.#rolar,
      abrirAcoesInvestigacao: PersonagemSheet.#abrirAcoesInvestigacao,
      abrirDialogoTeste: PersonagemSheet.#abrirDialogoTeste,
      definirRecurso: PersonagemSheet.#definirRecurso,
      passoDado: PersonagemSheet.#passoDado,
      escolherDado: PersonagemSheet.#escolherDado,
      abrirSeletor: PersonagemSheet.#abrirSeletor,
      criarItem: PersonagemSheet.#criarItem,
      alternarEquipado: PersonagemSheet.#alternarEquipado,
      ajustarCarga: PersonagemSheet.#ajustarCarga,
      editarItem: PersonagemSheet.#editarItem,
      apagarItem: PersonagemSheet.#apagarItem,
      adicionarAptidao: PersonagemSheet.#adicionarAptidao,
      removerAptidao: PersonagemSheet.#removerAptidao,
      encerrarCena: PersonagemSheet.#encerrarCena,
      definirImpeto: PersonagemSheet.#definirImpeto,
      gastarImpetoAtributo: PersonagemSheet.#gastarImpetoAtributo,
    },
  };

  static PARTS = {
    cabecalho: { template: "systems/ordem-paranormal-2e/templates/actor/personagem-cabecalho.hbs" },
    abas: { template: "systems/ordem-paranormal-2e/templates/actor/personagem-abas.hbs" },
    habilidades: { template: "systems/ordem-paranormal-2e/templates/actor/personagem-habilidades.hbs" },
    inventario: { template: "systems/ordem-paranormal-2e/templates/actor/personagem-inventario.hbs" },
    notas: { template: "systems/ordem-paranormal-2e/templates/actor/personagem-notas.hbs" },
    pericias: { template: "systems/ordem-paranormal-2e/templates/actor/personagem-pericias.hbs" },
  };

  static TABS = {
    principal: {
      tabs: [{ id: "habilidades" }, { id: "inventario" }, { id: "notas" }],
      initial: "habilidades",
      labelPrefix: "OP2.Aba",
    },
  };

  async _prepareContext(opcoes) {
    const contexto = await super._prepareContext(opcoes);
    const sistema = this.actor.system;

    return {
      ...contexto,
      actor: this.actor,
      sistema,
      // `fields` alimenta o {{formInput}}; sem ele o editor de texto rico não sobe.
      fields: this.actor.system.schema.fields,
      editavel: this.isEditable,
      ehGM: game.user.isGM,
      atributos: this.#atributos(sistema),
      pericias: this.#pericias(sistema),
      aptidoes: this.#aptidoes(sistema),
      recursos: {
        pv: this.#recurso(sistema.recursos.pv, "pv"),
        pd: this.#recurso(sistema.recursos.pd, "pd"),
      },
      perfis: PERFIS.map((chave) => ({ chave, rotulo: game.i18n.localize(`OP2.Perfil.${chave}`) })),
      // Opções do seletor de dado, com o ícone já renderizado.
      escada: ESCADA.map((dado) => ({ dado, icone: iconeDado(dado) })),
      habilidades: this.actor.items.filter((i) => i.type === "habilidade"),
      equipamentos: this.actor.items.filter((i) => i.type === "equipamento"),
      ferramentas: this.actor.items.filter((i) => i.type === "ferramenta"),
      temReducao: Object.values(sistema.estado.reducoesTemporarias).some((n) => n > 0),
      // O aumento precisa aparecer na ficha: sem isso o jogador gasta os três espaços
      // do Ímpeto e não tem onde conferir que o dado subiu (achado em uso real).
      aumentos: Object.entries(sistema.estado.aumentosTemporarios)
        .filter(([, passos]) => passos > 0)
        .map(([chave, passos]) => ({
          chave, passos,
          rotulo: game.i18n.localize(`OP2.Atributo.${chave}`),
          dado: sistema.atributos[chave].dadoEfetivo,
          base: sistema.atributos[chave].die,
        })),
      // Barra de ímpeto: mesma leitura dos traços de recurso — um espaço por
      // clique, preenchidos primeiro.
      impeto: {
        tem: sistema.impeto.espacos > 0,
        espacos: Array.from({ length: sistema.impeto.espacos }, (_, i) => ({
          n: i + 1, cheio: i < sistema.impeto.preenchidos,
        })),
        podeGastarPasso: sistema.impeto.cheia,
      },
      biografia: await enriquecer(sistema.biografia, this.actor),
    };
  }

  #atributos(sistema) {
    return Object.keys(ATRIBUTOS).map((chave) => {
      const atributo = sistema.atributos[chave];
      return {
        chave,
        rotulo: game.i18n.localize(`OP2.Atributo.${chave}`),
        die: atributo.die,
        dadoEfetivo: atributo.dadoEfetivo,
        reduzido: atributo.reduzido,
        icone: iconeDado(atributo.dadoEfetivo, { titulo: `${game.i18n.localize(`OP2.Atributo.${chave}`)}: ${atributo.dadoEfetivo}` }),
        // O dado base vai para o tooltip; um segundo ícone na linha comeria a largura
        // do nome do atributo, que em inglês já é apertada.
        dica: atributo.reduzido
          ? `${game.i18n.localize("OP2.Atributo.Reduzido")} — ${atributo.die} → ${atributo.dadoEfetivo}`
          : null,
        caminho: `system.atributos.${chave}.die`,
      };
    });
  }

  #pericias(sistema) {
    return Object.keys(PERICIAS)
      .filter((chave) => !PERICIAS[chave].especializada)
      .map((chave) => this.#linhaDePericia(sistema, chave))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  }

  /** Uma linha da ficha: nome, dado da perícia, dado do atributo pareado. */
  #linhaDePericia(sistema, chave, { chaveAptidao } = {}) {
    const pericia = chaveAptidao ? sistema.aptidoes[chaveAptidao] : sistema.pericias[chave];
    const chaveAtributo = sistema.pericias[chave].atributo;
    const atributo = sistema.atributos[chaveAtributo];
    const chaveTeste = chaveAptidao ? `aptidao.${chaveAptidao}` : chave;

    return {
      chave: chaveTeste,
      rotulo: chaveAptidao
        ? (sistema.aptidoes[chaveAptidao].rotulo || game.i18n.localize(`OP2.Aptidao.${chaveAptidao}`))
        : game.i18n.localize(`OP2.Pericia.${chave}`),
      die: pericia.die,
      dadoEfetivo: pericia.dadoEfetivo ?? pericia.die,
      valor: pericia.valor,
      caminho: chaveAptidao ? `system.aptidoes.${chaveAptidao}.die` : `system.pericias.${chave}.die`,
      icone: iconeDado(pericia.dadoEfetivo ?? pericia.die),
      atributo: {
        chave: chaveAtributo,
        rotulo: game.i18n.localize(`OP2.Atributo.${chaveAtributo}`),
        icone: iconeDado(atributo.dadoEfetivo),
      },
    };
  }

  #aptidoes(sistema) {
    const chaves = Object.keys(sistema.aptidoes ?? {});
    const chaveAtributo = sistema.pericias.aptidao.atributo;
    return {
      rotulo: game.i18n.localize("OP2.Pericia.aptidao"),
      atributo: {
        chave: chaveAtributo,
        rotulo: game.i18n.localize(`OP2.Atributo.${chaveAtributo}`),
        icone: iconeDado(sistema.atributos[chaveAtributo].dadoEfetivo),
      },
      campos: chaves
        .map((sub) => this.#linhaDePericia(sistema, "aptidao", { chaveAptidao: sub }))
        .map((linha, i) => ({ ...linha, sub: chaves[i], padrao: APTIDOES_PADRAO.includes(chaves[i]) })),
    };
  }

  /** PV/PD como barra proporcional — a ficha oficial usa pips, mas em valores altos
   *  (16, 20+) uma trilha de quadradinhos vira ilegível. A barra escala sem esse
   *  problema, e o número ao lado continua sendo a fonte exata do valor. */
  #recurso(recurso, chave) {
    const max = Math.max(recurso.max, recurso.value, 0);
    // Abaixo de 30% do máximo os traços pulsam em vermelho — o mesmo aviso visual
    // que barra de vida baixa usa em qualquer jogo, só que com o traço do livro.
    const critico = recurso.max > 0 && recurso.value / recurso.max <= 0.3;
    return {
      chave,
      value: recurso.value,
      max: recurso.max,
      critico,
      // Sem teto: os personagens do Ato II chegam a 32-34 de PV/PD, e um limite
      // baixo faria só esse recurso cair pra número puro enquanto o outro mantém
      // os traços — mais inconsistente do que o problema que o teto tentava evitar.
      // O traço quebra em várias linhas sozinho; não fica ilegível, só mais alto.
      tracos: max > 0
        ? Array.from({ length: max }, (_, i) => ({ n: i + 1, cheio: i < recurso.value }))
        : null,
    };
  }

  /* ---------------------------------------------------------------- ações -- */

  /**
   * Ações de investigação deste personagem. Ficam na ficha, não no painel: aqui
   * quem age é este personagem, sem ambiguidade — no painel, um jogador com mais
   * de um personagem não teria como escolher (achado em uso real).
   */
  static #abrirAcoesInvestigacao() {
    abrirAcoesInvestigacao(this.actor);
  }

  static async #rolar(evento, alvo) {
    const chave = alvo.dataset.chave;
    const abrirDialogo = evento.shiftKey !== lerConfig("cliqueAbreDialogo");
    await rolarTeste(this.actor, { chavePericia: chave, rapido: !abrirDialogo });
  }

  /**
   * Gatilho explícito do diálogo completo — sem depender de Shift, que não existe em
   * toque. É o caminho de quem está no celular ou no tablet.
   */
  static async #abrirDialogoTeste(_evento, alvo) {
    await rolarTeste(this.actor, { chavePericia: alvo.dataset.chave, rapido: false });
  }

  /** Roda do mouse e teclas de seta andam na escada sem abrir nada. */
  static async #passoDado(_evento, alvo) {
    const { caminho, delta } = alvo.dataset;
    const atual = foundry.utils.getProperty(this.actor, caminho);
    await this.actor.update({ [caminho]: stepDie(atual, Number(delta)) });
  }

  static async #abrirSeletor(_evento, alvo) {
    const controle = alvo.closest(".op2-controle-dado");
    controle.classList.toggle("aberto");
    // Alguns navegadores (Safari) não focam botão em clique por padrão; forçamos aqui
    // porque a roda do mouse só ajusta o dado quando o controle está focado.
    alvo.focus();
    if (controle.classList.contains("aberto")) {
      const fechar = (e) => {
        if (controle.contains(e.target)) return;
        controle.classList.remove("aberto");
        document.removeEventListener("click", fechar, true);
      };
      document.addEventListener("click", fechar, true);
    }
  }

  static async #escolherDado(_evento, alvo) {
    const { caminho, dado } = alvo.dataset;
    alvo.closest(".op2-controle-dado")?.classList.remove("aberto");
    await this.actor.update({ [caminho]: dado });
  }

  static async #criarItem(_evento, alvo) {
    const type = alvo.dataset.tipo;
    await this.actor.createEmbeddedDocuments("Item", [{
      name: game.i18n.format("OP2.Item.Novo", { tipo: game.i18n.localize(`TYPES.Item.${type}`) }),
      type,
    }]);
  }

  static async #editarItem(_evento, alvo) {
    this.#itemDe(alvo)?.sheet.render({ force: true });
  }

  static async #apagarItem(_evento, alvo) {
    const item = this.#itemDe(alvo);
    if (!item) return;
    const confirmado = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("OP2.Item.Apagar") },
      content: `<p>${game.i18n.format("OP2.Item.ApagarConfirma", { nome: item.name })}</p>`,
    });
    if (confirmado) await item.delete();
  }

  static async #alternarEquipado(_evento, alvo) {
    const item = this.#itemDe(alvo);
    if (item) await item.update({ "system.equipado": !item.system.equipado });
  }

  static async #ajustarCarga(_evento, alvo) {
    const item = this.#itemDe(alvo);
    if (!item) return;
    const { value, max } = item.system.cargas;
    const novo = Math.min(max, Math.max(0, value + Number(alvo.dataset.delta)));
    await item.update({ "system.cargas.value": novo });
  }

  #itemDe(alvo) {
    return this.actor.items.get(alvo.closest("[data-item-id]")?.dataset.itemId);
  }

  /** Aptidão é coleção aberta: o texto fala em "um campo específico" (spec §2.3). */
  static async #adicionarAptidao() {
    const rotulo = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("OP2.Aptidao.Adicionar") },
      content: `<input type="text" name="rotulo" autofocus placeholder="${game.i18n.localize("OP2.Aptidao.Exemplo")}">`,
      ok: { callback: (_e, botao) => botao.form.elements.rotulo.value.trim() },
    });
    if (!rotulo) return;

    const chave = rotulo.slugify({ strict: true });
    if (this.actor.system.aptidoes[chave]) {
      return void ui.notifications.warn(game.i18n.format("OP2.Aviso.AptidaoDuplicada", { rotulo }));
    }
    await this.actor.update({ [`system.aptidoes.${chave}`]: { rotulo, die: "d4" } });
  }

  /** Clicar no traço N define o recurso em N; clicar no atual zera de N para N-1. */
  /**
   * Barra de ímpeto: clicar num espaço preenche até ali; clicar no último
   * preenchido apaga. Mesma interação dos traços de PV/PD, que a mesa já conhece.
   */
  static async #definirImpeto(_evento, alvo) {
    const atual = this.actor.system.impeto.preenchidos;
    const valor = Number(alvo.dataset.valor);
    const novo = valor === atual ? valor - 1 : valor;
    await this.actor.update({ "system.impeto.preenchidos": Math.max(0, novo) });
  }

  /**
   * Apagar a barra cheia sobe um atributo em um passo até o fim da cena. O aumento
   * usa o mesmo campo das reduções temporárias, com sinal invertido: a ficha já
   * resolve `stepDie(die, -reducao)` em `prepareDerivedData`, e encerrar a cena já
   * zera tudo — não precisa de um segundo caminho para desfazer.
   */
  static async #gastarImpetoAtributo() {
    const { impeto } = this.actor.system;
    if (!impeto.cheia) return;

    const opcoes = Object.keys(ATRIBUTOS)
      .map((chave) => `<option value="${chave}">${game.i18n.localize(`OP2.Atributo.${chave}`)}</option>`)
      .join("");
    const escolhido = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("OP2.Impeto.Passo") },
      content: `
        <div class="form-group">
          <label>${game.i18n.localize("OP2.Impeto.QualAtributo")}</label>
          <select name="atributo">${opcoes}</select>
        </div>`,
      ok: { callback: (_evento, botao) => botao.form.elements.atributo.value },
      rejectClose: false,
    });
    if (!escolhido) return;

    const atual = this.actor.system.estado.aumentosTemporarios[escolhido] ?? 0;
    await this.actor.update({
      "system.impeto.preenchidos": 0,
      [`system.estado.aumentosTemporarios.${escolhido}`]: atual + 1,
    });
    ui.notifications.info(game.i18n.format("OP2.Impeto.PassoAplicado", {
      atributo: game.i18n.localize(`OP2.Atributo.${escolhido}`),
    }));
  }

  static async #definirRecurso(_evento, alvo) {
    const { recurso, valor } = alvo.dataset;
    const atual = this.actor.system.recursos[recurso].value;
    const novo = Number(valor) === atual ? Number(valor) - 1 : Number(valor);
    await this.actor.update({ [`system.recursos.${recurso}.value`]: Math.max(0, novo) });
  }

  static async #removerAptidao(_evento, alvo) {
    await this.actor.update({ [`system.aptidoes.-=${alvo.dataset.sub}`]: null });
  }

  static async #encerrarCena() {
    await encerrarCena({ atores: [this.actor] });
  }

  /** Filtro da coluna de perícias. Sobrevive ao re-render que o form dispara. */
  #busca = "";

  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);

    const campo = this.element.querySelector(".op2-busca__campo");
    if (campo) {
      campo.value = this.#busca;
      campo.addEventListener("input", (evento) => {
        this.#busca = evento.target.value;
        this.#filtrarPericias();
      });
      if (this.#busca) this.#filtrarPericias();
    }

    if (!this.isEditable) return;

    ligarRodaDoMouse(this.element, (caminho, passos) => {
      const atual = foundry.utils.getProperty(this.actor, caminho);
      this.actor.update({ [caminho]: stepDie(atual, passos) });
    });
  }

  /**
   * Esconde as linhas que não casam com a busca. A Aptidão abre sozinha quando um
   * subcampo casa — senão o resultado ficaria escondido dentro do `<details>` fechado.
   */
  #filtrarPericias() {
    const termo = this.#busca.trim().toLowerCase();
    const semAcento = (texto) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const alvo = semAcento(termo);

    for (const linha of this.element.querySelectorAll(".op2-pericia")) {
      const nome = semAcento(linha.querySelector(".op2-pericia__nome")?.textContent ?? "").toLowerCase();
      linha.hidden = Boolean(alvo) && !nome.includes(alvo);
    }

    const aptidao = this.element.querySelector(".op2-aptidao");
    if (!aptidao) return;
    const algumVisivel = [...aptidao.querySelectorAll(".op2-pericia")].some((l) => !l.hidden);
    aptidao.hidden = Boolean(alvo) && !algumVisivel;
    if (alvo && algumVisivel) aptidao.open = true;
  }
}

function enriquecer(html, ator) {
  const editor = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
  return editor.enrichHTML(html, { relativeTo: ator, secrets: ator.isOwner });
}
