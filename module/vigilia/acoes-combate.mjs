/**
 * Combate por fases do beta: as ações, com Foundry (beta §7). As contas estão em `combate.mjs`.
 *
 * O mesmo cliente rola os dois lados do que é teste oposto em ação geral e manobra: é um
 * clique, e quem não é dono do alvo não precisa escrever nele. Só a escrita passa pelo mestre.
 * Ataque corpo a corpo é diferente: o alvo escolhe revidar ou não, então o card espera.
 */
import { rolarTeste } from "../dice/teste.mjs";
import { rolarDadosDeNpc } from "./npc.mjs";
import { comoMestre } from "../ui/socket.mjs";
import { aplicarDano } from "../dice/falha-critica.mjs";
import { cardVigilia, donosDe } from "./card.mjs";
import { escolherPericia } from "../dice/pericia-dialog.mjs";
import {
  montarAtaque, resolverCruzado, danoDoAcerto, defesaVenceu, resolverManobra, faseDoAtaque,
} from "./combate.mjs";
import { danoDepoisDaProtecao } from "./dano.mjs";
import { atorDe, cenaAcaoAtiva, participantesDe, registrarAcao, mudarCondicao } from "./cena-acao.mjs";
import { MAX_MARCADORES, PASSOS_FINTA } from "../config.mjs";

const nome = (a) => foundry.utils.escapeHTML(a.name);
const condicoesDe = (a) => [...(a.system.estado?.condicoes ?? [])];
const ehNpc = (a) => a.type === "npc";

/** As armas do personagem, ou os ataques da ficha do NPC, numa forma só. */
export function ataquesDe(ator) {
  if (ehNpc(ator)) {
    return ator.system.ataques.map((a, i) => ({
      id: `npc-${i}`, nome: a.nome, tipo: a.tipo, bonusDano: a.bonusDano, bonusTeste: 0, minimoCritico: 0,
      ignoraRd: 0, dados: a.dados,
    }));
  }
  const armas = ator.items.filter((i) => i.type === "equipamento" && i.system.ataque.tipo);
  const lista = armas.map((i) => ({
    id: i.id, nome: i.name, tipo: i.system.ataque.tipo, bonusDano: i.system.ataque.bonusDano,
    bonusTeste: i.system.ataque.bonusTeste, minimoCritico: i.system.ataque.minimoCritico,
    ignoraRd: i.system.ataque.ignoraRd,
  }));
  // Sempre dá para bater com as mãos: dano RA, sem bônus (beta §7.3).
  lista.push({ id: "desarmado", nome: game.i18n.localize("OP2.Combate2.Desarmado"), tipo: "corpo", bonusDano: 0, bonusTeste: 0, minimoCritico: 0, ignoraRd: 0 });
  return lista;
}

/** Os outros da cena: é entre eles que se escolhe o alvo; a mira do Foundry tem prioridade. */
function candidatos(ator, cena) {
  const marcados = [...game.user.targets].map((t) => t.actor).filter(Boolean);
  if (marcados.length) return marcados.filter((a) => a.uuid !== ator.uuid);
  return (cena ? participantesDe(cena) : []).filter((a) => a.uuid !== ator.uuid);
}

/** Diálogo do ataque: em quem, de onde e em que situação. */
async function perguntarAtaque(ator, ataque, cena) {
  const alvos = candidatos(ator, cena);
  if (!alvos.length) {
    ui.notifications.warn(game.i18n.localize("OP2.Combate.SemAlvos"));
    return null;
  }
  const i = (k) => game.i18n.localize(`OP2.Combate2.${k}`);
  const opcoes = alvos.map((a) => `<option value="${a.uuid}">${nome(a)}</option>`).join("");
  const distancia = ataque.tipo === "distancia"
    ? `<label class="op2-campo op2-campo--inline"><input type="checkbox" name="longe"><span>${i("Longe")}</span></label>
       <label class="op2-campo op2-campo--inline"><input type="checkbox" name="corpoACorpo"><span>${i("AlvoLutando")}</span></label>
       <label class="op2-campo op2-campo--inline"><input type="checkbox" name="arriscar"><span>${i("Arriscar")}</span></label>
       <label class="op2-campo op2-campo--inline"><input type="checkbox" name="mirou" ${condicoesDe(ator).includes("mirando") ? "checked" : ""}><span>${i("Mirou")}</span></label>`
    : "";
  // A condição não guarda em quem: quem joga é que sabe se é o mesmo alvo.
  const finta = condicoesDe(ator).includes("fintando")
    ? `<label class="op2-campo op2-campo--inline"><input type="checkbox" name="fintou" checked><span>${i("Fintou")}</span></label>`
    : "";
  return foundry.applications.api.DialogV2.prompt({
    window: { title: `${ataque.nome} — ${ator.name}` },
    content: `<div class="form-group"><label>${game.i18n.localize("OP2.Combate.Alvo")}</label><select name="alvo">${opcoes}</select></div>
      ${distancia}
      ${finta}
      <label class="op2-campo op2-campo--inline"><input type="checkbox" name="vantagem"><span>${i("Vantagem")}</span></label>
      <label class="op2-campo op2-campo--inline"><input type="checkbox" name="naoLetal"><span>${i("NaoLetal")}</span></label>
      <div class="form-group"><label>${i("AjusteDt")}</label><input type="number" name="ajusteDt" value="0"></div>
      <div class="form-group"><label>${i("AjustePassos")}</label><input type="number" name="ajustePassos" value="0"></div>`,
    ok: {
      callback: (_e, botao) => {
        const f = botao.form.elements;
        return {
          alvo: f.alvo.value, longe: f.longe?.checked ?? false, corpoACorpo: f.corpoACorpo?.checked ?? false,
          arriscar: f.arriscar?.checked ?? false, mirou: f.mirou?.checked ?? false, fintou: f.fintou?.checked ?? false,
          vantagem: f.vantagem.checked, naoLetal: f.naoLetal.checked,
          ajusteDt: Number(f.ajusteDt.value) || 0, ajustePassos: Number(f.ajustePassos.value) || 0,
        };
      },
    },
    rejectClose: false,
  });
}

/** Rola o teste de ataque de quem quer que seja. */
async function rolarAtaque(ator, ataque, { dt, passos = 0, dadosExtras = [], oposto = false, contexto, rapido = false }) {
  if (ehNpc(ator)) return rolarDadosDeNpc(ator, [ataque.dados, ...dadosExtras].join("+"), { dt, oposto, contexto, passos });
  return rolarTeste(ator, {
    chavePericia: ataque.tipo === "distancia" ? "pontaria" : "luta",
    dt, oposto, passos, contexto, rapido,
    modificador: ataque.bonusTeste,
    minimoCritico: ataque.minimoCritico,
    dadosExtras: dadosExtras.map((dado) => ({ chave: `extra.${dado}`, rotulo: dado, tipo: "extra", dado })),
  });
}

/** AGREDIR (beta §7.3). Publica o card e deixa o resto com quem clica. */
export async function atacar(ator, ataque, { cena = cenaAcaoAtiva(), escolha, rapido = false } = {}) {
  const dados = escolha ?? await perguntarAtaque(ator, ataque, cena);
  if (!dados) return null;
  const alvo = atorDe(dados.alvo);
  if (!alvo) return null;

  const fintou = dados.fintou ?? condicoesDe(ator).includes("fintando");
  const montado = montarAtaque({
    tipo: ataque.tipo, longe: dados.longe, condicoesAlvo: condicoesDe(alvo), condicoesAtacante: condicoesDe(ator),
    alvoEmCorpoACorpo: dados.corpoACorpo, arriscar: dados.arriscar, vantagem: dados.vantagem, mirou: dados.mirou,
  });
  // Cobertura total só avisa: se a mesa diz que dá, dá.
  if (montado.alvoProtegido) ui.notifications.warn(game.i18n.format("OP2.Combate2.Protegido", { alvo: alvo.name }));
  const dtFinal = montado.dt + (dados.ajusteDt ?? 0);
  // Converter o golpe em não letal custa dois passos (beta §8.1).
  const passos = montado.passos + (fintou ? PASSOS_FINTA : 0) - (dados.naoLetal ? 2 : 0) + (dados.ajustePassos ?? 0);
  const roll = await rolarAtaque(ator, ataque, {
    dt: dtFinal, passos, rapido, dadosExtras: montado.dadosExtras, contexto: `${ataque.nome} → ${alvo.name}`,
  });
  if (!roll) return null;
  if (fintou) await mudarCondicao(ator, "fintando", false);
  if (cena) await registrarAcao(cena, ator, faseDoAtaque(ataque.tipo));

  const r = roll.resultado;
  const dano = danoDoAcerto(r, ataque.bonusDano);
  // Atirar no meio da luta e arriscar: ímpar, o tiro vai em quem o alvo enfrentava.
  const linhas = [];
  if (montado.arriscando) {
    const sorte = await new Roll("1d6").evaluate();
    linhas.push(game.i18n.format(sorte.total % 2 ? "OP2.Combate2.DesviouTiro" : "OP2.Combate2.AcertouAlvo", { valor: sorte.total }));
  }
  if (dados.naoLetal) linhas.push(game.i18n.localize("OP2.Combate2.GolpeNaoLetal"));

  const contexto = {
    atacanteUuid: ator.uuid, alvoUuid: alvo.uuid, total: roll.total, ra: r.ra, segunda: r.segunda,
    critico: r.critico ? 1 : 0, bonusDano: ataque.bonusDano, ignoraRd: ataque.ignoraRd ?? 0, nomeAtaque: ataque.nome,
    sucesso: r.sucesso ? 1 : 0,
  };
  const defendendo = condicoesDe(alvo).includes("defendendo");
  const botoes = [];
  if (r.sucesso && !defendendo) {
    botoes.push({ rotulo: game.i18n.format("OP2.Combate2.AplicarDano", { dano }), acao: "vigilia-dano", dados: { atorUuid: alvo.uuid, quantidade: dano, ignoraRd: contexto.ignoraRd } });
  }
  // Sempre há como pôr outro valor, ou ferir mesmo com a regra dizendo que errou.
  botoes.push({ rotulo: game.i18n.localize("OP2.Combate2.DanoManual"), acao: "vigilia-dano-manual", dados: { atorUuid: alvo.uuid, quantidade: dano, ignoraRd: contexto.ignoraRd } });
  if (defendendo) botoes.push({ rotulo: game.i18n.format("OP2.Combate2.Defender", { alvo: alvo.name }), acao: "vigilia-defender", dados: { atorUuid: alvo.uuid, ...contexto, corpo: ataque.tipo === "corpo" ? 1 : 0 } });
  // Corpo a corpo contra quem também ataca vira teste oposto (beta §7.3).
  else if (ataque.tipo === "corpo") botoes.push({ rotulo: game.i18n.format("OP2.Combate2.Revidar", { alvo: alvo.name }), acao: "vigilia-revidar", dados: { atorUuid: alvo.uuid, ...contexto } });

  await cardVigilia(ator, {
    titulo: game.i18n.format("OP2.Combate2.AtaqueTitulo", { ataque: ataque.nome }),
    selo: `${game.i18n.localize("OP2.DT")} ${dtFinal}`,
    estilo: r.sucesso ? "sucesso" : "falha",
    texto: game.i18n.format(r.sucesso ? "OP2.Combate2.Acertou" : "OP2.Combate2.Errou", {
      atacante: nome(ator), alvo: nome(alvo), total: roll.total, dano,
    }),
    linhas,
    botoes,
  });
  return { roll, dano, alvo };
}

/** O alvo revida: testes de ataque viram oposto, empate os dois acertam (beta §7.3). */
export async function revidar(alvo, dataset, { rapido = false } = {}) {
  const atacante = atorDe(dataset.atacanteUuid);
  if (!atacante) return null;
  const lista = ataquesDe(alvo).filter((a) => a.tipo === "corpo");
  const ataque = await escolherAtaque(alvo, lista);
  if (!ataque) return null;
  const roll = await rolarAtaque(alvo, ataque, { oposto: true, rapido, contexto: `${ataque.nome} → ${atacante.name}` });
  if (!roll) return null;
  const cena = cenaAcaoAtiva();
  if (cena) await registrarAcao(cena, alvo, "corpo");

  const totalA = Number(dataset.total);
  const { acertaA, acertaB } = resolverCruzado(totalA, roll.total);
  const danoA = danoDoAcerto({ ra: Number(dataset.ra), segunda: Number(dataset.segunda), critico: Number(dataset.critico) === 1 }, Number(dataset.bonusDano));
  const danoB = danoDoAcerto(roll.resultado, ataque.bonusDano);
  const botoes = [];
  if (acertaA) botoes.push({ rotulo: game.i18n.format("OP2.Combate2.DanoEm", { dano: danoA, alvo: alvo.name }), acao: "vigilia-dano", dados: { atorUuid: alvo.uuid, quantidade: danoA, ignoraRd: dataset.ignoraRd } });
  if (acertaB) botoes.push({ rotulo: game.i18n.format("OP2.Combate2.DanoEm", { dano: danoB, alvo: atacante.name }), acao: "vigilia-dano", dados: { atorUuid: atacante.uuid, quantidade: danoB, ignoraRd: ataque.ignoraRd ?? 0 } });
  await cardVigilia(alvo, {
    titulo: game.i18n.localize("OP2.Combate2.CruzadoTitulo"),
    texto: game.i18n.format("OP2.Combate2.Cruzado", { a: nome(atacante), ta: totalA, b: nome(alvo), tb: roll.total }),
    linhas: [game.i18n.localize(!acertaA && !acertaB ? "OP2.Combate2.NinguemAcertou" : (acertaA && acertaB ? "OP2.Combate2.DoisAcertaram" : "OP2.Combate2.UmAcertou"))],
    botoes,
  });
  return { roll, acertaA, acertaB };
}

/** DEFENDER-SE: Acrobacia (ou Luta, se corpo a corpo) +1d6 contra o ataque (beta §7.2). */
export async function defender(alvo, dataset, { rapido = false } = {}) {
  const atacante = atorDe(dataset.atacanteUuid);
  if (!atacante) return null;
  const extra = { chave: "defesa", rotulo: game.i18n.localize("OP2.Combate2.DefesaDado"), tipo: "extra", dado: "d6" };
  const corpo = Number(dataset.corpo) === 1;
  const roll = ehNpc(alvo)
    ? await rolarDadosDeNpc(alvo, dadosDoNpcPara(alvo, corpo ? "luta" : "acrobacia", "fisico", "d6"), { oposto: true })
    : await rolarTeste(alvo, { chavePericia: corpo && alvo.system.pericias.luta.valor > alvo.system.pericias.acrobacia.valor ? "luta" : "acrobacia", oposto: true, rapido, dadosExtras: [extra], contexto: game.i18n.localize("OP2.Combate2.DefesaTitulo") });
  if (!roll) return null;
  const venceu = defesaVenceu(roll.total, Number(dataset.total));
  const dano = danoDoAcerto({ ra: Number(dataset.ra), segunda: Number(dataset.segunda), critico: Number(dataset.critico) === 1 }, Number(dataset.bonusDano));
  await mudarCondicao(alvo, "defendendo", false);
  await cardVigilia(alvo, {
    titulo: game.i18n.localize("OP2.Combate2.DefesaTitulo"),
    estilo: venceu ? "sucesso" : "falha",
    texto: game.i18n.format(venceu ? "OP2.Combate2.DefesaVenceu" : "OP2.Combate2.DefesaPerdeu", { alvo: nome(alvo), defesa: roll.total, ataque: dataset.total }),
    // Perder a defesa não faz acertar quem já não tinha alcançado a DT.
    botoes: venceu || dataset.sucesso === "0" ? [] : [{ rotulo: game.i18n.format("OP2.Combate2.AplicarDano", { dano }), acao: "vigilia-dano", dados: { atorUuid: alvo.uuid, quantidade: dano, ignoraRd: dataset.ignoraRd } }],
  });
  return { roll, venceu };
}

async function escolherAtaque(ator, lista) {
  if (lista.length <= 1) return lista[0] ?? null;
  const opcoes = lista.map((a) => `<option value="${a.id}">${foundry.utils.escapeHTML(a.nome)}</option>`).join("");
  const id = await foundry.applications.api.DialogV2.prompt({
    window: { title: ator.name },
    content: `<div class="form-group"><select name="ataque">${opcoes}</select></div>`,
    ok: { callback: (_e, b) => b.form.elements.ataque.value },
    rejectClose: false,
  });
  return lista.find((a) => a.id === id) ?? null;
}

/**
 * O dano do card. Quem não é dono do alvo pede ao mestre; o dono escolhe gastar armadura
 * antes (beta §8.4). A RD do alvo e o que a arma ignora saem aqui (beta §8.5).
 */
export async function aplicarDanoDeCombate(alvo, dataset, { gastar } = {}) {
  const quantidade = Number(dataset.quantidade);
  const recurso = dataset.recurso ?? "pv";
  const rd = alvo.system.rd ?? 0;
  const temArmadura = recurso === "pv" && quantidade > 0 && (alvo.system.armadura?.disponivel ?? 0) > 0;
  // Gastar armadura é decisão de quem joga com o alvo (beta §8.4): o card vai para ele, em vez de
  // ferir direto. O mestre também é dono de todo personagem, mas não é ele quem decide; com o
  // jogador ausente, o card chega ao mestre e ele clica (`decidir`).
  const quemDecideEOutro = !alvo.isOwner || (game.user.isGM && alvo.hasPlayerOwner && !dataset.decidir && gastar === undefined);
  if (quemDecideEOutro && temArmadura) {
    return cardVigilia(alvo, {
      titulo: game.i18n.localize("OP2.Combate2.ArmaduraTitulo"),
      texto: game.i18n.format("OP2.Combate2.ArmaduraPergunta", { dano: quantidade, n: alvo.system.armadura.disponivel }),
      whisper: donosDe(alvo),
      botoes: [{
        rotulo: game.i18n.format("OP2.Combate2.DanoEm", { dano: quantidade, alvo: alvo.name }), acao: "vigilia-dano-dono",
        dados: { atorUuid: alvo.uuid, quantidade, recurso, ignoraRd: dataset.ignoraRd ?? 0, decidir: 1 },
      }],
    });
  }
  if (!alvo.isOwner) return comoMestre("vigilia-dano", { atorUuid: alvo.uuid, quantidade: danoDepoisDaProtecao(quantidade, { rd, ignoraRd: Number(dataset.ignoraRd ?? 0) }), recurso });
  let gastarArmadura = false;
  if (temArmadura) {
    gastarArmadura = gastar ?? await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("OP2.Combate2.ArmaduraTitulo") },
      content: `<p>${game.i18n.format("OP2.Combate2.ArmaduraPergunta", { dano: quantidade, n: alvo.system.armadura.disponivel })}</p>`,
      rejectClose: false,
    });
    if (gastarArmadura) await alvo.update({ "system.estado.armaduraGasta": alvo.system.estado.armaduraGasta + 1 });
  }
  const final = danoDepoisDaProtecao(quantidade, { rd, ignoraRd: Number(dataset.ignoraRd ?? 0), gastarArmadura });
  await aplicarDano(alvo, final, recurso);
  ui.notifications.info(game.i18n.format("OP2.Chat.DanoAplicado", { quantidade: final, alvos: alvo.name }));
  return final;
}

/** Dano com o valor que a mesa quiser: pergunta quanto, e depois segue o caminho normal. */
export async function pedirDanoManual(alvo, dataset) {
  const quantidade = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.format("OP2.Combate2.DanoManualTitulo", { alvo: alvo.name }) },
    content: `<div class="form-group"><label>${game.i18n.localize("OP2.Combate2.Quanto")}</label><input type="number" name="q" min="0" value="${Number(dataset.quantidade) || 0}" autofocus></div>
      <label class="op2-campo op2-campo--inline"><input type="checkbox" name="crua"><span>${game.i18n.localize("OP2.Combate2.SemProtecao")}</span></label>`,
    ok: { callback: (_e, b) => ({ q: Number(b.form.elements.q.value) || 0, crua: b.form.elements.crua.checked }) },
    rejectClose: false,
  });
  if (!quantidade) return null;
  if (quantidade.crua) return alvo.isOwner ? aplicarDano(alvo, quantidade.q, dataset.recurso ?? "pv") : comoMestre("vigilia-dano", { atorUuid: alvo.uuid, quantidade: quantidade.q, recurso: dataset.recurso ?? "pv" });
  return aplicarDanoDeCombate(alvo, { ...dataset, quantidade: quantidade.q });
}

/** Dados da ficha reduzida: atributo + perícia, o que o livro imprime junto. */
export function dadosDoNpcPara(npc, pericia, atributo = "fisico", extra = "") {
  const dados = [npc.system.atributos[atributo]?.die ?? "d4", npc.system.pericias?.[pericia]?.die ?? "d4", extra].filter(Boolean);
  return dados.join("+");
}

/** Rola a resposta passiva de quem quer que seja, sem diálogo. */
async function rolarResposta(ator, pericia, atributo, contexto) {
  if (ehNpc(ator)) return rolarDadosDeNpc(ator, dadosDoNpcPara(ator, pericia, atributo), { oposto: true, contexto, atributo });
  return rolarTeste(ator, { chavePericia: pericia, chaveAtributo: atributo, oposto: true, rapido: true, contexto });
}

const PERICIA_PADRAO = { atrapalhar: "enganacao", fintar: "enganacao" };

/** Ações gerais com teste oposto: Atrapalhar e Fintar (beta §7.2). */
export async function acaoOposta(ator, qual, { cena = cenaAcaoAtiva(), alvoUuid: pedido, rapido = false } = {}) {
  const alvoUuid = pedido ?? await escolherAlvo(ator, cena, game.i18n.localize(`OP2.Combate2.${qual}`));
  if (!alvoUuid) return null;
  const alvo = atorDe(alvoUuid);
  // Atrapalhar é com "perícia coerente": quem joga diz qual (beta §7.2). Fintar é sempre Enganação.
  const pericia = qual === "atrapalhar" && !rapido && !ehNpc(ator)
    ? await escolherPericia(ator, { titulo: game.i18n.localize("OP2.Combate2.atrapalhar") })
    : PERICIA_PADRAO[qual];
  if (!pericia) return null;
  const meu = ehNpc(ator)
    ? await rolarDadosDeNpc(ator, dadosDoNpcPara(ator, pericia, "emocao"), { oposto: true, atributo: "emocao" })
    : await rolarTeste(ator, { chavePericia: pericia, oposto: true, rapido, contexto: game.i18n.localize(`OP2.Combate2.${qual}`) });
  if (!meu) return null;
  const dele = await rolarResposta(alvo, qual === "fintar" ? "intuicao" : "percepcao", qual === "fintar" ? "emocao" : "mente", game.i18n.localize(`OP2.Combate2.${qual}`));
  const venceu = meu.total > dele.total;
  if (cena) await registrarAcao(cena, ator, "suporte");
  const condicao = qual === "atrapalhar" ? { alvo, chave: "atrapalhado" } : { alvo: ator, chave: "fintando" };
  await cardVigilia(ator, {
    titulo: game.i18n.localize(`OP2.Combate2.${qual}`),
    estilo: venceu ? "sucesso" : "falha",
    texto: game.i18n.format(venceu ? `OP2.Combate2.${qual}Venceu` : "OP2.Combate2.OpostoPerdeu", { ator: nome(ator), alvo: nome(alvo), a: meu.total, b: dele.total }),
    botoes: [botaoDeCondicao(condicao.alvo, condicao.chave, venceu)],
  });
  return { venceu };
}

/**
 * O botão que aplica a condição. Quem venceu vê; quem perdeu, só o mestre, para o caso de a
 * mesa decidir diferente da rolagem.
 */
function botaoDeCondicao(ator, condicao, venceu) {
  return {
    rotulo: game.i18n.format("OP2.Combate2.AplicarCondicao", { condicao: game.i18n.localize(`OP2.Condicao.${condicao}`), alvo: ator.name }),
    acao: "vigilia-condicao", soMestre: !venceu, dados: { atorUuid: ator.uuid, condicao },
  };
}

async function escolherAlvo(ator, cena, titulo) {
  const alvos = candidatos(ator, cena);
  if (!alvos.length) { ui.notifications.warn(game.i18n.localize("OP2.Combate.SemAlvos")); return null; }
  if (alvos.length === 1) return alvos[0].uuid;
  const opcoes = alvos.map((a) => `<option value="${a.uuid}">${nome(a)}</option>`).join("");
  return foundry.applications.api.DialogV2.prompt({
    window: { title: titulo },
    content: `<div class="form-group"><label>${game.i18n.localize("OP2.Combate.Alvo")}</label><select name="alvo">${opcoes}</select></div>`,
    ok: { callback: (_e, b) => b.form.elements.alvo.value },
    rejectClose: false,
  });
}

/** MANOBRA: ataque oposto a Acrobacia ou Luta do alvo, a melhor delas (beta §7.4). */
export async function manobra(ator, qual, { cena = cenaAcaoAtiva(), alvoUuid: pedido, rapido = false } = {}) {
  const alvoUuid = pedido ?? await escolherAlvo(ator, cena, game.i18n.localize(`OP2.Manobra.${qual}.nome`));
  if (!alvoUuid) return null;
  const alvo = atorDe(alvoUuid);
  const ataque = ataquesDe(ator).find((a) => a.tipo === "corpo");
  if (!ataque) return null;
  const meu = await rolarAtaque(ator, ataque, { oposto: true, rapido, contexto: game.i18n.localize(`OP2.Manobra.${qual}.nome`) });
  if (!meu) return null;
  const periciaResposta = ehNpc(alvo) || (alvo.system.pericias.luta.valor >= alvo.system.pericias.acrobacia.valor) ? "luta" : "acrobacia";
  const dele = await rolarResposta(alvo, periciaResposta, "fisico", game.i18n.localize(`OP2.Manobra.${qual}.nome`));
  const { venceu, porCinco } = resolverManobra(meu.total, dele.total);
  if (cena) await registrarAcao(cena, ator, "corpo");
  const botoes = [];
  const CONDICAO_DA_MANOBRA = { derrubar: "caido", agarrar: "agarrado" };
  if (CONDICAO_DA_MANOBRA[qual]) botoes.push(botaoDeCondicao(alvo, CONDICAO_DA_MANOBRA[qual], venceu));
  // Vencer por 5 deixa –1 passo só no próximo teste, até o fim da próxima rodada (beta §7.4).
  if (qual === "empurrar") botoes.push(botaoDeCondicao(alvo, "empurrado", venceu && porCinco));
  if (venceu && porCinco && qual === "derrubar") {
    botoes.push({ rotulo: game.i18n.format("OP2.Combate2.DanoEm", { dano: meu.resultado.rb, alvo: alvo.name }), acao: "vigilia-dano", dados: { atorUuid: alvo.uuid, quantidade: meu.resultado.rb } });
  }
  await cardVigilia(ator, {
    titulo: game.i18n.localize(`OP2.Manobra.${qual}.nome`),
    estilo: venceu ? "sucesso" : "falha",
    texto: venceu ? game.i18n.localize(`OP2.Manobra.${qual}.efeito`) : game.i18n.format("OP2.Combate2.OpostoPerdeu", { ator: nome(ator), alvo: nome(alvo), a: meu.total, b: dele.total }),
    linhas: venceu && porCinco ? [game.i18n.localize(`OP2.Manobra.${qual}.porCinco`)] : [],
    botoes,
  });
  return { venceu, porCinco };
}

/** O que não rola nada, só consome a ação e fica na ficha (beta §7.2). */
export async function acaoGeral(ator, qual, { cena = cenaAcaoAtiva() } = {}) {
  if (qual === "defender") {
    await mudarCondicao(ator, "defendendo", true);
    // Leitura de Combate: defender dá um marcador de análise (beta §12).
    if (ator.items?.some((i) => i.type === "habilidade" && i.system.mecanica === "leitura-combate")) {
      await ator.update({ "system.estado.marcadores": Math.min(MAX_MARCADORES, ator.system.estado.marcadores + 1) });
    }
  }
  if (qual === "erguer") await mudarCondicao(ator, "caido", false);
  // "Preparar" e "Usar" não fazem nada além de dizer: a mesa resolve.
  if (qual === "jogarSe") await mudarCondicao(ator, "caido", true);
  // Vale na próxima rodada, à distância, contra aquele alvo (beta §7.2): o ataque pergunta.
  if (qual === "mirar") await mudarCondicao(ator, "mirando", true);
  // Ação livre não gasta a vez; o preço é o passo a menos até o fim da rodada.
  const livre = ["erguerLivre", "sacarLivre"].includes(qual);
  if (qual === "erguerLivre") await mudarCondicao(ator, "caido", false);
  if (livre) await mudarCondicao(ator, "apressado", true);
  else if (cena && qual !== "jogarSe") await registrarAcao(cena, ator, "suporte");
  return cardVigilia(ator, {
    titulo: game.i18n.localize(`OP2.Combate2.${qual}`),
    texto: game.i18n.format(`OP2.Combate2.${qual}Texto`, { ator: nome(ator) }),
  });
}
