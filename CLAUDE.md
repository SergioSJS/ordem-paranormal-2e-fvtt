# Ordem Paranormal 2 — Sistema Foundry VTT

> Memória do projeto. Só ponteiros e convenções — o conteúdo vive em `docs/`.

## Leitura antes de trabalhar

1. `docs/op2-playtest-spec-foundry.md` — **a fonte da verdade das regras.** Toda decisão
   mecânica cita uma seção dela (`spec §4.2`).
2. `docs/ROADMAP.md` — fase ativa e critério de pronto.
3. `docs/ARQUITETURA.md` — antes de criar arquivo novo.
4. `docs/LACUNAS.md` — antes de implementar regra ambígua.
5. `docs/ESTILO-VISUAL.md` — antes de mexer em CSS ou template.

O PDF do playtest fica em `docs/` mas **não é commitado** (`.gitignore`). Ele é a fonte
da spec e das amostras visuais; extraia dele em vez de adivinhar.

## Estado

**Fases 1 a 4 fechadas; compêndios fechados; os dois atos montados do PDF do mestre.**
O texto do livro não entra no pacote (Licença da Comunidade): o sistema leva o
**extrator** (`module/extrator/`) e a janela *Aventuras do playtest*
(`module/aventura/`) lê o PDF do mestre no navegador, monta cada ato como um único
`Adventure` e guarda no compêndio do mundo `world.op2-aventuras`. Ato I (`Ato I — O
Porão`): cena murada, trilha, pré-gerados, handouts, 31 pontos com 87 linhas de quadro,
10 desafios, itens de mesa, roteiro e maldição rodada a rodada. Ato II (`Ato II — O
Porão`, só do PDF completo): cena com as paredes transportadas, os cinco agentes,
handouts e Compêndio em PDF, áudios EMF, as dez ferramentas, 25 pontos com 63 linhas e
o setor de ferramentas (44 leituras), 3 desafios, roteiro, mecânicas de mestre e a
maldição como evento parado (o gatilho ali é quebrar o Ídolo, p. 87). O extrator é
byte-idêntico ao gabarito Python na revisão 1 do PDF e lê a 1.1 e o gratuito —
`.claude/skills/revisar-extrator/` é o roteiro para a próxima revisão. **Nenhuma arte do
livro entra no sistema:** cada aventura declara em `flags.extras` o que espera do zip
da editora (o gratuito do Ato I, o de assinante do Ato II) e o importador
(`module/ui/extras-aventura.mjs`) pede o zip e sobe para `worlds/<mundo>/ato-*/`. Os
únicos compêndios embarcados são os de regras (habilidades, ocupações, ferramentas);
pré-gerados, cena, handouts e trilha vão em `assets/aventura/fontes-ato-*.json`, para
dentro da aventura. O selo da licença (`assets/licenca/`) é o único arquivo da editora
no pacote. Pronto para a rodada de teste manual que fecha a v1.
**Versão:** 0.0.1 (a v1 é decisão de release).
**Próximo:** o que o playtest ainda não publicou (NEX, progressão, traumas
permanentes). **v13 e v14 exercitados pelo e2e** (13.351: 532 verificações; 14.363:
570) — o bundle da cena leva os dois formatos de fundo, e o que só existe no v14 (níveis,
`Collection#every`, `Note.author`) é tratado com guarda dos dois lados.

## Convenções

- **Identificadores em pt-BR**: tipos, chaves, funções (`personagem`, `pericias`, `stepDie`
  é exceção por ser termo técnico consolidado). Comentários e docs em pt-BR.
- **Sem `template.json`** — sempre `TypeDataModel`.
- **Sem Active Effects** — a escada de dados não é aditiva. Passos vão para `stepMod` e
  são resolvidos em `prepareDerivedData()`. É também o que mantém v13 e v14 compatíveis.
- **ApplicationV2 / DocumentSheetV2** em tudo. Nada de AppV1.
- Prefixo CSS `.op2-*`, variáveis `--op2-*`, tudo dentro de `@layer system`.
- i18n namespace `OP2.*`. `lang/pt-BR.json` é primário, `lang/en.json` espelha — o teste
  `module/tests/i18n.test.mjs` falha se divergirem.
- **O jogo é em pt-BR.** `aplicarIdiomaPadrao()` em `module/op2.mjs` põe pt-BR para quem
  nunca escolheu idioma. Ele grava a chave `core.language` no `localStorage` em vez de
  mexer no default do setting: o core só registra `core.language` *depois* do hook
  `init` e resolve o idioma logo em seguida, sem hook no meio. A interface do próprio
  Foundry só fica em português com o módulo `pt-BR`, que o manifesto recomenda.
- **Não existe ação "Investigar".** Investigar um ponto é Examinar ou Interagir (spec
  §6.3). `examinar()` faz os dois passos: entrega de graça o que o tamanho do dado
  alcança e rola pelo resto; só custa 1 PD quando os dois vêm vazios.
- **Três estados por linha do quadro:** rascunho (`oculta`), descobrível (padrão, o
  único que Examinar acha) e aberta (`aberta`, o jogador vê sem gastar ação). A pista é
  de quem achou (revelação por personagem); **contar ao grupo** (`contadaPor`) é o
  jogador tornando a dele visível para a mesa — vale como aberta, com o nome dele. Não
  é a ação Compartilhar (spec §6.5), que é o teste do aliado por uma pista nova.
- **Marcador no mapa é nota sem diário: mexe em três coisas do core.** O ponto vira
  `Note` da cena (`module/cena/marcadores.mjs`). (1) O core esconde do jogador toda nota
  sem diário cujo autor seja mestre — por isso ela nasce com `author: null`. (2) Quem
  decide a visão é o nosso `isVisible`: acende quando o ponto não está oculto na
  investigação. (3) `Note#_canView` devolve `false` sem diário, e aí o gerente de mouse
  **nem chama o duplo clique** — sem sobrescrever isso, o marcador fica inerte no mapa.
- **Jogador não escreve em documento de mundo.** POI e Desafio são Items de mundo:
  passe por `comoMestre()` (`module/ui/socket.mjs`), que executa no `activeGM`.
- **`dragDrop` em `DEFAULT_OPTIONS` é do AppV1** e o AppV2 ignora em silêncio. No V2,
  construa `DragDrop.implementation` num getter `_dragDrop` e religue em `_onRender`.
- **`OP2Roll` entra em `CONFIG.Dice.rolls` com `push`, nunca `unshift`.** O primeiro da
  lista é a classe padrão de TODA rolagem do jogo (`/r 1d8`, módulos de dados); com o
  OP2Roll na frente, uma rolagem comum era renderizada pelo template do teste e saía
  vazia no chat.
- **Card com rolagem própria (Examinar, sobrecarga) mostra a falha crítica.** O partial
  `partials/falha-critica.hbs` leva o desfecho e o botão do mestre; `chat/dano.hbs` é o
  card de dano avulso. Nunca `roll.toMessage()` cru: o card do core não diz o que é.
- **Evento com roteiro conta as rodadas a partir do gatilho.** A maldição do Ato I não
  começa na rodada 0 da cena: começa quando o grupo acha o Ídolo. O roteiro é o Item
  `evento` (rodadas relativas + `rodadaInicial`), vinculado à investigação; disparar é
  ato de mestre, no painel.
- **O sistema fala pelo socket, e o manifesto precisa declarar isso.** Sem
  `"socket": true` no `system.json`, o servidor não relaia `system.<id>` e tudo que
  passa por `comoMestre()`/`paraTodos()` some — só que o mestre executa direto, então
  o bug só aparece com dois clientes.
- **Card só do mestre nasce no cliente do mestre.** Sussurro criado pelo jogador tem o
  jogador como autor, e o Foundry mostra toda mensagem ao próprio autor — o "só você vê"
  do Interagir apareceu para o jogador. Bastidor (contextual, perguntas do hack social,
  senha) vai por `enviarCardAoMestre()` (`module/ui/card-mestre.mjs`), pela ponte
  `comoMestre()`; `data-op2-gm` só esconde do DOM, não é segredo.
- **O core arredonda `button` e deixa a janela translúcida.** Botão pequeno nosso pede
  `border-radius: 0`; janela do sistema fixa fundo opaco e `backdrop-filter: none`.
- **O texto do livro não entra no pacote, nunca.** Nem em compêndio, nem cifrado. O que
  o sistema embarca é o extrator; o texto vem do PDF do mestre, na hora. Os scripts de
  `scripts/ato-*` e `scripts/extrator/` escrevem em `build/` e em
  `packs/sources/ato-*-aventura/`, que o `.gitignore` mantém fora — e o release tira
  do manifesto os packs sem banco.
- **Documento embutido preso a nível que a cena não tem some do mapa.** No v14 parede,
  luz, som, nota e token levam `levels: [id]`; a cena capturada do mundo de alguém vem
  com o id do nível DELE (`defaultLevel0000`), e a cena montada do pacote cria o nível
  com outro id — 36 das 39 paredes do Porão ficaram invisíveis. `comNivel()`
  (`scripts/aventura/fontes.mjs`) religa tudo ao nível que cria, e `importar-cena.mjs`
  nem grava `levels`. O e2e confere as paredes desenhadas no canvas, não só contadas.
- **O `system.json` do repositório não tem `manifest` nem `download`.** O release
  (`release.yml`) injeta os dois no manifesto publicado. Com eles no repo, o Foundry
  oferecia "Update" para a cópia symlinkada e extraía o zip da release POR CIMA da
  pasta de desenvolvimento (aconteceu: `system.json` reescrito pelo setup do v13).
  Nunca clique em "Update" num sistema symlinkado; nunca instale pelo `POST /setup`
  com o symlink no lugar.
- Commits: Conventional Commits, em português.
- Nunca commitar direto na `main` — sempre feature branch.

## Rodando local

```bash
npm install
npm run setup        # symlink -> ~/Library/Application Support/FoundryVTT/Data/systems/
npm run watch:css    # sass em watch
npm run check        # lint + testes + build do CSS — rode antes de commitar
npm run pack:build   # compila os compêndios de packs/sources/ (não versionados: rode depois de clonar)
npm run ato-i:gerar-cena  # deriva as paredes do Porão comparando os três mapas
npm run ato-i:cena   # traz a cena do seu mundo de volta para packs/sources/
node scripts/extrator/rodar.mjs <pdf> [gabarito] --texto --completo  # extrai os dois atos para build/js/
npm run ato-i:gerar-aventura && npm run ato-ii:gerar-aventura   # os Adventures locais, para o e2e
npm run posicoes -- --ato ato-i --mundo op2-meu   # marcadores e tokens de uma cena do mundo → posicoes.json
npm run ato-ii:cena -- --mundo op2-meu   # paredes, luzes, sons da cena do Ato II de volta para packs/sources/
npm run ato-ii:gerar-cena   # ou: paredes, luzes, grade, escuridão e marcadores do Ato I → cena do Ato II
npm run reparar-pastas -- <mundo>   # refaz as pastas de compêndio de um mundo
```

No Foundry: **Configurações → Configurar Aplicação → Hot Reload**. Com isso, `F5`
recarrega CSS e templates sem reiniciar o servidor. Mudança em `.mjs` exige `F5` também.

### Preview da ficha sem o Foundry

```bash
npm run preview        # gera preview.html
open preview.html
```

`scripts/preview.mjs` instancia a ficha **de verdade** com os stubs de teste, então o
contexto vem do mesmo `_prepareContext` que roda no jogo. Serve para iterar em CSS e
layout depressa. **Não** reproduz o chrome da janela, o sistema de abas do core nem o
tema do usuário — não dá nada por validado só porque o preview está bonito.

### Testar nas duas versões

O sistema declara `minimum: 13, verified: 14`. Toda mudança que toca API do Foundry
precisa passar nas duas.

- **v14** — `/Applications/Foundry Virtual Tabletop-14.app`, User Data em
  `~/Library/Application Support/FoundryVTT`.
- **v13** — `/Applications/Foundry Virtual Tabletop-13.app` (entrada `main.js`), User Data
  próprio. Para o e2e, `scripts/e2e/README.md` (porta 30013, `/tmp/fvtt-e2e-v13`). Para
  desenvolver nele, instale pelo manifesto da release em vez de symlinkar: dois Foundry
  no mesmo `packs/` disputam o LevelDB.
- O que quebrou no v13 e agora tem teste: `Playlist.fade` precisa ser positivo, a cena
  lê o fundo por `background` (não `levels`), `Collection` não tem `every`, `Note` não
  tem `author`, packs compilados por um v14 não abrem ("core version newer").

**Nunca abra o mesmo mundo nas duas versões.** A migração do v14 é irreversível: um mundo
aberto no v14 não volta para o v13. Mantenha mundos de teste separados.

O servidor do Foundry v14 exige **Node 24**. O `npm test` do projeto roda em Node 22+.

## Testes

### Offline — `npm test`

`node --test`, sem runner externo:

- `escada.test.mjs` — piso, teto, d20, passos compostos.
- `analise.test.mjs` — RA/RB, crítico, falha crítica, precedência sobre a DT.
- `investigacao.test.mjs` — as duas leituras da coluna DT, custo de PD, sobrecarga.
- `desafios.test.mjs` — Arrombar, dano de Alcançar, Destrancar (avaliação de palpite).
- `ferramentas.test.mjs` — escada do Laboratório Portátil, tabela do Rádio Modificado.
- `ferimentos.test.mjs` — escada de DT 7/10/13/16, quando o teste é devido, passos de Ajuda.
- `combate.test.mjs` — teste oposto, dano RA/RB, esquiva que anula, empate.
- `i18n.test.mjs` — paridade pt-BR/en e chave inexistente usada no código.
- `carga.test.mjs` — todo módulo importa, todo template compila, manifesto consistente.
- `extrator.test.mjs` — a grade (linhas, colunas, vazias) e `lerTabela` nos casos que
  mais quebram: DT com alternativa, rótulo compartilhado, número de página.
- `aventura.test.mjs` — `montarAtoI`/`montarAtoII` com um ato sintético: vínculos,
  pastas, ids estáveis, handouts das duas revisões.
- `npc.test.mjs` — a perícia do NPC a partir do diálogo: chave do sistema, Aptidão sem
  ponto na chave, "Outra" em slug.

### Dentro do Foundry — `npm run e2e`

Sobe o sistema num Foundry de verdade e confere o que os testes offline não alcançam:
sanitização do conteúdo de chat, contexto real das fichas, hooks depreciados, CSS
aplicado e texto cortado. Precisa de Node 24 e de um Foundry descartável rodando —
o passo a passo está em `scripts/e2e/README.md`.

**Um Foundry por vez.** O e2e symlinka este repositório, então ele e o seu Foundry
abrem os mesmos bancos de `packs/`. LevelDB aceita um processo só: com o e2e no ar, o
seu app sobe o mundo **sem compêndio algum**, e sem erro nenhum na tela. `pkill -f
"port=30099"` antes de abrir o app; `lsof packs/*/LOCK` confirma que soltou.

Rode antes de fechar qualquer fase. Foi ele que pegou o sanitizador removendo `<svg>`
dos cards de chat e o `{{actor.name}}` vazio na ficha.

### Prints do README — `node scripts/e2e/capturar.mjs`

Monta um mundo de demonstração no mesmo Foundry descartável e fotografa as telas em
`docs/img/`. Nenhuma imagem do README é mockup; se a interface mudar, rode de novo.

**Regra:** mexeu em ficha, painel, janela de ações, card de chat ou qualquer tela que o
README mostra? Rode `capturar.mjs` e commite os prints junto com a mudança. README com
print velho mente sobre o sistema — e é a primeira coisa que alguém vê.

`module/tests/stub-foundry.mjs` tem stubs mínimos da API — o suficiente para carregar os
módulos fora do Foundry. Não simula comportamento: lógica de regra fica em módulos puros
(`dice/escada.mjs`, `dice/analise.mjs`) justamente para ser testável de verdade.

## Agentes

`.claude/agents/` tem briefings especializados. `.claude/commands/` tem `/feature`,
`/verify`, `/handoff` e `/rule`.

`AGENTS.md` é a cópia deste arquivo para o Kimi Code — **mantenha os dois em sincronia**.

## Regras em uma tela

Dois dados somados (perícia + atributo), DT padrão 7. Escada d4→d12; tudo é passo, nunca
`+N`. RA/RB = maior/menor valor rolado. Crítico = dois dados iguais ≥ 6, ignora DT. Falha
crítica = todos em 1, ignora DT, rola 1d8 na tabela. Até 4 dados rolados, 3 somados.
Investigação compara o *tamanho* do dado contra a DT, sem rolar; Examinar rola e custa
1 PD se não trouxer informação nova.
