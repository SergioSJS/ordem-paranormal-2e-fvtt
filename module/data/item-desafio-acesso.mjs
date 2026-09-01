/**
 * Desafio de acesso — o obstáculo que bloqueia pistas (spec §7).
 *
 * Nesta fase é só o cadastro estruturado: o que o mestre precisa para anotar a
 * fechadura, o painel ou o obstáculo como no livro. Os minigames (Mastermind da
 * fechadura, pontuação acumulada do arrombamento, timer do hack) são Fase 3 e vão
 * ler exatamente estes campos.
 */
import { campoDado } from "./campos.mjs";

export class DesafioAcessoData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { SchemaField, StringField, NumberField, ArrayField } = foundry.data.fields;

    return {
      // "Desafio" é o normal; "bloqueio" é a versão dura, que fecha o POI de vez.
      categoria: new StringField({
        required: true, initial: "desafio", choices: ["desafio", "bloqueio"], blank: false,
      }),

      /** O que tranca, em texto livre: "Porta trancada", "Painel confuso — hack técnico"… */
      rotulo: new StringField({ required: true, initial: "", blank: true }),

      /** Observação em letra miúda, ex.: "Só é possível investigá-lo se conseguir entendê-lo." */
      nota: new StringField({ required: true, initial: "", blank: true }),

      /** Força bruta (spec §7.2): 1 PV por tentativa, Atletismo vs DT, acumula RA até a PA. */
      arrombar: new SchemaField({
        dt: new NumberField({ nullable: true, initial: null, min: 0, integer: true }),
        pa: new NumberField({ nullable: true, initial: null, min: 0, integer: true }),
      }),

      /** Fechadura técnica (spec §7.1): senha oculta de N dados, tentativas limitadas. */
      destrancar: new SchemaField({
        dados: new NumberField({ nullable: true, initial: null, min: 1, integer: true }),
        dado: campoDado("d6"),
        tentativas: new NumberField({ nullable: true, initial: null, min: 0, integer: true }),
      }),

      /** O que se ganha ao passar: "molho de chaves" (POIs podem ter benefícios, spec §6.2). */
      item: new StringField({ required: true, initial: "", blank: true }),

      /**
       * Hack técnico (spec §7.3): a curva "resultado do teste → problema matemático"
       * é conteúdo do dispositivo, não tabela fixa do playtest. Faixa livre + equação.
       */
      hack: new ArrayField(new SchemaField({
        faixa: new StringField({ required: true, initial: "", blank: true }),
        equacao: new StringField({ required: true, initial: "", blank: true }),
      })),
    };
  }
}
