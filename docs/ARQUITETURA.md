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
| `module/ui/` | Ícones de dado, helpers de Handlebars, listeners de chat. |
| `module/cena/` | Cena: encerrar, regras puras de investigação, ações, painel, rodadas e sobrecarga. |
| `module/settings/` | Registro dos settings. Um por lacuna do playtest. |
| `module/tests/` | `node --test`, sem runner externo. |
| `templates/partials/` | Peças reutilizadas: controle de dado, linha de perícia, trilha de recurso. |

## Decisões que valem repetir

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
o painel de investigação implementa a ordem arrastável com NPCs ao fim (spec §5.2) e o
avanço de rodada que dispara a sobrecarga mental (spec §7.6).

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
