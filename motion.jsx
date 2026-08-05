/* motion.jsx — hacker text-scramble + mouse-parallax tilt */
const { useState: useStateM, useEffect: useEffectM, useRef: useRefM } = React;

const M_REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*<>/\\=+';

/* ---------------------------------------------------------
   Scramble — decodes text in, hacker style. Settles L→R.
   --------------------------------------------------------- */
function Scramble({ text, className, perChar = 2, speed = 26, delay = 0 }) {
  const [out, setOut] = useStateM(M_REDUCED ? text : '');

  useEffectM(() => {
    if (M_REDUCED || document.hidden) { setOut(text); return; }
    let frame = 0, iv = null;
    const total = text.length;
    const reveal = () => {
      iv = setInterval(() => {
        frame++;
        const revealed = Math.floor(frame / perChar);
        let s = '';
        for (let i = 0; i < total; i++) {
          const ch = text[i];
          if (ch === ' ' || ch === '\u00a0') { s += ch; continue; }
          if (i < revealed) s += ch;
          else s += SCRAMBLE_CHARS[(Math.random() * SCRAMBLE_CHARS.length) | 0];
        }
        setOut(s);
        if (revealed >= total) { clearInterval(iv); setOut(text); }
      }, speed);
    };
    const st = setTimeout(reveal, delay);
    const skip = () => { clearTimeout(st); clearInterval(iv); setOut(text); };
    document.addEventListener('zb:skiptype', skip);
    return () => { clearTimeout(st); clearInterval(iv); document.removeEventListener('zb:skiptype', skip); };
  }, [text]);

  return <span className={className}>{out || '\u00a0'}</span>;
}

/* ---------------------------------------------------------
   useParallax — tilt a target element toward the cursor.
   Smoothed with rAF lerp. Disabled on touch / reduced-motion.
   --------------------------------------------------------- */
function useParallax(ref, { enabled = true, max = 5 } = {}) {
  useEffectM(() => {
    const el = ref.current;
    if (!el) return;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (!enabled || M_REDUCED || coarse) {
      el.style.transform = '';
      return;
    }
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, active = false;

    const onMove = (e) => {
      const w = window.innerWidth, h = window.innerHeight;
      tx = ((e.clientX / w) - 0.5) * 2;   // -1..1
      ty = ((e.clientY / h) - 0.5) * 2;
      if (!active) { active = true; loop(); }
    };
    const onLeave = () => { tx = 0; ty = 0; };

    const loop = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      const ry = cx * max;          // rotateY follows horizontal
      const rx = -cy * max;         // rotateX follows vertical
      el.style.transform =
        `perspective(1400px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateZ(0)`;
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001 || Math.abs(tx) > 0.001) {
        raf = requestAnimationFrame(loop);
      } else { active = false; }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerleave', onLeave);
    document.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('mouseleave', onLeave);
      cancelAnimationFrame(raf);
      el.style.transform = '';
    };
  }, [enabled, max]);
}

Object.assign(window, { Scramble, useParallax });
