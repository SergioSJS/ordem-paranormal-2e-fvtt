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
        // Obstáculo que se segura em vez de se abrir: a estante-porta do Ato I, que
        // pede alguém sustentando enquanto os outros passam (spec §7.5).
        sustentar: new BooleanField({ required: true, initial: false }),
        // Escapatória para tudo que o playtest não nomeia: uma tábua pregada
        // (Atletismo), um portão enferrujado (Máquinas), uma janela alta
        // (Acrobacia). O mestre diz qual perícia e como se chama.
        generico: new BooleanField({ required: true, initial: false }),
      }),

      /** Abordagem genérica: a perícia testada e o rótulo que aparece no botão. */
      generico: new SchemaField({
        pericia: new StringField({ required: true, initial: "atletismo", blank: false }),
        rotulo: new StringField({ required: true, initial: "", blank: true }),
        resolvido: new BooleanField({ required: true, initial: false }),
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
        // Quem tentou e em que rodada: é o que dá o teto de tentativas por rodada pelo
        // dado de Crime (spec §7.1) sem contador novo — o histórico já é a contagem.
        atorId: new StringField({ required: true, initial: "", blank: true }),
        rodada: new NumberField({ required: true, initial: 0, integer: true, nullable: false }),
      }), { initial: [] }),

      // HACKEAR (spec §7.3): duas abordagens independentes, cada uma com o próprio
      // estado — mesmo espírito de Arrombar/Destrancar não consumirem tentativa uma
      // da outra. Sem curva/automação do problema em si (docs/LACUNAS.md): só o
      // teste, o gate de rodada, e — no social — o banco de perguntas do mestre.
      hackTecnico: new SchemaField({
        // Alguns painéis não abrem com o teste: o resultado escolhe UMA linha de uma
        // tabela, e o que ela traz é um problema para o jogador resolver (o painel do
        // Ato I entrega uma equação). Vazia = hack comum, sucesso pela DT.
        tabela: new ArrayField(new SchemaField({
          rolagem: new StringField({ required: true, initial: "", blank: true }),
          desafio: new StringField({ required: true, initial: "", blank: true }),
          // O computador do Ato I não muda o problema por faixa: muda quanto tempo o
          // jogador tem para resolvê-lo. 0 = usa o timer padrão de 10s (spec §7.3).
          segundos: new NumberField({ required: true, initial: 0, min: 0, integer: true, nullable: false }),
        }), { initial: [] }),
        ultimaTentativaRodada: new NumberField({ required: true, initial: -1, integer: true, nullable: false }),
        resolvido: new BooleanField({ required: true, initial: false }),
      }),

      /** Sustentar contra este obstáculo (spec §7.5): a DT do ambiente e o que custa falhar. */
      sustentar: new SchemaField({
        dt: new NumberField({ required: true, initial: 7, min: 0, integer: true, nullable: false }),
        // "1d4 PV em quem estiver passando", no caso da estante — texto porque o efeito
        // é da mesa, não do sistema.
        aoFalhar: new StringField({ required: true, initial: "", blank: true }),
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
