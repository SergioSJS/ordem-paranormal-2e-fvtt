---
description: Gera o HANDOFF da sessão em docs/tasks/
---

Gere `docs/tasks/HANDOFF-<AAAA-MM-DD>.md` com:

- **Onde parei** — o que ficou funcionando e o que ficou pela metade, com arquivos.
- **Decisões tomadas** — especialmente leituras de regra ambígua. Se alguma virou
  default, ela está em `docs/LACUNAS.md`? Se não, adicione.
- **Estado dos testes** — saída real de `npm run check`.
- **Validação manual pendente** — o que ainda não foi visto rodando no Foundry, e em qual
  versão.
- **Próximo passo concreto**, não uma área genérica.

Atualize a seção "Estado" do `CLAUDE.md` **e** do `AGENTS.md` — os dois precisam ficar em
sincronia. Atualize as caixas do `docs/ROADMAP.md` só com o que você viu funcionando.
