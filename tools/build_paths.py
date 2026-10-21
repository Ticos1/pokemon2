"""Gera os caminhos por onde o treinador anda dentro dos mapas (cavernas, prédios, Floresta de Viridian)
a partir da colisão de verdade do FireRed (projeto pret/pokefirered).

  git clone --depth 1 https://github.com/pret/pokefirered /caminho/pokefirered
  python3 tools/build_paths.py /caminho/pokefirered

Saída: assets/paths.js, com window.MAP_PATHS[mapa] = lista de pontos [x, y] (em blocos de 16px)
onde o caminho faz curva, e window.MAP_WATER[mapa] = blocos de água (uma linha hex por fileira). O caminho é o mais longo entre dois pontos do maior pedaço andável do mapa,
então o treinador nunca passa por cima de árvores, paredes, água ou degraus.
"""
import json
import os
import re
import struct
import sys
from collections import deque

sys.path.insert(0, os.path.dirname(__file__))
from build_gba import AREA_MAPS  # noqa: E402
from gba_maps import NUM_METATILES_IN_PRIMARY, load_layout, snake, tileset_sources  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'paths.js')

# blocos que têm colisão livre mas não dá para andar (ou ficaria estranho passar por cima)
BLOCKED = re.compile(r'WATER|WATERFALL|JUMP|CURRENT|DIVE|WARP|DOOR|LADDER|STAIRS|SPIN|HOLE|CRACKED|COUNTER|TELEPORT')


def behaviors(root):
    names = {}
    txt = open(os.path.join(root, 'include/constants/metatile_behaviors.h')).read()
    for m in re.finditer(r'#define (MB_\w+)\s+(0x[0-9A-Fa-f]+|\d+)', txt):
        names[int(m.group(2), 0)] = m.group(1)
    return names


def attributes(root, name, primary):
    kind = 'primary' if primary else 'secondary'
    folder = os.path.join(root, 'data/tilesets', kind, snake(tileset_sources(root, name)['metatiles']))
    raw = open(os.path.join(folder, 'metatile_attributes.bin'), 'rb').read()
    return [v & 0x1FF for v in struct.unpack('<%dI' % (len(raw) // 4), raw)]


def grid(root, layout, mb_names):
    lay, _ = load_layout(root, layout + '_Layout')
    raw = open(os.path.join(root, lay['blockdata_filepath']), 'rb').read()
    vals = struct.unpack('<%dH' % (len(raw) // 2), raw)
    pa = attributes(root, lay['primary_tileset'], True)
    sa = attributes(root, lay['secondary_tileset'], False)
    w, h = lay['width'], lay['height']
    cells, water = {}, set()
    for i, v in enumerate(vals):
        mid, coll, elev = v & 0x3FF, (v >> 10) & 3, v >> 12
        if mid < NUM_METATILES_IN_PRIMARY:
            mb = pa[mid] if mid < len(pa) else 0
        else:
            k = mid - NUM_METATILES_IN_PRIMARY
            mb = sa[k] if k < len(sa) else 0
        name = mb_names.get(mb, '')
        if coll == 0 and not BLOCKED.search(name):
            cells[(i % w, i // w)] = elev
        if re.search(r'POND|OCEAN|DEEP_WATER|FAST_WATER', name):
            water.add((i % w, i // w))
    return w, h, cells, water


def neighbors(cells, p):
    x, y = p
    ea = cells[p]
    for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        q = (x + d[0], y + d[1])
        if q not in cells:
            continue
        eb = cells[q]
        # como no jogo: só muda de altura passando por um bloco de transição (0 ou 15)
        if ea == eb or ea in (0, 15) or eb in (0, 15):
            yield q, d


def bfs(cells, start):
    dist = {start: 0}
    queue = deque([start])
    while queue:
        p = queue.popleft()
        for q, _ in neighbors(cells, p):
            if q not in dist:
                dist[q] = dist[p] + 1
                queue.append(q)
    return dist


def longest_path(cells):
    # maior pedaço conectado
    seen, best = set(), None
    for p in cells:
        if p in seen:
            continue
        comp = bfs(cells, p)
        seen |= comp.keys()
        if best is None or len(comp) > len(best):
            best = comp
    # duas buscas: o ponto mais longe de qualquer um, e o mais longe dele
    a = max(best, key=lambda q: (best[q], q))
    da = bfs(cells, a)
    b = max(da, key=lambda q: (da[q], q))
    db = bfs(cells, b)
    # de a até b descendo a distância, seguindo reto sempre que der (menos curvas, como um jogador)
    path, p, last = [a], a, None
    while p != b:
        opts = [(q, d) for q, d in neighbors(cells, p) if db.get(q) == db[p] - 1]
        q, d = next(((q, d) for q, d in opts if d == last), opts[0])
        path.append(q)
        p, last = q, d
    # só os pontos de curva
    turns = [path[0]]
    for i in range(1, len(path) - 1):
        (x0, y0), (x1, y1), (x2, y2) = path[i - 1], path[i], path[i + 1]
        if (x1 - x0, y1 - y0) != (x2 - x1, y2 - y1):
            turns.append(path[i])
    turns.append(path[-1])
    # começa pela ponta mais à esquerda (o treinador entra andando para a direita)
    if turns[-1][0] < turns[0][0]:
        turns.reverse()
    return [list(t) for t in turns], len(path)


def build(root):
    mb_names = behaviors(root)
    out, wet = {}, {}
    for key, layout in AREA_MAPS.items():
        w, h, cells, water = grid(root, layout, mb_names)
        out[key], n = longest_path(cells)
        # água do mapa (para a boia da pesca cair no mar): uma linha hex por fileira de blocos
        if water:
            wet[key] = [''.join('%x' % sum(8 >> b for b in range(4) if (x + b, y) in water)
                                for x in range(0, w, 4)) for y in range(h)]
        print(f'{key:16} {n:4} blocos, {len(out[key])} pontos' + (', com água' if water else ''))
    with open(OUT, 'w') as f:
        f.write('// Gerado por tools/build_paths.py a partir de pret/pokefirered\n')
        f.write('window.MAP_PATHS = ' + json.dumps(out, separators=(',', ':')) + ';\n')
        f.write('window.MAP_WATER = ' + json.dumps(wet, separators=(',', ':')) + ';\n')


if __name__ == '__main__':
    build(sys.argv[1])
