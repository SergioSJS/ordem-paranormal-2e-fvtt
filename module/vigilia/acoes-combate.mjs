/**
 * Combate por fases do beta: as ações, com Foundry (beta §7). As contas estão em `combate.mjs`.
 *
 * O mesmo cliente rola os dois lados do que é teste oposto em ação geral e manobra: é um
 * clique, e quem não é dono do alvo não precisa escrever nele. Só a escrita passa pelo mestre.
 * Ataque corpo a corpo é diferente: o alvo escolhe revidar ou não, então o card espera.
 *
 * Toda ação contra alguém sai num card de confronto só (`confronto.mjs`), com os dados dentro:
 * as rolagens são `semCard`.
 */
import { rolarTeste, rotuloDePericia } from "../dice/teste.mjs";
import { rolarDadosDeNpc } from "./npc.mjs";
import { comoMestre } from "../ui/socket.mjs";
import { aplicarDano } from "../dice/falha-critica.mjs";
import { cardVigilia, donosDe } from "./card.mjs";
import { escolherPericia } from "../dice/pericia-dialog.mjs";
import {
  montarAtaque, resolverCruzado, danoDoAcerto, defesaVenceu, resolverManobra, faseDoAtaque, venceuSoltura, passosDaSoltura,
} from "./combate.mjs";
import { danoDepoisDaProtecao } from "./dano.mjs";
import { atorDe, cenaAcaoAtiva, participantesDe, registrarAcao, mudarCondicao } from "./cena-acao.mjs";
import { MAX_MARCADORES, PASSOS_FINTA, DT_PADRAO } from "../config.mjs";
import { alvosMarcados } from "./alvos.mjs";
import { cardConfronto, lado, golpe, vereditoDoTeste } from "./confronto.mjs";

const nome = (a) => foundry.utils.escapeHTML(a.name);
const condicoesDe = (a) => [...(a.system.estado?.condicoes ?? [])];
const ehNpc = (a) => a.type === "npc";

/** As armas do personagem, ou os ataques da ficha do NPC, numa forma só. */
export function ataquesDe(ator) {
  if (ehNpc(ator)) {
    return ator.system.ataques.map((a, i) => ({
      id: `npc-${i}`, nome: a.nome, tipo: a.tipo, bonusDano: a.bonusDano, bonusTeste: 0, minimoCritico: 0,
      ignoraRd: 0, dados: a.dados,
      efeito: a.efeito ?? "", danoPorRodada: a.danoPorRodada ?? "", passosSoltar: a.passosSoltar ?? 0,
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

/** Os outros da cena: é entre eles que se escolhe o alvo; a mira (do Foundry ou do palco) tem prioridade. */
function candidatos(ator, cena) {
  const marcados = alvosMarcados();
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
  if (ehNpc(ator)) return rolarDadosDeNpc(ator, [ataque.dados, ...dadosExtras].join("+"), { dt, oposto, contexto, passos, semCard: true });
  return rolarTeste(ator, {
    chavePericia: ataque.tipo === "distancia" ? "pontaria" : "luta",
    dt, oposto, passos, contexto, rapido, semCard: true,
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

  const agarra = ataque.efeito === "agarrar";
  const contexto = {
    atacanteUuid: ator.uuid, alvoUuid: alvo.uuid, total: roll.total, ra: r.ra, segunda: r.segunda,
    critico: r.critico ? 1 : 0, bonusDano: ataque.bonusDano, ignoraRd: ataque.ignoraRd ?? 0, nomeAtaque: ataque.nome,
    sucesso: r.sucesso ? 1 : 0,
    // O revide e a defesa precisam saber que este golpe agarra em vez de ferir.
    ...(agarra ? { efeito: "agarrar", danoPorRodada: ataque.danoPorRodada, passosSoltar: ataque.passosSoltar } : {}),
  };
  if (agarra) linhas.push(game.i18n.format("OP2.Agarre.Explica", { dano: foundry.utils.escapeHTML(ataque.danoPorRodada || "—") }));
  const defendendo = condicoesDe(alvo).includes("defendendo");
  // Corpo a corpo, aplicar o dano e revidar são saídas alternativas: o revide vira teste oposto e
  // traz o dano deste golpe de novo (beta §7.3). Usada uma, a outra pergunta antes (`grupo`).
  const grupo = ataque.tipo === "corpo" && !defendendo ? "desfecho" : undefined;
  const botoes = [];
  if (r.sucesso && !defendendo) {
    botoes.push(agarra
      ? botaoDeAgarre(alvo, ator, contexto, { grupo })
      : { rotulo: game.i18n.format("OP2.Combate2.AplicarDano", { dano }), acao: "vigilia-dano", dados: { atorUuid: alvo.uuid, quantidade: dano, ignoraRd: contexto.ignoraRd, grupo } });
  } else if (agarra && !defendendo) {
    // Errou, mas a mesa pode decidir que pegou: o mestre ainda tem o agarre, com quem segura e o dano.
    botoes.push({ ...botaoDeAgarre(alvo, ator, contexto), soMestre: true });
  }
  // Sempre há como pôr outro valor, ou ferir mesmo com a regra dizendo que errou.
  botoes.push({ rotulo: game.i18n.localize("OP2.Combate2.DanoManual"), acao: "vigilia-dano-manual", dados: { atorUuid: alvo.uuid, quantidade: dano, ignoraRd: contexto.ignoraRd } });
  if (defendendo) botoes.push({ rotulo: game.i18n.format("OP2.Combate2.Defender", { alvo: alvo.name }), acao: "vigilia-defender", dados: { atorUuid: alvo.uuid, ...contexto, corpo: ataque.tipo === "corpo" ? 1 : 0 } });
  // Corpo a corpo contra quem também ataca vira teste oposto (beta §7.3).
  else if (ataque.tipo === "corpo") botoes.push({ rotulo: game.i18n.format("OP2.Combate2.Revidar", { alvo: alvo.name }), acao: "vigilia-revidar", dados: { atorUuid: alvo.uuid, ...contexto, grupo } });

  if (r.sucesso && defendendo) linhas.push(game.i18n.format("OP2.Confronto.AguardaDefesa", { alvo: nome(alvo) }));
  await cardConfronto(ator, {
    titulo: game.i18n.format("OP2.Combate2.AtaqueTitulo", { ataque: ataque.nome }),
    selo: `${game.i18n.localize("OP2.DT")} ${dtFinal}`,
    esquerda: lado(ator, roll, { venceu: r.sucesso }),
    direita: lado(alvo),
    veredito: vereditoDoTeste(roll, { acertou: r.sucesso }),
    golpes: r.sucesso && !agarra ? [golpe(dano, alvo)] : [],
    distancia: ataque.tipo === "distancia",
    linhas,
    botoes,
    rolls: [roll],
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
  // Quem agarra (o Afogar) acerta prendendo, não ferindo: o botão é o do agarre (p. 33).
  const agarraA = dataset.efeito === "agarrar";
  const agarraB = ataque.efeito === "agarrar";
  const botoes = [];
  if (acertaA) {
    botoes.push(agarraA ? botaoDeAgarre(alvo, atacante, dataset)
      : { rotulo: game.i18n.format("OP2.Combate2.DanoEm", { dano: danoA, alvo: alvo.name }), acao: "vigilia-dano", dados: { atorUuid: alvo.uuid, quantidade: danoA, ignoraRd: dataset.ignoraRd } });
  }
  if (acertaB) {
    botoes.push(agarraB ? botaoDeAgarre(atacante, alvo, ataque)
      : { rotulo: game.i18n.format("OP2.Combate2.DanoEm", { dano: danoB, alvo: atacante.name }), acao: "vigilia-dano", dados: { atorUuid: atacante.uuid, quantidade: danoB, ignoraRd: ataque.ignoraRd ?? 0 } });
  }
  const t = (chave, dados) => game.i18n.format(`OP2.Confronto.${chave}`, dados);
  let veredito = { classe: "erro", rotulo: t("DoisErram") };
  if (acertaA && acertaB) veredito = { classe: "acerto", rotulo: t("DoisAcertam") };
  else if (acertaA) veredito = { classe: "acerto", rotulo: t("AcertaNome", { nome: atacante.name }) };
  else if (acertaB) veredito = { classe: "acerto", rotulo: t("AcertaNome", { nome: alvo.name }) };
  await cardConfronto(alvo, {
    titulo: game.i18n.localize("OP2.Combate2.CruzadoTitulo"),
    selo: game.i18n.localize("OP2.Confronto.Oposto"),
    esquerda: { ...lado(atacante, null, { venceu: acertaA }), total: totalA },
    direita: lado(alvo, roll, { venceu: acertaB }),
    veredito,
    golpes: [...(acertaA && !agarraA ? [golpe(danoA, alvo)] : []), ...(acertaB && !agarraB ? [golpe(danoB, atacante)] : [])],
    linhas: [game.i18n.localize(!acertaA && !acertaB ? "OP2.Combate2.NinguemAcertou" : (acertaA && acertaB ? "OP2.Combate2.DoisAcertaram" : "OP2.Combate2.UmAcertou"))],
    botoes,
    rolls: [roll],
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
    ? await rolarDadosDeNpc(alvo, dadosDoNpcPara(alvo, corpo ? "luta" : "acrobacia", "fisico", "d6"), { oposto: true, semCard: true })
    : await rolarTeste(alvo, { chavePericia: corpo && alvo.system.pericias.luta.valor > alvo.system.pericias.acrobacia.valor ? "luta" : "acrobacia", oposto: true, rapido, semCard: true, dadosExtras: [extra], contexto: game.i18n.localize("OP2.Combate2.DefesaTitulo") });
  if (!roll) return null;
  const venceu = defesaVenceu(roll.total, Number(dataset.total));
  const dano = danoDoAcerto({ ra: Number(dataset.ra), segunda: Number(dataset.segunda), critico: Number(dataset.critico) === 1 }, Number(dataset.bonusDano));
  await mudarCondicao(alvo, "defendendo", false);
  // Perder a defesa não faz acertar quem já não tinha alcançado a DT.
  const entra = !venceu && dataset.sucesso !== "0";
  const agarra = dataset.efeito === "agarrar";
  await cardConfronto(alvo, {
    titulo: game.i18n.localize("OP2.Combate2.DefesaTitulo"),
    selo: game.i18n.localize("OP2.Confronto.Oposto"),
    esquerda: { ...lado(atacante, null, { venceu: !venceu }), total: Number(dataset.total) },
    direita: lado(alvo, roll, { venceu }),
    veredito: venceu
      ? { classe: "defesa", rotulo: game.i18n.format("OP2.Confronto.Defendeu", { nome: alvo.name }) }
      : { classe: "acerto", rotulo: game.i18n.format("OP2.Confronto.NaoDefendeu", { nome: alvo.name }) },
    golpes: entra && !agarra ? [golpe(dano, alvo)] : [],
    linhas: [game.i18n.format(venceu ? "OP2.Combate2.DefesaVenceu" : "OP2.Combate2.DefesaPerdeu", { alvo: nome(alvo), defesa: roll.total, ataque: dataset.total })],
    botoes: !entra ? [] : [agarra ? botaoDeAgarre(alvo, atacante, dataset)
      : { rotulo: game.i18n.format("OP2.Combate2.AplicarDano", { dano }), acao: "vigilia-dano", dados: { atorUuid: alvo.uuid, quantidade: dano, ignoraRd: dataset.ignoraRd } }],
    rolls: [roll],
  });
  return { roll, venceu };
}

/**
 * O botão que prende a vítima, no lugar do de dano (o Afogar, p. 33). `origem` traz a fórmula do
 * fim da rodada e os passos de se soltar: é o ataque, ou o dataset do card que o carregou.
 */
function botaoDeAgarre(vitima, quemAgarra, origem, { grupo } = {}) {
  return {
    rotulo: game.i18n.format("OP2.Agarre.Aplicar", { alvo: vitima.name }),
    acao: "vigilia-agarrar",
    dados: {
      atorUuid: vitima.uuid, por: quemAgarra.uuid,
      dano: origem.danoPorRodada ?? "", passos: Number(origem.passosSoltar) || 0, grupo,
    },
  };
}

/** Escolha de perícia entre poucas, com a de dado maior marcada; `rapido` fica com ela. */
async function escolherEntre(ator, chaves, { rapido, titulo }) {
  const ordem = [...chaves].sort((a, b) => (ator.system.pericias[b]?.valor ?? 0) - (ator.system.pericias[a]?.valor ?? 0));
  if (rapido) return ordem[0];
  const opcoes = ordem.map((k) => `<option value="${k}">${foundry.utils.escapeHTML(rotuloDePericia(k))}</option>`).join("");
  return foundry.applications.api.DialogV2.prompt({
    window: { title: `${titulo} — ${ator.name}` },
    content: `<div class="form-group"><select name="pericia">${opcoes}</select></div>`,
    ok: { callback: (_e, b) => b.form.elements.pericia.value },
    rejectClose: false,
  });
}

/** Quem está agarrado nesta cena (e não por si mesmo). */
const agarrados = (cena) => (cena ? participantesDe(cena) : []).filter((a) => condicoesDe(a).includes("agarrado"));

/**
 * SOLTAR-SE, ou soltar um aliado (beta §7.4; Afogar, p. 33): Acrobacia ou Luta, a melhor, contra
 * a Luta de quem segura. A vítima sofre os passos do agarre (–1 no Afogar); quem ajuda, não.
 * Sem quem segura conhecido, é contra DT 7. O card propõe soltar; quem venceu clica.
 */
export async function soltar(ator, { cena = cenaAcaoAtiva(), vitimaUuid, pericia, rapido = false } = {}) {
  let vitima = vitimaUuid ? atorDe(vitimaUuid) : null;
  if (!vitima && condicoesDe(ator).includes("agarrado")) vitima = ator;
  if (!vitima) {
    // Do mesmo lado: personagem solta personagem, criatura solta criatura.
    const presos = agarrados(cena).filter((a) => a.uuid !== ator.uuid && a.type === ator.type);
    if (!presos.length) {
      ui.notifications.warn(game.i18n.localize("OP2.Agarre.NinguemPreso"));
      return null;
    }
    const uuid = presos.length === 1 ? presos[0].uuid : await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("OP2.Agarre.Soltar") },
      content: `<div class="form-group"><select name="vitima">${presos.map((a) => `<option value="${a.uuid}">${nome(a)}</option>`).join("")}</select></div>`,
      ok: { callback: (_e, b) => b.form.elements.vitima.value },
      rejectClose: false,
    });
    vitima = uuid ? atorDe(uuid) : null;
    if (!vitima) return null;
  }
  const agarre = vitima.system.estado?.agarre ?? {};
  const quemSegura = agarre.por ? atorDe(agarre.por) : null;
  const passos = passosDaSoltura(vitima === ator, agarre.passos);
  const contexto = game.i18n.localize("OP2.Agarre.Soltar");
  // Acrobacia ou Luta, à escolha de quem tenta (p. 33); a sugestão é a de dado maior.
  const periciaUsada = ehNpc(ator) ? "luta" : (pericia ?? await escolherEntre(ator, ["luta", "acrobacia"], { rapido, titulo: contexto }));
  if (!periciaUsada) return null;
  const dt = quemSegura ? undefined : DT_PADRAO;
  const meu = ehNpc(ator)
    ? await rolarDadosDeNpc(ator, dadosDoNpcPara(ator, "luta", "fisico"), { oposto: Boolean(quemSegura), dt, passos, contexto, semCard: true })
    : await rolarTeste(ator, { chavePericia: periciaUsada, oposto: Boolean(quemSegura), dt, passos, rapido, contexto, semCard: true });
  if (!meu) return null;
  const dele = quemSegura ? await rolarResposta(quemSegura, "luta", "fisico", contexto) : null;
  const venceu = venceuSoltura(meu.total, dele?.total);
  if (cena) await registrarAcao(cena, ator, "corpo");
  const texto = vitima !== ator ? "OP2.Agarre.TentouSoltarOutro" : (passos ? "OP2.Agarre.TentouSoltar" : "OP2.Agarre.TentouSoltarLivre");
  await cardConfronto(ator, {
    titulo: contexto,
    selo: dele ? game.i18n.localize("OP2.Confronto.Oposto") : `${game.i18n.localize("OP2.DT")} ${DT_PADRAO}`,
    esquerda: lado(ator, meu, { venceu }),
    direita: quemSegura ? lado(quemSegura, dele, { venceu: !venceu }) : lado(vitima),
    veredito: venceu
      ? { classe: "acerto", rotulo: game.i18n.format("OP2.Agarre.Solto", { nome: vitima.name }) }
      : { classe: "erro", rotulo: game.i18n.format("OP2.Agarre.Preso", { nome: vitima.name }) },
    linhas: [game.i18n.format(texto, { ator: nome(ator), vitima: nome(vitima), passos })],
    botoes: [{
      rotulo: game.i18n.format("OP2.Agarre.BotaoSoltar", { alvo: vitima.name }),
      acao: "vigilia-condicao", soMestre: !venceu, dados: { atorUuid: vitima.uuid, condicao: "agarrado", ligar: "0" },
    }],
    rolls: [meu, ...(dele ? [dele] : [])],
  });
  return { venceu };
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

/** Anuncia no chat o dano que entrou, depois da proteção: "9 de dano em Afogado 1", e se caiu. */
async function anunciarDano(alvo, final, bruto, recurso, antes) {
  const t = (chave, dados) => game.i18n.format(`OP2.Confronto.${chave}`, dados);
  const linhas = [];
  if (bruto > final) linhas.push(t("Protecao", { bruto, final }));
  // `antes`: lido antes de aplicar. Quem pediu ao mestre ainda não recebeu o update aqui.
  if (final > 0 && antes - final <= 0) linhas.push(t(recurso === "pd" ? "Enlouqueceu" : "Caiu", { nome: nome(alvo) }));
  return cardVigilia(alvo, {
    titulo: t(recurso === "pd" ? "DanoEmocionalTitulo" : "DanoTitulo"),
    estilo: final > 0 ? "falha" : "investigacao",
    texto: `<span class="op2-confronto__golpe"><strong class="op2-confronto__dano">${final}</strong>
      <span>${t(recurso === "pd" ? "DanoEmocionalEm" : "DanoEm", { alvo: nome(alvo) })}</span></span>`,
    linhas,
  });
}

/**
 * A escolha da armadura, em card: absorver (gasta 1 ponto, tira 10) ou levar o dano inteiro
 * (beta §8.4, ação livre de quem sofre). Vai para quem joga com o alvo e para o mestre, que
 * decide por quem não está. Card, não pop-up de Sim/Não: na mesa, o "Sim" depois de "Aplicar
 * dano" passava por confirmação e gastava a armadura sem ninguém escolher.
 */
function cardDaArmadura(alvo, quantidade, recurso, ignoraRd) {
  const rd = alvo.system.rd ?? 0;
  const n = alvo.system.armadura.disponivel;
  const absorvido = danoDepoisDaProtecao(quantidade, { rd, ignoraRd: Number(ignoraRd), gastarArmadura: true });
  const inteiro = danoDepoisDaProtecao(quantidade, { rd, ignoraRd: Number(ignoraRd) });
  const dados = (armadura) => ({ atorUuid: alvo.uuid, quantidade, recurso, ignoraRd, armadura, grupo: "armadura" });
  return cardVigilia(alvo, {
    titulo: game.i18n.localize("OP2.Combate2.ArmaduraTitulo"),
    texto: game.i18n.format("OP2.Combate2.ArmaduraPergunta", { alvo: alvo.name, dano: inteiro, n }),
    whisper: donosDe(alvo),
    botoes: [
      { rotulo: game.i18n.format("OP2.Combate2.ArmaduraAbsorver", { dano: absorvido }), acao: "vigilia-dano-dono", dados: dados(1) },
      { rotulo: game.i18n.format("OP2.Combate2.ArmaduraLevar", { dano: inteiro }), acao: "vigilia-dano-dono", dados: dados(0) },
    ],
  });
}

/**
 * O dano do card. Com ponto de armadura sobrando, quem joga com o alvo escolhe antes
 * (`cardDaArmadura`); `gastar` (ou `data-armadura` do botão) é essa escolha já feita. Quem não
 * é dono do alvo pede ao mestre. A RD do alvo e o que a arma ignora saem aqui (beta §8.5).
 */
export async function aplicarDanoDeCombate(alvo, dataset, { gastar } = {}) {
  const quantidade = Number(dataset.quantidade);
  const recurso = dataset.recurso ?? "pv";
  const rd = alvo.system.rd ?? 0;
  const ignoraRd = Number(dataset.ignoraRd ?? 0);
  const temArmadura = recurso === "pv" && quantidade > 0 && (alvo.system.armadura?.disponivel ?? 0) > 0;
  const escolha = gastar ?? (dataset.armadura === undefined ? undefined : String(dataset.armadura) === "1");
  if (temArmadura && escolha === undefined) {
    await cardDaArmadura(alvo, quantidade, recurso, ignoraRd);
    return true;
  }
  if (escolha === true && !temArmadura && recurso === "pv" && quantidade > 0) {
    // Dois danos esperando escolha e um ponto só: o primeiro "absorver" gastou.
    ui.notifications.warn(game.i18n.format("OP2.Combate2.SemArmadura", { alvo: alvo.name }));
    return false;
  }
  const antes = alvo.system.recursos?.[recurso]?.value ?? 0;
  if (!alvo.isOwner) {
    // Sem mestre, o dano não entra: anunciar antes seria mentir no chat, e o botão ficaria gasto.
    if (!game.users.activeGM) {
      ui.notifications.warn(game.i18n.localize("OP2.Aviso.SemMestreOnline"));
      return false;
    }
    const final = danoDepoisDaProtecao(quantidade, { rd, ignoraRd });
    // O anúncio vem antes: o pedido de teste de lesão, se zerar, sai depois dele.
    await anunciarDano(alvo, final, quantidade, recurso, antes);
    await comoMestre("vigilia-dano", { atorUuid: alvo.uuid, quantidade: final, recurso });
    return final;
  }
  const gastarArmadura = Boolean(escolha) && temArmadura;
  if (gastarArmadura) await alvo.update({ "system.estado.armaduraGasta": alvo.system.estado.armaduraGasta + 1 });
  const final = danoDepoisDaProtecao(quantidade, { rd, ignoraRd, gastarArmadura });
  await anunciarDano(alvo, final, quantidade, recurso, antes);
  await aplicarDano(alvo, final, recurso);
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
  if (quantidade.crua) {
    const recurso = dataset.recurso ?? "pv";
    const antes = alvo.system.recursos?.[recurso]?.value ?? 0;
    await anunciarDano(alvo, quantidade.q, quantidade.q, recurso, antes);
    if (alvo.isOwner) return aplicarDano(alvo, quantidade.q, recurso);
    return comoMestre("vigilia-dano", { atorUuid: alvo.uuid, quantidade: quantidade.q, recurso });
  }
  return aplicarDanoDeCombate(alvo, { ...dataset, quantidade: quantidade.q });
}

/** Dados da ficha reduzida: atributo + perícia, o que o livro imprime junto. */
export function dadosDoNpcPara(npc, pericia, atributo = "fisico", extra = "") {
  const dados = [npc.system.atributos[atributo]?.die ?? "d4", npc.system.pericias?.[pericia]?.die ?? "d4", extra].filter(Boolean);
  return dados.join("+");
}

/** Rola a resposta passiva de quem quer que seja, sem diálogo. */
async function rolarResposta(ator, pericia, atributo, contexto) {
  if (ehNpc(ator)) return rolarDadosDeNpc(ator, dadosDoNpcPara(ator, pericia, atributo), { oposto: true, contexto, atributo, semCard: true });
  return rolarTeste(ator, { chavePericia: pericia, chaveAtributo: atributo, oposto: true, rapido: true, contexto, semCard: true });
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
    ? await rolarDadosDeNpc(ator, dadosDoNpcPara(ator, pericia, "emocao"), { oposto: true, atributo: "emocao", semCard: true })
    : await rolarTeste(ator, { chavePericia: pericia, oposto: true, rapido, semCard: true, contexto: game.i18n.localize(`OP2.Combate2.${qual}`) });
  if (!meu) return null;
  const dele = await rolarResposta(alvo, qual === "fintar" ? "intuicao" : "percepcao", qual === "fintar" ? "emocao" : "mente", game.i18n.localize(`OP2.Combate2.${qual}`));
  const venceu = meu.total > dele.total;
  if (cena) await registrarAcao(cena, ator, "suporte");
  const condicao = qual === "atrapalhar" ? { alvo, chave: "atrapalhado" } : { alvo: ator, chave: "fintando" };
  await cardConfronto(ator, {
    titulo: game.i18n.localize(`OP2.Combate2.${qual}`),
    selo: game.i18n.localize("OP2.Confronto.Oposto"),
    esquerda: lado(ator, meu, { venceu }),
    direita: lado(alvo, dele, { venceu: !venceu }),
    veredito: vereditoOposto(ator, alvo, venceu),
    linhas: [game.i18n.format(venceu ? `OP2.Combate2.${qual}Venceu` : "OP2.Combate2.OpostoPerdeu", { ator: nome(ator), alvo: nome(alvo), a: meu.total, b: dele.total })],
    botoes: [botaoDeCondicao(condicao.alvo, condicao.chave, venceu)],
    rolls: [meu, dele],
  });
  return { venceu };
}

/** Teste oposto: quem venceu, em letra grande. */
function vereditoOposto(ator, alvo, venceu) {
  return venceu
    ? { classe: "acerto", rotulo: game.i18n.format("OP2.Confronto.Vence", { nome: ator.name }) }
    : { classe: "erro", rotulo: game.i18n.format("OP2.Confronto.Vence", { nome: alvo.name }) };
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
  if (qual === "derrubar") botoes.push(botaoDeCondicao(alvo, "caido", venceu));
  // Agarrar guarda quem segura: é contra ele que a vítima testa para se soltar.
  if (qual === "agarrar") botoes.push({ ...botaoDeAgarre(alvo, ator, {}), soMestre: !venceu });
  // Vencer por 5 deixa –1 passo só no próximo teste, até o fim da próxima rodada (beta §7.4).
  if (qual === "empurrar") botoes.push(botaoDeCondicao(alvo, "empurrado", venceu && porCinco));
  if (venceu && porCinco && qual === "derrubar") {
    botoes.push({ rotulo: game.i18n.format("OP2.Combate2.DanoEm", { dano: meu.resultado.rb, alvo: alvo.name }), acao: "vigilia-dano", dados: { atorUuid: alvo.uuid, quantidade: meu.resultado.rb } });
  }
  await cardConfronto(ator, {
    titulo: game.i18n.localize(`OP2.Manobra.${qual}.nome`),
    selo: game.i18n.localize("OP2.Confronto.Oposto"),
    esquerda: lado(ator, meu, { venceu }),
    direita: lado(alvo, dele, { venceu: !venceu }),
    veredito: vereditoOposto(ator, alvo, venceu),
    golpes: venceu && porCinco && qual === "derrubar" ? [golpe(meu.resultado.rb, alvo)] : [],
    linhas: [
      venceu ? game.i18n.localize(`OP2.Manobra.${qual}.efeito`) : game.i18n.format("OP2.Combate2.OpostoPerdeu", { ator: nome(ator), alvo: nome(alvo), a: meu.total, b: dele.total }),
      ...(venceu && porCinco ? [game.i18n.localize(`OP2.Manobra.${qual}.porCinco`)] : []),
    ],
    botoes,
    rolls: [meu, dele],
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
