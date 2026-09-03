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

**Fases 1 a 4 fechadas; compêndios fechados; Ato II fechado.** O sistema entrega cada
ato por um único `Adventure`. Ato I (`Ato I — O Porão`): cena murada, trilha,
pré-gerados, handouts, 31 pontos com 86 linhas de quadro, 10 desafios, itens de mesa,
roteiro e maldição rodada a rodada. Ato II (`Ato II — O Porão`): cena com as paredes
transportadas, os cinco agentes, handouts e Compêndio em PDF, áudios EMF, as dez
ferramentas, 25 pontos com 63 linhas e o setor de ferramentas (44 leituras), 3
desafios, roteiro e mecânicas de mestre. **As artes do Ato II não entram no sistema:**
o importador (`module/ui/extras-aventura.mjs`) pede o zip da editora e sobe para
`worlds/<mundo>/ato-ii/`. Pronto para a rodada de teste manual que fecha a v1.
**Versão:** 0.0.1 (a v1 é decisão de release).
**Próximo:** o que o playtest ainda não publicou (NEX, progressão, traumas
permanentes). Validação em v13 **adiada por decisão do projeto** — o sistema declara
`minimum: 13`, mas só o v14 foi exercitado.

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
  único que Examinar acha) e aberta (`aberta`, o jogador vê sem gastar ação).
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
- **O core arredonda `button` e deixa a janela translúcida.** Botão pequeno nosso pede
  `border-radius: 0`; janela do sistema fixa fundo opaco e `backdrop-filter: none`.
- Commits: Conventional Commits, em português.
- Nunca commitar direto na `main` — sempre feature branch.

## Rodando local

```bash
npm install
npm run setup        # symlink -> ~/Library/Application Support/FoundryVTT/Data/systems/
npm run watch:css    # sass em watch
npm run check        # lint + testes + build do CSS — rode antes de commitar
npm run pack:build   # compila os compêndios de packs/sources/
npm run ato-i:assets # recopia as artes do Ato I para assets/ato-i/
npm run ato-i:gerar-cena  # deriva as paredes do Porão comparando os três mapas
npm run ato-i:cena   # traz a cena do seu mundo de volta para packs/sources/
npm run ato-ii:extrair && npm run ato-ii:gerar-aventura   # o Ato II, a partir do PDF
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

- **v14** — instalação em `/Applications`, User Data em `~/Library/Application Support/FoundryVTT`.
- **v13** — instalação separada, User Data próprio:
  ```bash
  FOUNDRY_DATA="$HOME/FoundryV13/Data" npm run setup
  ```

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
