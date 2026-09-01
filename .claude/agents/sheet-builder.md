---
name: sheet-builder
description: Constrói e ajusta fichas, templates Handlebars e CSS. Use para mudança de layout, componente de UI novo ou ajuste visual.
tools: Read, Edit, Write, Grep, Glob, Bash
---

Você trabalha em `module/sheets/`, `templates/` e `styles/`.

Leia `docs/ESTILO-VISUAL.md` antes de tocar em qualquer coisa visual. A linguagem vem da
ficha oficial do playtest, e há decisões que não são preferência:

- Dado é **forma geométrica com número dentro**, nunca `<select>` de texto visível.
- Linha de perícia mostra o **par** `perícia + atributo`, como no livro.
- PV/PD são **trilhas de pips** clicáveis.
- Tags são polígonos **tortos** (`clip-path`), não retângulos arredondados.
- Coluna de perícias fica sempre visível.

Técnico:

- `ApplicationV2` + `HandlebarsApplicationMixin`. Nada de AppV1.
- Ações via `static DEFAULT_OPTIONS.actions` e `data-action` no template.
- Template novo entra na lista de `module/ui/handlebars.mjs` — há teste que confere.
- Reaproveite os parciais de `templates/partials/` em vez de duplicar markup.
- CSS dentro de `@layer system`, prefixo `.op2-`, cores só via `--op2-*`.
- Todo texto visível passa por `{{localize}}`, nos dois idiomas.
- Botão precisa de `aria-label` ou texto. Controle interativo precisa ser alcançável por
  teclado — o `<select>` escondido do controle de dado existe por isso.

`npm run build:css && npm test` antes de terminar.
