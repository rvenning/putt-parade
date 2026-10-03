// Persistence — gamekit storage configured for Putt Parade.
// putt_* localStorage keys, "puttparade" Firestore collection.
//
// Golf scores go DOWN as you get better, so "keep the best" means the lower of
// two scores here, never max(). Everything else saved is a count that only
// grows. The daily pair (date, best) moves together: a score belongs to its day.
// blank/merge are named so tests/storage.test.js can call the merge, the one
// function here that could destroy a save.

const STAT_KEYS = ["strokes", "holes", "rounds", "aces", "birdies", "splashes", "matches"];

const lowBest = (a, b) => (a > 0 && b > 0 ? Math.min(a, b) : a > 0 ? a : b > 0 ? b : 0);

const PROGRESS = {
  blank: () => ({
    holes: {},           // { [holeId]: best strokes on that hole, ever }
    rounds: {},          // { [courseId]: { best: lowest 9-hole total, stars, helper } }
    dailyDate: "", dailyBest: 0, dailyDone: 0,
    stats: {},           // lifetime counters, STAT_KEYS
    helper: null,        // this player's Helper choice (null = never asked)
    updated: 0,
  }),

  merge: (a, b) => {
    const holes = { ...(a.holes || {}) };
    for (const [k, v] of Object.entries(b.holes || {})) holes[k] = lowBest(holes[k] || 0, v || 0);
    const rounds = { ...(a.rounds || {}) };
    for (const [k, r] of Object.entries(b.rounds || {})) {
      const c = rounds[k];
      if (!c) { rounds[k] = r; continue; }
      const best = lowBest(c.best || 0, r.best || 0);
      // the helper flag travels with whichever round is the best one
      const helper = best === (r.best || 0) && best !== (c.best || 0) ? !!r.helper : best === (c.best || 0) && best !== (r.best || 0) ? !!c.helper : !!(c.helper && r.helper);
      rounds[k] = { best, stars: Math.max(c.stars || 0, r.stars || 0), helper };
    }
    const stats = { ...(a.stats || {}) };
    for (const [k, v] of Object.entries(b.stats || {})) stats[k] = Math.max(stats[k] || 0, v || 0);
    const da = a.dailyDate || "", db = b.dailyDate || "";
    const dailyBest = db > da ? b.dailyBest || 0 : da > db ? a.dailyBest || 0 : lowBest(a.dailyBest || 0, b.dailyBest || 0);
    const newer = (b.updated || 0) >= (a.updated || 0) ? b : a;
    return {
      ...a, ...b,
      holes, rounds, stats,
      dailyDate: db > da ? db : da, dailyBest,
      dailyDone: Math.max(a.dailyDone || 0, b.dailyDone || 0),
      helper: newer.helper != null ? newer.helper : a.helper != null ? a.helper : b.helper != null ? b.helper : null,
      updated: Math.max(a.updated || 0, b.updated || 0),
    };
  },
};

// Pure progression rules, shared by the menus and the tests.
const Progress = {
  courseOpen(p, i) { return i === 0 || !!(p.rounds && p.rounds[COURSES[i - 1].id]); },
  totalStars(p) { return Object.values(p.rounds || {}).reduce((s, r) => s + (r.stars || 0), 0); },
  coursesOpen(p) { let n = 0; COURSES.forEach((c, i) => { if (this.courseOpen(p, i)) n = i + 1; }); return n; },

  // Fold one player's finished hole into their progress (returns it).
  recordHole(p, holeId, strokes, extra) {
    p.holes = p.holes || {}; p.stats = p.stats || {};
    p.holes[holeId] = lowBest(p.holes[holeId] || 0, strokes);
    const s = p.stats;
    s.strokes = (s.strokes || 0) + strokes;
    s.holes = (s.holes || 0) + 1;
    if (strokes === 1) s.aces = (s.aces || 0) + 1;
    if (extra && extra.underPar) s.birdies = (s.birdies || 0) + 1;
    if (extra && extra.splashes) s.splashes = (s.splashes || 0) + extra.splashes;
    return p;
  },
  recordRound(p, courseId, total, stars, helper) {
    p.rounds = p.rounds || {}; p.stats = p.stats || {};
    const c = p.rounds[courseId];
    if (!c || total < c.best) p.rounds[courseId] = { best: total, stars: Math.max(stars, c ? c.stars : 0), helper: !!helper };
    else c.stars = Math.max(c.stars || 0, stars);
    p.stats.rounds = (p.stats.rounds || 0) + 1;
    return p;
  },
  recordDaily(p, date, strokes) {
    if (p.dailyDate !== date) { p.dailyDate = date; p.dailyBest = 0; p.dailyDone = (p.dailyDone || 0) + 1; }
    p.dailyBest = lowBest(p.dailyBest || 0, strokes);
    return p;
  },
};

const Storage = GK.createStorage({
  prefix: "putt",
  collection: "puttparade",
  firebaseConfig: window.FIREBASE_CONFIG,
  blankProgress: PROGRESS.blank,
  mergeProgress: PROGRESS.merge,
});
