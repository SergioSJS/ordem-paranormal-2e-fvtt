# Ordem Paranormal 2 — Sistema Foundry VTT

> Memória do projeto. Só ponteiros e convenções — o conteúdo vive em `docs/`.

## Leitura antes de trabalhar

1. `docs/op2-playtest-spec-foundry.md` — **a fonte da verdade das regras.** Toda decisão
   mecânica cita uma seção dela (`spec §4.2`).
2. `docs/ROADMAP.md` — fase ativa e critério de pronto.
3. `docs/ARQUITETURA.md` — antes de criar arquivo novo.
4. `docs/LACUNAS.md` — antes de implementar regra ambígua.
5. `docs/ESTILO-VISUAL.md` — antes de mexer em CSS ou template.

O PDF do playtest fica em `docs/` mas **não é commitado** (`.gitignore`). Ele é a fonte
da spec e das amostras visuais; extraia dele em vez de adivinhar.

## Estado

**Fase:** 1 — Ficha + motor de dados
**Versão:** 0.0.1
**Próxima milestone:** 0.1.0 — ficha jogável em v13 e v14

## Convenções

- **Identificadores em pt-BR**: tipos, chaves, funções (`personagem`, `pericias`, `stepDie`
  é exceção por ser termo técnico consolidado). Comentários e docs em pt-BR.
- **Sem `template.json`** — sempre `TypeDataModel`.
- **Sem Active Effects** — a escada de dados não é aditiva. Passos vão para `stepMod` e
  são resolvidos em `prepareDerivedData()`. É também o que mantém v13 e v14 compatíveis.
- **ApplicationV2 / DocumentSheetV2** em tudo. Nada de AppV1.
- Prefixo CSS `.op2-*`, variáveis `--op2-*`, tudo dentro de `@layer system`.
- i18n namespace `OP2.*`. `lang/pt-BR.json` é primário, `lang/en.json` espelha — o teste
  `module/tests/i18n.test.mjs` falha se divergirem.
- Commits: Conventional Commits, em português.
- Nunca commitar direto na `main` — sempre feature branch.

## Rodando local

```bash
npm install
npm run setup        # symlink -> ~/Library/Application Support/FoundryVTT/Data/systems/
npm run watch:css    # sass em watch
npm run check        # lint + testes + build do CSS — rode antes de commitar
```

No Foundry: **Configurações → Configurar Aplicação → Hot Reload**. Com isso, `F5`
recarrega CSS e templates sem reiniciar o servidor. Mudança em `.mjs` exige `F5` também.

### Preview da ficha sem o Foundry

```bash
npm run preview        # gera preview.html
open preview.html
```

`scripts/preview.mjs` instancia a ficha **de verdade** com os stubs de teste, então o
contexto vem do mesmo `_prepareContext` que roda no jogo. Serve para iterar em CSS e
layout depressa. **Não** reproduz o chrome da janela, o sistema de abas do core nem o
tema do usuário — não dá nada por validado só porque o preview está bonito.

### Testar nas duas versões

O sistema declara `minimum: 13, verified: 14`. Toda mudança que toca API do Foundry
precisa passar nas duas.

- **v14** — instalação em `/Applications`, User Data em `~/Library/Application Support/FoundryVTT`.
- **v13** — instalação separada, User Data próprio:
  ```bash
  FOUNDRY_DATA="$HOME/FoundryV13/Data" npm run setup
  ```

**Nunca abra o mesmo mundo nas duas versões.** A migração do v14 é irreversível: um mundo
aberto no v14 não volta para o v13. Mantenha mundos de teste separados.

O servidor do Foundry v14 exige **Node 24**. O `npm test` do projeto roda em Node 22+.

## Testes

`npm test` roda `node --test`, sem runner externo:

- `escada.test.mjs` — piso, teto, d20, passos compostos.
- `analise.test.mjs` — RA/RB, crítico, falha crítica, precedência sobre a DT.
- `i18n.test.mjs` — paridade pt-BR/en e chave inexistente usada no código.
- `carga.test.mjs` — todo módulo importa, todo template compila, manifesto consistente.

`module/tests/stub-foundry.mjs` tem stubs mínimos da API — o suficiente para carregar os
módulos fora do Foundry. Não simula comportamento: lógica de regra fica em módulos puros
(`dice/escada.mjs`, `dice/analise.mjs`) justamente para ser testável de verdade.

## Agentes

`.claude/agents/` tem briefings especializados. `.claude/commands/` tem `/feature`,
`/verify`, `/handoff` e `/rule`.

`AGENTS.md` é a cópia deste arquivo para o Kimi Code — **mantenha os dois em sincronia**.

## Regras em uma tela

Dois dados somados (perícia + atributo), DT padrão 7. Escada d4→d12; tudo é passo, nunca
`+N`. RA/RB = maior/menor valor rolado. Crítico = dois dados iguais ≥ 6, ignora DT. Falha
crítica = todos em 1, ignora DT, rola 1d8 na tabela. Até 4 dados rolados, 3 somados.
Investigação compara o *tamanho* do dado contra a DT, sem rolar; Examinar rola e custa
1 PD se não trouxer informação nova.
