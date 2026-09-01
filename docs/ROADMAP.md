# Roadmap

Milestones pequenas e reversíveis. Uma fase só fecha quando dá para *jogar* o que ela
promete, nas duas versões do Foundry.

## Fase 0 — Fundação ✅

Manifesto, tooling, testes, docs, símbolo do projeto. Sem conteúdo de jogo.

## Fase 1 — Ficha + motor de dados → `0.1.0` ◀ atual

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
- [ ] Validação em Foundry v13

**Pronto quando:** dá para criar um agente, montar a ficha, rolar qualquer perícia
trocando o atributo, ver RA/RB e crítico no chat, e o mestre aplicar falha crítica com
um clique — em v13 e v14.

**Sem compêndio de habilidades, e é intencional.** O playtest não publica uma lista de
habilidades: elas aparecem só nas fichas dos personagens prontos, que são conteúdo da
aventura *A Maldição do Ídolo de Pedra* — fora de escopo deste repositório. O tipo de
Item `habilidade` existe e é funcional; o conteúdo é criado pela mesa, ou vem de um
*adventure module* separado. Ver `docs/LACUNAS.md`.

## Fase 2 — Investigação → `0.2.0` ◀ atual

O coração do playtest, e o que nenhum outro sistema tem.

- [x] `ponto-interesse` como Item, com sheet de mestre (cabeçalho, quadro de perícias,
  descrição contextual só do GM)
- [x] Painel de investigação por cena
- [x] Investigar / Examinar / Interagir / Recapitular / Compartilhar
- [x] Revelação **por personagem** — a informação é de quem descobriu
- [x] Travas de 1×-por-cena em Recapitular e Compartilhar
- [x] Tracker de rodadas sem iniciativa: ordem arrastável, NPCs por último
- [x] Sobrecarga mental com tabela editável por cena
- [ ] Validação em Foundry v13 (bloqueada: sem instalação v13 na máquina)

**Ponto crítico entregue:** a coluna DT é lida de duas formas. Investigar compara o
*tamanho* do dado, sem rolar (`resolverInvestigacao`). Examinar rola e compara a soma —
e custa **1 PD se não trouxer informação nova**, com aviso antes de confirmar e botão
de pagamento no chat.

## Fase 3 — Desafios e ferramentas → `0.3.0`

- Destrancar: minigame Mastermind, senha em flag do mestre
- Arrombar, Alcançar, Sustentar
- `ferramenta` com handler por subtipo
- Laboratório Portátil (escada crescente) e Rádio Modificado (ordenação de frases)
- Cargas da Lanterna UV e do Pó Revelador

## Fase 4 — Combate simplificado → `0.4.0`

Teste oposto de Luta, dano RA/RB, esquiva com `+d6`, ferimentos e traumas com DT
escalando 7/10/13/16.

**Módulo isolado.** O playtest diz que essas regras são temporárias e serão substituídas
— nada do resto do sistema deve depender delas.

## Depois

NEX, progressão por nível, traumas permanentes e o combate completo, quando forem
publicados. Os campos já existem; a mecânica não.

Fora de escopo permanente: a aventura *A Maldição do Ídolo de Pedra*. Ela é conteúdo do
PDF e, se virar algo, é um *adventure module* separado.
