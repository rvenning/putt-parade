// Aiming: press anywhere on the green and pull back like a catapult. The pull
// sets direction (opposite the pull) and power (its length); letting go putts.
// Sliding back near where you pressed cancels. Pointer events cover mouse,
// pen and touch; a raw touchmove backs them up on stingy iOS builds.
//
// Nothing here touches the engine directly: it reports an aim to Play, which
// decides whether a shot is allowed.

const PULL_FULL = 150;      // logical px of pull for a full-power putt
const PULL_DEAD = 0.07;     // below this fraction it is a cancel, not a putt

const Input = {
  view: null, stage: null, enabled: false,
  press: null,          // { id, x, y } in client px
  aim: null,            // { ang, pow } while pulling
  pull: null,           // [x0, y0, x1, y1] logical, for the band
  lastTick: 0,
  onAim: null, onShoot: null, onCancel: null, canStart: () => false,

  bind(stage, view) {
    this.stage = stage; this.view = view;
    stage.addEventListener("pointerdown", (e) => this.down(e));
    stage.addEventListener("pointermove", (e) => this.move(e.pointerId, e.clientX, e.clientY, e), { passive: false });
    stage.addEventListener("pointerup", (e) => this.up(e.pointerId));
    stage.addEventListener("pointercancel", () => this.cancel());
    stage.addEventListener("touchmove", (e) => { if (this.press) { e.preventDefault(); const t = e.touches[0]; if (t) this.move(this.press.id, t.clientX, t.clientY); } }, { passive: false });
    document.addEventListener("gesturestart", (e) => e.preventDefault());
    document.addEventListener("gesturechange", (e) => e.preventDefault());
  },

  down(e) {
    if (!this.enabled || this.press || e.target.closest("button")) return;
    if (!this.canStart()) return;
    e.preventDefault();
    this.press = { id: e.pointerId, x: e.clientX, y: e.clientY };
    this.aim = null; this.pull = null;
    try { this.stage.setPointerCapture(e.pointerId); } catch (_) { /* synthetic or stale pointer */ }
  },
  move(id, x, y, e) {
    if (!this.press || id !== this.press.id) return;
    if (e) e.preventDefault();
    const v = this.view, dx = this.press.x - x, dy = this.press.y - y;
    const len = Math.hypot(dx, dy) / v.s, pow = Math.min(1, len / PULL_FULL);
    const [x0, y0] = v.toLogical(this.press.x, this.press.y), [x1, y1] = v.toLogical(x, y);
    this.pull = [x0, y0, x1, y1];
    if (pow < PULL_DEAD) { if (this.aim) { this.aim = null; this.onCancel && this.onCancel(); } return; }
    this.aim = { ang: Math.atan2(dy, dx), pow };
    const tick = Math.floor(pow * 10);
    if (tick !== this.lastTick) { this.lastTick = tick; Sfx.aimTick(pow); }
    this.onAim && this.onAim(this.aim);
  },
  up(id) {
    if (!this.press || id !== this.press.id) return;
    const aim = this.aim;
    this.press = null; this.aim = null; this.pull = null; this.lastTick = 0;
    if (aim) this.onShoot && this.onShoot(aim.ang, aim.pow);
    else this.onCancel && this.onCancel();
  },
  cancel() { this.press = null; this.aim = null; this.pull = null; this.onCancel && this.onCancel(); },
};
