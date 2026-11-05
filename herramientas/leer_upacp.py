"""Lee las páginas anuales de escalas de UPACP y genera filas (vigencia, categoría, modalidad, hora, mensual)."""
import sys, re, html, json, glob, os
sys.stdout.reconfigure(encoding='utf-8')

MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
         'septiembre', 'octubre', 'noviembre', 'diciembre']
CATS = ['PRIMERA', 'SEGUNDA', 'TERCERA', 'CUARTA', 'QUINTA']


def texto(path):
    s = open(path, encoding='utf8', errors='replace').read()
    i = s.find('Escalas salariales históricas', s.find('<body'))
    if i < 0:
        i = s.find('<table') - 3000
    s = s[max(0, i):]
    s = re.sub(r'<script.*?</script>', '', s, flags=re.S)
    s = re.sub(r'<style.*?</style>', '', s, flags=re.S)
    s = re.sub(r'<(tr|/tr|table|/table|h\d|/h\d|p|/p|br|div|/div|li)[^>]*>', '\n', s)
    s = re.sub(r'<t[dh][^>]*>', ' | ', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s).replace('\xa0', ' ')
    s = re.sub(r'[ \t]+', ' ', s)
    return re.sub(r'\n\s*\n+', '\n', s)


TIPEOS = []

def num(t):
    orig = t
    t = t.strip().strip('.,')
    # El último separador seguido de 1 o 2 dígitos es el decimal; el resto son miles
    m = re.fullmatch(r'([\d.,]*?)[.,](\d{1,2})', t)
    if m:
        entero, dec = re.sub(r'[.,]', '', m.group(1)), m.group(2)
    else:
        entero, dec = re.sub(r'[.,]', '', t), '0'
    if re.search(r'\.\d{3}\.\d{2}$|,\d{3},\d{2}$', orig.strip()):
        TIPEOS.append(orig)
    return float(f'{entero}.{dec}')


filas, avisos = [], []
for path in sorted(glob.glob(os.path.join(sys.argv[1], '*.html'))):
    anio = os.path.basename(path)[:4]
    t = texto(path)
    # Cada tabla empieza en "PRIMERA CATEGORIA"; su fecha es la última "Mes (de) AAAA" que aparece antes
    inicios = [m.start() for m in re.finditer(r'PRIMERA\s+CATEGOR', t, flags=re.I)]
    re_fecha = re.compile(r'(' + '|'.join(MESES) + r')\s*(?:de\s*|del\s*)?(\d{4})', flags=re.I)
    for k, ini in enumerate(inicios):
        fin = inicios[k + 1] if k + 1 < len(inicios) else len(t)
        previo = t[(inicios[k - 1] if k else 0):ini]
        # descarta el texto de la tabla anterior hasta su fin (después de QUINTA)
        q = list(re.finditer(r'QUINTA\s+CATEGOR', previo, flags=re.I))
        previo = previo[q[-1].end():] if q else previo
        # quita notas de antigüedad que mencionan fechas viejas
        previo = re.sub(r'ADICIONAL POR ANTIG.*?(sin efecto retroactivo|\n)', '', previo, flags=re.I | re.S)
        fechas = list(re_fecha.finditer(previo))
        if not fechas:
            avisos.append(f'página {anio}, tabla {k + 1}: sin fecha')
            continue
        mes, a = fechas[-1].group(1).lower(), fechas[-1].group(2)
        bloque = t[ini:fin]
        vig = f'{a}-{MESES.index(mes) + 1:02d}-01'
        mr = re.search(r'Resoluci[oó]n\s*(?:CNTCP)?\s*N?[°º]?\s*([\d]+\s*/\s*\d{2,4})', bloque, flags=re.I)
        resol = ('CNTCP ' + re.sub(r'\s', '', mr.group(1))) if mr else None
        mz = re.search(r'ZONA DESFAVORABLE.*?\((\d+)\s*%\)', bloque, flags=re.I | re.S)
        zona = int(mz.group(1)) if mz else None
        # Segmentos por categoría
        pos = []
        for c in CATS:
            m = re.search(c + r'\s+CATEGOR', bloque, flags=re.I)
            pos.append(m.start() if m else None)
        if None in pos:
            avisos.append(f'{vig}: no encontré todas las categorías')
            continue
        pos.append(len(bloque))
        for ci in range(5):
            seg = bloque[pos[ci]:pos[ci + 1]]
            seg = seg.split('El personal que efect')[0].split('ADICIONAL')[0]
            montos = [num(x) for x in re.findall(r'\$\s*([\d][\d.,]*)', seg)]
            horas, mens = montos[0::2], montos[1::2]
            if any(h > m for h, m in zip(horas, mens)):
                avisos.append(f'{vig} cat {ci + 1}: orden raro {montos}')
            if ci == 2 and len(horas) == 1 and len(mens) == 1:
                horas, mens = horas * 2, mens * 2
            if len(horas) != 2 or len(mens) != 2:
                avisos.append(f'{vig} cat {ci + 1}: horas={horas} mensual={mens}')
                continue
            for j, mod in enumerate(['con_retiro', 'sin_retiro']):
                filas.append({'vigencia': vig, 'cat': ci + 1, 'mod': mod, 'hora': horas[j],
                              'mensual': mens[j], 'resol': resol, 'zona': zona, 'pagina': anio})

json.dump(filas, open(sys.argv[2], 'w', encoding='utf8'), ensure_ascii=False, indent=0)
vigs = sorted({f['vigencia'] for f in filas})
print('filas:', len(filas), '| vigencias:', len(vigs), '|', vigs[0] if vigs else '', '→', vigs[-1] if vigs else '')
print("TIPEOS interpretados:", TIPEOS)
print("AVISOS:", len(avisos))
for a in avisos:
    print(' ', a)
