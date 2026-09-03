#!/usr/bin/env python3
"""Extrai o Ato II do PDF do playtest (p. 72 a 103) para `build/ato-ii.json`.

    python3 scripts/ato-ii/extrair-aventura.py

Reaproveita o leitor de quadro do Ato I (`scripts/ato-i/extrair-aventura.py`): o quadro
Perícia · DT · Informação é o mesmo. O que o Ato II acrescenta é o setor FERRAMENTAS de
cada ponto — rótulo da ferramenta na coluna da esquerda, centralizado sobre a leitura na
coluna da direita, como a DT do quadro — mais o roteiro do ato, as mecânicas das
ferramentas para o mestre e a matriz "Locais de uso de cada ferramenta", que serve de
conferência: cada ponto reage exatamente às ferramentas que o texto descreve.

O texto é da editora: `build/` não vai para o repositório.
"""
import importlib.util
import json
import pathlib
import re
import sys
import unicodedata

AQUI = pathlib.Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("ato_i", AQUI.parent / "ato-i" / "extrair-aventura.py")
ato_i = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ato_i)

SAIDA = pathlib.Path("build/ato-ii.json")

# --------------------------------------------------------------------- utilidades --

def recuo(linha):
    return len(linha) - len(linha.lstrip())


def limpo(texto):
    return re.sub(r"\s{2,}", " ", texto).strip()


def sem_acento(texto):
    return "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")


def paragrafos(linhas):
    """Linhas do PDF → parágrafos: linha em branco separa, hifenização volta a juntar."""
    blocos, atual = [], []
    for l in linhas:
        if l.strip():
            atual.append(l.strip())
        elif atual:
            blocos.append(atual); atual = []
    if atual:
        blocos.append(atual)
    return juntar_quebras([ato_i.juntar_hifenizacao("\n".join(b)).replace("\n", " ") for b in blocos])


def juntar_quebras(paragrafos):
    """Parágrafo que não termina em pontuação seguido de um que começa em minúscula é
    a mesma frase, cortada pela quebra de coluna ou de página."""
    saida = []
    for par in paragrafos:
        if saida and not re.search(r"[.!?…”:;)]$", saida[-1]) and par[:1].islower():
            saida[-1] = f"{saida[-1]} {par}"
        else:
            saida.append(par)
    return saida


def indice(linhas, padrao, a_partir=0):
    rx = re.compile(padrao)
    for i in range(a_partir, len(linhas)):
        if rx.match(linhas[i]):
            return i
    raise ValueError(f"não achei {padrao!r}")


def entre(linhas, inicio, fim, a_partir=0):
    a = indice(linhas, inicio, a_partir)
    b = indice(linhas, fim, a + 1)
    return linhas[a + 1:b], a, b


PAGINA = re.compile(r"^\s{30,}\d{1,3}\s*$")


def sem_paginas(linhas):
    return [l for l in linhas if not PAGINA.match(l)]


# ----------------------------------------------------------------- o trecho do ato --

def trecho_do_ato_ii():
    linhas = ato_i.texto_do_pdf()
    ini = next(i for i, l in enumerate(linhas) if l.startswith("O Ato II continua e conclui"))
    # O título "ATO / II" vem em duas linhas logo antes.
    return linhas[ini - 4:]


# ----------------------------------------------------------------------- roteiro --

def texto_de(linhas, coluna_minima=44):
    cru = ato_i.linearizar_duas_colunas(sem_paginas(linhas), coluna_minima=coluna_minima)
    return paragrafos(cru)


def ler_preparacao(linhas):
    bloco, a, _ = entre(linhas, r"^\s*PREPARAÇÃO\b", r"^MECÂNICAS DE\s*$")
    # A caixa lateral ("Se você é jogador, PARE DE LER AGORA") começa na linha do título.
    bloco = [linhas[a].replace("PREPARAÇÃO", " " * 10)] + bloco
    # Os nomes dos pré-gerados ficam soltos embaixo das fichas ilustradas.
    bloco = [l for l in bloco if not re.fullmatch(r"\s*(Amanda|Heitor|Val|Raven|Antônio)\s*", l)]
    return texto_de(bloco, coluna_minima=60)


def ler_mecanicas(linhas):
    """Instruções de mestre por ferramenta (p. 74 e 76), na ordem do livro."""
    a = indice(linhas, r"^MECÂNICAS DE\s*$")
    # A matriz da p. 75 começa pelo cabeçalho girado ("Lanterna de", bem à direita).
    b = indice(linhas, r"^\s{40,}Lanterna de\s*$", a)
    c = indice(linhas, r"^LASER DE VARREDURA\b", b)
    d = indice(linhas, r"^VITÓRIA E DERROTA\s*$", c)
    intro = paragrafos(sem_paginas(linhas[a + 2:a + 12]))
    # Cada página tem duas colunas; linearizar antes de cortar por título.
    corpo = ato_i.linearizar_duas_colunas(sem_paginas(linhas[a + 12:b]), coluna_minima=44) \
        + ato_i.linearizar_duas_colunas(sem_paginas(linhas[c:d]), coluna_minima=44)
    TITULOS = {
        "COMPÊNDIO DA ORDEM": "compendio", "LABORATÓRIO PORTÁTIL": "laboratorio",
        "CÂMERA MODIFICADA": "camera", "LANTERNA DE ESTOURO ULTRAVIOLETA": "lanternaUV",
        "LASER DE VARREDURA": "laser", "MEDIDOR EMF": "emf", "LEITOR INFRAVERMELHO": "infravermelho",
        "PÓ REVELADOR": "poRevelador", "RÁDIO MODIFICADO": "radio", "TERMÔMETRO DIFERENCIAL": "termometro",
    }
    secoes, atual = [], None
    i = 0
    while i < len(corpo):
        l = corpo[i].strip()
        titulo = l
        # "LANTERNA DE" / "ESTOURO ULTRAVIOLETA": título em duas linhas.
        if l == "LANTERNA DE" and i + 1 < len(corpo):
            titulo = f"{l} {corpo[i + 1].strip()}"; i += 1
        if titulo in TITULOS:
            atual = {"chave": TITULOS[titulo], "titulo": titulo.title(), "linhas": []}
            secoes.append(atual)
        elif atual is not None:
            atual["linhas"].append(corpo[i])
        i += 1
    for s in secoes:
        pars = paragrafos(s.pop("linhas"))
        if s["chave"] == "laser":
            pars = [par for par in pars if not re.match(r"Lista de pontos|PORÃO|SALA SECRETA|\d+ - ", par)]
        if s["chave"] == "radio":
            pars = [par for par in pars if not re.match(r"Resultado\s+Efeito|\d+(\s*-\s*\d+)? |\d+ ou (menos|mais)", par)]
        s["paragrafos"] = pars
    # A tabela do Rádio vem repetida como título dentro da própria seção ("RÁDIO MODIFICADO
    # / Resultado / Efeito"): já é a mesma seção, não abre outra.
    unidas = []
    for s in secoes:
        if unidas and unidas[-1]["chave"] == s["chave"]:
            unidas[-1]["paragrafos"] += s["paragrafos"]
        else:
            unidas.append(s)
    return intro, unidas


FERRAMENTAS_DA_MATRIZ = [
    ("Câmera", "camera"), ("Laboratório", "laboratorio"), ("Estouro Ultravioleta", "lanternaUV"),
    ("Laser de Varredura", "laser"), ("Infravermelho", "infravermelho"), ("Medidor EMF", "emf"),
    ("Pó Revelador", "poRevelador"), ("Rádio Modificado", "radio"), ("Ter", "termometro"),
]


def ler_matriz(linhas):
    """'Locais de uso de cada ferramenta' (p. 75): ✘ é leitura normal; célula vazia reage.

    Devolve {número do ponto: [chaves das ferramentas que reagem]} e a lista de pontos em
    que "todas as ferramentas resultam em leitura normal".
    """
    a = indice(linhas, r"^\s*LOCAIS DE USO\s*$") - 6
    b = indice(linhas, r"^LASER DE VARREDURA\b", a)
    bloco = linhas[a:b]
    centros = {}
    for l in bloco[:10]:
        for rotulo, chave in FERRAMENTAS_DA_MATRIZ:
            pos = l.find(rotulo)
            if pos >= 0 and chave not in centros:
                centros[chave] = pos + len(rotulo) / 2
    assert len(centros) == 9, centros
    matriz = {}
    for l in bloco:
        m = re.match(r"^(\d{1,2})\.\s+(.+?)\s{2,}", l)
        if not m or "✘" not in l:
            continue
        marcadas = {min(centros, key=lambda c: abs(centros[c] - i)) for i, ch in enumerate(l) if ch == "✘"}
        matriz[int(m.group(1))] = [c for _, c in FERRAMENTAS_DA_MATRIZ if c not in marcadas]
    normais = [int(m.group(1)) for l in bloco if (m := re.match(r"^\s{40,}(\d{1,2}) - ", l))]
    return matriz, normais


def ler_laser(linhas):
    """Os pontos que a varredura do laser identifica, por ambiente (p. 76)."""
    a = indice(linhas, r"^LASER DE VARREDURA\b")
    b = indice(linhas, r"^LEITOR INFRAVERMELHO\b", a)
    esquerda = [l[:58] for l in linhas[a:b]]
    saida, ambiente = {"porao": [], "salaSecreta": []}, None
    for l in esquerda:
        t = l.strip()
        if t == "PORÃO": ambiente = "porao"
        elif t == "SALA SECRETA": ambiente = "salaSecreta"
        elif ambiente and (m := re.match(r"^(\d{1,2}) - ", t)):
            saida[ambiente].append(int(m.group(1)))
    return saida


def ler_vitoria(linhas):
    bloco, _, _ = entre(linhas, r"^VITÓRIA E DERROTA\s*$", r"^\s*SOBRECARGA MENTAL\s*$")
    return paragrafos(sem_paginas(bloco))


def ler_introducao(linhas):
    a = indice(linhas, r"^VITÓRIA E DERROTA\s*$")
    bloco, _, _ = entre(linhas, r"^INTRODUÇÃO\s*$", r"^O ÍDOLO DE PEDRA, ATO II\s*$", a)
    return paragrafos(sem_paginas(bloco))


def ler_cena_inicial(linhas):
    a = indice(linhas, r"^O ÍDOLO DE PEDRA, ATO II\s*$")
    b = indice(linhas, r"^\s*Porão\s{4,}", a)
    # A narração vem em coluna diagonal (recuo crescente): só o texto interessa.
    bruto = [l for l in linhas[a + 1:b] if l.strip() and not re.fullmatch(r"[\s\d()noteto]+", l)]
    return paragrafos(bruto)


def ler_legenda(linhas):
    a = indice(linhas, r"^\s*Porão\s{4,}")
    b = indice(linhas, r"^PONTOS DE INTERESSE\s*$", a)
    legenda = {}
    for l in linhas[a:b]:
        for n, nome in re.findall(r"(\d{1,2})\.\s+([^\d]+?)(?=\s{2,}|\s*$)", l):
            legenda[int(n)] = limpo(nome)
    return legenda


def ler_secao(linhas, inicio, fim, a_partir=0):
    bloco, _, _ = entre(linhas, inicio, fim, a_partir)
    return paragrafos(sem_paginas(bloco))


def ler_narracao_final(linhas):
    a = indice(linhas, r"^NARRAÇÃO FINAL\s*$")
    b = indice(linhas, r"^A RESPOSTA CORRETA\s*$", a)
    bruto = sem_paginas(linhas[a + 1:b])
    # A caixa "FUGINDO" fica na coluna da direita, a partir da coluna 62 — e só a
    # partir da linha do título dela; antes disso a página é de uma coluna só.
    corte = 62
    k = next((i for i, l in enumerate(bruto) if l.strip() == "FUGINDO" or l[corte:].strip() == "FUGINDO"), len(bruto))
    esquerda = bruto[:k] + [l[:corte].rstrip() for l in bruto[k:]]
    direita = [l[corte:].strip() for l in bruto[k + 1:] if len(l) > corte and l[corte:].strip()]
    return paragrafos(esquerda), paragrafos(direita)


def ler_resposta(linhas):
    a = indice(linhas, r"^A RESPOSTA CORRETA\s*$")
    b = indice(linhas, r"^PRÓXIMOS PASSOS\s*$", a)
    return paragrafos(ato_i.linearizar_duas_colunas(sem_paginas(linhas[a + 1:b]), coluna_minima=44))


# ------------------------------------------------------------------------ pontos --

TITULO_DE_PONTO = re.compile(r"^(\s*)([A-ZÁÂÃÉÊÍÓÔÕÚÇ“”][A-ZÁÂÃÉÊÍÓÔÕÚÇ0-9 ,“”\-–()]{2,60}?)\s*$")
NUMERO_NA_MARGEM = re.compile(r"\s{2,}(\d{2})\s*$")
SECOES = {"PORÃO": "porao", "A SALA SECRETA": "salaSecreta", "A MALDIÇÃO DO ÍDOLO DE PEDRA": "caixaMaldicao"}
FIM_DOS_PONTOS = re.compile(r"^NARRAÇÃO FINAL\s*$")
CABECALHO = ato_i.CABECALHO
ABRE_CAIXA = re.compile(r"^\s{0,4}DESAFIO\s*$|\(DT\s*\d|\bPA\s*\d|\bROLAGEM\b|\bEQUAÇÃO\b|HACK\s+TÉCNICO")


def eh_titulo_de_ponto(linhas, i):
    m = TITULO_DE_PONTO.match(linhas[i])
    if not m or m.group(2).strip() in SECOES or "CONTINUAÇÃO" in linhas[i]:
        return False
    for proxima in linhas[i + 1:i + 5]:
        if NUMERO_NA_MARGEM.search(proxima) and not proxima.strip().isupper():
            return True
    return False


def blocos_por_linha_vazia(linhas, base=0):
    """[(inicio, fim)] de cada bloco de linhas não vazias, com índices relativos."""
    saida, ini = [], None
    for k, l in enumerate(linhas + [""]):
        if l.strip() and ini is None: ini = k
        elif not l.strip() and ini is not None:
            saida.append((base + ini, base + k)); ini = None
    return saida


COLA_DA_CAIXA = {"DESAFIO", "DE ACESSO", "DE ACESSO:", "ROLAGEM", "EQUAÇÃO"}


def rotulo_da_caixa(caixa):
    """O nome do obstáculo na coluna da esquerda da caixa, juntando as sílabas que o
    livro quebra com hífen ("COMPUTA- / DOR DESOR- / GANIZADO")."""
    nome = ""
    for l in caixa:
        if recuo(l) > 4 or not l.strip():
            continue
        pedaco = re.sub(r"[\ue000-\uf8ff•]", "", re.split(r"\s{2,}", l.strip())[0]).strip()
        pedaco = re.sub(r"\s*\(HACK.*$", "", pedaco).strip()
        if not pedaco or pedaco in COLA_DA_CAIXA or not pedaco.isupper() or "(" in pedaco or ")" in pedaco:
            continue
        nome = nome[:-1] + pedaco if nome.endswith("-") else f"{nome} {pedaco}".strip()
    return nome.rstrip("-").title()


def separar_caixa(linhas):
    """Tira do meio do ponto o quadro lateral de desafio, que é impresso dentro da
    tabela (o símbolo no teto, a grade do duto) ou logo antes dela (o painel, o
    computador). Devolve (linhas sem a caixa, linhas da caixa)."""
    caixa, resto = [], list(linhas)
    blocos = blocos_por_linha_vazia(linhas)
    for a, b in reversed(blocos):
        bloco = linhas[a:b]
        if any(ABRE_CAIXA.search(l) for l in bloco):
            # No primeiro bloco do ponto a descrição pode vir colada acima da caixa (o
            # painel elétrico) e fica; nos outros, tudo antes do marcador é da caixa (a
            # frase do símbolo alto, impressa dentro da tabela). O cabeçalho do quadro
            # fica sempre.
            inicio = next(k for k, l in enumerate(bloco) if ABRE_CAIXA.search(l)) if (a, b) == blocos[0] else 0
            antes, dentro = bloco[:inicio], bloco[inicio:]
            fica = antes + [l for l in dentro if CABECALHO.match(l)]
            caixa = [l for l in dentro if not CABECALHO.match(l)] + caixa
            resto[a:b] = fica
    return resto, caixa


ROTULOS_DE_FERRAMENTA = {
    "laboratório": "laboratorio", "lanterna": "lanternaUV", "leitor": "infravermelho",
    "câmera": "camera", "medidor emf": "emf", "pó revelador": "poRevelador", "rádio": "radio",
    "termômetro": "termometro",
}
PEDACO_DE_ROTULO = re.compile(
    r"^(Laboratório|Portátil|Sequência|[Mm]ínima:|exigida:|Lanterna|de Estouro|Ultravioleta|Leitor"
    r"|Infravermelho|Câmera|Modificad[ao]|Medidor EMF|Pó Revelador|Rádio|Termômetro|Diferencial"
    r"|\(apenas se|o Ídolo for|quebrado\))")


def ler_ferramentas(linhas):
    """O setor FERRAMENTAS de um ponto → ([{chave, texto, ...}], leitura normal, sobra).

    Os rótulos moram na coluna mais à esquerda do setor e a leitura numa coluna à
    direita, ~17 colunas adiante; o texto de mestre que vem depois volta para a
    margem do ponto — e, quando não volta (o computador), é largo demais para a
    coluna da leitura.
    """
    if "Todas as ferramentas" in " ".join(linhas[:6]):
        ini = next(k for k, l in enumerate(linhas) if "Todas as ferramentas" in l)
        fim = next((k for k in range(ini, len(linhas)) if not linhas[k].strip()), len(linhas))
        return [], limpo(" ".join(linhas[ini:fim])), linhas[fim:]

    candidatos = [recuo(l) for l in linhas if l.strip() and PEDACO_DE_ROTULO.match(l.strip())]
    col_rotulo = min(candidatos) if candidatos else 0
    def eh_rotulo(l):
        return bool(l.strip()) and recuo(l) <= col_rotulo + 2 and bool(PEDACO_DE_ROTULO.match(l.strip()))
    def inicio_do_texto(l):
        if eh_rotulo(l):
            m = re.match(r"^\s*\S.*?\s{2,}(?=\S)", l)
            return len(m.group(0)) if m else None
        return recuo(l)

    col_texto, fim = None, len(linhas)
    for a, b in blocos_por_linha_vazia(linhas):
        bloco = linhas[a:b]
        if col_texto is None:
            longas = [inicio_do_texto(l) for l in bloco if len(l.strip()) >= 30 and inicio_do_texto(l) is not None]
            if longas:
                col_texto = min(longas)
        if any(eh_rotulo(l) for l in bloco):
            continue
        if col_texto is None:
            continue
        recuado = min(recuo(l) for l in bloco) >= col_texto - 3
        estreito = max(len(l.rstrip()) for l in bloco) < 92
        if recuado and estreito:
            continue
        fim = a
        break
    setor, sobra = linhas[:fim], linhas[fim:]

    partes = []
    for l in setor:
        if not l.strip():
            partes.append((None, None)); continue
        if eh_rotulo(l):
            pedacos = re.split(r"\s{2,}", l.strip(), maxsplit=1)
            partes.append((pedacos[0], pedacos[1] if len(pedacos) > 1 else None))
        else:
            partes.append((None, l.strip()))

    rotulos = []
    for k, (pedaco, _) in enumerate(partes):
        if pedaco is None:
            continue
        nome_novo = any(pedaco.lower().startswith(n) for n in ROTULOS_DE_FERRAMENTA)
        if nome_novo or not rotulos:
            rotulos.append({"pedacos": [pedaco], "linhas": [k]})
        else:
            rotulos[-1]["pedacos"].append(pedaco); rotulos[-1]["linhas"].append(k)

    # O rótulo é centralizado sobre a leitura: a leitura vai do fim da anterior até o
    # espelho desse começo em torno do centro do rótulo.
    centros = [sum(r["linhas"]) / len(r["linhas"]) for r in rotulos]
    ferramentas, inicio = [], 0
    for n, r in enumerate(rotulos):
        if n == len(rotulos) - 1:
            ultimo = len(partes) - 1
        else:
            primeiro_texto = next((k for k in range(inicio, len(partes)) if partes[k][1]), inicio)
            ultimo = min(max(round(2 * centros[n] - primeiro_texto), max(r["linhas"])), len(partes) - 1)
            # O espelho erra por uma linha quando o rótulo não está exatamente no meio:
            # segue até o fim do sub-bloco, enquanto a linha ainda estiver mais perto
            # deste rótulo do que do próximo.
            proximo = rotulos[n + 1]
            k = ultimo + 1
            while k < len(partes) and partes[k] != (None, None) and k not in proximo["linhas"] \
                    and abs(k - centros[n]) <= abs(k - centros[n + 1]):
                ultimo = k
                k += 1
        texto = [partes[k][1] for k in range(inicio, ultimo + 1) if partes[k][1]]
        ferramentas.append({"rotulo": " ".join(r["pedacos"]), "linhas": texto})
        inicio = ultimo + 1

    saida = []
    for f in ferramentas:
        rotulo = f["rotulo"]
        chave = next((c for n, c in ROTULOS_DE_FERRAMENTA.items() if rotulo.lower().startswith(n)), None)
        item = {"chave": chave, "rotulo": rotulo}
        if (m := re.search(r"Sequência\s+(?:[Mm]ínima|exigida):\s*(\d)", rotulo)):
            item["dados"] = int(m.group(1))
        if re.search(r"\(apenas se o Ídolo for quebrado\)", rotulo):
            item["condicao"] = "apenas se o Ídolo for quebrado"
        texto = "\n".join(f["linhas"])
        # Nota de rodapé do livro ("E de Edgar.³"): o número solto no começo da linha é
        # o marcador; a nota em si vem no texto de mestre, começando pelo mesmo número.
        if (m := re.search(r"^(\d)\s{2,}(?=\S)", texto, re.M)):
            item["notaDeRodape"] = int(m.group(1))
            texto = re.sub(r"^(\d)\s{2,}(?=\S)", "", texto, flags=re.M)
        item["texto"] = texto
        saida.append(item)
    return saida, "", sobra


def tabela_de_hack(caixa):
    """Faixa → segundos ou equação. O Ato II imprime "10 ou mais" e "6 ou menos" na
    mesma linha, que o leitor do Ato I não conhece."""
    texto = " ".join(limpo(l) for l in caixa)
    equacao = next((m.group(1).strip() for l in caixa if (m := ato_i.EQUACAO_NO_TOPO.search(l.strip()))), "")
    linhas = []
    for faixa, valor in re.findall(r"(\d+\s*ou\s*mais|\d+\s*-\s*\d+|\d+\s*ou\s*menos|\d+\+)\s+([^\s]+(?:\s*[×÷=²√*+\-]\s*[^\s]+)*)", texto):
        if (m := re.match(r"(\d+)\s*ou\s*mais", faixa)):
            rolagem = f"{m.group(1)}+"
        elif (m := re.match(r"(\d+)\s*ou\s*menos", faixa)):
            rolagem = f"1-{m.group(1)}"
        else:
            rolagem = re.sub(r"\s+", "", faixa)
        if (m := re.fullmatch(r"(\d+)s", valor)):
            linhas.append({"rolagem": rolagem, "equacao": equacao, "segundos": int(m.group(1))})
        elif "=" in valor:
            linhas.append({"rolagem": rolagem, "equacao": limpo(valor), "segundos": 0})
    return linhas


ERRATAS_DE_EXTRACAO = {
    # Espaço engolido e primeira letra perdida na conversão do PDF, não no livro.
    "altarmolhado": "altar molhado",
    "nalisar o sangue congelado": "Analisar o sangue congelado",
}


def aplicar_erratas(obj):
    if isinstance(obj, str):
        for de, para in ERRATAS_DE_EXTRACAO.items():
            obj = obj.replace(de, para)
        return obj
    if isinstance(obj, list):
        return [aplicar_erratas(x) for x in obj]
    if isinstance(obj, dict):
        return {k: aplicar_erratas(v) for k, v in obj.items()}
    return obj


def desmontar_radio(texto):
    """'Conjuntos de palavras (vermelhos indicam conjuntos falsos): A – B – …' e
    'Solução: …' → {conjuntos: [...], solucao: [...]}. O vermelho se perde na
    extração; o que está na solução é verdadeiro, o resto é falso."""
    m = re.search(r"Conjuntos de palavras \(vermelhos indicam conjuntos falsos\):\s*(.+?)\s*Solução:\s*(.+)$",
                  texto.replace("\n", " "), re.S)
    if not m:
        return None
    conjuntos = [limpo(c) for c in re.split(r"\s+–\s+|\s+-\s+(?=[“A-Z])", m.group(1)) if c.strip()]
    solucao = limpo(m.group(2))
    return {"conjuntos": conjuntos, "solucao": solucao}


def paragrafos_com_listas(linhas):
    """Como `paragrafos`, mas um bloco de linhas curtas depois de um parágrafo que termina
    em ":" é lista (as chaves do molho: "Porta do Depósito A", …), separada por ";"."""
    saida, blocos, atual = [], [], []
    for l in linhas:
        if l.strip():
            atual.append(l.strip())
        elif atual:
            blocos.append(atual); atual = []
    if atual:
        blocos.append(atual)
    for b in blocos:
        eh_lista = saida and saida[-1].endswith(":") and len(b) >= 2 and all(len(x) <= 40 for x in b)
        if eh_lista:
            saida[-1] = f"{saida[-1]} {'; '.join(b)}."
        else:
            saida.append(ato_i.juntar_hifenizacao("\n".join(b)).replace("\n", " "))
    return saida


def ler_pontos(linhas, legenda):
    a = indice(linhas, r"^\s*PERTENCES DE ALAN\s*$")
    b = indice(linhas, FIM_DOS_PONTOS.pattern, a)
    trecho = linhas[a:b]
    pontos, secoes, atual = [], {}, None
    i = 0
    while i < len(trecho):
        l = trecho[i]
        t = l.strip()
        if t in SECOES:
            # Seção entre pontos: "PORÃO", "A SALA SECRETA", a caixa da maldição.
            fim = next((k for k in range(i + 1, len(trecho)) if eh_titulo_de_ponto(trecho, k)
                        or trecho[k].strip() in SECOES), len(trecho))
            secoes[SECOES[t]] = paragrafos(sem_paginas(trecho[i + 1:fim]))
            i = fim
            continue
        if eh_titulo_de_ponto(trecho, i):
            atual = {"nome": limpo(t), "recuo": recuo(l), "linhas": []}
            pontos.append(atual)
        elif "CONTINUAÇÃO" in t and atual is not None:
            pass
        elif atual is not None:
            atual["linhas"].append(l)
        i += 1

    usados = set()
    for p in pontos:
        montar_ponto(p, legenda)
        # O livro imprime o título do Símbolo no Teto no lugar do Duto de Ventilação
        # (ponto 18): o número da margem e a legenda dizem quem é.
        if p["numero"] in usados and p["numeroImpresso"] not in usados:
            p["tituloImpresso"] = p["nome"]
            p["numero"] = p["numeroImpresso"]
            p["nome"] = legenda.get(p["numero"], p["nome"]).upper()
        usados.add(p["numero"])
    return pontos, secoes


def montar_ponto(p, legenda):
    linhas = sem_paginas(p.pop("linhas"))
    p.pop("recuo")
    # O número do ponto, impresso na margem direita da descrição.
    numero = None
    for k, l in enumerate(linhas[:5]):
        if (m := NUMERO_NA_MARGEM.search(l)):
            numero = int(m.group(1)); linhas[k] = l[:m.start()]
            break
    p["numeroImpresso"] = numero
    meu = sem_acento(p["nome"]).lower()
    casam = [(len(nome), n) for n, nome in legenda.items()
             if sem_acento(nome).lower() in meu or meu in sem_acento(nome).lower()]
    p["numero"] = max(casam)[1] if casam else numero

    linhas, caixa = separar_caixa(linhas)
    p["desafio"] = ato_i.ler_desafio(caixa, p["nome"]) if caixa else None
    # "(HACK / 1-4 √2209 = 47 / TÉCNICO)": a tabela se imprime no meio do rótulo, e o
    # leitor do Ato I procura "HACK TÉCNICO" junto.
    texto_da_caixa = " ".join(caixa)
    if caixa and re.search(r"\bHACK\b", texto_da_caixa) and re.search(r"\bTÉCNICO\b", texto_da_caixa):
        p["desafio"] = p["desafio"] or {}
        p["desafio"]["hackTecnico"] = {"tabela": []}
        p["desafio"].setdefault("observacao", ato_i.prosa_da_caixa(caixa))
    if p["desafio"] and caixa:
        p["desafio"]["rotulo"] = rotulo_da_caixa(caixa) or p["desafio"].get("rotulo", "")

    # Onde cada parte começa.
    i_cab = next((k for k, l in enumerate(linhas) if CABECALHO.match(l)), None)
    i_fer = [k for k, l in enumerate(linhas) if l.strip() == "FERRAMENTAS"]
    fim_desc = min([k for k in [i_cab, *i_fer] if k is not None] or [len(linhas)])
    # A descrição é o primeiro bloco de linhas, na margem do ponto. Texto de mestre
    # antes do quadro vem depois de uma linha em branco, ou recuado para dentro
    # (Pertences de Edgar, sem quadro nem setor: a nota vem colada, 2 colunas adiante).
    margem = recuo(linhas[0]) if linhas and linhas[0].strip() else 0
    fim_bloco = next((k for k in range(fim_desc) if not linhas[k].strip() and any(l.strip() for l in linhas[:k])), fim_desc)
    corte = next((k for k in range(1, fim_bloco) if linhas[k].strip() and recuo(linhas[k]) >= margem + 2), fim_bloco)
    notas_antes = linhas[corte:fim_desc]
    p["descricao"] = limpo(" ".join(l.strip() for l in linhas[:corte]))

    infos, sobras = [], []
    p["celulasDT"] = 0
    if i_cab is not None:
        fim_tab = i_fer[0] if i_fer else len(linhas)
        col_dt, _ = ato_i.colunas(linhas[i_cab])
        # A coluna "Informação" do cabeçalho está 1 coluna à direita do texto nas
        # páginas do Ato II; medir pela DT (2 dígitos + folga) em vez do cabeçalho.
        infos, _, sobras = ato_i.ler_tabela(linhas[i_cab + 1:fim_tab] + [""] * 3, 0, col_dt, col_dt + 3)
        p["celulasDT"] = sum(1 for l in linhas[i_cab + 1:fim_tab]
                             if l[max(0, col_dt - 2):col_dt + 3].strip().isdigit())
    for info in infos:
        info["chave"], info["condicao"] = ato_i.chave_de_pericia(info["pericia"])
        # "3 ou 4 Eloísa não parecia…" / "5 Kênia e Eloísa…": os ícones de contagem
        # de jogadores do livro viram só o número na extração.
        if re.search(r"\b3\s+ou 4\s+[A-ZÁ-Ú]", info["texto"]):
            info["texto"] = re.sub(r"\b(\d)\s+ou\s+(\d)\s+(?=[A-ZÁ-Ú])", r"(\1 ou \2 jogadores) ", info["texto"])
            info["texto"] = re.sub(r"\.\s+(\d)\s+(?=[A-ZÁ-Ú])", r". (\1 jogadores) ", info["texto"])
    p["informacoes"] = infos

    ferramentas, leitura_normal, notas = [], "", []
    if i_fer:
        # Setor em duas páginas (o Ídolo, o Altar, o Computador): junta os pedaços.
        pedacos = []
        for n, k in enumerate(i_fer):
            fim = i_fer[n + 1] if n + 1 < len(i_fer) else len(linhas)
            pedacos.append(linhas[k + 1:fim])
        for pedaco in pedacos:
            f, normal, sobra = ler_ferramentas(pedaco)
            ferramentas += f
            leitura_normal = leitura_normal or normal
            notas += sobra
    else:
        notas = linhas[fim_desc:] if i_cab is None else []
    notas = notas_antes + notas
    p["leituraNormal"] = leitura_normal
    # O livro imprime "Laboratório" nos quatro rótulos do freezer; a leitura diz qual
    # ferramenta é cada uma (a matriz da p. 75 confirma: Câmera, Laboratório, Lanterna,
    # EMF e Termômetro).
    vistas = set()
    for f in ferramentas:
        if f["chave"] in vistas and not f.get("dados"):
            t = f["texto"].lower()
            if "estouro da lanterna" in t or "luz uv" in t:
                f["chave"], f["rotuloCorrigido"] = "lanternaUV", True
            elif "áudio emf" in t:
                f["chave"], f["rotuloCorrigido"] = "emf", True
            elif re.search(r"mais frio|mais quente|temperatura", t):
                f["chave"], f["rotuloCorrigido"] = "termometro", True
        vistas.add(f["chave"])
        # "(leia Percepção [ícone] acima)": o ícone da DT some na extração; a linha
        # citada é a de Percepção condicionada ao Ídolo quebrado.
        f["texto"] = re.sub(r"Percepção\s{3,}acima", "Percepção (apenas se o Ídolo for quebrado) acima", f["texto"])
    p["ferramentas"] = ferramentas
    if p["desafio"] and p["desafio"].get("hackTecnico") is not None:
        p["desafio"]["hackTecnico"]["tabela"] = tabela_de_hack(caixa)
    for f in ferramentas:
        if f["chave"] == "radio" and (r := desmontar_radio(f["texto"])):
            f["radio"] = r
        if (m := re.search(r"ÁUDIO EMF (\d)", f["texto"])):
            f["audio"] = int(m.group(1))
        f["handouts"] = [limpo(h) for h in re.findall(r"\[(HANDOUT[^\]]+)\]", f["texto"], re.I)]
    p["notas"] = [n for n in paragrafos_com_listas(notas) if n]
    p["notas"] += [s for s in sobras if s]
    p["handoutsCitados"] = sorted({limpo(h) for h in re.findall(r"Handouts?\s+(\d+[A-C]?(?:,\s*\d+[A-C]?)*(?:\s+e\s+\d+[A-C]?)?\s*-\s*[^.\]]+|\d+[A-C]?(?:,\s*\d+[A-C]?)*\s+E\s+\d+[A-C]?)", " ".join(l for l in linhas), re.I)})


# ------------------------------------------------------------------- conferência --

DISCREPANCIAS_DO_LIVRO = {7: {"lanternaUV"}}


def conferir(dados):
    """Provas estruturais: o que sai bate com o que o livro imprime."""
    problemas = []
    pontos = {p["numero"]: p for p in dados["pontos"]}
    faltam = [n for n in dados["legenda"] if n not in pontos]
    if faltam:
        problemas.append(f"pontos da legenda sem ponto extraído: {faltam}")

    # A matriz de ferramentas: cada ponto reage exatamente às ferramentas que o texto lê.
    for n, esperadas in dados["matriz"].items():
        p = pontos.get(n)
        if not p:
            problemas.append(f"ponto {n} da matriz não existe"); continue
        lidas = {f["chave"] for f in p["ferramentas"] if f["chave"] != "laser"}
        laser = n in dados["laser"]["porao"] + dados["laser"]["salaSecreta"]
        esperado = set(esperadas)
        if laser != ("laser" in esperado):
            problemas.append(f"ponto {n}: laser na matriz {'laser' in esperado}, na lista {laser}")
        esperado.discard("laser")
        # O livro se contradiz no Ídolo: o texto dá reação à Lanterna UV, a matriz não.
        # O texto manda (docs/LACUNAS.md).
        lidas -= DISCREPANCIAS_DO_LIVRO.get(n, set())
        if lidas != esperado:
            problemas.append(f"ponto {n} ({p['nome']}): texto lê {sorted(lidas)}, matriz diz {sorted(esperado)}")
    for n in dados["leituraNormal"]:
        p = pontos.get(n)
        if p and p["ferramentas"]:
            problemas.append(f"ponto {n} ({p['nome']}): devia ser leitura normal")

    # Cada célula de DT impressa é uma linha do quadro: nem uma a menos, nem a mais.
    for p in dados["pontos"]:
        if p["celulasDT"] != len(p["informacoes"]):
            problemas.append(f"{p['nome']}: {p['celulasDT']} células de DT no livro, {len(p['informacoes'])} linhas extraídas")

    # Rádio: a solução usa só conjuntos que existem, e cada conjunto verdadeiro entra.
    for p in dados["pontos"]:
        for f in p["ferramentas"]:
            if not f.get("radio"):
                continue
            norm = lambda t: re.sub(r"[^a-z0-9 ]", "", sem_acento(t).lower())
            sol = norm(f["radio"]["solucao"])
            verdadeiros = [c for c in f["radio"]["conjuntos"] if norm(c) and norm(c) in sol]
            if len(verdadeiros) < 3:
                problemas.append(f"{p['nome']}: rádio com só {len(verdadeiros)} conjuntos na solução")
    return problemas


def extrair():
    linhas = trecho_do_ato_ii()
    intro_mec, mecanicas = ler_mecanicas(linhas)
    matriz, normais = ler_matriz(linhas)
    legenda = ler_legenda(linhas)
    pontos, secoes = ler_pontos(linhas, legenda)
    narracao, fugindo = ler_narracao_final(linhas)
    dados = {
        "aberturaDoAto": paragrafos(sem_paginas(linhas[4:indice(linhas, r"^\s*PREPARAÇÃO\b")])),
        "preparacao": ler_preparacao(linhas),
        "mecanicasIntro": intro_mec,
        "mecanicas": mecanicas,
        "matriz": matriz,
        "leituraNormal": normais,
        "laser": ler_laser(linhas),
        "vitoria": ler_vitoria(linhas),
        "introducao": ler_introducao(linhas),
        "cenaInicial": ler_cena_inicial(linhas),
        "legenda": legenda,
        "pontosIntro": ler_secao(linhas, r"^PONTOS DE INTERESSE\s*$", r"^NOVAS DESCOBERTAS\s*$"),
        "novasDescobertas": ler_secao(linhas, r"^NOVAS DESCOBERTAS\s*$", r"^PERTENCES SEPARADOS PELA ORDEM\s*$"),
        "pertencesIntro": ler_secao(linhas, r"^PERTENCES SEPARADOS PELA ORDEM\s*$", r"^\s*PERTENCES DE ALAN\s*$"),
        **secoes,
        "pontos": pontos,
        "narracaoFinal": narracao,
        "fugindo": fugindo,
        "respostaCorreta": ler_resposta(linhas),
    }
    return dados


if __name__ == "__main__":
    dados = aplicar_erratas(extrair())
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(json.dumps(dados, ensure_ascii=False, indent=2))
    linhas_de_quadro = sum(len(p["informacoes"]) for p in dados["pontos"])
    ferramentas = sum(len(p["ferramentas"]) for p in dados["pontos"])
    print(f"{len(dados['pontos'])} pontos, {linhas_de_quadro} linhas de quadro, {ferramentas} leituras de ferramenta → {SAIDA}")
    for p in dados["pontos"]:
        fer = ", ".join(f"{f['chave']}{'('+str(f['dados'])+'d)' if f.get('dados') else ''}" for f in p["ferramentas"])
        print(f"  {str(p['numero']).rjust(2)} {p['nome'][:34]:36} {len(p['informacoes']):2} linhas  "
              f"{'desafio ' if p['desafio'] else ''}{fer or ('leitura normal' if p['leituraNormal'] else '-')}")
    problemas = conferir(dados)
    for pr in problemas:
        print("  !!", pr)
    if problemas:
        sys.exit(1)
