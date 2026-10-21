// Testes rápidos sem navegador: arquivos do index.html, regras, partidas simuladas, pesca e jogo salvo.
// Uso: node tools/test.js  (também roda no GitHub Actions a cada push)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('todos os scripts e estilos do index.html existem e não têm erro de sintaxe', () => {
  const files = [...html.matchAll(/(?:src|href)="([^"#:]+\.(?:js|css|webmanifest|woff2))"/g)].map(m => m[1]);
  assert.ok(files.length > 10);
  for (const f of files) {
    assert.ok(fs.existsSync(path.join(root, f)), `${f} não existe`);
    if (f.endsWith('.js')) new vm.Script(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
  }
});

// a simulação carrega as regras e a batalha do jogo (os mesmos arquivos do navegador)
const sim = require('./sim.js');
const { RULES: R, JOURNEY: J, MON: M, FISHING, GBA } = global.window;

test('gráficos citados pelo mapa existem em assets/gba.js', () => {
  vm.runInThisContext(fs.readFileSync(path.join(root, 'assets/gba.js'), 'utf8'));
  const src = fs.readFileSync(path.join(root, 'js/world.js'), 'utf8') + fs.readFileSync(path.join(root, 'js/game.js'), 'utf8');
  const used = new Set([...src.matchAll(/'((?:path|wood|trunk|canopy|tree|ledge|grass|flower)\w*|tall|water|sign)'/g)].map(m => m[1]));
  for (const t of used) {
    if (t === 'grass') continue; // montado como 'grass' + linha + coluna
    assert.ok(t in window.GBA.tiles, `tile ${t} não existe`);
  }
  for (const k of ['center', 'mart', 'gym', 'league']) assert.ok(window.GBA.buildings[k], `prédio ${k}`);
  for (const g of R.GYMS) assert.ok(g.look in window.GBA.people, `personagem ${g.look}`);
  for (const e of R.ELITE) assert.ok(e.look in window.GBA.people && e.arena in window.GBA.arenas.reduce((o, a) => ({ ...o, [a]: 1 }), {}), e.name);
});

const K = global.window.KANTO;

test('jornada passa por Kanto inteiro: 8 ginásios em ordem, Elite dos 4, Campeão e a Caverna Desconhecida', () => {
  for (let r = 0; r < 30; r++) {
    const st = J.newState(M.pick([1, 4, 7]), 1);
    const route = st.route;
    // as bifurcações viram o caminho escolhido
    for (let i = 0; i < route.length; i++) if (route[i].ev === 'choice') K.expandChoice(route, i, M.randInt(0, 1));
    assert.deepStrictEqual(route.filter(s => s.ev === 'gym').map(s => s.n), [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.deepStrictEqual(route.filter(s => s.ev === 'elite').map(s => s.n), [0, 1, 2, 3]);
    assert.strictEqual(route.filter(s => s.ev === 'champion').length, 1);
    assert.strictEqual(route[route.length - 1].ev, 'legend');
    assert.strictEqual(route[route.length - 1].id, 150);
    for (const a of ['mtmoon', 'ssanne', 'rocktunnel', 'tower', 'hideout', 'silph', 'mansion', 'powerplant', 'victory', 'unknown']) {
      assert.ok(route.some(s => s.area === a), `falta ${a}`);
    }
    for (const s of route) {
      assert.ok(K.AREAS[s.area] || s.ev === 'choice', `área ${s.area}`);
      const map = K.AREAS[s.area] && K.AREAS[s.area].maps && K.AREAS[s.area].maps[s.floor];
      if (map) assert.ok(window.GBA.maps[map], `mapa ${map}`);
      assert.ok(!['R'].includes(s.ev), 'evento sorteado não resolvido');
    }
    // a pesca só acontece onde tem água
    for (const s of route) if (s.ev === 'fishing') assert.ok(K.AREAS[s.area].water || K.AREAS[s.area].sea || s.area === 'route12', s.area);
  }
});

test('todo evento de batalha gera inimigos válidos', () => {
  const st = J.newState(4, 2);
  for (let i = 0; i < st.route.length; i++) {
    if (st.route[i].ev === 'choice') K.expandChoice(st.route, i, 0);
    const base = st.route[i];
    for (const ev of ['wild', 'fishing', 'trainer', 'double', 'rocket', 'rival', 'legend', 'marowak', 'fossil', 'quiz', 'boss', 'gym', 'elite', 'champion']) {
      if (!base.area || !K.AREAS[base.area].pool && ev === 'wild') continue;
      st.route[i] = { ...base, ev, n: (i % 4) + (ev === 'gym' || ev === 'rival' ? 2 : 0), id: base.id || 144, key: R.BOSSES[base.key] ? base.key : 'giovanni1', lvl: base.lvl || 20 };
      const enc = J.encounter(st, i);
      assert.ok(enc && enc.enemies.length > 0, `${ev} em ${i}`);
      for (const m of enc.enemies) assert.ok(R.DEX[m.id] && m.hp > 0 && m.maxhp > 0, `${ev} em ${i}`);
    }
    st.route[i] = base;
  }
});

test('partidas simuladas terminam sem erro nos dois modos', async () => {
  for (const mode of [1, 2]) {
    for (const starter of [1, 4, 7]) {
      for (let r = 0; r < 3; r++) {
        const out = await sim.run(starter, mode);
        assert.ok(out.reached >= 0 && out.reached <= out.st.route.length);
        for (const m of [...out.st.party, ...out.st.pc]) assert.ok(m.hp >= 0 && m.hp <= m.maxhp && m.lvl >= 1);
        assert.ok(out.st.money >= 0);
      }
    }
  }
});

test('pesca automática termina e peixes fáceis quase sempre vêm', () => {
  const st = J.newState(1, 1);
  let caught = 0;
  for (let i = 0; i < 30; i++) {
    const f = new FISHING.Fishing({ ...J.fishing(st, M.create(129, 10)), autoFn: () => true });
    let n = 0;
    while (f.state !== 'done' && n++ < 60 * 300) f.update(1 / 60);
    for (let k = 0; k < 120 && f.resolve; k++) f.update(1 / 60);
    assert.ok(f.result, 'a pesca não terminou');
    if (f.result.caught) caught++;
  }
  assert.ok(caught >= 27, `só pegou ${caught}/30 Magikarp`);
});

test('jogo salvo volta igual', () => {
  const mem = {};
  window.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  vm.runInThisContext(fs.readFileSync(path.join(root, 'js/save.js'), 'utf8'));
  const st = J.newState(7, 2);
  st.step = 5; st.seen = []; st.party.push(M.create(25, 12));
  window.SAVE.write(st, 123);
  const back = window.SAVE.read();
  assert.deepStrictEqual(back.party, JSON.parse(JSON.stringify(st.party)));
  assert.strictEqual(back.step, 5);
  assert.strictEqual(back.elapsed, 123);
  M.syncUid(back.party);
  assert.ok(M.create(1, 5).uid > Math.max(...back.party.map(m => m.uid)));
  window.SAVE.clear();
  assert.strictEqual(window.SAVE.read(), null);
});

test('jogo salvo de versão antiga (rota sem as áreas) não continua', () => {
  assert.strictEqual(J.upgradeSave({ v: 1, route: ['wild', 'gym'], step: 0, party: [M.create(1, 5)] }), null);
  const st = J.newState(1, 1);
  assert.ok(J.upgradeSave(JSON.parse(JSON.stringify({ ...st, v: 2 }))));
});

test('golpes de verdade: no máximo 4, todos válidos, e cada Pokémon tem pelo menos um', () => {
  for (const p of window.POKEDEX) {
    for (const lvl of [2, 5, 15, 30, 50, 70]) {
      const mv = R.movesFor({ id: p.id, lvl });
      assert.ok(mv.length >= 1 && mv.length <= 4, `${p.name} Nv${lvl}`);
      for (const m of mv) assert.ok(m.name && m.kind && m.cd > 0 && (m.kind === 'splash' || m.pow > 0), `${p.name}: ${m.name}`);
    }
  }
  // Charmander aprende Brasa no Nv 7, como no FireRed
  assert.ok(!R.movesFor({ id: 4, lvl: 6 }).some(m => m.key === 'ember'));
  assert.ok(R.movesFor({ id: 4, lvl: 7 }).some(m => m.key === 'ember'));
  const next = R.nextMove({ id: 7, lvl: 5 });
  assert.ok(next && next.lvl > 5 && next.move.name);
});

test('Pokémon de água não aparecem na grama alta das rotas', () => {
  for (const [k, a] of Object.entries(K.AREAS)) {
    if (a.kind !== 'walk' || !a.pool) continue;
    for (const [id] of K.POOLS[a.pool]) assert.ok(!R.DEX[id].types.includes('water'), `${R.DEX[id].name} em ${k}`);
  }
});

test('perder para um lendário põe um Centro Pokémon como próxima parada', () => {
  const st = J.newState(1, 1);
  const i = st.route.findIndex(s => s.ev === 'legend');
  const n = st.route.length;
  J.insertCenter(st, i);
  assert.strictEqual(st.route.length, n + 1);
  assert.strictEqual(st.route[i + 1].ev, 'center');
});

test('Safári, cassino, ovo, clima e pedras funcionam', () => {
  const st = J.newState(7, 1);
  const stop = { area: 'safari', lvl: 25, stage: 4 };
  let caught = 0;
  for (let k = 0; k < 200; k++) {
    const s = { mon: J.safariMon(stop), angry: 0, eating: 0 };
    for (let t = 0; t < 30; t++) { const r = J.safariTurn(s, 'ball'); if (r === 'caught') { caught++; break; } if (r === 'fled') break; }
  }
  assert.ok(caught > 20 && caught < 190, `capturou ${caught}/200 no Safári`);
  st.money = 1e6;
  for (let k = 0; k < 20; k++) J.casinoAuto(st);
  assert.ok(st.coins >= 0);
  J.giveEgg(st);
  let born = [];
  for (let k = 0; k < 6 && !born.length; k++) born = J.tickEggs(st);
  assert.strictEqual(born.length, 1);
  J.startWeather(st);
  for (let k = 0; k < 10; k++) J.tickWeather(st);
  assert.strictEqual(st.weather, null);
  assert.strictEqual(J.stoneTarget(M.create(25, 20), 'thunderstone'), 26);
  assert.strictEqual(J.stoneTarget(M.create(25, 20), 'firestone'), null);
});
