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
    return { px: 0, walking: false, target: null, onArrive: null, dist: 0, objects: [], dir: 'right', follower: true, bubble: null };
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
    for (let c = c0; c <= c0 + 12; c++) {
      for (let r = 0; r < ROWS; r++) ART.drawTile(lctx, tileAt(w, c, r), c * 16 - cx, r * 16);
    }
    // objetos e personagens ordenados pelo y dos pés
    const step = w.walking ? [1, 0, 2, 0][Math.floor(w.dist / 8) % 4] : 0;
    const drawables = w.objects.filter(o => o.draw).map(o => ({ y: o.y, fn: () => o.draw(lctx, cx) }));
    drawables.push({ y: FEET_Y + .5, fn: () => ART.drawChar(lctx, 'player', w.dir, step, PLAYER_SX, FEET_Y) });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();
    ctx.drawImage(low, 0, 0, W, LH * 2);

    // Pokémon que segue o jogador (em resolução cheia)
    const lead = party.find(m => m.hp > 0);
    if (lead && w.follower) drawFollower(ctx, lead, (PLAYER_SX - 22) * 2, FEET_Y * 2 - 2, w);
    // textos e efeitos em resolução cheia
    for (const o of w.objects) if (o.drawHi) o.drawHi(ctx, cx);
    if (w.bubble) {
      const o = w.bubble;
      const bx = (o.x - cx) * 2, by = FEET_Y * 2 - 58;
      ctx.fillStyle = '#282828'; ctx.fillRect(bx - 9, by - 13, 18, 20);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 7, by - 11, 14, 16);
      UI.text(ctx, '!', bx + 1, by + 2, { size: 10, color: '#e03030', shadow: false });
    }
  }

  // Pokémon andando atrás do jogador. De lado usa o sprite original de seguidor (HeartGold/SoulSilver),
  // trocando o quadro a cada passo; de frente/costas usa o sprite de batalha, com passos que pulam e achatam
  function drawFollower(ctx, mon, cx, groundY, w) {
    if (w.dir === 'left' || w.dir === 'right') {
      // um passo a cada 16px, junto com o jogador; parado ele continua mexendo devagar
      const step = w.walking ? Math.floor(w.dist / 16) : Math.floor(performance.now() / 500);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath();
      ctx.ellipse(cx, groundY, 16, 5, 0, 0, 7);
      ctx.fill();
      ART.drawWalker(ctx, mon.id, mon.shiny, w.dir, step, cx, groundY + 4, 2);
      return;
    }
    const back = w.dir === 'up';
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
    o.y = TOP_Y - 4;
    o.dir = 'down';
  }

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
    const cx = camX(w);
    return {
      hand: { x: PLAYER_SX * 2 + 6, y: (FEET_Y - 12) * 2 },
      bob: { x: (lk.center.x - cx) * 2, y: lk.center.y * 2 },
    };
  }

  window.WORLD = {
    PLAYER_SX, FEET_Y, TOP_Y, newWorld, walkTo, update, draw,
    npc, stepAside, tallGrass, lake, itemBall, building, plaza, sign, fishingSpots,
  };
})();
