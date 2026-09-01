import { TABELA_SOBRECARGA_PADRAO } from "../config.mjs";

/**
 * Investigação — a sessão narrativa que pode atravessar várias Scenes (spec §5.1).
 *
 * É Actor, não Item: tem ficha própria como personagem/NPC, e nada aqui depende de
 * Scene, token ou canvas — uma investigação pode envolver vários mapas ao mesmo
 * tempo, e trocar de mapa não pode resetar rodada, sobrecarga, participantes nem
 * as travas de Recapitular/Compartilhar (achado em uso real: o time se move entre
 * cômodos/mapas, mas continua na mesma investigação).
 *
 * POI e Desafio de Acesso continuam sendo Item — fazem sentido como conteúdo
 * autoral e reutilizável — mas o vínculo "este POI está nesta investigação" mora
 * aqui, não em flag de Scene.
 */
export class InvestigacaoData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const {
      HTMLField, StringField, NumberField, BooleanField, ArrayField, SchemaField,
    } = foundry.data.fields;

    const trava = () => new SchemaField({
      usado: new BooleanField({ required: true, initial: false }),
      atorId: new StringField({ required: true, initial: "", blank: true }),
      nome: new StringField({ required: true, initial: "", blank: true }),
    });

    return {
      descricao: new HTMLField({ required: true, initial: "", blank: true }),

      // Fim de cada rodada aplica a sobrecarga (spec §7.6); nem toda investigação usa.
      rodada: new NumberField({ required: true, initial: 0, min: 0, integer: true, nullable: false }),
      sobrecarga: new SchemaField({
        ativa: new BooleanField({ required: true, initial: false }),
        // Tabela de referência do playtest por padrão — a mesma que cada Scene
        // usava antes de ganhar uma própria (docs/LACUNAS.md).
        tabela: new ArrayField(new SchemaField({
          rodada: new NumberField({ required: true, initial: 1, min: 1, integer: true, nullable: false }),
          dano: new StringField({ required: true, initial: "0", blank: false }),
        }), { initial: () => TABELA_SOBRECARGA_PADRAO.map((linha) => ({ ...linha })) }),
      }),

      // Quem participa — não quem tem token numa Scene específica.
      participantes: new ArrayField(new StringField(), { initial: [] }),
      ordemParticipantes: new ArrayField(new StringField(), { initial: [] }),
      // Quem já agiu na rodada corrente — controle manual (spec não automatiza
      // turnos, §5.2), zerado a cada `avancarRodada()`.
      jaAgiram: new ArrayField(new StringField(), { initial: [] }),

      // POIs e desafios de acesso vinculados a esta investigação (spec §6.2/§7).
      pois: new ArrayField(new StringField(), { initial: [] }),
      desafios: new ArrayField(new StringField(), { initial: [] }),

      // Preparar com antecedência não deveria revelar na hora — o mestre pode
      // vincular um POI/desafio/participante e só torná-lo visível aos
      // jogadores quando a cena pedir (achado em uso real). Listas separadas de
      // UUIDs ocultos, não um campo por item: nada muda no vínculo em si.
      poisOcultos: new ArrayField(new StringField(), { initial: [] }),
      desafiosOcultos: new ArrayField(new StringField(), { initial: [] }),
      participantesOcultos: new ArrayField(new StringField(), { initial: [] }),

      // Travas de 1×-por-investigação (spec §6.4/§6.5).
      recapitularUsado: trava(),
      compartilharUsado: trava(),
    };
  }
}
