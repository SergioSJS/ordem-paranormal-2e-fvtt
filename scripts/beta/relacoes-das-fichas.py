#!/usr/bin/env python3
"""Lê o grau das relações nas fichas do playtest beta e grava em fichas.json.

O grau é desenhado (três círculos, com ponto no centro os marcados) e não existe como
texto no PDF. Para cada linha de RELAÇÕES, localiza o nome com `pdftotext -bbox`, rasteriza
a página e conta os círculos com miolo aceso. Falha se um NEUTRO sair com grau. Requer
Pillow.

Uso: relacoes-das-fichas.py <pdf das fichas> <fichas.json>
"""
import html
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

pdf, destino = sys.argv[1], sys.argv[2]
DPI = 288
ESCALA = DPI / 72
NOMES = {"RHIONA", "ROWAN", "MUIRENN", "CAVAN", "MALIK", "SIRA", "SORCHA", "CORMAC"}
fichas = json.load(open(destino, encoding="utf8"))

for ficha in fichas:
    n = ficha["pagina_historico"]
    xml = subprocess.run(
        ["pdftotext", "-f", str(n), "-l", str(n), "-bbox", pdf, "-"],
        capture_output=True,
        text=True,
    ).stdout
    palavras = [
        (float(a), float(b), float(c), float(d), html.unescape(t))
        for a, b, c, d, t in re.findall(
            r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]+)</word>', xml
        )
    ]
    y_titulo = next(p[1] for p in palavras if p[4] == "RELAÇÕES")
    # Agrupa em linhas com tolerância: nome e versalete têm corpos diferentes.
    linhas = []
    for p in sorted((w for w in palavras if w[1] > y_titulo + 4), key=lambda w: (w[1] + w[3]) / 2):
        meio = (p[1] + p[3]) / 2
        if linhas and abs(linhas[-1][0] - meio) < 3.5:
            linhas[-1][1].append(p)
        else:
            linhas.append([meio, [p]])
    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp) / "p"
        subprocess.run(
            ["pdftoppm", "-f", str(n), "-l", str(n), "-r", str(DPI), "-png", "-singlefile", pdf, str(base)],
            capture_output=True,
        )
        img = Image.open(str(base) + ".png").convert("L")
    relacoes = []
    for _, ws in linhas:
        ws = sorted(ws)
        if ws[0][4] not in NOMES:
            if relacoes:  # linha quebrada: continuação do texto anterior
                relacoes[-1]["texto"] = (relacoes[-1]["texto"] + " " + " ".join(w[4] for w in ws)).strip()
            continue
        # Entre o nome e o rótulo há 50 pt com os círculos, que o PDF às vezes expõe como
        # glifo solto: o rótulo é a primeira palavra depois desse vão.
        x0 = ws[0][2]
        resto = [w for w in ws[1:] if w[0] > x0 + 30]
        x1 = resto[0][0]
        cy = (ws[0][1] + ws[0][3]) / 2
        # Três círculos vazados dão 6 bordas na linha que os corta ao meio; cada miolo
        # aceso soma uma faixa. Testa algumas linhas perto do centro e fica com a que
        # enxerga os três círculos inteiros (ao menos 6 faixas).
        grau = None
        for dy in (0, -0.4, 0.4, -0.8, 0.8, -1.2, 1.2):
            y_px = int((cy + dy) * ESCALA)
            faixa = img.crop((int(x0 * ESCALA) + 2, y_px, int(x1 * ESCALA) - 2, y_px + 1)).tobytes()
            faixas = sum(1 for a, b in zip(b"\0" + faixa, faixa) if a <= 120 < b)
            if faixas >= 6:
                grau = max(grau or 0, faixas - 6)
        if grau is None or grau > 3:
            raise SystemExit(f"grau ilegível: p.{n} {ws[0][4]} (faixas={faixas})")
        texto = " ".join(w[4] for w in resto)
        m = re.match(r"(?:[A-ZÀ-Ý]+: )?([A-ZÀ-Ý ]+?)\.\s*(.*)", texto)
        relacoes.append(
            {
                "com": ws[0][4].title(),
                "grau": grau,
                "rotulo": m.group(1).strip() if m else "",
                "texto": m.group(2).strip() if m else texto,
            }
        )
    if any(r["rotulo"] == "NEUTRO" and r["grau"] for r in relacoes):
        raise SystemExit(f"NEUTRO com grau: p.{n} {relacoes}")
    ficha["relacoes"] = relacoes
    print(ficha["nome"][:22], [(r["com"], r["grau"], r["rotulo"]) for r in relacoes])

json.dump(fichas, open(destino, "w", encoding="utf8"), ensure_ascii=False, indent=2)
