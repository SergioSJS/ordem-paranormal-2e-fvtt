#!/usr/bin/env python3
"""Compara a saída de `rodar-extrator.mjs` com a leitura conferida em `extraido/`.

    python3 scripts/beta/comparar-extrator.py build/beta.json

Quadros: DT, perícia, texto e descrição de cada ponto contra `dados/pontos.json`, sem diferença
aceita. Roteiro: ordem de leitura de cada página contra `livro/*.md`, por similaridade de palavras;
a transcrição tem marcadores e tabelas, então 1,0 não é a meta. Abaixo de 0,93 merece olhar a página.
Sai com erro se algum quadro divergir.
"""
import difflib
import glob
import json
import re
import sys
import unicodedata

EXTRAIDO = "jambo-arquivos/playtest2/v1/extraido"
MISSOES = ("missao-1", "missao-2")


def norm(texto):
    return re.sub(r"[\W_]+", " ", unicodedata.normalize("NFC", texto)).lower().strip()


def limpa(texto):
    return norm(re.sub(r"<!--.*?-->|\*\*\[Leitura\]\*\*|<br>|\|---[^\n]*", " ", texto, flags=re.S)).split()


saida = json.load(open(sys.argv[1], encoding="utf8"))
gabarito = json.load(open(f"{EXTRAIDO}/dados/pontos.json", encoding="utf8"))

diferentes = 0
for missao in MISSOES:
    print(missao, "páginas", saida[missao]["paginas"][0], saida[missao]["paginas"][-1], "avisos", saida[missao]["avisos"])
    for ponto, certo in zip(saida[missao]["pontos"], gabarito[missao]):
        dts = [l["dt"] for l in ponto["informacoes"]] == [l["dt"] for l in certo["linhas"]]
        textos = [norm(a["texto"]) == norm(b["informacao"]) for a, b in zip(ponto["informacoes"], certo["linhas"])]
        rotulos = [(a["rotulo"], b["pericia"]) for a, b in zip(ponto["informacoes"], certo["linhas"]) if norm(a["rotulo"]) != norm(b["pericia"])]
        descricao = norm(ponto["descricao"]) == norm(certo["descricao"])
        if dts and all(textos) and not rotulos and descricao:
            continue
        diferentes += 1
        print(" ", ponto["numero"], ponto["nome"], "DT", dts, "texto", f"{sum(textos)}/{len(textos)}", "rótulos", rotulos, "descrição", descricao)
print("pontos com diferença:", diferentes)

livro = "".join(open(f, encoding="utf8").read() for f in sorted(glob.glob(f"{EXTRAIDO}/livro/*.md")))
partes = re.split(r"<!-- p\.(\d+) -->", livro)
paginas = {int(partes[i]): partes[i + 1] for i in range(1, len(partes), 2)}
razoes = []
for missao in MISSOES:
    for bloco in saida[missao]["roteiro"]:
        if bloco["pagina"] not in paginas:
            continue
        lido = norm(" ".join(p["texto"] for p in bloco["paragrafos"])).split()
        razao = difflib.SequenceMatcher(None, lido, limpa(paginas[bloco["pagina"]]), autojunk=False).ratio()
        razoes.append(razao)
        if razao < 0.93:
            print(f"p. {bloco['pagina']}: ordem {razao:.3f}")
print(f"roteiro: média {sum(razoes) / len(razoes):.3f}, mínimo {min(razoes):.3f}, {len(razoes)} páginas")
sys.exit(1 if diferentes else 0)
