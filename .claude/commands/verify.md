---
description: Roda o checklist da fase atual do roadmap
argument-hint: [numero-da-fase]
---

Verifique a fase $1 (ou a fase ativa do `docs/ROADMAP.md`, se nada for passado).

1. `npm run check` — lint, testes e build do CSS. Mostre a saída real, não resuma.
2. Para cada item marcado da fase no roadmap, aponte o arquivo que o implementa. Item
   marcado sem código correspondente é o achado mais importante que você pode trazer.
3. Para cada item não marcado, diga se está pronto e o roadmap está desatualizado, ou se
   falta mesmo.
4. Rode a revisão do agente `qa-reviewer` sobre o diff da branch.
5. Liste o que falta para o critério de pronto da fase, incluindo a validação manual em
   v13 e v14 — que **nenhum teste automatizado cobre**.

Não marque nada como pronto sem ter visto o código.
