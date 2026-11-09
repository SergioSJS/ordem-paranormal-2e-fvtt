/**
 * Personagem jogável — agente da Ordo Realitas ou sobrevivente.
 *
 * A ficha do playtest é explicitamente reduzida (spec §2.1). Os campos de progressão
 * paranormal (NEX) e os contadores de ferimento/trauma já existem porque são citados,
 * mesmo com a mecânica ainda não publicada.
 */
import { PERFIS, TIPOS_PERSONAGEM, PERICIAS, DT_FERIMENTO_BASE, DT_FERIMENTO_INCREMENTO, aptidoesDoModo } from "../config.mjs";
import { modoAtual } from "../modo.mjs";
import { stepDie, faces } from "../dice/escada.mjs";
import { PATAMARES } from "../vigilia/dano.mjs";
import { lerPassos } from "../vigilia/combate.mjs";
import { campoAtributos, campoPericias, campoAptidoes, campoRecurso, campoContador, campoAgarre } from "./campos.mjs";

export class PersonagemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { ArrayField, SchemaField, StringField, NumberField, BooleanField, HTMLField } = foundry.data.fields;

    return {
      tipo: new StringField({ required: true, initial: "agente", choices: TIPOS_PERSONAGEM, blank: false }),
      perfil: new StringField({ required: true, initial: "executor", choices: PERFIS, blank: false }),
      ocupacao: new StringField({ required: true, initial: "", blank: true }),
      nivel: new NumberField({ required: true, initial: 1, min: 1, max: 10, integer: true, nullable: false }),

      // Progressão paranormal: existe na ficha, mecânica ainda não publicada (spec §11).
      nex: new NumberField({ required: true, initial: 0, min: 0, max: 100, integer: true, nullable: false }),

      atributos: campoAtributos("d6"),
      pericias: campoPericias(),
      aptidoes: campoAptidoes(),

      // Sem fórmula publicada — vem preenchido nas fichas prontas (spec §11).
      recursos: new SchemaField({ pv: campoRecurso(0), pd: campoRecurso(0) }),

      estado: new SchemaField({
        testesFerimento: campoContador(),
        testesTrauma: campoContador(),
        // Ajuda recebida e ainda não usada (spec §4.7). Fica no personagem, não em
        // Active Effect: a escada não é aditiva, e passo pendente é exatamente o
        // tipo de coisa que `prepareDerivedData` e o diálogo de teste já sabem
        // resolver. Some no primeiro teste que a consome.
        ajuda: new SchemaField({
          passos: new NumberField({ required: true, initial: 0, min: 0, max: 2, integer: true, nullable: false }),
          de: new StringField({ required: true, initial: "", blank: true }),
          pericia: new StringField({ required: true, initial: "", blank: true }),
        }),
        // Falhas críticas reduzem atributos "até o fim da cena": é um contador zerável
        // por evento, não um efeito com duração em rodadas (spec §2.4).
        reducoesTemporarias: new SchemaField({
          fisico: campoContador(), mente: campoContador(), emocao: campoContador(),
        }),
        // O oposto da redução, e por isso um campo separado: `campoContador` trava em
        // 0, então gravar um aumento como redução negativa era silenciosamente
        // descartado — o Ímpeto cobrava os três espaços e o dado não mudava (achado
        // em uso real). Zera junto com as reduções ao encerrar a cena.
        aumentosTemporarios: new SchemaField({
          fisico: campoContador(), mente: campoContador(), emocao: campoContador(),
        }),
        // Recapitular e Compartilhar travam para o grupo após um sucesso (spec §6.4/§6.5).
        acoesUsadasNaCena: new foundry.data.fields.SetField(new StringField(), { initial: [] }),

        // A revelação é por personagem: "uma informação que você ainda não tinha
        // recebido" (spec §6.2). Fica no actor porque o jogador é dono do próprio
        // estado — grava as próprias descobertas sem permissão no item nem socket.
        // Zerada ao encerrar a cena.
        poisInvestigados: new foundry.data.fields.SetField(new StringField(), { initial: [] }),
        infosReveladas: new foundry.data.fields.SetField(new StringField(), { initial: [] }),
        // A leitura de ferramenta é da mesma natureza: "<poi>:<ferramenta>" de cada
        // leitura que este personagem fez (normal ou com reação). Antes só ia para o
        // chat e sumia da tela do jogador (achado em uso real, Ato II).
        ferramentasReveladas: new foundry.data.fields.SetField(new StringField(), { initial: [] }),

        // Dado de pavor (beta §9.1): "" = sem pavor.
        pavor: new StringField({ required: true, initial: "", blank: true }),
        // Marcadores da Análise (beta §12): 4 no máximo, somem no fim da cena.
        marcadores: campoContador(),
        // Caído, agarrado, atordoado… (beta §7.5). Sem Active Effects: quem lê é o motor.
        condicoes: new foundry.data.fields.SetField(new StringField(), { initial: [] }),
        agarre: campoAgarre(),
        // Permanentes até o mestre curar (beta §8). Lista, não Set: Laceração acumula.
        lesoes: new ArrayField(new StringField({ required: true, blank: false }), { initial: [] }),
        traumas: new ArrayField(new StringField({ required: true, blank: false }), { initial: [] }),
        armaduraGasta: campoContador(),
        // Dados guardados para um teste à escolha: relação invocada, plano, crucifixo.
        bonus: new ArrayField(new SchemaField({
          dado: new StringField({ required: true, initial: "d6", blank: false }),
          rotulo: new StringField({ required: true, initial: "", blank: true }),
        }), { initial: [] }),
        // Perseguição e furtividade (beta §10/§11): é o jogador quem grava o próprio.
        perseguicao: new SchemaField({
          avanco: campoContador(),
          folego: campoContador(),
          esforcos: campoContador(),
          periciasUsadas: new ArrayField(new StringField(), { initial: [] }),
          derrubado: new BooleanField({ required: true, initial: false }),
          obstaculo: new BooleanField({ required: true, initial: false }),
          avisado: new BooleanField({ required: true, initial: false }),
        }),
        furtividade: new SchemaField({
          esconderijo: new ArrayField(new SchemaField({
            dado: new StringField({ required: true, initial: "d6", blank: false }),
            valor: new NumberField({ required: true, initial: 1, min: 1, integer: true, nullable: false }),
          }), { initial: [] }),
          testou: new BooleanField({ required: true, initial: false }),
          avancos: campoContador(),
          usosEsconder: campoContador(),
          trilha: new BooleanField({ required: true, initial: false }),
          // Completou a área e está parado: a procura não o alcança (beta §11, p. 57).
          esperando: new BooleanField({ required: true, initial: false }),
        }),
        // Quanto falta em cada desafio que se vence por partes (Escalar, Equilibrar-se): é
        // de quem sobe, não do obstáculo. Chave: id do Item.
        progressoDesafios: new foundry.data.fields.ObjectField({ required: true, initial: () => ({}) }),
        runaUsada: new BooleanField({ required: true, initial: false }),
        // Equilíbrio (beta §6): dados de d4 gastos até o fim da travessia.
        equilibrio: campoContador(),

        // Sustentar (spec §7.5): fadiga cumulativa própria, distinta de
        // `reducoesTemporarias` (aquela é o efeito "até o fim da cena" da falha
        // crítica; esta é o desgaste de segurar algo, rodada a rodada).
        sustentando: new SchemaField({
          ativo: new BooleanField({ required: true, initial: false }),
          fadiga: new NumberField({ required: true, initial: 0, min: 0, integer: true, nullable: false }),
        }),
      }),

      // Patamar (beta §8.2): citado sem tabela de nível; o mestre escolhe.
      patamar: new StringField({ required: true, initial: "iniciante", choices: PATAMARES, blank: false }),
      // Relações (beta §9.2): grau de 0 a 3 e uma invocação por missão.
      relacoes: new ArrayField(new SchemaField({
        com: new StringField({ required: true, initial: "", blank: true }),
        grau: new NumberField({ required: true, initial: 0, min: 0, max: 3, integer: true, nullable: false }),
        rotulo: new StringField({ required: true, initial: "", blank: true }),
        invocada: new BooleanField({ required: true, initial: false }),
      }), { initial: [] }),

      biografia: new HTMLField({ required: true, initial: "", blank: true }),
    };
  }

  /**
   * Resolve os dados efetivos. É aqui que "aumento de passo" acontece — não via Active
   * Effect, porque o modo aditivo do core não representa a escada (spec §10.3).
   */
  prepareDerivedData() {
    const reducoes = this.estado.reducoesTemporarias;
    const aumentos = this.estado.aumentosTemporarios;

    for (const [chave, atributo] of Object.entries(this.atributos)) {
      const passos = (aumentos[chave] ?? 0) - (reducoes[chave] ?? 0);
      atributo.dadoEfetivo = stepDie(atributo.die, passos);
      atributo.valor = faces(atributo.dadoEfetivo);
      atributo.reduzido = passos < 0;
      atributo.aumentado = passos > 0;
    }

    // O que está vestido pesa: cota de malha –1 em Atletismo (beta §12). Vai como passo,
    // igual ao resto da escada.
    const itens = [...(this.parent?.items ?? [])].filter((i) => i.type === "equipamento" && i.system.equipado);
    const passosDeItens = {};
    for (const item of itens) {
      for (const { chave, passos } of lerPassos(item.system.passos)) {
        passosDeItens[chave] = (passosDeItens[chave] ?? 0) + passos;
      }
    }
    // Segredo do Aço: +1 ponto com qualquer item que já dê armadura (beta §12).
    const comArmadura = itens.filter((i) => i.system.armadura > 0);
    const extraPorItem = [...(this.parent?.items ?? [])]
      .some((i) => i.type === "habilidade" && i.system.mecanica === "segredo-aco") ? 1 : 0;
    const armaduraTotal = comArmadura.reduce((t, i) => t + i.system.armadura + extraPorItem, 0);
    this.armadura = {
      total: armaduraTotal,
      disponivel: Math.max(0, armaduraTotal - this.estado.armaduraGasta),
    };

    for (const [chave, pericia] of Object.entries(this.pericias)) {
      pericia.dadoEfetivo = stepDie(pericia.die, (pericia.stepMod ?? 0) + (passosDeItens[chave] ?? 0));
      // O tamanho do dado é comparado direto contra a DT ao Investigar, sem rolagem (spec §6.3).
      pericia.valor = faces(pericia.dadoEfetivo);
      pericia.especializada = PERICIAS[chave]?.especializada ?? false;
    }

    // Ficha vinda de outro modo não tem os campos deste: entram em d4, só na memória,
    // e a primeira edição grava. Assim trocar de modo não pede migração.
    for (const sub of aptidoesDoModo(modoAtual())) {
      this.aptidoes[sub] ??= { rotulo: "", die: "d4" };
    }

    for (const aptidao of Object.values(this.aptidoes ?? {})) {
      aptidao.dadoEfetivo = aptidao.die;
      aptidao.valor = faces(aptidao.die);
    }

    // DT escala 7 → 10 → 13 → 16… a cada teste já feito (spec §8.2/§8.3).
    this.estado.dtProximoFerimento = DT_FERIMENTO_BASE + DT_FERIMENTO_INCREMENTO * this.estado.testesFerimento;
    this.estado.dtProximoTrauma = DT_FERIMENTO_BASE + DT_FERIMENTO_INCREMENTO * this.estado.testesTrauma;
  }

  /**
   * Dado efetivo de uma chave de teste: `"fisico"`, `"percepcao"` ou `"aptidao.exatas"`.
   * @param {string} chave
   * @returns {{dado: string, valor: number, rotulo: string, tipo: string}|null}
   */
  resolverChave(chave) {
    if (chave.startsWith("aptidao.")) {
      const sub = chave.slice("aptidao.".length);
      const aptidao = this.aptidoes?.[sub];
      if (!aptidao) return null;
      return { dado: aptidao.dadoEfetivo ?? aptidao.die, valor: faces(aptidao.die), tipo: "pericia", chave };
    }
    if (this.atributos[chave]) {
      const a = this.atributos[chave];
      return { dado: a.dadoEfetivo, valor: a.valor, tipo: "atributo", chave };
    }
    if (this.pericias[chave]) {
      const p = this.pericias[chave];
      return { dado: p.dadoEfetivo, valor: p.valor, tipo: "pericia", chave };
    }
    return null;
  }

  /** Atributo pareado com uma perícia, respeitando o repareamento gravado na ficha. */
  atributoDe(chavePericia) {
    if (chavePericia.startsWith("aptidao.")) return this.pericias.aptidao.atributo;
    return this.pericias[chavePericia]?.atributo ?? null;
  }
}
