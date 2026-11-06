---
description: Inicia uma feature — branch, arquivo de tarefa e leitura da spec
argument-hint: <slug-da-feature>
---

Inicie a feature `$1`.

1. Confira que a árvore está limpa (`git status`). Se não estiver, pare e mostre o que há.
2. Crie a branch `feat/$1` a partir da `main`.
3. Leia `docs/projeto/ROADMAP.md` e diga em qual fase essa feature cai. Se não cai em nenhuma,
   pergunte antes de continuar.
4. Leia as seções relevantes de `docs/regras/spec-alpha.md` e liste, com citação
   de seção, as regras que a feature precisa respeitar.
5. Aponte as ambiguidades: existe entrada em `docs/regras/LACUNAS.md`? Se a feature esbarra numa
   nova, proponha o default e o setting antes de escrever código.
6. Escreva `docs/tasks/$1.md` com escopo, regras citadas, arquivos a tocar e critério de
   pronto.

Só então comece a implementar.
