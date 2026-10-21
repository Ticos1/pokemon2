// Progressão: experiência, times de treinadores e Pokémon selvagens de cada parada.
(function () {
  const R = window.RULES, M = window.MON, K = window.KANTO;
  const { DEX } = R;

  // Quem fica no banco também ganha experiência (como o Exp. All)
  const BENCH_XP = .85;
  const XP_MULT = { wild: 1, trainer: 1.5, rocket: 1.8, rival: 2, boss: 2, legend: 1.5, gym: 2, elite: 2, champion: 2 };

  // Experiência: base da espécie x nível / 7 (Game Boy), ajustada pela diferença de nível como na
  // 5ª geração: quem está abaixo do inimigo ganha mais, quem está acima ganha menos
  // O começo da jornada tem poucas batalhas até o Brock e o Blue em Cerulean; o fim tem muitas
  const xpScale = lvl => Math.min(1.3, Math.max(.55, 1.45 - lvl / 40));
  // a jornada tem só 3 paradas entre os ginásios: cada batalha do caminho vale bem mais que no
  // Game Boy (ginásios, Elite dos 4 e Campeão ficam como estavam)
  const JOURNEY_XP = 4;
  const LEAGUE_KINDS = new Set(['gym', 'elite', 'champion']);
  function xpFor(enemy, mult, lvl = enemy.lvl, kind) {
    const k = Math.pow((2 * enemy.lvl + 10) / (enemy.lvl + lvl + 10), 2.5);
    const boost = LEAGUE_KINDS.has(kind) ? 1 : JOURNEY_XP;
    return Math.round(DEX[enemy.id].exp * enemy.lvl / 7 * mult * k * xpScale(enemy.lvl) * boost);
  }

  // Dá experiência: participantes ganham 100%, quem ficou no banco ganha BENCH_XP.
  // Retorna mensagens de nível e golpes novos, e quem pode evoluir.
  function awardXp(party, result, kind) {
    const mult = XP_MULT[kind] || 1;
    const foes = [...result.defeated, ...(result.caught ? [result.caught] : [])];
    const lead = party.find(m => result.participants.has(m.uid)) || party[0];
    const total = foes.reduce((s, e) => s + xpFor(e, mult, lead.lvl, kind), 0);
    const log = [];
    const evolve = [];
    for (const mon of party) {
      if (mon.hp <= 0) continue;
      const share = result.participants.has(mon.uid) ? 1 : BENCH_XP;
      const gain = Math.round(foes.reduce((s, e) => s + xpFor(e, mult, mon.lvl, kind), 0) * share);
      if (!gain) continue;
      mon.xp += gain;
      const startLvl = mon.lvl;
      while (mon.lvl < 100 && mon.xp >= M.xpNext(mon.lvl)) {
        mon.xp -= M.xpNext(mon.lvl);
        mon.lvl++;
      }
      if (mon.lvl > startLvl) {
        M.refresh(mon);
        log.push({ kind: 'level', mon, lvl: mon.lvl });
        const forgot = R.forgottenAt(mon, startLvl);
        R.newMovesAt(mon, startLvl).forEach((mv, i) => log.push({ kind: 'move', mon, move: mv, forgot: forgot[i] }));
        const to = M.evolutionFor(mon);
        if (to) evolve.push({ mon, to });
      }
    }
    return { total, log, evolve };
  }

  // Doce Raro: sobe 1 nível. Retorna os golpes novos ({ move, forgot })
  function levelUp(mon) {
    const start = mon.lvl;
    mon.lvl++;
    mon.xp = 0;
    M.refresh(mon);
    const forgot = R.forgottenAt(mon, start);
    return R.newMovesAt(mon, start).map((move, i) => ({ move, forgot: forgot[i] }));
  }

  function evolve(mon, to) {
    mon.id = to;
    M.refresh(mon);
  }

  function makeMon(id, lvl, opts) {
    return M.create(M.evolvedFor(id, lvl), lvl, opts);
  }

  function teamFromPool(pool, n, lvl, stage) {
    const fair = pool.filter(id => M.bst(id) <= M.maxBstFor(stage));
    if (fair.length) pool = fair;
    const out = [];
    for (let i = 0; i < n; i++) {
      const l = Math.max(2, lvl + M.randInt(-1, 1) + (i === n - 1 ? 1 : 0));
      out.push(makeMon(M.pick(pool), l));
    }
    return out;
  }

  function teamSize(stage, mode, extra = 0) {
    const min = mode === 2 ? 2 : 1;
    const max = stage < 1 ? 1 : stage < 2 ? 2 : stage < 5 ? 3 : 4;
    return Math.min(6, Math.max(min, M.randInt(min, max) + extra));
  }

  // Classe de treinador da parada: a fixa ou uma das que aparecem na área
  function trainerClass(stop) {
    const area = K.AREAS[stop.area] || {};
    const key = stop.cls || M.pick(area.trainers || ['youngster', 'lass', 'bug']);
    return { key, ...R.TRAINER_CLASSES[key] };
  }

  function trainer(stop, mode, cls = trainerClass(stop)) {
    const team = teamFromPool(cls.pool, teamSize(stop.stage, mode), stop.lvl - 1, stop.stage);
    return { cls, team, money: cls.money * Math.max(...team.map(m => m.lvl)) };
  }

  // Dupla de treinadores: cada um com 1 ou 2 Pokémon, batalha 2x2
  function double(stop) {
    const a = trainerClass(stop);
    let b = trainerClass(stop);
    if (Math.random() < .5) b = a; // gêmeos, dois da mesma classe
    const n = stop.stage < 2 ? 1 : M.randInt(1, 2);
    const team = [...teamFromPool(a.pool, n, stop.lvl - 1, stop.stage), ...teamFromPool(b.pool, n, stop.lvl - 1, stop.stage)];
    return { a, b, team, money: (a.money + b.money) * Math.max(...team.map(m => m.lvl)) };
  }

  function rocket(stop, mode) {
    const cls = R.TRAINER_CLASSES.rocket;
    const team = teamFromPool(cls.pool, teamSize(stop.stage, mode, 1), stop.lvl, stop.stage);
    return { team, money: 40 * Math.max(...team.map(m => m.lvl)) };
  }

  // Time do Blue no encontro n (n = 6 é o Campeão)
  function rival(starter, n, mode) {
    const rs = R.RIVAL_STARTER[starter];
    const [A, B] = R.RIVAL_EXTRA[rs];
    const team = R.RIVAL_TEAMS[n].map(([id, l]) => makeMon(id === 'S' ? rs : id === 'A' ? A : id === 'B' ? B : id, l, { minIv: n >= 5 ? 25 : 15 }));
    if (mode === 2 && team.length < 2) team.unshift(makeMon(19, team[0].lvl - 1));
    return { team, money: 60 * Math.max(...team.map(m => m.lvl)) };
  }

  function gym(i) {
    const g = R.GYMS[i];
    return { gym: g, team: g.team.map(([id, l]) => M.create(id, l, { minIv: g.iv ?? 20 })), money: g.money * Math.max(...g.team.map(t => t[1])) };
  }

  function elite(i) {
    const e = R.ELITE[i];
    return { elite: e, team: e.team.map(([id, l]) => M.create(id, l, { minIv: 25 })), money: 100 * Math.max(...e.team.map(t => t[1])) };
  }

  function champion(starter) {
    return { team: rival(starter, 6, 1).team, money: 10000 };
  }

  function boss(key) {
    const b = R.BOSSES[key];
    return { boss: b, team: b.team.map(([id, l]) => M.create(id, l, { minIv: 20 })), money: b.money };
  }

  // Pokémon selvagem da área (ou da pesca). opts.id = espécie fixa (lendários, Snorlax)
  function wild(stop, opts = {}) {
    const area = K.AREAS[stop.area] || {};
    let lvl = (opts.lvl || stop.lvl || 5) + (opts.id ? 0 : M.randInt(-1, 1)) + (opts.bonus || 0);
    let id = opts.id;
    if (!id) id = M.weighted(opts.fish ? K.FISH : K.POOLS[opts.pool || area.pool] || K.POOLS.route1);
    return makeMon(id, Math.max(2, lvl), { shiny: M.rollShiny(opts.shinyMult || 1), minIv: opts.id ? 15 : 0 });
  }

  window.PROGRESS = {
    XP_MULT, awardXp, levelUp, evolve, makeMon, trainerClass, trainer, double, rocket, rival, gym, elite, champion, boss, wild,
  };
})();
