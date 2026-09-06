# Arquitetura

## Princípio

**A lógica de regra mora em módulos puros.** `dice/escada.mjs` e `dice/analise.mjs` não
importam nada do Foundry — recebem dados simples, devolvem dados simples. Tudo que toca
a API do Foundry é casca fina em volta deles.

Isso não é cerimônia: são as regras mais sutis do playtest (RA/RB, precedência do
crítico, dados descartados) e precisam ser testáveis sem subir um servidor.

```
config.mjs                 constantes das regras (perícias, tabelas, tetos)
  ↑
dice/escada.mjs            stepDie, faces — puro
dice/analise.mjs           RA, RB, crítico, desfecho — puro
  ↑
dice/op2-roll.mjs          ponte com Roll do core
dice/teste.mjs             orquestra: diálogo → roll → seleção → chat
  ↑
sheets/ · dialogs · chat   apresentação
```

## Mapa de arquivos

| Pasta | Papel |
|---|---|
| `module/config.mjs` | Constantes das regras. Nenhuma outra parte inventa número. |
| `module/data/` | `TypeDataModel` por tipo de documento. `campos.mjs` tem os construtores compartilhados. |
| `module/dice/` | Escada, análise, `OP2Roll`, diálogo de teste, seleção de dados, falha crítica. |
| `module/sheets/` | Fichas de ator e item. |
| `module/ui/` | Ícones de dado, helpers de Handlebars, listeners de chat, socket. `zip.mjs` (leitor de zip puro) e `extras-aventura.mjs` (o importador que pede o zip da editora, sobe para a pasta do mundo e reescreve os caminhos). |
| `module/cena/` | Cena: investigação ativa, painel, rodadas (sobrecarga e roteiro por rodada), ações de investigação/desafio/ferramenta/combate/ajuda, os três apps de minigame (Destrancar, Laboratório, Rádio), Ímpeto, ferimentos e queda. Regras puras em `investigacao.mjs`, `desafios.mjs`, `combate.mjs`, `ajuda.mjs`, `ferimentos.mjs`. |
| `module/settings/` | Registro dos settings. Um por lacuna do playtest. |
| `module/tests/` | `node --test`, sem runner externo. |
| `templates/partials/` | Peças reutilizadas: controle de dado, linha de perícia, trilha de recurso. |
| `scripts/build-packs.mjs` | Compila `packs/sources/` em LevelDB direto (o `fvtt package pack` devolvia banco vazio com documento embutido). |
| `module/extrator/` | O PDF do playtest vira texto (`grade.mjs` emula o `pdftotext -layout` em cima do pdf.js do Foundry) e o texto vira dados (`ato-i.mjs`, `ato-ii.mjs`). Roda no navegador e no Node; toda régua está comentada com o caso medido que a decidiu. |
| `module/aventura/` | Do texto extraído ao `Adventure` (`ato-i.mjs`, `ato-ii.mjs`, `comum.mjs`), a janela que pede o PDF (`aventuras-app.mjs`), a leitura do PDF pelo pdf.js (`pdf.mjs`) e o compêndio do mundo (`mundo.mjs`). |
| `scripts/extrator/rodar.mjs` | Roda o extrator num PDF pelo Node e compara com um gabarito — a ferramenta de revisão (`.claude/skills/revisar-extrator/`). |
| `scripts/aventura/` | `fontes.mjs` lê de `packs/sources/` o que cada ato precisa dos compêndios (pré-gerados, cena, handouts, trilha, agentes, ferramentas); `gerar-fontes.mjs` grava isso em `assets/aventura/fontes-ato-*.json` no `pack:build`, com a cena no formato v14 (`levels`) — `Adventure.create` no cliente não migra o v13, e a cena chegava sem mapa. Os packs LevelDB ficam no v13: o servidor migra, e ignora `levels` inline. |
| `scripts/ato-i/` | `gerar-aventura.mjs` monta o `Adventure` no Node, para o e2e; `extrair-aventura.py` é o extrator Python original, mantido como oráculo do gabarito; `importar-cena.mjs` traz a cena murada do mundo; `copiar-assets.mjs` recopia as artes. |
| `scripts/ato-ii/` | `gerar-aventura.mjs` monta o `Adventure` com `flags.extras` no Node; `extrair-aventura.py` é o oráculo Python; `gerar-cena.mjs` transporta as paredes do Ato I. `README.md` explica o pipeline. |
| `scripts/reparar-pastas-compendio.mjs` | Refaz as pastas de compêndio de um mundo que as perdeu (o Foundry só as materializa quando a lista de packs muda). |
| `assets/ato-i/` | As artes do Ato I que os compêndios referenciam. As do Ato II não existem aqui: o compêndio aponta para `assets/ato-ii/` e o importador troca pela pasta do mundo. |
| `assets/aventura/` | Os `fontes-ato-*.json` que a janela de aventuras busca com `fetch`. Gerados no `pack:build`, fora do git. |

## Decisões que valem repetir

**A aventura nasce no navegador, do PDF do mestre.** O texto do livro não pode viajar no
pacote (Licença da Comunidade), e cifrar o conteúdo com uma chave tirada do PDF não
escalava: cada revisão do PDF (a 1.1 saiu em setembro de 2026) pediria uma chave nova
e uma versão nova do sistema. Então o pacote leva o **extrator**, não o texto:
`module/extrator/grade.mjs` transforma o que o pdf.js entrega em linhas de texto em
colunas (o mesmo formato do `pdftotext -layout`, que foi o oráculo do extrator Python
original), `ato-i.mjs`/`ato-ii.mjs` leem quadros, caixas e roteiro, e
`module/aventura/ato-*.mjs` monta o `Adventure` juntando isso aos documentos dos
compêndios (`assets/aventura/fontes-ato-*.json`). A aventura vai para um compêndio DO
MUNDO (`world.op2-aventuras`) e é importada dali, pelo fluxo do core — a ficha, os
avisos de sobrescrita e o pedido do zip do Ato II continuam valendo. O mesmo código
roda no Node (`scripts/extrator/rodar.mjs`, `scripts/ato-*/gerar-aventura.mjs`) para o
e2e e para conferir uma revisão nova do PDF contra a anterior.

**Sem `template.json`.** Todo esquema é `TypeDataModel`, com validação e migração de
verdade.

**Sem Active Effects.** O modo aditivo do core não representa "aumente um passo". Os
passos vêm de `stepMod` e de contadores, resolvidos em `prepareDerivedData()`. Efeito
colateral bem-vindo: a maior quebra entre v13 e v14 foi justamente o formato dos Active
Effects, e nós passamos ao largo dela.

**`reducoesTemporarias` é contador, não efeito com duração.** As reduções de falha
crítica valem "até o fim da cena", e cena não é unidade de tempo — não dá para expressar
em rodadas. Zeram no evento explícito de encerrar cena.

**`aptidoes` é coleção dinâmica.** O texto fala em "conhecimento em um campo específico";
seis campos fixos seriam uma leitura estreita demais.

**O tamanho do dado é um valor de primeira classe.** `pericia.valor` (4, 6, 8, 10, 12) é
comparado direto contra a DT nas cenas de investigação, sem rolagem. Por isso `faces()`
existe como função exportada, não como detalhe interno.

**Nada é aplicado sem confirmação.** Dano, reduções e efeitos de falha crítica sempre
passam por um botão. O playtest é explícito sobre isso na tabela de falha crítica, e a
regra vale para o resto.

**Revelação de investigação mora no actor, não na cena.** `estado.infosReveladas` é um
conjunto de `"<uuid do POI>:<id da info>"`. Como o jogador é dono do próprio actor, ele
grava as próprias descobertas sem socket nem delegação ao mestre — e o painel de cada um
mostra só o que o seu personagem descobriu. Zera ao encerrar a cena.

**Travas de 1×-por-cena passam pelo mestre.** Recapitular e Compartilhar exigem que o
mestre julgue a interpretação (spec §6.4/§6.5), então quem registra a trava é um botão
`data-op2-gm` no card de sucesso — nunca o cliente do jogador. As travas são flags da
cena, escritas só pelo GM.

**Sem Combat do core para rodadas.** O tracker diverge entre v13 (AppV1) e v14 (AppV2);
o painel de investigação implementa a ordem arrastável e o avanço de rodada que dispara
a sobrecarga mental (spec §7.6). A ordem é uma lista só, com personagens e NPCs
misturados: separar os NPCs num grupo próprio (spec §5.2 sugere que ajam por último)
deixava a linha deles imóvel na prática — com um NPC só, as duas setinhas nasciam
desabilitadas. Quem age quando é decisão de mesa; o sistema guarda a ordem que a mesa
montou.

**`dragDrop` em `DEFAULT_OPTIONS` é opção do ApplicationV1.** O ApplicationV2 ignora, e
o painel ficou meses com `draggable="true"` no HTML e nenhum handler ligado. O caminho
do V2 é o das fichas do core: um getter `_dragDrop` que constrói
`DragDrop.implementation` com os callbacks da própria classe, religado em `_onRender`.

**Escrita de jogador em documento de mundo passa pelo mestre.** POI e Desafio são Items
de mundo: um jogador que arromba, hackeia ou dispara uma revelação não tem permissão de
atualizá-los (`User lacks permission to update Item`, achado em uso real). `module/ui/socket.mjs`
registra ações nomeadas de mestre e as executa **só** no `game.users.activeGM` — um GM
designado, para não aplicar duas vezes com dois mestres online. O jogador chama
`comoMestre("atualizarDesafio", …)` e o resultado volta pelo próprio documento.

**Três estados por linha do quadro, não dois.** `oculta` (rascunho do mestre: invisível e
não descobrível), `aberta` (o jogador vê sem gastar ação) e o padrão — descobrível, que é
o único estado que Examinar encontra. Com só `oculta`/visível não existia o estado do
meio, e nada ficava procurável: ou a linha estava trancada até para o Examinar, ou já
aparecia pronta na tela do jogador (achado em uso real).

**Não existe ação "Investigar".** Investigar um ponto é Examinar ou Interagir (spec §6.3
resolve a ação nas duas sub-ações). `examinar()` faz os dois passos com a mesma perícia:
entrega de graça o que o tamanho do dado alcança e rola pelo resto. Só custa 1 PD quando
os dois vêm vazios.

**Investigação é Actor, não flag de Scene.** A primeira versão (Fase 2) guardava rodada,
sobrecarga, POIs vinculados e as travas de Recapitular/Compartilhar em flags da Scene
ativa — e quebrava assim que uma investigação de verdade atravessava mais de um mapa
(achado em uso real: o time se move entre cômodos, mas continua na mesma investigação).
`investigacao` é um tipo de Actor com ficha própria (`InvestigacaoData`,
`module/data/actor-investigacao.mjs`), sem nenhuma referência a `canvas.scene` em
código nenhum do sistema. POI e Desafio continuam Item — são conteúdo
autoral, reutilizável — mas o vínculo "este POI está nesta investigação" é um campo de
schema na investigação (`system.pois`), não uma flag de Scene. O mestre troca pelo
seletor do painel ou abrindo a ficha da investigação direto pela sidebar de Actors.

**Painel e ficha da investigação são uma tela só, com duas portas.** A ficha era uma
coluna de listas por nome e o painel a tela de jogo (achado em uso real: "não rola
colocar essa mesma tela no cadastro?"). `module/cena/painel-comum.mjs` é um mixin com
tudo que os dois compartilham — contexto, ações de gestão, abas, arrastar-e-soltar,
preferências de tela, o roteiro como texto — e os templates são dois partials
(`templates/cena/partials/investigacao-lateral.hbs` e `investigacao-abas.hbs`). Cada
porta só responde `get investigacao()`: o painel devolve a ativa deste usuário e
mantém o seletor; a ficha devolve o próprio documento e edita nome, imagem e notas.
Por isso avançar rodada, encerrar cena e o roster recebem a investigação como
parâmetro (a ativa é só o padrão): a ficha de uma investigação que não é a ativa age
sobre ela mesma. Toda janela aberta se registra em `janelasDeInvestigacao` e é
rerrenderizada quando um ponto, desafio ou ator muda.

**Evento tem roteiro próprio, contado a partir do gatilho.** O livro não conta as
rodadas da maldição do começo da cena: elas começam quando o grupo observa o Ídolo de
Pedra (achado em uso real). Por isso o roteiro saiu de `InvestigacaoData.eventos` (que
era uma lista de rodadas absolutas) e virou o Item `evento`
(`module/data/item-evento.mjs`): gatilho, descrição e rodadas **relativas**, com
`disparado` e `rodadaInicial`. A investigação só guarda os uuids; `migrateData` limpa o
formato velho, e o roteiro volta ao reimportar a aventura. As regras puras estão em
`module/cena/eventos.mjs` (`rodadaRelativa`, `linhaDaRodada`, `proximaRodadaDaCena`), e
`avancarRodada()` junta no card o que cada evento disparado tiver para aquela rodada.
Disparar é ato de mesa: o mestre aperta no painel, e a rodada de agora vira a rodada 0.

**Um desafio pode pertencer a um ponto.** `PontoInteresseData.desafios` lista uuids de
Desafio de acesso; o vínculo se faz arrastando o desafio para a ficha do ponto. Vincular o
ponto a uma investigação (`vincularPoi`) traz os desafios dele; o painel mostra o desafio
dentro do card do ponto e o ponto no card do desafio (`pontoDoDesafio`); a janela de
ações põe os botões do desafio dentro do ponto e deixa na seção própria só os soltos.
Os geradores dos atos ligam cada desafio ao ponto de onde o livro o tirou.

**"Em jogo" (mundo) é diferente de "vendo agora" (cliente).** O grupo pode se dividir
em mais de uma investigação ao mesmo tempo (achado em uso real) — por isso não existe
mais um único ponteiro de investigação ativa. `investigacoesAtivasUuids` é setting de
**mundo** (`config: false`, não é escolha de regra): quais investigações o mestre
marcou como em jogo, controlando o que aparece pro navegador dos jogadores.
`investigacaoVisualizandoUuid` é setting de **cliente**: qual delas *este usuário*
está vendo agora no painel — cada jogador navega só entre as em-jogo onde o
personagem dele participa (`investigacoesVisiveis()`), o mestre entre todas
(`todasInvestigacoes()`, sem precisar que já estejam em jogo — é como ele prepara
antes de revelar). `criarInvestigacao()` já marca a nova como em jogo e já seleciona
para quem criou, então quem só usa uma investigação não percebe diferença nenhuma.

## Compatibilidade v13 + v14

Caminhos de API usados, válidos nas duas versões:

- `foundry.applications.api.ApplicationV2` e `HandlebarsApplicationMixin`
- `foundry.applications.sheets.ActorSheetV2` / `ItemSheetV2`
- `foundry.documents.collections.Actors` / `Items`
- `foundry.appv1.sheets.ActorSheet` (só para `unregisterSheet`)
- `foundry.abstract.TypeDataModel`, `foundry.data.fields.*`

Onde a v13 moveu algo, o acesso usa fallback explícito — veja `renderizar()` em
`dice/teste.mjs` e `enriquecer()` nas fichas.

`<details data-sync>` é ignorado no v13 e preserva estado no v14: usar sempre.

CSS fica em `@layer system` e nunca depende de estilo do core.

**O core arredonda todo `button` e deixa a janela translúcida.** Duas armadilhas que já
custaram tempo: um botão pequeno nosso (o traço de PV, o espaço de ímpeto) vira um oval
se não zerar `border-radius`, e a janela nasce com `rgba(...,.9)` mais
`backdrop-filter: blur(4px)`, o que empilha duas telas legíveis pela metade. Toda janela
do sistema fixa fundo opaco, borda vermelha escura e `backdrop-filter: none`
(`styles/parciais/_base.scss`).
