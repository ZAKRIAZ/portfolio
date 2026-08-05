/* gestures.jsx — webcam hand-gesture control: point to aim, pinch to select.
   Uses MediaPipe Tasks Vision (hand landmarker) loaded on demand. Opt-in via HUD. */
const { useState: useStateG, useEffect: useEffectG, useRef: useRefG } = React;

/* load the MediaPipe vision ESM bundle once, on demand */
function loadVision() {
  if (window.__mpVisionPromise) return window.__mpVisionPromise;
  window.__mpVisionPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('vision load timeout')), 25000);
    const onReady = () => { clearTimeout(timeout); resolve(window.__mpVision); };
    window.addEventListener('mp-vision-ready', onReady, { once: true });
    const s = document.createElement('script');
    s.type = 'module';
    s.textContent = `
      import { FilesetResolver, HandLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
      window.__mpVision = { FilesetResolver, HandLandmarker };
      window.dispatchEvent(new Event('mp-vision-ready'));
    `;
    s.onerror = () => { clearTimeout(timeout); reject(new Error('vision script error')); };
    document.head.appendChild(s);
  });
  return window.__mpVisionPromise;
}

async function getLandmarker() {
  if (window.__handLandmarker) return window.__handLandmarker;
  const { FilesetResolver, HandLandmarker } = await loadVision();
  const fileset = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
  );
  window.__handLandmarker = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 1,
  });
  return window.__handLandmarker;
}

const GZ_STATUS_LABEL = {
  loading: 'LOADING VISION…',
  camera:  'ALLOW CAMERA ACCESS…',
  denied:  'CAMERA BLOCKED',
  failed:  'TRACKING FAILED',
  nohand:  'SHOW YOUR HAND',
  track:   'TRACKING · PINCH = SELECT',
};

function GestureControl({ enabled, sfx, onDisable, onFirstTrack }) {
  const [status, setStatus] = useStateG('loading');
  const videoRef = useRefG(null);
  const cursorRef = useRefG(null);
  const firstTrackRef = useRefG(false);

  useEffectG(() => {
    if (!enabled) return;
    let cancelled = false;
    let raf = 0, stream = null, landmarker = null;
    let cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    let pinched = false, lastClick = 0, lastSeen = 0;

    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const clamp01 = (v) => Math.max(0, Math.min(1, v));

    async function start() {
      try {
        setStatus('loading');
        landmarker = await getLandmarker();
        if (cancelled) return;
        setStatus('camera');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' }, audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setStatus('nohand');
        loop();
      } catch (err) {
        if (cancelled) return;
        setStatus(err && err.name === 'NotAllowedError' ? 'denied' : 'failed');
        setTimeout(() => { if (!cancelled) onDisable && onDisable(); }, 2600);
      }
    }

    function loop() {
      if (cancelled) return;
      const video = videoRef.current;
      const cursor = cursorRef.current;
      if (video && cursor && video.readyState >= 2) {
        let res = null;
        try { res = landmarker.detectForVideo(video, performance.now()); } catch (e) {}
        const lms = res && res.landmarks && res.landmarks[0];
        const now = performance.now();
        if (lms) {
          lastSeen = now;
          if (!firstTrackRef.current) {
            firstTrackRef.current = true;
            setStatus('track');
            sfx && sfx.powerup();
            onFirstTrack && onFirstTrack();
          } else {
            setStatus('track');
          }
          // index fingertip drives the cursor (mirrored); map inner zone to full screen
          const rawX = 1 - lms[8].x, rawY = lms[8].y;
          const nx = clamp01((rawX - 0.18) / 0.64);
          const ny = clamp01((rawY - 0.18) / 0.64);
          const tx = nx * window.innerWidth;
          const ty = ny * window.innerHeight;
          cx += (tx - cx) * 0.35;
          cy += (ty - cy) * 0.35;
          cursor.style.opacity = '1';
          cursor.style.transform = `translate(${cx - 21}px, ${cy - 21}px)`;

          // pinch detection relative to hand size (robust to distance from camera)
          const handSize = dist(lms[0], lms[9]) || 0.001;
          const ratio = dist(lms[4], lms[8]) / handSize;
          const overEl = document.elementFromPoint(cx, cy);
          const clickable = overEl && overEl.closest('button, a, [role="button"], input, select, label');
          cursor.classList.toggle('over', !!clickable);

          if (!pinched && ratio < 0.35) {
            pinched = true;
            cursor.classList.add('pinch');
            if (now - lastClick > 600) {
              lastClick = now;
              if (clickable) { clickable.click(); }
              else if (overEl) { overEl.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: cx, clientY: cy })); }
            }
          } else if (pinched && ratio > 0.5) {
            pinched = false;
            cursor.classList.remove('pinch');
          }
        } else {
          if (now - lastSeen > 600) {
            cursor.style.opacity = '0';
            if (firstTrackRef.current) setStatus('nohand');
          }
        }
      }
      raf = requestAnimationFrame(loop);
    }

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((tr) => tr.stop());
      const v = videoRef.current; if (v) v.srcObject = null;
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <div className="gz-cam" data-omelette-chrome="">
        <video ref={videoRef} className="gz-video" muted playsInline></video>
        <div className="gz-statusbar">
          <span className={'gz-status' + (status === 'track' ? ' ok' : '')}>{GZ_STATUS_LABEL[status]}</span>
          <button className="gz-x" onClick={() => onDisable && onDisable()} aria-label="Turn camera off">✕</button>
        </div>
      </div>
      <div ref={cursorRef} className="gz-cursor" aria-hidden="true">
        <span className="gz-dot"></span>
      </div>
    </>
  );
}

Object.assign(window, { GestureControl });
