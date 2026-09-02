/**
 * Habilidade — de perfil, de ocupação ou ganha por nível/treino (spec §2.1).
 *
 * O playtest é assimétrico de propósito: habilidades fazem coisas diferentes entre si,
 * não concedem bônus genéricos (spec §1). Por isso o efeito mecânico aqui é declarativo
 * e restrito ao que o motor sabe aplicar — o resto é texto para a mesa.
 */
import { ATRIBUTOS, PERICIAS } from "../config.mjs";

export const ORIGENS_HABILIDADE = ["perfil", "ocupacao", "nivel", "treino", "outra"];

/** O que a habilidade oferece a um teste, quando o jogador escolhe usá-la. */
export const EFEITOS_HABILIDADE = ["nenhum", "passo", "dado-extra"];

export class HabilidadeData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { SchemaField, StringField, NumberField, BooleanField, HTMLField, SetField } = foundry.data.fields;

    return {
      origem: new StringField({ required: true, initial: "perfil", choices: ORIGENS_HABILIDADE, blank: false }),
      /** Perfil de origem, quando `origem === "perfil"`. */
      perfil: new StringField({ required: true, initial: "", blank: true }),
      custo: new StringField({ required: true, initial: "", blank: true }),
      /**
       * PD cobrados ao usar a habilidade num teste. `custo` é texto livre para a mesa
       * ler; este é o número que o diálogo de teste desconta quando o jogador marca a
       * habilidade — sem isso "gaste 2 PD para receber +d4" ficava só na descrição.
       */
      custoPD: new NumberField({ required: true, initial: 0, min: 0, integer: true, nullable: false }),
      descricao: new HTMLField({ required: true, initial: "", blank: true }),

      efeito: new SchemaField({
        tipo: new StringField({ required: true, initial: "nenhum", choices: EFEITOS_HABILIDADE, blank: false }),
        /** Passos concedidos quando `tipo === "passo"`. Pode ser negativo. */
        passos: new NumberField({ required: true, initial: 1, integer: true, nullable: false }),
        /** Dado adicional quando `tipo === "dado-extra"`; conta contra o teto de 4 (spec §4.5). */
        dado: new StringField({ required: true, initial: "d6", blank: false }),
        /** Vazio = oferece em qualquer teste; senão, só nestas chaves. */
        chaves: new SetField(new StringField(), { initial: [] }),
        /** Efeitos paranormais raros podem levar d12 → d20; precisa ser declarado (spec §3). */
        permitirD20: new BooleanField({ required: true, initial: false }),
      }),

      /**
       * Barra de Ímpeto (fichas do Ato I). O estado mora AQUI, não no personagem:
       * a barra é a habilidade. Guardada no ator, apagar a habilidade deixava a barra
       * para trás (achado em uso real). `espacos: 0` = esta habilidade não é uma barra.
       */
      impeto: new SchemaField({
        espacos: new NumberField({ required: true, initial: 0, min: 0, max: 6, integer: true, nullable: false }),
        preenchidos: new NumberField({ required: true, initial: 0, min: 0, max: 6, integer: true, nullable: false }),
      }),

      /** Habilidades podem ter uso próprio em cenas de investigação (spec §6.6). */
      usoEmInvestigacao: new HTMLField({ required: true, initial: "", blank: true }),
    };
  }

  /**
   * A habilidade se oferece neste teste?
   *
   * Casa contra a perícia E contra o atributo pareado: "quando faz um teste mental"
   * (Foco Mental, ficha do Ato I) é sobre o atributo, não sobre uma perícia
   * específica. Comparar só a chave da perícia fazia a habilidade nunca aparecer
   * (achado em uso real: "adiciona +d4 na rolagem, como fazer isso?").
   *
   * @param {string} chavePericia   ex.: "percepcao" ou "aptidao.artes"
   * @param {string} [chaveAtributo] ex.: "mente" — o atributo que vai ser rolado junto
   */
  aplicavelA(chavePericia, chaveAtributo) {
    if (this.efeito.tipo === "nenhum") return false;
    if (!this.efeito.chaves.size) return true;
    return this.efeito.chaves.has(chavePericia)
      || (Boolean(chaveAtributo) && this.efeito.chaves.has(chaveAtributo));
  }

  /**
   * PD cobrados ao usar a habilidade num teste.
   *
   * `custoPD` é o número; quando ele não foi preenchido — habilidade escrita à mão, ou
   * importada antes do campo existir — vale o que estiver escrito em `custo` ("2 PD").
   * Sem isso, "gaste 2 PD para receber +d4" não cobrava nada (achado em uso real).
   */
  get custoEmPD() {
    if (this.custoPD > 0) return this.custoPD;
    const escrito = /(\d+)\s*(pd|dp)\b/i.exec(this.custo ?? "");
    return escrito ? Number(escrito[1]) : 0;
  }

  /** Esta habilidade É uma barra de Ímpeto? */
  get temBarraImpeto() {
    return this.impeto.espacos > 0;
  }

  get impetoCheio() {
    return this.temBarraImpeto && this.impeto.preenchidos >= this.impeto.espacos;
  }

  /** Chaves válidas para o seletor da ficha do item. */
  static chavesDisponiveis() {
    return [...Object.keys(ATRIBUTOS), ...Object.keys(PERICIAS)];
  }
}
