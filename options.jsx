/* options.jsx — in-game OPTIONS screen: settings + achievements, styled as a console menu */
const { useState: useStateO } = React;

const OPT_ACCENTS = [
  { v: '#46a6ff', label: 'ELECTRIC BLUE' },
  { v: '#5ce08a', label: 'NEON GREEN' },
  { v: '#ff5ac8', label: 'ARCADE PINK' },
  { v: '#ffb43d', label: 'AMBER CRT' },
];
const OPT_FONTS = ['Press Start 2P', 'Silkscreen', 'Pixelify Sans'];

function OptRow({ label, hint, children }) {
  return (
    <div className="opt-row">
      <div className="opt-label">
        <span className="opt-name">{label}</span>
        {hint ? <span className="opt-hint">{hint}</span> : null}
      </div>
      <div className="opt-ctl">{children}</div>
    </div>
  );
}

function OptToggle({ on, onChange, sfx, onLabel = 'ON', offLabel = 'OFF' }) {
  return (
    <button
      className={'opt-toggle' + (on ? ' on' : '')}
      onClick={() => { sfx.select(); onChange(!on); }}
      onMouseEnter={() => sfx.hover()}
      role="switch"
      aria-checked={on ? 'true' : 'false'}
    >
      <span className="opt-toggle-track"><span className="opt-toggle-knob" /></span>
      <span className="opt-toggle-text">{on ? onLabel : offLabel}</span>
    </button>
  );
}

function OptSteps({ value, options, onChange, sfx, render }) {
  const i = Math.max(0, options.findIndex((o) => String(o) === String(value)));
  const step = (dir) => { sfx.move(); onChange(options[(i + dir + options.length) % options.length]); };
  return (
    <div className="opt-steps">
      <button className="opt-arrow" onClick={() => step(-1)} onMouseEnter={() => sfx.hover()} aria-label="Previous">◄</button>
      <span className="opt-value">{render ? render(options[i]) : options[i]}</span>
      <button className="opt-arrow" onClick={() => step(1)} onMouseEnter={() => sfx.hover()} aria-label="Next">►</button>
    </div>
  );
}

function OptBars({ value, min, max, step, onChange, sfx, segments = 8, format }) {
  const pct = (value - min) / (max - min);
  const filled = Math.round(pct * segments);
  const set = (n) => {
    const v = min + (n / segments) * (max - min);
    const snapped = Math.round(v / step) * step;
    sfx.move();
    onChange(Math.max(min, Math.min(max, parseFloat(snapped.toFixed(3)))));
  };
  return (
    <div className="opt-bars">
      <div className="opt-segs">
        {Array.from({ length: segments }, (_, n) => (
          <button
            key={n}
            className={'opt-seg' + (n < filled ? ' on' : '')}
            onClick={() => set(n + 1)}
            onMouseEnter={() => sfx.hover()}
            aria-label={'Set level ' + (n + 1)}
          />
        ))}
      </div>
      <span className="opt-value num">{format ? format(value) : value}</span>
    </div>
  );
}

function OptionsScreen({ sfx, t, setTweak, cam, setCam, earned, xp, level, plays, onReset }) {
  const [confirmReset, setConfirmReset] = useStateO(false);
  const keys = Object.keys(ACHIEVEMENTS);
  const got = keys.filter((k) => earned.has(k)).length;

  return (
    <div>
      <ScreenHead level="06" title="OPTIONS" />

      <div className="opt-grid">
        <div className="panel glow opt-panel">
          <div className="panel-title">DISPLAY</div>

          <OptRow label="ACCENT" hint="Screen colour">
            <OptSteps
              sfx={sfx}
              value={t.accent}
              options={OPT_ACCENTS.map((a) => a.v)}
              onChange={(v) => setTweak('accent', v)}
              render={(v) => {
                const found = OPT_ACCENTS.find((a) => a.v === v);
                return (
                  <span className="opt-swatch-wrap">
                    <span className="opt-swatch" style={{ background: v }} />
                    {found ? found.label : v}
                  </span>
                );
              }}
            />
          </OptRow>

          <OptRow label="SCANLINES" hint="CRT intensity">
            <OptBars
              sfx={sfx} value={t.scanlines} min={0} max={0.45} step={0.01} segments={8}
              onChange={(v) => setTweak('scanlines', v)}
              format={(v) => Math.round((v / 0.45) * 100) + '%'}
            />
          </OptRow>

          <OptRow label="TYPEFACE" hint="Pixel font">
            <OptSteps sfx={sfx} value={t.pixelFont} options={OPT_FONTS}
              onChange={(v) => setTweak('pixelFont', v)} />
          </OptRow>

          <OptRow label="PARALLAX" hint="Cabinet tilt">
            <OptToggle sfx={sfx} on={t.parallax !== false} onChange={(v) => setTweak('parallax', v)} />
          </OptRow>
        </div>

        <div className="panel opt-panel">
          <div className="panel-title">AUDIO &amp; MOTION</div>

          <OptRow label="SOUND FX" hint="Blips and beeps">
            <OptToggle sfx={sfx} on={!!t.sound} onChange={(v) => setTweak('sound', v)} />
          </OptRow>

          <OptRow label="MUSIC" hint="Chiptune loop">
            <OptToggle
              sfx={sfx}
              on={!!t.music}
              onChange={(v) => { setTweak('music', v); if (v && t.sound) sfx.startMusic(); else sfx.stopMusic(); }}
            />
          </OptRow>

          <OptRow label="ANIM SPEED" hint="Lower is faster">
            <OptBars
              sfx={sfx} value={t.animSpeed} min={0.4} max={2} step={0.1} segments={8}
              onChange={(v) => setTweak('animSpeed', v)}
              format={(v) => Number(v).toFixed(1) + 'x'}
            />
          </OptRow>

          <OptRow label="GESTURE CAM" hint="Point and pinch to select">
            <OptToggle sfx={sfx} on={cam} onChange={(v) => setCam(v)} onLabel="LIVE" offLabel="OFF" />
          </OptRow>
        </div>
      </div>

      <div className="panel opt-panel opt-save">
        <div className="panel-title">SAVE DATA · {got}/{keys.length} ACHIEVEMENTS</div>

        <div className="opt-stats">
          <span className="kv">LEVEL · <b>{level}</b></span>
          <span className="kv">XP · <b>{xp}</b></span>
          <span className="kv">PLAYS · <b>{String(plays).padStart(4, '0')}</b></span>
        </div>

        <div className="achv-grid">
          {keys.map((k) => {
            const a = ACHIEVEMENTS[k];
            const has = earned.has(k);
            return (
              <div className={'achv' + (has ? ' got' : '')} key={k}>
                <span className="achv-ico">{has ? a.icon : '?'}</span>
                <span className="achv-text">
                  <span className="achv-name">{has ? a.title : 'LOCKED'}</span>
                  {/* locked entries show a nudge instead of the answer, where one exists */}
                  <span className="achv-desc">{has ? a.desc : (a.hint || a.desc)}</span>
                </span>
              </div>
            );
          })}
        </div>

        <div className="opt-reset">
          {confirmReset ? (
            <>
              <span className="opt-warn">ERASE ALL PROGRESS?</span>
              <button className="btn accent" onClick={() => { sfx.back(); onReset(); setConfirmReset(false); }}>YES, ERASE</button>
              <button className="btn ghost" onClick={() => { sfx.hover(); setConfirmReset(false); }}>CANCEL</button>
            </>
          ) : (
            <button className="btn ghost" onClick={() => { sfx.hover(); setConfirmReset(true); }}>↺ RESET SAVE DATA</button>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { OptionsScreen });
