/**
 * Ações das ferramentas da Ordo Realitas (spec §9). Só agentes as usam — a spec não
 * dá um gate mecânico além disso, então não bloqueamos por `tipo` do personagem
 * (sobreviventes simplesmente não têm o Item; é uma restrição de conteúdo, não de
 * código, e a mesa pode ter exceções narrativas).
 */
import { SYSTEM_ID } from "../config.mjs";
import { podeUsarCarga, temReacaoFerramenta, conjuntosFalsosRemovidos, conjuntosRestantes } from "./ferramentas.mjs";
import { leituraParaJogador, parteDoMestre, chaveLeitura } from "./leitura-ferramenta.mjs";
import { investigacaoAtiva } from "./investigacao-ativa.mjs";
import { rolarTeste, renderizar } from "../dice/teste.mjs";
import { comoMestre, registrarAcaoDeMestre } from "../ui/socket.mjs";
import { enviarCardAoMestre } from "../ui/card-mestre.mjs";
import { lerConfig } from "../settings/register.mjs";

// POI é documento de mundo: o jogador não tem permissão de marcar o selo do laser.
registrarAcaoDeMestre("marcarReveladoPorLaser", async ({ uuid }) => {
  const poi = await fromUuid(uuid);
  if (poi?.type === "ponto-interesse") await poi.update({ "system.reveladoPorLaser": true });
});

const CHAT = "systems/ordem-paranormal-2e/templates/chat";

async function carregarPoi(poiUuid) {
  const poi = await fromUuid(poiUuid);
  if (poi?.type !== "ponto-interesse") {
    ui.notifications.warn(game.i18n.localize("OP2.Aviso.POIAusente"));
    return null;
  }
  return poi;
}

/** A descoberta é de quem usou a ferramenta (spec §6.2): sussurro para dono + mestre. */
function sussurroPara(ator) {
  return game.users
    .filter((u) => u.isGM || ator.testUserPermission(u, "OWNER"))
    .map((u) => u.id);
}

function editorDeTexto() {
  return foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
}

async function enviarCard(ator, contexto, whisper) {
  const conteudo = await renderizar(`${CHAT}/ferramenta.hbs`, contexto);
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: ator }),
    content: conteudo,
    whisper,
    flags: { [SYSTEM_ID]: { tipo: "ferramenta", atorId: ator.id } },
  });
}

/**
 * USAR FERRAMENTA (spec §9/§9.3): revela o que a ferramenta encontra naquele POI.
 * `null`/vazio é "leitura normal, sem reação" — que também é informação, por isso
 * revela um card de qualquer jeito, nunca fica em silêncio. Consome 1 carga quando
 * a ferramenta controla carga (Lanterna UV, Pó Revelador).
 * @returns {Promise<{temReacao: boolean, aguardaMestre?: boolean}|null>}
 */
export async function usarFerramenta(ator, poiUuid, subtipo) {
  // Rádio Modificado guarda conjuntos estruturados, não texto — tem app e ação
  // próprios (`usarRadio`/`radio-app.mjs`), não o card genérico de texto revelado.
  if (subtipo === "radio") return null;

  const poi = await carregarPoi(poiUuid);
  if (!poi) return null;

  const rotulo = game.i18n.localize(`OP2.Ferramenta.Subtipo.${subtipo}`);
  const ferramentaItem = ator.items.find((i) => i.type === "ferramenta" && i.system.subtipo === subtipo);
  if (!ferramentaItem) {
    ui.notifications.warn(game.i18n.format("OP2.Aviso.SemFerramenta", { ferramenta: rotulo }));
    return null;
  }
  if (!podeUsarCarga(ferramentaItem.system.cargas)) {
    ui.notifications.warn(game.i18n.format("OP2.Ferramenta.SemCargas", { ferramenta: rotulo }));
    return null;
  }
  if (ferramentaItem.system.cargas.usa) {
    await ferramentaItem.update({ "system.cargas.value": ferramentaItem.system.cargas.value - 1 });
  }

  return entregarLeitura(ator, poi, subtipo);
}

/** A leitura de uma ferramenta num ponto, como texto (o rádio guarda a dele à parte). */
function leituraBruta(poi, chave) {
  const valor = poi.system.ferramentas[chave];
  return typeof valor === "string" ? valor : (valor?.texto ?? "");
}

/**
 * Entrega a leitura de uma ferramenta num ponto — o caminho comum de usar a
 * ferramenta, do Laboratório que passou na escada e do rádio sem enigma. É o
 * espelho de Examinar para o setor de ferramentas:
 *
 * - **Grava no personagem** (`estado.ferramentasReveladas`): a leitura passa a
 *   aparecer no painel dele, com reação ou "leitura normal". Antes ia só para o chat,
 *   e o jogador não tinha onde reler (achado em uso real, Ato II).
 * - **A parte do mestre não vai ao jogador.** O livro imprime junto a instrução de
 *   mesa ("envie o handout", a condição); ela fica só no card do mestre.
 * - **Rascunho** (`ferramentasOcultas`): até o mestre liberar, a ferramenta devolve
 *   leitura normal — "apenas se o Ídolo for quebrado". O mestre vê o rascunho no card
 *   dele, com o aviso.
 * - **Revelação pelo mestre** (setting): como em Examinar, o card fica com ele, com o
 *   botão de entregar; o jogador só sabe que usou.
 * @param {Actor} ator
 * @param {Item} poi
 * @param {string} chave   a ferramenta ("camera", "laboratorio"…)
 * @returns {Promise<{temReacao: boolean, aguardaMestre: boolean}>}
 */
export async function entregarLeitura(ator, poi, chave) {
  const titulo = game.i18n.localize(`OP2.Ferramenta.Subtipo.${chave}`);
  const bruto = leituraBruta(poi, chave);
  const oculta = (poi.system.ferramentasOcultas ?? []).includes(chave);
  const textoJogador = oculta ? "" : leituraParaJogador(bruto);
  const temReacao = Boolean(textoJogador.trim());
  const peloMestre = temReacao && Boolean(lerConfig("revelacaoPeloMestre"));
  const nota = parteDoMestre(bruto);
  const enriquecer = (html) => editorDeTexto().enrichHTML(html, { relativeTo: poi });

  const cartao = { titulo, poiNome: poi.name, atorId: ator.id, poiUuid: poi.uuid, chave };
  if (peloMestre) {
    await enviarCard(ator, { ...cartao, aguardaMestre: true }, sussurroPara(ator));
  } else {
    await gravarLeitura(ator, poi.uuid, chave);
    await enviarCard(ator, {
      ...cartao, temReacao, resultado: temReacao ? await enriquecer(textoJogador) : null,
    }, sussurroPara(ator));
  }

  // O mestre vê o que o jogador não vê: a instrução, o rascunho trancado, o botão de
  // entregar. Sem nada disso, o card dele é o mesmo do jogador — e já chegou.
  if (oculta || nota || peloMestre) {
    await enviarCardAoMestre(ator, "ferramenta", {
      ...cartao,
      soMestre: true,
      oculta,
      temReacao: temReacaoFerramenta(leituraParaJogador(bruto)),
      resultado: await enriquecer(leituraParaJogador(bruto)),
      nota: nota ? await enriquecer(nota) : "",
      entregar: peloMestre ? { atorId: ator.id, poiUuid: poi.uuid, chave } : null,
    }, { tipo: "ferramenta" });
  }

  return { temReacao, aguardaMestre: peloMestre };
}

/** A leitura é do personagem que a fez: grava a chave "<poi>:<ferramenta>" nele. */
export async function gravarLeitura(ator, poiUuid, chave) {
  const atual = ator.system.estado.ferramentasReveladas;
  const nova = chaveLeitura(poiUuid, chave);
  if (atual.has(nova)) return;
  await ator.update({ "system.estado.ferramentasReveladas": [...atual, nova] });
}

/**
 * O mestre entrega ao jogador a leitura que ficou com ele (setting
 * `revelacaoPeloMestre`): grava e manda o card que teria saído na hora.
 */
export async function entregarLeituraDoMestre(ator, { poiUuid, chave }) {
  if (!game.user.isGM) return null;
  const poi = await carregarPoi(poiUuid);
  if (!poi) return null;
  if (ator.system.estado.ferramentasReveladas.has(chaveLeitura(poiUuid, chave))) {
    ui.notifications.info(game.i18n.localize("OP2.Investigacao.JaEntregue"));
    return null;
  }
  const oculta = (poi.system.ferramentasOcultas ?? []).includes(chave);
  const texto = oculta ? "" : leituraParaJogador(leituraBruta(poi, chave));
  const temReacao = Boolean(texto.trim());
  await gravarLeitura(ator, poiUuid, chave);
  await enviarCard(ator, {
    titulo: game.i18n.localize(`OP2.Ferramenta.Subtipo.${chave}`),
    poiNome: poi.name, atorId: ator.id, poiUuid, chave, temReacao,
    resultado: temReacao ? await editorDeTexto().enrichHTML(texto, { relativeTo: poi }) : null,
  }, sussurroPara(ator));
  return { temReacao };
}

/**
 * Desfaz a leitura de uma ferramenta num ponto, para todo personagem que a tenha —
 * o "limpar revelação" do setor de ferramentas. Ato de mestre: escreve nos atores.
 * @returns {Promise<string[]>} nomes de quem perdeu a leitura
 */
export async function limparLeitura(poiUuid, chave) {
  if (!game.user.isGM) return [];
  const alvo = chaveLeitura(poiUuid, chave);
  const afetados = game.actors.filter((a) => a.type === "personagem" && a.system.estado.ferramentasReveladas.has(alvo));
  for (const ator of afetados) {
    await ator.update({ "system.estado.ferramentasReveladas": [...ator.system.estado.ferramentasReveladas].filter((c) => c !== alvo) });
  }
  return afetados.map((a) => a.name);
}

/**
 * Rascunho ↔ liberada, para uma ferramenta de um ponto (o mesmo botão de olho das
 * linhas do quadro). POI é documento de mundo: passa pela ponte.
 * @returns {Promise<boolean>} se ficou em rascunho
 */
export async function alternarFerramentaOculta(poiUuid, chave) {
  const poi = await carregarPoi(poiUuid);
  if (!poi) return false;
  const atuais = poi.system.ferramentasOcultas ?? [];
  const oculta = !atuais.includes(chave);
  await comoMestre("atualizarPoi", {
    uuid: poi.uuid,
    dados: { "system.ferramentasOcultas": oculta ? [...atuais, chave] : atuais.filter((c) => c !== chave) },
  });
  return oculta;
}

/**
 * LASER DE VARREDURA (spec §9): ativado no ambiente, não num POI específico — marca
 * quais POIs da investigação reagem a alguma ferramenta, para economizar tentativas.
 */
export async function usarLaser(ator) {
  const investigacao = investigacaoAtiva();
  if (!investigacao) {
    ui.notifications.warn(game.i18n.localize("OP2.Painel.SemInvestigacao"));
    return null;
  }

  const rotulo = game.i18n.localize("OP2.Ferramenta.Subtipo.laser");
  const temLaser = ator.items.some((i) => i.type === "ferramenta" && i.system.subtipo === "laser");
  if (!temLaser) {
    ui.notifications.warn(game.i18n.format("OP2.Aviso.SemFerramenta", { ferramenta: rotulo }));
    return null;
  }

  const pois = (await Promise.all(investigacao.system.pois.map((uuid) => fromUuid(uuid))))
    .filter((poi) => poi?.type === "ponto-interesse");
  // O livro pode dizer de saída quem a varredura identifica (o Ato II lista os pontos
  // por ambiente, e deixa de fora alguns que reagem a outra ferramenta). Se algum
  // ponto da investigação tem leitura própria no slot do laser, é essa lista que
  // vale; senão, reage quem tem reação a qualquer ferramenta (spec §9).
  const explicito = pois.some((poi) => temReacaoFerramenta(poi.system.ferramentas.laser));
  const marcados = [];
  const leituras = [];
  for (const poi of pois) {
    if (poi.system.reveladoPorLaser) continue;
    const reage = explicito
      ? temReacaoFerramenta(poi.system.ferramentas.laser)
      : Object.values(poi.system.ferramentas).some(temReacaoFerramenta);
    if (!reage) continue;
    await comoMestre("marcarReveladoPorLaser", { uuid: poi.uuid });
    marcados.push(poi.name);
    leituras.push({
      nome: poi.name,
      leitura: explicito ? await editorDeTexto().enrichHTML(leituraParaJogador(poi.system.ferramentas.laser), { relativeTo: poi }) : "",
    });
  }

  await enviarCard(ator, {
    titulo: rotulo,
    laser: true,
    marcados: leituras,
    temMarcados: marcados.length > 0,
  }, sussurroPara(ator));

  return marcados;
}

/**
 * RÁDIO MODIFICADO (spec §9.2): rola Tecnologia (sem DT — o resultado é lido pela
 * tabela de faixas, não passa/falha) e decide quantos conjuntos falsos saem de jogo
 * antes de abrir o app de ordenação (`radio-app.mjs`). Uso ilimitado — não está em
 * `FERRAMENTAS_COM_CARGA`, então não consome nada.
 * @returns {Promise<{ator: Actor, poi: Item, roll: object, conjuntos: object[],
 *   removidos: number, totalFalsos: number}|null>}
 */
export async function usarRadio(ator, poiUuid, { rapido = false } = {}) {
  const poi = await carregarPoi(poiUuid);
  if (!poi) return null;

  const rotulo = game.i18n.localize("OP2.Ferramenta.Subtipo.radio");
  const temRadio = ator.items.some((i) => i.type === "ferramenta" && i.system.subtipo === "radio");
  if (!temRadio) {
    ui.notifications.warn(game.i18n.format("OP2.Aviso.SemFerramenta", { ferramenta: rotulo }));
    return null;
  }

  const conjuntos = poi.system.ferramentas.radio?.conjuntos ?? [];
  if (!conjuntos.length) {
    // Reação sem enigma (o Ídolo grita, nada para ordenar) — ou nenhuma: revela como
    // qualquer outra ferramenta, sem teste. "Sem reação" também é leitura (spec §9.3);
    // antes o rádio avisava "sem conjuntos" e não fazia nada, entregando que ali não
    // há enigma.
    await entregarLeitura(ator, poi, "radio");
    return null;
  }

  const roll = await rolarTeste(ator, {
    chavePericia: "tecnologia",
    semDT: true,
    rapido,
    contexto: `${rotulo} — ${poi.name}`,
  });
  if (!roll) return null;

  const totalFalsos = conjuntos.filter((conjunto) => !conjunto.verdadeiro).length;
  const removidos = conjuntosFalsosRemovidos(roll.total, totalFalsos);

  return { ator, poi, roll, conjuntos: conjuntosRestantes(conjuntos, removidos), removidos, totalFalsos };
}
