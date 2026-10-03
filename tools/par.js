// Bot strokes per hole, and the par they suggest.
//   node tools/par.js [holeId|course-prefix] [seeds]
// Suggested par = the mean of the adult and Rosalie bots, plus 0.6, rounded,
// kept between 2 and 5 — a capable grown-up beats it sometimes, an
// eight-year-old meets it on a good day, and a five-year-old is a few over.
const E = require("../tests/load.js");
const arg = process.argv[2] || "", seeds = +(process.argv[3] || 4);
const holes = E.HOLES.filter((h) => !arg || h.id === arg || h.id.startsWith(arg));
const skills = (process.env.SKILLS || "adult,rosalie,kid").split(",");
for (const h of holes) {
  const H = E.compileHole(h);
  const t0 = Date.now(), mean = {};
  const row = skills.map((k) => {
    const r = []; for (let s = 1; s <= seeds; s++) r.push(E.Bot.playHole(H, E.SKILLS[k], s * 977 + h.idx * 31));
    mean[k] = r.reduce((a, b) => a + b, 0) / r.length;
    return `${k} ${mean[k].toFixed(2)} [${r.join(" ")}]`;
  });
  const sug = mean.adult != null && mean.rosalie != null ? Math.max(2, Math.min(5, Math.round((mean.adult + mean.rosalie) / 2 + 0.6))) : "-";
  console.log(`${h.id.padEnd(10)} par ${h.par} -> ${sug}  ${row.join("  ")}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
