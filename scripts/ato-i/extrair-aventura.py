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
SAIDA_MALDICAO = pathlib.Path("build/ato-i-maldicao.json")
SAIDA_ITENS = pathlib.Path("build/ato-i-itens.json")
PDFTOTEXT = "/opt/homebrew/bin/pdftotext"

# O trecho do porão: da lista de pontos até a narração final.
INICIO = re.compile(r"^PONTOS DE INTERESSE\s*$")
FIM = re.compile(r"^NARRAÇÃO FINAL\s*$")

# Os colchetes do "[EVIDÊNCIA-CHAVE]" fazem parte do título no livro — sem eles na
# classe, o Celular e o Computador de Gustavo não eram ponto nenhum.
# O recuo vai longe: numa página de duas colunas, o título da direita começa perto da
# coluna 55. E "“ALTAR” DE MADEIRA" abre com aspa — sem ela, o altar não era ponto.
TITULO = re.compile(
    r"^(\s{0,60})([“\"]?[A-ZÁÂÃÉÊÍÓÔÕÚÇ][A-ZÁÂÃÉÊÍÓÔÕÚÇ0-9 ,:\[\]“”\"–'-]{4,50}?)"
    r"(\s{2,}\(([^)]{4,60})\))?\s*$")
CABECALHO = re.compile(r"^(\s*)Perícia\s+DT\s+Informação\s*$")
RUIDO = re.compile(r"^\s*\d{1,3}\s*$|^\s*$")
# Começo de frase: o que separa um título de ponto de um rótulo de caixa lateral.
FRASE = re.compile(r"^\s*[A-ZÁÂÃÉÊÍÓÔÕÚÇ“\"][a-záâãéêíóôõúçà]")


# Cabeçalhos de caixa e de quadro do livro. Parecem título (caixa alta, linha própria),
# mas o que vem depois deles é conteúdo de outro ponto: "CONTEÚDO" abre o que há dentro
# do armário, "A DÍVIDA PRECISA SER PAGA" é a tabela da maldição.
NAO_E_TITULO = re.compile(r"^(CONTEÚDO|FERRAMENTAS|NOVAS DESCOBERTAS|A DÍVIDA PRECISA SER PAGA"
                          r"|PONTOS DE INTERESSE|O PORÃO)$")

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
    if not m or DESAFIO_NA_CAIXA.search(m.group(2)) or NAO_E_TITULO.match(m.group(2).strip()):
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
        # A linha crua vai junto: fora da tabela, o texto atravessa as colunas e fatiar
        # por posição parte palavra no meio ("O fe rimento").
        atual.append((pericia, meio, info, linha))
        i += 1

    if atual: blocos.append(atual)

    # Cada bloco vira uma informação; a perícia se espalha para os blocos sem nome.
    # Bloco sem DT não é linha de quadro: é o texto de mestre que vem depois da tabela,
    # e ele não pode ser jogado fora.
    infos, sobras = [], []
    for bloco in blocos:
        nome = " ".join(p for p, _, _, _ in bloco if p).strip()
        dts = [m for _, m, _, _ in bloco if m.isdigit()]
        texto = " ".join(t for _, _, t, _ in bloco if t).strip()
        inteiro = re.sub(r"\s{2,}", " ", " ".join(crua.strip() for _, _, _, crua in bloco)).strip()
        if not dts or not texto:
            if inteiro:
                sobras.append(inteiro)
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

    return infos, i, sobras


# As caixas de desafio ao lado do ponto trazem os números prontos.
ARROMBAR = re.compile(r"ARROMBAR\s*(?:-\s*DT\s*Acumulada\s*(\d+)|\(DT\s*(\d+),\s*PA\s*(\d+)\))", re.I)
# Na caixa vem "DESTRANCAR (senha: 3d6, 3 tentativas)"; na prosa, sem os dois pontos.
DESTRANCAR = re.compile(r"DESTRANCAR\s*\(senha:?\s*(\d+)d(\d+)\s*(?:,\s*(\d+)\s*tentativas)?", re.I)
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
    # "(HACK SOCIAL)" no rótulo é a abordagem, que já vira campo — fora do nome.
    nome = " ".join(dict.fromkeys(palavras)).title()
    nome = re.sub(r"\(?\s*Hack\s+(Social|Técnico)\s*\)?", "", nome, flags=re.I).strip()
    return re.sub(r"\b(Do|Da|De|Dos|Das|E)\b", lambda m: m.group(1).lower(), nome)


# Tabela do Hack Técnico. Duas formas no livro: faixa → equação (o painel do depósito)
# e faixa → tempo, com uma equação só impressa no cabeçalho (o computador).
LINHA_DA_TABELA = re.compile(r"(\d+\s*\+|\d+\s*-\s*\d+)\s+(.+?=\s*[\d.,]+)\s*$")
LINHA_COM_TEMPO = re.compile(r"(\d+\s*\+|\d+\s*-\s*\d+|\d+\s*ou\s*$|menos)\s*(\d+)s\s*$")
EQUACAO_NO_TOPO = re.compile(r"EQUAÇÃO\s+(.+?=\s*[\d.,]+)\s*$")


def ler_tabela_de_hack(linhas):
    """Faixa de rolagem → o que o painel devolve.

    O painel do depósito devolve uma equação por faixa. O computador devolve TEMPO: a
    equação é uma só, impressa no alto da caixa, e a faixa diz quantos segundos o
    jogador tem para resolvê-la.
    """
    equacao_unica = next((m.group(1).strip() for l in linhas
                          if (m := EQUACAO_NO_TOPO.search(l.strip()))), "")
    tabela, pendente = [], None
    for linha in linhas:
        crua = linha.strip()
        if (m := LINHA_DA_TABELA.search(crua)):
            tabela.append({"rolagem": re.sub(r"\s+", "", m.group(1)),
                           "equacao": re.sub(r"\s+", " ", m.group(2)).strip(), "segundos": 0})
            continue
        # "6 ou / menos    10s": a faixa quebra em duas linhas.
        if (m := re.search(r"(\d+)\s*ou\s*$", crua)):
            pendente = m.group(1)
            continue
        if (m := re.search(r"(\d+)s\s*$", crua)) and pendente:
            tabela.append({"rolagem": f"1-{pendente}", "equacao": equacao_unica,
                           "segundos": int(m.group(1))})
            pendente = None
            continue
        if (m := LINHA_COM_TEMPO.search(crua)):
            tabela.append({"rolagem": re.sub(r"\s+", "", m.group(1)),
                           "equacao": equacao_unica, "segundos": int(m.group(2))})
    return tabela


# O banco do hack social: pergunta numa linha, resposta na seguinte; ou "rótulo: valor".
PERGUNTA = re.compile(r"^(.+\?)$")
ROTULO_VALOR = re.compile(r"^([A-ZÁÂÃÉÊÍÓÔÕÚÇ][^:]{4,60}):\s+(.+)$")


def ler_banco_de_perguntas(linhas):
    """Perguntas e respostas do hack social, como o livro imprime.

    Três formas na mesma caixa: pergunta numa linha e resposta na seguinte; "rótulo:
    valor" na mesma linha; e um cabeçalho que termina em ":" seguido de uma lista solta
    ("Nomes importantes para essa pessoa:" → Olívia, Laura). O rótulo da caixa fica na
    coluna da esquerda, então cada linha é lida pelo último pedaço.
    """
    banco, esperando, cabecalho = [], None, None
    for linha in linhas:
        pedacos = [p for p in re.split(r"\s{2,}", linha.strip()) if p]
        if not pedacos:
            continue
        crua = pedacos[-1]
        if crua.isupper() or crua.startswith("("):
            continue
        if esperando:
            banco.append({"pergunta": esperando, "resposta": crua})
            esperando = None
            continue
        if PERGUNTA.match(crua):
            esperando = crua
            cabecalho = None
        elif (m := ROTULO_VALOR.match(crua)):
            banco.append({"pergunta": m.group(1).strip(), "resposta": m.group(2).strip()})
        elif crua.endswith(":"):
            cabecalho = crua.rstrip(":").strip()
        elif cabecalho and not re.search(r"respostas?\s+corretas?", crua, re.I):
            banco.append({"pergunta": cabecalho, "resposta": crua})
    return banco


# Nem todo desafio está em caixa: as correntes de Edgar aparecem no texto de mestre.
ABERTO_COM = re.compile(
    r"(?:^|\.)\s*(?:A|As|O|Os)\s+([a-zà-ú]+(?:\s+[a-zà-ú]+){0,2}?)\s+"
    r"(?:pode|podem)\s+ser\s+(?:aberta|abertas|aberto|abertos)\s+com\b", re.I)


def desafio_na_prosa(linhas):
    """Desafio descrito no meio do texto, em caixa baixa, sem quadro lateral."""
    texto = re.sub(r"\s{2,}", " ", " ".join(l.strip() for l in linhas))
    m = ABERTO_COM.search(texto)
    if not m:
        return None
    d = ler_desafio([texto])
    if not d:
        return None
    d.pop("observacao", None)      # na prosa, a "caixa" é o texto do ponto inteiro
    d["rotulo"] = m.group(1).strip().capitalize()
    d.pop("item", None)          # "molho de chaves 1" aqui não vem entre parênteses
    if (chave := re.search(r"molho de chaves\s*(\d)", texto, re.I)):
        d["item"] = f"molho de chaves {chave.group(1)}"
    return d


def prosa_da_caixa(linhas):
    """O texto corrido dentro da caixa — o que não é rótulo nem abordagem."""
    partes = []
    for linha in linhas:
        if FIM_DA_CAIXA.search(linha):
            break
        texto = re.sub(r"\s{2,}", " ", linha.strip())
        # "Requer realizar as duas ações em sequência" é frase, não rótulo de abordagem.
        so_abordagens = re.compile(r"\b(ARROMBAR|DESTRANCAR|ALCANÇAR|HACKEAR|SUSTENTAR|RESOLVER|ITEM)\b")
        texto = so_abordagens.split(texto)[0] if so_abordagens.search(texto) else texto
        texto = re.sub(r"^[\ue000-\uf8ff•\-–\s]+", "", texto)
        # Fora o que já virou campo: pergunta do banco, senha impressa, equação.
        if texto.endswith("?") or LINHA_DA_TABELA.search(texto) \
                or re.search(r"senha\s+\d|=\s*\d|respostas?\s+corretas?", texto, re.I) \
                or ROTULO_VALOR.match(texto):
            continue
        if len(texto) > 25 and not texto.isupper():
            partes.append(texto)

    frase = re.sub(r"\s{2,}", " ", " ".join(partes)).strip()
    # Os rótulos do quadro se infiltram no meio da frase, porque são impressos na coluna
    # da esquerda, na mesma linha.
    frase = re.sub(r"\b(DESAFIO DE|DESAFIO|BLOQUEIO|DE ACESSO|MECÂNICA DE|ROLAGEM|EQUAÇÃO"
                   r"|HACK TÉCNICO|HACK SOCIAL)\b", "", frase)
    frase = re.sub(r"\(\s*\)|\([^)]{0,4}$", "", frase)      # sobra de parêntese cortado
    frase = re.sub(r"\s{2,}", " ", frase).strip(" .,:;")
    return frase if len(frase) > 30 else ""


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
        d["hackTecnico"] = {"tabela": ler_tabela_de_hack(linhas)}
    if re.search(r"HACK\s+SOCIAL", texto, re.I):
        respostas = re.search(r"(\d+)\s+respostas?\s+corretas?", texto, re.I)
        d["hackSocial"] = {
            "respostasNecessarias": int(respostas.group(1)) if respostas else 3,
            "perguntas": ler_banco_de_perguntas(linhas),
        }
    # A estante: enigma + Sustentar, uma pessoa por rodada.
    if (m := re.search(r"SUSTENTAR\s*\(DT\s*(\d+)\)", texto, re.I)):
        d["sustentar"] = {"dt": int(m.group(1))}
    # A porta de saída não tem minigame: a senha está impressa no livro.
    if (m := re.search(r"Senha\s+(\d{4,8})\s*(\([^)]*\))?", texto)):
        d["senhaFixa"] = m.group(1)
        d["senhaNota"] = (m.group(2) or "").strip("()")
    if d:
        d["rotulo"] = nome_do_obstaculo(linhas, nome_do_ponto)
        # A caixa também explica coisas que mudam a mesa: "se escolherem arrombar, o
        # Ídolo se quebra e a informação de Pesquisar sobe de 6 para 10". Sem isso, a
        # regra sumia junto com o quadro lateral.
        d["observacao"] = "" if "hackSocial" in d else prosa_da_caixa(linhas)
        # "ITEM (molho de chaves 1)": a chave que dispensa o desafio.
        if (m := re.search(r"ITEM\s*\(([^)]+)\)", texto, re.I)):
            d["item"] = re.sub(r"\s+", " ", m.group(1)).strip()
    return d or None


# "A DÍVIDA PRECISA SER PAGA": o que acontece no começo de cada rodada da cena.
INICIO_MALDICAO = re.compile(r"^\s*A DÍVIDA PRECISA SER PAGA\s*$")
FIM_MALDICAO = re.compile(r"^\s*(FERRAMENTAS|PONTOS DE INTERESSE)\s*$")
LINHA_DE_RODADA = re.compile(r"^\s{0,12}(\d{1,2})(?:\s+em)?\s*$")


INICIO_REGRAS = re.compile(r"A Maldição do Ídolo de Pedra é uma mecânica especial")
CAIXA_LATERAL = re.compile(r"^(A DÍVIDA|ÍDOLO QUEBRADO)")


def ler_regras_da_maldicao(linhas):
    """O que vem antes da tabela: a narração de ativação, o teste e as duas caixas.

    As caixas "A DÍVIDA FOI PAGA" e "ÍDOLO QUEBRADO" são impressas lado a lado, com a
    segunda começando na coluna 41 — daí o corte por posição.
    """
    try:
        ini = next(i for i, l in enumerate(linhas) if INICIO_REGRAS.search(l))
        fim = next(i for i, l in enumerate(linhas) if i > ini and INICIO_MALDICAO.match(l))
    except StopIteration:
        return {}

    bloco = linhas[ini:fim]
    texto = re.sub(r"\s{2,}", " ", " ".join(l.strip() for l in bloco))
    falas = re.findall(r"[“\"]?(Ao observarem o Ídolo.+?chamado\.)", texto)
    ativacao = re.search(r"(Ao terminar a narração.+?)(?=A partir disso|$)", texto)

    esquerda, direita = [], []
    dentro = False
    for linha in bloco:
        if CAIXA_LATERAL.match(linha.strip()):
            dentro = True
        if not dentro:
            continue
        esquerda.append(linha[:41].strip())
        direita.append(linha[41:].strip())

    def limpar(partes):
        texto = re.sub(r"\s{2,}", " ", " ".join(p for p in partes if p)).strip()
        # Coluna estreita quebra palavra no meio: "ape- nas" volta a ser "apenas".
        texto = re.sub(r"(\w)-\s+(\w)", r"\1\2", texto)
        # O título da caixa vem em caixa alta na primeira linha; ele já é o `titulo`.
        return re.sub(r"^[A-ZÁÂÃÉÊÍÓÔÕÚÇ ]{4,40}\s+(?=[A-ZÁ][a-zà-ú])", "", texto).strip()
    return {
        "narracao": " ".join(f.strip() for f in falas),
        "ativacao": (ativacao.group(1).strip() if ativacao else ""),
        "caixas": [c for c in ({"titulo": "A Dívida Foi Paga", "texto": limpar(esquerda)},
                               {"titulo": "Ídolo Quebrado", "texto": limpar(direita)}) if c["texto"]],
    }


def ler_maldicao(linhas):
    """A tabela da maldição: rodada → narração para ler + efeito de regra.

    Mesma geometria do quadro dos pontos: o número da rodada é centralizado
    VERTICALMENTE sobre o bloco, então pode aparecer no meio dele. Blocos são separados
    por linha em branco, e rodada sem texto (a maioria) não vira evento.
    """
    try:
        ini = next(i for i, l in enumerate(linhas) if INICIO_MALDICAO.match(l))
    except StopIteration:
        return []

    blocos, atual = [], []
    for linha in linhas[ini + 1:]:
        if FIM_MALDICAO.match(linha):
            break
        if not linha.strip():
            if atual:
                blocos.append(atual)
                atual = []
            continue
        if linha.strip().startswith("Rodada"):
            continue
        atual.append(linha)
    if atual:
        blocos.append(atual)

    eventos = []
    for bloco in blocos:
        rodada, partes = None, []
        for linha in bloco:
            resto = linha
            if (m := LINHA_DE_RODADA.match(linha)):
                rodada = int(m.group(1))
                continue
            # O número pode dividir a linha com o texto ("  4       marcada. A dívida…").
            if (m := re.match(r"^\s{0,12}(\d{1,2})(?:\s+em)?\s{2,}(.+)$", linha)):
                rodada, resto = int(m.group(1)), m.group(2)
            if (texto := re.sub(r"\s{2,}", " ", resto.strip())):
                partes.append(texto)
        if rodada is None or not partes:
            continue
        # O que está entre aspas é o que o mestre lê em voz alta; o resto é regra.
        inteiro = " ".join(partes)
        falas = re.findall(r"[“\"]([^”\"]+)[”\"]", inteiro)
        efeito = re.sub(r"[“\"][^”\"]+[”\"]", " ", inteiro)
        eventos.append({
            "rodada": rodada,
            "narracao": " ".join(f.strip() for f in falas).strip(),
            "efeito": re.sub(r"\s{2,}", " ", efeito).strip(),
        })
    return eventos


# Itens que o livro descreve no meio da prosa: a faca de churrasco (arma) e os dois
# molhos de chaves, que dispensam desafios.
ITEM_NA_PROSA = re.compile(r"^([A-ZÁÂÃÉÊÍÓÔÕÚÇ][A-ZÁÂÃÉÊÍÓÔÕÚÇ ]{4,40}):\s+(.+)$")
ENIGMA_DA_ESTANTE = re.compile(r"^PRATELEIRA\s+(\d)\s*[-–]\s*(.+)$")


# Um bloco de duas colunas lido linha a linha embaralha as duas ("resolvendo o puzzle da
# estante Vocês se deparam com o que,"). O vão entre as colunas é uma faixa de espaços que
# atravessa TODAS as linhas do bloco — achar essa faixa é o que diz onde cortar.
def desempilhar_colunas(cruas):
    # O número do ponto no mapa é impresso na margem direita da linha.
    linhas = [re.sub(r"\s{3,}\d{1,2}\s*$", "", l.rstrip()) for l in cruas if l.strip()]
    if len(linhas) < 5:
        return [re.sub(r"\s{2,}", " ", l.strip()) for l in linhas]

    largura = max(len(l) for l in linhas)
    cheias = [l.ljust(largura) for l in linhas]
    vao, atual = None, None
    for coluna in range(20, min(largura, 80)):
        if all(l[coluna] == " " for l in cheias):
            atual = (atual[0], coluna) if atual else (coluna, coluna)
            if not vao or (atual[1] - atual[0]) > (vao[1] - vao[0]):
                vao = atual
        else:
            atual = None

    if not vao or vao[1] - vao[0] < 4:
        return [re.sub(r"\s{2,}", " ", l.strip()) for l in linhas]

    corte = vao[0]
    esquerda = [l[:corte].strip() for l in cheias if l[:corte].strip()]
    direita = [l[corte:].strip() for l in cheias if l[corte:].strip()]
    # Duas colunas de verdade têm as duas com corpo; senão é texto de uma coluna só,
    # com o parágrafo recuado.
    if len(esquerda) < 3 or len(direita) < 3:
        return [re.sub(r"\s{2,}", " ", l.strip()) for l in linhas]
    return [re.sub(r"\s{2,}", " ", " ".join(esquerda)),
            re.sub(r"\s{2,}", " ", " ".join(direita))]


def ler_itens(linhas, nomes_de_pontos=()):
    """Itens descritos no texto e o enigma da estante (qual livro puxar)."""
    pontos = {n.upper() for n in nomes_de_pontos}
    itens, livros = [], []
    for i, linha in enumerate(linhas):
        texto = re.sub(r"\s{2,}", " ", linha.strip())
        if (m := ENIGMA_DA_ESTANTE.match(texto)):
            livros.append({"prateleira": int(m.group(1)), "livro": m.group(2).strip()})
        elif (m := ITEM_NA_PROSA.match(texto)) and not any(
                m.group(1).strip().upper() in n or n.startswith(m.group(1).strip().upper())
                for n in pontos):
            corpo = [m.group(2)]
            for proxima in linhas[i + 1:i + 4]:
                seguinte = re.sub(r"\s{2,}", " ", proxima.strip())
                if not seguinte or seguinte.isupper() or ITEM_NA_PROSA.match(seguinte):
                    break
                corpo.append(seguinte)
            descricao = " ".join(corpo).strip()
            itens.append({"nome": m.group(1).title(),
                          "descricao": descricao[0].upper() + descricao[1:]})
    # Os molhos de chaves: o livro lista o que cada um abre logo depois de "As chaves
    # abrem:", uma fechadura por linha, com o número do molho na frase anterior.
    for i, linha in enumerate(linhas):
        if "As chaves abrem" not in linha:
            continue
        contexto = " ".join(l.strip() for l in linhas[max(0, i - 3):i + 1])
        if not (m := re.search(r"molho de chaves\s*(\d)", contexto)):
            continue
        abre = []
        for proxima in linhas[i + 1:i + 9]:
            seguinte = re.sub(r"[\ue000-\uf8ff•]", " ", proxima)
            seguinte = re.sub(r"\s{2,}", " ", seguinte.strip())
            if not seguinte:
                continue
            if seguinte.isupper() or seguinte.endswith(":") or len(seguinte) > 60:
                break
            if re.fullmatch(r"\d{1,3}", seguinte):     # número de página na margem
                continue
            abre.append(seguinte.strip())
        nome = f"Molho de Chaves {m.group(1)}"
        if abre and not any(it["nome"] == nome for it in itens):
            itens.append({"nome": nome, "descricao": "Abre: " + "; ".join(abre) + "."})
    return {"itens": itens, "enigmaDaEstante": livros}


def extrair():
    linhas = trecho_do_porao(texto_do_pdf())
    pontos, atual = [], None
    i = 0
    while i < len(linhas):
        linha = linhas[i]
        cab = CABECALHO.match(linha)
        if cab and atual is not None:
            col_dt, col_info = colunas(linha)
            novas, fim, sobras = ler_tabela(linhas, i + 1, col_dt, col_info)
            atual["informacoes"].extend(novas)
            atual["notas"].extend(sobras)
            atual["bruto"].extend(linhas[i:fim])
            i = fim
            continue

        if atual is not None:
            atual["bruto"].append(linha)

        if eh_titulo(linhas, i):
            m = TITULO.match(linha)
            nome, condicao = m.group(2).strip(), (m.group(4) or "").strip()
            recuo_do_titulo = len(m.group(1))
            # "PONTO (CONTINUAÇÃO)" é a mesma tabela virando a página: as linhas
            # seguintes somam no ponto que já existe, em vez de criar um ponto novo.
            if "CONTINUAÇÃO" in nome.upper() and atual:
                i += 1
                continue
            atual = {"nome": nome, "condicao": condicao, "descricao": [],
                     "informacoes": [], "caixa": [], "bruto": [], "conteudo": [], "notas": [],
                     "descricao_cruas": [], "recuo": recuo_do_titulo,
                     "na_caixa": False, "no_conteudo": False}
            pontos.append(atual)
        elif atual is not None and not RUIDO.match(linha) and atual["informacoes"]:
            # Depois do quadro vem o texto de mestre do ponto: por que aquilo está ali,
            # o que significa, o que o grupo pode concluir. Era jogado fora.
            atual["notas"].append(linha.strip())
        elif atual is not None and not RUIDO.match(linha) and not atual["informacoes"]:
            texto = linha.strip()
            recuo = len(linha) - len(linha.lstrip())
            # "CONTEÚDO" abre o que o mestre lê ao vencer o desafio: o corpo no freezer,
            # o ídolo no armário — com handout e teste de Disciplina junto.
            if texto == "CONTEÚDO":
                atual["no_conteudo"], atual["na_caixa"] = True, False
                i += 1
                continue
            if atual["no_conteudo"]:
                atual["conteudo"].append(texto)
                i += 1
                continue
            # A coluna da direita da caixa às vezes é impressa ANTES do rótulo (o banco
            # de perguntas do celular). Descrição do ponto nunca começa tão à direita.
            if ABRE_CAIXA.search(texto) or DESAFIO_NA_CAIXA.search(texto):
                atual["na_caixa"] = True
            elif atual["na_caixa"] and recuo < 20 and len(texto) > 60 and texto[0].isupper():
                # Linha longa na margem: a caixa acabou e o texto do ponto voltou.
                atual["na_caixa"] = False
            # Recuo MUITO maior que o do título é coluna da direita de caixa. Medir em
            # absoluto quebrava os pontos impressos na coluna da direita da página, cujo
            # texto inteiro começa lá pela coluna 51.
            elif recuo >= atual["recuo"] + 20 and atual["descricao"]:
                atual["caixa"].append(linha.rstrip())
                i += 1
                continue
            if atual["na_caixa"] or texto.isupper():
                # Guarda a linha COM o recuo: é ele que diz qual coluna da caixa é qual.
                atual["caixa"].append(linha.rstrip())
            else:
                atual["descricao"].append(texto)
                atual["descricao_cruas"].append(linha.rstrip())
        i += 1

    for p in pontos:
        texto = " ".join(desempilhar_colunas(p["descricao_cruas"]))
        # O número do ponto no mapa é impresso na margem e cai no meio da frase.
        texto = re.sub(r"\s{3,}\d{1,2}\s+", " ", texto)
        texto = re.sub(r"\s+\d{1,2}\s*$", "", texto)
        p["descricao"] = re.sub(r"\s{2,}", " ", texto).strip()
        p.pop("recuo", None)
        p.pop("na_caixa", None)
        p.pop("no_conteudo", None)
        # O conteúdo revelado é texto de mestre, não descrição do que se vê.
        notas = " ".join(p.pop("notas", []))
        notas = re.sub(r"\s{3,}\d{1,3}\s+", " ", notas)     # número de página na margem
        p["notas"] = re.sub(r"\s{2,}", " ", notas).strip()
        conteudo = " ".join(p.pop("conteudo", []))
        p["conteudo"] = re.sub(r"\s{2,}", " ", re.sub(r"\s+\d{1,3}\s*$", "", conteudo)).strip()
        p["desafio"] = ler_desafio(p.pop("caixa"), p["nome"])
        # Sem caixa, o desafio ainda pode estar no texto ("As correntes podem ser
        # abertas com arrombar (DT 10, PA 10)…").
        if not p["desafio"]:
            p["desafio"] = desafio_na_prosa(p["bruto"])
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
    porao = trecho_do_porao(texto_do_pdf())
    maldicao = {"regras": ler_regras_da_maldicao(porao), "eventos": ler_maldicao(porao)}
    SAIDA_MALDICAO.write_text(json.dumps(maldicao, ensure_ascii=False, indent=2))
    print(f"{len(pontos)} ponto(s) com quadro → {SAIDA}")
    print(f"{len(maldicao['eventos'])} evento(s) de rodada (a maldição) → {SAIDA_MALDICAO}")
    extras = ler_itens(trecho_do_porao(texto_do_pdf()), [p["nome"] for p in pontos])
    SAIDA_ITENS.write_text(json.dumps(extras, ensure_ascii=False, indent=2))
    print(f"{len(extras['itens'])} item(ns) e {len(extras['enigmaDaEstante'])} livro(s) do enigma → {SAIDA_ITENS}")
    for p in pontos:
        pericias = {i["pericia"] for i in p["informacoes"]}
        print(f"  {p['nome'][:42]:44} {len(p['informacoes']):2} linhas  {sorted(pericias)}")
