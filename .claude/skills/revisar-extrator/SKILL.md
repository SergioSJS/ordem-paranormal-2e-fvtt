---
name: revisar-extrator
description: Como conferir e calibrar o extrator do PDF do playtest (module/extrator/) quando a editora publica uma revisão nova do PDF, ou quando um ponto de interesse sai errado no jogo. Rodar, comparar com o gabarito, olhar a grade, medir no PDF, aceitar o que está certo.
---

# Revisar o extrator do PDF

O sistema não traz texto do livro: o mestre escolhe o PDF do playtest na janela de
aventuras e `module/extrator/` monta os atos no navegador. O extrator é uma leitura
de layout — colunas, DTs, rótulos centralizados, caixas — e **toda revisão do PDF
pode deslocar alguma coisa**. Esta skill é o roteiro para conferir.

## Onde está cada coisa

| Arquivo | O que faz |
| --- | --- |
| `module/extrator/grade.mjs` | O pdf.js entrega pedaços de texto com x/y; isto vira linhas de texto em colunas, emulando `pdftotext -layout`. Toda régua (tolerância de linha, entrelinha, célula) está comentada com o caso medido que a decidiu. |
| `module/extrator/ato-i.mjs` | Pontos de interesse, quadro (`lerTabela`), caixas de desafio, maldição, itens de mesa, roteiro. |
| `module/extrator/ato-ii.mjs` | Matriz de ferramentas, legenda, pontos com setor de ferramentas, mecânicas, laser, rádio, `conferir()`. |
| `scripts/extrator/rodar.mjs` | Roda o extrator num PDF pelo Node e compara com um gabarito. **É a ferramenta de revisão.** |
| `module/aventura/ato-*.mjs` | Do JSON extraído ao `Adventure`. Não mexer aqui por causa de layout. |
| `module/tests/extrator.test.mjs` | Casos sintéticos das regras que mais quebram (grade, `lerTabela`). |

Os PDFs e zips da editora ficam em `jambo-arquivos/` (fora do git): `v1/` e `v2/`,
níveis gratuito/básico/completo. O gratuito para no Ato I.

## O ciclo

```bash
export PATH="$HOME/.nvm/versions/node/v24.20.0/bin:$PATH"   # Node 24
node scripts/extrator/rodar.mjs <pdf> <pasta-do-gabarito> --texto --completo
```

- Escreve `build/js/*.json` (o que o Foundry montaria) e `build/js/texto.txt` (a grade,
  para olhar).
- Compara com o gabarito e lista diferença por caminho (`ato-i-pontos[13].informacoes[4].dt`).
- `OP2_MAX_DIFS=80` mostra mais linhas.

**Gabaritos:**

- `build/gabarito-v1/` — saída do extrator Python (histórico) para o PDF v1. O JS é
  **byte-idêntico** a ele, exceto nos casos listados em `ACEITAS` no `rodar.mjs`, cada
  um com o motivo (o gabarito estava errado e foi conferido no PDF).
- Para uma revisão nova, o gabarito é **a saída do JS na revisão anterior**:
  `cp -r build/js build/js-v1` depois de rodar a v1, e compare a nova contra ela. As
  diferenças que sobram são (a) revisão editorial legítima ou (b) bug — decidir uma a uma.

## Como decidir uma diferença

1. **Leia a grade.** `grep -n -B3 -A6 "trecho" build/js/texto.txt`. Compare com o
   `pdftotext -layout` se tiver (`/tmp/v1.txt`). Se a grade está igual e a leitura
   difere, o problema é no leitor (`ato-*.mjs`); se a grade difere, é em `grade.mjs`.
2. **Meça no PDF antes de mudar régua.** Um trecho de node com o pdf.js do Foundry
   (`/Applications/Foundry Virtual Tabletop.app/Contents/Resources/app/node_modules/@foundryvtt/pdfjs/build/pdf.mjs`):
   liste `transform[4]` (x), `transform[5]` (y) e `height` dos itens da página em torno
   do trecho. As réguas em `grade.mjs` foram calibradas em décimos de ponto — a
   tolerância de linha é `< 0,5 × menor fonte`: 4,04 pt separa, 4,46 pt junta.
3. **Rode os três PDFs a cada mudança.** A v1 tem que continuar idêntica ao gabarito.
   Uma régua ajustada para a v1.1 quebra a v1 com facilidade (aconteceu com o número
   de página, com o rótulo centralizado, com a coluna de narração).
4. **Aceite só o que conferiu no livro.** Onde o JS lê certo e o gabarito errava, o
   caminho entra em `ACEITAS` com o motivo. Nunca aceite para silenciar.

## Regras que existem por um caso concreto (não remover sem rodar tudo)

- Linha ancorada no pedaço de fonte maior (rótulo de 9 pt ao lado de texto de 8 pt).
- Frase cortada no meio não abre linha em branco (fim sem pontuação + começo em
  minúscula, ou hífen), olhando a mesma **coluna**, não a linha inteira.
- Entrelinha nunca menor que a do corpo do documento (páginas de quadro têm fonte
  mediana 8 pt, o texto corrido é 9 pt).
- Número de página é número sozinho **longe das colunas do quadro** — pôster na coluna
  da direita tem DT com trinta espaços antes.
- "6 ou" / "10" é DT com alternativa (`dtAlternativa`), não prosa.
- Rótulo sem rótulo acima herda a perícia de cima — exceto quando está a três ou mais
  linhas da sua DT e no meio exato das duas (a Estante no PDF gratuito).
- Linha de equação (`= 67`) abre caixa de desafio (o painel elétrico se parte em dois
  blocos na grade).
- Página de narração sem corredor reto se parte linha a linha (`{ narracao: true }`);
  o miolo dos pontos, não.
- Erratas em `ato-ii.mjs` são regex com lookbehind: a v1.1 já vem com o "A" de
  "Analisar", e a errata dobrava.

## Erros do livro que o extrator conhece

- **v1, Ato II:** descrição do Símbolo no Teto impressa no Depósito A, no Molho de
  Chaves e no Duto; quadro do Molho no Depósito B e no Armário de Roupas; cadeira da
  Mesa de Poker na Churrasqueira; rótulos "Laboratório" nos quatro do Freezer; handout
  citado com número diferente do zip. A v1.1 corrigiu tudo; o gerador só põe as notas
  quando o erro está no texto.
- **Ídolo:** a matriz da v1 não marca a Lanterna UV, o texto marca
  (`DISCREPANCIAS_DO_LIVRO`); a v1.1 corrigiu a matriz. A conferência ignora dos dois
  lados.
- **Handouts do Ato I citados sem "HANDOUT"** ("os handouts 05A, 05B e 05C").

## Quando a editora publica uma revisão

1. Ponha os arquivos em `jambo-arquivos/vN/…`.
2. Rode a revisão anterior e guarde: `cp -r build/js build/js-anterior`.
3. Rode a nova contra `build/js-anterior` (`--completo --texto`), e também o PDF
   gratuito da revisão.
4. Classifique cada diferença. Texto que mudou no livro: legítimo. Estrutura que mudou
   (contagem de pontos, linhas, DTs, perícias): investigue.
5. `npm run check` e, com o Foundry descartável, `npm run e2e` com `OP2_E2E_PDF`
   apontando para o PDF novo.
6. Atualize esta skill se aprendeu uma regra nova.
