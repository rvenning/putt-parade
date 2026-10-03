// Generate icons/ — a timber-railed green seen from above, the cup with its
// red pennant, and a white ball rolling in. The Toy Diorama palette, since
// that is the look the game opens in.
// Run: node tools/make-icons.js  (from the putt-parade folder)
const fs = require("fs");
const path = require("path");
const { makeCanvas, downsample, encodePNG } = require("../lib/tools/png.js");

const OUT = path.join(__dirname, "..", "icons");
fs.mkdirSync(OUT, { recursive: true });

function paint(size, pad) {
  const SS = 4, big = size * SS;
  const cv = makeCanvas(big);
  const u = big / 100, s = pad ? 0.72 : 1;
  const at = (v) => 50 * u + (v - 50) * u * s;
  const sz = (v) => v * u * s;

  cv.fillRect(0, 0, big, big, "#2f6b3a");
  for (let y = -10; y < 110; y += 12) cv.fillRect(0, y * u, big, 6 * u, "#357742", 0.7);
  // shadow, timber rail, turf
  cv.fillRoundRect(at(14), at(13), sz(76), sz(80), sz(14), "#1d4526", 0.6);
  cv.fillRoundRect(at(10), at(8), sz(78), sz(82), sz(14), "#7a4a22");
  cv.fillRoundRect(at(10), at(6), sz(78), sz(82), sz(14), "#d9a35a");
  cv.fillRoundRect(at(17), at(13), sz(64), sz(68), sz(9), "#5cbf5a");
  for (let k = 0; k < 4; k++) cv.fillRect(at(17 + k * 16), at(13), sz(8), sz(68), "#64c862", 0.8);
  // the cup and flag
  cv.fillCircle(at(62), at(36), sz(8.5), "#3e9a3c");
  cv.fillCircle(at(62), at(36), sz(6.5), "#17240f");
  cv.fillRect(at(61.4), at(12), sz(2.2), sz(24), "#f3efe6");
  cv.fillTriangle(at(63.4), at(12), at(80), at(17.5), at(63.4), at(23), "#e8553a");
  // ball, with its shadow, rolling toward the cup
  cv.fillCircle(at(38), at(66), sz(8.5), "#1d4526", 0.5);
  cv.fillCircle(at(36), at(63.5), sz(8), "#cfd6d0");
  cv.fillCircle(at(35.5), at(63), sz(7.2), "#ffffff");
  cv.fillCircle(at(33), at(60.5), sz(2.2), "#ffffff");
  cv.fillRect(at(30), at(63), sz(11), sz(2.4), "#e8553a", 0.85);
  // the putt's path, dotted
  for (const [x, y] of [[44, 56], [49, 50], [54, 45]]) cv.fillCircle(at(x), at(y), sz(1.6), "#fff6df", 0.9);
  return encodePNG(size, size, downsample(cv.px, big, SS));
}

fs.writeFileSync(path.join(OUT, "icon-192.png"), paint(192, false));
fs.writeFileSync(path.join(OUT, "icon-512.png"), paint(512, false));
fs.writeFileSync(path.join(OUT, "maskable-512.png"), paint(512, true));
console.log("icons written to", OUT);
