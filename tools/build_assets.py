"""Baixa dados e sprites dos 151 Pokémon de Kanto (PokéAPI) e gera:
  assets/data.js    -> window.POKEDEX com tipos, status, evoluções etc.
  assets/*.png      -> folhas de sprites (front, back, shiny, ícones, itens)

Uso: python3 tools/build_assets.py           (cache em tools/.cache)
     python3 tools/build_assets.py sprites   (só as folhas dos Pokémon)
"""
import io
import json
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", ".cache")
OUT = os.path.join(ROOT, "assets")
API = "https://pokeapi.co/api/v2"
SPR = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites"
N = 151
COLS = 16

# Evoluções que não são por nível viram nível fixo (o jogo é curto)
STONE_LEVEL = 28
TRADE_LEVEL = 34
OTHER_LEVEL = 30


def fetch(url):
    name = url.replace("https://", "").replace("/", "_")
    path = os.path.join(CACHE, name)
    if os.path.exists(path):
        with open(path, "rb") as f:
            return f.read()
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "pokemon2-build/1.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
            break
        except Exception:
            if attempt == 3:
                raise
    with open(path, "wb") as f:
        f.write(data)
    return data


def fetch_json(url):
    return json.loads(fetch(url))


def species_id(url):
    return int(url.rstrip("/").split("/")[-1])


def walk_chain(node, evos):
    src = species_id(node["species"]["url"])
    for nxt in node["evolves_to"]:
        dst = species_id(nxt["species"]["url"])
        if dst <= N and src <= N:
            det = nxt["evolution_details"][0] if nxt["evolution_details"] else {}
            trig = det.get("trigger", {}).get("name")
            if trig == "level-up" and det.get("min_level"):
                lvl = det["min_level"]
            elif trig == "use-item":
                lvl = STONE_LEVEL
            elif trig == "trade":
                lvl = TRADE_LEVEL
            else:
                lvl = OTHER_LEVEL
            evos.setdefault(src, []).append({"to": dst, "level": lvl})
        walk_chain(nxt, evos)


def build_data():
    def one(i):
        p = fetch_json(f"{API}/pokemon/{i}")
        s = fetch_json(f"{API}/pokemon-species/{i}")
        return p, s

    with ThreadPoolExecutor(16) as ex:
        results = list(ex.map(one, range(1, N + 1)))

    chains = sorted({s["evolution_chain"]["url"] for _, s in results})
    evos = {}
    for url in chains:
        walk_chain(fetch_json(url)["chain"], evos)

    dex = []
    for p, s in results:
        st = {x["stat"]["name"]: x["base_stat"] for x in p["stats"]}
        prev = s["evolves_from_species"]
        dex.append({
            "id": p["id"],
            "name": p["name"].replace("-m", "♂").replace("-f", "♀").capitalize()
            if p["name"].startswith("nidoran") else
            {"mr-mime": "Mr. Mime", "farfetchd": "Farfetch'd"}.get(p["name"], p["name"].capitalize()),
            "types": [t["type"]["name"] for t in p["types"]],
            "hp": st["hp"], "atk": st["attack"], "def": st["defense"],
            "spa": st["special-attack"], "spd": st["special-defense"], "spe": st["speed"],
            "exp": p["base_experience"] or 60,
            "height": p["height"], "weight": p["weight"],
            "catch": s["capture_rate"],
            "legendary": s["is_legendary"] or s["is_mythical"],
            "from": species_id(prev["url"]) if prev and species_id(prev["url"]) <= N else None,
            "evo": evos.get(p["id"], []),
        })

    with open(os.path.join(OUT, "data.js"), "w") as f:
        f.write("// Gerado por tools/build_assets.py a partir da PokéAPI\n")
        f.write("window.POKEDEX = " + json.dumps(dex, separators=(",", ":"), ensure_ascii=False) + ";\n")
    print("data.js:", len(dex), "pokémon,", sum(len(v) for v in evos.values()), "evoluções")


# Sprites dos Pokémon: Black/White (96x96, corpo inteiro de frente e de costas).
# Cada sprite é recortado e apoiado na linha MON_FEET, centralizado na horizontal,
# para que os pés fiquem sempre no mesmo lugar (js/art.js usa o mesmo valor).
MON_SIZE = 96
MON_FEET = 90


def build_mon_sheet(name, path_fmt):
    w = h = MON_SIZE
    rows = (N + COLS - 1) // COLS
    sheet = Image.new("RGBA", (COLS * w, rows * h), (0, 0, 0, 0))

    def one(i):
        return i, Image.open(io.BytesIO(fetch(f"{SPR}/{path_fmt.format(i)}"))).convert("RGBA")

    with ThreadPoolExecutor(16) as ex:
        for i, img in ex.map(one, range(1, N + 1)):
            k = i - 1
            img = img.crop(img.getbbox())
            x = (w - img.width) // 2
            y = max(0, MON_FEET - img.height)
            sheet.paste(img, ((k % COLS) * w + x, (k // COLS) * h + y))
    sheet.save(os.path.join(OUT, name), optimize=True)
    print(name, sheet.size)


def build_sheet(name, path_fmt, size):
    w, h = size
    rows = (N + COLS - 1) // COLS
    sheet = Image.new("RGBA", (COLS * w, rows * h), (0, 0, 0, 0))

    def one(i):
        return i, Image.open(io.BytesIO(fetch(f"{SPR}/{path_fmt.format(i)}"))).convert("RGBA")

    with ThreadPoolExecutor(16) as ex:
        for i, img in ex.map(one, range(1, N + 1)):
            k = i - 1
            img = img.crop((0, 0, w, h)) if img.size != (w, h) else img
            sheet.paste(img, ((k % COLS) * w, (k // COLS) * h))
    sheet.save(os.path.join(OUT, name), optimize=True)
    print(name, sheet.size)


ITEMS = ["poke-ball", "great-ball", "ultra-ball", "potion", "super-potion",
         "hyper-potion", "revive", "rare-candy", "nugget"]


def build_items():
    sheet = Image.new("RGBA", (30 * len(ITEMS), 30), (0, 0, 0, 0))
    for k, it in enumerate(ITEMS):
        img = Image.open(io.BytesIO(fetch(f"{SPR}/items/{it}.png"))).convert("RGBA")
        bbox = img.getbbox()
        img = img.crop(bbox)
        x = k * 30 + (30 - img.width) // 2
        y = (30 - img.height) // 2
        sheet.paste(img, (x, y))
    sheet.save(os.path.join(OUT, "items.png"), optimize=True)
    print("items.png", ITEMS)


if __name__ == "__main__":
    import sys
    os.makedirs(CACHE, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    only_sprites = "sprites" in sys.argv[1:]
    if not only_sprites:
        build_data()
    bw = "pokemon/versions/generation-v/black-white/"
    build_mon_sheet("front.png", bw + "{}.png")
    build_mon_sheet("back.png", bw + "back/{}.png")
    build_mon_sheet("front_shiny.png", bw + "shiny/{}.png")
    build_mon_sheet("back_shiny.png", bw + "back/shiny/{}.png")
    if not only_sprites:
        build_sheet("icons.png", "pokemon/versions/generation-vii/icons/{}.png", (40, 30))
        build_items()
