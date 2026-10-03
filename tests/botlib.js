// Shared course check for the bot suites (one file per course, so node --test
// runs the four in parallel). Two promises a course has to keep:
//
//  1. Never stuck. A five-to-six-year-old (the kid bot: wobbly aim, rough
//     power, plays every hole once) finishes it. Being picked up at the stroke
//     limit is allowed now and then — losing a hole is fine — but not as a
//     habit, and the round stays within reach of par.
//  2. Par is honest. A capable grown-up (the adult bot) beats the course par
//     over a round, and a careful eight-year-old (Rosalie bot) gets near it.
const test = require("node:test");
const assert = require("node:assert");
const E = require("./load.js");

function playCourse(ci, skill, seed) {
  const c = E.COURSES[ci];
  let total = 0, pickups = 0;
  c.holes.forEach((h, i) => {
    const H = E.compileHole(h), s = E.Bot.playHole(H, E.SKILLS[skill], seed * 7919 + i * 131);
    total += s; if (s >= E.strokeLimit(h.par)) pickups++;
  });
  return { total, pickups, par: c.par };
}

module.exports = function courseSuite(ci) {
  const c = E.COURSES[ci];
  test(`${c.name}: the kid bot is never stuck`, () => {
    const runs = [1, 2].map((s) => playCourse(ci, "kid", s));
    const pick = runs.reduce((a, r) => a + r.pickups, 0);
    assert.ok(pick <= 2, `picked up ${pick} times in 18 holes`);
    for (const r of runs) assert.ok(r.total <= c.par + 14, `kid round ${r.total} vs par ${c.par}`);
  });
  test(`${c.name}: an adult beats par, Rosalie is near it`, () => {
    const a = playCourse(ci, "adult", 3), r = playCourse(ci, "rosalie", 4);
    assert.ok(a.total <= c.par, `adult round ${a.total} vs par ${c.par}`);
    assert.ok(r.total <= c.par + 4, `Rosalie round ${r.total} vs par ${c.par}`);
  });
};
