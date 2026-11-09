/**
 * O setor de ferramentas de um ponto, como painel e ficha o mostram (spec §9.3).
 *
 * Duas leituras do mesmo dado. O mestre vê cada ferramenta com reação: a leitura
 * inteira (com a parte só dele), se está em rascunho e quem já a fez. O jogador vê só
 * as leituras que o personagem dele fez — com reação ou "leitura normal" — e nada
 * do que ainda não usou: quais ferramentas reagem é parte do desafio.
 */
import { FERRAMENTAS_POI } from "../config.mjs";
import { temReacaoFerramenta, solucaoDasPecas } from "./ferramentas.mjs";
import { leituraParaJogador, parteDoMestre, chaveLeitura } from "./leitura-ferramenta.mjs";

/**
 * @param {Item} poi
 * @param {object} opcoes
 * @param {boolean} opcoes.ehGM
 * @param {Actor[]} [opcoes.personagens]  o roster, para "lida por" (mestre)
 * @param {Actor|null} [opcoes.ator]      o personagem de quem vê (jogador)
 * @param {{enrichHTML: Function}} opcoes.editor
 * @returns {Promise<Array<object>>}
 */
export async function setorDeFerramentas(poi, { ehGM, personagens = [], ator = null, editor }) {
  const enriquecer = (html) => (html ? editor.enrichHTML(html, { relativeTo: poi }) : "");
  const ferramentas = poi.system.ferramentas ?? {};
  const ocultas = poi.system.ferramentasOcultas ?? [];
  const leu = (a, chave) => a?.system.estado.ferramentasReveladas?.has(chaveLeitura(poi.uuid, chave));
  const saida = [];

  for (const chave of FERRAMENTAS_POI) {
    const valor = ferramentas[chave];
    const lidaPor = personagens.filter((a) => leu(a, chave)).map((a) => a.name);
    const oculta = ocultas.includes(chave);
    const radio = chave === "radio";
    // O que o jogador lê: o texto da ferramenta sem a parte do mestre; no rádio com
    // enigma, a frase montada.
    const bruto = radio ? (valor?.texto ?? "") : (typeof valor === "string" ? valor : "");
    const conjuntos = radio ? (valor?.conjuntos ?? []) : [];
    const textoJogador = conjuntos.length ? `<p>${solucaoDasPecas(conjuntos).join(" ")}</p>` : leituraParaJogador(bruto);

    if (ehGM) {
      // Só as ferramentas com algo cadastrado, ou que alguém já usou.
      if (!temReacaoFerramenta(valor) && !lidaPor.length) continue;
      saida.push({
        chave,
        rotulo: game.i18n.localize(`OP2.Ferramenta.Subtipo.${chave}`),
        oculta,
        temReacao: Boolean(textoJogador.trim()),
        leitura: await enriquecer(oculta ? textoJogador : textoJogador),
        nota: await enriquecer(parteDoMestre(bruto)),
        conjuntos: conjuntos.map((c) => ({ ...c })),
        lidaPor,
      });
      continue;
    }

    if (!leu(ator, chave)) continue;
    // O rascunho ainda trancado saiu como leitura normal para o jogador — e é assim
    // que fica no painel dele até o mestre liberar e ele usar de novo.
    const temReacao = !oculta && Boolean(textoJogador.trim());
    saida.push({
      chave,
      rotulo: game.i18n.localize(`OP2.Ferramenta.Subtipo.${chave}`),
      temReacao,
      leitura: temReacao ? await enriquecer(textoJogador) : "",
    });
  }
  return saida;
}
