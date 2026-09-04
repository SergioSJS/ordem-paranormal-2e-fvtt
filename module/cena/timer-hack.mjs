/**
 * O problema do hack técnico na mesa (spec §7.3): "o jogador então resolve um
 * problema matemático em 10 segundos".
 *
 * O fluxo é do mestre, não do sistema (achado em uso real: o card do jogador já
 * vinha com o veredito e com a conta E a resposta, e o timer era um contador só na
 * ficha do desafio, que só ele via):
 *
 * 1. O jogador rola Tecnologia. O card dele só diz o total e "o mestre prepara o
 *    problema". O mestre recebe, só ele, a faixa alcançada, a conta, a resposta e
 *    quantos segundos ela dá.
 * 2. O mestre avisa o tempo, pergunta se o jogador está pronto e aperta "Revelar o
 *    problema e iniciar": a conta e um contador grande abrem na tela de TODO MUNDO
 *    (ponte de socket para todos os clientes), e um card público registra o
 *    problema. O mestre vê a resposta na janela dele.
 * 3. O jogador responde em voz alta. O mestre aperta Acertou ou Errou: o desafio
 *    resolve (ou não), a janela de todos mostra o veredito e um card público fecha
 *    a rodada.
 */
import { SYSTEM_ID } from "../config.mjs";
import { renderizar } from "../dice/teste.mjs";
import { carregarDesafio } from "./acoes-desafio.mjs";
import { separarProblema } from "./desafios.mjs";
import { paraTodos, registrarAcaoDeTodos } from "../ui/socket.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const CHAT = `systems/${SYSTEM_ID}/templates/chat`;
const SEGUNDOS_PADRAO = 10;

export class TimerHackApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "op2-timer-hack",
    classes: ["op2", "op2-timer-hack"],
    window: { title: "OP2.Desafio.HackTecnico", icon: "fa-solid fa-laptop-code", resizable: false, minimizable: false },
    position: { width: 560, height: "auto" },
    actions: {
      acertou: TimerHackApp.#acertou,
      errou: TimerHackApp.#errou,
    },
  };

  static PARTS = {
    corpo: { template: `systems/${SYSTEM_ID}/templates/cena/timer-hack.hbs` },
  };

  /**
   * @param {object} dados  {desafioUuid, atorId, atorNome, desafioNome, pergunta,
   *   resposta (só no cliente do mestre), segundos, inicio}
   */
  constructor(dados, opcoes = {}) {
    super(opcoes);
    this.dados = dados;
  }

  #intervalo = null;
  #verdito = null;

  /** Segundos que faltam, contados do instante em que o mestre iniciou. */
  get restante() {
    return Math.max(0, Math.ceil((this.dados.inicio + this.dados.segundos * 1000 - Date.now()) / 1000));
  }

  async _prepareContext() {
    return {
      ...this.dados,
      restante: this.restante,
      esgotado: this.restante <= 0,
      verdito: this.#verdito,
      ehGM: game.user.isGM,
    };
  }

  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    clearInterval(this.#intervalo);
    // O contador é da tela, não do documento: cada cliente conta do mesmo `inicio`.
    this.#intervalo = setInterval(() => {
      const mostrador = this.element?.querySelector("[data-restante]");
      if (!mostrador) return clearInterval(this.#intervalo);
      const restante = this.restante;
      mostrador.textContent = restante;
      if (restante <= 0) {
        clearInterval(this.#intervalo);
        this.element.classList.add("op2-timer-hack--esgotado");
        const aviso = this.element.querySelector("[data-esgotado]");
        if (aviso) aviso.hidden = false;
      }
    }, 250);
  }

  _onClose(opcoes) {
    clearInterval(this.#intervalo);
    return super._onClose(opcoes);
  }

  /** O veredito do mestre chega a todos; a janela fica mais um pouco e fecha. */
  mostrarVerdito(acertou) {
    this.#verdito = acertou ? "acertou" : "errou";
    clearInterval(this.#intervalo);
    this.render();
    setTimeout(() => { if (this.rendered) this.close(); }, 4000);
  }

  static async #acertou() {
    await encerrarHackTecnico(this.dados.desafioUuid, this.dados.atorId, true);
  }

  static async #errou() {
    await encerrarHackTecnico(this.dados.desafioUuid, this.dados.atorId, false);
  }
}

/* -- uma janela por cliente ----------------------------------------------- */

let instancia = null;

function mostrar(dados) {
  if (instancia?.rendered) instancia.close();
  instancia = new TimerHackApp(dados);
  instancia.render({ force: true });
  return instancia;
}

registrarAcaoDeTodos("mostrarTimerHack", (dados) => { mostrar(dados); });
registrarAcaoDeTodos("encerrarTimerHack", ({ acertou }) => { instancia?.mostrarVerdito(acertou); });

async function cardPublico(ator, contexto) {
  return ChatMessage.create({
    speaker: ator ? ChatMessage.getSpeaker({ actor: ator }) : ChatMessage.getSpeaker(),
    content: await renderizar(`${CHAT}/hack-timer.hbs`, contexto),
    flags: { [SYSTEM_ID]: { tipo: "desafio", atorId: ator?.id ?? "" } },
  });
}

/**
 * O mestre revela o problema e dispara o contador em todas as telas.
 * @param {string} desafioUuid
 * @param {string|null} atorId        quem está hackeando (speaker dos cards)
 * @param {number} [indiceFaixa]      linha da tabela do painel; -1 = sem tabela
 * @param {{ segundos?: number }} [opcoes]
 */
export async function iniciarHackTecnico(desafioUuid, atorId, indiceFaixa = -1, { segundos: pedidos } = {}) {
  if (!game.user.isGM) return null;
  const desafio = await carregarDesafio(desafioUuid);
  if (!desafio) return null;
  const ator = atorId ? game.actors.get(atorId) : null;
  const linha = desafio.system.hackTecnico.tabela[indiceFaixa] ?? null;
  const { enunciado, resposta } = separarProblema(linha?.desafio ?? "");
  const segundos = pedidos > 0 ? pedidos : (linha?.segundos > 0 ? linha.segundos : SEGUNDOS_PADRAO);

  const dados = {
    desafioUuid,
    atorId: ator?.id ?? null,
    atorNome: ator?.name ?? "",
    desafioNome: desafio.name,
    // "16 x 5 = ?" para a mesa; a resposta fica só na janela do mestre.
    pergunta: enunciado ? (resposta ? `${enunciado} = ?` : enunciado) : "",
    segundos,
    inicio: Date.now(),
  };
  // A resposta não viaja pelo socket: os clientes dos jogadores nem a recebem.
  paraTodos("mostrarTimerHack", dados);
  mostrar({ ...dados, resposta });
  await cardPublico(ator, { fase: "inicio", ...dados });
  return dados;
}

/** O veredito do mestre: resolve o desafio (ou não) e fecha o contador de todos. */
export async function encerrarHackTecnico(desafioUuid, atorId, acertou) {
  if (!game.user.isGM) return null;
  const desafio = await carregarDesafio(desafioUuid);
  if (!desafio) return null;
  const ator = atorId ? game.actors.get(atorId) : null;
  if (acertou) await desafio.update({ "system.hackTecnico.resolvido": true });
  paraTodos("encerrarTimerHack", { acertou });
  instancia?.mostrarVerdito(acertou);
  await cardPublico(ator, { fase: "fim", acertou, atorNome: ator?.name ?? "", desafioNome: desafio.name, desafioUuid });
  return acertou;
}
