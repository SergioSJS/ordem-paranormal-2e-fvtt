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

      /** Habilidades podem ter uso próprio em cenas de investigação (spec §6.6). */
      usoEmInvestigacao: new HTMLField({ required: true, initial: "", blank: true }),
    };
  }

  /** A habilidade se oferece neste teste? @param {string} chave */
  aplicavelA(chave) {
    if (this.efeito.tipo === "nenhum") return false;
    if (!this.efeito.chaves.size) return true;
    return this.efeito.chaves.has(chave);
  }

  /** Chaves válidas para o seletor da ficha do item. */
  static chavesDisponiveis() {
    return [...Object.keys(ATRIBUTOS), ...Object.keys(PERICIAS)];
  }
}
