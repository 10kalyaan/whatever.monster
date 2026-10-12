const NS = "http://www.w3.org/2000/svg";

// seeded random so the board is identical on every load
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// black and white; green is the only accent and is used sparingly
// (keep GREEN in sync with --green in styles.css)
const WHITE = "#e8e8e6", GREY = "#8a8d8c", GREEN = "#2bff72";

function svg(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

function text(parent, x, y, str, { size = 12, fill = "#d9d9d6", weight = 400, opacity = 1, anchor = "start", rotate } = {}) {
  const t = svg("text", {
    x, y, fill, opacity,
    "font-size": size,
    "font-weight": weight,
    "font-family": "JetBrains Mono, Consolas, monospace",
    "text-anchor": anchor,
    "letter-spacing": 1,
  }, parent);
  if (rotate) t.setAttribute("transform", `rotate(${rotate} ${x} ${y})`);
  t.textContent = str;
  return t;
}

/* ================= the inside of the computer =================
   drawn as two SVG layers that get rasterised once: "low" sits under the
   moving parts (board, traces, fan housing), "high" sits over them (chips,
   labels). the moving bits are returned as data and drawn on a canvas. */
function buildBoard() {
  const layer = () => svg("svg", { viewBox: "0 0 1600 1000", width: 1600, height: 1000 });
  const low = layer(), high = layer();
  const metalDefs = root => {
    const defs = svg("defs", {}, root);
    const metal = svg("linearGradient", { id: "metal", x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    [["0", "#a9abaa"], [".45", "#6b6e6d"], [".55", "#8f9291"], ["1", "#505352"]]
      .forEach(([offset, c]) => svg("stop", { offset, "stop-color": c }, metal));
    return defs;
  };
  const dots = svg("pattern", { id: "dots", width: 22, height: 22, patternUnits: "userSpaceOnUse" }, metalDefs(low));
  metalDefs(high);
  svg("circle", { cx: 11, cy: 11, r: 1, fill: "#0c0d0d" }, dots);

  svg("rect", { width: 1600, height: 1000, fill: "#020202" }, low);
  svg("rect", { width: 1600, height: 1000, fill: "url(#dots)" }, low);

  // styles are inline: CSS doesn't reach inside an SVG drawn as an image
  const traces = svg("g", { fill: "none", stroke: "#131515", "stroke-width": 2.5, "stroke-linejoin": "round", "stroke-linecap": "round" }, low);
  const under = svg("g", {}, low);
  const parts = svg("g", {}, high);
  const silk = svg("g", {}, high);

  const live = [];
  const trace = (d, pulse = rand() < .5) => {
    svg("path", { d }, traces);
    if (pulse) live.push(d);
  };
  const via = (x, y) => svg("circle", { cx: x, cy: y, r: 4, fill: "#020202", stroke: "#1c1e1e", "stroke-width": 2 }, traces);
  const label = (x, y, s, o = {}) => text(silk, x, y, s, { size: 12, opacity: .5, fill: WHITE, ...o });

  /* ---- traces ---- */
  // CPU -> RAM
  for (let i = 0; i < 12; i++) trace(`M840 ${372 + i * 16} H920`);
  // CPU -> SSD
  for (let i = 0; i < 9; i++) { const x = 600 + i * 14; trace(`M${x} 610 V660 L${x - 100} 760`); }
  // CPU -> chipset
  for (let i = 0; i < 7; i++) { const x = 760 + i * 12; trace(`M${x} 610 V${870 - i * 10} H1000`); }
  // fan header -> chipset
  for (let i = 0; i < 4; i++) trace(`M1160 ${430 + i * 12} H${1140 - i * 8} V${836 - i * 12} H1110`, true);
  // flex cable -> CPU
  for (let i = 0; i < 6; i++) { const y = 171 - i * 9; trace(`M500 ${y} H${600 + i * 14} V330`); }
  // background routing
  for (let i = 0; i < 48; i++) {
    let x = Math.round(rand() * 160) * 10, y = Math.round(rand() * 100) * 10;
    let dir = Math.floor(rand() * 8);
    let d = `M${x} ${y}`;
    via(x, y);
    for (let s = 0; s < 3; s++) {
      const len = 40 + rand() * 170, ang = dir * Math.PI / 4;
      x += Math.round(Math.cos(ang) * len);
      y += Math.round(Math.sin(ang) * len);
      d += ` L${x} ${y}`;
      dir = (dir + (rand() < .5 ? 1 : 7)) % 8; // only 45° turns
    }
    via(x, y);
    trace(d, rand() < .3);
  }

  const pulses = live.map(d => {
    // about one pulse in ten is green, the rest are white
    return { d, color: rand() < .1 ? GREEN : WHITE, dur: 2.6 + rand() * 4, delay: rand() * 6 };
  });

  /* ---- parts ---- */
  const ic = (x, y, w, h, name) => {
    const col = GREY;
    const g = svg("g", {}, parts);
    for (let py = y + 8; py < y + h - 6; py += 9) {
      svg("rect", { x: x - 6, y: py, width: 6, height: 4, fill: "#5d605f" }, g);
      svg("rect", { x: x + w, y: py, width: 6, height: 4, fill: "#5d605f" }, g);
    }
    svg("rect", { x, y, width: w, height: h, rx: 3, fill: "#0e0f0f", stroke: "#2a2c2b", "stroke-width": 1.5 }, g);
    svg("circle", { cx: x + 8, cy: y + 8, r: 3, fill: col }, g);
    svg("rect", { x: x + 6, y: y + h - 6, width: w - 12, height: 2, rx: 1, fill: col }, g);
    if (name) label(x, y - 10, name, { size: 11 });
  };
  const cap = (x, y, r = 13) => {
    const g = svg("g", {}, parts);
    svg("circle", { cx: x, cy: y, r, fill: "#1a1b1b", stroke: "#5a5d5c", "stroke-width": 2.5 }, g);
    svg("path", { d: `M${x - r * .55} ${y} H${x + r * .55} M${x} ${y - r * .55} V${y + r * .55}`, stroke: "#303332", "stroke-width": 2 }, g);
  };
  const resistors = (x, y, n) => {
    for (let i = 0; i < n; i++) {
      const rx = x + i * 16;
      svg("rect", { x: rx, y, width: 10, height: 6, fill: "#1c1d1d" }, parts);
      svg("rect", { x: rx, y, width: 2.5, height: 6, fill: "#8a8d8c" }, parts);
      svg("rect", { x: rx + 7.5, y, width: 2.5, height: 6, fill: "#8a8d8c" }, parts);
      svg("rect", { x: rx + 4, y, width: 2, height: 6, fill: GREY }, parts);
    }
  };
  const sticker = (x, y, w, h) => svg("rect", { x, y, width: w, height: h, rx: 3, fill: "#e9e9e5" }, parts);

  // mounting holes
  [[60, 60], [1540, 60], [60, 940], [1540, 940]].forEach(([x, y]) => {
    svg("circle", { cx: x, cy: y, r: 20, fill: "none", stroke: "#3a3d3c", "stroke-width": 2 }, parts);
    svg("circle", { cx: x, cy: y, r: 9, fill: "#050505", stroke: "#585b5a", "stroke-width": 2 }, parts);
  });

  // flex cable + connector
  svg("rect", { x: 60, y: 118, width: 384, height: 56, fill: "#1a1b1b" }, parts);
  for (let i = 0; i < 8; i++) svg("path", { d: `M60 ${124 + i * 6.5} H440`, stroke: WHITE, "stroke-width": 2, "stroke-opacity": .12 + (i % 2) * .12 }, parts);
  svg("rect", { x: 440, y: 108, width: 60, height: 76, rx: 4, fill: "#202221", stroke: "#3a3c3b", "stroke-width": 1.5 }, parts);
  label(60, 106, "J1 · FLEX");
  text(silk, 60, 198, "// TODO: hide the cables", { size: 11, fill: GREY, opacity: .7 });

  // VRM: chokes + caps around the CPU
  for (let i = 0; i < 6; i++) {
    svg("rect", { x: 470, y: 342 + i * 44, width: 26, height: 22, rx: 2, fill: "#202221", stroke: "#3a3d3c" }, parts);
    cap(518, 352 + i * 44);
  }
  for (let i = 0; i < 8; i++) cap(578 + i * 37, 290);

  // CPU
  svg("rect", { x: 548, y: 318, width: 304, height: 304, fill: "none", stroke: "#d9d9d6", opacity: .2, "stroke-dasharray": "4 4" }, silk);
  svg("rect", { x: 560, y: 330, width: 280, height: 280, rx: 6, fill: "#141515", stroke: "#2c2e2d", "stroke-width": 2 }, parts);
  svg("rect", { x: 548, y: 360, width: 8, height: 220, rx: 3, fill: "#2a2c2b" }, parts);
  svg("rect", { x: 590, y: 360, width: 220, height: 220, rx: 12, fill: "url(#metal)" }, parts);
  svg("path", { d: "M600 570 h16 l-16 -16 z", fill: "#3a3c3b" }, parts);
  text(parts, 612, 410, "WHTVR", { size: 28, weight: 700, fill: "#2a2c2b" });
  text(parts, 612, 436, "M-01 · 3.9GHz", { size: 14, fill: "#2a2c2b" });
  text(parts, 612, 456, "SN 0x7F3A-2026", { size: 12, fill: "#2a2c2b" });
  svg("rect", { x: 612, y: 476, width: 176, height: 6, rx: 3, fill: "#2a2c2b" }, parts);
  text(parts, 612, 552, "© whatever.monster", { size: 11, fill: "#2a2c2b" });
  label(858, 352, "CPU1");
  resistors(864, 640, 4);
  resistors(560, 640, 2);

  // RAM
  for (let k = 0; k < 4; k++) {
    const x = 920 + k * 45;
    svg("rect", { x: x - 4, y: 250, width: 34, height: 480, rx: 3, fill: "#121313", stroke: "#2a2c2b" }, parts);
    svg("rect", { x: x - 2, y: 240, width: 30, height: 14, rx: 2, fill: "#2b2d2c" }, parts);
    svg("rect", { x: x - 2, y: 726, width: 30, height: 14, rx: 2, fill: "#2b2d2c" }, parts);
    svg("rect", { x, y: 262, width: 26, height: 456, rx: 2, fill: "#1b1d1c", stroke: "#333635" }, parts);
    for (let j = 0; j < 8; j++) svg("rect", { x: x + 5, y: 280 + j * 54, width: 16, height: 38, fill: "#0f1010", stroke: "#2a2c2b" }, parts);
    svg("rect", { x: x + 2, y: 264, width: 22, height: 7, rx: 3, fill: GREEN }, parts);
    label(x + 13, 758, ["A1", "A2", "B1", "B2"][k], { anchor: "middle" });
  }
  sticker(1013, 440, 20, 150);
  text(parts, 1027, 582, "DDR5 · 32GB · 6400", { size: 10, fill: "#1b1d1c", rotate: -90 });

  // fan: housing goes under the canvas, blades + hub are drawn live on top of it
  const fx = 1330, fy = 330;
  svg("rect", { x: 1160, y: 160, width: 340, height: 340, rx: 34, fill: "#0f1010", stroke: "#2c2e2d", "stroke-width": 2 }, under);
  [[1190, 190], [1470, 190], [1190, 470], [1470, 470]].forEach(([x, y]) =>
    svg("circle", { cx: x, cy: y, r: 9, fill: "#050505", stroke: "#4a4d4c", "stroke-width": 2 }, under));
  svg("circle", { cx: fx, cy: fy, r: 158, fill: "#070808", stroke: "#3a3d3c", "stroke-width": 3 }, under);
  const fan = { fx, fy, r: 158, blade: "M42 -8 C90 -30 130 -72 152 -50 C140 -8 100 22 40 18 Z" };
  label(1160, 148, "FAN1");

  // M.2 SSD
  for (let i = 0; i < 10; i++) svg("rect", { x: 168, y: 766 + i * 6, width: 12, height: 3, fill: "#8a8d8c" }, parts);
  svg("rect", { x: 180, y: 760, width: 540, height: 70, rx: 6, fill: "#18191a", stroke: "#2c2e2d" }, parts);
  svg("rect", { x: 196, y: 772, width: 56, height: 46, rx: 2, fill: "#0e0f0f" }, parts);
  sticker(266, 770, 210, 50);
  text(parts, 278, 791, "NVMe · 2TB", { size: 13, weight: 700, fill: "#1b1d1c" });
  text(parts, 278, 809, "whatever.monster/ssd", { size: 10, fill: "#555" });
  svg("rect", { x: 490, y: 822, width: 174, height: 3, rx: 1.5, fill: GREY, opacity: .5 }, parts);
  svg("rect", { x: 490, y: 772, width: 80, height: 46, rx: 2, fill: "#0e0f0f" }, parts);
  svg("rect", { x: 584, y: 772, width: 80, height: 46, rx: 2, fill: "#0e0f0f" }, parts);
  svg("circle", { cx: 740, cy: 795, r: 12, fill: "url(#metal)" }, parts);
  label(180, 748, "M2_1");

  // chipset with heatsink
  svg("rect", { x: 1000, y: 780, width: 110, height: 110, rx: 4, fill: "url(#metal)", opacity: .85 }, parts);
  for (let i = 0; i < 8; i++) svg("path", { d: `M${1012 + i * 12} 792 V878`, stroke: "#3b3e3d", "stroke-width": 5 }, parts);
  label(1000, 768, "PCH");

  // CMOS battery
  svg("rect", { x: 1282, y: 752, width: 136, height: 56, rx: 6, fill: "#151616", stroke: "#2c2e2d" }, parts);
  svg("circle", { cx: 1350, cy: 780, r: 56, fill: "url(#metal)", stroke: "#2c2e2d", "stroke-width": 2 }, parts);
  svg("circle", { cx: 1350, cy: 780, r: 44, fill: "none", stroke: "rgba(0,0,0,.25)", "stroke-width": 2 }, parts);
  text(parts, 1350, 776, "CR2032", { size: 13, weight: 700, fill: "#2a2c2b", anchor: "middle" });
  text(parts, 1350, 796, "+3V", { size: 11, fill: "#2a2c2b", anchor: "middle" });
  label(1290, 712, "BAT1");
  label(1416, 838, "DO NOT LICK", { size: 10 });

  // misc chips
  ic(300, 320, 100, 100, "U3 · AUDIO");
  ic(120, 430, 70, 50, "U7");
  ic(330, 520, 60, 90, "U9 · TPM");
  ic(130, 610, 120, 60, "U11 · BIOS");
  ic(700, 120, 70, 60, "U5");
  ic(1200, 570, 80, 80, "U14 · NET");
  ic(1420, 580, 60, 60, "U15");

  // front-panel header
  for (let r = 0; r < 2; r++) for (let c = 0; c < 10; c++) {
    svg("rect", { x: 880 + c * 20, y: 120 + r * 20, width: 13, height: 13, fill: "#1a1b1b", stroke: "#3a3d3c" }, parts);
    svg("rect", { x: 884.5 + c * 20, y: 124.5 + r * 20, width: 4, height: 4, fill: "#a3a6a5" }, parts);
  }
  label(880, 108, "J_FRONT");

  label(1180, 950, "WHATEVER.MONSTER  ·  REV 0.1", { size: 14 });
  label(84, 950, "MADE BY HUMANS. DEBUGGED BY MORE HUMANS.", { size: 11, opacity: .4 });

  return { low, high, pulses, fan };
}

/* ================= tiny syntax highlighters ================= */
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function highlightHTML(src) {
  return src.replace(/(<\/?)([\w-]+)([^>]*)(\/?>)|([^<]+)/g, (m, open, tag, attrs, close, txt) => {
    if (txt !== undefined) return `<span class="t-text">${esc(txt)}</span>`;
    const a = attrs.replace(/([\w:-]+)(?:(=)("[^"]*"))?/g, (_, n, eq, v) =>
      `<span class="t-attr">${n}</span>` + (eq ? `<span class="t-punc">=</span><span class="t-str">${esc(v)}</span>` : ""));
    return `<span class="t-punc">${esc(open)}</span><span class="t-tag">${tag}</span>${a}<span class="t-punc">${esc(close)}</span>`;
  });
}

/* ================= render the board =================
   the board never changes, so it's rasterised once into two still canvases.
   only the pulses + fan are redrawn each frame, on a third canvas between
   them. scrolling just moves/fades whole layers, which the GPU does for free. */
const clamp = v => Math.min(1, Math.max(0, v));
const range = (v, a, b) => clamp((v - a) / (b - a));
const ease = t => t * t * (3 - 2 * t);
const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

function toImage(el) {
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(el)], { type: "image/svg+xml" }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

// length of an M/L/H/V polyline, so the pulse dash can be sized like SVG's pathLength
function pathLength(d) {
  let x = 0, y = 0, len = 0, m;
  const re = /([MLHV])\s*(-?[\d.]+)(?:\s+(-?[\d.]+))?/g;
  while ((m = re.exec(d))) {
    const px = x, py = y, a = +m[2], b = +m[3];
    if (m[1] === "M") { x = a; y = b; continue; }
    if (m[1] === "L") { x = a; y = b; } else if (m[1] === "H") x = a; else y = a;
    len += Math.hypot(x - px, y - py);
  }
  return len;
}

// soft light over each zone: centre x/y and radius x/y as fractions of the view
const BLOOMS = [
  [.63, .30, .08, .12, GREEN, .05], // faint spill from the RAM lights
];

const hero = document.getElementById("hero");
const stage = hero.querySelector(".stage");
const $ = sel => stage.querySelector(sel);
const internals = $(".internals"), shade = $(".shade"), frame = $(".frame"), glass = $(".glass");
const glyphs = $(".glyphs"), nav = $(".nav"), plate = $(".plate"), hint = $(".hint"), fadeOut = $(".fade-out");
const [cLow, cLive, cHigh] = internals.querySelectorAll("canvas");
const live = cLive.getContext("2d");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const board = buildBoard();
const pulses = board.pulses.map(p => ({ ...p, path: new Path2D(p.d), len: pathLength(p.d) }));
const blade = new Path2D(board.fan.blade);
let imgLow = null, imgHigh = null;
let view = { w: 0, h: 0, s: 1, ox: 0, oy: 0 }, dpr = 1, liveDpr = 1;

function paintStill() {
  [[cLow, imgLow], [cHigh, imgHigh]].forEach(([c, img], i) => {
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, view.w, view.h);
    if (img) ctx.drawImage(img, view.ox, view.oy, 1600 * view.s, 1000 * view.s);
    if (i === 1) BLOOMS.forEach(([x, y, rx, ry, col, a]) => {
      ctx.save();
      ctx.translate(x * view.w, y * view.h);
      ctx.scale(rx * view.w, ry * view.h);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, hexA(col, a));
      g.addColorStop(.7, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    });
  });
}

function drawLive(now) {
  const { s, ox, oy } = view, { fx, fy, r } = board.fan, sec = now / 1000;
  live.setTransform(1, 0, 0, 1, 0, 0);
  live.clearRect(0, 0, cLive.width, cLive.height);
  live.setTransform(liveDpr * s, 0, 0, liveDpr * s, liveDpr * ox, liveDpr * oy);

  // data pulses: a soft glow pass, then the bright core. kept off the fan.
  live.save();
  live.beginPath();
  live.rect(0, 0, 1600, 1000);
  live.arc(fx, fy, r, 0, Math.PI * 2);
  live.clip("evenodd");
  live.lineCap = "round";
  for (const p of pulses) {
    const t = ((sec + p.delay) / p.dur) % 1;
    live.setLineDash([p.len * .05, p.len * .95]);
    live.lineDashOffset = p.len * (1 - t);
    live.strokeStyle = p.color;
    live.globalAlpha = .3; live.lineWidth = 8; live.stroke(p.path);
    live.globalAlpha = 1; live.lineWidth = 3; live.stroke(p.path);
  }
  live.restore();
  live.setLineDash([]);

  // fan blades
  live.save();
  live.translate(fx, fy);
  live.rotate((sec / 2.2) * Math.PI * 2);
  live.fillStyle = "#1c1e1d";
  live.strokeStyle = "#2f3231";
  live.lineWidth = 1;
  for (let i = 0; i < 9; i++) { live.rotate(Math.PI * 2 / 9); live.fill(blade); live.stroke(blade); }
  live.restore();

  // hub sticker
  live.beginPath();
  live.arc(fx, fy, 46, 0, Math.PI * 2);
  live.fillStyle = "#e9e9e5"; live.fill();
  live.lineWidth = 2; live.strokeStyle = "#bfc1c0"; live.stroke();
  live.beginPath();
  live.arc(fx + 18, fy - 16, 5, 0, Math.PI * 2);
  live.fillStyle = GREEN; live.fill();
  live.fillStyle = "#1b1d1c";
  live.font = "700 22px 'JetBrains Mono', Consolas, monospace";
  live.textAlign = "center";
  live.fillText("WM", fx, fy + 8);
}

function layout() {
  const w = internals.clientWidth, h = internals.clientHeight;
  if (!w || !h) return;
  const s = Math.max(w / 1600, h / 1000); // same as preserveAspectRatio="xMidYMid slice"
  view = { w, h, s, ox: (w - 1600 * s) / 2, oy: (h - 1000 * s) / 2 };
  dpr = Math.min(devicePixelRatio || 1, 2);
  liveDpr = Math.min(dpr, 1.5); // the per-frame canvas stays a bit lighter
  cLow.width = cHigh.width = Math.round(w * dpr);
  cLow.height = cHigh.height = Math.round(h * dpr);
  cLive.width = Math.round(w * liveDpr);
  cLive.height = Math.round(h * liveDpr);
  paintStill();
  drawLive(performance.now());
}

Promise.all([toImage(board.low), toImage(board.high)])
  .then(([l, h]) => { imgLow = l; imgHigh = h; paintStill(); })
  .catch(err => console.error("board render failed", err));
document.fonts && document.fonts.ready.then(() => drawLive(performance.now()));

/* ================= scroll: glass lifts, board zooms ================= */
// progress glides toward the real scroll position so wheel "steps" don't jump
let target = 0, current = 0, running = false;
let px = 0, py = 0; // pointer parallax, px

const progress = () => {
  const r = hero.getBoundingClientRect();
  const room = r.height - innerHeight;
  return room > 0 ? clamp(-r.top / room) : 0;
};

// only transform + opacity on a handful of layers: nothing re-lays out or repaints
function apply(p) {
  const a = ease(range(p, 0, .5)), c = ease(range(p, .2, 1));
  internals.style.transform = `translate3d(${px}px, ${py}px, 0) scale(${1 + c * .45})`;
  shade.style.opacity = c * .72;
  frame.style.transform = `scale(${1 + c * .3})`;
  glyphs.style.opacity = 1 - a;
  glass.style.opacity = 1 - a * .9;
  glass.style.transform = `scale(${1 + a * .04})`;
  nav.style.opacity = 1 - a;
  plate.style.opacity = Math.max(0, 1 - a * 1.2);
  plate.style.transform = `translate3d(0, ${-48 * a}px, 0)`;
  hint.style.opacity = Math.max(0, .8 - a * 2);
  // solid black by 88% of the way, so the hero is fully gone before it starts to
  // scroll off (the smoothed progress lags the real scroll a touch)
  fadeOut.style.opacity = ease(range(p, .5, .88));
}

function tick() {
  current += (target - current) * .12;
  if (Math.abs(target - current) < .0005) current = target;
  apply(current);
  if (current !== target) requestAnimationFrame(tick);
  else running = false;
}

function onScroll() {
  target = progress();
  if (reduced) return apply(current = target);
  if (!running) { running = true; requestAnimationFrame(tick); }
}
addEventListener("scroll", onScroll, { passive: true });

addEventListener("resize", onScroll);

// re-render the canvases whenever the board's box changes size (window resize,
// a tab that opened tiny in the background, mobile toolbars...), once per frame
let layoutQueued = false;
new ResizeObserver(() => {
  if (layoutQueued) return;
  layoutQueued = true;
  requestAnimationFrame(() => { layoutQueued = false; layout(); });
}).observe(internals);

let pointerQueued = false;
addEventListener("pointermove", e => {
  const mx = e.clientX / innerWidth, my = e.clientY / innerHeight;
  px = (mx - .5) * -16;
  py = (my - .5) * -12;
  if (pointerQueued) return;
  pointerQueued = true;
  requestAnimationFrame(() => {
    pointerQueued = false;
    glass.style.setProperty("--mx", mx.toFixed(3));
    glass.style.setProperty("--my", my.toFixed(3));
    if (!running) apply(current);
  });
}, { passive: true });

current = target = progress();
layout();
apply(current);

// the live canvas only animates while the hero is on screen
if (!reduced) (function loop(now) {
  if (!document.hidden && current < .999) drawLive(now);
  requestAnimationFrame(loop);
})(performance.now());

/* ================= hover: "the code broke" ================= */
const peek = document.createElement("div");
peek.className = "peek";
document.body.appendChild(peek);

// classes and styles that only exist for animation, hidden from the "source"
const NOISE = ["broken", "reveal", "in"];

function sourceOf(node) {
  const clone = node.cloneNode(true);
  clone.removeAttribute("data-peek");
  clone.removeAttribute("style");
  clone.classList.remove(...NOISE);
  if (!clone.classList.length) clone.removeAttribute("class");
  return clone.outerHTML;
}

function selectorOf(node) {
  const cls = [...node.classList].filter(c => !NOISE.includes(c));
  return node.tagName.toLowerCase() + (cls.length ? "." + cls.join(".") : "");
}

document.querySelectorAll("[data-peek]").forEach(node => {
  node.addEventListener("mouseenter", () => {
    node.classList.add("broken");
    peek.innerHTML =
      `<div class="peek-head"><span class="bp"></span>paused on breakpoint · ${selectorOf(node)}</div>` +
      `<pre>${highlightHTML(sourceOf(node))}</pre>`;
    const r = node.getBoundingClientRect();
    const w = peek.offsetWidth, h = peek.offsetHeight;
    let top = r.bottom + 14;
    if (top + h > innerHeight - 12) top = r.top - h - 14;
    peek.style.left = Math.max(12, Math.min(r.left, innerWidth - w - 12)) + "px";
    peek.style.top = Math.max(12, top) + "px";
    peek.classList.add("on");
  });
  node.addEventListener("mouseleave", () => {
    node.classList.remove("broken");
    peek.classList.remove("on");
  });
});

/* ================= the rest of the page ================= */
// the top bar takes over from the hero nav once the glass has lifted
const topbar = document.querySelector(".topbar");
const toggleTopbar = () => topbar.classList.toggle("on", hero.getBoundingClientRect().bottom < innerHeight * .5);
addEventListener("scroll", toggleTopbar, { passive: true });
toggleTopbar();

// sections fade up as they arrive (cards in a grid stagger slightly)
const reveals = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window && !reduced) {
  document.querySelectorAll("[data-stagger]").forEach(group =>
    [...group.querySelectorAll(".reveal")].forEach((el, i) => (el.style.transitionDelay = `${(i % 6) * 60}ms`)));
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in");
    io.unobserve(e.target);
  }), { rootMargin: "0px 0px -8% 0px" });
  reveals.forEach(el => io.observe(el));
} else {
  reveals.forEach(el => el.classList.add("in"));
}

// TODO(contact): real WhatsApp number, digits only with country code (e.g. "9198XXXXXXXX").
// left empty, wa.me opens WhatsApp with the message ready and lets them pick a chat.
const WHATSAPP_NUMBER = "";
const WHATSAPP_TEXT = "hey WTV, i've got a problem i want solved: ";
document.querySelectorAll(".whatsapp-link").forEach(a => {
  a.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_TEXT)}`;
  a.target = "_blank";
  a.rel = "noopener";
});

// contact form. TODO(backend): actually send the submission — for now it only validates.
const form = document.querySelector(".form");
const formMsg = form.querySelector(".form-msg");
const FORM_OK = "got it. we'll reach out within 24 hours. go do something fun in the meantime.";
const FORM_ERR = "something broke, and not in the cool way. try again, or just whatsapp us."; // for when sending fails
form.addEventListener("submit", e => {
  e.preventDefault();
  const f = form.elements;
  const reachable = f.phone.value.trim() || f.email.value.trim();
  const checks = [[f.name, f.name.value.trim()], [f.problem, f.problem.value.trim()], [f.phone, reachable], [f.email, reachable]];
  checks.forEach(([el, ok]) => el.setAttribute("aria-invalid", ok ? "false" : "true"));
  if (checks.some(([, ok]) => !ok)) {
    formMsg.className = "form-msg wide err";
    formMsg.textContent = "we just need your name, the problem, and a phone or email.";
    return;
  }
  formMsg.className = "form-msg wide ok";
  formMsg.textContent = FORM_OK;
  form.reset();
});

// team "files": arrow keys + click switch tabs
const tabs = [...document.querySelectorAll('.team [role="tab"]')];
const selectTab = tab => tabs.forEach(t => {
  const on = t === tab;
  t.setAttribute("aria-selected", on);
  t.tabIndex = on ? 0 : -1;
  document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
});
tabs.forEach((t, i) => {
  t.addEventListener("click", () => selectTab(t));
  t.addEventListener("keydown", e => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    const next = tabs[(i + step + tabs.length) % tabs.length];
    selectTab(next);
    next.focus();
  });
});

// a different faint, code-themed backdrop for every section. each is an SVG tile,
// generated once and used as a CSS mask, so the section paints it in its own colour
// (see .content > section::after). nothing here animates.
(function backdrops() {
  let s = 11;
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const pick = a => a[Math.floor(r() * a.length)];
  const x = str => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const MONO = `font-family="Consolas, 'JetBrains Mono', monospace"`;
  // any words in a backdrop are dimmed so they stay texture, not something to read
  const tile = (w, h, body) => ({ w, h, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" stroke="#000" fill="#000">${body.replace(/<text /g, '<text opacity=".45" ')}</svg>` });

  const P = {
    // 01 · binary rain: columns of 0/1 with a bright head and a fading tail
    intro() {
      const out = [];
      for (let cx = 12; cx < 600; cx += 48) {
        let y = -Math.round(r() * 300);
        while (y < 640) {
          const len = 6 + Math.floor(r() * 14);
          for (let k = 0; k < len; k++, y += 18) {
            if (y < 0 || y > 600) continue;
            const a = (k === len - 1 ? 1 : .2 + .6 * k / len).toFixed(2);
            out.push(`<text x="${cx}" y="${y}" font-size="14" fill-opacity="${a}" stroke="none" ${MONO}>${r() < .5 ? 0 : 1}</text>`);
          }
          y += 40 + Math.round(r() * 160);
        }
      }
      return tile(600, 600, out.join(""));
    },

    // 02 · a stack trace / error log
    problem() {
      const lines = [
        "TypeError: Cannot read properties of undefined (reading 'total')",
        "    at sumColumn (spreadsheet.js:42:17)",
        "    at Array.map (<anonymous>)",
        "    at copyPasteForward (daily.js:7:3)",
        "Warning: this step is done by hand. again.",
        "    at almostWorks (app-built-for-someone-else.js:118:9)",
        "Error: totals don't match (expected 48,210, got ¯\\_(ツ)_/¯)",
        "    at ai_slop.generate (weekend-build.js:1:1)",
        "UnhandledPromiseRejection: the demo worked though",
        "    at Object.<anonymous> (idea-you-cant-show.js:0:0)",
      ];
      const out = [];
      for (let i = 0, y = 26; y < 620; i++, y += 52) {
        out.push(`<text x="24" y="${y}" font-size="13" fill-opacity="${i % 3 ? .55 : 1}" stroke="none" ${MONO}>${x(lines[i % lines.length])}</text>`);
      }
      return tile(1000, 624, out.join(""));
    },

    // 03 · a hex dump: address, 16 bytes, then the readable text. the bytes spell
    // out the section's own line, so the right-hand column is a little easter egg.
    idea() {
      const msg = "whatever's broken, slow or impossible. we build whatever fixes it. ";
      const bytes = [...msg].map(ch => ch.charCodeAt(0));
      const hex = n => n.toString(16).padStart(2, "0");
      const out = [];
      for (let row = 0, y = 30; y < 620; row++, y += 40) {
        const chunk = Array.from({ length: 16 }, (_, k) => bytes[(row * 16 + k) % bytes.length]);
        const left = chunk.slice(0, 8).map(hex).join(" "), right = chunk.slice(8).map(hex).join(" ");
        const ascii = chunk.map(b => String.fromCharCode(b)).join("");
        out.push(`<text x="24" y="${y}" font-size="13" stroke="none" fill-opacity=".45" ${MONO}>${(0x7f3a00 + row * 16).toString(16).padStart(8, "0")}</text>`);
        out.push(`<text x="128" y="${y}" font-size="13" stroke="none" fill-opacity=".8" ${MONO}>${left}  ${right}</text>`);
        out.push(`<text x="540" y="${y}" font-size="13" stroke="none" ${MONO}>|${x(ascii)}|</text>`);
      }
      return tile(900, 640, out.join(""));
    },

    // 04 · circuit traces
    build() {
      const T = 900, out = [];
      for (let i = 0; i < 13; i++) {
        let px = 40 + Math.round(r() * 82) * 10, py = 40 + Math.round(r() * 82) * 10;
        let dir = Math.floor(r() * 4) * 2, d = `M${px} ${py}`;
        out.push(`<circle cx="${px}" cy="${py}" r="4" fill="none" stroke-width="2"/>`);
        for (let k = 0; k < 3; k++) {
          const len = 50 + r() * 160, a = dir * Math.PI / 4;
          px = Math.min(T - 30, Math.max(30, Math.round(px + Math.cos(a) * len)));
          py = Math.min(T - 30, Math.max(30, Math.round(py + Math.sin(a) * len)));
          d += ` L${px} ${py}`;
          dir = (dir + (r() < .5 ? 1 : 7)) % 8;
        }
        out.push(`<path d="${d}" fill="none" stroke-width="2" stroke-linejoin="round"/>`);
        out.push(`<circle cx="${px}" cy="${py}" r="3.5"/>`);
      }
      for (let i = 0; i < 2; i++) {
        const cx = 60 + Math.round(r() * 70) * 10, cy = 60 + Math.round(r() * 70) * 10, w = 60 + Math.round(r() * 6) * 10, h = 40 + Math.round(r() * 4) * 10;
        out.push(`<rect x="${cx}" y="${cy}" width="${w}" height="${h}" rx="4" fill="none" stroke-width="2"/>`);
        for (let p = cx + 8; p < cx + w - 4; p += 10) out.push(`<path d="M${p} ${cy} v-7 M${p} ${cy + h} v7" stroke-width="2"/>`);
      }
      return tile(T, T, out.join(""));
    },

    // 05 · website wireframes
    work() {
      const out = [];
      const win = (wx, wy, w, h) => {
        out.push(`<rect x="${wx}" y="${wy}" width="${w}" height="${h}" rx="8" fill="none" stroke-width="1.5"/>`);
        out.push(`<path d="M${wx} ${wy + 22} H${wx + w}" stroke-width="1.5"/>`);
        [0, 1, 2].forEach(i => out.push(`<circle cx="${wx + 14 + i * 12}" cy="${wy + 11}" r="3" fill="none" stroke-width="1.5"/>`));
        const ix = wx + 16, iw = w - 32;
        out.push(`<rect x="${ix}" y="${wy + 38}" width="${iw * .45}" height="10" rx="3" stroke="none"/>`);
        out.push(`<rect x="${ix}" y="${wy + 56}" width="${iw * .7}" height="6" rx="3" stroke="none" fill-opacity=".5"/>`);
        const imgW = iw * .42, imgH = h - 110;
        if (imgH > 30) {
          out.push(`<rect x="${ix}" y="${wy + 76}" width="${imgW}" height="${imgH}" rx="4" fill="none" stroke-width="1.5"/>`);
          out.push(`<path d="M${ix} ${wy + 76} L${ix + imgW} ${wy + 76 + imgH} M${ix + imgW} ${wy + 76} L${ix} ${wy + 76 + imgH}" stroke-width="1" stroke-opacity=".6"/>`);
          for (let ly = wy + 80; ly < wy + 76 + imgH; ly += 14) out.push(`<rect x="${ix + imgW + 14}" y="${ly}" width="${(iw - imgW - 14) * (.5 + r() * .5)}" height="5" rx="2.5" stroke="none" fill-opacity=".45"/>`);
        }
        out.push(`<rect x="${ix}" y="${wy + h - 26}" width="70" height="14" rx="7" fill="none" stroke-width="1.5"/>`);
      };
      win(30, 30, 380, 250); win(400, 300, 380, 280);
      return tile(820, 620, out.join(""));
    },

    // 06 · git commit graph
    how() {
      const out = [], lanes = [];
      for (let lx = 40; lx < 720; lx += 180) lanes.push(lx);
      lanes.forEach(lx => {
        out.push(`<path d="M${lx} 0 V800" stroke-width="2" stroke-opacity=".7"/>`);
        for (let cy = 30 + Math.round(r() * 40); cy < 800; cy += 60 + Math.round(r() * 70)) {
          out.push(`<circle cx="${lx}" cy="${cy}" r="6" fill="none" stroke-width="2"/>`);
          if (r() < .45) out.push(`<text x="${lx + 14}" y="${cy + 4}" font-size="11" stroke="none" fill-opacity=".7" ${MONO}>${Math.floor(r() * 0xfffffff).toString(16).padStart(7, "0")}</text>`);
        }
      });
      for (let i = 0; i < 4; i++) { // merges and branch-offs between neighbouring lanes
        const k = Math.floor(r() * (lanes.length - 1)), y1 = 60 + Math.round(r() * 640), dir = r() < .5 ? 1 : -1;
        const a = lanes[k + (dir < 0 ? 1 : 0)], b = lanes[k + (dir < 0 ? 0 : 1)];
        out.push(`<path d="M${a} ${y1} C${a} ${y1 + 40} ${b} ${y1 + 30} ${b} ${y1 + 70}" fill="none" stroke-width="2"/>`);
      }
      return tile(720, 800, out.join(""));
    },

    // 07 · terminal windows
    why() {
      const cmds = [["$ npm run build", "> compiled in 1.2s"], ["$ git push origin main", "> main -> main"], ["$ wtv deploy --prod", "✓ live"], ["$ whoami", "> whatever"], ["$ make it-work", "✓ done"], ["$ sudo fix ai-slop", "✓ 0 hallucinations"]];
      const out = [];
      const term = (tx, ty, w, lines) => {
        const h = 40 + lines * 44;
        out.push(`<rect x="${tx}" y="${ty}" width="${w}" height="${h}" rx="8" fill="none" stroke-width="1.5"/>`);
        out.push(`<path d="M${tx} ${ty + 22} H${tx + w}" stroke-width="1.5"/>`);
        [0, 1, 2].forEach(i => out.push(`<circle cx="${tx + 14 + i * 12}" cy="${ty + 11}" r="3" stroke="none" fill-opacity=".6"/>`));
        let ly = ty + 44;
        for (let i = 0; i < lines; i++) {
          const [c, o] = pick(cmds);
          out.push(`<text x="${tx + 14}" y="${ly}" font-size="13" stroke="none" ${MONO}>${x(c)}</text>`);
          out.push(`<text x="${tx + 14}" y="${ly + 20}" font-size="13" stroke="none" fill-opacity=".5" ${MONO}>${x(o)}</text>`);
          ly += 44;
        }
        out.push(`<text x="${tx + 14}" y="${ly}" font-size="13" stroke="none" ${MONO}>$</text><rect x="${tx + 28}" y="${ly - 11}" width="8" height="14" stroke="none"/>`);
      };
      term(30, 30, 330, 3); term(470, 300, 330, 3);
      return tile(840, 560, out.join(""));
    },

    // 08 · network mesh of nodes
    about() {
      const pts = [], out = [];
      for (let i = 0; i < 17; i++) pts.push([30 + r() * 700, 30 + r() * 700]);
      pts.forEach((p, i) => {
        pts.map((q, j) => [Math.hypot(p[0] - q[0], p[1] - q[1]), j]).filter(([, j]) => j !== i)
          .sort((a, b) => a[0] - b[0]).slice(0, 3)
          .forEach(([dist, j]) => { if (j > i || dist > 140) out.push(`<path d="M${p[0] | 0} ${p[1] | 0} L${pts[j][0] | 0} ${pts[j][1] | 0}" stroke-width="1.2" stroke-opacity=".7"/>`); });
      });
      pts.forEach(([px, py]) => {
        const big = r() < .25;
        out.push(`<circle cx="${px | 0}" cy="${py | 0}" r="${big ? 7 : 3.5}" ${big ? 'fill="none" stroke-width="2"' : 'stroke="none"'}/>`);
      });
      return tile(760, 760, out.join(""));
    },

    // 09 · a code minimap
    faq() {
      const out = [];
      [24].forEach(colX => {
        let indent = 0;
        for (let y = 20; y < 600; y += 9) {
          if (r() < .12) continue; // blank line
          indent = Math.max(0, Math.min(5, indent + (r() < .3 ? 1 : 0) - (r() < .3 ? 1 : 0)));
          const w = 30 + r() * 230, cx = colX + indent * 14;
          const split = r() < .5 ? w * (.2 + r() * .3) : 0;
          if (split) {
            out.push(`<rect x="${cx | 0}" y="${y}" width="${split | 0}" height="4" rx="2" stroke="none"/>`);
            out.push(`<rect x="${(cx + split + 6) | 0}" y="${y}" width="${(w - split) | 0}" height="4" rx="2" stroke="none" fill-opacity=".5"/>`);
          } else out.push(`<rect x="${cx | 0}" y="${y}" width="${w | 0}" height="4" rx="2" stroke="none" fill-opacity=".75"/>`);
        }
      });
      return tile(800, 600, out.join(""));
    },

    // 10 · keyboard keycaps
    contact() {
      const out = [], keys = ["W", "T", "V", "⌘", "↵", "⌥", "⇧", "{", "}", ";", "esc", "tab", "/", "$", "~", "0", "1"];
      const rowOff = [0, 26, 40, 66];
      for (let row = 0; row < 4; row += 2) {
        for (let k = 0, kx = 20 + rowOff[row]; kx < 860; k++, kx += 62) {
          const ky = 20 + row * 62;
          out.push(`<rect x="${kx}" y="${ky}" width="52" height="52" rx="9" fill="none" stroke-width="1.5"/>`);
          out.push(`<rect x="${kx + 6}" y="${ky + 5}" width="40" height="36" rx="6" fill="none" stroke-width="1" stroke-opacity=".5"/>`);
          if (r() < .35) out.push(`<text x="${kx + 12}" y="${ky + 26}" font-size="13" stroke="none" ${MONO}>${x(pick(keys))}</text>`);
        }
      }
      return tile(880, 340, out.join(""));
    },
  };

  for (const [id, make] of Object.entries(P)) {
    const el = document.getElementById(id);
    if (!el) continue;
    const { w, h, svg } = make();
    el.style.setProperty("--pattern", `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
    el.style.setProperty("--pattern-size", `${w}px ${h}px`);
  }
})();

// circuits that hug one corner of each section's content: an L-shaped trace down a
// side margin that turns along the top or bottom, plus one short trace in from the
// screen edge. the corner rotates section to section. they're still (no pulses), so
// the single fixed canvas is only redrawn when you scroll or resize.
(function sectionCircuits() {
  const content = document.querySelector(".content");
  const canvas = document.createElement("canvas");
  canvas.className = "circuit-canvas";
  canvas.setAttribute("aria-hidden", "true");
  content.prepend(canvas);
  const ctx = canvas.getContext("2d");
  const sections = [...content.querySelectorAll(":scope > section")];
  // top-left, top-right, bottom-right, bottom-left, then round again
  const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  let boards = [], cdpr = 1;

  // the box the section's text and cards actually occupy, in page coordinates
  function contentBox(sec) {
    const host = sec.matches(".section") ? sec : sec.querySelector(".section");
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const k of host.children) {
      if (getComputedStyle(k).position === "absolute") continue;
      const rc = k.getBoundingClientRect();
      if (!rc.width || !rc.height) continue;
      l = Math.min(l, rc.left); r = Math.max(r, rc.right);
      t = Math.min(t, rc.top + scrollY); b = Math.max(b, rc.bottom + scrollY);
    }
    return { l, t, r, b };
  }

  function build(sec, idx) {
    let s = 977 + idx * 7919;
    const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    const W = document.documentElement.clientWidth;
    const top = sec.getBoundingClientRect().top + scrollY, H = sec.offsetHeight;
    const c = contentBox(sec);
    const box = { l: c.l, r: c.r, t: c.t - top, b: c.b - top };
    const color = getComputedStyle(sec).getPropertyValue("--sec").trim() || "#2bff72";
    const [sx, sy] = CORNERS[idx % CORNERS.length]; // which side (x) and which edge (y)
    const traces = [], pad = 26;
    const add = pts => traces.push(pts.map(([x, y]) => [Math.round(x), Math.round(y)]));

    const gap = sx < 0 ? box.l : W - box.r;           // width of that side margin
    const w = box.r - box.l, h = box.b - box.t;
    const yEdge = sy < 0 ? Math.max(14, box.t - 34) : Math.min(H - 14, box.b + 34);
    const xFar = sx < 0 ? box.l + w * (.55 + rnd() * .25) : box.r - w * (.55 + rnd() * .25);

    if (gap >= 90) {
      // the L: down the margin, a 45° turn at the corner, then along the content edge
      const vx = sx < 0 ? gap * (.35 + rnd() * .2) : W - gap * (.35 + rnd() * .2);
      const yStart = sy < 0 ? box.t + h * (.55 + rnd() * .25) : box.t + h * (.2 + rnd() * .25);
      const turn = 30;
      add([[vx, yStart], [vx, yEdge - sy * turn], [vx - sx * turn, yEdge], [xFar, yEdge]]);
      // one short trace in from the screen edge, stopping just short of the content
      const y0 = sy < 0 ? box.t + h * (.2 + rnd() * .15) : box.b - h * (.2 + rnd() * .15);
      const edge = sx < 0 ? 0 : W, inner = sx < 0 ? box.l - pad : box.r + pad;
      const x1 = edge - sx * gap * (.15 + rnd() * .15);
      const jog = -sy * (22 + rnd() * 30);
      add([[edge, y0], [x1, y0], [x1 - sx * Math.abs(jog), y0 + jog], [inner, y0 + jog]]);
    } else {
      // no room at the sides (tablets, phones): just the run along the content edge
      add([[sx < 0 ? box.l - 20 : box.r + 20, yEdge], [xFar, yEdge]]);
    }
    return { top, h: H, color, traces };
  }

  const line = pts => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };

  function draw() {
    const vh = innerHeight, y = scrollY;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = .32;
    for (const bd of boards) {
      if (bd.top - y >= vh || bd.top + bd.h - y <= 0) continue;
      ctx.setTransform(cdpr, 0, 0, cdpr, 0, cdpr * (bd.top - y));
      ctx.strokeStyle = ctx.fillStyle = bd.color;
      for (const pts of bd.traces) {
        line(pts);
        const [ax, ay] = pts[0], [ex, ey] = pts[pts.length - 1];
        ctx.beginPath(); ctx.arc(ax, ay, 3.5, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function layout() {
    cdpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(innerWidth * cdpr);
    canvas.height = Math.round(innerHeight * cdpr);
    boards = sections.map(build);
    draw();
  }

  let drawQueued = false;
  addEventListener("scroll", () => {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => { drawQueued = false; draw(); });
  }, { passive: true });

  let layoutQueued = false;
  new ResizeObserver(() => {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(() => { layoutQueued = false; layout(); });
  }).observe(content);
  if (document.fonts) document.fonts.ready.then(layout);
  layout();
})();

/* ================= the monster =================
   a little pixel monster that lives on one edge of the screen in every section
   (feet on the edge, so on the side walls it walks sideways). each section picks
   the edge with free space — the side margin away from that section's circuits,
   or the top/bottom when there's no margin — and never the same edge twice in a
   row, so scrolling into the next section makes it leap across. hidden over the hero. */
(function monster() {
  // ten monsters, one per section. 16 wide, 11 rows of body + 2 rows of legs.
  // X = body (section colour), W = white, K = near-black. `eyes` lists the rows to
  // close when it blinks; `legs` are the two walking poses.
  const L1 = ["....XX....XX....", "...XX......XX..."], L2 = ["....XX....XX....", ".....XX..XX....."];
  const DESIGNS = [
    { name: "horned", eyes: [4, 5], legs: [L1, L2], body: [
      "................", "....X......X....", "....XX....XX....", "....XXXXXXXX....", "...XXXXXXXXXX...", "..XXWWXXXXWWXX..",
      "..XXWKXXXXWKXX..", "..XXXXXXXXXXXX..", ".XXXXXXXXXXXXXX.", ".X.XXKWKKWKXX.X.", "...XXXXXXXXXX..."] },
    { name: "cyclops", eyes: [3, 4, 5], legs: [L1, L2], body: [
      ".......X........", "......XXX.......", "....XXXXXXXX....", "...XXXWWWWXXX...", "..XXXWWKKWWXXX..", "..XXXXWWWWXXXX..",
      "..XXXXXXXXXXXX..", ".XXXXXXXXXXXXXX.", ".X.XXXKKKKXXX.X.", "...XXXXXXXXXX...", "....XXXXXXXX...."] },
    { name: "ghost", eyes: [4, 5], legs: [["...XXXXXXXXXX...", "...X.XX.XX.XX..."], ["...XXXXXXXXXX...", "....XX.XX.XX.X.."]], body: [
      "................", ".....XXXXXX.....", "....XXXXXXXX....", "...XXXXXXXXXX...", "...XWWXXXXWWX...", "...XWKXXXXWKX...",
      "...XXXXXXXXXX...", "...XXXXKKXXXX...", "...XXXXXXXXXX...", "...XXXXXXXXXX...", "...XXXXXXXXXX..."] },
    { name: "invader", eyes: [], legs: [[".....XX..XX.....", "................"], ["...XX......XX...", "................"]], body: [
      "................", "................", "................", "................", "....X......X....", ".....X....X.....",
      "....XXXXXXXX....", "...XX.XXXX.XX...", "..XXXXXXXXXXXX..", "..X.XXXXXXXX.X..", "..X.X......X.X.."] },
    { name: "slime", eyes: [5, 6], legs: [["XXXXXXXXXXXXXXXX", ".XX..XX..XX..XX."], ["XXXXXXXXXXXXXXXX", "..XX..XX..XX..X."]], body: [
      "................", "................", "................", "......XXXX......", "....XXXXXXXX....", "...XXWWXXWWXX...",
      "..XXXWKXXWKXXX..", "..XXXXXXXXXXXX..", ".XXXXXKKKKXXXXX.", ".XXXXXXXXXXXXXX.", "XXXXXXXXXXXXXXXX"] },
    { name: "bat", eyes: [5, 6], legs: [["......X..X......", "................"], [".....X....X.....", "................"]], body: [
      "................", "................", ".....X....X.....", ".....XXXXXX.....", "X...XXXXXXXX...X", "XX..XWWXXWWX..XX",
      "XXX.XWKXXWKX.XXX", "XXXXXXXXXXXXXXXX", ".XXXXXKKKKXXXXX.", "..X.XXXXXXXX.X..", ".....XXXXXX....."] },
    { name: "robot", eyes: [3, 4], legs: [["....XX....XX....", "....XX....XX...."], ["....XX....XX....", "...XXX....XXX..."]], body: [
      ".......X........", "......XXX.......", "...XXXXXXXXXX...", "...XWWXXXXWWX...", "...XWKXXXXWKX...", "...XXXXXXXXXX...",
      "...XKWKWKWKWX...", "...XXXXXXXXXX...", ".XXXXXXXXXXXXXX.", ".X.XXXXXXXXXX.X.", "...XXXXXXXXXX..."] },
    { name: "spiky", eyes: [4, 5], legs: [["....XX...XX.....", "...XX.....XX...."], ["....XX...XX.....", ".....XX.XX......"]], body: [
      "................", "..X..X..X..X....", "...XXXXXXXXX.X..", "..XXXXXXXXXXX...", ".XXXWWXXXXWWXX..", "XXXXWKXXXXWKXXX.",
      ".XXXXXXXXXXXXX..", "XXXXXXKKKKXXXXX.", ".XXXXXXXXXXXXX..", "..XXXXXXXXXXX...", "...XXXXXXXXX...."] },
    { name: "squid", eyes: [5, 6], legs: [["...X.X.XX.X.X...", "..X..X....X..X.."], ["...X.X.XX.X.X...", "....X.X..X.X...."]], body: [
      "................", "......XXXX......", ".....XXXXXX.....", "....XXXXXXXX....", "...XXXXXXXXXX...", "...XWWXXXXWWX...",
      "...XWKXXXXWKX...", "...XXXXXXXXXX...", "...XXXXKKXXXX...", "...XXXXXXXXXX...", "....XXXXXXXX...."] },
    { name: "cat", eyes: [5, 6], legs: [L1, L2], body: [
      "................", "..X..........X..", "..XX........XX..", "..XXXXXXXXXXXX..", "..XXXXXXXXXXXX..", "..XXWWXXXXWWXX..",
      "..XXWKXXXXWKXX..", "..XXXXXKKXXXXX..", ".XXXXXXXXXXXXXX.", "...XXXXXXXXXX...", "....XXXXXXXX...."] },
  ];
  const fix = r => r.padEnd(16, ".").slice(0, 16);
  // walk / blink / jump frames for every design
  const FRAMES = DESIGNS.map(({ body, eyes, legs }) => {
    body = body.map(fix);
    const blink = body.map((r, i) => !eyes.includes(i) ? r
      : i === eyes[eyes.length - 1] ? r.replace(/[WK]/g, "K") : r.replace(/[WK]/g, "X"));
    const arms = body.findIndex((r, i) => i >= 3 && r.includes("X"));
    const jump = body.map((r, i) => (i === arms || i === arms + 1) ? "X" + r.slice(1, 15) + "X" : r);
    // scream: blank white eyes, and the mouth ripped open two rows deep
    const scream = jump.map((r, i) => (eyes.includes(i) ? r.replace(/K/g, "W") : r));
    const lastEye = eyes.length ? eyes[eyes.length - 1] : 3;
    const mouth = scream.reduce((m, r, i) => (i > lastEye && r.includes("K") ? i : m), -1);
    if (mouth >= 0) {
      const a = scream[mouth].indexOf("K") - 1, b = scream[mouth].lastIndexOf("K") + 1;
      [mouth, mouth + 1].forEach(i => {
        if (scream[i]) scream[i] = [...scream[i]].map((ch, x) => (x >= a && x <= b && ch !== "." ? "K" : ch)).join("");
      });
    }
    return {
      a: [...body, ...legs[0].map(fix)],
      b: [...body, ...legs[1].map(fix)],
      blink: [...blink, ...legs[0].map(fix)],
      jump: [...jump, fix(legs[0][1]), "................"],
      scream: [...scream, fix(legs[0][1]), "................"],
    };
  });
  const INK = { W: "#f4f4f0", K: "#050505" };

  const el = document.createElement("div");
  el.className = "monster";
  el.setAttribute("aria-hidden", "true");
  // a 16×16 canvas scaled up with crisp pixels; the 13-row sprite sits at the bottom so its feet touch the edge
  const cv = document.createElement("canvas");
  cv.width = cv.height = 16;
  el.appendChild(cv);
  document.body.appendChild(el);
  const g = cv.getContext("2d");
  const pixel = (ch, color) => (ch === "X" ? color : INK[ch]);

  let drawn = "";
  function drawFrame(look, frame) {
    const key = `${look.d}|${frame}|${look.color}`;
    if (key === drawn) return;
    drawn = key;
    el.style.color = look.color; // the glow
    g.clearRect(0, 0, 16, 16);
    FRAMES[look.d][frame].forEach((row, y) => {
      for (let x = 0; x < 16; x++) {
        const ch = row[x];
        if (ch === ".") continue;
        g.fillStyle = pixel(ch, look.color);
        g.fillRect(x, y + 3, 1, 1);
      }
    });
  }
  // mid-leap: pixels flip from the old monster to the new one in a noisy dissolve
  const NOISE = Array.from({ length: 256 }, () => Math.random());
  function drawMorph(from, to, p) {
    drawn = "";
    g.clearRect(0, 0, 16, 16);
    const A = FRAMES[from.d].jump, B = FRAMES[to.d].jump;
    for (let y = 0; y < 13; y++) for (let x = 0; x < 16; x++) {
      const useNew = NOISE[y * 16 + x] + (Math.random() - .5) * .25 < p;
      const ch = (useNew ? B : A)[y][x];
      if (ch === ".") continue;
      g.fillStyle = pixel(ch, useNew ? to.color : from.color);
      g.fillRect(x, y + 3, 1, 1);
    }
  }

  const sections = [...document.querySelectorAll(".content > section")];
  const topbarEl = document.querySelector(".topbar");
  const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]]; // same rotation as the section circuits
  let S = 48;
  const W = () => document.documentElement.clientWidth;
  const topLimit = () => (topbarEl ? topbarEl.offsetHeight : 0);

  // where the edges are, and how far along each one it can walk
  function bounds(edge) {
    const w = W(), h = innerHeight, top = topLimit();
    return edge === "top" || edge === "bottom"
      ? { axis: "x", min: 8, max: w - S - 8 }
      : { axis: "y", min: top + 8, max: h - S - 8 };
  }
  function at(edge, u) {
    const w = W(), h = innerHeight;
    if (edge === "bottom") return { x: u, y: h - S, r: 0 };
    if (edge === "top") return { x: u, y: topLimit(), r: 180 };
    if (edge === "left") return { x: 0, y: u, r: 90 };
    return { x: w - S, y: u, r: -90 };
  }

  // the content's left/right edges in this section
  function sideRoom(sec) {
    const host = sec.matches(".section") ? sec : sec.querySelector(".section");
    let l = Infinity, r = -Infinity;
    for (const k of host.children) {
      if (getComputedStyle(k).position === "absolute") continue;
      const rc = k.getBoundingClientRect();
      if (!rc.width) continue;
      l = Math.min(l, rc.left); r = Math.max(r, rc.right);
    }
    return { left: l >= S + 24, right: W() - r >= S + 24 };
  }
  function chooseEdge(idx, prev) {
    const [sx, sy] = CORNERS[idx % CORNERS.length];
    const room = { ...sideRoom(sections[idx]), top: true, bottom: true };
    const prefs = [sx < 0 ? "right" : "left", sy < 0 ? "bottom" : "top", sx < 0 ? "left" : "right", sy < 0 ? "top" : "bottom"];
    return prefs.find(e => room[e] && e !== prev) || prefs.find(e => room[e]);
  }

  // state
  let current = -2, edge = null, u = 0, dir = 1, flip = 1, mode = "hidden";
  let flight = null, pauseUntil = 0, nextPause = 0, last = 0;
  let look = null; // { d: design index, color } — what it currently looks like
  const pos = { x: 0, y: 0, r: 0 };
  const SPEED = 46; // px per second
  let pop = 1, freakUntil = 0, coolUntil = 0, sprintUntil = 0;
  let mouse = null; // last known cursor position

  function render() {
    el.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0) rotate(${pos.r.toFixed(1)}deg) scale(${flip * pop}, ${pop})`;
  }
  function faceAlong(edgeName, d) {
    const rad = at(edgeName, 0).r * Math.PI / 180;
    const [mx, my] = bounds(edgeName).axis === "x" ? [d, 0] : [0, d];
    flip = Math.sign(mx * Math.cos(rad) + my * Math.sin(rad)) || 1;
  }

  function leapTo(newEdge, newLook = look) {
    const b = bounds(newEdge);
    const along = b.axis === "x" ? pos.x : pos.y;
    const targetU = Math.min(b.max, Math.max(b.min, along));
    const to = at(newEdge, targetU);
    let dr = ((to.r - pos.r) % 360 + 540) % 360 - 180; // shortest turn
    const fromLook = mode === "flying" ? flight.toLook : look;
    el.classList.remove("freak");
    pop = 1;
    flight = { from: { ...pos }, to: { x: to.x, y: to.y, r: pos.r + dr }, t0: performance.now(), dur: reduced ? 0 : 820, edge: newEdge, u: targetU, fromLook, toLook: newLook };
    mode = "flying";
  }

  function setSection(idx) {
    if (idx === current) return;
    current = idx;
    if (idx < 0) { mode = "hidden"; el.classList.remove("on"); return; }
    const newLook = { d: idx % DESIGNS.length, color: getComputedStyle(sections[idx]).getPropertyValue("--sec").trim() };
    if (!look) look = newLook;
    // mid-leap, "where it is" means the edge it's heading for
    const from = mode === "flying" ? flight.edge : edge;
    const next = chooseEdge(idx, from);
    if (mode === "hidden" && !edge) {
      // first appearance: drop in from above the middle of the screen
      pos.x = W() / 2 - S / 2; pos.y = -S * 2; pos.r = 0;
      el.classList.add("on");
      leapTo(next, newLook);
    } else if (mode === "hidden") {
      el.classList.add("on");
      if (next !== edge) leapTo(next, newLook); else { look = newLook; mode = "walk"; }
    } else if (next !== from) {
      leapTo(next, newLook);
    } else {
      look = newLook; // same edge (rare): just change outfit
    }
  }

  function whichSection() {
    const mid = innerHeight * .5;
    const hero = document.getElementById("hero");
    if (hero.getBoundingClientRect().bottom > mid) return -1;
    for (let i = 0; i < sections.length; i++) if (sections[i].getBoundingClientRect().bottom > mid) return i;
    return sections.length - 1; // the footer counts as the last section
  }

  function tick(now) {
    const dt = Math.min(.05, (now - (last || now)) / 1000);
    last = now;
    if (mode === "flying") {
      const f = flight, t = f.dur ? Math.min(1, (now - f.t0) / f.dur) : 1;
      const e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const mx = (f.from.x + f.to.x) / 2, my = (f.from.y + f.to.y) / 2;
      const cx = W() / 2 - S / 2 - mx, cy = innerHeight / 2 - S / 2 - my, len = Math.hypot(cx, cy) || 1;
      const lift = Math.min(200, 60 + Math.hypot(f.to.x - f.from.x, f.to.y - f.from.y) * .35) * Math.sin(Math.PI * t);
      pos.x = f.from.x + (f.to.x - f.from.x) * e + cx / len * lift;
      pos.y = f.from.y + (f.to.y - f.from.y) * e + cy / len * lift;
      pos.r = f.from.r + (f.to.r - f.from.r) * e;
      const p = Math.min(1, Math.max(0, (t - .3) / .4));
      if (p <= 0) drawFrame(f.fromLook, "jump");
      else if (p >= 1) drawFrame(f.toLook, "jump");
      else drawMorph(f.fromLook, f.toLook, p);
      el.style.color = (p < .5 ? f.fromLook : f.toLook).color; // the glow
      if (t >= 1) {
        look = f.toLook;
        edge = f.edge; u = f.u; mode = "walk";
        pos.r = at(edge, u).r;
        dir = Math.random() < .5 ? 1 : -1;
        faceAlong(edge, dir);
        pauseUntil = now + 500; // a little landing beat
        nextPause = now + 3500 + Math.random() * 4000;
      }
      render();
    } else if (mode === "freak") {
      // shaking, puffed up, flickering between screaming and arms-up
      const p = at(edge, u), shake = reduced ? 0 : 1;
      pos.x = p.x + (Math.random() - .5) * 12 * shake;
      pos.y = p.y + (Math.random() - .5) * 12 * shake;
      pos.r = p.r + (Math.random() - .5) * 34 * shake;
      pop = reduced ? 1.2 : 1.35 + Math.random() * .2;
      drawFrame(look, Math.floor(now / 70) % 3 ? "scream" : "jump");
      render();
      if (now > freakUntil) {
        el.classList.remove("freak");
        pop = 1;
        // then it bolts: half the time a panic-leap to another edge, otherwise a sprint along this one
        const room = sideRoom(sections[current]);
        const others = ["top", "bottom", "left", "right"].filter(e => e !== edge && (e === "top" || e === "bottom" || room[e]));
        if (!reduced && others.length && Math.random() < .5) leapTo(others[Math.floor(Math.random() * others.length)]);
        else { mode = "walk"; sprintUntil = now + 1000; pauseUntil = 0; faceAlong(edge, dir); }
      }
    } else if (mode === "walk") {
      const b = bounds(edge);
      if (now < pauseUntil) {
        const left = pauseUntil - now;
        drawFrame(look, left > 350 && left < 520 ? "blink" : "a");
      } else {
        if (!reduced) u += dir * SPEED * (now < sprintUntil ? 6 : 1) * dt;
        if (u <= b.min || u >= b.max) { u = Math.min(b.max, Math.max(b.min, u)); dir = -dir; faceAlong(edge, dir); }
        drawFrame(look, reduced ? "a" : Math.floor(now / (now < sprintUntil ? 60 : 170)) % 2 ? "b" : "a");
        if (now > nextPause) { pauseUntil = now + 900 + Math.random() * 900; nextPause = pauseUntil + 3000 + Math.random() * 5000; }
      }
      const p = at(edge, u);
      pos.x = p.x; pos.y = p.y; pos.r = p.r;
      render();
      // is the cursor on it? (a little slack, it's small and moving)
      const pad = 6;
      if (mouse && mouse[0] > pos.x - pad && mouse[0] < pos.x + S + pad && mouse[1] > pos.y - pad && mouse[1] < pos.y + S + pad) poke(mouse[0], mouse[1]);
    }
    requestAnimationFrame(tick);
  }

  function size() {
    S = innerWidth < 600 ? 36 : 48;
    el.style.width = el.style.height = S + "px";
    if (edge && current >= 0) {
      // the screen changed: re-pick if this edge no longer has room
      const next = chooseEdge(current, null);
      const b = bounds(edge);
      u = Math.min(b.max, Math.max(b.min, u));
      if (next !== edge && !sideRoom(sections[current])[edge] && (edge === "left" || edge === "right")) leapTo(next);
    }
  }

  // ---- poke it ----
  const YELLS = [
    "AAAAAAAAA!!", "segfault!!", "KERNEL PANIC", "404: chill not found", "sudo leave me alone",
    "rm -rf /fear", "NaN NaN NaN NaN", "undefined is not a function!!", "ctrl+z ctrl+z ctrl+z",
    "while(true) { scream(); }", "stack overflow!!", "who touched prod?!",
  ];
  const bubble = document.createElement("div");
  bubble.className = "monster-say";
  bubble.setAttribute("aria-hidden", "true");
  document.body.appendChild(bubble);
  let bubbleTimer;
  function say(text) {
    bubble.textContent = text;
    bubble.style.color = look.color;
    bubble.classList.add("on");
    // put it beside the monster, on the side facing the middle of the screen
    const cx = pos.x + S / 2, cy = pos.y + S / 2, w = bubble.offsetWidth, h = bubble.offsetHeight;
    const toX = Math.sign(W() / 2 - cx) || 1, toY = Math.sign(innerHeight / 2 - cy) || 1;
    let bx = edge === "left" || edge === "right" ? cx + toX * (S * .9) - (toX < 0 ? w : 0) : cx - w / 2;
    let by = edge === "top" || edge === "bottom" ? cy + toY * (S * .9) - (toY < 0 ? h : 0) : cy - h / 2;
    bubble.style.left = Math.max(8, Math.min(W() - w - 8, bx)) + "px";
    bubble.style.top = Math.max(8, Math.min(innerHeight - h - 8, by)) + "px";
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove("on"), 1500);
  }
  function burst() {
    const cx = pos.x + S / 2, cy = pos.y + S / 2;
    for (let i = 0; i < 14; i++) {
      const bit = document.createElement("i");
      bit.className = "monster-bit";
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70;
      bit.style.cssText = `left:${cx}px;top:${cy}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;background:${i % 4 ? look.color : "#f4f4f0"}`;
      document.body.appendChild(bit);
      bit.addEventListener("animationend", () => bit.remove());
    }
  }
  function poke(x, y) {
    const now = performance.now();
    if (mode !== "walk" || now < coolUntil) return;
    mode = "freak";
    freakUntil = now + 1100;
    coolUntil = now + 2800;
    // when it bolts along its edge, it runs away from the cursor
    const along = bounds(edge).axis === "x" ? x - (pos.x + S / 2) : y - (pos.y + S / 2);
    dir = along > 0 ? -1 : 1;
    el.classList.add("freak");
    say(YELLS[Math.floor(Math.random() * YELLS.length)]);
    if (!reduced) burst();
  }
  // browsers only fire hover events when the *mouse* moves, not when the monster walks
  // under a still cursor, so remember where the mouse is and check it every frame (in tick)
  addEventListener("pointermove", e => { if (e.pointerType !== "touch") mouse = [e.clientX, e.clientY]; }, { passive: true });
  document.documentElement.addEventListener("mouseleave", () => (mouse = null));
  // phones: a tap pokes it
  el.addEventListener("pointerdown", e => poke(e.clientX, e.clientY));

  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; setSection(whichSection()); });
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", () => { size(); onScroll(); });
  size();
  setSection(whichSection());
  requestAnimationFrame(tick);
})();
