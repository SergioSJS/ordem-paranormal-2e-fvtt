/**
 * Desafio de acesso — o obstáculo que Arrombar ou Destrancar tentam vencer
 * (spec §7.1/§7.2).
 *
 * Arrombar e Destrancar são duas abordagens *independentes* para o mesmo objeto —
 * cada uma com o próprio contador de tentativas, porque exceder uma não deveria
 * consumir a outra (a mesa pode narrar "força bruta" e "picking" como tentativas
 * bem diferentes no mesmo cadeado).
 */
export class DesafioAcessoData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const {
      NumberField, BooleanField, ArrayField, SchemaField, StringField,
    } = foundry.data.fields;

    return {
      dtObjeto: new NumberField({ required: true, initial: 7, min: 0, integer: true, nullable: false }),
      pontuacaoAlvo: new NumberField({ required: true, initial: 10, min: 1, integer: true, nullable: false }),
      pontuacaoAtual: new NumberField({ required: true, initial: 0, min: 0, integer: true, nullable: false }),
      maxTentativas: new NumberField({ required: true, initial: 0, min: 0, integer: true, nullable: false }),
      tentativasUsadas: new NumberField({ required: true, initial: 0, min: 0, integer: true, nullable: false }),
      quebrado: new BooleanField({ required: true, initial: false }),

      // DESTRANCAR (spec §7.1): Mastermind — senha oculta em posições 1..facesSenha,
      // resposta por posição (exato/alto/baixo). A spec não define o tamanho do dado
      // da senha; default d6 clássico de Mastermind (docs/LACUNAS.md).
      tamanhoSenha: new NumberField({ required: true, initial: 4, min: 1, max: 8, integer: true, nullable: false }),
      facesSenha: new NumberField({ required: true, initial: 6, min: 2, max: 12, integer: true, nullable: false }),
      senha: new ArrayField(new NumberField({ required: true, min: 1, integer: true, nullable: false }), { initial: [] }),
      destrancarTentativas: new NumberField({ required: true, initial: 0, min: 0, integer: true, nullable: false }),
      destrancado: new BooleanField({ required: true, initial: false }),
      historicoDestrancar: new ArrayField(new SchemaField({
        palpite: new ArrayField(new NumberField({ required: true, integer: true })),
        resultado: new ArrayField(new StringField({ required: true, choices: ["exato", "alto", "baixo"] })),
      }), { initial: [] }),
    };
  }
}
