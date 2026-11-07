/** Perseguição: as ações, com Foundry (beta §10). As contas estão em `perseguicao.mjs`. */
import { rolarTeste, rotuloDePericia } from "../dice/teste.mjs";
import { comoMestre } from "../ui/socket.mjs";
import { cardVigilia } from "./card.mjs";
import {
  pontosDeAvanco, formulaDoEsforco, passosDoAvanco, regraDeCarregar, avancoDoCarregado, corteDaRodada,
  atingidosPeloCorte, chegouNoObstaculo, sortear,
} from "./perseguicao.mjs";

const nome = (a) => foundry.utils.escapeHTML(a.name);
const paramsDe = (cena) => cena.system.perseguicao ?? {};

async function personagensDe(cena) {
  const { personagensDe: lista } = await import("./cena-acao.mjs");
  return lista(cena);
}

/** O diálogo do avanço: perícia, fôlego, esforço e quem se carrega. */
async function perguntarAvanco(ator, cena) {
  const estado = ator.system.estado.perseguicao;
  const params = paramsDe(cena);
  const i = (k, d) => game.i18n.format(`OP2.Perseguicao.${k}`, d ?? {});
  const candidatas = ["atletismo", "acrobacia", "sobrevivencia", "percepcao", "furtividade", "intuicao"]
    .filter((p) => p === "atletismo" || !estado.periciasUsadas.includes(p));
  const pericias = candidatas.map((p) => `<option value="${p}">${rotuloDePericia(p)}</option>`).join("");
  const outros = (await personagensDe(cena)).filter((a) => a.uuid !== ator.uuid && !a.system.estado.perseguicao.derrubado
    && regraDeCarregar(estado.avanco, a.system.estado.perseguicao.avanco).podeCarregar);
  const carregar = params.carregar && outros.length
    ? `<div class="form-group"><label>${i("Carregar")}</label><select name="carregar"><option value="">—</option>${outros.map((a) => `<option value="${a.uuid}">${nome(a)}</option>`).join("")}</select></div>`
    : "";
  return foundry.applications.api.DialogV2.prompt({
    window: { title: i("AvancarTitulo", { ator: ator.name }) },
    content: `<div class="form-group"><label>${i("Pericia")}</label><select name="pericia">${pericias}</select></div>
      <div class="form-group"><label>${i("Folego", { n: estado.folego })}</label><input type="number" name="folego" value="0" min="0" max="${Math.min(2, estado.folego)}"></div>
      <label class="op2-campo op2-campo--inline"><input type="checkbox" name="esforco"><span>${i("Esforco", { formula: formulaDoEsforco(estado.esforcos) })}</span></label>
      ${carregar}`,
    ok: {
      callback: (_e, b) => {
        const f = b.form.elements;
        return { pericia: f.pericia.value, folego: Number(f.folego.value) || 0, esforco: f.esforco.checked, carregar: f.carregar?.value ?? "" };
      },
    },
    rejectClose: false,
  });
}

/**
 * AVANÇAR. `escolha` pula o diálogo (e2e, macro).
 * @returns {Promise<{pontos: number, avanco: number}|null>}
 */
export async function avancar(ator, cena, { escolha, rapido = false } = {}) {
  const params = paramsDe(cena);
  const estado = ator.system.estado.perseguicao;
  if (estado.derrubado) return void ui.notifications.warn(game.i18n.localize("OP2.Perseguicao.Derrubado"));
  const dados = escolha ?? await perguntarAvanco(ator, cena);
  if (!dados) return null;

  // A vala (Missão 2): perceber antes, uma vez só. Tropeçar custa dois passos (beta §10).
  let tropecou = false;
  const obstaculo = params.obstaculo;
  const passouDaVala = chegouNoObstaculo(estado.avanco, obstaculo?.minimo ?? 0, estado.obstaculo);
  if (passouDaVala) {
    const teste = await rolarTeste(ator, {
      chavePericia: ator.system.pericias.sobrevivencia.valor > ator.system.pericias.percepcao.valor ? "sobrevivencia" : "percepcao",
      dt: obstaculo.dt, rapido, passos: estado.avisado ? 1 : 0, contexto: game.i18n.localize("OP2.Perseguicao.Vala"),
    });
    if (!teste) return null;
    tropecou = !teste.sucesso;
  }

  const alvoCarregado = dados.carregar ? (await import("./cena-acao.mjs")).atorDe(dados.carregar) : null;
  const passos = passosDoAvanco({ esforco: dados.esforco, carregando: Boolean(alvoCarregado), tropecou });
  const sacrificios = cena.system.sacrificios.filter((u) => u !== ator.uuid).length;
  const extras = [
    ...Array.from({ length: dados.folego }, (_v, i) => ({ chave: `folego.${i}`, rotulo: game.i18n.localize("OP2.Perseguicao.FolegoDado"), tipo: "extra", dado: "d6" })),
    ...Array.from({ length: sacrificios }, (_v, i) => ({ chave: `sacrificio.${i}`, rotulo: game.i18n.localize("OP2.Perseguicao.SacrificioDado"), tipo: "extra", dado: "d6" })),
  ];
  const roll = await rolarTeste(ator, {
    chavePericia: dados.pericia, dt: params.dt ?? 10, passos, rapido, dadosExtras: extras,
    contexto: game.i18n.localize("OP2.Perseguicao.Avancar"),
  });
  if (!roll) return null;

  const r = roll.resultado;
  const pontos = pontosDeAvanco(r);
  const base = alvoCarregado ? regraDeCarregar(estado.avanco, alvoCarregado.system.estado.perseguicao.avanco).base : estado.avanco;
  const novo = base + pontos;
  const atualizado = {
    "system.estado.perseguicao.avanco": novo,
    "system.estado.perseguicao.folego": estado.folego - dados.folego,
    "system.estado.perseguicao.obstaculo": estado.obstaculo || passouDaVala,
    // Outra perícia só uma vez (beta §10).
    "system.estado.perseguicao.periciasUsadas": dados.pericia === "atletismo" ? estado.periciasUsadas : [...estado.periciasUsadas, dados.pericia],
  };
  if (dados.esforco) atualizado["system.estado.perseguicao.esforcos"] = estado.esforcos + 1;
  await ator.update(atualizado);
  if (alvoCarregado) await comoMestre("vigilia-avanco", { atorUuid: alvoCarregado.uuid, avanco: avancoDoCarregado(alvoCarregado.system.estado.perseguicao.avanco, novo) });
  if (dados.esforco) {
    await cardVigilia(ator, {
      titulo: game.i18n.localize("OP2.Perseguicao.EsforcoTitulo"),
      botoes: [{ rotulo: game.i18n.format("OP2.Perseguicao.DanoFisico", { ator: ator.name, dano: formulaDoEsforco(estado.esforcos) }), acao: "vigilia-rolar-dano", dados: { atorUuid: ator.uuid, formula: formulaDoEsforco(estado.esforcos), recurso: "pv" } }],
    });
  }
  const { registrarAcao } = await import("./cena-acao.mjs");
  await registrarAcao(cena, ator, "");
  await cardVigilia(ator, {
    titulo: game.i18n.localize("OP2.Perseguicao.Avancar"),
    selo: `${novo}`,
    estilo: r.sucesso ? "sucesso" : "falha",
    texto: game.i18n.format("OP2.Perseguicao.Avancou", { ator: nome(ator), pontos, total: novo }),
  });
  return { pontos, avanco: novo };
}

/** Recuperar fôlego: +2 dados, no lugar de avançar (Missão 2). */
export async function recuperarFolego(ator, cena) {
  const estado = ator.system.estado.perseguicao;
  await ator.update({ "system.estado.perseguicao.folego": estado.folego + 2 });
  const { registrarAcao } = await import("./cena-acao.mjs");
  await registrarAcao(cena, ator, "");
  return cardVigilia(ator, { titulo: game.i18n.localize("OP2.Perseguicao.Recuperar"), texto: game.i18n.format("OP2.Perseguicao.Recuperou", { ator: nome(ator), n: estado.folego + 2 }) });
}

/** Sacrifício: não avança, e os aliados ganham +1d6 nesta rodada (Missão 2). */
export async function sacrificio(ator, cena) {
  await comoMestre("vigilia-sacrificio", { cenaUuid: cena.uuid, ator: ator.uuid });
  const { registrarAcao } = await import("./cena-acao.mjs");
  await registrarAcao(cena, ator, "");
  return cardVigilia(ator, { titulo: game.i18n.localize("OP2.Perseguicao.Sacrificio"), texto: game.i18n.format("OP2.Perseguicao.Sacrificou", { ator: nome(ator) }) });
}

/** Avisar da vala: quem ainda não passou ganha +1 passo para perceber (beta §10). */
export async function avisarDaVala(ator, cena) {
  for (const outro of (await personagensDe(cena)).filter((a) => a.uuid !== ator.uuid && !a.system.estado.perseguicao.obstaculo)) {
    await comoMestre("vigilia-avisado", { atorUuid: outro.uuid });
  }
  return cardVigilia(ator, { titulo: game.i18n.localize("OP2.Perseguicao.Vala"), texto: game.i18n.format("OP2.Perseguicao.Avisou", { ator: nome(ator) }) });
}

/** Os ataques das cabeças, em dois alvos sorteados (Missão 2). É botão do painel. */
export async function sortearAtaquesDasCabecas(cena) {
  const dano = paramsDe(cena).ataquesPorRodada ?? "1d6";
  const vivos = (await personagensDe(cena)).filter((a) => !a.system.estado.perseguicao.derrubado);
  const alvos = sortear(vivos, 2);
  const botoes = alvos.map((a, i) => ({
    rotulo: game.i18n.format(i === 0 ? "OP2.Perseguicao.DanoFisico" : "OP2.Perseguicao.DanoEmocional", { ator: a.name, dano }),
    acao: "vigilia-rolar-dano",
    dados: { atorUuid: a.uuid, formula: dano, recurso: i === 0 ? "pv" : "pd" },
  }));
  return cardVigilia(null, { titulo: game.i18n.localize("OP2.Perseguicao.Cabecas"), texto: game.i18n.localize("OP2.Perseguicao.CabecasTexto"), botoes });
}

/**
 * Fim de rodada: o que o corte diz, em card. Quem aplica é o mestre, pelos botões, e ele pode
 * marcar ou poupar quem quiser no painel (beta §10).
 */
export async function fimDaRodadaDaPerseguicao(cena) {
  const params = paramsDe(cena);
  const { rodada } = cena.system;
  const pcs = await personagensDe(cena);
  const corredores = pcs.map((a) => ({ id: a.uuid, avanco: a.system.estado.perseguicao.avanco, fora: a.system.estado.perseguicao.derrubado }));
  const corte = corteDaRodada(params.cortes ?? [], rodada);
  const atingidos = corte ? atingidosPeloCorte(corredores, corte.minimo, params.consequencia) : { atingidos: [], empatados: [] };
  const consequencia = params.consequencia;
  const nomeDe = (uuid) => pcs.find((a) => a.uuid === uuid)?.name ?? "";
  const nomes = (lista) => lista.map((u) => foundry.utils.escapeHTML(nomeDe(u))).join(", ");

  const botoes = [];
  // Quem morreu também sai da corrida: senão segue sendo o último no próximo corte.
  if (consequencia === "morte") {
    for (const uuid of atingidos.atingidos) {
      botoes.push({ rotulo: game.i18n.format("OP2.Perseguicao.TirarDaCorrida", { ator: nomeDe(uuid) }), acao: "vigilia-derrubado", soMestre: true, dados: { atorUuid: uuid } });
    }
  }
  if (consequencia === "derrubado") {
    for (const uuid of atingidos.atingidos) {
      botoes.push({ rotulo: game.i18n.format("OP2.Perseguicao.MarcarDerrubado", { ator: nomeDe(uuid) }), acao: "vigilia-derrubado", soMestre: true, dados: { atorUuid: uuid } });
    }
    // Quem já estava fora, e quem cai agora, apanha da água nesta rodada (Missão 1).
    const sofrem = [...pcs.filter((a) => a.system.estado.perseguicao.derrubado).map((a) => a.uuid), ...atingidos.atingidos];
    if (params.danoPorRodada) {
      for (const uuid of sofrem) {
        botoes.push({ rotulo: game.i18n.format("OP2.Perseguicao.DanoFisico", { ator: nomeDe(uuid), dano: params.danoPorRodada }), acao: "vigilia-rolar-dano", dados: { atorUuid: uuid, formula: params.danoPorRodada, recurso: "pv" } });
      }
    }
  }
  const linhas = [];
  if (corte) linhas.push(game.i18n.format("OP2.Perseguicao.Corte", { minimo: corte.minimo }));
  if (atingidos.atingidos.length) {
    linhas.push(game.i18n.format(consequencia === "morte" ? "OP2.Perseguicao.Morreu" : "OP2.Perseguicao.Atingidos", { nomes: nomes(atingidos.atingidos) }));
  }
  if (atingidos.empatados.length) linhas.push(game.i18n.format("OP2.Perseguicao.Empate", { nomes: nomes(atingidos.empatados) }));
  if (rodada >= (params.rodadas ?? 4)) linhas.push(game.i18n.localize("OP2.Perseguicao.UltimaRodada"));
  if (linhas.length || botoes.length) {
    await cardVigilia(null, { titulo: game.i18n.format("OP2.Perseguicao.FimDaRodada", { n: rodada }), estilo: atingidos.atingidos.length ? "falha" : "sucesso", linhas, botoes });
  }
  return { atingidos };
}

export function registrarPerseguicao(registrar) {
  registrar("vigilia-avanco", async ({ atorUuid, avanco }) => {
    const ator = (await import("./cena-acao.mjs")).atorDe(atorUuid);
    if (ator) await ator.update({ "system.estado.perseguicao.avanco": avanco });
  });
  registrar("vigilia-avisado", async ({ atorUuid }) => {
    const ator = (await import("./cena-acao.mjs")).atorDe(atorUuid);
    if (ator) await ator.update({ "system.estado.perseguicao.avisado": true });
  });
}
