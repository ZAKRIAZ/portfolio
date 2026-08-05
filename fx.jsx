/* fx.jsx — boot sequence + segmented typewriter */
const { useState: useStateFx, useEffect: useEffectFx, useRef: useRefFx } = React;

const PREFERS_REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------
   Typewriter — types out text, supports bold segments.
   parts: a string, OR an array of { t, b } segments.
   Click anywhere fires document 'zb:skiptype' to finish instantly.
   --------------------------------------------------------- */
function Type({ parts, speed = 14, delay = 0, cursor = true }) {
  const segs = typeof parts === 'string' ? [{ t: parts }] : parts;
  const total = segs.reduce((a, s) => a + s.t.length, 0);
  const [n, setN] = useStateFx(PREFERS_REDUCED ? total : 0);

  useEffectFx(() => {
    if (PREFERS_REDUCED || document.hidden) { setN(total); return; }
    setN(0);
    let i = 0, iv = null;
    const st = setTimeout(() => {
      iv = setInterval(() => {
        i += 1;
        setN(i);
        if (i >= total) clearInterval(iv);
      }, speed);
    }, delay);
    const skip = () => { setN(total); clearTimeout(st); clearInterval(iv); };
    document.addEventListener('zb:skiptype', skip);
    document.addEventListener('visibilitychange', skip);
    return () => { clearTimeout(st); clearInterval(iv); document.removeEventListener('zb:skiptype', skip); document.removeEventListener('visibilitychange', skip); };
  }, []);

  let rem = n;
  const out = [];
  segs.forEach((s, idx) => {
    const take = Math.max(0, Math.min(s.t.length, rem));
    rem -= s.t.length;
    const txt = s.t.slice(0, take);
    if (!txt) return;
    out.push(s.b ? <b key={idx}>{txt}</b> : <React.Fragment key={idx}>{txt}</React.Fragment>);
  });
  const typing = n < total;
  return (
    <>
      {out}
      {cursor && typing && !PREFERS_REDUCED && <span className="tw-cur">▋</span>}
    </>
  );
}

/* ---------------------------------------------------------
   BootScreen — CRT power-on, BIOS log, loading bar, PRESS START
   --------------------------------------------------------- */
const BOOT_LINES = [
  { t: 'ZAKARIAE-OS  v2.6', c: 'accent' },
  { t: 'RABAT, MOROCCO   (c) 2026', c: 'dim' },
  { t: '', c: 'dim' },
  { t: 'DETECTING SKILLS .............. OK', c: 'ok' },
  { t: 'MOUNTING  /INTEGRATIONS ....... OK', c: 'ok' },
  { t: 'LINKING   ERP // EDI // APIS ... OK', c: 'ok' },
  { t: 'LOADING   PROJECTS ............ OK', c: 'ok' },
  { t: 'INIT      FULL-STACK ENGINE ... OK', c: 'ok' },
];

function BootScreen({ onStart, sfx }) {
  const [revealed, setRevealed] = useStateFx(PREFERS_REDUCED ? BOOT_LINES.length : 0);
  const [ready, setReady] = useStateFx(PREFERS_REDUCED);
  const [closing, setClosing] = useStateFx(false);
  const doneRef = useRefFx(false);

  // reveal log lines one at a time
  useEffectFx(() => {
    if (PREFERS_REDUCED) return;
    if (revealed >= BOOT_LINES.length) {
      const r = setTimeout(() => { setReady(true); sfx && sfx.coin(); }, 360);
      return () => clearTimeout(r);
    }
    const id = setTimeout(() => {
      setRevealed((v) => v + 1);
      sfx && sfx.move();
    }, revealed === 0 ? 420 : 230);
    return () => clearTimeout(id);
  }, [revealed]);

  const finishLog = () => { setRevealed(BOOT_LINES.length); };

  const start = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    sfx && sfx.warm();
    sfx && sfx.select();
    setClosing(true);
    setTimeout(onStart, PREFERS_REDUCED ? 0 : 420);
  };

  const handleActivate = () => {
    sfx && sfx.warm();
    if (!ready) { finishLog(); return; }
    start();
  };

  // any key to advance / start
  useEffectFx(() => {
    const onKey = (e) => {
      if (e.key === 'Tab') return;
      e.preventDefault();
      handleActivate();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready]);

  const pct = Math.round((revealed / BOOT_LINES.length) * 100);

  return (
    <div className={'boot' + (closing ? ' closing' : '')} onClick={handleActivate}>
      <div className="boot-scan" />
      <div className="boot-inner">
        <div className="boot-log">
          {BOOT_LINES.slice(0, revealed).map((l, i) => (
            <div key={i} className={'boot-line ' + (l.c || '')}>{l.t || '\u00a0'}</div>
          ))}
        </div>

        {!ready ? (
          <div className="boot-loadwrap">
            <div className="boot-bar">
              <div className="boot-fill" style={{ width: pct + '%' }} />
            </div>
            <div className="boot-pct">LOADING {pct}%</div>
          </div>
        ) : (
          <div className="boot-ready">
            <div className="boot-press blink">PRESS START</div>
            <div className="boot-hint">▸ CLICK OR PRESS ANY KEY ◂</div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { Type, BootScreen });

/* QA FIX (2026-08-05) — the sub-screen entrance cascade in styles.css uses
   `animation-fill-mode: both`, so while the tab is hidden (background tab,
   prerender, screenshot bots) the animation never advances and every child
   sits at its 0% keyframe: opacity 0. Result: a blank screen. Flag hidden
   documents so the CSS can skip the entrance and show content immediately. */
(function markHiddenDocument() {
  const sync = () => document.documentElement.classList.toggle('no-entrance', document.hidden);
  sync();
  document.addEventListener('visibilitychange', sync);
})();
