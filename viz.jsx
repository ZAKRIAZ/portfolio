/* viz.jsx — signature integration-map hero canvas + ambient drifting particles */
const { useRef: useRefV, useEffect: useEffectV } = React;

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
function hexToRgb(hex) {
  let h = (hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h || '46a6ff', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* ---------------------------------------------------------
   IntegrationMap — pixel nodes wired together, data packets
   flowing along the links. Lives behind the menu title.
   --------------------------------------------------------- */
const MAP_NODES = [
  { id: 'NETSUITE', kind: 'erp' },
  { id: 'SHOPIFY', kind: 'app' },
  { id: 'AMAZON', kind: 'app' },
  { id: 'WALMART', kind: 'app' },
  { id: 'SALESFORCE', kind: 'app' },
  { id: 'EDI', kind: 'app' },
];

function IntegrationMap({ paused }) {
  const ref = useRefV(null);

  useEffectV(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf = 0, w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let nodes = [], links = [], packets = [];
    let accent = [70, 166, 255], good = [92, 224, 138], warn = [255, 180, 61];
    let frame = 0;

    function refreshColors() {
      accent = hexToRgb(cssVar('--accent', '#46a6ff'));
      good = hexToRgb(cssVar('--good', '#5ce08a'));
      warn = hexToRgb(cssVar('--warn', '#ffce4d'));
    }

    function layout() {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cx = w / 2, cy = h / 2;
      const rx = Math.min(w * 0.44, 400);
      const ry = Math.min(h * 0.42, 270);
      const off = Math.PI / MAP_NODES.length; // rotate so no node sits dead-center top/bottom
      nodes = MAP_NODES.map((n, i) => {
        const a = (i / MAP_NODES.length) * Math.PI * 2 - Math.PI / 2 + off;
        return { ...n, x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, ph: Math.random() * Math.PI * 2 };
      });
      // hub in the center routes everything (the integration layer)
      const hub = { id: 'HUB', kind: 'hub', x: cx, y: cy, ph: 0 };
      // links: every node to the hub, plus a ring
      links = [];
      nodes.forEach((n, i) => {
        links.push({ a: hub, b: n });
        links.push({ a: n, b: nodes[(i + 1) % nodes.length] });
      });
      nodes.push(hub);
      // seed packets on links
      packets = [];
      for (let i = 0; i < 14; i++) spawnPacket();
    }

    function spawnPacket() {
      const link = links[(Math.random() * links.length) | 0];
      const dir = Math.random() < 0.5;
      packets.push({
        link,
        t: Math.random(),
        spd: 0.0028 + Math.random() * 0.004,
        dir: dir ? 1 : -1,
        col: Math.random() < 0.18 ? warn : (Math.random() < 0.5 ? good : accent),
      });
    }

    function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

    function draw() {
      frame++;
      if (frame % 45 === 0) refreshColors();
      ctx.clearRect(0, 0, w, h);

      // links
      ctx.lineWidth = 1.5;
      links.forEach((l) => {
        ctx.strokeStyle = rgba(accent, 0.16);
        ctx.beginPath();
        ctx.moveTo(l.a.x, l.a.y);
        ctx.lineTo(l.b.x, l.b.y);
        ctx.stroke();
      });

      // packets (little pixel squares riding the links)
      packets.forEach((p, idx) => {
        p.t += p.spd * p.dir;
        if (p.t > 1 || p.t < 0) {
          packets.splice(idx, 1);
          spawnPacket();
          return;
        }
        const x = p.link.a.x + (p.link.b.x - p.link.a.x) * p.t;
        const y = p.link.a.y + (p.link.b.y - p.link.a.y) * p.t;
        ctx.fillStyle = rgba(p.col, 0.9);
        ctx.shadowColor = rgba(p.col, 0.9);
        ctx.shadowBlur = 8;
        ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
        ctx.shadowBlur = 0;
      });

      // nodes
      nodes.forEach((n) => {
        const pulse = 0.5 + 0.5 * Math.sin(frame * 0.04 + n.ph);
        const isHub = n.kind === 'hub';
        const col = isHub ? warn : accent;
        const s = isHub ? 13 : 9;
        // outer glow box
        ctx.fillStyle = rgba(col, 0.10 + pulse * 0.10);
        ctx.fillRect(n.x - s - 3, n.y - s - 3, (s + 3) * 2, (s + 3) * 2);
        // node box
        ctx.fillStyle = '#0a1322';
        ctx.fillRect(n.x - s, n.y - s, s * 2, s * 2);
        ctx.strokeStyle = rgba(col, 0.55 + pulse * 0.4);
        ctx.lineWidth = 2;
        ctx.strokeRect(n.x - s, n.y - s, s * 2, s * 2);
        // inner dot
        ctx.fillStyle = rgba(col, 0.8);
        ctx.fillRect(n.x - 2, n.y - 2, 4, 4);
        // label
        if (!isHub) {
          ctx.fillStyle = rgba(accent, 0.5);
          ctx.font = '8px "Press Start 2P", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(n.id, n.x, n.y + s + 12);
        } else {
          ctx.fillStyle = rgba(warn, 0.85);
          ctx.font = '8px "Press Start 2P", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('ME', n.x, n.y);
        }
      });

      raf = requestAnimationFrame(draw);
    }

    refreshColors();
    layout();
    const ro = new ResizeObserver(() => layout());
    ro.observe(canvas);
    if (!paused && !document.hidden) raf = requestAnimationFrame(draw);

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !paused) raf = requestAnimationFrame(draw);
    };
    document.addEventListener('visibilitychange', onVis);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, [paused]);

  return <canvas ref={ref} className="intmap" aria-hidden="true" />;
}

/* ---------------------------------------------------------
   AmbientParticles — slow drifting pixel bits behind cabinet
   --------------------------------------------------------- */
function AmbientParticles() {
  const ref = useRefV(null);
  useEffectV(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf = 0, w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let bits = [];
    let accent = [70, 166, 255];
    let frame = 0;

    function size() {
      w = window.innerWidth; h = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function seed() {
      const count = Math.min(46, Math.floor((w * h) / 26000));
      bits = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        s: Math.random() < 0.25 ? 3 : 2,
        vy: -(0.08 + Math.random() * 0.22),
        vx: (Math.random() - 0.5) * 0.06,
        tw: Math.random() * Math.PI * 2,
      }));
    }
    function draw() {
      frame++;
      if (frame % 60 === 0) accent = hexToRgb(cssVar('--accent', '#46a6ff'));
      ctx.clearRect(0, 0, w, h);
      bits.forEach((b) => {
        b.y += b.vy; b.x += b.vx; b.tw += 0.03;
        if (b.y < -4) { b.y = h + 4; b.x = Math.random() * w; }
        if (b.x < -4) b.x = w + 4; if (b.x > w + 4) b.x = -4;
        const a = 0.10 + 0.16 * (0.5 + 0.5 * Math.sin(b.tw));
        ctx.fillStyle = `rgba(${accent[0]},${accent[1]},${accent[2]},${a})`;
        ctx.fillRect(b.x, b.y, b.s, b.s);
      });
      raf = requestAnimationFrame(draw);
    }
    size(); seed();
    const onResize = () => { size(); seed(); };
    window.addEventListener('resize', onResize);
    if (!document.hidden) raf = requestAnimationFrame(draw);
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(draw); };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  return <canvas ref={ref} className="ambient" aria-hidden="true" />;
}

Object.assign(window, { IntegrationMap, AmbientParticles });
