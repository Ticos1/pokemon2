// Efeitos sonoros sintetizados (estilo chiptune) com WebAudio.
(function () {
  let ctx = null;
  let muted = false;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, { type = 'square', vol = .08, at = 0, slide = 0 } = {}) {
    const a = ac();
    if (!a || muted) return;
    const t = a.currentTime + at;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + .02);
  }

  function noise(dur, { vol = .1, at = 0 } = {}) {
    const a = ac();
    if (!a || muted) return;
    const t = a.currentTime + at;
    const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = a.createBufferSource();
    const g = a.createGain();
    g.gain.value = vol;
    s.buffer = buf;
    s.connect(g).connect(a.destination);
    s.start(t);
  }

  const notes = (seq, step = .09, opts) => seq.forEach((f, i) => f && tone(f, step * 1.1, { ...opts, at: i * step }));

  const SFX = {
    blip: () => tone(1200, .03, { vol: .03 }),
    select: () => notes([880, 1320], .05),
    hit: () => { noise(.12, { vol: .12 }); tone(160, .1, { slide: -80, vol: .06 }); },
    superHit: () => { noise(.2, { vol: .18 }); tone(220, .2, { slide: -150, vol: .08 }); },
    weakHit: () => noise(.06, { vol: .05 }),
    shoot: () => tone(600, .07, { slide: -300, vol: .03, type: 'triangle' }),
    beam: () => tone(300, .4, { slide: 600, vol: .05, type: 'sawtooth' }),
    boom: () => { noise(.35, { vol: .2 }); tone(90, .3, { slide: -50, vol: .1 }); },
    faint: () => tone(500, .6, { slide: -420, vol: .07 }),
    throw: () => tone(400, .25, { slide: 500, vol: .04, type: 'triangle' }),
    pop: () => { noise(.08, { vol: .1 }); tone(900, .08, { vol: .05 }); },
    shake: () => tone(220, .08, { vol: .06 }),
    caught: () => notes([523, 659, 784, 1047, 0, 784, 1047], .1),
    escape: () => notes([400, 300], .08),
    levelUp: () => notes([523, 659, 784, 1047], .07, { type: 'triangle', vol: .07 }),
    heal: () => notes([659, 784, 988, 1319, 988, 1319], .12, { type: 'triangle', vol: .06 }),
    buy: () => notes([988, 1319], .06),
    shiny: () => notes([1568, 2093, 1568, 2093, 2637], .06, { vol: .05 }),
    victory: () => notes([523, 523, 523, 659, 0, 587, 659, 784, 0, 784, 1047], .1, { type: 'square', vol: .05 }),
    evolve: () => notes([392, 523, 659, 784, 1047, 1319], .14, { type: 'triangle', vol: .07 }),
    alert: () => notes([1320, 1760], .06),
    splash: () => { noise(.25, { vol: .08 }); tone(300, .15, { slide: -150, vol: .03, type: 'triangle' }); },
    reel: () => tone(1800, .02, { vol: .015 }),
    badge: () => notes([784, 988, 1175, 1568, 0, 1568, 1760, 2093], .1, { type: 'square', vol: .05 }),
    gameOver: () => notes([392, 330, 262, 196], .22, { type: 'triangle', vol: .07 }),
  };

  window.SFX = SFX;
  window.AUDIO = {
    unlock: ac,
    toggle() { muted = !muted; return muted; },
    set(m) { muted = !!m; return muted; },
    get muted() { return muted; },
  };
})();
