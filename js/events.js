// Paradas da jornada: o que aparece no caminho e o que acontece em cada uma.
// As regras (inimigos, prêmios, itens) vêm de js/journey.js e as áreas de js/kanto.js;
// aqui ficam só a cena e os diálogos, como no Red/Blue.
(function () {
  const R = window.RULES, M = window.MON, J = window.JOURNEY, K = window.KANTO, Wd = window.WORLD;
  const { DEX, ITEMS } = R;
  const GM = window.GAME, G = GM.G;
  const { say, choose, wait, walkTo, runBattle, afterBattle } = GM;

  const EVENT_GAP = 230; // distância (baixa resolução) até a próxima parada
  const TRAINER_NAMES = ['Joey', 'Ana', 'Rick', 'Bia', 'Leo', 'Duda', 'Caio', 'Lia', 'Theo', 'Nina', 'Gabe', 'Malu', 'Davi', 'Iris', 'Enzo', 'Lara'];

  const ahead = () => G.world.px + EVENT_GAP;
  const add = (...objs) => G.world.objects.push(...objs);
  const area = stop => K.AREAS[stop.area] || {};
  const name = mon => DEX[mon.id].name;
  // mapa do andar da parada (cavernas, prédios e salas das cidades); null = caminhada pela rota
  const mapOf = stop => { const a = area(stop); return (a.maps && stop.floor !== undefined && a.maps[stop.floor]) || null; };
  const theme = stop => area(stop).theme || 'route';
  const auto = () => G.autopilot;

  // ---------- Chegando num lugar ----------
  let lastPlace = null;
  async function enterPlace(i) {
    const stop = G.route[i];
    const key = mapOf(stop);
    const cur = G.world.map ? G.world.map.key : null;
    if (key !== cur) {
      await GM.fade(true, .3);
      Wd.setMap(G.world, key, area(stop).dark);
      if (!key) G.world.objects = [];
      G.fx = { kind: 'fade', out: false, t: 0, dur: .3 };
      await wait(.3);
    }
    G.world.weather = G.weather && !key && area(stop).kind === 'walk' ? G.weather.kind : null;
    const place = K.placeName(stop);
    if (place !== lastPlace && stop.area) {
      if (!key && area(stop).kind === 'walk' && lastPlace) add(Wd.sign(G.world.px + 120, area(stop).name.toUpperCase()));
      GM.showPlace(place);
      lastPlace = place;
    }
    // os mapas das próximas paradas já vão carregando
    for (let k = i; k < Math.min(G.route.length, i + 4); k++) ART.loadMap(mapOf(G.route[k]));
  }

  // Pokémon de verdade parado no caminho (lendários e Snorlax)
  function monObject(id, x, scale = 1) {
    return { x, keep: true, drawHi(c, cx) { ART.drawMon(c, id, false, false, (x - cx) * 2, Wd.FEET_Y * 2 + 4, { feet: true, scale, flip: true }); } };
  }

  // Selvagem especial (lendário, Snorlax): perder não acaba o jogo, a próxima parada é um Centro Pokémon
  async function specialLoss(i, mon) {
    await say(`${name(mon)} foi embora... Seu time precisa de cuidados.`);
    await say('Você correu para o Centro Pokémon mais próximo.');
    J.insertCenter(G, i);
    GM.updateHud();
    return true;
  }

  // ---------- Grama alta / selvagem ----------
  async function evWild(i) {
    const stop = G.route[i];
    const x = ahead();
    if (G.world.map) {
      await walkTo(x);
      G.world.bubble = { x: G.world.px, t: .8 };
      window.SFX.alert();
      await wait(.8);
    } else {
      const grass = Wd.tallGrass(x - 24, 6);
      add(grass);
      await walkTo(x + 16);
      grass.shake = .8;
      window.SFX.alert();
      await wait(.7);
    }
    const enc = J.encounter(G, i);
    const res = await runBattle({ enemies: enc.enemies, kind: 'wild', theme: theme(stop), weather: J.battleWeather(G, stop) });
    return afterBattle(res, 'wild');
  }

  // ---------- Lendários e Snorlax ----------
  const LEGEND_TEXT = {
    143: ['Um Pokémon enorme está dormindo no meio do caminho...', 'Você tocou a Poké Flauta! O Snorlax acordou de mau humor!'],
    144: ['Um ar gelado sopra no fundo da caverna...', 'É o Articuno, o Pokémon lendário do gelo!'],
    145: ['Faíscas estalam por toda a usina...', 'É o Zapdos, o Pokémon lendário do trovão!'],
    146: ['O chão da Estrada Vitória está quente...', 'É o Moltres, o Pokémon lendário do fogo!'],
    150: ['Uma presença assustadora enche a caverna...', 'É o Mewtwo, o Pokémon criado na Mansão de Cinnabar!'],
  };
  async function evLegend(i) {
    const stop = G.route[i];
    const x = ahead();
    add(monObject(stop.id, x + 40, stop.id === 143 ? 1.2 : 1));
    await walkTo(x - 30);
    for (const t of LEGEND_TEXT[stop.id] || ['Um Pokémon lendário!']) await say(t);
    window.SFX.alert();
    const enc = J.encounter(G, i);
    G.world.objects = G.world.objects.filter(o => !o.keep);
    const res = await runBattle({ enemies: enc.enemies, kind: 'wild', theme: theme(stop), weather: J.battleWeather(G, stop) });
    if (!res.won) return specialLoss(i, enc.enemies[0]);
    if (!res.caught && !res.fled) await say(`${name(enc.enemies[0])} foi derrotado.`);
    return afterBattle(res, 'legend');
  }

  // Torre Pokémon 6F: o fantasma da mãe Marowak (com o Scope Silph dá para ver quem é)
  async function evMarowak(i) {
    const stop = G.route[i];
    await walkTo(ahead());
    await say('Um fantasma aparece! "Saia... daqui..."');
    await say('O Scope Silph revelou o fantasma: é o espírito de uma mãe Marowak!');
    const enc = J.encounter(G, i);
    const res = await runBattle({ enemies: enc.enemies, kind: 'wild', theme: theme(stop), noCatch: true });
    if (!res.won) return specialLoss(i, enc.enemies[0]);
    await say('O espírito do Marowak se acalmou... e partiu em paz.');
    return afterBattle(res, 'legend');
  }

  // ---------- Treinadores ----------
  async function trainerApproach(look, i, x = ahead()) {
    const o = Wd.npc(look, x);
    add(o);
    G.seen[i] = look;
    await walkTo(x - 34);
    G.world.bubble = { x, t: .9 };
    window.SFX.alert();
    await wait(.9);
    return o;
  }

  const HELLO = ['Ei! Nossos olhos se cruzaram, vamos batalhar!', 'Você parece forte. Vamos ver!', 'Não vou perder pra você!', 'Meus Pokémon estão prontos!'];
  const BYE = ['Ahh, perdi!', 'Você é bom mesmo!', 'Não acredito!', 'Vou treinar mais...'];

  async function evTrainer(i) {
    const stop = G.route[i];
    const enc = J.encounter(G, i);
    const cls = enc.cls;
    const nm = M.pick(TRAINER_NAMES);
    const o = await trainerApproach(cls.look, i);
    await say(`${cls.cls} ${nm}: ${M.pick(HELLO)}`);
    const res = await runBattle({ enemies: enc.enemies, kind: 'trainer', theme: theme(stop), title: `${cls.cls} ${nm}`, weather: J.battleWeather(G, stop) });
    if (res.won) await say(`${cls.cls} ${nm}: ${M.pick(BYE)}`);
    Wd.stepAside(o);
    return afterBattle(res, 'trainer', enc.money);
  }

  // Dupla de treinadores: batalha 2x2 mesmo no modo 1x1
  async function evDouble(i) {
    const stop = G.route[i];
    const enc = J.encounter(G, i);
    const [n1, n2] = [M.pick(TRAINER_NAMES), M.pick(TRAINER_NAMES.filter(n => n !== TRAINER_NAMES[0]))];
    const x = ahead();
    const o1 = Wd.npc(enc.a.look, x), o2 = Wd.npc(enc.b.look, x + 18);
    add(o1, o2);
    G.seen[i] = enc.a.look;
    await walkTo(x - 34);
    G.world.bubble = { x: x + 9, t: .9 };
    window.SFX.alert();
    await wait(.9);
    const who = enc.a === enc.b || enc.a.key === enc.b.key ? `${enc.a.cls}s ${n1} e ${n2}` : `${enc.a.cls} ${n1} e ${enc.b.cls} ${n2}`;
    await say(`${who}: Nós dois contra você! Batalha em dupla!`);
    const res = await runBattle({ enemies: enc.enemies, kind: 'trainer', theme: theme(stop), title: 'Dupla', mode: 2, weather: J.battleWeather(G, stop) });
    if (res.won) await say(`${n1} e ${n2}: Nem juntos deu...`);
    Wd.stepAside(o1); Wd.stepAside(o2);
    return afterBattle(res, 'trainer', enc.money);
  }

  async function evRocket(i) {
    const stop = G.route[i];
    const enc = J.encounter(G, i);
    const o = await trainerApproach(Math.random() < .3 ? 'rocketf' : 'rocket', i);
    G.seen[i] = 'rocket';
    await say(stop.nugget
      ? 'Homem: Parabéns, você passou pela Ponte Pepita! Ganhou uma Pepita! ...Que tal entrar para a Equipe Rocket? Não? Então vou pegar à força!'
      : 'Recruta Rocket: Prepare-se para encrenca! Entregue seus Pokémon!');
    const res = await runBattle({ enemies: enc.enemies, kind: 'rocket', theme: stop.area === 'route24' ? 'route' : (area(stop).theme || 'rocket'), title: 'Recruta Rocket', look: 'rocket', vs: { name: 'Equipe Rocket', subtitle: 'Recruta' } });
    if (!res.won) return false;
    await say('Recruta Rocket: A Equipe Rocket decolando de novo!');
    G.world.objects = G.world.objects.filter(x => x !== o); // foge
    const ok = await afterBattle(res, 'rocket', enc.money);
    if (ok && stop.nugget) { G.money += 5000; GM.updateHud(); window.SFX.buy(); await say('Você vendeu a Pepita por ₽5000!'); }
    if (ok && J.rocketDrop(G)) { GM.updateHud(); window.SFX.buy(); await say('O recruta deixou cair um Doce Raro!'); }
    return ok;
  }

  const RIVAL_LINES = [
    ['Blue: Ei, espera aí! Vamos ver se o seu Pokémon é bom mesmo!', 'Blue: O quê?! Eu escolhi o Pokémon errado!'],
    ['Blue: E aí! Ainda está nessa? Vamos ver o quanto você melhorou!', 'Blue: Hmph! Vou capturar Pokémon bem mais fortes!'],
    ['Blue: Você também foi convidado pro S.S. Anne? Que coincidência... Batalha!', 'Blue: Eu só estava aquecendo! Até mais!'],
    ['Blue: O que você está fazendo na Torre Pokémon? Seus Pokémon estão vivinhos... Vamos lutar!', 'Blue: Hmph. Vou treinar mais e voltar.'],
    ['Blue: A Equipe Rocket? Não ligo pra eles. Vim te enfrentar!', 'Blue: Tá bom, você venceu. Pode ir atrás deles.'],
    ['Blue: Vai tentar a Liga? Eu também juntei as 8 insígnias! Vamos ver quem é melhor!', 'Blue: Isso não acaba aqui. Te vejo na Liga Pokémon!'],
  ];
  async function evRival(i) {
    const stop = G.route[i];
    const enc = J.encounter(G, i);
    const o = await trainerApproach('rival', i);
    G.stats.rivalFights = (G.stats.rivalFights || 0) + 1;
    const [hi, bye] = RIVAL_LINES[stop.n] || RIVAL_LINES[0];
    await say(hi);
    const res = await runBattle({ enemies: enc.enemies, kind: 'rival', theme: theme(stop), title: 'Rival Blue', look: 'rival', vs: { name: 'Blue', subtitle: 'Rival' } });
    if (!res.won) return false;
    await say(bye);
    Wd.stepAside(o);
    return afterBattle(res, 'rival', enc.money);
  }

  // Giovanni (Esconderijo Rocket e Silph Co.)
  async function evBoss(i) {
    const stop = G.route[i];
    const enc = J.encounter(G, i);
    const b = enc.boss;
    await trainerApproach(b.look, i);
    await say(`${b.name}: ${b.intro}`);
    const res = await runBattle({ enemies: enc.enemies, kind: 'trainer', theme: theme(stop), title: b.name, look: b.look, vs: { name: b.name, subtitle: b.subtitle } });
    if (!res.won) return false;
    await say(`${b.name}: ${b.lose}`);
    const ok = await afterBattle(res, 'boss', enc.money);
    if (stop.key === 'giovanni1') { window.SFX.caught(); await say('Você recebeu o Scope Silph! Agora dá para ver os fantasmas da Torre Pokémon.'); }
    if (stop.key === 'giovanni2') {
      GM.addItem('masterball');
      window.SFX.caught();
      await say('Presidente da Silph: Obrigado por salvar a empresa! Leve esta Bola Mestra. Ela captura qualquer Pokémon!');
    }
    return ok;
  }

  // Dojo de Luta de Saffron: vence o Mestre do Caratê e escolhe um prêmio
  async function evDojo(i) {
    const stop = G.route[i];
    const enc = J.encounter(G, i);
    await say('Dojo de Luta! Os faixas-pretas de Saffron treinam aqui.');
    await trainerApproach('blackbelt', i);
    await say(`${enc.boss.name}: ${enc.boss.intro}`);
    const res = await runBattle({ enemies: enc.enemies, kind: 'trainer', theme: 'dojo', title: enc.boss.name, look: 'blackbelt', vs: { name: enc.boss.name, subtitle: enc.boss.subtitle } });
    if (!res.won) return false;
    await say(`${enc.boss.name}: ${enc.boss.lose}`);
    const ok = await afterBattle(res, 'boss', enc.money);
    const pick = await choose('Qual Pokémon você quer?', [
      { label: 'Hitmonlee', sub: 'Mestre dos chutes', value: 'hitmonlee', icon: ART.iconStyle(106) },
      { label: 'Hitmonchan', sub: 'Mestre dos socos', value: 'hitmonchan', icon: ART.iconStyle(107) },
    ], { auto: M.pick(['hitmonlee', 'hitmonchan']) });
    const [id, lvl] = J.GIFTS[pick];
    window.SFX.caught();
    await say(`Você recebeu ${DEX[id].name}!`);
    await GM.addCaught(M.create(id, lvl, { minIv: 10 }), { gift: true });
    return ok;
  }

  // ---------- Item, presente, ovo, mercador ----------
  async function sayFoundItem({ k, n }) {
    window.SFX.buy();
    GM.updateHud();
    if (k === 'nugget') await say('Você encontrou uma Pepita! Vendeu por ₽5000!');
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

  const GIFT_TEXT = {
    eevee: ['No terraço da Mansão Celadon há uma Poké Bola em cima da mesa...', 'Dentro dela estava um Eevee! "Leve-o com você", diz o bilhete.'],
    lapras: ['Funcionário da Silph: Obrigado por expulsar a Equipe Rocket!', 'Funcionário da Silph: Este Lapras precisa de um bom treinador. Cuide bem dele!'],
  };
  async function evGift(i) {
    const stop = G.route[i];
    const x = ahead();
    if (!GIFT_TEXT[stop.key]) { add(Wd.npc('oldman', x + 20)); G.seen[i] = 'oldman'; }
    await walkTo(x);
    const mon = J.gift(G, i);
    for (const t of GIFT_TEXT[stop.key] || [`Senhor: Este ${name(mon)} precisa de um treinador. Cuide bem dele!`]) await say(t);
    window.SFX.caught();
    await say(`Você recebeu ${name(mon)}!`);
    await GM.addCaught(mon, { gift: true });
    return true;
  }

  // Creche da Rota 5: o senhor achou um ovo e dá para você
  async function evEgg(i) {
    G.seen[i] = 'oldman';
    await walkTo(ahead());
    await say('Creche Pokémon. Senhor: Olá! Achei este ovo no quintal e não sei de quem é...');
    await say('Senhor: Leve com você! Ele vai chocar se você andar bastante com ele.');
    J.giveEgg(G);
    window.SFX.caught();
    await say('Você recebeu um Ovo Pokémon!');
    return true;
  }

  async function hatchEggs() {
    for (const mon of J.tickEggs(G)) {
      await say('Oh? O ovo está se mexendo!');
      window.SFX.evolve();
      await wait(1.2);
      G.fx = { kind: 'white', t: 0, dur: .8 };
      window.SFX.caught();
      await say(`Nasceu um ${name(mon)}!`);
      await GM.addCaught(mon, { gift: true });
    }
  }

  async function evMerchant(i) {
    const x = ahead();
    add(Wd.npc('gentleman', x + 20));
    G.seen[i] = 'gentleman';
    await walkTo(x);
    const offers = J.merchantOffers();
    await say('Mercador: Psiu! Tenho umas coisinhas raras aqui. Interessa?');
    const opts = offers.map(o => ({ label: `${ITEMS[o.k].name} ₽${o.price}`, sub: ITEMS[o.k].desc, value: o, icon: ART.itemStyle(ITEMS[o.k].icon), disabled: G.money < o.price }));
    opts.push({ label: 'Não, obrigado', value: null });
    const pick = await choose(`Seu dinheiro: ₽${G.money}`, opts, { auto: J.merchantAuto(G, offers) });
    if (pick) {
      J.buy(G, pick.k, pick.price);
      window.SFX.buy();
      GM.updateHud();
      await say(`Você comprou ${ITEMS[pick.k].name}!`);
    } else await say('Mercador: Que pena... Quem sabe na próxima.');
    return true;
  }

  // Rota 4, no Centro Pokémon do Mt. Moon: o vendedor de Magikarp (₽500, como no Red/Blue)
  async function evMagikarp(i) {
    const x = ahead();
    add(Wd.npc('psychic', x + 20));
    G.seen[i] = 'psychic';
    await walkTo(x);
    await say('Homem: Ei, garoto! Tenho uma oferta secreta: um Magikarp por só ₽500! Ele vai ficar forte, confia!');
    const yes = await choose(null, [{ label: 'Comprar por ₽500', value: true, disabled: G.money < 500 }, { label: 'Não, obrigado', value: false }], { auto: G.money >= 2000 });
    if (!yes) { await say('Homem: Você vai se arrepender...'); return true; }
    G.money -= 500;
    GM.updateHud();
    window.SFX.buy();
    await say('Homem: Negócio fechado! Sem devolução!');
    await GM.addCaught(M.create(129, 5), { gift: true });
    return true;
  }

  // ---------- Clima ----------
  async function evWeather() {
    await walkTo(ahead() - 80);
    const k = J.startWeather(G);
    G.world.weather = G.world.map ? null : k;
    await say(J.WEATHER[k].start);
    await say({ rain: 'Golpes de água ficam mais fortes, e os de fogo, mais fracos.', sun: 'Golpes de fogo ficam mais fortes, e os de água, mais fracos.', sand: 'A areia machuca quem não é de pedra, terra ou aço.', hail: 'O granizo machuca quem não é de gelo.' }[k]);
    return true;
  }

  async function weatherEnd() {
    const k = J.tickWeather(G);
    if (k) { G.world.weather = null; await say(J.WEATHER[k].end); }
  }

  // ---------- Cidades, Centro Pokémon e histórias ----------
  async function cityStop(i) {
    const stop = G.route[i];
    const nm = area(stop).name;
    const x = ahead() + 40;
    add(
      Wd.sign(x - 92, nm.toUpperCase()),
      Wd.plaza(x - 64, x + 112),
      Wd.building('center', x - 24),
      Wd.building('mart', x + 72),
      Wd.npc('nurse', x - 8, Wd.TOP_Y + 3, 'down'),
      Wd.npc('clerk', x + 56, Wd.TOP_Y + 3, 'down'),
    );
    await walkTo(x + 24);
    await say(`Bem-vindo a ${nm}!`);
    if (stop.text) await say(stop.text);
    await say('Enfermeira Joy: Vou cuidar dos seus Pokémon!');
    await GM.healParty();
    await say('Seus Pokémon estão totalmente recuperados!');
    if (stop.dept) await say('A Loja de Departamentos de Celadon vende Pedras de Evolução!');
    await GM.visitShop(stop.dept ? 'Vendedora: Bem-vindo à Loja de Departamentos!' : 'Vendedor: Quer comprar alguma coisa?', 'Seguir viagem', { stones: !!stop.dept });
    return true;
  }

  async function evCenter(i) {
    const stop = G.route[i];
    const x = ahead() + 20;
    add(Wd.plaza(x - 64, x + 40), Wd.building('center', x - 24), Wd.npc('nurse', x - 8, Wd.TOP_Y + 3, 'down'));
    await walkTo(x);
    await say(`${stop.name || 'Centro Pokémon'}. Enfermeira Joy: Vou cuidar dos seus Pokémon!`);
    await GM.healParty();
    await say('Seus Pokémon estão totalmente recuperados!');
    return true;
  }

  const HEAL_TEXT = {
    purified: ['Uma zona purificada! Uma luz suave envolve o andar...', 'Seus Pokémon foram curados.'],
    silph: ['Funcionária da Silph: Você está lutando contra a Equipe Rocket? Descanse um pouco aqui!', 'Seus Pokémon foram curados.'],
    mom: ['Pallet Town! Mamãe: Que bom te ver! Você e seus Pokémon parecem cansados. Descansem um pouco!', 'Seus Pokémon foram curados.'],
  };
  async function evHeal(i) {
    const stop = G.route[i];
    if (stop.key === 'mom') add(Wd.npc('mom', ahead() + 20));
    await walkTo(ahead());
    const [a, b] = HEAL_TEXT[stop.key] || ['Hora de descansar.', 'Seus Pokémon foram curados.'];
    await say(a);
    await GM.healParty();
    await say(b);
    return true;
  }

  const STORY = {
    museum: { look: 'scientist', lines: ['Museu de Ciências de Pewter. Fósseis de Pokémon pré-históricos por todo lado!', 'Cientista: Este Âmbar Antigo tem o DNA de um Pokémon pré-histórico. Leve ao laboratório da Ilha Cinnabar!', 'Você recebeu o Âmbar Antigo!'] },
    bill: { look: 'bill', lines: ['Casa do Bill. Um Clefairy fala: "Me ajuda! Sou o Bill! Um experimento deu errado..."', 'Você ligou a máquina e o Bill voltou ao normal!', 'Bill: Valeu! Tome este Ticket do S.S. Anne. Tem uma festa no navio em Vermilion!'] },
    fanclub: { look: 'gentleman', lines: ['Fã-Clube Pokémon de Vermilion. Presidente: Quer ouvir sobre o meu Rapidash? Ele é tão lindo...', 'Presidente: ...e por isso ele é o melhor! Obrigado por ouvir! Tome este Vale-Bicicleta!'] },
    captain: { look: 'captain', lines: ['Capitão: Urgh... estou enjoado...', 'Você esfregou as costas do capitão. Ele melhorou!', 'Capitão: Obrigado! Tome o HM01: Corte. Agora dá para cortar arbustos!', 'O S.S. Anne zarpou de Vermilion.'] },
    dark: { lines: ['Está escuro demais aqui dentro...', 'Você usou Flash! A caverna ficou um pouco mais clara.'], flash: true },
    tower1: { look: 'channeler', lines: ['Torre Pokémon: aqui descansam os Pokémon que já partiram.', 'Médium: Sinto presenças... muitas presenças...'] },
    ghost: { lines: ['Um fantasma bloqueia a escada! "Saia... daqui..."', 'Sem o Scope Silph não dá para ver o que é. Melhor voltar outra hora.'] },
    fuji: { look: 'fuji', lines: ['Sr. Fuji: Você me salvou da Equipe Rocket! Muito obrigado.', 'Sr. Fuji: Tome esta Poké Flauta. A melodia acorda qualquer Pokémon que estiver dormindo.'] },
    warden: { look: 'warden', lines: ['Na Zona Safári você achou uma dentadura de ouro...', 'Guarda: Meus dentes! Obrigado! Tome o HM03: Surfe. Agora dá para atravessar o mar!'] },
    diary: { lines: ['Um diário velho em cima da mesa...', '"Batizamos o Pokémon recém-descoberto da selva de Mew."', '"Mew deu à luz. Chamamos o filhote de Mewtwo."', '"Mewtwo é poderoso demais. Não conseguimos controlá-lo..."', 'Você achou a Chave Secreta do Ginásio de Cinnabar!'] },
    gates: { look: 'gentleman', lines: ['Rota 23: os guardas conferem as suas insígnias, uma por uma...', 'Guarda: As 8 insígnias de Kanto! Pode seguir para a Estrada Vitória.'] },
    unknown: { lines: ['Agora que você é o Campeão, os guardas liberaram a caverna ao norte de Cerulean.', 'Dizem que algo muito poderoso vive lá no fundo...'] },
  };
  async function evStory(i) {
    const stop = G.route[i];
    const st = STORY[stop.key] || { lines: [] };
    if (st.look) add(Wd.npc(st.look, ahead() + 20));
    await walkTo(ahead());
    for (const t of st.lines) await say(t);
    if (st.flash && G.world.map) G.world.map.flash = true;
    if (J.storyEffect(G, stop.key)) window.SFX.caught();
    return true;
  }

  // ---------- Bifurcação ----------
  async function evChoice(i) {
    const stop = G.route[i];
    const c = K.CHOICES[stop.key];
    const opts = c.options.map((o, k) => ({ label: o.label, sub: o.sub, value: k }));
    const pick = await choose(c.text, opts, { auto: M.randInt(0, opts.length - 1) });
    K.expandChoice(G.route, i, pick);
    GM.updateHud();
    await say(`Você seguiu por: ${c.options[pick].label}.`);
    return true;
  }

  // ---------- Fósseis ----------
  async function evFossil(i) {
    const stop = G.route[i];
    const enc = J.encounter(G, i);
    const o = await trainerApproach('nerd', i);
    await say('Supernerd: Esses fósseis são MEUS! Se quiser um, vai ter que me vencer!');
    const res = await runBattle({ enemies: enc.enemies, kind: 'trainer', theme: theme(stop), title: 'Supernerd Miguel' });
    if (!res.won) return false;
    await say('Supernerd: Tá bom, tá bom! Pode escolher UM fóssil.');
    Wd.stepAside(o);
    const ok = await afterBattle(res, 'trainer', enc.money);
    const pick = await choose('Qual fóssil você quer?', [
      { label: 'Fóssil Domo', sub: 'Um Pokémon de casco', value: 'dome', icon: ART.itemStyle(16) },
      { label: 'Fóssil Hélix', sub: 'Um Pokémon de concha espiral', value: 'helix', icon: ART.itemStyle(17) },
    ], { auto: M.pick(['dome', 'helix']) });
    G.fossils.push(pick);
    window.SFX.caught();
    await say(`Você pegou o ${J.FOSSILS[pick].item}! O laboratório da Ilha Cinnabar consegue reviver fósseis.`);
    return ok;
  }

  async function evLab() {
    add(Wd.npc('scientist', ahead() + 20));
    await walkTo(ahead());
    await say('Laboratório Pokémon de Cinnabar. Cientista: Trouxe algum fóssil? Eu consigo reviver!');
    if (!G.fossils.length) { await say('Cientista: Nenhum fóssil? Que pena!'); return true; }
    const names = G.fossils.map(f => J.FOSSILS[f].item).join(' e ');
    await say(`Cientista: ${names}! Espere um pouco...`);
    window.SFX.evolve();
    await wait(1.5);
    for (const mon of J.reviveFossils(G)) {
      G.fx = { kind: 'white', t: 0, dur: .8 };
      window.SFX.caught();
      await say(`Cientista: Pronto! O fóssil virou um ${name(mon)}!`);
      await GM.addCaught(mon, { gift: true });
    }
    return true;
  }

  // ---------- Quiz do Ginásio de Cinnabar ----------
  async function evQuiz(i) {
    const stop = G.route[i];
    await walkTo(ahead());
    await say('Ginásio de Cinnabar: máquinas de quiz guardam as portas. Acertou, a porta abre. Errou, um treinador te desafia!');
    for (const q of J.quizQuestions()) {
      const right = Math.random() < .75 ? q.a : !q.a;
      const ans = await choose(`Quiz: ${q.q}`, [{ label: 'SIM', value: true }, { label: 'NÃO', value: false }], { auto: right });
      if (ans === q.a) { window.SFX.select(); await say('Certo! A porta se abriu.'); continue; }
      window.SFX.alert();
      await say('Errado! Um treinador aparece!');
      const enc = J.encounter(G, i);
      const res = await runBattle({ enemies: enc.enemies, kind: 'trainer', theme: 'fire', title: enc.cls.cls });
      if (!(await afterBattle(res, 'trainer', enc.money))) return false;
    }
    return true;
  }

  // ---------- Lago: minijogo de pesca ----------
  async function evFishing(i) {
    const stop = G.route[i];
    const x = ahead();
    const lk = Wd.lake(x - 8, 5);
    add(lk, Wd.npc('fisher', x + 26));
    await walkTo(x);
    await say(G.world.map ? 'Pescador: O mar está cheio de peixes hoje! Pegue minha vara!' : 'Pescador: Que lago bonito! Pegue minha vara e tente a sorte!');
    if (!G.autopilot) await say('Segure o clique (ou ESPAÇO) para a barra verde subir e mantenha o peixe dentro dela!');
    const enc = J.encounter(G, i);
    const mon = enc.enemies[0];
    // olha para a água (no mapa, o bloco de água mais perto)
    const wet = Wd.waterNear(G.world);
    G.world.dir = 'down';
    if (wet) G.world.face = wet.dir;
    // a pesca é sempre em 1x e quem joga é o jogador (o AUTO só passa os textos);
    // só o modo gravação pesca sozinho
    const speed = G.speed;
    GM.setSpeed(1);
    const f = new window.FISHING.Fishing({ ...J.fishing(G, mon), autoFn: () => G.autopilot });
    f.lake = lk;
    G.fishing = f;
    const r = await f.promise;
    G.fishing = null;
    GM.setSpeed(speed);
    G.world.dir = 'right';
    G.world.face = null;
    if (!r.caught) {
      await say('Ah, não... O Pokémon escapou!');
      await say('Pescador: Acontece! Boa sorte na jornada!');
      return true;
    }
    if (r.treasure) {
      await say('Veio um baú preso no anzol!');
      await sayFoundItem(J.foundItem(G));
    }
    await say(`Fisgou! Um ${name(mon)} mordeu a isca!`);
    // pescaria perfeita: o Pokémon chega cansado (mais fácil de capturar)
    if (r.perfect) {
      mon.hp = Math.ceil(mon.maxhp * .6);
      await say(`Pescaria perfeita! ${name(mon)} chegou cansado.`);
    }
    const res = await runBattle({ enemies: [mon], kind: 'wild', theme: 'water', weather: J.battleWeather(G, stop) });
    return afterBattle(res, 'wild');
  }

  // ---------- Ginásios, Liga ----------
  async function evGym(i) {
    // a cidade do ginásio é uma parada só: primeiro o Centro Pokémon e a loja, depois o ginásio
    if (G.route[i].city) await cityStop(i);
    const enc = J.encounter(G, i);
    const g = enc.gym;
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
  async function evElite(i) {
    const enc = J.encounter(G, i);
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

  async function evChampion(i) {
    const enc = J.encounter(G, i);
    await say('Você entra na sala do Campeão...');
    await GM.goInside('champion', 'rival');
    await say('Blue: Até que enfim você chegou! Eu sou o Campeão agora. Prove que é melhor que eu!');
    const res = await runBattle({ enemies: enc.enemies, kind: 'champion', theme: 'champion', title: 'Campeão Blue', look: 'champion', vs: { name: 'Blue', subtitle: 'CAMPEÃO' } });
    if (!res.won) return false;
    await say('Blue: Não acredito... Eu perdi! Você é o novo Campeão!');
    await afterBattle(res, 'champion', enc.money);
    G.champion = true;
    await GM.hallOfFame();
    await say('Professor Carvalho: Parabéns! Seu nome está no Hall da Fama!');
    await GM.goOutside();
    return true;
  }

  const EVENTS = {
    wild: evWild, trainer: evTrainer, double: evDouble, rocket: evRocket, rival: evRival, boss: evBoss, dojo: evDojo,
    item: evItem, gift: evGift, egg: evEgg, merchant: evMerchant, magikarp: evMagikarp, weather: evWeather,
    city: cityStop, center: evCenter, heal: evHeal, story: evStory, choice: evChoice, fossil: evFossil, lab: evLab,
    quiz: evQuiz, fishing: evFishing, legend: evLegend, marowak: evMarowak, gym: evGym, elite: evElite, champion: evChampion,
    casino: i => window.SCENES.casino(i), safari: i => window.SCENES.safari(i),
  };

  // Retorna false se o time inteiro desmaiou
  async function run(i) {
    const stop = G.route[i];
    await hatchEggs();
    await weatherEnd();
    if (stop.ev !== 'choice') await enterPlace(i);
    return EVENTS[stop.ev] ? EVENTS[stop.ev](i) : true;
  }

  function reset() { lastPlace = null; }

  window.EVENTS = { run, reset, enterPlace, mapOf };
})();
