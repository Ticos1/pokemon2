"""Gera os gráficos do GBA (FireRed) usados no jogo a partir do projeto pret/pokefirered.

  git clone --depth 1 https://github.com/pret/pokefirered /caminho/pokefirered
  python3 tools/build_gba.py /caminho/pokefirered

Saída em assets/gba/ e assets/gba.js (posições de cada sprite nas folhas).
"""
import json
import os
import sys
from collections import Counter

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from gba_maps import MapRenderer, load_layout, render_layout  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'gba')

# Personagens do mapa (16x32 por quadro): nome no jogo -> arquivo
PEOPLE = {
    'player': 'red_normal', 'rival': 'blue', 'nurse': 'nurse', 'clerk': 'clerk', 'oldman': 'old_man_1',
    'fisher': 'fisher', 'rocket': 'rocket_m', 'oak': 'prof_oak',
    'brock': 'brock', 'misty': 'misty', 'surge': 'lt_surge', 'erika': 'erika', 'koga': 'koga',
    'sabrina': 'sabrina', 'blaine': 'blaine', 'giovanni': 'giovanni',
    'lorelei': 'lorelei', 'bruno': 'bruno', 'agatha': 'agatha', 'lance': 'lance',
    'youngster': 'youngster', 'lass': 'lass', 'bug': 'bug_catcher', 'hiker': 'hiker',
    'swimmer': 'swimmer_m_land', 'blackbelt': 'black_belt', 'channeler': 'channeler', 'nerd': 'scientist',
    'birdkeeper': 'camper', 'tamer': 'cooltrainer_m', 'cooltrainer': 'cooltrainer_f', 'beauty': 'beauty',
    'gentleman': 'gentleman', 'sailor': 'sailor', 'picnicker': 'picnicker', 'maniac': 'poke_maniac',
}

# Retratos de batalha (64x64)
PORTRAITS = {
    'player': 'red', 'rival': 'rival_late', 'champion': 'champion_rival', 'rocket': 'rocket_grunt_m',
    'brock': 'leader_brock', 'misty': 'leader_misty', 'surge': 'leader_lt_surge', 'erika': 'leader_erika',
    'koga': 'leader_koga', 'sabrina': 'leader_sabrina', 'blaine': 'leader_blaine', 'giovanni': 'leader_giovanni',
    'lorelei': 'elite_four_lorelei', 'bruno': 'elite_four_bruno', 'agatha': 'elite_four_agatha', 'lance': 'elite_four_lance',
    'youngster': 'youngster', 'lass': 'lass', 'bug': 'bug_catcher', 'hiker': 'hiker', 'swimmer': 'swimmer_m',
    'blackbelt': 'black_belt', 'channeler': 'channeler', 'nerd': 'super_nerd', 'birdkeeper': 'bird_keeper',
    'tamer': 'tamer', 'cooltrainer': 'cool_trainer_f', 'beauty': 'beauty', 'gentleman': 'gentleman',
    'sailor': 'sailor', 'picnicker': 'picnicker', 'maniac': 'pokemaniac',
}

# Metatiles da Rota 1 usados na caminhada
ROUTE_TILES = {
    'grass00': 0x8, 'grass01': 0x9, 'grass10': 0x10, 'grass11': 0x11,
    'tall': 0xd, 'flowerA': 0x1, 'flowerB': 0x4,
    'pathL': 0xdb, 'pathC': 0xdc, 'pathR': 0xdd,
    'forestL0': 0x1c, 'forestL1': 0x1f, 'forestL2': 0x14, 'forestL3': 0x17,
    'forestR0': 0x1e, 'forestR1': 0x1d, 'forestR2': 0x16, 'forestR3': 0x15,
    'treeTL': 0xe, 'treeTR': 0xf, 'treeBL': 0x26, 'treeBR': 0x27,
    # caminho na horizontal: bordas de cima/baixo, cantos e cantos internos (praça encostando no caminho)
    'pathT': 0xd4, 'pathB': 0xe4, 'pathTL': 0xd3, 'pathTR': 0xd5, 'pathBL': 0xe3, 'pathBR': 0xe5,
    'pathInTL': 0x102, 'pathInTR': 0x103, 'pathInBL': 0x104, 'pathInBR': 0x105,
    # floresta fechada (blocos alternados), base dos troncos e copas da borda de baixo
    'woodA': 0x1c, 'woodB': 0x1d, 'woodC': 0x14, 'woodD': 0x15,
    'trunkA': 0x24, 'trunkB': 0x25, 'canopyA': 0x1e, 'canopyB': 0x1f,
    'ledgeL': 0xb0, 'ledge': 0x87, 'ledgeR': 0xb1, 'sign': 0x3,
}

# Prédios: (layout, porta x, porta y, x0, y0, x1, y1 relativos à porta, em blocos)
BUILDINGS = {
    'center': ('PewterCity_Layout', 17, 25, -2, -4, 2, 0),
    'mart': ('PewterCity_Layout', 28, 18, -2, -3, 1, 0),
    'gym': ('VermilionCity_Layout', 14, 25, -3, -4, 3, 0),
    'league': ('IndigoPlateau_Exterior_Layout', 11, 6, -5, -6, 5, 1),
}

# Arenas: interior de cada ginásio e salas da Liga
ARENAS = {
    'rock': 'PewterCity_Gym_Layout', 'water': 'CeruleanCity_Gym_Layout', 'electric': 'VermilionCity_Gym_Layout',
    'grass': 'CeladonCity_Gym_Layout', 'poison': 'FuchsiaCity_Gym_Layout', 'psychic': 'SaffronCity_Gym_Layout',
    'fire': 'CinnabarIsland_Gym_Layout', 'ground': 'ViridianCity_Gym_Layout', 'rocket': 'RocketHideout_B1F_Layout',
    'lorelei': 'PokemonLeague_LoreleisRoom_Layout', 'bruno': 'PokemonLeague_BrunosRoom_Layout',
    'agatha': 'PokemonLeague_AgathasRoom_Layout', 'lance': 'PokemonLeague_LancesRoom_Layout',
    'champion': 'PokemonLeague_ChampionsRoom_Layout',
}
LEAGUE_ROOMS = {'lorelei', 'bruno', 'agatha', 'lance', 'champion'}

LOW_W, LOW_H = 180, 320
ARENA_CENTER = (90, 155)  # centro da arena na tela em baixa resolução


def transparent(path):
    src = Image.open(path)
    img = src.convert('RGBA')
    px, a = src.load(), img.load()
    for y in range(src.height):
        for x in range(src.width):
            if px[x, y] == 0:
                a[x, y] = (0, 0, 0, 0)
    return img


def build_people(pret, meta):
    names = list(PEOPLE)
    sheet = Image.new('RGBA', (16 * 9, 32 * len(names)), (0, 0, 0, 0))
    for row, key in enumerate(names):
        img = transparent(os.path.join(pret, 'graphics/object_events/pics/people', PEOPLE[key] + '.png'))
        n = img.width // 16
        # ordem do FireRed: 0 baixo, 1 cima, 2 esquerda, 3-4 andando baixo, 5-6 cima, 7-8 esquerda
        order = list(range(9)) if n >= 9 else [0, 1, 2, 0, 0, 1, 1, 2, 2]
        for i, f in enumerate(order):
            sheet.paste(img.crop((f * 16, 0, f * 16 + 16, 32)), (i * 16, row * 32))
    sheet.save(os.path.join(OUT, 'people.png'), optimize=True)
    meta['people'] = {k: i for i, k in enumerate(names)}


def build_portraits(pret, meta):
    names = list(PORTRAITS)
    sheet = Image.new('RGBA', (64 * len(names), 64), (0, 0, 0, 0))
    for i, key in enumerate(names):
        img = transparent(os.path.join(pret, 'graphics/trainers/front_pics', PORTRAITS[key] + '_front_pic.png'))
        sheet.paste(img, (i * 64, 0))
    sheet.save(os.path.join(OUT, 'portraits.png'), optimize=True)
    meta['portraits'] = {k: i for i, k in enumerate(names)}


def water(r, blocks):
    # o metatile mais azul do mapa é a água
    def blue(mid):
        cols = r.metatile(mid).getcolors(256) or []
        return sum(n for n, (cr, cg, cb, ca) in cols if cb > cr + 40 and cb > cg)
    return r.metatile(max(set(blocks), key=blue))


def build_tiles(pret, meta):
    lay, blocks = load_layout(pret, 'Route1_Layout')
    r = MapRenderer(pret, lay['primary_tileset'], lay['secondary_tileset'])
    tiles = dict(ROUTE_TILES)
    # água: lago de Pallet
    pl, pb = load_layout(pret, 'PalletTown_Layout')
    pr = MapRenderer(pret, pl['primary_tileset'], pl['secondary_tileset'])
    names = list(tiles) + ['water']
    sheet = Image.new('RGBA', (16 * len(names), 16), (0, 0, 0, 0))
    for i, k in enumerate(names):
        img = water(pr, pb) if k == 'water' else r.metatile(tiles[k])
        sheet.alpha_composite(img, (i * 16, 0))
    sheet.save(os.path.join(OUT, 'tiles.png'), optimize=True)
    meta['tiles'] = {k: i for i, k in enumerate(names)}


def build_buildings(pret, meta):
    out = {}
    imgs = []
    cache = {}
    for key, (layout, dx, dy, x0, y0, x1, y1) in BUILDINGS.items():
        if layout not in cache:
            cache[layout] = render_layout(pret, layout)[0]
        img = cache[layout].crop(((dx + x0) * 16, (dy + y0) * 16, (dx + x1 + 1) * 16, (dy + y1 + 1) * 16))
        imgs.append((key, img))
    w = sum(i.width for _, i in imgs)
    h = max(i.height for _, i in imgs)
    sheet = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    x = 0
    for key, img in imgs:
        sheet.alpha_composite(img, (x, 0))
        out[key] = [x, 0, img.width, img.height]
        x += img.width
    sheet.save(os.path.join(OUT, 'buildings.png'), optimize=True)
    meta['buildings'] = out


def floor_tile(r, blocks, w, h):
    # metatile mais comum fora das 3 primeiras linhas (a parede)
    c = Counter(blocks[y * w + x] for y in range(3, h) for x in range(w))
    return r.metatile(c.most_common(1)[0][0])


def build_arenas(pret):
    for theme, layout in ARENAS.items():
        img, lay, blocks, r = render_layout(pret, layout)
        w, h = lay['width'], lay['height']
        canvas = Image.new('RGBA', (LOW_W, LOW_H), (16, 16, 24, 255))
        floor = floor_tile(r, blocks, w, h)
        for ty in range(0, LOW_H, 16):
            for tx in range(0, LOW_W, 16):
                canvas.alpha_composite(floor, (tx, ty))
        if theme in LEAGUE_ROOMS:
            # sala inteira centralizada (a sala do Lance é só a parte da esquerda)
            room = img.crop((0, 0, 13 * 16, 13 * 16)) if theme == 'lance' else img
            cx = room.width // 2
            cy = room.height // 2 + (8 if theme != 'champion' else 0)
            canvas.alpha_composite(room, (ARENA_CENTER[0] - cx, ARENA_CENTER[1] - cy))
        else:
            # parede do fundo do ginásio no topo, piso no resto
            wall = img.crop((0, 0, img.width, 48))
            x = (LOW_W - wall.width) // 2
            canvas.alpha_composite(wall, (x, 8))
        canvas.save(os.path.join(OUT, f'arena_{theme}.png'), optimize=True)

    # arena da rota: grama com grama alta e floresta
    lay, blocks = load_layout(pret, 'Route1_Layout')
    r = MapRenderer(pret, lay['primary_tileset'], lay['secondary_tileset'])
    canvas = Image.new('RGBA', (LOW_W, LOW_H), (0, 0, 0, 255))
    for row in range(-1, LOW_H // 16 + 1):
        for col in range(12):
            x, y = col * 16 - 6, row * 16
            if col in (0, 1):
                mid = [0x1c, 0x1f, 0x14, 0x17][(row % 2) * 2 + col]
            elif col in (10, 11):
                mid = [0x1e, 0x1d, 0x16, 0x15][(row % 2) * 2 + col - 10]
            elif row < 3 or row > 15:
                mid = 0xd
            else:
                mid = [0x8, 0x9, 0x10, 0x11][(row % 2) * 2 + col % 2]
            canvas.alpha_composite(r.metatile(mid), (x, y)) if x >= 0 else canvas.paste(r.metatile(mid).crop((-x, 0, 16, 16)), (0, y))
    canvas.save(os.path.join(OUT, 'arena_route.png'), optimize=True)


BADGE_TINTS = [(176, 176, 184), (80, 150, 248), (248, 168, 48), (120, 208, 96),
               (248, 120, 176), (232, 192, 64), (240, 80, 56), (88, 184, 104)]


def build_badges(pret):
    # as insígnias vêm em tons de cinza; a cor de cada uma é aplicada aqui
    src = Image.open(os.path.join(pret, 'graphics/trainer_card/badges.png'))
    gray = src.convert('RGBA')
    idx = src.load()
    out = Image.new('RGBA', gray.size, (0, 0, 0, 0))
    o, g = out.load(), gray.load()
    for y in range(src.height):
        for x in range(src.width):
            if idx[x, y] == 0:
                continue
            r, gg, b, _ = g[x, y]
            k = (r + gg + b) / 3 / 255
            tr, tg, tb = BADGE_TINTS[x // 16]
            if k > .85:
                o[x, y] = (255, 255, 255, 255)
            elif k < .2:
                o[x, y] = (40, 40, 48, 255)
            else:
                o[x, y] = (int(tr * (k + .25)) if tr * (k + .25) < 255 else 255,
                           int(min(255, tg * (k + .25))), int(min(255, tb * (k + .25))), 255)
    out.save(os.path.join(OUT, 'badges.png'), optimize=True)


if __name__ == '__main__':
    pret = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    build_people(pret, meta)
    build_portraits(pret, meta)
    build_tiles(pret, meta)
    build_buildings(pret, meta)
    build_arenas(pret)
    build_badges(pret)
    meta['arenas'] = sorted(list(ARENAS) + ['route'])
    with open(os.path.join(ROOT, 'assets', 'gba.js'), 'w') as f:
        f.write('// Gerado por tools/build_gba.py a partir de pret/pokefirered\n')
        f.write('window.GBA = ' + json.dumps(meta, separators=(',', ':')) + ';\n')
    print('ok', {k: len(v) for k, v in meta.items()})
