# Ato II — como a aventura é montada

O Ato II não é público: o texto está no PDF do playtest (p. 72 a 103) e as artes no
zip `Ordem-2-Playtest-Alpha-Ato-II-Extras.zip`, que a editora entrega a quem assina.
Nada disso entra no repositório nem no pacote. O que entra é o que **nós** fizemos: o
extrator, o gerador, as paredes da cena, os cinco agentes transcritos das fichas e as
habilidades novas. **Quem monta a aventura é o mestre, dentro do Foundry** (janela
*Aventuras do playtest*, `module/aventura/`): o extrator (`module/extrator/ato-ii.mjs`)
e o gerador (`module/aventura/ato-ii.mjs`) rodam no navegador dele, do PDF dele.

Os mesmos módulos rodam no Node, para o e2e e para conferir uma revisão nova do PDF:

```bash
node scripts/extrator/rodar.mjs docs/<o PDF completo>.pdf [gabarito] --texto --completo
                                # PDF → build/js/ato-ii.json (e o Ato I junto)
npm run ato-ii:gerar-cena       # paredes do Ato I → packs/sources/ato-ii-cenas/
npm run ato-ii:gerar-aventura   # → packs/sources/ato-ii-aventura/ato-ii.json
npm run pack:build
```

`scripts/ato-ii/extrair-aventura.py` (`npm run ato-ii:extrair`) é o extrator Python
original, em cima do `pdftotext -layout`: fica como oráculo do gabarito — o JS é
byte-idêntico a ele na revisão 1 do PDF (`.claude/skills/revisar-extrator/SKILL.md`).

## O extrator

`module/extrator/ato-ii.mjs` reaproveita o leitor de quadro do Ato I e acrescenta o setor
**FERRAMENTAS** de cada ponto: o rótulo da ferramenta na coluna da esquerda, centralizado
sobre a leitura na coluna da direita, como a DT do quadro. A leitura de cada rótulo vai
do fim da anterior até o espelho desse começo em torno do centro do rótulo, e depois
até o fim do sub-bloco enquanto a linha estiver mais perto deste rótulo do que do
próximo.

Ele se confere sozinho e sai com erro se algo não bater:

- cada célula de DT impressa no quadro vira exatamente uma linha (63 no ato);
- cada ponto reage exatamente às ferramentas que a tabela **"Locais de uso de cada
  ferramenta"** (p. 75) diz — ✘ é leitura normal, célula vazia reage — com uma exceção
  registrada, o Ídolo, onde o texto dá reação à Lanterna UV e a tabela não;
- a lista do laser (p. 76) bate com a coluna do laser da tabela;
- os 25 pontos da legenda do mapa existem;
- a solução de cada Rádio Modificado usa peças que existem no conjunto.

## A cena

O mapa do Ato II é o mesmo porão redesenhado 3,9% maior, com a escada mais longa
(3537×4101 contra 3537×3750). As vigas das paredes foram medidas nos dois arquivos por
cor (pixels cáqui por linha e por coluna, picos = vigas): topo 105→109, base do porão
2255→2341, direita 3206→3330, esquerda 374→387. Escala uniforme a partir do canto
superior esquerdo — `x' = 1,0392·x − 2`, `y' = 1,0383·y` — e as 39 paredes muradas à mão
no Ato I viajam por ela (`gerar-cena.mjs`). Estante e porta de saída ficam abertas,
como o livro diz; a grade do duto segue trancada; as portas dos depósitos, fechadas e
destrancadas.

## Os agentes

`packs/sources/ato-ii-personagens/` são os cinco agentes transcritos das fichas do zip
(atributos, perícias, aptidões, PV/PD, habilidades). As habilidades novas entram no
compêndio de habilidades; Foco Mental (4 PD, +d8) e o Ímpeto de cinco espaços são
variantes de nível 6 e ficam só no ator.

## O importador

O compêndio aponta para `systems/ordem-paranormal-2e/assets/ato-ii/…`, que não existe.
Na importação, `module/ui/extras-aventura.mjs` pede o zip, descompacta no navegador
(`module/ui/zip.mjs`), sobe os arquivos para `worlds/<mundo>/ato-ii/` e troca o prefixo
nos documentos. A lista do que a aventura espera está em `flags.extras` do `Adventure`.
