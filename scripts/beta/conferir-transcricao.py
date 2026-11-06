#!/usr/bin/env python3
"""Compara, página a página, as palavras da fonte com as da transcrição. Sem amostragem.

Multiconjunto de palavras: pega omissão e invenção, não pega linha trocada. Para isso, confira
as colunas de DT contra `pdftotext -bbox` (scripts/beta/README.md).

Uso: conferir-transcricao.py <pasta extraido> [-v]
"""
import re, sys, glob, os, collections, unicodedata
BASE = sys.argv[1]
# Diferença aceita por página, com o motivo. Revisão nova do PDF: rever, não acrescentar no automático.
ACEITAS = {
    4: {"sobra": {"arquivos", "secretos"}},           # logo em imagem, entra na frase
    11: {"falta": {"d8"}, "sobra": set("12345678")},  # a chave 1-8 da tabela é um ícone 'N_on_d8'
    12: {"falta": {"aumenquando", "tar"}, "sobra": {"aumentar", "quando"}},  # quebra de coluna
    36: {"falta": set("123456")},                     # rótulos do mapa, em comentário
    61: {"falta": set("1234567")},                    # rótulos do mapa, em comentário
    63: {"sobra": {"perícia", "dt", "informação"}},   # cabeçalho repetido: tabela de continuação
}
def norm(s):
    s = unicodedata.normalize('NFC', s)
    s = re.sub(r'(\d+)_on_(d\d+)', r'\2', s)           # ícones de dado
    s = re.sub(r'(?<=\w)[-­]\s*\n\s*(?=\w)', '', s)  # hifenização
    s = re.sub(r'(?<![0-9A-Za-zÀ-ÿ])(\d+)d(\d+)', r'\1 d\2', s)  # "2d6" e "2 [ícone d6]" são o mesmo
    s = s.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
    return s
PAL = re.compile(r"[0-9A-Za-zÀ-ÿ]+")
def palavras(s): return [p.lower() for p in PAL.findall(s)]
def sem_hifen(c):  # junta chaves com '-' removido: "fazê-lo" e "fazêlo" batem
    return c
resumo = []
por_pag = {}
for f in sorted(glob.glob(os.path.join(BASE, 'livro', '*.md'))):
    txt = open(f, encoding='utf8').read()
    txt = re.sub(r'<!--(?! p\.\d+ -->).*?-->', ' ', txt, flags=re.S)
    txt = txt.replace('**[Leitura]**', ' ').replace('<br>', ' ')
    partes = re.split(r'<!-- p\.(\d+) -->', txt)
    for i in range(1, len(partes), 2):
        por_pag[int(partes[i])] = (os.path.basename(f), norm(re.sub(r'[|*#>`_]', ' ', partes[i+1])))
total_f = total_t = 0
ruins = 0
for n, (arq, t) in sorted(por_pag.items()):
    src_path = os.path.join(BASE, 'paginas', f'{n:02d}.raw.txt')
    src = norm(open(src_path, encoding='utf8').read())
    ps = collections.Counter(palavras(src)); pt = collections.Counter(palavras(t))
    # rodapé: número da própria página pode faltar
    ps[str(n)] = 0 if ps[str(n)] <= 1 else ps[str(n)] - 1
    falta = ps - pt; sobra = pt - ps
    # hifen real na quebra de linha: a fonte perde o hifen ("Trata-\nse" -> "tratase") e
    # a transcricao mantem ("trata" + "se"). Casa token faltante com dois que sobram.
    for tok in list(falta):
        while falta[tok] > 0:
            achou = False
            for i in range(1, len(tok)):
                x, y = tok[:i], tok[i:]
                if sobra[x] > 0 and sobra[y] > 0 and (x != y or sobra[x] > 1):
                    sobra[x] -= 1; sobra[y] -= 1; falta[tok] -= 1; achou = True; break
            if not achou: break
    falta += collections.Counter(); sobra += collections.Counter()
    # hifenização sem quebra (ex.: "ata- que" já resolvido) e junções: tenta casar concatenações
    ac = ACEITAS.get(n, {})
    for k in ac.get('falta', ()): falta.pop(k, None)
    for k in ac.get('sobra', ()): sobra.pop(k, None)
    tot = sum(ps.values()); total_f += tot; total_t += sum(pt.values())
    fl, sb = sum(falta.values()), sum(sobra.values())
    cob = 100*(tot-fl)/tot if tot else 100
    marca = '' if fl <= max(2, tot*0.005) and sb <= max(2, tot*0.005) else ' <<<'
    if marca: ruins += 1
    print(f"p.{n:02d} {arq:32s} fonte {tot:4d}  faltam {fl:3d}  sobram {sb:3d}  cob {cob:5.1f}%{marca}")
    if marca or '-v' in sys.argv:
        print('    faltam:', ' '.join(f'{k}×{v}' if v>1 else k for k,v in falta.most_common(40)))
        print('    sobram:', ' '.join(f'{k}×{v}' if v>1 else k for k,v in sobra.most_common(40)))
paginas_com_texto = {int(os.path.basename(p)[:2]) for p in glob.glob(os.path.join(BASE,'paginas','*.raw.txt')) if len(palavras(open(p,encoding='utf8').read()))>3}
faltando = sorted(paginas_com_texto - set(por_pag))
print(f"\npáginas transcritas {len(por_pag)}; com texto na fonte e sem transcrição: {faltando}; reprovadas: {ruins}")
print(f"palavras fonte {total_f}, transcrição {total_t}")
sys.exit(1 if faltando or ruins else 0)
