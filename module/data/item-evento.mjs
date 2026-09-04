/**
 * Evento com roteiro próprio — "A Maldição do Ídolo de Pedra" do Ato I é o exemplo.
 *
 * A contagem NÃO é a da cena: o livro conta as rodadas a partir do gatilho ("ao
 * observarem o Ídolo de Pedra…"), que pode cair na rodada 1 ou na 50 (achado em uso
 * real). Por isso o roteiro sai da investigação e vira um Item próprio: aqui as
 * rodadas são relativas (0 = o momento do gatilho) e `rodadaInicial` guarda em que
 * rodada da cena o evento foi disparado. A rodada 7 do evento é a rodada
 * `rodadaInicial + 7` da cena.
 */
const { HTMLField, ArrayField, SchemaField, NumberField, BooleanField } = foundry.data.fields;

export class EventoData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // O que faz o evento começar. Texto de mestre: quem decide que aconteceu é ele.
      gatilho: new HTMLField({ required: true, initial: "", blank: true }),
      descricao: new HTMLField({ required: true, initial: "", blank: true }),

      // O roteiro, em rodadas CONTADAS A PARTIR DO GATILHO.
      rodadas: new ArrayField(new SchemaField({
        rodada: new NumberField({ required: true, initial: 0, min: 0, integer: true, nullable: false }),
        narracao: new HTMLField({ required: true, initial: "", blank: true }),
        efeito: new HTMLField({ required: true, initial: "", blank: true }),
      }), { initial: [] }),

      disparado: new BooleanField({ required: true, initial: false }),
      // A rodada da cena em que o gatilho caiu; -1 enquanto não disparado.
      rodadaInicial: new NumberField({ required: true, initial: -1, integer: true, nullable: false }),
    };
  }
}
