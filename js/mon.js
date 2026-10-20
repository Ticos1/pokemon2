// Instâncias de Pokémon: status, experiência, evolução e geração de times.
(function () {
  const { DEX, SHINY_RATE } = window.RULES;
  let uidCounter = 1;

  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  function weighted(pairs) {
    const total = pairs.reduce((s, p) => s + p[1], 0);
    let r = Math.random() * total;
    for (const [v, w] of pairs) { if ((r -= w) < 0) return v; }
    return pairs[pairs.length - 1][0];
  }

  function calcStats(mon) {
    const b = DEX[mon.id], L = mon.lvl, iv = mon.ivs;
    const st = k => Math.floor((2 * b[k] + iv[k]) * L / 100) + 5;
    return {
      maxhp: Math.floor((2 * b.hp + iv.hp) * L / 100) + L + 10,
      atk: st('atk'), def: st('def'), spa: st('spa'), spd: st('spd'), spe: st('spe'),
    };
  }

  function refresh(mon) {
    const oldMax = mon.maxhp || 0;
    Object.assign(mon, calcStats(mon));
    if (oldMax) {
      if (mon.hp > 0) mon.hp = Math.min(mon.maxhp, mon.hp + (mon.maxhp - oldMax));
    } else {
      mon.hp = mon.maxhp;
    }
  }

  function create(id, lvl, opts = {}) {
    const ivs = {};
    for (const k of ['hp', 'atk', 'def', 'spa', 'spd', 'spe']) ivs[k] = randInt(opts.minIv || 0, 31);
    const mon = {
      uid: uidCounter++, id, lvl, xp: 0, ivs,
      shiny: opts.shiny !== undefined ? opts.shiny : false,
    };
    refresh(mon);
    return mon;
  }

  const name = mon => DEX[mon.id].name;
  const xpNext = lvl => Math.round(.9 * lvl * lvl + 2 * lvl + 15);

  // Escolhe a evolução para um nível (Eevee escolhe uma aleatória)
  function evolutionFor(mon) {
    const evos = DEX[mon.id].evo.filter(e => mon.lvl >= e.level);
    return evos.length ? pick(evos).to : null;
  }

  // Espécie evoluída adequada a um nível (para treinadores e selvagens)
  function evolvedFor(id, lvl) {
    let cur = id;
    for (let guard = 0; guard < 3; guard++) {
      const evos = DEX[cur].evo.filter(e => lvl >= e.level + 2);
      if (!evos.length) break;
      cur = pick(evos).to;
    }
    return cur;
  }

  function bst(id) {
    const d = DEX[id];
    return d.hp + d.atk + d.def + d.spa + d.spd + d.spe;
  }

  const EXCLUDE_WILD = new Set([1, 4, 7, 138, 140, 142, 132]);
  const WILD_BASES = window.POKEDEX.filter(p => !p.from && !p.legendary && !EXCLUDE_WILD.has(p.id));

  // Primeira rota: só Pokémon de início de jogo
  const ROUTE1 = [[16, 30], [19, 30], [10, 15], [13, 15], [21, 15], [29, 10], [32, 10], [25, 2]];

  // Força máxima (soma dos status base) permitida em cada parte da rota
  const maxBstFor = slot => (slot < 2 ? 330 : slot < 6 ? 420 : 999);

  function wildSpecies(slot) {
    if (slot === 0) return weighted(ROUTE1);
    const maxBst = maxBstFor(slot);
    const pool = WILD_BASES.filter(p => bst(p.id) <= maxBst).map(p => [p.id, p.catch]);
    return weighted(pool);
  }

  function rollShiny(mult = 1) {
    return Math.random() < SHINY_RATE * mult;
  }

  window.MON = {
    rand, randInt, pick, weighted, create, refresh, name, xpNext, evolutionFor, evolvedFor,
    wildSpecies, rollShiny, bst, maxBstFor,
  };
})();
