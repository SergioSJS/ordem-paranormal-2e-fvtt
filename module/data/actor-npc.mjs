/**
 * NPC — ficha reduzida (spec §10.1).
 *
 * Não recebe as 20 perícias: o mestre declara só as que aquele NPC usa, porque no
 * playtest a maioria dos oponentes existe para um punhado de testes.
 */
import { campoAtributos, campoRecurso, campoDado } from "./campos.mjs";
import { faces } from "../dice/escada.mjs";

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
      atributo.valor = faces(atributo.die);
    }
    for (const pericia of Object.values(this.pericias ?? {})) {
      pericia.dadoEfetivo = pericia.die;
      pericia.valor = faces(pericia.die);
    }
  }

  /**
   * O NPC não pareia perícia com atributo — é uma ficha reduzida, cada entrada é um
   * dado solo (spec §10.1). Por isso tudo aqui declara `tipo: "atributo"`: é o mesmo
   * sinal que `rolarTeste()` usa para não tentar montar um segundo componente
   * automático (spec §4.1 — a regra normal é perícia + atributo, mas um NPC não tem
   * essa distinção).
   * @param {string} chave
   */
  resolverChave(chave) {
    const atributo = this.atributos[chave];
    if (atributo) return { dado: atributo.dadoEfetivo, valor: atributo.valor, tipo: "atributo", chave };

    const pericia = this.pericias[chave];
    if (pericia) return { dado: pericia.dadoEfetivo, valor: pericia.valor, tipo: "atributo", chave };

    return null;
  }
}
