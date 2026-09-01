/**
 * Desafio de acesso físico — o obstáculo que Arrombar tenta vencer (spec §7.2).
 *
 * A pontuação acumula RA entre tentativas até atingir a Pontuação Alvo (PA); o
 * limite de tentativas é opcional (0 = sem teto) porque só fechaduras têm teto
 * no playtest — outros obstáculos (portas, correntes) não mencionam limite.
 */
export class DesafioAcessoData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { NumberField, BooleanField } = foundry.data.fields;

    return {
      dtObjeto: new NumberField({ required: true, initial: 7, min: 0, integer: true, nullable: false }),
      pontuacaoAlvo: new NumberField({ required: true, initial: 10, min: 1, integer: true, nullable: false }),
      pontuacaoAtual: new NumberField({ required: true, initial: 0, min: 0, integer: true, nullable: false }),
      maxTentativas: new NumberField({ required: true, initial: 0, min: 0, integer: true, nullable: false }),
      tentativasUsadas: new NumberField({ required: true, initial: 0, min: 0, integer: true, nullable: false }),
      quebrado: new BooleanField({ required: true, initial: false }),
    };
  }
}
