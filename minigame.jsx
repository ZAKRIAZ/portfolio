/* minigame.jsx — "PACKET CATCH": move the collector, catch good data packets,
   avoid the corrupted ones. Hidden behind the DEV MODE panel. */
const { useRef: useRefMG, useEffect: useEffectMG, useState: useStateMG } = React;

function mgCssVar(name, fb) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fb;
}

function PacketCatch({ onClose, sfx, onScore }) {
  const canvasRef = useRefMG(null);
  const [phase, setPhase] = useStateMG('intro'); // intro | play | over
  const [score, setScore] = useStateMG(0);
  const [best, setBest] = useStateMG(() => parseInt(localStorage.getItem('zb_pc_best') || '0', 10) || 0);
  const [timeLeft, setTimeLeft] = useStateMG(30);
  const stateRef = useRefMG({ phase: 'intro' });
  stateRef.current.phase = phase;

  // game loop
  useEffectMG(() => {
    if (phase !== 'play') return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf = 0, w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let player = { x: 0.5, w: 78, h: 14 };
    let drops = [];
    let spawnT = 0, frame = 0, localScore = 0, running = true;
    const keys = { left: false, right: false };
    let pointerX = null;

    function size() {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function rgb(varName, fb) {
      const v = mgCssVar(varName, fb); return v;
    }
    function spawn() {
      const bad = Math.random() < 0.22;
      drops.push({
        x: 0.06 + Math.random() * 0.88,
        y: -0.04,
        v: 0.0045 + Math.random() * 0.006 + frame * 0.0000008,
        bad,
        glyph: bad ? '✕' : (Math.random() < 0.3 ? '$' : '◈'),
      });
    }

    function step() {
      if (!running) return;
      frame++;
      // move player
      const speed = 0.018;
      if (pointerX != null) {
        player.x += (pointerX - player.x) * 0.35;
      } else {
        if (keys.left) player.x -= speed;
        if (keys.right) player.x += speed;
      }
      const half = (player.w / 2) / w;
      player.x = Math.max(half, Math.min(1 - half, player.x));

      spawnT--;
      if (spawnT <= 0) { spawn(); spawnT = Math.max(16, 42 - frame * 0.02); }

      // draw
      ctx.clearRect(0, 0, w, h);
      // floor line
      const accent = rgb('--accent', '#46a6ff');
      const good = rgb('--good', '#5ce08a');
      const bad = rgb('--bad', '#ff5d6c');
      const warn = rgb('--warn', '#ffce4d');
      const py = h - 26;

      ctx.strokeStyle = accent; ctx.globalAlpha = 0.25; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, py + 10); ctx.lineTo(w, py + 10); ctx.stroke();
      ctx.globalAlpha = 1;

      // drops
      drops.forEach((d) => {
        d.y += d.v;
        const dx = d.x * w, dy = d.y * h;
        ctx.fillStyle = d.bad ? bad : (d.glyph === '$' ? warn : good);
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
        ctx.fillRect(dx - 7, dy - 7, 14, 14);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#06101e';
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(d.glyph, dx, dy + 1);
      });

      // player paddle
      const px = player.x * w;
      ctx.fillStyle = accent; ctx.shadowColor = accent; ctx.shadowBlur = 10;
      ctx.fillRect(px - player.w / 2, py, player.w, player.h);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#06101e';
      ctx.fillRect(px - player.w / 2 + 4, py + 4, player.w - 8, 3);

      // collisions
      drops = drops.filter((d) => {
        const dx = d.x * w, dy = d.y * h;
        const caught = dy > py - 6 && dy < py + player.h + 6 && Math.abs(dx - px) < player.w / 2 + 8;
        if (caught) {
          if (d.bad) { localScore = Math.max(0, localScore - 3); sfx && sfx.back(); }
          else { localScore += (d.glyph === '$' ? 3 : 1); sfx && sfx.coin(); }
          setScore(localScore);
          return false;
        }
        if (dy > h + 20) return false;
        return true;
      });

      raf = requestAnimationFrame(step);
    }

    size();
    const onResize = () => size();
    window.addEventListener('resize', onResize);

    const kd = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') { keys.left = true; pointerX = null; }
      if (e.key === 'ArrowRight' || e.key === 'd') { keys.right = true; pointerX = null; }
    };
    const ku = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    };
    const pm = (e) => {
      const r = canvas.getBoundingClientRect();
      pointerX = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    canvas.addEventListener('pointermove', pm);

    raf = requestAnimationFrame(step);

    // countdown
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          running = false;
          cancelAnimationFrame(raf);
          const finalScore = localScore;
          setScore(finalScore);
          setBest((b) => {
            const nb = Math.max(b, finalScore);
            try { localStorage.setItem('zb_pc_best', String(nb)); } catch (err) {}
            return nb;
          });
          onScore && onScore(finalScore);
          sfx && sfx.select();
          setPhase('over');
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      clearInterval(timer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      canvas.removeEventListener('pointermove', pm);
    };
  }, [phase]);

  // esc to close
  useEffectMG(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const startPlay = () => { sfx && sfx.warm(); sfx && sfx.select(); setScore(0); setTimeLeft(30); setPhase('play'); };

  return (
    <div className="mg" onClick={(e) => { if (e.target.classList.contains('mg')) onClose(); }}>
      <div className="mg-card">
        <div className="mg-hud">
          <span className="mg-kicker">PACKET CATCH</span>
          <div className="mg-stats">
            <span>SCORE <b>{String(score).padStart(3, '0')}</b></span>
            <span>BEST <b>{String(best).padStart(3, '0')}</b></span>
            <span className={timeLeft <= 5 ? 'mg-time low' : 'mg-time'}>TIME <b>{String(timeLeft).padStart(2, '0')}</b></span>
          </div>
          <button className="mg-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="mg-stage">
          <canvas ref={canvasRef} className="mg-canvas" />

          {phase === 'intro' && (
            <div className="mg-overlay">
              <div className="mg-title">PACKET CATCH</div>
              <p className="mg-rules">
                Catch the good data — <b className="g">◈</b> sync &nbsp; <b className="y">$</b> orders.<br />
                Dodge the corrupted <b className="r">✕</b> packets.<br /><br />
                ◄ ► or A / D · or move your mouse · 30 seconds
              </p>
              <button className="btn accent" onClick={startPlay}>► START</button>
            </div>
          )}

          {phase === 'over' && (
            <div className="mg-overlay">
              <div className="mg-title">TIME UP</div>
              <p className="mg-rules">
                FINAL SCORE <b className="g">{String(score).padStart(3, '0')}</b><br />
                {score >= best && score > 0 ? <span className="y">★ NEW HIGH SCORE ★</span> : <>BEST {String(best).padStart(3, '0')}</>}
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

Object.assign(window, { PacketCatch });
