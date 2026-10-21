// Golpes de verdade do FireRed/LeafGreen (assets/moves.js, gerado da PokéAPI) adaptados para a
// batalha em tempo real: nome em português e o jeito de cada golpe na arena.
// Tipos de golpe na arena (ver js/battle.js):
//  proj   projétil (count = leque, burst = rajada em sequência, homing = teleguiado)
//  beam   raio em linha reta após carregar
//  dash   investida corpo a corpo
//  strike impacto em área na posição do alvo após um aviso (pode desviar)
//  nova   onda em área ao redor de quem usou
(function () {
  const NAMES = {
    'absorb': 'Absorver', 'acid': 'Ácido', 'aerial-ace': 'Ás dos Ares', 'air-cutter': 'Cortador de Ar',
    'ancient-power': 'Poder Ancestral', 'astonish': 'Assombro', 'aurora-beam': 'Raio Aurora', 'barrage': 'Barragem',
    'bind': 'Amarrar', 'bite': 'Mordida', 'blizzard': 'Nevasca', 'body-slam': 'Pancada Corporal',
    'bone-club': 'Clava de Osso', 'bone-rush': 'Ataque de Osso', 'bonemerang': 'Ossomerangue', 'bounce': 'Quique',
    'brick-break': 'Quebra-Telha', 'bubble': 'Bolha', 'bubble-beam': 'Jato de Bolhas', 'clamp': 'Apertar',
    'comet-punch': 'Soco Cometa', 'confusion': 'Confusão', 'constrict': 'Constrição', 'covet': 'Cobiça',
    'crabhammer': 'Martelo de Caranguejo', 'cross-chop': 'Golpe Cruzado', 'crunch': 'Triturar', 'dig': 'Cavar',
    'dizzy-punch': 'Soco Tonteante', 'double-edge': 'Ataque Arriscado', 'double-kick': 'Chute Duplo',
    'double-slap': 'Tapa Duplo', 'dragon-breath': 'Sopro do Dragão', 'dragon-rage': 'Fúria do Dragão',
    'drill-peck': 'Bicada Broca', 'dynamic-punch': 'Soco Dinâmico', 'earthquake': 'Terremoto', 'egg-bomb': 'Bomba de Ovo',
    'ember': 'Brasa', 'extreme-speed': 'Velocidade Extrema', 'false-swipe': 'Golpe Falso', 'feint-attack': 'Ataque Dissimulado',
    'fire-blast': 'Explosão de Fogo', 'fire-punch': 'Soco de Fogo', 'fire-spin': 'Giro de Fogo', 'flame-wheel': 'Roda de Fogo',
    'flamethrower': 'Lança-chamas', 'fury-attack': 'Ataque Furioso', 'fury-cutter': 'Cortador Furioso',
    'fury-swipes': 'Arranhões Furiosos', 'future-sight': 'Visão do Futuro', 'giga-drain': 'Giga Dreno', 'gust': 'Rajada de Vento',
    'headbutt': 'Cabeçada', 'heat-wave': 'Onda de Calor', 'high-jump-kick': 'Chute Alto', 'horn-attack': 'Ataque de Chifre',
    'hydro-pump': 'Hidro Bomba', 'hyper-beam': 'Hiper Raio', 'hyper-fang': 'Hiper Presa', 'hyper-voice': 'Hiper Voz',
    'ice-beam': 'Raio de Gelo', 'ice-punch': 'Soco de Gelo', 'icicle-spear': 'Lança de Gelo', 'icy-wind': 'Vento Gelado',
    'iron-tail': 'Cauda de Ferro', 'jump-kick': 'Chute com Salto', 'karate-chop': 'Golpe de Caratê', 'knock-off': 'Derrubar',
    'leech-life': 'Sanguessuga', 'lick': 'Lambida', 'low-kick': 'Chute Baixo', 'mach-punch': 'Soco Rápido',
    'magical-leaf': 'Folha Mágica', 'mega-drain': 'Mega Dreno', 'mega-kick': 'Mega Chute', 'mega-punch': 'Mega Soco',
    'megahorn': 'Megachifre', 'metal-claw': 'Garra de Metal', 'meteor-mash': 'Soco Meteoro', 'mud-shot': 'Tiro de Lama',
    'mud-slap': 'Tapa de Lama', 'night-shade': 'Sombra Noturna', 'outrage': 'Ultraje', 'pay-day': 'Dia de Pagamento',
    'peck': 'Bicada', 'petal-dance': 'Dança das Pétalas', 'pin-missile': 'Míssil de Agulha', 'poison-fang': 'Presa Venenosa',
    'poison-sting': 'Ferrão Venenoso', 'pound': 'Pancada', 'powder-snow': 'Neve em Pó', 'psybeam': 'Psicorraio',
    'psychic': 'Psíquico', 'quick-attack': 'Ataque Rápido', 'rage': 'Fúria', 'rapid-spin': 'Giro Rápido',
    'razor-leaf': 'Folha Navalha', 'rock-blast': 'Explosão de Rocha', 'rock-throw': 'Lançar Pedra', 'rolling-kick': 'Chute Giratório',
    'rollout': 'Rolagem', 'sand-tomb': 'Tumba de Areia', 'scratch': 'Arranhão', 'seismic-toss': 'Movimento Sísmico',
    'shadow-ball': 'Bola Sombria', 'shadow-punch': 'Soco Sombrio', 'signal-beam': 'Raio Sinal', 'silver-wind': 'Vento Prateado',
    'skull-bash': 'Golpe de Crânio', 'sky-attack': 'Ataque do Céu', 'sky-uppercut': 'Gancho Celeste', 'slam': 'Pancada Forte',
    'slash': 'Talho', 'sludge': 'Lodo', 'sludge-bomb': 'Bomba de Lodo', 'smog': 'Fumaça', 'solar-beam': 'Raio Solar',
    'sonic-boom': 'Bomba Sônica', 'spark': 'Faísca', 'spike-cannon': 'Canhão de Espinhos', 'stomp': 'Pisotear',
    'submission': 'Submissão', 'super-fang': 'Superpresa', 'superpower': 'Superpoder', 'swift': 'Meteoros',
    'tackle': 'Investida', 'take-down': 'Desmantelar', 'thrash': 'Debater-se', 'thunder': 'Trovão',
    'thunder-punch': 'Soco Trovão', 'thunder-shock': 'Choque do Trovão', 'thunderbolt': 'Relâmpago', 'tri-attack': 'Ataque Triplo',
    'twineedle': 'Agulha Dupla', 'twister': 'Tornado', 'vice-grip': 'Agarrar', 'vine-whip': 'Chicote de Vinha',
    'vital-throw': 'Arremesso Vital', 'water-gun': "Jato d'Água", 'waterfall': 'Cachoeira', 'wing-attack': 'Ataque de Asa',
    'wrap': 'Enrolar', 'zap-cannon': 'Canhão Elétrico',
  };

  // Jeito de cada golpe na arena. Sem entrada: físico vira investida (dash), especial vira projétil.
  // split = rajada/leque de n tiros que dividem a força do golpe; slow = deixa o alvo lento (segundos)
  const STYLE = {
    // fogo
    'ember': { kind: 'proj', speed: 230 },
    'flamethrower': { kind: 'proj', burst: 6, speed: 260, r: 6, gap: .07, jitter: .18 },
    'fire-blast': { kind: 'proj', speed: 200, r: 13, knock: 140 },
    'fire-spin': { kind: 'strike', delay: .5, radius: 24, slow: 1.2 },
    'heat-wave': { kind: 'nova', radius: 105 },
    // água
    'water-gun': { kind: 'proj', speed: 250 },
    'bubble': { kind: 'proj', count: 3, spread: .3, speed: 170, r: 5, slow: .8 },
    'bubble-beam': { kind: 'proj', burst: 4, speed: 220, r: 6, gap: .08, jitter: .12, slow: 1 },
    'hydro-pump': { kind: 'proj', speed: 240, r: 13, knock: 140 },
    'clamp': { slow: 1.5 },
    'crabhammer': { knock: 130 },
    // elétrico
    'thunder-shock': { kind: 'proj', speed: 280, zigzag: true },
    'thunderbolt': { kind: 'proj', speed: 300, r: 7, zigzag: true },
    'thunder': { kind: 'strike', delay: .7, radius: 30 },
    'zap-cannon': { kind: 'proj', speed: 150, r: 12, homing: 2.5 },
    // planta
    'absorb': { kind: 'proj', speed: 200, r: 5, homing: 2.5 },
    'mega-drain': { kind: 'proj', speed: 200, r: 7, homing: 2.5 },
    'giga-drain': { kind: 'proj', speed: 200, r: 9, homing: 2.5 },
    'razor-leaf': { kind: 'proj', count: 3, spread: .32, speed: 240 },
    'magical-leaf': { kind: 'proj', count: 2, spread: .4, speed: 220, homing: 3.5 },
    'petal-dance': { kind: 'proj', count: 5, spread: .45, speed: 210 },
    'solar-beam': { kind: 'beam', charge: 1.2, width: 22 },
    // gelo
    'powder-snow': { kind: 'proj', count: 3, spread: .35, speed: 190, slow: 1 },
    'icy-wind': { kind: 'proj', speed: 200, r: 7, slow: 1.5 },
    'ice-beam': { kind: 'beam', charge: .45, width: 10, slow: 2.5 },
    'aurora-beam': { kind: 'beam', charge: .35, width: 9, slow: 1 },
    'blizzard': { kind: 'strike', delay: .7, radius: 22, count: 3, scatter: 34, slow: 2 },
    'icicle-spear': { kind: 'proj', burst: 3, speed: 280, r: 4, gap: .1, jitter: .08 },
    'ice-punch': { slow: 1.2 },
    // veneno
    'poison-sting': { kind: 'proj', speed: 260, r: 4 },
    'acid': { kind: 'proj', speed: 220, r: 6 },
    'smog': { kind: 'strike', delay: .5, radius: 24 },
    'sludge': { kind: 'proj', speed: 200, r: 9 },
    'sludge-bomb': { kind: 'strike', delay: .8, radius: 28 },
    // terra
    'mud-slap': { kind: 'proj', speed: 210, r: 6, slow: .8 },
    'mud-shot': { kind: 'proj', speed: 210, r: 7, slow: 1.5 },
    'bonemerang': { kind: 'proj', burst: 2, speed: 230, r: 6, gap: .25, homing: 2 },
    'dig': { kind: 'strike', delay: .9, radius: 24 },
    'earthquake': { kind: 'nova', radius: 115 },
    'sand-tomb': { kind: 'strike', delay: .6, radius: 26, slow: 1.5 },
    // voador
    'gust': { kind: 'proj', speed: 190, r: 10 },
    'air-cutter': { kind: 'proj', count: 2, spread: .25, speed: 260 },
    'bounce': { kind: 'strike', delay: .9, radius: 24 },
    'sky-attack': { charge: 1, knock: 160 },
    // psíquico
    'confusion': { kind: 'proj', speed: 180, r: 7, homing: 3 },
    'psybeam': { kind: 'beam', charge: .3, width: 8 },
    'psychic': { kind: 'strike', delay: .45, radius: 26 },
    'future-sight': { kind: 'strike', delay: 1.6, radius: 32 },
    // inseto
    'pin-missile': { kind: 'proj', burst: 4, speed: 300, r: 3, gap: .09, jitter: .08 },
    'twineedle': { kind: 'proj', burst: 2, speed: 300, r: 3, gap: .12, jitter: .05 },
    'signal-beam': { kind: 'beam', charge: .4, width: 10 },
    'silver-wind': { kind: 'proj', count: 3, spread: .4, speed: 200, r: 6 },
    // pedra
    'rock-throw': { kind: 'strike', delay: .6, radius: 18 },
    'rock-blast': { kind: 'proj', burst: 3, speed: 230, r: 6, gap: .14, jitter: .1 },
    'ancient-power': { kind: 'strike', delay: .6, radius: 20, count: 2, scatter: 30 },
    // fantasma
    'lick': {},
    'night-shade': { kind: 'proj', speed: 170, r: 8, homing: 3 },
    'shadow-ball': { kind: 'proj', speed: 170, r: 10, homing: 2.5 },
    // dragão
    'dragon-rage': { kind: 'proj', speed: 210, r: 9 },
    'dragon-breath': { kind: 'proj', speed: 210, r: 8 },
    'twister': { kind: 'nova', radius: 80 },
    // normal
    'swift': { kind: 'proj', count: 3, spread: .5, speed: 220, r: 5, homing: 4 },
    'sonic-boom': { kind: 'proj', speed: 260, r: 6 },
    'hyper-beam': { kind: 'beam', charge: .9, width: 16 },
    'hyper-voice': { kind: 'nova', radius: 105 },
    'tri-attack': { kind: 'proj', count: 3, spread: .3, speed: 230 },
    'egg-bomb': { kind: 'strike', delay: .7, radius: 26 },
    'barrage': { kind: 'proj', burst: 3, speed: 220, r: 6, gap: .12, jitter: .1 },
    'spike-cannon': { kind: 'proj', burst: 4, speed: 280, r: 4, gap: .09, jitter: .08 },
    'pay-day': { kind: 'proj', count: 3, spread: .4, speed: 220, r: 4 },
    'skull-bash': { charge: .8, knock: 160 },
    'mega-kick': { knock: 150 },
    'iron-tail': { knock: 150 },
    'high-jump-kick': { knock: 160 },
  };

  const DATA = window.MOVEDEX, LEARN = window.LEARNSETS;
  // efeitos de status (chance no FireRed) que existem na arena
  const AILMENT = { burn: 'burn', paralysis: 'para', poison: 'poison' };

  const cache = {};

  // Golpe pronto para a batalha a partir do nome na PokéAPI (ex.: 'thunder-punch')
  function get(key) {
    if (cache[key]) return cache[key];
    const d = DATA[key];
    if (!d) return null;
    const st = STYLE[key] || {};
    const phys = d.cls === 'physical';
    const kind = st.kind || (phys ? 'dash' : 'proj');
    // golpes de 2 a 5 acertos batem em média 3 vezes
    const total = d.pow * (d.hits >= 5 ? 3 : d.hits);
    const shots = (st.burst || 1) * (st.count || 1);
    const m = {
      key, name: NAMES[key] || key, type: d.type, kind, phys,
      pow: Math.max(1, Math.round(total / shots)), total,
      cd: Math.min(8, Math.max(1.2, 1.5 + (total - 40) * .055)) * (d.prio > 0 ? .7 : 1),
      ...st,
    };
    if (kind === 'proj') { m.speed = m.speed || 230; m.r = m.r || Math.min(12, 4 + Math.round(total / 25)); }
    if (kind === 'beam') { m.charge = m.charge || .5; m.width = m.width || 10; }
    if (kind === 'strike') { m.delay = m.delay || .6; m.radius = m.radius || 22; }
    if (kind === 'nova') m.radius = m.radius || 100;
    if (m.burst && !m.gap) m.gap = .09;
    const ail = AILMENT[d.ailment];
    if (ail && d.chance) m[ail] = d.chance / 100;
    if (d.crit) m.crit = .2;
    if (d.drain > 0) m.drain = d.drain / 100;
    if (d.drain < 0) m.recoil = -d.drain / 100;
    cache[key] = m;
    return m;
  }

  const learnset = id => LEARN[id] || [];

  window.MOVELIST = { get, learnset, NAMES };
})();
