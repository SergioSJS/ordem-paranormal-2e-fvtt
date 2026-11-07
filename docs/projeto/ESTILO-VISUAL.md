# Estilo visual

A linguagem vem da ficha oficial diagramada do playtest (PDF p.15) e das páginas de
regra (p.16). Nada de asset do livro é copiado — o que replicamos é **gramática visual**:
formas, proporções, cores e hierarquia.

## Paleta

Amostrada do PDF.

| Token | Valor | Uso |
|---|---|---|
| `--op2-preto` | `#0d0908` | fundo da ficha |
| `--op2-painel` | `#16100e` | painéis |
| `--op2-vermelho` | `#c8321e` | tags, molduras, ícones de dado |
| `--op2-vermelho-claro` | `#e0472f` | hover, ênfase |
| `--op2-tinta` | `#f2ede6` | texto |
| `--op2-tinta-fraca` | `#8a7f79` | texto secundário |
| `--op2-critico` | `#e8b53a` | sucesso crítico |
| `--op2-sucesso` | `#6f9a4e` | sucesso |

O tema claro (`#ece7df`) reproduz as páginas de regra do livro — papel, não interface.
O sistema segue o tema do Foundry; não força nenhum dos dois.

## Ícones de dado

**A assinatura do sistema.** O livro não escreve "d8": desenha a forma com o número
dentro. A silhueta comunica o tamanho antes de você ler o número.

| Dado | Forma |
|---|---|
| d4 | triângulo |
| d6 | quadrado |
| d8 | losango |
| d10 | pipa (pentágono alongado) |
| d12 | octógono |
| d20 | círculo — só via paranormal, fora do escopo do playtest |

Implementados em `module/ui/dice-icons.mjs` como SVG inline em viewBox `0 0 24 24`,
coloridos por CSS var. São polígonos regulares: geometria, não arte.

Estados: `--base` (dado antes de uma redução, cinza e menor, ao lado do efetivo),
`--descartado` (dado rolado que não entrou na soma, cinza e translúcido).

## Formas

**Tags rasgadas.** Todo rótulo do livro é uma tag vermelha com bordas tortas. Feito com
`clip-path: polygon(...)` de ângulos irregulares. Retângulo arredondado não é a linguagem
daqui — se você se pegar arredondando cantos, parou de seguir o livro.

**Moldura de canto.** A ficha oficial é emoldurada por linhas finas vermelhas que só
aparecem nos cantos. `.op2-moldura` faz isso com `mask-image` em duas direções.

**Pips.** PV e PD são trilhas de quadradinhos, não campos numéricos. São clicáveis:
clicar no pip N define o valor em N. Acima de 30 pontos a trilha some e sobra o número —
40 pips não são legíveis nem clicáveis.

## Tipografia

As fontes do livro (Arpona, ZeitungMicroPro, ZeitungMonoPro, Agharti) são comerciais.
Substituímos por equivalentes de papel tipográfico, sob OFL, empacotadas em
`assets/fonts/`.

| Papel | Livro | Nossa | Onde |
|---|---|---|---|
| Display | Agharti | Big Shoulders Display | títulos, tags, nomes, totais |
| Mono | ZeitungMonoPro | Cutive Mono | perícias, valores, metadados |
| Corpo | Arpona | Bitter | descrições, texto corrido |

A mono nas perícias não é estilo gratuito: é o que dá à coluna o ar de dossiê
datilografado do livro, e alinha os nomes numa lista longa.

## Layout da ficha

Duas colunas. A coluna de perícias fica **sempre visível** à direita — na diagramação
oficial ela nunca sai da vista, e é a parte da ficha mais consultada durante o jogo.

Cada linha de perícia mostra o **par** que será rolado:

```
ACROBACIA          ▲4  +  ■6   FÍSICO
```

Essa é a diferença que mais importa. Um seletor com o texto "d4" e o nome do atributo ao
lado carrega a mesma informação e comunica muito menos.

## Extraindo mais do PDF

```bash
pdftoppm -f 15 -l 15 -r 300 -png jambo-arquivos/playtest1/v1/2-agenteelite-completo/Ordem-*.pdf saida        # página inteira
pdftoppm -f 15 -l 15 -r 300 -x 100 -y 480 -W 620 -H 1400 -png jambo-arquivos/playtest1/v1/2-agenteelite-completo/Ordem-*.pdf recorte
pdffonts jambo-arquivos/playtest1/v1/2-agenteelite-completo/Ordem-*.pdf                                       # fontes usadas
```

Páginas úteis: **15** (ficha diagramada com legendas), **16** (escalas de atributo e
perícia com os ícones), **22** (exemplo de Ponto de Interesse, referência para a fase 2).

## Os dois temas do Foundry

O Foundry marca o tema do usuário com `theme-light`/`theme-dark` no `body` e em cada
janela (`themed theme-light`); no v14 também `:root[data-theme]`. O sistema segue o
tema, nunca força um:

- **Tudo passa pelos tokens** (`_tokens.scss`): `--op2-fundo`, `--op2-superficie`,
  `--op2-texto`, `--op2-linha`… O bloco `.theme-light .op2` redefine a paleta inteira,
  inclusive as variantes "claras" (`--op2-vermelho-claro`, `--op2-perfil-*-claro`) que
  existem para linha fina e rótulo sobre fundo escuro e viram cor cheia sobre fundo claro.
- **Cor fixa só quando é sinal, não tema**: texto branco sobre vermelho (`#fff
  !important` — o tema claro do core pinta `button`/`select` de escuro por cima).
  `--op2-tinta`/`--op2-painel`/`--op2-preto` são a paleta do livro, não superfícies:
  fora dos tokens, use `--op2-texto`/`--op2-superficie`/`--op2-fundo`.
- **Cabeçalho da janela** recebe `color: var(--op2-texto)` — o core supõe o header escuro
  dele e põe o título branco; o nosso é a superfície do tema.
- **Misturas com `color-mix`** usam `var(--op2-fundo)`, não `#000`: o vinho do diálogo
  vira rosa pálido no claro em vez de vinho com texto escuro em cima.
- **Selo da licença** em dois tons no HTML (`op2-selo--escuro`/`--claro`); o CSS mostra o
  do tema, sem JS.
- **Conferir nos dois**: `OP2_TEMA=light OP2_SAIDA=/tmp/claro node scripts/e2e/capturar.mjs`
  fotografa as telas no claro. Os prints do README são no escuro.

## Modo Vigília

O beta tem outra gramática, e o mundo no modo Vigília veste ela: `marcarModoNaTela()`
(`module/modo.mjs`) põe `op2-vigilia` no `<body>` no `init`, e `styles/parciais/_vigilia.scss`
redefine os tokens. O modo moderno não muda em nada. A fonte é a ficha de personagem do zip da
editora e as páginas de regra do beta (p. 16 é boa para o tema claro).

| | Alpha (moderno) | Beta (Vigília) |
|---|---|---|
| Fundo | preto liso `#0d0908` | carvão esverdeado `#0e1315`, com textura de giz |
| Acento (`--op2-vermelho`) | vermelho `#c8321e` | osso `#a6a395`; no claro, azul-petróleo `#2f5866` |
| Perfil | pinta a ficha (vermelho, azul, verde) | não pinta: tudo é prata |
| Rótulo | tag vermelha rasgada | faixa `#5f5e57` com nó celta nas pontas, que some atrás do texto |
| Moldura | linha vermelha só nos cantos | linha dupla de osso pela borda toda |
| Dado | vermelho, número branco | osso, número escuro (`--op2-sobre-acento`) |
| Título | Big Shoulders | IM Fell English SC, sem caixa alta (versalete) |
| Corpo, rótulo, perícia | Bitter, Cutive Mono | Barlow 400/700/800 |
| Tema claro | papel `#ece7df` | papel azul-acinzentado `#dde4e8` |

- **O nó, a moldura e o giz são desenhados no SCSS** (SVG em data URI): nada da arte do livro.
  O giz é só ruído fino em ladrilho; ruído largo em ladrilho mostra a emenda, então as manchas
  são `radial-gradient`.
- **Especificidade.** `body.op2-vigilia .op2` (0,2,1) ganha de `.op2[data-perfil]` (0,2,0); o
  bloco claro (`:root[data-theme="light"] body.op2-vigilia .op2`, 0,4,1) redefine tudo o que o
  claro do moderno redefine, senão o vermelho do alpha vaza.
- **Ícones do sistema** (`assets/icons`) viram prata por `filter: grayscale`; retrato e arte de
  quem joga ficam como estão.
- **Nome e atributos:** `.op2 input`/`button` herdam a fonte do corpo com mais especificidade
  que `.op2-nome`. No moderno isso sempre foi assim (o nome sai em Bitter); no Vigília o tema
  força a fonte de título nesses dois lugares.
- **Conferir:** o e2e confere a classe, o acento, a faixa e a fonte nos dois modos;
  `OP2_MODO=vigilia node scripts/e2e/capturar.mjs` fotografa a ficha do Vigília.
