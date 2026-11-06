# Extração do playtest beta

Ferramentas para ler o PDF do beta e conferir a leitura. **Tudo que elas produzem é texto do livro e
fica em `jambo-arquivos/playtest2/v1/extraido/`, fora do git.** O extrator que roda no jogo ainda não
existe (`docs/projeto/ROADMAP.md`, Fase 5): isto é a fonte de consulta e o gabarito dele.

```bash
E=jambo-arquivos/playtest2/v1/extraido
python3 scripts/beta/conferir-transcricao.py $E        # palavra a palavra, página a página
python3 scripts/beta/catalogar-pontos.py $E            # quadros de ponto → dados/pontos.json
python3 -I scripts/beta/relacoes-das-fichas.py <pdf das fichas> $E/dados/fichas.json   # requer Pillow
```

`conferir-transcricao.py` sai com erro se alguma página divergir. Os alertas aceitos estão em
`extraido/LEIAME.md`: são marcadores da transcrição (`[Leitura]`, `<br>`) e rótulos de mapa.

## Em revisão nova do PDF

1. Ponha os arquivos em `jambo-arquivos/playtest2/vN/`.
2. `pdftotext` por página (`-layout` e normal) e `pdftoppm -r 110 -png` em `extraido/paginas/`.
3. Transcreva e rode a conferência: a transcrição é por sub-agente, página por página, com a imagem
   mandando na ordem de leitura.
4. Confira as colunas de DT contra `pdftotext -bbox`: o multiconjunto de palavras não pega linha trocada.
