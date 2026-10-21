// Minijogo de pesca no estilo Stardew Valley.
// Segure (clique, toque ou ESPAÇO) para a barra verde subir; solte para ela cair.
// Mantenha o peixe dentro da barra até encher o medidor da direita.
// A lógica roda em passos fixos de 60 Hz, com os mesmos números do Stardew.
(function () {
  const sfx = name => window.SFX && window.SFX[name] && window.SFX[name]();
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const TICK = 1 / 60;
  const TRACK = 568;      // altura da trilha (unidades internas)
  const FISH_MAX = 532;   // posição máxima do peixe (topo = 0)
  const FISH_H = 36;      // altura do peixe na trilha
  const START = .3;       // o medidor começa em 30%
  const GAIN = .002, LOSS = .003;
  const GRACE = 40;       // passos iniciais sem perder (a barra ainda está indo até o peixe)
  const TREASURE_GAIN = .0135, TREASURE_LOSS = .01;
  const AUTO_REACT = 3, AUTO_LAG = 4; // reação do jogador automático, em passos

  // Tela (360x640): moldura à direita, acima do lago (o jogador fica à esquerda)
  const PX = 268, PY = 96, TX = PX + 12, TY = PY + 14, TW = 26, TH = 300, MX = TX + TW + 8, MW = 8;
  const SC = TH / TRACK;

  class Fishing {
    // o: { difficulty 0-100, motion 'mixed'|'dart'|'smooth'|'sinker'|'floater', barH, treasure, autoFn }
    constructor(o) {
      this.difficulty = o.difficulty;
      this.motion = o.motion;
      this.barH = o.barH;
      this.autoFn = o.autoFn || (() => false);
      this.manual = false;
      this.hold = false;
      this.state = 'cast';
      this.t = 0;
      this.acc = 0;
      this.waitT = rand(1, 2.6);
      this.barPos = TRACK - this.barH;
      this.barSpeed = 0;
      this.fishPos = 508;
      this.fishSpeed = 0;
      this.fishTarget = -1;
      this.floatAcc = 0;
      this.progress = START;
      this.perfect = true;
      this.inBar = false;
      this.reelT = 0;
      this.ticks = 0;
      this.reelAng = 0;
      this.shake = 0;
      this.treasure = o.treasure ? { at: rand(1, 3), pos: 0, level: 0, shown: false, caught: false, inBar: false } : null;
      this.result = null;
      this.promise = new Promise(res => { this.resolve = res; });
    }

    press(down) {
      this.hold = down;
      if (down) this.manual = true;
    }

    update(dt) {
      this.t += dt;
      if (this.state === 'cast' && this.t > .55) { this.state = 'wait'; this.t = 0; sfx('splash'); }
      else if (this.state === 'wait' && this.t > this.waitT) { this.state = 'bite'; this.t = 0; sfx('alert'); }
      else if (this.state === 'bite' && this.t > .7) { this.state = 'reel'; this.t = 0; }
      else if (this.state === 'done' && this.t > 1.1 && this.resolve) { this.resolve(this.result); this.resolve = null; }
      if (this.state !== 'reel') return;
      this.acc += dt;
      while (this.acc >= TICK && this.state === 'reel') {
        this.acc -= TICK;
        this.tick();
      }
    }

    // Peixe: o mesmo comportamento do Stardew (alvo aleatório, investidas, afunda/flutua)
    moveFish() {
      const d = this.difficulty, m = this.motion;
      if (Math.random() < d * (m === 'smooth' ? 20 : 1) / 4000 && (m !== 'smooth' || this.fishTarget === -1)) {
        const below = FISH_MAX - this.fishPos, above = this.fishPos;
        const pct = Math.min(99, d + randInt(10, 45)) / 100;
        this.fishTarget = this.fishPos + randInt(-above, below) * pct;
      }
      if (m === 'floater') this.floatAcc = Math.max(this.floatAcc - .01, -1.5);
      else if (m === 'sinker') this.floatAcc = Math.min(this.floatAcc + .01, 1.5);
      if (Math.abs(this.fishPos - this.fishTarget) > 3 && this.fishTarget !== -1) {
        const a = (this.fishTarget - this.fishPos) / (randInt(10, 30) + (100 - Math.min(100, d)));
        this.fishSpeed += (a - this.fishSpeed) / 5;
      } else if (m !== 'smooth' && Math.random() < d / 2000) {
        this.fishTarget = this.fishPos + (Math.random() < .5 ? randInt(-100, -51) : randInt(50, 100));
      } else {
        this.fishTarget = -1;
      }
      if (m === 'dart' && Math.random() < d / 1000) {
        this.fishTarget = this.fishPos + (Math.random() < .5 ? randInt(-100 - d * 2, -51) : randInt(50, 100 + d * 2));
      }
      this.fishTarget = clamp(this.fishTarget, -1, FISH_MAX + 16);
      this.fishPos = clamp(this.fishPos + this.fishSpeed + this.floatAcc, 0, FISH_MAX);
    }

    // jogador automático (modo gravação): segura quando a barra vai ficar abaixo do peixe.
    // Ele reage com atraso (maior nos peixes difíceis), então às vezes o peixe escapa.
    autoHold() {
      if (this.ticks >= (this.autoNext || 0)) {
        const fish = this.fishPos + FISH_H / 2 + this.fishSpeed * 6;
        const bar = this.barPos + this.barH / 2 + this.barSpeed * 11;
        this.autoState = bar > fish;
        this.autoNext = this.ticks + AUTO_REACT + randInt(0, Math.round(this.difficulty / AUTO_LAG));
      }
      return this.autoState;
    }

    tick() {
      this.ticks++;
      this.moveFish();
      const hold = !this.manual && this.autoFn() ? this.autoHold() : this.hold;
      this.holding = hold;

      // Barra verde: gravidade, impulso e quique no fundo
      const g = hold ? -.25 : .25;
      const bottom = TRACK - this.barH;
      if (hold && (this.barPos === 0 || this.barPos === bottom)) this.barSpeed = 0;
      this.barSpeed += g;
      this.barPos += this.barSpeed;
      if (this.barPos > bottom) { this.barPos = bottom; this.barSpeed = -this.barSpeed * 2 / 3; if (Math.abs(this.barSpeed) < .6) this.barSpeed = 0; }
      if (this.barPos < 0) { this.barPos = 0; this.barSpeed = 0; }

      const fc = this.fishPos + FISH_H / 2;
      this.inBar = fc >= this.barPos + 4 && fc <= this.barPos + this.barH - 4;

      // Baú do tesouro
      const tr = this.treasure;
      if (tr && !tr.caught) {
        if (!tr.shown && this.t >= tr.at) {
          tr.shown = true;
          // longe do peixe
          tr.pos = clamp(fc > TRACK / 2 ? rand(40, fc - 120) : rand(fc + 120, TRACK - 40), 30, TRACK - 30);
          sfx('blip');
        }
        if (tr.shown) {
          tr.inBar = tr.pos >= this.barPos && tr.pos <= this.barPos + this.barH;
          tr.level = clamp(tr.level + (tr.inBar ? TREASURE_GAIN : -TREASURE_LOSS), 0, 1);
          if (tr.level >= 1) { tr.caught = true; tr.inBar = false; sfx('buy'); }
        }
      }

      if (this.inBar) {
        this.progress += GAIN;
        this.reelAng += .25;
        if ((this.reelT += 1) % 8 === 0) sfx('reel');
      } else if (!(tr && tr.inBar) && this.ticks > GRACE) {
        this.progress -= LOSS;
        this.perfect = false;
      }
      this.shake = this.inBar ? 1 : 0;

      if (this.progress >= 1) this.finish(true);
      else if (this.progress <= 0) this.finish(false);
    }

    finish(caught) {
      this.progress = clamp(this.progress, 0, 1);
      this.state = 'done';
      this.t = 0;
      this.result = { caught, perfect: caught && this.perfect, treasure: !!(this.treasure && this.treasure.caught && caught) };
      sfx(caught ? 'caught' : 'escape');
    }

    // ---------- Desenho ----------
    // hand: ponta da vara na tela; bob: ponto do lago onde cai a boia
    draw(ctx, hand, bob) {
      this.drawLine(ctx, hand, bob);
      if (this.state === 'reel' || (this.state === 'done' && this.t < .9)) this.drawPanel(ctx);
    }

    drawLine(ctx, hand, bob) {
      let bx = bob.x, by = bob.y;
      if (this.state === 'cast') {
        const k = Math.min(1, this.t / .55);
        bx = hand.x + (bob.x - hand.x) * k;
        by = hand.y + (bob.y - hand.y) * k - Math.sin(k * Math.PI) * 50;
      } else if (this.state === 'wait') {
        by += Math.sin(this.t * 5) * 1.5;
      } else if (this.state === 'bite') {
        by += 4 + Math.sin(this.t * 40) * 2;
      } else if (this.state === 'reel') {
        bx += rand(-1.5, 1.5); by += 2 + rand(-1.5, 1.5);
      }
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hand.x, hand.y);
      const sag = this.state === 'reel' ? 4 : 18;
      ctx.quadraticCurveTo((hand.x + bx) / 2, Math.max(hand.y, by) + sag, bx, by);
      ctx.stroke();
      // ondas na água
      if (this.state !== 'cast') {
        const r = 6 + (this.t * 10 % 8);
        ctx.strokeStyle = `rgba(255,255,255,${.6 - (r - 6) / 16})`;
        ctx.beginPath(); ctx.ellipse(bx, by + 3, r, r / 3, 0, 0, 7); ctx.stroke();
      }
      // boia vermelha e branca
      ctx.fillStyle = '#282828'; ctx.fillRect(bx - 4, by - 4, 8, 8);
      ctx.fillStyle = '#f04040'; ctx.fillRect(bx - 3, by - 3, 6, 3);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 3, by, 6, 3);
      ctx.restore();
    }

    drawPanel(ctx) {
      const dx = this.inBar ? rand(-.6, .6) : 0;
      ctx.save();
      ctx.translate(Math.round(dx), 0);
      // moldura de madeira
      ctx.fillStyle = '#3a2210'; ctx.fillRect(PX - 2, PY - 2, MX + MW + 12 - PX + 4, TH + 72);
      ctx.fillStyle = '#b8743a'; ctx.fillRect(PX, PY, MX + MW + 12 - PX, TH + 68);
      ctx.fillStyle = '#d89a58'; ctx.fillRect(PX + 2, PY + 2, MX + MW + 12 - PX - 4, 3);
      ctx.fillStyle = '#7a4520'; ctx.fillRect(PX + 2, PY + TH + 62, MX + MW + 12 - PX - 4, 3);
      // trilha (água)
      ctx.fillStyle = '#3a2210'; ctx.fillRect(TX - 2, TY - 2, TW + 4, TH + 4);
      const grad = ctx.createLinearGradient(0, TY, 0, TY + TH);
      grad.addColorStop(0, '#58b0e8'); grad.addColorStop(1, '#1c4c90');
      ctx.fillStyle = grad; ctx.fillRect(TX, TY, TW, TH);
      // bolhas
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      for (let i = 0; i < 5; i++) {
        const y = TY + TH - ((performance.now() / 30 + i * 67) % TH);
        ctx.fillRect(TX + 4 + (i * 7) % (TW - 8), Math.round(y), 2, 2);
      }

      // barra verde
      const by = TY + this.barPos * SC, bh = this.barH * SC;
      ctx.globalAlpha = this.inBar ? 1 : .6;
      ctx.fillStyle = '#2c7a1c'; ctx.fillRect(TX, Math.round(by), TW, Math.round(bh));
      ctx.fillStyle = '#78d850'; ctx.fillRect(TX + 2, Math.round(by) + 2, TW - 4, Math.round(bh) - 4);
      ctx.fillStyle = '#b8f888'; ctx.fillRect(TX + 2, Math.round(by) + 2, TW - 4, 2);
      ctx.fillStyle = '#58b838'; ctx.fillRect(TX + 2, Math.round(by + bh) - 4, TW - 4, 2);
      ctx.globalAlpha = 1;

      // baú
      const tr = this.treasure;
      if (tr && tr.shown && !tr.caught) {
        const ty = TY + tr.pos * SC;
        const cx = TX + TW / 2;
        ctx.fillStyle = '#3a2210'; ctx.fillRect(cx - 7, ty - 6, 14, 12);
        ctx.fillStyle = '#c88838'; ctx.fillRect(cx - 6, ty - 5, 12, 10);
        ctx.fillStyle = '#f8d048'; ctx.fillRect(cx - 6, ty - 1, 12, 2); ctx.fillRect(cx - 1, ty - 2, 2, 4);
        if (tr.level > 0) {
          ctx.fillStyle = '#282828'; ctx.fillRect(cx - 8, ty + 7, 16, 3);
          ctx.fillStyle = '#f8d048'; ctx.fillRect(cx - 7, ty + 8, Math.round(14 * tr.level), 1);
        }
      }

      // peixe
      const fy = TY + (this.fishPos + FISH_H / 2) * SC + (this.inBar ? rand(-.8, .8) : 0);
      this.drawFish(ctx, TX + TW / 2 + (this.inBar ? rand(-.8, .8) : 0), fy);

      // medidor de captura
      ctx.fillStyle = '#3a2210'; ctx.fillRect(MX - 2, TY - 2, MW + 4, TH + 4);
      ctx.fillStyle = '#5a3818'; ctx.fillRect(MX, TY, MW, TH);
      const p = this.progress;
      const mh = Math.round(TH * p);
      ctx.fillStyle = `hsl(${Math.round(p * 120)}, 80%, 50%)`;
      ctx.fillRect(MX, TY + TH - mh, MW, mh);

      // molinete
      const rx = TX + TW / 2, ry = TY + TH + 30;
      ctx.fillStyle = '#3a2210'; ctx.beginPath(); ctx.arc(rx, ry, 15, 0, 7); ctx.fill();
      ctx.fillStyle = '#a8a8b8'; ctx.beginPath(); ctx.arc(rx, ry, 13, 0, 7); ctx.fill();
      ctx.fillStyle = '#686878'; ctx.beginPath(); ctx.arc(rx, ry, 5, 0, 7); ctx.fill();
      const ax = rx + Math.cos(this.reelAng) * 10, ay = ry + Math.sin(this.reelAng) * 10;
      ctx.strokeStyle = '#282828'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(ax, ay); ctx.stroke();
      ctx.fillStyle = '#f8f8f8'; ctx.fillRect(ax - 2, ay - 2, 4, 4);
      ctx.restore();

      const UI = window.UI;
      if (this.state === 'done') {
        const r = this.result;
        const msg = r.caught ? (r.perfect ? 'PERFEITO!' : 'PEGOU!') : 'ESCAPOU...';
        UI.text(ctx, msg, 180, 300, { size: 16, color: r.caught ? '#f8e050' : '#f86060', align: 'center', outline: true });
      } else if (this.t < 2.5 && !this.manual) {
        UI.text(ctx, this.autoFn() ? 'AUTO' : 'SEGURE', PX - 8, TY + TH / 2, { size: 8, color: '#ffffff', align: 'right', outline: true });
        if (!this.autoFn()) UI.text(ctx, 'PARA SUBIR', PX - 8, TY + TH / 2 + 14, { size: 8, color: '#ffffff', align: 'right', outline: true });
      }
    }

    drawFish(ctx, x, y) {
      x = Math.round(x); y = Math.round(y);
      const hard = this.difficulty >= 70;
      const body = hard ? '#9858d8' : '#f08838', light = hard ? '#c8a0f8' : '#f8c070';
      ctx.fillStyle = '#282828';
      ctx.fillRect(x - 8, y - 4, 13, 8); ctx.fillRect(x + 4, y - 6, 5, 12);
      ctx.fillStyle = body;
      ctx.fillRect(x - 7, y - 3, 11, 6); ctx.fillRect(x + 5, y - 5, 3, 10);
      ctx.fillStyle = light; ctx.fillRect(x - 6, y - 2, 8, 2);
      ctx.fillStyle = '#282828'; ctx.fillRect(x - 5, y - 2, 2, 2);
    }
  }

  window.FISHING = { Fishing };
})();
