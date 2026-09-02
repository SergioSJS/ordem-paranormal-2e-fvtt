/**
 * Personagem jogável — agente da Ordo Realitas ou sobrevivente.
 *
 * A ficha do playtest é explicitamente reduzida (spec §2.1). Os campos de progressão
 * paranormal (NEX) e os contadores de ferimento/trauma já existem porque são citados,
 * mesmo com a mecânica ainda não publicada.
 */
import { PERFIS, TIPOS_PERSONAGEM, PERICIAS, DT_FERIMENTO_BASE, DT_FERIMENTO_INCREMENTO } from "../config.mjs";
import { stepDie, faces } from "../dice/escada.mjs";
import { campoAtributos, campoPericias, campoAptidoes, campoRecurso, campoContador } from "./campos.mjs";

export class PersonagemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { SchemaField, StringField, NumberField, BooleanField, HTMLField } = foundry.data.fields;

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

        // Sustentar (spec §7.5): fadiga cumulativa própria, distinta de
        // `reducoesTemporarias` (aquela é o efeito "até o fim da cena" da falha
        // crítica; esta é o desgaste de segurar algo, rodada a rodada).
        sustentando: new SchemaField({
          ativo: new BooleanField({ required: true, initial: false }),
          fadiga: new NumberField({ required: true, initial: 0, min: 0, integer: true, nullable: false }),
        }),
      }),

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

    for (const [chave, pericia] of Object.entries(this.pericias)) {
      pericia.dadoEfetivo = stepDie(pericia.die, pericia.stepMod ?? 0);
      // O tamanho do dado é comparado direto contra a DT ao Investigar, sem rolagem (spec §6.3).
      pericia.valor = faces(pericia.dadoEfetivo);
      pericia.especializada = PERICIAS[chave]?.especializada ?? false;
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
