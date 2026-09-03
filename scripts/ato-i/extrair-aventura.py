"""Extrai os pontos de interesse do Ato I do PDF do playtest.

O PDF é a fonte da verdade do texto — e não é nosso para redistribuir, então o
resultado deste script fica fora do repositório (ver `.gitignore`). Quem tem o PDF
gera o compêndio na própria máquina.

O layout é regular: título em caixa alta, descrição, um bloco opcional de desafio de
acesso, e a tabela `Perícia | DT | Informação`. As colunas são fixas o bastante para
fatiar por posição — o que evita adivinhar onde a informação começa quando a perícia
da linha está vazia (linha que continua a perícia anterior).
"""
import re, subprocess, json, pathlib, sys

PDF = pathlib.Path("docs/Ordem-Paranormal-RPG-2-Playtest-Alpha-agentes.pdf")
# Fora de `packs/sources/`: ali dentro todo .json é documento de compêndio.
SAIDA = pathlib.Path("build/ato-i-pontos.json")
PDFTOTEXT = "/opt/homebrew/bin/pdftotext"

# O trecho do porão: da lista de pontos até a narração final.
INICIO = re.compile(r"^PONTOS DE INTERESSE\s*$")
FIM = re.compile(r"^NARRAÇÃO FINAL\s*$")

TITULO = re.compile(
    r"^(\s{0,24})([A-ZÁÂÃÉÊÍÓÔÕÚÇ][A-ZÁÂÃÉÊÍÓÔÕÚÇ0-9 ,:–'-]{4,50}?)"
    r"(\s{2,}\(([^)]{4,60})\))?\s*$")
CABECALHO = re.compile(r"^(\s*)Perícia\s+DT\s+Informação\s*$")
RUIDO = re.compile(r"^\s*\d{1,3}\s*$|^\s*$")
# Começo de frase: o que separa um título de ponto de um rótulo de caixa lateral.
FRASE = re.compile(r"^\s*[A-ZÁÂÃÉÊÍÓÔÕÚÇ“\"][a-záâãéêíóôõúçà]")


# Rótulos das caixas de desafio ao lado do ponto — nunca são títulos.
DESAFIO_NA_CAIXA = re.compile(r"\(DT\s|\bPA\s|\b(ARROMBAR|DESTRANCAR|ALCANÇAR|HACKEAR|ITEM)\b")
# Rótulo que abre a caixa lateral. Depois dele, tudo é da caixa até a tabela começar —
# inclusive as frases em caixa normal da coluna da esquerda ("Só é possível investigá-lo
# se conseguir entendê-lo") e a tabela de equações do Hack Técnico, que estava vazando
# para a descrição do ponto.
ABRE_CAIXA = re.compile(r"\b(DESAFIO|BLOQUEIO|MECÂNICA DE|DE ACESSO|HACK (TÉCNICO|SOCIAL)"
                        r"|ROLAGEM|SUSTENTAR|RESOLVER O ENIGMA)\b|Requer realizar as duas ações")


def eh_titulo(linhas, i):
    """Título de ponto de interesse, e não rótulo da caixa de desafio ao lado.

    As caixas laterais ("DESAFIO / DE ACESSO / PORTA TRANCADA") também são caixa alta.
    O que as separa é o que vem depois: um título de ponto é seguido da descrição, uma
    frase em caixa normal; um rótulo de caixa é seguido de outro rótulo.
    """
    m = TITULO.match(linhas[i])
    if not m or DESAFIO_NA_CAIXA.search(m.group(2)):
        return False
    for proxima in linhas[i + 1:i + 4]:
        if RUIDO.match(proxima):
            continue
        return bool(FRASE.match(proxima))
    return False


def texto_do_pdf():
    if not PDF.exists():
        sys.exit(f"Não achei {PDF}. O PDF do playtest não vem no repositório.")
    saida = subprocess.run([PDFTOTEXT, "-layout", str(PDF), "-"],
                           capture_output=True, text=True, check=True)
    return saida.stdout.splitlines()


def trecho_do_porao(linhas):
    ini = next(i for i, l in enumerate(linhas) if INICIO.match(l))
    fim = next(i for i, l in enumerate(linhas) if i > ini and FIM.match(l))
    return linhas[ini:fim]


def colunas(cabecalho):
    """Onde começam DT e Informação, para fatiar as linhas da tabela."""
    return cabecalho.index("DT"), cabecalho.index("Informação")


def ler_tabela(linhas, i, col_dt, col_info):
    """Lê a tabela até ela acabar. Devolve (informações, próximo índice).

    Uma linha da tabela ocupa VÁRIAS linhas de texto: o nome da perícia e a DT vêm
    centralizados verticalmente sobre a informação, que quebra em quantas linhas
    precisar. As linhas em branco separam um bloco do outro.

    E a perícia vale para o bloco inteiro em que aparece — inclusive para os blocos
    ACIMA dela, já que a centralização pode colocá-la no meio. Ler linha a linha
    prendia cada informação à perícia errada.
    """
    blocos, atual, vazias = [], [], 0
    while i < len(linhas):
        linha = linhas[i]
        if eh_titulo(linhas, i) or CABECALHO.match(linha):
            break

        # A DT encosta na coluna vizinha quando tem dois dígitos ("1|0"): folga de 2.
        pericia = linha[:max(0, col_dt - 2)].strip()
        meio = linha[max(0, col_dt - 2):col_info].strip()
        info = linha[col_info:].strip()

        if not pericia and not meio and not info:
            vazias += 1
            if atual: blocos.append(atual); atual = []
            if vazias >= 3: break          # fim da tabela: o texto de mestre vem depois
            i += 1
            continue

        vazias = 0
        atual.append((pericia, meio, info))
        i += 1

    if atual: blocos.append(atual)

    # Cada bloco vira uma informação; a perícia se espalha para os blocos sem nome.
    infos = []
    for bloco in blocos:
        nome = " ".join(p for p, _, _ in bloco if p).strip()
        dts = [m for _, m, _ in bloco if m.isdigit()]
        texto = " ".join(t for _, _, t in bloco if t).strip()
        if not dts or not texto:
            continue
        infos.append({"pericia": nome, "dt": int(dts[0]), "texto": texto})

    # A etiqueta vale para a própria linha e para as de BAIXO, até a próxima etiqueta.
    # As linhas acima da primeira etiqueta são dela — a centralização vertical pode
    # colocá-la no meio do grupo. Propagar para trás sem esse limite dava a linha de
    # Percepção para a Aptidão seguinte.
    corrente = ""
    for info in infos:
        if info["pericia"]: corrente = info["pericia"]
        elif corrente: info["pericia"] = corrente

    primeira = next((i["pericia"] for i in infos if i["pericia"]), "")
    for info in infos:
        if info["pericia"]: break
        info["pericia"] = primeira

    return infos, i


# As caixas de desafio ao lado do ponto trazem os números prontos.
ARROMBAR = re.compile(r"ARROMBAR\s*(?:-\s*DT\s*Acumulada\s*(\d+)|\(DT\s*(\d+),\s*PA\s*(\d+)\))", re.I)
DESTRANCAR = re.compile(r"DESTRANCAR\s*\(senha:\s*(\d+)d(\d+)\s*(?:,\s*(\d+)\s*tentativas)?", re.I)
ALCANCAR = re.compile(r"ALCANÇAR\s*\(DT\s*(\d+)\)", re.I)


# "DESAFIO / DE ACESSO / PORTA TRANCADA": as duas primeiras são o rótulo do quadro,
# a terceira é o nome do obstáculo — o que interessa.
CABECA_DA_CAIXA = re.compile(r"^(DESAFIO|BLOQUEIO|DE ACESSO)$")
# Onde a caixa acaba e a página recomeça.
FIM_DA_CAIXA = re.compile(r"CONTEÚDO|CONTINUAÇÃO|TESTE")
PALAVRA_CHAVE = re.compile(r"\b(ARROMBAR|DESTRANCAR|ALCANÇAR|HACKEAR|SUSTENTAR|RESOLVER"
                           r"|ITEM|Requer)\b")


# Palavras do rótulo do quadro, não do obstáculo: o que sobra é o nome dele.
COLA_DA_CAIXA = {"DESAFIO", "BLOQUEIO", "MECÂNICA", "DE", "ACESSO", "HACK", "TÉCNICO",
                 "SOCIAL", "ROLAGEM", "EQUAÇÃO", "REQUER", "ITEM"}


def nome_do_obstaculo(linhas, nome_do_ponto=""):
    """O que a caixa chama o obstáculo ("PORTA TRANCADA", "PAINEL CONFUSO").

    O rótulo mora na coluna da esquerda; a da direita traz a abordagem ou a tabela. Duas
    colunas separadas por 2+ espaços, então basta ficar com o primeiro pedaço.
    """
    palavras = []
    for linha in linhas:
        if FIM_DA_CAIXA.search(linha):
            break
        # O rótulo mora na margem esquerda da caixa. Linha recuada é continuação da
        # coluna da direita ("• DE LIVROS", do enigma da estante) e não é nome de nada.
        if len(linha) - len(linha.lstrip()) > 20:
            continue
        esquerda = re.split(r"\s{2,}", linha.strip())[0]
        # Caixa de uma coluna só: a abordagem vem na mesma fatia do rótulo.
        esquerda = PALAVRA_CHAVE.split(esquerda)[0]
        esquerda = re.sub(r"[\ue000-\uf8ff•\-–]", " ", esquerda)
        if not esquerda or not esquerda.isupper():
            continue
        palavras += [p for p in esquerda.split()
                     if p not in COLA_DA_CAIXA and not p.isdigit()]
    nome = " ".join(dict.fromkeys(palavras)).title()
    return re.sub(r"\b(Do|Da|De|Dos|Das|E)\b", lambda m: m.group(1).lower(), nome)


# Tabela do Hack Técnico: faixa de rolagem à esquerda, equação à direita.
LINHA_DA_TABELA = re.compile(r"(\d+\s*\+|\d+\s*-\s*\d+)\s+(.+?=\s*[\d.,]+)\s*$")


def ler_desafio(linhas, nome_do_ponto=""):
    """Lê a caixa de desafio de acesso que vem antes da tabela do ponto."""
    texto = " ".join(linhas)
    d = {}
    if (m := ARROMBAR.search(texto)):
        acumulada, dt, pa = m.groups()
        # "DT Acumulada 12" diz só quanto somar: o teste em si fica na DT padrão.
        d["arrombar"] = ({"dt": 7, "pa": int(acumulada)} if acumulada
                         else {"dt": int(dt), "pa": int(pa)})
    if (m := DESTRANCAR.search(texto)):
        tamanho, faces, tentativas = m.groups()
        d["destrancar"] = {"tamanho": int(tamanho), "faces": int(faces),
                           "tentativas": int(tentativas) if tentativas else 0}
    if (m := ALCANCAR.search(texto)):
        d["alcancar"] = {"dt": int(m.group(1))}
    if re.search(r"HACK\s+TÉCNICO", texto, re.I):
        tabela = []
        for linha in linhas:
            if (m := LINHA_DA_TABELA.search(linha.strip())):
                tabela.append({"rolagem": re.sub(r"\s+", "", m.group(1)),
                               "equacao": re.sub(r"\s+", " ", m.group(2)).strip()})
        d["hackTecnico"] = {"tabela": tabela}
    if re.search(r"HACK\s+SOCIAL", texto, re.I):
        d["hackSocial"] = True
    # A estante: enigma + Sustentar, uma pessoa por rodada.
    if (m := re.search(r"SUSTENTAR\s*\(DT\s*(\d+)\)", texto, re.I)):
        d["sustentar"] = {"dt": int(m.group(1))}
    # A porta de saída não tem minigame: a senha está impressa no livro.
    if (m := re.search(r"Senha\s+(\d{4,8})\s*(\([^)]*\))?", texto)):
        d["senhaFixa"] = m.group(1)
        d["senhaNota"] = (m.group(2) or "").strip("()")
    if d:
        d["rotulo"] = nome_do_obstaculo(linhas, nome_do_ponto)
        # "ITEM (molho de chaves 1)": a chave que dispensa o desafio.
        if (m := re.search(r"ITEM\s*\(([^)]+)\)", texto, re.I)):
            d["item"] = re.sub(r"\s+", " ", m.group(1)).strip()
    return d or None


def extrair():
    linhas = trecho_do_porao(texto_do_pdf())
    pontos, atual = [], None
    i = 0
    while i < len(linhas):
        linha = linhas[i]
        cab = CABECALHO.match(linha)
        if cab and atual is not None:
            col_dt, col_info = colunas(linha)
            novas, fim = ler_tabela(linhas, i + 1, col_dt, col_info)
            atual["informacoes"].extend(novas)
            atual["bruto"].extend(linhas[i:fim])
            i = fim
            continue

        if atual is not None:
            atual["bruto"].append(linha)

        if eh_titulo(linhas, i):
            m = TITULO.match(linha)
            nome, condicao = m.group(2).strip(), (m.group(4) or "").strip()
            # "PONTO (CONTINUAÇÃO)" é a mesma tabela virando a página: as linhas
            # seguintes somam no ponto que já existe, em vez de criar um ponto novo.
            if "CONTINUAÇÃO" in nome.upper() and atual:
                i += 1
                continue
            atual = {"nome": nome, "condicao": condicao, "descricao": [],
                     "informacoes": [], "caixa": [], "bruto": [], "na_caixa": False}
            pontos.append(atual)
        elif atual is not None and not RUIDO.match(linha) and not atual["informacoes"]:
            texto = linha.strip()
            if ABRE_CAIXA.search(texto) or DESAFIO_NA_CAIXA.search(texto):
                atual["na_caixa"] = True
            if atual["na_caixa"] or texto.isupper():
                # Guarda a linha COM o recuo: é ele que diz qual coluna da caixa é qual.
                atual["caixa"].append(linha.rstrip())
            else:
                atual["descricao"].append(texto)
        i += 1

    for p in pontos:
        texto = " ".join(p["descricao"])
        # O número do ponto no mapa é impresso na margem e cai no meio da frase.
        texto = re.sub(r"\s{3,}\d{1,2}\s+", " ", texto)
        texto = re.sub(r"\s+\d{1,2}\s*$", "", texto)
        p["descricao"] = re.sub(r"\s{2,}", " ", texto).strip()
        p.pop("na_caixa", None)
        p["desafio"] = ler_desafio(p.pop("caixa"), p["nome"])
        # "Mostre o HANDOUT 06 - ESTANTE DE LIVROS" aparece tanto na pista quanto na
        # prosa do mestre — o ponto leva os dois.
        p["handouts"] = sorted({int(n) for n in
                                re.findall(r"HANDOUT\s*(\d+)", " ".join(p.pop("bruto")), re.I)})
    # Ponto sem tabela ainda é ponto: a Mesa de Sinuca, por exemplo, só tem reação de
    # ferramenta. O que não vale é o cabeçalho de seção, que não tem descrição nenhuma.
    return [p for p in pontos if p["informacoes"] or p["descricao"]]


# Nomes do PDF → chaves do sistema. O sufixo entre parênteses é condição de mesa
# ("apenas Victor", "se o ídolo for quebrado") e vai para o texto da informação, porque
# o sistema não modela condição por linha.
PERICIAS = {
    "percepção": "percepcao", "pesquisar": "pesquisar", "intuição": "intuicao",
    "máquinas": "maquinas", "tecnologia": "tecnologia", "sobrevivência": "sobrevivencia",
    "medicina": "medicina", "ocultismo": "ocultismo", "atletismo": "atletismo",
    "acrobacia": "acrobacia", "crime": "crime", "disciplina": "disciplina",
    "enganação": "enganacao", "furtividade": "furtividade", "intimidar": "intimidar",
    "luta": "luta", "persuasão": "persuasao", "pontaria": "pontaria", "vigor": "vigor",
}


def chave_de_pericia(rotulo):
    """Devolve (chave, condição). "Aptidão (Humanas)" vira aptidao.humanas."""
    texto = rotulo.strip()
    condicao = ""
    m = re.match(r"^([^(]+?)\s*\(([^)]+)\)\s*$", texto)
    if m:
        base, dentro = m.group(1).strip(), m.group(2).strip()
        if base.lower().startswith("aptidão"):
            return f"aptidao.{dentro.lower().replace('á','a').replace('ó','o')}", ""
        texto, condicao = base, dentro
    # "Medicina ou Sobrevivência": o sistema testa uma perícia por linha; fica a
    # primeira, e a alternativa vai na condição para o mestre decidir na mesa.
    if " ou " in texto.lower():
        primeira, resto = re.split(r"\s+ou\s+", texto, maxsplit=1)
        condicao = f"ou {resto}" + (f"; {condicao}" if condicao else "")
        texto = primeira
    return PERICIAS.get(texto.strip().lower(), ""), condicao


if __name__ == "__main__":
    pontos = extrair()
    for ponto in pontos:
        for info in ponto["informacoes"]:
            info["chave"], info["condicao"] = chave_de_pericia(info["pericia"])
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(json.dumps(pontos, ensure_ascii=False, indent=2))
    print(f"{len(pontos)} ponto(s) com quadro → {SAIDA}")
    for p in pontos:
        pericias = {i["pericia"] for i in p["informacoes"]}
        print(f"  {p['nome'][:42]:44} {len(p['informacoes']):2} linhas  {sorted(pericias)}")
