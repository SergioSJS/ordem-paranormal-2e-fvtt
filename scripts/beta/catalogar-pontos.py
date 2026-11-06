#!/usr/bin/env python3
"""Tira os quadros de ponto de interesse das transcrições do playtest beta para JSON.

Lê `<extraido>/livro/{10,11,20,21,22}-*.md` e escreve `<extraido>/dados/pontos.json`.
Serve de gabarito para o extrator das missões. A saída é texto do livro: fica em
jambo-arquivos/, fora do git, como a transcrição de onde vem.

Uso: python3 scripts/beta/catalogar-pontos.py jambo-arquivos/playtest2/v1/extraido
"""
import glob
import json
import os
import re
import sys

base = sys.argv[1]
titulo = re.compile(r"^###\s+(.+?)\s*\(?(\d{2}|\d\.\d)?\)?\s*$")
pagina = re.compile(r"<!-- p\.(\d+) -->")
LIMPA = re.compile(r"\*\*|(?<!\w)\*|\*(?!\w)")


def limpa(s):
    return LIMPA.sub("", s).replace("<br>", "\n").strip()


def ler_missao(arquivos):
    pontos = []
    atual = None
    em_contexto = False
    pag = None
    for arq in arquivos:
        for linha in open(arq, encoding="utf8"):
            linha = linha.rstrip("\n")
            m = pagina.match(linha)
            if m:
                pag = int(m.group(1))
                continue
            m = titulo.match(linha)
            if m and "RESUMO" not in linha.upper() and (m.group(2) or "CONTINUA" in linha):
                if "CONTINUA" in linha.upper():
                    em_contexto = False
                    continue
                numero = m.group(2)
                atual = {
                    "numero": numero,
                    "nome": limpa(m.group(1)),
                    "pagina": pag,
                    "descricao": "",
                    "linhas": [],
                    "contexto": [],
                }
                pontos.append(atual)
                em_contexto = False
                ultima_pericia = ""
                continue
            if atual is None:
                continue
            if linha.startswith("#"):  # título que não é ponto encerra o bloco
                atual = None
                continue
            if linha.startswith("|"):
                c = [x.strip() for x in linha.strip().strip("|").split("|")]
                if len(c) != 3 or c[0] == "Perícia" or (c[0] and set(c[0]) <= {"-"}) or not c[1].isdigit():
                    continue
                ultima_pericia = limpa(c[0]) or ultima_pericia
                atual["linhas"].append(
                    {"pericia": ultima_pericia, "dt": int(c[1]), "informacao": limpa(c[2])}
                )
            elif linha.startswith(">"):
                t = limpa(linha.lstrip("> "))
                if t:
                    atual["contexto"].append(t)
            elif linha.strip() and not atual["descricao"] and not atual["linhas"]:
                atual["descricao"] = limpa(linha)
    return pontos


saida = {}
for chave, prefixos in (("missao-1", ("10-", "11-")), ("missao-2", ("20-", "21-", "22-"))):
    arqs = sorted(
        a
        for p in prefixos
        for a in glob.glob(os.path.join(base, "livro", p + "*.md"))
    )
    saida[chave] = ler_missao(arqs)

with open(os.path.join(base, "dados", "pontos.json"), "w", encoding="utf8") as f:
    json.dump(saida, f, ensure_ascii=False, indent=1)

for chave, pts in saida.items():
    print(chave, len(pts), "pontos,", sum(len(p["linhas"]) for p in pts), "linhas")
    for p in pts:
        print(f"  {p['numero'] or '--':4s} {p['nome'][:28]:28s} p.{p['pagina']} dts={[l['dt'] for l in p['linhas']]}")
