/** Construtores de campo reaproveitados pelos data models. */
import { ESCADA, PERICIAS, ATRIBUTOS, APTIDOES_PADRAO } from "../config.mjs";

const f = () => foundry.data.fields;

/** Um dado da escada. Nunca é `Number`: a escala do sistema é tamanho de dado (spec §1). */
export function campoDado(inicial = "d4") {
  const { StringField } = f();
  return new StringField({ required: true, initial: inicial, choices: ESCADA, blank: false });
}

/** Contador inteiro não-negativo (testes de ferimento, reduções temporárias…). */
export function campoContador(inicial = 0) {
  const { NumberField } = f();
  return new NumberField({ required: true, initial: inicial, min: 0, integer: true, nullable: false });
}

/** Recurso value/max, como PV e PD. */
export function campoRecurso(inicial = 0) {
  const { SchemaField, NumberField } = f();
  return new SchemaField({
    value: new NumberField({ required: true, initial: inicial, integer: true, nullable: false }),
    max: new NumberField({ required: true, initial: inicial, min: 0, integer: true, nullable: false }),
  });
}

/**
 * Uma perícia: o dado treinado, o atributo-base sugerido e um acumulador de passos
 * vindos de itens e efeitos. O atributo é gravado porque o mestre pode reparear
 * a perícia de forma permanente na ficha (spec §2.3).
 */
export function campoPericia(atributoBase) {
  const { SchemaField, StringField, NumberField } = f();
  return new SchemaField({
    die: campoDado(),
    atributo: new StringField({
      required: true, initial: atributoBase, blank: false, choices: Object.keys(ATRIBUTOS),
    }),
    stepMod: new NumberField({ required: true, initial: 0, integer: true, nullable: false }),
  });
}

/** As 20 perícias como schema fixo. */
export function campoPericias() {
  const { SchemaField } = f();
  const schema = {};
  for (const [chave, def] of Object.entries(PERICIAS)) schema[chave] = campoPericia(def.atributo);
  return new SchemaField(schema);
}

/** Os 3 atributos. */
export function campoAtributos(inicial = "d6") {
  const { SchemaField } = f();
  const schema = {};
  for (const chave of Object.keys(ATRIBUTOS)) schema[chave] = new SchemaField({ die: campoDado(inicial) });
  return new SchemaField(schema);
}

/**
 * Aptidão é uma coleção *dinâmica* de subperícias, não seis campos fixos: o texto fala
 * em "conhecimento em um campo específico" e a lista pode crescer (spec §2.3).
 */
export function campoAptidoes() {
  const { TypedObjectField, SchemaField, StringField } = f();
  const entrada = new SchemaField({
    rotulo: new StringField({ required: true, initial: "", blank: true }),
    die: campoDado(),
  });
  // TypedObjectField existe a partir do v13; o fallback mantém o v12 utilizável em dev.
  return TypedObjectField ? new TypedObjectField(entrada) : new foundry.data.fields.ObjectField();
}

/** Valores iniciais das aptidões padrão, usados na criação do ator. */
export function aptidoesIniciais() {
  return Object.fromEntries(APTIDOES_PADRAO.map((c) => [c, { rotulo: "", die: "d4" }]));
}
