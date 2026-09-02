# Roadmap

Milestones pequenas e reversíveis. Uma fase só fecha quando dá para *jogar* o que ela
promete, nas duas versões do Foundry.

## Fase 0 — Fundação ✅

Manifesto, tooling, testes, docs, símbolo do projeto. Sem conteúdo de jogo.

## Fase 1 — Ficha + motor de dados → `0.1.0` ✅

- [x] Escada de dados com testes
- [x] `OP2Roll` com RA/RB, crítico, falha crítica, precedência sobre a DT
- [x] Seleção 4 rolados → 3 contados
- [x] Diálogo de teste com troca de atributo pareado e passos
- [x] Chat card com dados como ícones, RA/RB e botões de dano
- [x] Tabela de falha crítica com confirmação do mestre
- [x] `personagem` e `npc` como `TypeDataModel`
- [x] `habilidade` e `equipamento`
- [x] Ficha do personagem: perícias com par de dados, PV/PD em pips, aptidão extensível
- [x] Ficha de NPC e de itens
- [x] i18n pt-BR + en com teste de paridade
- [x] Busca na coluna de perícias
- [x] Validação em Foundry v14 real (`npm run e2e`, 47 verificações)
- [ ] Validação em Foundry v13 (adiada por decisão do projeto)

**Pronto quando:** dá para criar um agente, montar a ficha, rolar qualquer perícia
trocando o atributo, ver RA/RB e crítico no chat, e o mestre aplicar falha crítica com
um clique — em v13 e v14.

**Sem compêndio de habilidades, e é intencional.** O playtest não publica uma lista de
habilidades: elas aparecem só nas fichas dos personagens prontos, que são conteúdo da
aventura *A Maldição do Ídolo de Pedra* — fora de escopo deste repositório. O tipo de
Item `habilidade` existe e é funcional; o conteúdo é criado pela mesa, ou vem de um
*adventure module* separado. Ver `docs/LACUNAS.md`.

## Fase 2 — Investigação → `0.2.0` ✅

O coração do playtest, e o que nenhum outro sistema tem.

- [x] `ponto-interesse` como Item, com sheet de mestre (cabeçalho, quadro de perícias,
  descrição contextual só do GM)
- [x] Painel de investigação por cena
- [x] Examinar / Interagir / Recapitular / Compartilhar / Usar habilidades e itens
  (não existe ação "Investigar": investigar um ponto É examinar ou interagir, spec §6.3)
- [x] Revelação **por personagem** — a informação é de quem descobriu
- [x] Três estados por linha do quadro: rascunho / descobrível / aberta
- [x] Desfazer uma descoberta sem encerrar a cena
- [x] Travas de 1×-por-cena em Recapitular e Compartilhar
- [x] Tracker de rodadas sem iniciativa: uma lista só, arrastável, NPCs incluídos
  (a spec sugere NPCs por último; prender o grupo deixava a linha deles imóvel)
- [x] Sobrecarga mental com tabela editável por cena
- [ ] Validação em Foundry v13 (adiada por decisão do projeto)

**Ponto crítico entregue:** a coluna DT é lida de duas formas. Investigar compara o
*tamanho* do dado, sem rolar (`resolverInvestigacao`). Examinar rola e compara a soma —
e custa **1 PD se não trouxer informação nova**, com aviso antes de confirmar e botão
de pagamento no chat.

## Fase 3 — Desafios e ferramentas → `0.3.0`

### M1 — Desafios de acesso físico ✅

- [x] `desafio-acesso` como Item, com pontuação acumulada e teto de tentativas opcional
- [x] Arrombar: 1 PV/tentativa, Atletismo vs DT do objeto, acumula RA até a PA
- [x] Alcançar: seguro (duas ações, dano = RB na falha) e arriscado (uma ação, DT+3,
  dano = RA na falha) — nunca aplica dano sozinho, botão no card
- [x] Sustentar: custo inicial + teste, fadiga cumulativa a cada rodada
  (`estado.sustentando`, hook em `avancarRodada()`)
- [x] Seção "Desafios" no painel de investigação, com Arrombar por item
- [ ] Validação em Foundry v13 (adiada por decisão do projeto)

### M2 — Ferramentas da Ordo Realitas ✅

- [x] Item `ferramenta` com `subtipo` (10 ferramentas, spec §9)
- [x] Usar ferramenta num POI: revela `ferramentas.<chave>` (ou "sem reação" —
  também é informação, spec §9.3); consome carga quando a ferramenta controla
  (Lanterna UV, Pó Revelador)
- [x] Laser de Varredura: ação de cena que marca quais POIs reagem a alguma
  ferramenta, sem dizer qual
- [x] Seção de ferramentas por POI no painel, só com o que o personagem carrega
- [x] Regras puras do Laboratório Portátil (escada crescente) e do Rádio
  Modificado (tabela de conjuntos falsos) — prontas para o app de M3
- [ ] Validação em Foundry v13 (adiada por decisão do projeto)

### M3 — minigames dedicados ✅

- [x] Destrancar: app de Mastermind numérico, senha oculta no Item, resposta
  posição a posição (exato/alto/baixo), teto de tentativas reaproveita `quebrado`
- [x] App do Laboratório Portátil (`module/cena/laboratorio-app.mjs`) — a checkbox
  estava desatualizada, o app já existia e tem cobertura em `scripts/e2e/verificar.mjs`
- [x] App do Rádio Modificado (`module/cena/radio-app.mjs`) — schema próprio pro POI
  (`conjuntos` verdadeiro/falso + frase, docs/LACUNAS.md), teto de falsos removidos
  pelo teste de Tecnologia, ordenação por setinhas. Verificado ao vivo: 220
  checks, 0 erros de console, screenshot real do app rodando.
- [ ] Validação em Foundry v13 (adiada por decisão do projeto)

Fase 3 fechada. A validação em v13 está adiada por decisão do projeto — o sistema
declara `minimum: 13`, mas só o v14 foi exercitado de verdade.

## Fase 4 — Combate simplificado e regras avulsas → `0.4.0` ✅

**Módulo isolado.** O playtest diz que essas regras são temporárias e serão substituídas
— nada do resto do sistema depende delas.

- [x] Teste oposto (spec §4.6): maior resultado vence, sem DT; empate não move nada
- [x] Combate: teste oposto de Luta, dano RA com arma e RB desarmado (spec §8.1)
- [x] Esquiva: Acrobacia com `+d6` somado — a única exceção aditiva do playtest;
      vencendo, ninguém sofre nem causa dano
- [x] Ferimentos (§8.2): zerar PV pede Vigor contra DT 7/10/13/16, +3 por teste feito
- [x] Traumas (§8.3): zerar PD pede Disciplina, com a consequência da falha configurável
      (`falhaTrauma`) — o texto avisa que morrer por PD vai mudar
- [x] Ajuda (§4.7): mínimo d6, +1 passo em d6/d8 e +2 em d10/d12, no dado que o setting
      `ajudaAlvo` indica; vira passo pendente e o próximo teste consome
- [x] Usar habilidades e itens (§6.6): o jogador declara, o card leva a descrição para a
      mesa, e o mestre concede o passo — nada automático
- [x] Barra de Ímpeto das fichas do Ato I: falha preenche, 1 espaço vira `+d4` no teste,
      3 espaços sobem um atributo em um passo até o fim da cena
- [ ] Validação em Foundry v13 (adiada por decisão do projeto)

## Compêndios

- [x] Habilidades do Ato I (8 itens)
- [x] Pré-gerados do Ato I (Alan, Edgar, Eloísa, Kênia, Victor), com habilidades e tokens
- [x] Handouts e históricos do Ato I como JournalEntry
- [x] `npm run ato-i` instala as imagens no User Data (não são redistribuídas)
- [x] As 10 ferramentas da Ordo Realitas como itens prontos, com as cargas da regra
      (Lanterna UV 3, Pó Revelador 5; as demais ilimitadas)

As habilidades de perfil moram no compêndio de habilidades com `origem: "perfil"` — não
existe um pack "perfis" separado.

## Depois

NEX, progressão por nível, traumas permanentes e o combate completo, quando forem
publicados. Os campos já existem; a mecânica não.

Fora de escopo permanente: a aventura *A Maldição do Ídolo de Pedra*. Ela é conteúdo do
PDF e, se virar algo, é um *adventure module* separado.
