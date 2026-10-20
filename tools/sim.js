// Simula partidas completas sem tela para balancear a dificuldade.
// Uso: node tools/sim.js [runs=40] [mode=1]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
global.window = global;
for (const f of ['assets/data.js', 'js/rules.js', 'js/mon.js', 'js/progress.js', 'js/battle.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
}
const { Battle } = window.BATTLE;
const P = window.PROGRESS, M = window.MON, R = window.RULES;

// jogador simples: usa poção quando um Pokémon em campo fica com pouca vida
function usePotions(b, bag) {
  for (const u of b.units) {
    if (u.side !== 'p' || u.state === 'faint' || u.mon.hp <= 0) continue;
    if (u.mon.hp / u.mon.maxhp > .3) continue;
    const k = ['hyperpotion', 'superpotion', 'potion'].find(x => bag[x] > 0);
    if (!k) return;
    bag[k]--;
    u.mon.hp = Math.min(u.mon.maxhp, u.mon.hp + R.ITEMS[k].heal);
  }
}

function fight(party, enemies, kind, mode, bag) {
  const b = new Battle({ party, enemies, mode, kind, headless: true, hooks: { canCatch: () => false } });
  let result = null;
  b.start().then(r => { result = r; });
  const dt = 1 / 30;
  // resolve as promessas a cada passo
  return (async () => {
    let n = 0;
    while (!result && b.t < 600) {
      b.update(dt);
      if (bag && ++n % 15 === 0) usePotions(b, bag);
      await null;
    }
    return { result: result || { won: false, participants: new Set(), defeated: [] }, time: b.t };
  })();
}

const arrive = {};
async function run(starter, mode) {
  const party = [M.create(starter, 5, { minIv: 20 })];
  const bag = { potion: 2 };
  let money = 1000;
  let badges = 0;
  const route = P.buildRoute();
  const times = {};
  let gymIdx = 0, eliteIdx = 0;
  for (let i = 0; i < route.length; i++) {
    const ev = route[i];
    let enemies, kind;
    if (ev === 'item') continue;
    // Centro Pokémon na cidade do ginásio e no Planalto Índigo
    if (ev === 'gym' || (ev === 'elite' && route[i - 1] !== 'elite')) {
      party.forEach(m => { m.hp = m.maxhp; });
      // gasta metade do dinheiro em poções
      const k = badges >= 3 ? 'hyperpotion' : badges >= 1 ? 'superpotion' : 'potion';
      let budget = money / 2;
      while (budget >= R.ITEMS[k].price) { budget -= R.ITEMS[k].price; money -= R.ITEMS[k].price; bag[k] = (bag[k] || 0) + 1; }
    }
    if (ev === 'gift') { if (party.length < 6) party.push(P.makeMon(M.pick(R.GIFT_POOL), R.SLOT_LEVEL[i] - 1)); continue; }
    if (ev === 'wild' || ev === 'fishing') {
      const w = P.wild(i, { fish: ev === 'fishing' });
      enemies = [w]; kind = 'wild';
      if (mode === 2 && Math.random() < .5) enemies.push(P.wild(i));
    } else if (ev === 'trainer' || ev === 'fork') { enemies = P.trainer(i, mode).team; kind = 'trainer'; }
    else if (ev === 'rocket') { enemies = P.rocket(i, mode).team; kind = 'rocket'; }
    else if (ev === 'rival') { enemies = P.rival(starter, i, mode).team; kind = 'rival'; }
    else if (ev === 'gym') { enemies = P.gym(gymIdx++).team; kind = 'gym'; }
    else if (ev === 'elite') { enemies = P.elite(eliteIdx++).team; kind = 'elite'; }
    else if (ev === 'champion') { enemies = P.champion(starter).team; kind = 'champion'; }
    if (kind === 'gym' || kind === 'elite' || kind === 'champion') {
      arrive[i] = arrive[i] || [];
      arrive[i].push(Math.max(...party.map(m => m.lvl)));
    }
    const { result, time } = await fight(party, enemies, kind, mode, bag);
    (times[kind] = times[kind] || []).push(time);
    if (!result.won) return { reached: i, ev, party, times };
    const xp = P.awardXp(party, result, kind);
    money += { wild: 0, trainer: 300, rocket: 600, rival: 800, gym: 1500, elite: 4000, champion: 5000 }[kind] || 0;
    if (kind === 'gym') badges++;
    for (const e of xp.evolve) P.evolve(e.mon, e.to);
    // pega o selvagem e aplica poções simples
    if (kind === 'wild' && party.length < 6 && Math.random() < .7) {
      const w = enemies[0]; w.hp = w.maxhp; party.push(w);
    }
    party.forEach(m => { if (m.hp > 0) m.hp = Math.min(m.maxhp, m.hp + Math.ceil(m.maxhp * R.REST_HEAL) + (i % 3 === 0 ? 20 : 0)); });
  }
  return { reached: route.length, ev: 'champion-win', party, times };
}

(async () => {
  const runs = +process.argv[2] || 40;
  const mode = +process.argv[3] || 1;
  for (const starter of [1, 4, 7]) {
    const reached = {};
    const allTimes = {};
    const lvls = [];
    for (let r = 0; r < runs; r++) {
      const out = await run(starter, mode);
      const key = out.ev === 'champion-win' ? 'CAMPEÃO' : `${out.reached}:${out.ev}`;
      reached[key] = (reached[key] || 0) + 1;
      for (const k in out.times) (allTimes[k] = allTimes[k] || []).push(...out.times[k]);
      lvls.push(Math.max(...out.party.map(m => m.lvl)));
    }
    const avg = a => (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1);
    console.log(`\n${R.DEX[starter].name} modo ${mode}x${mode}: ${JSON.stringify(reached)}`);
    console.log('  nível ao chegar:', Object.entries(arrive).map(([k, v]) => `${k}:${avg(v)}`).join(' '));
    for (const k in arrive) delete arrive[k];
    console.log('  nível máx médio:', avg(lvls), ' duração média (s):', Object.entries(allTimes).map(([k, v]) => `${k}=${avg(v)}`).join(' '));
  }
})();
