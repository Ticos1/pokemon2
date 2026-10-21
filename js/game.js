// Jogo principal: estado, tela, HUD, batalhas, menus, cenas especiais, telas de início e fim.
// A caminhada fica em js/world.js e as paradas da rota em js/events.js.
(function () {
  const R = window.RULES, M = window.MON, P = window.PROGRESS, J = window.JOURNEY;
  const { DEX, ITEMS, BALLS } = R;
  const { say, choose, el, esc, $ } = UI;

  const W = 360, H = 640;

  const G = {
    speed: 1, mode: 1, scene: 'title', paused: false, autopilot: false,
    party: [], pc: [], bag: {}, money: 0, badges: 0, starter: 4,
    route: [], step: 0, stats: {}, seen: [],
    world: null, battle: null, bg: null, fx: null, fishing: null, timers: [], time: 0,
  };
  window.G = G;

  // ---------- Canvas / escala ----------
  const canvas = $('#screen');
  const ctx = canvas.getContext('2d');
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
  const count = k => J.count(G, k);
  const addItem = (k, n = 1) => { J.addItem(G, k, n); updateHud(); };
  const ballCount = () => J.ballCount(G);

  // ---------- HUD ----------
  function eventLabel(kind, i) {
    const gi = J.indexOfKind(G.route, i, 'gym');
    const ei = J.indexOfKind(G.route, i, 'elite');
    return {
      wild: 'Grama alta', trainer: 'Treinador', item: 'Item', fishing: 'Lago',
      rocket: 'Equipe Rocket', rival: 'Rival', gift: 'Presente',
      gym: R.GYMS[gi] ? `Ginásio de ${R.GYMS[gi].leader}` : 'Ginásio',
      elite: R.ELITE[ei] ? `Elite dos 4: ${R.ELITE[ei].name}` : 'Elite dos 4',
      champion: 'Campeão',
    }[kind] || kind;
  }

  // Ícone de cada parada na barra de progresso, com os gráficos do GBA
  function nodeIcon(ev, i) {
    if (ev === 'wild') return ART.tileStyle('tall', 12);
    if (ev === 'fishing') return ART.tileStyle('water', 12);
    if (ev === 'item') return ART.itemStyle(0, 12);
    if (ev === 'elite') return ART.headStyle(R.ELITE[J.indexOfKind(G.route, i, 'elite')].look);
    if (ev === 'champion') return ART.headStyle('rival');
    const look = { trainer: G.seen[i] || 'youngster', rocket: 'rocket', rival: 'rival', gift: 'oldman' }[ev];
    return look ? ART.headStyle(look) : '';
  }

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
      } else if (ev === 'champion' || ev === 'elite' || i < G.step) {
        if (ev === 'champion' || ev === 'elite') n.classList.add('champ');
        n.innerHTML = `<i style="${nodeIcon(ev, i)}"></i>`;
      } else {
        n.textContent = '?';
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

  // ---------- Mundo ----------
  const walkTo = x => WORLD.walkTo(G.world, x);

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
    const before = R.movesFor(mon);
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
    const now = R.movesFor(mon);
    const gone = before.filter(m => !now.includes(m));
    for (const [i, mv] of now.filter(m => !before.includes(m)).entries()) await sayNewMove(mon, { move: mv, forgot: gone[i] });
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
      ART.drawMon(ctx, e.to, e.shiny, false, 180, 280, { scale: 2 });
      return;
    }
    const k = Math.min(1, e.t / 3.6);
    // alterna cada vez mais rápido entre a forma antiga e a nova
    const freq = 1.5 + k * k * 14;
    const showNew = Math.sin(e.t * freq * Math.PI) > 0 && k > .15;
    const id = showNew ? e.to : e.from;
    const tint = k > .1 ? '#ffffff' : null;
    ART.drawMon(ctx, id, e.shiny, false, 180, 280, { scale: 2, tint });
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

  // Dentro de um prédio (ginásio, salas da Liga): a arena com o líder esperando
  async function goInside(theme, look) {
    await fade(true);
    G.indoor = { theme, look };
    G.scene = 'indoor';
    G.fx = { kind: 'fade', out: false, t: 0, dur: .35 };
    await wait(.35);
  }

  async function goOutside() {
    await fade(true);
    G.indoor = null;
    G.scene = 'world';
    G.world.dir = 'right';
    G.fx = { kind: 'fade', out: false, t: 0, dur: .35 };
    await wait(.35);
  }

  function drawIndoor() {
    const d = G.indoor;
    ctx.drawImage(ART.arena(d.theme), 0, 0, W, H);
    ART.drawChar(ctx, d.look, 'down', 0, 180, 214, 2);
    ART.drawChar(ctx, 'player', 'up', 0, 180, 452, 2);
  }

  // ---------- Batalhas ----------
  async function runBattle({ enemies, kind, theme = 'route', title, look, vs }) {
    const back = G.scene === 'indoor' ? 'indoor' : 'world';
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
    G.scene = back;
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
    const choice = await choose(`${name} está fraco! Lançar uma Poké Bola?`, opts, { auto: J.bestBall(G) });
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
    const team = el('button', 'bbtn team', 'TIME');
    team.onclick = () => openTeam();
    box.appendChild(team);
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
      for (const mv of moves) await sayNewMove(mon, mv);
      const to = M.evolutionFor(mon);
      if (to) await evolveScene(mon, to);
    }
    updateHud();
  }

  // ---------- Painel do Pokémon ----------
  // Abre na caminhada, dentro do ginásio e no meio da batalha (o jogo pausa enquanto está aberto)
  function canOpenPanel() {
    if (G.busyModal || G.fishing || G.paused) return false;
    if (G.scene === 'battle') return !!G.battle && G.battle.phase === 'fight' && !G.battle.paused;
    return G.scene === 'world' || G.scene === 'indoor';
  }

  function pausePanel() {
    G.busyModal = true;
    G.paused = true;
    const b = G.battle;
    if (b) b.paused = true;
    return () => {
      UI.closeModal();
      G.paused = false;
      G.busyModal = false;
      if (b && G.battle === b) b.paused = false;
    };
  }

  const KIND_LABEL = { dash: 'corpo a corpo', proj: 'à distância', beam: 'raio', strike: 'na área do alvo', nova: 'ao redor', splash: '-' };

  function moveRow(m) {
    const color = m.type ? R.TYPE_INFO[m.type].color : '#888';
    return el('div', 'move', `<span class="type" style="background:${color}">${m.type ? R.TYPE_INFO[m.type].pt : '-'}</span>
      <b>${m.name}</b><small>${m.total ? 'Poder ' + m.total : ''}</small><em>${KIND_LABEL[m.kind] || ''}</em>`);
  }

  function openMonPanel(mon, resume) {
    if (!resume) {
      if (!canOpenPanel()) return;
      resume = pausePanel();
    }
    const inBattle = G.scene === 'battle';
    const box = UI.modal('monpanel');
    const render = () => {
      const sp = DEX[mon.id];
      const k = mon.hp / mon.maxhp;
      box.innerHTML = '';
      const head = el('div', 'mon-head');
      head.appendChild(UI.monImg(mon.id, mon.shiny));
      const info = el('div', 'mon-info', `
        <h2>${sp.name}${mon.shiny ? ' <span class="shiny">✦</span>' : ''}</h2>
        <div>Nv ${mon.lvl} · ${sp.types.map(UI.typeTag).join(' ')}</div>
        <div class="hpline"><span>PS ${Math.max(0, Math.ceil(mon.hp))}/${mon.maxhp}</span><span class="hpb"><i style="width:${Math.ceil(k * 100)}%;background:${k > .5 ? '#58d070' : k > .2 ? '#f8c830' : '#f05050'}"></i></span></div>
        <div class="muted">${mon.hp <= 0 ? 'Desmaiado' : `XP ${mon.xp}/${M.xpNext(mon.lvl)}`}</div>`);
      head.appendChild(info);
      box.appendChild(head);
      box.appendChild(el('div', 'stats', `
        <span>ATQ ${mon.atk}</span><span>DEF ${mon.def}</span><span>VEL ${mon.spe}</span>
        <span>AT.E ${mon.spa}</span><span>DF.E ${mon.spd}</span>`));
      box.appendChild(el('div', 'label', 'GOLPES'));
      const moves = el('div', 'moves');
      for (const m of R.movesFor(mon)) moves.appendChild(moveRow(m));
      box.appendChild(moves);
      const next = R.nextMove(mon);
      const evo = M.evolutionFor({ ...mon, lvl: 100 });
      const evoLvl = evo && DEX[mon.id].evo.find(e => e.to === evo).level;
      box.appendChild(el('div', 'next muted', [
        next ? `Próximo golpe: <b>${next.move.name}</b> no Nv ${next.lvl}` : 'Não aprende mais golpes subindo de nível.',
        evoLvl && evoLvl > mon.lvl ? `Evolui no Nv ${evoLvl}` : '',
      ].filter(Boolean).join('<br>')));
      const actions = el('div', 'actions');
      const idx = G.party.indexOf(mon);
      if (idx > 0 && !inBattle) {
        const lead = el('button', 'btn', 'COLOCAR NA FRENTE');
        lead.onclick = () => { G.party.splice(idx, 1); G.party.unshift(mon); window.SFX.select(); updateHud(); render(); };
        actions.appendChild(lead);
      }
      const items = el('button', 'btn', 'USAR ITEM');
      items.onclick = async () => { await itemMenu({ inBattle }); openMonPanel(mon, resume); };
      actions.appendChild(items);
      if (G.pc.length && !inBattle) {
        const swap = el('button', 'btn', `TROCAR (PC: ${G.pc.length})`);
        swap.onclick = () => pcSwap(mon, box, render, resume);
        actions.appendChild(swap);
      }
      if (inBattle) {
        const team = el('button', 'btn', 'VOLTAR');
        team.onclick = () => openTeam(resume);
        actions.appendChild(team);
      }
      const close = el('button', 'btn', 'FECHAR');
      close.onclick = resume;
      actions.appendChild(close);
      box.appendChild(actions);
    };
    render();
  }

  // Lista do time (botão TIME da batalha): vida e golpes de cada um
  function openTeam(resume) {
    if (!resume) {
      if (!canOpenPanel()) return;
      resume = pausePanel();
    }
    const box = UI.modal('team');
    box.innerHTML = '<h2>SEU TIME</h2>';
    const list = el('div', 'mon-list');
    for (const mon of G.party) {
      const k = mon.hp / mon.maxhp;
      const row = el('button', 'mon-row' + (mon.hp <= 0 ? ' fainted' : ''));
      row.innerHTML = `<span class="icon" style="${ART.iconStyle(mon.id)}"></span>
        <span class="nm">${DEX[mon.id].name}${mon.shiny ? ' ✦' : ''}<small>Nv${mon.lvl} · ${Math.max(0, Math.ceil(mon.hp))}/${mon.maxhp} PS</small>
        <small class="mv">${R.movesFor(mon).map(m => m.name).join(' · ')}</small></span>
        <span class="hpb"><i style="width:${Math.ceil(k * 100)}%;background:${k > .5 ? '#58d070' : k > .2 ? '#f8c830' : '#f05050'}"></i></span>`;
      row.onclick = () => { window.SFX.select(); openMonPanel(mon, resume); };
      list.appendChild(row);
    }
    box.appendChild(list);
    const close = el('button', 'btn', 'FECHAR');
    close.onclick = resume;
    box.appendChild(close);
  }

  function pcSwap(mon, box, back, resume) {
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
        resume();
      };
      list.appendChild(row);
    }
    box.appendChild(list);
    const b = el('button', 'btn', 'VOLTAR');
    b.onclick = back;
    box.appendChild(b);
  }

  // Golpe novo: com 4 golpes, o Pokémon esquece o mais fraco para aprender o novo
  async function sayNewMove(mon, { move, forgot }) {
    const name = DEX[mon.id].name;
    if (forgot) await say(`1, 2 e... Puf! ${name} esqueceu ${forgot.name} e aprendeu ${move.name}!`);
    else await say(`${name} aprendeu ${move.name}!`);
  }

  // ---------- Pós-batalha ----------
  async function afterBattle(res, kind, money) {
    if (res.fled) { await say('Você fugiu em segurança!'); return true; }
    if (!res.won) return false;
    if (res.caught) await addCaught(res.caught);
    const xp = J.victory(G, res, kind, money);
    if (xp.total) await say(`Seu time ganhou ${xp.total} pontos de experiência!`);
    for (const l of xp.log) {
      if (l.kind === 'level') { window.SFX.levelUp(); await say(`${DEX[l.mon.id].name} subiu para o Nv. ${l.lvl}!`); }
      else await sayNewMove(l.mon, l);
    }
    if (money) {
      window.SFX.buy();
      updateHud();
      await say(`Você ganhou ₽${money}!`);
    }
    for (const e of xp.evolve) await evolveScene(e.mon, e.to);
    J.rest(G.party);
    updateHud();
    return true;
  }

  async function addCaught(mon, opts) {
    const where = J.addCaught(G, mon, opts);
    updateHud();
    if (where === 'party') await say(`${DEX[mon.id].name} entrou para o seu time!`);
    else await say(`Seu time está cheio. ${DEX[mon.id].name} foi enviado para o PC de Bill.`);
  }

  // ---------- Loja e Centro Pokémon ----------
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

  async function healParty() {
    window.SFX.heal();
    J.healAll(G.party);
    G.fx = { kind: 'white', t: 0, dur: .8 };
    updateHud();
    await wait(.8);
  }

  // Loja: no modo gravação as compras são automáticas
  async function visitShop(prompt, stayLabel) {
    if (G.autopilot) {
      const bought = J.autoShop(G);
      const list = Object.entries(bought).map(([k, n]) => `${n}x ${ITEMS[k].name}`);
      updateHud();
      if (list.length) { window.SFX.buy(); await say(`Você comprou ${list.join(', ')}.`); }
      return;
    }
    const c = await choose(prompt, [{ label: 'Entrar na loja', value: true }, { label: stayLabel, value: false }]);
    if (c) await shop();
  }

  // ---------- Telas de início e fim ----------
  function titleScreen(saved) {
    return new Promise(resolve => {
      const box = UI.modal('title');
      box.innerHTML = `
        <div class="logo"><span>POKÉMON</span><em>Jornada por Kanto</em></div>
        <p class="muted">Seu treinador caminha sozinho por Kanto.<br>Um evento surpresa, um ginásio... até as 8 insígnias, a Elite dos 4 e o Campeão.<br>As batalhas acontecem sozinhas, em tempo real!</p>`;
      const start = how => () => { window.AUDIO.unlock(); window.SFX.select(); UI.closeModal(); resolve(how); };
      if (saved) {
        const lead = saved.party[0];
        const cont = el('button', 'btn big', 'CONTINUAR');
        cont.onclick = start('continue');
        box.appendChild(cont);
        box.appendChild(el('p', 'tiny muted', `Parada ${saved.step + 1}/${saved.route.length} · ${DEX[lead.id].name} Nv${lead.lvl} · ${saved.badges} insígnia${saved.badges === 1 ? '' : 's'}`));
      }
      box.appendChild(el('div', 'label', 'MODO DE BATALHA'));
      const modes = el('div', 'row');
      for (const m of [1, 2]) {
        const b = el('button', 'btn toggle' + (G.mode === m ? ' on' : ''), `${m}x${m}`);
        b.onclick = () => { G.mode = m; SAVE.prefs({ mode: m }); [...modes.children].forEach((c, i) => c.classList.toggle('on', i + 1 === m)); window.SFX.select(); };
        modes.appendChild(b);
      }
      box.appendChild(modes);
      const rec = el('button', 'btn toggle rec' + (G.autopilot ? ' on' : ''), '● MODO GRAVAÇÃO');
      rec.onclick = () => { setRecording(!G.autopilot); rec.classList.toggle('on', G.autopilot); window.SFX.select(); };
      box.appendChild(rec);
      box.appendChild(el('p', 'tiny muted', 'Gravação: textos, escolhas e loja no automático e sem botões na tela. Teclas 1, 2 e 4 mudam a velocidade; ESC desliga.'));
      const fresh = el('button', 'btn big', saved ? 'NOVO JOGO' : 'COMEÇAR');
      if (saved) fresh.classList.add('alt');
      fresh.onclick = start('new');
      box.appendChild(fresh);
      box.appendChild(el('p', 'tiny muted', 'Clique ou ESPAÇO para avançar os textos'));
    });
  }

  function starterScreen() {
    return new Promise(resolve => {
      const box = UI.modal('starter');
      box.innerHTML = '<h2>Escolha seu Pokémon inicial</h2><p class="muted">Professor Carvalho: Cada um tem suas forças. Escolha com sabedoria!</p>';
      const row = el('div', 'starters');
      let timer = null;
      const cards = [];
      for (const id of [1, 4, 7]) {
        const card = el('button', 'starter-card');
        card.appendChild(UI.monImg(id, false));
        card.appendChild(el('div', 'nm', DEX[id].name));
        card.appendChild(el('div', 'types', DEX[id].types.map(UI.typeTag).join(' ')));
        card.onclick = () => { clearTimeout(timer); window.SFX.select(); UI.closeModal(); resolve(id); };
        row.appendChild(card);
        cards.push(card);
      }
      box.appendChild(row);
      // modo gravação: escolhe um inicial sozinho
      if (G.autopilot) {
        const card = M.pick(cards);
        timer = setTimeout(() => { card.classList.add('picked'); timer = setTimeout(() => card.onclick(), 600); }, 1400 / G.speed);
      }
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
      const secs = Math.round(elapsed());
      box.appendChild(el('div', 'stats', `
        <span>Capturas: ${G.stats.caught || 0}</span><span>Shinies: ${G.stats.shinies || 0}</span>
        <span>Evoluções: ${G.stats.evolved || 0}</span><span>Tempo: ${Math.floor(secs / 60)}m${String(secs % 60).padStart(2, '0')}s</span>`));
      const again = el('button', 'btn big', 'JOGAR DE NOVO');
      again.onclick = () => { UI.closeModal(); resolve(); };
      box.appendChild(again);
    });
  }

  // ---------- Modo gravação ----------
  function setRecording(on) {
    G.autopilot = on;
    UI.state.autopilot = on;
    UI.state.auto = on || UI.state.auto;
    $('#btn-auto').classList.toggle('on', UI.state.auto);
    $('#stage').classList.toggle('rec', on);
    SAVE.prefs({ rec: on });
  }

  // ---------- Fluxo principal ----------
  // tempo de jogo (soma o que já tinha sido jogado antes de carregar o jogo salvo)
  let playedBefore = 0;
  const elapsed = () => playedBefore + (performance.now() - G.startedAt) / 1000;

  async function newGame(saved) {
    G.world = WORLD.newWorld();
    G.scene = 'world';
    G.indoor = null;
    if (saved) {
      Object.assign(G, JSON.parse(JSON.stringify(saved)));
      M.syncUid([...G.party, ...G.pc]);
      playedBefore = saved.elapsed || 0;
      updateHud();
      await say(`Bem-vindo de volta! ${eventLabel(G.route[G.step], G.step)} é a próxima parada.`);
    } else {
      Object.assign(G, { party: [], pc: [], bag: {}, money: 0, badges: 0, stats: {}, step: 0, route: [], seen: [] });
      G.world.follower = false;
      updateHud();
      const starter = await starterScreen();
      Object.assign(G, J.newState(starter, G.mode), { seen: [] });
      G.world.follower = true;
      playedBefore = 0;
      updateHud();
      await say(`Você escolheu ${DEX[G.starter].name}! Você recebeu 5 Poké Bolas e 2 Poções.`);
      await say(`Blue: Então eu fico com o ${DEX[R.RIVAL_STARTER[G.starter]].name}! Te vejo na Liga!`);
      if (!G.autopilot) await say('Dica: toque num Pokémon da barra de baixo (ou em TIME, na batalha) para ver a vida e os golpes dele.');
    }
    G.startedAt = performance.now();
    for (let i = G.step; i < G.route.length; i++) {
      G.step = i;
      SAVE.write(G, elapsed());
      updateHud();
      const ok = await EVENTS.run(G.route[i], i);
      if (!ok) {
        SAVE.clear();
        window.SFX.gameOver();
        await say('Seu time não pode mais lutar...');
        await endScreen(false, i);
        return;
      }
    }
    SAVE.clear();
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
    setupInput();
    const prefs = SAVE.prefs();
    if (prefs.mode) G.mode = prefs.mode;
    if (prefs.muted) { window.AUDIO.set(true); $('#btn-mute').textContent = '♪̸'; $('#btn-mute').classList.add('off'); }
    if (prefs.rec) setRecording(true);
    requestAnimationFrame(frame);
    for (;;) {
      // cenário do título: caminhada infinita
      G.scene = 'world';
      G.world = WORLD.newWorld(); G.world.walking = true; G.world.target = 1e9; G.world.follower = false;
      G.party = []; G.route = [];
      $('#hud').classList.add('hidden');
      $('#party').classList.add('hidden');
      const saved = J.upgradeSave(SAVE.read());
      const how = await titleScreen(saved);
      $('#hud').classList.remove('hidden');
      $('#party').classList.remove('hidden');
      await newGame(how === 'continue' ? saved : null);
    }
  }

  function setupButtons() {
    const sp = $('#btn-speed');
    sp.onclick = () => { if (G.fishing) return; setSpeed(G.speed === 1 ? 2 : G.speed === 2 ? 4 : 1); window.SFX.select(); };
    const auto = $('#btn-auto');
    auto.onclick = () => { UI.state.auto = !UI.state.auto; auto.classList.toggle('on', UI.state.auto); window.SFX.select(); };
    const mute = $('#btn-mute');
    mute.onclick = () => { const m = window.AUDIO.toggle(); SAVE.prefs({ muted: m }); mute.textContent = m ? '♪̸' : '♪'; mute.classList.toggle('off', m); };
  }

  function setSpeed(v) {
    G.speed = v;
    $('#btn-speed').textContent = v + 'x';
  }

  // Segurar (clique/toque na tela ou ESPAÇO) para o minijogo de pesca; ESC sai do modo gravação;
  // 1, 2 e 4 mudam a velocidade (no modo gravação os botões ficam escondidos)
  function setupInput() {
    const press = down => { if (G.fishing) G.fishing.press(down); };
    canvas.addEventListener('pointerdown', e => { if (G.fishing) { e.preventDefault(); press(true); } });
    window.addEventListener('pointerup', () => press(false));
    window.addEventListener('pointercancel', () => press(false));
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape' && G.autopilot) setRecording(false);
      if (['Digit1', 'Digit2', 'Digit4'].includes(e.code) && !G.fishing) setSpeed(+e.code.slice(5));
      if (G.fishing && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyZ')) { e.preventDefault(); if (!e.repeat) press(true); }
    });
    window.addEventListener('keyup', e => { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyZ') press(false); });
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
    if (G.scene === 'world' && G.world && !G.paused) WORLD.update(G.world, dt);
    if (G.fishing && !G.paused) G.fishing.update(dt);
  }

  function render() {
    ctx.setTransform(K, 0, 0, K, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (G.scene === 'battle' && G.battle) G.battle.draw(ctx, G.bg);
    else if (G.scene === 'vs' && G.vs) drawVs();
    else if (G.scene === 'evolve' && G.evo) drawEvolve();
    else if (G.scene === 'indoor' && G.indoor) drawIndoor();
    else if (G.world) {
      WORLD.draw(ctx, G.world, G.party);
      if (G.fishing) { const s = WORLD.fishingSpots(G.world, G.fishing.lake); G.fishing.draw(ctx, s.hand, s.bob); }
    }
    drawBadgeFx();
    drawFx();
  }

  window.GAME = {
    G, wait, say, choose, setSpeed, count, addItem, ballCount, updateHud, walkTo, runBattle, afterBattle, addCaught,
    flashTransition, fade, vsScreen, badgeScene, evolveScene, healParty, visitShop, goInside, goOutside,
  };

  // os eventos (js/events.js) carregam depois deste arquivo; main só começa a rodar quando as imagens carregam
  main().catch(err => {
    console.error(err);
    document.body.insertAdjacentHTML('beforeend', `<pre class="fatal">${esc(err.stack || err)}</pre>`);
  });
})();
