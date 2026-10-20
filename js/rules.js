// Regras do jogo: tipos, golpes, treinadores, ginásios, loja e progressão.
(function () {
  const DEX = {};
  for (const p of window.POKEDEX) DEX[p.id] = p;

  // Multiplicadores atacante -> defensor (só os diferentes de 1)
  const TYPE_CHART = {
    normal: { rock: .5, ghost: 0, steel: .5 },
    fire: { fire: .5, water: .5, grass: 2, ice: 2, bug: 2, rock: .5, dragon: .5, steel: 2 },
    water: { fire: 2, water: .5, grass: .5, ground: 2, rock: 2, dragon: .5 },
    electric: { water: 2, electric: .5, grass: .5, ground: 0, flying: 2, dragon: .5 },
    grass: { fire: .5, water: 2, grass: .5, poison: .5, ground: 2, flying: .5, bug: .5, rock: 2, dragon: .5, steel: .5 },
    ice: { fire: .5, water: .5, grass: 2, ice: .5, ground: 2, flying: 2, dragon: 2, steel: .5 },
    fighting: { normal: 2, ice: 2, poison: .5, flying: .5, psychic: .5, bug: .5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: .5 },
    poison: { grass: 2, poison: .5, ground: .5, rock: .5, ghost: .5, steel: 0, fairy: 2 },
    ground: { fire: 2, electric: 2, grass: .5, poison: 2, flying: 0, bug: .5, rock: 2, steel: 2 },
    flying: { electric: .5, grass: 2, fighting: 2, bug: 2, rock: .5, steel: .5 },
    psychic: { fighting: 2, poison: 2, psychic: .5, dark: 0, steel: .5 },
    bug: { fire: .5, grass: 2, fighting: .5, poison: .5, flying: .5, psychic: 2, ghost: .5, dark: 2, steel: .5, fairy: .5 },
    rock: { fire: 2, ice: 2, fighting: .5, ground: .5, flying: 2, bug: 2, steel: .5 },
    ghost: { normal: 0, psychic: 2, ghost: 2, dark: .5 },
    dragon: { dragon: 2, steel: .5, fairy: 0 },
    dark: { fighting: .5, psychic: 2, ghost: 2, dark: .5, fairy: .5 },
    steel: { fire: .5, water: .5, electric: .5, ice: 2, rock: 2, steel: .5, fairy: 2 },
    fairy: { fire: .5, fighting: 2, poison: .5, dragon: 2, dark: 2, steel: .5 },
  };

  function effectiveness(atkType, defTypes) {
    if (!atkType) return 1;
    let m = 1;
    for (const t of defTypes) {
      const v = TYPE_CHART[atkType][t];
      if (v !== undefined) m *= v;
    }
    return m;
  }

  const TYPE_INFO = {
    normal: { pt: 'Normal', color: '#a8a878' }, fire: { pt: 'Fogo', color: '#f08030' },
    water: { pt: 'Água', color: '#6890f0' }, electric: { pt: 'Elétrico', color: '#f8d030' },
    grass: { pt: 'Planta', color: '#78c850' }, ice: { pt: 'Gelo', color: '#98d8d8' },
    fighting: { pt: 'Lutador', color: '#c03028' }, poison: { pt: 'Veneno', color: '#a040a0' },
    ground: { pt: 'Terra', color: '#e0c068' }, flying: { pt: 'Voador', color: '#a890f0' },
    psychic: { pt: 'Psíquico', color: '#f85888' }, bug: { pt: 'Inseto', color: '#a8b820' },
    rock: { pt: 'Pedra', color: '#b8a038' }, ghost: { pt: 'Fantasma', color: '#705898' },
    dragon: { pt: 'Dragão', color: '#7038f8' }, dark: { pt: 'Sombrio', color: '#705848' },
    steel: { pt: 'Aço', color: '#b8b8d0' }, fairy: { pt: 'Fada', color: '#ee99ac' },
  };

  // Tipos de golpe:
  //  proj   projétil (count = leque, burst = rajada em sequência, homing = teleguiado)
  //  beam   raio em linha reta após carregar
  //  dash   investida corpo a corpo (físico)
  //  strike impacto em área na posição do alvo após um aviso (pode desviar)
  //  nova   onda em área ao redor de quem usou
  const MOVES = {
    normal: [
      { name: 'Investida', kind: 'dash', pow: 40, cd: 1.6 },
      { name: 'Hiper Raio', kind: 'beam', pow: 110, cd: 7, charge: .9, width: 16, lvl: 22 }],
    fire: [
      { name: 'Brasa', kind: 'proj', pow: 40, cd: 1.5, speed: 230, r: 5, burn: .1 },
      { name: 'Lança-chamas', kind: 'proj', pow: 20, cd: 4.5, speed: 260, r: 6, burst: 6, gap: .07, jitter: .18, burn: .1, lvl: 20 }],
    water: [
      { name: "Jato d'Água", kind: 'proj', pow: 40, cd: 1.5, speed: 250, r: 5 },
      { name: 'Hidro Bomba', kind: 'proj', pow: 110, cd: 6, speed: 240, r: 13, knock: 140, lvl: 22 }],
    electric: [
      { name: 'Choque do Trovão', kind: 'proj', pow: 40, cd: 1.5, speed: 280, r: 5, zigzag: true, para: .1 },
      { name: 'Trovão', kind: 'strike', pow: 110, cd: 6, delay: .7, radius: 30, para: .3, lvl: 22 }],
    grass: [
      { name: 'Folha Navalha', kind: 'proj', pow: 22, cd: 1.8, speed: 240, r: 5, count: 3, spread: .32, crit: .2 },
      { name: 'Raio Solar', kind: 'beam', pow: 120, cd: 7, charge: 1.2, width: 22, lvl: 24 }],
    ice: [
      { name: 'Vento Gelado', kind: 'proj', pow: 45, cd: 1.7, speed: 200, r: 7, slow: 1.5 },
      { name: 'Raio de Gelo', kind: 'beam', pow: 90, cd: 5, charge: .45, width: 10, slow: 2.5, lvl: 22 }],
    fighting: [
      { name: 'Golpe de Caratê', kind: 'dash', pow: 50, cd: 1.6, crit: .2 },
      { name: 'Chute Alto', kind: 'dash', pow: 100, cd: 4.5, knock: 160, lvl: 22 }],
    poison: [
      { name: 'Ferrão Venenoso', kind: 'proj', pow: 30, cd: 1.4, speed: 260, r: 4, poison: .3 },
      { name: 'Bomba de Lodo', kind: 'strike', pow: 90, cd: 5, delay: .8, radius: 28, poison: .35, lvl: 22 }],
    ground: [
      { name: 'Tiro de Lama', kind: 'proj', pow: 35, cd: 1.8, speed: 210, r: 7, slow: 1.2 },
      { name: 'Terremoto', kind: 'nova', pow: 100, cd: 6.5, radius: 115, lvl: 24 }],
    flying: [
      { name: 'Rajada de Vento', kind: 'proj', pow: 40, cd: 1.6, speed: 190, r: 10 },
      { name: 'Golpe Aéreo', kind: 'dash', pow: 90, cd: 4.5, lvl: 22 }],
    psychic: [
      { name: 'Confusão', kind: 'proj', pow: 50, cd: 1.7, speed: 180, r: 7, homing: 3 },
      { name: 'Psíquico', kind: 'strike', pow: 90, cd: 4.5, delay: .45, radius: 26, lvl: 22 }],
    bug: [
      { name: 'Míssil de Agulha', kind: 'proj', pow: 14, cd: 1.8, speed: 300, r: 3, burst: 4, gap: .09, jitter: .08 },
      { name: 'Tesoura X', kind: 'dash', pow: 80, cd: 4, lvl: 22 }],
    rock: [
      { name: 'Lançar Pedra', kind: 'strike', pow: 50, cd: 1.9, delay: .6, radius: 18 },
      { name: 'Deslize de Pedras', kind: 'strike', pow: 75, cd: 5, delay: .7, radius: 22, count: 3, scatter: 34, lvl: 22 }],
    ghost: [
      { name: 'Lambida', kind: 'dash', pow: 30, cd: 1.5, para: .3 },
      { name: 'Bola Sombria', kind: 'proj', pow: 80, cd: 4, speed: 170, r: 10, homing: 2.5, lvl: 22 }],
    dragon: [
      { name: 'Sopro do Dragão', kind: 'proj', pow: 60, cd: 2, speed: 210, r: 8, para: .3 },
      { name: 'Pulso do Dragão', kind: 'proj', pow: 90, cd: 4.5, speed: 220, r: 12, homing: 2, lvl: 24 }],
    steel: [
      { name: 'Garra de Metal', kind: 'dash', pow: 50, cd: 1.6 },
      { name: 'Cauda de Ferro', kind: 'dash', pow: 100, cd: 4.5, knock: 150, lvl: 24 }],
    fairy: [
      { name: 'Voz Encantadora', kind: 'proj', pow: 40, cd: 1.5, speed: 190, r: 6, homing: 3 },
      { name: 'Brilho Mágico', kind: 'nova', pow: 80, cd: 5, radius: 100, lvl: 22 }],
    dark: [
      { name: 'Mordida', kind: 'dash', pow: 60, cd: 1.7 },
      { name: 'Pulso Sombrio', kind: 'proj', pow: 80, cd: 4, speed: 230, r: 9, lvl: 22 }],
  };
  for (const t in MOVES) for (const m of MOVES[t]) m.type = t;

  const SPLASH = { name: 'Pirueta', kind: 'splash', pow: 0, cd: 2.5, type: 'water' };
  const STRUGGLE = { name: 'Debater', kind: 'dash', pow: 50, cd: 1.8, type: null };

  // Golpes extras de algumas espécies (como no FireRed: Charmander aprende Garra de Metal)
  const FLASH_CANNON = { name: 'Canhão de Luz', kind: 'proj', type: 'steel', pow: 65, cd: 2.2, speed: 240, r: 7 };
  const EXTRA_MOVES = {
    4: [[FLASH_CANNON, 6]], 5: [[FLASH_CANNON, 6]], 6: [[FLASH_CANNON, 6]],
    7: [[MOVES.dark[0], 10]], 8: [[MOVES.dark[0], 10]], 9: [[MOVES.dark[0], 10]],
    25: [[MOVES.steel[1], 26]], 26: [[MOVES.steel[1], 26]],
  };

  // Golpes do Pokémon de acordo com tipos e nível
  function movesFor(mon) {
    const sp = DEX[mon.id];
    if (mon.id === 129) {
      return mon.lvl >= 15 ? [SPLASH, MOVES.normal[0]] : [SPLASH];
    }
    const out = [];
    const [t1, t2] = sp.types;
    out.push(MOVES[t1][0]);
    if (t2) out.push(MOVES[t2][0]);
    if (t1 !== 'normal' && t2 !== 'normal') out.push(MOVES.normal[0]);
    if (mon.lvl >= MOVES[t1][1].lvl) out.push(MOVES[t1][1]);
    if (t2 && mon.lvl >= MOVES[t2][1].lvl + 6) out.push(MOVES[t2][1]);
    for (const [move, lvl] of EXTRA_MOVES[mon.id] || []) {
      if (mon.lvl >= lvl && !out.includes(move)) out.push(move);
    }
    return out;
  }

  function newMovesAt(mon, oldLvl) {
    const before = new Set(movesFor({ ...mon, lvl: oldLvl }).map(m => m.name));
    return movesFor(mon).filter(m => !before.has(m.name));
  }

  // Progressão: evento, ginásio, evento, ginásio... (8 ginásios), mais um evento,
  // a Elite dos 4 e o Campeão.  R = evento aleatório
  const ROUTE = [];
  for (let i = 0; i < 8; i++) ROUTE.push('R', 'gym');
  ROUTE.push('R', 'elite', 'elite', 'elite', 'elite', 'champion');
  // Nível base dos eventos de cada parada
  const SLOT_LEVEL = [4, 8, 9, 13, 14, 17, 18, 21, 22, 26, 26, 30, 30, 34, 34, 38, 38, 42, 43, 44, 45, 47];
  // Depois de cada vitória o time descansa e recupera parte da vida
  const REST_HEAL = .25;
  // Bônus de dano dos Pokémon do jogador (o herói sempre luta melhor)
  const PLAYER_POWER = 1.35;
  // Redução do dano que os Pokémon do jogador recebem
  const PLAYER_GUARD = .85;

  // Os 8 ginásios de Kanto, com os times do FireRed em níveis menores
  const GYMS = [
    {
      leader: 'Brock', city: 'Pewter', type: 'rock', badge: 'Insígnia Rocha', look: 'brock',
      team: [[74, 5], [95, 6]], money: 100,
      intro: 'Sou Brock, Líder de Pewter! Minha defesa de pedra é dura como rocha!',
      lose: 'Eu subestimei você... Leve a Insígnia Rocha!',
    },
    {
      leader: 'Misty', city: 'Cerulean', type: 'water', badge: 'Insígnia Cascata', look: 'misty',
      team: [[120, 9], [121, 10]], money: 100,
      intro: 'Sou Misty, a sereia de Cerulean! Prepare-se para se molhar!',
      lose: 'Uau, você é forte! Tome a Insígnia Cascata.',
    },
    {
      leader: 'Lt. Surge', city: 'Vermilion', type: 'electric', badge: 'Insígnia Trovão', look: 'surge',
      team: [[100, 16], [25, 17], [26, 19]], money: 100,
      intro: 'Ei, garoto! Meus Pokémon elétricos me salvaram na guerra. Vão te eletrocutar!',
      lose: 'Uau! Você é eletrizante! A Insígnia Trovão é sua!',
    },
    {
      leader: 'Erika', city: 'Celadon', type: 'grass', badge: 'Insígnia Arco-íris', look: 'erika',
      team: [[71, 21], [114, 21], [45, 23]], money: 100,
      intro: 'Olá... Sou Erika. Adoro arranjos de flores. Que tal uma batalha?',
      lose: 'Oh! Eu me rendo. Você merece a Insígnia Arco-íris.',
    },
    {
      leader: 'Koga', city: 'Fuchsia', type: 'poison', badge: 'Insígnia Alma', look: 'koga',
      team: [[109, 25], [89, 26], [109, 25], [110, 28]], money: 100,
      intro: 'Fwahahaha! Um ninja domina a arte do veneno. Sinta o desespero!',
      lose: 'Hmm! Você provou seu valor. Leve a Insígnia Alma.',
    },
    {
      leader: 'Sabrina', city: 'Saffron', type: 'psychic', badge: 'Insígnia Pântano', look: 'sabrina',
      team: [[64, 29], [122, 29], [49, 30], [65, 32]], money: 100,
      intro: 'Eu já sabia que você viria. Vi isso nas minhas visões...',
      lose: 'Esta derrota me choca! Mas... tome a Insígnia Pântano.',
    },
    {
      leader: 'Blaine', city: 'Cinnabar', type: 'fire', badge: 'Insígnia Vulcão', look: 'blaine',
      team: [[58, 32], [77, 33], [78, 34], [59, 36]], money: 100,
      intro: 'Hah! Meus Pokémon de fogo vão te reduzir a cinzas! Tem queimadura aí?',
      lose: 'Eu me queimei! Você merece a Insígnia Vulcão!',
    },
    {
      leader: 'Giovanni', city: 'Viridian', type: 'ground', badge: 'Insígnia Terra', look: 'giovanni',
      team: [[111, 36], [51, 36], [31, 37], [34, 38], [112, 40]], money: 100,
      intro: 'Bem-vindo. Eu sou Giovanni, o chefe da Equipe Rocket. Mostre o que sabe!',
      lose: 'Ha! Que batalha! Leve a Insígnia Terra. A Equipe Rocket vai acabar...',
    },
  ];

  // Elite dos 4 (em sequência, sem Centro Pokémon entre as salas)
  const ELITE = [
    {
      name: 'Lorelei', type: 'ice', look: 'lorelei', arena: 'lorelei',
      team: [[87, 41], [91, 41], [80, 42], [124, 42], [131, 44]],
      intro: 'Bem-vindo à Liga Pokémon. Sou Lorelei, da Elite dos 4. Vou te congelar!',
      lose: 'Você é melhor do que eu pensava. Siga em frente!',
    },
    {
      name: 'Bruno', type: 'fighting', look: 'bruno', arena: 'bruno',
      team: [[95, 41], [107, 42], [106, 42], [95, 43], [68, 45]],
      intro: 'Sou Bruno, da Elite dos 4! Vou te esmagar com força bruta! Hoo hah!',
      lose: 'Eu perdi?! Meu treino não foi suficiente...',
    },
    {
      name: 'Agatha', type: 'ghost', look: 'agatha', arena: 'agatha',
      team: [[94, 42], [42, 42], [93, 43], [24, 44], [94, 46]],
      intro: 'Sou Agatha, da Elite dos 4. Pokémon servem para lutar! Vou te mostrar!',
      lose: 'Você venceu! Agora entendo por que o velho Carvalho te elogia.',
    },
    {
      name: 'Lance', type: 'dragon', look: 'lance', arena: 'lance',
      team: [[130, 43], [148, 43], [148, 43], [142, 45], [149, 47]],
      intro: 'Sou Lance, o mestre dos dragões e o último da Elite dos 4. Prepare-se!',
      lose: 'Inacreditável... Você é um treinador de verdade. O Campeão te espera.',
    },
  ];

  // Time do campeão (Blue) de acordo com o inicial escolhido
  const CHAMPION_TEAMS = {
    1: [[18, 45], [65, 45], [112, 46], [103, 46], [130, 47], [6, 49]],
    4: [[18, 45], [65, 45], [112, 46], [59, 46], [103, 47], [9, 49]],
    7: [[18, 45], [65, 45], [112, 46], [130, 46], [59, 47], [3, 49]],
  };
  const RIVAL_STARTER = { 1: 4, 4: 7, 7: 1 };

  const TRAINER_CLASSES = [
    { cls: 'Caça-Insetos', look: 'bug', pool: [10, 13, 46, 48, 123, 127], money: 12 },
    { cls: 'Jovem', look: 'youngster', pool: [19, 21, 16, 29, 32, 56, 52, 23, 27], money: 16 },
    { cls: 'Garota', look: 'lass', pool: [39, 35, 43, 16, 19, 25, 52, 69], money: 16 },
    { cls: 'Alpinista', look: 'hiker', pool: [74, 95, 66, 27, 50, 104, 111], money: 30 },
    { cls: 'Nadador', look: 'swimmer', pool: [72, 118, 60, 54, 79, 86, 90, 98, 116, 120], money: 20 },
    { cls: 'Criador de Aves', look: 'birdkeeper', pool: [16, 21, 83, 84, 17, 22, 85], money: 25 },
    { cls: 'Faixa-Preta', look: 'blackbelt', pool: [56, 66, 106, 107, 57], money: 25 },
    { cls: 'Médium', look: 'channeler', pool: [92, 96, 63, 122], money: 30 },
    { cls: 'Nerd', look: 'nerd', pool: [81, 100, 88, 109, 25, 137], money: 25 },
    { cls: 'Domador', look: 'tamer', pool: [37, 58, 77, 23, 24, 128], money: 35 },
    { cls: 'Beldade', look: 'beauty', pool: [43, 44, 69, 70, 35, 39, 118], money: 30 },
    { cls: 'Cavalheiro', look: 'gentleman', pool: [58, 37, 52, 128, 84], money: 40 },
    { cls: 'Marinheiro', look: 'sailor', pool: [66, 72, 98, 116, 90, 67], money: 25 },
    { cls: 'Piqueniqueira', look: 'picnicker', pool: [43, 69, 16, 39, 25, 102], money: 18 },
    { cls: 'Maníaco Pokémon', look: 'maniac', pool: [104, 105, 79, 111, 30, 112], money: 30 },
    { cls: 'Treinadora Ás', look: 'cooltrainer', pool: [17, 20, 26, 55, 57, 59, 62, 75, 82, 117, 119, 148], money: 45, minSlot: 8 },
  ];
  const ROCKET_POOL = [19, 41, 23, 109, 88, 52, 96, 20, 24, 42, 110, 89];

  const FISH_POOL = [[129, 40], [118, 12], [60, 12], [54, 8], [72, 10], [98, 8], [116, 6], [90, 6], [120, 5], [130, 2], [147, 2], [131, 1]];
  const GIFT_POOL = [133, 131, 106, 107, 138, 140, 137, 147, 25, 113, 143];

  const ITEMS = {
    pokeball: { name: 'Poké Bola', price: 200, icon: 0, ball: 1, desc: 'Captura Pokémon selvagens.' },
    greatball: { name: 'Grande Bola', price: 600, icon: 1, ball: 1.5, badges: 1, desc: 'Captura melhor que a Poké Bola.' },
    ultraball: { name: 'Ultra Bola', price: 1200, icon: 2, ball: 2, badges: 3, desc: 'Captura muito melhor.' },
    potion: { name: 'Poção', price: 300, icon: 3, heal: 20, desc: 'Recupera 20 PS.' },
    superpotion: { name: 'Super Poção', price: 700, icon: 4, heal: 60, desc: 'Recupera 60 PS.' },
    hyperpotion: { name: 'Hiper Poção', price: 1200, icon: 5, heal: 200, badges: 3, desc: 'Recupera 200 PS.' },
    revive: { name: 'Reviver', price: 1500, icon: 6, revive: true, badges: 1, desc: 'Revive com metade dos PS.' },
    rarecandy: { name: 'Doce Raro', price: 0, icon: 7, candy: true, desc: 'Sobe 1 nível.' },
  };
  const BALLS = ['pokeball', 'greatball', 'ultraball'];

  const SHINY_RATE = 1 / 80;

  window.RULES = {
    DEX, TYPE_INFO, MOVES, SPLASH, STRUGGLE, effectiveness, movesFor, newMovesAt,
    ROUTE, SLOT_LEVEL, REST_HEAL, PLAYER_POWER, PLAYER_GUARD, GYMS, ELITE, CHAMPION_TEAMS, RIVAL_STARTER, TRAINER_CLASSES, ROCKET_POOL,
    FISH_POOL, GIFT_POOL, ITEMS, BALLS, SHINY_RATE,
  };
})();
