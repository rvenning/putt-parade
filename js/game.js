// The game, DOM-free: one hole played by 1–4 people taking turns (HoleSim),
// and a round of holes with a scorecard (Match). Nothing here reads the DOM,
// draws, or calls Math.random, so the bots and tests drive the real thing.
//
// Turns go round in seat order, one stroke each. A player whose ball is in the
// cup (or picked up at the stroke limit) drops out of the rotation. Other
// players' balls are ghosts: drawn, never collided with.

const REST_STEPS = 48;          // still for 0.2 s = at rest
const SHOT_MAX_T = 30;          // a shot that has not settled by now is stopped
const strokeLimit = (par) => Math.min(10, par + 4);

const TERMS = [
  [-3, "Albatross!", "Three under par"], [-2, "Eagle!", "Two under par"], [-1, "Birdie!", "One under par"],
  [0, "Par", "Right on target"], [1, "Bogey", "One over par"], [2, "Double bogey", "Two over par"],
];
function termFor(strokes, par) {
  if (strokes === 1) return { word: "Hole in one!", sub: "Ace!", tier: "ace" };
  const d = strokes - par;
  const t = TERMS.find((x) => x[0] === d);
  if (t) return { word: t[1], sub: t[2], tier: d < 0 ? "under" : d === 0 ? "par" : "over" };
  return d < 0 ? { word: "Albatross!", sub: `${-d} under par`, tier: "under" } : { word: `+${d}`, sub: `${d} over par`, tier: "over" };
}

// One shot simulated to the end, from (x, y) at hole time t0. Used by the
// aiming guide (stopAtBounce) and by the bots (to the end). Returns where it
// stopped and why; `path` is filled with every nth position if given.
const _sb = { x: 0, y: 0, vx: 0, vy: 0, lock: -1, hit: 0, surf: 0 };
function simulateShot(H, x, y, ang, pow, t0, opts) {
  const o = opts || {};
  const b = _sb;
  b.x = x; b.y = y; b.vx = Math.cos(ang) * pow * PHYS.MAX_V; b.vy = Math.sin(ang) * pow * PHYS.MAX_V; b.lock = -1;
  let t = t0, still = 0, bounces = 0;
  const maxSteps = Math.round((o.maxT || 14) / PHYS.DT), every = o.every || 8;
  for (let i = 0; i < maxSteps; i++) {
    t += PHYS.DT;
    const ev = Physics.step(H, b, t);
    if (o.path && i % every === 0) o.path.push(b.x, b.y);
    if (ev === EV.CUP) return { x: H.cup[0], y: H.cup[1], end: "cup", t, bounces };
    if (ev === EV.WATER) return { x: b.x, y: b.y, end: "water", t, bounces };
    if (ev > 0 && ev !== EV.PORTAL) { bounces++; if (o.stopAtBounce && bounces >= o.stopAtBounce) { if (o.path) o.path.push(b.x, b.y); return { x: b.x, y: b.y, end: "bounce", t, bounces }; } }
    if (b.vx * b.vx + b.vy * b.vy < PHYS.REST_V * PHYS.REST_V) { if (++still >= REST_STEPS) { if (o.path) o.path.push(b.x, b.y); return { x: b.x, y: b.y, end: "rest", t, bounces, surf: b.surf }; } }
    else still = 0;
  }
  return { x: b.x, y: b.y, end: "timeout", t, bounces, surf: b.surf };
}

class HoleSim {
  // players: [{ id, name, avatar, color, helper }]
  constructor(H, players, opts) {
    const o = opts || {};
    this.H = H;
    this.players = players;
    this.t = o.t0 || 0;
    this.acc = 0;
    this.limit = strokeLimit(H.par);
    this.balls = players.map((p) => ({
      x: H.tee[0], y: H.tee[1], vx: 0, vy: 0, lock: -1, hit: 0, surf: 0,
      strokes: 0, state: "ready", from: null, snap: null, still: 0, shotT: 0,
      doOvers: p.helper ? 1 : 0, rolled: 0,
    }));
    this.turn = 0;
    this.over = false;
    this.events = [];
  }

  get ball() { return this.balls[this.turn]; }
  get player() { return this.players[this.turn]; }
  canShoot() { return !this.over && this.ball.state === "ready"; }
  moving() { return this.ball.state === "moving"; }

  shoot(ang, pow) {
    if (!this.canShoot()) return false;
    pow = Math.max(0.02, Math.min(1, pow));
    const b = this.ball;
    b.snap = { x: b.x, y: b.y, strokes: b.strokes };
    b.from = { x: b.x, y: b.y };
    b.vx = Math.cos(ang) * pow * PHYS.MAX_V; b.vy = Math.sin(ang) * pow * PHYS.MAX_V;
    b.strokes++; b.state = "moving"; b.still = 0; b.shotT = 0; b.lock = -1;
    this.events.push({ type: "shot", seat: this.turn, pow, x: b.x, y: b.y, ang });
    return true;
  }

  // A helper's do-over: take your last shot again (your ball goes back, the
  // stroke is not counted). Once per hole, only on your turn, never once holed.
  canDoOver() { const b = this.ball; return !this.over && b.state === "ready" && b.doOvers > 0 && !!b.snap; }
  doOver() {
    if (!this.canDoOver()) return false;
    const b = this.ball;
    b.x = b.snap.x; b.y = b.snap.y; b.strokes = b.snap.strokes; b.snap = null; b.doOvers--;
    this.events.push({ type: "doOver", seat: this.turn, x: b.x, y: b.y });
    return true;
  }

  // Real time in; fixed steps out. The hole clock always runs so spinners turn
  // while someone aims.
  tick(dt) {
    if (!(dt > 0)) return;
    this.acc += Math.min(0.05, dt);
    let n = 0;
    while (this.acc >= PHYS.DT && n < 40) { this.step(); this.acc -= PHYS.DT; n++; }
  }

  step() {
    this.t += PHYS.DT;
    if (this.over) return;
    const b = this.ball;
    if (b.state !== "moving") return;
    b.shotT += PHYS.DT;
    const ox = b.x, oy = b.y;
    const ev = Physics.step(this.H, b, this.t);
    b.rolled += Math.hypot(b.x - ox, b.y - oy);
    if (ev === EV.CUP) {
      b.x = this.H.cup[0]; b.y = this.H.cup[1]; b.vx = b.vy = 0; b.state = "in";
      this.events.push({ type: "cup", seat: this.turn, strokes: b.strokes, par: this.H.par, term: termFor(b.strokes, this.H.par) });
      return this.endTurn();
    }
    if (ev === EV.WATER) {
      this.events.push({ type: "water", seat: this.turn, x: b.x, y: b.y });
      b.x = b.from.x; b.y = b.from.y; b.vx = b.vy = 0; b.strokes++; b.lock = -1;
      return this.settle(b);
    }
    if (ev) this.events.push({ type: ev === EV.WALL ? "wall" : ev === EV.BUMPER ? "bumper" : ev === EV.SPINNER ? "spinner" : ev === EV.MOVER ? "mover" : ev === EV.POST ? "post" : "portal", seat: this.turn, x: b.x, y: b.y, v: b.hit, i: b.bumper });
    if (b.vx * b.vx + b.vy * b.vy < PHYS.REST_V * PHYS.REST_V) { if (++b.still >= REST_STEPS) return this.settle(b); }
    else b.still = 0;
    if (b.shotT > SHOT_MAX_T) return this.settle(b);
  }

  settle(b) {
    b.vx = b.vy = 0;
    if (b.strokes >= this.limit) {
      b.state = "out";
      this.events.push({ type: "pickup", seat: this.turn, strokes: this.limit });
      b.strokes = this.limit;
    } else {
      b.state = "ready";
      this.events.push({ type: "rest", seat: this.turn, x: b.x, y: b.y });
    }
    this.endTurn();
  }

  endTurn() {
    const n = this.balls.length;
    for (let k = 1; k <= n; k++) {
      const i = (this.turn + k) % n;
      if (this.balls[i].state === "ready") {
        const changed = i !== this.turn;
        this.turn = i;
        this.events.push({ type: "turn", seat: i, changed });
        return;
      }
    }
    this.over = true;
    this.events.push({ type: "holeOver", strokes: this.balls.map((b) => b.strokes) });
  }

  scores() { return this.balls.map((b) => b.strokes); }
}

// A round: a list of holes, the players, and the scorecard.
class Match {
  // cfg: { mode: "round"|"hole"|"daily", course, holes: [def], players, mirror, date }
  constructor(cfg) {
    this.cfg = cfg;
    this.players = cfg.players;
    this.holeIdx = 0;
    this.card = cfg.players.map(() => cfg.holes.map(() => null));
    this.done = false;
    this.startHole();
  }
  get hole() { return this.cfg.holes[this.holeIdx]; }
  startHole() {
    this.H = compileHole(this.hole, { mirror: this.cfg.mirror });
    this.sim = new HoleSim(this.H, this.players);
  }
  // Called once the hole is over: writes its scores; returns true if more holes remain.
  recordHole() {
    const s = this.sim.scores();
    s.forEach((v, p) => { this.card[p][this.holeIdx] = v; });
    return this.holeIdx < this.cfg.holes.length - 1;
  }
  nextHole() {
    if (this.holeIdx >= this.cfg.holes.length - 1) { this.done = true; return false; }
    this.holeIdx++;
    this.startHole();
    return true;
  }
  par(upTo) { return this.cfg.holes.slice(0, upTo == null ? this.cfg.holes.length : upTo).reduce((s, h) => s + h.par, 0); }
  total(p) { return this.card[p].reduce((s, v) => s + (v || 0), 0); }
  played(p) { return this.card[p].filter((v) => v != null).length; }
  // to-par over the holes played so far
  toPar(p) { let d = 0; this.card[p].forEach((v, i) => { if (v != null) d += v - this.cfg.holes[i].par; }); return d; }
  standings() {
    return this.players.map((pl, i) => ({ seat: i, player: pl, total: this.total(i), toPar: this.toPar(i) }))
      .sort((a, b) => a.total - b.total || a.seat - b.seat);
  }
}

// Course stars from a finished round: finishing earns one; the bands are the
// course par plus a margin set per course (easier courses ask for less).
function roundStars(total, coursePar, bands) {
  const b = bands || [5, 0];
  if (total <= coursePar + b[1]) return 3;
  if (total <= coursePar + b[0]) return 2;
  return 1;
}

// The Daily Hole: one hole from the whole collection, picked by the date, and
// flipped left-to-right on odd days so it is never quite the hole you know.
function dailyPick(dateKey, nHoles) {
  let h = 2166136261;
  for (let i = 0; i < dateKey.length; i++) { h ^= dateKey.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return { index: h % nHoles, mirror: ((h >>> 9) & 1) === 1 };
}

const fmtToPar = (d) => (d === 0 ? "E" : d > 0 ? `+${d}` : `${d}`);

if (typeof module !== "undefined") module.exports = { HoleSim, Match, simulateShot, termFor, strokeLimit, roundStars, dailyPick, fmtToPar };
