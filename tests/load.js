// Shared loader for the suites and the tools: runs the REAL engine sources in
// a vm sandbox, in index.html order. Nothing that touches the DOM is loaded —
// if the engine ever reaches for it, every suite fails to load.
const path = require("node:path");
const { loadScripts } = require("../lib/tools/test-harness.js");

const ROOT = path.join(__dirname, "..");
module.exports = loadScripts({
  baseDir: ROOT,
  files: ["js/physics.js", "js/hole.js", "js/courses.js", "js/game.js", "js/bot.js"],
  exports: ["PHYS", "EV", "Physics", "compileHole", "mirrorDef", "playable", "distanceField", "COURSES", "HOLES", "chamfer", "rect",
    "HoleSim", "Match", "simulateShot", "termFor", "strokeLimit", "roundStars", "dailyPick", "fmtToPar", "Bot", "SKILLS", "mulberry32"],
});
