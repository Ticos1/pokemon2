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

test('rota tem 30 paradas (2 eventos antes de cada ginásio), 8 ginásios, Elite dos 4 e Campeão', () => {
  for (let i = 0; i < 50; i++) {
    const st = J.newState(M.pick([1, 4, 7]), 1);
    assert.strictEqual(st.route.length, R.SLOT_LEVEL.length);
    assert.strictEqual(st.route.filter(x => x === 'gym').length, 8);
    assert.strictEqual(st.route.filter(x => x === 'elite').length, 4);
    assert.strictEqual(st.route[st.route.length - 1], 'champion');
    assert.strictEqual(st.route[0], 'wild');
  }
});

test('todo evento de batalha gera inimigos válidos', () => {
  const st = J.newState(4, 2);
  for (let i = 0; i < st.route.length; i++) {
    for (const ev of ['wild', 'fishing', 'trainer', 'rocket', 'rival', 'gym', 'elite', 'champion']) {
      st.route[i] = ev;
      const enc = J.encounter(st, i);
      assert.ok(enc.enemies.length > 0, `${ev} em ${i}`);
      for (const m of enc.enemies) assert.ok(R.DEX[m.id] && m.hp > 0 && m.maxhp > 0, `${ev} em ${i}`);
    }
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

test('jogo salvo da versão de 22 paradas continua na mesma parada', () => {
  const old = ['wild', 'gym', 'trainer', 'gym', 'item', 'gym', 'rival', 'gym', 'wild', 'gym', 'gift', 'gym', 'rocket', 'gym', 'fishing', 'gym', 'trainer', 'elite', 'elite', 'elite', 'elite', 'champion'];
  for (const [step, ev] of [[0, 'wild'], [3, 'gym'], [6, 'rival'], [16, 'trainer'], [19, 'elite'], [21, 'champion']]) {
    const up = J.upgradeSave({ v: 1, route: old.slice(), step, seen: [], party: [M.create(1, 5)] });
    assert.strictEqual(up.route.length, R.ROUTE.length);
    assert.strictEqual(up.route[up.step], ev);
    assert.strictEqual(up.route.filter(x => x === 'gym').length, 8);
    R.ROUTE.forEach((x, i) => { if (x !== 'R') assert.strictEqual(up.route[i], x); });
  }
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

test('Pokémon de água não aparecem na grama alta', () => {
  for (let slot = 0; slot < R.ROUTE.length; slot++) {
    for (let i = 0; i < 40; i++) {
      const id = M.wildSpecies(slot);
      assert.ok(!R.DEX[id].types.includes('water'), `${R.DEX[id].name} na grama (parada ${slot})`);
    }
  }
});
