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

function fight(party, enemies, kind, mode) {
  const b = new Battle({ party, enemies, mode, kind, headless: true, hooks: { canCatch: () => false } });
  let result = null;
  b.start().then(r => { result = r; });
  const dt = 1 / 30;
  // resolve as promessas a cada passo
  return (async () => {
    while (!result && b.t < 600) { b.update(dt); await null; }
    return { result: result || { won: false, participants: new Set(), defeated: [] }, time: b.t };
  })();
}

async function run(starter, mode) {
  const party = [M.create(starter, 5, { minIv: 20 })];
  const route = P.buildRoute();
  const times = {};
  let gymIdx = 0;
  for (let i = 0; i < route.length; i++) {
    const ev = route[i];
    let enemies, kind;
    if (ev === 'city') { party.forEach(m => { m.hp = m.maxhp; }); continue; }
    if (ev === 'item') continue;
    if (ev === 'gift') { if (party.length < 6) party.push(P.makeMon(M.pick(R.GIFT_POOL), R.SLOT_LEVEL[i] - 1)); continue; }
    if (ev === 'wild' || ev === 'fishing') {
      const w = P.wild(i, { fish: ev === 'fishing' });
      enemies = [w]; kind = 'wild';
      if (mode === 2 && Math.random() < .5) enemies.push(P.wild(i));
    } else if (ev === 'trainer' || ev === 'fork') { enemies = P.trainer(i, mode).team; kind = 'trainer'; }
    else if (ev === 'rocket') { enemies = P.rocket(i, mode).team; kind = 'rocket'; }
    else if (ev === 'rival') { enemies = P.rival(starter, i, mode).team; kind = 'rival'; }
    else if (ev === 'gym') { enemies = P.gym(gymIdx++).team; kind = 'gym'; }
    else if (ev === 'champion') { party.forEach(m => { m.hp = m.maxhp; }); enemies = P.champion(starter).team; kind = 'champion'; }
    const { result, time } = await fight(party, enemies, kind, mode);
    (times[kind] = times[kind] || []).push(time);
    if (!result.won) return { reached: i, ev, party, times };
    const xp = P.awardXp(party, result, kind);
    for (const e of xp.evolve) P.evolve(e.mon, e.to);
    // pega o selvagem e aplica poções simples
    if (kind === 'wild' && party.length < 6 && Math.random() < .7) {
      const w = enemies[0]; w.hp = w.maxhp; party.push(w);
    }
    party.forEach(m => { if (m.hp > 0) m.hp = Math.min(m.maxhp, m.hp + Math.ceil(m.maxhp * R.REST_HEAL) + (i % 3 === 0 ? 20 : 0)); });
  }
  return { reached: 15, ev: 'champion-win', party, times };
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
      const key = out.reached === 15 ? 'CAMPEÃO' : `${out.reached}:${out.ev}`;
      reached[key] = (reached[key] || 0) + 1;
      for (const k in out.times) (allTimes[k] = allTimes[k] || []).push(...out.times[k]);
      lvls.push(Math.max(...out.party.map(m => m.lvl)));
    }
    const avg = a => (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1);
    console.log(`\n${R.DEX[starter].name} modo ${mode}x${mode}: ${JSON.stringify(reached)}`);
    console.log('  nível máx médio:', avg(lvls), ' duração média (s):', Object.entries(allTimes).map(([k, v]) => `${k}=${avg(v)}`).join(' '));
  }
})();
