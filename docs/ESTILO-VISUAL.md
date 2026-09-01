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
pdftoppm -f 15 -l 15 -r 300 -png docs/Ordem-*.pdf saida        # página inteira
pdftoppm -f 15 -l 15 -r 300 -x 100 -y 480 -W 620 -H 1400 -png docs/Ordem-*.pdf recorte
pdffonts docs/Ordem-*.pdf                                       # fontes usadas
```

Páginas úteis: **15** (ficha diagramada com legendas), **16** (escalas de atributo e
perícia com os ícones), **22** (exemplo de Ponto de Interesse, referência para a fase 2).
