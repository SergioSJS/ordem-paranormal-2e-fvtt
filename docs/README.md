# Documentação

| Pasta | O que tem |
|---|---|
| [`regras/`](regras/) | O que o jogo manda. |
| [`projeto/`](projeto/) | Como o sistema é feito e para onde vai. |
| [`img/`](img/) | Prints do README e da listagem. `system.json` aponta para cá pela URL: não renomear. |

## Regras

| Arquivo | Para quê |
|---|---|
| [`spec-alpha.md`](regras/spec-alpha.md) | **Modo moderno:** playtest alpha, Atos I e II. Citada como `spec §N` no código. |
| [`spec-beta.md`](regras/spec-beta.md) | **Modo Vigília:** playtest beta, Missões 1 e 2. Citada como `beta §N`. |
| [`alpha-para-beta.md`](regras/alpha-para-beta.md) | Os dois modos em paralelo: decisão, o que muda, onde bate no código. |
| [`LACUNAS.md`](regras/LACUNAS.md) | Ambiguidades, erros do livro e decisões. Beta na seção final. |
| [`GLOSSARIO.md`](regras/GLOSSARIO.md) | Nomes usados no código. |

## Projeto

| Arquivo | Para quê |
|---|---|
| [`ROADMAP.md`](projeto/ROADMAP.md) | Fases e critério de pronto. |
| [`ARQUITETURA.md`](projeto/ARQUITETURA.md) | Antes de criar arquivo novo. |
| [`ESTILO-VISUAL.md`](projeto/ESTILO-VISUAL.md) | Antes de mexer em CSS ou template. |
| [`PUBLICACAO.md`](projeto/PUBLICACAO.md) | Listagem do Foundry e versões. |

## Material da editora: nunca aqui

PDFs, zips, artes e tudo que contém texto do livro ficam em `jambo-arquivos/`, que o `.gitignore`
mantém fora do repositório. `docs/` só leva texto nosso.

```
jambo-arquivos/
├── playtest1/                     alpha
│   ├── v1/2-agenteelite-completo/ PDF e zips de cada ato (os scripts e o e2e usam este)
│   └── v2/{0-sobrevivente-gratuito,1-recruta-basico,2-agenteelite-completo}/  revisão 1.1
└── playtest2/                     beta
    └── v1/
        ├── 2-agenteelite-completo/  PDF, zips e pastas extraídas das missões
        └── extraido/                gerado: ver extraido/LEIAME.md
```

Para refazer a extração do beta: `scripts/beta/README.md`.
