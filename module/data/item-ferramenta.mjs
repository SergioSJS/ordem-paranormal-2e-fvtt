/**
 * Ferramenta da Ordo Realitas (spec §9) — só para agentes. Cada uma é um minigame
 * distinto; `subtipo` escolhe o handler em `module/cena/acoes-ferramenta.mjs`.
 */
import { FERRAMENTAS_ORDO } from "../config.mjs";

export class FerramentaData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { SchemaField, StringField, NumberField, BooleanField, HTMLField } = foundry.data.fields;

    return {
      subtipo: new StringField({ required: true, initial: "compendio", choices: FERRAMENTAS_ORDO, blank: false }),
      descricao: new HTMLField({ required: true, initial: "", blank: true }),

      // Só Lanterna UV e Pó Revelador têm carga limitada (spec §9); as demais são
      // ilimitadas. O campo existe em toda ferramenta pelo mesmo motivo de
      // `item-equipamento.mjs`: `usa` decide se o teto vale, sem depender do subtipo
      // em código de UI.
      cargas: new SchemaField({
        usa: new BooleanField({ required: true, initial: false }),
        value: new NumberField({ required: true, initial: 0, min: 0, integer: true, nullable: false }),
        max: new NumberField({ required: true, initial: 0, min: 0, integer: true, nullable: false }),
      }),
    };
  }
}
