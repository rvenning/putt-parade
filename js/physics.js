// Mini-golf physics — a ball rolling on a flat green seen from above. No DOM,
// no canvas, no Math.random: every function here depends only on its arguments,
// which is what lets the bots plan shots on the real engine and the tests
// replay a hole byte for byte.
//
// Units are LOGICAL pixels on the fixed 400×700 field, and seconds. Everything
// moving (spinners, sliders) is a pure function of the hole clock t, so a shot
// fired at the same t with the same angle and power always ends in the same place.

const PHYS = {
  W: 400, H: 700,
  DT: 1 / 240,          // fixed step
  R: 7,                 // ball radius
  CUP_R: 10.5,
  MAX_V: 1000,          // full-power shot
  CAP_V: 1150,          // nothing (not even a pad) pushes the ball faster
  SINK_V: 185,          // slower than this over the cup and it drops
  PULL_V: 300,          // slower than this near the cup and the lip draws it in
  WALL_E: 0.74,         // restitution against rails
  BUMP_E: 0.9, BUMP_KICK: 300,
  REST_V: 4,            // below this the ball counts as still
  PORTAL_R: 12,
  // rolling resistance: speed falls by (mu + k·speed) per second
  TURF: { mu: 230, k: 0.62 },
  SAND: { mu: 1150, k: 2.6 },
  ICE: { mu: 46, k: 0.14 },
};

// Codes stepBall() returns. Higher codes end the shot.
const EV = { NONE: 0, WALL: 1, BUMPER: 2, SPINNER: 3, MOVER: 4, POST: 5, PORTAL: 6, CUP: 10, WATER: 11 };

const Physics = {
  closest(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    let t = L > 0 ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    Physics._cx = ax + dx * t; Physics._cy = ay + dy * t; Physics._ct = t;
  },
  _cx: 0, _cy: 0, _ct: 0,

  // Contact response. (nx, ny) points out of the solid toward the ball; pen is
  // the overlap; (svx, svy) the surface's own velocity. Returns the impact speed.
  resolve(b, nx, ny, pen, svx, svy, e, kick) {
    b.x += nx * pen; b.y += ny * pen;
    const rvx = b.vx - svx, rvy = b.vy - svy, vn = rvx * nx + rvy * ny;
    if (vn >= 0) return 0;
    let out = -vn * e;
    if (kick && out < kick) out = kick;
    // A ball resting against a rail touches it every step; only a real impact
    // loses tangential speed, or a ball rolling along a rail would stall.
    const f = -vn > 40 ? 0.04 : 0;
    if (-vn < 25 && !kick) out = 0;
    const tvx = rvx - vn * nx, tvy = rvy - vn * ny;
    b.vx = svx + tvx * (1 - f) + nx * out;
    b.vy = svy + tvy * (1 - f) + ny * out;
    return -vn;
  },

  pointInPoly(x, y, p) {
    let inside = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  },

  // A region is either an ellipse {e:[cx,cy,rx,ry]} or a polygon {p:[[x,y],…]}.
  inRegion(r, x, y) {
    if (r.e) { const dx = (x - r.e[0]) / r.e[2], dy = (y - r.e[1]) / r.e[3]; return dx * dx + dy * dy < 1; }
    if (x < r.bx0 || x > r.bx1 || y < r.by0 || y > r.by1) return false;
    return Physics.pointInPoly(x, y, r.p);
  },

  // ----------------------------------------------------- moving obstacles --
  spinnerAngle(s, t) { return s.phase + s.w * t; },
  // Fills out[k] = [tipX, tipY] for each arm at time t.
  spinnerTips(s, t, out) {
    const a0 = Physics.spinnerAngle(s, t);
    for (let k = 0; k < s.arms; k++) {
      const a = a0 + (k * Math.PI * 2) / s.arms;
      out[k * 2] = s.x + Math.cos(a) * s.len; out[k * 2 + 1] = s.y + Math.sin(a) * s.len;
    }
    return out;
  },
  // A slider eases back and forth between a and b: u = ½ − ½cos(2πt/T + φ).
  moverPos(m, t) {
    const w = (Math.PI * 2) / m.T, ph = w * t + m.phase;
    const u = 0.5 - 0.5 * Math.cos(ph), du = 0.5 * Math.sin(ph) * w;
    Physics._mx = m.a[0] + (m.b[0] - m.a[0]) * u; Physics._my = m.a[1] + (m.b[1] - m.a[1]) * u;
    Physics._mvx = (m.b[0] - m.a[0]) * du; Physics._mvy = (m.b[1] - m.a[1]) * du;
  },
  _mx: 0, _my: 0, _mvx: 0, _mvy: 0,

  // The surface under (x, y): friction, acceleration and whether it is water.
  surface(H, x, y, out) {
    out.mu = PHYS.TURF.mu; out.k = PHYS.TURF.k; out.ax = 0; out.ay = 0; out.kind = 0;
    for (let i = 0; i < H.sand.length; i++) if (Physics.inRegion(H.sand[i], x, y)) { out.mu = PHYS.SAND.mu; out.k = PHYS.SAND.k; out.kind = 1; break; }
    for (let i = 0; i < H.ice.length; i++) if (Physics.inRegion(H.ice[i], x, y)) { out.mu = PHYS.ICE.mu; out.k = PHYS.ICE.k; out.kind = 2; break; }
    for (let i = 0; i < H.slopes.length; i++) { const s = H.slopes[i]; if (Physics.inRegion(s, x, y)) { out.ax += s.dir[0]; out.ay += s.dir[1]; } }
    for (let i = 0; i < H.pads.length; i++) { const s = H.pads[i]; if (Physics.inRegion(s, x, y)) { out.ax += s.dir[0]; out.ay += s.dir[1]; out.kind = out.kind || 3; } }
    return out;
  },
  _surf: { mu: 0, k: 0, ax: 0, ay: 0, kind: 0 },
  _tips: new Float64Array(16),

  // One fixed step of the ball. Returns an EV code; impact speed in b.hit.
  step(H, b, t) {
    const R = PHYS.R, DT = PHYS.DT;
    const s = Physics.surface(H, b.x, b.y, Physics._surf);
    b.surf = s.kind;
    // slopes and pads push; rolling resistance pulls. A slope weaker than the
    // turf's resistance holds a still ball where it is, as real turf does.
    b.vx += s.ax * DT; b.vy += s.ay * DT;
    let sp = Math.hypot(b.vx, b.vy);
    if (sp > 0) { const ns = Math.max(0, sp - (s.mu + s.k * sp) * DT); b.vx *= ns / sp; b.vy *= ns / sp; sp = ns; }

    // the cup: a lip that draws a slow ball in, and a drop for a slower one
    const dxc = H.cup[0] - b.x, dyc = H.cup[1] - b.y, dc = Math.hypot(dxc, dyc);
    if (dc < PHYS.CUP_R + 3 && sp < PHYS.PULL_V && dc > 1e-6) {
      const p = 900 * (1 - dc / (PHYS.CUP_R + 3)) * DT;
      b.vx += (dxc / dc) * p; b.vy += (dyc / dc) * p;
    }
    if (dc < PHYS.CUP_R - 2 && sp < PHYS.SINK_V) return EV.CUP;

    b.x += b.vx * DT; b.y += b.vy * DT;
    let ev = EV.NONE; b.hit = 0;

    // moving things first, static rails last: if a sweeping arm ever pins the
    // ball against a rail, the rail wins and the ball can never be pushed through.
    for (let i = 0; i < H.spinners.length; i++) {
      const sp_ = H.spinners[i];
      const dxs = b.x - sp_.x, dys = b.y - sp_.y;
      if (dxs * dxs + dys * dys > (sp_.len + sp_.hw + R + 2) ** 2) continue;
      const tips = Physics.spinnerTips(sp_, t, Physics._tips);
      for (let k = 0; k < sp_.arms; k++) {
        Physics.closest(b.x, b.y, sp_.x, sp_.y, tips[k * 2], tips[k * 2 + 1]);
        const qx = Physics._cx, qy = Physics._cy, dx = b.x - qx, dy = b.y - qy, d = Math.hypot(dx, dy), rr = R + sp_.hw;
        if (d < rr && d > 1e-6) {
          const ox = qx - sp_.x, oy = qy - sp_.y;
          const v = Physics.resolve(b, dx / d, dy / d, rr - d, -oy * sp_.w, ox * sp_.w, 0.6, 0);
          if (v > 40) { ev = EV.SPINNER; b.hit = Math.max(b.hit, v); }
        }
      }
      if (sp_.hub) {
        const dx = b.x - sp_.x, dy = b.y - sp_.y, d = Math.hypot(dx, dy), rr = R + sp_.hub;
        if (d < rr && d > 1e-6) Physics.resolve(b, dx / d, dy / d, rr - d, 0, 0, 0.6, 0);
      }
    }
    for (let i = 0; i < H.movers.length; i++) {
      const m = H.movers[i];
      Physics.moverPos(m, t);
      const mx = Physics._mx, my = Physics._my, mvx = Physics._mvx, mvy = Physics._mvy;
      const ax = mx - m.hx, ay = my - m.hy, bx = mx + m.hx, by = my + m.hy;
      Physics.closest(b.x, b.y, ax, ay, bx, by);
      const dx = b.x - Physics._cx, dy = b.y - Physics._cy, d = Math.hypot(dx, dy), rr = R + m.r;
      if (d < rr && d > 1e-6) {
        const v = Physics.resolve(b, dx / d, dy / d, rr - d, mvx, mvy, 0.6, 0);
        if (v > 40) { ev = EV.MOVER; b.hit = Math.max(b.hit, v); }
      }
    }
    for (let i = 0; i < H.bumpers.length; i++) {
      const c = H.bumpers[i], dx = b.x - c[0], dy = b.y - c[1], d = Math.hypot(dx, dy), rr = R + c[2];
      if (d < rr && d > 1e-6) {
        const v = Physics.resolve(b, dx / d, dy / d, rr - d, 0, 0, PHYS.BUMP_E, PHYS.BUMP_KICK);
        if (v > 0) { ev = EV.BUMPER; b.hit = Math.max(b.hit, v); b.bumper = i; }
      }
    }
    for (let i = 0; i < H.posts.length; i++) {
      const c = H.posts[i], dx = b.x - c[0], dy = b.y - c[1], d = Math.hypot(dx, dy), rr = R + c[2];
      if (d < rr && d > 1e-6) {
        const v = Physics.resolve(b, dx / d, dy / d, rr - d, 0, 0, PHYS.WALL_E, 0);
        if (v > 60) { ev = ev || EV.POST; b.hit = Math.max(b.hit, v); }
      }
    }
    // static rails, twice so an inside corner settles in one step
    for (let pass = 0; pass < 2; pass++) {
      const cell = H.segCell(b.x, b.y);
      for (let n = 0; n < cell.length; n++) {
        const o = cell[n] * 4, S = H.segs;
        Physics.closest(b.x, b.y, S[o], S[o + 1], S[o + 2], S[o + 3]);
        const dx = b.x - Physics._cx, dy = b.y - Physics._cy, d2 = dx * dx + dy * dy;
        if (d2 < R * R && d2 > 1e-12) {
          const d = Math.sqrt(d2);
          const v = Physics.resolve(b, dx / d, dy / d, R - d, 0, 0, PHYS.WALL_E, 0);
          if (v > 60 && pass === 0) { ev = ev || EV.WALL; b.hit = Math.max(b.hit, v); }
        }
      }
    }

    // portals: in one, out the other, same velocity; locked until clear of both
    for (let i = 0; i < H.portals.length; i++) {
      const p = H.portals[i];
      const da = Math.hypot(b.x - p.a[0], b.y - p.a[1]), db = Math.hypot(b.x - p.b[0], b.y - p.b[1]);
      if (b.lock === i) { if (da > PHYS.PORTAL_R + 8 && db > PHYS.PORTAL_R + 8) b.lock = -1; continue; }
      if (b.lock >= 0) continue;
      if (da < PHYS.PORTAL_R) { b.x = p.b[0] + (b.x - p.a[0]); b.y = p.b[1] + (b.y - p.a[1]); b.lock = i; ev = EV.PORTAL; }
      else if (db < PHYS.PORTAL_R) { b.x = p.a[0] + (b.x - p.b[0]); b.y = p.a[1] + (b.y - p.b[1]); b.lock = i; ev = EV.PORTAL; }
    }

    for (let i = 0; i < H.water.length; i++) if (Physics.inRegion(H.water[i], b.x, b.y)) return EV.WATER;
    const s2 = b.vx * b.vx + b.vy * b.vy;
    if (s2 > PHYS.CAP_V * PHYS.CAP_V) { const k = PHYS.CAP_V / Math.sqrt(s2); b.vx *= k; b.vy *= k; }
    return ev;
  },
};

if (typeof module !== "undefined") module.exports = { PHYS, EV, Physics };
