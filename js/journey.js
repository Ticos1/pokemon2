// Regras da jornada usadas pelo jogo e pelo simulador (tools/sim.js): estado inicial,
// Centro Pokémon, descanso, inimigos de cada parada, prêmios, itens achados, presentes e capturas.
// Nada aqui mexe na tela; o jogo (js/events.js) só anima o que estas funções decidem.
(function () {
  const R = window.RULES, M = window.MON, P = window.PROGRESS;

  const START_BAG = { pokeball: 5, potion: 2 };
  const START_MONEY = 1000;
  const STARTER_LEVEL = 5;
  const ROCKET_CANDY = .5;     // chance do recruta Rocket deixar cair um Doce Raro
  const NUGGET_VALUE = 3000;
  const FOUND_ITEMS = [[['pokeball', 3], 25], [['greatball', 2], 15], [['potion', 2], 20], [['superpotion', 1], 15], [['revive', 1], 10], [['rarecandy', 1], 10], [['nugget', 1], 5]];
  const HEAL_ORDER = ['hyperpotion', 'superpotion', 'potion'];

  function newState(starter, mode) {
    return {
      starter, mode,
      party: [M.create(starter, STARTER_LEVEL, { minIv: 20 })], pc: [],
      bag: { ...START_BAG }, money: START_MONEY, badges: 0,
      route: P.buildRoute(), step: 0, stats: {},
    };
  }

  const count = (st, k) => st.bag[k] || 0;
  const addItem = (st, k, n = 1) => { st.bag[k] = count(st, k) + n; };
  const ballCount = st => R.BALLS.reduce((s, b) => s + count(st, b), 0);
  const bestBall = st => [...R.BALLS].reverse().find(b => count(st, b) > 0) || null;
  const alive = party => party.filter(m => m.hp > 0);

  // Há Centro Pokémon na cidade de cada ginásio e na entrada da Liga (entre as salas da Elite, não)
  function hasCenter(route, i) {
    return route[i] === 'gym' || (route[i] === 'elite' && route[i - 1] !== 'elite');
  }

  const indexOfKind = (route, i, kind) => route.slice(0, i).filter(x => x === kind).length;

  function healAll(party) {
    for (const m of party) m.hp = m.maxhp;
  }

  // Depois de cada vitória o time descansa e recupera parte da vida
  function rest(party) {
    for (const m of party) if (m.hp > 0) m.hp = Math.min(m.maxhp, m.hp + Math.ceil(m.maxhp * R.REST_HEAL));
  }

  // Inimigos de uma parada de batalha. kind = tipo de XP/prêmio; battle = 'wild' ou 'trainer'
  function encounter(st, i) {
    const ev = st.route[i];
    switch (ev) {
      case 'wild': {
        const enemies = [P.wild(i)];
        if (st.mode === 2 && alive(st.party).length >= 2 && Math.random() < .5) enemies.push(P.wild(i));
        return { kind: 'wild', battle: 'wild', enemies, money: 0 };
      }
      case 'fishing':
        return { kind: 'wild', battle: 'wild', enemies: [P.wild(i, { fish: true })], money: 0 };
      case 'trainer': {
        const tr = P.trainer(i, st.mode);
        return { kind: 'trainer', battle: 'trainer', enemies: tr.team, money: tr.money, cls: tr.cls };
      }
      case 'rocket': {
        const tr = P.rocket(i, st.mode);
        return { kind: 'rocket', battle: 'trainer', enemies: tr.team, money: tr.money };
      }
      case 'rival': {
        const tr = P.rival(st.starter, i, st.mode);
        return { kind: 'rival', battle: 'trainer', enemies: tr.team, money: tr.money };
      }
      case 'gym': {
        const gi = indexOfKind(st.route, i, 'gym');
        const d = P.gym(gi);
        return { kind: 'gym', battle: 'trainer', enemies: d.team, money: d.money, gym: d.gym, index: gi };
      }
      case 'elite': {
        const ei = indexOfKind(st.route, i, 'elite');
        const d = P.elite(ei);
        return { kind: 'elite', battle: 'trainer', enemies: d.team, money: d.money, elite: d.elite, index: ei };
      }
      case 'champion': {
        const d = P.champion(st.starter);
        return { kind: 'champion', battle: 'trainer', enemies: d.team, money: d.money };
      }
    }
    return null;
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
      if (R.DEX[mon.id].legendary) st.stats.legendary = (st.stats.legendary || 0) + 1;
    }
    mon.xp = 0;
    if (st.party.length < 6) { st.party.push(mon); return 'party'; }
    st.pc.push(mon);
    return 'pc';
  }

  function gift(st, i) {
    const id = M.pick(R.GIFT_POOL);
    return M.create(id, Math.max(5, R.SLOT_LEVEL[i] - 1));
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

  // Minijogo de pesca: quanto mais difícil de capturar a espécie, mais o peixe foge
  const FISH_MOTION = { 129: 'mixed', 130: 'dart', 118: 'smooth', 119: 'smooth', 60: 'mixed', 61: 'mixed', 54: 'floater', 55: 'floater', 72: 'dart', 73: 'dart', 98: 'sinker', 99: 'sinker', 116: 'smooth', 117: 'smooth', 90: 'sinker', 91: 'sinker', 120: 'mixed', 121: 'dart', 147: 'dart', 148: 'dart', 131: 'floater' };
  const TREASURE_CHANCE = .2;

  function fishing(st, mon) {
    const rate = R.DEX[mon.id].catch;
    return {
      difficulty: Math.round(15 + (255 - rate) / 255 * 65 + mon.lvl / 5),
      motion: FISH_MOTION[mon.id] || 'mixed',
      barH: 140 + Math.min(8, st.badges) * 6,
      treasure: Math.random() < TREASURE_CHANCE,
    };
  }

  window.JOURNEY = {
    START_BAG, START_MONEY, FOUND_ITEMS, HEAL_ORDER,
    newState, count, addItem, ballCount, bestBall, alive, hasCenter, indexOfKind, healAll, rest,
    encounter, victory, addCaught, gift, foundItem, rocketDrop, autoShop, fishing,
  };
})();
