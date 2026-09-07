# Mudanças

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versões seguem [SemVer](https://semver.org/lang/pt-BR/).

## [Não publicado]

- **Filtros no painel do mestre**: chips por visibilidade, progresso (intocado, em
  andamento, esgotado) e marcador no mapa, seletor de perícia do quadro e ordem
  (original, nome, progresso) na aba de pontos; a aba de desafios ganha busca, os mesmos
  chips por estado e o seletor de abordagem. Buscar pelo nome abre o card achado mesmo
  recolhido; a barra conta "x de y" e tem limpar. O jogador tem a mesma barra no painel
  e na janela de ações, sem visibilidade e sem "esgotado" (entregaria que acabou), com
  a perícia só do que ele já vê. Na janela de ações a busca passa a ser por aba.
- O card com marcador tem um botão que centraliza o mapa nele.
- Atalhos de teclado: **I** abre e fecha o painel de investigação; **Shift+I**, a janela
  de ações do personagem (troque em Configurar controles).
- **Toda janela do sistema cabe na tela e rola por dentro** — regra global; a ficha do ponto
  com muitas linhas sumia por baixo. O e2e enche cada tipo de janela e exige rolagem.
- A ficha do ponto (a que abre pelo marcador no mapa) traz os controles do card do painel:
  oculto/visível em cada investigação, quem já revelou cada linha, limpar revelação.
- O jogador não vê mais o total de pistas do ponto ("0/3") no painel.
- A janela de ações fecha depois de a ação rolar; cancelada, fica — e, aberta, acompanha o
  que o mestre libera no painel.
- Linhas do quadro gravadas em HTML (versões antigas) aparecem como texto puro na ficha do
  ponto e são migradas no carregamento do mundo.
- O marcador no mapa mostra se o ponto está oculto dos jogadores: esmaecido, com o selo de
  olho cortado no canto.
- No painel, o jogador vê as pistas do ponto como lista, agrupadas pela perícia que as acha.
- O card de Examinar explica o que veio de graça: "uma linha veio sem rolar: a DT dela não
  passa do tamanho do seu dado".
- A lista de investigações ativas não guarda mais uuids de investigações apagadas.

- Perícia de NPC pelo diálogo: a lista do playtest (chave do sistema, rola como a do
  personagem), Aptidões com o campo, "Outra" com nome livre e o dado — em vez de um
  campo de texto solto.

- Link de apoio ao sistema (Ko-fi) na tela de boas-vindas e no README.

## [0.9.5] — 2026-09-07

- Listagem do Foundry: capa é o card do sistema, ícone é o selo, cinco prints com legenda
  (`media` do manifesto). Reenviar o zip das artes pela janela de aventuras.

## [0.9.4] — 2026-09-07

- Auditoria visual do tema claro, tela a tela (`scripts/e2e/auditoria-visual.mjs`): tag
  OCULTO do desafio visível, nome da investigação com reticências na lateral estreita,
  caixa das Notas da ficha visível mesmo vazia, caixa do arquivo no envio do zip sem cortar
  o botão nativo.
- A linha do quadro é texto puro nos dois atos (a ficha do ponto mostrava `<p><em>`).
- Menu de configurações: "Aventuras do playtest" antes de "Arquivos das aventuras"; o menu
  de arquivos não repete um ato que exista no pack de desenvolvimento e no do mundo.

## [0.9.3] — 2026-09-07

- Card do setup centralizado: o Foundry usa a imagem do sistema também como fundo do card de
  mundo, cortando as laterais e pondo o título do mundo por cima — o alto fica só com os
  escorridos, e nada de texto ou selo nas bordas.

## [0.9.2] — 2026-09-07

- **Tema claro do Foundry**: cabeçalho das janelas, diálogos, selo (preto no claro), cores de
  linha e rótulo, pips da ficha e botões vermelhos — tudo legível nos dois temas.
- Card do setup refeito: escuro, com o escorrido no alto.

## [0.9.1] — 2026-09-07

- Card do sistema na tela de setup (`media` tipo `setup`): fontes e paleta do sistema, selo
  da licença — nenhuma arte do livro. Gerador em `scripts/marca/`.

## [0.9.0] — 2026-09-06

Candidata à v1: tudo que a jogatina do Ato I e a revisão das mecânicas do Ato II vão
exercitar. Roda no v13 (13.351) e no v14 (14.363), os dois cobertos pelo e2e.

### Adicionado

- **Ficha, motor de dados e testes.** Escada d4→d12, dois dados somados, RA/RB,
  crítico (dois dados iguais ≥ 6), falha crítica com a tabela de 1d8, testes opostos,
  Ajuda e dados extras. Tudo em `stepMod`, resolvido em `prepareDerivedData()`.
- **Cenas de investigação.** Pontos de interesse com quadro Perícia · DT · Informação
  em três estados por linha, Examinar, Interagir, Recapitular, Compartilhar,
  sobrecarga mental por rodada e o painel do mestre — que é a mesma tela da ficha da
  investigação.
- **Desafios de acesso.** Arrombar, Destrancar (com o minigame de senha), Alcançar,
  Sustentar, hack técnico (com contador na tela da mesa) e hack social.
- **Ferramentas da Ordo Realitas.** As dez, com Laboratório Portátil e Rádio
  Modificado em janela própria e o setor de ferramentas nos pontos.
- **Contar ao grupo.** A pista é de quem achou; um botão na linha (no card de Examinar
  e na janela de ações) a torna visível para todos os participantes, com o nome de
  quem contou. O mestre continua podendo abrir qualquer linha pelo painel.
- **Eventos com roteiro próprio.** Item `evento` com gatilho e rodadas contadas a
  partir dele: disparar é ato de mesa, no painel.
- **Marcadores no mapa.** O ponto vira nota da cena com o ícone dele; nasce só do
  mestre e acende para a mesa quando o ponto deixa de estar oculto.
- **Identidade visual dos perfis.** Analista, Executor e Vigilante pintam a ficha
  inteira e as janelas abertas a partir dela.
- **Compêndios.** Habilidades, ocupações e ferramentas; pré-gerados, cenas, handouts
  e trilha dos atos I e II.

### Notas

- **As aventuras nascem do seu PDF, dentro do Foundry.** O texto do livro não vem no
  pacote — a Licença da Comunidade não permite. *Configurações → Aventuras do
  playtest*: o sistema lê o PDF do playtest no navegador, monta o Ato I (e o Ato II, se
  o PDF for o completo) e guarda no compêndio do mundo, pronto para importar. Lê as
  revisões 1 e 1.1 do playtest e o PDF gratuito; contradição do livro (o Rádio da 1.1)
  vira aviso na janela, não erro. A janela mostra o que há das artes na pasta do mundo
  e tem o botão de enviar o zip antes de importar.
- **Nenhuma arte do livro vem no pacote.** As do Ato I são o zip gratuito do site da
  editora; as do Ato II vêm com a assinatura dos Arquivos Secretos. O sistema pede o
  zip de cada ato na hora de importar e guarda os arquivos na pasta do mundo.
- **Cena pronta para jogar.** Marcadores dos pontos, tokens dos pré-gerados na posição
  inicial, luzes, grade e escuridão capturados de uma mesa montada vêm nos dois atos;
  o Ato II herda do Ato I pela transformação do mapa, com os marcadores casados pelo
  nome do ponto. Reimportar um ato com a cena aberta mantém o nível da cena.
- O selo e o aviso da Licença da Comunidade na tela de boas-vindas, na janela de
  aventuras, no README e na capa da listagem.
- Sistema não-oficial, feito por fã, sem afiliação com os detentores dos direitos de
  Ordem Paranormal RPG.
