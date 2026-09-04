/**
 * Roteiro de evento (Item `evento`) — regras puras, sem Foundry.
 *
 * As rodadas do roteiro são contadas a partir do gatilho, não do começo da cena: se a
 * maldição é ativada na rodada 12, a "rodada 4" dela acontece na rodada 16 da cena
 * (achado em uso real, lendo o livro).
 */

/** Em que rodada DO EVENTO a cena está. -1 enquanto o gatilho não foi puxado. */
export function rodadaRelativa(evento, rodadaDaCena) {
  if (!evento?.disparado || evento.rodadaInicial < 0) return -1;
  return rodadaDaCena - evento.rodadaInicial;
}

/** A linha do roteiro que cai nesta rodada da cena, se houver. */
export function linhaDaRodada(evento, rodadaDaCena) {
  const relativa = rodadaRelativa(evento, rodadaDaCena);
  if (relativa < 0) return null;
  return (evento.rodadas ?? []).find((linha) => linha.rodada === relativa) ?? null;
}

/** A próxima rodada DA CENA em que este evento tem algo a dizer, ou null. */
export function proximaRodadaDaCena(evento, rodadaDaCena) {
  if (!evento?.disparado || evento.rodadaInicial < 0) return null;
  const futuras = (evento.rodadas ?? [])
    .map((linha) => evento.rodadaInicial + linha.rodada)
    .filter((rodada) => rodada >= rodadaDaCena)
    .sort((a, b) => a - b);
  return futuras[0] ?? null;
}

/** O que cada evento disparado tem para esta rodada da cena. */
export function linhasDaRodada(eventos, rodadaDaCena) {
  return (eventos ?? [])
    .map((evento) => ({ evento, linha: linhaDaRodada(evento, rodadaDaCena) }))
    .filter(({ linha }) => linha && (linha.narracao?.trim() || linha.efeito?.trim()));
}
