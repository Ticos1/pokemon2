"""Baixa da PokéAPI os golpes que cada Pokémon aprende por nível no FireRed/LeafGreen e gera
assets/moves.js -> window.LEARNSETS ({id: [[nível, golpe], ...]}) e window.MOVEDEX (dados de cada golpe).

Só entram golpes que causam dano; os nomes em português e o jeito de cada golpe na arena
ficam em js/moves.js.

Uso: python3 tools/build_moves.py   (cache em tools/.cache, o mesmo de build_assets.py)
"""
import json
import os
from concurrent.futures import ThreadPoolExecutor

from build_assets import API, CACHE, N, ROOT, fetch_json

VERSION = "firered-leafgreen"
# golpes de dano que não fazem sentido na batalha em tempo real (nocaute em um golpe, contra-ataques,
# golpes que dependem do turno do inimigo)
SKIP = {"fissure", "horn-drill", "guillotine", "counter", "mirror-coat", "bide", "explosion", "self-destruct",
        "present", "magnitude", "psywave", "endeavor", "flail", "reversal", "spit-up", "return", "frustration",
        "hidden-power", "dream-eater", "focus-punch", "struggle", "snore", "beat-up", "pursuit", "revenge",
        "nature-power", "secret-power", "eruption", "water-spout", "uproar", "facade", "fake-out"}
# golpes de dano fixo ou que dependem do peso: força equivalente
FIXED = {"seismic-toss": 60, "night-shade": 60, "dragon-rage": 55, "sonic-boom": 40, "super-fang": 60, "low-kick": 50}


def main():
    def one(i):
        return i, fetch_json(f"{API}/pokemon/{i}")

    with ThreadPoolExecutor(16) as ex:
        mons = list(ex.map(one, range(1, N + 1)))

    learn = {}
    names = set()
    for i, p in mons:
        out = []
        for m in p["moves"]:
            for d in m["version_group_details"]:
                if d["version_group"]["name"] == VERSION and d["move_learn_method"]["name"] == "level-up":
                    out.append([max(1, d["level_learned_at"]), m["move"]["name"]])
        learn[i] = sorted(out)
        names.update(n for _, n in out)

    def mv(n):
        return n, fetch_json(f"{API}/move/{n}")

    with ThreadPoolExecutor(16) as ex:
        data = dict(ex.map(mv, sorted(names)))

    # a PokéAPI traz a força atual; past_values guarda a de antes de cada mudança.
    # A força do FireRed é a da primeira mudança feita depois dele.
    groups = {g["name"] for p in data.values() for g in [x["version_group"] for x in p["past_values"]]}
    order = {g: fetch_json(f"{API}/version-group/{g}")["order"] for g in groups | {VERSION}}

    def gen3_power(d):
        later = sorted((x for x in d["past_values"] if order[x["version_group"]["name"]] > order[VERSION]),
                       key=lambda x: order[x["version_group"]["name"]])
        for x in later:
            if x["power"] is not None:
                return x["power"]
        return d["power"]

    movedex = {}
    for n, d in data.items():
        power = FIXED.get(n) or gen3_power(d)
        if not power or n in SKIP:
            continue
        meta = d.get("meta") or {}
        movedex[n] = {
            "type": d["type"]["name"],
            "pow": power,
            "cls": d["damage_class"]["name"],
            "pp": d["pp"],
            "ailment": (meta.get("ailment") or {}).get("name"),
            "chance": meta.get("ailment_chance") or 0,
            "hits": meta.get("max_hits") or 1,
            "crit": meta.get("crit_rate") or 0,
            "drain": meta.get("drain") or 0,
            "flinch": meta.get("flinch_chance") or 0,
            "prio": d["priority"],
        }
    for i in learn:
        learn[i] = [x for x in learn[i] if x[1] in movedex]

    with open(os.path.join(ROOT, "assets", "moves.js"), "w") as f:
        f.write("// Gerado por tools/build_moves.py a partir da PokéAPI (FireRed/LeafGreen, golpes por nível)\n")
        f.write("window.MOVEDEX = " + json.dumps(movedex, separators=(",", ":"), sort_keys=True) + ";\n")
        f.write("window.LEARNSETS = " + json.dumps(learn, separators=(",", ":")) + ";\n")
    print("moves.js:", len(movedex), "golpes de dano")


if __name__ == "__main__":
    os.makedirs(CACHE, exist_ok=True)
    main()
