// Jogo salvo no navegador (localStorage): grava antes de cada parada da rota.
// Se a aba fechar no meio de uma batalha, a partida volta para o começo daquela parada.
(function () {
  const KEY = 'pokemon-jornada:save:v2';
  const PREFS = 'pokemon-jornada:prefs';
  const FIELDS = ['starter', 'mode', 'party', 'pc', 'bag', 'money', 'badges', 'route', 'step', 'stats', 'seen', 'coins', 'eggs', 'fossils', 'weather', 'champion'];

  function storage() {
    try { return window.localStorage; } catch (e) { return null; }
  }

  function write(G, elapsed) {
    const s = storage();
    if (!s) return;
    const data = { v: 2, elapsed, savedAt: Date.now() };
    for (const k of FIELDS) data[k] = G[k];
    try { s.setItem(KEY, JSON.stringify(data)); } catch (e) { /* cheio ou bloqueado */ }
  }

  function read() {
    const s = storage();
    if (!s) return null;
    try {
      const data = JSON.parse(s.getItem(KEY));
      if (!data || data.v !== 2 || !Array.isArray(data.party) || !data.party.length) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function clear() {
    const s = storage();
    try { if (s) s.removeItem(KEY); } catch (e) { /* ignorado */ }
  }

  // Preferências que valem entre partidas (modo de batalha, som, modo gravação)
  function prefs(update) {
    const s = storage();
    let p = {};
    try { p = JSON.parse(s && s.getItem(PREFS)) || {}; } catch (e) { p = {}; }
    if (update) {
      Object.assign(p, update);
      try { if (s) s.setItem(PREFS, JSON.stringify(p)); } catch (e) { /* ignorado */ }
    }
    return p;
  }

  window.SAVE = { write, read, clear, prefs };
})();
