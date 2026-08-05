/* pacman.jsx — "MAZE MUNCHER"
   You are a data packet loose in the cache. Eat every cached record before the
   garbage collectors reclaim you. Original maze, tile-based chase AI with a queued
   turn buffer, four GC personalities, scatter/chase phases, flush tokens.
   Every top-level binding in this file is suffixed MM — the whole site shares one
   lexical scope, so a duplicate name blanks the page. */
const { useState: useStateMM, useEffect: useEffectMM, useRef: useRefMM } = React;

/* '#' wall  '.' cached record  'o' flush token  '-' GC pen  '=' pen door
   'P' packet spawn  ' ' empty (row 10 wraps left<->right through the side tunnel) */
const MAZE_MM = [
  '###################',
  '#........#........#',
  '#o##.###...###.##o#',
  '#.................#',
  '#.#.###.###.###.#.#',
  '#.....#.....#.....#',
  '###.#.###.###.#.###',
  '#...#.#.....#.#...#',
  '#.###.........###.#',
  '#.###.###=###.###.#',
  '  ###.##---##.###  ',
  '#.###.#######.###.#',
  '#.###.#######.###.#',
  '#........P........#',
  '#.##.##..#..##.##.#',
  '#.....#.....#.....#',
  '###.#.###.###.#.###',
  '#.................#',
  '#o##.###.#.###.##o#',
  '#........#........#',
  '###################',
];

const BEST_KEY_MM = 'zb_mm_best';
const VEC_MM = [[0, -1], [1, 0], [0, 1], [-1, 0]];          // 0 up  1 right  2 down  3 left
const PICK_MM = [0, 3, 2, 1];                                // tie-break: up, left, down, right
const ROT_MM = [[0, -1, 1, 0], [1, 0, 0, 1], [0, 1, -1, 0], [-1, 0, 0, -1]];
const EAT_MM = [200, 400, 800, 1600];
const FRIGHT_MM = '#93aeff';
const PELLET_MM = '#a7bcd9';
const SHADE_MM = '#05090f';

const PHASES_MM = [
  { m: 's', t: 7000 }, { m: 'c', t: 20000 },
  { m: 's', t: 7000 }, { m: 'c', t: 20000 },
  { m: 's', t: 5000 }, { m: 'c', t: 9e8 },
];

/* the four garbage collectors — kind drives the chase target */
const GCS_MM = [
  { key: 'CHASER',   kind: 'lock',   cv: '--bad',  fb: '#ff5d6c', sc: [17, 1],  pen: -1, penT: 0 },
  { key: 'AMBUSHER', kind: 'ahead',  cv: '--warn', fb: '#ffce4d', sc: [1, 1],   pen: 1,  penT: 1500 },
  { key: 'FLANKER',  kind: 'mirror', cv: '--good', fb: '#5ce08a', sc: [17, 19], pen: 0,  penT: 4200 },
  { key: 'WANDERER', kind: 'rand',   cv: null,     fb: '#c58cff', sc: [1, 19],  pen: 2,  penT: 7200 },
];

function cssVarMM(name, fb) {
  if (!name) return fb;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fb;
}
function paletteMM() {
  return {
    accent: cssVarMM('--accent', '#46a6ff'),
    good: cssVarMM('--good', '#5ce08a'),
    warn: cssVarMM('--warn', '#ffce4d'),
    bad: cssVarMM('--bad', '#ff5d6c'),
  };
}
function wrapColMM(c) {
  const n = MAZE_MM[0].length;
  return ((c % n) + n) % n;
}
function tileAtMM(c, r) {
  if (r < 0 || r >= MAZE_MM.length) return '#';
  return MAZE_MM[r][wrapColMM(c)];
}
/* allowPen: ghosts heading home may cross the door and pen floor; the packet never can */
function openMM(c, r, allowPen) {
  const ch = tileAtMM(c, r);
  if (ch === '#') return false;
  if (!allowPen && (ch === '-' || ch === '=')) return false;
  return true;
}
function readBestMM() {
  try { return parseInt(localStorage.getItem(BEST_KEY_MM) || '0', 10) || 0; } catch (e) { return 0; }
}
function writeBestMM(n) {
  try { localStorage.setItem(BEST_KEY_MM, String(n)); } catch (e) {}
}

/* one-time scan: spawn points, pen geometry, pellet total, and a BFS field the
   eaten GCs descend to walk home (a greedy chase can stall in a maze, a BFS field can't) */
const META_MM = (function () {
  const rows = MAZE_MM.length, cols = MAZE_MM[0].length;
  let spawn = { c: 9, r: 13 }, door = { c: 9, r: 9 }, total = 0, tunnel = 10;
  const penTiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = MAZE_MM[r][c];
      if (ch === 'P') spawn = { c: c, r: r };
      else if (ch === '=') door = { c: c, r: r };
      else if (ch === '-') penTiles.push({ c: c, r: r });
      else if (ch === '.' || ch === 'o') total++;
    }
    if (MAZE_MM[r][0] !== '#' && MAZE_MM[r][cols - 1] !== '#') tunnel = r;
  }
  const pen = { c: door.c, r: door.r + 1 };
  const home = { c: door.c, r: door.r - 1 };
  const dist = [];
  for (let r = 0; r < rows; r++) dist.push(new Int16Array(cols).fill(-1));
  dist[pen.r][pen.c] = 0;
  const q = [pen];
  for (let i = 0; i < q.length; i++) {
    const cur = q[i], dv = dist[cur.r][cur.c];
    for (let d = 0; d < 4; d++) {
      const nc = wrapColMM(cur.c + VEC_MM[d][0]), nr = cur.r + VEC_MM[d][1];
      if (nr < 0 || nr >= rows) continue;
      if (MAZE_MM[nr][nc] === '#') continue;
      if (dist[nr][nc] !== -1) continue;
      dist[nr][nc] = dv + 1;
      q.push({ c: nc, r: nr });
    }
  }
  return { rows: rows, cols: cols, spawn: spawn, door: door, pen: pen, home: home,
           penTiles: penTiles, total: total, tunnel: tunnel, dist: dist };
})();

function layoutMM(w, h) {
  const tile = Math.max(4, Math.floor(Math.min(w / META_MM.cols, (h - 2) / META_MM.rows)));
  return {
    tile: tile,
    ox: Math.floor((w - tile * META_MM.cols) / 2),
    oy: Math.floor((h - tile * META_MM.rows) / 2),
  };
}
/* walls are rebuilt only on resize: one body rect per wall tile plus a 2px lip on
   every face that touches a corridor — that lip is what reads as the neon maze */
function buildWallsMM(lay) {
  const body = [], edge = [];
  const t = lay.tile, e = Math.max(2, Math.round(t * 0.15));
  for (let r = 0; r < META_MM.rows; r++) {
    for (let c = 0; c < META_MM.cols; c++) {
      if (MAZE_MM[r][c] !== '#') continue;
      const x = lay.ox + c * t, y = lay.oy + r * t;
      body.push([x, y, t, t]);
      if (tileAtMM(c, r - 1) !== '#') edge.push([x, y, t, e]);
      if (tileAtMM(c, r + 1) !== '#') edge.push([x, y + t - e, t, e]);
      if (tileAtMM(c - 1, r) !== '#') edge.push([x, y, e, t]);
      if (tileAtMM(c + 1, r) !== '#') edge.push([x + t - e, y, e, t]);
    }
  }
  return { body: body, edge: edge };
}
function drawWallsMM(ctx, walls, col, lift) {
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = col;
  for (let i = 0; i < walls.body.length; i++) {
    const b = walls.body[i];
    ctx.fillRect(b[0], b[1], b[2], b[3]);
  }
  ctx.globalAlpha = lift;
  for (let i = 0; i < walls.edge.length; i++) {
    const b = walls.edge[i];
    ctx.fillRect(b[0], b[1], b[2], b[3]);
  }
  ctx.globalAlpha = 1;
}
function drawDoorMM(ctx, lay, col) {
  const t = lay.tile, d = META_MM.door;
  const th = Math.max(2, Math.round(t * 0.2));
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = col;
  ctx.fillRect(lay.ox + d.c * t + 1, lay.oy + d.r * t + Math.round((t - th) / 2), t - 2, th);
  ctx.globalAlpha = 1;
}

/* the packet: a hard-edged square with a chomping wedge bitten out of its leading
   face. Built from horizontal bars so it stays pixellated, and rotated with an
   exact integer matrix so no edge ever gets antialiased. */
function drawPacketMM(ctx, cx, cy, size, dir, open, col, alpha) {
  const R = Math.max(2, Math.round(size / 2));
  const px = Math.max(2, Math.round(size / 8));
  const m = ROT_MM[dir] || ROT_MM[1];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(Math.round(cx), Math.round(cy));
  ctx.transform(m[0], m[1], m[2], m[3], 0, 0);
  ctx.fillStyle = col;
  for (let j = -R; j < R; j += px) {
    const j2 = j + px;
    let inner;
    if (j <= 0 && j2 >= 0) inner = 0;
    else inner = Math.min(Math.abs(j), Math.abs(j2));
    const right = open > 0.02 ? Math.min(R, inner / open) : R;
    const bw = Math.round(right) + R;
    if (bw > 0) ctx.fillRect(-R, j, bw, Math.min(px, R - j));
  }
  ctx.restore();
}

/* a garbage collector: blocky torso, fringed underside, eyes that track its heading */
function drawGcMM(ctx, cx, cy, size, dir, col, wig, eyesOnly) {
  const s = Math.max(6, Math.round(size));
  const u = Math.max(1, Math.round(s / 7));
  const x0 = Math.round(cx - s / 2), y0 = Math.round(cy - s / 2);
  if (!eyesOnly) {
    ctx.fillStyle = col;
    ctx.fillRect(x0 + u, y0, s - 2 * u, u);
    ctx.fillRect(x0, y0 + u, s, s - 2 * u);
    const legw = Math.max(1, Math.round(s / 4));
    for (let k = 0; k < 4; k++) {
      if ((k + wig) % 2 === 0) ctx.fillRect(x0 + k * legw, y0 + s - u, legw, u);
    }
  }
  const v = VEC_MM[dir] || VEC_MM[3];
  const ew = Math.max(2, u * 2), eh = Math.max(2, u * 2);
  const ey = y0 + 2 * u;
  const lx = x0 + u, rx = x0 + s - u - ew;
  ctx.fillStyle = eyesOnly ? '#c9d8ef' : '#f2f7ff';
  ctx.fillRect(lx, ey, ew, eh);
  ctx.fillRect(rx, ey, ew, eh);
  const pw = Math.max(1, u);
  const px2 = Math.round(v[0] * (ew - pw) / 2), py2 = Math.round(v[1] * (eh - pw) / 2);
  ctx.fillStyle = '#0a1120';
  ctx.fillRect(lx + Math.round((ew - pw) / 2) + px2, ey + Math.round((eh - pw) / 2) + py2, pw, pw);
  ctx.fillRect(rx + Math.round((ew - pw) / 2) + px2, ey + Math.round((eh - pw) / 2) + py2, pw, pw);
}

function boxTextMM(ctx, txt, cx, cy, col, fs) {
  ctx.font = fs + 'px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(txt).width;
  ctx.globalAlpha = 0.84;
  ctx.fillStyle = SHADE_MM;
  ctx.fillRect(Math.round(cx - tw / 2) - 7, Math.round(cy - fs / 2) - 6, Math.round(tw) + 14, fs + 12);
  ctx.globalAlpha = 1;
  ctx.fillStyle = col;
  ctx.fillText(txt, Math.round(cx), Math.round(cy));
}

/* layout size, NOT getBoundingClientRect: the card animates in on a
   transform: scaleY(0.004), which would report a 2px-tall canvas */
function boxOfMM(canvas) {
  let w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) {
    const r = canvas.getBoundingClientRect();
    w = r.width; h = r.height;
  }
  return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
}

/* attract-mode still frame drawn behind the intro / game-over overlays */
function drawIdleMM(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const box = boxOfMM(canvas);
  const w = box.w, h = box.h;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  const pal = paletteMM();
  const lay = layoutMM(w, h);
  drawWallsMM(ctx, buildWallsMM(lay), pal.accent, 0.55);
  drawDoorMM(ctx, lay, pal.warn);
  const t = lay.tile, pr = Math.max(2, Math.round(t * 0.16));
  for (let r = 0; r < META_MM.rows; r++) {
    for (let c = 0; c < META_MM.cols; c++) {
      const ch = MAZE_MM[r][c];
      if (ch !== '.' && ch !== 'o') continue;
      const cx = lay.ox + (c + 0.5) * t, cy = lay.oy + (r + 0.5) * t;
      if (ch === '.') {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = PELLET_MM;
        ctx.fillRect(Math.round(cx - pr / 2), Math.round(cy - pr / 2), pr, pr);
      } else {
        const s = Math.max(4, Math.round(t * 0.46));
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = pal.warn;
        ctx.fillRect(Math.round(cx - s / 2), Math.round(cy - s / 2), s, s);
      }
    }
  }
  ctx.globalAlpha = 1;
}

function MazeMuncher({ onClose, sfx, onScore }) {
  const canvasRef = useRefMM(null);
  const [phase, setPhase] = useStateMM('intro');   // intro | play | over
  const [score, setScore] = useStateMM(0);
  const [lives, setLives] = useStateMM(3);
  const [level, setLevel] = useStateMM(1);
  const [best, setBest] = useStateMM(readBestMM);
  const scoredRef = useRefMM(false);

  /* ---------------------------------------------------------------- game loop */
  useEffectMM(() => {
    if (phase !== 'play') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const COLS = META_MM.cols, ROWS = META_MM.rows;
    let w = 1, h = 1, dpr = 1;
    let lay = { tile: 8, ox: 0, oy: 0 };
    let walls = { body: [], edge: [] };
    let raf = 0, running = true, hiddenPause = false, userPause = false, last = 0;
    let pal = paletteMM(), palT = 0;
    const prevStyle = canvas.style.touchAction;
    canvas.style.touchAction = 'none';

    const g = {
      pellets: [], left: 0,
      score: 0, lives: 3, level: 1,
      mode: 'ready', modeT: 1500, showLv: true,
      freeze: 0, frightT: 0, frightMax: 1, chain: 0,
      pIdx: 0, pT: 0,
      player: null, ghosts: [], pops: [],
      t: 0, chomp: 0, beat: 0,
    };

    /* ------------------------------------------------------------ setup */
    function phaseDur(i) {
      const p = PHASES_MM[i];
      if (p.m !== 's') return p.t;
      return Math.max(2200, Math.round(p.t * (1 - (g.level - 1) * 0.08)));
    }
    function resetPellets() {
      g.pellets = [];
      for (let r = 0; r < ROWS; r++) {
        const row = new Uint8Array(COLS);
        for (let c = 0; c < COLS; c++) {
          const ch = MAZE_MM[r][c];
          row[c] = ch === '.' ? 1 : ch === 'o' ? 2 : 0;
        }
        g.pellets.push(row);
      }
      g.left = META_MM.total;
    }
    function resetActors() {
      g.player = { c: META_MM.spawn.c, r: META_MM.spawn.r, d: 3, want: -1, prog: 0, moving: false };
      g.ghosts = GCS_MM.map(function (def, i) {
        const out = def.pen < 0;
        const slot = out ? META_MM.home : (META_MM.penTiles[def.pen] || META_MM.pen);
        return {
          def: def, i: i,
          c: slot.c, r: slot.r, d: out ? 3 : 0, prog: 0,
          mode: out ? 'run' : 'pen',
          penT: out ? 0 : Math.max(300, def.penT - (g.level - 1) * 400),
        };
      });
      g.pIdx = 0;
      g.pT = phaseDur(0);
      g.frightT = 0;
      g.chain = 0;
      g.freeze = 0;
      g.pops = [];
    }
    function speeds() {
      const lv = Math.min(g.level - 1, 8);
      const base = 0.106 + lv * 0.0048;
      return { pl: 0.126 + lv * 0.0036, gh: base, fr: base * 0.6, back: 0.28 };
    }

    function size() {
      const box = boxOfMM(canvas);
      w = box.w;
      h = box.h;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      lay = layoutMM(w, h);
      walls = buildWallsMM(lay);
    }

    /* ---------------------------------------------------------- mechanics */
    function canGo(e, d, allowPen) {
      return openMM(e.c + VEC_MM[d][0], e.r + VEC_MM[d][1], allowPen);
    }
    function commit(e) {
      e.c = wrapColMM(e.c + VEC_MM[e.d][0]);
      e.r = e.r + VEC_MM[e.d][1];
    }
    function reverse(e, allowPen) {
      const nd = (e.d + 2) % 4;
      if (e.prog > 0) { commit(e); e.d = nd; e.prog = 1 - e.prog; }
      else if (canGo(e, nd, allowPen)) e.d = nd;
    }
    function dist2(c1, r1, c2, r2) {
      let dc = c1 - c2;
      if (dc > COLS / 2) dc -= COLS;
      if (dc < -COLS / 2) dc += COLS;
      const dr = r1 - r2;
      return dc * dc + dr * dr;
    }
    function posOf(e) {
      return { x: e.c + VEC_MM[e.d][0] * e.prog, y: e.r + VEC_MM[e.d][1] * e.prog };
    }
    function addScore(n) {
      g.score += n;
      setScore(g.score);
    }

    function eatAt(c, r) {
      const v = g.pellets[r][c];
      if (!v) return;
      g.pellets[r][c] = 0;
      g.left--;
      if (v === 2) {
        addScore(50);
        g.frightMax = Math.max(2400, 6200 - (g.level - 1) * 450);
        g.frightT = g.frightMax;
        g.chain = 0;
        g.ghosts.forEach(function (gh) { if (gh.mode === 'run') reverse(gh, false); });
        if (sfx && sfx.powerup) sfx.powerup();
      } else {
        addScore(10);
        g.beat++;
        if (g.beat % 2 === 0 && sfx && sfx.move) sfx.move();
      }
      if (g.left <= 0) {
        g.mode = 'clear';
        g.modeT = 1600;
        g.frightT = 0;
        if (sfx && sfx.levelup) sfx.levelup();
      }
    }

    function stepPlayer(sp) {
      const p = g.player;
      if (p.want >= 0 && p.want !== p.d) {
        if (p.prog > 0 && p.want === (p.d + 2) % 4) {
          commit(p);
          p.d = p.want;
          p.prog = 1 - p.prog;
          p.moving = true;
        } else if (p.prog <= 0 && canGo(p, p.want, false)) {
          p.d = p.want;
          p.moving = true;
        }
      }
      if (!p.moving) {
        if (p.want >= 0 && canGo(p, p.want, false)) { p.d = p.want; p.moving = true; }
        else return;
      }
      p.prog += sp;
      g.chomp += sp;
      if (p.prog >= 1) {
        commit(p);
        p.prog -= 1;
        eatAt(p.c, p.r);
        if (p.want >= 0 && p.want !== p.d && canGo(p, p.want, false)) p.d = p.want;
        if (!canGo(p, p.d, false)) { p.prog = 0; p.moving = false; }
      }
    }

    function chaseTarget(gh) {
      const p = g.player;
      if (gh.def.kind === 'ahead') {
        const v = VEC_MM[p.d];
        return [wrapColMM(p.c + v[0] * 4),
                Math.max(0, Math.min(ROWS - 1, p.r + v[1] * 4))];
      }
      if (gh.def.kind === 'mirror') {
        const lead = g.ghosts[0] || gh;
        let dc = p.c - lead.c;
        if (dc > COLS / 2) dc -= COLS;
        if (dc < -COLS / 2) dc += COLS;
        return [wrapColMM(p.c + dc),
                Math.max(0, Math.min(ROWS - 1, p.r + (p.r - lead.r)))];
      }
      return [p.c, p.r];
    }
    function options(gh, allowPen, allowRev) {
      const out = [];
      for (let k = 0; k < 4; k++) {
        const d = PICK_MM[k];
        if (!allowRev && d === (gh.d + 2) % 4) continue;
        const nc = wrapColMM(gh.c + VEC_MM[d][0]), nr = gh.r + VEC_MM[d][1];
        if (!openMM(nc, nr, allowPen)) continue;
        out.push({ d: d, c: nc, r: nr });
      }
      return out;
    }
    function chooseExit(gh) {
      const D = META_MM.door;
      if (gh.r > D.r) gh.d = gh.c === D.c ? 0 : (gh.c < D.c ? 1 : 3);
      else if (gh.r === D.r) gh.d = 0;
      else {
        gh.mode = 'run';
        gh.d = openMM(gh.c - 1, gh.r, false) ? 3 : 1;
      }
    }
    function chooseBack(gh) {
      if (gh.c === META_MM.pen.c && gh.r === META_MM.pen.r) {
        gh.mode = 'pen';
        gh.penT = 1400;
        gh.prog = 0;
        gh.d = 0;
        return;
      }
      const opts = options(gh, true, true);
      let bd = -1, bv = Infinity;
      for (let i = 0; i < opts.length; i++) {
        const v = META_MM.dist[opts[i].r][opts[i].c];
        if (v >= 0 && v < bv) { bv = v; bd = opts[i].d; }
      }
      if (bd >= 0) gh.d = bd;
    }
    function chooseGhost(gh) {
      if (gh.mode === 'exit') { chooseExit(gh); return; }
      if (gh.mode === 'back') { chooseBack(gh); return; }
      const opts = options(gh, false, false);
      /* nothing but the way we came (the maze has no dead ends, but never trust it):
         flip and re-centre rather than reverse(), which would commit into the wall */
      if (!opts.length) { gh.d = (gh.d + 2) % 4; gh.prog = 0; return; }
      if (opts.length === 1) { gh.d = opts[0].d; return; }
      if (gh.def.kind === 'rand') {
        gh.d = opts[Math.floor(Math.random() * opts.length) % opts.length].d;
        return;
      }
      let tc, tr, away = false;
      if (g.frightT > 0) { tc = g.player.c; tr = g.player.r; away = true; }
      else if (PHASES_MM[g.pIdx].m === 's') { tc = gh.def.sc[0]; tr = gh.def.sc[1]; }
      else { const t = chaseTarget(gh); tc = t[0]; tr = t[1]; }
      let bd = opts[0].d, bv = dist2(opts[0].c, opts[0].r, tc, tr);
      for (let i = 1; i < opts.length; i++) {
        const v = dist2(opts[i].c, opts[i].r, tc, tr);
        if (away ? v > bv : v < bv) { bv = v; bd = opts[i].d; }
      }
      gh.d = bd;
    }
    function stepGhost(gh, sp) {
      gh.prog += sp;
      if (gh.prog >= 1) {
        commit(gh);
        gh.prog -= 1;
        chooseGhost(gh);
        if (!canGo(gh, gh.d, gh.mode !== 'run')) gh.prog = 0;
      }
    }

    function die() {
      g.mode = 'dying';
      g.modeT = 1400;
      g.frightT = 0;
      g.player.moving = false;
      if (sfx && sfx.back) sfx.back();
    }
    function collide() {
      const p = posOf(g.player);
      for (let i = 0; i < g.ghosts.length; i++) {
        const gh = g.ghosts[i];
        if (gh.mode === 'pen' || gh.mode === 'back') continue;
        const q = posOf(gh);
        let dx = q.x - p.x;
        if (dx > COLS / 2) dx -= COLS;
        if (dx < -COLS / 2) dx += COLS;
        const dy = q.y - p.y;
        if (dx * dx + dy * dy > 0.34) continue;
        if (g.frightT > 0) {
          const pts = EAT_MM[Math.min(g.chain, EAT_MM.length - 1)];
          g.chain++;
          addScore(pts);
          g.pops.push({ x: q.x, y: q.y, txt: String(pts), t: 950 });
          gh.mode = 'back';
          gh.prog = 0;
          chooseBack(gh);
          g.freeze = 420;
          if (sfx && sfx.coin) sfx.coin();
        } else {
          die();
          return;
        }
      }
    }
    function afterDeath() {
      g.lives -= 1;
      setLives(g.lives);
      if (g.lives <= 0) { endRun(); return; }
      resetActors();
      g.mode = 'ready';
      g.modeT = 1200;
      g.showLv = false;
    }
    function nextLevel() {
      g.level += 1;
      setLevel(g.level);
      resetPellets();
      resetActors();
      g.mode = 'ready';
      g.modeT = 1400;
      g.showLv = true;
    }
    function endRun() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      const fin = g.score;
      setScore(fin);
      setBest(function (b) {
        const nb = Math.max(b, fin);
        writeBestMM(nb);
        return nb;
      });
      if (!scoredRef.current) {
        scoredRef.current = true;
        if (onScore) onScore(fin);
      }
      if (sfx && sfx.select) sfx.select();
      setPhase('over');
    }

    /* -------------------------------------------------------------- update */
    function update(dt) {
      g.t += dt;
      const f = dt / 16.667;
      if (g.mode === 'ready') {
        g.modeT -= dt;
        if (g.modeT <= 0) g.mode = 'run';
        return;
      }
      if (g.mode === 'dying') {
        g.modeT -= dt;
        if (g.modeT <= 0) afterDeath();
        return;
      }
      if (g.mode === 'clear') {
        g.modeT -= dt;
        if (g.modeT <= 0) nextLevel();
        return;
      }
      for (let i = g.pops.length - 1; i >= 0; i--) {
        g.pops[i].t -= dt;
        if (g.pops[i].t <= 0) g.pops.splice(i, 1);
      }
      if (g.freeze > 0) { g.freeze -= dt; return; }

      if (g.frightT > 0) {
        g.frightT -= dt;
        if (g.frightT <= 0) { g.frightT = 0; g.chain = 0; }
      } else {
        g.pT -= dt;
        if (g.pT <= 0 && g.pIdx < PHASES_MM.length - 1) {
          g.pIdx++;
          g.pT = phaseDur(g.pIdx);
          g.ghosts.forEach(function (gh) { if (gh.mode === 'run') reverse(gh, false); });
        }
      }

      const sp = speeds();
      stepPlayer(sp.pl * f);
      if (g.mode !== 'run') return;              // eaten the last record / just died

      for (let i = 0; i < g.ghosts.length; i++) {
        const gh = g.ghosts[i];
        if (gh.mode === 'pen') {
          gh.penT -= dt;
          if (gh.penT <= 0) { gh.mode = 'exit'; gh.prog = 0; chooseExit(gh); }
          continue;
        }
        let s = sp.gh;
        if (gh.mode === 'back') s = sp.back;
        else if (gh.mode === 'exit') s = sp.gh * 0.85;
        else if (g.frightT > 0) s = sp.fr;
        if (gh.mode === 'run' && gh.r === META_MM.tunnel && (gh.c <= 2 || gh.c >= COLS - 3)) s *= 0.62;
        stepGhost(gh, s * f);
      }
      collide();
    }

    /* ---------------------------------------------------------------- draw */
    function drawActors() {
      const t = lay.tile;
      /* pellets */
      const pr = Math.max(2, Math.round(t * 0.16));
      const blink = Math.floor(g.t / 260) % 2 === 0;
      for (let r = 0; r < ROWS; r++) {
        const row = g.pellets[r];
        for (let c = 0; c < COLS; c++) {
          const v = row[c];
          if (!v) continue;
          const cx = lay.ox + (c + 0.5) * t, cy = lay.oy + (r + 0.5) * t;
          if (v === 1) {
            ctx.fillStyle = PELLET_MM;
            ctx.fillRect(Math.round(cx - pr / 2), Math.round(cy - pr / 2), pr, pr);
          } else if (blink) {
            const s = Math.max(4, Math.round(t * 0.46));
            ctx.fillStyle = pal.warn;
            ctx.fillRect(Math.round(cx - s / 2), Math.round(cy - s / 2), s, s);
          }
        }
      }
      /* packet */
      const p = g.player;
      let px = p.c + VEC_MM[p.d][0] * p.prog, py = p.r + VEC_MM[p.d][1] * p.prog;
      if (px < 0) px += COLS;
      if (px >= COLS) px -= COLS;
      const pcx = lay.ox + (px + 0.5) * t, pcy = lay.oy + (py + 0.5) * t;
      if (g.mode === 'dying') {
        const k = Math.max(0, Math.min(1, 1 - g.modeT / 1400));
        drawPacketMM(ctx, pcx, pcy, t * 0.88 * (1 - k * 0.55), p.d, 0.25 + k * 3.4, pal.accent, 1 - k * 0.75);
      } else {
        const cyc = [0.02, 0.42, 0.85, 0.42];
        const open = p.moving && g.mode === 'run' ? cyc[Math.floor(g.chomp * 5) % 4] : 0.42;
        drawPacketMM(ctx, pcx, pcy, t * 0.88, p.d, open, pal.accent, 1);
      }
      if (g.mode === 'dying') return;
      /* collectors */
      const wig = Math.floor(g.t / 130) % 2;
      for (let i = 0; i < g.ghosts.length; i++) {
        const gh = g.ghosts[i];
        let gx = gh.c + VEC_MM[gh.d][0] * gh.prog, gy = gh.r + VEC_MM[gh.d][1] * gh.prog;
        if (gx < 0) gx += COLS;
        if (gx >= COLS) gx -= COLS;
        let bob = 0;
        if (gh.mode === 'pen') bob = (Math.floor(g.t / 220) % 2 ? 1 : -1) * Math.max(1, t * 0.1);
        const cx = lay.ox + (gx + 0.5) * t, cy = lay.oy + (gy + 0.5) * t + bob;
        const eyes = gh.mode === 'back' || gh.mode === 'pen';
        let col = gh.def.cv ? cssVarMM(gh.def.cv, gh.def.fb) : gh.def.fb;
        if (!eyes && g.frightT > 0) {
          col = (g.frightT < 1800 && Math.floor(g.t / 130) % 2) ? '#ffffff' : FRIGHT_MM;
        }
        drawGcMM(ctx, cx, cy, t * 0.82, gh.d, col, wig, eyes);
      }
      /* score pops */
      for (let i = 0; i < g.pops.length; i++) {
        const o = g.pops[i];
        let x = o.x;
        if (x < 0) x += COLS;
        if (x >= COLS) x -= COLS;
        const k = 1 - o.t / 950;
        ctx.globalAlpha = Math.max(0, Math.min(1, o.t / 400));
        ctx.font = Math.max(8, Math.round(t * 0.55)) + 'px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = pal.good;
        ctx.fillText(o.txt, Math.round(lay.ox + (x + 0.5) * t), Math.round(lay.oy + (o.y + 0.5) * t - k * t * 1.3));
        ctx.globalAlpha = 1;
      }
    }

    function drawGutters() {
      const t = lay.tile;
      const mazeH = ROWS * t;
      const gw = Math.max(4, Math.round(t * 0.3));
      const bx = lay.ox - Math.round(t * 0.7) - gw;
      const rx = lay.ox + COLS * t + Math.round(t * 0.7);
      if (bx < 2 || rx + gw > w - 2) return;
      const by = lay.oy + t, bh = mazeH - 2 * t;
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = pal.accent;
      ctx.fillRect(bx, by, gw, bh);
      ctx.fillRect(rx, by, gw, bh);
      const frac = META_MM.total ? g.left / META_MM.total : 0;
      const fh = Math.round(bh * Math.max(0, Math.min(1, frac)));
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = pal.good;
      ctx.fillRect(bx, by + bh - fh, gw, fh);
      if (g.frightT > 0) {
        const pf = Math.max(0, Math.min(1, g.frightT / g.frightMax));
        const ph = Math.round(bh * pf);
        ctx.fillStyle = pal.warn;
        ctx.fillRect(rx, by + bh - ph, gw, ph);
      }
      ctx.globalAlpha = 1;
      /* spare packets stacked in the left gutter */
      const ix = bx - Math.round(t * 0.9);
      if (ix - t * 0.5 > 2) {
        for (let i = 0; i < Math.max(0, g.lives - 1) && i < 5; i++) {
          drawPacketMM(ctx, ix, lay.oy + mazeH - t * (1.2 + i * 1.15), t * 0.62, 1, 0.45, pal.accent, 0.9);
        }
      }
      /* phase pips in the right gutter */
      const qx = rx + Math.round(t * 0.9);
      if (qx + t * 0.5 < w - 2) {
        const hot = g.frightT > 0 ? pal.warn : (PHASES_MM[g.pIdx].m === 's' ? pal.good : pal.bad);
        const ps = Math.max(3, Math.round(t * 0.3));
        for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = (Math.floor(g.t / 300) % 3) === i ? 0.95 : 0.25;
          ctx.fillStyle = hot;
          ctx.fillRect(Math.round(qx - ps / 2), Math.round(lay.oy + mazeH - t * (1.2 + i * 0.7)), ps, ps);
        }
        ctx.globalAlpha = 1;
      }
    }

    function draw() {
      if (g.t - palT > 400 || palT === 0) { pal = paletteMM(); palT = g.t; }
      ctx.clearRect(0, 0, w, h);
      const t = lay.tile;
      let lift = 0.85;
      if (g.mode === 'clear') lift = Math.floor(g.t / 140) % 2 ? 0.25 : 1;
      drawWallsMM(ctx, walls, pal.accent, lift);
      drawDoorMM(ctx, lay, g.frightT > 0 ? pal.warn : pal.bad);
      drawGutters();
      drawActors();
      const midX = lay.ox + COLS * t / 2;
      const fs = Math.max(8, Math.min(10, Math.round(t * 0.6)));
      if (hiddenPause || userPause) {
        boxTextMM(ctx, 'PAUSED', midX, lay.oy + 10.5 * t, pal.warn, fs);
      } else if (g.mode === 'ready') {
        boxTextMM(ctx, g.showLv ? 'LEVEL ' + g.level : 'READY', midX, lay.oy + 12.5 * t, pal.warn, fs);
      } else if (g.mode === 'clear') {
        boxTextMM(ctx, 'CACHE FLUSHED', midX, lay.oy + 12.5 * t, pal.good, fs);
      } else if (g.mode === 'dying') {
        boxTextMM(ctx, 'RECLAIMED', midX, lay.oy + 12.5 * t, pal.bad, fs);
      }
    }

    /* ---------------------------------------------------------------- loop */
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (hiddenPause || userPause) { last = now; draw(); return; }
      let dt = now - last;
      last = now;
      if (!(dt > 0)) dt = 16.667;
      if (dt > 34) dt = 34;
      update(dt);
      if (running) draw();
    }

    /* --------------------------------------------------------------- input */
    const kd = function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      let d = -1;
      if (k === 'ArrowUp' || k === 'w' || k === 'W') d = 0;
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') d = 1;
      else if (k === 'ArrowDown' || k === 's' || k === 'S') d = 2;
      else if (k === 'ArrowLeft' || k === 'a' || k === 'A') d = 3;
      if (d >= 0) {
        e.preventDefault();
        if (g.player) g.player.want = d;
        if (userPause) { userPause = false; last = performance.now(); }
        return;
      }
      if (k === 'p' || k === 'P') {
        userPause = !userPause;
        last = performance.now();
        if (sfx && sfx.hover) sfx.hover();
      } else if (k === ' ') {
        e.preventDefault();
      }
    };
    let swx = 0, swy = 0, swon = false;
    const pdown = function (e) { swon = true; swx = e.clientX; swy = e.clientY; };
    const pup = function (e) {
      if (!swon) return;
      swon = false;
      const dx = e.clientX - swx, dy = e.clientY - swy;
      if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
      if (g.player) g.player.want = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
    };
    const onResize = function () { size(); };
    const onVis = function () {
      hiddenPause = !!document.hidden;
      last = performance.now();
    };

    /* ---------------------------------------------------------------- boot */
    g.score = 0;
    g.lives = 3;
    g.level = 1;
    resetPellets();
    resetActors();
    g.mode = 'ready';
    g.modeT = 1500;
    g.showLv = true;
    setScore(0);
    setLives(3);
    setLevel(1);
    size();

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(function () { size(); });
      ro.observe(canvas);
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', kd);
    document.addEventListener('visibilitychange', onVis);
    canvas.addEventListener('pointerdown', pdown);
    canvas.addEventListener('pointerup', pup);
    canvas.addEventListener('pointercancel', pup);

    last = performance.now();
    raf = requestAnimationFrame(frame);

    return function () {
      running = false;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', kd);
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('pointerdown', pdown);
      canvas.removeEventListener('pointerup', pup);
      canvas.removeEventListener('pointercancel', pup);
      canvas.style.touchAction = prevStyle;
    };
  }, [phase]);

  /* -------------------------------------------------- idle frame + resize */
  useEffectMM(() => {
    if (phase === 'play') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const paint = function () { drawIdleMM(canvas); };
    paint();
    const id = setTimeout(paint, 60);          // fonts / layout settle
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(paint);          // catches a late/zero-size layout
      ro.observe(canvas);
    }
    window.addEventListener('resize', paint);
    return function () {
      clearTimeout(id);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', paint);
    };
  }, [phase]);

  /* ------------------------------------------------------------- esc close */
  useEffectMM(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hover = () => { if (sfx && sfx.hover) sfx.hover(); };
  const startPlay = () => {
    if (sfx) { sfx.warm && sfx.warm(); sfx.select && sfx.select(); }
    scoredRef.current = false;
    setScore(0);
    setLives(3);
    setLevel(1);
    setPhase('play');
  };
  const pad = (n) => String(Math.max(0, n)).padStart(4, '0');

  return (
    <div className="mg" onClick={(e) => { if (e.target.classList.contains('mg')) onClose(); }}>
      <div className="mg-card">
        <div className="mg-hud">
          <span className="mg-kicker">MAZE MUNCHER</span>
          <div className="mg-stats">
            <span>SCORE <b>{pad(score)}</b></span>
            <span className={lives <= 1 ? 'mg-time low' : 'mg-time'}>LIVES <b>{Math.max(0, lives)}</b></span>
            <span>LV <b>{String(level).padStart(2, '0')}</b></span>
            <span>BEST <b>{pad(best)}</b></span>
          </div>
          <button className="mg-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="mg-stage">
          <canvas ref={canvasRef} className="mg-canvas" />

          {phase === 'intro' && (
            <div className="mg-overlay">
              <div className="mg-title">MAZE MUNCHER</div>
              <p className="mg-rules">
                You are a data packet in the cache. Eat every record <b className="g">▪</b> — 10 pts.<br />
                A flush token <b className="y">◼</b> is 50 and leaves the garbage collectors
                <b className="r"> vulnerable</b> for 6s — eat them for 200 · 400 · 800 · 1600.<br /><br />
                ◄ ▲ ▼ ► / W A S D · swipe on touch · P pauses · 3 lives
              </p>
              <button className="btn accent" onClick={startPlay} onMouseEnter={hover}>► START</button>
            </div>
          )}

          {phase === 'over' && (
            <div className="mg-overlay">
              <div className="mg-title">RECLAIMED</div>
              <p className="mg-rules">
                FINAL SCORE <b className="g">{pad(score)}</b> · LEVEL <b className="y">{level}</b><br />
                {score >= best && score > 0
                  ? <span className="y">★ NEW HIGH SCORE ★</span>
                  : <>BEST {pad(best)}</>}
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button className="btn accent" onClick={startPlay} onMouseEnter={hover}>► RETRY</button>
                <button className="btn ghost" onClick={onClose} onMouseEnter={hover}>QUIT</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MazeMuncher });
