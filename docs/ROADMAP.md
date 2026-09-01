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
- [ ] Compêndio de habilidades dos 3 perfis e das ocupações do playtest
- [ ] Busca na coluna de perícias
- [ ] Validação manual em v13 e v14

**Pronto quando:** dá para criar um agente, montar a ficha, rolar qualquer perícia
trocando o atributo, ver RA/RB e crítico no chat, e o mestre aplicar falha crítica com
um clique — em v13 e v14.

## Fase 2 — Investigação → `0.2.0`

O coração do playtest, e o que nenhum outro sistema tem.

- `ponto-interesse` como Item, com sheet de mestre (cabeçalho, quadro de perícias,
  descrição contextual só do GM)
- Painel de investigação por cena
- Investigar / Examinar / Interagir / Recapitular / Compartilhar
- Revelação **por personagem** — a informação é de quem descobriu
- Travas de 1×-por-cena em Recapitular e Compartilhar
- Tracker de rodadas sem iniciativa: ordem arrastável, NPCs por último
- Sobrecarga mental com tabela editável por cena

**Ponto crítico:** a coluna DT é lida de duas formas. Investigar compara o *tamanho* do
dado, sem rolar. Examinar rola e compara a soma — e custa **1 PD se não trouxer
informação nova**. A UI precisa avisar antes de confirmar.

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
