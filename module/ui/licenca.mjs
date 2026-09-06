/**
 * A Licença da Comunidade de Ordem Paranormal, no que o sistema mostra: o aviso que
 * ela exige em conteúdo de texto, o selo que ela exige em conteúdo visual (sem
 * transparência, pelo menos 10% da largura da "capa") e os links oficiais.
 *
 * O selo vem do Drive da editora e viaja no sistema em `assets/licenca/`: é o único
 * arquivo da editora no pacote, e está ali porque a licença pede que esteja.
 */
import { SYSTEM_ID } from "../config.mjs";

export const LICENCA = {
  aviso: "OP2.Licenca.Aviso",
  url: "https://ordemparanormal.com.br/licenca",
};

/** Os links oficiais que a licença lista. */
export const LINKS = {
  licenca: LICENCA.url,
  site: "https://ordemparanormal.com.br",
  loja: "https://loja.ordemparanormal.com.br",
};

/** O selo em branco, para o fundo escuro do sistema; o preto fica para o README e a capa clara. */
export const SELO = `systems/${SYSTEM_ID}/assets/licenca/selo-branco.png`;
