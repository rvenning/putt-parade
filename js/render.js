// Rendering: a View draws one hole into one canvas — the game, the title
// screen's demo and the menu thumbnails all use it. render.js decides WHEN and
// WHERE (the camera, the order of layers, the aim guide, the juice); the art
// style decides HOW each thing looks.
//
// The field is a fixed 400×700. The camera fits it to the stage, anchored a
// little low so the tee sits near the thumb, and the style paints the
// surround out to the edges so there is never a letterbox.

const Fx = GK.Fx.configure({ grav: 0, poolCap: 420, shakeMax: 7, shakeDecay: 26, shape: "circle", burstSpeed: 120, burstSize: 2.2, textSize: 14, textDy: -26, textCap: 12, font: "'Nunito', system-ui, sans-serif" });

class View {
  constructor(cv, opts) {
    this.cv = cv; this.ctx = cv.getContext("2d");
    this.o = Object.assign({ topPad: 0, botPad: 0, anchor: 0.55, zoom: 1 }, opts);
    this.W = 0; this.H = 0; this.s = 1; this.ox = 0; this.oy = 0; this.dpr = 1;
    this.base = null; this.key = "";
    this.H_ = null; this.ci = 0; this.n = 1; this.style = "diorama";
    this.trail = [];
  }
  resize() {
    const r = this.cv.getBoundingClientRect();
    if (r.width < 50 || r.height < 50) return false;
    this.dpr = Math.min(2.5, window.devicePixelRatio || 1);
    this.W = r.width; this.H = r.height;
    this.cv.width = Math.round(r.width * this.dpr); this.cv.height = Math.round(r.height * this.dpr);
    const avail = this.H - this.o.topPad - this.o.botPad;
    this.s = Math.min(this.W / PHYS.W, avail / PHYS.H) * this.o.zoom;
    this.ox = (this.W - PHYS.W * this.s) / 2;
    this.oy = this.o.topPad + (avail - PHYS.H * this.s) * this.o.anchor;
    this.key = "";
    return true;
  }
  // Notice the canvas changing size without a resize event (fonts landing,
  // the HUD wrapping, the iPad settling its toolbars).
  checkSize() {
    const r = this.cv.getBoundingClientRect();
    if (r.width > 50 && r.height > 50 && (Math.abs(r.width - this.W) > 1 || Math.abs(r.height - this.H) > 1)) this.resize();
  }
  setScene(H, ci, n, style) { this.H_ = H; this.ci = ci; this.n = n; this.style = style; this.key = ""; this.trail = []; }
  box() { return { l: -this.ox / this.s, t: -this.oy / this.s, r: (this.W - this.ox) / this.s, b: (this.H - this.oy) / this.s }; }
  toLogical(cx, cy) { const r = this.cv.getBoundingClientRect(); return [(cx - r.left - this.ox) / this.s, (cy - r.top - this.oy) / this.s]; }
  ensureBase() {
    const key = this.style + "|" + (this.H_ && this.H_.id) + "|" + this.cv.width + "x" + this.cv.height + "|" + this.ox.toFixed(1) + "," + this.oy.toFixed(1);
    if (this.key === key && this.base) return;
    this.key = key;
    const b = this.base || document.createElement("canvas");
    b.width = this.cv.width; b.height = this.cv.height;
    const c = b.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, b.width, b.height);
    c.setTransform(this.dpr * this.s, 0, 0, this.dpr * this.s, this.dpr * this.ox, this.dpr * this.oy);
    const st = Art.get(this.style);
    st.bakeBase(c, this.H_, st.pal(this.ci), this.box());
    this.base = b;
  }

  // One frame. `S` is what to draw: { sim, t, aim, guide, sink, bump, showFlag }
  draw(S) {
    if (!this.H_ || !this.W) return;
    this.ensureBase();
    const c = this.ctx, st = Art.get(this.style), P = st.pal(this.ci), H = this.H_;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.cv.width, this.cv.height);
    const [shx, shy] = S.fx ? Fx.shakeOffset() : [0, 0];
    c.setTransform(1, 0, 0, 1, shx * this.dpr * this.s, shy * this.dpr * this.s);
    c.drawImage(this.base, 0, 0);
    c.setTransform(this.dpr * this.s, 0, 0, this.dpr * this.s, this.dpr * (this.ox + shx * this.s), this.dpr * (this.oy + shy * this.s));
    st.dyn(c, H, P, S.t, { bump: S.bump || [] });

    const sim = S.sim;
    if (sim) {
      // the waiting player's ball gets a soft halo so it is easy to find
      const cur = sim.ball;
      if (!sim.over && cur.state === "ready" && !S.aim) {
        const k = 0.5 + 0.5 * Math.sin(S.t * 4 * Art.motion);
        Art.soft(c, cur.x, cur.y, 20 + k * 4, 20 + k * 4, Art.SEATS[sim.turn], 0.18 + k * 0.1);
        c.lineWidth = 2.5; c.strokeStyle = "rgba(0,0,0,.25)"; c.beginPath(); c.arc(cur.x, cur.y + 1, 13 + k * 2.5, 0, Art.TAU); c.stroke();
        c.strokeStyle = Art.SEATS[sim.turn]; c.beginPath(); c.arc(cur.x, cur.y, 13 + k * 2.5, 0, Art.TAU); c.stroke();
      }
      // trail of the moving ball
      if (cur.state === "moving") { this.trail.push(cur.x, cur.y); if (this.trail.length > 28) this.trail.splice(0, 2); }
      else if (this.trail.length) this.trail.splice(0, 2);
      if (this.trail.length > 3) {
        c.lineCap = "round"; c.lineJoin = "round";
        const n = this.trail.length / 2, glow = !!st.trail;
        for (let i = 1; i < n; i++) {
          const a = i / n; c.globalAlpha = a * (glow ? 0.8 : 0.28);
          c.strokeStyle = glow ? Art.SEATS[sim.turn] : "#ffffff"; c.lineWidth = PHYS.R * 2 * a * (glow ? 0.85 : 0.7);
          c.beginPath(); c.moveTo(this.trail[i * 2 - 2], this.trail[i * 2 - 1]); c.lineTo(this.trail[i * 2], this.trail[i * 2 + 1]); c.stroke();
        }
        c.globalAlpha = 1;
      }
      // everyone else's ball first (ghosts), then whoever is playing
      sim.balls.forEach((b, i) => { if (i !== sim.turn) this.drawBall(c, st, P, b, i, S, true); });
      this.drawBall(c, st, P, cur, sim.turn, S, false);
    }
    st.over(c, H, P, S.t);
    const lift = S.flagLift || 0;
    st.flag(c, H, P, S.t, lift, this.n);
    if (S.aim && sim) this.drawAim(c, st, sim, S);
    if (S.fx) { Fx.render(c); }
    if (S.fx && Fx.flash > 0) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = Fx.flash; c.fillStyle = Fx.flashColor; c.fillRect(0, 0, this.cv.width, this.cv.height); c.globalAlpha = 1; }
  }

  drawBall(c, st, P, b, seat, S, ghost) {
    if (b.state === "in") {
      const k = S.sink && S.sink[seat] != null ? Math.min(1, (S.t - S.sink[seat]) / 0.38) : 1;
      if (k >= 1) return;
      const x = b.x, y = b.y;
      st.ball(c, x, y, PHYS.R * (1 - k * 0.6), seat, P, { sinking: true, ghost });
      return;
    }
    if (b.state === "out") return;
    st.ball(c, b.x, b.y, PHYS.R, seat, P, { vx: b.vx, vy: b.vy, rolled: b.rolled, ghost: ghost && b.state !== "moving" });
  }

  // The aiming guide: dots along the REAL path (simulated with the engine) up
  // to the first bounce — the second with the Helper — then a power ring and
  // an arrow on the ball.
  drawAim(c, st, sim, S) {
    const A = st.aim, { ang, pow } = S.aim, b = sim.ball;
    const path = [];
    simulateShot(sim.H, b.x, b.y, ang, pow, sim.t, { path, every: 7, stopAtBounce: S.guide.bounces, maxT: S.guide.maxT });
    const n = path.length / 2;
    for (let i = 0; i < n; i++) {
      const a = 1 - i / (n + 3);
      if (A.glow) Art.dot(c, path[i * 2], path[i * 2 + 1], 4.5, A.dot, a * 0.2);
      Art.dot(c, path[i * 2], path[i * 2 + 1], 2.1 + (1 - a) * 0.6, A.dot, a);
    }
    c.lineCap = "round";
    c.strokeStyle = A.back; c.lineWidth = 5; c.beginPath(); c.arc(b.x, b.y, 19, 0, Art.TAU); c.stroke();
    const hot = pow > 0.85;
    c.strokeStyle = hot ? A.hot : A.ring; c.lineWidth = 5; c.beginPath(); c.arc(b.x, b.y, 19, -Math.PI / 2, -Math.PI / 2 + pow * Art.TAU); c.stroke();
    const ax = b.x + Math.cos(ang) * 30, ay = b.y + Math.sin(ang) * 30;
    c.fillStyle = hot ? A.hot : A.ring; c.beginPath(); c.moveTo(ax + Math.cos(ang) * 9, ay + Math.sin(ang) * 9);
    c.lineTo(ax + Math.cos(ang + 2.4) * 7.5, ay + Math.sin(ang + 2.4) * 7.5); c.lineTo(ax + Math.cos(ang - 2.4) * 7.5, ay + Math.sin(ang - 2.4) * 7.5); c.fill();
    // the pull itself: a faint band from where you pressed to where you are
    if (S.pull) { c.strokeStyle = A.line; c.lineWidth = 2; c.setLineDash([5, 6]); c.beginPath(); c.moveTo(S.pull[0], S.pull[1]); c.lineTo(S.pull[2], S.pull[3]); c.stroke(); c.setLineDash([]); Art.dot(c, S.pull[0], S.pull[1], 4, A.line); }
  }
}

// Static snapshots for the menus: a hole painted in the current style, zoomed
// to its green. Cached per style, hole and size.
const Thumbs = {
  cache: new Map(),
  get(def, ci, w, h, style) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const key = style + "|" + def.id + "|" + w + "x" + h + "|" + dpr;
    let cv = this.cache.get(key);
    if (cv) return cv;
    if (this.cache.size > 80) this.cache.clear();
    const H = compileHole(def);
    cv = document.createElement("canvas");
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const xs = def.green.map((p) => p[0]), ys = def.green.map((p) => p[1]);
    const gx0 = Math.min(...xs) - 26, gx1 = Math.max(...xs) + 26, gy0 = Math.min(...ys) - 26, gy1 = Math.max(...ys) + 26;
    const s = Math.min(w / (gx1 - gx0), h / (gy1 - gy0));
    const ox = (w - (gx1 - gx0) * s) / 2 - gx0 * s, oy = (h - (gy1 - gy0) * s) / 2 - gy0 * s;
    const c = cv.getContext("2d");
    c.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
    const st = Art.get(style), P = st.pal(ci);
    st.bakeBase(c, H, P, { l: -ox / s, t: -oy / s, r: (w - ox) / s, b: (h - oy) / s });
    st.dyn(c, H, P, 1.3, { bump: [] });
    st.over(c, H, P, 1.3);
    st.flag(c, H, P, 0.4, 0, def.n);
    st.ball(c, H.tee[0], H.tee[1], PHYS.R, 0, P, {});
    this.cache.set(key, cv);
    return cv;
  },
  // as a fresh <canvas> element sized by CSS
  el(def, ci, w, h, style) {
    const src = this.get(def, ci, w, h, style), cv = document.createElement("canvas");
    cv.width = src.width; cv.height = src.height; cv.getContext("2d").drawImage(src, 0, 0);
    return cv;
  },
};
