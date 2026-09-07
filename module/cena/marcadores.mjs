/* global PIXI */
/**
 * Marcadores no mapa: cada ponto de interesse (ou desafio) pode virar uma nota da
 * cena, com o ícone do próprio ponto, no lugar onde ele está no mapa.
 *
 * Quem coloca é o mestre: arrasta o ponto — do painel, da barra lateral ou do
 * compêndio — para o mapa. O marcador nasce só do mestre e **passa a aparecer para
 * os jogadores quando o ponto deixa de estar oculto na investigação**, a mesma regra
 * que o painel e a janela de ações já usam. Nada de mexer em permissão de documento:
 * a visão é derivada do estado da investigação, então revelar um ponto acende o
 * marcador na hora, e escondê-lo apaga.
 *
 * Como o Foundry decide a visão de uma nota sem diário vinculado: se o autor for um
 * mestre, o jogador não vê. Por isso o marcador nasce com `author: null` — aí a regra
 * do core libera para todo mundo (continua valendo névoa e visão) e a trava de mesa
 * fica por nossa conta, aqui.
 */
import { SYSTEM_ID } from "../config.mjs";
import { investigacoesVisiveis, investigacoesAtivas } from "./investigacao-ativa.mjs";

/** A chave da flag que liga a nota ao ponto (ou desafio). */
export const CHAVE_MARCADOR = "marcador";

/** @returns {string|null} o uuid do ponto marcado por esta nota, se for nossa. */
export function pontoDoMarcador(nota) {
  return nota?.getFlag?.(SYSTEM_ID, CHAVE_MARCADOR) ?? null;
}

/**
 * Se o ponto marcado está liberado para quem olha. Função pura: recebe as
 * investigações que o usuário enxerga, para poder ser testada fora do Foundry.
 *
 * Regra: o marcador acende quando o ponto (ou o desafio) está vinculado a alguma
 * investigação visível e NÃO está na lista de ocultos dela — igual ao painel.
 */
export function liberadoNas(uuid, investigacoes) {
  return investigacoes.some(({ system }) => (
    (system.pois?.includes(uuid) && !system.poisOcultos?.includes(uuid))
    || (system.desafios?.includes(uuid) && !system.desafiosOcultos?.includes(uuid))
  ));
}

/** O mesmo, no jogo: o mestre vê sempre; o jogador, só o que a investigação liberou. */
export function marcadorLiberado(uuid) {
  if (game.user.isGM) return true;
  return liberadoNas(uuid, investigacoesVisiveis());
}

/**
 * Se a mesa já enxerga este ponto. É a mesma pergunta do jogador, mas sem depender de
 * quem está olhando: serve para o mestre saber, no mapa, o que ainda está escondido.
 */
export function liberadoParaAMesa(uuid) {
  return liberadoNas(uuid, investigacoesAtivas());
}

/** As notas desta cena que marcam este ponto. */
export function marcadoresDoPonto(cena, uuid) {
  return [...(cena?.notes ?? [])].filter((nota) => pontoDoMarcador(nota) === uuid);
}

/**
 * Põe (ou muda de lugar) o marcador de um ponto na cena. Um ponto, um marcador por
 * cena: arrastar de novo é reposicionar, não duplicar.
 */
export async function marcarNoMapa(uuid, { x, y, cena = canvas?.scene } = {}) {
  if (!game.user.isGM) return null;
  if (!cena) {
    ui.notifications.warn(game.i18n.localize("OP2.Marcador.SemCena"));
    return null;
  }
  const ponto = await fromUuid(uuid);
  if (!["ponto-interesse", "desafio-acesso"].includes(ponto?.type)) return null;

  // Pelo botão não há posição: cai no meio do que o mestre está vendo, e ele arrasta
  // dali. Arrastando o ponto para o mapa, a posição é a do cursor.
  x ??= canvas?.stage?.pivot?.x ?? cena.width / 2;
  y ??= canvas?.stage?.pivot?.y ?? cena.height / 2;

  const existente = marcadoresDoPonto(cena, uuid)[0];
  if (existente) {
    await existente.update({ x: Math.round(x), y: Math.round(y) });
    ui.notifications.info(game.i18n.format("OP2.Marcador.Movido", { nome: ponto.name }));
    return existente;
  }

  const [nota] = await cena.createEmbeddedDocuments("Note", [{
    x: Math.round(x),
    y: Math.round(y),
    // Sem autor a regra do core não esconde do jogador; quem decide é `isVisible`.
    author: null,
    text: ponto.name,
    texture: { src: ponto.img },
    // 40 é o padrão do core: no zoom de mesa o pino sumia sobre o mapa do porão.
    iconSize: 60,
    // Fora da névoa também: o mapa da mesa é o mapa do livro, e o ponto marcado não
    // depende de alguém já ter passado por ali.
    global: true,
    flags: { [SYSTEM_ID]: { [CHAVE_MARCADOR]: uuid } },
  }]);
  ui.notifications.info(game.i18n.format("OP2.Marcador.Criado", { nome: ponto.name }));
  return nota;
}

/** Tira o marcador do ponto (em todas as cenas). */
export async function desmarcarDoMapa(uuid) {
  if (!game.user.isGM) return;
  for (const cena of game.scenes) {
    const ids = marcadoresDoPonto(cena, uuid).map((n) => n.id);
    if (ids.length) await cena.deleteEmbeddedDocuments("Note", ids);
  }
}

/**
 * Clicar no marcador leva ao card do ponto: o mestre cai no painel, o jogador na
 * janela de ações do personagem dele — que é de onde ele age.
 */
export async function abrirMarcador(uuid) {
  const ponto = await fromUuid(uuid);
  if (!ponto) return;

  // O mestre vai para a ficha do ponto — é o cadastro dele, com quadro, notas e
  // desafios. O jogador não tem permissão nesse Item (nem deveria ver o quadro
  // inteiro): para ele o marcador abre a janela de ações, no card daquele ponto.
  if (game.user.isGM) {
    ponto.sheet.render(true);
    return;
  }
  const { abrirAcoesInvestigacao } = await import("./acoes-app.mjs");
  const personagem = game.user.character;
  if (!personagem) {
    ui.notifications.warn(game.i18n.localize("OP2.Marcador.SemPersonagem"));
    return;
  }
  const app = abrirAcoesInvestigacao(personagem);
  await app?.focarCard?.(uuid, ponto.type === "desafio-acesso" ? "desafios" : "pontos");
}

/** Redesenha a visão dos marcadores: revelar um ponto acende o dele na hora. */
export function atualizarMarcadores() {
  for (const nota of canvas?.notes?.placeables ?? []) {
    // `refreshState` propaga para a visibilidade e também refaz a meia-luz do mestre.
    if (pontoDoMarcador(nota.document)) nota.renderFlags.set({ refreshState: true });
  }
}

/** A classe da nota no canvas, com a nossa trava de visão e o clique no card. */
function classeDeNota(Base) {
  return class NotaOP2 extends Base {
    /** @override */
    get isVisible() {
      const uuid = pontoDoMarcador(this.document);
      // `super` continua cuidando de prévia, seleção, névoa e visão; o marcador só
      // acrescenta a trava da mesa.
      if (!uuid || this.isPreview || this.controlled) return super.isVisible;
      return marcadorLiberado(uuid) && super.isVisible;
    }

    /**
     * Meia-luz no marcador que a mesa ainda não vê. Só o mestre tem os dois estados na
     * tela; sem isso ele não sabe, olhando o mapa, o que já revelou (achado em uso real).
     */
    _refreshState() {
      super._refreshState();
      const uuid = pontoDoMarcador(this.document);
      if (!uuid || !this.controlIcon) return;
      const oculto = game.user.isGM && !liberadoParaAMesa(uuid);
      // Meia-luz + ícone cinza + selo vermelho riscado: só a meia-luz não bastava
      // para o mestre ver, olhando o mapa, o que os jogadores ainda não veem
      // (pedido em uso real). Jogador nunca chega aqui com `oculto`: nem vê a nota.
      this.controlIcon.alpha = oculto ? 0.6 : 1;
      if (this.controlIcon.icon) this.controlIcon.icon.tint = oculto ? 0x8a7f79 : 0xffffff;
      this.#seloOculto(oculto);
    }

    /** O selo "oculto" no canto do ícone: disco vermelho com o risco branco. */
    #seloOculto(mostrar) {
      let selo = this.controlIcon.children.find((c) => c.name === "op2-selo-oculto");
      if (!mostrar) { selo?.destroy(); return; }
      if (selo) return;
      const tamanho = this.controlIcon.iconSize ?? this.controlIcon.width ?? 40;
      const r = Math.max(6, Math.round(tamanho * 0.2));
      selo = new PIXI.Graphics();
      selo.name = "op2-selo-oculto";
      selo.beginFill(0xc8321e).lineStyle(2, 0x0d0908, 0.9).drawCircle(0, 0, r).endFill();
      selo.lineStyle(2.5, 0xf2ede6, 1).moveTo(-r * 0.55, -r * 0.55).lineTo(r * 0.55, r * 0.55);
      selo.position.set(tamanho - r * 0.6, tamanho - r * 0.6);
      this.controlIcon.addChild(selo);
    }

    /**
     * Sem diário vinculado, o core devolve `false` aqui — e o gerente de mouse nem
     * chega a chamar o duplo clique: o marcador ficava inerte no mapa (achado em uso
     * real, medido: chamar o handler na mão abria, o clique não).
     */
    _canView(usuario) {
      return pontoDoMarcador(this.document) ? true : super._canView(usuario);
    }

    /** @override */
    _onClickLeft2(evento) {
      const uuid = pontoDoMarcador(this.document);
      if (!uuid) return super._onClickLeft2(evento);
      abrirMarcador(uuid);
      return undefined;
    }
  };
}

export function registrarMarcadores() {
  CONFIG.Note.objectClass = classeDeNota(CONFIG.Note.objectClass);

  // Arrastar um ponto para o mapa cria o marcador. Vale para o card do painel, a
  // barra lateral e o compêndio: todos soltam `{type: "Item", uuid}`.
  Hooks.on("dropCanvasData", (_canvas, dados) => {
    if (dados?.type !== "Item" || !dados.uuid) return undefined;
    const item = fromUuidSync(dados.uuid);
    if (!["ponto-interesse", "desafio-acesso"].includes(item?.type)) return undefined;
    if (!game.user.isGM) return false;
    marcarNoMapa(dados.uuid, { x: dados.x, y: dados.y });
    return false;
  });

  // Revelar/esconder um ponto muda quem vê o marcador; o ponto some, o marcador some.
  for (const gatilho of ["updateActor", "createActor", "deleteActor"]) {
    Hooks.on(gatilho, (ator) => {
      if (ator.type === "investigacao") atualizarMarcadores();
    });
  }
  Hooks.on("deleteItem", (item) => {
    if (["ponto-interesse", "desafio-acesso"].includes(item.type) && game.user.isGM) desmarcarDoMapa(item.uuid);
  });
  Hooks.on("canvasReady", atualizarMarcadores);
}
