// The art layer: shared drawing helpers and the registry of art styles.
//
// Two rules, as in every family game's art.js:
//   1. Nothing here may move a ball or change a number the engine reads.
//      Positions come from the engine; decoration comes from a positional hash,
//      so a hole looks the same on every device.
//   2. Everything static is painted once into an offscreen layer and blitted.
//
// A style (js/style-*.js) supplies palettes per course and painters for each
// kind of thing. render.js decides when and where; a style decides how.

const Art = {
  styles: {},
  motion: 1,           // 0 under prefers-reduced-motion: every sway and shimmer multiplies by it
  TAU: Math.PI * 2,

  hash(a, b) { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); },

  // shade by a FRACTION: +0.2 lightens 20% toward white, -0.2 darkens 20%
  shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
    return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
  },
  rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; },

  polyPath(c, pts, close) {
    c.beginPath();
    for (let i = 0; i < pts.length; i++) i ? c.lineTo(pts[i][0], pts[i][1]) : c.moveTo(pts[i][0], pts[i][1]);
    if (close !== false) c.closePath();
  },
  // a polygon traced with a hand-cut wobble (Paper Cut)
  wobblePath(c, pts, amp, seed) {
    c.beginPath();
    let first = true;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 13));
      for (let k = 0; k < n; k++) {
        const u = k / n, x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u;
        const j = k === 0 ? 0 : (Art.hash(x + seed, y) - 0.5) * amp, jj = k === 0 ? 0 : (Art.hash(y, x + seed) - 0.5) * amp;
        first ? c.moveTo(x + j, y + jj) : c.lineTo(x + j, y + jj); first = false;
      }
    }
    c.closePath();
  },
  ellPath(c, e, grow, jit, seed) {
    c.beginPath();
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Art.TAU, w = jit ? 1 + (Art.hash((seed || 0) + (i % n), 7) - 0.5) * jit : 1;
      const x = e[0] + Math.cos(a) * (e[2] + grow) * w, y = e[1] + Math.sin(a) * (e[3] + grow) * w;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath();
  },
  // a region (ellipse or polygon) as a path; polygons can be grown outward
  regionPath(c, r, grow, jit, seed) {
    if (r.e) return Art.ellPath(c, r.e, grow || 0, jit, seed);
    if (!grow) return jit ? Art.wobblePath(c, r.p, jit * 20, seed || 0) : Art.polyPath(c, r.p);
    Art.polyPath(c, Art.offsetPoly(r.p, grow));
  },
  // offset a simple polygon outward (positive) by moving each vertex along its bisector
  offsetPoly(p, d) {
    const n = p.length, out = [];
    let area = 0; for (let i = 0; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
    const s = area > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n];
      const n1 = Art.normal(a, b, s), n2 = Art.normal(b, c, s);
      let nx = n1[0] + n2[0], ny = n1[1] + n2[1]; const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
      const k = d / Math.max(0.35, nx * n1[0] + ny * n1[1]);
      out.push([b[0] + nx * k, b[1] + ny * k]);
    }
    return out;
  },
  normal(a, b, s) { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [(dy / L) * s, (-dx / L) * s]; },
  regionCentre(r) { if (r.e) return [r.e[0], r.e[1]]; const n = r.p.length; return [r.p.reduce((s, q) => s + q[0], 0) / n, r.p.reduce((s, q) => s + q[1], 0) / n]; },

  dot(c, x, y, r, col, a) {
    if (a != null && a !== 1) c.globalAlpha = a;
    c.fillStyle = col; c.beginPath(); c.arc(x, y, Math.max(0.3, r), 0, Art.TAU); c.fill();
    if (a != null && a !== 1) c.globalAlpha = 1;
  },
  capsule(c, ax, ay, bx, by, r) {
    const ang = Math.atan2(by - ay, bx - ax);
    c.beginPath(); c.arc(ax, ay, r, ang + Math.PI / 2, ang - Math.PI / 2); c.arc(bx, by, r, ang - Math.PI / 2, ang + Math.PI / 2); c.closePath();
  },

  // A soft round blob, prerendered once and stamped at any size: shadows,
  // glows and light pools without a gradient per frame.
  _soft: null,
  soft(c, x, y, rx, ry, col, a) {
    if (!Art._soft) {
      const s = document.createElement("canvas"); s.width = s.height = 128;
      const g = s.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.55, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128); Art._soft = s;
    }
    const key = col;
    let tint = Art._softTint[key];
    if (!tint) {
      if (Object.keys(Art._softTint).length > 40) Art._softTint = {};
      tint = document.createElement("canvas"); tint.width = tint.height = 128;
      const g = tint.getContext("2d"); g.drawImage(Art._soft, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = col; g.fillRect(0, 0, 128, 128);
      Art._softTint[key] = tint;
    }
    c.globalAlpha = a == null ? 1 : a;
    c.drawImage(tint, x - rx, y - ry, rx * 2, ry * 2);
    c.globalAlpha = 1;
  },
  _softTint: {},

  // Decoration scattered over the surround — never on or near the green.
  scatter(H, box, n, salt, margin, fn) {
    const segs = H.segs;
    for (let i = 0; i < n; i++) {
      const x = box.l + Art.hash(i + salt, 71.3) * (box.r - box.l), y = box.t + Art.hash(i + salt, 97.1) * (box.b - box.t);
      if (Physics.pointInPoly(x, y, H.green)) continue;
      let near = false;
      for (let k = 0; k < H.nSegs && !near; k++) { Physics.closest(x, y, segs[k * 4], segs[k * 4 + 1], segs[k * 4 + 2], segs[k * 4 + 3]); if (Math.hypot(x - Physics._cx, y - Physics._cy) < margin) near = true; }
      if (near) continue;
      fn(x, y, (k) => Art.hash(i * 13 + salt + k * 7, 53 + k * 11), i);
    }
  },

  // The spinners' tips at time t (shared by every style).
  tips(s, t) { return Physics.spinnerTips(s, t, new Float64Array(s.arms * 2)); },

  // Seat colours: four balls that read on every turf in every style.
  SEATS: ["#ffffff", "#ff7a59", "#4fc3ff", "#ffd23e"],
  SEAT_NAMES: ["white", "coral", "sky", "sunshine"],

  register(id, style) { Art.styles[id] = style; },
  get(id) { return Art.styles[id] || Art.styles.diorama; },
};
