"""Extrai os pontos de interesse do Ato I do PDF do playtest.

O PDF é a fonte da verdade do texto — e não é nosso para redistribuir, então o
resultado deste script fica fora do repositório (ver `.gitignore`). Quem tem o PDF
gera o compêndio na própria máquina.

O layout é regular: título em caixa alta, descrição, um bloco opcional de desafio de
acesso, e a tabela `Perícia | DT | Informação`. As colunas são fixas o bastante para
fatiar por posição — o que evita adivinhar onde a informação começa quando a perícia
da linha está vazia (linha que continua a perícia anterior).
"""
import re, subprocess, json, os, pathlib, sys

# O PDF ganha revisões; OP2_PDF aponta para a que se quer extrair.
PDF = pathlib.Path(os.environ.get("OP2_PDF", "docs/Ordem-Paranormal-RPG-2-Playtest-Alpha-agentes.pdf"))
# Fora de `packs/sources/`: ali dentro todo .json é documento de compêndio.
SAIDA = pathlib.Path("build/ato-i-pontos.json")
SAIDA_MALDICAO = pathlib.Path("build/ato-i-maldicao.json")
SAIDA_ITENS = pathlib.Path("build/ato-i-itens.json")
SAIDA_ROTEIRO = pathlib.Path("build/ato-i-roteiro.json")
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


def linearizar_duas_colunas(linhas, coluna_minima=44):
    """Reescreve as páginas de duas colunas como texto em uma coluna só.

    Algumas páginas do porão põem dois assuntos lado a lado — a Sala Secreta à esquerda
    e a Mesa de Poker, um ponto INTEIRO com quadro próprio, à direita. Lido linha a
    linha, o ponto da direita não existia e o da esquerda vinha embaralhado.

    O vão entre as colunas é uma faixa de espaços que atravessa todas as linhas do
    trecho. Só conta como duas colunas se o vão estiver bem à direita (a partir da
    coluna 44) e os dois lados tiverem corpo — senão é a tabela do quadro, cujo vão
    entre "Perícia" e "DT" fica bem antes disso.
    """
    saida, i = [], 0
    while i < len(linhas):
        # Junta o trecho até duas linhas em branco seguidas (fim de bloco na página).
        fim, brancas = i, 0
        while fim < len(linhas):
            if not linhas[fim].strip():
                brancas += 1
                if brancas >= 3:
                    break
            else:
                brancas = 0
            fim += 1

        bloco = linhas[i:fim]
        corpo = [l for l in bloco if l.strip()]
        vao = None
        if len(corpo) >= 10:
            largura = max(len(l) for l in corpo)
            cheias = [l.ljust(largura) for l in corpo]
            atual = None
            for coluna in range(coluna_minima, min(largura, 78)):
                if all(l[coluna] == " " for l in cheias):
                    atual = (atual[0], coluna) if atual else (coluna, coluna)
                    if not vao or (atual[1] - atual[0]) > (vao[1] - vao[0]):
                        vao = atual
                else:
                    atual = None
            if vao and vao[1] - vao[0] < 3:
                vao = None
            if vao:
                corte = vao[0]
                esquerda = [l for l in bloco if l[:corte].strip()]
                direita = [l for l in bloco if len(l) > corte and l[corte:].strip()]
                if len(esquerda) < 5 or len(direita) < 5:
                    vao = None

        if vao:
            corte = vao[0]
            saida += [l[:corte].rstrip() for l in bloco if l[:corte].strip()]
            saida.append("")
            saida.append("")
            # A coluna da direita mantém o recuo relativo dela, não o da página.
            saida += [l[corte:].rstrip() for l in bloco if len(l) > corte and l[corte:].strip()]
            saida.append("")
            saida.append("")
        else:
            saida += bloco
        i = fim
    return saida


# O roteiro do ato: a narração de abertura, as instruções de como começar e a narração
# final. Fica fora de "PONTOS DE INTERESSE", que é só o miolo da investigação.
def juntar_hifenizacao(texto):
    """Coluna estreita quebra palavra no fim da linha: "ilu- minada" volta a ser uma."""
    return re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", texto)


ABERTURA = re.compile(r"^INTRODUÇÃO\s*$")
CENA_INICIAL = re.compile(r"^O ÍDOLO DE PEDRA, ATO I\s*$")
NARRACAO_FINAL = re.compile(r"^NARRAÇÃO FINAL\s*$")
DEPOIS_DO_FIM = re.compile(r"^\s*DEPOIS DO FIM\s*$")


def ler_roteiro(linhas):
    """Abertura, instruções de início e narração final, na ordem em que o mestre usa."""
    def bloco(inicio, fim):
        try:
            a = next(i for i, l in enumerate(linhas) if inicio.match(l))
            b = next(i for i, l in enumerate(linhas) if i > a and fim.match(l))
        except StopIteration:
            return ""
        cru = linearizar_duas_colunas(linhas[a + 1:b], coluna_minima=38)
        # Fora números de página soltos e a contagem de jogadores em ícones.
        texto = [re.sub(r"\s{2,}", " ", l.strip()) for l in cru if l.strip()]
        texto = [t for t in texto if not re.fullmatch(r"[\d\s]{1,6}", t)]
        return juntar_hifenizacao("\n".join(texto).strip())

    # A introdução do Ato I é a SEGUNDA do PDF (a primeira abre o livro inteiro).
    inicios = [i for i, l in enumerate(linhas) if ABERTURA.match(l)]
    ini_ato = inicios[1] if len(inicios) > 1 else inicios[0]
    resto = linhas[ini_ato:]
    def bloco_relativo(inicio, fim, coluna_minima=38, corte_fixo=None):
        try:
            a = next(i for i, l in enumerate(resto) if inicio.match(l))
            b = next(i for i, l in enumerate(resto) if i > a and fim.match(l))
        except StopIteration:
            return ""
        bruto = resto[a + 1:b]
        if corte_fixo:
            # Caixa lateral sem vão perfeito (a dica da trilha na abertura): corta por
            # posição, lendo a página primeiro e a caixa depois.
            esquerda = [l[:corte_fixo].rstrip() for l in bruto if l[:corte_fixo].strip()]
            direita = [l[corte_fixo:].rstrip() for l in bruto if len(l) > corte_fixo and l[corte_fixo:].strip()]
            bruto = esquerda + ["", ""] + direita
        # Página de narração: duas colunas mais estreitas que as do miolo.
        cru = linearizar_duas_colunas(bruto, coluna_minima=coluna_minima)
        texto = [re.sub(r"\s{2,}", " ", l.strip()) for l in cru if l.strip()]
        return juntar_hifenizacao(
            "\n".join(t for t in texto if not re.fullmatch(r"[\d\s]{1,6}", t)).strip())

    return {
        # Na abertura, a segunda "coluna" é uma caixinha lateral estreita ("use como
        # trilha de fundo a música O Porão") — ela começa bem mais à direita.
        "introducao": bloco_relativo(ABERTURA, CENA_INICIAL, corte_fixo=60),
        "cenaInicial": bloco_relativo(CENA_INICIAL, INICIO),
        "narracaoFinal": bloco(NARRACAO_FINAL, DEPOIS_DO_FIM),
    }


def trecho_do_porao(linhas):
    ini = next(i for i, l in enumerate(linhas) if INICIO.match(l))
    fim = next(i for i, l in enumerate(linhas) if i > ini and FIM.match(l))
    return linearizar_duas_colunas(linhas[ini:fim])


def colunas(cabecalho):
    """Onde começam DT e Informação, para fatiar as linhas da tabela."""
    return cabecalho.index("DT"), cabecalho.index("Informação")


# Os nomes que a coluna da esquerda pode trazer — é o que separa rótulo de prosa.
NOMES_DE_PERICIA = ("(" + "|".join([
    "Acrobacia", "Aptidão", "Atletismo", "Crime", "Disciplina", "Enganação", "Furtividade",
    "Intimidar", "Intuição", "Luta", "Máquinas", "Medicina", "Ocultismo", "Percepção",
    "Persuasão", "Pesquisar", "Pontaria", "Sobrevivência", "Tecnologia", "Vigor",
]) + ")")


def ler_tabela(linhas, i, col_dt, col_info):
    """Lê a tabela até ela acabar. Devolve (informações, próximo índice).

    Uma linha da tabela ocupa VÁRIAS linhas de texto: o nome da perícia e a DT vêm
    centralizados verticalmente sobre a informação, que quebra em quantas linhas
    precisar. As linhas em branco separam um bloco do outro.

    E a perícia vale para o bloco inteiro em que aparece — inclusive para os blocos
    ACIMA dela, já que a centralização pode colocá-la no meio. Ler linha a linha
    prendia cada informação à perícia errada.
    """
    blocos, atual, vazias, prosa = [], [], 0, []
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
        # Numa linha de tabela, a coluna do meio só tem a DT. Se ela tem LETRAS, o texto
        # está atravessando as colunas: é prosa de mestre que a coluna estreita empurrou
        # para dentro da tabela (a Mesa de Poker, impressa ao lado da Sala Secreta).
        if re.search(r"[A-Za-zÀ-ÿ]", meio):
            if atual:
                blocos.append(atual)
                atual = []
            prosa.append(linha.strip())
            i += 1
            continue

        atual.append((pericia, meio, info, linha))
        i += 1

    if atual: blocos.append(atual)

    # Um bloco pode conter MAIS DE UMA linha do quadro: o livro só separa com linha em
    # branco quando muda de perícia, então "Percepção 6 …" e "Percepção 10 …" vêm
    # coladas. Cada célula de DT é uma linha; o texto sem DT vai para a célula mais
    # próxima (empate fica com a de cima, que é onde o livro começa a frase).
    # Bloco sem DT nenhuma não é quadro: é o texto de mestre que vem depois da tabela.
    infos, sobras, pendente = [], [re.sub(r"\s{2,}", " ", " ".join(prosa)).strip()] if prosa else [], []
    for bloco in blocos:
        indices_dt = [k for k, (_, meio, _, _) in enumerate(bloco) if meio.isdigit()]
        inteiro = re.sub(r"\s{2,}", " ", " ".join(crua.strip() for _, _, _, crua in bloco)).strip()
        if not indices_dt:
            # Sem DT e escrito SÓ na coluna de informação: é continuação da linha
            # anterior do quadro, um parágrafo a mais dela (o chat de grupo no celular
            # de Gustavo). Texto que invade a coluna da perícia é nota de mestre, que
            # vem depois da tabela.
            so_informacao = all(not pericia and not meio for pericia, meio, _, _ in bloco)
            texto_extra = " ".join(info for _, _, info, _ in bloco if info).strip()
            if so_informacao and texto_extra:
                # Fica pendente para a PRÓXIMA linha do quadro: a DT é centralizada
                # sobre o grupo inteiro, então o parágrafo que vem antes do número
                # ainda é dela (o chat de grupo no celular de Gustavo).
                pendente.append(texto_extra)
            elif inteiro:
                sobras.append(inteiro)
            continue

        # O rótulo da perícia quebra em duas linhas ("Aptidão" / "(Humanas)",
        # "Percepção" / "(apenas se o ídolo for quebrado)"). Juntar antes de distribuir:
        # senão cada pedaço ia para uma linha do quadro diferente, e sobrava "(Humanas)"
        # como se fosse perícia.
        rotulos = {}
        inicio = None
        prosa_na_coluna = []
        for k, (pericia, meio, info, crua) in enumerate(bloco):
            if not pericia:
                continue
            # Em coluna estreita (a Mesa de Poker), o texto de mestre invade a coluna da
            # perícia. O que não tem nome de perícia nem é continuação entre parênteses
            # não é rótulo: é prosa, e vai para as notas em vez de sumir.
            eh_rotulo = bool(re.search(NOMES_DE_PERICIA, pericia, re.I))
            aberto = inicio is not None and rotulos[inicio].count("(") > rotulos[inicio].count(")")
            # "(exclusivo" numa linha e "Alan)" na outra: enquanto o parêntese não fecha,
            # o que vem é continuação do rótulo.
            continuacao = pericia.startswith("(") or aberto or (inicio is not None and pericia.islower())
            if eh_rotulo:
                inicio = k
                rotulos[k] = pericia
            elif continuacao and inicio is not None and len(pericia) < 40:
                rotulos[inicio] = f"{rotulos[inicio]} {pericia}".strip()
            else:
                prosa_na_coluna.append(pericia)
        if prosa_na_coluna:
            sobras.append(re.sub(r"\s{2,}", " ", " ".join(prosa_na_coluna)).strip())

        linhas_por_dt = {k: [] for k in indices_dt}
        rotulos_por_dt = {k: [] for k in indices_dt}
        for k, (_, _, info, _) in enumerate(bloco):
            alvo = min(indices_dt, key=lambda d: (abs(d - k), d > k))
            if info:
                linhas_por_dt[alvo].append(info)
        for k, rotulo in rotulos.items():
            alvo = min(indices_dt, key=lambda d: (abs(d - k), d > k))
            rotulos_por_dt[alvo].append(rotulo)

        for k in indices_dt:
            texto = " ".join(linhas_por_dt[k]).strip()
            if not texto:
                continue
            infos.append({"pericia": " ".join(rotulos_por_dt[k]).strip(),
                          "dt": int(bloco[k][1])})
            infos[-1]["texto"] = " ".join([*pendente, texto]).strip()
            pendente = []

    # Sobrou parágrafo depois da última linha do quadro: é continuação dela.
    if pendente and infos:
        infos[-1]["texto"] = f"{infos[-1]['texto']} {' '.join(pendente)}".strip()
    elif pendente:
        sobras.extend(pendente)

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


PRATELEIRA = re.compile(r"^\s*PRATELEIRA\s+(\d)\s*$")


def ler_prateleiras(linhas):
    """A lista completa dos livros de cada prateleira, para o mestre ler em voz alta.

    Não é só a solução do enigma: são cerca de vinte títulos, e é neles que os jogadores
    procuram os quatro certos. Cada livro pode ocupar duas linhas (o autor desce), e a
    continuação vem mais recuada que o item.
    """
    prateleiras, atual, item = [], None, None
    for linha in linhas:
        if (m := PRATELEIRA.match(linha)):
            atual = {"prateleira": int(m.group(1)), "livros": []}
            prateleiras.append(atual)
            item = None
            continue
        if atual is None:
            continue
        # O marcador de lista do PDF é um glifo de fonte de ícones (área privativa) ou
        # um byte solto de controle; fora os dois.
        texto = re.sub(r"[\ue000-\uf8ff\u0080-\u009f•]", " ", linha)
        texto = re.sub(r"\s{2,}", " ", texto).strip()
        recuo = len(linha) - len(linha.lstrip())
        if not texto:
            continue
        # Título novo começa mais à esquerda; a linha mais recuada continua o anterior.
        if item is not None and recuo > item["recuo"]:
            item["texto"] += f" {texto}"
            continue
        # A prateleira 5 é a última: a lista acaba quando a página vira (número de
        # página solto, título em caixa alta ou cabeçalho de quadro).
        if len(prateleiras) == 5 and (texto.isupper() or CABECALHO.match(linha)
                                      or re.fullmatch(r"\d{1,3}", texto)
                                      or len(atual["livros"]) >= 4):
            break
        item = {"texto": texto, "recuo": recuo}
        atual["livros"].append(item)
    return [{"prateleira": p["prateleira"],
             "livros": [re.sub(r"\s{2,}", " ", l["texto"]).strip() for l in p["livros"]]}
            for p in prateleiras if p["livros"]]


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
    return {"itens": itens, "enigmaDaEstante": livros, "prateleiras": ler_prateleiras(linhas)}


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

        # A seção da maldição vem logo depois do Ídolo de Pedra e não é nota dele:
        # tem extração própria (regras + tabela por rodada).
        if atual is not None and (INICIO_REGRAS.search(linha) or INICIO_MALDICAO.match(linha)):
            atual = None
            i += 1
            continue

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
                     "depois_da_caixa": False,
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
            elif atual["na_caixa"] and abs(recuo - atual["recuo"]) <= 4 \
                    and len(texto) > 60 and texto[0].isupper():
                # Linha longa alinhada com o TÍTULO: a caixa acabou e o texto do ponto
                # voltou. Medir contra a margem da página deixava passar a coluna da
                # caixa, que é ainda mais à esquerda (a estante engolia "ACESSO PORTA
                # Apenas uma pessoa pode passar por rodada").
                atual["na_caixa"] = False
                atual["depois_da_caixa"] = True
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
            elif atual["depois_da_caixa"]:
                # Ponto sem quadro (o duto): o que vem depois da caixa já é texto de
                # mestre, não a descrição do que se vê.
                atual["notas"].append(texto)
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
        p.pop("depois_da_caixa", None)
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


def limpar_rotulo(rotulo):
    """Fica só com a perícia (e a condição entre parênteses) dentro do rótulo lido.

    Em página de coluna estreita — a Mesa de Poker, impressa ao lado da Sala Secreta —
    o texto de mestre invade a coluna da perícia e vem grudado no rótulo. Como a lista
    de perícias é fechada, dá para recortar o rótulo de verdade.
    """
    texto = re.sub(r"\s{2,}", " ", rotulo).strip()
    nomes = sorted(PERICIAS, key=len, reverse=True)
    m = re.search(rf"({'|'.join(re.escape(n) for n in nomes)})", texto, re.I)
    if not m:
        return texto
    inicio = m.start()
    resto = texto[m.end():]
    # Mantém o que completa o rótulo: "(Humanas)", "ou Sobrevivência", "(apenas Victor)".
    cauda = re.match(r"^(\s*\([^)]*\)|\s+ou\s+\w+)+", resto)
    return (texto[inicio:m.end()] + (cauda.group(0) if cauda else "")).strip()


def chave_de_pericia(rotulo):
    """Devolve (chave, condição). "Aptidão (Humanas)" vira aptidao.humanas."""
    texto = limpar_rotulo(rotulo)
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
    roteiro = ler_roteiro(texto_do_pdf())
    SAIDA_ROTEIRO.write_text(json.dumps(roteiro, ensure_ascii=False, indent=2))
    print(f"roteiro: {', '.join(f'{k} {len(v)} chars' for k, v in roteiro.items())} → {SAIDA_ROTEIRO}")
    for p in pontos:
        pericias = {i["pericia"] for i in p["informacoes"]}
        print(f"  {p['nome'][:42]:44} {len(p['informacoes']):2} linhas  {sorted(pericias)}")
