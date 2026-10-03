const NS = "http://www.w3.org/2000/svg";

// seeded random so the board is identical on every load
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

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

/* ================= the inside of the computer ================= */
function buildBoard(board) {
  const defs = svg("defs", {}, board);
  const metal = svg("linearGradient", { id: "metal", x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
  [["0", "#a9abaa"], [".45", "#6b6e6d"], [".55", "#8f9291"], ["1", "#505352"]]
    .forEach(([offset, c]) => svg("stop", { offset, "stop-color": c }, metal));
  const dots = svg("pattern", { id: "dots", width: 22, height: 22, patternUnits: "userSpaceOnUse" }, defs);
  svg("circle", { cx: 11, cy: 11, r: 1, fill: "#1b1d1c" }, dots);

  svg("rect", { width: 1600, height: 1000, fill: "#0b0c0c" }, board);
  svg("rect", { width: 1600, height: 1000, fill: "url(#dots)" }, board);

  const traces = svg("g", { class: "traces" }, board);
  const pulses = svg("g", { class: "pulses" }, board);
  const parts = svg("g", { class: "parts" }, board);
  const silk = svg("g", { class: "silk" }, board);

  const live = [];
  const trace = (d, pulse = rand() < .5) => {
    svg("path", { d }, traces);
    if (pulse) live.push(d);
  };
  const via = (x, y) => svg("circle", { cx: x, cy: y, r: 4, fill: "#0b0c0c", stroke: "#2f3332", "stroke-width": 2 }, traces);
  const label = (x, y, s, o = {}) => text(silk, x, y, s, { size: 12, opacity: .5, ...o });

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

  live.forEach(d => {
    // about half the data is plain white, the rest is coloured like syntax tokens
    const tone = rand() < .5 ? "" : " " + ["kw", "str", "fn", "type", "ctrl"][Math.floor(rand() * 5)];
    const p = svg("path", { d, pathLength: 100, class: "pulse" + tone }, pulses);
    p.style.animationDuration = (2.6 + rand() * 4).toFixed(2) + "s";
    p.style.animationDelay = (-rand() * 6).toFixed(2) + "s";
  });

  /* ---- parts ---- */
  const ic = (x, y, w, h, name) => {
    const g = svg("g", {}, parts);
    for (let py = y + 8; py < y + h - 6; py += 9) {
      svg("rect", { x: x - 6, y: py, width: 6, height: 4, fill: "#5d605f" }, g);
      svg("rect", { x: x + w, y: py, width: 6, height: 4, fill: "#5d605f" }, g);
    }
    svg("rect", { x, y, width: w, height: h, rx: 3, fill: "#0e0f0f", stroke: "#2a2c2b", "stroke-width": 1.5 }, g);
    svg("circle", { cx: x + 8, cy: y + 8, r: 2.5, fill: "#2f3231" }, g);
    if (name) label(x, y - 10, name, { size: 11 });
  };
  const cap = (x, y, r = 13) => {
    const g = svg("g", {}, parts);
    svg("circle", { cx: x, cy: y, r, fill: "#1a1b1b", stroke: "#4b4e4d", "stroke-width": 2 }, g);
    svg("path", { d: `M${x - r * .55} ${y} H${x + r * .55} M${x} ${y - r * .55} V${y + r * .55}`, stroke: "#303332", "stroke-width": 2 }, g);
  };
  const resistors = (x, y, n) => {
    for (let i = 0; i < n; i++) {
      const rx = x + i * 16;
      svg("rect", { x: rx, y, width: 10, height: 6, fill: "#1c1d1d" }, parts);
      svg("rect", { x: rx, y, width: 2.5, height: 6, fill: "#8a8d8c" }, parts);
      svg("rect", { x: rx + 7.5, y, width: 2.5, height: 6, fill: "#8a8d8c" }, parts);
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
  for (let i = 0; i < 8; i++) svg("path", { d: `M60 ${124 + i * 6.5} H440`, stroke: "#2b2d2c", "stroke-width": 1.5 }, parts);
  svg("rect", { x: 440, y: 108, width: 60, height: 76, rx: 4, fill: "#202221", stroke: "#3a3c3b", "stroke-width": 1.5 }, parts);
  label(60, 106, "J1 · FLEX");
  text(silk, 60, 198, "// TODO: hide the cables", { size: 11, fill: "#6a9955", opacity: .7 });

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
    label(x + 13, 758, ["A1", "A2", "B1", "B2"][k], { anchor: "middle" });
  }
  sticker(1013, 440, 20, 150);
  text(parts, 1027, 582, "DDR5 · 32GB · 6400", { size: 10, fill: "#0e639c", rotate: -90 });

  // fan
  const fx = 1330, fy = 330;
  svg("rect", { x: 1160, y: 160, width: 340, height: 340, rx: 34, fill: "#0f1010", stroke: "#2c2e2d", "stroke-width": 2 }, parts);
  [[1190, 190], [1470, 190], [1190, 470], [1470, 470]].forEach(([x, y]) =>
    svg("circle", { cx: x, cy: y, r: 9, fill: "#050505", stroke: "#4a4d4c", "stroke-width": 2 }, parts));
  svg("circle", { cx: fx, cy: fy, r: 158, fill: "#070808", stroke: "#262827", "stroke-width": 3 }, parts);
  const blades = svg("g", { class: "fan" }, parts);
  const blade = `M${fx + 42} ${fy - 8} C${fx + 90} ${fy - 30} ${fx + 130} ${fy - 72} ${fx + 152} ${fy - 50} C${fx + 140} ${fy - 8} ${fx + 100} ${fy + 22} ${fx + 40} ${fy + 18} Z`;
  for (let i = 0; i < 9; i++) svg("path", { d: blade, fill: "#1c1e1d", stroke: "#2f3231", transform: `rotate(${i * 40} ${fx} ${fy})` }, blades);
  svg("circle", { cx: fx, cy: fy, r: 46, fill: "#e9e9e5" }, parts);
  svg("circle", { cx: fx + 18, cy: fy - 16, r: 5, fill: "#4ec9b0" }, parts);
  text(parts, fx, fy + 8, "WM", { size: 22, weight: 700, fill: "#1b1d1c", anchor: "middle" });
  label(1160, 148, "FAN1");

  // M.2 SSD
  for (let i = 0; i < 10; i++) svg("rect", { x: 168, y: 766 + i * 6, width: 12, height: 3, fill: "#8a8d8c" }, parts);
  svg("rect", { x: 180, y: 760, width: 540, height: 70, rx: 6, fill: "#18191a", stroke: "#2c2e2d" }, parts);
  svg("rect", { x: 196, y: 772, width: 56, height: 46, rx: 2, fill: "#0e0f0f" }, parts);
  sticker(266, 770, 210, 50);
  text(parts, 278, 791, "NVMe · 2TB", { size: 13, weight: 700, fill: "#1b1d1c" });
  text(parts, 278, 809, "// whatever.monster/ssd", { size: 10, fill: "#3f7f3f" });
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
  label(1416, 838, "DO NOT LICK", { size: 10, opacity: .45 });

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

  label(1180, 950, "WHATEVER.MONSTER  ·  REV 0.1", { size: 14, opacity: .55 });
  label(84, 950, "MADE BY HUMANS. DEBUGGED BY MORE HUMANS.", { size: 11, opacity: .4 });
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

/* ================= scroll: glass lifts, board zooms ================= */
const clamp = v => Math.min(1, Math.max(0, v));
const range = (v, a, b) => clamp((v - a) / (b - a));
const ease = t => t * t * (3 - 2 * t);

const hero = document.getElementById("hero");
const stage = hero.querySelector(".stage");
buildBoard(stage.querySelector(".board"));

// progress glides toward the real scroll position so wheel "steps" don't jump
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
let target = 0, current = 0, running = false;

const progress = () => {
  const r = hero.getBoundingClientRect();
  const room = r.height - innerHeight;
  return room > 0 ? clamp(-r.top / room) : 0;
};

function apply(p) {
  stage.style.setProperty("--a", ease(range(p, 0, .5)).toFixed(4));
  stage.style.setProperty("--c", ease(range(p, .2, 1)).toFixed(4));
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
current = target = progress();
apply(current);

addEventListener("pointermove", e => {
  stage.style.setProperty("--mx", (e.clientX / innerWidth).toFixed(3));
  stage.style.setProperty("--my", (e.clientY / innerHeight).toFixed(3));
}, { passive: true });

/* ================= hover: "the code broke" ================= */
const peek = document.createElement("div");
peek.className = "peek";
document.body.appendChild(peek);

function sourceOf(node) {
  const clone = node.cloneNode(true);
  clone.removeAttribute("data-peek");
  clone.classList.remove("broken");
  if (!clone.classList.length) clone.removeAttribute("class");
  return clone.outerHTML;
}

function selectorOf(node) {
  const cls = [...node.classList].filter(c => c !== "broken");
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
