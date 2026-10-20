// Jogo principal: caminhada pela rota, eventos, loja, evolução e telas.
(function () {
  const R = window.RULES, M = window.MON, P = window.PROGRESS;
  const { DEX, ITEMS, BALLS } = R;
  const { say, choose, el, esc, $ } = UI;

  const W = 360, H = 640;
  const WALK_SPEED = 72;      // px/s (baixa resolução)
  const EVENT_GAP = 230;      // distância entre eventos
  const TRAINER_NAMES = ['Joey', 'Ana', 'Rick', 'Bia', 'Leo', 'Duda', 'Caio', 'Lia', 'Theo', 'Nina', 'Gabe', 'Malu', 'Davi', 'Iris', 'Enzo', 'Lara'];

  const G = {
    speed: 1, mode: 1, scene: 'title', paused: false, busy: false,
    party: [], pc: [], bag: {}, money: 0, badges: 0, starter: 4,
    route: [], step: 0, stats: {},
    world: null, battle: null, bg: null, fx: null, timers: [], time: 0,
  };
  window.G = G;

  // ---------- Canvas / escala ----------
  const canvas = $('#screen');
  const ctx = canvas.getContext('2d');
  const [low, lctx] = ART.canvas(180, 320);
  let K = 2;

  function resize() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    const stage = $('#stage');
    stage.style.transform = `scale(${s})`;
    stage.style.left = Math.round((window.innerWidth - W * s) / 2) + 'px';
    stage.style.top = Math.round((window.innerHeight - H * s) / 2) + 'px';
    K = Math.min(4, Math.max(1, Math.ceil(s * (window.devicePixelRatio || 1))));
    canvas.width = W * K;
    canvas.height = H * K;
    ctx.imageSmoothingEnabled = false;
  }

  // ---------- Tempo ----------
  function wait(sec) {
    return new Promise(res => G.timers.push({ t: G.time + sec, res }));
  }

  // ---------- Itens ----------
  const count = k => G.bag[k] || 0;
  const addItem = (k, n = 1) => { G.bag[k] = count(k) + n; updateHud(); };
  const ballCount = () => BALLS.reduce((s, b) => s + count(b), 0);

  // ---------- HUD ----------
  function gymIndexAt(i) {
    return G.route.slice(0, i + 1).filter(x => x === 'gym').length - 1;
  }

  function eventLabel(kind, i) {
    const gi = gymIndexAt(i);
    const ei = G.route.slice(0, i + 1).filter(x => x === 'elite').length - 1;
    return {
      wild: 'Grama alta', trainer: 'Treinador', item: 'Item', fishing: 'Lago',
      rocket: 'Equipe Rocket', rival: 'Rival', gift: 'Presente',
      gym: R.GYMS[gi] ? `Ginásio de ${R.GYMS[gi].leader}` : 'Ginásio',
      elite: R.ELITE[ei] ? `Elite dos 4: ${R.ELITE[ei].name}` : 'Elite dos 4',
      champion: 'Campeão',
    }[kind] || kind;
  }

  const NODE_ICON = { wild: '🌿', trainer: '⚔', item: '●', fishing: '≈', rocket: 'R', rival: '!', gift: '♥', elite: '4', champion: '♛' };

  function updateHud() {
    const prog = $('#prog');
    if (!prog) return;
    prog.innerHTML = '';
    let gymN = 0;
    G.route.forEach((ev, i) => {
      const n = el('div', 'node');
      if (ev === 'gym') {
        n.classList.add('gym');
        n.innerHTML = `<i style="${ART.badgeStyle(gymN, 12)}"></i>`;
        if (gymN >= G.badges) n.classList.add('dim');
        gymN++;
      } else if (ev === 'champion' || ev === 'elite') {
        n.classList.add('champ');
        n.textContent = NODE_ICON[ev];
      } else {
        n.textContent = i < G.step ? NODE_ICON[ev] : '?';
      }
      if (i < G.step) n.classList.add('done');
      if (i === G.step) n.classList.add('current');
      prog.appendChild(n);
    });
    const total = G.route.length || R.ROUTE.length;
    $('#step').textContent = `${Math.min(G.step + (G.scene === 'title' ? 0 : 1), total)}/${total}`;
    $('#money').textContent = '₽' + G.money;
    $('#balls').textContent = ballCount();
    $('#potions').textContent = count('potion') + count('superpotion') + count('hyperpotion');
    updateParty();
  }

  function updateParty() {
    const bar = $('#party');
    bar.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const mon = G.party[i];
      const slot = el('div', 'pslot' + (mon ? '' : ' empty') + (mon && mon.hp <= 0 ? ' fainted' : '') + (i === 0 && mon ? ' lead' : ''));
      if (mon) {
        const k = mon.hp / mon.maxhp;
        slot.innerHTML = `<div class="icon" style="${ART.iconStyle(mon.id)}"></div>
          <div class="lv">${mon.shiny ? '<b>✦</b>' : ''}Nv${mon.lvl}</div>
          <div class="hp"><i style="width:${Math.ceil(k * 100)}%;background:${k > .5 ? '#58d070' : k > .2 ? '#f8c830' : '#f05050'}"></i></div>`;
        slot.onclick = () => openMonPanel(mon);
      }
      bar.appendChild(slot);
    }
  }

  // ---------- Mundo (caminhada) ----------
  function hash(n) {
    let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function newWorld() {
    return { py: 0, walking: false, target: null, onArrive: null, dist: 0, objects: [], dir: 'up', follower: true, bubble: null };
  }

  function walkTo(y) {
    const w = G.world;
    w.walking = true;
    w.target = y;
    return new Promise(res => { w.onArrive = res; });
  }

  function updateWorld(dt) {
    const w = G.world;
    if (!w || G.paused) return;
    if (w.walking) {
      const step = WALK_SPEED * dt;
      w.py -= step;
      w.dist += step;
      if (w.py <= w.target) {
        w.py = w.target;
        w.walking = false;
        const f = w.onArrive;
        w.onArrive = null;
        if (f) f();
      }
    }
    for (const o of w.objects) if (o.update) o.update(dt);
    if (w.bubble && (w.bubble.t -= dt) <= 0) w.bubble = null;
  }

  // Colunas da rota (16px cada, x = col * 16 - 6): 0-1 floresta, 5-6 caminho, 10-11 floresta
  const PATH_X = 90; // centro do caminho
  const colX = c => c * 16 - 6;

  // árvore decorativa 2x2 (topo na linha r) à esquerda (colunas 2-3) ou à direita (8-9)
  function treeAt(col, row) {
    for (const [c0, seed] of [[2, 3.7], [8, 5.3]]) {
      if (col !== c0 && col !== c0 + 1) continue;
      for (const r of [row, row - 1]) {
        if (r % 3 === 0 && hash(r * seed + c0) < .3) {
          const top = r === row;
          const left = col === c0;
          return top ? (left ? 'treeTL' : 'treeTR') : (left ? 'treeBL' : 'treeBR');
        }
      }
    }
    return null;
  }

  function tileAt(col, row) {
    for (const o of G.world.objects) if (o.tile) { const t = o.tile(col, row); if (t) return t; }
    const odd = ((row % 2) + 2) % 2;
    if (col <= 1) return 'forestL' + (odd * 2 + col);
    if (col >= 10) return 'forestR' + (odd * 2 + col - 10);
    if (col === 5) return 'pathL';
    if (col === 6) return 'pathR';
    const tree = treeAt(col, row);
    if (tree) return tree;
    if (hash(col * 7.3 + row * 13.1) < .07) return (row + col) % 2 ? 'flowerA' : 'flowerB';
    return 'grass' + odd + (col % 2);
  }

  function drawWorld() {
    const w = G.world;
    const top = w.py - 230;
    const x = lctx;
    const r0 = Math.floor(top / 16);
    for (let r = r0; r < r0 + 22; r++) {
      const y = r * 16 - top;
      for (let c = 0; c < 12; c++) ART.drawTile(x, tileAt(c, r), colX(c), y);
    }
    // objetos e personagens ordenados por y
    const drawables = w.objects.filter(o => o.draw).map(o => ({ y: o.y, fn: () => o.draw(x, top) }));
    const step = w.walking ? [1, 0, 2, 0][Math.floor(w.dist / 8) % 4] : 0;
    drawables.push({ y: w.py, fn: () => ART.drawChar(x, 'player', w.dir, step, PATH_X, Math.round(w.py - top)) });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();
    ctx.drawImage(low, 0, 0, W, H);

    // Pokémon que segue o jogador (em resolução cheia)
    const lead = G.party.find(m => m.hp > 0);
    if (lead && w.follower) {
      const bob = w.walking ? Math.abs(Math.sin(w.dist / 5)) * 3 : 0;
      ART.drawIcon(ctx, lead.id, PATH_X * 2, (w.py - top) * 2 + 26 - bob, false);
    }
    // overlays em resolução cheia
    for (const o of w.objects) if (o.drawHi) o.drawHi(ctx, top);
    if (w.bubble) {
      const o = w.bubble;
      const bx = o.x * 2, by = (o.y - top) * 2 - 74;
      ctx.fillStyle = '#282828'; ctx.fillRect(bx - 9, by - 13, 18, 20);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 7, by - 11, 14, 16);
      UI.text(ctx, '!', bx + 1, by + 2, { size: 10, color: '#e03030', shadow: false });
    }
  }

  // ---------- Objetos do mundo ----------
  function npc(look, y, x = PATH_X, dir = 'down') {
    return { y, x, look, dir, draw(c, top) { ART.drawChar(c, this.look, this.dir, 0, this.x, Math.round(this.y - top)); } };
  }

  // depois da batalha o treinador sai do caminho
  function stepAside(o) {
    o.x = PATH_X + 26;
    o.dir = 'left';
  }

  function tallGrass(y0, rows = 4) {
    const rTop = Math.floor((y0 - rows * 16) / 16), rBot = Math.floor(y0 / 16);
    const o = {
      y: y0, shake: 0,
      tile: (col, row) => (row >= rTop && row <= rBot && col >= 2 && col <= 9 ? 'tall' : null),
      update(dt) { this.shake = Math.max(0, this.shake - dt); },
      // folhas voando enquanto a grama balança
      drawHi(c, top) {
        if (this.shake <= 0) return;
        const k = Math.floor(this.shake * 20) % 2;
        for (let i = 0; i < 6; i++) {
          const gx = (PATH_X + (i - 2.5) * 14 + (k ? 2 : -2)) * 2;
          const gy = (y0 - 40 - (i % 3) * 8 - top) * 2 - (1 - this.shake) * 30;
          c.fillStyle = i % 2 ? '#205830' : '#88d070';
          c.fillRect(gx, gy, 4, 4);
        }
      },
    };
    return o;
  }

  function lake(y0) {
    const rTop = Math.floor((y0 - 64) / 16), rBot = Math.floor(y0 / 16);
    return { y: y0, tile: (col, row) => (row >= rTop && row <= rBot && col >= 7 && col <= 9 ? 'water' : null) };
  }

  function itemBall(y) {
    const o = {
      y, taken: false,
      drawHi(c, top) { if (!this.taken) ART.drawItem(c, 0, PATH_X * 2, (y - top) * 2 - 10, .7); },
    };
    return o;
  }

  function buildingObj(kind, x, y, label) {
    const [, h] = ART.buildingSize(kind);
    return {
      y,
      draw(c, top) { ART.drawBuilding(c, kind, x, y - top); },
      drawHi(c, top) {
        if (!label) return;
        UI.text(c, label, x * 2, (y - top - h) * 2 - 6, { size: 8, color: '#ffffff', align: 'center', outline: true });
      },
    };
  }

  // área calçada da cidade
  function plaza(yTop, yBot) {
    const rTop = Math.floor(yTop / 16), rBot = Math.floor(yBot / 16);
    return { y: yBot, tile: (col, row) => (row >= rTop && row <= rBot && col >= 2 && col <= 9 ? 'pathC' : null) };
  }

  // ---------- Transições e cenas especiais ----------
  function flashTransition() {
    G.fx = { kind: 'flash', t: 0, dur: .9 };
    window.SFX.alert();
    return wait(.9);
  }

  function drawFx() {
    const f = G.fx;
    if (!f) return;
    const k = f.t / f.dur;
    if (f.kind === 'flash') {
      if (k < .5) {
        if (Math.floor(k * 12) % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(0, 0, W, H); }
      } else {
        const kk = (k - .5) / .5;
        ctx.fillStyle = '#101018';
        for (let i = 0; i < 8; i++) {
          const h = H / 8;
          const w2 = W * kk;
          if (i % 2) ctx.fillRect(0, i * h, w2, h); else ctx.fillRect(W - w2, i * h, w2, h);
        }
      }
    } else if (f.kind === 'fade') {
      ctx.fillStyle = `rgba(16,16,24,${f.out ? k : 1 - k})`;
      ctx.fillRect(0, 0, W, H);
    } else if (f.kind === 'white') {
      ctx.fillStyle = `rgba(255,255,255,${1 - k})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function fade(out, dur = .35) {
    G.fx = { kind: 'fade', out, t: 0, dur };
    return wait(dur);
  }

  // Tela VS para chefes
  async function vsScreen(look, name, subtitle) {
    G.vs = { look, name, subtitle, t: 0 };
    G.scene = 'vs';
    window.SFX.alert();
    await wait(2.2);
    G.vs = null;
  }

  function drawVs() {
    const v = G.vs;
    const k = Math.min(1, v.t / .35);
    ctx.fillStyle = '#202040'; ctx.fillRect(0, 0, W, H);
    // faixas diagonais
    ctx.save();
    ctx.fillStyle = '#3858c8';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * k, 0); ctx.lineTo(W * k - 120, H); ctx.lineTo(0, H); ctx.fill();
    ctx.fillStyle = '#c83838';
    ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(W - W * k * .55, H); ctx.lineTo(W - W * k * .55 + 120, 0); ctx.fill();
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      const y = ((i * 53 + v.t * 600) % (H + 40)) - 20;
      ctx.fillRect(0, y, W, 2);
    }
    ctx.restore();
    const slide = (1 - k) * 200;
    // retratos de batalha do GBA (o jogador fica de frente para o oponente)
    ART.drawPortrait(ctx, 'player', 96 - slide, 450, 3, true);
    ART.drawPortrait(ctx, v.look, 264 + slide, 200, 3);
    const pulse = 1 + Math.sin(v.t * 10) * .06;
    ctx.save();
    ctx.translate(180, 330); ctx.scale(pulse, pulse);
    UI.text(ctx, 'VS', 0, 12, { size: 40, color: '#f8e050', align: 'center', outline: true, outlineColor: '#401010' });
    ctx.restore();
    UI.text(ctx, v.name, 270, 386, { size: 12, color: '#ffffff', align: 'center', outline: true });
    if (v.subtitle) UI.text(ctx, v.subtitle, 270, 404, { size: 8, color: '#f8e050', align: 'center', outline: true });
  }

  // Evolução
  async function evolveScene(mon, to) {
    const from = mon.id;
    const prevScene = G.scene;
    G.scene = 'evolve';
    G.evo = { from, to, shiny: mon.shiny, t: 0, done: false };
    await say(`O quê? ${DEX[from].name} está evoluindo!`);
    window.SFX.evolve();
    await wait(3.6);
    G.evo.done = true;
    G.fx = { kind: 'white', t: 0, dur: .6 };
    P.evolve(mon, to);
    window.SFX.levelUp();
    G.stats.evolved = (G.stats.evolved || 0) + 1;
    await say(`Parabéns! Seu ${DEX[from].name} evoluiu para ${DEX[to].name}!`);
    G.evo = null;
    G.scene = prevScene;
    updateHud();
  }

  function drawEvolve() {
    const e = G.evo;
    ctx.fillStyle = '#101828'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
      const a = i * 2.4 + e.t * .7, r = 40 + ((i * 37 + e.t * 60) % 220);
      ctx.fillStyle = i % 3 ? 'rgba(160,200,255,.6)' : 'rgba(255,240,160,.8)';
      ctx.fillRect(180 + Math.cos(a) * r, 280 + Math.sin(a) * r, 2, 2);
    }
    if (e.done) {
      ART.drawMon(ctx, e.to, e.shiny, false, 180, 280, { scale: 2.5 });
      return;
    }
    const k = Math.min(1, e.t / 3.6);
    // alterna cada vez mais rápido entre a forma antiga e a nova
    const freq = 1.5 + k * k * 14;
    const showNew = Math.sin(e.t * freq * Math.PI) > 0 && k > .15;
    const id = showNew ? e.to : e.from;
    const tint = k > .1 ? '#ffffff' : null;
    ART.drawMon(ctx, id, e.shiny, false, 180, 280, { scale: 2.5, tint });
  }

  // Insígnia
  async function badgeScene(i) {
    G.badgeFx = { i, t: 0 };
    window.SFX.badge();
    await wait(1.8);
    G.badgeFx = null;
  }

  function drawBadgeFx() {
    const b = G.badgeFx;
    if (!b) return;
    const k = Math.min(1, b.t / .5);
    ctx.fillStyle = `rgba(16,16,32,${.6 * k})`; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6 + b.t;
      ctx.strokeStyle = 'rgba(248,224,80,.5)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(180, 280); ctx.lineTo(180 + Math.cos(a) * 200, 280 + Math.sin(a) * 200); ctx.stroke();
    }
    ART.drawBadge(ctx, b.i, 180, 280, Math.max(16, Math.round(5 * k) * 16));
    UI.text(ctx, R.GYMS[b.i].badge.toUpperCase(), 180, 360, { size: 10, color: '#ffffff', align: 'center', outline: true });
  }

  // ---------- Batalhas ----------
  async function runBattle({ enemies, kind, theme = 'route', title, look, vs }) {
    if (vs) await vsScreen(look, vs.name, vs.subtitle);
    else await flashTransition();
    const b = new BATTLE.Battle({
      party: G.party, enemies, mode: G.mode, kind: kind === 'wild' ? 'wild' : 'trainer', title,
      hooks: {
        canCatch: () => ballCount() > 0,
        catchPrompt: unit => catchPrompt(unit),
      },
    });
    G.battle = b;
    G.bg = BATTLE.arenaBackground(theme);
    G.scene = 'battle';
    G.fx = { kind: 'fade', out: false, t: 0, dur: .3 };
    showBattleButtons(kind === 'wild');
    $('#party').classList.add('hidden');
    const res = await b.start();
    showBattleButtons(null);
    $('#party').classList.remove('hidden');
    await fade(true, .3);
    G.battle = null;
    G.scene = 'world';
    G.fx = { kind: 'fade', out: false, t: 0, dur: .3 };
    updateHud();
    return res;
  }

  async function catchPrompt(unit) {
    const name = DEX[unit.mon.id].name;
    const opts = BALLS.filter(b => count(b) > 0).map(b => ({
      label: `${ITEMS[b].name} x${count(b)}`, value: b, icon: ART.itemStyle(ITEMS[b].icon),
    }));
    opts.push({ label: 'Continuar lutando', value: null });
    const choice = await choose(`${name} está fraco! Lançar uma Poké Bola?`, opts);
    if (choice) { G.bag[choice]--; updateHud(); }
    return choice;
  }

  function showBattleButtons(wild) {
    const box = $('#battle-buttons');
    box.innerHTML = '';
    if (wild === null) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    const bag = el('button', 'bbtn', 'MOCHILA');
    bag.onclick = () => openBattleBag();
    box.appendChild(bag);
    if (wild) {
      const run = el('button', 'bbtn', 'FUGIR');
      run.onclick = () => {
        const b = G.battle;
        if (!b || b.ending || b.paused || b.phase !== 'fight') return;
        b.ending = true;
        b.phase = 'end';
        b.say('Você fugiu!', 2);
        window.SFX.escape();
        setTimeout(() => b.resolve({ won: true, fled: true, participants: new Set(), defeated: [], caught: null }), 500);
      };
      box.appendChild(run);
    }
  }

  // Mochila durante a batalha: pausa e permite usar poções
  async function openBattleBag() {
    const b = G.battle;
    if (!b || b.paused || b.phase !== 'fight' || G.paused) return;
    b.paused = true;
    G.paused = true;
    await itemMenu({ inBattle: true });
    G.paused = false;
    if (G.battle === b) b.paused = false;
  }

  const HEAL_ITEMS = ['potion', 'superpotion', 'hyperpotion', 'revive', 'rarecandy'];

  // Menu de itens: escolhe item e depois o Pokémon
  function itemMenu({ inBattle } = {}) {
    return new Promise(resolve => {
      const box = UI.modal('bag');
      const render = () => {
        box.innerHTML = `<h2>MOCHILA</h2>`;
        const list = el('div', 'item-list');
        const usable = HEAL_ITEMS.filter(k => count(k) > 0 && !(inBattle && k === 'rarecandy'));
        if (!usable.length) list.innerHTML = '<p class="muted">Nenhum item de cura. Compre na Loja!</p>';
        for (const k of usable) {
          const it = ITEMS[k];
          const row = el('button', 'item-row', `<span class="ico" style="${ART.itemStyle(it.icon)}"></span><span>${it.name}</span><b>x${count(k)}</b>`);
          row.onclick = () => pickTarget(k);
          list.appendChild(row);
        }
        box.appendChild(list);
        const close = el('button', 'btn', 'FECHAR');
        close.onclick = () => { UI.closeModal(); resolve(); };
        box.appendChild(close);
      };
      const pickTarget = k => {
        const it = ITEMS[k];
        box.innerHTML = `<h2>${it.name}</h2><p class="muted">${it.desc} Em quem?</p>`;
        const list = el('div', 'mon-list');
        for (const mon of G.party) {
          const ok = it.revive ? mon.hp <= 0 : it.candy ? mon.lvl < 100 : mon.hp > 0 && mon.hp < mon.maxhp;
          const row = el('button', 'mon-row' + (ok ? '' : ' disabled'));
          const k2 = mon.hp / mon.maxhp;
          row.innerHTML = `<span class="icon" style="${ART.iconStyle(mon.id)}"></span>
            <span class="nm">${DEX[mon.id].name}<small>Nv${mon.lvl} · ${mon.hp}/${mon.maxhp} PS</small></span>
            <span class="hpb"><i style="width:${Math.ceil(k2 * 100)}%"></i></span>`;
          if (ok) {
            row.onclick = async () => {
              await useItem(k, mon);
              if (it.candy) { resolve(); return; } // o Doce Raro fecha a mochila
              render();
            };
          }
          list.appendChild(row);
        }
        box.appendChild(list);
        const back = el('button', 'btn', 'VOLTAR');
        back.onclick = render;
        box.appendChild(back);
      };
      render();
    });
  }

  async function useItem(k, mon) {
    const it = ITEMS[k];
    G.bag[k]--;
    if (it.heal) {
      mon.hp = Math.min(mon.maxhp, mon.hp + it.heal);
      window.SFX.heal();
    } else if (it.revive) {
      mon.hp = Math.floor(mon.maxhp / 2);
      window.SFX.heal();
      // volta para a batalha (entra direto se houver espaço vazio)
      const b = G.battle;
      if (b) {
        b.sides.p.queue.push(mon);
        for (let i = 0; i < b.slots; i++) if (!b.sides.p.slots[i]) { b.sendOut('p', i); break; }
      }
    } else if (it.candy) {
      const moves = P.levelUp(mon);
      window.SFX.levelUp();
      UI.closeModal();
      await say(`${DEX[mon.id].name} subiu para o Nv. ${mon.lvl}!`);
      for (const mv of moves) await say(`${DEX[mon.id].name} aprendeu ${mv.name}!`);
      const to = M.evolutionFor(mon);
      if (to) await evolveScene(mon, to);
    }
    updateHud();
  }

  // ---------- Painel do Pokémon ----------
  function openMonPanel(mon) {
    if (G.scene !== 'world' || G.busyModal) return;
    G.busyModal = true;
    G.paused = true;
    const box = UI.modal('monpanel');
    const render = () => {
      const sp = DEX[mon.id];
      const k = mon.hp / mon.maxhp;
      box.innerHTML = '';
      const head = el('div', 'mon-head');
      head.appendChild(UI.monImg(mon.id, mon.shiny, 2));
      const info = el('div', 'mon-info', `
        <h2>${sp.name}${mon.shiny ? ' <span class="shiny">✦</span>' : ''}</h2>
        <div>Nv ${mon.lvl} · ${sp.types.map(UI.typeTag).join(' ')}</div>
        <div class="hpline"><span>PS ${mon.hp}/${mon.maxhp}</span><span class="hpb"><i style="width:${Math.ceil(k * 100)}%"></i></span></div>
        <div class="muted">XP ${mon.xp}/${M.xpNext(mon.lvl)}</div>`);
      head.appendChild(info);
      box.appendChild(head);
      box.appendChild(el('div', 'stats', `
        <span>ATQ ${mon.atk}</span><span>DEF ${mon.def}</span><span>VEL ${mon.spe}</span>
        <span>AT.E ${mon.spa}</span><span>DF.E ${mon.spd}</span>`));
      const moves = el('div', 'moves');
      for (const m of R.movesFor(mon)) {
        moves.appendChild(el('div', 'move', `<span class="type" style="background:${m.type ? R.TYPE_INFO[m.type].color : '#888'}">${m.type ? R.TYPE_INFO[m.type].pt : '-'}</span> ${m.name} <small>${m.pow || '-'}</small>`));
      }
      box.appendChild(moves);
      const actions = el('div', 'actions');
      const idx = G.party.indexOf(mon);
      if (idx > 0) {
        const lead = el('button', 'btn', 'COLOCAR NA FRENTE');
        lead.onclick = () => { G.party.splice(idx, 1); G.party.unshift(mon); window.SFX.select(); updateHud(); render(); };
        actions.appendChild(lead);
      }
      const items = el('button', 'btn', 'USAR ITEM');
      items.onclick = async () => { await itemMenu(); G.busyModal = false; openMonPanel(mon); };
      actions.appendChild(items);
      if (G.pc.length) {
        const swap = el('button', 'btn', `TROCAR (PC: ${G.pc.length})`);
        swap.onclick = () => pcSwap(mon, box, render);
        actions.appendChild(swap);
      }
      const close = el('button', 'btn', 'FECHAR');
      close.onclick = () => { UI.closeModal(); G.paused = false; G.busyModal = false; };
      actions.appendChild(close);
      box.appendChild(actions);
    };
    render();
  }

  function pcSwap(mon, box, back) {
    box.innerHTML = `<h2>PC DE BILL</h2><p class="muted">Trocar ${DEX[mon.id].name} por:</p>`;
    const list = el('div', 'mon-list');
    for (const other of G.pc) {
      const row = el('button', 'mon-row');
      row.innerHTML = `<span class="icon" style="${ART.iconStyle(other.id)}"></span>
        <span class="nm">${DEX[other.id].name}${other.shiny ? ' ✦' : ''}<small>Nv${other.lvl} · ${other.hp}/${other.maxhp} PS</small></span>`;
      row.onclick = () => {
        const i = G.party.indexOf(mon), j = G.pc.indexOf(other);
        G.party[i] = other; G.pc[j] = mon;
        window.SFX.select();
        updateHud();
        UI.closeModal(); G.paused = false; G.busyModal = false;
      };
      list.appendChild(row);
    }
    box.appendChild(list);
    const b = el('button', 'btn', 'VOLTAR');
    b.onclick = back;
    box.appendChild(b);
  }

  // ---------- Pós-batalha ----------
  async function afterBattle(res, kind, money) {
    if (res.fled) { await say('Você fugiu em segurança!'); return true; }
    if (!res.won) return false;
    if (res.caught) await addCaught(res.caught);
    const xp = P.awardXp(G.party, res, kind);
    if (xp.total) await say(`Seu time ganhou ${xp.total} pontos de experiência!`);
    for (const l of xp.log) {
      if (l.kind === 'level') { window.SFX.levelUp(); await say(`${DEX[l.mon.id].name} subiu para o Nv. ${l.lvl}!`); }
      else await say(`${DEX[l.mon.id].name} aprendeu ${l.move.name}!`);
    }
    if (money) {
      G.money += money;
      G.stats.earned = (G.stats.earned || 0) + money;
      window.SFX.buy();
      await say(`Você ganhou ₽${money}!`);
    }
    for (const e of xp.evolve) await evolveScene(e.mon, e.to);
    for (const m of G.party) if (m.hp > 0) m.hp = Math.min(m.maxhp, m.hp + Math.ceil(m.maxhp * R.REST_HEAL));
    updateHud();
    return true;
  }

  async function addCaught(mon) {
    G.stats.caught = (G.stats.caught || 0) + 1;
    if (mon.shiny) G.stats.shinies = (G.stats.shinies || 0) + 1;
    if (DEX[mon.id].legendary) G.stats.legendary = (G.stats.legendary || 0) + 1;
    mon.xp = 0;
    if (G.party.length < 6) {
      G.party.push(mon);
      updateHud();
      await say(`${DEX[mon.id].name} entrou para o seu time!`);
    } else {
      G.pc.push(mon);
      await say(`Seu time está cheio. ${DEX[mon.id].name} foi enviado para o PC de Bill.`);
    }
  }

  // ---------- Eventos ----------
  const aheadY = () => G.world.py - EVENT_GAP;

  async function evWild(slot, opts = {}) {
    const y = aheadY();
    const grass = tallGrass(y + 10, 5);
    G.world.objects.push(grass);
    await walkTo(y);
    grass.shake = .8;
    window.SFX.alert();
    await wait(.7);
    const enemies = [P.wild(slot, opts)];
    const alive = G.party.filter(m => m.hp > 0).length;
    if (G.mode === 2 && alive >= 2 && Math.random() < .5) enemies.push(P.wild(slot, opts));
    if (enemies.some(e => DEX[e.id].legendary)) {
      await say('O chão está tremendo... Um Pokémon lendário apareceu!');
    }
    const res = await runBattle({ enemies, kind: 'wild', theme: opts.fish ? 'water' : 'route' });
    await walkTo(G.world.py - 40);
    return afterBattle(res, 'wild');
  }

  function trainerName() { return M.pick(TRAINER_NAMES); }

  async function trainerApproach(look) {
    const y = aheadY() - 30;
    const o = npc(look, y);
    G.world.objects.push(o);
    await walkTo(y + 70);
    G.world.bubble = { x: PATH_X, y, t: .9 };
    window.SFX.alert();
    await wait(.9);
    return o;
  }

  async function evTrainer(slot, moneyMult = 1) {
    const tr = P.trainer(slot, G.mode);
    const name = trainerName();
    const o = await trainerApproach(tr.cls.look);
    await say(`${tr.cls.cls} ${name}: ${M.pick(['Ei! Nossos olhos se cruzaram, vamos batalhar!', 'Você parece forte. Vamos ver!', 'Não vou perder pra você!', 'Meus Pokémon estão prontos!'])}`);
    const res = await runBattle({ enemies: tr.team, kind: 'trainer', title: `${tr.cls.cls} ${name}` });
    if (res.won) await say(`${tr.cls.cls} ${name}: ${M.pick(['Ahh, perdi!', 'Você é bom mesmo!', 'Não acredito!', 'Vou treinar mais...'])}`);
    stepAside(o);
    const ok = await afterBattle(res, 'trainer', Math.round(tr.money * moneyMult));
    if (ok) await walkTo(G.world.py - 60);
    return ok;
  }

  async function evRocket(slot) {
    const tr = P.rocket(slot, G.mode);
    const o = await trainerApproach('rocket');
    await say('Recruta Rocket: Prepare-se para encrenca! Entregue seus Pokémon!');
    const res = await runBattle({ enemies: tr.team, kind: 'rocket', theme: 'rocket', title: 'Recruta Rocket', look: 'rocket', vs: { name: 'Equipe Rocket', subtitle: 'Recruta' } });
    if (!res.won) return false;
    await say('Recruta Rocket: A Equipe Rocket decolando de novo!');
    o.y = -1e9; // foge
    const ok = await afterBattle(res, 'rocket', tr.money);
    if (ok && Math.random() < .5) { addItem('rarecandy'); window.SFX.buy(); await say('O recruta deixou cair um Doce Raro!'); }
    if (ok) await walkTo(G.world.py - 60);
    return ok;
  }

  async function evRival(slot) {
    const tr = P.rival(G.starter, slot, G.mode);
    const o = await trainerApproach('rival');
    G.stats.rivalFights = (G.stats.rivalFights || 0) + 1;
    await say(G.stats.rivalFights > 1 ? 'Blue: Você de novo? Dessa vez eu ganho!' : 'Blue: Ei! Vamos ver quem ficou mais forte!');
    const res = await runBattle({ enemies: tr.team, kind: 'rival', title: 'Rival Blue', look: 'rival', vs: { name: 'Blue', subtitle: 'Rival' } });
    if (!res.won) return false;
    await say('Blue: O quê?! Que sorte a sua!');
    stepAside(o);
    const ok = await afterBattle(res, 'rival', tr.money);
    if (ok) await walkTo(G.world.py - 60);
    return ok;
  }

  const FOUND_ITEMS = [[['pokeball', 3], 25], [['greatball', 2], 15], [['potion', 2], 20], [['superpotion', 1], 15], [['revive', 1], 10], [['rarecandy', 1], 10], [['nugget', 1], 5]];

  async function giveFoundItem() {
    const [k, n] = M.weighted(FOUND_ITEMS);
    window.SFX.buy();
    if (k === 'nugget') {
      G.money += 3000;
      updateHud();
      await say('Você encontrou uma Pepita! Vendeu por ₽3000!');
    } else {
      addItem(k, n);
      await say(`Você encontrou ${n > 1 ? n + 'x ' : ''}${ITEMS[k].name}!`);
    }
  }

  async function evItem() {
    const y = aheadY();
    const ball = itemBall(y);
    G.world.objects.push(ball);
    await walkTo(y + 4);
    ball.taken = true;
    await giveFoundItem();
    return true;
  }

  async function evFishing(slot) {
    const y = aheadY();
    G.world.objects.push(lake(y + 20), npc('fisher', y - 10, 104, 'left'));
    await walkTo(y);
    await say('Pescador: Que lago bonito! Pegue minha vara e tente a sorte!');
    await say('...');
    await say('Fisgou! Um Pokémon mordeu a isca!');
    return evWildDirect(slot, { fish: true });
  }

  async function evWildDirect(slot, opts) {
    const enemies = [P.wild(slot, opts)];
    const res = await runBattle({ enemies, kind: 'wild', theme: opts.fish ? 'water' : 'route' });
    return afterBattle(res, 'wild');
  }

  async function evGift(slot) {
    const y = aheadY();
    G.world.objects.push(npc('oldman', y - 6, 110, 'left'));
    await walkTo(y);
    const id = M.pick(R.GIFT_POOL);
    await say(`Senhor: Este ${DEX[id].name} precisa de um treinador. Cuide bem dele!`);
    const mon = M.create(id, Math.max(5, R.SLOT_LEVEL[slot] - 1));
    window.SFX.caught();
    await say(`Você recebeu ${DEX[id].name}!`);
    await addCaught(mon);
    G.stats.caught--;
    return true;
  }

  async function shop() {
    return new Promise(resolve => {
      const box = UI.modal('shop');
      const render = () => {
        box.innerHTML = `<h2>LOJA POKÉMON</h2><div class="money">Seu dinheiro: <b>₽${G.money}</b></div>`;
        const list = el('div', 'item-list');
        for (const [k, it] of Object.entries(ITEMS)) {
          if (!it.price || (it.badges || 0) > G.badges) continue;
          const row = el('div', 'shop-row' + (G.money < it.price ? ' poor' : ''));
          row.innerHTML = `<span class="ico" style="${ART.itemStyle(it.icon)}"></span>
            <span class="nm">${it.name}<small>${it.desc}</small></span>
            <span class="have">x${count(k)}</span>`;
          const buy = el('button', 'btn small', '₽' + it.price);
          buy.onclick = () => {
            if (G.money < it.price) return;
            G.money -= it.price;
            addItem(k);
            window.SFX.buy();
            render();
          };
          row.appendChild(buy);
          list.appendChild(row);
        }
        box.appendChild(list);
        const close = el('button', 'btn', 'SAIR DA LOJA');
        close.onclick = () => { UI.closeModal(); resolve(); };
        box.appendChild(close);
      };
      render();
    });
  }

  async function healParty() {
    window.SFX.heal();
    for (const m of G.party) m.hp = m.maxhp;
    G.fx = { kind: 'white', t: 0, dur: .8 };
    updateHud();
    await wait(.8);
  }

  // Cidade do ginásio: Centro Pokémon (cura) e Loja
  async function cityStop(name) {
    const y = aheadY();
    G.world.objects.push(
      plaza(y - 60, y + 40),
      buildingObj('center', 34, y - 4),
      buildingObj('mart', 146, y - 4),
      npc('nurse', y + 14, 40, 'down'),
      npc('clerk', y + 14, 140, 'down'),
    );
    await walkTo(y + 16);
    await say(`Bem-vindo à cidade de ${name}!`);
    await say('Enfermeira Joy: Vou cuidar dos seus Pokémon!');
    await healParty();
    await say('Seus Pokémon estão totalmente recuperados!');
    const c = await choose('Vendedor: Quer comprar alguma coisa?', [{ label: 'Entrar na loja', value: true }, { label: 'Seguir viagem', value: false }]);
    if (c) await shop();
  }

  async function evGym(slot) {
    const gi = G.route.slice(0, slot).filter(x => x === 'gym').length;
    const data = P.gym(gi);
    const g = data.gym;
    await cityStop(g.city);
    const y = G.world.py - 150;
    G.world.objects.push(plaza(y - 90, y + 30), buildingObj('gym', PATH_X, y, `GINÁSIO DE ${g.city.toUpperCase()}`));
    await walkTo(y + 14);
    await say(`Ginásio de ${g.city} — Líder: ${g.leader}, especialista em tipo ${R.TYPE_INFO[g.type].pt}.`);
    await say(`${g.leader}: ${g.intro}`);
    const res = await runBattle({ enemies: data.team, kind: 'gym', theme: g.type, title: `Líder ${g.leader}`, look: g.look, vs: { name: g.leader, subtitle: 'Líder de Ginásio' } });
    if (!res.won) return false;
    await say(`${g.leader}: ${g.lose}`);
    G.badges++;
    updateHud();
    await badgeScene(gi);
    await say(`Você recebeu a ${g.badge}!`);
    const ok = await afterBattle(res, 'gym', data.money);
    // sai pelo outro lado do ginásio
    await fade(true);
    G.world.objects = G.world.objects.filter(o => o.y < y - 200);
    G.world.py -= 120;
    G.fx = { kind: 'fade', out: false, t: 0, dur: .35 };
    return ok;
  }

  // Elite dos 4: a primeira sala começa no Planalto Índigo; entre as salas não há cura
  async function evElite(slot) {
    const ei = G.route.slice(0, slot).filter(x => x === 'elite').length;
    const data = P.elite(ei);
    const e = data.elite;
    if (ei === 0) {
      const y = aheadY();
      G.world.objects.push(plaza(y - 110, y + 30), buildingObj('league', PATH_X, y, 'LIGA POKÉMON'));
      await walkTo(y + 20);
      await say('Você chegou ao Planalto Índigo! Aqui estão a Elite dos 4 e o Campeão.');
      await healParty();
      await say('Seus Pokémon foram curados. Depois daqui, não há mais Centro Pokémon!');
      const c = await choose('Quer passar na loja antes do desafio?', [{ label: 'Entrar na loja', value: true }, { label: 'Estou pronto!', value: false }]);
      if (c) await shop();
    } else {
      await say(`Você segue para a próxima sala da Liga...`);
    }
    await say(`${e.name}: ${e.intro}`);
    const res = await runBattle({ enemies: data.team, kind: 'elite', theme: e.arena, title: e.name, look: e.look, vs: { name: e.name, subtitle: 'Elite dos 4' } });
    if (!res.won) return false;
    await say(`${e.name}: ${e.lose}`);
    return afterBattle(res, 'elite', data.money);
  }

  async function evChampion() {
    await say('Você entra na sala do Campeão...');
    await say('Blue: Até que enfim você chegou! Eu sou o Campeão agora. Prove que é melhor que eu!');
    const data = P.champion(G.starter);
    const res = await runBattle({ enemies: data.team, kind: 'champion', theme: 'champion', title: 'Campeão Blue', look: 'champion', vs: { name: 'Blue', subtitle: 'CAMPEÃO' } });
    if (!res.won) return false;
    await say('Blue: Não acredito... Eu perdi! Você é o novo Campeão!');
    await afterBattle(res, 'champion', data.money);
    return true;
  }

  async function runEvent(kind, slot) {
    switch (kind) {
      case 'wild': return evWild(slot);
      case 'trainer': return evTrainer(slot);
      case 'rocket': return evRocket(slot);
      case 'rival': return evRival(slot);
      case 'item': return evItem(slot);
      case 'fishing': return evFishing(slot);
      case 'gift': return evGift(slot);
      case 'gym': return evGym(slot);
      case 'elite': return evElite(slot);
      case 'champion': return evChampion(slot);
    }
    return true;
  }

  // ---------- Telas de início e fim ----------
  function titleScreen() {
    return new Promise(resolve => {
      const box = UI.modal('title');
      box.innerHTML = `
        <div class="logo"><span>POKÉMON</span><em>Jornada por Kanto</em></div>
        <p class="muted">Seu treinador caminha sozinho por Kanto.<br>Um evento surpresa, um ginásio... até as 8 insígnias, a Elite dos 4 e o Campeão.<br>As batalhas acontecem sozinhas, em tempo real!</p>
        <div class="label">MODO DE BATALHA</div>`;
      const modes = el('div', 'row');
      for (const m of [1, 2]) {
        const b = el('button', 'btn toggle' + (G.mode === m ? ' on' : ''), `${m}x${m}`);
        b.onclick = () => { G.mode = m; [...modes.children].forEach((c, i) => c.classList.toggle('on', i + 1 === m)); window.SFX.select(); };
        modes.appendChild(b);
      }
      box.appendChild(modes);
      const start = el('button', 'btn big', 'COMEÇAR');
      start.onclick = () => { window.AUDIO.unlock(); window.SFX.select(); UI.closeModal(); resolve(); };
      box.appendChild(start);
      box.appendChild(el('p', 'tiny muted', 'Clique ou ESPAÇO para avançar os textos'));
    });
  }

  function starterScreen() {
    return new Promise(resolve => {
      const box = UI.modal('starter');
      box.innerHTML = '<h2>Escolha seu Pokémon inicial</h2><p class="muted">Professor Carvalho: Cada um tem suas forças. Escolha com sabedoria!</p>';
      const row = el('div', 'starters');
      for (const id of [1, 4, 7]) {
        const card = el('button', 'starter-card');
        card.appendChild(UI.monImg(id, false, 2));
        card.appendChild(el('div', 'nm', DEX[id].name));
        card.appendChild(el('div', 'types', DEX[id].types.map(UI.typeTag).join(' ')));
        card.onclick = () => { window.SFX.select(); UI.closeModal(); resolve(id); };
        row.appendChild(card);
      }
      box.appendChild(row);
    });
  }

  function endScreen(won, reachedSlot) {
    return new Promise(resolve => {
      const box = UI.modal(won ? 'end win' : 'end');
      const kind = G.route[reachedSlot];
      if (won) {
        box.innerHTML = `<h1>CAMPEÃO!</h1><p>Você venceu a Liga Pokémon de Kanto!</p><div class="label">HALL DA FAMA</div>`;
      } else {
        box.innerHTML = `<h1>FIM DE JOGO</h1><p>Seu time desmaiou...</p>
          <p>Você chegou até: <b>${eventLabel(kind, reachedSlot)}</b> (${reachedSlot + 1}/${G.route.length})</p>`;
      }
      const team = el('div', 'hall');
      for (const m of G.party) {
        const c = el('div', 'hall-mon');
        c.appendChild(UI.monImg(m.id, m.shiny, 1));
        c.appendChild(el('small', '', `${DEX[m.id].name}<br>Nv${m.lvl}`));
        team.appendChild(c);
      }
      box.appendChild(team);
      const badges = el('div', 'badges');
      for (let i = 0; i < 8; i++) {
        const [c, x] = ART.canvas(32, 32);
        ART.drawBadge(x, i, 16, 16, 32);
        if (i >= G.badges) c.className = 'dim';
        badges.appendChild(c);
      }
      box.appendChild(badges);
      const secs = Math.round((performance.now() - G.startedAt) / 1000);
      box.appendChild(el('div', 'stats', `
        <span>Capturas: ${G.stats.caught || 0}</span><span>Shinies: ${G.stats.shinies || 0}</span>
        <span>Evoluções: ${G.stats.evolved || 0}</span><span>Tempo: ${Math.floor(secs / 60)}m${String(secs % 60).padStart(2, '0')}s</span>`));
      const again = el('button', 'btn big', 'JOGAR DE NOVO');
      again.onclick = () => { UI.closeModal(); resolve(); };
      box.appendChild(again);
    });
  }

  // ---------- Fluxo principal ----------
  async function newGame() {
    G.party = []; G.pc = []; G.bag = { pokeball: 5, potion: 2 }; G.money = 1000; G.badges = 0;
    G.stats = {}; G.step = 0; G.route = P.buildRoute();
    G.world = newWorld();
    G.scene = 'world';
    G.world.follower = false;
    updateHud();
    G.starter = await starterScreen();
    const starter = M.create(G.starter, 5, { minIv: 20 });
    G.party.push(starter);
    G.world.follower = true;
    updateHud();
    await say(`Você escolheu ${DEX[G.starter].name}! Você recebeu 5 Poké Bolas e 2 Poções.`);
    await say(`Blue: Então eu fico com o ${DEX[R.RIVAL_STARTER[G.starter]].name}! Te vejo na Liga!`);
    G.startedAt = performance.now();
    for (let i = 0; i < G.route.length; i++) {
      G.step = i;
      updateHud();
      const ok = await runEvent(G.route[i], i);
      if (!ok) {
        window.SFX.gameOver();
        await say('Seu time não pode mais lutar...');
        await endScreen(false, i);
        return;
      }
    }
    G.step = G.route.length;
    updateHud();
    window.SFX.victory();
    await endScreen(true, G.route.length - 1);
  }

  async function main() {
    resize();
    window.addEventListener('resize', resize);
    await Promise.all([ART.load(), document.fonts ? document.fonts.load('8px "Press Start 2P"').catch(() => {}) : null]);
    UI.state.speedFn = () => G.speed;
    setupButtons();
    requestAnimationFrame(frame);
    // cenário de fundo do título: caminhada infinita
    G.world = newWorld();
    G.world.follower = false;
    G.world.walking = true; G.world.target = -1e9;
    G.scene = 'world';
    updateHud();
    for (;;) {
      G.scene = 'world';
      G.world = newWorld(); G.world.walking = true; G.world.target = -1e9; G.world.follower = false;
      $('#hud').classList.add('hidden');
      $('#party').classList.add('hidden');
      await titleScreen();
      $('#hud').classList.remove('hidden');
      $('#party').classList.remove('hidden');
      await newGame();
    }
  }

  function setupButtons() {
    const sp = $('#btn-speed');
    sp.onclick = () => { G.speed = G.speed === 1 ? 2 : G.speed === 2 ? 4 : 1; sp.textContent = G.speed + 'x'; window.SFX.select(); };
    const auto = $('#btn-auto');
    auto.onclick = () => { UI.state.auto = !UI.state.auto; auto.classList.toggle('on', UI.state.auto); window.SFX.select(); };
    const mute = $('#btn-mute');
    mute.onclick = () => { const m = window.AUDIO.toggle(); mute.textContent = m ? '♪̸' : '♪'; mute.classList.toggle('off', m); };
  }

  // ---------- Loop ----------
  let last = performance.now();
  function frame(now) {
    const real = Math.min(.05, (now - last) / 1000);
    last = now;
    const dt = real * G.speed;
    const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
    for (let i = 0; i < steps; i++) step(dt / steps);
    render();
    requestAnimationFrame(frame);
  }

  function step(dt) {
    G.time += dt;
    const due = G.timers.filter(t => t.t <= G.time);
    G.timers = G.timers.filter(t => t.t > G.time);
    for (const t of due) t.res();
    if (G.fx) { G.fx.t += dt; if (G.fx.t >= G.fx.dur) G.fx = G.fx.kind === 'fade' && G.fx.out ? { ...G.fx, t: G.fx.dur } : null; }
    if (G.vs) G.vs.t += dt;
    if (G.evo) G.evo.t += dt;
    if (G.badgeFx) G.badgeFx.t += dt;
    if (G.scene === 'battle' && G.battle && !G.paused) G.battle.update(dt);
    else if (G.scene === 'battle' && G.battle) G.battle.updateFx(0);
    if (G.scene === 'world') updateWorld(dt);
  }

  function render() {
    ctx.setTransform(K, 0, 0, K, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (G.scene === 'battle' && G.battle) G.battle.draw(ctx, G.bg);
    else if (G.scene === 'vs' && G.vs) drawVs();
    else if (G.scene === 'evolve' && G.evo) drawEvolve();
    else if (G.world) drawWorld();
    drawBadgeFx();
    drawFx();
  }

  main().catch(err => {
    console.error(err);
    document.body.insertAdjacentHTML('beforeend', `<pre class="fatal">${esc(err.stack || err)}</pre>`);
  });
})();
