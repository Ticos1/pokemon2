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

  const ML = window.MOVELIST;
  const SPLASH = { name: 'Pirueta', kind: 'splash', pow: 0, total: 0, cd: 2.5, type: 'water' };
  const STRUGGLE = { name: 'Debater', kind: 'dash', pow: 50, total: 50, cd: 1.8, type: null };
  const MAX_MOVES = 4;

  // Golpes de MT/tutor que os iniciais e o Pikachu ganham (como no FireRed), para cada inicial ter
  // resposta aos ginásios que levam vantagem sobre ele: Charmander aprende Garra de Metal (Brock) e
  // Soco Trovão (Misty), a linha do Squirtle ganha Vento Gelado (Erika). A linha do Bulbasaur, que
  // quase não aprende golpes de dano subindo de nível, aprende Folha Navalha mais cedo e ganha
  // Bomba de Lodo (MT36) e Raio Solar (MT22).
  const BULBASAUR = [['razor-leaf', 13], ['sludge-bomb', 28], ['solar-beam', 40]];
  const CHARMANDER = [['metal-claw', 6], ['thunder-punch', 9]];
  const SQUIRTLE = [['icy-wind', 18]];
  const EXTRA_MOVES = { 1: BULBASAUR, 2: BULBASAUR, 3: BULBASAUR, 4: CHARMANDER, 5: CHARMANDER, 6: CHARMANDER, 7: SQUIRTLE, 8: SQUIRTLE, 9: SQUIRTLE, 25: [['iron-tail', 26]], 26: [['iron-tail', 26]] };

  // Linha evolutiva até a espécie (da forma base até ela)
  function family(id) {
    const out = [];
    for (let cur = id; cur; cur = DEX[cur].from) out.unshift(cur);
    return out;
  }

  // Golpes que o Pokémon aprendeu subindo de nível até o nível atual: os da espécie e os das
  // pré-evoluções (até o nível em que evoluiu), mais os de MT/tutor. [[nível, golpe], ...] em ordem
  function learned(id, lvl) {
    const fam = family(id);
    const out = [];
    fam.forEach((sp, i) => {
      const next = fam[i + 1];
      const evo = next && DEX[sp].evo.find(e => e.to === next);
      const until = next ? (evo ? evo.level : 1) : Infinity;
      for (const [l, key] of ML.learnset(sp)) if (l <= lvl && l <= until) out.push([l, key]);
    });
    for (const [key, l] of EXTRA_MOVES[id] || []) if (l <= lvl) out.push([l, key]);
    const seen = new Set();
    return out.sort((a, b) => a[0] - b[0]).filter(([, k]) => !seen.has(k) && seen.add(k));
  }

  // Sem nenhum golpe de dano (Abra só tem Teletransporte, Ditto só Transformação)
  function fallbackMove(id) {
    for (const sp of family(id)) if (ML.learnset(sp).length) return ML.get(ML.learnset(sp)[0][1]);
    return ML.get(DEX[id].types.includes('psychic') ? 'confusion' : 'pound');
  }

  // Os 4 golpes do Pokémon, como um treinador escolheria: fica com os mais fortes (golpe do mesmo
  // tipo vale mais) e evita repetir tipo. Retorna na ordem em que foram aprendidos.
  function movesFor(mon) {
    if (mon.id === 129) return mon.lvl >= 15 ? [SPLASH, ML.get('tackle')] : [SPLASH];
    const types = DEX[mon.id].types;
    const pool = learned(mon.id, mon.lvl).map(([, k]) => ML.get(k));
    if (!pool.length) return [fallbackMove(mon.id)];
    const chosen = [];
    while (chosen.length < MAX_MOVES && chosen.length < pool.length) {
      let best = null, bestV = -1;
      pool.forEach((m, i) => {
        if (chosen.includes(m)) return;
        const same = chosen.filter(c => c.type === m.type).length;
        // empate: fica o aprendido por último
        const v = m.total * (types.includes(m.type) ? 1.5 : 1) * Math.pow(.6, same) + i * .01;
        if (v > bestV) { bestV = v; best = m; }
      });
      chosen.push(best);
    }
    return pool.filter(m => chosen.includes(m));
  }

  function newMovesAt(mon, oldLvl) {
    const before = new Set(movesFor({ ...mon, lvl: oldLvl }).map(m => m.name));
    return movesFor(mon).filter(m => !before.has(m.name));
  }

  function forgottenAt(mon, oldLvl) {
    const now = new Set(movesFor(mon).map(m => m.name));
    return movesFor({ ...mon, lvl: oldLvl }).filter(m => !now.has(m.name));
  }

  // Próximo golpe que o Pokémon vai aprender subindo de nível: { lvl, move } ou null
  function nextMove(mon) {
    for (let l = mon.lvl + 1; l <= 100; l++) {
      const mv = newMovesAt({ ...mon, lvl: l }, l - 1);
      if (mv.length) return { lvl: l, move: mv[0] };
    }
    return null;
  }

  // Depois de cada vitória o time descansa e recupera parte da vida
  const REST_HEAL = .25;
  // Bônus de dano dos Pokémon do jogador (o herói sempre luta melhor)
  const PLAYER_POWER = 1.35;
  // Redução do dano que os Pokémon do jogador recebem
  const PLAYER_GUARD = .85;

  // Os 8 ginásios de Kanto com os times e níveis do Red/Blue.
  // iv = valor individual mínimo dos Pokémon do líder (20 se não tiver). Os 4 primeiros são mais
  // fracos: o jogador ainda não tem time para cobrir o tipo (ver tools/sim.js).
  const GYMS = [
    {
      leader: 'Brock', city: 'Pewter', type: 'rock', badge: 'Insígnia Rocha', look: 'brock',
      team: [[74, 10], [95, 12]], money: 100, iv: 5,
      intro: 'Sou Brock, Líder de Pewter! Minha defesa de pedra é dura como rocha!',
      lose: 'Eu subestimei você... Leve a Insígnia Rocha!',
    },
    {
      leader: 'Misty', city: 'Cerulean', type: 'water', badge: 'Insígnia Cascata', look: 'misty',
      team: [[120, 18], [121, 21]], money: 100, iv: 5,
      intro: 'Sou Misty, a sereia de Cerulean! Prepare-se para se molhar!',
      lose: 'Uau, você é forte! Tome a Insígnia Cascata.',
    },
    {
      leader: 'Lt. Surge', city: 'Vermilion', type: 'electric', badge: 'Insígnia Trovão', look: 'surge',
      team: [[100, 21], [25, 18], [26, 24]], money: 100, iv: 5,
      intro: 'Ei, garoto! Meus Pokémon elétricos me salvaram na guerra. Vão te eletrocutar!',
      lose: 'Uau! Você é eletrizante! A Insígnia Trovão é sua!',
    },
    {
      leader: 'Erika', city: 'Celadon', type: 'grass', badge: 'Insígnia Arco-íris', look: 'erika',
      team: [[71, 29], [114, 24], [45, 29]], money: 100, iv: 10,
      intro: 'Olá... Sou Erika. Adoro arranjos de flores. Que tal uma batalha?',
      lose: 'Oh! Eu me rendo. Você merece a Insígnia Arco-íris.',
    },
    {
      leader: 'Koga', city: 'Fuchsia', type: 'poison', badge: 'Insígnia Alma', look: 'koga',
      team: [[109, 37], [89, 39], [109, 37], [110, 43]], money: 100,
      intro: 'Fwahahaha! Um ninja domina a arte do veneno. Sinta o desespero!',
      lose: 'Hmm! Você provou seu valor. Leve a Insígnia Alma.',
    },
    {
      leader: 'Sabrina', city: 'Saffron', type: 'psychic', badge: 'Insígnia Pântano', look: 'sabrina',
      team: [[64, 38], [122, 37], [49, 38], [65, 43]], money: 100,
      intro: 'Eu já sabia que você viria. Vi isso nas minhas visões...',
      lose: 'Esta derrota me choca! Mas... tome a Insígnia Pântano.',
    },
    {
      leader: 'Blaine', city: 'Cinnabar', type: 'fire', badge: 'Insígnia Vulcão', look: 'blaine',
      team: [[58, 42], [77, 40], [78, 42], [59, 47]], money: 100,
      intro: 'Hah! Meus Pokémon de fogo vão te reduzir a cinzas! Tem queimadura aí?',
      lose: 'Eu me queimei! Você merece a Insígnia Vulcão!',
    },
    {
      leader: 'Giovanni', city: 'Viridian', type: 'ground', badge: 'Insígnia Terra', look: 'giovanni',
      team: [[111, 45], [51, 42], [31, 44], [34, 45], [112, 50]], money: 100,
      intro: 'Bem-vindo. Eu sou Giovanni, o chefe da Equipe Rocket. Mostre o que sabe!',
      lose: 'Ha! Que batalha! Leve a Insígnia Terra. A Equipe Rocket vai acabar...',
    },
  ];

  // Elite dos 4 (em sequência, sem Centro Pokémon entre as salas)
  const ELITE = [
    {
      name: 'Lorelei', type: 'ice', look: 'lorelei', arena: 'lorelei',
      team: [[87, 54], [91, 53], [80, 54], [124, 56], [131, 56]],
      intro: 'Bem-vindo à Liga Pokémon. Sou Lorelei, da Elite dos 4. Vou te congelar!',
      lose: 'Você é melhor do que eu pensava. Siga em frente!',
    },
    {
      name: 'Bruno', type: 'fighting', look: 'bruno', arena: 'bruno',
      team: [[95, 53], [107, 55], [106, 55], [95, 56], [68, 58]],
      intro: 'Sou Bruno, da Elite dos 4! Vou te esmagar com força bruta! Hoo hah!',
      lose: 'Eu perdi?! Meu treino não foi suficiente...',
    },
    {
      name: 'Agatha', type: 'ghost', look: 'agatha', arena: 'agatha',
      team: [[94, 56], [42, 56], [93, 55], [24, 58], [94, 60]],
      intro: 'Sou Agatha, da Elite dos 4. Pokémon servem para lutar! Vou te mostrar!',
      lose: 'Você venceu! Agora entendo por que o velho Carvalho te elogia.',
    },
    {
      name: 'Lance', type: 'dragon', look: 'lance', arena: 'lance',
      team: [[130, 58], [148, 56], [148, 56], [142, 60], [149, 62]],
      intro: 'Sou Lance, o mestre dos dragões e o último da Elite dos 4. Prepare-se!',
      lose: 'Inacreditável... Você é um treinador de verdade. O Campeão te espera.',
    },
  ];

  // Blue escolhe o inicial que tem vantagem sobre o seu
  const RIVAL_STARTER = { 1: 4, 4: 7, 7: 1 };
  // Times do Blue em cada encontro (Red/Blue). 'S' = inicial dele; 'A'/'B' = os dois Pokémon que
  // mudam com o inicial (Gyarados, Arcanine ou Exeggutor). As espécies evoluem sozinhas pelo nível.
  const RIVAL_TEAMS = [
    [[16, 5], ['S', 6]],
    [[17, 15], [63, 14], [19, 13], ['S', 16]],
    [[17, 19], [20, 16], [64, 18], ['S', 20]],
    [[17, 25], ['A', 23], [64, 20], ['S', 25]],
    [[18, 37], ['A', 38], [65, 35], ['B', 38], ['S', 40]],
    [[18, 47], [112, 45], ['A', 45], ['B', 47], [65, 50], ['S', 53]],
    [[18, 61], [65, 59], [112, 61], ['A', 61], ['B', 63], ['S', 65]],
  ];
  // pelo inicial do Blue: Charmander -> Exeggcute e Magikarp; Squirtle -> Growlithe e Exeggcute; Bulbasaur -> Magikarp e Growlithe
  const RIVAL_EXTRA = { 4: [102, 129], 7: [58, 102], 1: [129, 58] };

  // Chefes da Equipe Rocket e outras batalhas fixas da história
  const BOSSES = {
    giovanni1: { name: 'Giovanni', look: 'giovanni', subtitle: 'Chefe da Equipe Rocket', team: [[95, 25], [111, 24], [115, 29]], money: 1500,
      intro: 'Então você chegou até aqui... Eu sou Giovanni, chefe da Equipe Rocket!', lose: 'Que derrota... Leve isto. A Equipe Rocket vai desaparecer por um tempo.' },
    giovanni2: { name: 'Giovanni', look: 'giovanni', subtitle: 'Chefe da Equipe Rocket', team: [[33, 37], [115, 35], [111, 37], [31, 41]], money: 3000,
      intro: 'Você de novo?! A Silph Co. é nossa. Não vou deixar uma criança atrapalhar!', lose: 'Arrgh! Perdi de novo... A Silph Co. é sua. Por enquanto.' },
    karate: { name: 'Mestre do Caratê', look: 'blackbelt', subtitle: 'Dojo de Luta', team: [[106, 37], [107, 37]], money: 1200,
      intro: 'Hwaaa! Eu sou o Mestre do Caratê! Ninguém derruba o Dojo de Luta!', lose: 'Você é forte! Escolha um dos meus Pokémon como prêmio.' },
  };

  // Classes de treinador (Red/Blue). As áreas (js/kanto.js) dizem quais aparecem em cada lugar
  const TRAINER_CLASSES = {
    bug: { cls: 'Caça-Insetos', look: 'bug', pool: [10, 13, 46, 48, 123, 127, 11, 14], money: 12 },
    youngster: { cls: 'Jovem', look: 'youngster', pool: [19, 21, 16, 29, 32, 56, 52, 23, 27], money: 16 },
    lass: { cls: 'Garota', look: 'lass', pool: [39, 35, 43, 16, 19, 25, 52, 69, 29], money: 16 },
    hiker: { cls: 'Alpinista', look: 'hiker', pool: [74, 95, 66, 27, 50, 104, 111, 75], money: 30 },
    swimmer: { cls: 'Nadador', look: 'swimmer', pool: [72, 118, 60, 54, 79, 86, 90, 98, 116, 120, 61, 121], money: 20 },
    birdkeeper: { cls: 'Criador de Aves', look: 'birdkeeper', pool: [16, 21, 83, 84, 17, 22, 85], money: 25 },
    blackbelt: { cls: 'Faixa-Preta', look: 'blackbelt', pool: [56, 66, 106, 107, 57, 67], money: 25 },
    channeler: { cls: 'Médium', look: 'channeler', pool: [92, 93], money: 30 },
    nerd: { cls: 'Supernerd', look: 'nerd', pool: [81, 100, 88, 109, 37, 58], money: 25 },
    tamer: { cls: 'Domador', look: 'tamer', pool: [27, 58, 77, 23, 24, 128, 111], money: 35 },
    beauty: { cls: 'Beldade', look: 'beauty', pool: [43, 44, 69, 70, 35, 39, 118, 120], money: 30 },
    gentleman: { cls: 'Cavalheiro', look: 'gentleman', pool: [58, 37, 52, 128, 84, 25], money: 40 },
    sailor: { cls: 'Marinheiro', look: 'sailor', pool: [66, 72, 98, 116, 90, 67, 118], money: 25 },
    picnicker: { cls: 'Piqueniqueira', look: 'picnicker', pool: [43, 69, 16, 39, 25, 102, 114], money: 18 },
    maniac: { cls: 'Maníaco Pokémon', look: 'maniac', pool: [104, 105, 79, 111, 30, 112, 31], money: 30 },
    cooltrainer: { cls: 'Treinadora Ás', look: 'cooltrainer', pool: [17, 20, 26, 55, 57, 59, 62, 75, 82, 117, 119, 148, 36, 45], money: 45 },
    fisher: { cls: 'Pescador', look: 'fisher', pool: [129, 118, 60, 72, 90, 116, 119, 99], money: 35 },
    biker: { cls: 'Motoqueiro', look: 'rocker', pool: [109, 88, 110, 89, 100], money: 20 },
    burglar: { cls: 'Ladrão', look: 'burglar', pool: [58, 37, 77, 38, 126], money: 90 },
    scientist: { cls: 'Cientista', look: 'scientist', pool: [81, 100, 109, 88, 101, 82, 110], money: 50 },
    gambler: { cls: 'Apostador', look: 'gentleman', pool: [60, 116, 69, 43, 58, 37], money: 70 },
    rocker: { cls: 'Roqueiro', look: 'rocker', pool: [100, 81, 101], money: 25 },
    juggler: { cls: 'Malabarista', look: 'psychic', pool: [96, 64, 97, 122, 110], money: 35 },
    rocket: { cls: 'Recruta Rocket', look: 'rocket', pool: [19, 41, 23, 109, 88, 52, 96, 20, 24, 42, 110, 89], money: 30 },
  };

  // Presente do senhor no meio do caminho
  const GIFT_POOL = [133, 131, 106, 107, 147, 25, 113, 143, 123, 127, 128, 115];
  // Ovo da Creche: o que nasce dele
  const EGG_POOL = [[147, 10], [133, 10], [131, 6], [113, 8], [123, 10], [127, 10], [115, 8], [128, 8], [138, 6], [140, 6], [142, 4], [143, 6], [137, 4], [124, 4]];

  const ITEMS = {
    pokeball: { name: 'Poké Bola', price: 200, icon: 0, ball: 1, desc: 'Captura Pokémon selvagens.' },
    greatball: { name: 'Grande Bola', price: 600, icon: 1, ball: 1.5, badges: 1, desc: 'Captura melhor que a Poké Bola.' },
    ultraball: { name: 'Ultra Bola', price: 1200, icon: 2, ball: 2, badges: 3, desc: 'Captura muito melhor.' },
    masterball: { name: 'Bola Mestra', price: 0, icon: 14, ball: 255, desc: 'Captura qualquer Pokémon, sem falhar.' },
    potion: { name: 'Poção', price: 300, icon: 3, heal: 20, desc: 'Recupera 20 PS.' },
    superpotion: { name: 'Super Poção', price: 700, icon: 4, heal: 60, desc: 'Recupera 60 PS.' },
    hyperpotion: { name: 'Hiper Poção', price: 1200, icon: 5, heal: 200, badges: 3, desc: 'Recupera 200 PS.' },
    revive: { name: 'Reviver', price: 1500, icon: 6, revive: true, badges: 1, desc: 'Revive com metade dos PS.' },
    rarecandy: { name: 'Doce Raro', price: 0, icon: 7, candy: true, desc: 'Sobe 1 nível.' },
    firestone: { name: 'Pedra do Fogo', price: 2100, icon: 9, stone: true, desc: 'Evolui Vulpix, Growlithe e Eevee.' },
    waterstone: { name: 'Pedra da Água', price: 2100, icon: 10, stone: true, desc: 'Evolui Poliwhirl, Shellder, Staryu e Eevee.' },
    thunderstone: { name: 'Pedra do Trovão', price: 2100, icon: 11, stone: true, desc: 'Evolui Pikachu e Eevee.' },
    leafstone: { name: 'Pedra da Folha', price: 2100, icon: 12, stone: true, desc: 'Evolui Gloom, Weepinbell e Exeggcute.' },
    moonstone: { name: 'Pedra da Lua', price: 0, icon: 13, stone: true, desc: 'Evolui Nidorina, Nidorino, Clefairy e Jigglypuff.' },
  };
  const STONES = ['firestone', 'waterstone', 'thunderstone', 'leafstone', 'moonstone'];
  // Evoluções por pedra (Red/Blue): pedra -> { espécie: evolução }
  const STONE_EVO = {
    firestone: { 37: 38, 58: 59, 133: 136 }, waterstone: { 61: 62, 90: 91, 120: 121, 133: 134 },
    thunderstone: { 25: 26, 133: 135 }, leafstone: { 44: 45, 70: 71, 102: 103 }, moonstone: { 30: 31, 33: 34, 35: 36, 39: 40 },
  };
  const BALLS = ['pokeball', 'greatball', 'ultraball', 'masterball'];

  const SHINY_RATE = 1 / 80;

  window.RULES = {
    DEX, TYPE_INFO, SPLASH, STRUGGLE, effectiveness, movesFor, newMovesAt, forgottenAt, nextMove, learned,
    REST_HEAL, PLAYER_POWER, PLAYER_GUARD, GYMS, ELITE, RIVAL_STARTER, RIVAL_TEAMS, RIVAL_EXTRA, BOSSES, TRAINER_CLASSES,
    GIFT_POOL, EGG_POOL, ITEMS, BALLS, STONES, STONE_EVO, SHINY_RATE,
  };
})();
