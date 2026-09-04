# Mudanças

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versões seguem [SemVer](https://semver.org/lang/pt-BR/).

## [Não publicado]

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
- **Eventos com roteiro próprio.** Item `evento` com gatilho e rodadas contadas a
  partir dele: disparar é ato de mesa, no painel.
- **Marcadores no mapa.** O ponto vira nota da cena com o ícone dele; nasce só do
  mestre e acende para a mesa quando o ponto deixa de estar oculto.
- **Identidade visual dos perfis.** Analista, Executor e Vigilante pintam a ficha
  inteira e as janelas abertas a partir dela.
- **Compêndios.** Habilidades, ocupações e ferramentas; pré-gerados, cenas, handouts
  e trilha dos atos I e II.

### Notas

- As aventuras dos atos I e II **não vêm no pacote publicado**: o texto é da editora.
  Quem tem o PDF do playtest gera os compêndios localmente (`npm run ato-i:extrair &&
  npm run ato-i:gerar-aventura`, o mesmo para `ato-ii`).
- Sistema não-oficial, feito por fã, sem afiliação com os detentores dos direitos de
  Ordem Paranormal RPG.
