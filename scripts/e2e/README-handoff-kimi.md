# Handoff para Kimi Code — continuação da sessão Fase 3

Repo: `ordem-paranormal-2e-fvtt`, branch `feat/fase-3-desafios-acesso` (não mergeada
em `main`). Leia `AGENTS.md` (raiz) antes de tudo — é a cópia deste projeto do
`CLAUDE.md`, e traz as convenções obrigatórias (pt-BR, sem Active Effects, sem
template.json, ApplicationV2, testes antes de commitar, etc).

## Estado atual (tudo já commitado, `npm run check` passa: lint + 133 testes + build CSS)

Commits mais recentes, nesta ordem:
1. `feat: oculta recursos da investigação, reordena por setinhas e corrige nome duplicado`
2. `feat: investigações múltiplas em jogo, reordenar NPC e ocultar info do quadro`

O usuário pediu, na mensagem mais recente, seis coisas. **Três já foram feitas** e
verificadas ao vivo (Playwright contra Foundry headless real, ver
`scripts/e2e/verificar.mjs`), **três ficaram pendentes** — duas delas com o backend
pronto, faltando só UI, e uma nem começou. Detalhe de cada uma abaixo.

## 1. Feito e verificado (não mexer sem necessidade)

- Mostrar/ocultar POIs, desafios e participantes (jogadores e NPCs) da investigação
  ativa — `module/cena/investigacao-ativa.mjs` (`alternarOculto`), filtrado no
  painel e na ficha da Investigação.
- Setinhas de subir/descer na Ordem das Rodadas (`moverParticipante`,
  `ordemAposMover` — esta última pura, sem Foundry).
- Checkbox de "já agiu" também em NPCs, e restrito a mestre (jogador não é dono do
  Actor da investigação — clicar gerava erro de permissão real, visto em uso).
- Participantes é `<details data-sync="participantes">` recolhível, agora **fechado
  por padrão** (pedido do usuário na 2ª rodada de feedback).
- Nome da investigação não repete mais na tela do jogador.
- Quadro de informações do POI ganhou campo `oculta` por linha (rascunho do mestre,
  nunca revelável por Investigar/Examinar mesmo com DT batida) —
  `module/data/item-ponto-interesse.mjs`, toggle na ficha do POI
  (`templates/item/ponto-interesse.hbs`), filtro em `module/cena/investigacao.mjs`
  (`resolverInvestigacao`/`resolverExaminar`).
- Investigações múltiplas "em jogo" ao mesmo tempo, com navegação por jogador:
  - `module/settings/register.mjs`: `investigacoesAtivasUuids` (mundo, array) +
    `investigacaoVisualizandoUuid` (cliente, string) substituíram o antigo
    `investigacaoAtivaUuid` único.
  - `module/cena/investigacao-ativa.mjs`: `investigacoesAtivas()`, `estaAtiva()`,
    `alternarAtiva()`, `investigacoesVisiveis()` (mestre vê tudo; jogador só as
    "em jogo" onde o personagem dele participa e não está oculto),
    `investigacaoAtiva()` agora resolve por usuário, não por mundo.
  - `criarInvestigacao()` já marca a nova como "em jogo" automaticamente — quem só
    usa uma investigação não percebe diferença nenhuma no fluxo de hoje.
  - Painel (`module/cena/painel-investigacao.mjs` +
    `templates/cena/painel-investigacao.hbs`): mestre tem o seletor de sempre
    ("Visualizando", lista todas) + um checkbox novo "Em jogo" que chama a action
    `alternarAtiva`; jogador agora TAMBÉM tem um `<select>` (antes era só um texto
    fixo) que lista `investigacoesVisiveis()`, com o mesmo listener manual de
    `change` (não usa `data-action` no `<select>` — ver comentário no código sobre
    o dropdown nativo fechando sozinho).

**Isto NÃO foi verificado ao vivo ainda** (não rodei `npm run e2e` /
`node scripts/e2e/verificar.mjs` depois deste lote — só `npm run check`, que não
sobe um Foundry de verdade). Antes de seguir para os itens pendentes, **rode a
verificação e2e primeiro** contra um Foundry headless descartável (passo a passo em
`scripts/e2e/README.md`) e confira principalmente:
- Criar uma investigação ainda deixa o mestre vendo e jogando nela sem precisar
  mexer no checkbox "Em jogo" (regressão que quebraria todo mundo que só usa uma).
- Jogador com personagem atribuído (`game.user.character`) participante de uma
  investigação "em jogo" vê o seletor e consegue trocar de investigação sozinho.
- Jogador sem personagem atribuído, ou cujo personagem não participa de nenhuma
  investigação em jogo, vê "Nenhuma investigação selecionada" sem quebrar o painel.
- `alternarAtiva` é mestre-only (igual todo o resto do bastidor do painel).

Depois de confirmar isso, adicione os cenários como verificações permanentes em
`scripts/e2e/verificar.mjs` (mesmo padrão dos já existentes — ver os blocos
"painel e rodadas" e o truque de simular visão de jogador com
`Object.defineProperty(game.user, "isGM", {value: false, configurable: true})`,
já usado ali pra testar a UI do lado do jogador sem precisar de um segundo usuário).

## 2. Pendente — backend pronto, falta só UI

### Ajustar progresso do desafio com botões +/- (pedido explícito do usuário)

> "deveria ser possível ajustar o progresso dos desafios pelo painel de
> investigação, e msm na tela de desafio, deveria ser mais simples ajustar as
> coisas talvez com botão de aumentar e diminuir."

Já existe: a action `ajustarPontuacaoDesafio` está registrada e implementada em
`module/cena/painel-investigacao.mjs` (`#ajustarPontuacaoDesafio`) — mestre-only,
trava em `[0, pontuacaoAlvo]`, `desafio.update({"system.pontuacaoAtual": novo})`.

**Falta**: o botão em si no template. Em
`templates/cena/painel-investigacao.hbs`, seção "Desafios de Acesso" (procure por
`OP2.Desafio.Progresso`), trocar o texto fixo `{{pontuacaoAtual}} / {{pontuacaoAlvo}}`
por um par de botões +/- (só quando `@root.ehGM`) chamando essa action com
`data-desafio-uuid="{{uuid}}"` e `data-delta="-1"`/`"1"`. Use o mesmo padrão visual
já existente em `templates/actor/personagem-inventario.hbs` (`data-action=
"ajustarCarga" data-delta="-1"`, classe `op2-botao-icone`, ícones
`fa-solid fa-minus`/`fa-plus`).

Depois, fazer o mesmo na **ficha do próprio desafio**
(`templates/item/desafio-acesso.hbs`, `module/sheets/item-desafio-acesso-sheet.mjs`):
adicionar `ajustarPontuacao`/`ajustarTentativas` no `DEFAULT_OPTIONS.actions` da
sheet (herda de `OP2ItemSheet` — subclasses SOMAM ações, não substituem; ver
`PontoInteresseSheet` como exemplo), implementar os handlers (mesmo padrão do
`#ajustarPontuacaoDesafio` do painel, mas em cima de `this.item` em vez de
`fromUuid`), e trocar o `<input type="number">` de `pontuacaoAtual` (e talvez
`tentativasUsadas`) por um stepper com botões ao lado. Pode precisar de uma classe
CSS nova pro layout inline do stepper — não existe ainda, mas é simples (flex row,
gap pequeno) em `styles/parciais/_investigacao.scss`.

Adicione i18n se precisar de novos aria-label (ex. "Aumentar"/"Diminuir" — confira
se já existe algo genérico antes de criar chave nova).

## 3. Pendente — não começado

### Ícones padrão distintos por tipo de documento

> "investigações deveriam ter icones diferentes, os icones padrões, o msm vale para
> as diferentes fichas de itens tb, cada um com icone padrão sendo possível trocar
> obviamente"

Hoje todo Actor/Item novo nasce com o ícone genérico do Foundry (o "mystery man" /
saco cinza). Pedido: cada **tipo de documento** (Actor: `personagem`, `npc`,
`investigacao`; Item: `habilidade`, `equipamento`, `ferramenta`, `ponto-interesse`,
`desafio-acesso`) devia ter um ícone padrão distinto ao ser criado, continuando
trocável normalmente pelo usuário (clique na imagem do cabeçalho, já funciona via
`data-action="editImage"` em todas as fichas).

Como fazer: `system.json` tem `documentTypes.Actor.<tipo>` e
`documentTypes.Item.<tipo>` — confira se o schema do manifesto do Foundry v13/v14
aceita uma chave `img` ali dentro (`documentTypes.Actor.investigacao.img`) para
definir o ícone-padrão-na-criação; se não aceitar diretamente nesse manifesto,
o caminho alternativo é um hook `Hooks.on("preCreateActor"/"preCreateItem", ...)`
em `module/op2.mjs` que seta `data.img` quando ainda está vazio/no valor genérico
padrão do core, condicionado a `data.type`. Confirme o comportamento certo lendo a
documentação/fonte do Foundry v13 antes de escolher a abordagem — não adivinhe.

Precisa de assets: veja se já existem ícones em `assets/` (procure por `.svg`/`.png`
usados hoje nas fichas, tipo `ponto-interesse`/`desafio-acesso`, que já têm um ícone
customizado nas fichas — o mesmo arquivo pode servir de ícone padrão do documento).
Se não houver ícone pronto pra algum tipo, pergunte ao usuário antes de gerar/buscar
arte nova — não é uma decisão técnica, é de conteúdo/estilo visual
(`docs/ESTILO-VISUAL.md` pode ter uma pista da direção visual esperada).

## Checklist antes de fechar

1. `npm run check` a cada mudança.
2. `npm run e2e` / `node scripts/e2e/verificar.mjs` contra Foundry real — screenshot
   de qualquer tela nova, nenhuma UI nova entra sem ver rodando de verdade (regra do
   projeto, não é frescura: já pegou pelo menos 4 bugs reais nesta sessão).
3. Regressão permanente em `scripts/e2e/verificar.mjs` pra cada coisa nova.
4. Commits em Conventional Commits, em português, **sem trailer de atribuição**
   (`Co-Authored-By` etc. — política da empresa do usuário, vale pra todo commit
   neste repo, sem exceção).
5. Apagar este arquivo (`scripts/e2e/README-handoff-kimi.md`) quando o handoff
   terminar — é só uma ponte entre sessões, não é documentação do projeto.
