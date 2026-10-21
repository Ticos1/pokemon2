// Gráficos: Pokémon (PokéAPI, Black/White de corpo inteiro) e sprites do GBA (FireRed, gerados por tools/build_gba.py).
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

  // Sprites dos Pokémon: quadros de 96x96 com os pés na linha MON_FEET (tools/build_assets.py)
  const MON_SIZE = 96, MON_FEET = 90;

  function cell(id, w, h) {
    const k = id - 1;
    return [(k % 16) * w, Math.floor(k / 16) * h];
  }

  // Sprite 96x96 de um Pokémon, opcionalmente pintado de uma cor só (silhueta)
  const silCache = {};
  function monCanvas(id, shiny, back, tint) {
    const sheet = (back ? 'back' : 'front') + (shiny ? '_shiny' : '');
    const key = sheet + id + (tint || '');
    if (silCache[key]) return silCache[key];
    const Z = MON_SIZE;
    const [c, x] = canvas(Z, Z);
    const [sx, sy] = cell(id, Z, Z);
    x.drawImage(SHEETS[sheet], sx, sy, Z, Z, 0, 0, Z, Z);
    if (tint) {
      x.globalCompositeOperation = 'source-atop';
      x.fillStyle = tint;
      x.fillRect(0, 0, Z, Z);
    }
    silCache[key] = c;
    return c;
  }

  // Desenha centralizado em (cx, cy); com o.feet, (cx, cy) é o ponto dos pés
  function drawMon(ctx, id, shiny, back, cx, cy, o = {}) {
    const s = o.scale || 1;
    const img = monCanvas(id, shiny, back, o.tint);
    const h = MON_SIZE / 2 * s, top = o.feet ? -MON_FEET * s : -h;
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.translate(Math.round(cx), Math.round(cy));
    if (o.flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -h, top, 2 * h, 2 * h);
    if (o.flash) {
      ctx.globalAlpha = (o.alpha ?? 1) * o.flash;
      ctx.drawImage(monCanvas(id, shiny, back, '#ffffff'), -h, top, 2 * h, 2 * h);
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

  // Ícones de itens (30x30 na folha); size muda o tamanho exibido
  function itemStyle(icon, size = 30) {
    const k = size / 30;
    return `background-image:url(${SHEET_FILES.items});background-size:${SHEETS.items ? SHEETS.items.width * k : 270 * k}px ${size}px;background-position:-${icon * size}px 0`;
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
  // fromY > 0 desenha só a parte de baixo do tile (grama alta na frente das pernas)
  function drawTile(ctx, name, x, y, fromY = 0, scale = 1) {
    const i = window.GBA.tiles[name];
    const h = 16 - fromY;
    ctx.drawImage(SHEETS.tiles, i * 16, fromY, 16, h, Math.round(x), Math.round(y + fromY * scale), 16 * scale, h * scale);
  }

  function tileStyle(name, size = 16) {
    const n = Object.keys(window.GBA.tiles).length;
    return `background-image:url(${SHEET_FILES.tiles});background-size:${n * size}px ${size}px;background-position:-${window.GBA.tiles[name] * size}px 0`;
  }

  // Cabeça de um personagem do mapa (ícones da barra de progresso)
  function headStyle(look, size = 12) {
    const row = window.GBA.people[look] ?? window.GBA.people.youngster;
    const k = size / 16;
    return `background-image:url(${SHEET_FILES.people});background-size:${144 * k}px ${Object.keys(window.GBA.people).length * 32 * k}px;background-position:0 -${(row * 32 + 7) * k}px`;
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
    load, SHEETS, MON_SIZE, MON_FEET, canvas, drawMon, monCanvas, iconStyle, drawIcon, itemStyle, drawItem,
    drawChar, drawPortrait, drawTile, tileStyle, headStyle, drawBuilding, buildingSize, drawBadge, badgeStyle, arena,
  };
})();
