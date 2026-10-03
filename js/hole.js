// Turns a hole's authored data into what the physics and the bots read:
// rail segments in a coarse grid, regions with bounding boxes, moving parts
// with their derived fields, and a lazily built distance-to-cup field.
// Still no DOM, no canvas, no randomness.

const SEG_CELL = 40;

function mirrorX(x) { return PHYS.W - x; }

// A copy of the hole's data flipped left-to-right (the Daily Hole's twist).
function mirrorDef(d) {
  const P = (p) => [mirrorX(p[0]), p[1]];
  const poly = (ps) => ps.map(P).reverse();
  const reg = (r) => (r.e ? { ...r, e: [mirrorX(r.e[0]), r.e[1], r.e[2], r.e[3]] } : { ...r, p: poly(r.p) });
  const dirReg = (r) => ({ ...reg(r), dir: [-r.dir[0], r.dir[1]] });
  return {
    ...d,
    tee: P(d.tee), cup: P(d.cup), green: poly(d.green),
    blocks: (d.blocks || []).map(poly),
    posts: (d.posts || []).map((c) => [mirrorX(c[0]), c[1], c[2]]),
    bumpers: (d.bumpers || []).map((c) => [mirrorX(c[0]), c[1], c[2]]),
    sand: (d.sand || []).map(reg), water: (d.water || []).map(reg), ice: (d.ice || []).map(reg),
    slopes: (d.slopes || []).map(dirReg), pads: (d.pads || []).map(dirReg),
    spinners: (d.spinners || []).map((s) => ({ ...s, x: mirrorX(s.x), w: -s.w, phase: Math.PI - (s.phase || 0) })),
    movers: (d.movers || []).map((m) => ({ ...m, a: P(m.a), b: P(m.b), ang: Math.PI - (m.ang || 0) })),
    portals: (d.portals || []).map((p) => ({ ...p, a: P(p.a), b: P(p.b) })),
    deco: (d.deco || []).map((o) => ({ ...o, x: o.x != null ? mirrorX(o.x) : o.x })),
  };
}

function prepRegion(r) {
  const o = { ...r };
  if (o.p) {
    o.bx0 = Math.min(...o.p.map((q) => q[0])); o.bx1 = Math.max(...o.p.map((q) => q[0]));
    o.by0 = Math.min(...o.p.map((q) => q[1])); o.by1 = Math.max(...o.p.map((q) => q[1]));
  }
  return o;
}

function compileHole(def, opts) {
  const d = opts && opts.mirror ? mirrorDef(def) : def;
  const H = {
    def: d, id: d.id, par: d.par,
    tee: d.tee.slice(), cup: d.cup.slice(), green: d.green, blocks: d.blocks || [],
    posts: d.posts || [], bumpers: d.bumpers || [],
    sand: (d.sand || []).map(prepRegion), water: (d.water || []).map(prepRegion), ice: (d.ice || []).map(prepRegion),
    slopes: (d.slopes || []).map(prepRegion), pads: (d.pads || []).map(prepRegion),
    spinners: (d.spinners || []).map((s) => ({ arms: 4, hw: 5, hub: 7, phase: 0, ...s })),
    movers: (d.movers || []).map((m) => {
      const ang = m.ang || 0, hl = m.hl || 22;
      return { r: 8, phase: 0, T: 4, ...m, hl, hx: Math.cos(ang) * hl, hy: Math.sin(ang) * hl };
    }),
    portals: d.portals || [], deco: d.deco || [],
  };
  // rail segments: the green's edges and every block's edges
  const segs = [];
  const addPoly = (p) => { for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; segs.push(a[0], a[1], b[0], b[1]); } };
  addPoly(H.green); H.blocks.forEach(addPoly);
  H.segs = new Float64Array(segs);
  H.nSegs = segs.length / 4;
  // coarse grid: each cell lists every segment within reach of a ball in it
  const cols = Math.ceil(PHYS.W / SEG_CELL) + 2, rows = Math.ceil(PHYS.H / SEG_CELL) + 2;
  const grid = [];
  const reach = SEG_CELL * 0.7072 + PHYS.R + 4;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cx = (c - 1 + 0.5) * SEG_CELL, cy = (r - 1 + 0.5) * SEG_CELL, list = [];
    for (let i = 0; i < H.nSegs; i++) {
      Physics.closest(cx, cy, H.segs[i * 4], H.segs[i * 4 + 1], H.segs[i * 4 + 2], H.segs[i * 4 + 3]);
      if (Math.hypot(cx - Physics._cx, cy - Physics._cy) < reach) list.push(i);
    }
    grid.push(list);
  }
  const all = Array.from({ length: H.nSegs }, (_, i) => i);
  H.segCell = (x, y) => {
    const c = Math.floor(x / SEG_CELL) + 1, r = Math.floor(y / SEG_CELL) + 1;
    if (c < 0 || r < 0 || c >= cols || r >= rows) return all;
    return grid[r * cols + c];
  };
  H.field = null;
  return H;
}

// Is (x, y) somewhere a resting ball could be? On the green, off every block,
// clear of the rails, posts and bumpers, and not in the water.
function playable(H, x, y, margin) {
  const m = margin == null ? PHYS.R : margin;
  if (!Physics.pointInPoly(x, y, H.green)) return false;
  for (const b of H.blocks) if (Physics.pointInPoly(x, y, b)) return false;
  for (let i = 0; i < H.nSegs; i++) {
    Physics.closest(x, y, H.segs[i * 4], H.segs[i * 4 + 1], H.segs[i * 4 + 2], H.segs[i * 4 + 3]);
    if (Math.hypot(x - Physics._cx, y - Physics._cy) < m) return false;
  }
  for (const c of H.posts.concat(H.bumpers)) if (Math.hypot(x - c[0], y - c[1]) < c[2] + m) return false;
  for (const w of H.water) if (Physics.inRegion(w, x, y)) return false;
  return true;
}

// Distance from every playable cell to the cup, around the rails — what the
// bots minimise. Built once per hole, on first use. Portals are free links.
const FIELD_CELL = 5;
function distanceField(H) {
  if (H.field) return H.field;
  const cols = Math.ceil(PHYS.W / FIELD_CELL), rows = Math.ceil(PHYS.H / FIELD_CELL);
  const ok = new Uint8Array(cols * rows), dist = new Float64Array(cols * rows).fill(1e9);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    ok[r * cols + c] = playable(H, (c + 0.5) * FIELD_CELL, (r + 0.5) * FIELD_CELL, PHYS.R - 1) ? 1 : 0;
  }
  const idx = (x, y) => Math.max(0, Math.min(rows - 1, Math.floor(y / FIELD_CELL))) * cols + Math.max(0, Math.min(cols - 1, Math.floor(x / FIELD_CELL)));
  const links = new Map();
  for (const p of H.portals) {
    const a = idx(p.a[0], p.a[1]), b = idx(p.b[0], p.b[1]);
    links.set(a, (links.get(a) || []).concat(b)); links.set(b, (links.get(b) || []).concat(a));
  }
  // Dijkstra on a binary heap
  const heap = [], push = (d, i) => { heap.push([d, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const start = idx(H.cup[0], H.cup[1]);
  dist[start] = 0; ok[start] = 1; push(0, start);
  const N8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
  while (heap.length) {
    const [d, i] = pop();
    if (d > dist[i]) continue;
    const c = i % cols, r = (i / cols) | 0;
    for (const [dc, dr, w] of N8) {
      const cc = c + dc, rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
      const j = rr * cols + cc;
      if (!ok[j]) continue;
      const nd = d + w * FIELD_CELL;
      if (nd < dist[j]) { dist[j] = nd; push(nd, j); }
    }
    const L = links.get(i);
    if (L) for (const j of L) if (d + 2 < dist[j]) { dist[j] = d + 2; push(d + 2, j); }
  }
  H.field = {
    cols, rows, dist, ok,
    at(x, y) {
      const c = Math.floor(x / FIELD_CELL), r = Math.floor(y / FIELD_CELL);
      let best = 1e9;
      for (let k = 0; k <= 2 && best >= 1e9; k++) {
        for (let dr = -k; dr <= k; dr++) for (let dc = -k; dc <= k; dc++) {
          const cc = c + dc, rr = r + dr;
          if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
          const v = dist[rr * cols + cc];
          if (v < 1e9) best = Math.min(best, v + Math.hypot((cc + 0.5) * FIELD_CELL - x, (rr + 0.5) * FIELD_CELL - y));
        }
      }
      return best;
    },
  };
  return H.field;
}

if (typeof module !== "undefined") module.exports = { compileHole, mirrorDef, playable, distanceField };
