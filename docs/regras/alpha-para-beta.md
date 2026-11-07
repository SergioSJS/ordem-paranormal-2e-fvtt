# Do alpha para o beta: o que muda no sistema

Análise de impacto, sem nada implementado ainda. Regras em `docs/regras/spec-beta.md`;
contradições e defaults em `docs/regras/LACUNAS.md`, seção "Playtest beta".

## Decisão: dois modos de jogo, em paralelo

Decidido pelo mantenedor em 2026-11-06. O beta se passa no passado, então não substitui nada:

| Modo | Chave | Regras | Aventuras | Fonte |
|---|---|---|---|---|
| **Moderno** | `moderno` | `spec-alpha.md` | Atos I e II | PDF e zips do alpha |
| **Vigília** | `vigilia` | `spec-beta.md` | Missões 1 e 2 | PDF e zips do beta |

**Nada do modo moderno é apagado.** Mundos existentes abrem em `moderno`, iguais a hoje.

- **Setting de mundo `modo`**, default `moderno`. Trocar não perde dado (ver abaixo) e recarrega a mesa
  inteira: pelo `requiresReload` no formulário, por `trocarModo()` fora dele.
- **Perícias em união.** `PERICIAS` passa a ter 22 chaves, cada uma com os modos em que aparece, e o
  schema do ator guarda todas: o modo só decide o que as telas mostram. Sem migração. As seis telas que
  fazem `Object.keys(PERICIAS)` passam por `periciasDoModo()`. Campo de Aptidão que a mesa criou (rótulo
  preenchido) aparece em qualquer modo, mesmo com a chave de um de fábrica do outro.

  | Chave | Moderno | Vigília |
  |---|---|---|
  | `maquinas`, `tecnologia` | sim | oculta |
  | `animais`, `oficio` | oculta | sim |
  | `pesquisar` | Pesquisar | Inspecionar (mesma chave) |
  | `ocultismo` | Ocultismo | Bruxaria (mesma chave) |
  | as outras 16 | iguais | iguais |

- **Aptidões, rótulos e compêndios por modo.** Vocação é rótulo de `ocupacao`. Prontidão e Ímpeto mudam
  de regra com o mesmo nome, então habilidades e vocações do Vigília ficam em compêndio próprio.
- **Regra por modo em tabela única**, para cada subsistema (combate, dano, investigação): nada de `if`
  espalhado, e é o que permite ligar um subsistema em outro modo depois.
- **Importação dos dois modos.** A janela *Aventuras do playtest* agrupa por modo, cada um com o próprio
  PDF e os próprios zips. Importar aventura do outro modo oferece trocar o modo do mundo.

**O playtest é autocontido.** Leitura integral: o livro traz ficha, testes, investigação, desafios,
combate, dano, medo e relações, e diz que repete o alpha para que baste um arquivo (p. 4). Fichas prontas
vêm no zip. Não depende do PDF do alpha. Perseguição e furtividade só existem dentro das missões.

**Combate novo no modo moderno: opcional, ligado por padrão** (decisão do mantenedor, 2026-11-06). As
regras não são presas à época: a carta e a ação Preparar usam pistola como exemplo (p. 2, p. 19), e o alpha
chamava o próprio combate de temporário. Setting de mundo, default ligado, disponível no modo moderno e sem
efeito no Vigília, que só tem o novo. Desligado, o moderno usa o combate simplificado de hoje
(`spec §8`). O default muda o comportamento de mundos existentes **quando o M4 sair**: entra no CHANGELOG.

## O que muda, por área

Legenda: 🟢 reaproveita · 🟡 estende · 🔴 novo.

| Área | Beta | Onde bate |
|---|---|---|
| 🟡 Perícias | União de 22 chaves, com rótulo e visibilidade por modo (`beta §2.2`) | `config.mjs` `PERICIAS`; as seis telas que listam; i18n |
| 🟡 Aptidões | Outra lista por modo; Erudição define alfabetização | `config.mjs` `APTIDOES_PADRAO` |
| 🟡 Vocação | Rótulo de Ocupação no Vigília | `item-ocupacao.mjs`, ficha, i18n: rótulo por modo, a chave fica |
| 🔴 Modificador fixo | `+1`, `–2` no teste e no dano | `dice/analise.mjs`, `dice/teste.mjs`, card. **Quebra a convenção "tudo é passo": rever `CLAUDE.md`** |
| 🟢 Dado bônus | `+1d6`, limite 4/3 | Motor já lida com dado extra e seleção |
| 🔴 Crítico no dano | Soma a segunda maior | `dice/analise.mjs` |
| 🔴 Dado de pavor | Rola junto, anula, não soma | `analise.mjs` (puro + teste), estado do ator, diálogo |
| 🟡 Investigar | **Observar** novo; Interagir vira alternativa; ação se chama Investigar | `cena/investigacao.mjs`, `acoes-investigacao.mjs`, `acoes-app.mjs`. Revisar a nota "Não existe ação Investigar" do `CLAUDE.md`, que vale para o alpha |
| 🟡 Quadro | Pré-requisito na linha; subponto preso ao pai | `item-ponto-interesse.mjs`, painel |
| 🟢 Destrancar, Arrombar, Sustentar | Iguais | `cena/desafios.mjs` |
| 🟡 Alcançar | Perícia por ponto | `item-desafio-acesso.mjs` |
| 🔴 Equilíbrio, Escalar | Desafios novos | `item-desafio-acesso.mjs`, `desafios.mjs` (puro) |
| 🔴 Combate por fases | Quatro fases, simultaneidade, ação por fase | **Módulo novo, ao lado** de `cena/combate.mjs` e `acoes-combate.mjs`, que ficam para o moderno com a opção desligada. `rodada.mjs` serve de base para o tracker |
| 🔴 Ações e manobras | 9 gerais, 5 manobras | `acoes-combate.mjs` novo, regras puras em módulo testável |
| 🔴 Condições | Caído, agarrado, atordoado, moribundo, inconsciente, cobertura, ocultação | Sem Active Effects: passos em `stepMod`, estado em `estado.*` |
| 🔴 Lesão e trauma | Tabelas 1d20, permanentes | Módulo novo, ao lado de `cena/ferimentos.mjs` e `queda.mjs` |
| 🔴 Armadura e RD | Gasto por dano; RD em criatura | `actor-personagem.mjs`, `actor-npc.mjs`, `cardDeDano` |
| 🟡 Equipamento | Dano, armadura, marcial, passos | `item-equipamento.mjs` (hoje só `arma` booleano) |
| 🔴 Relações | 56 linhas nas fichas; grau, uso por missão | `actor-personagem.mjs`, ficha |
| 🟡 Habilidades | **Mesmo nome, outra regra:** Prontidão (no alpha, 3 PD para agir primeiro; no beta, isso é Antecipação Tática com 2 PD) e Ímpeto (de 3 para 5 espaços, com ação extra). Análise é nova | `cena/impeto.mjs`, `packs/sources/habilidades/`: compêndio por modo; marcadores novos; Prontidão com efeito de fase |
| 🔴 Perseguição | Modelo + parâmetros | Módulo puro, tipo novo de cena, janela |
| 🔴 Furtividade | Dados de esconderijo | Módulo puro, janela, tabela por cena |
| 🟢 Roteiro por rodada | Ondas, fases do chefe, limite de tempo | `item-evento.mjs` já conta rodadas a partir do gatilho |
| 🟡 NPC | Ações, RD, ataque por dado (`2d10`), estratégia por rodada | `actor-npc.mjs` |

## Aventuras

Mesma arquitetura dos atos: **o texto do livro não entra no pacote.** O extrator lê o PDF do mestre e
monta um `Adventure` por missão; um zip da editora traz as artes. Em mãos só o nível completo do
beta (`2-agenteelite-completo`): faltam PDF gratuito e de recruta para testar o extrator neles.

| | Missão 1 | Missão 2 |
|---|---|---|
| Páginas | 28–47 | 50–75 |
| Disponível | Gratuita | Recruta e elite |
| Zip | `…-Missao-1-Extras.zip` (255 MB) | `…-Missao-2-Extras-Elite.zip` (352 MB) |
| Cenas | Combate; chefe em 3 fases (perseguição, investigação, combate) | Furtividade; investigação; combate em ondas; perseguição |
| Pontos / linhas | 6 / 16 | 10 / 24 |
| Fichas de criatura | Afogado, aughisk | Cria da floresta (o Ellén Trechend não tem ficha) |
| Personagens | 6 | 8 |
| Mapas | 2 ângulos da ilhota | 2 iluminações da caverna |

**Tamanho dos extras.** Mapas de 9930×8280, token com até 35 MB, PNG de 49 MB repetindo o JPG. O importador
atual sobe os arquivos como vêm. Antes de copiar a Missão 2 inteira para o mundo, vale reduzir tokens e
ignorar o PNG duplicado.

**Sem grade.** Combate sem medição: cena sem grade, marcadores de ponto nas posições numeradas das p. 36 e p. 61.

**Erros do livro.** Nenhum vira correção silenciosa: `docs/regras/LACUNAS.md` lista cada um. A montagem
avisa e segue, e `.claude/skills/revisar-extrator/` vale para a revisão seguinte.

## Ordem proposta

No `docs/projeto/ROADMAP.md`, Fase 5.
