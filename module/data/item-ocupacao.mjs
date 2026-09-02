/**
 * Ocupação (spec §2.1) — o que o personagem faz da vida, e a habilidade que isso lhe dá.
 *
 * O texto do playtest trata ocupação como campo livre: "Ocupação — texto livre. Concede
 * 1 habilidade". Não há lista fechada publicada. Este Item existe para o que a mesa
 * repete: guardar a ocupação com a habilidade dela junto, para não recriar as duas na
 * mão a cada personagem novo. O campo da ficha continua texto — arrastar a ocupação
 * para o personagem preenche o texto e traz a habilidade.
 */
export class OcupacaoData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { StringField, HTMLField } = foundry.data.fields;

    return {
      descricao: new HTMLField({ required: true, initial: "", blank: true }),

      /** Nome da habilidade concedida — o que a mesa lê. */
      habilidade: new StringField({ required: true, initial: "", blank: true }),

      /**
       * De onde puxar a habilidade ao aplicar a ocupação num personagem. Aponta para o
       * compêndio de habilidades; vazio significa "só o nome", e a mesa cria à mão.
       */
      habilidadeUuid: new StringField({ required: true, initial: "", blank: true }),
    };
  }
}
