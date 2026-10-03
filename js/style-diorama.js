// Toy Diorama — each course is a little model on a tabletop. Chunky rails with
// a real side face, light from the top left, soft shadows under everything,
// mowing stripes, and a surround that is a place (meadow, pier, fair, snow).
//
// Legibility budget: rails are the only warm-brown/cream bands on the turf,
// hazards keep their own hue on every course (sand gold, water blue, ice
// pale cyan), and nothing decorative is ever drawn inside the rails.

(function () {
  const A = Art, T = A.TAU, sh = A.shade;

  const PAL = [
    { id: "meadow", ground: ["#86cc70", "#5fa957"], speck: ["#4f9a4c", "#9bd884"], turf: "#5cbf5a",
      rail: { top: "#d9a35a", side: "#a8692f", dark: "#7a4a22", hi: "#f6d394" }, cast: "#244d22",
      block: { top: "#4f9e4a", side: "#2f6b30", hi: "#78c46a" }, bumper: "#e8553a", post: "#a0703f", flag: "#e8553a" },
    { id: "pier", ground: ["#4aa7d6", "#2b7db3"], speck: ["#7cc7ea", "#2a6f9f"], turf: "#46b58a",
      rail: { top: "#f4efe4", side: "#c3baa6", dark: "#6f7f90", hi: "#ffffff", trim: "#2f6fb0" }, cast: "#123d5c",
      deck: "#c99a62", deckLine: "#9c7140", block: { top: "#e9e2d2", side: "#a89f8b", hi: "#ffffff" }, bumper: "#e8453a", post: "#8d949c", flag: "#2f6fb0" },
    { id: "fair", ground: ["#a7c56a", "#86a650"], speck: ["#c9dc8f", "#6f8f3c"], turf: "#39a6d6",
      rail: { top: "#e8553a", side: "#a8341f", dark: "#6b1f12", hi: "#ffd0c2", stripe: "#fff6df" }, cast: "#3d5a1f",
      block: { top: "#ffd23e", side: "#c9971a", hi: "#fff0a8" }, bumper: "#ff5fa2", post: "#fff6df", flag: "#ffd23e" },
    { id: "frost", ground: ["#f3f8fc", "#d8e8f3"], speck: ["#ffffff", "#c3d8e8"], turf: "#78c7a6",
      rail: { top: "#c4d1de", side: "#8193a6", dark: "#4f6275", hi: "#ffffff", snow: true }, cast: "#5d7a94",
      block: { top: "#eef5fb", side: "#a9bccd", hi: "#ffffff" }, bumper: "#5aa9e6", post: "#9fb2c4", flag: "#e8553a" },
  ];
  const COMMON = { sand: "#f0d79a", sandEdge: "#d6b46a", sandDot: "#c9a65c", water: "#3a98c9", waterDeep: "#2c7fb0", bank: "#8a6a3c",
    ice: "#dff5ff", iceLine: "#ffffff", pad: "#ffd23e", padArrow: "#ffffff", slopeHi: "rgba(255,255,255,.14)", slopeLo: "rgba(0,40,10,.12)" };

  const S = {
    id: "diorama", label: "Toy Diorama",
    pal(ci) { return Object.assign({}, COMMON, PAL[ci] || PAL[0]); },

    // ------------------------------------------------------------ bake --
    bakeBase(c, H, P, B) {
      const g = c.createLinearGradient(0, B.t, 0, B.b); g.addColorStop(0, P.ground[0]); g.addColorStop(1, P.ground[1]);
      c.fillStyle = g; c.fillRect(B.l, B.t, B.r - B.l, B.b - B.t);
      for (let i = 0; i < 360; i++) A.dot(c, B.l + A.hash(i, 1) * (B.r - B.l), B.t + A.hash(i, 2) * (B.b - B.t), 1 + A.hash(i, 3) * 2.2, P.speck[i % 2], 0.5);
      DECOR[P.id](c, H, P, B);

      // the green's cast shadow, then the rails standing on the ground
      const G = () => A.polyPath(c, H.green);
      for (let i = 0; i < 6; i++) { c.save(); c.translate(6, 9); G(); c.lineJoin = "round"; c.globalAlpha = 0.07; c.lineWidth = 34 - i * 4; c.strokeStyle = P.cast; c.stroke(); c.fill(); c.restore(); }
      c.save(); G(); c.lineJoin = "round"; c.lineWidth = 26; c.strokeStyle = P.rail.dark; c.stroke(); c.restore();
      c.save(); c.translate(0, -3); G(); c.lineJoin = "round"; c.lineWidth = 24; c.strokeStyle = P.rail.top; c.stroke();
      if (P.rail.stripe) { c.lineWidth = 24; c.setLineDash([16, 16]); c.strokeStyle = P.rail.stripe; c.stroke(); c.setLineDash([]); }
      if (P.rail.trim) { c.lineWidth = 3; c.strokeStyle = P.rail.trim; c.translate(0, 0); c.stroke(); }
      c.lineWidth = 2; c.strokeStyle = P.rail.hi; c.setLineDash([22, 9]); c.stroke(); c.setLineDash([]);
      if (P.rail.snow) { c.lineWidth = 9; c.strokeStyle = "rgba(255,255,255,.85)"; c.setLineDash([18, 7, 8, 12]); c.stroke(); c.setLineDash([]); }
      c.restore();

      // turf
      c.save(); G(); c.clip();
      c.fillStyle = P.turf; c.fillRect(0, 0, PHYS.W, PHYS.H);
      for (let i = -24; i < 40; i++) { c.fillStyle = i % 2 ? "rgba(255,255,255,0.05)" : "rgba(0,30,10,0.035)"; c.beginPath(); c.moveTo(i * 34, 0); c.lineTo(i * 34 + 34, 0); c.lineTo(i * 34 + 34 - 400, 700); c.lineTo(i * 34 - 400, 700); c.fill(); }
      for (let i = 0; i < 1100; i++) A.dot(c, A.hash(i, 21) * PHYS.W, A.hash(i, 22) * PHYS.H, 0.7, i % 2 ? sh(P.turf, -0.12) : sh(P.turf, 0.16), 0.5);
      this.regions(c, H, P);
      // the inner face of the far rails, and a soft occlusion along every rail
      c.translate(0, 5); G(); c.lineWidth = 12; c.strokeStyle = P.rail.side; c.stroke(); c.translate(0, -5);
      G(); c.lineWidth = 22; c.strokeStyle = "rgba(10,40,20,0.14)"; c.stroke();
      G(); c.lineWidth = 11; c.strokeStyle = "rgba(10,40,20,0.12)"; c.stroke();
      this.tee(c, H, P); this.cup(c, H, P);
      for (const p of H.portals) { this.portalBase(c, p.a, P, 0); this.portalBase(c, p.b, P, 1); }
      c.restore();

      for (const b of H.blocks) this.block(c, b, P, H);
      for (const p of H.posts) this.post(c, p, P);
      for (const b of H.bumpers) A.soft(c, b[0] + 5, b[1] + 7, b[2] + 6, b[2] + 5, P.cast, 0.4);
      for (const s of H.spinners) A.soft(c, s.x + 4, s.y + 6, 12, 10, P.cast, 0.35);
    },

    regions(c, H, P) {
      for (const r of H.slopes) {
        const [cx, cy] = A.regionCentre(r), L = Math.hypot(r.dir[0], r.dir[1]) || 1, ux = r.dir[0] / L, uy = r.dir[1] / L;
        c.save(); A.regionPath(c, r); c.clip();
        const ext = 260, gr = c.createLinearGradient(cx - ux * ext * 0.5, cy - uy * ext * 0.5, cx + ux * ext * 0.5, cy + uy * ext * 0.5);
        gr.addColorStop(0, P.slopeHi); gr.addColorStop(1, P.slopeLo); c.fillStyle = gr; c.fillRect(0, 0, PHYS.W, PHYS.H);
        // contour lines across the slope, and chevrons pointing downhill
        c.strokeStyle = "rgba(255,255,255,.18)"; c.lineWidth = 1.5;
        for (let k = -8; k <= 8; k++) { const ox = cx + ux * k * 22, oy = cy + uy * k * 22; c.beginPath(); c.moveTo(ox - uy * 300, oy + ux * 300); c.lineTo(ox + uy * 300, oy - ux * 300); c.stroke(); }
        c.fillStyle = "rgba(255,255,255,.32)";
        for (let k = -3; k <= 3; k++) for (let j = -1; j <= 1; j++) this.chevron(c, cx + ux * j * 46 - uy * k * 44, cy + uy * j * 46 + ux * k * 44, ux, uy, 7);
        c.restore();
      }
      for (const r of H.pads) { c.save(); A.regionPath(c, r, 3); c.fillStyle = "rgba(0,0,0,.18)"; c.fill(); A.regionPath(c, r); c.fillStyle = sh(P.pad, -0.1); c.fill(); A.regionPath(c, r, -3); c.fillStyle = P.pad; c.fill(); c.restore(); }
      for (const r of H.ice) {
        c.save(); A.regionPath(c, r); c.fillStyle = P.ice; c.fill(); c.clip();
        c.strokeStyle = "rgba(160,210,235,.6)"; c.lineWidth = 1;
        for (let i = 0; i < 26; i++) { const x = A.hash(i, 41) * PHYS.W, y = A.hash(i, 42) * PHYS.H, L = 10 + A.hash(i, 43) * 28, a = -0.6 + A.hash(i, 44) * 0.3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); c.stroke(); }
        c.fillStyle = "rgba(255,255,255,.55)"; for (let i = 0; i < 14; i++) { const x = A.hash(i, 45) * PHYS.W, y = A.hash(i, 46) * PHYS.H; c.beginPath(); c.ellipse(x, y, 12, 3, -0.5, 0, T); c.fill(); }
        c.restore();
        c.save(); A.regionPath(c, r); c.strokeStyle = "rgba(255,255,255,.9)"; c.lineWidth = 2; c.stroke(); c.restore();
      }
      for (const r of H.sand) {
        A.regionPath(c, r, 2, 0.12, 3); c.fillStyle = P.sandEdge; c.fill();
        A.regionPath(c, r, 0, 0.12, 3); c.fillStyle = P.sand; c.fill();
        c.save(); A.regionPath(c, r); c.clip();
        for (let i = 0; i < 160; i++) A.dot(c, A.hash(i, 31) * PHYS.W, A.hash(i, 32) * PHYS.H, 0.9, P.sandDot, 0.7);
        const [cx, cy] = A.regionCentre(r); c.strokeStyle = "rgba(160,120,50,.32)"; c.lineWidth = 1.2;
        for (let k = 1; k < 6; k++) { c.beginPath(); c.ellipse(cx, cy, k * 12, k * 7, 0, 0, T); c.stroke(); }
        c.restore();
      }
      for (const r of H.water) {
        A.regionPath(c, r, 4, 0.08, 9); c.fillStyle = P.bank; c.fill();
        A.regionPath(c, r, 1, 0.08, 9); c.fillStyle = P.water; c.fill();
        A.regionPath(c, r, -6, 0.08, 9); c.fillStyle = P.waterDeep; c.fill();
        if (r.e) { const [x, y, rx, ry] = r.e; [[-0.45, -0.3, 6], [0.3, 0.42, 5]].forEach(([fx, fy, s]) => { c.fillStyle = "#5fb34f"; c.beginPath(); c.arc(x + fx * rx, y + fy * ry, s, 0.3, 6); c.lineTo(x + fx * rx, y + fy * ry); c.fill(); }); }
      }
    },
    chevron(c, x, y, ux, uy, s) {
      const nx = -uy, ny = ux;
      c.beginPath(); c.moveTo(x + ux * s, y + uy * s); c.lineTo(x - ux * s * 0.5 + nx * s, y - uy * s * 0.5 + ny * s);
      c.lineTo(x - ux * s * 0.1, y - uy * s * 0.1); c.lineTo(x - ux * s * 0.5 - nx * s, y - uy * s * 0.5 - ny * s); c.closePath(); c.fill();
    },
    tee(c, H, P) {
      const [x, y] = H.tee;
      c.fillStyle = "rgba(0,0,0,.16)"; c.fillRect(x - 26, y - 13, 56, 34);
      c.fillStyle = sh(P.turf, -0.28); c.fillRect(x - 28, y - 17, 56, 34);
      c.strokeStyle = "rgba(255,255,255,.75)"; c.lineWidth = 2; c.strokeRect(x - 24, y - 13, 48, 26);
      A.dot(c, x - 18, y, 2.5, "#fff6df"); A.dot(c, x + 18, y, 2.5, "#fff6df");
    },
    cup(c, H, P) {
      const [x, y] = H.cup;
      A.dot(c, x, y + 1, PHYS.CUP_R + 3.5, sh(P.turf, -0.12));
      const g = c.createRadialGradient(x, y - 3, 1, x, y, PHYS.CUP_R); g.addColorStop(0, "#0b160b"); g.addColorStop(1, "#22351e");
      c.fillStyle = g; c.beginPath(); c.arc(x, y, PHYS.CUP_R, 0, T); c.fill();
      c.strokeStyle = "rgba(255,255,255,.6)"; c.lineWidth = 1.6; c.beginPath(); c.arc(x, y, PHYS.CUP_R, 0.2, 2.9); c.stroke();
    },
    portalBase(c, p, P, k) {
      const col = k ? "#9a5cff" : "#ff5fa2";
      A.dot(c, p[0], p[1], PHYS.PORTAL_R + 6, "rgba(0,0,0,.18)");
      A.dot(c, p[0], p[1], PHYS.PORTAL_R + 4, col);
      A.dot(c, p[0], p[1], PHYS.PORTAL_R + 1, "#1d1030");
    },
    block(c, b, P, H) {
      for (let i = 0; i < 4; i++) { c.save(); c.translate(5, 8); A.polyPath(c, b); c.globalAlpha = 0.08; c.lineJoin = "round"; c.lineWidth = 16 - i * 4; c.strokeStyle = P.cast; c.stroke(); c.fill(); c.restore(); }
      c.save(); c.translate(0, 6); A.polyPath(c, b); c.fillStyle = P.block.side; c.fill(); c.lineJoin = "round"; c.lineWidth = 6; c.strokeStyle = P.block.side; c.stroke(); c.restore();
      c.save(); A.polyPath(c, b); c.fillStyle = P.block.top; c.fill(); c.lineJoin = "round"; c.lineWidth = 6; c.strokeStyle = P.block.top; c.stroke(); c.clip();
      // top texture: a hedge on the meadow, planks or paving elsewhere
      if (P.id === "meadow") for (let i = 0; i < 70; i++) A.dot(c, A.hash(i, 61) * PHYS.W, A.hash(i, 62) * PHYS.H, 6 + A.hash(i, 63) * 6, i % 3 ? P.block.hi : sh(P.block.top, -0.12), 0.7);
      else if (P.id === "fair") { c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = 7; for (let k = -30; k < 30; k++) { c.beginPath(); c.moveTo(k * 22, 0); c.lineTo(k * 22 + 700, 700); c.stroke(); } }
      else if (P.id === "frost") for (let i = 0; i < 40; i++) A.dot(c, A.hash(i, 64) * PHYS.W, A.hash(i, 65) * PHYS.H, 5 + A.hash(i, 66) * 7, "#ffffff", 0.8);
      else { c.strokeStyle = "rgba(0,0,0,.12)"; c.lineWidth = 1; for (let y = 0; y < 700; y += 10) { c.beginPath(); c.moveTo(0, y); c.lineTo(400, y); c.stroke(); } }
      c.restore();
      c.save(); A.polyPath(c, b); c.lineJoin = "round"; c.lineWidth = 2; c.strokeStyle = P.block.hi; c.globalAlpha = 0.7; c.translate(-1, -1); c.stroke(); c.restore();
    },
    post(c, p, P) {
      const [x, y, r] = p;
      A.soft(c, x + 4, y + 6, r + 5, r + 4, P.cast, 0.4);
      if (P.id === "pier") {   // a rock
        c.fillStyle = sh(P.post, -0.3); c.beginPath(); c.ellipse(x, y + 3, r, r * 0.9, 0, 0, T); c.fill();
        c.fillStyle = P.post; c.beginPath(); for (let k = 0; k < 9; k++) { const a = (k / 9) * T, rr = r * (0.88 + A.hash(x + k, y) * 0.18); k ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill();
        A.dot(c, x - r * 0.3, y - r * 0.35, r * 0.35, sh(P.post, 0.35), 0.8);
      } else if (P.id === "fair") {   // a striped lamp post seen from above
        A.dot(c, x, y + 3, r, "#b8344f"); A.dot(c, x, y, r, "#fff6df"); A.dot(c, x, y, r * 0.62, "#e8553a"); A.dot(c, x, y, r * 0.3, "#ffd23e");
      } else if (P.id === "frost") {   // an ice pillar
        A.dot(c, x, y + 4, r, "#7f9fbd"); A.dot(c, x, y, r, "#cfe9fa"); A.dot(c, x - r * 0.3, y - r * 0.3, r * 0.45, "#ffffff", 0.9);
      } else {   // a cut stump with rings
        A.dot(c, x, y + 4, r, "#6e4a26"); A.dot(c, x, y, r, P.post); c.strokeStyle = "rgba(90,55,25,.6)"; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r * 0.6, 0, T); c.stroke(); c.beginPath(); c.arc(x, y, r * 0.3, 0, T); c.stroke();
      }
    },

    // ------------------------------------------------------- per frame --
    dyn(c, H, P, t, fx) {
      const m = A.motion;
      for (const r of H.water) {
        c.save(); A.regionPath(c, r, -2, 0.08, 9); c.clip();
        const [cx, cy] = A.regionCentre(r); c.strokeStyle = "rgba(220,245,255,.55)"; c.lineWidth = 1.6;
        for (let i = 0; i < 5; i++) { const ph = (t * 0.33 * m + i / 5) % 1; c.globalAlpha = Math.sin(ph * Math.PI) * 0.8; c.beginPath(); c.ellipse(cx - 22 + i * 11, cy - 16 + i * 8, 8 + ph * 12, 2 + ph * 2, 0, 0, T); c.stroke(); }
        c.restore();
      }
      for (const r of H.pads) {
        const L = Math.hypot(r.dir[0], r.dir[1]) || 1, ux = r.dir[0] / L, uy = r.dir[1] / L, [cx, cy] = A.regionCentre(r);
        c.save(); A.regionPath(c, r, -3); c.clip(); c.fillStyle = "rgba(255,255,255,.85)";
        const off = ((t * 60 * m) % 26);
        for (let k = -6; k <= 6; k++) for (let j = -2; j <= 2; j++) { const d = k * 26 + off; this.chevron(c, cx + ux * d - uy * j * 30, cy + uy * d + ux * j * 30, ux, uy, 9); }
        c.restore();
      }
      for (const p of H.portals) for (const [q, k] of [[p.a, 0], [p.b, 1]]) {
        c.save(); c.translate(q[0], q[1]); c.rotate(t * 2.2 * m * (k ? -1 : 1));
        c.strokeStyle = k ? "#c9a7ff" : "#ffb3d4"; c.lineWidth = 2;
        for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, 0, 4 + i * 3, i * 2, i * 2 + 2.6); c.stroke(); }
        c.restore();
        for (let i = 0; i < 3; i++) { const a = t * 1.5 * m + i * 2.1 + k; A.dot(c, q[0] + Math.cos(a) * (PHYS.PORTAL_R + 7), q[1] + Math.sin(a) * (PHYS.PORTAL_R + 7), 1.6, "#fff6df", 0.9); }
      }
      for (const b of H.bumpers) {
        const i = H.bumpers.indexOf(b), f = fx.bump[i] || 0, r = b[2] * (1 + f * 0.16);
        if (P.id === "pier") {   // a striped buoy
          A.dot(c, b[0], b[1] + 3, r, "#8f2a22"); A.dot(c, b[0], b[1], r, f > 0 ? "#ff8a6a" : P.bumper);
          c.save(); c.beginPath(); c.arc(b[0], b[1], r, 0, T); c.clip(); c.fillStyle = "#ffffff"; c.fillRect(b[0] - r, b[1] - r * 0.25, r * 2, r * 0.5); c.restore();
          A.dot(c, b[0], b[1], r * 0.28, "#ffd23e");
        } else if (P.id === "fair") {   // a star bumper
          A.dot(c, b[0], b[1] + 3, r, "#a1306a"); this.star(c, b[0], b[1], r * 1.08, r * 0.62, f > 0 ? "#ffd1e6" : P.bumper); A.dot(c, b[0], b[1], r * 0.42, "#ffd23e");
        } else if (P.id === "frost") {   // a snowball
          A.dot(c, b[0], b[1] + 3, r, "#7fa2c4"); A.dot(c, b[0], b[1], r, f > 0 ? "#ffffff" : "#e9f4fc"); A.dot(c, b[0] - r * 0.3, b[1] - r * 0.3, r * 0.4, "#ffffff");
          c.strokeStyle = P.bumper; c.lineWidth = 2; c.beginPath(); c.arc(b[0], b[1], r - 1, 0, T); c.stroke();
        } else {   // a red mushroom
          A.dot(c, b[0], b[1] + 3, r, "#a83a2a"); A.dot(c, b[0], b[1], r, f > 0 ? "#ff8a6a" : P.bumper);
          [[-0.35, -0.35, 0.24], [0.35, -0.12, 0.17], [-0.05, 0.4, 0.15]].forEach(([dx, dy, k]) => A.dot(c, b[0] + dx * r, b[1] + dy * r, k * r, "#fff6df"));
        }
      }
      for (const s of H.spinners) {
        const tips = A.tips(s, t);
        c.lineCap = "round";
        for (let k = 0; k < s.arms; k++) { c.strokeStyle = "rgba(20,50,20,.25)"; c.lineWidth = s.hw * 2; c.beginPath(); c.moveTo(s.x + 4, s.y + 6); c.lineTo(tips[k * 2] + 4, tips[k * 2 + 1] + 6); c.stroke(); }
        for (let k = 0; k < s.arms; k++) {
          c.strokeStyle = P.rail.dark; c.lineWidth = s.hw * 2 + 2; c.beginPath(); c.moveTo(s.x, s.y + 2); c.lineTo(tips[k * 2], tips[k * 2 + 1] + 2); c.stroke();
          c.strokeStyle = P.rail.top; c.lineWidth = s.hw * 2 - 1; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(tips[k * 2], tips[k * 2 + 1]); c.stroke();
          A.dot(c, tips[k * 2], tips[k * 2 + 1], s.hw * 0.7, P.rail.hi, 0.9);
        }
        A.dot(c, s.x, s.y, (s.hub || 7) + 1, P.bumper); A.dot(c, s.x - 2, s.y - 2, (s.hub || 7) * 0.4, "#ffffff", 0.6);
      }
      for (const mv of H.movers) { Physics.moverPos(mv, t); this.mover(c, mv, Physics._mx, Physics._my, P); }
    },
    star(c, x, y, R, r, col) {
      c.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r : R; k ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      c.closePath(); c.fillStyle = col; c.fill();
    },
    mover(c, m, x, y, P) {
      const ax = x - m.hx, ay = y - m.hy, bx = x + m.hx, by = y + m.hy, r = m.r;
      A.soft(c, x + 5, y + 8, m.hl + r + 4, r + 5, P.cast, 0.35);
      if (m.boat) {
        A.capsule(c, ax, ay + 3, bx, by + 3, r); c.fillStyle = "#7a4a22"; c.fill();
        A.capsule(c, ax, ay, bx, by, r); c.fillStyle = "#c98a4a"; c.fill();
        A.capsule(c, ax + 6, ay, bx - 6, by, r - 4); c.fillStyle = "#e8c48a"; c.fill();
        A.dot(c, x, y, 3, "#ffffff"); c.fillStyle = "#e8553a"; c.beginPath(); c.moveTo(x, y - 1); c.lineTo(x + 12, y - 4); c.lineTo(x, y - 8); c.fill();
      } else if (m.car) {
        A.capsule(c, ax, ay + 3, bx, by + 3, r); c.fillStyle = "#333a4a"; c.fill();
        A.capsule(c, ax, ay, bx, by, r); c.fillStyle = "#3a3f52"; c.fill();
        A.capsule(c, ax + 3, ay, bx - 3, by, r - 3); c.fillStyle = ["#ff5fa2", "#ffd23e", "#4fc3ff"][Math.abs(Math.round(m.a[1])) % 3]; c.fill();
        A.dot(c, x - 4, y, 4, "#fff6df", 0.85);
      } else if (m.penguin) {
        A.capsule(c, ax, ay + 3, bx, by + 3, r); c.fillStyle = "#1e2433"; c.fill();
        A.capsule(c, ax, ay, bx, by, r); c.fillStyle = "#2b3245"; c.fill();
        A.capsule(c, ax + 4, ay + 2, bx - 4, by + 2, r - 4); c.fillStyle = "#ffffff"; c.fill();
        const dir = Math.sign(Physics._mvx) || 1;
        A.dot(c, x + dir * (m.hl + r - 3), y - 1, 3, "#ffb52e"); A.dot(c, x + dir * (m.hl + 1), y - 4, 1.6, "#1e2433"); A.dot(c, x + dir * (m.hl + 1), y + 2, 1.6, "#1e2433");
      } else {   // the windmill door and anything else: a painted plank
        A.capsule(c, ax, ay + 3, bx, by + 3, r); c.fillStyle = P.rail.dark; c.fill();
        A.capsule(c, ax, ay, bx, by, r); c.fillStyle = "#e8553a"; c.fill();
        c.strokeStyle = "rgba(255,255,255,.7)"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(ax, ay - 1); c.lineTo(bx, by - 1); c.stroke();
      }
    },

    // drawn after the balls: buildings the ball passes under
    over(c, H, P, t) {
      const m = A.motion;
      for (const d of H.deco) {
        if (d.kind === "windmill") {
          const x0 = d.x - d.w / 2, y = d.y, w = d.w, h = d.depth;
          A.soft(c, d.x + 8, y + h + 4, w * 0.55, 16, P.cast, 0.35);
          c.fillStyle = "#8a5a3a"; c.fillRect(x0 - 4, y + h - 10, w + 8, 14);
          c.fillStyle = "#f2e6cf"; c.fillRect(x0 - 2, y - 6, w + 4, h + 2);
          // roof: shingles in rows
          c.fillStyle = "#c2523c"; c.fillRect(x0 - 6, y - 12, w + 12, h * 0.62);
          c.strokeStyle = "rgba(0,0,0,.18)"; c.lineWidth = 1; for (let k = 0; k < 5; k++) { const yy = y - 12 + k * (h * 0.62) / 5; c.beginPath(); c.moveTo(x0 - 6, yy); c.lineTo(x0 + w + 6, yy); c.stroke(); }
          c.fillStyle = "rgba(255,255,255,.15)"; c.fillRect(x0 - 6, y - 12, w + 12, 4);
          // the doorway
          c.fillStyle = "#3b2a1c"; c.beginPath(); c.moveTo(d.x - d.gap / 2, y + h); c.lineTo(d.x - d.gap / 2, y + h - 14); c.arc(d.x, y + h - 14, d.gap / 2, Math.PI, 0); c.lineTo(d.x + d.gap / 2, y + h); c.fill();
          // sails turning above the roof
          const hx = d.x, hy = y + 10, L = Math.min(46, h * 0.8);
          c.save(); c.translate(hx, hy); c.rotate(t * 0.9 * m);
          for (let k = 0; k < 4; k++) { c.rotate(T / 4); c.fillStyle = "rgba(60,40,25,.35)"; c.fillRect(-1, 4, 4, L); c.fillStyle = "#fff6df"; c.fillRect(-7, 10, 9, L - 8); c.strokeStyle = "#8a5a3a"; c.lineWidth = 1.4; c.strokeRect(-7, 10, 9, L - 8); c.beginPath(); for (let j = 1; j < 4; j++) { c.moveTo(-7, 10 + j * (L - 8) / 4); c.lineTo(2, 10 + j * (L - 8) / 4); } c.stroke(); c.fillStyle = "#6e4a26"; c.fillRect(-1.5, 0, 3, L); }
          c.restore();
          A.dot(c, hx, hy, 5, "#6e4a26"); A.dot(c, hx, hy, 2, "#f6d394");
        } else if (d.kind === "lighthouse") {
          const { x, y } = d;
          A.soft(c, x + 14, y + 18, 40, 30, P.cast, 0.35);
          A.dot(c, x, y, 34, "#ffffff"); c.save(); c.beginPath(); c.arc(x, y, 34, 0, T); c.clip();
          c.fillStyle = "#e8453a"; for (let k = -2; k <= 2; k += 2) c.fillRect(x - 40, y + k * 12 - 6, 80, 12); c.restore();
          A.dot(c, x, y, 18, "#3a3f52"); A.dot(c, x, y, 13, "#ffe9a0");
          const a = t * 0.8 * m;
          c.save(); c.globalAlpha = 0.16; c.fillStyle = "#fff6c8"; c.beginPath(); c.moveTo(x, y); c.arc(x, y, 150, a, a + 0.35); c.closePath(); c.fill(); c.beginPath(); c.moveTo(x, y); c.arc(x, y, 150, a + Math.PI, a + Math.PI + 0.35); c.closePath(); c.fill(); c.restore();
        }
      }
    },

    flag(c, H, P, t, lift, n) {
      const px = H.cup[0] + 1, py = H.cup[1] - lift, top = py - 46, m = A.motion;
      c.strokeStyle = "rgba(20,50,20,.3)"; c.lineWidth = 2.5; c.beginPath(); c.moveTo(px + 2, H.cup[1] + 2); c.lineTo(px + 24, H.cup[1] + 12); c.stroke();
      c.strokeStyle = "#f3efe6"; c.lineWidth = 2.4; c.beginPath(); c.moveTo(px, py); c.lineTo(px, top); c.stroke();
      c.beginPath(); c.moveTo(px, top);
      for (let i = 0; i <= 8; i++) { const u = i / 8; c.lineTo(px + u * 30, top + 4 * u + Math.sin(t * 5 - u * 4) * 2.4 * u * m); }
      for (let i = 8; i >= 0; i--) { const u = i / 8; c.lineTo(px + u * 30, top + 20 - 6 * u + Math.sin(t * 5 - u * 4) * 2.4 * u * m); }
      c.closePath(); c.fillStyle = P.flag; c.fill();
      c.fillStyle = P.flag === "#ffd23e" ? "#5a3a00" : "#fff6df"; c.font = "400 12px 'Lilita One', sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(String(n), px + 12, top + 10 + Math.sin(t * 5 - 1.6) * m);
    },

    ball(c, x, y, r, seat, P, o) {
      const col = A.SEATS[seat];
      if (o.ghost) { c.globalAlpha = 0.5; }
      if (!o.sinking) A.soft(c, x + 3, y + 4.5, r * 1.25, r * 1.1, "#10240f", 0.42);
      const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      g.addColorStop(0, seat ? sh(col, 0.45) : "#ffffff"); g.addColorStop(seat ? 0.3 : 0.5, col); g.addColorStop(1, sh(col, seat ? -0.3 : -0.25));
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, T); c.fill();
      this.roll(c, x, y, r, o, seat === 0 ? "#e8553a" : "#ffffff");
      c.strokeStyle = "rgba(30,40,30,.4)"; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r, 0, T); c.stroke();
      A.dot(c, x - r * 0.35, y - r * 0.42, r * 0.26, "#ffffff", 0.9);
      c.globalAlpha = 1;
    },
    // a printed band that rolls with the ball
    roll(c, x, y, r, o, col) {
      const dir = Math.atan2(o.vy || 0, o.vx || 0) || -Math.PI / 2, roll = (o.rolled || 0) / (PHYS.R * 2);
      const cs = Math.cos(roll); if (cs < -0.2) return;
      c.save(); c.beginPath(); c.arc(x, y, r, 0, T); c.clip(); c.translate(x, y); c.rotate(dir + Math.PI / 2);
      c.strokeStyle = col; c.lineWidth = r * 0.4; c.globalAlpha *= 0.85;
      c.beginPath(); c.ellipse(0, Math.sin(roll) * r * 0.9, r, r * 0.35 * Math.abs(cs) + 0.6, 0, 0, T); c.stroke(); c.restore();
    },
    aim: { dot: "#ffffff", ring: "#fff6df", back: "rgba(0,0,0,.2)", hot: "#e8553a", line: "rgba(255,255,255,.55)" },
    parts(P) {
      return { strike: [sh(P.turf, 0.3), "#fff6df"], wall: [P.rail.hi, P.rail.top], sand: [P.sand, P.sandEdge], water: ["#bfe8ff", "#ffffff"],
        bump: ["#ffd34d", "#fff6df"], cup: ["#ffd34d", "#e8553a", "#fff6df", "#7ad06e", "#4fc3ff"], portal: ["#ff5fa2", "#c9a7ff", "#fff6df"] };
    },
  };

  // --------------------------------------------------------- surrounds --
  const tree = (c, x, y, r, P, cols) => {
    A.soft(c, x + r * 0.5, y + r * 0.6, r * 1.15, r, P.cast, 0.45);
    [[0, 0, 1], [-0.45, 0.15, 0.7], [0.45, 0.2, 0.68], [0.05, -0.38, 0.62]].forEach(([dx, dy, k]) => A.dot(c, x + dx * r, y + dy * r, r * k, cols[0]));
    [[-0.15, -0.2, 0.55], [0.3, -0.05, 0.38]].forEach(([dx, dy, k]) => A.dot(c, x + dx * r, y + dy * r, r * k, cols[1]));
    A.dot(c, x - r * 0.3, y - r * 0.42, r * 0.24, cols[2], 0.85);
  };
  const DECOR = {
    meadow(c, H, P, B) {
      const fl = ["#fff6df", "#ffd34d", "#ff8fa3", "#c9a7ff"];
      A.scatter(H, B, 220, 11, 22, (x, y, h, i) => { A.dot(c, x, y, 2.2, fl[i % 4], 0.95); A.dot(c, x, y, 0.9, "#f2b630"); });
      A.scatter(H, B, 26, 211, 30, (x, y, h) => { A.soft(c, x + 2, y + 3, 15, 10, P.cast, 0.3); c.fillStyle = "#d8d2c2"; c.beginPath(); c.ellipse(x, y, 13, 9, h(1), 0, T); c.fill(); c.fillStyle = "#ece7da"; c.beginPath(); c.ellipse(x - 2, y - 2, 9, 5, h(1), 0, T); c.fill(); });
      A.scatter(H, B, 40, 311, 62, (x, y, h) => tree(c, x, y, 16 + h(2) * 14, P, ["#3f8f3d", "#5fb34f", "#8ad36d"]));
    },
    pier(c, H, P, B) {
      // waves on the sea
      c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 2;
      A.scatter(H, B, 120, 21, 40, (x, y) => { c.beginPath(); c.arc(x, y, 6, Math.PI * 1.1, Math.PI * 1.9); c.arc(x + 11, y, 6, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); });
      // the pier deck under the green, on pilings
      const deck = A.offsetPoly(H.green, 26);
      for (const [x, y] of A.offsetPoly(H.green, 30)) A.soft(c, x + 6, y + 10, 10, 8, "#0e3550", 0.5);
      c.save(); c.translate(7, 11); A.polyPath(c, deck); c.fillStyle = "rgba(10,40,60,.35)"; c.fill(); c.restore();
      A.polyPath(c, deck); c.fillStyle = P.deck; c.fill();
      c.save(); A.polyPath(c, deck); c.clip(); c.strokeStyle = P.deckLine; c.lineWidth = 1.2;
      for (let y = 0; y < 720; y += 11) { c.beginPath(); c.moveTo(-10, y); c.lineTo(410, y); c.stroke(); }
      for (let i = 0; i < 160; i++) { const y = Math.floor(A.hash(i, 5) * 64) * 11, x = A.hash(i, 6) * 400; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 11); c.stroke(); }
      c.restore();
      A.polyPath(c, deck); c.strokeStyle = "#7a5530"; c.lineWidth = 3; c.stroke();
      A.scatter(H, B, 7, 41, 60, (x, y, h, i) => { A.dot(c, x, y + 2, 7, "#8f2a22"); A.dot(c, x, y, 7, i % 2 ? "#ffd23e" : "#e8453a"); A.dot(c, x, y, 2.4, "#ffffff"); });
    },
    fair(c, H, P, B) {
      A.scatter(H, B, 140, 51, 20, (x, y, h, i) => A.dot(c, x, y, 1.6, ["#fff6df", "#ffd23e", "#ff5fa2"][i % 3], 0.8));
      A.scatter(H, B, 14, 61, 52, (x, y, h, i) => {   // striped tents from above
        const r = 20 + h(1) * 14, cols = [["#e8553a", "#fff6df"], ["#4fc3ff", "#fff6df"], ["#ffd23e", "#ff5fa2"]][i % 3];
        A.soft(c, x + 7, y + 9, r + 6, r + 4, P.cast, 0.4);
        for (let k = 0; k < 10; k++) { c.fillStyle = cols[k % 2]; c.beginPath(); c.moveTo(x, y); c.arc(x, y, r, (k / 10) * T, ((k + 1) / 10) * T); c.closePath(); c.fill(); }
        A.dot(c, x, y, 3.5, "#ffd23e"); c.strokeStyle = "rgba(0,0,0,.2)"; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r, 0, T); c.stroke();
      });
      A.scatter(H, B, 12, 71, 26, (x, y) => { A.soft(c, x + 2, y + 3, 7, 5, P.cast, 0.4); A.dot(c, x, y, 5, "#fff6df"); A.dot(c, x, y, 3, "#ffd23e"); });
    },
    frost(c, H, P, B) {
      A.scatter(H, B, 60, 81, 24, (x, y, h) => A.soft(c, x, y, 22 + h(1) * 22, 12 + h(2) * 10, "#ffffff", 0.7));
      A.scatter(H, B, 36, 91, 40, (x, y, h) => {   // pines from above, snow on the boughs
        const r = 16 + h(3) * 14;
        A.soft(c, x + r * 0.5, y + r * 0.6, r * 1.1, r * 0.9, P.cast, 0.4);
        for (let k = 0; k < 3; k++) { const rr = r * (1 - k * 0.28); c.fillStyle = ["#2f6b52", "#3f8a68", "#5aa684"][k]; c.beginPath(); for (let j = 0; j < 16; j++) { const a = (j / 16) * T, q = j % 2 ? rr * 0.62 : rr; j ? c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q) : c.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); c.fill(); }
        for (let j = 0; j < 5; j++) A.dot(c, x + (A.hash(x, j) - 0.5) * r, y + (A.hash(y, j) - 0.5) * r, 2.5, "#ffffff", 0.9);
      });
      A.scatter(H, B, 14, 101, 30, (x, y, h) => { A.soft(c, x + 3, y + 4, 12, 9, P.cast, 0.3); c.fillStyle = "#8ea3b8"; c.beginPath(); c.ellipse(x, y, 10, 8, h(1), 0, T); c.fill(); A.dot(c, x - 2, y - 4, 6, "#ffffff", 0.95); });
    },
  };

  A.register("diorama", S);
})();
