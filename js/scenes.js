// Cenas especiais com tela própria: o caça-níquel do Cassino de Celadon e a Zona Safári de Fuchsia.
// As regras (prêmios, chance de captura e de fuga) vêm de js/journey.js.
(function () {
  const R = window.RULES, M = window.MON, J = window.JOURNEY, K = window.KANTO, Wd = window.WORLD;
  const { DEX } = R;
  const GM = window.GAME, G = GM.G;
  const { say, choose, wait, walkTo } = GM;
  const name = mon => DEX[mon.id].name;
  const ahead = () => G.world.px + 230;

  // ---------- Caça-níquel ----------
  // Três rolos girando; cada toque (ou ESPAÇO) para o próximo. Paga na linha do meio.
  const SYM_H = 44;
  function spin() {
    return new Promise(resolve => {
      const n = J.REEL.length;
      const slot = {
        t: 0, reels: [0, 1, 2].map(k => ({ pos: Math.random() * n, speed: 11 + k * 1.5, stopping: false, target: null, done: false })),
        next: 0, result: null, resolve,
      };
      // modo gravação: para os rolos sozinho
      if (G.autopilot) slot.autoAt = [1 + Math.random(), 1.6 + Math.random(), 2.2 + Math.random()];
      G.slot = slot;
      G.onPress = () => stopNext(slot);
      G.scene = 'casino';
    });
  }

  function stopNext(slot) {
    if (slot.next > 2 || slot.result) return;
    const r = slot.reels[slot.next++];
    // como no Game Boy, o rolo às vezes escorrega mais um símbolo antes de parar
    r.target = Math.ceil(r.pos) + (Math.random() < .35 ? 1 : 0);
    r.stopping = true;
    window.SFX.select();
  }

  function updateSlot(slot, dt) {
    slot.t += dt;
    if (slot.autoAt && slot.next < 3 && slot.t >= slot.autoAt[slot.next]) stopNext(slot);
    const n = J.REEL.length;
    for (const r of slot.reels) {
      if (r.done) continue;
      r.pos += r.speed * dt;
      if (r.stopping && r.pos >= r.target) { r.pos = r.target; r.done = true; window.SFX.shake(); }
    }
    if (!slot.result && slot.reels.every(r => r.done)) {
      const keys = slot.reels.map(r => J.REEL[((Math.round(r.pos) % n) + n) % n]);
      const pay = J.slotPay(keys);
      slot.result = { pay, t: slot.t };
      G.coins += pay;
      if (pay) window.SFX[pay >= 100 ? 'badge' : 'buy']();
    }
    if (slot.result && slot.t - slot.result.t > 1.6) {
      G.onPress = null;
      G.slot = null;
      G.scene = 'world';
      slot.resolve(slot.result.pay);
    }
  }

  function drawSymbol(ctx, key, cx, cy) {
    const sym = J.SLOT_SYMBOLS.find(s => s.key === key);
    if (key === '7') UI.text(ctx, '7', cx, cy + 12, { size: 28, color: '#e03030', align: 'center', outline: true, outlineColor: '#601010' });
    else if (key === 'BAR') {
      ctx.fillStyle = '#282828'; ctx.fillRect(cx - 24, cy - 10, 48, 20);
      UI.text(ctx, 'BAR', cx, cy + 6, { size: 10, color: '#f8f8f8', align: 'center' });
    } else if (key === 'cherry') {
      ctx.strokeStyle = '#309030'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - 8, cy + 4); ctx.quadraticCurveTo(cx, cy - 18, cx + 8, cy - 14); ctx.moveTo(cx + 8, cy + 6); ctx.lineTo(cx + 6, cy - 14); ctx.stroke();
      ctx.fillStyle = '#e02838';
      ctx.beginPath(); ctx.arc(cx - 9, cy + 8, 8, 0, 7); ctx.arc(cx + 9, cy + 10, 8, 0, 7); ctx.fill();
    } else if (sym && sym.id) ART.drawIcon(ctx, sym.id, cx, cy);
  }

  function drawCasino(ctx) {
    const slot = G.slot;
    if (!slot) return;
    updateSlot(slot, 1 / 60 * (G.paused ? 0 : 1));
    ctx.drawImage(ART.arena('casino'), 0, 0, 360, 640);
    ctx.fillStyle = 'rgba(16,16,32,.45)'; ctx.fillRect(0, 0, 360, 640);
    // gabinete da máquina
    const X = 50, Y = 170, MW = 260, MH = 290;
    ctx.fillStyle = '#383850'; ctx.fillRect(X - 4, Y - 4, MW + 8, MH + 8);
    ctx.fillStyle = '#c83838'; ctx.fillRect(X, Y, MW, MH);
    ctx.fillStyle = '#f8d030'; ctx.fillRect(X + 8, Y + 8, MW - 16, 30);
    UI.text(ctx, 'CAÇA-NÍQUEL', X + MW / 2, Y + 29, { size: 12, color: '#c83838', align: 'center' });
    const n = J.REEL.length;
    const top = Y + 60, wy = SYM_H * 3;
    slot.reels.forEach((r, k) => {
      const cx = X + 47 + k * 83;
      ctx.fillStyle = '#f8f8f0'; ctx.fillRect(cx - 34, top, 68, wy);
      ctx.save();
      ctx.beginPath(); ctx.rect(cx - 34, top, 68, wy); ctx.clip();
      const base = Math.floor(r.pos), frac = r.pos - base;
      for (let d = -2; d <= 2; d++) {
        const key = J.REEL[(((base + d) % n) + n) % n];
        drawSymbol(ctx, key, cx, top + wy / 2 + (d - frac) * SYM_H);
      }
      ctx.restore();
      ctx.strokeStyle = '#383850'; ctx.lineWidth = 3; ctx.strokeRect(cx - 34, top, 68, wy);
    });
    // linha do prêmio
    ctx.fillStyle = 'rgba(248,208,48,.9)';
    ctx.fillRect(X + 6, top + wy / 2 - 1, 6, 3); ctx.fillRect(X + MW - 12, top + wy / 2 - 1, 6, 3);
    UI.text(ctx, `FICHAS: ${G.coins}`, X + MW / 2, Y + MH - 40, { size: 10, color: '#ffffff', align: 'center', outline: true });
    if (slot.result) {
      const msg = slot.result.pay ? `+${slot.result.pay} FICHAS!` : 'NADA...';
      UI.text(ctx, msg, 180, Y - 20, { size: 14, color: slot.result.pay ? '#f8e050' : '#d0d0d0', align: 'center', outline: true });
    } else if (!G.autopilot) {
      const blink = Math.floor(slot.t * 3) % 2;
      if (blink) UI.text(ctx, 'TOQUE PARA PARAR O ROLO', 180, Y + MH - 14, { size: 8, color: '#ffffff', align: 'center', outline: true });
    }
  }

  async function prizes() {
    const opts = J.PRIZES.map(p => ({
      label: `${DEX[p.id].name} Nv${p.lvl}`, sub: `${p.coins} fichas`, value: p, icon: ART.iconStyle(p.id), disabled: G.coins < p.coins,
    }));
    opts.push({ label: 'Voltar', value: null });
    const auto = [...J.PRIZES].reverse().find(p => p.coins <= G.coins) || null;
    const p = await choose(`Sala de prêmios. Suas fichas: ${G.coins}`, opts, { auto });
    if (!p) return false;
    G.coins -= p.coins;
    window.SFX.caught();
    await say(`Você trocou ${p.coins} fichas por um ${DEX[p.id].name}!`);
    await GM.addCaught(M.create(p.id, p.lvl), { gift: true });
    return true;
  }

  async function casino(i) {
    await walkTo(ahead());
    await say('Cassino de Celadon! As máquinas de caça-níquel não param de tocar.');
    if (!G.stats.freeCoins) {
      G.stats.freeCoins = 1;
      G.coins += 10;
      await say('Um senhor: Ei, quer jogar? Tome 10 fichas pra começar!');
    }
    let spins = 0;
    for (;;) {
      const [packN, packP] = J.COIN_PACK;
      const opts = [
        { label: `Girar (${J.SPIN_COST} fichas)`, value: 'spin', disabled: G.coins < J.SPIN_COST },
        { label: `Comprar ${packN} fichas`, sub: `₽${packP}`, value: 'buy', disabled: G.money < packP },
        { label: 'Sala de prêmios', sub: 'Pokémon raros', value: 'prize' },
        { label: 'Sair do cassino', value: 'exit' },
      ];
      // modo gravação: compra um pacote, gira algumas vezes, troca e sai
      let auto = 'exit';
      if (G.coins < J.SPIN_COST && G.money >= packP * 3 && spins < 8) auto = 'buy';
      else if (G.coins >= J.SPIN_COST && spins < 8) auto = 'spin';
      else if (J.PRIZES.some(p => p.coins <= G.coins) && !G.stats.prizeTaken) auto = 'prize';
      const c = await choose(`Fichas: ${G.coins} · Dinheiro: ₽${G.money}`, opts, { auto });
      if (c === 'exit') break;
      if (c === 'buy') { G.money -= packP; G.coins += packN; window.SFX.buy(); GM.updateHud(); continue; }
      if (c === 'prize') { if (await prizes()) G.stats.prizeTaken = 1; continue; }
      G.coins -= J.SPIN_COST;
      spins++;
      await spin();
    }
    await say('Você saiu do cassino.');
    return true;
  }

  // ---------- Zona Safári ----------
  // Sem batalha: joga Bola Safári, isca (fica calmo, mas mais difícil de pegar) ou pedra (fica bravo:
  // mais fácil de pegar, mas foge mais)
  const SAFARI_MAPS = { Centro: 'safari_center', Leste: 'safari_east', Norte: 'safari_north', Oeste: 'safari_west' };

  function drawSafari(ctx) {
    const s = G.safari;
    if (!s) return;
    if (!G.paused) s.t += 1 / 60;
    ctx.drawImage(ART.arena('safari'), 0, 0, 360, 640);
    const mx = 180, my = 300;
    const a = s.anim;
    const at = a ? s.t - a.t0 : 0;
    const inBall = a && a.kind === 'ball' && at > .5 && !(a.result !== 'caught' && at > .9 + a.shakes * .4);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(mx, my + 4, 50, 12, 0, 0, 7); ctx.fill();
    if (!inBall && !s.gone) ART.drawMon(ctx, s.mon.id, s.mon.shiny, false, mx, my, { feet: true, scale: 2, flash: a && a.kind === 'ball' && at > .4 && at < .55 ? 1 : 0 });
    ART.drawChar(ctx, 'player', 'up', 0, 90, 600, 4);
    if (a) {
      const k = Math.min(1, at / .5);
      const bx = 100 + (mx - 100) * k, by = 520 + (my - 40 - 520) * k - Math.sin(k * Math.PI) * 120;
      if (a.kind === 'ball') {
        let rot = 0;
        if (at > .9) { const sk = Math.floor((at - .9) / .4); if (sk < a.shakes) rot = Math.sin((at - .9) * 16) * .5; }
        if (at < .5 || inBall || a.result === 'caught') ART.drawItem(ctx, 15, bx, at < .5 ? by : my - 20, 1, rot);
      } else if (at < .5) {
        ctx.fillStyle = a.kind === 'rock' ? '#807060' : '#f0a0b0';
        ctx.beginPath(); ctx.arc(bx, by, 7, 0, 7); ctx.fill();
      }
    }
    // placa de status
    UI.panel(ctx, 8, 60, 200, 34);
    UI.text(ctx, `${name(s.mon)} Nv${s.mon.lvl}${s.mon.shiny ? '✦' : ''}`, 16, 74, { size: 8 });
    const st = s.state.eating > 0 ? 'COMENDO' : s.state.angry > 0 ? 'BRAVO!' : '';
    if (st) UI.text(ctx, st, 200, 88, { size: 8, color: s.state.angry > 0 ? '#e03030' : '#309030', align: 'right' });
    UI.text(ctx, `Bolas Safári: ${s.balls}`, 16, 88, { size: 7, color: '#505060' });
  }

  async function throwAnim(kind, result, shakes = 0) {
    G.safari.anim = { kind, t0: G.safari.t, result, shakes };
    window.SFX.throw();
    await wait(.5);
    if (kind === 'ball') {
      window.SFX.pop();
      await wait(.4);
      for (let k = 0; k < shakes; k++) { window.SFX.shake(); await wait(.4); }
      if (result === 'caught') window.SFX.caught(); else window.SFX.escape();
      await wait(.3);
    }
    G.safari.anim = null;
  }

  async function safari(i) {
    const stop = G.route[i];
    await walkTo(ahead());
    await say('Zona Safári! A entrada custa ₽500. Você recebe 30 Bolas Safári.');
    if (G.money >= 500) { G.money -= 500; GM.updateHud(); } else await say('Guarda: Sem dinheiro? Tudo bem, hoje a entrada é por minha conta!');
    let balls = J.SAFARI_BALLS, caught = 0;
    for (const zone of J.SAFARI_AREAS) {
      if (balls <= 0) break;
      await GM.fade(true, .3);
      Wd.setMap(G.world, SAFARI_MAPS[zone]);
      G.fx = { kind: 'fade', out: false, t: 0, dur: .3 };
      GM.showPlace(`Zona Safári — ${zone}`);
      await walkTo(ahead());
      G.world.bubble = { x: G.world.px, t: .8 };
      window.SFX.alert();
      await wait(.8);
      const mon = J.safariMon(stop);
      const state = { mon, angry: 0, eating: 0 };
      await GM.flashTransition();
      G.safari = { mon, state, balls, t: 0, anim: null };
      G.scene = 'safari';
      await say(`Um ${name(mon)} selvagem apareceu!`);
      for (;;) {
        if (balls <= 0) { await say('Acabaram as Bolas Safári!'); break; }
        const rate = DEX[mon.id].catch;
        // modo gravação: joga pedra uma vez nos difíceis e depois bolas
        const auto = rate < 60 && !state.angry && !state.tried ? 'rock' : 'ball';
        const act = await choose(`O que fazer? (Bolas: ${balls})`, [
          { label: 'Bola Safári', value: 'ball', icon: ART.itemStyle(15) },
          { label: 'Isca', sub: 'Fica calmo, difícil de pegar', value: 'bait' },
          { label: 'Pedra', sub: 'Fica bravo, fácil de pegar', value: 'rock' },
          { label: 'Fugir', value: 'run' },
        ], { auto });
        state.tried = true;
        if (act === 'run') { await say('Você fugiu!'); break; }
        if (act === 'ball') { balls--; G.safari.balls = balls; }
        const r = J.safariTurn(state, act);
        if (act === 'ball') {
          const shakes = r === 'caught' ? 3 : M.randInt(0, 2);
          await throwAnim('ball', r === 'caught' ? 'caught' : 'miss', shakes);
          if (r === 'caught') {
            await say(`Peguei! ${name(mon)} foi capturado!`);
            caught++;
            G.scene = 'world'; G.safari = null;
            await GM.addCaught(mon);
            break;
          }
          await say(['Ah, não! Ele saiu da bola!', 'Quase! Escapou!', 'Droga! Estava quase!'][Math.min(2, shakes)]);
        } else {
          await throwAnim(act, null);
          await say(act === 'bait' ? `${name(mon)} está comendo a isca!` : `Você jogou uma pedra! ${name(mon)} ficou bravo!`);
        }
        if (r === 'fled') { G.safari.gone = true; await say(`${name(mon)} fugiu!`); break; }
      }
      G.scene = 'world';
      G.safari = null;
    }
    await say(caught ? `Fim do passeio no Safári! Você capturou ${caught} Pokémon.` : 'Fim do passeio no Safári!');
    return true;
  }

  window.SCENES = { casino, safari, draw: { casino: drawCasino, safari: drawSafari } };
})();
