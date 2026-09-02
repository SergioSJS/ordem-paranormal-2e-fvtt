"""Extrai as paredes do Porão comparando os três mapas publicados do Ato I.

Cada mapa acrescenta uma área ao anterior. A máscara "onde há chão" de cada arquivo,
subtraída da anterior, isola porão, sala secreta e duto. A borda da união vira parede;
a fronteira entre duas regiões vira porta secreta.
"""
import json, pathlib, hashlib, sys
from collections import deque
from PIL import Image, ImageDraw, ImageFilter

MAPAS = pathlib.Path("docs/Arquivos para o público - Ato I/Mapas")
SAIDA = pathlib.Path("packs/sources/ato-i-cenas")
ESCALA = 16         # px do original por célula da análise: ±16px de precisão,
                    # e a borda sai com dezenas de segmentos em vez de milhares
CORTE = 24          # acima disto é chão desenhado; abaixo é o vazio preto da arte
GRADE = 100         # px por casa — o duto tem ~92px, uma casa de largura


def mascara(caminho):
    """Onde há chão desenhado. A mediana fecha buraco de móvel escuro e apara o
    serrilhado da borda pintada — sem ela a parede vira uma escadinha de mil pedaços."""
    im = Image.open(caminho).convert("L")
    p = im.resize((im.width // ESCALA, im.height // ESCALA), Image.BOX)
    b = p.point(lambda v: 255 if v >= CORTE else 0)
    for _ in range(2):
        b = b.filter(ImageFilter.MedianFilter(3))
    return b.size, [v > 127 for v in list(b.getdata())]


def preencher_buracos(m, L, A):
    """Móveis escuros viram 'vazio' no corte; só a borda externa interessa."""
    fora = [False] * (L * A)
    fila = deque()
    for x in range(L):
        for y in (0, A - 1):
            i = y * L + x
            if not m[i] and not fora[i]: fora[i] = True; fila.append(i)
    for y in range(A):
        for x in (0, L - 1):
            i = y * L + x
            if not m[i] and not fora[i]: fora[i] = True; fila.append(i)
    while fila:
        i = fila.popleft()
        x, y = i % L, i // L
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < L and 0 <= ny < A:
                j = ny * L + nx
                if not m[j] and not fora[j]: fora[j] = True; fila.append(j)
    return [not f for f in fora]


MINIMO = 2  # aresta de uma célula só é ruído da borda pintada, não parede

def arestas(dentro, vizinho, L, A):
    """Arestas de célula onde `dentro` encosta em `vizinho`. Devolve segmentos unitários."""
    horizontais, verticais = [], []
    for y in range(A):
        for x in range(L):
            if not dentro[y * L + x]: continue
            if y == 0 or vizinho(x, y - 1): horizontais.append((x, y))
            if y == A - 1 or vizinho(x, y + 1): horizontais.append((x, y + 1))
            if x == 0 or vizinho(x - 1, y): verticais.append((x, y))
            if x == L - 1 or vizinho(x + 1, y): verticais.append((x + 1, y))
    return horizontais, verticais


def juntar(horizontais, verticais):
    """Une arestas colineares contíguas: 4 mil segmentos unitários viram dezenas."""
    segmentos = []
    porLinha = {}
    for x, y in horizontais: porLinha.setdefault(y, set()).add(x)
    for y, xs in porLinha.items():
        for ini, fim in _corridas(sorted(xs)):
            if fim - ini + 1 >= MINIMO: segmentos.append((ini, y, fim + 1, y))
    porColuna = {}
    for x, y in verticais: porColuna.setdefault(x, set()).add(y)
    for x, ys in porColuna.items():
        for ini, fim in _corridas(sorted(ys)):
            if fim - ini + 1 >= MINIMO: segmentos.append((x, ini, x, fim + 1))
    return segmentos


def _corridas(valores):
    corridas, ini, ant = [], None, None
    for v in valores:
        if ini is None: ini = ant = v
        elif v == ant + 1: ant = v
        else: corridas.append((ini, ant)); ini = ant = v
    if ini is not None: corridas.append((ini, ant))
    return corridas


def parede(seg, secreta=False):
    x1, y1, x2, y2 = (v * ESCALA for v in seg)
    return {
        "c": [x1, y1, x2, y2],
        # Porta secreta: invisível para o jogador até o mestre abrir (spec do Ato I —
        # a sala e o duto só existem depois que o grupo os encontra).
        "door": 2 if secreta else 0,
        "ds": 0, "move": 20, "sense": 20, "sound": 20, "light": 20, "dir": 0, "threshold": {},
    }


def main():
    arquivos = sorted(MAPAS.glob("*.jpg"))
    assert len(arquivos) == 3, f"esperava 3 mapas, achei {len(arquivos)}"
    (L, A), m1 = mascara(arquivos[0])
    _, m2 = mascara(arquivos[1])
    _, m3 = mascara(arquivos[2])

    porao = preencher_buracos(m1, L, A)
    ate_sala = preencher_buracos(m2, L, A)
    tudo = preencher_buracos(m3, L, A)
    sala = [b and not a for a, b in zip(porao, ate_sala)]
    duto = [c and not b for b, c in zip(ate_sala, tudo)]

    em = lambda m: (lambda x, y: m[y * L + x])
    vazio = lambda x, y: not tudo[y * L + x]

    # Perímetro: onde o chão encosta no vazio da arte.
    h, v = arestas(tudo, vazio, L, A)
    paredes = [parede(s) for s in juntar(h, v)]

    # Fronteiras entre as áreas: passagens que o grupo ainda não descobriu.
    for regiao, outra in ((porao, sala), (sala, duto), (porao, duto)):
        h, v = arestas(regiao, em(outra), L, A)
        paredes += [parede(s, secreta=True) for s in juntar(h, v)]

    largura, altura = Image.open(arquivos[2]).size
    ident = hashlib.sha1(b"ato-i-porao").hexdigest()[:16]
    cena = {
        "_id": ident, "_key": f"!scenes!{ident}",
        "name": "O Porão — Ato I",
        "width": largura, "height": altura,
        # Sem padding: com ele o Foundry desloca o fundo e as paredes, calculadas em
        # coordenada da imagem, caem fora da arte (achado ao conferir a cena rodando).
        "padding": 0, "backgroundColor": "#000000",
        "background": {"src": "op2-ato-i/mapas/mapa-03-o-porao-sala-secreta-duto-de-ventilacao-completo.jpg"},
        "grid": {"type": 1, "size": GRADE, "distance": 1.5, "units": "m", "alpha": 0.15},
        # Visão por token e névoa ligadas: é o que faz as paredes valerem alguma coisa.
        # A escuridão fica em 0 — importar uma cena toda preta parece defeito, e subir
        # o escuro é um controle que o mestre já conhece.
        "tokenVision": True, "fog": {"exploration": True},
        "environment": {"globalLight": {"enabled": True}, "darknessLevel": 0},
        "walls": paredes,
        "flags": {}, "folder": None, "sort": 0, "ownership": {"default": 0},
    }
    SAIDA.mkdir(parents=True, exist_ok=True)
    destino = SAIDA / "porao.json"
    # A cena do compêndio hoje é a que o mestre muralhou à mão, trazida por
    # `npm run ato-i:cena` — bem melhor do que esta conta consegue. Regerar por cima
    # apagaria esse trabalho, então exige `--forcar`.
    if destino.exists() and "--forcar" not in sys.argv:
        print(f"{destino} já existe e provavelmente é a cena feita à mão.")
        print("Use --forcar para sobrescrever, ou npm run ato-i:cena para atualizar a partir do seu mundo.")
        return
    for i, p in enumerate(cena["walls"]):
        p["_id"] = hashlib.sha1(f"parede-{i}".encode()).hexdigest()[:16]
        p["_key"] = f'!scenes.walls!{ident}.{p["_id"]}'
    destino.write_text(json.dumps(cena, ensure_ascii=False, indent=2) + "\n")

    # Conferência: as paredes desenhadas por cima da arte, para olhar antes de confiar.
    arte = Image.open(arquivos[2]).convert("RGB")
    caneta = ImageDraw.Draw(arte)
    for p in paredes:
        x1, y1, x2, y2 = p["c"]
        cor = (255, 210, 40) if p["door"] == 2 else (60, 200, 255)
        caneta.line((x1, y1, x2, y2), fill=cor, width=10)
    arte.resize((arte.width // 2, arte.height // 2)).save("/tmp/paredes.png")

    secretas = sum(1 for p in paredes if p["door"] == 2)
    print(f"cena: {largura}x{altura}, grade {GRADE}px")
    print(f"paredes: {len(paredes)} ({len(paredes) - secretas} de perímetro, {secretas} portas secretas)")


if __name__ == "__main__":
    main()
