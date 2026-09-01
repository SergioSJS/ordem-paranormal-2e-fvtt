/**
 * Ponto de Interesse (POI) — a unidade das cenas de investigação (spec §6.2).
 *
 * Três seções com visibilidades diferentes: o cabeçalho é narrado quando alguém
 * Investiga, o quadro de informações é revelado linha a linha, e a descrição
 * contextual é só do mestre — é ela que resolve as interações livres (spec §6.3.2).
 *
 * O estado de revelação NÃO fica aqui: é por personagem ("uma informação que você
 * ainda não tinha recebido") e mora no actor, em `estado.infosReveladas` — assim o
 * jogador grava as próprias descobertas sem precisar de permissão no item.
 */
import { FERRAMENTAS_POI } from "../config.mjs";

export class PontoInteresseData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const {
      SchemaField, StringField, NumberField, BooleanField, HTMLField, ArrayField,
    } = foundry.data.fields;

    // `null` = leitura normal, sem reação; texto = o que a ferramenta revela (spec §9.3).
    const ferramentas = {};
    for (const chave of FERRAMENTAS_POI) {
      ferramentas[chave] = new HTMLField({ nullable: true, initial: null });
    }

    return {
      /** Narrada ao Investigar. */
      descricaoBasica: new HTMLField({ required: true, initial: "", blank: true }),

      /** Só do mestre: a explicação completa, que resolve interações livres. */
      descricaoContextual: new HTMLField({ required: true, initial: "", blank: true }),

      /**
       * Quadro de informações: Perícia · DT · Informação. A coluna DT é lida de duas
       * formas — Investigar compara o tamanho do dado, Examinar compara a soma
       * rolada (spec §6.3). `pericia` aceita "percepcao" e "aptidao.artes".
       */
      informacoes: new ArrayField(new SchemaField({
        id: new StringField({ required: true, blank: false }),
        pericia: new StringField({ required: true, initial: "percepcao", blank: false }),
        dt: new NumberField({ required: true, initial: 7, min: 0, integer: true, nullable: false }),
        texto: new HTMLField({ required: true, initial: "", blank: true }),
        // Rascunho do mestre: nunca revelável enquanto oculta, mesmo que a DT seja
        // batida (spec: preparar com antecedência sem comprometer a mesa com algo
        // que ainda pode mudar). `resolverInvestigacao`/`resolverExaminar` filtram.
        oculta: new BooleanField({ required: true, initial: false }),
      })),

      ferramentas: new SchemaField(ferramentas),

      /** O Laser de Varredura revela quais POIs reagem às demais ferramentas (spec §9). */
      reveladoPorLaser: new BooleanField({ required: true, initial: false }),
    };
  }
}
