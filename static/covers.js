/* Kernel Ideas — original cover art, drawn in SVG (no external images).
   Every curated source gets its own 3D-style object tied to its title.
   Sources without one (e.g. ideas you add yourself) get a generic object for their format.

   KernelArt.cover(title, kind, topicColor) → full 300×400 cover artwork (sits under the title overlay)
   KernelArt.motif(title, kind, topicColor) → the object alone on a transparent 300×300 canvas (feed cards)

   To add art for a new source: add an entry to MOTIFS keyed by slug(title).
   Each motif draws in a 300×300 box, centre x≈150, ground y≈245. */
(() => {
"use strict";

/* ── colour helpers ── */
const rgb = h => { h = h.replace("#", ""); if (h.length === 3) h = [...h].map(c => c + c).join(""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const hex = a => "#" + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v + (B[i] - v) * t)); };
const lt = (c, t = .3) => mix(c, "#ffffff", t);
const dk = (c, t = .3) => mix(c, "#000000", t);
const f = v => +(+v).toFixed(1);
const pts = a => a.map(p => `${f(p[0])},${f(p[1])}`).join(" ");

/* palette for objects (topic colour is the background) */
const C = { gold: "#f4b740", cream: "#f6eee1", coral: "#ff7a52", mint: "#7fd9ae", sky: "#86bdf2", lilac: "#b7a2ef",
  ink: "#2c3140", white: "#fbfbfd", rose: "#ff8ca1", wood: "#c98a4b", stone: "#b9b0a3", leaf: "#58b77d", brick: "#d9653f", glass: "#cfe8ff" };

let N = 0;
/* A drawing context: collects gradient defs with ids unique to this render
   (the same cover can be on the page twice, sometimes inside a hidden view). */
class Pen {
  constructor() { this.id = "ka" + (N++).toString(36); this.n = 0; this.defs = []; }
  uid() { return `${this.id}-${this.n++}`; }
  stops(s) { return s.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}"${a !== 1 ? ` stop-opacity="${a}"` : ""}/>`).join(""); }
  lin(s, x1 = 0, y1 = 0, x2 = 0, y2 = 1) { const id = this.uid(); this.defs.push(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${this.stops(s)}</linearGradient>`); return `url(#${id})`; }
  rad(s, cx = .5, cy = .5, r = .5, fx = cx, fy = cy) { const id = this.uid(); this.defs.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" fx="${fx}" fy="${fy}">${this.stops(s)}</radialGradient>`); return `url(#${id})`; }

  /* soft contact shadow on the ground */
  shadow(cx, cy, rx, ry = rx * .2, a = .32) { return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${this.rad([[0, "#000", a], [1, "#000", 0]])}"/>`; }
  glow(cx, cy, r, c = "#fff", a = .55) { return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${this.rad([[0, c, a], [1, c, 0]])}"/>`; }
  /* shaded sphere with a specular highlight */
  ball(cx, cy, r, c) {
    return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${this.rad([[0, lt(c, .62)], [.3, lt(c, .2)], [.72, c], [1, dk(c, .32)]], .38, .32, .78)}"/>` +
      `<ellipse cx="${f(cx - r * .34)}" cy="${f(cy - r * .4)}" rx="${f(r * .24)}" ry="${f(r * .13)}" fill="#fff" opacity=".6" transform="rotate(-32 ${f(cx - r * .34)} ${f(cy - r * .4)})"/>`;
  }
  /* isometric box: front-bottom corner at (cx,by); w along the right axis, d along the left axis, h up */
  box(cx, by, w, d, h, c, extra = {}) {
    const R = [.866, -.5], L = [-.866, -.5], F = [cx, by];
    const Rp = [cx + w * R[0], by + w * R[1]], Lp = [cx + d * L[0], by + d * L[1]], B = [Rp[0] + d * L[0], Rp[1] + d * L[1]];
    const up = p => [p[0], p[1] - h];
    this.last = { F, Rp, Lp, B, up, w, d, h };
    return `<polygon points="${pts([Lp, F, up(F), up(Lp)])}" fill="${extra.left || this.lin([[0, c], [1, dk(c, .12)]])}"/>` +
      `<polygon points="${pts([F, Rp, up(Rp), up(F)])}" fill="${extra.right || this.lin([[0, dk(c, .24)], [1, dk(c, .36)]])}"/>` +
      `<polygon points="${pts([up(F), up(Rp), up(B), up(Lp)])}" fill="${extra.top || this.lin([[0, lt(c, .42)], [1, lt(c, .16)]], 0, 0, 1, 1)}"/>`;
  }
  /* point on the last box's top face (u along w, v along d, 0..1) */
  top(u, v) { const { F, w, d, h } = this.last; return [F[0] + u * w * .866 - v * d * .866, F[1] - h - u * w * .5 - v * d * .5]; }
  /* point on the last box's left face (u along d, v up, 0..1) */
  left(u, v) { const { F, d, h } = this.last; return [F[0] - u * d * .866, F[1] - u * d * .5 - v * h]; }
  /* upright cylinder, base centre (cx,by) */
  cyl(cx, by, rx, h, c, ry = rx * .32) {
    return `<path d="M${f(cx - rx)} ${f(by - h)}L${f(cx - rx)} ${f(by)}A${f(rx)} ${f(ry)} 0 0 0 ${f(cx + rx)} ${f(by)}L${f(cx + rx)} ${f(by - h)}Z" fill="${this.lin([[0, dk(c, .2)], [.32, lt(c, .2)], [.68, c], [1, dk(c, .34)]], 0, 0, 1, 0)}"/>` +
      `<ellipse cx="${f(cx)}" cy="${f(by - h)}" rx="${f(rx)}" ry="${f(ry)}" fill="${this.lin([[0, lt(c, .46)], [1, lt(c, .14)]])}"/>`;
  }
  /* front-facing rounded slab with visible thickness */
  slab(x, y, w, h, r, c, depth = 8) {
    return `<rect x="${f(x)}" y="${f(y + depth)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="${dk(c, .34)}"/>` +
      `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="${this.lin([[0, lt(c, .22)], [1, dk(c, .04)]])}"/>`;
  }
  /* any filled path, extruded toward bottom-right by `depth` px */
  solid(d, c, depth = 0, tf = "") {
    let s = "";
    for (let i = depth; i > 0; i -= 1.5) s += `<path d="${d}" fill="${dk(c, .36)}" transform="translate(${f(i * .45)} ${f(i)})"/>`;
    return `<g${tf ? ` transform="${tf}"` : ""}>${s}<path d="${d}" fill="${this.lin([[0, lt(c, .3)], [1, dk(c, .06)]])}"/></g>`;
  }
  /* rounded 3D tube along a path (rods, handles, roads) */
  tube(d, c, w, cap = "round") {
    const p = (stroke, sw, tx, op = 1) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${f(sw)}" stroke-linecap="${cap}" stroke-linejoin="round"${tx ? ` transform="translate(${tx})"` : ""}${op < 1 ? ` opacity="${op}"` : ""}/>`;
    return p(dk(c, .32), w) + p(c, w * .7, `${f(-w * .06)} ${f(-w * .1)}`) + p(lt(c, .55), w * .2, `${f(-w * .16)} ${f(-w * .24)}`, .8);
  }
  /* extruded text */
  text(x, y, str, size, c, depth = 6, weight = 800, anchor = "middle") {
    const t = (fill, dx, dy) => `<text x="${f(x + dx)}" y="${f(y + dy)}" font-family="Figtree, system-ui, sans-serif" font-weight="${weight}" font-size="${size}" text-anchor="${anchor}" fill="${fill}">${str}</text>`;
    let s = ""; for (let i = depth; i > 0; i--) s += t(dk(c, .38), i * .45, i);
    return s + t(lt(c, .12), 0, 0);
  }
  /* 4-point sparkle */
  star(cx, cy, r, c = "#fff") { return `<path d="M${cx} ${cy - r}Q${cx + r * .18} ${cy - r * .18} ${cx + r} ${cy}Q${cx + r * .18} ${cy + r * .18} ${cx} ${cy + r}Q${cx - r * .18} ${cy + r * .18} ${cx - r} ${cy}Q${cx - r * .18} ${cy - r * .18} ${cx} ${cy - r}Z" fill="${c}"/>`; }
}

/* ── the motifs, one per curated source ── */
const MOTIFS = {
  /* HABITS */
  "atomic-habits": (g) => { // tiny cubes stack into a staircase: small actions compound
    let s = g.shadow(150, 238, 120, 24);
    const sz = 34, cols = [1, 2, 3, 4], x0 = 92, y0 = 238;
    for (let i = cols.length - 1; i >= 0; i--) {
      const cx = x0 + i * sz * .866, by = y0 - i * sz * .5;
      for (let j = 0; j < cols[i]; j++) s += g.box(cx, by - j * sz, sz, sz, sz, i === 3 && j === 3 ? C.gold : C.cream);
    }
    s += g.glow(x0 + 3 * sz * .866, y0 - 1.5 * sz - 4 * sz + 8, 46, C.gold, .5);
    return s + g.box(40, 250, 14, 14, 14, C.gold);
  },
  "the-power-of-habit": (g) => { // the habit loop: cue → routine → reward
    const ring = (d) => g.tube(d, C.cream, 22);
    let s = g.shadow(150, 236, 120, 22);
    s += ring("M60 158 A92 46 0 0 1 240 158"); // back half
    s += g.ball(68, 150, 20, C.coral) + g.ball(232, 150, 20, C.mint);
    s += ring("M240 158 A92 46 0 0 1 60 158"); // front half over the balls' feet
    s += g.ball(150, 196, 28, C.gold);
    return s;
  },
  /* FOCUS */
  "deep-work": (g, T) => { // a tunnel inward toward one bright point
    let s = "";
    for (let i = 0; i < 7; i++) {
      const k = Math.pow(.76, i), w = 230 * k, h = 200 * k, x = 150 - w / 2, y = 132 - h / 2 + 8 * (1 - k);
      s += `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(26 * k)}" fill="${i % 2 ? dk(T, .18 + i * .07) : lt(T, .16 - i * .02)}" stroke="${lt(T, .4)}" stroke-opacity=".25"/>`;
    }
    return s + g.glow(150, 134, 60, C.gold, .7) + g.ball(150, 134, 11, C.gold) + g.shadow(150, 248, 110, 14, .18);
  },
  "getting-things-done": (g) => { // inbox trays and a big check
    let s = g.shadow(150, 236, 118, 22);
    for (let k = 0; k < 3; k++) s += g.box(150, 232 - k * 30, 92, 92, 12, k === 2 ? C.cream : lt(C.sky, .2));
    s += g.tube("M108 108 L138 138 L196 74", C.gold, 22);
    return s;
  },
  "maker-s-schedule-manager-s-schedule": (g) => { // one long block vs a day chopped into pieces
    let s = g.shadow(150, 246, 120, 16) + g.slab(36, 56, 228, 178, 18, C.cream, 10);
    s += g.cyl(96, 62, 8, 18, C.ink) + g.cyl(204, 62, 8, 18, C.ink);
    s += g.slab(54, 92, 192, 50, 12, C.mint, 6);
    [[54, 30], [92, 22], [122, 34], [164, 18], [190, 26], [224, 22]].forEach(([x, w], i) =>
      s += g.slab(x, 164, w - 4, 50, 8, i % 2 ? C.coral : lt(C.coral, .25), 6));
    return s;
  },
  "inside-the-mind-of-a-master-procrastinator": (g) => { // the alarm clock you keep snoozing
    let s = g.shadow(150, 248, 90, 16);
    s += g.tube("M96 236 L110 214 M204 236 L190 214", C.ink, 10);
    s += g.ball(92, 82, 24, C.gold) + g.ball(208, 82, 24, C.gold);
    s += `<circle cx="150" cy="150" r="86" fill="${g.rad([[0, lt(C.coral, .35)], [.7, C.coral], [1, dk(C.coral, .35)]], .38, .32, .8)}"/>`;
    s += `<circle cx="150" cy="150" r="66" fill="${g.lin([[0, C.white], [1, C.cream]])}"/>`;
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; s += `<circle cx="${f(150 + Math.sin(a) * 54)}" cy="${f(150 - Math.cos(a) * 54)}" r="${i % 3 ? 2.5 : 4.5}" fill="${C.ink}" opacity=".7"/>`; }
    s += `<path d="M150 150 L150 106 M150 150 L182 162" stroke="${C.ink}" stroke-width="7" stroke-linecap="round"/><circle cx="150" cy="150" r="7" fill="${C.coral}"/>`;
    s += `<text x="232" y="62" font-family="Figtree, system-ui" font-weight="800" font-size="26" fill="${C.cream}" opacity=".9">z</text><text x="250" y="40" font-family="Figtree, system-ui" font-weight="800" font-size="18" fill="${C.cream}" opacity=".7">z</text>`;
    return s;
  },
  /* MINDSET */
  "mindset": (g) => { // a seed that grows
    let s = g.shadow(150, 246, 80, 14);
    s += g.tube("M150 196 C150 160 146 130 152 96", C.leaf, 12);
    s += g.solid("M150 120 C126 84 84 84 66 104 C92 130 128 132 150 120Z", C.leaf, 4);
    s += g.solid("M152 98 C178 52 230 50 246 74 C220 106 176 112 152 98Z", lt(C.leaf, .15), 4);
    return s + g.ball(150, 204, 44, C.wood);
  },
  "man-s-search-for-meaning": (g) => { // one candle in the dark
    let s = `<circle cx="150" cy="96" r="130" fill="${g.rad([[0, "#000", 0], [1, "#000", .25]])}"/>`;
    s += g.glow(150, 92, 110, C.gold, .55) + g.shadow(150, 250, 70, 12);
    s += g.cyl(150, 246, 34, 116, C.cream, 11);
    s += `<path d="M150 132 L150 118" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/>`;
    s += `<path d="M150 62 C166 88 170 104 150 120 C130 104 134 88 150 62Z" fill="${g.lin([[0, "#fff6d8"], [.6, C.gold], [1, C.coral]])}"/>`;
    return s + `<path d="M150 84 C157 98 157 106 150 114 C143 106 143 98 150 84Z" fill="#fff" opacity=".85"/>`;
  },
  "the-obstacle-is-the-way": (g) => { // the path goes over the boulder, not around it
    let s = g.shadow(150, 244, 124, 18);
    s += `<polygon points="60,240 80,150 138,104 214,118 246,192 228,242" fill="${dk(C.stone, .12)}"/>`;
    s += `<polygon points="80,150 138,104 214,118 160,160" fill="${lt(C.stone, .25)}"/>`;
    s += `<polygon points="214,118 246,192 228,242 160,160" fill="${dk(C.stone, .32)}"/>`;
    s += `<polygon points="60,240 80,150 160,160 140,242" fill="${C.stone}"/>`;
    s += g.tube("M30 262 C70 250 82 210 100 186 C120 160 150 152 168 120", C.cream, 15);
    s += `<path d="M168 120 L168 62" stroke="${C.ink}" stroke-width="5" stroke-linecap="round"/>`;
    return s + g.solid("M170 62 L212 74 L170 88Z", C.coral, 3);
  },
  "grit-the-power-of-passion-and-perseverance": (g, T) => { // the long way up
    let s = g.shadow(150, 246, 128, 14);
    s += `<polygon points="150,52 30,244 172,244" fill="${g.lin([[0, lt(T, .5)], [1, lt(T, .15)]])}"/>`;
    s += `<polygon points="150,52 172,244 272,244" fill="${g.lin([[0, dk(T, .1)], [1, dk(T, .35)]])}"/>`;
    s += `<polygon points="150,52 124,94 140,88 152,100 164,88 176,98" fill="${C.white}"/>`;
    s += `<path d="M88 238 L128 214 L102 190 L144 166 L120 140 L150 112 L142 92" fill="none" stroke="${C.cream}" stroke-width="5" stroke-dasharray="2 9" stroke-linecap="round"/>`;
    s += `<path d="M150 54 L150 18" stroke="${C.ink}" stroke-width="4" stroke-linecap="round"/>`;
    return s + g.solid("M152 18 L184 27 L152 37Z", C.coral, 3);
  },
  /* LEARNING */
  "make-it-stick": (g) => { // a note pinned in place
    let s = g.shadow(150, 244, 100, 14);
    s += g.solid("M74 70 H228 V206 H74Z", lt(C.sky, .45), 6, "rotate(8 150 140)");
    s += g.solid("M70 82 H226 V220 H70Z", C.cream, 8, "rotate(-5 150 150)");
    s += `<g transform="rotate(-5 150 150)" stroke="${C.ink}" stroke-opacity=".28" stroke-width="5" stroke-linecap="round"><path d="M96 134 H196M96 156 H200M96 178 H168"/></g>`;
    s += `<path d="M152 106 L146 128" stroke="#8a8f99" stroke-width="4" stroke-linecap="round"/>`;
    return s + g.ball(154, 96, 18, C.coral);
  },
  "peak": (g) => { // practice builds height, step by step
    let s = g.shadow(150, 246, 118, 18);
    [[76, 52, C.cream], [120, 86, C.cream], [164, 124, lt(C.gold, .45)], [210, 168, C.gold]].forEach(([x, h, c]) => s += g.cyl(x, 236, 19, h, c));
    return s + g.glow(210, 62, 50, C.gold, .6) + g.star(210, 46, 18, "#fff");
  },
  "learning-how-to-learn": (g) => { // the cap you earn by learning how
    let s = g.shadow(150, 246, 104, 16);
    s += g.box(150, 238, 96, 96, 26, C.coral);
    s += g.box(150, 210, 90, 90, 22, C.sky);
    s += `<path d="M96 122 L96 160 C120 182 180 182 204 160 L204 122Z" fill="${g.lin([[0, dk(C.ink, .1)], [.4, lt(C.ink, .2)], [1, dk(C.ink, .3)]], 0, 0, 1, 0)}"/>`;
    s += `<polygon points="150,64 262,112 150,160 38,112" fill="${dk(C.ink, .3)}" transform="translate(0 8)"/><polygon points="150,64 262,112 150,160 38,112" fill="${g.lin([[0, lt(C.ink, .25)], [1, C.ink]], 0, 0, 1, 1)}"/>`;
    s += `<path d="M150 112 L236 124 L236 170" fill="none" stroke="${C.gold}" stroke-width="4" stroke-linecap="round"/>`;
    return s + g.ball(150, 112, 7, C.gold) + g.solid("M228 168 H244 L248 196 H224Z", C.gold, 2);
  },
  "the-feynman-technique": (g) => { // explain it simply, on a chalkboard
    let s = g.shadow(150, 248, 120, 12);
    s += g.slab(30, 52, 240, 168, 14, C.wood, 8) + `<rect x="42" y="64" width="216" height="144" rx="8" fill="${g.lin([[0, "#3c5e51"], [1, "#2a463c"]])}"/>`;
    s += `<g fill="none" stroke="#fff" stroke-opacity=".82" stroke-width="3">${[0, 60, 120].map(a => `<ellipse cx="150" cy="134" rx="66" ry="22" transform="rotate(${a} 150 134)"/>`).join("")}</g>`;
    s += g.ball(150, 134, 11, C.gold);
    return s + g.slab(54, 226, 192, 10, 4, dk(C.wood, .1), 4) + g.slab(196, 216, 34, 9, 4, C.white, 3);
  },
  /* MONEY */
  "the-psychology-of-money": (g) => { // money is feelings as much as maths
    let s = g.shadow(150, 248, 90, 14);
    s += `<ellipse cx="160" cy="150" rx="76" ry="86" fill="${dk(C.gold, .3)}"/>`;
    s += `<ellipse cx="150" cy="150" rx="76" ry="86" fill="${g.rad([[0, lt(C.gold, .55)], [.6, C.gold], [1, dk(C.gold, .22)]], .36, .3, .8)}"/>`;
    s += `<ellipse cx="150" cy="150" rx="60" ry="69" fill="none" stroke="${dk(C.gold, .18)}" stroke-width="4"/>`;
    s += g.solid("M150 196 C110 168 106 132 126 124 C138 119 148 126 150 136 C152 126 162 119 174 124 C194 132 190 168 150 196Z", C.coral, 5);
    return s + g.ball(240, 72, 12, C.gold) + g.ball(258, 46, 7, C.gold) + g.ball(226, 100, 6, lt(C.gold, .3));
  },
  "i-will-teach-you-to-be-rich": (g) => { // money flows into buckets on its own
    let s = g.shadow(150, 248, 126, 16);
    s += g.tube("M46 64 H254 M84 64 V96 M150 64 V96 M216 64 V96", "#9aa4b2", 12);
    [[84, 34], [150, 64], [216, 96]].forEach(([x, lvl]) => {
      s += g.cyl(x, 236, 30, 128, C.glass, 9).replace(/fill="url/g, 'fill-opacity=".45" fill="url');
      s += g.cyl(x, 234, 26, lvl, C.gold, 8);
      s += `<path d="M${x - 30} ${236 - 128} V236" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>`;
    });
    return s + g.ball(150, 108, 7, C.gold) + g.ball(216, 116, 6, C.gold);
  },
  /* PEOPLE */
  "how-to-win-friends-and-influence-people": (g) => { // friendly faces, connected
    const smile = (x, y, r) => `<path d="M${f(x - r * .35)} ${f(y + r * .12)} Q${x} ${f(y + r * .5)} ${f(x + r * .35)} ${f(y + r * .12)}" fill="none" stroke="${C.ink}" stroke-width="${f(r * .1)}" stroke-linecap="round"/><circle cx="${f(x - r * .3)}" cy="${f(y - r * .14)}" r="${f(r * .08)}" fill="${C.ink}"/><circle cx="${f(x + r * .3)}" cy="${f(y - r * .14)}" r="${f(r * .08)}" fill="${C.ink}"/>`;
    const P = [[150, 150, 34, C.coral], [74, 92, 24, C.gold], [228, 96, 24, C.mint], [96, 226, 22, C.sky], [214, 222, 22, C.lilac]];
    let s = g.shadow(150, 256, 110, 12);
    P.slice(1).forEach(([x, y]) => s += g.tube(`M150 150 L${x} ${y}`, C.cream, 10));
    P.forEach(([x, y, r, c]) => s += g.ball(x, y, r, c) + smile(x, y, r));
    return s;
  },
  "never-split-the-difference": (g) => { // the negotiator's phone line
    let s = g.shadow(150, 248, 110, 14);
    s += g.solid("M72 238 L90 150 Q150 134 210 150 L228 238Z", C.coral, 8);
    s += `<circle cx="150" cy="196" r="32" fill="${g.lin([[0, C.white], [1, C.cream]])}"/>`;
    for (let i = 0; i < 10; i++) { const a = -Math.PI * .8 + i * Math.PI * .16; s += `<circle cx="${f(150 + Math.cos(a) * 21)}" cy="${f(196 + Math.sin(a) * 21)}" r="4" fill="${C.ink}" opacity=".55"/>`; }
    s += `<circle cx="150" cy="196" r="9" fill="${C.coral}"/>`;
    s += g.tube("M80 132 Q76 100 112 98 L188 98 Q224 100 220 132", dk(C.coral, .15), 24);
    s += g.solid("M58 120 H104 V146 Q81 158 58 146Z", dk(C.coral, .1), 5) + g.solid("M196 120 H242 V146 Q219 158 196 146Z", dk(C.coral, .1), 5);
    return s + `<path d="M228 220 c10 0 10 10 20 10 s10 -10 20 -10 s10 10 20 10" fill="none" stroke="${C.ink}" stroke-width="4" stroke-linecap="round"/>`;
  },
  "crucial-conversations": (g) => { // high stakes, two voices
    let s = g.shadow(150, 250, 112, 12);
    s += g.solid("M44 70 H184 Q200 70 200 86 V150 Q200 166 184 166 H96 L68 192 L74 166 H60 Q44 166 44 150 V86 Q44 70 60 70Z", C.coral, 8);
    s += g.text(122, 146, "!", 72, C.white, 5, 900);
    s += g.solid("M116 150 H240 Q256 150 256 166 V218 Q256 234 240 234 H232 L240 258 L212 234 H132 Q116 234 116 218 V166 Q116 150 132 150Z", C.cream, 8);
    return s + [158, 186, 214].map(x => g.ball(x, 192, 8, C.ink)).join("");
  },
  "the-power-of-vulnerability": (g) => { // a heart, open, with light coming through
    let s = g.shadow(150, 250, 90, 14) + g.glow(150, 150, 120, C.gold, .35);
    s += g.solid("M150 236 C58 176 54 92 106 84 C132 80 148 98 150 114 C152 98 168 80 194 84 C246 92 242 176 150 236Z", C.coral, 8);
    s += `<path d="M150 116 L138 146 L158 160 L142 196 L150 232" fill="none" stroke="${C.gold}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>`;
    s += `<path d="M150 116 L138 146 L158 160 L142 196 L150 232" fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    return s + g.star(232, 74, 12) + g.star(66, 96, 8) + g.star(246, 132, 6);
  },
  /* HEALTH */
  "huberman-lab-sleep-light-episodes": (g) => { // a mic between sunrise and moon
    let s = g.glow(150, 132, 120, C.gold, .5);
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; s += `<path d="M${f(150 + Math.cos(a) * 86)} ${f(130 + Math.sin(a) * 86)} L${f(150 + Math.cos(a) * 104)} ${f(130 + Math.sin(a) * 104)}" stroke="${C.gold}" stroke-width="6" stroke-linecap="round" opacity=".8"/>`; }
    s += `<circle cx="150" cy="130" r="74" fill="${g.rad([[0, lt(C.gold, .5)], [1, C.gold]], .4, .35, .8)}"/>`;
    s += g.shadow(150, 250, 66, 10);
    s += g.tube("M104 140 Q104 194 150 194 Q196 194 196 140", C.ink, 10) + g.tube("M150 196 V236", C.ink, 10) + g.cyl(150, 246, 40, 8, C.ink, 12);
    s += `<rect x="122" y="66" width="56" height="112" rx="28" fill="${g.lin([[0, "#7d8594"], [.35, "#d7dbe2"], [.7, "#9aa2b0"], [1, "#4c5260"]], 0, 0, 1, 0)}"/>`;
    s += `<g stroke="${C.ink}" stroke-opacity=".35" stroke-width="2.5">${[86, 98, 110, 122, 134].map(y => `<path d="M128 ${y} H172"/>`).join("")}</g>`;
    return s + `<path d="M246 30 a22 22 0 1 0 22 30 a18 18 0 1 1 -22 -30Z" fill="${C.cream}"/>`;
  },
  "why-we-sleep": (g) => { // the moon resting on a pillow
    const m = g.uid();
    let s = g.shadow(150, 252, 120, 12);
    s += g.solid("M44 206 C36 178 60 168 92 172 C130 162 174 162 210 172 C242 168 266 178 256 206 C262 232 238 240 210 234 C170 242 130 242 92 234 C62 240 38 232 44 206Z", C.cream, 7);
    s += `<path d="M72 204 C120 196 182 196 230 204" fill="none" stroke="${dk(C.cream, .12)}" stroke-width="3" stroke-linecap="round"/>`;
    s += `<mask id="${m}"><rect width="300" height="300" fill="#fff"/><circle cx="178" cy="92" r="58" fill="#000"/></mask>`;
    s += `<g mask="url(#${m})"><circle cx="146" cy="120" r="66" fill="${g.rad([[0, lt(C.gold, .5)], [.7, C.gold], [1, dk(C.gold, .25)]], .35, .35, .8)}"/></g>`;
    return s + g.text(232, 64, "z", 34, C.white, 3) + g.text(262, 34, "z", 22, C.white, 2);
  },
  "outlive": (g) => { // time, and something that keeps growing
    let s = g.shadow(150, 252, 92, 12);
    s += g.slab(70, 44, 160, 18, 8, C.wood, 6) + g.slab(70, 226, 160, 18, 8, C.wood, 6);
    s += `<path d="M86 62 H214 C214 104 162 126 156 144 C162 162 214 184 214 226 H86 C86 184 138 162 144 144 C138 126 86 104 86 62Z" fill="${C.glass}" fill-opacity=".35" stroke="#fff" stroke-opacity=".7" stroke-width="3"/>`;
    s += `<path d="M106 84 H194 C188 104 160 118 150 134 C140 118 112 104 106 84Z" fill="${g.lin([[0, lt(C.gold, .3)], [1, C.gold]])}"/>`;
    s += `<path d="M150 136 L150 210" stroke="${C.gold}" stroke-width="3" stroke-dasharray="3 5"/>`;
    s += `<path d="M98 226 C112 200 188 200 202 226Z" fill="${g.lin([[0, lt(C.gold, .3)], [1, dk(C.gold, .1)]])}"/>`;
    s += g.tube("M150 214 C150 200 150 196 152 186", C.leaf, 6);
    return s + g.solid("M151 194 C140 178 124 180 120 188 C130 198 144 198 151 194Z", C.leaf) + g.solid("M152 188 C162 170 180 170 184 178 C176 190 162 192 152 188Z", lt(C.leaf, .15));
  },
  /* DECISIONS */
  "thinking-fast-and-slow": (g) => { // a lightning bolt and a snail's spiral
    let s = g.shadow(150, 248, 124, 14);
    s += g.solid("M112 34 L62 140 H102 L78 238 L156 116 H114 L142 34Z", C.gold, 9);
    let d = ""; for (let t = 0; t <= 4 * Math.PI; t += .2) { const r = 6 + t * 3.6; d += `${t ? "L" : "M"}${f(214 + Math.cos(t) * r)} ${f(178 + Math.sin(t) * r)}`; }
    s += g.ball(214, 178, 56, C.coral) + `<path d="${d}" fill="none" stroke="${dk(C.coral, .35)}" stroke-width="4" stroke-linecap="round" opacity=".7"/>`;
    return s + g.tube("M160 240 Q200 236 262 240", C.cream, 12);
  },
  "thinking-in-bets": (g) => { // dice and a chip: decisions under uncertainty
    let s = g.shadow(150, 250, 126, 16);
    const pip = p => `<ellipse cx="${f(p[0])}" cy="${f(p[1])}" rx="5.5" ry="3.4" fill="${C.ink}"/>`;
    const lpip = p => `<ellipse cx="${f(p[0])}" cy="${f(p[1])}" rx="3.6" ry="5" fill="${C.ink}" transform="rotate(-30 ${f(p[0])} ${f(p[1])})"/>`;
    s += g.box(206, 214, 58, 58, 58, C.white);
    [[.25, .25], [.75, .75], [.5, .5]].forEach(([u, v]) => s += pip(g.top(u, v)));
    [[.3, .3], [.7, .7]].forEach(([u, v]) => s += lpip(g.left(u, v)));
    s += g.box(118, 246, 64, 64, 64, C.white);
    [[.25, .25], [.25, .75], [.75, .25], [.75, .75], [.5, .5]].forEach(([u, v]) => s += pip(g.top(u, v)));
    [[.3, .25], [.3, .5], [.3, .75], [.7, .25], [.7, .5], [.7, .75]].forEach(([u, v]) => s += lpip(g.left(u, v)));
    s += g.cyl(236, 258, 30, 12, C.coral, 10);
    return s + `<ellipse cx="236" cy="246" rx="20" ry="6.5" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="7 6"/>`;
  },
  "amazon-shareholder-letters": (g) => { // a stack of yearly letters
    let s = g.shadow(150, 250, 118, 14);
    [[-10, 170, lt(C.sky, .5)], [6, 150, C.cream], [-3, 132, C.white]].forEach(([r, y, c]) => {
      s += g.solid(`M52 ${y - 70} H248 V${y + 40} H52Z`, c, 6, `rotate(${r} 150 ${y})`);
    });
    s += `<g transform="rotate(-3 150 132)"><path d="M52 62 L150 126 L248 62" fill="none" stroke="${dk(C.cream, .15)}" stroke-width="4" stroke-linejoin="round"/></g>`;
    return s + g.ball(150, 126, 16, C.coral) + `<text x="150" y="131" text-anchor="middle" font-family="Figtree, system-ui" font-weight="800" font-size="14" fill="#fff">1</text>`;
  },
  /* CREATIVITY */
  "steal-like-an-artist": (g) => { // a collage of borrowed shapes in a gilded frame
    let s = g.shadow(150, 250, 110, 12);
    s += `<g transform="rotate(-4 150 140)">${g.slab(46, 40, 208, 196, 10, C.gold, 9)}<rect x="66" y="60" width="168" height="156" rx="4" fill="${g.lin([[0, C.cream], [1, dk(C.cream, .06)]])}"/>`;
    s += g.ball(122, 112, 34, C.coral) + g.solid("M160 84 L214 176 H106Z", C.mint, 5) + g.solid("M134 150 H198 V204 H134Z", C.sky, 5);
    s += `<rect x="54" y="40" width="44" height="14" rx="2" fill="#fff" opacity=".7" transform="rotate(-32 76 47)"/><rect x="202" y="222" width="44" height="14" rx="2" fill="#fff" opacity=".7" transform="rotate(-32 224 229)"/></g>`;
    return s;
  },
  "the-war-of-art": (g) => { // a shield and a pencil drawn like a sword
    let s = g.shadow(150, 252, 104, 12);
    s += g.solid("M150 50 L236 80 C236 160 204 214 150 240 C96 214 64 160 64 80Z", C.cream, 9);
    s += `<path d="M150 64 L222 90 C222 158 196 202 150 226Z" fill="${C.coral}" opacity=".9"/>`;
    s += `<g transform="rotate(-40 150 150)"><rect x="30" y="138" width="190" height="24" fill="${g.lin([[0, lt(C.gold, .4)], [.5, C.gold], [1, dk(C.gold, .3)]])}"/>`;
    s += `<rect x="14" y="138" width="20" height="24" rx="4" fill="${C.rose}"/><rect x="30" y="138" width="10" height="24" fill="#c9ccd4"/>`;
    s += `<polygon points="220,138 260,150 220,162" fill="${C.cream}"/><polygon points="248,146 262,150 248,154" fill="${C.ink}"/></g>`;
    return s;
  },
  "art-fear": (g) => { // a blank canvas and the first small mark
    let s = g.shadow(150, 252, 100, 12);
    s += g.tube("M150 40 L150 250 M106 250 L134 90 M194 250 L166 90", C.wood, 10);
    s += g.slab(84, 58, 132, 150, 4, C.white, 8);
    s += g.slab(76, 204, 148, 12, 4, C.wood, 5);
    s += `<path d="M118 150 C126 136 140 158 150 142 C158 130 170 148 178 140" fill="none" stroke="${C.coral}" stroke-width="7" stroke-linecap="round"/>`;
    return s + `<ellipse cx="236" cy="236" rx="26" ry="10" fill="${C.cream}"/>` + g.ball(228, 232, 5, C.coral) + g.ball(242, 234, 5, C.sky) + g.ball(236, 240, 5, C.gold);
  },
  /* LEADERSHIP */
  "how-great-leaders-inspire-action": (g, T) => { // the golden circle: why, how, what
    let s = g.shadow(150, 244, 118, 22);
    s += g.cyl(150, 232, 108, 22, lt(T, .55), 36) + g.cyl(150, 206, 74, 22, C.coral, 25) + g.cyl(150, 180, 40, 22, C.gold, 13);
    s += `<text x="150" y="163" text-anchor="middle" font-family="Figtree, system-ui" font-weight="800" font-size="15" fill="${dk(C.gold, .45)}" transform="scale(1 .6) translate(0 ${f(163 / .6 - 163)})">WHY</text>`;
    return s + g.glow(150, 140, 60, C.gold, .45);
  },
  "extreme-ownership": (g) => { // the key: you own the outcome
    let s = g.shadow(150, 244, 112, 12);
    s += `<g transform="rotate(-24 150 150)">`;
    s += `<circle cx="84" cy="150" r="44" fill="none" stroke="${dk(C.gold, .32)}" stroke-width="26" transform="translate(4 6)"/>`;
    s += `<circle cx="84" cy="150" r="44" fill="none" stroke="${g.lin([[0, lt(C.gold, .45)], [1, dk(C.gold, .1)]])}" stroke-width="26"/>`;
    s += g.solid("M124 140 H262 V162 H124Z", C.gold, 5) + g.solid("M222 160 H238 V192 H222Z M246 160 H262 V182 H246Z", C.gold, 5);
    return s + `</g>`;
  },
  "the-fearless-organization": (g) => { // a team under one umbrella
    let s = g.shadow(150, 252, 116, 12);
    s += `<g stroke="${C.sky}" stroke-width="4" stroke-linecap="round" opacity=".8"><path d="M30 60 l-8 16M48 120 l-8 16M262 70 l-8 16M280 130 l-8 16M24 180 l-8 16M270 190 l-8 16"/></g>`;
    s += g.tube("M150 110 V218 Q150 238 132 238 Q118 238 118 224", C.ink, 9);
    s += g.solid("M38 136 C42 82 92 48 150 48 C208 48 258 82 262 136 C246 124 226 124 212 136 C198 124 172 124 150 136 C128 124 102 124 88 136 C74 124 54 124 38 136Z", C.coral, 7);
    s += `<path d="M150 48 C126 70 116 100 112 132 M150 48 C174 70 184 100 188 132" fill="none" stroke="${dk(C.coral, .2)}" stroke-width="3"/>`;
    return s + g.ball(92, 222, 20, C.mint) + g.ball(206, 222, 20, C.gold) + g.ball(150, 196, 16, C.sky);
  },
  /* CALM */
  "meditations": (g) => { // a Stoic column
    let s = g.shadow(150, 252, 96, 14);
    s += g.box(150, 252, 70, 70, 16, C.cream) + g.cyl(150, 220, 42, 140, C.cream, 13);
    s += `<g stroke="${dk(C.cream, .2)}" stroke-width="3" opacity=".7">${[-28, -14, 0, 14, 28].map(x => `<path d="M${150 + x} ${f(84 + Math.abs(x) * .2)} V${f(220 + 12 - Math.abs(x) * .2)}"/>`).join("")}</g>`;
    s += g.box(150, 88, 66, 66, 16, C.cream);
    s += `<circle cx="94" cy="62" r="12" fill="none" stroke="${C.cream}" stroke-width="7"/><circle cx="206" cy="62" r="12" fill="none" stroke="${dk(C.cream, .15)}" stroke-width="7"/>`;
    return s + g.tube("M60 236 Q40 200 54 160", C.leaf, 6) + g.tube("M240 236 Q260 200 246 160", C.leaf, 6);
  },
  "10-happier": (g) => { // 10%, on a meditation cushion
    let s = g.shadow(150, 252, 116, 16);
    s += g.cyl(150, 238, 104, 34, C.coral, 32);
    s += `<ellipse cx="150" cy="204" rx="70" ry="18" fill="${dk(C.coral, .12)}" opacity=".35"/>`;
    return s + g.text(150, 168, "10%", 96, C.gold, 9, 900);
  },
  "stress-breathing-tools": (g, T) => { // a calm cairn and the slow rhythm of breath
    let s = `<g fill="none" stroke="#fff" stroke-linecap="round" opacity=".35">${[0, 1, 2].map(i => `<path d="M${20 + i * 6} ${110 + i * 26} C70 ${80 + i * 26} 110 ${140 + i * 26} 150 ${110 + i * 26} S230 ${80 + i * 26} ${280 - i * 6} ${110 + i * 26}" stroke-width="${4 - i}"/>`).join("")}</g>`;
    s += g.shadow(150, 252, 92, 12);
    [[150, 228, 78, 26, C.stone], [146, 186, 60, 22, lt(C.stone, .2)], [154, 150, 44, 18, dk(C.stone, .06)], [150, 120, 30, 14, lt(C.stone, .35)]].forEach(([x, y, rx, ry, c]) =>
      s += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${g.rad([[0, lt(c, .45)], [.65, c], [1, dk(c, .3)]], .4, .3, .8)}"/>`);
    return s;
  },
  /* CAREER */
  "so-good-they-can-t-ignore-you": (g) => { // a trophy in the spotlight
    let s = `<polygon points="120,0 180,0 262,250 38,250" fill="${g.lin([[0, "#fff", .45], [1, "#fff", 0]])}"/>`;
    s += g.shadow(150, 250, 90, 14);
    s += g.box(150, 252, 64, 64, 22, C.ink) + g.cyl(150, 200, 14, 34, C.gold, 5);
    s += `<path d="M98 108 C66 108 66 150 108 154 M202 108 C234 108 234 150 192 154" fill="none" stroke="${dk(C.gold, .1)}" stroke-width="10" stroke-linecap="round"/>`;
    s += `<path d="M96 70 H204 C204 136 182 168 150 170 C118 168 96 136 96 70Z" fill="${g.lin([[0, dk(C.gold, .2)], [.3, lt(C.gold, .4)], [.65, C.gold], [1, dk(C.gold, .3)]], 0, 0, 1, 0)}"/>`;
    s += `<ellipse cx="150" cy="70" rx="54" ry="13" fill="${dk(C.gold, .3)}"/>`;
    return s + g.star(150, 116, 16, "#fff8e0");
  },
  "how-to-do-great-work": (g) => { // a telescope pointed at something far away
    let s = g.glow(236, 58, 60, C.gold, .6) + g.star(236, 58, 22, "#fff8e0") + g.star(272, 112, 8) + g.star(196, 30, 6);
    s += g.shadow(140, 252, 90, 12);
    s += g.tube("M140 160 L94 248 M140 160 L140 250 M140 160 L188 248", C.ink, 7);
    s += `<g transform="rotate(-32 140 150)">`;
    s += `<rect x="40" y="134" width="70" height="26" rx="5" fill="${g.lin([[0, lt(C.cream, .2)], [1, dk(C.cream, .2)]])}"/>`;
    s += `<rect x="106" y="126" width="110" height="40" rx="6" fill="${g.lin([[0, lt(C.coral, .3)], [1, dk(C.coral, .2)]])}"/>`;
    s += `<rect x="212" y="120" width="16" height="52" rx="5" fill="${g.lin([[0, lt(C.gold, .3)], [1, dk(C.gold, .2)]])}"/>`;
    return s + `</g>`;
  },
  "career-habits-worth-building": (g) => { // a wall built brick by brick
    let s = g.shadow(150, 252, 124, 12);
    const W = 52, H = 24;
    const rows = [[0, 5], [W / 2, 4], [0, 5], [W / 2, 3]];
    rows.forEach(([off, n], r) => { for (let i = 0; i < n; i++) s += g.slab(22 + off + i * (W + 2), 222 - r * (H + 2), W, H, 4, i % 2 ? C.brick : lt(C.brick, .12), 6); });
    s += `<g transform="rotate(-12 236 88)">${g.slab(208, 76, W, H, 4, C.gold, 6)}</g>`;
    return s + `<path d="M196 116 l-10 10 M214 122 l-6 12 M232 120 l-2 13" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>`;
  },
};
/* generic objects for sources without their own art (your own ideas, new content) */
const GENERIC = {
  book: (g, T, r) => { // a small stack of books
    const cs = [C.coral, C.cream, C.sky, C.gold, C.mint, C.lilac];
    let s = g.shadow(150, 248, 116, 16);
    [0, 1, 2].forEach(k => s += g.box(150 + (r() - .5) * 16, 240 - k * 30, 104, 64, 26, cs[Math.floor(r() * cs.length)]));
    return s;
  },
  article: (g) => {
    let s = g.shadow(150, 248, 100, 12);
    s += g.solid("M70 64 H214 V224 H70Z", lt(C.sky, .45), 6, "rotate(7 150 150)") + g.solid("M78 56 H222 V220 H78Z", C.cream, 8, "rotate(-4 150 140)");
    return s + `<g transform="rotate(-4 150 140)" stroke="${C.ink}" stroke-opacity=".28" stroke-width="6" stroke-linecap="round"><path d="M100 92 H190M100 120 H200M100 144 H196M100 168 H170M100 192 H186"/></g>`;
  },
  video: (g) => {
    let s = g.shadow(150, 248, 112, 12) + g.slab(40, 62, 220, 150, 16, C.ink, 10);
    s += `<rect x="52" y="74" width="196" height="126" rx="8" fill="${g.lin([[0, lt(C.sky, .2)], [1, dk(C.sky, .2)]])}"/>`;
    return s + g.ball(150, 137, 32, C.white) + `<path d="M141 120 L166 137 L141 154Z" fill="${C.coral}"/>` + g.slab(120, 226, 60, 10, 5, C.ink, 4);
  },
  podcast: (g) => {
    let s = g.shadow(150, 250, 66, 10) + g.tube("M104 130 Q104 190 150 190 Q196 190 196 130", C.ink, 10) + g.tube("M150 192 V236", C.ink, 10) + g.cyl(150, 246, 40, 8, C.ink, 12);
    return s + `<rect x="122" y="56" width="56" height="112" rx="28" fill="${g.lin([[0, "#7d8594"], [.35, "#d7dbe2"], [.7, "#9aa2b0"], [1, "#4c5260"]], 0, 0, 1, 0)}"/>`;
  },
};

const slug = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 150);
function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function draw(title, kind, T) {
  const g = new Pen(), fn = MOTIFS[slug(title)] || GENERIC[kind] || GENERIC.book;
  const body = fn(g, T || "#1d4f86", rng(hash(title)));
  return { g, body };
}
const has = title => !!MOTIFS[slug(title)];

/* full cover: lighting, a soft halo behind the object, and the object itself */
function cover(title, kind, T) {
  const { g, body } = draw(title, kind, T);
  const r = rng(hash("bg" + title)), a1 = 20 + r() * 50, a2 = 120 + r() * 80;
  const bg = `<rect width="300" height="400" fill="${g.lin([[0, "#fff", .16], [.55, "#fff", 0], [1, "#000", .28]], 0, 0, .4, 1)}"/>` +
    `<circle cx="${f(150 + (r() - .5) * 60)}" cy="${f(150 + (r() - .5) * 40)}" r="150" fill="${g.rad([[0, "#fff", .32], [1, "#fff", 0]])}"/>` +
    `<circle cx="${f(a1 * 4)}" cy="${f(a2)}" r="${f(160 + r() * 60)}" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="22"/>`;
  /* long titles wrap to 3–4 lines at the bottom, so the object gets smaller and moves up to stay clear of them */
  const len = String(title).length, k = len > 34 ? .62 : len > 24 ? .7 : .8, y = len > 34 ? 6 : len > 24 ? 14 : 26;
  return `<svg class="art" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>${g.defs.join("")}</defs>${bg}<g transform="translate(${f(150 - 150 * k)} ${y}) scale(${k})">${body}</g></svg>`;
}
/* the object alone, for the feed card header */
function motif(title, kind, T) {
  const { g, body } = draw(title, kind, T);
  return `<svg class="motif" viewBox="0 0 300 300" aria-hidden="true"><defs>${g.defs.join("")}</defs>${body}</svg>`;
}

window.KernelArt = { cover, motif, has, slug, list: () => Object.keys(MOTIFS) };
})();
