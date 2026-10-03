// Lints all 36 holes against the engine they run on. Every check collects
// offenders and asserts the list is empty, so one run names them all.
const test = require("node:test");
const assert = require("node:assert");
const E = require("./load.js");
const { PHYS, Physics, HOLES, COURSES } = E;
const R = PHYS.R, SQUEEZE = 2 * R + 3;

const segsOf = (H) => Array.from({ length: H.nSegs }, (_, i) => [H.segs[i * 4], H.segs[i * 4 + 1], H.segs[i * 4 + 2], H.segs[i * 4 + 3]]);
const segDist = (x, y, s) => { Physics.closest(x, y, s[0], s[1], s[2], s[3]); return Math.hypot(x - Physics._cx, y - Physics._cy); };
function cross(a, b, c, d) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
// distance along a ray to the nearest rail it hits (Infinity if none)
function rayHit(x, y, ux, uy, segs) {
  let best = Infinity;
  for (const s of segs) {
    const ex = s[2] - s[0], ey = s[3] - s[1], den = ux * ey - uy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((s[0] - x) * ey - (s[1] - y) * ex) / den, u = ((s[0] - x) * uy - (s[1] - y) * ux) / den;
    if (t >= 0 && u >= 0 && u <= 1) best = Math.min(best, t);
  }
  return best;
}

test("there are 4 courses of 9 holes, each with a unique id", () => {
  assert.strictEqual(COURSES.length, 4);
  assert.strictEqual(HOLES.length, 36);
  assert.strictEqual(new Set(HOLES.map((h) => h.id)).size, 36);
  for (const c of COURSES) assert.strictEqual(c.holes.length, 9);
});

test("every green is a simple polygon inside the field, with blocks inside it", () => {
  const bad = [];
  for (const h of HOLES) {
    const g = h.green;
    for (const [x, y] of g) if (x < 12 || x > PHYS.W - 12 || y < 12 || y > PHYS.H - 12) bad.push(`${h.id}: vertex ${x},${y} off the field`);
    for (let i = 0; i < g.length; i++) for (let j = i + 2; j < g.length; j++) {
      if (i === 0 && j === g.length - 1) continue;
      if (cross(g[i], g[(i + 1) % g.length], g[j], g[(j + 1) % g.length])) bad.push(`${h.id}: green edges ${i} and ${j} cross`);
    }
    for (const b of h.blocks || []) for (const [x, y] of b) {
      const cx = b.reduce((s, p) => s + p[0], 0) / b.length, cy = b.reduce((s, p) => s + p[1], 0) / b.length;
      const ix = x + (cx - x) * 0.02, iy = y + (cy - y) * 0.02;
      if (!Physics.pointInPoly(ix, iy, g)) bad.push(`${h.id}: block vertex ${x},${y} outside the green`);
    }
  }
  assert.deepStrictEqual(bad, []);
});

test("tee and cup sit in open, playable space, and the cup is on dry ground", () => {
  const bad = [];
  for (const h of HOLES) {
    const H = E.compileHole(h);
    if (!E.playable(H, h.tee[0], h.tee[1], R + 6)) bad.push(`${h.id}: tee too close to something`);
    if (!E.playable(H, h.cup[0], h.cup[1], PHYS.CUP_R + 4)) bad.push(`${h.id}: cup too close to something`);
    for (const r of H.sand.concat(H.water, H.slopes, H.pads)) if (Physics.inRegion(r, h.cup[0], h.cup[1])) bad.push(`${h.id}: cup inside a region`);
    for (const r of H.sand.concat(H.water, H.pads)) if (Physics.inRegion(r, h.tee[0], h.tee[1])) bad.push(`${h.id}: tee inside a region`);
    for (const p of H.portals) for (const q of [p.a, p.b]) if (!E.playable(H, q[0], q[1], PHYS.PORTAL_R + 4)) bad.push(`${h.id}: portal at ${q} is cramped`);
  }
  assert.deepStrictEqual(bad, []);
});

test("the cup can be reached from the tee", () => {
  const bad = [];
  for (const h of HOLES) {
    const f = E.distanceField(E.compileHole(h));
    if (!(f.at(h.tee[0], h.tee[1]) < 1e8)) bad.push(h.id);
  }
  assert.deepStrictEqual(bad, []);
});

test("nothing that moves can squeeze a ball against a rail", () => {
  const bad = [];
  for (const h of HOLES) {
    const H = E.compileHole(h), segs = segsOf(H);
    const solids = H.posts.concat(H.bumpers);
    for (const s of H.spinners) {
      const reach = s.len + s.hw;
      for (const g of segs) { const d = segDist(s.x, s.y, g) - reach; if (d < SQUEEZE) bad.push(`${h.id}: spinner at ${s.x},${s.y} comes within ${d.toFixed(1)}px of a rail`); }
      for (const c of solids) { const d = Math.hypot(c[0] - s.x, c[1] - s.y) - c[2] - reach; if (d < SQUEEZE) bad.push(`${h.id}: spinner near a peg`); }
    }
    for (const m of H.movers) {
      const ux0 = m.b[0] - m.a[0], uy0 = m.b[1] - m.a[1], L = Math.hypot(ux0, uy0), ux = ux0 / L, uy = uy0 / L;
      // at each end of its travel, look ahead (in the direction it was going)
      // from the leading edge for the nearest rail
      for (const [end, dir] of [[m.b, 1], [m.a, -1]]) {
        const fx = ux * dir, fy = uy * dir;
        for (const k of [-1, 0, 1]) {
          const px = end[0] + m.hx * k + fx * m.r, py = end[1] + m.hy * k + fy * m.r;
          const d = rayHit(px, py, fx, fy, segs);
          if (d < SQUEEZE) bad.push(`${h.id}: mover stops ${d.toFixed(1)}px from a rail`);
        }
      }
    }
  }
  assert.deepStrictEqual(bad, []);
});

test("a ball left anywhere comes to rest somewhere it can be putted from", () => {
  // Drop a still ball on a grid over every hole and leave it alone for 12 s
  // of hole time — moving things may shove it, slopes may roll it. It must
  // settle, stay inside the rails, and still have a way to the cup.
  const bad = [];
  for (const h of HOLES) {
    const H = E.compileHole(h), f = E.distanceField(H);
    for (let y = 30.3; y < PHYS.H; y += 23) for (let x = 30.7; x < PHYS.W; x += 23) {
      if (!E.playable(H, x, y, R + 1)) continue;
      const b = { x, y, vx: 0, vy: 0, lock: -1, hit: 0, surf: 0 };
      let still = 0, t = 3.7, end = "moving";
      for (let i = 0; i < 240 * 12; i++) {
        t += PHYS.DT;
        const ev = Physics.step(H, b, t);
        if (ev === E.EV.CUP || ev === E.EV.WATER) { end = "done"; break; }
        if (b.vx * b.vx + b.vy * b.vy < 16) { if (++still > 240) { end = "rest"; break; } } else still = 0;
      }
      if (end === "done") continue;
      // something still shoving it is fine as long as it is not trapped
      if (!Physics.pointInPoly(b.x, b.y, H.green) || H.blocks.some((p) => Physics.pointInPoly(b.x, b.y, p))) bad.push(`${h.id}: ball from ${x | 0},${y | 0} escaped the rails`);
      else if (!(f.at(b.x, b.y) < 1e8)) bad.push(`${h.id}: ball from ${x | 0},${y | 0} stranded at ${b.x | 0},${b.y | 0}`);
    }
  }
  assert.deepStrictEqual(bad, []);
});

test("hard shots in every direction never tunnel through a rail", () => {
  const bad = [];
  const rnd = E.mulberry32(42);
  for (const h of HOLES) {
    const H = E.compileHole(h);
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI * 2, p = 0.4 + rnd() * 0.6, t0 = rnd() * 10;
      const r = E.simulateShot(H, h.tee[0], h.tee[1], a, p, t0, { maxT: 20 });
      if (r.end === "cup" || r.end === "water") continue;
      const inside = Physics.pointInPoly(r.x, r.y, H.green) && !H.blocks.some((q) => Physics.pointInPoly(r.x, r.y, q));
      if (!inside) bad.push(`${h.id}: shot ${i} ended at ${r.x | 0},${r.y | 0}`);
      if (r.end === "timeout") bad.push(`${h.id}: shot ${i} never settled`);
    }
  }
  assert.deepStrictEqual(bad, []);
});

test("mirroring a hole (the Daily twist) keeps it lint-clean and playable", () => {
  const bad = [];
  for (const h of HOLES) {
    const H = E.compileHole(h, { mirror: true });
    if (Math.abs(H.tee[0] - (PHYS.W - h.tee[0])) > 1e-9) bad.push(`${h.id}: tee not mirrored`);
    if (!(E.distanceField(H).at(H.tee[0], H.tee[1]) < 1e8)) bad.push(`${h.id}: mirrored cup unreachable`);
    if (!E.playable(H, H.tee[0], H.tee[1], R + 6)) bad.push(`${h.id}: mirrored tee cramped`);
  }
  assert.deepStrictEqual(bad, []);
});
