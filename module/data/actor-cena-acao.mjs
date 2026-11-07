/**
 * Cena de ação do beta: combate por fases, perseguição ou furtividade (beta §7, §10, §11).
 *
 * É Actor, como a Investigação: tem ficha e vive no mundo, sem depender de canvas. O estado
 * de cada personagem (fôlego, avanço, esconderijo) mora no próprio personagem, que é dele
 * que o jogador é dono; aqui ficam a rodada, a fase e os parâmetros que variam por missão.
 */
export const TIPOS_DE_CENA = ["combate", "perseguicao", "furtividade"];

export class CenaAcaoData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const {
      HTMLField, StringField, NumberField, BooleanField, ArrayField, SchemaField, ObjectField,
    } = foundry.data.fields;

    return {
      tipo: new StringField({ required: true, initial: "combate", choices: TIPOS_DE_CENA, blank: false }),
      descricao: new HTMLField({ required: true, initial: "", blank: true }),
      ativa: new BooleanField({ required: true, initial: false }),
      rodada: new NumberField({ required: true, initial: 0, min: 0, integer: true, nullable: false }),
      fase: new StringField({ required: true, initial: "", blank: true }),

      // Uuids de ator: token sem vínculo tem PV próprio, e é isso que deixa cada afogado
      // da onda apanhar separado.
      participantes: new ArrayField(new StringField({ required: true, blank: false }), { initial: [] }),
      // Quem agiu nesta rodada, e em que fase (beta §7.1). Zera quando a rodada vira.
      agiram: new ArrayField(new SchemaField({
        ator: new StringField({ required: true, blank: false }),
        fase: new StringField({ required: true, initial: "", blank: true }),
      }), { initial: [] }),
      // O que estava de pé na virada anterior ("uuid|condição"): é como se sabe quem acabou de
      // ficar moribundo e que condição de duas rodadas já cumpriu a primeira (`virarRodada`).
      vistas: new ArrayField(new StringField(), { initial: [] }),
      // Modelos das ondas: uuids de ator NPC que viram token ao "adicionar criaturas".
      criaturas: new ArrayField(new StringField({ required: true, blank: false }), { initial: [] }),
      // Roteiro rodada a rodada (Item `evento`, o mesmo do Ato I).
      eventos: new ArrayField(new StringField(), { initial: [] }),

      // Variam por missão: ver `module/aventura/missoes.mjs`. ObjectField porque cada missão
      // traz o seu conjunto, e a mesa não edita isto na ficha.
      perseguicao: new ObjectField({ required: true, initial: () => ({}) }),
      furtividade: new ObjectField({ required: true, initial: () => ({}) }),
      // Durante a perseguição: quem se sacrificou nesta rodada dá +1d6 aos aliados.
      sacrificios: new ArrayField(new StringField(), { initial: [] }),
      // Distrair escala para o grupo inteiro (beta §11).
      usosDistrair: new NumberField({ required: true, initial: 0, min: 0, integer: true, nullable: false }),
      areaAtual: new NumberField({ required: true, initial: 0, min: 0, integer: true, nullable: false }),
    };
  }
}
