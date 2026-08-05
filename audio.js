/* 8-bit blip engine + looping chiptune. Web Audio, no asset files. */
(function () {
  let ctx = null;
  let muted = false;

  // master + music bus
  let master = null, musicBus = null, musicGain = null;
  let musicOn = false, musicTimer = null, musicStep = 0, nextNoteTime = 0;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.0; musicBus.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tones(steps, { type = 'square', gain = 0.06 } = {}) {
    if (muted) return;
    const c = ac();
    if (!c) return;
    const now = c.currentTime;
    steps.forEach(([freq, off, dur]) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + off);
      g.gain.setValueAtTime(0, now + off);
      g.gain.linearRampToValueAtTime(gain, now + off + 0.008);
      g.gain.setValueAtTime(gain, now + off + dur - 0.02);
      g.gain.linearRampToValueAtTime(0, now + off + dur);
      osc.connect(g).connect(master || c.destination);
      osc.start(now + off);
      osc.stop(now + off + dur + 0.01);
    });
  }

  /* ---------- looping chiptune ----------
     A gentle, slow arpeggio over a soft bass — pleasant, not busy. */
  const BPM = 104;
  const STEP = 60 / BPM / 2;            // eighth notes
  const N = { C3:130.81, E3:164.81, G3:196.0, A3:220.0, B3:246.94,
              C4:261.63, D4:293.66, E4:329.63, G4:392.0, A4:440.0, B4:493.88, C5:523.25 };
  // 16-step lead arpeggio (Am - F - C - G vibe)
  const LEAD = [N.A3,N.C4,N.E4,N.C4, N.F3=174.61,N.A3,N.C4,N.A3, N.C4,N.E4,N.G4,N.E4, N.G3,N.B3,N.D4,N.B3];
  const BASS = [N.A3/2, null, N.A3/2, null, 174.61/2, null, 174.61/2, null,
                N.C3, null, N.C3, null, N.G3/2, null, N.G3/2, null];

  function scheduleNote(step, time) {
    const c = ctx;
    // lead (triangle-ish soft square)
    const lf = LEAD[step % LEAD.length];
    if (lf) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle'; o.frequency.value = lf;
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(0.5, time + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, time + STEP * 0.9);
      o.connect(g).connect(musicBus);
      o.start(time); o.stop(time + STEP);
    }
    // bass
    const bf = BASS[step % BASS.length];
    if (bf) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'square'; o.frequency.value = bf;
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(0.32, time + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, time + STEP * 1.6);
      o.connect(g).connect(musicBus);
      o.start(time); o.stop(time + STEP * 1.8);
    }
  }

  function musicScheduler() {
    if (!musicOn || !ctx) return;
    while (nextNoteTime < ctx.currentTime + 0.12) {
      scheduleNote(musicStep, nextNoteTime);
      nextNoteTime += STEP;
      musicStep = (musicStep + 1) % 16;
    }
    musicTimer = setTimeout(musicScheduler, 40);
  }

  function startMusic() {
    const c = ac();
    if (!c) return;
    musicOn = true;
    musicStep = 0;
    nextNoteTime = c.currentTime + 0.08;
    const target = muted ? 0 : 0.11;
    musicBus.gain.cancelScheduledValues(c.currentTime);
    musicBus.gain.setValueAtTime(musicBus.gain.value, c.currentTime);
    musicBus.gain.linearRampToValueAtTime(target, c.currentTime + 1.2);
    clearTimeout(musicTimer);
    musicScheduler();
  }
  function stopMusic() {
    musicOn = false;
    clearTimeout(musicTimer);
    if (ctx && musicBus) {
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime);
      musicBus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    }
  }
  function setMusicVolume(v) {
    if (ctx && musicBus && !muted) musicBus.gain.setTargetAtTime(v, ctx.currentTime, 0.1);
  }

  const SFX = {
    move()   { tones([[440, 0, 0.05]], { gain: 0.04 }); },
    hover()  { tones([[660, 0, 0.03]], { gain: 0.022 }); },
    select() { tones([[523, 0, 0.05], [784, 0.05, 0.07], [1047, 0.12, 0.10]], { gain: 0.055 }); },
    back()   { tones([[392, 0, 0.06], [262, 0.06, 0.10]], { gain: 0.05 }); },
    coin()   { tones([[988, 0, 0.04], [1319, 0.05, 0.12]], { gain: 0.05 }); },
    levelup(){ tones([[523,0,0.07],[659,0.07,0.07],[784,0.14,0.07],[1047,0.21,0.16]], { gain: 0.06 }); },
    powerup(){ tones([[330,0,0.05],[440,0.05,0.05],[554,0.10,0.05],[659,0.15,0.05],[880,0.20,0.14]], { gain: 0.05 }); },

    setMuted(v) {
      muted = !!v;
      if (!muted) ac();
      if (ctx && musicBus) musicBus.gain.setTargetAtTime(muted ? 0 : (musicOn ? 0.11 : 0), ctx.currentTime, 0.08);
    },
    isMuted() { return muted; },
    warm() { ac(); },
    startMusic, stopMusic, setMusicVolume,
    isMusicOn() { return musicOn; },
  };

  window.SFX = SFX;
})();
