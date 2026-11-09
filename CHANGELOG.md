# Mudanças

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versões seguem [SemVer](https://semver.org/lang/pt-BR/).

## [Não publicado]

## [0.10.0] — 2026-11-09

**Modo Vigília**, o playtest beta *Contos da Vigília*, em paralelo ao modo moderno. Um setting de mundo escolhe
o modo; os Atos I e II continuam como estavam.

- **As duas missões, do seu PDF e dos seus zips.** A janela de aventuras tem um grupo por modo. O texto sai do
  PDF do mestre e as artes do zip da editora, reduzidas ao importar (o mapa cabe em 4096 px, o token em 1024).
- **Motor do beta:** modificador fixo no teste, dado de pavor (controlar, abraçar ou ignorar), crítico que soma
  o segundo maior, marcadores de Análise, dados guardados para depois da rolagem.
- **Combate por fases** (suporte, distância, corpo a corpo, final) com painel de ação, ataque, defesa, manobras,
  condições, armadura, redução de dano, lesões e traumas.
- **Perseguição e furtividade** como cenas de ação, com cortes, fôlego, dados de esconderijo e rolagem de procura;
  equilíbrio, escalar e carregar nos desafios; Observar na investigação.
- **Ficha:** aba Condição, relações por grau, patamar, armas e armaduras com mecânica, NPC com RD e ataques.
- **Tudo se faz à mão.** A automação propõe, e quem clica aplica. Fase, rodada, "já agiu", PV, PD, pavor,
  condições, avanço, fôlego, esconderijo, lesões e relações se editam; ataque aceita ajuste de DT e de passos;
  dano aceita "Outro valor…".
- **Luz e escuridão nas cenas das missões.** A ilhota nasce escura e na névoa, só com a tocha paranormal acesa
  no topo da pilha; a gruta tem as tochas, a fogueira, os cristais e a água do mapa acesos, e a chama do ritual
  no altar, apagada até o mestre acender. Tudo se ajusta na camada de iluminação.
- **O modo Vigília tem a cara do beta.** Carvão com textura de giz, prata e osso no lugar do vermelho, rótulo em
  faixa de nó celta, moldura dupla, dado de osso, títulos em IM Fell English SC e texto em Barlow; no tema claro,
  o papel azul-acinzentado das páginas de regra. Segue o modo do mundo; o moderno não muda.
- **Montar a cena de ação.** A ficha da cena virou a tela de montagem: quem está (personagens e criaturas, com
  retrato), pôr pela lista, pelos tokens selecionados, pelos personagens dos jogadores ou arrastando, e os modelos
  das ondas à parte. O painel escolhe a cena no topo, mostra a cena parada com o botão de iniciar e o atalho dos
  jogadores, e a onda de criaturas ganhou rótulo. As cenas das missões nascem sem personagens.
- **Nova cena e arrastar para o painel.** "Nova cena" pergunta nome, tipo e quem entra (jogadores, tokens
  selecionados) e cria a cena parada; antes, "Novo combate" puxava o mapa inteiro e já começava. Soltar um ator
  da barra lateral no painel o põe na cena.
- **Guia da fase** no painel: o que dá para fazer em cada fase do combate (e na perseguição e na furtividade), com
  as ações da fase atual primeiro e as outras em "outras ações".
- **Palco**: a cena de ação como teatro no rodapé da tela, para todo mundo. Retratos de quem está em cena, PV,
  condições, quem já agiu, quem caiu; quem age dá um passo à frente com a legenda do card; clicar no próprio
  personagem abre as ações da fase.
- **Modo transmissão (OBS).** Um usuário (ou `/game?op2-transmissao`) que vê só os cards dos personagens, com
  fundo transparente: rosto, personagem, quem joga, PV, PD, pavor e condições, e a rolagem de cada um com os dados
  desenhados, o total e o desfecho. Sussurro e rolagem cega não aparecem. Configurável: posição, direção, escala,
  quem aparece; o usuário e o acesso de observador saem de um clique. Estilo **sem fundo** para avatar
  transparente (sem caixa, PV e PD em texto), escolhido na configuração ou pela URL de cada fonte.
- **Montar, parar e tirar pelo painel.** Parada, a cena se monta no próprio painel (quantidade × ator, jogadores,
  arrastar), com o Iniciar por último; no ar, **Parar** volta à montagem sem zerar nada e **Encerrar** acaba a
  cena; o X em cada linha tira da cena (a criatura que a cena criou sai do mapa junto).
- **Transmissão**: estilo "os dois" (cartões e sem fundo em duas colunas), avatar em busto (cabeça e tronco) ou
  inteiro, e cor no sem fundo (nome no destaque do modo, PV em vermelho, PD em azul).
- **Card de confronto no chat.** Ataque, revide, defesa, manobra, atrapalhar e fintar viram um card só, com os
  dois retratos, a seta, o veredito grande e o dano em número grande com o nome de quem leva; os dados ficam dentro
  do card, em vez de um card de teste genérico à parte (que oferecia "Dano RA/RB" sem saber o alvo). O dano aplicado
  publica o que entrou, depois da proteção, e se o alvo caiu.
- **O combate todo pelo palco.** Clique na figura abre ficha, alvo, já agiu, PV −/+, condições, ações da fase e
  tirar da cena; duplo clique abre a ficha (também da criatura); `T` sobre a figura mira nela (Shift soma), com a
  mira do Foundry quando há token e a do palco quando não há. Na barra, o mestre vai a uma fase com um clique,
  mexe na rodada, avança, para e encerra. O menu de quem já agiu fica opaco (só a figura apaga): antes ele
  herdava a transparência e não se lia sobre o mapa.
- **Transmissão parada no lugar.** O card tem tamanho fixo (a vaga da rolagem e a linha do estado ficam
  reservadas mesmo vazias) e a cena de ação mora num elemento à parte, com posição própria ou fora da tela (para
  uma fonte separada, `=cena`). Antes, começar a cena empurrava todos os cards para baixo e a rolagem esticava o
  card. O e2e mede cada card antes e depois de cena, fase, rolagem, dano, pavor e condição.
- **Armadura é escolha de quem apanha** (beta §8.4). Com ponto sobrando, o dano vira um card com dois botões,
  "Absorver" (gasta 1 ponto, tira 10) e "Levar o dano", para quem joga com o alvo e para o mestre. Antes era um
  Sim/Não depois de "Aplicar dano", que passava por confirmação e gastava a armadura sem ninguém escolher.
- **Prints novos no README:** o card de confronto, o palco com o menu aberto e, pela primeira vez, a
  transmissão. O script de prints entrava como mestre duas vezes, e o Foundry não deixa: agora entra pelo
  usuário "Transmissão", como o README manda.
- **Afogar agarra, não fere** (p. 33). Ataque de NPC ganha efeito "Agarra", com dano por rodada e passos para se
  soltar, editáveis na ficha. O acerto oferece "Agarrar" no lugar do dano (também no revide e na defesa); quem
  está agarrado tem "Soltar-se" (Acrobacia ou Luta contra a Luta de quem segura, com o passo a menos), quem está
  livre tem "Soltar um aliado", e no fim da rodada sai um card com o dano de cada agarrado. A manobra Agarrar
  guarda quem segura. O dano manual continua no card, e a condição se tira à mão.
- **RD do aughisk é 3**, decisão da mesa (o livro não imprime). Mundos com a Missão 1 já importada recebem o
  Afogar novo e a RD 3 ao abrir; o que o mestre já editou fica.
- **Perseguição e furtividade pelo palco.** O menu da figura traz Avançar, Recuperar fôlego, Sacrifício, Avisar
  da vala, o teste de esconderijo e as ações da área; embaixo do nome, os pontos de avanço e o fôlego, ou os dados
  de esconderijo. Antes, fora do combate, o menu só levava ao painel.
- **Rolagem por cima, na transmissão.** Os dados saem na forma de cada um, com o valor dentro, a RA em vermelho e a
  RB em azul (com a etiqueta embaixo), o total e o desfecho, na faixa de baixo do card: nome, PV e PD seguem à
  vista, e o card não muda de tamanho. O número sai em fonte de corpo (na versalete do Vigília, 11 virava "II"). A faixa da rodada passa a ficar no canto de cima à direita por padrão. **Contornos para
  montar o overlay**: tracejado no card, na área da rolagem e na faixa da cena, ligado na configuração ou por
  `&op2-guias` na URL.
- **Efeitos de mesa**: coração e borda escura no dado de pavor, sino e brilho no crítico, tremor na falha
  crítica, baque e pisca no dano, tambor ao iniciar a cena, gongo e faixa a cada fase. Som sintetizado (Web
  Audio, sem arquivo). Liga, desliga e volume por pessoa; respeita "menos movimento" do sistema.
- **Pastas do Vigília em verde**, para não se confundirem com as vermelhas dos Atos no mesmo mundo. A cor vale na importação (também de uma aventura guardada antes) e, ao abrir o mundo, nas pastas das Missões já importadas.
- **Retratos cortados pelo topo** na ficha e no painel: antes o corte era no meio e sobrava o tronco.
- **PDF gratuito do beta** conferido: monta a Missão 1 igual à do completo e diz que a 2 é só de assinantes.

**Corrigido:** importar a segunda missão levava os pré-gerados da primeira (os mesmos ids): cada missão traz agora
a sua cópia. Os botões do card de teste (Dano RA, Dano RB, Preencher Ímpeto, Rolar Falha Crítica) saíam sem o id do
ator e o clique avisava "ator ausente".

**Mudança no modo moderno:** o combate novo vale também lá e vem **ligado por padrão**, inclusive em mundo que já
existe. Para voltar ao combate simplificado do alpha, desligue *Combate novo no modo moderno* nos settings do mundo.

## [0.9.7] — 2026-10-03

Retorno de uma mesa que jogou o Ato I:

- **Linha do quadro com perícia alternativa** ("Pesquisar ou Tecnologia", o Computador):
  campo próprio na ficha do ponto, e Examinar acha a linha com qualquer uma das duas. Antes
  a segunda perícia ficava só no texto, e um 10 em Tecnologia saía como falha e cobrava o
  PD. As aventuras montadas do PDF já preenchem o campo.
- **O hack não fica preso para sempre.** O gate "só na rodada seguinte" (spec §7.3) conta
  pela rodada da investigação: com o contador parado, a primeira tentativa trancava o
  dispositivo para a mesa inteira, e "já tentou nesta rodada" não dizia como sair. Agora o
  aviso aponta as saídas, o botão do hack avisa "nesta rodada" antes do clique, a ficha do
  desafio tem *Liberar tentativa*, o mestre que clica pode "tentar mesmo assim", e
  encerrar a investigação zera o gate junto com a rodada.
- **Ferramentas da Ordo Realitas como revelação.** A leitura de uma ferramenta num ponto
  fica com o personagem e aparece no painel dele (com reação ou leitura normal), com quem
  leu e o limpar no painel do mestre; o botão marca o que já foi lido ali. A instrução de
  mesa que o livro imprime junto ("envie o handout", a condição, a solução do rádio) vai
  só ao mestre. Leitura condicionada ("apenas se o Ídolo for quebrado") entra em rascunho
  — leitura normal até o mestre liberar. O Medidor EMF toca o áudio na tela do jogador (ou, se ele quiser, na mesa inteira); a
  Câmera entrega a foto e a descrição; o Laboratório usa a sequência mínima do ponto sem
  perguntar ao jogador. O setting *Revelação pelo mestre* vale para as ferramentas.
- "Mostre o handout: X" no texto da linha do quadro vira "(handout: X)" para o jogador;
  a imagem segue na nota do mestre.
- A sexta linha do Computador do Ato I ("Intuição 6", com a contagem de jogadores) ia
  para as notas do mestre: o leitor do quadro tomava três linhas em branco por fim da
  tabela. 88 linhas no Ato I.
- "Caso contrário, sem reação." no Termômetro do Ídolo é do mestre, não da leitura.
- Linha do quadro que começa com "(Requer …)" (o Computador, nos dois atos) nasce em
  rascunho: é condição, e Examinar a entregava antes do hack social.
- **Setor de ferramentas na ficha do ponto em editor rico.** A leitura de cada ferramenta
  é HTML (o laser e a câmera trazem o handout; o EMF, o link da playlist) e estava num
  textarea: no Ato II, todas as 44 leituras apareciam com as tags cruas. A imagem fica
  numa altura fixa na ficha; o card de chat segue mostrando inteira.
- **Revelação pelo mestre** (setting de mundo, desligado por padrão): Examinar não entrega
  a pista direto ao jogador — o card vai só ao mestre, com *Entregar ao jogador*; o jogador
  vê a rolagem e um aviso. Para quem quer narrar antes.
- Rolagem sem a opção `rollMode` no `toMessage`: o core aplica o modo do usuário nas duas
  versões, e no v14 a opção estava depreciada (aviso a cada rolagem).
- A release no GitHub traz como corpo a seção da versão no CHANGELOG e a linha de
  instalação (antes era o assunto do commit da tag). As releases antigas foram reescritas.

## [0.9.6] — 2026-09-07

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
