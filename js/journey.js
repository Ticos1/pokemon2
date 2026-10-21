// Regras da jornada usadas pelo jogo e pelo simulador (tools/sim.js): estado inicial,
// Centro Pokémon, descanso, inimigos de cada parada, prêmios, itens achados, presentes, ovos,
// mercador, clima, Zona Safári, cassino, quiz do Blaine e fósseis.
// Nada aqui mexe na tela; o jogo (js/events.js) só anima o que estas funções decidem.
(function () {
  const R = window.RULES, M = window.MON, P = window.PROGRESS, K = window.KANTO;
  const { DEX } = R;

  const START_BAG = { pokeball: 5, potion: 2 };
  const START_MONEY = 3000;
  const STARTER_LEVEL = 5;
  const ROCKET_CANDY = .5;     // chance do recruta Rocket deixar cair um Doce Raro
  const NUGGET_VALUE = 5000;
  const FOUND_ITEMS = [[['pokeball', 3], 20], [['greatball', 2], 15], [['potion', 2], 15], [['superpotion', 1], 15], [['revive', 1], 10], [['rarecandy', 1], 10], [['nugget', 1], 5], [['moonstone', 1], 4], [['firestone', 1], 2], [['waterstone', 1], 2], [['thunderstone', 1], 2], [['leafstone', 1], 2]];
  const HEAL_ORDER = ['hyperpotion', 'superpotion', 'potion'];

  function newState(starter, mode) {
    return {
      starter, mode,
      party: [M.create(starter, STARTER_LEVEL, { minIv: 20 })], pc: [],
      bag: { ...START_BAG }, money: START_MONEY, badges: 0, coins: 0,
      route: K.buildRoute(), step: 0, stats: {}, eggs: [], fossils: [], weather: null, champion: false,
    };
  }

  const count = (st, k) => st.bag[k] || 0;
  const addItem = (st, k, n = 1) => { st.bag[k] = count(st, k) + n; };
  const ballCount = st => R.BALLS.reduce((s, b) => s + count(st, b), 0);
  // a Bola Mestra fica guardada para os lendários
  const bestBall = (st, mon) => [...R.BALLS].reverse().find(b => count(st, b) > 0 && (b !== 'masterball' || (mon && DEX[mon.id].legendary))) || null;
  const alive = party => party.filter(m => m.hp > 0);

  function healAll(party) {
    for (const m of party) m.hp = m.maxhp;
  }

  // Depois de cada vitória o time descansa e recupera parte da vida
  function rest(party) {
    for (const m of party) if (m.hp > 0) m.hp = Math.min(m.maxhp, m.hp + Math.ceil(m.maxhp * R.REST_HEAL));
  }

  const area = stop => K.AREAS[stop.area] || {};

  // Inimigos de uma parada de batalha. kind = tipo de XP/prêmio; battle = 'wild' ou 'trainer'.
  // special = selvagem especial (lendários, Snorlax): perder não acaba o jogo
  function encounter(st, i) {
    const stop = st.route[i];
    const mode = st.mode;
    switch (stop.ev) {
      case 'wild': {
        const enemies = [P.wild(stop)];
        if (mode === 2 && alive(st.party).length >= 2 && Math.random() < .5) enemies.push(P.wild(stop));
        return { kind: 'wild', battle: 'wild', enemies, money: 0 };
      }
      case 'fishing':
        return { kind: 'wild', battle: 'wild', enemies: [P.wild(stop, { fish: true })], money: 0 };
      case 'legend':
        return { kind: 'legend', battle: 'wild', enemies: [P.wild(stop, { id: stop.id, lvl: stop.lvl })], money: 0, special: true };
      case 'marowak':
        return { kind: 'legend', battle: 'wild', enemies: [M.create(105, stop.lvl || 30, { minIv: 20 })], money: 0, noCatch: true };
      case 'trainer': {
        const tr = P.trainer(stop, mode);
        return { kind: 'trainer', battle: 'trainer', enemies: tr.team, money: tr.money, cls: tr.cls };
      }
      case 'double': {
        const d = P.double(stop);
        return { kind: 'trainer', battle: 'trainer', enemies: d.team, money: d.money, a: d.a, b: d.b, mode: 2 };
      }
      case 'fossil': {
        const tr = P.trainer(stop, mode, { key: 'nerd', ...R.TRAINER_CLASSES.nerd });
        return { kind: 'trainer', battle: 'trainer', enemies: tr.team, money: tr.money, cls: tr.cls };
      }
      case 'quiz': {
        const tr = P.trainer({ ...stop, lvl: 38, stage: 6 }, mode, { key: 'burglar', ...R.TRAINER_CLASSES.burglar });
        return { kind: 'trainer', battle: 'trainer', enemies: tr.team, money: tr.money, cls: tr.cls };
      }
      case 'rocket': {
        const tr = P.rocket(stop, mode);
        return { kind: 'rocket', battle: 'trainer', enemies: tr.team, money: tr.money };
      }
      case 'rival': {
        const tr = P.rival(st.starter, stop.n, mode);
        return { kind: 'rival', battle: 'trainer', enemies: tr.team, money: tr.money };
      }
      case 'boss': case 'dojo': {
        const d = P.boss(stop.key || 'karate');
        return { kind: 'boss', battle: 'trainer', enemies: d.team, money: d.money, boss: d.boss };
      }
      case 'gym': {
        const d = P.gym(stop.n);
        return { kind: 'gym', battle: 'trainer', enemies: d.team, money: d.money, gym: d.gym, index: stop.n };
      }
      case 'elite': {
        const d = P.elite(stop.n);
        return { kind: 'elite', battle: 'trainer', enemies: d.team, money: d.money, elite: d.elite, index: stop.n };
      }
      case 'champion': {
        const d = P.champion(st.starter);
        return { kind: 'champion', battle: 'trainer', enemies: d.team, money: d.money };
      }
    }
    return null;
  }

  // Perdeu para um selvagem especial: segue a viagem e a próxima parada é um Centro Pokémon
  function insertCenter(st, i) {
    st.route.splice(i + 1, 0, { ev: 'center', area: st.route[i].area, stage: st.badges, after: 'legend' });
  }

  // Vitória: experiência e dinheiro. Retorna o resultado de PROGRESS.awardXp (níveis, golpes e evoluções)
  function victory(st, res, kind, money) {
    const xp = P.awardXp(st.party, res, kind);
    if (money) {
      st.money += money;
      st.stats.earned = (st.stats.earned || 0) + money;
    }
    return xp;
  }

  // Pokémon capturado ou recebido: vai para o time ou, se estiver cheio, para o PC
  function addCaught(st, mon, { gift = false } = {}) {
    if (!gift) {
      st.stats.caught = (st.stats.caught || 0) + 1;
      if (mon.shiny) st.stats.shinies = (st.stats.shinies || 0) + 1;
      if (DEX[mon.id].legendary) st.stats.legendary = (st.stats.legendary || 0) + 1;
      if (mon.id === 150) st.stats.mewtwo = 1;
    }
    mon.xp = 0;
    if (st.party.length < 6) { st.party.push(mon); return 'party'; }
    st.pc.push(mon);
    return 'pc';
  }

  // Presentes da história (Red/Blue) e o senhor que aparece no caminho
  const GIFTS = { eevee: [133, 25], lapras: [131, 15], hitmonlee: [106, 30], hitmonchan: [107, 30], magikarp: [129, 5] };
  function gift(st, i) {
    const stop = st.route[i];
    if (GIFTS[stop.key]) return M.create(GIFTS[stop.key][0], GIFTS[stop.key][1], { minIv: 10 });
    return M.create(M.pick(R.GIFT_POOL), Math.max(5, (stop.lvl || 10) - 2));
  }

  // Item no chão (a Pepita vira dinheiro na hora)
  function foundItem(st) {
    const [k, n] = M.weighted(FOUND_ITEMS);
    if (k === 'nugget') st.money += NUGGET_VALUE;
    else addItem(st, k, n);
    return { k, n };
  }

  function rocketDrop(st) {
    if (Math.random() >= ROCKET_CANDY) return false;
    addItem(st, 'rarecandy');
    return true;
  }

  // Compras automáticas (simulador e modo gravação): Poké Bolas se tiver poucas, depois cura
  function autoShop(st) {
    const bought = {};
    const buy = k => { st.money -= R.ITEMS[k].price; addItem(st, k); bought[k] = (bought[k] || 0) + 1; };
    const can = k => R.ITEMS[k] && (R.ITEMS[k].badges || 0) <= st.badges;
    const ball = can('ultraball') ? 'ultraball' : can('greatball') ? 'greatball' : 'pokeball';
    let budget = Math.floor(st.money / 2);
    while (ballCount(st) < 5 && budget >= R.ITEMS[ball].price) { budget -= R.ITEMS[ball].price; buy(ball); }
    const potion = HEAL_ORDER.find(can);
    while (budget >= R.ITEMS[potion].price) { budget -= R.ITEMS[potion].price; buy(potion); }
    return bought;
  }

  // ---------- Pedras de evolução ----------
  function stoneTarget(mon, stone) {
    return (R.STONE_EVO[stone] || {})[mon.id] || null;
  }

  // ---------- Ovo da Creche ----------
  const EGG_STEPS = 4; // paradas até nascer
  function giveEgg(st) {
    st.eggs.push({ id: M.weighted(R.EGG_POOL), left: EGG_STEPS });
  }

  // Passa uma parada: retorna os Pokémon que nasceram
  function tickEggs(st) {
    const born = [];
    for (const e of st.eggs) if (--e.left <= 0) born.push(M.create(e.id, 5, { minIv: 15, shiny: M.rollShiny(2) }));
    st.eggs = st.eggs.filter(e => e.left > 0);
    return born;
  }

  // ---------- Mercador ambulante ----------
  const MERCHANT_STOCK = [['rarecandy', 3000], ['firestone', 2100], ['waterstone', 2100], ['thunderstone', 2100], ['leafstone', 2100], ['moonstone', 2500], ['revive', 1500], ['ultraball', 1200], ['hyperpotion', 1200]];
  function merchantOffers() {
    const out = [];
    while (out.length < 3) {
      const o = M.pick(MERCHANT_STOCK);
      if (!out.includes(o)) out.push(o);
    }
    return out.map(([k, price]) => ({ k, price }));
  }
  // simulador e modo gravação: Doce Raro se sobrar dinheiro
  const merchantAuto = (st, offers) => offers.find(o => o.k === 'rarecandy' && st.money >= o.price + 4000) || null;

  function buy(st, k, price) {
    st.money -= price;
    addItem(st, k);
  }

  // ---------- Clima ----------
  const WEATHER = {
    rain: { name: 'Chuva', start: 'Começou a chover!', end: 'A chuva parou.', boost: 'water', weak: 'fire' },
    sun: { name: 'Sol forte', start: 'O sol ficou muito forte!', end: 'O sol voltou ao normal.', boost: 'fire', weak: 'water' },
    sand: { name: 'Tempestade de areia', start: 'Uma tempestade de areia começou!', end: 'A tempestade de areia passou.', chip: ['rock', 'ground', 'steel'] },
    hail: { name: 'Granizo', start: 'Começou a cair granizo!', end: 'O granizo parou.', chip: ['ice'] },
  };
  const WEATHER_STOPS = 4;
  function startWeather(st) {
    const kind = M.pick(Object.keys(WEATHER));
    st.weather = { kind, left: WEATHER_STOPS };
    return kind;
  }
  // Passa uma parada: retorna o clima que acabou (ou null)
  function tickWeather(st) {
    if (!st.weather) return null;
    if (--st.weather.left > 0) return null;
    const k = st.weather.kind;
    st.weather = null;
    return k;
  }
  // Clima que vale na batalha: só ao ar livre
  const battleWeather = (st, stop) => (st.weather && area(stop).kind === 'walk' ? st.weather.kind : null);

  // ---------- Zona Safári (como no Game Boy: bola, isca, pedra ou fugir) ----------
  const SAFARI_BALLS = 30;
  const SAFARI_AREAS = ['Centro', 'Leste', 'Norte', 'Oeste'];

  function safariMon(stop) {
    return P.wild({ ...stop, lvl: stop.lvl || 28 }, { pool: 'safari' });
  }

  // s = { mon, angry, eating }; action: 'ball' | 'bait' | 'rock'. Retorna 'caught' | 'miss' | 'fled' | 'stay'
  function safariTurn(s, action) {
    const rate = DEX[s.mon.id].catch;
    if (action === 'ball') {
      const p = Math.min(.9, Math.max(.03, rate / 255 * .75 * (s.angry > 0 ? 2 : 1) * (s.eating > 0 ? .5 : 1)));
      if (Math.random() < p) return 'caught';
    } else if (action === 'bait') {
      s.eating = M.randInt(1, 5); s.angry = 0;
    } else if (action === 'rock') {
      s.angry = M.randInt(1, 5); s.eating = 0;
    }
    const flee = Math.min(.8, Math.max(.05, DEX[s.mon.id].spe / 255 * .5)) * (s.angry > 0 ? 2 : 1) * (s.eating > 0 ? .25 : 1);
    s.angry = Math.max(0, s.angry - 1); s.eating = Math.max(0, s.eating - 1);
    if (Math.random() < flee) return 'fled';
    return action === 'ball' ? 'miss' : 'stay';
  }

  // ---------- Cassino de Celadon ----------
  const COIN_PACK = [50, 1000];   // 50 fichas por ₽1000, como no jogo
  const SPIN_COST = 3;
  // Símbolos dos rolos: 7, BAR, Pikachu, Psyduck, Magnemite e cereja. pay = prêmio com 3 iguais
  const SLOT_SYMBOLS = [
    { key: '7', pay: 300 }, { key: 'BAR', pay: 100 }, { key: 'pika', id: 25, pay: 15 },
    { key: 'psy', id: 54, pay: 15 }, { key: 'mag', id: 81, pay: 15 }, { key: 'cherry', pay: 8 },
  ];
  // a fita de cada rolo (o 7 aparece pouco)
  const REEL = ['cherry', 'pika', 'BAR', 'psy', 'cherry', 'mag', '7', 'pika', 'cherry', 'psy', 'BAR', 'mag', 'cherry', 'pika', 'psy', 'mag'];
  const slotPay = keys => {
    if (keys[0] === keys[1] && keys[1] === keys[2]) return SLOT_SYMBOLS.find(s => s.key === keys[0]).pay;
    const cherries = keys.filter(k => k === 'cherry').length;
    return cherries >= 2 ? 4 : 0;
  };
  // Prêmios (Red): Pokémon trocados por fichas
  const PRIZES = [
    { id: 63, lvl: 9, coins: 180 }, { id: 35, lvl: 8, coins: 500 }, { id: 30, lvl: 17, coins: 1200 },
    { id: 147, lvl: 18, coins: 2800 }, { id: 123, lvl: 25, coins: 5500 }, { id: 137, lvl: 26, coins: 9999 },
  ];
  // simulador e modo gravação: compra fichas, gira 15 vezes e leva o melhor prêmio que der
  function casinoAuto(st) {
    if (st.money >= COIN_PACK[1] * 3) { st.money -= COIN_PACK[1]; st.coins += COIN_PACK[0]; }
    for (let i = 0; i < 15 && st.coins >= SPIN_COST; i++) {
      st.coins -= SPIN_COST;
      st.coins += slotPay([0, 1, 2].map(() => M.pick(REEL)));
    }
    const prize = [...PRIZES].reverse().find(p => p.coins <= st.coins);
    if (!prize) return null;
    st.coins -= prize.coins;
    return M.create(prize.id, prize.lvl);
  }

  // Efeitos das cenas da história
  function storyEffect(st, key) {
    if (key === 'museum') { st.fossils.push('amber'); return 'amber'; }
    return null;
  }

  // ---------- Fósseis ----------
  const FOSSILS = { dome: { item: 'Fóssil Domo', id: 140 }, helix: { item: 'Fóssil Hélix', id: 138 }, amber: { item: 'Âmbar Antigo', id: 142 } };
  function reviveFossils(st) {
    const out = st.fossils.map(f => M.create(FOSSILS[f].id, 30, { minIv: 10 }));
    st.fossils = [];
    return out;
  }

  // ---------- Quiz do Ginásio de Cinnabar ----------
  const QUIZ = [
    { q: 'Caterpie evolui para Metapod?', a: true },
    { q: 'Existem 9 insígnias oficiais da Liga Pokémon?', a: false },
    { q: 'Poliwag evolui 3 vezes?', a: false },
    { q: 'Golpes elétricos funcionam contra Pokémon de terra?', a: false },
    { q: 'Pokémon da mesma espécie e nível são sempre idênticos?', a: false },
    { q: 'O MT28 ensina Cavar?', a: true },
    { q: 'Golpes de fogo são super efetivos contra Pokémon de planta?', a: true },
    { q: 'O Pokémon nº 1 da Pokédex é o Bulbasaur?', a: true },
  ];
  const quizQuestions = () => [...QUIZ].sort(() => Math.random() - .5).slice(0, 3);

  // Minijogo de pesca: quanto mais difícil de capturar a espécie, mais o peixe foge
  const FISH_MOTION = { 129: 'mixed', 130: 'dart', 118: 'smooth', 119: 'smooth', 60: 'mixed', 61: 'mixed', 54: 'floater', 55: 'floater', 72: 'dart', 73: 'dart', 98: 'sinker', 99: 'sinker', 116: 'smooth', 117: 'smooth', 90: 'sinker', 91: 'sinker', 79: 'floater', 86: 'smooth', 120: 'mixed', 121: 'dart', 147: 'dart', 148: 'dart', 131: 'floater' };
  const TREASURE_CHANCE = .2;

  function fishing(st, mon) {
    const rate = DEX[mon.id].catch;
    return {
      difficulty: Math.round(15 + (255 - rate) / 255 * 65 + Math.min(10, mon.lvl / 5)),
      motion: FISH_MOTION[mon.id] || 'mixed',
      barH: 140 + Math.min(8, st.badges) * 6,
      treasure: Math.random() < TREASURE_CHANCE,
    };
  }

  // Jogo salvo de versões antigas (rota sem as áreas de Kanto) não dá para continuar
  function upgradeSave(data) {
    if (!data || !Array.isArray(data.route) || typeof data.route[0] !== 'object') return null;
    return { eggs: [], fossils: [], coins: 0, weather: null, champion: false, ...data };
  }

  window.JOURNEY = {
    START_BAG, START_MONEY, FOUND_ITEMS, HEAL_ORDER, WEATHER, SAFARI_BALLS, SAFARI_AREAS, COIN_PACK, SPIN_COST,
    SLOT_SYMBOLS, REEL, PRIZES, FOSSILS, GIFTS,
    newState, count, addItem, ballCount, bestBall, alive, healAll, rest, area,
    encounter, insertCenter, victory, addCaught, gift, foundItem, rocketDrop, autoShop, stoneTarget,
    giveEgg, tickEggs, merchantOffers, merchantAuto, buy, startWeather, tickWeather, battleWeather,
    safariMon, safariTurn, slotPay, casinoAuto, storyEffect, reviveFossils, quizQuestions, fishing, upgradeSave,
  };
})();
