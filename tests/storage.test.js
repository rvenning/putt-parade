"use strict";
// The progress merge and the progression rules. Golf scores go DOWN as you
// improve, so "best" here means lowest — and every merge property is asserted
// in both argument orders, since which device syncs first is a coin toss.
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { loadScripts } = require("../lib/tools/test-harness.js");

const S = loadScripts({
  baseDir: path.join(__dirname, ".."),
  files: ["lib/gk-util.js", "lib/gk-audio.js", "lib/gk-storage.js", "tests/fake-firebase.js",
    "js/physics.js", "js/hole.js", "js/courses.js", "js/storage.js"],
  exports: ["PROGRESS", "Progress", "Storage", "COURSES"],
  browser: true,
  globals: { structuredClone },
});
const { PROGRESS, Progress, COURSES } = S;
const blank = () => PROGRESS.blank();
const bothWays = (a, b, check) => { check(PROGRESS.merge(a, b)); check(PROGRESS.merge(b, a)); };

test("a blank save has every field the game reads, and only the first course is open", () => {
  const p = blank();
  for (const k of ["holes", "rounds", "dailyDate", "dailyBest", "dailyDone", "stats", "helper", "updated"]) assert.ok(k in p, k);
  assert.ok(Progress.courseOpen(p, 0));
  assert.ok(!Progress.courseOpen(p, 1));
  assert.strictEqual(Progress.coursesOpen(p), 1);
});

test("merge keeps the LOWER score on every hole, and never loses a hole", () => {
  const phone = { ...blank(), holes: { "meadow-1": 2, "meadow-2": 4 } };
  const pad = { ...blank(), holes: { "meadow-2": 3, "meadow-3": 1 } };
  bothWays(phone, pad, (m) => assert.deepStrictEqual({ ...m.holes }, { "meadow-1": 2, "meadow-2": 3, "meadow-3": 1 }));
});

test("a zero (never played) never beats a real score", () => {
  bothWays({ ...blank(), holes: { "pier-1": 0 } }, { ...blank(), holes: { "pier-1": 4 } }, (m) => assert.strictEqual(m.holes["pier-1"], 4));
});

test("rounds merge to the lowest total and the most stars, and the helper flag follows the best round", () => {
  const a = { ...blank(), rounds: { meadow: { best: 25, stars: 2, helper: false } } };
  const b = { ...blank(), rounds: { meadow: { best: 21, stars: 3, helper: true }, pier: { best: 30, stars: 1, helper: false } } };
  bothWays(a, b, (m) => {
    assert.strictEqual(m.rounds.meadow.best, 21);
    assert.strictEqual(m.rounds.meadow.stars, 3);
    assert.strictEqual(m.rounds.meadow.helper, true);
    assert.strictEqual(m.rounds.pier.best, 30);
  });
});

test("stars never drop, even if the lower round earned fewer", () => {
  const a = { ...blank(), rounds: { fair: { best: 30, stars: 3 } } }, b = { ...blank(), rounds: { fair: { best: 28, stars: 2 } } };
  bothWays(a, b, (m) => { assert.strictEqual(m.rounds.fair.best, 28); assert.strictEqual(m.rounds.fair.stars, 3); });
});

test("the daily score belongs to its day: a newer day wins outright, the same day keeps the lower", () => {
  bothWays({ ...blank(), dailyDate: "2026-10-03", dailyBest: 2 }, { ...blank(), dailyDate: "2026-10-04", dailyBest: 5 }, (m) => {
    assert.strictEqual(m.dailyDate, "2026-10-04"); assert.strictEqual(m.dailyBest, 5);
  });
  bothWays({ ...blank(), dailyDate: "2026-10-03", dailyBest: 4 }, { ...blank(), dailyDate: "2026-10-03", dailyBest: 3 }, (m) => assert.strictEqual(m.dailyBest, 3));
});

test("lifetime counters merge by max", () => {
  bothWays({ ...blank(), stats: { aces: 3, holes: 40 } }, { ...blank(), stats: { aces: 1, holes: 55, splashes: 2 } }, (m) => {
    assert.strictEqual(m.stats.aces, 3); assert.strictEqual(m.stats.holes, 55); assert.strictEqual(m.stats.splashes, 2);
  });
});

test("the helper choice follows whichever save is newer", () => {
  bothWays({ ...blank(), helper: true, updated: 10 }, { ...blank(), helper: false, updated: 20 }, (m) => assert.strictEqual(m.helper, false));
});

test("recordHole keeps the best, counts aces and birdies", () => {
  const p = blank();
  Progress.recordHole(p, "meadow-1", 3, { underPar: false });
  Progress.recordHole(p, "meadow-1", 1, { underPar: true });
  Progress.recordHole(p, "meadow-1", 2, { underPar: false, splashes: 1 });
  assert.strictEqual(p.holes["meadow-1"], 1);
  assert.strictEqual(p.stats.aces, 1); assert.strictEqual(p.stats.birdies, 1); assert.strictEqual(p.stats.holes, 3);
  assert.strictEqual(p.stats.strokes, 6); assert.strictEqual(p.stats.splashes, 1);
});

test("finishing a course's round (any score) opens the next course", () => {
  const p = blank();
  Progress.recordRound(p, COURSES[0].id, 40, 1, false);
  assert.ok(Progress.courseOpen(p, 1));
  assert.ok(!Progress.courseOpen(p, 2));
  Progress.recordRound(p, COURSES[0].id, 22, 3, false);
  assert.strictEqual(p.rounds[COURSES[0].id].best, 22);
  Progress.recordRound(p, COURSES[0].id, 30, 1, false);
  assert.strictEqual(p.rounds[COURSES[0].id].best, 22, "a worse round never replaces a better one");
  assert.strictEqual(p.rounds[COURSES[0].id].stars, 3);
});

test("recordDaily resets on a new day and keeps the lower score within one", () => {
  const p = blank();
  Progress.recordDaily(p, "2026-10-03", 4); Progress.recordDaily(p, "2026-10-03", 2); Progress.recordDaily(p, "2026-10-03", 5);
  assert.strictEqual(p.dailyBest, 2); assert.strictEqual(p.dailyDone, 1);
  Progress.recordDaily(p, "2026-10-04", 6);
  assert.strictEqual(p.dailyBest, 6); assert.strictEqual(p.dailyDone, 2);
});
