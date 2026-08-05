/* extras.jsx — achievements/toasts, Konami code, attract mode, play counter, tab title */
const { useState: useStateX, useEffect: useEffectX, useRef: useRefX, useCallback: useCallbackX } = React;

/* ---------------------------------------------------------
   Play counter (localStorage) — increments once per load
   --------------------------------------------------------- */
function getPlayCount() {
  let n = parseInt(localStorage.getItem('zb_plays') || '0', 10);
  if (isNaN(n)) n = 0;
  n += 1;
  try { localStorage.setItem('zb_plays', String(n)); } catch (e) {}
  return n;
}
const PLAY_COUNT = getPlayCount();

/* ---------------------------------------------------------
   Achievement toast system
   useToasts() -> [toasts, push]
   --------------------------------------------------------- */
let _tid = 0;
function useToasts() {
  const [toasts, setToasts] = useStateX([]);
  const push = useCallbackX((data) => {
    const id = ++_tid;
    setToasts((list) => [...list, { id, ...data }]);
    setTimeout(() => {
      setToasts((list) => list.filter((x) => x.id !== id));
    }, data.duration || 4200);
  }, []);
  return [toasts, push];
}

function ToastStack({ toasts }) {
  return (
    <div className="toast-stack">
      {toasts.map((tt) => (
        <div className={'toast' + (tt.kind ? ' ' + tt.kind : '')} key={tt.id}>
          <div className="toast-ico">{tt.icon || '★'}</div>
          <div className="toast-body">
            <div className="toast-kicker">{tt.kicker || 'ACHIEVEMENT UNLOCKED'}</div>
            <div className="toast-title">{tt.title}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------
   The cabinet — games hidden behind DEV MODE.
   `comp` is looked up on window at render time, so a game
   file that fails to load degrades to a missing button
   rather than taking the page down with it.
   --------------------------------------------------------- */
const CABINET = [
  { id: 'packet', label: 'PACKET CATCH', comp: 'PacketCatch', blurb: 'Catch the good data, dodge the corrupted packets.' },
  { id: 'blocks', label: 'TETRIS',  comp: 'BlockStack',  blurb: 'Stack the falling blocks, clear the lines.' },
  { id: 'maze',   label: 'PAC-MAN', comp: 'MazeMuncher', blurb: 'Eat the cache, outrun the garbage collectors.' },
];

/* ---------------------------------------------------------
   Achievement definitions + persistence
   --------------------------------------------------------- */
const ACHIEVEMENTS = {
  /* exploring */
  first_step:    { icon: '▸', title: 'FIRST STEPS',   desc: 'Entered your first level.' },
  completionist: { icon: '✦', title: '100% COMPLETE', desc: 'Visited every level.' },
  speedrun:      { icon: '⏱', title: 'SPEEDRUN',      desc: 'Cleared all five levels in under a minute.' },
  deep_dive:     { icon: '⤓', title: 'DEEP DIVE',     desc: 'Read a level all the way to the bottom.' },
  /* secrets */
  konami:        { icon: '✪', title: 'SECRET FOUND',  desc: 'Entered the Konami code.',
                   hint: 'The 1988 Contra cheat. Thirty lives. Same ten buttons.' },
  coin_op:       { icon: '◈', title: 'COIN-OP',       desc: 'Played a round of Packet Catch.',
                   hint: 'There is a cabinet behind the cheat code.' },
  high_score:    { icon: '★', title: 'PACKET MASTER', desc: 'Scored 30 or more in Packet Catch.',
                   hint: 'The $ packets are worth triple.' },
  line_cook:     { icon: '▤', title: 'LINE COOK',     desc: 'Scored 2,000 or more in Tetris.',
                   hint: 'Clear four rows at once with the long straight piece.' },
  cache_cleaner: { icon: '◕', title: 'CACHE CLEANER', desc: 'Scored 2,000 or more in Pac-Man.',
                   hint: 'Power pellets first, then hunt the collectors.' },
  full_arcade:   { icon: '⛁', title: 'FULL ARCADE',   desc: 'Played all three cabinet games.',
                   hint: 'The cheat code opens more than one machine.' },
  /* tinkering */
  tinkerer:      { icon: '⚙', title: 'TINKERER',      desc: 'Changed a setting in Options.' },
  spectrum:      { icon: '◐', title: 'FULL SPECTRUM', desc: 'Tried every accent colour.' },
  gesture:       { icon: '◉', title: 'HANDS ON',      desc: 'Controlled the menu by camera.' },
  /* patience + timing */
  attract:       { icon: '⧗', title: 'ATTRACT MODE',  desc: 'Stood back and watched the demo reel.' },
  night_shift:   { icon: '☾', title: 'NIGHT SHIFT',   desc: 'Dropped by between midnight and 5am.' },
  returning:     { icon: '↺', title: 'PLAYER ONE',    desc: 'Came back for another play.' },
  veteran:       { icon: '⬢', title: 'VETERAN',       desc: 'Reached LV.4.' },
  /* the one that matters */
  handshake:     { icon: '✉', title: 'HANDSHAKE',     desc: 'Opened one of my links. Say hello?' },
};

function loadEarned() {
  try { return new Set(JSON.parse(localStorage.getItem('zb_achv') || '[]')); }
  catch (e) { return new Set(); }
}
function saveEarned(set) {
  try { localStorage.setItem('zb_achv', JSON.stringify([...set])); } catch (e) {}
}

/* hook: returns unlock(key) that fires a toast only the first time (per session for replayability of toast) */
function useAchievements(push, sfx) {
  const earnedRef = useRefX(loadEarned());
  const shownRef = useRefX(new Set()); // shown this session
  const [, force] = useStateX(0);

  const unlock = useCallbackX((key) => {
    const def = ACHIEVEMENTS[key];
    if (!def) return;
    if (shownRef.current.has(key)) return;       // don't double-toast in one session
    shownRef.current.add(key);
    const isNew = !earnedRef.current.has(key);
    earnedRef.current.add(key);
    saveEarned(earnedRef.current);
    force((n) => n + 1);
    sfx && sfx.coin();
    push({
      icon: def.icon,
      title: def.title,
      kicker: isNew ? 'ACHIEVEMENT UNLOCKED' : 'ACHIEVEMENT',
    });
  }, [push, sfx]);

  const resetEarned = useCallbackX(() => {
    earnedRef.current = new Set();
    shownRef.current = new Set();
    saveEarned(earnedRef.current);
    force((n) => n + 1);
  }, []);

  return { unlock, earned: earnedRef.current, resetEarned };
}

/* ---------------------------------------------------------
   Konami code hook  ↑↑↓↓←→←→ B A
   --------------------------------------------------------- */
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
function useKonami(onCode) {
  useEffectX(() => {
    let pos = 0;
    const onKey = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === KONAMI[pos]) {
        pos += 1;
        if (pos === KONAMI.length) { pos = 0; onCode(); }
      } else {
        // allow restart if the key matches first step
        pos = (k === KONAMI[0]) ? 1 : 0;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCode]);
}

/* ---------------------------------------------------------
   Attract mode — fires onTick after idleMs of no input,
   then repeatedly every cycleMs until any input resumes.
   --------------------------------------------------------- */
function useAttract({ enabled, idleMs = 16000, cycleMs = 4200, onTick, onExit }) {
  useEffectX(() => {
    if (!enabled) return;
    let idleTimer = null, cycle = null, active = false;
    const stop = () => {
      if (active) { active = false; onExit && onExit(); }
      clearInterval(cycle); cycle = null;
    };
    const arm = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        active = true;
        onTick();
        cycle = setInterval(onTick, cycleMs);
      }, idleMs);
    };
    const reset = () => {
      if (active) stop();
      arm();
    };
    const evs = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];
    evs.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    arm();
    return () => {
      clearTimeout(idleTimer); clearInterval(cycle);
      evs.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, [enabled, idleMs, cycleMs, onTick, onExit]);
}

/* ---------------------------------------------------------
   Secret credits overlay (Konami reward)
   --------------------------------------------------------- */
function SecretPanel({ onClose, onPlay }) {
  useEffectX(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="secret" onClick={onClose}>
      <div className="secret-card" onClick={(e) => e.stopPropagation()}>
        <div className="secret-kicker">✪ CHEAT CODE ACCEPTED ✪</div>
        <h2 className="secret-title">DEV MODE</h2>
        <div className="secret-credits">
          <div className="cred-row"><span>BUILT BY</span><b>ZAKARIAE BELFKIH</b></div>
          <div className="cred-row"><span>CLASS</span><b>INTEGRATION DEV</b></div>
          <div className="cred-row"><span>ENGINE</span><b>REACT + CSS</b></div>
          <div className="cred-row"><span>POWER-UP</span><b>30 EXTRA LIVES</b></div>
          <div className="cred-row"><span>STATUS</span><b className="blink-soft">OPEN TO WORK</b></div>
        </div>
        <p className="secret-foot">You found the secret. Tell me in your message and I'll know you're thorough. ▸ ESC TO CLOSE</p>
        {onPlay && (
          <>
            <div className="secret-kicker" style={{ marginTop: 18, marginBottom: 10 }}>◈ INSERT COIN ◈</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {CABINET.map((c) => (
                <button key={c.id} className="btn accent" onClick={() => onPlay(c.id)} title={c.blurb}>
                  ► {c.label}
                </button>
              ))}
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
          <button className="btn ghost" onClick={onClose}>CONTINUE</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  PLAY_COUNT, useToasts, ToastStack, ACHIEVEMENTS, useAchievements,
  useKonami, useAttract, SecretPanel, CABINET,
});
