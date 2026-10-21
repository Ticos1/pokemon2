// Batalha automática em tempo real, vista de cima.
// A lógica (update) é separada do desenho (draw) para permitir simulação sem tela.
(function () {
  const { DEX, TYPE_INFO, effectiveness, movesFor, STRUGGLE, ITEMS, PLAYER_POWER, PLAYER_GUARD } = window.RULES;
  const { rand, pick } = window.MON;
  const sfx = name => window.SFX && window.SFX[name] && window.SFX[name]();

  const W = 360;
  const ARENA = { x0: 24, x1: 336, y0: 112, y1: 508 };
  const UNIT_R = 18;
  const S = 1; // escala dos sprites na arena
  const FEET_Y = 22; // altura dos pés em relação ao centro da unidade (sombra)
  const CATCH_HP = .35;

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const t = clamp(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function moveRange(m) {
    switch (m.kind) {
      case 'dash': return 150;
      case 'nova': return m.radius * .8;
      case 'beam': return 300;
      case 'strike': return 250;
      case 'splash': return 999;
      default: return 240;
    }
  }

  class Battle {
    // opts: { party, enemies, mode, kind: 'wild'|'trainer'|'gym'|'champion', theme, title,
    //         hooks: { canCatch(), catchPrompt(unit) -> Promise<ballKey|null>, ballMult(key) } }
    constructor(opts) {
      this.o = opts;
      this.mode = opts.mode || 1;
      this.wild = opts.kind === 'wild';
      this.units = [];
      this.projectiles = [];
      this.effects = [];
      this.texts = [];
      this.particles = [];
      this.timers = [];
      this.t = 0;
      this.shake = 0;
      this.phase = 'intro';
      this.paused = false;
      this.participants = new Set();
      this.defeated = [];
      this.caught = null;
      this.banner = null;
      this.headless = !!opts.headless;
      // clima (js/journey.js WEATHER): chuva e sol mudam o dano de água e fogo; areia e granizo machucam
      this.weather = opts.weather ? window.JOURNEY.WEATHER[opts.weather] : null;
      this.weatherKind = opts.weather || null;
      this.sides = {
        p: { queue: opts.party.filter(m => m.hp > 0), slots: [] },
        e: { queue: opts.enemies.slice(), slots: [] },
      };
      this.enemyTotal = opts.enemies.length;
      this.slots = Math.max(1, Math.min(this.mode, this.sides.p.queue.length));
      this.done = new Promise(res => { this.resolve = res; });
    }

    start() {
      // nunca há mais inimigos em campo do que Pokémon vivos do jogador
      const n = this.slots;
      const eDelay = this.wild ? 0 : .2;
      for (let i = 0; i < n; i++) this.after(eDelay + i * .25, () => this.sendOut('e', i));
      for (let i = 0; i < n; i++) this.after(.9 + i * .25, () => this.sendOut('p', i));
      this.after(1.7, () => { this.phase = 'fight'; });
      return this.done;
    }

    after(delay, fn) { this.timers.push({ t: this.t + delay, fn }); }

    slotPos(side, i) {
      const n = this.slots;
      const x = n === 1 ? W / 2 : (i === 0 ? W / 2 - 70 : W / 2 + 70);
      return { x, y: side === 'e' ? 190 : 430 };
    }

    sendOut(side, slot) {
      const s = this.sides[side];
      const mon = s.queue.shift();
      if (!mon) return;
      const pos = this.slotPos(side, slot);
      const u = {
        mon, side, slot, x: pos.x, y: pos.y, vx: 0, vy: 0, kx: 0, ky: 0,
        state: 'enter', enterT: 0, cds: new Map(), gcd: .6 + Math.random() * .4,
        status: {}, flash: 0, strafe: Math.random() < .5 ? 1 : -1, strafeT: rand(1.5, 3),
        faceRight: side === 'p', bob: Math.random() * 6, alpha: 1, scale: 0, burst: null,
        moves: movesFor(mon),
      };
      for (const m of u.moves) u.cds.set(m, rand(.2, .8) * m.cd);
      s.slots[slot] = u;
      this.units.push(u);
      if (side === 'p') this.participants.add(mon.uid);
      const name = DEX[mon.id].name;
      if (side === 'p') this.say(`Vai, ${name}!`);
      else if (!this.wild) this.say(`${this.o.title || 'O oponente'} enviou ${name}!`);
      else this.say(`Um ${name} selvagem apareceu!`);
      // animação: bola voando até a posição
      if (this.wild && side === 'e') {
        u.enterT = .35;
        this.burstParticles(u.x, u.y + 18, '#58a848', 14, 90);
      } else {
        const from = side === 'p' ? { x: W / 2, y: 600 } : { x: W / 2, y: 40 };
        this.effects.push({ kind: 'ballThrow', from, to: { x: u.x, y: u.y }, t: 0, dur: .45, icon: 0 });
        u.enterT = .45;
      }
      if (mon.shiny) {
        this.after(u.enterT + .2, () => {
          sfx('shiny');
          this.effects.push({ kind: 'sparkle', x: u.x, y: u.y, t: 0, dur: 1.2 });
          this.text(u.x, u.y - 60, '✦ SHINY ✦', '#f8e050', 1.6, 10);
        });
      }
    }

    say(msg, dur = 1.4) { this.banner = { msg, t: dur }; }

    text(x, y, msg, color, dur = .9, size = 8) {
      this.texts.push({ x, y, msg, color, t: 0, dur, size });
    }

    burstParticles(x, y, color, n = 10, speed = 120, life = .5) {
      if (this.headless) return;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = rand(.3, 1) * speed;
        this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, color, t: 0, life: life * rand(.6, 1.2), s: rand(1.5, 3.5) });
      }
    }

    living(side) {
      return this.units.filter(u => u.side === side && (u.state === 'idle' || u.state === 'cast' || u.state === 'dash'));
    }

    // ---------- Atualização ----------
    update(dt) {
      this.t += dt;
      if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
      const due = this.timers.filter(tm => tm.t <= this.t);
      this.timers = this.timers.filter(tm => tm.t > this.t);
      for (const tm of due) tm.fn();

      this.updateFx(dt);
      if (this.paused) return;
      if (this.phase === 'catch') { this.updateCatch(dt); return; }

      for (const u of this.units) this.updateUnit(u, dt);
      this.updateProjectiles(dt);
      this.units = this.units.filter(u => !u.removed);
      if (this.phase === 'fight') this.checkEnd();
    }

    updateFx(dt) {
      this.shake = Math.max(0, this.shake - dt * 30);
      for (const p of this.particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .92; p.vy *= .92; }
      this.particles = this.particles.filter(p => p.t < p.life);
      for (const tx of this.texts) tx.t += dt;
      for (const u of this.units) if (u.callout && (u.callout.t += dt) >= u.callout.dur) u.callout = null;
      this.texts = this.texts.filter(tx => tx.t < tx.dur);
      for (const e of this.effects) {
        e.t += dt;
        if (e.update) e.update(dt);
      }
      this.effects = this.effects.filter(e => e.t < e.dur);
    }

    updateUnit(u, dt) {
      u.flash = Math.max(0, u.flash - dt * 4);
      u.bob += dt;
      if (u.state === 'enter') {
        u.enterT -= dt;
        if (u.enterT <= 0) {
          u.scale = Math.min(1, u.scale + dt * 5);
          if (u.scale === 1 && u.enterT < -.2) u.state = 'idle';
          if (u.scale > 0 && !u.popped) { u.popped = true; if (!(this.wild && u.side === 'e')) { sfx('pop'); this.burstParticles(u.x, u.y, '#ffffff', 12, 140); } }
        }
        return;
      }
      if (u.state === 'faint') {
        u.faintT += dt;
        u.alpha = Math.max(0, 1 - u.faintT / .8);
        if (u.faintT > .9) { u.removed = true; this.onRemoved(u); }
        return;
      }
      if (u.state === 'caught' || u.state === 'absorbed') return;
      if (this.phase !== 'fight') return;

      // status
      const st = u.status;
      for (const k in st) st[k] -= dt;
      if (st.burn > 0 || st.poison > 0) {
        u.dot = (u.dot || 0) + dt;
        if (u.dot >= 1) {
          u.dot = 0;
          const d = Math.max(1, Math.floor(u.mon.maxhp / (st.poison > 0 ? 14 : 16)));
          this.applyDamage(u, d, null);
          this.text(u.x, u.y - 44, '-' + d, st.poison > 0 ? '#c060e0' : '#f08030');
        }
      }
      // areia e granizo: dano a cada 2 s em quem não é do tipo que aguenta
      if (this.weather && this.weather.chip && !DEX[u.mon.id].types.some(t => this.weather.chip.includes(t))) {
        u.wchip = (u.wchip || 0) + dt;
        if (u.wchip >= 2) {
          u.wchip = 0;
          const d = Math.max(1, Math.floor(u.mon.maxhp / 16));
          this.applyDamage(u, d, null);
          this.text(u.x, u.y - 44, '-' + d, '#e0c890');
        }
      }
      if (u.state === 'faint') return;

      // knockback
      if (u.kx || u.ky) {
        u.x += u.kx * dt; u.y += u.ky * dt;
        u.kx *= Math.pow(.02, dt); u.ky *= Math.pow(.02, dt);
        if (Math.abs(u.kx) + Math.abs(u.ky) < 5) { u.kx = 0; u.ky = 0; }
        this.clampArena(u);
      }

      if (st.para > 0) return; // paralisado: não age

      const slow = st.slow > 0 ? .5 : 1;
      for (const [m, cd] of u.cds) u.cds.set(m, cd - dt * slow);
      u.gcd -= dt * slow;

      const foes = this.living(u.side === 'p' ? 'e' : 'p');
      if (!foes.length) { u.vx = u.vy = 0; if (u.state !== 'dash') u.state = 'idle'; return; }
      let target = u.target && foes.includes(u.target) ? u.target : null;
      if (!target || Math.random() < dt * .3) {
        target = foes.reduce((a, b) => (dist(u, a) <= dist(u, b) ? a : b));
      }
      u.target = target;

      if (u.state === 'dash') { this.updateDash(u, dt); return; }
      if (u.state === 'cast') {
        u.castT -= dt;
        if (u.burst) {
          u.burst.t -= dt;
          if (u.burst.t <= 0 && u.burst.n > 0) {
            u.burst.n--; u.burst.t = u.burst.m.gap;
            this.fireProjectile(u, u.burst.m, this.aim(u, target, u.burst.m.speed) + rand(-1, 1) * (u.burst.m.jitter || 0));
          }
          if (u.burst.n <= 0) { u.burst = null; u.state = 'idle'; }
          return;
        }
        if (u.castT <= 0) this.execute(u, u.castMove, target);
        return;
      }

      // escolher golpe
      const d = dist(u, target);
      const ready = u.gcd <= 0 ? this.bestMove(u, target) : null;
      if (ready && d <= moveRange(ready)) {
        this.beginCast(u, ready, target);
        return;
      }

      // movimentação: aproxima/afasta + circula o alvo
      const meleeStyle = u.mon.atk >= u.mon.spa * 1.05;
      let want = ready ? moveRange(ready) * .75 : (meleeStyle ? 70 : 150);
      want = Math.max(want, 46);
      const ang = Math.atan2(target.y - u.y, target.x - u.x);
      const radial = clamp((d - want) / 40, -1, 1);
      u.strafeT -= dt;
      if (u.strafeT <= 0) { u.strafe *= -1; u.strafeT = rand(1.2, 3); }
      let mx = Math.cos(ang) * radial + Math.cos(ang + Math.PI / 2) * u.strafe * .7;
      let my = Math.sin(ang) * radial + Math.sin(ang + Math.PI / 2) * u.strafe * .7;
      for (const o of this.units) {
        if (o === u || o.state === 'faint') continue;
        const od = dist(u, o);
        if (od < 44 && od > 0) { mx += (u.x - o.x) / od * 1.2; my += (u.y - o.y) / od * 1.2; }
      }
      // evita bordas
      if (u.x < ARENA.x0 + 30) mx += 1; if (u.x > ARENA.x1 - 30) mx -= 1;
      if (u.y < ARENA.y0 + 30) my += 1; if (u.y > ARENA.y1 - 30) my -= 1;
      const len = Math.hypot(mx, my) || 1;
      const speed = (48 + u.mon.spe * .55 + DEX[u.mon.id].spe * .4) * slow;
      u.vx = mx / len * speed; u.vy = my / len * speed;
      u.x += u.vx * dt; u.y += u.vy * dt;
      if (Math.abs(u.vx) > 4) u.faceRight = u.vx > 0;
      this.clampArena(u);
      u.state = 'idle';
    }

    clampArena(u) {
      u.x = clamp(u.x, ARENA.x0 + UNIT_R, ARENA.x1 - UNIT_R);
      u.y = clamp(u.y, ARENA.y0 + UNIT_R, ARENA.y1 - UNIT_R);
    }

    stab(u, m) { return DEX[u.mon.id].types.includes(m.type) ? 1.5 : 1; }

    bestMove(u, target) {
      let best = null, bestScore = 0, anyUseful = false, topScore = 0;
      const defTypes = DEX[target.mon.id].types;
      const scores = new Map();
      for (const m of u.moves) {
        if (m.kind === 'splash') continue;
        const eff = effectiveness(m.type, defTypes);
        if (eff > 0) anyUseful = true;
        const atk = m.kind === 'dash' ? u.mon.atk : u.mon.spa;
        const hits = (m.count || 1) * (m.burst || 1);
        // dano esperado por segundo de recarga
        const score = m.pow * hits * eff * this.stab(u, m) * atk / Math.sqrt(m.cd);
        scores.set(m, score);
        topScore = Math.max(topScore, score);
      }
      for (const m of u.moves) {
        if (m.kind === 'splash') { if (u.cds.get(m) <= 0 && !best) best = m; continue; }
        const score = scores.get(m);
        // ignora golpes muito piores que o melhor: espera ele recarregar
        if (u.cds.get(m) > 0 || score <= 0 || score < topScore * .45) continue;
        const sc = score + Math.random() * 5;
        if (sc > bestScore) { bestScore = sc; best = m; }
      }
      if (!anyUseful && !u.moves.some(m => m.kind === 'splash')) {
        if (!u.cds.has(STRUGGLE)) u.cds.set(STRUGGLE, 0);
        return u.cds.get(STRUGGLE) <= 0 ? STRUGGLE : null;
      }
      return best;
    }

    beginCast(u, m, target) {
      u.state = 'cast';
      u.castMove = m;
      u.castT = m.charge || .18;
      u.vx = u.vy = 0;
      u.faceRight = target.x > u.x;
      u.cds.set(m, m.cd * (1.15 - Math.min(.4, u.mon.spe / 400)));
      u.gcd = .55;
      if (m.charge) this.effects.push({ kind: 'charge', u, color: this.color(m), t: 0, dur: m.charge });
      // nome do golpe em cima de quem usou (acompanha o Pokémon)
      u.callout = { msg: m.name, color: this.color(m), t: 0, dur: Math.max(1.1, (m.charge || 0) + .7) };
    }

    color(m) { return m.type ? TYPE_INFO[m.type].color : '#d8d8d8'; }

    // mira prevendo o movimento do alvo
    aim(u, target, speed) {
      const t = speed ? dist(u, target) / speed : 0;
      return Math.atan2(target.y + target.vy * t * .8 - u.y, target.x + target.vx * t * .8 - u.x);
    }

    execute(u, m, target) {
      const ang = m.kind === 'proj' ? this.aim(u, target, m.speed) : Math.atan2(target.y - u.y, target.x - u.x);
      switch (m.kind) {
        case 'proj': {
          if (m.burst) {
            u.burst = { m, n: m.burst, t: 0 };
            return;
          }
          const n = m.count || 1;
          for (let i = 0; i < n; i++) this.fireProjectile(u, m, ang + (i - (n - 1) / 2) * (m.spread || 0));
          break;
        }
        case 'beam': {
          sfx('beam');
          const len = 420;
          const x2 = u.x + Math.cos(ang) * len, y2 = u.y + Math.sin(ang) * len;
          for (const f of this.living(u.side === 'p' ? 'e' : 'p')) {
            if (distToSegment(f.x, f.y, u.x, u.y, x2, y2) < m.width / 2 + UNIT_R) this.hit(u, f, m, ang);
          }
          this.effects.push({ kind: 'beam', x1: u.x, y1: u.y, x2, y2, w: m.width, color: this.color(m), t: 0, dur: .4 });
          this.shake = Math.max(this.shake, 4);
          break;
        }
        case 'dash': {
          u.state = 'dash';
          u.dashAng = ang;
          u.dashT = Math.min(.45, dist(u, target) / 420 + .08);
          u.dashHit = false;
          u.dashMove = m;
          sfx('shoot');
          return;
        }
        case 'strike': {
          const n = m.count || 1;
          for (let i = 0; i < n; i++) {
            const sc = m.scatter || 0;
            const p = { x: target.x + (i ? rand(-sc, sc) : 0), y: target.y + (i ? rand(-sc, sc) : 0) };
            this.effects.push({ kind: 'warn', x: p.x, y: p.y, r: m.radius, color: this.color(m), type: m.type, t: 0, dur: m.delay + i * .12 });
            this.after(m.delay + i * .12, () => {
              if (u.state === 'faint' || u.removed) return;
              for (const f of this.living(u.side === 'p' ? 'e' : 'p')) {
                if (Math.hypot(f.x - p.x, f.y - p.y) < m.radius + UNIT_R * .6) this.hit(u, f, m, Math.atan2(f.y - p.y, f.x - p.x));
              }
              this.effects.push({ kind: 'impact', x: p.x, y: p.y, r: m.radius, color: this.color(m), type: m.type, t: 0, dur: .45 });
              this.burstParticles(p.x, p.y, this.color(m), 14, 150);
              this.shake = Math.max(this.shake, 5);
              sfx('boom');
            });
          }
          break;
        }
        case 'nova': {
          sfx('boom');
          this.effects.push({ kind: 'nova', x: u.x, y: u.y, r: m.radius, color: this.color(m), type: m.type, t: 0, dur: .5 });
          this.shake = Math.max(this.shake, 9);
          this.after(.12, () => {
            for (const f of this.living(u.side === 'p' ? 'e' : 'p')) {
              if (dist(u, f) < m.radius + UNIT_R) this.hit(u, f, m, Math.atan2(f.y - u.y, f.x - u.x));
            }
          });
          break;
        }
        case 'splash': {
          u.jump = .6;
          this.after(.5, () => this.text(u.x, u.y - 44, 'Mas nada aconteceu!', '#d0d0d0', 1.2));
          break;
        }
      }
      u.state = 'idle';
    }

    fireProjectile(u, m, ang) {
      sfx('shoot');
      this.projectiles.push({
        x: u.x + Math.cos(ang) * 16, y: u.y + Math.sin(ang) * 16,
        ang, speed: m.speed, r: m.r, m, owner: u, t: 0, ttl: 2.4, hit: false,
        target: u.target,
      });
    }

    updateProjectiles(dt) {
      for (const p of this.projectiles) {
        p.t += dt;
        const homing = p.m.homing || 1.2;
        if (p.target && !p.target.removed && p.target.state !== 'faint') {
          const want = Math.atan2(p.target.y - p.y, p.target.x - p.x);
          let diff = want - p.ang;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          p.ang += clamp(diff, -homing * dt, homing * dt);
        }
        let vx = Math.cos(p.ang) * p.speed, vy = Math.sin(p.ang) * p.speed;
        if (p.m.zigzag) {
          const z = Math.sign(Math.sin(p.t * 40)) * 160;
          vx += Math.cos(p.ang + Math.PI / 2) * z; vy += Math.sin(p.ang + Math.PI / 2) * z;
        }
        p.x += vx * dt; p.y += vy * dt;
        if (!this.headless && Math.random() < .6) {
          this.particles.push({ x: p.x, y: p.y, vx: rand(-15, 15), vy: rand(-15, 15), color: this.color(p.m), t: 0, life: .25, s: Math.max(1.5, p.r * .5) });
        }
        if (p.x < ARENA.x0 - 20 || p.x > ARENA.x1 + 20 || p.y < ARENA.y0 - 20 || p.y > ARENA.y1 + 20 || p.t > p.ttl) { p.hit = true; continue; }
        for (const f of this.living(p.owner.side === 'p' ? 'e' : 'p')) {
          if (Math.hypot(f.x - p.x, f.y - p.y) < UNIT_R + p.r) {
            this.hit(p.owner, f, p.m, p.ang);
            this.burstParticles(p.x, p.y, this.color(p.m), 8, 100);
            p.hit = true;
            break;
          }
        }
      }
      this.projectiles = this.projectiles.filter(p => !p.hit);
    }

    updateDash(u, dt) {
      u.dashT -= dt;
      const sp = 420;
      u.x += Math.cos(u.dashAng) * sp * dt; u.y += Math.sin(u.dashAng) * sp * dt;
      u.faceRight = Math.cos(u.dashAng) > 0;
      this.clampArena(u);
      if (!this.headless && Math.random() < .5) this.effects.push({ kind: 'ghost', u, x: u.x, y: u.y, t: 0, dur: .2 });
      if (!u.dashHit) {
        for (const f of this.living(u.side === 'p' ? 'e' : 'p')) {
          if (dist(u, f) < UNIT_R * 2) {
            u.dashHit = true;
            this.hit(u, f, u.dashMove, u.dashAng);
            this.effects.push({ kind: 'star', x: (u.x + f.x) / 2, y: (u.y + f.y) / 2, color: this.color(u.dashMove), t: 0, dur: .25 });
            u.kx = -Math.cos(u.dashAng) * 120; u.ky = -Math.sin(u.dashAng) * 120;
            u.dashT = 0;
            break;
          }
        }
      }
      if (u.dashT <= 0) u.state = 'idle';
    }

    // ---------- Dano ----------
    hit(att, def, m, ang) {
      if (def.state === 'faint' || def.removed || def.state === 'enter') return;
      const a = att.mon, d = def.mon;
      const phys = m.phys ?? m.kind === 'dash';
      const A = phys ? a.atk : a.spa, D = phys ? d.def : d.spd;
      const eff = effectiveness(m.type, DEX[d.id].types);
      const crit = Math.random() < .0625 + (m.crit || 0) ? 1.5 : 1;
      const base = ((2 * a.lvl / 5 + 2) * m.pow * A / D) / 50 + 2;
      const bonus = att.side === 'p' ? PLAYER_POWER : PLAYER_GUARD;
      const w = this.weather;
      const wmul = w && w.boost ? (m.type === w.boost ? 1.5 : m.type === w.weak ? .5 : 1) : 1;
      let dmg = Math.floor(base * this.stab(att, m) * eff * crit * bonus * wmul * rand(.85, 1));
      if (eff > 0) dmg = Math.max(1, dmg);

      const tx = def.x, ty = def.y - 40;
      if (eff === 0) {
        this.text(tx, ty, 'NÃO AFETA', '#b0b0b0');
        return;
      }
      this.applyDamage(def, dmg, att);
      def.flash = 1;
      const kb = m.knock || (phys ? 70 : 30);
      def.kx += Math.cos(ang) * kb; def.ky += Math.sin(ang) * kb;
      this.text(tx + rand(-8, 8), ty, String(dmg), eff > 1 ? '#f8e050' : '#ffffff', .8, eff > 1 ? 12 : 8);
      if (eff > 1) { this.text(tx, ty - 14, 'SUPER EFETIVO!', '#f8a030', 1.1); sfx('superHit'); this.shake = Math.max(this.shake, 6); }
      else if (eff < 1) { this.text(tx, ty - 14, 'pouco efetivo', '#b0b0b0', .9); sfx('weakHit'); }
      else sfx('hit');
      if (crit > 1) { this.text(tx, ty - 26, 'CRÍTICO!', '#f85050', 1); this.shake = Math.max(this.shake, 5); }
      // Absorver, Mega Dreno...: recupera parte do dano. Desmantelar, Ataque Arriscado...: se machuca
      if (m.drain && att.state !== 'faint' && a.hp > 0) {
        const heal = Math.min(a.maxhp - a.hp, Math.max(1, Math.floor(dmg * m.drain)));
        if (heal > 0) { a.hp += heal; this.text(att.x, att.y - 44, '+' + heal, '#78e878'); }
      }
      if (m.recoil && att.state !== 'faint' && a.hp > 0) {
        const r = Math.max(1, Math.floor(dmg * m.recoil));
        this.applyDamage(att, r, def);
        this.text(att.x, att.y - 44, '-' + r, '#f0a0a0');
      }

      if (def.state !== 'faint' && def.mon.hp > 0) {
        const st = def.status;
        const roll = p => p && Math.random() < p;
        if (roll(m.burn) && !DEX[d.id].types.includes('fire')) { st.burn = 4; this.text(tx, ty + 12, 'queimou!', '#f08030'); }
        if (roll(m.poison) && !DEX[d.id].types.includes('poison')) { st.poison = 5; this.text(tx, ty + 12, 'envenenou!', '#c060e0'); }
        if (roll(m.para) && !DEX[d.id].types.includes('electric')) { st.para = .9; this.text(tx, ty + 12, 'paralisou!', '#f8d030'); }
        if (m.slow) st.slow = m.slow;
      }
    }

    applyDamage(def, dmg, att) {
      const mon = def.mon;
      const catchable = this.wild && def.side === 'e' && !def.declined && this.o.hooks && this.o.hooks.canCatch();
      mon.hp -= dmg;
      if (catchable && mon.hp <= 0) mon.hp = 1; // a primeira vez sempre dá chance de capturar
      if (mon.hp <= 0) {
        mon.hp = 0;
        this.faint(def);
        return;
      }
      if (catchable && mon.hp / mon.maxhp <= CATCH_HP && this.phase === 'fight' && !this.paused) {
        this.promptCatch(def);
      }
    }

    faint(u) {
      if (u.state === 'faint') return;
      u.state = 'faint';
      u.faintT = 0;
      sfx('faint');
      this.text(u.x, u.y - 54, DEX[u.mon.id].name + ' desmaiou!', '#ffffff', 1.2);
      if (u.side === 'e') this.defeated.push(u.mon);
    }

    onRemoved(u) {
      const s = this.sides[u.side];
      s.slots[u.slot] = null;
      if (s.queue.length) this.after(.5, () => this.sendOut(u.side, u.slot));
    }

    checkEnd() {
      if (this.ending) return;
      for (const side of ['p', 'e']) {
        const s = this.sides[side];
        const onField = this.units.some(u => u.side === side && !u.removed && u.state !== 'faint' && u.state !== 'caught');
        if (!onField && !s.queue.length) {
          this.ending = true;
          const won = side === 'e';
          this.phase = 'end';
          if (won) { this.say(this.caught ? 'Capturado!' : 'VITÓRIA!', 3); }
          else this.say('Você perdeu...', 3);
          this.after(1.4, () => this.resolve({
            won, participants: this.participants, defeated: this.defeated, caught: this.caught,
          }));
          return;
        }
      }
    }

    // ---------- Captura ----------
    async promptCatch(u) {
      this.paused = true;
      const ball = await this.o.hooks.catchPrompt(u);
      this.paused = false;
      if (!ball) { u.declined = true; return; }
      this.startCatch(u, ball);
    }

    startCatch(u, ballKey) {
      const mon = u.mon;
      const rate = DEX[mon.id].catch;
      const M = mon.maxhp, H = Math.max(1, mon.hp);
      const a = clamp(((3 * M - 2 * H) * rate * ITEMS[ballKey].ball) / (3 * M), 1, 255);
      const p = Math.pow(a / 255, .25);
      let shakes = 0;
      while (shakes < 4 && Math.random() < p) shakes++;
      const caught = shakes >= 4;
      this.phase = 'catch';
      this.projectiles = [];
      this.catchAnim = { u, ballKey, icon: ITEMS[ballKey].icon, t: 0, shakes: Math.min(3, shakes), caught, stage: 'throw', from: { x: W / 2, y: 600 } };
      sfx('throw');
    }

    updateCatch(dt) {
      const c = this.catchAnim;
      c.t += dt;
      const u = c.u;
      const tShake = .8;
      if (c.stage === 'throw' && c.t >= .6) {
        c.stage = 'absorb'; sfx('pop'); u.state = 'absorbed'; u.absorb = 0;
        this.burstParticles(u.x, u.y, '#ffffff', 16, 120);
      }
      if (c.stage === 'absorb') {
        u.absorb = Math.min(1, (c.t - .6) / .35);
        if (c.t >= 1.1) { c.stage = 'shake'; c.k = 0; }
      }
      if (c.stage === 'shake') {
        const k = Math.floor((c.t - 1.1) / tShake);
        if (k > c.k - 1 && k < c.shakes && k >= c.k) { c.k = k + 1; sfx('shake'); }
        const end = 1.1 + c.shakes * tShake + .3;
        if (c.t >= end) {
          if (c.caught) {
            c.stage = 'caught'; c.doneT = c.t;
            sfx('caught');
            this.effects.push({ kind: 'sparkle', x: u.x, y: u.y + 10, t: 0, dur: 1 });
            this.say(`${DEX[u.mon.id].name} foi capturado!`, 2);
          } else {
            c.stage = 'escape'; c.doneT = c.t;
            sfx('escape'); sfx('pop');
            this.burstParticles(u.x, u.y, '#ffffff', 16, 140);
            u.state = 'idle'; u.absorb = 0;
            u.declined = false;
            this.say(['Ah, não! Escapou!', 'Quase! Escapou!', 'Droga! Estava quase!'][Math.min(2, c.shakes)], 1.5);
          }
        }
      }
      if (c.stage === 'caught' && c.t - c.doneT > 1.4) {
        u.state = 'caught'; u.removed = true;
        this.units = this.units.filter(x => x !== u);
        this.caught = u.mon;
        this.catchAnim = null;
        this.phase = 'fight';
        this.sides.e.slots[u.slot] = null;
        if (this.sides.e.queue.length) this.after(.5, () => this.sendOut('e', u.slot));
        this.checkEnd();
      }
      if (c.stage === 'escape' && c.t - c.doneT > .5) {
        this.catchAnim = null;
        // a próxima chance vem quando ele levar mais dano
        this.phase = 'fight';
      }
    }

    // ---------- Desenho ----------
    draw(ctx, bg) {
      ctx.save();
      if (this.shake > 0) ctx.translate(rand(-1, 1) * this.shake, rand(-1, 1) * this.shake);
      ctx.drawImage(bg, 0, 0, 360, 640);

      // efeitos no chão
      for (const e of this.effects) if (e.kind === 'warn' || e.kind === 'nova') this.drawEffect(ctx, e);

      // unidades ordenadas por y
      const sorted = this.units.slice().sort((a, b) => a.y - b.y);
      for (const e of this.effects) if (e.kind === 'ghost') this.drawEffect(ctx, e);
      for (const u of sorted) this.drawUnit(ctx, u);
      for (const p of this.projectiles) this.drawProjectile(ctx, p);
      for (const e of this.effects) if (e.kind !== 'warn' && e.kind !== 'nova' && e.kind !== 'ghost') this.drawEffect(ctx, e);
      for (const p of this.particles) {
        ctx.globalAlpha = 1 - p.t / p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x - p.s / 2), Math.round(p.y - p.s / 2), Math.ceil(p.s), Math.ceil(p.s));
      }
      ctx.globalAlpha = 1;
      if (this.catchAnim) this.drawCatch(ctx);
      for (const u of sorted) this.drawUnitBar(ctx, u);
      for (const u of sorted) this.drawCallout(ctx, u);
      for (const tx of this.texts) {
        const k = tx.t / tx.dur;
        ctx.globalAlpha = k > .7 ? (1 - k) / .3 : 1;
        UI.text(ctx, tx.msg, tx.x, tx.y - k * 16, { size: tx.size, color: tx.color, align: 'center', outline: true });
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      if (this.weatherKind) ART.drawWeather(ctx, this.weatherKind, this.t);
      this.drawHud(ctx);
      if (this.banner) {
        const msg = this.banner.msg;
        ctx.fillStyle = 'rgba(24,24,40,.78)';
        ctx.fillRect(0, 296, 360, 26);
        UI.text(ctx, msg, 180, 313, { size: 8, color: '#ffffff', align: 'center' });
      }
    }

    drawUnit(ctx, u) {
      const back = u.side === 'p';
      const moving = Math.hypot(u.vx, u.vy) > 5 && u.state === 'idle';
      let yOff = moving ? -Math.abs(Math.sin(u.bob * 12)) * 4 : Math.sin(u.bob * 2) * 1;
      if (u.jump > 0) { u.jump -= 1 / 60; yOff -= Math.sin((1 - u.jump / .6) * Math.PI) * 30; }
      let scale = u.state === 'enter' ? u.scale : 1;
      if (u.state === 'absorbed') scale = 1 - u.absorb;
      if (scale <= 0) return;
      // sombra
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.beginPath();
      ctx.ellipse(u.x, u.y + 20, 18 * scale, 6 * scale, 0, 0, 7);
      ctx.fill();
      const flip = back ? !u.faceRight : u.faceRight;
      let tint = null;
      if (u.state === 'absorbed') tint = '#ffffff';
      const st = u.status;
      let shakeX = st.para > 0 ? rand(-2, 2) : 0;
      // pés apoiados na sombra
      ART.drawMon(ctx, u.mon.id, u.mon.shiny, back, u.x + shakeX, u.y + FEET_Y + yOff - (u.state === 'faint' ? -u.faintT * 30 : 0), {
        feet: true, flip, scale: scale * S, alpha: u.alpha, tint, flash: u.flash > 0 ? (Math.floor(u.flash * 10) % 2 ? .9 : 0) : 0,
      });
      if (u.state === 'cast' && u.castMove && u.castMove.charge) {
        // brilho ao carregar
      }
      // ícones de status
      const icons = [];
      if (st.burn > 0) icons.push('#f08030');
      if (st.poison > 0) icons.push('#a040a0');
      if (st.para > 0) icons.push('#f8d030');
      if (st.slow > 0) icons.push('#98d8d8');
      icons.forEach((c, i) => { ctx.fillStyle = '#282828'; ctx.fillRect(u.x + 18 + i * 7, u.y - 38, 6, 6); ctx.fillStyle = c; ctx.fillRect(u.x + 19 + i * 7, u.y - 37, 4, 4); });
    }

    drawUnitBar(ctx, u) {
      if (u.state === 'enter' || u.state === 'faint' || u.state === 'absorbed' || u.state === 'caught') return;
      const w = 32, x = Math.round(u.x - w / 2), y = Math.round(u.y - 36);
      const k = u.mon.hp / u.mon.maxhp;
      ctx.fillStyle = '#282828'; ctx.fillRect(x - 1, y - 1, w + 2, 5);
      ctx.fillStyle = '#505050'; ctx.fillRect(x, y, w, 3);
      ctx.fillStyle = k > .5 ? '#58d070' : k > .2 ? '#f8c830' : '#f05050';
      ctx.fillRect(x, y, Math.ceil(w * k), 3);
      ctx.fillStyle = u.side === 'p' ? '#58a8f8' : '#f86060';
      ctx.fillRect(x - 4, y - 1, 3, 5);
    }

    // Nome do golpe numa plaquinha com a cor do tipo, em cima da barra de vida
    drawCallout(ctx, u) {
      const c = u.callout;
      if (!c || u.state === 'faint' || u.state === 'absorbed' || u.state === 'caught') return;
      const k = c.t / c.dur;
      const pop = Math.min(1, c.t / .12);
      ctx.globalAlpha = k > .8 ? (1 - k) / .2 : 1;
      ctx.font = `8px ${UI.FONT}`;
      const w = Math.ceil(ctx.measureText(c.msg).width) + 10, h = 13;
      const x = Math.round(clamp(u.x - w / 2, 2, W - w - 2)), y = Math.round(u.y - 54 - (1 - pop) * 6);
      ctx.fillStyle = '#202030';
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = c.color;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.fillRect(x, y + h - 2, w, 2);
      UI.text(ctx, c.msg, x + w / 2, y + 10, { size: 8, color: '#ffffff', align: 'center', outline: true });
      ctx.globalAlpha = 1;
    }

    drawProjectile(ctx, p) {
      const c = this.color(p.m), t = p.m.type;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.ang);
      if (t === 'grass') {
        ctx.rotate(p.t * 20);
        ctx.fillStyle = '#58b838'; ctx.beginPath(); ctx.ellipse(0, 0, 7, 3, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#a8e870'; ctx.fillRect(-4, -1, 8, 1);
      } else if (t === 'bug' || t === 'poison' && p.m.r < 5) {
        ctx.fillStyle = t === 'bug' ? '#f8f8f8' : '#c060e0';
        ctx.fillRect(-6, -1, 12, 2);
        ctx.fillStyle = '#282828'; ctx.fillRect(4, -1, 2, 2);
      } else if (t === 'flying') {
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(-4, 0, p.r, -1.1, 1.1); ctx.stroke();
        ctx.beginPath(); ctx.arc(-10, 0, p.r * .7, -1, 1); ctx.stroke();
      } else if (t === 'electric') {
        ctx.strokeStyle = '#f8f070'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-3, -4); ctx.lineTo(1, 3); ctx.lineTo(6, -2); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-2, -2, 4, 4);
      } else if (t === 'ice') {
        ctx.fillStyle = '#c8f0f8'; ctx.beginPath(); ctx.moveTo(p.r, 0); ctx.lineTo(0, p.r * .7); ctx.lineTo(-p.r, 0); ctx.lineTo(0, -p.r * .7); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-2, -1, 4, 2);
      } else {
        const pulse = 1 + Math.sin(p.t * 30) * .12;
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(0, 0, p.r * pulse, 0, 7); ctx.fill();
        ctx.fillStyle = t === 'ghost' || t === 'dark' ? '#281838' : 'rgba(255,255,255,.75)';
        ctx.beginPath(); ctx.arc(0, 0, p.r * .45, 0, 7); ctx.fill();
        if (t === 'water') { ctx.fillStyle = '#ffffff'; ctx.fillRect(-p.r * .4, -p.r * .5, 2, 2); }
      }
      ctx.restore();
    }

    drawEffect(ctx, e) {
      const k = e.t / e.dur;
      ctx.save();
      switch (e.kind) {
        case 'ballThrow': {
          const x = e.from.x + (e.to.x - e.from.x) * k;
          const y = e.from.y + (e.to.y - e.from.y) * k - Math.sin(k * Math.PI) * 80;
          ART.drawItem(ctx, e.icon, x, y, .8, k * 12);
          break;
        }
        case 'charge': {
          if (e.u.removed || e.u.state === 'faint') break;
          ctx.globalAlpha = .35 + k * .4;
          ctx.fillStyle = e.color;
          const r = 8 + k * 20 + Math.sin(e.t * 40) * 2;
          ctx.beginPath(); ctx.arc(e.u.x, e.u.y, r, 0, 7); ctx.fill();
          ctx.globalAlpha = .8;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(e.u.x, e.u.y, r * .35, 0, 7); ctx.fill();
          break;
        }
        case 'beam': {
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = e.color; ctx.lineCap = 'round';
          ctx.lineWidth = e.w * (1 - k * .5);
          ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = e.w * .35 * (1 - k);
          ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
          break;
        }
        case 'warn': {
          const blink = Math.floor(e.t * 12) % 2;
          ctx.globalAlpha = .55;
          ctx.strokeStyle = blink ? '#ffffff' : e.color; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(e.x, e.y + 8, e.r, 0, 7); ctx.stroke();
          ctx.fillStyle = e.color; ctx.globalAlpha = .18 + k * .25;
          ctx.beginPath(); ctx.arc(e.x, e.y + 8, e.r * k, 0, 7); ctx.fill();
          if (e.type === 'rock') {
            ctx.globalAlpha = 1;
            const fy = e.y - 260 * (1 - k);
            ctx.fillStyle = '#806838'; ctx.fillRect(e.x - 8, fy - 8, 16, 14);
            ctx.fillStyle = '#b8a060'; ctx.fillRect(e.x - 6, fy - 6, 8, 5);
          }
          break;
        }
        case 'impact': {
          ctx.globalAlpha = 1 - k;
          if (e.type === 'electric') {
            ctx.strokeStyle = '#fff8a0'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(e.x + 10, 0);
            let yy = 0, xx = e.x + 10;
            while (yy < e.y) { yy += 40; xx = e.x + rand(-16, 16); ctx.lineTo(xx, Math.min(yy, e.y)); }
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,200,' + (.4 * (1 - k)) + ')'; ctx.fillRect(0, 0, 360, 640);
          }
          ctx.fillStyle = e.color;
          ctx.beginPath(); ctx.arc(e.x, e.y + 6, e.r * (.6 + k * .6), 0, 7); ctx.fill();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(e.x, e.y + 6, e.r * (.8 + k), 0, 7); ctx.stroke();
          break;
        }
        case 'nova': {
          ctx.globalAlpha = (1 - k) * .8;
          ctx.strokeStyle = e.color; ctx.lineWidth = 8 * (1 - k) + 2;
          ctx.beginPath(); ctx.arc(e.x, e.y + 10, e.r * k, 0, 7); ctx.stroke();
          ctx.fillStyle = e.color; ctx.globalAlpha = (1 - k) * .25;
          ctx.beginPath(); ctx.arc(e.x, e.y + 10, e.r * k, 0, 7); ctx.fill();
          if (e.type === 'ground') {
            ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#604020'; ctx.lineWidth = 2;
            for (let i = 0; i < 6; i++) {
              const a = i * 1.05 + .3;
              ctx.beginPath(); ctx.moveTo(e.x, e.y + 10);
              ctx.lineTo(e.x + Math.cos(a) * e.r * .5, e.y + 10 + Math.sin(a) * e.r * .3);
              ctx.lineTo(e.x + Math.cos(a + .2) * e.r * .9, e.y + 10 + Math.sin(a + .2) * e.r * .55);
              ctx.stroke();
            }
          }
          break;
        }
        case 'star': {
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = '#ffffff';
          ctx.translate(e.x, e.y); ctx.rotate(k * 2);
          const r = 10 + k * 10;
          ctx.beginPath();
          for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * .35 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
          ctx.fill();
          ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(0, 0, r * .3, 0, 7); ctx.fill();
          break;
        }
        case 'ghost': {
          if (e.u.removed) break;
          ART.drawMon(ctx, e.u.mon.id, e.u.mon.shiny, e.u.side === 'p', e.x, e.y + FEET_Y, { feet: true, scale: S, alpha: .3 * (1 - k), tint: '#ffffff', flip: e.u.side === 'p' ? !e.u.faceRight : e.u.faceRight });
          break;
        }
        case 'sparkle': {
          for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4 + e.t * 2, r = 14 + k * 30;
            ctx.globalAlpha = 1 - k;
            ctx.fillStyle = i % 2 ? '#f8e050' : '#ffffff';
            const sx = e.x + Math.cos(a) * r, sy = e.y + Math.sin(a) * r;
            ctx.fillRect(sx - 1, sy - 4, 2, 8); ctx.fillRect(sx - 4, sy - 1, 8, 2);
          }
          break;
        }
      }
      ctx.restore();
    }

    drawCatch(ctx) {
      const c = this.catchAnim, u = c.u;
      let x = u.x, y = u.y, rot = 0;
      if (c.stage === 'throw') {
        const k = Math.min(1, c.t / .6);
        x = c.from.x + (u.x - c.from.x) * k;
        y = c.from.y + (u.y - c.from.y) * k - Math.sin(k * Math.PI) * 120;
        rot = k * 14;
      } else if (c.stage === 'absorb') {
        y = u.y - 10;
        ctx.globalAlpha = .6;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(u.x, u.y, 30 * (1 - u.absorb), 0, 7); ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        const fall = Math.min(1, (c.t - 1.1) / .2);
        y = u.y - 10 + 22 * fall;
        if (c.stage === 'shake') {
          const local = ((c.t - 1.1) % .8);
          const k = Math.floor((c.t - 1.1) / .8);
          if (k < c.shakes && local < .4) rot = Math.sin(local / .4 * Math.PI * 2) * .5;
        }
      }
      if (c.stage === 'escape') return;
      ART.drawItem(ctx, c.icon, x, y, .8, rot);
      if (c.stage === 'caught') {
        const k = Math.min(1, (c.t - c.doneT) / .4);
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = '#f8e050';
          const sx = x - 16 + i * 16, sy = y - 16 - k * 12;
          ctx.fillRect(sx - 1, sy - 3, 2, 6); ctx.fillRect(sx - 3, sy - 1, 6, 2);
        }
      }
    }

    drawHud(ctx) {
      const box = (x, y, w, u, mine) => {
        const mon = u.mon;
        UI.panel(ctx, x, y, w, mine ? 40 : 30);
        UI.text(ctx, DEX[mon.id].name + (mon.shiny ? '✦' : ''), x + 6, y + 12, { size: 8, color: '#282828' });
        UI.text(ctx, 'Nv' + mon.lvl, x + w - 6, y + 12, { size: 8, color: '#282828', align: 'right' });
        UI.hpBar(ctx, x + 6, y + 18, w - 12, mon.hp / mon.maxhp);
        if (mine) {
          UI.text(ctx, `${Math.max(0, Math.ceil(mon.hp))}/${mon.maxhp}`, x + w - 6, y + 34, { size: 8, color: '#282828', align: 'right' });
          ctx.fillStyle = '#383838'; ctx.fillRect(x + 6, y + 36, w - 70, 2);
          ctx.fillStyle = '#58a8f8'; ctx.fillRect(x + 6, y + 36, (w - 70) * Math.min(1, mon.xp / MON.xpNext(mon.lvl)), 2);
        }
      };
      const n = this.slots;
      const w = n === 1 ? 200 : 168;
      for (const side of ['e', 'p']) {
        for (let i = 0; i < n; i++) {
          const u = this.sides[side].slots[i];
          if (!u) continue;
          const x = n === 1 ? (side === 'e' ? 8 : 152) : 8 + i * 176;
          const y = side === 'e' ? 54 : 548;
          box(x, y, w, u, side === 'p');
        }
      }
      // bolinhas do time inimigo (treinadores)
      if (!this.wild) {
        const alive = this.sides.e.queue.length + this.units.filter(u => u.side === 'e' && u.state !== 'faint').length;
        for (let i = 0; i < this.enemyTotal; i++) {
          ART.drawItem(ctx, 0, 352 - i * 14, 95, .45);
          if (i >= alive) { ctx.fillStyle = 'rgba(40,40,40,.6)'; ctx.beginPath(); ctx.arc(352 - i * 14, 95, 6, 0, 7); ctx.fill(); }
        }
      }
      const alivePlayer = this.sides.p.queue.length + this.units.filter(u => u.side === 'p' && u.state !== 'faint').length;
      for (let i = 0; i < this.o.party.length; i++) {
        ART.drawItem(ctx, 0, 10 + i * 14, 527, .45);
        if (i >= alivePlayer) { ctx.fillStyle = 'rgba(40,40,40,.6)'; ctx.beginPath(); ctx.arc(10 + i * 14, 527, 6, 0, 7); ctx.fill(); }
      }
    }
  }

  // Cenário da arena: interior do ginásio ou sala da Liga (gerado do FireRed)
  function arenaBackground(theme) {
    return ART.arena(theme);
  }

  window.BATTLE = { Battle, arenaBackground, ARENA };
})();
