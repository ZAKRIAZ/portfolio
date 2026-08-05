/* tetris.jsx — "BLOCK STACK": a full falling-block puzzle for the hidden cabinet.
   Ten columns, twenty rows, seven pieces, bag randomiser, wall kicks, lock delay.

   NOTE ON NAMING: every .jsx here is compiled by Babel standalone into ONE shared
   global lexical scope, so a duplicated top-level name blanks the entire page.
   Every top-level binding in this file therefore carries the `BS` suffix (the
   exported component `BlockStack` is the only exception, and it is unique). */
const { useState: useStateBS, useEffect: useEffectBS, useRef: useRefBS } = React;

const COLS_BS = 10;
const ROWS_BS = 20;
const LOCK_MS_BS = 460;        // grace period after a piece touches down
const LOCK_FAST_BS = 140;      // shorter grace while soft-drop is held
const LOCK_RESETS_BS = 12;     // cap, so sliding forever is impossible
const CLEAR_MS_BS = 250;       // row flash before the rows collapse
const DAS_MS_BS = 150;         // delay before auto-shift kicks in
const ARR_MS_BS = 45;          // auto-shift repeat rate
const SOFT_MS_BS = 45;         // soft-drop repeat rate
const KICKS_BS = [0, -1, 1, -2, 2];          // rotation nudges, tried in order
const CLEAR_SCORE_BS = [0, 100, 300, 500, 800];
const KEYS_BS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

/* Square matrices so rotation is a plain transpose-flip. The filled row sits at
   index 1 for the 3x3/4x4 pieces, which is what puts a fresh piece flush with
   the top of the well. */
const SHAPES_BS = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};

/* Three pieces follow the fixed CSS status vars; four are fixed pixel-art tones,
   and together the seven stay readable against each other. I deliberately does
   NOT follow --accent: that var is user-tweakable, and NEON GREEN (#5ce08a) is
   byte-for-byte --good while AMBER CRT (#ffb43d) is a hair off --warn, so an
   accent-tinted piece could render identically to a settled S or O. The accent
   still shows on the well frame, the ghost and the row flash.
   Only literal-hex vars are read — --accent-bright & friends are color-mix()
   expressions that canvas cannot parse. */
const TINTS_BS = {
  I: [null, '#46a6ff'],
  O: ['--warn', '#ffce4d'],
  S: ['--good', '#5ce08a'],
  Z: ['--bad', '#ff5d6c'],
  T: [null, '#c86bff'],
  J: [null, '#5c6cff'],
  L: [null, '#ff9d3d'],
};

function cssVarBS(name, fb) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fb;
}

function paletteBS() {
  const p = {
    accent: cssVarBS('--accent', '#46a6ff'),
    good: cssVarBS('--good', '#5ce08a'),
    warn: cssVarBS('--warn', '#ffce4d'),
    bad: cssVarBS('--bad', '#ff5d6c'),
    dim: cssVarBS('--ink-dim', '#7287a8'),
    line: cssVarBS('--bg-line', '#1b2a47'),
  };
  for (let i = 0; i < KEYS_BS.length; i++) {
    const k = KEYS_BS[i];
    const t = TINTS_BS[k];
    p[k] = t[0] ? cssVarBS(t[0], t[1]) : t[1];
  }
  return p;
}

function emptyGridBS() {
  const g = [];
  for (let y = 0; y < ROWS_BS; y++) g.push(new Array(COLS_BS).fill(0));
  return g;
}

function rotateBS(m, dir) {
  const n = m.length;
  const out = [];
  for (let i = 0; i < n; i++) out.push(new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      out[i][j] = dir > 0 ? m[n - 1 - j][i] : m[j][n - 1 - i];
    }
  }
  return out;
}

/* Cells above the top of the well (y < 0) are legal — that is where a piece
   spawns from — so only the floor, the walls and settled blocks collide. */
function collideBS(grid, m, px, py) {
  const n = m.length;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!m[r][c]) continue;
      const x = px + c;
      const y = py + r;
      if (x < 0 || x >= COLS_BS || y >= ROWS_BS) return true;
      if (y >= 0 && grid[y][x]) return true;
    }
  }
  return false;
}

function boundsBS(m) {
  let r0 = m.length, r1 = -1, c0 = m.length, c1 = -1;
  for (let r = 0; r < m.length; r++) {
    for (let c = 0; c < m.length; c++) {
      if (!m[r][c]) continue;
      if (r < r0) r0 = r;
      if (r > r1) r1 = r;
      if (c < c0) c0 = c;
      if (c > c1) c1 = c;
    }
  }
  return { r0: r0, r1: r1, c0: c0, c1: c1 };
}

function gravityMsBS(level) {
  return Math.max(70, 820 - (level - 1) * 72);
}

/* One block: flat fill, hard bevel, darker core. No gradients, no curves. */
function drawCellBS(ctx, x, y, s, col) {
  const px = Math.round(x);
  const py = Math.round(y);
  const sz = Math.max(2, Math.round(s));
  const b = Math.max(1, Math.round(sz * 0.13));
  ctx.fillStyle = col;
  ctx.fillRect(px, py, sz, sz);
  ctx.fillStyle = 'rgba(255,255,255,0.26)';
  ctx.fillRect(px, py, sz, b);
  ctx.fillRect(px, py, b, sz);
  ctx.fillStyle = 'rgba(0,0,0,0.40)';
  ctx.fillRect(px, py + sz - b, sz, b);
  ctx.fillRect(px + sz - b, py, b, sz);
  const i = Math.max(2, Math.round(sz * 0.29));
  if (sz - i * 2 > 1) {
    ctx.fillStyle = 'rgba(7,13,24,0.32)';
    ctx.fillRect(px + i, py + i, sz - i * 2, sz - i * 2);
  }
}

function BlockStack({ onClose, sfx, onScore }) {
  const canvasRef = useRefBS(null);
  const [phase, setPhase] = useStateBS('intro');   // intro | play | over
  const [score, setScore] = useStateBS(0);
  const [lines, setLines] = useStateBS(0);
  const [level, setLevel] = useStateBS(1);
  const [best, setBest] = useStateBS(() => {
    try { return parseInt(localStorage.getItem('zb_bs_best') || '0', 10) || 0; }
    catch (err) { return 0; }
  });

  // props stay fresh for the long-lived loop without re-running the effect
  const sfxRef = useRefBS(sfx);
  sfxRef.current = sfx;
  const scoreCbRef = useRefBS(onScore);
  scoreCbRef.current = onScore;
  // set by the play effect: re-measure the canvas and repaint the current board.
  // Lives in a ref so resizing still works after the run ends and that effect's
  // listeners are gone, which otherwise left the frozen board stretched.
  const relayoutRef = useRefBS(null);

  useEffectBS(() => {
    if (phase !== 'play') return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');

    let raf = 0;
    let running = true;
    let last = performance.now();
    let frames = 0;
    let pal = paletteBS();

    // layout, recomputed by size()
    let w = 1, h = 1, dpr = 1;
    let cell = 10, wellW = 100, wellH = 200, wellX = 0, wellY = 0;
    let gutter = 0, fontPx = 8, previewCell = 8;

    const g = {
      grid: emptyGridBS(),
      bag: [],
      cur: null,
      next: null,
      score: 0,
      lines: 0,
      level: 1,
      dropT: 0,
      lockT: 0,
      resets: 0,
      clear: null,
      paused: false,
      over: false,
      scored: false,
    };
    const shown = { score: 0, lines: 0, level: 1 };
    const held = { left: false, right: false, down: false };
    const rep = { left: 0, right: 0, down: 0 };
    // -1 / 1: which horizontal key was pressed last. Both flags stay true while
    // both keys are physically down, so releasing the newer one hands the shift
    // back to the older instead of stalling the piece.
    let lastDir = 0;

    const beep = (name) => {
      const s = sfxRef.current;
      if (s && typeof s[name] === 'function') s[name]();
    };

    /* ---------- layout ---------- */
    /* clientWidth/clientHeight, never getBoundingClientRect(): the card opens with
       a tvOn scaleY(0.004) animation, and the rect is transform-sensitive — mid
       entrance it reads ~2px tall and the whole playfield lands outside a 2px
       backing store. The layout size ignores the transform. */
    function size() {
      w = Math.max(1, canvas.clientWidth);
      h = Math.max(1, canvas.clientHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const pad = 8;
      // +6 phantom columns reserve the side gutters for NEXT and the level text
      cell = Math.max(5, Math.floor(Math.min(
        (h - pad * 2) / ROWS_BS,
        (w - pad * 2) / (COLS_BS + 6)
      )));
      wellW = cell * COLS_BS;
      wellH = cell * ROWS_BS;
      wellX = Math.round((w - wellW) / 2);
      wellY = Math.round((h - wellH) / 2);
      gutter = Math.max(0, wellX);
      fontPx = Math.max(6, Math.min(10, Math.floor((gutter - 12) / 5.2)));
      previewCell = Math.max(4, Math.floor(Math.min(cell * 0.8, (gutter - 22) / 4)));
    }

    /* ---------- piece supply ---------- */
    function takeBS() {
      if (g.bag.length === 0) {
        const b = KEYS_BS.slice();
        for (let i = b.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const t = b[i]; b[i] = b[j]; b[j] = t;
        }
        g.bag = b;
      }
      return g.bag.shift();
    }

    function spawn() {
      const k = g.next || takeBS();
      g.next = takeBS();
      const m = SHAPES_BS[k].map((row) => row.slice());
      const bd = boundsBS(m);
      const px = Math.floor((COLS_BS - m.length) / 2);
      const py = -bd.r0;
      g.cur = { k: k, m: m, x: px, y: py };
      g.dropT = 0;
      g.lockT = 0;
      g.resets = 0;
      if (collideBS(g.grid, m, px, py)) endGame();
    }

    /* ---------- moves ---------- */
    function touchedDown() {
      return !!g.cur && collideBS(g.grid, g.cur.m, g.cur.x, g.cur.y + 1);
    }

    // any successful nudge while grounded buys a little more grace, up to a cap
    function refreshLock() {
      if (touchedDown() && g.resets < LOCK_RESETS_BS) {
        g.lockT = 0;
        g.resets++;
      }
    }

    function tryMove(dx) {
      if (!g.cur || g.over) return false;
      if (collideBS(g.grid, g.cur.m, g.cur.x + dx, g.cur.y)) return false;
      g.cur.x += dx;
      refreshLock();
      return true;
    }

    function rotate(dir) {
      if (!g.cur || g.over) return false;
      const m2 = rotateBS(g.cur.m, dir);
      for (let i = 0; i < KICKS_BS.length; i++) {
        const nx = g.cur.x + KICKS_BS[i];
        if (!collideBS(g.grid, m2, nx, g.cur.y)) {
          g.cur.m = m2;
          g.cur.x = nx;
          refreshLock();
          beep('hover');
          return true;
        }
      }
      return false;
    }

    function softStep() {
      if (!g.cur || g.over) return false;
      if (collideBS(g.grid, g.cur.m, g.cur.x, g.cur.y + 1)) return false;
      g.cur.y++;
      g.score += 1;
      g.dropT = 0;
      g.lockT = 0;
      return true;
    }

    function hardDrop() {
      if (!g.cur || g.over) return;
      let d = 0;
      while (!collideBS(g.grid, g.cur.m, g.cur.x, g.cur.y + 1)) { g.cur.y++; d++; }
      g.score += d * 2;
      lockPiece();
    }

    function lockPiece() {
      if (!g.cur) return;
      const m = g.cur.m;
      const k = g.cur.k;
      /* A piece that comes to rest with a cell still above the ceiling cannot be
         stored — a vertical I locked on a 17-high column used to lose its top
         block and leave a phantom gap. That is a top-out, so end the run and
         leave the killing piece on screen. */
      for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m.length; c++) {
          if (m[r][c] && g.cur.y + r < 0) { endGame(); return; }
        }
      }
      for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m.length; c++) {
          if (!m[r][c]) continue;
          const y = g.cur.y + r;
          const x = g.cur.x + c;
          if (y >= 0 && y < ROWS_BS && x >= 0 && x < COLS_BS) g.grid[y][x] = k;
        }
      }
      g.cur = null;
      g.lockT = 0;
      g.resets = 0;
      g.dropT = 0;

      const rows = [];
      for (let y = 0; y < ROWS_BS; y++) {
        let full = true;
        for (let x = 0; x < COLS_BS; x++) { if (!g.grid[y][x]) { full = false; break; } }
        if (full) rows.push(y);
      }
      if (rows.length) {
        const four = rows.length === 4;
        g.clear = { rows: rows, t: 0, four: four };
        if (four) beep('levelup'); else beep('coin');
      } else {
        beep('back');   // the thunk of a piece settling
        spawn();
      }
    }

    function resolveClear() {
      const rows = g.clear.rows;
      const n = rows.length;
      g.score += (CLEAR_SCORE_BS[n] || 0) * g.level;
      const kept = [];
      for (let y = 0; y < ROWS_BS; y++) {
        if (rows.indexOf(y) === -1) kept.push(g.grid[y]);
      }
      while (kept.length < ROWS_BS) kept.unshift(new Array(COLS_BS).fill(0));
      g.grid = kept;
      g.lines += n;
      const nl = Math.floor(g.lines / 10) + 1;
      if (nl > g.level) { g.level = nl; beep('powerup'); }
      g.clear = null;
      spawn();
    }

    function togglePause() {
      if (g.over) return;
      g.paused = !g.paused;
      held.left = false; held.right = false; held.down = false;
      beep('hover');
    }

    function endGame() {
      if (g.over) return;
      g.over = true;
      g.paused = false;
      running = false;
      cancelAnimationFrame(raf);
      held.left = false; held.right = false; held.down = false;
      draw();                    // freeze the board that killed the run on screen
      beep('back');
      const fin = g.score;
      syncHud();
      setBest((b) => {
        const nb = Math.max(b, fin);
        try { localStorage.setItem('zb_bs_best', String(nb)); } catch (err) {}
        return nb;
      });
      if (!g.scored) {
        g.scored = true;
        const cb = scoreCbRef.current;
        cb && cb(fin);
      }
      setPhase('over');
    }

    function syncHud() {
      if (shown.score !== g.score) { shown.score = g.score; setScore(g.score); }
      if (shown.lines !== g.lines) { shown.lines = g.lines; setLines(g.lines); }
      if (shown.level !== g.level) { shown.level = g.level; setLevel(g.level); }
    }

    /* ---------- simulation ---------- */
    function tick(dt) {
      if (g.over || g.paused) return;

      if (g.clear) {
        g.clear.t += dt;
        if (g.clear.t >= CLEAR_MS_BS) resolveClear();
        return;
      }
      if (!g.cur) return;

      const both = held.left && held.right;
      if (held.left && !(both && lastDir === 1)) {
        rep.left -= dt;
        if (rep.left <= 0) { if (tryMove(-1)) beep('move'); rep.left = ARR_MS_BS; }
      }
      if (held.right && !(both && lastDir === -1)) {
        rep.right -= dt;
        if (rep.right <= 0) { if (tryMove(1)) beep('move'); rep.right = ARR_MS_BS; }
      }
      if (held.down) {
        rep.down -= dt;
        if (rep.down <= 0) { softStep(); rep.down = SOFT_MS_BS; }
      }
      if (!g.cur) return;   // a held key can end the piece's life mid-tick

      if (touchedDown()) {
        g.lockT += dt;
        if (g.lockT >= (held.down ? LOCK_FAST_BS : LOCK_MS_BS)) lockPiece();
      } else {
        g.lockT = 0;
        g.resets = 0;
        g.dropT += dt;
        const gm = gravityMsBS(g.level);
        while (g.dropT >= gm) {
          g.dropT -= gm;
          if (collideBS(g.grid, g.cur.m, g.cur.x, g.cur.y + 1)) break;
          g.cur.y++;
        }
      }
    }

    /* ---------- drawing ---------- */
    function label(text, x, y, col, align) {
      ctx.font = fontPx + 'px "Press Start 2P", monospace';
      ctx.textAlign = align || 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = col;
      ctx.fillText(text, x, y);
    }

    function drawWell() {
      ctx.fillStyle = 'rgba(4,9,18,0.72)';
      ctx.fillRect(wellX, wellY, wellW, wellH);

      ctx.strokeStyle = pal.line;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let c = 1; c < COLS_BS; c++) {
        const x = wellX + c * cell + 0.5;
        ctx.moveTo(x, wellY); ctx.lineTo(x, wellY + wellH);
      }
      for (let r = 1; r < ROWS_BS; r++) {
        const y = wellY + r * cell + 0.5;
        ctx.moveTo(wellX, y); ctx.lineTo(wellX + wellW, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    function drawStack() {
      for (let y = 0; y < ROWS_BS; y++) {
        for (let x = 0; x < COLS_BS; x++) {
          const k = g.grid[y][x];
          if (!k) continue;
          drawCellBS(ctx, wellX + x * cell, wellY + y * cell, cell - 1, pal[k] || pal.accent);
        }
      }
    }

    function drawPiece() {
      if (!g.cur) return;
      const m = g.cur.m;
      const col = pal[g.cur.k] || pal.accent;

      // ghost: where this piece lands if left alone
      let gy = g.cur.y;
      while (!collideBS(g.grid, m, g.cur.x, gy + 1)) gy++;
      if (gy !== g.cur.y) {
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = col;
        for (let r = 0; r < m.length; r++) {
          for (let c = 0; c < m.length; c++) {
            if (!m[r][c]) continue;
            const y = gy + r;
            if (y < 0) continue;
            ctx.fillRect(
              Math.round(wellX + (g.cur.x + c) * cell),
              Math.round(wellY + y * cell),
              Math.max(2, cell - 1), Math.max(2, cell - 1)
            );
          }
        }
        ctx.globalAlpha = 1;
      }

      for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m.length; c++) {
          if (!m[r][c]) continue;
          const y = g.cur.y + r;
          if (y < 0) continue;
          drawCellBS(ctx, wellX + (g.cur.x + c) * cell, wellY + y * cell, cell - 1, col);
        }
      }
    }

    function drawClear() {
      if (!g.clear) return;
      const on = Math.floor(g.clear.t / 55) % 2 === 0;
      const rows = g.clear.rows;
      for (let i = 0; i < rows.length; i++) {
        ctx.globalAlpha = g.clear.four ? 0.95 : 0.72;
        ctx.fillStyle = on ? '#ffffff' : pal.accent;
        ctx.fillRect(wellX, wellY + rows[i] * cell, wellW, Math.max(2, cell - 1));
      }
      ctx.globalAlpha = 1;
      if (g.clear.four && on) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(wellX - 1, wellY - 1, wellW + 2, wellH + 2);
      }
    }

    function drawFrame() {
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(wellX - 1, wellY - 1, wellW + 2, wellH + 2);
    }

    function drawSides() {
      if (gutter < 34) return;

      // LEFT — level / lines, hugging the well, plus the control legend
      const lx = wellX - 10;
      let ly = wellY + 2;
      label('LEVEL', lx, ly, pal.dim, 'right'); ly += fontPx + 5;
      label(String(g.level), lx, ly, pal.accent, 'right'); ly += fontPx + 14;
      label('LINES', lx, ly, pal.dim, 'right'); ly += fontPx + 5;
      label(String(g.lines), lx, ly, pal.good, 'right');

      if (wellH > 240 && gutter >= 46) {
        const legend = ['<  >', 'MOVE', 'Z  X', 'TURN', 'SPC', 'DROP', 'P', 'PAUSE'];
        ctx.globalAlpha = 0.45;
        let by = wellY + wellH - fontPx - 2;
        for (let i = legend.length - 1; i >= 0; i--) {
          label(legend[i], lx, by, pal.dim, 'right');
          by -= fontPx + 3;
        }
        ctx.globalAlpha = 1;
      }

      // RIGHT — NEXT preview
      const bx = wellX + wellW + 10;
      label('NEXT', bx, wellY + 2, pal.dim, 'left');
      const k = g.next;
      if (!k) return;
      const m = SHAPES_BS[k];
      const bd = boundsBS(m);
      const boxW = previewCell * 4 + 8;
      const boxH = previewCell * 4 + 8;
      const boxX = bx;
      const boxY = wellY + fontPx + 10;
      ctx.strokeStyle = pal.line;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW, boxH);
      ctx.globalAlpha = 1;
      const pw = (bd.c1 - bd.c0 + 1) * previewCell;
      const ph = (bd.r1 - bd.r0 + 1) * previewCell;
      const ox = boxX + Math.round((boxW - pw) / 2);
      const oy = boxY + Math.round((boxH - ph) / 2);
      for (let r = bd.r0; r <= bd.r1; r++) {
        for (let c = bd.c0; c <= bd.c1; c++) {
          if (!m[r][c]) continue;
          drawCellBS(
            ctx,
            ox + (c - bd.c0) * previewCell,
            oy + (r - bd.r0) * previewCell,
            previewCell - 1,
            pal[k] || pal.accent
          );
        }
      }
    }

    function drawPause() {
      if (!g.paused || g.over) return;
      ctx.fillStyle = 'rgba(7,11,20,0.80)';
      ctx.fillRect(wellX, wellY, wellW, wellH);
      const cx = wellX + Math.round(wellW / 2);
      ctx.font = fontPx + 'px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = pal.accent;
      ctx.fillText('PAUSED', cx, wellY + Math.round(wellH / 2) - fontPx);
      ctx.fillStyle = pal.dim;
      ctx.fillText('P RESUMES', cx, wellY + Math.round(wellH / 2) + fontPx + 4);
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      drawWell();
      drawStack();
      drawPiece();
      drawClear();
      drawFrame();
      drawSides();
      drawPause();
    }

    /* ---------- loop ---------- */
    function step(now) {
      if (!running) return;
      const dt = Math.min(100, Math.max(0, now - last));
      last = now;
      frames++;

      // the canvas is sized in vh/%, so re-layout whenever the box changes — and
      // whenever the DPI does, which a window dragged between monitors changes
      // without touching the CSS box
      if (frames % 15 === 0) {
        pal = paletteBS();
        const cw = Math.max(1, canvas.clientWidth);
        const ch = Math.max(1, canvas.clientHeight);
        const d = Math.min(window.devicePixelRatio || 1, 2);
        if (cw !== w || ch !== h || d !== dpr) size();
      }

      tick(dt);
      if (!running) return;      // tick() may have ended the run
      draw();
      syncHud();
      raf = requestAnimationFrame(step);
    }

    /* ---------- input ---------- */
    const kd = (e) => {
      if (g.over) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === 'Escape') return;                 // close is handled elsewhere
      const low = typeof k === 'string' && k.length === 1 ? k.toLowerCase() : k;
      let hit = true;

      if (k === 'ArrowLeft' || low === 'a') {
        if (!g.paused) {
          if (!e.repeat) { if (tryMove(-1)) beep('move'); rep.left = DAS_MS_BS; }
          held.left = true; lastDir = -1;
        }
      } else if (k === 'ArrowRight' || low === 'd') {
        if (!g.paused) {
          if (!e.repeat) { if (tryMove(1)) beep('move'); rep.right = DAS_MS_BS; }
          held.right = true; lastDir = 1;
        }
      } else if (k === 'ArrowDown' || low === 's') {
        if (!g.paused) {
          if (!e.repeat) { softStep(); rep.down = SOFT_MS_BS; }
          held.down = true;
        }
      } else if (k === 'ArrowUp' || low === 'x') {
        if (!g.paused && !e.repeat) rotate(1);
      } else if (low === 'z') {
        if (!g.paused && !e.repeat) rotate(-1);
      } else if (k === ' ' || k === 'Spacebar') {
        if (!g.paused && !e.repeat) hardDrop();
      } else if (low === 'p') {
        if (!e.repeat) togglePause();
      } else {
        hit = false;
      }
      if (hit) e.preventDefault();
    };

    const ku = (e) => {
      const k = e.key;
      const low = typeof k === 'string' && k.length === 1 ? k.toLowerCase() : k;
      // releasing one direction re-charges the other if it is still held down
      if (k === 'ArrowLeft' || low === 'a') {
        held.left = false;
        if (held.right) { lastDir = 1; rep.right = DAS_MS_BS; }
      } else if (k === 'ArrowRight' || low === 'd') {
        held.right = false;
        if (held.left) { lastDir = -1; rep.left = DAS_MS_BS; }
      } else if (k === 'ArrowDown' || low === 's') held.down = false;
    };

    // touch / mouse: drag sideways to move, tap to rotate, swipe down to slam
    let pd = null;
    const pdown = (e) => {
      if (g.over) return;
      pd = { x: e.clientX, y: e.clientY, ox: e.clientX, t: performance.now(), moved: false };
    };
    const pmove = (e) => {
      if (!pd || g.paused || g.over) return;
      const stepPx = Math.max(16, cell);
      const dx = e.clientX - pd.ox;
      if (Math.abs(dx) >= stepPx) {
        const dir = dx > 0 ? 1 : -1;
        const n = Math.floor(Math.abs(dx) / stepPx);
        for (let i = 0; i < n; i++) { if (tryMove(dir)) beep('move'); }
        pd.ox += dir * stepPx * n;
        pd.moved = true;
      }
    };
    const pup = (e) => {
      if (!pd) return;
      const dx = e.clientX - pd.x;
      const dy = e.clientY - pd.y;
      const dur = performance.now() - pd.t;
      pd = null;
      if (g.over) return;
      if (g.paused) { togglePause(); return; }
      if (dy > 46 && Math.abs(dy) > Math.abs(dx)) hardDrop();
      else if (Math.abs(dx) < 14 && Math.abs(dy) < 14 && dur < 400) rotate(1);
    };
    const pcancel = () => { pd = null; };

    // hidden tab: stop the loop outright and park the run paused
    const onVis = () => {
      if (document.hidden) {
        if (!g.over && !g.paused) g.paused = true;
        held.left = false; held.right = false; held.down = false;
        running = false;
        cancelAnimationFrame(raf);
      } else if (!g.over && !running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    };
    const onBlur = () => { held.left = false; held.right = false; held.down = false; };

    size();
    g.next = takeBS();
    spawn();
    draw();
    relayoutRef.current = () => { size(); draw(); };

    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVis);
    canvas.addEventListener('pointerdown', pdown);
    canvas.addEventListener('pointermove', pmove);
    canvas.addEventListener('pointerup', pup);
    canvas.addEventListener('pointercancel', pcancel);
    canvas.addEventListener('pointerleave', pcancel);

    if (running) raf = requestAnimationFrame(step);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('pointerdown', pdown);
      canvas.removeEventListener('pointermove', pmove);
      canvas.removeEventListener('pointerup', pup);
      canvas.removeEventListener('pointercancel', pcancel);
      canvas.removeEventListener('pointerleave', pcancel);
    };
  }, [phase]);

  /* Sizing outlives the run: during play this re-lays-out mid-game, and on the
     GAME OVER screen it keeps the frozen board behind the overlay from being
     stretched by a window resize or a phone rotation. */
  useEffectBS(() => {
    const onResize = () => { const f = relayoutRef.current; if (f) f(); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); relayoutRef.current = null; };
  }, []);

  // esc closes the modal, in play or not
  useEffectBS(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const startPlay = () => {
    sfx && sfx.warm();
    sfx && sfx.select();
    setScore(0);
    setLines(0);
    setLevel(1);
    setPhase('play');
  };

  const isRecord = score > 0 && score >= best;

  return (
    <div className="mg" onClick={(e) => { if (e.target.classList.contains('mg')) onClose(); }}>
      <div className="mg-card">
        <div className="mg-hud">
          <span className="mg-kicker">TETRIS</span>
          <div className="mg-stats" style={{ flexWrap: 'wrap' }}>
            <span>SCORE <b>{String(score).padStart(5, '0')}</b></span>
            <span>LINES <b>{String(lines).padStart(3, '0')}</b></span>
            <span>LEVEL <b>{String(level).padStart(2, '0')}</b></span>
            <span>BEST <b>{String(best).padStart(5, '0')}</b></span>
          </div>
          <button className="mg-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="mg-stage">
          <canvas ref={canvasRef} className="mg-canvas" style={{ touchAction: 'none' }} />

          {phase === 'intro' && (
            <div className="mg-overlay">
              <div className="mg-title">TETRIS</div>
              <p className="mg-rules">
                Fit the falling blocks together. A <b className="g">full row</b> clears
                and scores; four rows at once is a <b className="y">MEGA CLEAR</b>.<br /><br />
                ◄ ► move · ▼ soft drop · Z / X rotate<br />
                SPACE hard drop · P pause<br />
                <b className="r">Stack to the top and it ends.</b>
              </p>
              <button className="btn accent" onClick={startPlay}>► START</button>
            </div>
          )}

          {phase === 'over' && (
            <div className="mg-overlay">
              <div className="mg-title">STACK OUT</div>
              <p className="mg-rules">
                FINAL SCORE <b className="g">{String(score).padStart(5, '0')}</b><br />
                {lines} LINES · LEVEL {level}<br />
                {isRecord
                  ? <span className="y">★ NEW HIGH SCORE ★</span>
                  : <>BEST {String(best).padStart(5, '0')}</>}
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button className="btn accent" onClick={startPlay}>► RETRY</button>
                <button className="btn ghost" onClick={onClose}>QUIT</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { BlockStack });
