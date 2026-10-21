// Progressão: experiência, times de treinadores, Pokémon selvagens e sorteio dos eventos.
(function () {
  const R = window.RULES, M = window.MON;
  const { DEX } = R;

  // Quem fica no banco também ganha experiência (como o Exp. All)
  const BENCH_XP = .85;
  const XP_MULT = { wild: 1, trainer: 1.5, rocket: 1.8, rival: 2, gym: 2, elite: 2, champion: 2 };

  function xpFor(enemy, mult) {
    return Math.round((enemy.lvl * 12 + 50) * mult * (DEX[enemy.id].exp / 140 + .5) * .9);
  }

  // Dá experiência: participantes ganham 100%, quem ficou no banco ganha BENCH_XP.
  // Retorna mensagens de nível e golpes novos, e quem pode evoluir.
  function awardXp(party, result, kind) {
    const mult = XP_MULT[kind] || 1;
    let total = 0;
    for (const e of result.defeated) total += xpFor(e, mult);
    if (result.caught) total += xpFor(result.caught, mult);
    const log = [];
    const evolve = [];
    for (const mon of party) {
      if (mon.hp <= 0) continue;
      const gain = Math.round(total * (result.participants.has(mon.uid) ? 1 : BENCH_XP));
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

  function teamFromPool(pool, n, lvl, slot) {
    const fair = pool.filter(id => M.bst(id) <= M.maxBstFor(slot));
    if (fair.length) pool = fair;
    const out = [];
    for (let i = 0; i < n; i++) {
      const l = Math.max(2, lvl + M.randInt(-1, 1) + (i === n - 1 ? 1 : 0));
      out.push(makeMon(M.pick(pool), l));
    }
    return out;
  }

  function teamSize(slot, mode, extra = 0) {
    const min = mode === 2 ? 2 : 1;
    const stage = R.STAGE[slot];
    const max = stage < 1 ? 1 : stage < 2 ? 2 : stage < 5 ? 3 : 4;
    return Math.min(6, Math.max(min, M.randInt(min, max) + extra));
  }

  function trainer(slot, mode) {
    const cls = M.pick(R.TRAINER_CLASSES.filter(c => !c.minStage || R.STAGE[slot] >= c.minStage));
    const lvl = R.SLOT_LEVEL[slot];
    const team = teamFromPool(cls.pool, teamSize(slot, mode), lvl - 1, slot);
    return { cls, team, money: cls.money * Math.max(...team.map(m => m.lvl)) };
  }

  function rocket(slot, mode) {
    const lvl = R.SLOT_LEVEL[slot];
    const team = teamFromPool(R.ROCKET_POOL, teamSize(slot, mode, 1), lvl, slot);
    return { team, money: 40 * Math.max(...team.map(m => m.lvl)) };
  }

  function rival(starter, slot, mode) {
    const lvl = R.SLOT_LEVEL[slot] + 1;
    const team = [makeMon(16, lvl - 2)];
    const stage = R.STAGE[slot];
    if (stage >= 2) team.push(makeMon(M.pick([63, 133, 66, 58]), lvl - 1));
    if (stage >= 4) team.push(makeMon(M.pick([111, 102, 129, 92]), lvl - 1));
    if (stage >= 6) team.push(makeMon(M.pick([59, 130, 103, 65]), lvl));
    if (mode === 2 && team.length < 2) team.push(makeMon(19, lvl - 2));
    team.push(makeMon(R.RIVAL_STARTER[starter], lvl + 1, { minIv: 15 }));
    return { team, money: 60 * (lvl + 1) };
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
    const t = R.CHAMPION_TEAMS[starter] || R.CHAMPION_TEAMS[1];
    return { team: t.map(([id, l]) => M.create(id, l, { minIv: 25 })), money: 5000 };
  }

  function wild(slot, opts = {}) {
    let id, lvl = R.SLOT_LEVEL[slot] + M.randInt(-1, 1) + (opts.bonus || 0);
    if (opts.fish) id = M.weighted(R.FISH_POOL);
    else if (R.STAGE[slot] >= 4 && Math.random() < .025) { id = M.pick([144, 145, 146]); lvl += 4; }
    else if (R.STAGE[slot] >= 6 && Math.random() < .004) { id = M.pick([150, 151]); lvl += 6; }
    else id = M.wildSpecies(slot);
    const mon = makeMon(id, Math.max(2, lvl), { shiny: M.rollShiny(opts.shinyMult || 1) });
    return mon;
  }

  // Sorteia os eventos aleatórios da rota (o jogador não escolhe)
  const EVENT_WEIGHTS = [
    ['wild', 30], ['trainer', 30], ['item', 8], ['fishing', 9],
    ['rocket', 9], ['rival', 8], ['gift', 6],
  ];

  // Eventos que podem repetir em seguida (os outros não aparecem duas vezes seguidas)
  const COMMON = new Set(['wild', 'trainer']);

  function buildRoute() {
    const used = {};
    let prev = null;
    return R.ROUTE.map((slot, i) => {
      if (slot !== 'R') { prev = slot; return slot; }
      if (i === 0) { prev = 'wild'; return 'wild'; }
      let pick = 'trainer';
      for (let tries = 0; tries < 30; tries++) {
        const ev = M.weighted(EVENT_WEIGHTS);
        if (ev === prev && !COMMON.has(ev)) continue;
        if ((ev === 'rocket' || ev === 'rival') && R.STAGE[i] < 1) continue;
        if (ev === 'rival' && used.rival >= 3) continue;
        if (ev === 'gift' && used.gift >= 2) continue;
        if (ev === 'item' && used.item >= 3) continue;
        pick = ev;
        break;
      }
      used[pick] = (used[pick] || 0) + 1;
      prev = pick;
      return pick;
    });
  }

  window.PROGRESS = {
    XP_MULT, awardXp, levelUp, evolve, makeMon, trainer, rocket, rival, gym, elite, champion, wild, buildRoute,
  };
})();
