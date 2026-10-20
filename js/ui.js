// Interface: texto em pixel no canvas, caixas de diálogo, escolhas e janelas (DOM).
(function () {
  const FONT = '"Press Start 2P", monospace';
  const $ = sel => document.querySelector(sel);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- Canvas ----------
  function text(ctx, str, x, y, o = {}) {
    const size = o.size || 8;
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = 'alphabetic';
    if (o.outline) {
      ctx.lineWidth = Math.max(3, size / 3);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = o.outlineColor || '#202030';
      ctx.strokeText(str, x, y);
    } else if (o.shadow !== false && (o.color || '#282828') === '#282828') {
      ctx.fillStyle = '#d0d0c8';
      ctx.fillText(str, x + 1, y + 1);
    }
    ctx.fillStyle = o.color || '#282828';
    ctx.fillText(str, x, y);
  }

  function panel(ctx, x, y, w, h) {
    ctx.fillStyle = '#383850';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#f8f8e8';
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = '#d8d8c0';
    ctx.fillRect(x + 2, y + h - 4, w - 4, 2);
  }

  function hpBar(ctx, x, y, w, k) {
    k = Math.max(0, Math.min(1, k));
    ctx.fillStyle = '#383850';
    ctx.fillRect(x, y, w, 7);
    ctx.fillStyle = '#f8b830';
    ctx.font = `6px ${FONT}`;
    ctx.fillText('PS', x + 2, y + 6);
    ctx.fillStyle = '#505060';
    ctx.fillRect(x + 16, y + 2, w - 18, 3);
    ctx.fillStyle = k > .5 ? '#58d070' : k > .2 ? '#f8c830' : '#f05050';
    ctx.fillRect(x + 16, y + 2, Math.ceil((w - 18) * k), 3);
  }

  // ---------- Diálogo ----------
  const state = { auto: false, speedFn: () => 1, typing: null };

  function say(msg, opts = {}) {
    return new Promise(resolve => {
      const box = $('#dialog');
      const txt = box.querySelector('.text');
      const arrow = box.querySelector('.arrow');
      box.classList.remove('hidden');
      arrow.classList.add('hidden');
      txt.textContent = '';
      let i = 0;
      let finished = false;
      let autoTimer = null;
      const full = String(msg);
      const cps = 60 * state.speedFn();
      let acc = 0;
      let last = performance.now();
      const tick = now => {
        if (finished) return;
        acc += (now - last) / 1000 * cps;
        last = now;
        const n = Math.min(full.length, Math.floor(acc));
        if (n > i) {
          i = n;
          txt.textContent = full.slice(0, i);
          if (i % 3 === 0) window.SFX.blip();
        }
        if (i >= full.length) return done();
        requestAnimationFrame(tick);
      };
      const done = () => {
        if (finished) return;
        finished = true;
        txt.textContent = full;
        if (opts.keep) { cleanup(); resolve(); return; }
        arrow.classList.remove('hidden');
        if (state.auto || opts.autoClose) {
          autoTimer = setTimeout(close, (opts.autoClose || 900 + full.length * 12) / state.speedFn());
        }
      };
      const close = () => {
        cleanup();
        box.classList.add('hidden');
        resolve();
      };
      const onInput = e => {
        if (e.type === 'keydown' && !['Space', 'Enter', 'KeyZ'].includes(e.code)) return;
        if (e.type === 'keydown') e.preventDefault();
        if (!finished) done();
        else { window.SFX.select(); close(); }
      };
      const cleanup = () => {
        clearTimeout(autoTimer);
        box.removeEventListener('pointerdown', onInput);
        window.removeEventListener('keydown', onInput);
        state.typing = null;
      };
      box.addEventListener('pointerdown', onInput);
      window.addEventListener('keydown', onInput);
      state.typing = { done };
      requestAnimationFrame(tick);
    });
  }

  // Escolha com botões. options: [{ label, value, sub, disabled, icon }]
  async function choose(msg, options) {
    if (msg) await say(msg, { keep: true });
    return new Promise(resolve => {
      const box = $('#choices');
      box.innerHTML = '';
      box.classList.remove('hidden');
      for (const o of options) {
        const b = el('button', 'choice' + (o.disabled ? ' disabled' : ''));
        b.innerHTML = (o.icon ? `<span class="ico" style="${o.icon}"></span>` : '') +
          `<span class="lbl">${esc(o.label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</span>`;
        if (!o.disabled) {
          b.onclick = () => {
            window.SFX.select();
            box.classList.add('hidden');
            $('#dialog').classList.add('hidden');
            resolve(o.value);
          };
        }
        box.appendChild(b);
      }
    });
  }

  // Janela modal genérica; retorna o elemento de conteúdo
  function modal(cls) {
    const m = $('#modal');
    m.className = 'modal ' + (cls || '');
    m.innerHTML = '';
    const inner = el('div', 'modal-inner');
    m.appendChild(inner);
    return inner;
  }

  function closeModal() {
    const m = $('#modal');
    m.className = 'modal hidden';
    m.innerHTML = '';
  }

  // Canvas com sprite de um Pokémon para usar no DOM
  function monImg(id, shiny, scale = 1, cls = '') {
    const [c, x] = ART.canvas(64 * scale, 64 * scale);
    x.drawImage(ART.monCanvas(id, shiny, false), 0, 0, 64 * scale, 64 * scale);
    c.className = 'mon-img ' + cls;
    return c;
  }

  function typeTag(t) {
    const info = window.RULES.TYPE_INFO[t];
    return `<span class="type" style="background:${info.color}">${info.pt}</span>`;
  }

  window.UI = { text, panel, hpBar, say, choose, modal, closeModal, monImg, typeTag, el, esc, state, $ };
})();
