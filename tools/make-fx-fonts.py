#!/usr/bin/env python3
"""Génère fx-fonts.js : polices Liberation Sans (OFL) réduites à l'alphabet Windows-1252 + profil sRGB (licence zlib),
utilisées pour produire des PDF/A-3 (Factur-X). Usage : python3 tools/make-fx-fonts.py <profil.icc>
Nécessite : pip install fonttools"""
import base64, json, subprocess, sys, tempfile, os
from fontTools.ttLib import TTFont
SRC = '/usr/share/fonts/truetype/liberation/LiberationSans-%s.ttf'
chars = ''.join(bytes([b]).decode('cp1252') for b in range(32, 256) if b not in (0x81, 0x8D, 0x8F, 0x90, 0x9D))
tmp = tempfile.mkdtemp(); open(tmp + '/c.txt', 'w').write(chars)
out = {}
for style in ('Regular', 'Bold'):
    dst = '%s/%s.ttf' % (tmp, style)
    subprocess.check_call(['pyftsubset', SRC % style, '--text-file=' + tmp + '/c.txt', '--output-file=' + dst, '--layout-features=', '--no-hinting',
                           '--drop-tables+=DSIG,GSUB,GPOS,kern,GDEF', '--notdef-outline'], stderr=subprocess.DEVNULL)
    f = TTFont(dst); cmap = f.getBestCmap(); hm = f['hmtx']; upm = f['head'].unitsPerEm
    w = []
    for b in range(32, 256):
        try: u = ord(bytes([b]).decode('cp1252'))
        except UnicodeDecodeError: u = None
        g = cmap.get(u) if u else None
        w.append(round(hm[g][0] * 1000 / upm) if g else round(hm['.notdef'][0] * 1000 / upm))
    h = f['head']; hh = f['hhea']; os2 = f['OS/2']
    data = open(dst, 'rb').read()
    out[style.lower()] = dict(b64=base64.b64encode(data).decode(), size=len(data), widths=w,
        bbox=[round(h.xMin * 1000 / upm), round(h.yMin * 1000 / upm), round(h.xMax * 1000 / upm), round(h.yMax * 1000 / upm)],
        asc=round(hh.ascent * 1000 / upm), desc=round(hh.descent * 1000 / upm), cap=round(getattr(os2, 'sCapHeight', 0) * 1000 / upm) or 716)
icc = base64.b64encode(open(sys.argv[1], 'rb').read()).decode()
js = ('/* Généré par tools/make-fx-fonts.py. Polices : Liberation Sans (SIL OFL 1.1). Profil sRGB : littleCMS / Kai-Uwe Behrmann (licence zlib/libpng). */\n'
      'window.FX_FONTS=%s;\nwindow.FX_ICC="%s";\n') % (json.dumps(out, separators=(',', ':')), icc)
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app', 'fx-fonts.js'), 'w').write(js)
print('fx-fonts.js', len(js), 'octets')
