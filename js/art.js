// Pixel art: folhas de sprites dos Pokémon, personagens, tiles, prédios e insígnias.
(function () {
  const SHEETS = {};
  const SHEET_FILES = {
    front: 'assets/front.png', back: 'assets/back.png',
    front_shiny: 'assets/front_shiny.png', back_shiny: 'assets/back_shiny.png',
    icons: 'assets/icons.png', items: 'assets/items.png',
  };

  function load() {
    return Promise.all(Object.entries(SHEET_FILES).map(([k, src]) => new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => { SHEETS[k] = img; res(); };
      img.onerror = () => rej(new Error('Falha ao carregar ' + src));
      img.src = src;
    })));
  }

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return [c, x];
  }

  function cell(id, w, h) {
    const k = id - 1;
    return [(k % 16) * w, Math.floor(k / 16) * h];
  }

  // Sprite 64x64 de um Pokémon, opcionalmente pintado de uma cor só (silhueta)
  const silCache = {};
  function monCanvas(id, shiny, back, tint) {
    const sheet = (back ? 'back' : 'front') + (shiny ? '_shiny' : '');
    const key = sheet + id + (tint || '');
    if (silCache[key]) return silCache[key];
    const [c, x] = canvas(64, 64);
    const [sx, sy] = cell(id, 64, 64);
    x.drawImage(SHEETS[sheet], sx, sy, 64, 64, 0, 0, 64, 64);
    if (tint) {
      x.globalCompositeOperation = 'source-atop';
      x.fillStyle = tint;
      x.fillRect(0, 0, 64, 64);
    }
    silCache[key] = c;
    return c;
  }

  // Desenha centralizado em (cx, cy)
  function drawMon(ctx, id, shiny, back, cx, cy, o = {}) {
    const s = o.scale || 1;
    const img = monCanvas(id, shiny, back, o.tint);
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.translate(Math.round(cx), Math.round(cy));
    if (o.flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -32 * s, -32 * s, 64 * s, 64 * s);
    if (o.flash) {
      ctx.globalAlpha = (o.alpha ?? 1) * o.flash;
      ctx.drawImage(monCanvas(id, shiny, back, '#ffffff'), -32 * s, -32 * s, 64 * s, 64 * s);
    }
    ctx.restore();
  }

  function iconStyle(id) {
    const [sx, sy] = cell(id, 40, 30);
    return `background-image:url(${SHEET_FILES.icons});background-position:-${sx}px -${sy}px`;
  }

  function drawIcon(ctx, id, cx, cy, flip) {
    const [sx, sy] = cell(id, 40, 30);
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(cy));
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(SHEETS.icons, sx, sy, 40, 30, -20, -15, 40, 30);
    ctx.restore();
  }

  function itemStyle(icon) {
    return `background-image:url(${SHEET_FILES.items});background-position:-${icon * 30}px 0`;
  }

  function drawItem(ctx, icon, cx, cy, scale = 1, rot = 0) {
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(cy));
    if (rot) ctx.rotate(rot);
    ctx.drawImage(SHEETS.items, icon * 30, 0, 30, 30, -15 * scale, -15 * scale, 30 * scale, 30 * scale);
    ctx.restore();
  }

  // ---------- Personagens (16x17, metade espelhada) ----------
  const HEAD_FRONT = ['....oooo', '...ohhhh', '..ohhhhh', '..ohhhhw', '.okkkkkk', '..oyssss', '..oysess', '..oyssss', '...ossss'];
  const HEAD_BACK = ['....oooo', '...ohhhh', '..ohhhhh', '..ohhhhh', '..okkkkk', '..oyyyyy', '..oyyyyy', '..oyyyyy', '...oyyyy'];
  const BODY = ['..occccc', '.osccccc', '.osccccc', '..oppppp', '..oppppp'];
  const LEGS = [
    ['...oppo..oppo...', '...obbo..obbo...', '....oo....oo....'],
    ['...oppo..oppo...', '...obbo..oppo...', '....oo...obbo...'],
    ['...oppo..oppo...', '...oppo..obbo...', '...obbo...oo....'],
  ];
  const mirror = r => r + r.split('').reverse().join('');

  const hair = (hc, dark, extra) => Object.assign({ h: hc, w: hc, k: dark, y: hc }, extra);
  const LOOKS = {
    player: { h: '#e03838', w: '#ffffff', k: '#a02020', y: '#402818', c: '#3868d0', p: '#404868', b: '#d03030' },
    rival: hair('#b07038', '#805020', { c: '#7050a8', p: '#383838', b: '#604030' }),
    brock: hair('#5a3820', '#3a2410', { c: '#6a8838', p: '#806048', b: '#403020' }),
    misty: hair('#f08020', '#c05810', { c: '#f8e050', p: '#3870d0', b: '#d03030' }),
    surge: hair('#f8e050', '#c8a820', { c: '#4a7838', p: '#4a5a30', b: '#302818' }),
    erika: hair('#303060', '#202040', { c: '#e8c040', p: '#c04040', b: '#803030' }),
    youngster: { h: '#f0c030', w: '#ffffff', k: '#c09020', y: '#402818', c: '#f8f8f8', p: '#4060b0', b: '#303030' },
    lass: hair('#e08030', '#a05010', { c: '#f070a0', p: '#3050a0', b: '#803050' }),
    bug: { h: '#d8c070', w: '#d8c070', k: '#a89040', y: '#402818', c: '#f0f0f0', p: '#d09040', b: '#605030' },
    hiker: { h: '#906030', w: '#906030', k: '#604020', y: '#302010', c: '#d08838', p: '#705030', b: '#402010' },
    swimmer: hair('#202020', '#101010', { c: '#f8c898', p: '#3060e0', b: '#f8c898' }),
    birdkeeper: { h: '#3878d8', w: '#ffffff', k: '#2050a0', y: '#402818', c: '#f0d060', p: '#506080', b: '#303030' },
    blackbelt: hair('#202020', '#101010', { c: '#f8f8f8', p: '#f0f0f0', b: '#f8c898' }),
    channeler: hair('#f0f0f0', '#c0c0c0', { c: '#9068c0', p: '#9068c0', b: '#604080' }),
    nerd: hair('#403020', '#201810', { c: '#d8d8d8', p: '#5060a0', b: '#303030' }),
    tamer: { h: '#904828', w: '#904828', k: '#603018', y: '#402818', c: '#c03030', p: '#402020', b: '#201010' },
    rocket: { h: '#202020', w: '#e03030', k: '#101010', y: '#402818', c: '#303030', p: '#303030', b: '#e03030' },
    nurse: { h: '#ffffff', w: '#f04060', k: '#f888b8', y: '#f888b8', c: '#f8b8d0', p: '#ffffff', b: '#f0f0f0' },
    clerk: { h: '#3060c0', w: '#ffffff', k: '#204080', y: '#402818', c: '#3060c0', p: '#303050', b: '#202020' },
    oldman: hair('#d8d8d8', '#a8a8a8', { c: '#806850', p: '#605040', b: '#403020' }),
    fisher: { h: '#e8e0a0', w: '#e8e0a0', k: '#b0a060', y: '#402818', c: '#5080c0', p: '#506040', b: '#303030' },
  };
  const BASE = { o: '#282828', s: '#f8c898', e: '#282828' };

  const charCache = {};
  function charCanvas(look, dir, frame) {
    const key = look + dir + frame;
    if (charCache[key]) return charCache[key];
    const pal = Object.assign({}, BASE, LOOKS[look] || LOOKS.youngster);
    const rows = [...(dir === 'up' ? HEAD_BACK : HEAD_FRONT), ...BODY].map(mirror).concat(LEGS[frame]);
    const [c, x] = canvas(16, rows.length);
    rows.forEach((r, y) => {
      for (let i = 0; i < 16; i++) {
        const col = pal[r[i]];
        if (col) { x.fillStyle = col; x.fillRect(i, y, 1, 1); }
      }
    });
    charCache[key] = c;
    return c;
  }

  // (x, y) = base do personagem (centro dos pés)
  function drawChar(ctx, look, dir, frame, x, y, scale = 1) {
    const c = charCanvas(look, dir, frame);
    ctx.drawImage(c, Math.round(x - 8 * scale), Math.round(y - c.height * scale), 16 * scale, c.height * scale);
  }

  // ---------- Tiles (16x16) ----------
  const TILES = {};
  function px(x, col, pts) { x.fillStyle = col; for (const [a, b, w = 1, h = 1] of pts) x.fillRect(a, b, w, h); }

  function buildTiles() {
    let [c, x] = canvas(16, 16);
    x.fillStyle = '#88d070'; x.fillRect(0, 0, 16, 16);
    px(x, '#70b858', [[2, 3], [3, 2], [10, 9], [11, 8], [6, 13], [7, 12], [13, 2], [12, 3]]);
    TILES.grass = c;

    [c, x] = canvas(16, 16);
    x.drawImage(TILES.grass, 0, 0);
    px(x, '#f85858', [[4, 5, 2, 2], [11, 11, 2, 2]]);
    px(x, '#f8f8f8', [[11, 4, 2, 2], [3, 12, 2, 2]]);
    px(x, '#f8d030', [[4, 5], [11, 11], [11, 4], [3, 12]]);
    TILES.flowers = c;

    [c, x] = canvas(16, 16);
    x.fillStyle = '#e8d098'; x.fillRect(0, 0, 16, 16);
    px(x, '#d0b878', [[3, 4], [11, 2], [7, 10], [13, 13], [2, 13]]);
    TILES.path = c;

    [c, x] = canvas(16, 16);
    x.fillStyle = '#88d070'; x.fillRect(0, 0, 16, 16);
    for (const [bx, by] of [[0, 2], [8, 2], [4, 9], [12, 9]]) {
      px(x, '#2f7f30', [[bx, by + 1, 1, 6], [bx + 3, by + 1, 1, 6], [bx + 1, by, 2, 1]]);
      px(x, '#48b048', [[bx + 1, by + 1, 2, 6]]);
      px(x, '#78d068', [[bx + 1, by + 1, 1, 2]]);
    }
    TILES.tall = c;

    [c, x] = canvas(16, 16);
    x.fillStyle = '#5890f0'; x.fillRect(0, 0, 16, 16);
    px(x, '#a0c8f8', [[2, 4, 4, 1], [9, 10, 5, 1], [11, 3, 3, 1]]);
    TILES.water = c;

    // Árvore 16x24
    [c, x] = canvas(16, 24);
    px(x, '#205820', [[3, 0, 10, 1], [1, 1, 14, 1], [0, 2, 16, 14], [1, 16, 14, 1], [3, 17, 10, 1]]);
    px(x, '#38883a', [[3, 1, 10, 1], [1, 2, 14, 13], [3, 15, 10, 1]]);
    px(x, '#58a848', [[3, 3, 5, 3], [9, 6, 4, 3], [4, 9, 4, 3]]);
    px(x, '#6a4020', [[6, 18, 4, 5]]);
    px(x, '#402810', [[6, 22, 4, 1], [6, 18, 1, 5]]);
    TILES.tree = c;
  }

  // ---------- Prédios ----------
  function building(kind, w, h) {
    const [c, x] = canvas(w, h);
    const roof = kind === 'center' ? ['#e04848', '#b02828'] : kind === 'mart' ? ['#4870d8', '#2848a0'] : ['#8a8a9a', '#5a5a6a'];
    const roofH = Math.floor(h * .42);
    px(x, '#282828', [[0, 0, w, roofH + 1]]);
    px(x, roof[0], [[1, 1, w - 2, roofH - 1]]);
    for (let i = 3; i < roofH; i += 4) px(x, roof[1], [[1, i, w - 2, 1]]);
    px(x, '#282828', [[1, roofH, w - 2, h - roofH]]);
    px(x, '#f0e8d0', [[2, roofH + 1, w - 4, h - roofH - 1]]);
    px(x, '#d0c8a8', [[2, h - 3, w - 4, 2]]);
    const dw = kind === 'gym' ? 14 : 10;
    const dx = Math.floor(w / 2 - dw / 2);
    px(x, '#282828', [[dx - 1, h - 13, dw + 2, 13]]);
    px(x, '#90b8e8', [[dx, h - 12, dw, 12]]);
    px(x, '#5080c0', [[dx + Math.floor(dw / 2), h - 12, 1, 12]]);
    for (const wx of [5, w - 13]) {
      px(x, '#282828', [[wx - 1, roofH + 4, 10, 8]]);
      px(x, '#a8d8f8', [[wx, roofH + 5, 8, 6]]);
    }
    if (kind === 'center') {
      const cx = Math.floor(w / 2);
      px(x, '#282828', [[cx - 5, 3, 10, 10]]);
      px(x, '#f04040', [[cx - 4, 4, 8, 4]]);
      px(x, '#ffffff', [[cx - 4, 8, 8, 4]]);
      px(x, '#282828', [[cx - 4, 7, 8, 1], [cx - 1, 6, 2, 3]]);
    }
    if (kind === 'mart') {
      px(x, '#282828', [[Math.floor(w / 2) - 9, 3, 18, 8]]);
      px(x, '#ffffff', [[Math.floor(w / 2) - 8, 4, 16, 6]]);
      px(x, '#4870d8', [[Math.floor(w / 2) - 8, 5, 16, 1], [Math.floor(w / 2) - 8, 8, 16, 1]]);
    }
    return c;
  }

  // ---------- Insígnias ----------
  function drawBadge(ctx, i, cx, cy, r = 6) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#282828';
    if (i === 0) {
      ctx.fillStyle = '#a8a8b0';
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = Math.PI / 8 + k * Math.PI / 4;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d8d8e0'; ctx.fillRect(-r / 2, -r / 2, r / 2, r / 2);
    } else if (i === 1) {
      ctx.fillStyle = '#58a8f8';
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.quadraticCurveTo(r, 0, r * .7, r * .5);
      ctx.arc(0, r * .3, r * .7, 0.3, Math.PI - 0.3);
      ctx.quadraticCurveTo(-r, 0, 0, -r);
      ctx.fill(); ctx.stroke();
    } else if (i === 2) {
      ctx.fillStyle = '#f8a030';
      ctx.beginPath();
      for (let k = 0; k < 16; k++) {
        const a = k * Math.PI / 8, rr = k % 2 ? r * .55 : r;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f8e050'; ctx.beginPath(); ctx.arc(0, 0, r * .35, 0, 7); ctx.fill();
    } else {
      const cols = ['#f05050', '#f8a030', '#f8e050', '#58c858', '#58a8f8', '#a070e0'];
      cols.forEach((col, k) => {
        const a = k * Math.PI / 3;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(Math.cos(a) * r * .55, Math.sin(a) * r * .55, r * .45, 0, 7); ctx.fill();
      });
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, r * .3, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  window.ART = {
    load, SHEETS, canvas, drawMon, monCanvas, iconStyle, drawIcon, itemStyle, drawItem,
    drawChar, charCanvas, LOOKS, TILES, buildTiles, building, drawBadge,
  };
})();
