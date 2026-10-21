// Mundo da caminhada: o treinador anda para a direita por uma rota do FireRed vista de cima.
// Tudo é desenhado em baixa resolução (180x320) e ampliado; os Pokémon e textos vão em resolução cheia.
//
// Linhas da tela (16px cada):
//   0-3   floresta fechada (a linha 3 é a base dos troncos)
//   4-10  grama, árvores e as cidades (os prédios ficam com a porta virada para o caminho)
//   11-12 caminho de terra
//   13-16 grama, grama alta, lagos e degraus
//   17-19 floresta da borda de baixo
(function () {
  const W = 360, LW = 180, LH = 320, ROWS = 20;
  const WALK_SPEED = 72;          // px/s (baixa resolução)
  const PLAYER_SX = 60;           // x do jogador na tela (baixa resolução)
  const PATH_ROW = 11;            // o caminho ocupa as linhas 11 e 12
  const FEET_Y = 199;             // y dos pés de quem anda pelo caminho
  const TOP_Y = PATH_ROW * 16;    // borda de cima do caminho (base dos prédios)
  const [low, lctx] = ART.canvas(LW, LH);

  function hash(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function newWorld() {
    return { px: 0, walking: false, target: null, onArrive: null, dist: 0, objects: [], dir: 'right', follower: true, bubble: null, map: null };
  }

  // Dentro de cavernas e prédios o fundo é o mapa de verdade do andar (assets/gba/maps): a câmera
  // passa por ele enquanto o treinador anda. key = null volta para a rota.
  function setMap(w, key, dark) {
    if (!key) { w.map = null; return; }
    if (w.map && w.map.key === key) return;
    w.map = { key, start: w.px, dark: !!dark, path: mapPath(key) };
    w.objects = w.objects.filter(o => o.keep);
    ART.loadMap(key);
  }

  // Caminho andável do mapa (tools/build_paths.py, da colisão do FireRed): pontos em pixels nos pés
  // de quem anda, com a distância acumulada. Sem caminho, o treinador anda reto no meio do mapa.
  const pathCache = {};
  function mapPath(key) {
    if (pathCache[key]) return pathCache[key];
    const raw = (window.MAP_PATHS || {})[key];
    if (!raw || raw.length < 2) return null;
    const pts = raw.map(([x, y]) => ({ x: x * 16 + 8, y: y * 16 + 15 }));
    let len = 0;
    pts[0].d = 0;
    for (let i = 1; i < pts.length; i++) {
      len += Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
      pts[i].d = len;
    }
    return (pathCache[key] = { pts, len });
  }

  // Ponto do caminho a uma distância d do começo; no fim ele dá meia-volta (vai e volta)
  function pathPoint(path, d) {
    const L = path.len;
    let t = ((d % (2 * L)) + 2 * L) % (2 * L);
    const back = t > L;
    if (back) t = 2 * L - t;
    const pts = path.pts;
    let i = 1;
    while (i < pts.length - 1 && pts[i].d < t) i++;
    const a = pts[i - 1], b = pts[i];
    const k = (t - a.d) / Math.max(1, b.d - a.d);
    const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k;
    let dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
    if (back) { dx = -dx; dy = -dy; }
    const dir = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
    return { x, y, dir };
  }

  // Onde fica na tela (baixa resolução) algo que está na posição x do mundo, andando pelo caminho do mapa
  function mapScreen(w, x) {
    const path = w.map.path;
    const me = pathPoint(path, w.px - w.map.start);
    const p = pathPoint(path, x - w.map.start);
    return { x: PLAYER_SX + p.x - me.x, y: FEET_Y + p.y - me.y, dir: p.dir };
  }

  // Altura da câmera com mais chão (pixels que não são o vazio preto) na faixa onde o treinador anda
  function floorY(img) {
    const mid = (img.height - LH) / 2;
    try {
      const [c, x] = ART.canvas(img.width, img.height);
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, img.width, img.height).data;
      const lit = new Array(img.height).fill(0);
      for (let y = 0; y < img.height; y++) {
        for (let xx = 0; xx < Math.min(img.width, 360); xx += 4) {
          const k = (y * img.width + xx) * 4;
          if (d[k] + d[k + 1] + d[k + 2] > 60) lit[y]++;
        }
      }
      let best = mid, bestScore = -1;
      for (let cy = 0; cy <= img.height - LH; cy += 8) {
        let sc = 0;
        for (let y = cy + FEET_Y - 40; y < cy + FEET_Y + 16; y++) sc += lit[y];
        sc -= Math.abs(cy - mid) * .05; // empate: perto do meio do mapa
        if (sc > bestScore) { bestScore = sc; best = cy; }
      }
      return best;
    } catch (e) {
      return mid; // index.html aberto direto do disco: o navegador não deixa ler os pixels
    }
  }

  function drawMap(w) {
    const img = ART.mapImage(w.map.key);
    lctx.fillStyle = '#000';
    lctx.fillRect(0, 0, LW, LH);
    if (!img) return;
    // a câmera segue o treinador pelo caminho: ele fica sempre no mesmo lugar da tela
    if (w.map.path) {
      const me = pathPoint(w.map.path, w.px - w.map.start);
      lctx.drawImage(img, Math.round(PLAYER_SX - me.x), Math.round(FEET_Y - me.y));
      return;
    }
    const mw = img.width, mh = img.height;
    // a câmera anda na metade da velocidade do treinador e para no fim do mapa
    const cx = mw <= LW ? -(LW - mw) / 2 : Math.min(mw - LW, Math.max(0, (w.px - w.map.start) * .5));
    if (w.map.cy === undefined) w.map.cy = mh <= LH ? -(LH - mh) / 2 : floorY(img);
    const cy = w.map.cy;
    lctx.drawImage(img, -Math.round(cx), -Math.round(cy));
  }

  function walkTo(w, x) {
    w.walking = true;
    w.target = x;
    w.dir = 'right';
    return new Promise(res => { w.onArrive = res; });
  }

  function update(w, dt) {
    if (w.walking) {
      const step = WALK_SPEED * dt;
      w.px += step;
      w.dist += step;
      if (w.px >= w.target) {
        w.px = w.target;
        w.walking = false;
        const f = w.onArrive;
        w.onArrive = null;
        if (f) f();
      }
    }
    for (const o of w.objects) if (o.update) o.update(dt);
    if (w.bubble && (w.bubble.t -= dt) <= 0) w.bubble = null;
    // objetos que já ficaram para trás saem da lista
    const left = w.px - PLAYER_SX - 200;
    w.objects = w.objects.filter(o => (o.right ?? o.x ?? Infinity) > left);
  }

  const camX = w => Math.round(w.px - PLAYER_SX);
  const colOf = x => Math.floor(x / 16);

  // ---------- Mapa ----------
  // Árvore 2x2 com o canto de cima à esquerda em (c, r), em colunas pares
  function treeAt(col, row) {
    const c0 = col - (col & 1);
    for (const r0 of [5, 7, 13]) {
      if (row !== r0 && row !== r0 + 1) continue;
      if (hash(c0 * 3.7 + r0 * 11.3) >= (r0 === 13 ? .14 : .2)) continue;
      // nunca duas árvores coladas na mesma faixa
      if (r0 !== 13 && hash((c0 - 2) * 3.7 + r0 * 11.3) < .2) continue;
      const top = row === r0, left = col === c0;
      return top ? (left ? 'treeTL' : 'treeTR') : (left ? 'treeBL' : 'treeBR');
    }
    return null;
  }

  // Degraus de pedra (só dá para pular para baixo) na grama de baixo
  function ledgeAt(col, row) {
    if (row !== 15) return null;
    const seg = Math.floor(col / 8), start = seg * 8 + 1 + Math.floor(hash(seg * 5.1) * 2), len = 3 + Math.floor(hash(seg * 9.7) * 3);
    if (hash(seg * 2.3) > .45 || col < start || col >= start + len) return null;
    return col === start ? 'ledgeL' : col === start + len - 1 ? 'ledgeR' : 'ledge';
  }

  function baseTile(col, row) {
    const odd = row & 1, side = col & 1;
    if (row <= 2) return odd ? (side ? 'woodD' : 'woodC') : (side ? 'woodB' : 'woodA');
    if (row === 3) return side ? 'trunkB' : 'trunkA';
    if (row === 17) return side ? 'treeTR' : 'treeTL';
    if (row === 18) return side ? 'canopyB' : 'canopyA';
    if (row >= 19) return side ? 'woodD' : 'woodC';
    if (row === PATH_ROW) return 'pathT';
    if (row === PATH_ROW + 1) return 'pathB';
    return null;
  }

  function decoTile(col, row) {
    const odd = row & 1;
    const deco = treeAt(col, row) || ledgeAt(col, row);
    if (deco) return deco;
    if (hash(col * 7.3 + row * 13.1) < .07) return (row + col) % 2 ? 'flowerA' : 'flowerB';
    return 'grass' + odd + (col & 1);
  }

  function tileAt(w, col, row) {
    for (const o of w.objects) if (o.tile) { const t = o.tile(col, row); if (t) return t; }
    const base = baseTile(col, row);
    if (base) return base;
    for (const o of w.objects) if (o.clear && o.clear(col, row)) return 'grass' + (row & 1) + (col & 1);
    return decoTile(col, row);
  }

  // ---------- Desenho ----------
  function draw(ctx, w, party) {
    const cx = camX(w);
    const c0 = Math.floor(cx / 16);
    if (w.map) drawMap(w);
    else {
      for (let c = c0; c <= c0 + 12; c++) {
        for (let r = 0; r < ROWS; r++) ART.drawTile(lctx, tileAt(w, c, r), c * 16 - cx, r * 16);
      }
    }
    // No mapa, cada objeto vai para o seu ponto do caminho: desloca o desenho dele (que é feito
    // como se estivesse na linha reta da rota) até lá
    const onPath = !!(w.map && w.map.path);
    const shift = o => {
      if (!onPath || o.x === undefined) return { x: 0, y: 0 };
      const s = mapScreen(w, o.x);
      return { x: s.x - (o.x - cx), y: s.y - FEET_Y, dir: s.dir };
    };
    const shifted = (c, o, k, fn) => {
      const d = shift(o);
      c.save();
      c.translate(d.x * k, d.y * k);
      fn();
      c.restore();
    };
    // w.face (pesca no mapa) manda; senão no mapa ele olha para onde o caminho vai
    const pdir = w.face || (onPath ? pathPoint(w.map.path, w.px - w.map.start).dir : w.dir);

    // objetos e personagens ordenados pelo y dos pés
    const step = w.walking ? [1, 0, 2, 0][Math.floor(w.dist / 8) % 4] : 0;
    const drawables = w.objects.filter(o => o.draw).map(o => ({
      y: o.y + shift(o).y,
      fn: () => shifted(lctx, o, 1, () => {
        // no mapa não há para onde sair do caminho: quem já batalhou some aos poucos
        if (onPath && o.aside !== undefined) {
          const a = 1 - (performance.now() - o.aside) / 500;
          if (a <= 0) return;
          lctx.globalAlpha = a;
        }
        // no mapa quem espera no caminho olha para o treinador que vem chegando
        if (onPath && o.look && o.y === FEET_Y) {
          const back = { left: 'right', right: 'left', up: 'down', down: 'up' }[shift(o).dir];
          const keep = o.dir;
          o.dir = back;
          o.draw(lctx, cx);
          o.dir = keep;
        } else o.draw(lctx, cx);
      }),
    }));
    drawables.push({ y: FEET_Y + .5, fn: () => ART.drawChar(lctx, 'player', pdir, step, PLAYER_SX, FEET_Y) });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();
    ctx.drawImage(low, 0, 0, W, LH * 2);

    // Pokémon que segue o jogador (em resolução cheia); no mapa ele vem atrás pelo mesmo caminho
    const lead = party.find(m => m.hp > 0);
    if (lead && w.follower) {
      if (onPath) {
        const f = mapScreen(w, w.px - 22);
        drawFollower(ctx, lead, f.x * 2, f.y * 2 - 2, w, f.dir);
        // ele está atrás (mais acima na tela): o treinador fica na frente dele
        if (f.y < FEET_Y) ART.drawChar(ctx, 'player', pdir, step, PLAYER_SX * 2, FEET_Y * 2, 2);
      } else drawFollower(ctx, lead, (PLAYER_SX - 22) * 2, FEET_Y * 2 - 2, w, w.dir);
    }
    // textos e efeitos em resolução cheia
    for (const o of w.objects) if (o.drawHi) shifted(ctx, o, 2, () => o.drawHi(ctx, cx));
    // cavernas escuras: só a luz em volta do treinador (o Flash clareia)
    if (w.map && w.map.dark) {
      const g = ctx.createRadialGradient(PLAYER_SX * 2, FEET_Y * 2 - 20, 60, PLAYER_SX * 2, FEET_Y * 2 - 20, w.map.flash ? 420 : 230);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.82)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, LH * 2);
    }
    if (w.weather) ART.drawWeather(ctx, w.weather, performance.now() / 1000);
    if (w.bubble) {
      const o = w.bubble;
      const at = onPath ? mapScreen(w, o.x) : { x: o.x - cx, y: FEET_Y };
      const bx = at.x * 2, by = at.y * 2 - 58;
      ctx.fillStyle = '#282828'; ctx.fillRect(bx - 9, by - 13, 18, 20);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 7, by - 11, 14, 16);
      UI.text(ctx, '!', bx + 1, by + 2, { size: 10, color: '#e03030', shadow: false });
    }
  }

  // Pokémon andando atrás do jogador. De lado usa o sprite original de seguidor (HeartGold/SoulSilver),
  // trocando o quadro a cada passo; de frente/costas usa o sprite de batalha, com passos que pulam e achatam
  function drawFollower(ctx, mon, cx, groundY, w, dir) {
    if (dir === 'left' || dir === 'right') {
      // um passo a cada 16px, junto com o jogador; parado ele continua mexendo devagar
      const step = w.walking ? Math.floor(w.dist / 16) : Math.floor(performance.now() / 500);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath();
      ctx.ellipse(cx, groundY, 16, 5, 0, 0, 7);
      ctx.fill();
      ART.drawWalker(ctx, mon.id, mon.shiny, dir, step, cx, groundY + 4, 2);
      return;
    }
    const back = dir === 'up';
    const img = ART.monCanvas(mon.id, mon.shiny, back);
    const Z = ART.MON_SIZE;
    const s = .6;
    let hop = 0, tilt = 0, sx = 1, sy = 1;
    if (w.walking) {
      const ph = w.dist / 16 * Math.PI; // um passo a cada 16px, junto com o jogador
      const lift = Math.abs(Math.sin(ph));
      hop = lift * 5;
      tilt = Math.sin(ph) * .09;
      sy = 1 - (1 - lift) * .08 + lift * .04;
      sx = 2 - sy;
    } else {
      const br = Math.sin(performance.now() / 400);
      sy = 1 + br * .02; sx = 1 - br * .02;
    }
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath();
    ctx.ellipse(cx, groundY, 16 * (1 - hop / 20), 5 * (1 - hop / 20), 0, 0, 7);
    ctx.fill();
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(groundY - hop));
    ctx.rotate(tilt);
    ctx.scale(s * sx, s * sy);
    ctx.drawImage(img, -Z / 2, -ART.MON_FEET, Z, Z);
    ctx.restore();
  }

  // ---------- Objetos ----------
  // (x em coordenadas do mundo, y = pés na tela; tudo em baixa resolução)
  function npc(look, x, y = FEET_Y, dir = 'left') {
    return { x, y, look, dir, draw(c, cx) { ART.drawChar(c, this.look, this.dir, 0, this.x - cx, this.y); } };
  }

  // depois da batalha o treinador sai do caminho (sobe para a grama)
  function stepAside(o) {
    o.aside = performance.now();
    if (G().world.map && G().world.map.path) return;
    o.y = TOP_Y - 4;
    o.dir = 'down';
  }
  const G = () => window.GAME.G;

  // Grama alta cobrindo o caminho; quem está dentro some da cintura para baixo, como no GBA
  function tallGrass(x0, cols = 6) {
    const a = colOf(x0), b = a + cols - 1;
    return {
      x: x0, right: (b + 1) * 16, y: 0, shake: 0,
      tile: (col, row) => (row >= 9 && row <= 14 && col >= a && col <= b ? 'tall' : null),
      update(dt) { this.shake = Math.max(0, this.shake - dt); },
      // por cima de quem está dentro (jogador e Pokémon), em resolução cheia
      drawHi(c, cx) {
        const r = Math.floor((FEET_Y - 1) / 16);
        const from = colOf(cx + PLAYER_SX - 40), to = colOf(cx + PLAYER_SX + 8);
        for (let col = Math.max(a, from); col <= Math.min(b, to); col++) {
          ART.drawTile(c, 'tall', (col * 16 - cx) * 2, r * 32 - 4, 3, 2);
        }
        this.drawLeaves(c);
      },
      // folhas voando enquanto a grama balança
      drawLeaves(c) {
        if (this.shake <= 0) return;
        const k = Math.floor(this.shake * 20) % 2;
        for (let i = 0; i < 6; i++) {
          const gx = (PLAYER_SX + (i - 2.5) * 10 + (k ? 2 : -2)) * 2;
          const gy = (FEET_Y - 26 - (i % 3) * 8) * 2 - (1 - this.shake) * 30;
          c.fillStyle = i % 2 ? '#205830' : '#88d070';
          c.fillRect(gx, gy, 4, 4);
        }
      },
    };
  }

  // Lago abaixo do caminho (linhas 13-15)
  function lake(x0, cols = 5) {
    const a = colOf(x0), b = a + cols - 1;
    return {
      x: x0, right: (b + 1) * 16,
      tile: (col, row) => (row >= 13 && row <= 15 && col >= a && col <= b ? 'water' : null),
      center: { x: (a + b + 1) * 8, y: 14 * 16 + 8 },
    };
  }

  function itemBall(x) {
    return {
      x, taken: false,
      drawHi(c, cx) { if (!this.taken) ART.drawItem(c, 0, (x - cx) * 2, FEET_Y * 2 - 12, .7); },
    };
  }

  // Prédio com a porta (base) encostada no caminho, centralizado em x
  function building(kind, x, label) {
    const [bw, bh] = ART.buildingSize(kind);
    return {
      x, right: x + bw / 2, y: TOP_Y,
      draw(c, cx) { ART.drawBuilding(c, kind, x - cx, TOP_Y); },
      drawHi(c, cx) {
        if (label) UI.text(c, label, (x - cx) * 2, (TOP_Y - bh) * 2 - 6, { size: 8, color: '#ffffff', align: 'center', outline: true });
      },
      clear: (col, row) => row >= 3 && row < PATH_ROW && col >= colOf(x - bw / 2) - 1 && col <= colOf(x + bw / 2),
    };
  }

  // Praça de terra acima do caminho (de x0 a x1), ligada a ele pelos cantos internos
  function plaza(x0, x1, rowTop = 7) {
    const a = colOf(x0), b = colOf(x1);
    return {
      x: x0, right: (b + 1) * 16,
      tile(col, row) {
        if (col < a || col > b || row < rowTop || row > PATH_ROW) return null;
        if (row === PATH_ROW) return col === a ? 'pathInTL' : col === b ? 'pathInTR' : 'pathC';
        if (row === rowTop) return col === a ? 'pathTL' : col === b ? 'pathTR' : 'pathT';
        return col === a ? 'pathL' : col === b ? 'pathR' : 'pathC';
      },
    };
  }

  // Placa na beira do caminho com o nome do lugar
  function sign(x, label) {
    const col = colOf(x);
    return {
      x, right: x + 16,
      tile: (c, r) => (c === col && r === PATH_ROW - 1 ? 'sign' : null),
      clear: (c, r) => r >= PATH_ROW - 2 && r < PATH_ROW && Math.abs(c - col) <= 1,
      drawHi(c, cx) {
        if (label) UI.text(c, label, (col * 16 + 8 - cx) * 2, (PATH_ROW - 1) * 32 - 6, { size: 6, color: '#ffffff', align: 'center', outline: true });
      },
    };
  }

  // Ponta da vara e ponto do lago onde cai a boia, em resolução cheia
  function fishingSpots(w, lk) {
    const wet = waterNear(w);
    if (wet) return { hand: { x: PLAYER_SX * 2 + 6, y: (FEET_Y - 12) * 2 }, bob: { x: wet.x * 2, y: wet.y * 2 } };
    const cx = camX(w);
    return {
      hand: { x: PLAYER_SX * 2 + 6, y: (FEET_Y - 12) * 2 },
      bob: { x: (lk.center.x - cx) * 2, y: lk.center.y * 2 },
    };
  }

  // No mapa: o bloco de água mais perto do treinador (posição na tela e para onde ele olha)
  function waterNear(w) {
    const rows = w.map && w.map.path && (window.MAP_WATER || {})[w.map.key];
    if (!rows) return null;
    const me = pathPoint(w.map.path, w.px - w.map.start);
    const tx = Math.floor(me.x / 16), ty = Math.floor((me.y - 1) / 16);
    let best = null;
    for (let y = Math.max(0, ty - 6); y <= Math.min(rows.length - 1, ty + 6); y++) {
      for (let x = Math.max(0, tx - 6); x <= tx + 6; x++) {
        const h = parseInt(rows[y][x >> 2] || '0', 16);
        if (!(h & (8 >> (x & 3)))) continue;
        const d = Math.hypot(x - tx, y - ty);
        if (d >= 1 && (!best || d < best.d)) best = { x, y, d };
      }
    }
    if (!best) return null;
    const dx = best.x - tx, dy = best.y - ty;
    return {
      x: PLAYER_SX + best.x * 16 + 8 - me.x, y: FEET_Y + best.y * 16 + 8 - me.y,
      dir: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'),
    };
  }

  window.WORLD = {
    PLAYER_SX, FEET_Y, TOP_Y, newWorld, setMap, walkTo, update, draw,
    npc, stepAside, tallGrass, lake, itemBall, building, plaza, sign, fishingSpots, waterNear,
  };
})();
