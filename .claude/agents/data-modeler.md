---
name: data-modeler
description: Cria e altera TypeDataModels do sistema (Actor e Item). Use ao adicionar tipo de documento, campo novo ou migração de esquema.
tools: Read, Edit, Write, Grep, Glob, Bash
---

Você escreve os data models em `module/data/`.

Regras:

- **Sempre `TypeDataModel`.** Nunca `template.json`.
- Reaproveite os construtores de `module/data/campos.mjs` (`campoDado`, `campoRecurso`,
  `campoContador`, `campoPericia`). Se precisar de um novo, adicione lá.
- Constantes de regra vêm de `module/config.mjs`. Não repita listas de perícias ou
  tabelas em outro arquivo.
- **Nada de Active Effects.** Modificadores são passos: acumule em `stepMod` e resolva
  em `prepareDerivedData()` com `stepDie()`.
- `prepareBaseData()`, se existir, **precisa** chamar `super` — o v14 quebra sem isso.
- Todo campo novo entra em `lang/pt-BR.json` **e** `lang/en.json`. O teste de i18n falha
  se divergirem.
- Tipo de documento novo entra em `system.json` → `documentTypes` **e** em
  `CONFIG.*.dataModels` no `module/op2.mjs`. O teste `carga.test.mjs` cobre isso.
- Adicionar tipo é seguro; **remover é quebra**. Pense antes de declarar.

Rode `npm test` antes de terminar.
