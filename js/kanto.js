// Kanto inteiro, na ordem do Pokémon Red/Blue: rotas, cidades, cavernas (com os andares), prédios,
// o cassino, a Torre Pokémon, a Zona Safári, a Estrada Vitória e a Caverna Desconhecida depois da Liga.
// Cada área tem os Pokémon selvagens e os treinadores que aparecem nela no jogo de Game Boy.
// buildRoute() monta a lista de paradas da partida, com as áreas sorteadas; 'R' vira um evento sorteado da área.
(function () {
  const M = window.MON;

  // ---------- Pokémon selvagens de cada lugar (Red/Blue; [espécie, peso]) ----------
  const POOLS = {
    route1: [[16, 50], [19, 50]],
    route2: [[16, 40], [19, 40], [10, 10], [13, 10]],
    route22: [[19, 40], [21, 30], [29, 15], [32, 15]],
    forest: [[10, 30], [11, 15], [13, 30], [14, 15], [25, 5]],
    route3: [[21, 40], [39, 20], [56, 25], [19, 15]],
    mtmoon: [[41, 55], [74, 25], [46, 12], [35, 8]],
    route4: [[19, 30], [21, 30], [23, 15], [27, 15], [56, 10]],
    route24: [[10, 15], [13, 15], [43, 20], [69, 20], [63, 15], [16, 15]],
    route5: [[16, 30], [43, 20], [69, 20], [52, 20], [56, 10]],
    route6: [[16, 30], [43, 20], [69, 20], [52, 20], [56, 10]],
    route11: [[21, 35], [23, 20], [27, 20], [96, 25]],
    diglett: [[50, 95], [51, 5]],
    route9: [[19, 30], [21, 30], [23, 20], [27, 20]],
    rocktunnel: [[41, 35], [74, 30], [66, 25], [95, 10]],
    tower: [[92, 85], [93, 10], [104, 5]],
    route8: [[16, 25], [23, 15], [27, 15], [37, 15], [58, 15], [52, 15]],
    route12: [[43, 20], [69, 20], [44, 10], [70, 10], [48, 20], [16, 10], [17, 10]],
    route16: [[21, 30], [22, 10], [19, 25], [20, 10], [84, 25]],
    safari: [[32, 12], [33, 6], [29, 12], [30, 6], [102, 12], [111, 10], [46, 8], [48, 8], [113, 4], [123, 4], [127, 4], [115, 4], [128, 4], [84, 6]],
    seafoam: [[86, 20], [87, 5], [54, 12], [79, 12], [90, 10], [116, 10], [98, 10], [41, 15], [42, 6]],
    sea: [[72, 80], [73, 20]],
    route21: [[19, 25], [20, 10], [16, 25], [17, 15], [114, 25]],
    mansion: [[19, 15], [20, 10], [88, 15], [89, 5], [109, 15], [110, 5], [77, 15], [58, 10], [37, 5], [132, 5]],
    plant: [[100, 30], [81, 30], [25, 15], [82, 10], [101, 5], [125, 5], [26, 5]],
    route23: [[21, 25], [22, 20], [23, 15], [24, 15], [56, 15], [132, 10]],
    victory: [[66, 20], [67, 10], [74, 20], [75, 10], [95, 10], [41, 10], [42, 10], [105, 5], [49, 5]],
    unknown: [[42, 12], [47, 8], [26, 8], [101, 8], [82, 8], [64, 8], [132, 8], [40, 6], [85, 6], [67, 6], [112, 6], [105, 6], [113, 5], [108, 5]],
  };
  // Pesca com a Vara Boa/Super Vara (os lagos das rotas)
  const FISH = [[129, 40], [118, 12], [60, 12], [54, 8], [72, 10], [98, 8], [116, 6], [90, 6], [120, 5], [79, 5], [86, 5], [130, 2], [147, 2], [131, 1]];

  // ---------- Áreas ----------
  // kind: 'walk' = caminhada pela rota (grama, cidades); 'map' = mapa de verdade de cada andar (cavernas e prédios)
  // theme = cenário das batalhas; maps = mapa de cada andar (assets/gba/maps)
  const AREAS = {
    pallet: { name: 'Pallet Town', kind: 'walk' },
    route1: { name: 'Rota 1', kind: 'walk', pool: 'route1', lvl: [2, 5] },
    viridian: { name: 'Viridian City', kind: 'walk', city: true },
    route22: { name: 'Rota 22', kind: 'walk', pool: 'route22', lvl: [5, 9] },
    route2: { name: 'Rota 2', kind: 'walk', pool: 'route2', lvl: [4, 6], trainers: ['bug', 'youngster'] },
    forest: { name: 'Floresta de Viridian', kind: 'map', theme: 'forest', maps: { '': 'forest' }, pool: 'forest', lvl: [5, 8], trainers: ['bug'] },
    pewter: { name: 'Pewter City', kind: 'walk', city: true, maps: { Museu: 'museum' } },
    route3: { name: 'Rota 3', kind: 'walk', pool: 'route3', lvl: [7, 11], trainers: ['youngster', 'lass', 'bug'] },
    mtmoon: { name: 'Mt. Moon', kind: 'map', theme: 'cave', maps: { '1F': 'mtmoon_1f', B1F: 'mtmoon_b1f', B2F: 'mtmoon_b2f' }, pool: 'mtmoon', lvl: [8, 12], trainers: ['hiker', 'lass', 'nerd', 'bug', 'youngster'], dark: true },
    route4: { name: 'Rota 4', kind: 'walk', pool: 'route4', lvl: [10, 12], trainers: ['lass', 'youngster'], water: true },
    cerulean: { name: 'Cerulean City', kind: 'walk', city: true, lvl: [16, 18] },
    route24: { name: 'Ponte Pepita (Rota 24)', kind: 'walk', pool: 'route24', lvl: [13, 16], trainers: ['bug', 'lass', 'youngster', 'tamer'], water: true },
    route25: { name: 'Rota 25', kind: 'walk', pool: 'route24', lvl: [13, 16], trainers: ['hiker', 'lass', 'youngster'], maps: { Bill: 'bill' } },
    route5: { name: 'Rota 5', kind: 'walk', pool: 'route5', lvl: [13, 16], maps: { Creche: 'daycare' } },
    route6: { name: 'Rota 6', kind: 'walk', pool: 'route6', lvl: [14, 17], trainers: ['bug', 'tamer', 'picnicker'], water: true },
    vermilion: { name: 'Vermilion City', kind: 'walk', city: true, maps: { 'Fã-Clube': 'fanclub' }, lvl: [18, 20] },
    ssanne: { name: 'S.S. Anne', kind: 'map', theme: 'ship', maps: { 'Convés': 'ssanne_deck', '1F': 'ssanne_1f', '2F': 'ssanne_2f', 'Cabine': 'ssanne_captain' }, lvl: [17, 20], trainers: ['sailor', 'gentleman', 'youngster', 'lass', 'fisher'] },
    diglett: { name: 'Caverna do Diglett', kind: 'map', theme: 'diglett', maps: { B1F: 'diglett' }, pool: 'diglett', lvl: [17, 22], dark: true },
    route11: { name: 'Rota 11', kind: 'walk', pool: 'route11', lvl: [16, 20], trainers: ['youngster', 'nerd', 'gambler', 'rocker'], water: true },
    route9: { name: 'Rota 9', kind: 'walk', pool: 'route9', lvl: [18, 21], trainers: ['hiker', 'bug', 'picnicker', 'youngster'] },
    route10: { name: 'Rota 10', kind: 'walk', pool: 'route9', lvl: [18, 21], trainers: ['hiker', 'maniac'] },
    rocktunnel: { name: 'Túnel de Pedra', kind: 'map', theme: 'tunnel', maps: { '1F': 'rocktunnel_1f', B1F: 'rocktunnel_b1f' }, pool: 'rocktunnel', lvl: [18, 22], trainers: ['hiker', 'maniac', 'picnicker'], dark: true },
    lavender: { name: 'Lavender Town', kind: 'walk', city: true },
    tower: { name: 'Torre Pokémon', kind: 'map', theme: 'tower', maps: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(i => [i + 'F', `tower_${i}f`])), pool: 'tower', lvl: [22, 30], trainers: ['channeler'] },
    route8: { name: 'Rota 8', kind: 'walk', pool: 'route8', lvl: [20, 24], trainers: ['gambler', 'lass', 'nerd', 'biker'], maps: { 'Subterrâneo': 'underground' } },
    celadon: { name: 'Celadon City', kind: 'walk', city: true, maps: { 'Mansão': 'condo', Cassino: 'casino', 'Prêmios': 'prizeroom', 'Loja': 'deptstore' } },
    hideout: { name: 'Esconderijo Rocket', kind: 'map', theme: 'rocket', maps: Object.fromEntries([1, 2, 3, 4].map(i => [`B${i}F`, `hideout_b${i}f`])), lvl: [21, 26], trainers: ['rocket'], rocket: true },
    route12: { name: 'Rotas 12–15', kind: 'walk', pool: 'route12', lvl: [25, 30], trainers: ['fisher', 'birdkeeper', 'beauty', 'picnicker', 'tamer'], water: true },
    cycling: { name: 'Ciclovia (Rotas 16–18)', kind: 'walk', pool: 'route16', lvl: [25, 30], trainers: ['biker', 'birdkeeper'] },
    fuchsia: { name: 'Fuchsia City', kind: 'walk', city: true, maps: { 'Zona Safári': 'safari_center', 'Casa do Guarda': 'warden' } },
    safari: { name: 'Zona Safári', kind: 'map', theme: 'safari', maps: { Centro: 'safari_center', Leste: 'safari_east', Norte: 'safari_north', Oeste: 'safari_west' }, pool: 'safari', lvl: [22, 32] },
    saffron: { name: 'Saffron City', kind: 'walk', city: true, maps: { Dojo: 'dojo' } },
    silph: { name: 'Silph Co.', kind: 'map', theme: 'silph', maps: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => [i + 'F', `silph_${i}f`])), lvl: [30, 36], trainers: ['rocket', 'scientist'], rocket: true, floors: 11 },
    route19: { name: 'Rotas 19–20', kind: 'map', theme: 'water', maps: { '19': 'route19', '20': 'route20' }, pool: 'sea', lvl: [30, 34], trainers: ['swimmer', 'beauty'], sea: true },
    seafoam: { name: 'Ilhas Espuma', kind: 'map', theme: 'seafoam', maps: Object.fromEntries(['1F', 'B1F', 'B2F', 'B3F', 'B4F'].map(f => [f, 'seafoam_' + f.toLowerCase()])), pool: 'seafoam', lvl: [33, 40], dark: true },
    route21: { name: 'Rota 21', kind: 'map', theme: 'water', maps: { '21': 'route21' }, pool: 'route21', lvl: [30, 34], trainers: ['swimmer', 'fisher'], sea: true },
    cinnabar: { name: 'Ilha Cinnabar', kind: 'walk', city: true, maps: { 'Laboratório': 'lab' } },
    mansion: { name: 'Mansão Pokémon', kind: 'map', theme: 'mansion', maps: Object.fromEntries(['1F', '2F', '3F', 'B1F'].map(f => [f, 'mansion_' + f.toLowerCase()])), pool: 'mansion', lvl: [32, 38], trainers: ['burglar', 'scientist'] },
    powerplant: { name: 'Usina Elétrica', kind: 'map', theme: 'plant', maps: { '': 'powerplant' }, pool: 'plant', lvl: [34, 40] },
    route23: { name: 'Rota 23', kind: 'walk', pool: 'route23', lvl: [40, 44], trainers: ['cooltrainer', 'tamer'] },
    victory: { name: 'Estrada Vitória', kind: 'map', theme: 'victory', maps: { '1F': 'victory_1f', '2F': 'victory_2f', '3F': 'victory_3f' }, pool: 'victory', lvl: [42, 47], trainers: ['cooltrainer', 'blackbelt', 'juggler', 'tamer'], dark: true },
    indigo: { name: 'Planalto Índigo', kind: 'walk' },
    unknown: { name: 'Caverna Desconhecida', kind: 'map', theme: 'unknown', maps: { '1F': 'unknown_1f', '2F': 'unknown_2f', B1F: 'unknown_b1f' }, pool: 'unknown', lvl: [55, 65], dark: true },
  };

  // ---------- A jornada ----------
  // Antes de cada cidade com ginásio, 3 paradas em áreas sorteadas de Kanto inteiro (qualquer rota,
  // caverna ou prédio, com um evento sorteado); depois a cidade (Centro, loja e ginásio). No fim, a Liga.
  // 8 x (3 + 1) + Elite dos 4 + Campeão = 37 paradas.
  const S = (ev, o = {}) => ({ ev, ...o });
  const STOPS_PER_GYM = 3;
  const GYM_CITY = ['pewter', 'cerulean', 'vermilion', 'celadon', 'fuchsia', 'saffron', 'cinnabar', 'viridian'];
  // nível dos selvagens e treinadores nas 3 paradas antes de cada ginásio (da primeira à última)
  const GYM_LEVELS = [[4, 9], [14, 21], [19, 25], [25, 32], [31, 38], [37, 43], [41, 47], [45, 51]];
  // áreas que podem ser sorteadas: tudo menos as cidades, Pallet e o Planalto Índigo
  const RANDOM_AREAS = Object.keys(AREAS).filter(k => !AREAS[k].city && (AREAS[k].pool || AREAS[k].trainers));
  const LEAGUE = ['indigo', [S('elite', { n: 0 }), S('elite', { n: 1 }), S('elite', { n: 2 }), S('elite', { n: 3 }), S('champion')]];

  // 3 áreas diferentes, cada uma num andar sorteado
  function randomStops(n) {
    const areas = [];
    while (areas.length < STOPS_PER_GYM) {
      const k = M.pick(RANDOM_AREAS);
      if (!areas.includes(k)) areas.push(k);
    }
    const [lo, hi] = GYM_LEVELS[n];
    return areas.map((k, j) => {
      const maps = AREAS[k].kind === 'map' && AREAS[k].maps ? Object.keys(AREAS[k].maps) : null;
      const lvl = Math.round(lo + (hi - lo) * j / (STOPS_PER_GYM - 1));
      return [k, [S('R', { lvl, ...(maps ? { floor: M.pick(maps) } : {}) })]];
    });
  }

  function journey() {
    const path = [];
    for (let n = 0; n < GYM_CITY.length; n++) {
      path.push(...randomStops(n));
      path.push([GYM_CITY[n], [S('gym', { n, city: true })]]);
    }
    path.push(LEAGUE);
    return path;
  }

  // Bifurcações: o jogador escolhe por onde seguir (como no Game Boy, os dois caminhos levam ao mesmo lugar)
  const CHOICES = {
    vermilion: {
      text: 'De Vermilion dá para explorar a Caverna do Diglett ou seguir pela Rota 11. Por onde?',
      options: [
        { label: 'Caverna do Diglett', sub: 'Diglett e Dugtrio selvagens', path: [['diglett', [S('wild', { floor: 'B1F' }), S('item', { floor: 'B1F' }), S('wild', { floor: 'B1F' })]]] },
        { label: 'Rota 11', sub: 'Treinadores e Drowzee', path: [['route11', ['trainer', 'double', 'R']]] },
      ],
    },
    lavender: {
      text: 'Para chegar a Fuchsia há dois caminhos, e um Snorlax dorme em cada um. Por onde?',
      options: [
        { label: 'Rotas 12–15', sub: 'Ponte do Silêncio e pescadores', path: [['route12', [S('legend', { id: 143, lvl: 30, key: 'snorlax' }), 'fishing', 'trainer', 'double', 'R']]] },
        { label: 'Ciclovia', sub: 'Rotas 16–18, motoqueiros', path: [['cycling', [S('legend', { id: 143, lvl: 30, key: 'snorlax' }), 'trainer', 'double', 'R', 'trainer']]] },
      ],
    },
    fuchsia: {
      text: 'Até a Ilha Cinnabar dá para surfar pelas Ilhas Espuma ou voltar a Pallet e descer pela Rota 21. Por onde?',
      options: [
        { label: 'Ilhas Espuma', sub: 'Cavernas geladas... e Articuno', path: [['route19', [S('trainer', { floor: '19' }), S('R', { floor: '20' })]], ['seafoam', [S('wild', { floor: '1F' }), S('R', { floor: 'B1F' }), S('wild', { floor: 'B2F' }), S('item', { floor: 'B3F' }), S('legend', { id: 144, lvl: 50, floor: 'B4F' })]]] },
        { label: 'Rota 21', sub: 'Passa em casa e pesca no mar', path: [['pallet', [S('heal', { key: 'mom' })]], ['route21', [S('fishing', { floor: '21' }), S('trainer', { floor: '21' }), S('R', { floor: '21' }), S('trainer', { floor: '21' })]]] },
      ],
    },
  };

  // ---------- Eventos sorteados ----------
  const WALK_EVENTS = [['wild', 30], ['trainer', 28], ['item', 8], ['fishing', 9], ['rocket', 6], ['gift', 3], ['merchant', 6], ['weather', 7], ['double', 6]];
  const MAP_EVENTS = [['wild', 40], ['trainer', 32], ['item', 16], ['rocket', 12], ['double', 5]];
  // eventos que podem repetir em seguida (os outros não aparecem duas vezes seguidas)
  const COMMON = new Set(['wild', 'trainer']);
  const LIMITS = { gift: 2, merchant: 3, weather: 5 };

  function randomEvent(area, prev, used, stage) {
    const pool = (area.kind === 'map' ? MAP_EVENTS : WALK_EVENTS).filter(([ev]) => {
      if (ev === prev && !COMMON.has(ev)) return false;
      if (ev === 'fishing' && !area.water) return false;
      if (ev === 'wild' && !area.pool) return false;
      if ((ev === 'trainer' || ev === 'double') && !area.trainers) return false;
      if (ev === 'rocket' && area.kind === 'map' && !area.rocket) return false;
      if ((ev === 'rocket' || ev === 'merchant' || ev === 'weather') && stage < 1) return false;
      return (used[ev] || 0) < (LIMITS[ev] ?? Infinity);
    });
    return M.weighted(pool);
  }

  // Lista de paradas a partir de [[área, paradas], ...]. Cada parada recebe área, andar e nível.
  // ctx guarda o que já saiu (limites dos eventos sorteados) e a quantidade de insígnias.
  function expand(path, ctx) {
    const out = [];
    for (const [areaId, stops] of path) {
      const area = AREAS[areaId] || {};
      stops.forEach((s, k) => {
        let stop = typeof s === 'string' ? { ev: s } : { ...s };
        // a bifurcação fica na área de onde se sai
        if (stop.ev === 'choice') { out.push({ ...stop, area: ctx.area }); return; }
        stop.area = ctx.area = areaId;
        if (stop.floor === undefined && area.maps && area.kind === 'map') stop.floor = Object.keys(area.maps)[0];
        stop.stage = ctx.badges;
        if (stop.lvl === undefined && area.lvl) {
          const [a, b] = area.lvl;
          stop.lvl = Math.round(a + (b - a) * (stops.length > 1 ? k / (stops.length - 1) : 0));
        }
        if (stop.ev === 'R') stop.ev = randomEvent(area, ctx.prev, ctx.used, ctx.badges);
        ctx.used[stop.ev] = (ctx.used[stop.ev] || 0) + 1;
        ctx.prev = stop.ev;
        if (stop.ev === 'gym') ctx.badges++;
        out.push(stop);
      });
    }
    return out;
  }

  function buildRoute() {
    return expand(journey(), { badges: 0, used: {}, prev: null });
  }

  // Paradas do caminho escolhido numa bifurcação: entram logo depois dela
  function expandChoice(route, i, option) {
    const ctx = { badges: route.slice(0, i).filter(s => s.ev === 'gym').length, used: {}, prev: null };
    for (const s of route.slice(0, i)) ctx.used[s.ev] = (ctx.used[s.ev] || 0) + 1;
    const stops = expand(CHOICES[route[i].key].options[option].path, ctx);
    route.splice(i + 1, 0, ...stops);
    route[i].picked = option;
    return stops;
  }

  // Nome do lugar de uma parada ("Mt. Moon B1F")
  function placeName(stop) {
    if (!stop || !stop.area) return 'Kanto';
    const a = AREAS[stop.area];
    const floor = a.kind === 'map' && /^B?\d+F$/.test(stop.floor || '') ? ' ' + stop.floor : '';
    return a.name + floor;
  }

  window.KANTO = { POOLS, FISH, AREAS, GYM_CITY, GYM_LEVELS, RANDOM_AREAS, CHOICES, buildRoute, expandChoice, placeName };
})();
