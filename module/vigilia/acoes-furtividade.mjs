/** Furtividade: as ações, com Foundry (beta §11). As contas estão em `furtividade.mjs`. */
import { rolarTeste } from "../dice/teste.mjs";
import { DT_PADRAO } from "../config.mjs";
import { comoMestre } from "../ui/socket.mjs";
import { cardVigilia } from "./card.mjs";
import {
  dadosDeEsconderijo, maiorDado, aplicarProcura, formulaPorMaiorDado, dtQueEscala, chamarAtencao,
  equilibrado, dadosDeEquilibrio, quedaPorMargem,
} from "./furtividade.mjs";
import { sortear } from "./perseguicao.mjs";

const nome = (a) => foundry.utils.escapeHTML(a.name);
const paramsDe = (cena) => cena.system.furtividade ?? {};
const estadoDe = (a) => a.system.estado.furtividade;

async function vivosDe(cena) {
  const { personagensDe } = await import("./cena-acao.mjs");
  return personagensDe(cena);
}
/** Agir marca a rodada e tira da espera: quem segue agindo volta a correr risco (p. 57). */
const agir = async (cena, ator) => {
  if (estadoDe(ator).esperando) await ator.update({ "system.estado.furtividade.esperando": false });
  return (await import("./cena-acao.mjs")).registrarAcao(cena, ator, "personagens");
};
/** Quem a procura alcança: quem completou a área e está esperando fica de fora. */
const expostosDe = async (cena) => (await vivosDe(cena)).filter((a) => !estadoDe(a).esperando);
/** Escuro no fundo da encosta: –1 passo em tudo, a partir de certo avanço (p. 59). */
function passosDoEscuro(cena, ator) {
  const area = paramsDe(cena).areas?.[cena.system.areaAtual];
  return area?.escuridao && estadoDe(ator).avancos >= area.escuridao ? -1 : 0;
}

/**
 * TESTE DE ESCONDERIJO (p. 55): não soma; os dados ficam com o valor. Crítico rola um a
 * mais, igual a um dos dados do teste.
 */
export async function testeDeEsconderijo(ator, { pericia = "furtividade", rapido = false } = {}) {
  const roll = await rolarTeste(ator, { chavePericia: pericia, semDT: true, rapido, semCard: true, contexto: game.i18n.localize("OP2.Furtividade.Teste") });
  if (!roll) return null;
  const dados = dadosDeEsconderijo(roll.dados);
  if (roll.resultado.critico && dados.length) {
    const extra = await new Roll(`1${dados[0].dado}`).evaluate();
    dados.push({ dado: dados[0].dado, valor: extra.total });
  }
  await ator.update({ "system.estado.furtividade.esconderijo": dados, "system.estado.furtividade.testou": true });
  await cardVigilia(ator, {
    titulo: game.i18n.localize("OP2.Furtividade.Teste"),
    texto: game.i18n.format("OP2.Furtividade.Escondeu", { ator: nome(ator), dados: textoDos(dados) }),
    rolls: [roll],
  });
  return dados;
}

const textoDos = (dados) => (dados.length ? dados.map((d) => `${d.dado} [${d.valor}]`).join(", ") : "—");

/** Um dado rolado vira esconderijo; o jogador escolhe qual. */
async function escolherDadoDoTeste(roll) {
  const dados = dadosDeEsconderijo(roll.dados);
  if (dados.length <= 1) return dados[0] ?? null;
  const opcoes = dados.map((d, i) => `<option value="${i}">${d.dado} [${d.valor}]</option>`).join("");
  const i = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("OP2.Furtividade.EscolherDado") },
    content: `<div class="form-group"><select name="d">${opcoes}</select></div>`,
    ok: { callback: (_e, b) => Number(b.form.elements.d.value) },
    rejectClose: false,
  });
  return dados[i ?? 0];
}

/** ESCONDER-SE: Furtividade DT 7, +3 a cada uso próprio (p. 55). */
export async function esconderSe(ator, cena, { rapido = false } = {}) {
  const estado = estadoDe(ator);
  const roll = await rolarTeste(ator, { chavePericia: "furtividade", dt: dtQueEscala(estado.usosEsconder), rapido, passos: passosDoEscuro(cena, ator), contexto: game.i18n.localize("OP2.Furtividade.Esconder") });
  if (!roll) return null;
  const dados = { "system.estado.furtividade.usosEsconder": estado.usosEsconder + 1 };
  if (roll.sucesso) {
    const dado = rapido ? dadosDeEsconderijo(roll.dados)[0] : await escolherDadoDoTeste(roll);
    if (dado) dados["system.estado.furtividade.esconderijo"] = [...estado.esconderijo, dado];
  }
  await ator.update(dados);
  await agir(cena, ator);
  return roll;
}

/** DISTRAIR: Enganação DT 7, +3 por uso de qualquer um; o dado vai para si ou para aliado. */
export async function distrair(ator, cena, { aliado, rapido = false } = {}) {
  const dt = dtQueEscala(cena.system.usosDistrair);
  const roll = await rolarTeste(ator, { chavePericia: "enganacao", dt, rapido, passos: passosDoEscuro(cena, ator), contexto: game.i18n.localize("OP2.Furtividade.Distrair") });
  if (!roll) return null;
  await comoMestre("vigilia-distrair", { cenaUuid: cena.uuid });
  if (roll.sucesso) {
    const dado = rapido ? dadosDeEsconderijo(roll.dados)[0] : await escolherDadoDoTeste(roll);
    const alvo = aliado ?? ator;
    if (dado) await comoMestre("vigilia-esconderijo", { atorUuid: alvo.uuid, esconderijo: [...estadoDe(alvo).esconderijo, dado] });
  }
  await agir(cena, ator);
  return roll;
}

/** CHAMAR ATENÇÃO: perde dois para o aliado ganhar um (p. 55). */
export async function chamarAtencaoPara(ator, aliado, cena) {
  const r = chamarAtencao(estadoDe(ator).esconderijo, estadoDe(aliado).esconderijo);
  if (!r) return void ui.notifications.warn(game.i18n.localize("OP2.Furtividade.SemDados"));
  await ator.update({ "system.estado.furtividade.esconderijo": r.meus });
  await comoMestre("vigilia-esconderijo", { atorUuid: aliado.uuid, esconderijo: r.deles });
  await agir(cena, ator);
  return cardVigilia(ator, { titulo: game.i18n.localize("OP2.Furtividade.Chamar"), texto: game.i18n.format("OP2.Furtividade.Chamou", { ator: nome(ator), aliado: nome(aliado) }) });
}

/** AÇÃO CHAMATIVA: barulho custa um dado. */
export async function acaoChamativa(ator) {
  const [, ...resto] = estadoDe(ator).esconderijo;
  await ator.update({ "system.estado.furtividade.esconderijo": resto });
  return cardVigilia(ator, { titulo: game.i18n.localize("OP2.Furtividade.Chamativa"), texto: game.i18n.format("OP2.Furtividade.PerdeuDado", { ator: nome(ator) }) });
}

/** Os números da procura: rola, e mostra a todos. */
async function rolarProcura(formula) {
  const roll = await new Roll(formula).evaluate();
  return { roll, valores: roll.dice.flatMap((t) => t.results.map((r) => r.result)) };
}

/** Descarta o que casa, e diz quem foi achado. */
async function aplicarValores(alvos, valores) {
  const linhas = [];
  for (const ator of alvos) {
    const r = aplicarProcura(estadoDe(ator).esconderijo, valores);
    if (!r.perdeu) continue;
    await comoMestre("vigilia-esconderijo", { atorUuid: ator.uuid, esconderijo: r.resta });
    linhas.push(game.i18n.format(r.encontrado ? "OP2.Furtividade.Encontrado" : "OP2.Furtividade.Perdeu", { ator: nome(ator), n: r.perdeu }));
  }
  return linhas;
}

/** O botão do card da procura: descarta os dados iguais. Quem decide clicar é a mesa. */
export async function descartarIguais(_ator, dataset) {
  const { atorDe } = await import("./cena-acao.mjs");
  const alvos = dataset.alvos.split(",").map(atorDe).filter(Boolean);
  const linhas = await aplicarValores(alvos, dataset.valores.split(",").map(Number));
  return cardVigilia(null, {
    titulo: game.i18n.localize("OP2.Furtividade.Procura"),
    selo: dataset.valores,
    linhas: linhas.length ? linhas : [game.i18n.localize("OP2.Furtividade.NinguemAchado")],
  });
}

/**
 * FASE DAS CRIATURAS (p. 56). Botão do painel, não evento de fase: o mestre rola, ou escolhe
 * a linha que quiser (`forcar`). A tabela da cena diz o que cada número faz; descartar é outro
 * clique, porque a mesa pode querer narrar diferente.
 */
export async function faseDasCriaturas(cena, { forcar } = {}) {
  const tabela = paramsDe(cena).tabela ?? [];
  const d10 = forcar ? null : await new Roll("1d10").evaluate();
  const valor = forcar ?? d10.total;
  const linha = tabela.find((l) => l.valor === valor);
  if (!linha) return null;
  const pcs = await expostosDe(cena);
  if (!pcs.length && linha.tipo !== "nada" && linha.tipo !== "numeros") return void ui.notifications.warn(game.i18n.localize("OP2.Furtividade.NinguemExposto"));
  const titulo = game.i18n.format("OP2.Furtividade.CriaturasTitulo", { n: valor });
  const texto = game.i18n.localize(`OP2.Furtividade.Linha.${linha.tipo}`);
  const rolls = d10 ? [d10] : [];

  if (linha.tipo === "nada") return cardVigilia(null, { titulo, texto, rolls });
  if (linha.tipo === "numeros") {
    return cardVigilia(null, { titulo, texto, rolls, botoes: !pcs.length ? [] : [{ rotulo: game.i18n.localize("OP2.Furtividade.DizerNumeros"), acao: "vigilia-numeros", soMestre: true, dados: { atorUuid: pcs[0]?.uuid, cena: cena.uuid } }] });
  }
  if (linha.tipo === "sopro") {
    const [alvo] = sortear(pcs, 1);
    return cardVigilia(alvo ?? null, {
      titulo, texto, rolls,
      botoes: alvo ? [
        { rotulo: game.i18n.localize("OP2.Furtividade.FicarParado"), acao: "vigilia-rolar-dano", dados: { atorUuid: alvo.uuid, formula: "2d6", recurso: "pd" } },
        { rotulo: game.i18n.localize("OP2.Furtividade.SairDePerto"), acao: "vigilia-perder-dado", dados: { atorUuid: alvo.uuid } },
      ] : [],
    });
  }
  // Procura: em todos, ou em um sorteado com os dados pelo maior dele.
  const alvos = linha.tipo === "alvo" ? sortear(pcs, 1) : pcs;
  const formula = linha.tipo === "alvo" ? formulaPorMaiorDado(maiorDado(estadoDe(alvos[0] ?? pcs[0]).esconderijo), linha.formulas) : linha.formula;
  const { roll, valores } = await rolarProcura(formula);
  return cardVigilia(alvos.length === 1 ? alvos[0] : null, {
    titulo,
    selo: `${formula}: ${valores.join(", ")}`,
    texto,
    rolls: [...rolls, roll],
    botoes: pcs.length ? [{
      rotulo: game.i18n.format("OP2.Furtividade.DescartarIguais", { valores: valores.join(", ") }),
      acao: "vigilia-descartar",
      dados: { atorUuid: pcs[0].uuid, alvos: alvos.map((a) => a.uuid).join(","), valores: valores.join(",") },
    }] : [],
  });
}

/** O mestre fala dois números (linha 1 da tabela). */
export async function dizerNumeros(cena) {
  const numeros = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("OP2.Furtividade.DizerNumeros") },
    content: '<div class="form-group"><input type="number" name="a" min="1" max="12" value="1"><input type="number" name="b" min="1" max="12" value="2"></div>',
    ok: { callback: (_e, b) => [Number(b.form.elements.a.value), Number(b.form.elements.b.value)] },
    rejectClose: false,
  });
  if (!numeros) return null;
  const linhas = await aplicarValores(await expostosDe(cena), numeros);
  return cardVigilia(null, { titulo: game.i18n.localize("OP2.Furtividade.DizerNumeros"), selo: numeros.join(", "), linhas: linhas.length ? linhas : [game.i18n.localize("OP2.Furtividade.NinguemAchado")] });
}

/** Encontrado: 1d6 por rodada no fim dela (p. 55). Um botão por personagem. */
export async function fimDaRodadaDaFurtividade(cena) {
  const encontrados = (await vivosDe(cena)).filter((a) => estadoDe(a).testou && !estadoDe(a).esconderijo.length && !estadoDe(a).esperando);
  if (!encontrados.length) return null;
  return cardVigilia(null, {
    titulo: game.i18n.localize("OP2.Furtividade.EncontradosTitulo"),
    botoes: encontrados.map((a) => ({
      rotulo: game.i18n.format("OP2.Perseguicao.DanoFisico", { ator: a.name, dano: "1d6" }),
      acao: "vigilia-rolar-dano", dados: { atorUuid: a.uuid, formula: "1d6", recurso: "pv" },
    })),
  });
}

/**
 * Uma ação de área (p. 57–59). O número de avanços e o que dói vêm da cena.
 * @param {object} acao
 * @param {string} [acao.pericia] @param {number} [acao.dt]
 * @param {number} [acao.avanca] quanto soma
 * @param {boolean} [acao.antes] soma antes do teste, passe ou não
 * @param {string} [acao.danoFalha]
 * @param {boolean} [acao.despenca] falhar por 3+ cai o que faltava
 * @param {boolean} [acao.equilibrio] teste de equilíbrio em vez de perícia
 * @param {boolean} [acao.trilha] não avança: dá +1 passo nos testes de Acrobacia da área
 * @param {boolean} [acao.saltoDeFe]
 */
export async function acaoDeArea(ator, cena, acao, { rapido = false } = {}) {
  const area = paramsDe(cena).areas?.[cena.system.areaAtual];
  if (!area) return null;
  const estado = estadoDe(ator);
  const faltam = () => Math.max(0, area.avancos - estadoDe(ator).avancos);
  // Completar a área já deixa esperando: é o que quase todo mundo faz, e o painel desmarca.
  const somar = (n) => {
    const avancos = Math.min(area.avancos, estadoDe(ator).avancos + n);
    return ator.update({ "system.estado.furtividade.avancos": avancos, "system.estado.furtividade.esperando": avancos >= area.avancos });
  };

  // Dano por botão: o card mostra quanto, e quem aplica é a mesa.
  const botaoDeDano = (formula) => ({
    rotulo: game.i18n.format("OP2.Perseguicao.DanoFisico", { ator: ator.name, dano: formula }),
    acao: "vigilia-rolar-dano", dados: { atorUuid: ator.uuid, formula, recurso: "pv" },
  });

  if (acao.saltoDeFe) {
    // O teste é opcional: cancelar ainda é saltar.
    await agir(cena, ator);
    const teste = await rolarTeste(ator, { chavePericia: "acrobacia", dt: DT_PADRAO, rapido, passos: passosDoEscuro(cena, ator), contexto: acao.nome });
    const reducao = teste?.sucesso ? teste.rb : 0;
    const formula = `max(0, ${Math.max(1, faltam())}d6 - ${reducao})`;
    await somar(area.avancos);
    return cardVigilia(ator, { titulo: acao.nome, botoes: [botaoDeDano(formula)] });
  }

  if (acao.equilibrio) {
    await agir(cena, ator);
    const venceu = await testeDeEquilibrio(ator, { rapido });
    if (venceu) await somar(acao.avanca ?? 1);
    return cardVigilia(ator, {
      titulo: acao.nome, estilo: venceu ? "sucesso" : "falha",
      botoes: !venceu && acao.danoFalha ? [botaoDeDano(acao.danoFalha)] : [],
    });
  }

  const escuro = passosDoEscuro(cena, ator);
  // A trilha achada no bosque vale nos testes de Acrobacia dele.
  const trilha = estado.trilha && acao.pericia === "acrobacia" ? 1 : 0;
  const roll = await rolarTeste(ator, { chavePericia: acao.pericia, dt: acao.dt, rapido, passos: escuro + trilha, contexto: acao.nome });
  if (!roll) return null;
  // Só depois de confirmada: fechar o diálogo não pode gastar a vez nem somar avanço.
  await agir(cena, ator);
  if (acao.antes) await somar(acao.avanca);
  if (acao.trilha) {
    if (roll.sucesso) await ator.update({ "system.estado.furtividade.trilha": true });
    return roll;
  }
  if (roll.sucesso && !acao.antes) await somar(acao.avanca ?? 1);
  if (!roll.sucesso) {
    const despenca = acao.despenca ? quedaPorMargem({ total: roll.total, dt: acao.dt, faltam: faltam() }) : null;
    const formula = despenca ?? acao.danoFalha;
    if (despenca) await somar(area.avancos);
    if (formula) await cardVigilia(ator, { titulo: acao.nome, estilo: "falha", botoes: [botaoDeDano(formula)] });
  }
  return roll;
}

/** A runa de Brenna: PV, PD ou um dado de esconderijo, de uma vez só (Missão 2). */
export async function usarRuna(ator, { escolha } = {}) {
  const chave = escolha ?? await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("OP2.Furtividade.Runa") },
    content: `<p>${game.i18n.localize("OP2.Furtividade.RunaAjuda")}</p>`,
    buttons: ["pv", "pd", "esconderijo"].map((b) => ({ action: b, label: `OP2.Furtividade.RunaOpcao.${b}` })),
    rejectClose: false,
  });
  if (!chave) return null;
  const d10 = await new Roll("1d10").evaluate();
  const dados = { "system.estado.runaUsada": true };
  if (chave === "pv" || chave === "pd") {
    const r = ator.system.recursos[chave];
    dados[`system.recursos.${chave}.value`] = Math.min(r.max, r.value + d10.total);
  } else {
    dados["system.estado.furtividade.esconderijo"] = [...estadoDe(ator).esconderijo, { dado: "d10", valor: d10.total }];
  }
  await ator.update(dados);
  return cardVigilia(ator, { titulo: game.i18n.localize("OP2.Furtividade.Runa"), selo: `${d10.total}`, texto: game.i18n.localize(`OP2.Furtividade.RunaOpcao.${chave}`), rolls: [d10] });
}

/**
 * TESTE DE EQUILÍBRIO (p. 17): 2d10 sem somar. Caindo, gasta dados de d4 um a um até firmar
 * ou acabar. Sem janela nos testes (`rapido`): gasta enquanto tiver.
 * @returns {Promise<boolean>}
 */
export async function testeDeEquilibrio(ator, { rapido = false, escolher } = {}) {
  const maximo = dadosDeEquilibrio(ator.system.pericias.acrobacia.valor);
  let gastos = ator.system.estado.equilibrio;
  const par = await new Roll("2d10").evaluate();
  const valores = par.dice[0].results.map((r) => r.result);
  const passos = [`${valores[0]} · ${valores[1]}`];
  const rolls = [par];
  while (!equilibrado(valores[0], valores[1]) && gastos < maximo) {
    const quer = rapido || await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("OP2.Equilibrio.Titulo") },
      content: `<p>${game.i18n.format("OP2.Equilibrio.Caindo", { a: valores[0], b: valores[1], n: maximo - gastos })}</p>`,
      rejectClose: false,
    });
    if (!quer) break;
    const d4 = await new Roll("1d4").evaluate();
    rolls.push(d4);
    gastos += 1;
    // Quem está atrás recebe o d4: é a única forma de aproximar os dois.
    const indice = escolher ?? (valores[0] < valores[1] ? 0 : 1);
    valores[indice] += d4.total;
    passos.push(`+${d4.total} → ${valores[0]} · ${valores[1]}`);
  }
  await ator.update({ "system.estado.equilibrio": gastos });
  const venceu = equilibrado(valores[0], valores[1]);
  await cardVigilia(ator, {
    titulo: game.i18n.localize("OP2.Equilibrio.Titulo"),
    estilo: venceu ? "sucesso" : "falha",
    texto: game.i18n.localize(venceu ? "OP2.Equilibrio.Firme" : "OP2.Equilibrio.Caiu"),
    linhas: passos,
    rolls,
  });
  return venceu;
}
