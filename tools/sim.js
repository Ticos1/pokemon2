// Simula partidas completas sem tela para balancear a dificuldade.
// As regras da jornada vêm de js/journey.js (as mesmas do jogo); aqui fica só o "jogador":
// usa poções quando um Pokémon fica fraco, joga a melhor bola e faz compras automáticas.
// Uso: node tools/sim.js [runs=40] [mode=1]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
global.window = global;
for (const f of ['assets/data.js', 'js/rules.js', 'js/mon.js', 'js/progress.js', 'js/journey.js', 'js/battle.js', 'js/fishing.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
}
const { Battle } = window.BATTLE;
const { Fishing } = window.FISHING;
const R = window.RULES, P = window.PROGRESS, J = window.JOURNEY;

// usa poção quando um Pokémon em campo fica com pouca vida
function usePotions(b, st) {
  for (const u of b.units) {
    if (u.side !== 'p' || u.state === 'faint' || u.mon.hp <= 0) continue;
    if (u.mon.hp / u.mon.maxhp > .3) continue;
    const k = J.HEAL_ORDER.find(x => J.count(st, x) > 0);
    if (!k) return;
    st.bag[k]--;
    u.mon.hp = Math.min(u.mon.maxhp, u.mon.hp + R.ITEMS[k].heal);
  }
}

async function fight(st, enc) {
  const b = new Battle({
    party: st.party, enemies: enc.enemies, mode: st.mode, kind: enc.battle, headless: true,
    hooks: {
      canCatch: () => J.ballCount(st) > 0 && st.party.length + st.pc.length < 30,
      catchPrompt: async () => { const k = J.bestBall(st); if (k) st.bag[k]--; return k; },
    },
  });
  let result = null;
  b.start().then(r => { result = r; });
  const dt = 1 / 30;
  let n = 0;
  while (!result && b.t < 600) {
    b.update(dt);
    if (++n % 15 === 0) usePotions(b, st);
    await null; // resolve as promessas a cada passo
  }
  return { result: result || { won: false, participants: new Set(), defeated: [] }, time: b.t };
}

function fishingMinigame(st, mon) {
  const f = new Fishing({ ...J.fishing(st, mon), autoFn: () => true });
  let n = 0;
  while (f.state !== 'done' && n++ < 60 * 300) f.update(1 / 60);
  return !!(f.result && f.result.caught);
}

const arrive = {};
async function run(starter, mode) {
  const st = J.newState(starter, mode);
  const times = {};
  for (let i = 0; i < st.route.length; i++) {
    const ev = st.route[i];
    if (J.hasCenter(st.route, i)) { J.healAll(st.party); J.autoShop(st); }
    if (ev === 'item') { J.foundItem(st); continue; }
    if (ev === 'gift') { J.addCaught(st, J.gift(st, i), { gift: true }); continue; }
    const enc = J.encounter(st, i);
    if (ev === 'fishing' && !fishingMinigame(st, enc.enemies[0])) continue;
    if (['gym', 'elite', 'champion'].includes(ev)) (arrive[i] = arrive[i] || []).push(Math.max(...st.party.map(m => m.lvl)));
    const { result, time } = await fight(st, enc);
    (times[ev] = times[ev] || []).push(time);
    if (!result.won) return { reached: i, ev, st, times };
    if (result.caught) J.addCaught(st, result.caught);
    const xp = J.victory(st, result, enc.kind, enc.money);
    if (ev === 'gym') st.badges++;
    if (ev === 'rocket') J.rocketDrop(st);
    for (const e of xp.evolve) P.evolve(e.mon, e.to);
    J.rest(st.party);
  }
  return { reached: st.route.length, ev: 'champion-win', st, times };
}

module.exports = { run };
if (require.main !== module) return;

(async () => {
  const runs = +process.argv[2] || 40;
  const mode = +process.argv[3] || 1;
  let wins = 0;
  for (const starter of [1, 4, 7]) {
    const reached = {};
    const allTimes = {};
    const lvls = [];
    for (let r = 0; r < runs; r++) {
      const out = await run(starter, mode);
      const key = out.ev === 'champion-win' ? 'CAMPEÃO' : `${out.reached}:${out.ev}`;
      reached[key] = (reached[key] || 0) + 1;
      for (const k in out.times) (allTimes[k] = allTimes[k] || []).push(...out.times[k]);
      lvls.push(Math.max(...out.st.party.map(m => m.lvl)));
    }
    wins += reached['CAMPEÃO'] || 0;
    const avg = a => (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1);
    const sorted = Object.entries(reached).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' ');
    console.log(`\n${R.DEX[starter].name} modo ${mode}x${mode}: ${sorted}`);
    console.log('  nível ao chegar:', Object.entries(arrive).map(([k, v]) => `${k}:${avg(v)}`).join(' '));
    for (const k in arrive) delete arrive[k];
    console.log('  nível máx médio:', avg(lvls), ' duração média (s):', Object.entries(allTimes).map(([k, v]) => `${k}=${avg(v)}`).join(' '));
  }
  console.log(`\nCampeão em ${wins}/${runs * 3} partidas (${Math.round(wins / runs / 3 * 100)}%)`);
})();
