/* app.jsx — root: boot phase, TV transitions, HUD, tweaks + sound */
const { useState, useEffect, useRef, useCallback } = React;

const SCREENS = {
  menu:       { title: 'MAIN MENU',  comp: null },
  about:      { title: 'ABOUT',      comp: 'AboutScreen' },
  skills:     { title: 'SKILLS',     comp: 'SkillsScreen' },
  experience: { title: 'EXPERIENCE', comp: 'ExperienceScreen' },
  projects:   { title: 'PROJECTS',   comp: 'ProjectsScreen' },
  contact:    { title: 'CONTACT',    comp: 'ContactScreen' },
  options:    { title: 'OPTIONS',    comp: 'OptionsScreen' },
};
const LEVEL_ORDER = ['about', 'skills', 'experience', 'projects', 'contact', 'options'];
const ATTRACT_ORDER = ['about', 'skills', 'experience', 'projects', 'contact'];

const FONT_MAP = {
  'Press Start 2P': "'Press Start 2P', monospace",
  'Silkscreen': "'Silkscreen', monospace",
  'Pixelify Sans': "'Pixelify Sans', monospace",
};
const ACCENTS = ['#46a6ff', '#5ce08a', '#ff5ac8', '#ffb43d'];

/* ---- XP system ---- */
const XP_PER_LEVEL = 100;
function loadXp() { const n = parseInt(localStorage.getItem('zb_xp') || '0', 10); return isNaN(n) ? 0 : n; }
function xpToLevel(xp) { return Math.floor(xp / XP_PER_LEVEL) + 1; }

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#46a6ff",
  "scanlines": 0.22,
  "animSpeed": 1,
  "pixelFont": "Press Start 2P",
  "sound": true,
  "music": true,
  "parallax": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [phase, setPhase] = useState(() => ((document.hidden && !location.search.includes('boot')) ? 'ready' : 'boot'));   // 'boot' | 'ready'
  const [screen, setScreen] = useState('menu');
  const [anim, setAnim] = useState('');          // '' | 'off' | 'on'
  const [visited, setVisited] = useState(() => new Set());
  const [secret, setSecret] = useState(false);
  const [minigame, setMinigame] = useState(false);
  const [cam, setCam] = useState(false);
  const [xp, setXp] = useState(loadXp);
  const [leveling, setLeveling] = useState(false);
  const busy = useRef(false);

  const sfx = window.SFX;

  // cabinet ref for mouse-parallax tilt
  const cabinetRef = useRef(null);
  useParallax(cabinetRef, { enabled: t.parallax !== false, max: 5 });

  // achievements + toasts
  const [toasts, pushToast] = useToasts();
  const { unlock, earned, resetEarned } = useAchievements(pushToast, sfx);
  const screenRef = useRef(screen);
  screenRef.current = screen;

  // award XP; detect level-up
  const xpRef = useRef(xp);
  xpRef.current = xp;
  const addXp = useCallback((amount, reason) => {
    const before = xpRef.current;
    const after = before + amount;
    xpRef.current = after;
    setXp(after);
    try { localStorage.setItem('zb_xp', String(after)); } catch (e) {}
    if (xpToLevel(after) > xpToLevel(before)) {
      setLeveling(true);
      setTimeout(() => setLeveling(false), 1600);
      sfx.levelup();
      pushToast({ icon: '\u25b2', kicker: 'LEVEL UP', title: 'REACHED LV.' + xpToLevel(after) });
    }
  }, [pushToast]);

  useEffect(() => { sfx.setMuted(!t.sound); }, [t.sound]);

  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', t.accent);
    r.style.setProperty('--scan-opacity', String(t.scanlines));
    r.style.setProperty('--anim-speed', String(t.animSpeed));
    r.style.setProperty('--font-display', FONT_MAP[t.pixelFont] || FONT_MAP['Press Start 2P']);
  }, [t.accent, t.scanlines, t.animSpeed, t.pixelFont]);

  const ms = (base) => base * (parseFloat(t.animSpeed) || 1);

  // returning-player achievement (>1 play) — fire once after boot
  useEffect(() => {
    if (phase !== 'ready') return;
    if (PLAY_COUNT > 1) { setTimeout(() => unlock('returning'), 700); setTimeout(() => addXp(10, 'return'), 900); }
  }, [phase]);

  // tinkerer achievement — when tweaks panel becomes visible
  useEffect(() => {
    let awarded = false;
    const check = () => {
      const panel = document.querySelector('.twk-panel');
      if (panel && panel.offsetParent !== null && !awarded) { awarded = true; unlock('tinkerer'); addXp(15, 'tweaks'); }
    };
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [unlock, addXp]);

  // music: start after boot, follow the music tweak + mute
  useEffect(() => {
    if (phase !== 'ready') return;
    if (t.music && t.sound) sfx.startMusic(); else sfx.stopMusic();
  }, [phase, t.music, t.sound]);

  // Konami code -> secret panel
  useKonami(useCallback(() => {
    sfx.warm();
    unlock('konami');
    addXp(40, 'konami');
    setSecret(true);
  }, [unlock, addXp]));

  const go = useCallback((id) => {
    if (busy.current || id === screen) return;
    busy.current = true;
    sfx.warm();
    if (id === 'menu') sfx.back(); else sfx.select();
    if (id !== 'menu' && !visited.has(id)) {
      const nextVisited = new Set(visited); nextVisited.add(id);
      setVisited(nextVisited);
      setTimeout(() => sfx.coin(), ms(220));
      addXp(25, 'level');
      if (nextVisited.size === 1) setTimeout(() => unlock('first_step'), ms(420));
      if (ATTRACT_ORDER.every((k) => nextVisited.has(k))) setTimeout(() => unlock('completionist'), ms(560));
    }
    setAnim('off');                       // collapse current
    setTimeout(() => {
      setScreen(id);
      setAnim('on');                      // expand new
      setTimeout(() => { setAnim(''); busy.current = false; }, ms(320));
    }, ms(190));
  }, [screen, visited, t.animSpeed, unlock, addXp]);

  // skip-typing on click inside a sub-screen
  const onScreenClick = () => { if (!busy.current) document.dispatchEvent(new Event('zb:skiptype')); };

  // keyboard: digits jump, Esc back (only when playing)
  useEffect(() => {
    if (phase !== 'ready') return;
    const onKey = (e) => {
      if (e.key === 'Escape') { if (screen !== 'menu') go('menu'); return; }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= LEVEL_ORDER.length) go(LEVEL_ORDER[n - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, screen, go]);

  const startGame = () => {
    setPhase('ready');
    setScreen('menu');
    setAnim('on');
    setTimeout(() => setAnim(''), ms(340));
  };

  // attract mode — when idle on the menu, auto-cycle levels like an arcade demo
  const attractIdx = useRef(0);
  useAttract({
    enabled: phase === 'ready' && !secret,
    idleMs: 16000,
    cycleMs: 4600,
    onTick: useCallback(() => {
      if (busy.current || secret) return;
      const cur = screenRef.current;
      // cycle menu -> about -> ... -> contact -> menu ...
      const order = ['menu', ...ATTRACT_ORDER];
      const i = order.indexOf(cur);
      const next = order[(i + 1) % order.length];
      go(next);
    }, [go, secret]),
  });

  // tab title flasher
  useEffect(() => {
    const titles = ['◄ ZAKARIAE BELFKIH ►', '▸ PLAYER 1 · PRESS START ◂'];
    let i = 0;
    const base = 'ZAKARIAE BELFKIH — Integration & Full-Stack Dev';
    document.title = base;
    const iv = setInterval(() => {
      document.title = titles[i % titles.length];
      i += 1;
    }, 2600);
    return () => { clearInterval(iv); document.title = base; };
  }, []);

  const isMenu = screen === 'menu';
  const Comp = isMenu ? null : window[SCREENS[screen].comp];
  const tubeCls = 'tube' + (anim === 'off' ? ' tv-off' : anim === 'on' ? ' tv-on' : '');
  const level = xpToLevel(xp);
  const xpPct = ((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100;

  const resetSave = () => {
    try { localStorage.removeItem('zb_xp'); localStorage.removeItem('zb_plays'); localStorage.removeItem('zb_pc_best'); } catch (e) {}
    resetEarned();
    xpRef.current = 0;
    setXp(0);
    setVisited(new Set());
  };

  const screenProps = screen === 'options'
    ? { sfx, t, setTweak, cam, setCam, earned, xp, level, plays: PLAY_COUNT, onReset: resetSave }
    : { sfx };

  return (
    <div className="stage">
      <AmbientParticles />
      <div className="cabinet" ref={cabinetRef}>
        <div className="hud">
          <div className="hud-left">
            {isMenu ? (
              <span className="hud-title">▮ MAIN MENU</span>
            ) : (
              <>
                <button className="back-btn" onClick={() => go('menu')} onMouseEnter={() => sfx.hover()}>◄ MENU</button>
                <span className="hud-title">{SCREENS[screen].title}</span>
              </>
            )}
          </div>
          <div className="hud-right">
            <button
              className="icon-btn"
              onClick={() => { sfx.warm(); sfx.select(); setCam((v) => !v); }}
              title={cam ? 'Turn gesture camera off' : 'Control with hand gestures (camera)'}
            >
              {cam ? '◉ CAM ON' : '◉ CAM'}
            </button>
            <div className={'xp' + (leveling ? ' levelup' : '')} title={'XP ' + (xp % XP_PER_LEVEL) + ' / ' + XP_PER_LEVEL}>
              <span className="xp-lv">LV.{level}</span>
              <span className="xp-track"><span className="xp-fill" style={{ width: xpPct + '%' }} /></span>
            </div>
            <span className="hud-coins">★ x {visited.size}</span>
            <button
              className="icon-btn"
              onClick={() => {
                sfx.warm();
                const next = !t.sound;
                setTweak('sound', next);
                if (next) { sfx.setMuted(false); setTimeout(() => sfx.select(), 0); }
              }}
              title={t.sound ? 'Mute' : 'Unmute'}
            >
              {t.sound ? '♪ ON' : '♪ OFF'}
            </button>
          </div>
        </div>

        <div className="screen-area" onClick={onScreenClick}>
          <div key={screen} className={tubeCls}>
            <div className={'screen' + (isMenu ? ' is-menu' : '')}>
              {isMenu
                ? <><IntegrationMap paused={anim !== ''} /><TitleScreen onPick={go} sfx={sfx} /></>
                : <Comp {...screenProps} />}
            </div>
          </div>
          <div key={'sweep-' + screen} className="scan-sweep" aria-hidden="true" />
        </div>
      </div>

      {phase === 'boot' && <BootScreen onStart={startGame} sfx={sfx} />}
      {secret && <SecretPanel onClose={() => { sfx.back(); setSecret(false); }} onPlay={() => { sfx.select(); setSecret(false); setMinigame(true); }} />}
      {minigame && <PacketCatch sfx={sfx} onClose={() => { sfx.back(); setMinigame(false); }}
        onScore={(s) => { unlock('konami'); addXp(20, 'minigame'); if (s >= 30) addXp(20, 'highscore'); }} />}
      <GestureControl enabled={cam} sfx={sfx} onDisable={() => setCam(false)}
        onFirstTrack={() => { unlock('gesture'); addXp(20, 'gesture'); }} />
      <ToastStack toasts={toasts} />

      <TweaksPanel>
        <TweakSection label="Look" />
        <TweakColor label="Accent" value={t.accent} options={ACCENTS}
          onChange={(v) => setTweak('accent', v)} />
        <TweakSlider label="Scanlines" value={t.scanlines} min={0} max={0.45} step={0.01}
          onChange={(v) => setTweak('scanlines', v)} />
        <TweakSelect label="Pixel font" value={t.pixelFont}
          options={['Press Start 2P', 'Silkscreen', 'Pixelify Sans']}
          onChange={(v) => setTweak('pixelFont', v)} />
        <TweakSection label="Motion & Sound" />
        <TweakSlider label="Anim speed" value={t.animSpeed} min={0.4} max={2} step={0.1} unit="x"
          onChange={(v) => setTweak('animSpeed', v)} />
        <TweakToggle label="Sound FX" value={t.sound}
          onChange={(v) => setTweak('sound', v)} />
        <TweakToggle label="Music" value={t.music}
          onChange={(v) => { setTweak('music', v); if (v && t.sound) sfx.startMusic(); else sfx.stopMusic(); }} />
        <TweakToggle label="Parallax tilt" value={t.parallax !== false}
          onChange={(v) => setTweak('parallax', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
