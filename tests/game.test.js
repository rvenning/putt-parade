// The DOM-free game: turns, penalties, the helper's do-over, the stroke
// limit, the scorecard, the daily pick, and the clock guards.
const test = require("node:test");
const assert = require("node:assert");
const E = require("./load.js");
const { PHYS, HOLES, HoleSim, Match } = E;

const holeById = (id) => HOLES.find((h) => h.id === id);
const settle = (sim) => { let n = 0; while (sim.ball.state === "moving" && n++ < 240 * 40) sim.step(); };
const sinkNow = (sim) => { const b = sim.ball; b.x = sim.H.cup[0]; b.y = sim.H.cup[1] + 20; sim.shoot(-Math.PI / 2, 0.1); settle(sim); };

test("turns go round in seat order, one stroke each, and holed players drop out", () => {
  const sim = new HoleSim(E.compileHole(holeById("meadow-1")), [{ id: "a" }, { id: "b" }, { id: "c" }]);
  assert.strictEqual(sim.turn, 0);
  sim.shoot(-Math.PI / 2, 0.15); settle(sim); assert.strictEqual(sim.turn, 1);
  sinkNow(sim);
  assert.strictEqual(sim.balls[1].state, "in"); assert.strictEqual(sim.turn, 2);
  sim.shoot(-Math.PI / 2, 0.15); settle(sim); assert.strictEqual(sim.turn, 0);
  sim.shoot(-Math.PI / 2, 0.1); settle(sim); assert.strictEqual(sim.turn, 2, "seat 1 is skipped once holed");
  sinkNow(sim); sinkNow(sim);
  assert.ok(sim.over);
  assert.ok(sim.events.some((e) => e.type === "holeOver"));
});

test("water costs a stroke and puts the ball back where the shot started", () => {
  const H = E.compileHole(holeById("pier-4"));   // a pond straight up the middle
  const sim = new HoleSim(H, [{ id: "a" }]);
  const [tx, ty] = H.tee;
  sim.shoot(-Math.PI / 2, 0.6); settle(sim);
  assert.ok(sim.events.some((e) => e.type === "water"), "the straight shot should find the pond");
  assert.strictEqual(sim.ball.strokes, 2);
  assert.deepStrictEqual([sim.ball.x, sim.ball.y], [tx, ty]);
});

test("the helper's do-over undoes one stroke per hole, and only for helpers", () => {
  const H = E.compileHole(holeById("meadow-3"));
  const sim = new HoleSim(H, [{ id: "h", helper: true }]);
  sim.shoot(-Math.PI / 2, 0.4); settle(sim);
  assert.ok(sim.canDoOver());
  assert.ok(sim.doOver());
  assert.strictEqual(sim.ball.strokes, 0); assert.deepStrictEqual([sim.ball.x, sim.ball.y], [...H.tee]);
  sim.shoot(-Math.PI / 2, 0.4); settle(sim);
  assert.ok(!sim.canDoOver(), "only one per hole");
  const plain = new HoleSim(H, [{ id: "p", helper: false }]);
  plain.shoot(-Math.PI / 2, 0.4); settle(plain);
  assert.ok(!plain.canDoOver());
});

test("reaching the stroke limit picks the ball up and scores the limit", () => {
  const H = E.compileHole(holeById("meadow-1"));
  const sim = new HoleSim(H, [{ id: "a" }]);
  for (let i = 0; i < 20 && !sim.over; i++) { sim.shoot(Math.PI / 2, 0.05); settle(sim); }
  assert.ok(sim.over);
  assert.strictEqual(sim.balls[0].state, "out");
  assert.strictEqual(sim.balls[0].strokes, E.strokeLimit(H.par));
});

test("a bad dt never moves the clock or the ball, and a huge one is capped", () => {
  const sim = new HoleSim(E.compileHole(holeById("meadow-7")), [{ id: "a" }]);
  sim.shoot(-Math.PI / 2, 0.5);
  const t0 = sim.t, x0 = sim.ball.x, y0 = sim.ball.y;
  for (const bad of [-1, -0.016, 0, NaN, undefined]) sim.tick(bad);
  assert.strictEqual(sim.t, t0); assert.strictEqual(sim.ball.x, x0); assert.strictEqual(sim.ball.y, y0);
  sim.tick(60);
  assert.ok(sim.t - t0 <= 0.0501 + 1e-9);
});

test("a match writes the scorecard hole by hole and totals it", () => {
  const holes = E.COURSES[0].holes.slice(0, 3);
  const m = new Match({ mode: "round", course: 0, holes, players: [{ id: "a" }, { id: "b" }] });
  for (let h = 0; h < 3; h++) {
    while (!m.sim.over) sinkNow(m.sim);
    m.recordHole();
    if (h < 2) assert.ok(m.nextHole());
  }
  assert.deepStrictEqual([...m.card[0]], [1, 1, 1]);
  assert.strictEqual(m.total(1), 3);
  assert.strictEqual(m.toPar(0), 3 - m.par());
  assert.ok(!m.nextHole()); assert.ok(m.done);
});

test("terms: ace, birdie, par, bogey", () => {
  assert.strictEqual(E.termFor(1, 3).tier, "ace");
  assert.strictEqual(E.termFor(2, 3).word, "Birdie!");
  assert.strictEqual(E.termFor(3, 3).word, "Par");
  assert.strictEqual(E.termFor(4, 3).word, "Bogey");
  assert.strictEqual(E.termFor(7, 3).tier, "over");
});

test("the daily pick is the same for everyone on a date, and varies across dates", () => {
  const a = E.dailyPick("2026-10-03", 36), b = E.dailyPick("2026-10-03", 36);
  assert.deepStrictEqual({ ...a }, { ...b });
  const seen = new Set(); for (let d = 1; d <= 28; d++) seen.add(E.dailyPick(`2026-11-${String(d).padStart(2, "0")}`, 36).index);
  assert.ok(seen.size >= 15, `only ${seen.size} different holes in 28 days`);
});

test("round stars follow the course bands", () => {
  for (const c of E.COURSES) {
    assert.strictEqual(E.roundStars(c.par + c.bands[1], c.par, c.bands), 3);
    assert.strictEqual(E.roundStars(c.par + c.bands[1] + 1, c.par, c.bands), 2);
    assert.strictEqual(E.roundStars(c.par + c.bands[0] + 1, c.par, c.bands), 1);
  }
});

test("the engine is pure: no Math.random and no DOM in the engine files", () => {
  const fs = require("node:fs"), path = require("node:path");
  for (const f of ["physics.js", "hole.js", "courses.js", "game.js", "bot.js"]) {
    const src = fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.ok(!/Math\.random\s*\(/.test(src), `${f} calls Math.random`);
    assert.ok(!/\bdocument\./.test(src), `${f} touches the DOM`);
  }
});

test("the title-screen demos replay exactly on the current engine", () => {
  const { DEMO } = require("../js/demo.js");
  for (const d of DEMO) {
    const sim = new HoleSim(E.compileHole(holeById(d.hole)), [{ id: "x" }]);
    let k = 0;
    for (let i = 0; i < 240 * 40 && !sim.over; i++) { const s = d.shots[k]; if (s && sim.canShoot() && sim.t >= s.t - PHYS.DT / 2) { sim.shoot(s.a, s.p); k++; } sim.step(); }
    assert.ok(sim.over && sim.balls[0].state === "in", `${d.hole} demo no longer holes out: re-run tools/make-demo.js`);
  }
});
