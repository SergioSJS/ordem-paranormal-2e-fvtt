# Extração do playtest beta

Ferramentas para ler o PDF do beta e conferir a leitura. **Tudo que elas produzem é texto do livro e
fica em `jambo-arquivos/playtest2/v1/extraido/`, fora do git.** É a fonte de consulta e o gabarito do
extrator que roda no jogo (`module/extrator/missoes.mjs`).

```bash
E=jambo-arquivos/playtest2/v1/extraido
python3 scripts/beta/conferir-transcricao.py $E        # palavra a palavra, página a página
python3 scripts/beta/catalogar-pontos.py $E            # quadros de ponto → dados/pontos.json
python3 -I scripts/beta/relacoes-das-fichas.py <pdf das fichas> $E/dados/fichas.json   # requer Pillow
```

O extrator do jogo se confere contra esse gabarito, sem Foundry no ar:

```bash
node scripts/beta/rodar-extrator.mjs <pdf> build/beta.json   # usa o pdf.js do Foundry instalado; OP2_PDFJS troca
python3 scripts/beta/comparar-extrator.py build/beta.json    # quadros sem diferença; roteiro por similaridade
```

Os pré-gerados e as habilidades saem de `dados/fichas.json`, sem histórico (é texto do livro):

```bash
node scripts/beta/gerar-personagens.mjs   # packs/sources/vigilia-personagens e habilidades-vigilia
```

`conferir-transcricao.py` sai com erro se alguma página divergir. Os alertas aceitos estão em
`extraido/LEIAME.md`: são marcadores da transcrição (`[Leitura]`, `<br>`) e rótulos de mapa.

## Em revisão nova do PDF

1. Ponha os arquivos em `jambo-arquivos/playtest2/vN/`.
2. `pdftotext` por página (`-layout` e normal) e `pdftoppm -r 110 -png` em `extraido/paginas/`.
3. Transcreva e rode a conferência: a transcrição é por sub-agente, página por página, com a imagem
   mandando na ordem de leitura.
4. Confira as colunas de DT contra `pdftotext -bbox`: o multiconjunto de palavras não pega linha trocada.
5. Rode `rodar-extrator.mjs` e `comparar-extrator.py`, e o e2e com `OP2_E2E_PDF_BETA` apontando para o PDF novo.

### A revisão 1.1 (novembro/2026)

A 1.1 rediagramou o livro (`jambo-arquivos/playtest2/v1.1/`). A leitura de referência (`extraido/`) é da 1.0;
o que a 1.1 mudou está em `docs/regras/LACUNAS.md`, "Playtest beta: revisão 1.1". Para conferir as duas:

```bash
node scripts/beta/rodar-extrator.mjs <pdf 1.0> build/beta-v1.json && python3 scripts/beta/comparar-extrator.py build/beta-v1.json
node scripts/beta/rodar-extrator.mjs <pdf 1.1> build/beta-v11.json   # 16 + 27 linhas, sem aviso
```

O e2e lê a 1.1 por padrão; `OP2_E2E_BETA=1.0` lê a 1.0. As correções das fichas 1.1 entram em
`gerar-personagens.mjs` pela tabela de `module/aventura/revisao-beta.mjs`, que também corrige mundos já importados.

