"""Renderiza mapas e metatiles do FireRed a partir do projeto pret/pokefirered.

Uso como biblioteca (ver tools/build_gba.py) ou direto:
  python3 tools/gba_maps.py /caminho/pokefirered PewterCity_Layout saida.png
"""
import json
import os
import re
import struct
import sys

from PIL import Image

NUM_TILES_IN_PRIMARY = 640
NUM_METATILES_IN_PRIMARY = 640
NUM_PALS_IN_PRIMARY = 7


def snake(name):
    # gTileset_PewterCity -> pewter_city
    name = name.replace('gTileset_', '')
    # SSAnne -> ss_anne (siglas ficam juntas)
    return re.sub(r'(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])', '_', name).lower()


def read_pal(path):
    lines = open(path).read().split('\n')
    cols = []
    for ln in lines[3:19]:
        r, g, b = map(int, ln.split()[:3])
        cols.append((r, g, b))
    return cols


_HEADERS = {}


def tileset_sources(root, name):
    # alguns tilesets reaproveitam gráficos/paletas de outros (ver headers.h)
    if not _HEADERS:
        txt = open(os.path.join(root, 'src/data/tilesets/headers.h')).read()
        for m in re.finditer(r'const struct Tileset (gTileset_\w+) =\s*\{(.*?)\};', txt, re.S):
            body = m.group(2)
            get = lambda k: re.search(r'\.' + k + r'\s*=\s*(\w+)', body).group(1)
            _HEADERS[m.group(1)] = {
                'tiles': get('tiles').replace('gTilesetTiles_', 'gTileset_'),
                'palettes': get('palettes').replace('gTilesetPalettes_', 'gTileset_'),
                'metatiles': get('metatiles').replace('gMetatiles_', 'gTileset_'),
            }
    return _HEADERS.get(name, {'tiles': name, 'palettes': name, 'metatiles': name})


class Tileset:
    def __init__(self, root, name, primary):
        kind = 'primary' if primary else 'secondary'
        src = tileset_sources(root, name)
        folder = lambda n: os.path.join(root, 'data/tilesets', kind, snake(n))
        self.tiles = Image.open(os.path.join(folder(src['tiles']), 'tiles.png'))
        self.cols = self.tiles.width // 8
        self.ntiles = self.cols * (self.tiles.height // 8)
        self.pals = [read_pal(os.path.join(folder(src['palettes']), 'palettes', f'{i:02d}.pal')) for i in range(16)]
        raw = open(os.path.join(folder(src['metatiles']), 'metatiles.bin'), 'rb').read()
        self.metatiles = [struct.unpack_from('<8H', raw, i * 16) for i in range(len(raw) // 16)]
        self.pix = self.tiles.load()


class MapRenderer:
    def __init__(self, root, primary, secondary):
        self.p = Tileset(root, primary, True)
        self.s = Tileset(root, secondary, False)
        # paletas 0-6 vêm do primário, 7-12 do secundário
        self.pals = self.p.pals[:NUM_PALS_IN_PRIMARY] + self.s.pals[NUM_PALS_IN_PRIMARY:]
        self.cache = {}

    def tile(self, idx, pal, hf, vf):
        key = (idx, pal, hf, vf)
        if key in self.cache:
            return self.cache[key]
        ts = self.p
        if idx >= NUM_TILES_IN_PRIMARY:
            ts, idx = self.s, idx - NUM_TILES_IN_PRIMARY
        img = Image.new('RGBA', (8, 8), (0, 0, 0, 0))
        if idx < ts.ntiles:
            ox, oy = (idx % ts.cols) * 8, (idx // ts.cols) * 8
            colors = self.pals[pal] if pal < len(self.pals) else self.pals[0]
            out = img.load()
            for y in range(8):
                for x in range(8):
                    c = ts.pix[ox + x, oy + y]
                    if c:
                        out[x, y] = colors[c] + (255,)
        if hf:
            img = img.transpose(Image.FLIP_LEFT_RIGHT)
        if vf:
            img = img.transpose(Image.FLIP_TOP_BOTTOM)
        self.cache[key] = img
        return img

    def metatile(self, mid):
        if mid < NUM_METATILES_IN_PRIMARY:
            entries = self.p.metatiles[mid] if mid < len(self.p.metatiles) else [0] * 8
        else:
            k = mid - NUM_METATILES_IN_PRIMARY
            entries = self.s.metatiles[k] if k < len(self.s.metatiles) else [0] * 8
        img = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
        for layer in range(2):
            for i in range(4):
                e = entries[layer * 4 + i]
                t = self.tile(e & 0x3FF, e >> 12, (e >> 10) & 1, (e >> 11) & 1)
                img.alpha_composite(t, ((i % 2) * 8, (i // 2) * 8))
        return img


def load_layout(root, name):
    d = json.load(open(os.path.join(root, 'data/layouts/layouts.json')))
    lay = next(l for l in d['layouts'] if l.get('name') == name)
    raw = open(os.path.join(root, lay['blockdata_filepath']), 'rb').read()
    blocks = [v & 0x3FF for v in struct.unpack('<%dH' % (len(raw) // 2), raw)]
    return lay, blocks


def render_layout(root, name):
    lay, blocks = load_layout(root, name)
    r = MapRenderer(root, lay['primary_tileset'], lay['secondary_tileset'])
    w, h = lay['width'], lay['height']
    img = Image.new('RGBA', (w * 16, h * 16), (0, 0, 0, 255))
    for y in range(h):
        for x in range(w):
            img.alpha_composite(r.metatile(blocks[y * w + x]), (x * 16, y * 16))
    return img, lay, blocks, r


if __name__ == '__main__':
    root, name, out = sys.argv[1:4]
    img, *_ = render_layout(root, name)
    img.save(out)
    print(out, img.size)
