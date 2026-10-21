// Paradas da rota: o que aparece no caminho e o que acontece em cada uma.
// As regras (inimigos, prêmios, itens) vêm de js/journey.js; aqui ficam só a cena e os diálogos.
(function () {
  const R = window.RULES, M = window.MON, J = window.JOURNEY, Wd = window.WORLD;
  const { DEX, ITEMS } = R;
  const GM = window.GAME, G = GM.G;
  const { say, wait, walkTo, runBattle, afterBattle } = GM;

  const EVENT_GAP = 230; // distância (baixa resolução) até a próxima parada
  const TRAINER_NAMES = ['Joey', 'Ana', 'Rick', 'Bia', 'Leo', 'Duda', 'Caio', 'Lia', 'Theo', 'Nina', 'Gabe', 'Malu', 'Davi', 'Iris', 'Enzo', 'Lara'];

  const ahead = () => G.world.px + EVENT_GAP;
  const add = (...objs) => G.world.objects.push(...objs);

  // ---------- Grama alta ----------
  async function evWild(slot) {
    const x = ahead();
    const grass = Wd.tallGrass(x - 24, 6);
    add(grass);
    await walkTo(x + 16);
    grass.shake = .8;
    window.SFX.alert();
    await wait(.7);
    const enc = J.encounter(G, slot);
    if (enc.enemies.some(e => DEX[e.id].legendary)) {
      await say('O chão está tremendo... Um Pokémon lendário apareceu!');
    }
    const res = await runBattle({ enemies: enc.enemies, kind: 'wild' });
    return afterBattle(res, 'wild');
  }

  // ---------- Treinadores ----------
  async function trainerApproach(look, slot) {
    const x = ahead();
    const o = Wd.npc(look, x);
    add(o);
    G.seen[slot] = look;
    await walkTo(x - 34);
    G.world.bubble = { x, t: .9 };
    window.SFX.alert();
    await wait(.9);
    return o;
  }

  async function evTrainer(slot) {
    const enc = J.encounter(G, slot);
    const cls = enc.cls;
    const name = M.pick(TRAINER_NAMES);
    const o = await trainerApproach(cls.look, slot);
    await say(`${cls.cls} ${name}: ${M.pick(['Ei! Nossos olhos se cruzaram, vamos batalhar!', 'Você parece forte. Vamos ver!', 'Não vou perder pra você!', 'Meus Pokémon estão prontos!'])}`);
    const res = await runBattle({ enemies: enc.enemies, kind: 'trainer', title: `${cls.cls} ${name}` });
    if (res.won) await say(`${cls.cls} ${name}: ${M.pick(['Ahh, perdi!', 'Você é bom mesmo!', 'Não acredito!', 'Vou treinar mais...'])}`);
    Wd.stepAside(o);
    return afterBattle(res, 'trainer', enc.money);
  }

  async function evRocket(slot) {
    const enc = J.encounter(G, slot);
    const o = await trainerApproach('rocket', slot);
    await say('Recruta Rocket: Prepare-se para encrenca! Entregue seus Pokémon!');
    const res = await runBattle({ enemies: enc.enemies, kind: 'rocket', theme: 'rocket', title: 'Recruta Rocket', look: 'rocket', vs: { name: 'Equipe Rocket', subtitle: 'Recruta' } });
    if (!res.won) return false;
    await say('Recruta Rocket: A Equipe Rocket decolando de novo!');
    G.world.objects = G.world.objects.filter(x => x !== o); // foge
    const ok = await afterBattle(res, 'rocket', enc.money);
    if (ok && J.rocketDrop(G)) { GM.updateHud(); window.SFX.buy(); await say('O recruta deixou cair um Doce Raro!'); }
    return ok;
  }

  async function evRival(slot) {
    const enc = J.encounter(G, slot);
    const o = await trainerApproach('rival', slot);
    G.stats.rivalFights = (G.stats.rivalFights || 0) + 1;
    await say(G.stats.rivalFights > 1 ? 'Blue: Você de novo? Dessa vez eu ganho!' : 'Blue: Ei! Vamos ver quem ficou mais forte!');
    const res = await runBattle({ enemies: enc.enemies, kind: 'rival', title: 'Rival Blue', look: 'rival', vs: { name: 'Blue', subtitle: 'Rival' } });
    if (!res.won) return false;
    await say('Blue: O quê?! Que sorte a sua!');
    Wd.stepAside(o);
    return afterBattle(res, 'rival', enc.money);
  }

  // ---------- Item, presente ----------
  async function sayFoundItem({ k, n }) {
    window.SFX.buy();
    GM.updateHud();
    if (k === 'nugget') await say('Você encontrou uma Pepita! Vendeu por ₽3000!');
    else await say(`Você encontrou ${n > 1 ? n + 'x ' : ''}${ITEMS[k].name}!`);
  }

  async function evItem() {
    const x = ahead();
    const ball = Wd.itemBall(x);
    add(ball);
    await walkTo(x - 4);
    ball.taken = true;
    await sayFoundItem(J.foundItem(G));
    return true;
  }

  async function evGift(slot) {
    const x = ahead();
    add(Wd.npc('oldman', x + 20));
    G.seen[slot] = 'oldman';
    await walkTo(x);
    const mon = J.gift(G, slot);
    await say(`Senhor: Este ${DEX[mon.id].name} precisa de um treinador. Cuide bem dele!`);
    window.SFX.caught();
    await say(`Você recebeu ${DEX[mon.id].name}!`);
    await GM.addCaught(mon, { gift: true });
    return true;
  }

  // ---------- Lago: minijogo de pesca ----------
  async function evFishing(slot) {
    const x = ahead();
    const lk = Wd.lake(x - 8, 5);
    add(lk, Wd.npc('fisher', x + 26));
    await walkTo(x);
    await say('Pescador: Que lago bonito! Pegue minha vara e tente a sorte!');
    if (!G.autopilot && !UI.state.auto) await say('Segure o clique (ou ESPAÇO) para a barra verde subir e mantenha o peixe dentro dela!');
    const enc = J.encounter(G, slot);
    const mon = enc.enemies[0];
    G.world.dir = 'down';
    const f = new window.FISHING.Fishing({ ...J.fishing(G, mon), autoFn: () => UI.state.auto || G.autopilot });
    f.lake = lk;
    G.fishing = f;
    const r = await f.promise;
    G.fishing = null;
    G.world.dir = 'right';
    if (!r.caught) {
      await say('Ah, não... O Pokémon escapou!');
      await say('Pescador: Acontece! Boa sorte na jornada!');
      return true;
    }
    if (r.treasure) {
      await say('Veio um baú preso no anzol!');
      await sayFoundItem(J.foundItem(G));
    }
    await say(`Fisgou! Um ${DEX[mon.id].name} mordeu a isca!`);
    // pescaria perfeita: o Pokémon chega cansado (mais fácil de capturar)
    if (r.perfect) {
      mon.hp = Math.ceil(mon.maxhp * .6);
      await say(`Pescaria perfeita! ${DEX[mon.id].name} chegou cansado.`);
    }
    const res = await runBattle({ enemies: [mon], kind: 'wild', theme: 'water' });
    return afterBattle(res, 'wild');
  }

  // ---------- Cidades e ginásios ----------
  // Cidade do ginásio: placa, Centro Pokémon e Loja de frente para o caminho
  async function cityStop(name) {
    const x = ahead() + 40;
    add(
      Wd.sign(x - 92, name.toUpperCase()),
      Wd.plaza(x - 64, x + 112),
      Wd.building('center', x - 24),
      Wd.building('mart', x + 72),
      Wd.npc('nurse', x - 8, Wd.TOP_Y + 3, 'down'),
      Wd.npc('clerk', x + 56, Wd.TOP_Y + 3, 'down'),
    );
    await walkTo(x + 24);
    await say(`Bem-vindo à cidade de ${name}!`);
    await say('Enfermeira Joy: Vou cuidar dos seus Pokémon!');
    await GM.healParty();
    await say('Seus Pokémon estão totalmente recuperados!');
    await GM.visitShop('Vendedor: Quer comprar alguma coisa?', 'Seguir viagem');
  }

  async function evGym(slot) {
    const enc = J.encounter(G, slot);
    const g = enc.gym;
    await cityStop(g.city);
    const x = G.world.px + 190;
    const gym = Wd.building('gym', x, `GINÁSIO DE ${g.city.toUpperCase()}`);
    add(Wd.plaza(x - 72, x + 72), gym);
    await walkTo(x);
    await say(`Ginásio de ${g.city} — Líder: ${g.leader}, especialista em tipo ${R.TYPE_INFO[g.type].pt}.`);
    G.world.dir = 'up';
    await wait(.3);
    await GM.goInside(g.type, g.look);
    await say(`${g.leader}: ${g.intro}`);
    const res = await runBattle({ enemies: enc.enemies, kind: 'gym', theme: g.type, title: `Líder ${g.leader}`, look: g.look, vs: { name: g.leader, subtitle: 'Líder de Ginásio' } });
    if (!res.won) return false;
    await say(`${g.leader}: ${g.lose}`);
    G.badges++;
    GM.updateHud();
    await GM.badgeScene(enc.index);
    await say(`Você recebeu a ${g.badge}!`);
    const ok = await afterBattle(res, 'gym', enc.money);
    await GM.goOutside();
    return ok;
  }

  // Elite dos 4: a primeira sala começa no Planalto Índigo; entre as salas não há cura
  async function evElite(slot) {
    const enc = J.encounter(G, slot);
    const e = enc.elite;
    if (enc.index === 0) {
      const x = ahead() + 60;
      const league = Wd.building('league', x, 'LIGA POKÉMON');
      add(Wd.sign(x - 120, 'PLANALTO ÍNDIGO'), Wd.plaza(x - 104, x + 104, 4), league);
      await walkTo(x);
      await say('Você chegou ao Planalto Índigo! Aqui estão a Elite dos 4 e o Campeão.');
      await GM.healParty();
      await say('Seus Pokémon foram curados. Depois daqui, não há mais Centro Pokémon!');
      await GM.visitShop('Quer passar na loja antes do desafio?', 'Estou pronto!');
      G.world.dir = 'up';
      await wait(.3);
    } else {
      await say('Você segue para a próxima sala da Liga...');
    }
    await GM.goInside(e.arena, e.look);
    await say(`${e.name}: ${e.intro}`);
    const res = await runBattle({ enemies: enc.enemies, kind: 'elite', theme: e.arena, title: e.name, look: e.look, vs: { name: e.name, subtitle: 'Elite dos 4' } });
    if (!res.won) return false;
    await say(`${e.name}: ${e.lose}`);
    return afterBattle(res, 'elite', enc.money);
  }

  async function evChampion(slot) {
    const enc = J.encounter(G, slot);
    await say('Você entra na sala do Campeão...');
    await GM.goInside('champion', 'rival');
    await say('Blue: Até que enfim você chegou! Eu sou o Campeão agora. Prove que é melhor que eu!');
    const res = await runBattle({ enemies: enc.enemies, kind: 'champion', theme: 'champion', title: 'Campeão Blue', look: 'champion', vs: { name: 'Blue', subtitle: 'CAMPEÃO' } });
    if (!res.won) return false;
    await say('Blue: Não acredito... Eu perdi! Você é o novo Campeão!');
    await afterBattle(res, 'champion', enc.money);
    return true;
  }

  const EVENTS = {
    wild: evWild, trainer: evTrainer, rocket: evRocket, rival: evRival, item: evItem,
    fishing: evFishing, gift: evGift, gym: evGym, elite: evElite, champion: evChampion,
  };

  // Retorna false se o time inteiro desmaiou
  function run(kind, slot) {
    return EVENTS[kind] ? EVENTS[kind](slot) : Promise.resolve(true);
  }

  window.EVENTS = { run };
})();
