# Glossário

Nomes usados no código. Consulte antes de batizar qualquer coisa — o sistema usa
identificadores em pt-BR, e consistência aqui é o que evita `skill`, `pericia` e
`ability` convivendo no mesmo repositório.

## Termos do jogo

| Termo | Chave / identificador | i18n | Observação |
|---|---|---|---|
| Teste | `teste` | `OP2.Test` → usamos `OP2.Dialog.Teste` | dois dados somados |
| Dificuldade | `dt` | `OP2.DT` | padrão 7 |
| Rolagem Alta | `ra` | `OP2.RA` | maior **valor** rolado |
| Rolagem Baixa | `rb` | `OP2.RB` | menor **valor** rolado |
| Sucesso crítico | `critico` | `OP2.Critico` | dois dados iguais ≥ 6 |
| Falha crítica | `falhaCritica` | `OP2.FalhaCriticaTitulo` | todos os dados em 1 |
| Aumento de passo | `stepUp` / `passos: +1` | `OP2.StepUp` | nunca `+N` numérico |
| Redução de passo | `stepDown` / `passos: -1` | `OP2.StepDown` | |
| Escada de dados | `ESCADA` | — | `["d4","d6","d8","d10","d12"]` |
| Perfil | `perfil` | `OP2.Perfil.*` | executor, analista, vigilante |
| Ocupação | `ocupacao` | `OP2.Campo.Ocupacao` | texto livre |
| Pontos de Vida | `recursos.pv` | `OP2.Recurso.pv` | |
| Pontos de Determinação | `recursos.pd` | `OP2.Recurso.pd` | |
| Ponto de Interesse | `ponto-interesse` | `OP2.POI` | fase 2 |
| Sobrecarga mental | `sobrecarga` | `OP2.MentalOverload` | fase 2 |
| Desafio de acesso | `desafio-acesso` | `OP2.AccessChallenge` | fase 3 |
| Ferimento | `estado.testesFerimento` | `OP2.Wound` | contador |
| Trauma | `estado.testesTrauma` | `OP2.Trauma` | contador |
| Cena | `cena` | `OP2.Cena.*` | unidade estrutural, não de tempo |

## Termos técnicos

| Conceito | Nome no código |
|---|---|
| Dado da ficha, antes de modificadores | `die` |
| Dado depois de passos e reduções | `dadoEfetivo` |
| Número de faces (4, 6, 8, 10, 12) | `valor` / `faces()` |
| Acumulador de passos de itens e efeitos | `stepMod` |
| Reduções de falha crítica, por atributo | `estado.reducoesTemporarias.<atributo>` |
| Um dado da rolagem, com resultado | `DadoRolado` (`{ indice, dado, resultado, contado }`) |
| Peça de um teste (perícia, atributo, extra) | `ComponenteTeste` |
| Dado que entra na soma | `contado: true` |

## Convenções de nome

- Tipos de documento e chaves: **pt-BR, kebab-case** quando composto
  (`ponto-interesse`, `desafio-acesso`).
- Funções e variáveis: **pt-BR camelCase** (`rolarTeste`, `dadoEfetivo`).
  Exceções: `stepDie` e `faces`, termos técnicos consolidados.
- Classes: **PascalCase**, sufixo em pt-BR (`PersonagemSheet`, `PersonagemData`).
- CSS: `.op2-<bloco>__<elemento>--<modificador>`.
- i18n: `OP2.<Área>.<Chave>`, com a área em PascalCase.
