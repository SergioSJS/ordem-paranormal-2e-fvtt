/**
 * Desafio de acesso — o obstáculo que Arrombar, Destrancar ou Hackear tentam vencer
 * (spec §7.1/§7.2/§7.3).
 *
 * Cada abordagem é *independente* pro mesmo objeto — cada uma com o próprio
 * contador de tentativas, porque exceder uma não deveria consumir a outra (a mesa
 * pode narrar "força bruta", "picking" e "hackear o painel" como tentativas bem
 * diferentes no mesmo dispositivo).
 */
export class DesafioAcessoData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const {
      NumberField, BooleanField, ArrayField, SchemaField, StringField,
    } = foundry.data.fields;

    return {
      // Nem todo obstáculo aceita toda abordagem: uma porta emperrada não se
      // hackeia, um painel eletrônico não se arromba no braço (achado em uso
      // real — os quatro botões apareciam em todo desafio, sem sentido). O
      // mestre liga o que faz sentido naquele objeto.
      abordagens: new SchemaField({
        arrombar: new BooleanField({ required: true, initial: true }),
        destrancar: new BooleanField({ required: true, initial: true }),
        hackTecnico: new BooleanField({ required: true, initial: false }),
        hackSocial: new BooleanField({ required: true, initial: false }),
      }),

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

      // HACKEAR (spec §7.3): duas abordagens independentes, cada uma com o próprio
      // estado — mesmo espírito de Arrombar/Destrancar não consumirem tentativa uma
      // da outra. Sem curva/automação do problema em si (docs/LACUNAS.md): só o
      // teste, o gate de rodada, e — no social — o banco de perguntas do mestre.
      hackTecnico: new SchemaField({
        ultimaTentativaRodada: new NumberField({ required: true, initial: -1, integer: true, nullable: false }),
        resolvido: new BooleanField({ required: true, initial: false }),
      }),
      hackSocial: new SchemaField({
        // "Varia por missão" (spec) — o mestre define por desafio.
        respostasNecessarias: new NumberField({ required: true, initial: 3, min: 1, integer: true, nullable: false }),
        perguntas: new ArrayField(new SchemaField({
          pergunta: new StringField({ required: true, initial: "", blank: true }),
          resposta: new StringField({ required: true, initial: "", blank: true }),
        }), { initial: [] }),
        ultimaTentativaRodada: new NumberField({ required: true, initial: -1, integer: true, nullable: false }),
        resolvido: new BooleanField({ required: true, initial: false }),
      }),
    };
  }
}
