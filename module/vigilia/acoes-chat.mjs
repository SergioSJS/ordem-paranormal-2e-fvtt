/** Botões dos cards do beta. Nada se aplica sem clique, como no resto do sistema. */
import { registrarAcaoDeChat } from "../ui/chat.mjs";
import { cardDeDano } from "../cena/rodada.mjs";
import { rolarTesteBeta, rolarTabelaBeta, aplicarLinhaPorChave } from "./queda.mjs";
import { revidar, defender, aplicarDanoDeCombate, pedirDanoManual } from "./acoes-combate.mjs";
import { acaoChamativa, dizerNumeros, descartarIguais } from "./acoes-furtividade.mjs";
import { mudarCondicao, marcarDerrubado, agarrar } from "./cena-acao.mjs";

/**
 * A decisão é de quem joga com o personagem (ou do mestre): o card é público, o clique não.
 * Sem isto, um jogador rola a reação do NPC, ou a escrita falha depois de ele já ter rolado.
 * Devolve `false` se recusou ou se o diálogo foi fechado: o botão não fica marcado como usado.
 */
const soDono = (acao) => async (ator, dados) => {
  if (!ator.isOwner) {
    ui.notifications.warn(game.i18n.format("OP2.Aviso.SoDono", { ator: ator.name }));
    return false;
  }
  return (await acao(ator, dados)) ?? false;
};

export function registrarAcoesDeChatDaVigilia() {
  registrarAcaoDeChat("vigilia-teste-queda", soDono((ator, d) => rolarTesteBeta(ator, d.tipo)));
  registrarAcaoDeChat("vigilia-tabela-queda", soDono((ator, d) => rolarTabelaBeta(ator, d.tipo, { naoLetal: Boolean(d.naoLetal) })));
  registrarAcaoDeChat("vigilia-aplicar-linha", soDono((ator, d) => aplicarLinhaPorChave(ator, d.tipo, d.chave)));
  registrarAcaoDeChat("vigilia-fim-pavor", soDono((ator) => ator.update({ "system.estado.pavor": "" })));
  registrarAcaoDeChat("vigilia-recupera-pv", soDono((ator) => ator.update({ "system.recursos.pv.value": ator.system.recursos.pv.value + 1 })));
  registrarAcaoDeChat("vigilia-dano", (ator, d) => aplicarDanoDeCombate(ator, d));
  registrarAcaoDeChat("vigilia-dano-dono", soDono((ator, d) => aplicarDanoDeCombate(ator, d)));
  registrarAcaoDeChat("vigilia-revidar", soDono((ator, d) => revidar(ator, d)));
  registrarAcaoDeChat("vigilia-defender", soDono((ator, d) => defender(ator, d)));
  registrarAcaoDeChat("vigilia-perder-dado", soDono((ator) => acaoChamativa(ator)));
  registrarAcaoDeChat("vigilia-numeros", async (_ator, d) => dizerNumeros(await fromUuid(d.cena)));
  // A regra propõe, quem clica aplica: nada disso acontece sozinho (feedback de mesa).
  registrarAcaoDeChat("vigilia-condicao", (ator, d) => mudarCondicao(ator, d.condicao, d.ligar !== "0"));
  // Acertou quem agarra (manobra, Afogar): prende e guarda quem segura. O dano é no fim da rodada.
  registrarAcaoDeChat("vigilia-agarrar", (ator, d) => agarrar(ator, { por: d.por, dano: d.dano, passos: d.passos }));
  // Digitar um valor é decisão da mesa: mestre ou quem joga com o alvo.
  registrarAcaoDeChat("vigilia-dano-manual", soDono((ator, d) => pedirDanoManual(ator, d)));
  registrarAcaoDeChat("vigilia-descartar", (ator, d) => descartarIguais(ator, d));
  registrarAcaoDeChat("vigilia-derrubado", (ator) => marcarDerrubado(ator));
  // Dano por fórmula: o da rodada na perseguição, o sopro na nuca. O dono ainda decide a armadura.
  registrarAcaoDeChat("vigilia-rolar-dano", async (ator, d) => {
    const roll = await new Roll(d.formula).evaluate();
    await cardDeDano(ator, roll, { titulo: ator.name, recurso: d.recurso ?? "pv" });
    await aplicarDanoDeCombate(ator, { quantidade: roll.total, recurso: d.recurso ?? "pv" });
  });
}
