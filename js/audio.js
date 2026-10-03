// Sounds and music, layered on gamekit's synth. Everything is generated:
// nothing to load, nothing copyrighted, works offline.
//
// Three rules. The putt's pitch follows its power, so you hear how hard you
// hit it. A ball in the cup rattles before it drops, so the moment lands. And
// nothing ever buzzes: a splash or a bogey is a soft, falling "oh well".
//
// Each art style has its own little tune (toy marimba, music box, synth arps),
// played by a lookahead pump on the WebAudio clock so it never drifts.

const Sfx = GK.Sfx;
const MUSIC_VOL = 0.55;   // music notes are scaled by this; effects play at full

Object.assign(Sfx, {
  putt(pow) {
    this.noise({ dur: 0.03, vol: 0.06 + pow * 0.08 });
    this.tone({ freq: 520 + pow * 380, type: "sine", dur: 0.08, vol: 0.14 + pow * 0.08, slide: -120 });
    this.tone({ freq: 1500 + pow * 600, type: "triangle", dur: 0.03, vol: 0.05 });
  },
  wall(v) { const k = Math.min(1, v / 700); this.tone({ freq: 240 + k * 120, type: "triangle", dur: 0.05, vol: 0.05 + k * 0.1 }); this.noise({ dur: 0.02, vol: 0.03 + k * 0.05 }); },
  post(v) { const k = Math.min(1, v / 700); this.tone({ freq: 700, type: "sine", dur: 0.06, vol: 0.05 + k * 0.08 }); },
  bumper() { this.tone({ freq: 330, type: "square", dur: 0.09, vol: 0.07, slide: 280 }); this.tone({ freq: 660, type: "sine", dur: 0.14, vol: 0.08, when: 0.02, slide: 200 }); },
  spinner() { this.tone({ freq: 190, type: "triangle", dur: 0.08, vol: 0.12, slide: 60 }); this.noise({ dur: 0.04, vol: 0.05 }); },
  mover() { this.tone({ freq: 150, type: "sine", dur: 0.1, vol: 0.14, slide: -40 }); },
  portal() { this.tone({ freq: 300, type: "sine", dur: 0.28, vol: 0.09, slide: 900 }); this.tone({ freq: 900, type: "triangle", dur: 0.2, vol: 0.05, when: 0.06, slide: 600 }); },
  splash() { this.noise({ dur: 0.35, vol: 0.12 }); this.tone({ freq: 420, type: "sine", dur: 0.3, vol: 0.08, slide: -260 }); this.tone({ freq: 220, type: "sine", dur: 0.25, vol: 0.06, when: 0.15, slide: -80 }); },
  sand() { this.noise({ dur: 0.12, vol: 0.05 }); },
  // the ball rattles round the lip, then drops
  cup() {
    [0, 0.05, 0.095, 0.13, 0.16].forEach((w, i) => this.tone({ freq: 1250 - i * 110, type: "triangle", dur: 0.04, vol: 0.09 - i * 0.012, when: w }));
    this.tone({ freq: 180, type: "sine", dur: 0.18, vol: 0.18, when: 0.2, slide: -60 });
  },
  term(tier) {
    const P = [0, 4, 7, 12, 16];
    if (tier === "ace") {
      [0, 4, 7, 12, 7, 12, 16, 19].forEach((s, i) => this.tone({ freq: 523 * Math.pow(2, s / 12), type: "triangle", dur: 0.2, vol: 0.14, when: 0.35 + i * 0.09 }));
      [0, 7, 12].forEach((s, i) => this.tone({ freq: 262 * Math.pow(2, s / 12), type: "sine", dur: 0.5, vol: 0.1, when: 0.35 + i * 0.27 }));
    } else if (tier === "under") P.forEach((s, i) => this.tone({ freq: 523 * Math.pow(2, s / 12), type: "triangle", dur: 0.16, vol: 0.12, when: 0.35 + i * 0.07 }));
    else if (tier === "par") [0, 7, 12].forEach((s, i) => this.tone({ freq: 523 * Math.pow(2, s / 12), type: "sine", dur: 0.18, vol: 0.11, when: 0.35 + i * 0.09 }));
    else [7, 4].forEach((s, i) => this.tone({ freq: 392 * Math.pow(2, s / 12), type: "sine", dur: 0.22, vol: 0.08, when: 0.35 + i * 0.16, slide: -20 }));
  },
  turn() { this.tone({ freq: 880, type: "sine", dur: 0.08, vol: 0.06 }); this.tone({ freq: 1175, type: "sine", dur: 0.12, vol: 0.06, when: 0.08 }); },
  rewind() { this.tone({ freq: 900, type: "triangle", dur: 0.22, vol: 0.08, slide: -600 }); },
  pickup() { this.tone({ freq: 440, type: "sine", dur: 0.2, vol: 0.07, slide: -100 }); },
  aimTick(pow) { this.tone({ freq: 300 + pow * 900, type: "sine", dur: 0.02, vol: 0.025 }); },
  star(n) { this.tone({ freq: 660 + n * 220, type: "triangle", dur: 0.22, vol: 0.16, slide: 160 }); },
  fanfare() { [0, 4, 7, 12, 16, 12, 16, 19, 24].forEach((s, i) => this.tone({ freq: 392 * Math.pow(2, s / 12), type: "triangle", dur: 0.22, vol: 0.13, when: i * 0.11 })); },
});

// ------------------------------------------------------------------ music --
// A track is a root note, a tempo, a 4-chord loop (semitones) and a 16-step
// lead pattern per chord written as scale degrees of a major pentatonic.
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const TRACKS = {
  diorama: { root: 262, bpm: 104, lead: "triangle", leadVol: 0.05, bass: "sine", bassVol: 0.07,
    chords: [0, 5, 7, 5],
    pat: [[4, null, 2, null, 3, null, 4, 5, null, null, 4, null, 2, null, null, null], [3, null, 4, null, 5, null, 4, null, 3, null, 2, null, 1, null, null, null]] },
  paper: { root: 523, bpm: 84, lead: "sine", leadVol: 0.045, bass: "triangle", bassVol: 0.04,
    chords: [0, 9, 5, 7],
    pat: [[0, null, 4, null, 2, null, 5, null, 4, null, 2, null, 3, null, null, null], [5, null, 4, null, 2, null, 3, null, 1, null, 2, null, 0, null, null, null]] },
  glow: { root: 220, bpm: 116, lead: "square", leadVol: 0.022, bass: "sawtooth", bassVol: 0.03,
    chords: [0, 8, 3, 10],
    pat: [[0, 2, 4, 7, 4, 2, 0, 2, 4, 7, 9, 7, 4, 2, 4, 7], [5, 4, 2, 0, 2, 4, 5, 7, 5, 4, 2, 4, 2, 0, 2, 4]] },
};

const Music = {
  on: true, style: "diorama", timer: 0, nextT: 0, step: 0,
  start() {
    if (!this.on || this.timer || !Sfx.ctx) return;
    this.nextT = Sfx.ctx.currentTime + 0.1; this.step = 0;
    this.timer = setInterval(() => this.pump(), 110);
  },
  stop() { clearInterval(this.timer); this.timer = 0; },
  setStyle(s) { this.style = TRACKS[s] ? s : "diorama"; },
  setOn(v) { this.on = v; if (v) this.start(); else this.stop(); },
  pump() {
    const ctx = Sfx.ctx;
    if (!ctx || !Sfx.enabled) return;
    const tr = TRACKS[this.style], spb = 60 / tr.bpm / 2;
    if (this.nextT < ctx.currentTime - 0.3) this.nextT = ctx.currentTime + 0.05;   // after a hitch, skip silently
    while (this.nextT < ctx.currentTime + 0.6) {
      const bar = Math.floor(this.step / 16) % tr.chords.length, s = this.step % 16;
      const chord = tr.chords[bar], pat = tr.pat[bar % tr.pat.length], when = this.nextT - ctx.currentTime;
      const deg = pat[s];
      if (deg != null) Sfx.tone({ freq: tr.root * Math.pow(2, (chord + PENTA[deg]) / 12), type: tr.lead, dur: spb * 1.6, vol: tr.leadVol * MUSIC_VOL, when });
      if (s % 4 === 0) Sfx.tone({ freq: (tr.root / 4) * Math.pow(2, (chord + (s === 8 ? 7 : 0)) / 12), type: tr.bass, dur: spb * 3.2, vol: tr.bassVol * MUSIC_VOL, when });
      this.nextT += spb; this.step++;
    }
  },
};
