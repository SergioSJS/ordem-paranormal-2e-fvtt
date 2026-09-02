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
      // Rádio Modificado tem estrutura própria — minigame de ordenação de palavras
      // (spec §9.2), não cabe no texto livre das outras (docs/LACUNAS.md).
      if (chave === "radio") continue;
      ferramentas[chave] = new HTMLField({ nullable: true, initial: null });
    }
    ferramentas.radio = new SchemaField({
      conjuntos: new ArrayField(new SchemaField({
        verdadeiro: new BooleanField({ required: true, initial: true }),
        // Palavras corretas, em ordem, separadas por espaço (docs/LACUNAS.md) — o
        // app embaralha na hora de jogar; conferir a resposta é comparar de novo.
        frase: new StringField({ required: true, initial: "", blank: true }),
      }), { initial: [] }),
    }, { nullable: true, initial: null });

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
        // Três estados por linha, não dois. Com só `oculta` não existia o estado
        // do meio — o que a mesa mais usa: `oculta` trancava a linha até pro
        // Examinar, e não-oculta já aparecia pronta na tela do jogador. Não havia
        // como deixar algo "lá pra ser achado" (achado em uso real: "não volta a
        // ficar disponível para procurar").
        //
        //   oculta  → rascunho do mestre: invisível E não descobrível
        //   aberta  → o jogador vê sem gastar ação (o mestre já entregou)
        //   nenhuma → o padrão: só quem Examinar com a perícia e a DT descobre
        //
        // `resolverInvestigacao`/`resolverExaminar` filtram as duas: rascunho
        // porque não existe, aberta porque já é sabida — e aí não conta como
        // "informação nova" para efeito do custo de 1 PD (spec §6.3.1).
        oculta: new BooleanField({ required: true, initial: false }),
        aberta: new BooleanField({ required: true, initial: false }),
      })),

      ferramentas: new SchemaField(ferramentas),

      /** O Laser de Varredura revela quais POIs reagem às demais ferramentas (spec §9). */
      reveladoPorLaser: new BooleanField({ required: true, initial: false }),
    };
  }
}
