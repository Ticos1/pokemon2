// Gráficos: Pokémon (PokéAPI) e sprites do GBA (FireRed, gerados por tools/build_gba.py).
(function () {
  const SHEETS = {};
  const SHEET_FILES = {
    front: 'assets/front.png', back: 'assets/back.png',
    front_shiny: 'assets/front_shiny.png', back_shiny: 'assets/back_shiny.png',
    icons: 'assets/icons.png', items: 'assets/items.png',
    people: 'assets/gba/people.png', portraits: 'assets/gba/portraits.png',
    tiles: 'assets/gba/tiles.png', buildings: 'assets/gba/buildings.png', badges: 'assets/gba/badges.png',
  };
  for (const a of window.GBA.arenas) SHEET_FILES['arena_' + a] = `assets/gba/arena_${a}.png`;

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

  // ---------- Personagens do GBA (16x32) ----------
  // quadros: 0 baixo, 1 cima, 2 esquerda, 3-4 andando baixo, 5-6 cima, 7-8 esquerda
  const DIR_FRAMES = { down: [0, 3, 4], up: [1, 5, 6], left: [2, 7, 8], right: [2, 7, 8] };

  // (x, y) = base do personagem (centro dos pés); step 0 = parado, 1/2 = passos
  function drawChar(ctx, look, dir, step, x, y, scale = 1) {
    const row = window.GBA.people[look] ?? window.GBA.people.youngster;
    const f = DIR_FRAMES[dir][step || 0];
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (dir === 'right') ctx.scale(-1, 1);
    ctx.drawImage(SHEETS.people, f * 16, row * 32, 16, 32, -8 * scale, -32 * scale + 2 * scale, 16 * scale, 32 * scale);
    ctx.restore();
  }

  // Retrato de batalha 64x64 (tela VS)
  function drawPortrait(ctx, key, cx, cy, scale = 1, flip = false) {
    const i = window.GBA.portraits[key];
    if (i === undefined) return;
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(cy));
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(SHEETS.portraits, i * 64, 0, 64, 64, -32 * scale, -32 * scale, 64 * scale, 64 * scale);
    ctx.restore();
  }

  // ---------- Tiles da rota (16x16) ----------
  function drawTile(ctx, name, x, y) {
    const i = window.GBA.tiles[name];
    ctx.drawImage(SHEETS.tiles, i * 16, 0, 16, 16, Math.round(x), Math.round(y), 16, 16);
  }

  // Prédio desenhado com a base em y, centralizado em x
  function drawBuilding(ctx, key, x, y) {
    const [sx, sy, w, h] = window.GBA.buildings[key];
    ctx.drawImage(SHEETS.buildings, sx, sy, w, h, Math.round(x - w / 2), Math.round(y - h), w, h);
    return [w, h];
  }

  function buildingSize(key) {
    const b = window.GBA.buildings[key];
    return [b[2], b[3]];
  }

  // ---------- Insígnias (16x16 cada) ----------
  function drawBadge(ctx, i, cx, cy, size = 16) {
    ctx.drawImage(SHEETS.badges, i * 16, 0, 16, 16, Math.round(cx - size / 2), Math.round(cy - size / 2), size, size);
  }

  function badgeStyle(i, size = 16) {
    return `background-image:url(${SHEET_FILES.badges});background-size:${128 * size / 16}px ${size}px;background-position:-${i * size}px 0`;
  }

  function arena(theme) {
    return SHEETS['arena_' + theme] || SHEETS.arena_route;
  }

  window.ART = {
    load, SHEETS, canvas, drawMon, monCanvas, iconStyle, drawIcon, itemStyle, drawItem,
    drawChar, drawPortrait, drawTile, drawBuilding, buildingSize, drawBadge, badgeStyle, arena,
  };
})();
