// The shot planner — one brain for the title-screen demo, the par calibration
// and every test. It plans on the REAL physics (simulateShot), so what it
// believes about a hole is what the hole does.
//
// The faculty mini-golf tests is AIM: how precisely you can set a direction
// and a strength. So a bot's skill is two numbers — angle wobble (degrees) and
// power wobble (fraction) — and it plans knowing its own wobble, choosing the
// shot that is good on average over a few wobbled copies rather than the one
// that is perfect only if executed perfectly. That is the difference between a
// careful player and a reckless one, and it keeps the kid bot from attempting
// three-rail miracles it cannot repeat.

const SKILLS = {
  kid:     { aim: 3.6, pow: 0.2, samples: 4 },    // a five-to-six-year-old with the long guide
  rosalie: { aim: 2.4, pow: 0.13, samples: 4 },   // a confident eight-year-old
  adult:   { aim: 1.5, pow: 0.09, samples: 4 },
  pro:     { aim: 0.8, pow: 0.05, samples: 3 },
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rnd) => { let u = 0; for (let i = 0; i < 6; i++) u += rnd(); return (u - 3) / 1.2247; };

const POWERS = [0.07, 0.12, 0.18, 0.26, 0.35, 0.46, 0.6, 0.78, 1];

const Bot = {
  SKILLS,
  rng: mulberry32,

  score(H, field, res, fromD) {
    if (res.end === "cup") return -1000;
    if (res.end === "water") return fromD + 260;
    let s = field.at(res.x, res.y);
    if (res.surf === 1) s += 30;               // resting in sand costs the next shot
    if (res.end === "timeout") s += 120;
    return s;
  },

  // Best (ang, pow) from (x, y) at hole time t for this skill.
  plan(H, x, y, t, skill) {
    const field = distanceField(H);
    const fromD = field.at(x, y);
    const nA = 48, cand = [];
    const direct = Math.atan2(H.cup[1] - y, H.cup[0] - x);
    const angles = [];
    for (let i = 0; i < nA; i++) angles.push((i / nA) * Math.PI * 2);
    for (let k = -3; k <= 3; k++) angles.push(direct + k * 0.02);
    for (const a of angles) for (const p of POWERS) {
      const r = simulateShot(H, x, y, a, p, t);
      cand.push({ a, p, s: this.score(H, field, r, fromD) });
    }
    cand.sort((u, v) => u.s - v.s);
    // refine the best few with a finer grid, then judge the finalists under
    // the bot's own wobble
    const fine = [];
    const seen = new Set();
    for (const c of cand.slice(0, 6)) {
      for (let da = -2; da <= 2; da++) for (let dp = -2; dp <= 2; dp++) {
        const a = c.a + da * 0.012, p = Math.max(0.04, Math.min(1, c.p * (1 + dp * 0.06)));
        const key = Math.round(a * 1000) + ":" + Math.round(p * 1000);
        if (seen.has(key)) continue; seen.add(key);
        const r = simulateShot(H, x, y, a, p, t);
        fine.push({ a, p, s: this.score(H, field, r, fromD) });
      }
    }
    fine.sort((u, v) => u.s - v.s);
    const sk = skill || SKILLS.pro;
    if (!sk.samples) return fine[0];
    const rnd = mulberry32(Math.round(x * 131 + y * 7919 + t * 1000));
    let best = null;
    for (const c of fine.slice(0, 8)) {
      let tot = c.s;
      for (let k = 0; k < sk.samples; k++) {
        const a = c.a + gauss(rnd) * (sk.aim * Math.PI / 180), p = Math.max(0.03, Math.min(1, c.p * (1 + gauss(rnd) * sk.pow)));
        tot += this.score(H, field, simulateShot(H, x, y, a, p, t), fromD);
      }
      const avg = tot / (sk.samples + 1);
      if (!best || avg < best.avg) best = { a: c.a, p: c.p, s: c.s, avg };
    }
    return best;
  },

  // Play one hole alone. Returns strokes taken (the stroke limit if picked up).
  playHole(H, skill, seed) {
    const rnd = mulberry32(seed);
    const sim = new HoleSim(H, [{ id: "bot", helper: false }]);
    let guard = 0;
    while (!sim.over && guard++ < 20) {
      const b = sim.ball;
      const pl = this.plan(H, b.x, b.y, sim.t, skill);
      const a = pl.a + gauss(rnd) * (skill.aim * Math.PI / 180);
      const p = Math.max(0.03, Math.min(1, pl.p * (1 + gauss(rnd) * skill.pow)));
      sim.shoot(a, p);
      let n = 0;
      while (sim.ball.state === "moving" && !sim.over && n++ < 240 * 40) sim.step();
      if (sim.balls[0].state !== "ready") break;
      // a human takes a moment between shots; the clock (and the spinners) move on
      for (let k = 0; k < 240 * (1 + rnd()); k++) sim.step();
    }
    return sim.balls[0].strokes;
  },
};

if (typeof module !== "undefined") module.exports = { Bot, SKILLS, mulberry32 };
