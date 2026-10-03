// App shell and the play loop. Profiles, PINs, sync, install and the version
// line come from gamekit; this file decides what each screen shows, who is
// playing, and turns engine events into sound, light and words.

const AVATARS = ["🦄", "🐰", "🦊", "🐼", "🐸", "🐯", "🦖", "🐙", "🦉", "🐧", "🐝", "🐨"];
const STYLES = [
  { id: "diorama", label: "Toy Diorama", desc: "Chunky, sunlit, tactile" },
  { id: "paper", label: "Paper Cut", desc: "Storybook card and ink" },
  { id: "glow", label: "Glow Night", desc: "Blacklight neon arcade" },
];
const MAX_PLAYERS = 4;
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const esc = (s) => GK.util.esc(String(s));
const $ = (id) => document.getElementById(id);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// ------------------------------------------------------------------- play --
const Play = {
  match: null, cfg: null, view: null, raf: 0, last: 0, paused: false, token: 0,
  sink: [], bump: [], flagLift: 0, flagUp: false, ending: false, splashes: [], hudSig: "",

  boot() {
    this.view = new View($("cv"), { topPad: 58, botPad: 8, anchor: 0.7 });
    Input.bind($("game-stage"), this.view);
    Input.canStart = () => {
      if ($("hole-card").classList.contains("show")) { this.hideHoleCard(); return false; }
      return !!(this.match && !this.paused && this.match.sim.canShoot());
    };
    Input.onAim = (a) => {
      const pw = $("power"); pw.classList.add("on", ); pw.classList.toggle("hot", a.pow > 0.85);
      pw.firstElementChild.style.width = Math.round(a.pow * 100) + "%"; pw.lastElementChild.textContent = Math.round(a.pow * 100) + "%";
      $("hint").classList.add("gone");
    };
    Input.onCancel = () => $("power").classList.remove("on");
    Input.onShoot = (ang, pow) => { $("power").classList.remove("on"); if (this.match && !this.paused) this.match.sim.shoot(ang, pow); };
    window.addEventListener("resize", () => setTimeout(() => this.view.resize(), 60));
  },

  // cfg: { mode, course, holes, players, mirror, date, title }
  start(cfg) {
    this.cfg = cfg;
    this.match = new Match(cfg);
    this.token++;
    this.paused = false;
    GK.UI.showScreen("game");
    this.view.resize();
    this.loadHole();
    Input.enabled = true;
    if (!this.raf) this.loop();
  },
  loadHole() {
    const m = this.match, def = m.hole;
    this.view.setScene(m.H, def.course, def.n, App.style);
    this.sink = []; this.bump = []; this.flagLift = 0; this.flagUp = false; this.ending = false; this.hudSig = "";
    this.splashes = m.players.map(() => 0);
    Fx.reset();
    this.showHoleCard();
    $("stamp").className = "stamp";
    $("hint").classList.toggle("gone", (Storage.getSettings().putts || 0) > 3);
    this.hud();
  },

  loop() {
    const tick = (t) => { this.raf = requestAnimationFrame(tick); this.frame(t); };
    this.raf = requestAnimationFrame(tick);
  },
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; },

  // One frame, clamped at both ends; the engine moves only in fixed steps.
  frame(t) {
    if (GK.UI.screen !== "game" || !this.match) return;
    let dt = this.last ? (t - this.last) / 1000 : 0;
    this.last = t;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(0.05, dt);
    GK.Debug.frame(dt);
    this.view.checkSize();
    const sim = this.match.sim;
    if (!this.paused && dt > 0) {
      sim.tick(dt);
      Fx.update(dt);
      for (let i = 0; i < this.bump.length; i++) if (this.bump[i]) this.bump[i] = Math.max(0, this.bump[i] - dt * 4);
      if (this.flagUp) this.flagLift = Math.min(16, this.flagLift + dt * 60);
      this.drain();
      this.hud();
    }
    const guide = this.match.players[sim.turn].helper ? { bounces: 2, maxT: 2.6 } : { bounces: 1, maxT: 1.15 };
    this.view.draw({ sim, t: sim.t, aim: Input.aim, pull: Input.pull, guide, sink: this.sink, bump: this.bump, flagLift: this.flagLift, fx: true });
  },

  // Engine events become sound, light and words.
  drain() {
    const sim = this.match.sim, st = Art.get(App.style), PC = st.parts(st.pal(this.match.hole.course)), R = !Art.motion;
    const burst = (x, y, cols, n, sp) => { const k = R ? Math.ceil(n / 3) : n; for (let i = 0; i < k; i++) Fx.burst(x, y, cols[i % cols.length], 1, sp || 120, 0.45, 2.2); };
    for (const e of sim.events) {
      switch (e.type) {
        case "shot": {
          Sfx.putt(e.pow); burst(e.x, e.y, PC.strike, 7, 70);
          const s = Storage.getSettings(); s.putts = (s.putts || 0) + 1; if (s.putts <= 5) Storage.saveSettings(s);
          $("btn-doover").hidden = true; break;
        }
        case "wall": Sfx.wall(e.v); burst(e.x, e.y, PC.wall, 4, 60); break;
        case "post": Sfx.post(e.v); burst(e.x, e.y, PC.wall, 4, 60); break;
        case "bumper": Sfx.bumper(); this.bump[e.i] = 1; burst(e.x, e.y, PC.bump, 10, 120); if (!R) Fx.addShake(2); break;
        case "spinner": Sfx.spinner(); burst(e.x, e.y, PC.wall, 5, 80); break;
        case "mover": Sfx.mover(); burst(e.x, e.y, PC.wall, 5, 80); break;
        case "portal": Sfx.portal(); burst(e.x, e.y, PC.portal, 12, 90); break;
        case "water":
          Sfx.splash(); this.splashes[e.seat]++;
          for (let i = 0; i < (R ? 4 : 14); i++) Fx.burst(e.x, e.y, PC.water[i % 2], 1, 110, 0.5, 2.4);
          this.stamp("Splash!", "+1 stroke, back you go", "over", 1400);
          break;
        case "cup": {
          this.sink[e.seat] = sim.t;
          this.flagUp = true;
          Sfx.cup(); Sfx.term(e.term.tier);
          const big = e.term.tier === "ace" || e.term.tier === "under";
          burst(this.match.H.cup[0], this.match.H.cup[1], PC.cup, big ? 30 : 16, big ? 190 : 130);
          if (big && !R) { Fx.confetti(PHYS.W, PHYS.H, PC.cup, e.term.tier === "ace" ? 110 : 60); Fx.addFlash(0.25, "#fff6df"); }
          this.stamp(e.term.word, this.match.players.length > 1 ? `${this.match.players[e.seat].name} · ${plural(e.strokes, "stroke")}` : e.term.sub, e.term.tier, 1900);
          break;
        }
        case "pickup": Sfx.pickup(); this.stamp("Picked up", `That's the most strokes on this hole: ${e.strokes}`, "over", 1700); break;
        case "doOver": Sfx.rewind(); burst(e.x, e.y, PC.portal, 10, 70); break;
        case "turn": if (e.changed && this.match.players.length > 1) this.showTurn(e.seat); break;
        case "holeOver": this.holeOver(); break;
      }
    }
    sim.events.length = 0;
  },

  hud() {
    const m = this.match, sim = m.sim, b = sim.ball, pl = m.players[sim.turn], def = m.hole;
    const sig = [m.holeIdx, sim.turn, b.strokes, b.state, sim.canDoOver(), sim.over].join("|");
    if (sig === this.hudSig) return;
    this.hudSig = sig;
    $("hud-hole").innerHTML = `<svg class="i"><use href="#ico-flag"/></svg>${this.cfg.mode === "daily" ? "Daily" : def.n}<small>par ${def.par}</small>`;
    $("hud-hole").setAttribute("aria-label", `${this.cfg.mode === "daily" ? "Daily hole" : `Hole ${def.n}`}, par ${def.par}`);
    const sp = $("hud-strokes"); const v = String(b.strokes);
    if (sp.dataset.v !== v) { sp.dataset.v = v; sp.innerHTML = `${b.strokes}<small>${b.strokes === 1 ? "stroke" : "strokes"}</small>`; sp.classList.remove("pop"); void sp.offsetWidth; sp.classList.add("pop"); }
    const pp = $("hud-player");
    pp.style.setProperty("--seat", Art.SEATS[sim.turn]);
    pp.lastElementChild.textContent = `${pl.avatar} ${pl.name}`;
    $("btn-doover").hidden = !(pl.helper && sim.canDoOver());
  },

  stamp(word, sub, tier, ms) {
    const s = $("stamp");
    s.innerHTML = `<b>${esc(word)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}`;
    s.className = "stamp show t-" + tier;
    clearTimeout(this._st); this._st = setTimeout(() => { s.className = "stamp"; }, ms);
  },
  showHoleCard() {
    const def = this.match.hole, c = $("hole-card"), daily = this.cfg.mode === "daily";
    c.innerHTML = `<span class="hc-k">${daily ? "Daily Hole" : `${esc(COURSES[def.course].name)} · Hole ${def.n}`}</span>
      <b>${esc(def.name)}</b><span class="hc-par">Par ${def.par}</span><span class="hc-tip">${esc(def.tip)}</span>`;
    c.classList.add("show");
    clearTimeout(this._hc); this._hc = setTimeout(() => this.hideHoleCard(), 2800);
  },
  hideHoleCard() { $("hole-card").classList.remove("show"); },
  showTurn(seat) {
    const pl = this.match.players[seat], c = $("turn-card");
    c.style.setProperty("--seat", Art.SEATS[seat]);
    c.innerHTML = `<i class="seat-dot"></i>${esc(pl.avatar)} ${esc(pl.name)}'s turn`;
    c.classList.remove("show"); void c.offsetWidth; c.classList.add("show");
    Sfx.turn();
    clearTimeout(this._tc); this._tc = setTimeout(() => c.classList.remove("show"), 1500);
  },

  doOver() { if (this.match && this.match.sim.doOver()) this.hudSig = ""; },

  holeOver() {
    if (this.ending) return;
    this.ending = true;
    Input.enabled = false;
    const token = this.token;
    setTimeout(() => { if (this.token === token) App.holeFinished(); }, 1500);
  },

  pause() {
    if (!this.match || this.paused || GK.UI.screen !== "game") return;
    this.paused = true;
    Input.cancel();
    const m = this.match;
    $("pause-where").textContent = this.cfg.mode === "round" ? `${COURSES[this.cfg.course].name}, hole ${m.holeIdx + 1} of 9.` : this.cfg.mode === "daily" ? "The Daily Hole." : `Practising ${m.hole.name}.`;
    GK.UI.openModal("modal-pause");
  },
  resume() {
    GK.UI.closeModal("modal-pause");
    this.paused = false; this.last = 0;
    Input.enabled = !this.ending;
  },
  quit() {
    this.token++;
    GK.UI.closeModal("modal-pause"); GK.UI.closeModal("modal-card");
    this.paused = false; Input.enabled = false; Input.cancel();
    this.match = null;
  },
};

// --------------------------------------------------------- title screen --
// The splash plays recorded rounds on real holes (js/demo.js) through the
// real engine, so the first thing anyone sees is the game itself.
const Hero = {
  view: null, sim: null, idx: 0, shots: [], k: 0, acc: 0, last: 0, raf: 0, wait: 0, sink: [],
  boot() { this.view = new View($("hero"), { topPad: 0, botPad: 0, anchor: 0.5, zoom: 1.04 }); },
  start() {
    if (this.raf) return;
    this.view.resize(); this.load(this.idx);
    const tick = (t) => { this.raf = requestAnimationFrame(tick); this.frame(t); };
    this.raf = requestAnimationFrame(tick);
  },
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; this.last = 0; },
  load(i) {
    const d = DEMO[i % DEMO.length], def = HOLES.find((h) => h.id === d.hole);
    const H = compileHole(def);
    this.sim = new HoleSim(H, [{ id: "demo" }]); this.shots = d.shots; this.k = 0; this.acc = 0; this.wait = 0; this.sink = [];
    this.view.setScene(H, def.course, def.n, App.style);
  },
  frame(t) {
    if (GK.UI.screen !== "splash") return this.stop();
    let dt = this.last ? (t - this.last) / 1000 : 0; this.last = t;
    dt = Math.max(0, Math.min(0.05, dt));
    this.view.checkSize();
    const sim = this.sim;
    this.acc += dt;
    while (this.acc >= PHYS.DT) {
      this.acc -= PHYS.DT;
      const s = this.shots[this.k];
      if (s && sim.canShoot() && sim.t >= s.t - PHYS.DT / 2) { sim.shoot(s.a, s.p); this.k++; }
      sim.step();
    }
    for (const e of sim.events) if (e.type === "cup") this.sink[0] = sim.t;
    sim.events.length = 0;
    if (sim.over) { this.wait += dt; if (this.wait > 2.4) { this.idx++; this.load(this.idx); } }
    this.view.draw({ sim, t: sim.t, sink: this.sink, flagLift: sim.over ? 14 : 0 });
  },
};

// -------------------------------------------------------------------- app --
const App = {
  profile: null, party: [], style: "diorama", lbTab: "daily",

  init() {
    const s = Storage.getSettings();
    Sfx.enabled = s.sound !== false;
    Music.on = s.music !== false;
    this.applyStyle(STYLES.some((x) => x.id === s.style) ? s.style : "diorama", true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotion = () => { Art.motion = mq.matches ? 0 : 1; document.body.classList.toggle("reduced-motion", mq.matches); };
    applyMotion(); mq.addEventListener ? mq.addEventListener("change", applyMotion) : mq.addListener && mq.addListener(applyMotion);

    GK.UI.onScreenChange = (name) => {
      if (name !== "game") { Input.enabled = false; Input.cancel(); }
      if (name === "splash") { this.refreshSplash(); Hero.start(); } else Hero.stop();
      document.body.dataset.screen = name;
    };
    GK.UI.bindSoundToggle(Storage);
    document.querySelectorAll(".btn-sound").forEach((b) => b.addEventListener("click", () => { $("set-sound").checked = Sfx.enabled; if (Sfx.enabled) Music.start(); }));
    GK.UI.bindMenuClicks();
    GK.Profiles.init({
      storage: Storage, avatars: AVATARS,
      meta: (p, prog) => {
        const n = Object.keys(prog.rounds || {}).length, aces = (prog.stats || {}).aces || 0;
        return `${n ? `${plural(n, "course")} played` : "No rounds yet"}${aces ? ` · ${plural(aces, "ace")}` : ""}`;
      },
      onEnter: (p) => this.enter(p),
      addLabel: "New Player",
    });
    GK.initPWA({ appName: "Putt Parade" });
    Play.boot(); Hero.boot();
    document.addEventListener("visibilitychange", () => { if (document.hidden) { Play.pause(); Music.stop(); } else if (Sfx.ctx) Music.start(); });
    document.addEventListener("pointerdown", () => { Sfx.init(); Music.start(); }, { capture: true });
    document.addEventListener("keydown", (e) => { if (GK.UI.screen === "game" && (e.key === "p" || e.key === "Escape")) Play.paused ? Play.resume() : Play.pause(); });
    $("set-sound").onchange = (e) => { Sfx.enabled = e.target.checked; const st = Storage.getSettings(); st.sound = Sfx.enabled; Storage.saveSettings(st); document.querySelectorAll(".btn-sound").forEach((b) => (b.textContent = Sfx.enabled ? "🔊" : "🔇")); if (Sfx.enabled) Music.start(); };
    $("set-music").onchange = (e) => { const st = Storage.getSettings(); st.music = e.target.checked; Storage.saveSettings(st); Music.setOn(e.target.checked); };
    $("set-helper").onchange = (e) => this.setHelper(this.party[0], e.target.checked);

    GK.Debug.init({ storage: Storage, title: "PUTT PARADE" })
      .action("sink current ball", () => { const s = Play.match && Play.match.sim; if (s && s.canShoot()) { const b = s.ball; b.x = s.H.cup[0]; b.y = s.H.cup[1] + 2; s.shoot(-Math.PI / 2, 0.02); } })
      .jump("hole", 36, (n) => { if (this.profile) Play.start({ mode: "hole", course: HOLES[n - 1].course, holes: [HOLES[n - 1]], players: this.players() }); });

    this.showScreen("splash");
    Storage.initFirebase().then((ok) => {
      $("sync-badge").textContent = ok ? "☁️ Family sync on" : "📴 Playing offline";
      if (!ok) return;
      if (GK.UI.screen === "profiles") GK.Profiles.renderList();
      if (GK.UI.screen === "splash") this.refreshSplash();
      if (GK.UI.screen === "club") this.showClub();
      if (GK.UI.screen === "leaderboard") this.showLeaderboard(true);
    });
    if (document.fonts) document.fonts.ready.then(() => { Thumbs.cache.clear(); if (Hero.view) Hero.view.key = ""; });
  },

  showScreen(n) { GK.UI.showScreen(n); },
  progress(id) { return Storage.getProgress(id || this.profile.id); },

  // ------------------------------------------------------------ style --
  applyStyle(id, quiet) {
    this.style = id;
    document.body.classList.remove("st-diorama", "st-paper", "st-glow");
    document.body.classList.add("st-" + id);
    document.querySelector('meta[name="theme-color"]').content = { diorama: "#2f6b3a", paper: "#f4ead8", glow: "#0b0820" }[id];
    Music.setStyle(id);
    if (quiet) return;
    const s = Storage.getSettings(); s.style = id; Storage.saveSettings(s);
    if (Play.match) Play.view.setScene(Play.match.H, Play.match.hole.course, Play.match.hole.n, id);
    if (Hero.view && Hero.view.H_) Hero.view.setScene(Hero.view.H_, Hero.view.ci, Hero.view.n, id);
    if (GK.UI.screen === "club") this.showClub();
    if (GK.UI.screen === "course") this.showCourse(this.courseIdx);
  },
  openSettings(fromPause) {
    this.settingsFromPause = !!fromPause;
    if (fromPause) GK.UI.closeModal("modal-pause");
    const s = Storage.getSettings();
    $("set-sound").checked = Sfx.enabled; $("set-music").checked = s.music !== false;
    const me = this.party[0];
    $("helper-row").hidden = !me || !!me.guest;
    if (me) { $("helper-name").textContent = me.name; $("set-helper").checked = !!me.helper; }
    const def = (Play.match && Play.match.hole) || HOLES[6];
    $("style-list").innerHTML = "";
    for (const st of STYLES) {
      const b = document.createElement("button");
      b.className = "style-card" + (st.id === this.style ? " on" : "");
      b.setAttribute("role", "radio"); b.setAttribute("aria-checked", st.id === this.style ? "true" : "false");
      b.setAttribute("aria-label", `${st.label}: ${st.desc}`);
      b.appendChild(Thumbs.el(def, def.course, 92, 120, st.id));
      b.insertAdjacentHTML("beforeend", `<span class="sc-name">${st.label}</span><span class="sc-desc">${st.desc}</span>`);
      b.onclick = () => { this.applyStyle(st.id); this.openSettings(this.settingsFromPause); };
      $("style-list").appendChild(b);
    }
    GK.UI.openModal("modal-settings");
  },
  closeSettings() {
    GK.UI.closeModal("modal-settings");
    if (this.settingsFromPause && Play.match) GK.UI.openModal("modal-pause");
  },
  howTo() { GK.UI.openModal("modal-howto"); },

  // ------------------------------------------------------------ splash --
  refreshSplash() {
    const last = GK.Profiles.lastProfile();
    const cont = $("btn-continue-as"), start = $("btn-start");
    if (last) {
      cont.hidden = false; cont.textContent = `Continue as ${last.avatar} ${last.name}`;
      cont.onclick = () => GK.Profiles.select(last);
      start.className = "btn soft"; start.textContent = "Switch player";
    } else { cont.hidden = true; start.className = "btn big primary"; start.textContent = "Play"; }
  },
  play() { GK.Profiles.renderList(); this.showScreen("profiles"); },

  enter(p) {
    this.profile = p;
    const prog = this.progress(p.id);
    // keep today's party if this player is already in it; otherwise start fresh
    const others = this.party.filter((x) => x.id !== p.id);
    this.party = [{ id: p.id, name: p.name, avatar: p.avatar, helper: !!prog.helper }].concat(others).slice(0, MAX_PLAYERS);
    this.showClub();
  },
  players() { return this.party.map((x) => ({ ...x })); },
  setHelper(pl, on) {
    if (!pl) return;
    pl.helper = on;
    if (!pl.guest) { const pr = this.progress(pl.id); pr.helper = on; Storage.saveProgress(pl.id, pr); }
    if (GK.UI.screen === "club") this.renderParty();
  },

  // --------------------------------------------------------- clubhouse --
  showClub() {
    if (!this.profile) return this.play();
    const p = this.progress();
    $("club-avatar").textContent = this.profile.avatar;
    $("club-name").textContent = this.profile.name;
    this.renderParty();
    const wrap = $("courses"); wrap.innerHTML = "";
    COURSES.forEach((c, i) => {
      const open = Progress.courseOpen(p, i), r = (p.rounds || {})[c.id];
      const b = document.createElement("button");
      b.className = "course-card panel" + (open ? "" : " locked");
      b.style.setProperty("--cc", ["#5cbf5a", "#3aa0c8", "#ff7a59", "#8fb8de"][i]);
      b.setAttribute("aria-label", `${c.name}. ${open ? (r ? `Best round ${r.best}, ${r.stars} of 3 stars` : "Not played yet") : `Locked. Finish ${COURSES[i - 1].name} to open`}`);
      b.innerHTML = `<span class="cc-art"></span><span class="cc-body">
          <span class="kicker">Course ${i + 1} · Par ${c.par}</span>
          <span class="cc-name">${esc(c.name)}</span>
          <span class="cc-blurb">${esc(c.blurb)}</span>
          <span class="cc-foot">${open ? `${this.starsHtml(r ? r.stars : 0)}<span class="cc-best">${r ? `Best ${r.best} (${fmtToPar(r.best - c.par)})` : "Not played yet"}</span>` : `<span class="cc-lock"><svg class="i"><use href="#ico-lock"/></svg>Finish ${esc(COURSES[i - 1].name)} to open</span>`}</span>
        </span>`;
      b.querySelector(".cc-art").appendChild(Thumbs.el(c.holes[0].id === "meadow-1" ? c.holes[6] : c.holes[4], i, 132, 150, this.style));
      b.onclick = () => (open ? this.showCourse(i) : (Sfx.pickup(), GK.UI.toast(`Finish ${COURSES[i - 1].name} first`)));
      wrap.appendChild(b);
    });
    this.renderDaily();
    this.showScreen("club");
  },
  starsHtml(n) { return `<span class="stars" aria-hidden="true">${[0, 1, 2].map((i) => `<svg class="i${i < n ? " on" : ""}"><use href="#ico-star"/></svg>`).join("")}</span>`; },
  renderParty() {
    const list = $("party-list"); list.innerHTML = "";
    this.party.forEach((pl, i) => {
      const d = document.createElement("div");
      d.className = "party-chip"; d.style.setProperty("--seat", Art.SEATS[i]);
      d.innerHTML = `<i class="seat-dot" title="Ball colour"></i><span class="pc-name">${esc(pl.avatar)} ${esc(pl.name)}</span>
        <button class="pc-helper${pl.helper ? " on" : ""}" aria-pressed="${pl.helper ? "true" : "false"}" aria-label="Helper for ${esc(pl.name)}">Helper</button>
        ${i ? `<button class="pc-x" aria-label="Remove ${esc(pl.name)}">×</button>` : ""}`;
      d.querySelector(".pc-helper").onclick = () => this.setHelper(pl, !pl.helper);
      const x = d.querySelector(".pc-x"); if (x) x.onclick = () => { this.party.splice(i, 1); this.renderParty(); };
      list.appendChild(d);
    });
    $("btn-add-player").hidden = this.party.length >= MAX_PLAYERS;
  },
  openAddPlayer() {
    const list = $("add-list"); list.innerHTML = "";
    const inParty = new Set(this.party.map((x) => x.id));
    for (const p of Storage.getProfiles()) {
      if (inParty.has(p.id)) continue;
      const b = document.createElement("button"); b.className = "add-row";
      b.innerHTML = `<span class="ar-av">${p.avatar}</span><span>${esc(p.name)}</span>${p.pin ? '<svg class="i"><use href="#ico-lock"/></svg>' : ""}`;
      const add = () => { const pr = this.progress(p.id); this.party.push({ id: p.id, name: p.name, avatar: p.avatar, helper: !!pr.helper }); GK.UI.closeModal("modal-add"); this.renderParty(); };
      b.onclick = () => (p.pin ? (GK.UI.closeModal("modal-add"), GK.Profiles.openPin({ title: `${p.avatar} ${esc(p.name)} is locked`, sub: "Enter the 4-digit PIN", mode: "verify", profile: p, onSuccess: add })) : add());
      list.appendChild(b);
    }
    const g = document.createElement("button"); g.className = "add-row guest";
    const n = this.party.filter((x) => x.guest).length + 1;
    g.innerHTML = `<span class="ar-av">🙂</span><span>Guest ${n}<small>Scores aren't saved</small></span>`;
    g.onclick = () => { this.party.push({ id: "guest-" + Date.now(), name: `Guest ${n}`, avatar: "🙂", helper: false, guest: true }); GK.UI.closeModal("modal-add"); this.renderParty(); };
    list.appendChild(g);
    GK.UI.openModal("modal-add");
  },
  dailyDef() { const d = dailyPick(todayKey(), HOLES.length); return { def: HOLES[d.index], mirror: d.mirror }; },
  renderDaily() {
    const { def, mirror } = this.dailyDef(), today = todayKey();
    const p = this.progress(), mine = p.dailyDate === today ? p.dailyBest : 0;
    const rows = Storage.profilesWithProgress().filter((r) => r.progress.dailyDate === today && r.progress.dailyBest > 0).sort((a, b) => a.progress.dailyBest - b.progress.dailyBest);
    const lead = rows[0];
    const card = $("daily-card");
    card.innerHTML = `<span class="dc-art"></span><span class="dc-body"><span class="kicker">Daily Hole · ${new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" })}</span>
      <span class="dc-name">${esc(def.name)}${mirror ? " (mirrored)" : ""}</span>
      <span class="dc-note">${mine ? `Your best today: ${plural(mine, "stroke")}` : "A new hole every day, the same for everyone"}${lead ? ` · Leader: ${esc(lead.avatar)} ${esc(lead.name)} (${lead.progress.dailyBest})` : ""}</span>
      <span class="dc-go">Play today's hole</span></span>`;
    card.querySelector(".dc-art").appendChild(Thumbs.el(mirror ? Object.assign(mirrorDef(def), { id: def.id + "-m", n: def.n, course: def.course }) : def, def.course, 96, 110, this.style));
  },

  // ------------------------------------------------------------ course --
  showCourse(i) {
    this.courseIdx = i;
    const c = COURSES[i], p = this.progress(), r = (p.rounds || {})[c.id];
    $("course-kicker").textContent = `Course ${i + 1} of 4`;
    $("course-title").textContent = c.name;
    $("course-hero").innerHTML = `<span class="ch-body"><span class="ch-blurb">${esc(c.blurb)}</span>
      <span class="ch-stats"><span><b>9</b> holes</span><span><b>${c.par}</b> par</span><span><b>${r ? r.best : "–"}</b> your best</span></span>
      <span class="ch-stars">${this.starsHtml(r ? r.stars : 0)}<small>3 stars: ${c.par + c.bands[1]} or less · 2 stars: ${c.par + c.bands[0]} or less</small></span></span>`;
    const rb = $("btn-round");
    rb.textContent = this.party.length > 1 ? `Play the round · ${this.party.length} players` : "Play the round · 9 holes";
    rb.onclick = () => this.startRound(i);
    const wrap = $("holes"); wrap.innerHTML = "";
    c.holes.forEach((h) => {
      const best = (p.holes || {})[h.id] || 0;
      const b = document.createElement("button");
      b.className = "hole-tile panel";
      b.setAttribute("aria-label", `Hole ${h.n}, ${h.name}, par ${h.par}${best ? `, your best ${best}` : ""}. Practise it`);
      b.innerHTML = `<span class="ht-art"></span><span class="ht-n">${h.n}</span><span class="ht-name">${esc(h.name)}</span>
        <span class="ht-meta">Par ${h.par}${best ? ` · <b class="${best < h.par ? "u" : best === h.par ? "e" : "o"}">Best ${best}</b>` : ""}</span>`;
      b.querySelector(".ht-art").appendChild(Thumbs.el(h, i, 104, 128, this.style));
      b.onclick = () => this.startHole(h);
      wrap.appendChild(b);
    });
    this.showScreen("course");
  },

  startRound(i) { Play.start({ mode: "round", course: i, holes: COURSES[i].holes, players: this.players() }); },
  startHole(h) { Play.start({ mode: "hole", course: h.course, holes: [h], players: this.players() }); },
  startDaily() {
    const { def, mirror } = this.dailyDef();
    Play.start({ mode: "daily", course: def.course, holes: [def], players: this.players(), mirror, date: todayKey() });
  },

  // ----------------------------------------------------- after a hole --
  holeFinished() {
    const m = Play.match, cfg = Play.cfg, def = m.hole;
    const more = m.recordHole();
    // save each real player's hole (guests are never saved)
    m.players.forEach((pl, seat) => {
      if (pl.guest) return;
      const pr = this.progress(pl.id), strokes = m.card[seat][m.holeIdx];
      Progress.recordHole(pr, cfg.mirror ? def.id + "~m" : def.id, strokes, { underPar: strokes < def.par, splashes: Play.splashes[seat] });
      if (cfg.mode === "daily") Progress.recordDaily(pr, cfg.date, strokes);
      Storage.saveProgress(pl.id, pr);
    });
    const title = $("mc-title"), next = $("mc-next"), close = $("mc-close");
    close.hidden = true;
    $("mc-card").innerHTML = this.cardHtml(m, m.holeIdx);
    if (cfg.mode === "round") {
      $("mc-kicker").textContent = `${COURSES[cfg.course].name} · after hole ${m.holeIdx + 1}`;
      title.textContent = this.leaderLine(m);
      next.textContent = more ? `Hole ${m.holeIdx + 2}: ${m.cfg.holes[m.holeIdx + 1].name}` : "See the results";
      next.onclick = () => { GK.UI.closeModal("modal-card"); if (more) { m.nextHole(); Play.loadHole(); Input.enabled = true; } else this.showResults(); };
    } else {
      const s = m.card[0][m.holeIdx];
      $("mc-kicker").textContent = cfg.mode === "daily" ? "Daily Hole" : `Practice · ${def.name}`;
      title.textContent = m.players.length > 1 ? this.leaderLine(m) : termFor(s, def.par).word;
      next.textContent = "Play it again";
      next.onclick = () => { GK.UI.closeModal("modal-card"); m.card.forEach((r) => (r[0] = null)); m.startHole(); Play.loadHole(); Input.enabled = true; };
      close.hidden = false; close.textContent = cfg.mode === "daily" ? "Back to the clubhouse" : "Back to the course";
      close.onclick = () => { GK.UI.closeModal("modal-card"); Play.quit(); cfg.mode === "daily" ? this.showClub() : this.showCourse(cfg.course); };
    }
    GK.UI.openModal("modal-card");
  },
  leaderLine(m) {
    if (m.players.length === 1) { const d = m.toPar(0); return d === 0 ? "Level with par" : d < 0 ? `${-d} under par` : `${d} over par`; }
    const st = m.standings();
    if (st[0].total === st[1].total) return "All square at the top";
    return `${st[0].player.name} leads`;
  },
  showCardFromPause() {
    const m = Play.match; if (!m) return;
    GK.UI.closeModal("modal-pause");
    $("mc-kicker").textContent = Play.cfg.mode === "round" ? COURSES[Play.cfg.course].name : "Scorecard";
    $("mc-title").textContent = "Scorecard so far";
    $("mc-card").innerHTML = this.cardHtml(m, m.holeIdx - 1);
    $("mc-next").textContent = "Keep playing";
    $("mc-next").onclick = () => { GK.UI.closeModal("modal-card"); Play.resume(); };
    $("mc-close").hidden = true;
    GK.UI.openModal("modal-card");
  },

  // The scorecard: a real mini-golf card, holes across, players down.
  cardHtml(m, upTo) {
    const holes = m.cfg.holes, single = holes.length === 1;
    const cls = (v, par) => (v == null ? "" : v === 1 ? "ace" : v < par ? "u" : v === par ? "e" : "o");
    let h = `<table class="card"><thead><tr><th scope="col">${single ? "" : "Hole"}</th>`;
    holes.forEach((x, i) => (h += `<th scope="col"${i === upTo ? ' class="now"' : ""}>${single ? "Strokes" : x.n}</th>`));
    if (!single) h += `<th scope="col">Tot</th><th scope="col">±</th>`;
    h += `</tr></thead><tbody><tr class="par"><th scope="row">Par</th>`;
    holes.forEach((x) => (h += `<td>${x.par}</td>`));
    if (!single) h += `<td>${m.par()}</td><td></td>`;
    h += `</tr>`;
    m.players.forEach((pl, p) => {
      h += `<tr><th scope="row"><i class="seat-dot" style="--seat:${Art.SEATS[p]}"></i>${esc(pl.avatar)} ${esc(pl.name)}</th>`;
      m.card[p].forEach((v, i) => (h += `<td class="${cls(v, holes[i].par)}">${v == null ? "" : v}</td>`));
      if (!single) h += `<td class="tot">${m.played(p) ? m.total(p) : ""}</td><td class="tp">${m.played(p) ? fmtToPar(m.toPar(p)) : ""}</td>`;
      h += `</tr>`;
    });
    return h + `</tbody></table>`;
  },

  // ----------------------------------------------------- end of round --
  showResults() {
    const m = Play.match, cfg = Play.cfg, c = COURSES[cfg.course];
    const st = m.standings(), solo = m.players.length === 1;
    const lines = [];
    m.players.forEach((pl, seat) => {
      const total = m.total(seat), stars = roundStars(total, c.par, c.bands);
      if (pl.guest) return;
      const pr = this.progress(pl.id), prev = (pr.rounds || {})[c.id];
      Progress.recordRound(pr, c.id, total, stars, pl.helper);
      Storage.saveProgress(pl.id, pr);
      if (!prev || total < prev.best) lines.push(`${pl.name}: new best on ${c.name}!`);
    });
    const meStars = roundStars(m.total(0), c.par, c.bands);
    $("res-kicker").textContent = `${c.name} · round complete`;
    $("res-title").textContent = solo ? (m.toPar(0) < 0 ? "Under par!" : m.toPar(0) === 0 ? "Right on par" : "Round complete") : st[0].total === st[1].total ? "It's a tie!" : `${st[0].player.name} wins!`;
    $("res-stars").innerHTML = solo ? this.starsHtml(meStars) : "";
    $("res-big").innerHTML = solo ? `<b>${m.total(0)}</b><span>strokes · ${fmtToPar(m.toPar(0))}</span>`
      : `<ol class="standings">${st.map((r, i) => `<li><span class="sd-rank">${i + 1}</span><i class="seat-dot" style="--seat:${Art.SEATS[r.seat]}"></i><span class="sd-name">${esc(r.player.avatar)} ${esc(r.player.name)}</span>${this.starsHtml(roundStars(r.total, c.par, c.bands))}<b>${r.total}</b><small>${fmtToPar(r.toPar)}</small></li>`).join("")}</ol>`;
    $("res-card").innerHTML = this.cardHtml(m, -1);
    const nextIdx = cfg.course + 1, p = this.progress();
    $("res-note").textContent = lines.join(" ") || (meStars < 3 ? `${meStars === 1 ? `${c.par + c.bands[0]} or fewer` : `${c.par + c.bands[1]} or fewer`} earns another star.` : "Three stars. Brilliant putting!");
    const next = $("res-next");
    if (nextIdx < COURSES.length && Progress.courseOpen(p, nextIdx)) { next.textContent = `Next: ${COURSES[nextIdx].name}`; next.onclick = () => { Play.quit(); this.showCourse(nextIdx); }; }
    else { next.textContent = "Play this course again"; next.onclick = () => { Play.quit(); this.startRound(cfg.course); }; }
    $("res-again").textContent = "Pick a hole"; $("res-again").onclick = () => { Play.quit(); this.showCourse(cfg.course); };
    $("res-club").onclick = () => { Play.quit(); this.showClub(); };
    this.showScreen("results");
    if (solo) for (let i = 0; i < meStars; i++) setTimeout(() => Sfx.star(i + 1), 400 + i * 260);
    else Sfx.fanfare();
  },

  restartHole() {
    const m = Play.match; if (!m) return;
    GK.UI.closeModal("modal-pause");
    Play.token++; m.startHole(); Play.loadHole(); Play.paused = false; Play.last = 0; Input.enabled = true;
  },
  exitGame() { const mode = Play.cfg && Play.cfg.mode, ci = Play.cfg && Play.cfg.course; Play.quit(); mode === "round" || mode === "hole" ? this.showCourse(ci) : this.showClub(); },

  // ------------------------------------------------------- leaderboard --
  showLeaderboard(silent) {
    const tabs = [["daily", "Daily"]].concat(COURSES.map((c) => [c.id, c.name])).concat([["aces", "Aces"]]);
    $("lb-tabs").replaceChildren(...tabs.map(([id, label]) => {
      const b = document.createElement("button");
      b.className = "lb-tab" + (id === this.lbTab ? " active" : ""); b.textContent = label;
      b.setAttribute("role", "tab"); b.setAttribute("aria-selected", id === this.lbTab ? "true" : "false");
      b.onclick = () => { this.lbTab = id; this.showLeaderboard(true); };
      return b;
    }));
    const tab = this.lbTab, today = todayKey(), c = COURSES.find((x) => x.id === tab);
    const val = (r) => {
      const p = r.progress || {};
      if (tab === "daily") return p.dailyDate === today ? p.dailyBest || 0 : 0;
      if (tab === "aces") return (p.stats || {}).aces || 0;
      return ((p.rounds || {})[tab] || {}).best || 0;
    };
    $("lb-note").textContent = tab === "daily" ? `Today's hole: ${this.dailyDef().def.name}. Fewest strokes wins.` : tab === "aces" ? "Holes in one, on any hole, ever." : `Best 9-hole round on ${c.name} (par ${c.par}).`;
    GK.Profiles.renderLeaderboard("lb-rows", {
      cols: (r) => {
        const v = val(r);
        if (!v) return `<span class="lb-stat dim">${tab === "daily" ? "Not played today" : tab === "aces" ? "None yet" : "No round yet"}</span>`;
        if (tab === "aces") return `<span class="lb-stat"><b>${v}</b></span>`;
        if (tab === "daily") return `<span class="lb-stat"><b>${v}</b> ${v === 1 ? "stroke" : "strokes"}</span>`;
        const rd = r.progress.rounds[tab];
        return `<span class="lb-stat">${rd.helper ? '<i class="tag">Helper</i>' : ""}${this.starsHtml(rd.stars)}<b>${v}</b> <small>${fmtToPar(v - c.par)}</small></span>`;
      },
      sort: (a, b) => { const x = val(a), y = val(b); if (tab === "aces") return y - x; return (x || 999) - (y || 999); },
      meId: this.profile && this.profile.id,
      empty: "No players yet. Tap Play!",
    });
    this.showScreen("leaderboard");
  },
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => App.init());
else App.init();
