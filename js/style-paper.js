// Paper Cut — every piece cut from coloured card and laid in layers, a flat
// offset shadow under each one and a wobbly ink line round the edge.
//
// Legibility budget: the ink line is the rail, so nothing decorative carries
// an ink outline inside the green; hazards keep their hue (sand mustard,
// water blue, ice white-blue) on every course.

(function () {
  const A = Art, T = A.TAU, sh = A.shade;
  const INK = "#3b3446", SHADOW = "rgba(59,52,70,.2)";

  const PAL = [
    { id: "meadow", paper: "#f4ead8", hills: ["#f7d9c4", "#e9e1c4", "#d7e4c4", "#c4d9b4"], turf: "#a9c79a", rail: "#f6c9b8", block: "#e8b4a0", accent: "#e7826b", flag: "#e7826b", bumper: "#f6a9a0", post: "#d9b38c" },
    { id: "pier", paper: "#e8f1f4", hills: ["#cfe3ef", "#b5d5ea", "#9cc9e6", "#86bde0"], turf: "#9fcfb4", rail: "#fffaf0", block: "#f3e3c3", accent: "#4f86c6", flag: "#4f86c6", bumper: "#f29a8e", post: "#b9b4c4", deck: "#e7c99b" },
    { id: "fair", paper: "#fbeed5", hills: ["#fbd9a8", "#f6c27f", "#f2ab8f", "#e8987b"], turf: "#9ec9e2", rail: "#f2c94c", block: "#f6a9a0", accent: "#e7826b", flag: "#b9b3f0", bumper: "#f6a9a0", post: "#fffaf0" },
    { id: "frost", paper: "#f2f5fa", hills: ["#ffffff", "#eef0fb", "#dfe3f6", "#cfd5f0"], turf: "#b9dccb", rail: "#c9c3ef", block: "#ffffff", accent: "#7a8fd6", flag: "#e7826b", bumper: "#a9cdf0", post: "#d5dbe8" },
  ];
  const COMMON = { sand: "#f2d48a", water: "#8fc3e6", waterDeep: "#6aa9d6", ice: "#f4fbff", pad: "#f2c94c", slope: "rgba(59,52,70,.12)" };

  // a cut-out: flat shadow, card fill, ink edge
  function cut(c, path, fill, dx, dy, lw) {
    c.save(); c.translate(dx == null ? 3 : dx, dy == null ? 4 : dy); path(); c.fillStyle = SHADOW; c.fill(); c.restore();
    path(); c.fillStyle = fill; c.fill(); c.strokeStyle = INK; c.lineWidth = lw || 1.8; c.lineJoin = "round"; c.stroke();
  }

  const S = {
    id: "paper", label: "Paper Cut",
    pal(ci) { return Object.assign({}, COMMON, PAL[ci] || PAL[0]); },

    bakeBase(c, H, P, B) {
      c.fillStyle = P.paper; c.fillRect(B.l, B.t, B.r - B.l, B.b - B.t);
      for (let i = 0; i < 900; i++) A.dot(c, B.l + A.hash(i, 3) * (B.r - B.l), B.t + A.hash(i, 4) * (B.b - B.t), 0.7, i % 2 ? "#ffffff" : sh(P.paper, -0.07), 0.6);
      // layered paper hills behind the green
      const span = B.b - B.t;
      P.hills.forEach((col, k) => {
        const y0 = B.t + span * (0.08 + k * 0.25), amp = 12 + k * 3, seed = k * 1.7 + 1;
        const path = () => { c.beginPath(); c.moveTo(B.l - 10, B.b + 10); for (let x = B.l - 10; x <= B.r + 20; x += 18) c.lineTo(x, y0 + Math.sin(x / 55 + seed) * amp + (A.hash(x, seed) - 0.5) * 4); c.lineTo(B.r + 10, B.b + 10); c.closePath(); };
        cut(c, path, col, 3, 4, 1.4);
      });
      DECOR[P.id](c, H, P, B);

      const J = 1.5, G = () => A.wobblePath(c, H.green, J * 2, 5);
      if (P.deck) { const d = A.offsetPoly(H.green, 22); cut(c, () => A.wobblePath(c, d, 3, 8), P.deck, 5, 6, 1.6); c.save(); A.wobblePath(c, d, 3, 8); c.clip(); c.strokeStyle = "rgba(59,52,70,.25)"; c.lineWidth = 1; for (let y = 0; y < 720; y += 12) { c.beginPath(); c.moveTo(0, y); c.lineTo(400, y); c.stroke(); } c.restore(); }
      // the rail strip, then the turf card on top of it
      c.save(); c.translate(6, 7); G(); c.lineJoin = "round"; c.lineWidth = 22; c.strokeStyle = SHADOW; c.stroke(); c.fillStyle = SHADOW; c.fill(); c.restore();
      c.save(); G(); c.lineJoin = "round"; c.lineWidth = 24; c.strokeStyle = INK; c.stroke(); c.lineWidth = 20.5; c.strokeStyle = P.rail; c.stroke();
      c.lineWidth = 1.2; c.strokeStyle = "rgba(59,52,70,.5)"; c.setLineDash([4, 5]); c.stroke(); c.setLineDash([]); c.restore();
      c.save(); G(); c.fillStyle = P.turf; c.fill(); c.clip();
      for (let i = 0; i < 1300; i++) A.dot(c, A.hash(i, 41) * PHYS.W, A.hash(i, 42) * PHYS.H, 0.6, i % 2 ? sh(P.turf, -0.1) : sh(P.turf, 0.14), 0.55);
      c.strokeStyle = "rgba(59,52,70,.06)"; c.lineWidth = 1; for (let i = -40; i < 60; i++) { c.beginPath(); c.moveTo(i * 16, 0); c.lineTo(i * 16 - 300, 700); c.stroke(); }
      this.regions(c, H, P);
      this.tee(c, H, P); this.cup(c, H, P);
      for (const p of H.portals) { this.portalBase(c, p.a, P, 0); this.portalBase(c, p.b, P, 1); }
      c.restore();
      c.save(); G(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); c.restore();
      for (const b of H.blocks) cut(c, () => A.wobblePath(c, b, 2.4, 13), P.block, 5, 6, 2);
      for (const b of H.blocks) { c.save(); A.wobblePath(c, b, 2.4, 13); c.clip(); c.strokeStyle = "rgba(59,52,70,.12)"; c.lineWidth = 1; for (let k = -40; k < 40; k++) { c.beginPath(); c.moveTo(k * 9, 0); c.lineTo(k * 9 + 700, 700); c.stroke(); } c.restore(); }
      for (const p of H.posts) cut(c, () => { c.beginPath(); c.arc(p[0], p[1], p[2], 0, T); }, P.post, 3, 3, 1.8);
    },
    regions(c, H, P) {
      for (const r of H.slopes) {
        const [cx, cy] = A.regionCentre(r), L = Math.hypot(r.dir[0], r.dir[1]) || 1, ux = r.dir[0] / L, uy = r.dir[1] / L;
        c.save(); A.regionPath(c, r); c.fillStyle = "rgba(255,250,240,.35)"; c.fill(); c.clip();
        c.strokeStyle = P.slope; c.lineWidth = 1.2;
        for (let k = -30; k < 30; k++) { const ox = cx + ux * k * 7, oy = cy + uy * k * 7; c.beginPath(); c.moveTo(ox - uy * 300, oy + ux * 300); c.lineTo(ox + uy * 300, oy - ux * 300); c.stroke(); }
        c.strokeStyle = INK; c.lineWidth = 1.6; c.lineCap = "round";
        for (let k = -3; k <= 3; k++) for (let j = -1; j <= 1; j++) { const x = cx + ux * j * 50 - uy * k * 44, y = cy + uy * j * 50 + ux * k * 44; c.beginPath(); c.moveTo(x - ux * 10, y - uy * 10); c.lineTo(x + ux * 8, y + uy * 8); c.moveTo(x + ux * 8 - uy * 5 - ux * 6, y + uy * 8 + ux * 5 - uy * 6); c.lineTo(x + ux * 8, y + uy * 8); c.lineTo(x + ux * 8 + uy * 5 - ux * 6, y + uy * 8 - ux * 5 - uy * 6); c.stroke(); }
        c.restore();
      }
      for (const r of H.pads) cut(c, () => A.regionPath(c, r, -2, 0.03, 4), P.pad, 2, 3, 1.6);
      for (const r of H.ice) {
        cut(c, () => A.regionPath(c, r, 0, 0.05, 6), P.ice, 2, 3, 1.6);
        c.save(); A.regionPath(c, r); c.clip(); c.strokeStyle = "rgba(122,143,214,.45)"; c.lineWidth = 1.4; c.lineCap = "round";
        for (let i = 0; i < 18; i++) { const x = A.hash(i, 81) * PHYS.W, y = A.hash(i, 82) * PHYS.H; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 16, y - 7); c.stroke(); }
        c.restore();
      }
      for (const r of H.sand) {
        cut(c, () => A.regionPath(c, r, 0, 0.14, 3), P.sand, 3, 3, 1.8);
        c.save(); A.regionPath(c, r); c.clip(); for (let i = 0; i < 70; i++) A.dot(c, A.hash(i, 51) * PHYS.W, A.hash(i, 52) * PHYS.H, 1.1, INK, 0.3); c.restore();
      }
      for (const r of H.water) {
        cut(c, () => A.regionPath(c, r, 0, 0.12, 9), P.water, 3, 3, 1.8);
        c.save(); A.regionPath(c, r, -9, 0.12, 9); c.fillStyle = P.waterDeep; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.1; c.stroke(); c.restore();
      }
    },
    tee(c, H, P) {
      const [x, y] = H.tee;
      c.save(); c.translate(x, y); c.rotate(-0.04);
      c.fillStyle = SHADOW; c.fillRect(-25, -12, 54, 30); c.fillStyle = "#fffaf0"; c.fillRect(-28, -15, 54, 30); c.strokeStyle = INK; c.lineWidth = 1.6; c.strokeRect(-28, -15, 54, 30);
      c.setLineDash([3, 3]); c.strokeRect(-24, -11, 46, 22); c.setLineDash([]);
      c.restore();
    },
    cup(c, H, P) {
      const [x, y] = H.cup;
      c.beginPath(); c.arc(x, y, PHYS.CUP_R + 2.5, 0, T); c.fillStyle = "#fffaf0"; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
      c.beginPath(); c.arc(x, y, PHYS.CUP_R, 0, T); c.fillStyle = "#2d2836"; c.fill();
    },
    portalBase(c, p, P, k) {
      cut(c, () => { c.beginPath(); c.arc(p[0], p[1], PHYS.PORTAL_R + 4, 0, T); }, k ? "#b9b3f0" : "#f6a9a0", 2, 3, 1.8);
      c.beginPath(); c.arc(p[0], p[1], PHYS.PORTAL_R, 0, T); c.fillStyle = "#2d2836"; c.fill();
    },

    dyn(c, H, P, t, fx) {
      const m = A.motion;
      for (const r of H.water) {
        c.save(); A.regionPath(c, r, -1, 0.12, 9); c.clip(); c.strokeStyle = "#fffaf0"; c.lineWidth = 1.5;
        const [cx, cy] = A.regionCentre(r);
        for (let i = 0; i < 4; i++) { const x = cx - 26 + i * 16 + Math.sin(t * 1.3 * m + i) * 3, y = cy - 12 + (i % 2) * 14; c.beginPath(); c.arc(x, y, 4, Math.PI, 0); c.arc(x + 8, y, 4, Math.PI, 0); c.stroke(); }
        c.restore();
      }
      for (const r of H.pads) {
        const L = Math.hypot(r.dir[0], r.dir[1]) || 1, ux = r.dir[0] / L, uy = r.dir[1] / L, [cx, cy] = A.regionCentre(r);
        c.save(); A.regionPath(c, r, -3); c.clip(); c.strokeStyle = INK; c.lineWidth = 2.2; c.lineCap = "round"; c.lineJoin = "round";
        const off = (t * 50 * m) % 24;
        for (let k = -6; k <= 6; k++) for (let j = -2; j <= 2; j++) { const d = k * 24 + off, x = cx + ux * d - uy * j * 30, y = cy + uy * d + ux * j * 30; c.beginPath(); c.moveTo(x - ux * 6 - uy * 7, y - uy * 6 + ux * 7); c.lineTo(x + ux * 4, y + uy * 4); c.lineTo(x - ux * 6 + uy * 7, y - uy * 6 - ux * 7); c.stroke(); }
        c.restore();
      }
      for (const p of H.portals) for (const [q, k] of [[p.a, 0], [p.b, 1]]) {
        c.save(); c.translate(q[0], q[1]); c.rotate(t * 1.8 * m * (k ? -1 : 1)); c.strokeStyle = "#fffaf0"; c.lineWidth = 1.6;
        c.beginPath(); for (let i = 0; i < 30; i++) { const a = i * 0.45, rr = 1 + i * 0.32; i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(0, 0); } c.stroke(); c.restore();
      }
      for (let i = 0; i < H.bumpers.length; i++) {
        const b = H.bumpers[i], f = fx.bump[i] || 0, r = b[2] * (1 + f * 0.15);
        cut(c, () => { c.beginPath(); c.arc(b[0], b[1], r, 0, T); }, f > 0 ? "#ffd6cb" : P.bumper, 3, 3, 2);
        c.beginPath(); c.arc(b[0], b[1], r * 0.55, 0, T); c.fillStyle = "#fffaf0"; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
      }
      for (const s of H.spinners) {
        const tips = A.tips(s, t); c.lineCap = "round";
        for (let k = 0; k < s.arms; k++) { c.save(); c.translate(3, 3); c.strokeStyle = SHADOW; c.lineWidth = s.hw * 2; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(tips[k * 2], tips[k * 2 + 1]); c.stroke(); c.restore(); }
        for (let k = 0; k < s.arms; k++) { c.strokeStyle = INK; c.lineWidth = s.hw * 2 + 3; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(tips[k * 2], tips[k * 2 + 1]); c.stroke(); c.strokeStyle = "#b9b3f0"; c.lineWidth = s.hw * 2 - 1; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(tips[k * 2], tips[k * 2 + 1]); c.stroke(); }
        c.beginPath(); c.arc(s.x, s.y, (s.hub || 7) + 0.5, 0, T); c.fillStyle = "#f2c94c"; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.8; c.stroke();
      }
      for (const mv of H.movers) { Physics.moverPos(mv, t); this.mover(c, mv, Physics._mx, Physics._my, P); }
    },
    mover(c, m, x, y, P) {
      const ax = x - m.hx, ay = y - m.hy, bx = x + m.hx, by = y + m.hy, r = m.r;
      const fill = m.boat ? "#e7c99b" : m.car ? ["#f6a9a0", "#f2c94c", "#8fc3e6"][Math.abs(Math.round(m.a[1])) % 3] : m.penguin ? "#4a4458" : "#e7826b";
      cut(c, () => A.capsule(c, ax, ay, bx, by, r), fill, 3, 4, 2);
      if (m.boat) { c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.moveTo(ax + 4, ay); c.lineTo(bx - 4, by); c.stroke(); c.fillStyle = "#fffaf0"; c.beginPath(); c.moveTo(x, y - 2); c.lineTo(x + 12, y - 4); c.lineTo(x, y - 12); c.closePath(); c.fill(); c.stroke(); }
      if (m.penguin) { const dir = Math.sign(Physics._mvx) || 1; c.beginPath(); c.ellipse(x + dir * 2, y + 1, m.hl, r - 4, 0, 0, T); c.fillStyle = "#fffaf0"; c.fill(); A.dot(c, x + dir * (m.hl + r - 2), y, 3, "#f2c94c"); }
      if (m.car) { A.dot(c, x - 3, y, 4, "#fffaf0"); c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.arc(x - 3, y, 4, 0, T); c.stroke(); }
    },
    over(c, H, P, t) {
      const m = A.motion;
      for (const d of H.deco) {
        if (d.kind === "windmill") {
          const x0 = d.x - d.w / 2, y = d.y, w = d.w, h = d.depth;
          const body = () => { c.beginPath(); c.rect(x0 - 2, y - 8, w + 4, h + 4); };
          cut(c, body, "#fffaf0", 5, 6, 2);
          c.save(); body(); c.clip(); c.fillStyle = "#e7826b"; c.fillRect(x0 - 2, y - 8, w + 4, h * 0.55); c.strokeStyle = "rgba(59,52,70,.35)"; c.lineWidth = 1; for (let k = 0; k < 40; k++) { c.beginPath(); c.moveTo(x0 + k * 9, y - 8); c.lineTo(x0 + k * 9 - 12, y - 8 + h * 0.55); c.stroke(); } c.restore();
          c.beginPath(); c.moveTo(x0 - 2, y - 8 + h * 0.55); c.lineTo(x0 + w + 2, y - 8 + h * 0.55); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
          c.fillStyle = "#2d2836"; c.beginPath(); c.moveTo(d.x - d.gap / 2, y + h - 4); c.lineTo(d.x - d.gap / 2, y + h - 14); c.arc(d.x, y + h - 14, d.gap / 2, Math.PI, 0); c.lineTo(d.x + d.gap / 2, y + h - 4); c.fill();
          const hx = d.x, hy = y + 10, L = Math.min(46, h * 0.8);
          c.save(); c.translate(hx, hy); c.rotate(t * 0.9 * m);
          for (let k = 0; k < 4; k++) { c.rotate(T / 4); c.fillStyle = SHADOW; c.fillRect(-4, 12, 10, L - 8); c.fillStyle = "#fffaf0"; c.fillRect(-7, 9, 10, L - 8); c.strokeStyle = INK; c.lineWidth = 1.5; c.strokeRect(-7, 9, 10, L - 8); c.beginPath(); c.moveTo(-2, 0); c.lineTo(-2, L); c.stroke(); }
          c.restore();
          c.beginPath(); c.arc(hx, hy, 5, 0, T); c.fillStyle = "#f2c94c"; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
        } else if (d.kind === "lighthouse") {
          const { x, y } = d;
          cut(c, () => { c.beginPath(); c.arc(x, y, 34, 0, T); }, "#fffaf0", 6, 7, 2);
          c.save(); c.beginPath(); c.arc(x, y, 34, 0, T); c.clip(); c.fillStyle = "#e7826b"; for (let k = -2; k <= 2; k += 2) c.fillRect(x - 40, y + k * 12 - 6, 80, 12); c.restore();
          c.beginPath(); c.arc(x, y, 34, 0, T); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
          cut(c, () => { c.beginPath(); c.arc(x, y, 15, 0, T); }, "#f2c94c", 2, 2, 1.8);
          const a = t * 0.8 * m; c.save(); c.globalAlpha = 0.22; c.fillStyle = "#f2c94c"; c.beginPath(); c.moveTo(x, y); c.arc(x, y, 140, a, a + 0.3); c.closePath(); c.fill(); c.restore();
        }
      }
    },
    flag(c, H, P, t, lift, n) {
      const px = H.cup[0] + 1, py = H.cup[1] - lift, top = py - 46, m = A.motion;
      c.strokeStyle = "rgba(59,52,70,.22)"; c.lineWidth = 3; c.beginPath(); c.moveTo(px + 3, H.cup[1] + 2); c.lineTo(px + 22, H.cup[1] + 12); c.stroke();
      c.strokeStyle = INK; c.lineWidth = 3.4; c.beginPath(); c.moveTo(px, py); c.lineTo(px, top); c.stroke();
      c.strokeStyle = "#fffaf0"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(px, py - 1); c.lineTo(px, top + 1); c.stroke();
      c.beginPath(); c.moveTo(px, top); c.lineTo(px + 30, top + 9 + Math.sin(t * 3) * 1.5 * m); c.lineTo(px, top + 20); c.closePath();
      c.fillStyle = P.flag; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
      c.fillStyle = "#fffaf0"; c.font = "700 14px Gaegu, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(n), px + 10, top + 10);
    },
    ball(c, x, y, r, seat, P, o) {
      const col = A.SEATS[seat] === "#ffffff" ? "#fffaf0" : A.SEATS[seat];
      if (o.ghost) c.globalAlpha = 0.5;
      if (!o.sinking) A.dot(c, x + 3, y + 3, r, SHADOW);
      c.beginPath(); c.arc(x, y, r, 0, T); c.fillStyle = col; c.fill();
      Art.styles.diorama.roll(c, x, y, r, o, seat === 0 ? "#e7826b" : "#fffaf0");
      c.beginPath(); c.arc(x, y, r, 0, T); c.strokeStyle = INK; c.lineWidth = 1.8; c.stroke();
      c.globalAlpha = 1;
    },
    aim: { dot: INK, ring: INK, back: "rgba(59,52,70,.15)", hot: "#e7826b", line: "rgba(59,52,70,.45)" },
    parts(P) {
      return { strike: [P.turf, INK], wall: [P.rail, INK], sand: [P.sand, INK], water: [P.water, "#fffaf0"], bump: [P.bumper, "#fffaf0"],
        cup: ["#f6a9a0", "#b9b3f0", "#f2c94c", "#8fc3e6", "#a9c79a"], portal: ["#f6a9a0", "#b9b3f0", "#fffaf0"] };
    },
  };

  const flower = (c, x, y, col) => {
    c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y + 4); c.lineTo(x, y + 14); c.stroke();
    for (let k = 0; k < 5; k++) { const a = k * 1.2566; c.beginPath(); c.arc(x + Math.cos(a) * 4.2, y + Math.sin(a) * 4.2, 3.4, 0, T); c.fillStyle = col; c.fill(); c.stroke(); }
    c.beginPath(); c.arc(x, y, 2.3, 0, T); c.fillStyle = "#f2c94c"; c.fill(); c.stroke();
  };
  const DECOR = {
    meadow(c, H, P, B) {
      A.scatter(H, B, 40, 17, 26, (x, y, h, i) => flower(c, x, y, ["#f6a9a0", "#fffaf0", "#b9b3f0"][i % 3]));
      A.scatter(H, B, 16, 27, 40, (x, y, h) => { const r = 14 + h(1) * 12; cut(c, () => { c.beginPath(); c.arc(x, y, r, 0, T); c.arc(x + r * 0.7, y + r * 0.2, r * 0.7, 0, T); }, "#a9c79a", 3, 4, 1.5); });
    },
    pier(c, H, P, B) {
      c.strokeStyle = "#fffaf0"; c.lineWidth = 1.6;
      A.scatter(H, B, 60, 37, 40, (x, y) => { c.beginPath(); c.arc(x, y, 5, Math.PI, 0); c.arc(x + 10, y, 5, Math.PI, 0); c.stroke(); });
      A.scatter(H, B, 6, 47, 60, (x, y, h, i) => cut(c, () => { c.beginPath(); c.arc(x, y, 7, 0, T); }, i % 2 ? "#f2c94c" : "#f29a8e", 2, 3, 1.5));
    },
    fair(c, H, P, B) {
      A.scatter(H, B, 12, 57, 50, (x, y, h, i) => {
        const r = 18 + h(1) * 12, col = ["#f6a9a0", "#8fc3e6", "#f2c94c"][i % 3];
        cut(c, () => { c.beginPath(); for (let k = 0; k < 8; k++) { const a = (k / 8) * T; k ? c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); }, col, 4, 5, 1.6);
        c.strokeStyle = INK; c.lineWidth = 1.2; for (let k = 0; k < 8; k += 2) { const a = (k / 8) * T; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.stroke(); }
      });
      A.scatter(H, B, 50, 67, 22, (x, y, h, i) => { c.fillStyle = ["#f6a9a0", "#f2c94c", "#b9b3f0"][i % 3]; c.beginPath(); c.moveTo(x, y - 4); c.lineTo(x + 4, y + 3); c.lineTo(x - 4, y + 3); c.closePath(); c.fill(); });
    },
    frost(c, H, P, B) {
      A.scatter(H, B, 20, 77, 40, (x, y, h) => {
        const r = 14 + h(2) * 12;
        cut(c, () => { c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.8, y + r * 0.7); c.lineTo(x - r * 0.8, y + r * 0.7); c.closePath(); }, "#9fcfb4", 3, 4, 1.5);
        c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.3, y - r * 0.4); c.lineTo(x - r * 0.3, y - r * 0.4); c.closePath(); c.fillStyle = "#fffaf0"; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2; c.stroke();
      });
      A.scatter(H, B, 40, 87, 20, (x, y) => { c.strokeStyle = "#b9b3f0"; c.lineWidth = 1.2; for (let k = 0; k < 3; k++) { const a = (k * Math.PI) / 3; c.beginPath(); c.moveTo(x - Math.cos(a) * 4, y - Math.sin(a) * 4); c.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4); c.stroke(); } });
    },
  };

  A.register("paper", S);
})();
