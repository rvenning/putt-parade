// The four courses and their 36 holes. Pure data on the fixed 400×700 field.
//
// A hole is: green (the rail polygon), tee, cup, par, and any of —
//   blocks   solid islands (polygons; their edges are rails too)
//   posts    [x, y, r] round solid pegs        bumpers  [x, y, r] springy pegs
//   sand / ice / water   regions: {e:[cx,cy,rx,ry]} ellipse or {p:[[x,y]…]} polygon
//   slopes / pads        regions with dir:[ax, ay] (px/s²); pads are strong
//   spinners {x, y, len, arms, w (rad/s), phase}
//   movers   {a, b, T (s), phase, ang, hl (half length), r} — eases a⇄b
//   portals  {a, b}      deco  [{kind, …}] — art only, never collision
//
// Each course introduces its own things; tests/holes.test.js lints every hole
// (inside the rails, cup reachable, no ball can be squeezed) and the bots set
// and check every par.

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// Cut every corner of a polygon by c — rounder greens roll truer and look kinder.
function chamfer(poly, c) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[(i - 1 + poly.length) % poly.length], q = poly[i], n = poly[(i + 1) % poly.length];
    const d1 = Math.hypot(p[0] - q[0], p[1] - q[1]), d2 = Math.hypot(n[0] - q[0], n[1] - q[1]);
    const k1 = Math.min(c, d1 / 2.5) / d1, k2 = Math.min(c, d2 / 2.5) / d2;
    out.push([q[0] + (p[0] - q[0]) * k1, q[1] + (p[1] - q[1]) * k1], [q[0] + (n[0] - q[0]) * k2, q[1] + (n[1] - q[1]) * k2]);
  }
  return out.map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
}
// A windmill across a lane: two buildings with a doorway, and a door that
// slides to and fro across it. The sails are art; the door is the obstacle.
function windmill(x0, x1, y, opts) {
  const o = opts || {};
  const cx = (x0 + x1) / 2, gap = o.gap || 40, depth = o.depth || 56, T = o.T || 3.2;
  return {
    blocks: [rect(x0, y, cx - gap / 2, y + depth), rect(cx + gap / 2, y, x1, y + depth)],
    movers: [{ a: [cx - 46, y + depth + 13], b: [cx + 46, y + depth + 13], T, phase: o.phase || 0, ang: 0, hl: 20, r: 6, door: true }],
    deco: [{ kind: "windmill", x: cx, y, w: x1 - x0, depth, gap }],
  };
}
const merge = (base, ...parts) => {
  const o = { ...base };
  for (const p of parts) for (const k of Object.keys(p)) o[k] = (o[k] || []).concat(p[k]);
  return o;
};

const COURSES = [
  {
    id: "meadow", name: "Meadow Lane", blurb: "Gentle greens to learn on. Banks, corners, a hill and a windmill.",
    bands: [3, -2], intro: "rails, blocks, sand, hills, spinners",
  },
  {
    id: "pier", name: "Pebble Pier", blurb: "Out over the water. Ponds to dodge, buoys to bounce off and boats that won't wait.",
    bands: [3, -2], intro: "water, bumpers, moving boats",
  },
  {
    id: "fair", name: "Funfair Fields", blurb: "Speed pads, magic hats that teleport the ball, and a carousel that never stops.",
    bands: [4, -2], intro: "speed pads, portals, carousels",
  },
  {
    id: "frost", name: "Frosty Peaks", blurb: "Ice that never stops sliding, snowy hills and a mill in the mountains.",
    bands: [4, -1], intro: "ice, steep hills, sliding penguins",
  },
];

// -------------------------------------------------------------- holes --
const OCT_CAROUSEL = [[139, 60], [261, 60], [261, 212], [348, 299], [348, 421], [261, 508], [261, 660], [139, 660], [139, 508], [52, 421], [52, 299], [139, 212]];
const OCT_RINK = [[135, 203], [265, 203], [357, 295], [357, 425], [265, 517], [265, 660], [135, 660], [135, 517], [43, 425], [43, 295]];

const HOLES = [
  // ======================================================= Meadow Lane ==
  { id: "meadow-1", name: "First Putt", par: 2, tip: "Pull back, aim and let go. Softly does it.",
    green: chamfer(rect(130, 90, 270, 640), 18), tee: [200, 585], cup: [200, 150] },
  { id: "meadow-2", name: "Dogleg", par: 2, tip: "Bank it off the top rail.",
    green: chamfer([[60, 70], [350, 70], [350, 300], [200, 300], [200, 640], [60, 640]], 20), tee: [130, 580], cup: [305, 190] },
  { id: "meadow-3", name: "Block Party", par: 3, tip: "Round the block, left or right.",
    green: chamfer(rect(70, 90, 330, 640), 22), tee: [200, 590], cup: [200, 150],
    blocks: [[[200, 315], [252, 367], [200, 419], [148, 367]]] },
  { id: "meadow-4", name: "Zigzag", par: 2, tip: "Two corners. Take them one at a time.",
    green: chamfer([[40, 60], [250, 60], [250, 470], [360, 470], [360, 640], [150, 640], [150, 220], [40, 220]], 16), tee: [310, 590], cup: [92, 110] },
  { id: "meadow-5", name: "Bunker Hill", par: 3, tip: "Sand slows the ball right down. Go round it.",
    green: chamfer(rect(110, 70, 290, 640), 20), tee: [200, 590], cup: [200, 138],
    sand: [{ e: [200, 270, 70, 34] }] },
  { id: "meadow-6", name: "The Slope", par: 3, tip: "The hill pulls everything to the right. Aim left of the flag.",
    green: chamfer(rect(50, 80, 350, 640), 24), tee: [110, 590], cup: [110, 150],
    slopes: [{ p: rect(50, 250, 350, 450), dir: [270, 0] }], sand: [{ e: [318, 560, 32, 40] }] },
  { id: "meadow-7", name: "Turnstile", par: 2, tip: "The turnstile never stops. Pick your moment.",
    green: chamfer(rect(110, 70, 290, 640), 20), tee: [200, 590], cup: [200, 140],
    spinners: [{ x: 200, y: 365, len: 62, arms: 4, w: 1.4 }] },
  { id: "meadow-8", name: "Peg Garden", par: 3, tip: "Thread the pegs. Bounces are allowed.",
    green: chamfer(rect(60, 80, 340, 640), 24), tee: [200, 595], cup: [200, 140],
    posts: [[110, 280, 9], [200, 280, 9], [290, 280, 9], [155, 355, 9], [245, 355, 9], [110, 430, 9], [200, 430, 9], [290, 430, 9]] },
  merge({ id: "meadow-9", name: "The Windmill", par: 3, tip: "Wait for the door to slide open, then go!",
    green: chamfer(rect(110, 60, 290, 650), 20), tee: [200, 600], cup: [200, 132], sand: [{ e: [140, 205, 22, 30] }] },
    windmill(110, 290, 300)),

  // ======================================================== Pebble Pier ==
  { id: "pier-1", name: "Boardwalk", par: 3, tip: "Water costs a stroke and sends you back. Keep left.",
    green: chamfer(rect(110, 80, 290, 640), 18), tee: [170, 590], cup: [200, 150],
    water: [{ e: [268, 360, 50, 70] }] },
  { id: "pier-2", name: "Island Green", par: 2, tip: "One narrow bridge to the flag.",
    green: chamfer(rect(50, 70, 350, 650), 24), tee: [200, 600], cup: [200, 132],
    water: [{ e: [108, 270, 72, 96] }, { e: [292, 270, 72, 96] }] },
  { id: "pier-3", name: "Buoys", par: 3, tip: "The buoys bounce back hard.",
    green: chamfer(rect(60, 80, 340, 640), 24), tee: [200, 600], cup: [200, 140],
    bumpers: [[140, 300, 14], [260, 300, 14], [200, 390, 16], [120, 480, 14], [280, 480, 14]] },
  { id: "pier-4", name: "Tide Pool", par: 2, tip: "Round the pool, either way.",
    green: chamfer(rect(50, 70, 350, 650), 40), tee: [200, 612], cup: [200, 118],
    water: [{ e: [200, 370, 92, 120] }] },
  { id: "pier-5", name: "The Ferry", par: 3, tip: "The ferry crosses back and forth. Slip past it.",
    green: chamfer(rect(110, 70, 290, 650), 20), tee: [200, 600], cup: [200, 132],
    movers: [{ a: [168, 365], b: [232, 365], T: 3.4, ang: 0, hl: 32, r: 9, boat: true }],
    water: [{ e: [145, 220, 28, 26] }, { e: [116, 368, 9, 40] }, { e: [284, 368, 9, 40] }] },
  { id: "pier-6", name: "Rock Pool", par: 2, tip: "Rocks everywhere. Find a gap.",
    green: chamfer(rect(60, 80, 340, 640), 30), tee: [200, 600], cup: [200, 130],
    posts: [[130, 250, 12], [250, 232, 13], [190, 330, 12], [298, 360, 12], [110, 420, 13], [222, 462, 12]],
    sand: [{ e: [282, 160, 36, 22] }] },
  { id: "pier-7", name: "Harbour Wall", par: 3, tip: "Mind the water tucked into the corner.",
    green: chamfer([[40, 70], [340, 70], [340, 650], [190, 650], [190, 300], [40, 300]], 20), tee: [265, 600], cup: [100, 180],
    water: [{ e: [212, 322, 28, 28] }] },
  { id: "pier-8", name: "Twin Boats", par: 3, tip: "Two boats, never in step.",
    green: chamfer(rect(110, 60, 290, 650), 20), tee: [200, 600], cup: [200, 120],
    movers: [{ a: [168, 255], b: [232, 255], T: 3.0, ang: 0, hl: 32, r: 9, boat: true }, { a: [232, 455], b: [168, 455], T: 3.8, phase: 1.3, ang: 0, hl: 32, r: 9, boat: true }] },
  { id: "pier-9", name: "Lighthouse", par: 3, tip: "Round the lighthouse to finish the pier.",
    green: chamfer(rect(40, 60, 360, 660), 40), tee: [200, 612], cup: [200, 108],
    blocks: [[[171, 292], [229, 292], [270, 333], [270, 391], [229, 432], [171, 432], [130, 391], [130, 333]]],
    water: [{ e: [72, 362, 22, 80] }, { e: [328, 362, 22, 80] }], deco: [{ kind: "lighthouse", x: 200, y: 362 }] },

  // ===================================================== Funfair Fields ==
  { id: "fair-1", name: "Speed Lane", par: 2, tip: "Arrows mean speed. The pad does the work.",
    green: chamfer(rect(130, 60, 270, 650), 18), tee: [200, 600], cup: [200, 120],
    pads: [{ p: rect(140, 390, 260, 470), dir: [0, -900] }] },
  { id: "fair-2", name: "Hat Trick", par: 3, tip: "In one magic hat, out the other.",
    green: chamfer(rect(80, 70, 320, 650), 24), tee: [200, 600], cup: [200, 132],
    blocks: [rect(80, 330, 320, 372)], portals: [{ a: [200, 470], b: [262, 240] }] },
  { id: "fair-3", name: "Pinball", par: 3, tip: "Bumpers kick back. Use them, or go round.",
    green: chamfer(rect(50, 70, 350, 650), 30), tee: [200, 612], cup: [200, 130],
    bumpers: [[200, 250, 18], [130, 330, 15], [270, 330, 15], [200, 412, 15], [110, 488, 13], [290, 488, 13]] },
  { id: "fair-4", name: "Carousel", par: 3, tip: "Ride the carousel round, or beat it through.",
    green: OCT_CAROUSEL, tee: [200, 612], cup: [200, 108],
    spinners: [{ x: 200, y: 360, len: 100, arms: 3, w: 0.9, hw: 6, hub: 12 }] },
  { id: "fair-5", name: "Loop the Loop", par: 3, tip: "One side speeds you up. The other pushes back.",
    green: chamfer(rect(50, 70, 350, 650), 60), tee: [200, 615], cup: [200, 118],
    blocks: [chamfer(rect(130, 180, 270, 560), 30)],
    pads: [{ p: rect(56, 300, 124, 440), dir: [0, -700] }, { p: rect(276, 300, 344, 440), dir: [0, 700] }] },
  { id: "fair-6", name: "Hall of Mirrors", par: 3, tip: "The long way round, or the hat?",
    green: chamfer(rect(50, 70, 350, 650), 20), tee: [100, 600], cup: [300, 130],
    blocks: [rect(50, 250, 262, 282), rect(138, 430, 350, 462)], portals: [{ a: [300, 590], b: [92, 180] }] },
  { id: "fair-7", name: "Dodgems", par: 3, tip: "Three dodgems. Timing beats power.",
    green: chamfer(rect(50, 70, 350, 650), 30), tee: [200, 612], cup: [200, 128],
    movers: [{ a: [105, 262], b: [295, 262], T: 3.6, ang: 0, hl: 26, r: 10, car: true },
      { a: [295, 400], b: [105, 400], T: 4.2, phase: 0.8, ang: 0, hl: 26, r: 10, car: true },
      { a: [160, 520], b: [240, 520], T: 2.6, phase: 2.1, ang: 0, hl: 20, r: 10, car: true }] },
  { id: "fair-8", name: "Big Wheels", par: 3, tip: "Two wheels turning opposite ways.",
    green: chamfer(rect(90, 60, 310, 650), 24), tee: [200, 610], cup: [200, 115],
    spinners: [{ x: 200, y: 252, len: 70, arms: 3, w: 1.2, hw: 5 }, { x: 200, y: 462, len: 70, arms: 3, w: -1.2, hw: 5 }] },
  { id: "fair-9", name: "Grand Finale", par: 3, tip: "Everything at once. Have fun!",
    green: chamfer([[40, 60], [360, 60], [360, 360], [230, 360], [230, 650], [40, 650]], 22), tee: [135, 610], cup: [310, 118],
    pads: [{ p: rect(56, 400, 214, 470), dir: [0, -650] }], bumpers: [[300, 205, 15], [172, 170, 14]],
    spinners: [{ x: 135, y: 298, len: 58, arms: 2, w: 1.6, hw: 5 }] },

  // ======================================================= Frosty Peaks ==
  { id: "frost-1", name: "First Frost", par: 2, tip: "Ice keeps the ball going. Less power than you think.",
    green: chamfer(rect(120, 70, 280, 640), 20), tee: [200, 590], cup: [200, 140],
    ice: [{ p: rect(120, 240, 280, 520) }] },
  { id: "frost-2", name: "Snow Hill", par: 2, tip: "Uphill all the way. Hit it hard or it rolls back.",
    green: chamfer(rect(90, 60, 310, 650), 24), tee: [200, 600], cup: [200, 140],
    slopes: [{ p: rect(90, 220, 310, 470), dir: [0, 420] }], posts: [[158, 190, 9], [242, 190, 9]] },
  { id: "frost-3", name: "Ice Rink", par: 3, tip: "Round and slippery. Bank it in.",
    green: OCT_RINK, tee: [200, 615], cup: [200, 238],
    ice: [{ e: [200, 362, 150, 150] }], posts: [[118, 330, 10], [282, 330, 10], [150, 420, 10], [250, 420, 10]],
    blocks: [[[200, 296], [232, 328], [200, 360], [168, 328]]] },
  { id: "frost-4", name: "Penguin Parade", par: 3, tip: "Penguins waddle across. Don't hit one!",
    green: chamfer(rect(100, 60, 300, 650), 24), tee: [200, 610], cup: [200, 115],
    ice: [{ p: rect(100, 160, 300, 560) }],
    movers: [{ a: [147, 232], b: [253, 232], T: 3.4, ang: 0, hl: 18, r: 12, penguin: true },
      { a: [253, 360], b: [147, 360], T: 3.0, phase: 1.1, ang: 0, hl: 18, r: 12, penguin: true },
      { a: [147, 488], b: [253, 488], T: 3.8, phase: 2.4, ang: 0, hl: 18, r: 12, penguin: true }] },
  { id: "frost-5", name: "Avalanche", par: 2, tip: "Three hills, each pulling a different way.",
    green: chamfer(rect(60, 70, 340, 650), 24), tee: [200, 612], cup: [200, 130],
    slopes: [{ p: rect(60, 200, 340, 290), dir: [380, 0] }, { p: rect(60, 330, 340, 420), dir: [-380, 0] }, { p: rect(60, 460, 340, 550), dir: [380, 0] }],
    posts: [[200, 310, 10], [130, 440, 10], [270, 180, 10]] },
  { id: "frost-6", name: "Ice Cave", par: 3, tip: "The cave goes the long way. The ice hole doesn't.",
    green: chamfer(rect(70, 70, 330, 650), 24), tee: [200, 610], cup: [130, 140],
    blocks: [rect(70, 340, 250, 372)], ice: [{ p: rect(70, 372, 330, 650) }], portals: [{ a: [118, 470], b: [288, 205] }],
    water: [{ e: [118, 535, 34, 22] }, { e: [290, 470, 18, 50] }] },
  { id: "frost-7", name: "Moguls", par: 3, tip: "Bumps! Enough speed to get over, not so much you fly back.",
    green: chamfer(rect(90, 60, 310, 650), 24), tee: [200, 610], cup: [200, 120],
    slopes: [{ p: rect(90, 200, 310, 260), dir: [0, 300] }, { p: rect(90, 260, 310, 320), dir: [0, -300] },
      { p: rect(90, 400, 310, 460), dir: [0, 300] }, { p: rect(90, 460, 310, 520), dir: [0, -300] }] },
  { id: "frost-8", name: "Frozen Pond", par: 3, tip: "Thin ice in the middle. Plop!",
    green: chamfer(rect(50, 70, 350, 650), 30), tee: [200, 612], cup: [200, 140],
    ice: [{ e: [200, 370, 140, 110] }], water: [{ e: [200, 370, 52, 38] }], sand: [{ e: [298, 172, 34, 22] }],
    posts: [[110, 300, 10], [290, 300, 10], [200, 250, 10]] },
  merge({ id: "frost-9", name: "Snow Mill", par: 3, tip: "Slide up the ice, through the mill door, and home.",
    green: chamfer(rect(60, 60, 340, 650), 24), tee: [200, 610], cup: [200, 130],
    ice: [{ p: rect(60, 440, 340, 650) }], slopes: [{ p: rect(60, 160, 340, 250), dir: [0, -150] }] },
    windmill(60, 340, 300, { T: 2.8, phase: 1 })),
];

HOLES.forEach((h, i) => { h.course = Math.floor(i / 9); h.n = (i % 9) + 1; h.idx = i; });
COURSES.forEach((c, i) => { c.holes = HOLES.slice(i * 9, i * 9 + 9); c.par = c.holes.reduce((s, h) => s + h.par, 0); c.idx = i; });

if (typeof module !== "undefined") module.exports = { COURSES, HOLES, chamfer, rect };
