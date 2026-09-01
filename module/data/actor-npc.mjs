/**
 * NPC — ficha reduzida (spec §10.1).
 *
 * Não recebe as 20 perícias: o mestre declara só as que aquele NPC usa, porque no
 * playtest a maioria dos oponentes existe para um punhado de testes.
 */
import { campoAtributos, campoRecurso, campoDado } from "./campos.mjs";

export class NpcData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { SchemaField, StringField, HTMLField, TypedObjectField, ObjectField } = foundry.data.fields;

    const pericia = new SchemaField({
      rotulo: new StringField({ required: true, initial: "", blank: true }),
      die: campoDado(),
    });

    return {
      categoria: new StringField({ required: true, initial: "", blank: true }),
      atributos: campoAtributos("d6"),
      pericias: TypedObjectField ? new TypedObjectField(pericia) : new ObjectField(),
      recursos: new SchemaField({ pv: campoRecurso(0), pd: campoRecurso(0) }),
      notas: new HTMLField({ required: true, initial: "", blank: true }),
    };
  }

  prepareDerivedData() {
    for (const atributo of Object.values(this.atributos)) {
      atributo.dadoEfetivo = atributo.die;
    }
    for (const pericia of Object.values(this.pericias ?? {})) {
      pericia.dadoEfetivo = pericia.die;
    }
  }
}
