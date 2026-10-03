// Glow Night — indoor blacklight mini-golf. Dark felt, neon-tube rails, a
// glitter pit for sand, lit pools, confetti-print carpet, a glowing ball trail.
//
// Legibility budget: the tube colour belongs to the rails alone on each course;
// hazards glow in their own fixed colours (sand violet, water cyan, ice white)
// and the carpet print outside the rails stays under 30% opacity.
// Glow is baked with shadowBlur ONCE; per-frame glows are wide low-alpha
// strokes, never shadowBlur or ctx.filter (see lessons: filters per draw call).

(function () {
  const A = Art, T = A.TAU;
  const PAL = [
    { id: "meadow", bg: "#0b0820", felt: "#1a1440", tube: "#ff4fd8", tube2: "#ffd6f5", accent: "#3ef0ff", flag: "#3ef0ff", bumper: "#ffd23e", post: "#b6ff3e", carpet: ["#ff4fd8", "#3ef0ff", "#b6ff3e", "#ffd23e"] },
    { id: "pier", bg: "#03121b", felt: "#0b2b3a", tube: "#3ef0ff", tube2: "#d6fbff", accent: "#7dffb0", flag: "#7dffb0", bumper: "#ff7a59", post: "#7dffb0", carpet: ["#3ef0ff", "#7dffb0", "#4f8bff", "#ffffff"] },
    { id: "fair", bg: "#140818", felt: "#2a0f3a", tube: "#ffd23e", tube2: "#fff3c4", accent: "#ff7a2e", flag: "#ff4fd8", bumper: "#ff4fd8", post: "#3ef0ff", carpet: ["#ffd23e", "#ff7a2e", "#ff4fd8", "#3ef0ff"] },
    { id: "frost", bg: "#060a1c", felt: "#14204a", tube: "#9fe4ff", tube2: "#ffffff", accent: "#b6a0ff", flag: "#b6a0ff", bumper: "#b6a0ff", post: "#ffffff", carpet: ["#9fe4ff", "#b6a0ff", "#ffffff", "#7dffb0"] },
  ];
  const COMMON = { sand: "#2b1f5e", sandGlint: ["#ff4fd8", "#3ef0ff", "#ffd23e", "#b6ff3e"], sandEdge: "#b06bff", water: "#0a5f8a", waterHi: "#1cc8e0", waterEdge: "#3ef0ff", ice: "#1f3a6e", iceEdge: "#e6f7ff", pad: "#b6ff3e" };

  function glowStroke(c, col, w, blur) { c.shadowColor = col; c.shadowBlur = blur; c.strokeStyle = col; c.lineWidth = w; c.stroke(); c.shadowBlur = 0; }

  const S = {
    id: "glow", label: "Glow Night",
    pal(ci) { return Object.assign({}, COMMON, PAL[ci] || PAL[0]); },

    bakeBase(c, H, P, B) {
      c.fillStyle = P.bg; c.fillRect(B.l, B.t, B.r - B.l, B.b - B.t);
      // blacklight carpet: confetti shapes in the course's neons, faint
      A.scatter(H, B, 260, 61, 14, (x, y, h, i) => {
        c.save(); c.translate(x, y); c.rotate(h(1) * 6); c.globalAlpha = 0.26; c.strokeStyle = P.carpet[i % 4]; c.lineWidth = 1.6; c.beginPath();
        const k = i % 4;
        if (P.id === "frost" && k < 2) { for (let j = 0; j < 3; j++) { const a = (j * Math.PI) / 3; c.moveTo(-Math.cos(a) * 5, -Math.sin(a) * 5); c.lineTo(Math.cos(a) * 5, Math.sin(a) * 5); } }
        else if (P.id === "fair" && k < 2) { for (let j = 0; j < 5; j++) { const a = -Math.PI / 2 + (j * 4 * Math.PI) / 5; j ? c.lineTo(Math.cos(a) * 5, Math.sin(a) * 5) : c.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); } c.closePath(); }
        else if (P.id === "pier" && k < 2) { c.arc(0, 0, 4, Math.PI, 0); for (let j = -2; j <= 2; j++) { c.moveTo(j * 2, 0); c.quadraticCurveTo(j * 2 + 2, 5, j * 2, 9); } }
        else if (k === 0) { c.moveTo(-5, 0); c.quadraticCurveTo(0, -6, 5, 0); }
        else if (k === 1) c.arc(0, 0, 3, 0, T);
        else if (k === 2) { c.moveTo(-4, -4); c.lineTo(4, 4); c.moveTo(4, -4); c.lineTo(-4, 4); }
        else { c.moveTo(-4, 3); c.lineTo(0, -4); c.lineTo(4, 3); }
        c.stroke(); c.restore();
      });
      const G = () => A.polyPath(c, H.green);
      // felt with a soft pool of light
      c.save(); G(); c.clip(); c.fillStyle = P.felt; c.fillRect(0, 0, PHYS.W, PHYS.H);
      for (let i = 0; i < 1300; i++) A.dot(c, A.hash(i, 71) * PHYS.W, A.hash(i, 72) * PHYS.H, 0.7, i % 2 ? A.shade(P.felt, 0.12) : A.shade(P.felt, -0.25), 0.8);
      const vg = c.createRadialGradient(200, 360, 40, 200, 360, 440); vg.addColorStop(0, "rgba(140,100,255,.10)"); vg.addColorStop(1, "rgba(0,0,0,.28)"); c.fillStyle = vg; c.fillRect(0, 0, PHYS.W, PHYS.H);
      this.regions(c, H, P);
      // tee strip and cup ring
      c.strokeStyle = "#b6ff3e"; c.shadowColor = "#b6ff3e"; c.shadowBlur = 10; c.lineWidth = 2; c.strokeRect(H.tee[0] - 24, H.tee[1] - 13, 48, 26); c.shadowBlur = 0;
      c.fillStyle = "#020106"; c.beginPath(); c.arc(H.cup[0], H.cup[1], PHYS.CUP_R, 0, T); c.fill();
      c.beginPath(); c.arc(H.cup[0], H.cup[1], PHYS.CUP_R + 1.5, 0, T); glowStroke(c, "#ffd23e", 2, 12);
      for (const p of H.portals) for (const [q, k] of [[p.a, 0], [p.b, 1]]) { c.fillStyle = "#020106"; c.beginPath(); c.arc(q[0], q[1], PHYS.PORTAL_R, 0, T); c.fill(); c.beginPath(); c.arc(q[0], q[1], PHYS.PORTAL_R + 3, 0, T); glowStroke(c, k ? "#b06bff" : "#ff4fd8", 2.4, 14); }
      c.restore();
      // blocks: dark slabs edged in tube light
      for (const b of H.blocks) { A.polyPath(c, b); c.fillStyle = "#07051a"; c.fill(); c.lineJoin = "round"; glowStroke(c, P.accent, 3, 16); A.polyPath(c, b); c.strokeStyle = "#ffffff"; c.lineWidth = 1; c.stroke(); }
      for (const p of H.posts) { c.beginPath(); c.arc(p[0], p[1], p[2], 0, T); c.fillStyle = "#07051a"; c.fill(); glowStroke(c, P.post, 2.5, 12); }
      // the neon tube rails: housing, then the tube in two glow passes
      c.save(); G(); c.lineJoin = "round"; c.lineWidth = 20; c.strokeStyle = "#07051a"; c.stroke();
      c.lineWidth = 16; c.strokeStyle = A.shade(P.felt, -0.3); c.stroke();
      glowStroke(c, P.tube, 4, 22); c.shadowColor = P.tube; c.shadowBlur = 8; c.lineWidth = 2; c.strokeStyle = P.tube2; c.stroke(); c.shadowBlur = 0; c.restore();
    },
    regions(c, H, P) {
      for (const r of H.slopes) {
        const [cx, cy] = A.regionCentre(r), L = Math.hypot(r.dir[0], r.dir[1]) || 1, ux = r.dir[0] / L, uy = r.dir[1] / L;
        c.save(); A.regionPath(c, r); c.clip();
        const gr = c.createLinearGradient(cx - ux * 130, cy - uy * 130, cx + ux * 130, cy + uy * 130); gr.addColorStop(0, "rgba(120,90,255,.18)"); gr.addColorStop(1, "rgba(0,0,0,.2)"); c.fillStyle = gr; c.fillRect(0, 0, PHYS.W, PHYS.H);
        c.strokeStyle = "rgba(182,160,255,.5)"; c.lineWidth = 1.5;
        for (let k = -3; k <= 3; k++) for (let j = -1; j <= 1; j++) { const x = cx + ux * j * 50 - uy * k * 44, y = cy + uy * j * 50 + ux * k * 44; c.beginPath(); c.moveTo(x - ux * 4 - uy * 7, y - uy * 4 + ux * 7); c.lineTo(x + ux * 6, y + uy * 6); c.lineTo(x - ux * 4 + uy * 7, y - uy * 4 - ux * 7); c.stroke(); }
        c.restore();
      }
      for (const r of H.pads) { A.regionPath(c, r, -2); c.fillStyle = "rgba(182,255,62,.08)"; c.fill(); glowStroke(c, P.pad, 2, 10); }
      for (const r of H.ice) {
        A.regionPath(c, r); c.fillStyle = P.ice; c.fill(); glowStroke(c, P.iceEdge, 1.6, 10);
        c.save(); A.regionPath(c, r); c.clip(); c.strokeStyle = "rgba(230,247,255,.25)"; c.lineWidth = 1;
        for (let i = 0; i < 24; i++) { const x = A.hash(i, 91) * PHYS.W, y = A.hash(i, 92) * PHYS.H; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 18, y - 8); c.stroke(); }
        c.restore();
      }
      for (const r of H.sand) {
        A.regionPath(c, r, 0, 0.1, 3); c.fillStyle = P.sand; c.fill();
        c.save(); A.regionPath(c, r); c.clip(); for (let i = 0; i < 200; i++) A.dot(c, A.hash(i, 81) * PHYS.W, A.hash(i, 82) * PHYS.H, 0.9, P.sandGlint[i % 4], 0.85); c.restore();
        A.regionPath(c, r, 0, 0.1, 3); glowStroke(c, P.sandEdge, 2, 10);
      }
      for (const r of H.water) {
        const [cx, cy] = A.regionCentre(r), rad = r.e ? Math.max(r.e[2], r.e[3]) : 80;
        const wg = c.createRadialGradient(cx, cy, 4, cx, cy, rad); wg.addColorStop(0, P.waterHi); wg.addColorStop(1, P.water);
        A.regionPath(c, r, 0, 0.08, 9); c.fillStyle = wg; c.fill(); glowStroke(c, P.waterEdge, 2, 14);
      }
    },

    dyn(c, H, P, t, fx) {
      const m = A.motion;
      for (const r of H.water) {
        c.save(); A.regionPath(c, r, -2, 0.08, 9); c.clip(); c.strokeStyle = "rgba(180,255,255,.6)"; c.lineWidth = 1.2;
        const [cx, cy] = A.regionCentre(r);
        for (let i = 0; i < 3; i++) { const ph = (t * 0.4 * m + i / 3) % 1; c.globalAlpha = 1 - ph; c.beginPath(); c.ellipse(cx, cy, 6 + ph * 40, 4 + ph * 30, 0, 0, T); c.stroke(); }
        c.restore();
      }
      for (const r of H.pads) {
        const L = Math.hypot(r.dir[0], r.dir[1]) || 1, ux = r.dir[0] / L, uy = r.dir[1] / L, [cx, cy] = A.regionCentre(r);
        c.save(); A.regionPath(c, r, -3); c.clip(); c.lineCap = "round"; c.lineJoin = "round";
        const off = (t * 70 * m) % 24;
        for (const [w, col] of [[6, "rgba(182,255,62,.22)"], [2, "#eaffc8"]]) {
          c.strokeStyle = col; c.lineWidth = w;
          for (let k = -6; k <= 6; k++) for (let j = -2; j <= 2; j++) { const d = k * 24 + off, x = cx + ux * d - uy * j * 30, y = cy + uy * d + ux * j * 30; c.beginPath(); c.moveTo(x - ux * 6 - uy * 7, y - uy * 6 + ux * 7); c.lineTo(x + ux * 4, y + uy * 4); c.lineTo(x - ux * 6 + uy * 7, y - uy * 6 - ux * 7); c.stroke(); }
        }
        c.restore();
      }
      for (const p of H.portals) for (const [q, k] of [[p.a, 0], [p.b, 1]]) {
        c.save(); c.translate(q[0], q[1]); c.rotate(t * 2.6 * m * (k ? -1 : 1));
        for (const [w, a] of [[5, 0.25], [1.6, 1]]) { c.globalAlpha = a; c.strokeStyle = k ? "#c9a7ff" : "#ff9be6"; c.lineWidth = w; c.beginPath(); for (let i = 0; i < 26; i++) { const ang = i * 0.5, rr = 1 + i * 0.36; i ? c.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : c.moveTo(0, 0); } c.stroke(); }
        c.restore();
      }
      for (let i = 0; i < H.bumpers.length; i++) {
        const b = H.bumpers[i], f = fx.bump[i] || 0, r = b[2] * (1 + f * 0.18);
        A.soft(c, b[0], b[1], r + 12, r + 12, P.bumper, 0.3 + f * 0.5);
        A.dot(c, b[0], b[1], r, "#140f33");
        c.strokeStyle = P.bumper; c.lineWidth = 3; c.beginPath(); c.arc(b[0], b[1], r, 0, T); c.stroke();
        c.strokeStyle = "#ffffff"; c.lineWidth = 1.2; c.beginPath(); c.arc(b[0], b[1], r * 0.5, 0, T); c.stroke();
      }
      for (const s of H.spinners) {
        const tips = A.tips(s, t); c.lineCap = "round";
        for (let k = 0; k < s.arms; k++) { c.strokeStyle = "rgba(182,255,62,.2)"; c.lineWidth = s.hw * 2 + 8; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(tips[k * 2], tips[k * 2 + 1]); c.stroke(); }
        for (let k = 0; k < s.arms; k++) { c.strokeStyle = "#b6ff3e"; c.lineWidth = s.hw * 2 - 2; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(tips[k * 2], tips[k * 2 + 1]); c.stroke(); c.strokeStyle = "#eaffc8"; c.lineWidth = 2; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(tips[k * 2], tips[k * 2 + 1]); c.stroke(); }
        A.dot(c, s.x, s.y, (s.hub || 7), "#0b0820"); c.strokeStyle = "#b6ff3e"; c.lineWidth = 2; c.beginPath(); c.arc(s.x, s.y, s.hub || 7, 0, T); c.stroke();
      }
      for (const mv of H.movers) { Physics.moverPos(mv, t); this.mover(c, mv, Physics._mx, Physics._my, P); }
    },
    mover(c, m, x, y, P) {
      const ax = x - m.hx, ay = y - m.hy, bx = x + m.hx, by = y + m.hy, r = m.r;
      const col = m.boat ? "#7dffb0" : m.car ? ["#ff4fd8", "#ffd23e", "#3ef0ff"][Math.abs(Math.round(m.a[1])) % 3] : m.penguin ? "#ffffff" : "#ff7a2e";
      A.capsule(c, ax, ay, bx, by, r + 5); c.fillStyle = A.rgba(col, 0.16); c.fill();
      A.capsule(c, ax, ay, bx, by, r); c.fillStyle = "#0b0820"; c.fill(); c.strokeStyle = col; c.lineWidth = 2.4; c.stroke();
      if (m.penguin) { const dir = Math.sign(Physics._mvx) || 1; A.dot(c, x + dir * (m.hl + r - 3), y, 2.6, "#ffd23e"); A.dot(c, x + dir * (m.hl - 2), y - 3, 1.5, "#ffffff"); }
      else { c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.strokeStyle = A.rgba(col, 0.6); c.lineWidth = 1.2; c.stroke(); }
    },
    over(c, H, P, t) {
      const m = A.motion;
      for (const d of H.deco) {
        if (d.kind === "windmill") {
          const x0 = d.x - d.w / 2, y = d.y, w = d.w, h = d.depth;
          c.fillStyle = "#07051a"; c.fillRect(x0 - 2, y - 8, w + 4, h + 4);
          c.strokeStyle = A.rgba(P.accent, 0.22); c.lineWidth = 7; c.strokeRect(x0 - 2, y - 8, w + 4, h + 4);
          c.strokeStyle = P.accent; c.lineWidth = 2; c.strokeRect(x0 - 2, y - 8, w + 4, h + 4);
          c.beginPath(); c.moveTo(d.x - d.gap / 2, y + h - 4); c.lineTo(d.x - d.gap / 2, y + h - 14); c.arc(d.x, y + h - 14, d.gap / 2, Math.PI, 0); c.lineTo(d.x + d.gap / 2, y + h - 4); c.strokeStyle = "#ffd23e"; c.lineWidth = 2; c.stroke();
          const hx = d.x, hy = y + 10, L = Math.min(46, h * 0.8);
          c.save(); c.translate(hx, hy); c.rotate(t * 0.9 * m); c.lineCap = "round";
          for (let k = 0; k < 4; k++) { c.rotate(T / 4); c.strokeStyle = "rgba(255,79,216,.25)"; c.lineWidth = 9; c.beginPath(); c.moveTo(0, 6); c.lineTo(0, L); c.stroke(); c.strokeStyle = "#ff4fd8"; c.lineWidth = 2; c.strokeRect(-6, 10, 8, L - 10); }
          c.restore(); A.dot(c, hx, hy, 4, "#ffd23e");
        } else if (d.kind === "lighthouse") {
          const { x, y } = d;
          A.dot(c, x, y, 34, "#07051a"); c.beginPath(); c.arc(x, y, 34, 0, T); c.strokeStyle = P.accent; c.lineWidth = 2.4; c.stroke();
          c.beginPath(); c.arc(x, y, 24, 0, T); c.strokeStyle = "#ff7a59"; c.lineWidth = 2; c.stroke();
          A.soft(c, x, y, 26, 26, "#fff6c8", 0.5); A.dot(c, x, y, 7, "#fff6c8");
          const a = t * 0.8 * m; c.save(); c.globalAlpha = 0.16; c.fillStyle = "#fff6c8"; c.beginPath(); c.moveTo(x, y); c.arc(x, y, 160, a, a + 0.3); c.closePath(); c.fill(); c.beginPath(); c.moveTo(x, y); c.arc(x, y, 160, a + Math.PI, a + Math.PI + 0.3); c.closePath(); c.fill(); c.restore();
        }
      }
    },
    flag(c, H, P, t, lift, n) {
      const px = H.cup[0] + 1, py = H.cup[1] - lift, top = py - 46, m = A.motion;
      c.lineCap = "round"; c.strokeStyle = "rgba(255,255,255,.2)"; c.lineWidth = 6; c.beginPath(); c.moveTo(px, py); c.lineTo(px, top); c.stroke();
      c.strokeStyle = "#ffffff"; c.lineWidth = 2; c.stroke();
      c.beginPath(); c.moveTo(px, top);
      for (let i = 0; i <= 8; i++) { const u = i / 8; c.lineTo(px + u * 30, top + 4 * u + Math.sin(t * 5 - u * 4) * 2.4 * u * m); }
      for (let i = 8; i >= 0; i--) { const u = i / 8; c.lineTo(px + u * 30, top + 20 - 6 * u + Math.sin(t * 5 - u * 4) * 2.4 * u * m); }
      c.closePath(); c.fillStyle = A.rgba(P.flag, 0.25); c.fill(); c.strokeStyle = P.flag; c.lineWidth = 2; c.stroke();
      c.fillStyle = P.flag; c.font = "400 11px Bungee, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(n), px + 12, top + 10 + Math.sin(t * 5 - 1.6) * m);
    },
    ball(c, x, y, r, seat, P, o) {
      const col = A.SEATS[seat];
      if (o.ghost) c.globalAlpha = 0.45;
      A.soft(c, x, y, r * 2.6, r * 2.6, col, o.ghost ? 0.2 : 0.4);
      const g = c.createRadialGradient(x - r * 0.3, y - r * 0.35, 0, x, y, r); g.addColorStop(0, "#ffffff"); g.addColorStop(seat ? 0.35 : 0.6, A.shade(col, seat ? 0.15 : 0.4)); g.addColorStop(1, col);
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, T); c.fill();
      Art.styles.diorama.roll(c, x, y, r, o, seat === 0 ? "#ff4fd8" : "#ffffff");
      c.globalAlpha = 1;
    },
    aim: { dot: "#3ef0ff", ring: "#3ef0ff", back: "rgba(62,240,255,.15)", hot: "#ff4fd8", line: "rgba(62,240,255,.45)", glow: true },
    trail: true,
    parts(P) {
      return { strike: [P.accent, "#ffffff"], wall: [P.tube, P.tube2], sand: [P.sandEdge, "#ffd23e"], water: ["#3ef0ff", "#ffffff"], bump: [P.bumper, "#ffffff"],
        cup: ["#ff4fd8", "#3ef0ff", "#b6ff3e", "#ffd23e"], portal: ["#ff4fd8", "#b06bff", "#ffffff"] };
    },
  };
  A.register("glow", S);
})();
