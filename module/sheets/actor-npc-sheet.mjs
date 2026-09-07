/** Ficha reduzida de NPC: só os atributos e as perícias que o mestre declarou. */
import { ATRIBUTOS, SYSTEM_ID, PERICIAS, APTIDOES_PADRAO, ESCADA } from "../config.mjs";
import { stepDie } from "../dice/escada.mjs";
import { iconeDado } from "../ui/dice-icons.mjs";
import { ligarRodaDoMouse } from "../ui/controle-dado.mjs";
import { rolarTeste } from "../dice/teste.mjs";
import { lerConfig } from "../settings/register.mjs";
import { enriquecerHtml } from "../ui/enriquecer.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class NpcSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["op2", "op2-ficha", "op2-ficha--npc"],
    position: { width: 480, height: 640 },
    window: { resizable: true, icon: "fa-solid fa-ghost" },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      rolar: NpcSheet.#rolar,
      escolherDado: NpcSheet.#escolherDado,
      abrirSeletor: NpcSheet.#abrirSeletor,
      adicionarPericia: NpcSheet.#adicionarPericia,
      removerPericia: NpcSheet.#removerPericia,
    },
  };

  static PARTS = {
    corpo: { template: "systems/ordem-paranormal-2e/templates/actor/npc.hbs" },
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
      // O editor `toggled` mostra o HTML enriquecido quando está fechado. Sem passar
      // `enriched`, o texto salvava e a ficha aparecia vazia (achado em uso real).
      notasEnriquecidas: await enriquecerHtml(sistema.notas, this.actor),
      editavel: this.isEditable,
      recursos: {
        pv: this.#recurso(sistema.recursos.pv),
        pd: this.#recurso(sistema.recursos.pd),
      },
      atributos: Object.keys(ATRIBUTOS).map((chave) => ({
        chave,
        rotulo: game.i18n.localize(`OP2.Atributo.${chave}`),
        icone: iconeDado(sistema.atributos[chave].die),
        caminho: `system.atributos.${chave}.die`,
      })),
      pericias: Object.entries(sistema.pericias ?? {}).map(([sub, p]) => ({
        sub,
        rotulo: p.rotulo || sub,
        icone: iconeDado(p.die),
        caminho: `system.pericias.${sub}.die`,
      })),
    };
  }

  /** Mesmo critério de recurso crítico da ficha de personagem, para o mesmo pulso de aviso. */
  #recurso(recurso) {
    const max = Math.max(recurso.max, recurso.value, 0);
    const critico = recurso.max > 0 && recurso.value / recurso.max <= 0.3;
    return {
      critico,
      tracos: max > 0
        ? Array.from({ length: max }, (_, i) => ({ n: i + 1, cheio: i < recurso.value }))
        : null,
    };
  }

  static async #rolar(evento, alvo) {
    const chave = alvo.dataset.chave;
    const abrirDialogo = evento.shiftKey !== lerConfig("cliqueAbreDialogo");
    await rolarTeste(this.actor, { chavePericia: chave, rapido: !abrirDialogo });
  }

  static async #abrirSeletor(_evento, alvo) {
    alvo.closest(".op2-controle-dado")?.classList.toggle("aberto");
    // Alguns navegadores (Safari) não focam botão em clique por padrão; forçamos aqui
    // porque a roda do mouse só ajusta o dado quando o controle está focado.
    alvo.focus();
  }

  static async #escolherDado(_evento, alvo) {
    alvo.closest(".op2-controle-dado")?.classList.remove("aberto");
    await this.actor.update({ [alvo.dataset.caminho]: alvo.dataset.dado });
  }

  static async #adicionarPericia() {
    // A lista do playtest, não um campo de texto solto: a chave do sistema faz a
    // perícia do NPC rolar como a do personagem (achado em uso real: "campo aberto,
    // todo zoado").
    const content = await foundry.applications.handlebars.renderTemplate(
      `systems/${SYSTEM_ID}/templates/dialog/npc-pericia.hbs`, opcoesDePericiaNpc());
    const escolha = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("OP2.Npc.AdicionarPericia") },
      classes: ["op2", "op2-dialog", "op2-npc-pericia-dialog"],
      content,
      render: (_evento, dialog) => {
        const select = dialog.element.querySelector("select[name=chave]");
        const outra = dialog.element.querySelector(".op2-npc-pericia__outra");
        const sincronizar = () => { outra.hidden = select.value !== "__outra"; if (!outra.hidden) outra.querySelector("input").focus(); };
        select.addEventListener("change", sincronizar);
        sincronizar();
      },
      ok: {
        label: game.i18n.localize("OP2.Npc.Confirmar"),
        icon: "fa-solid fa-plus",
        callback: (_e, botao) => ({
          chave: botao.form.elements.chave.value,
          rotulo: botao.form.elements.rotulo.value.trim(),
          die: botao.form.elements.die.value,
        }),
      },
      rejectClose: false,
    });
    if (!escolha) return;
    const pericia = periciaNpcEscolhida(escolha);
    if (!pericia) return;
    if (this.actor.system.pericias?.[pericia.chave]) {
      ui.notifications.warn(game.i18n.format("OP2.Npc.PericiaRepetida", { pericia: pericia.rotulo }));
      return;
    }
    await this.actor.update({ [`system.pericias.${pericia.chave}`]: { rotulo: pericia.rotulo, die: pericia.die } });
  }

  static async #removerPericia(_evento, alvo) {
    await this.actor.update({ [`system.pericias.-=${alvo.dataset.sub}`]: null });
  }

  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    if (!this.isEditable) return;
    ligarRodaDoMouse(this.element, (caminho, passos) => {
      const atual = foundry.utils.getProperty(this.actor, caminho);
      this.actor.update({ [caminho]: stepDie(atual, passos) });
    });
  }
}

/** As opções do diálogo: perícias do playtest, Aptidões com o campo, e os dados da escada. */
export function opcoesDePericiaNpc() {
  const pericias = Object.keys(PERICIAS).filter((c) => c !== "aptidao")
    .map((chave) => ({ chave, rotulo: game.i18n.localize(`OP2.Pericia.${chave}`) }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, game.i18n.lang));
  const aptidoes = APTIDOES_PADRAO.map((sub) => ({
    chave: `aptidao-${sub}`,
    rotulo: `${game.i18n.localize("OP2.Pericia.aptidao")} (${game.i18n.localize(`OP2.Aptidao.${sub}`)})`,
  }));
  return { pericias, aptidoes, dados: ESCADA };
}

/**
 * O que gravar a partir da escolha do diálogo. Chave do sistema para as do playtest
 * (`acrobacia`), `aptidao-<campo>` para as Aptidões (ponto na chave viraria caminho
 * aninhado no `update`), e o nome em slug para "Outra". Sem nome, nada.
 * @param {{chave: string, rotulo: string, die: string}} escolha
 * @returns {{chave: string, rotulo: string, die: string}|null}
 */
export function periciaNpcEscolhida({ chave, rotulo, die }) {
  const dado = ESCADA.includes(die) ? die : "d6";
  if (chave === "__outra") {
    const nome = (rotulo ?? "").trim();
    if (!nome) return null;
    const slug = nome.slugify({ strict: true }).replace(/\./g, "-");
    return slug ? { chave: slug, rotulo: nome, die: dado } : null;
  }
  const opcoes = opcoesDePericiaNpc();
  const conhecida = [...opcoes.pericias, ...opcoes.aptidoes].find((o) => o.chave === chave);
  return conhecida ? { chave: conhecida.chave, rotulo: conhecida.rotulo, die: dado } : null;
}
