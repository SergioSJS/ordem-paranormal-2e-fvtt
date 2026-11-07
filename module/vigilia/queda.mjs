/**
 * Testes de lesão e de trauma do beta (beta §8.2/§8.3): o que acontece ao zerar PV ou PD.
 * Substitui o `cena/ferimentos.mjs` quando o combate novo vale.
 *
 * Tudo por clique, como no resto do sistema: o card pede, o dono rola, e a linha da tabela
 * só cai na ficha com outro clique. A morte só é anunciada: quem tira o personagem é a mesa.
 */
import { rolarTeste } from "../dice/teste.mjs";
import { cardVigilia, donosDe } from "./card.mjs";
import { dtDeQueda } from "./combate.mjs";
import {
  LESOES, TRAUMAS, linhaDaTabela, precisaRolarDeNovo, bonusDePatamar, efeitoDoTesteDeLesao, maximosDaLinha,
} from "./dano.mjs";

const TIPOS = {
  lesao: {
    recurso: "pv", contador: "testesFerimento", pericia: "vigor", atributo: "fisico",
    tabela: LESOES, lista: "lesoes", i18n: "OP2.Lesao",
  },
  trauma: {
    recurso: "pd", contador: "testesTrauma", pericia: "disciplina", atributo: "emocao",
    tabela: TRAUMAS, lista: "traumas", i18n: "OP2.TraumaBeta",
  },
};

/** O card que pede o teste. @param {"lesao"|"trauma"} tipo */
export async function pedirTesteBeta(ator, tipo) {
  const config = TIPOS[tipo];
  const dt = dtDeQueda(ator.system.estado[config.contador]);
  return cardVigilia(ator, {
    titulo: game.i18n.localize(`${config.i18n}.TesteTitulo`),
    texto: game.i18n.format(`${config.i18n}.TesteTexto`, { ator: foundry.utils.escapeHTML(ator.name), dt }),
    estilo: "falha",
    whisper: donosDe(ator),
    botoes: [{
      rotulo: game.i18n.format(`${config.i18n}.Rolar`, { dt }),
      acao: "vigilia-teste-queda",
      dados: { atorUuid: ator.uuid, tipo },
    }],
  });
}

/** Rola o teste; o contador sobe sempre, passou ou não (beta §8.2). */
export async function rolarTesteBeta(ator, tipo, { rapido = false } = {}) {
  const config = TIPOS[tipo];
  const feitos = ator.system.estado[config.contador];
  const roll = await rolarTeste(ator, {
    chavePericia: config.pericia,
    chaveAtributo: config.atributo,
    dt: dtDeQueda(feitos),
    rapido,
    contexto: game.i18n.localize(`${config.i18n}.TesteTitulo`),
  });
  if (!roll) return null;
  await ator.update({ [`system.estado.${config.contador}`]: feitos + 1 });

  if (tipo === "trauma") {
    if (roll.sucesso) {
      await cardVigilia(ator, { titulo: game.i18n.localize("OP2.TraumaBeta.TesteTitulo"), estilo: "sucesso",
        texto: game.i18n.format("OP2.TraumaBeta.Passou", { ator: foundry.utils.escapeHTML(ator.name) }) });
      return { roll };
    }
    await pedirTabela(ator, "trauma");
    return { roll };
  }

  const efeito = efeitoDoTesteDeLesao(roll.desfecho);
  if (efeito.lesao) {
    await pedirTabela(ator, "lesao");
    return { roll, efeito };
  }
  await aplicarEfeitoDoTeste(ator, efeito);
  await cardVigilia(ator, {
    titulo: game.i18n.localize("OP2.Lesao.TesteTitulo"),
    estilo: efeito.morte ? "falha-critica" : "sucesso",
    texto: game.i18n.format(`OP2.Lesao.Desfecho.${roll.desfecho}`, { ator: foundry.utils.escapeHTML(ator.name) }),
  });
  return { roll, efeito };
}

async function aplicarEfeitoDoTeste(ator, efeito) {
  const condicoes = new Set(ator.system.estado.condicoes);
  for (const c of efeito.condicoes ?? []) condicoes.add(c);
  for (const c of efeito.sai ?? []) condicoes.delete(c);
  const dados = { "system.estado.condicoes": [...condicoes] };
  if (efeito.recupera) dados["system.recursos.pv.value"] = ator.system.recursos.pv.value + efeito.recupera;
  await ator.update(dados);
}

async function pedirTabela(ator, tipo) {
  const config = TIPOS[tipo];
  return cardVigilia(ator, {
    titulo: game.i18n.localize(`${config.i18n}.TabelaTitulo`),
    texto: game.i18n.format(`${config.i18n}.TabelaTexto`, { ator: foundry.utils.escapeHTML(ator.name) }),
    estilo: "falha",
    botoes: [
      { rotulo: game.i18n.localize(`${config.i18n}.RolarTabela`), acao: "vigilia-tabela-queda", dados: { atorUuid: ator.uuid, tipo } },
      // Dano não letal rola 2d20 e fica com o melhor; só a lesão tem isso (beta §8.1).
      ...(tipo === "lesao" ? [{ rotulo: game.i18n.localize("OP2.Lesao.RolarNaoLetal"), acao: "vigilia-tabela-queda", dados: { atorUuid: ator.uuid, tipo, naoLetal: 1 } }] : []),
    ],
  });
}

/**
 * Rola na tabela; o card traz o botão que aplica na ficha. Repetida rola de novo (beta §8.2), com um limite para
 * não prender a mesa em quem já tem a tabela quase toda.
 */
export async function rolarTabelaBeta(ator, tipo, { naoLetal = false, formula } = {}) {
  const config = TIPOS[tipo];
  const jaTem = ator.system.estado[config.lista];
  const bonus = bonusDePatamar(ator.system.patamar);
  const expressao = formula ?? (naoLetal ? "2d20kh" : "1d20");
  let roll;
  let linha;
  for (let tentativa = 0; tentativa < 20; tentativa += 1) {
    roll = await new Roll(`${expressao} + ${bonus}`).evaluate();
    linha = linhaDaTabela(config.tabela, roll.total);
    if (!precisaRolarDeNovo(linha, jaTem)) break;
  }
  await cardVigilia(ator, {
    titulo: game.i18n.localize(`${config.i18n}.${linha.chave}.nome`),
    selo: `${roll.total}`,
    estilo: linha.morte ? "falha-critica" : "falha",
    texto: game.i18n.localize(`${config.i18n}.${linha.chave}.efeito`),
    rolls: [roll],
    botoes: linha.morte ? [] : [{
      rotulo: game.i18n.localize("OP2.Lesao.AplicarLinha"), acao: "vigilia-aplicar-linha",
      dados: { atorUuid: ator.uuid, tipo, chave: linha.chave },
    }],
  });
  return { roll, linha };
}

/** "Fim da cena com 0 PV, recupera 1", se sobreviveu, e quem sabe é a mesa (beta §8.2). */
export const botoesDeRecuperacao = (pcs) => pcs.filter((a) => a.system.recursos.pv.value === 0).map((a) => ({
  rotulo: game.i18n.format("OP2.CenaAcao.RecuperaUmPv", { ator: a.name }),
  acao: "vigilia-recupera-pv", soMestre: true, dados: { atorUuid: a.uuid },
}));

/** O botão do card: acha a linha pela chave e aplica. */
export function aplicarLinhaPorChave(ator, tipo, chave) {
  const linha = TIPOS[tipo].tabela.find((l) => l.chave === chave);
  return linha ? aplicarLinha(ator, tipo, linha) : null;
}

/**
 * Anotar ou curar à mão mexe no máximo como a tabela: Laceração e Chaga pesam nos dois sentidos.
 * @param {Actor} ator
 * @param {"lesoes"|"traumas"} lista
 * @param {string} chave
 * @param {1|-1} sinal -1 ao ganhar a linha, 1 ao curar
 */
export function dadosDosMaximos(ator, lista, chave, sinal) {
  const { pv, pd } = maximosDaLinha(lista, chave);
  const dados = {};
  if (pv) dados["system.recursos.pv.max"] = Math.max(0, ator.system.recursos.pv.max - sinal * pv);
  if (pd) dados["system.recursos.pd.max"] = Math.max(0, ator.system.recursos.pd.max - sinal * pd);
  return dados;
}

/** O que cada linha faz na ficha. Exportada para o e2e aplicar uma linha conhecida. */
export async function aplicarLinha(ator, tipo, linha) {
  const config = TIPOS[tipo];
  const estado = ator.system.estado;
  const dados = {};
  if (linha.perm) dados[`system.estado.${config.lista}`] = [...estado[config.lista], linha.chave];
  if (linha.pvMax) {
    dados["system.recursos.pv.max"] = Math.max(0, ator.system.recursos.pv.max + linha.pvMax);
  }
  if (linha.pdMax) {
    dados["system.recursos.pd.max"] = Math.max(0, ator.system.recursos.pd.max + linha.pdMax);
  }
  if (linha.recupera) dados["system.recursos.pv.value"] = ator.system.recursos.pv.value + linha.recupera;
  if (linha.recuperaPd) dados["system.recursos.pd.value"] = ator.system.recursos.pd.value + linha.recuperaPd;
  if (linha.reduz) {
    dados[`system.estado.reducoesTemporarias.${linha.reduz}`] = estado.reducoesTemporarias[linha.reduz] + 1;
  }
  // Pânico: recebe dado de pavor; quem já tem sobe um passo (beta §9.1).
  if (linha.pavor) dados["system.estado.pavor"] = subirPavor(estado.pavor);
  // Depois de rolar na tabela, se sobreviver, sai de moribundo (beta §8.2).
  // Morte Lenta também acorda: age mais uma rodada e morre ao fim dela.
  if (tipo === "lesao" && !linha.morte) {
    const saem = linha.acorda ? ["moribundo", "inconsciente"] : ["moribundo"];
    dados["system.estado.condicoes"] = [...estado.condicoes].filter((c) => !saem.includes(c));
  }
  if (Object.keys(dados).length) await ator.update(dados);
}

const ESCADA_PAVOR = ["d6", "d8", "d10", "d12"];
/** Receber pavor: d6 de início, um passo a mais se já tem, até d12. */
export const subirPavor = (atual) => (atual ? ESCADA_PAVOR[Math.min(ESCADA_PAVOR.indexOf(atual) + 1, ESCADA_PAVOR.length - 1)] : "d6");
