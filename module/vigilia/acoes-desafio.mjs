/** Desafios de acesso que o beta traz: Escalar e Equilibrar-se (beta §6). */
import { rolarTeste } from "../dice/teste.mjs";
import { cardVigilia } from "./card.mjs";
import { passoDeEscalada } from "./furtividade.mjs";
import { testeDeEquilibrio } from "./acoes-furtividade.mjs";

const nome = (a) => foundry.utils.escapeHTML(a.name);
const progressoDe = (ator, desafio) => ator.system.estado.progressoDesafios?.[desafio.id] ?? 0;
const gravar = (ator, desafio, n) => ator.update({ [`system.estado.progressoDesafios.${desafio.id}`]: n });

/** ESCALAR: acumula até o alvo; quem cai sofre o que já tinha acumulado. */
export async function escalar(ator, desafio, modo, { rapido = false } = {}) {
  const { alvo, dtRapido, dtCauteloso, pericia } = desafio.system.escalar;
  const pontos = progressoDe(ator, desafio);
  const roll = await rolarTeste(ator, {
    chavePericia: pericia, dt: modo === "rapido" ? dtRapido : dtCauteloso, rapido,
    contexto: `${game.i18n.localize("OP2.Desafio.Escalar")} — ${desafio.name}`,
  });
  if (!roll) return null;
  const r = passoDeEscalada({
    pontos, alvo, modo, sucesso: roll.sucesso, ra: roll.ra, rb: roll.rb,
    critico: roll.resultado.critico, segunda: roll.resultado.segunda,
  });
  await gravar(ator, desafio, r.chegou ? 0 : r.pontos);
  const chave = r.chegou ? "EscalarChegou" : (roll.sucesso ? "EscalarSubiu" : "EscalarCaiu");
  await cardVigilia(ator, {
    titulo: desafio.name,
    estilo: roll.sucesso ? "sucesso" : "falha",
    texto: game.i18n.format(`OP2.Desafio.${chave}`, { ator: nome(ator), pontos: r.pontos, alvo, dano: r.dano }),
    botoes: r.dano > 0 ? [{ rotulo: game.i18n.format("OP2.Combate2.AplicarDano", { dano: r.dano }), acao: "vigilia-dano", dados: { atorUuid: ator.uuid, quantidade: r.dano, recurso: "pv" } }] : [],
  });
  return r;
}

/** EQUILIBRAR-SE: N sucessos seguidos; caiu, d4 de dano e recomeça (p. 66). */
export async function equilibrar(ator, desafio, { rapido = false } = {}) {
  const { sucessos, danoFalha } = desafio.system.equilibrar;
  const venceu = await testeDeEquilibrio(ator, { rapido });
  if (!venceu) {
    await gravar(ator, desafio, 0);
    await ator.update({ "system.estado.equilibrio": 0 });
    await cardVigilia(ator, {
      titulo: desafio.name, estilo: "falha", texto: game.i18n.format("OP2.Desafio.EquilibrarCaiu", { ator: nome(ator) }),
      botoes: [{ rotulo: game.i18n.format("OP2.Perseguicao.DanoFisico", { ator: ator.name, dano: danoFalha || "1d4" }), acao: "vigilia-rolar-dano", dados: { atorUuid: ator.uuid, formula: danoFalha || "1d4", recurso: "pv" } }],
    });
    return { chegou: false, n: 0 };
  }
  const n = progressoDe(ator, desafio) + 1;
  const chegou = n >= sucessos;
  await gravar(ator, desafio, chegou ? 0 : n);
  if (chegou) await ator.update({ "system.estado.equilibrio": 0 });
  await cardVigilia(ator, {
    titulo: desafio.name, estilo: "sucesso",
    texto: game.i18n.format(chegou ? "OP2.Desafio.EquilibrarChegou" : "OP2.Desafio.EquilibrarAvancou", { ator: nome(ator), n, total: sucessos }),
  });
  return { chegou, n };
}
