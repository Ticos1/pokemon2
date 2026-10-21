"""Gera os sprites originais dos Pokémon andando de lado (seguidores do HeartGold/SoulSilver)
a partir do projeto pret/pokeheartgold.

  git clone --depth 1 https://github.com/pret/pokeheartgold /caminho/pokeheartgold
  python3 tools/build_overworld.py /caminho/pokeheartgold

Saída: assets/overworld.png, uma linha de quadros 32x32 por Pokémon (1 a 151):
  colunas 0-1 andando para a esquerda, 2-3 para a direita; 4-7 o mesmo com as cores shiny.
"""
import os
import re
import struct
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'overworld.png')
N = 151
SIZE = 32
MMODEL_FOLLOWER_MON_BASE = 297  # include/constants/mmodel.h
SIDE_FRAMES = (4, 5, 6, 7)      # quadros do arquivo: 0-1 costas, 2-3 frente, 4-5 esquerda, 6-7 direita


def u16(b, o):
    return struct.unpack_from('<H', b, o)[0]


def u32(b, o):
    return struct.unpack_from('<I', b, o)[0]


def info_block(b, o):
    """Lista (nome, dados) de um bloco de informações do formato 3D do DS."""
    n = b[o + 1]
    p = o + 4 + 8 + 4 * n
    unit = u16(b, p)
    p += 4
    data = [b[p + i * unit:p + (i + 1) * unit] for i in range(n)]
    p += unit * n
    names = [b[p + i * 16:p + (i + 1) * 16].rstrip(b'\0').decode() for i in range(n)]
    return list(zip(names, data))


def read_btx(path):
    """Lê um .NSBTX (texturas do DS): devolve os quadros com cada paleta."""
    b = open(path, 'rb').read()
    assert b[:4] == b'BTX0', path
    tex = b[u32(b, 0x10):]
    tex_data, pal_data = u32(tex, 0x14), u32(tex, 0x38)
    textures = []
    for _, d in info_block(tex, u16(tex, 0x0E)):
        p = u16(d, 2)
        textures.append({'off': u16(d, 0) << 3, 'w': 8 << ((p >> 4) & 7), 'h': 8 << ((p >> 7) & 7),
                         'fmt': (p >> 10) & 7, 'clear0': (p >> 13) & 1})
    palettes = [u16(d, 0) << 3 for _, d in info_block(tex, u32(tex, 0x34))]

    def decode(t, pal):
        assert t['fmt'] == 3, 'esperava textura de 16 cores'
        po = pal_data + palettes[pal]
        colors = []
        for i in range(16):
            c = u16(tex, po + 2 * i)
            colors.append(((c & 31) * 255 // 31, (c >> 5 & 31) * 255 // 31, (c >> 10 & 31) * 255 // 31, 255))
        img = Image.new('RGBA', (t['w'], t['h']))
        px = img.load()
        o = tex_data + t['off']
        for i in range(t['w'] * t['h']):
            v = tex[o + i // 2] >> (4 * (i & 1)) & 15
            px[i % t['w'], i // t['w']] = (0, 0, 0, 0) if v == 0 and t['clear0'] else colors[v]
        return img

    return textures, decode


def follower_indexes(pret):
    """Índice de seguidor de cada espécie (as formas fêmeas têm índice próprio e são puladas)."""
    out = []
    with open(os.path.join(pret, 'include', 'constants', 'follow_mon_idx.h')) as f:
        for line in f:
            m = re.match(r'#define FOLLOWER_MON_(\w+)\s+(\d+)', line)
            if m and m.group(1) != 'NONE' and not m.group(1).endswith('_F'):
                out.append(int(m.group(2)))
    return out[:N]


def build(pret):
    sheet = Image.new('RGBA', (SIZE * 8, SIZE * N), (0, 0, 0, 0))
    for k, idx in enumerate(follower_indexes(pret)):
        path = os.path.join(pret, 'files', 'data', 'mmodel', 'mmodel',
                            f'mmodel_{MMODEL_FOLLOWER_MON_BASE + idx:08d}.NSBTX')
        textures, decode = read_btx(path)
        for shiny in (0, 1):
            for c, fr in enumerate(SIDE_FRAMES):
                img = decode(textures[fr], shiny)
                sheet.paste(img, ((shiny * 4 + c) * SIZE, k * SIZE))
    sheet.save(OUT, optimize=True)
    print('overworld.png', sheet.size)


if __name__ == '__main__':
    build(sys.argv[1])
