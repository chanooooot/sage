// --- app icon (drawn on canvas, no image asset needed) ---
(function setupAppIcon() {
  const size = 192;
  const ic = document.createElement('canvas');
  ic.width = size; ic.height = size;
  const ictx = ic.getContext('2d');

  const grad = ictx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#F97316');
  grad.addColorStop(1, '#7C3AED');
  const r = 40;
  ictx.fillStyle = grad;
  ictx.beginPath();
  ictx.moveTo(r, 0);
  ictx.arcTo(size, 0, size, size, r);
  ictx.arcTo(size, size, 0, size, r);
  ictx.arcTo(0, size, 0, 0, r);
  ictx.arcTo(0, 0, size, 0, r);
  ictx.closePath();
  ictx.fill();

  // simple doodle face: two eyes + smile, matches the in-app creature look
  ictx.fillStyle = '#fff';
  ictx.beginPath(); ictx.arc(66, 76, 16, 0, Math.PI * 2); ictx.fill();
  ictx.beginPath(); ictx.arc(126, 76, 16, 0, Math.PI * 2); ictx.fill();
  ictx.fillStyle = '#1F2937';
  ictx.beginPath(); ictx.arc(70, 76, 7, 0, Math.PI * 2); ictx.fill();
  ictx.beginPath(); ictx.arc(122, 76, 7, 0, Math.PI * 2); ictx.fill();
  ictx.strokeStyle = '#fff';
  ictx.lineWidth = 8;
  ictx.lineCap = 'round';
  ictx.beginPath();
  ictx.moveTo(66, 104);
  ictx.quadraticCurveTo(96, 122, 126, 104);
  ictx.stroke();

  const dataUrl = ic.toDataURL('image/png');
  document.getElementById('favicon').href = dataUrl;
  document.getElementById('appleIcon').href = dataUrl;

  const manifest = {
    name: 'AirDoodle',
    short_name: 'AirDoodle',
    start_url: '.',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#7C3AED',
    icons: [{ src: dataUrl, sizes: '192x192', type: 'image/png' }]
  };
  const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
  document.getElementById('manifestLink').href = URL.createObjectURL(manifestBlob);
})();

const video = document.getElementById('cam');
const retry = document.getElementById('retry');
const firstRun = document.getElementById('firstRun');
const idleHintEl = document.getElementById('idleHint');
const bottomBar = document.getElementById('bottomBar');
const camBtn = document.getElementById('camBtn');
const flipBtn = document.getElementById('flipBtn');
let cameraStartTime = null;

// first-run/retry are modal dialogs: block the background controls while shown
function updateBackgroundInert() {
  const blocked = firstRun.style.display !== 'none' || retry.style.display === 'flex';
  camBtn.inert = blocked;
  flipBtn.inert = blocked;
  bottomBar.inert = blocked;
}

function dismissFirstRun() {
  firstRun.style.display = 'none';
  updateBackgroundInert();
}
document.getElementById('startCameraBtn').addEventListener('click', () => {
  dismissFirstRun();
  if (!trackingStarted) startCamera();
});
updateBackgroundInert();
document.getElementById('startCameraBtn').focus();

const CAM_ICON = '<svg width="20" height="20" viewBox="0 0 20 20" fill="#1F2937"><rect x="1" y="5" width="14" height="11" rx="3"/><path d="M15 8 L19 5.5 V13.5 L15 11 Z"/><circle cx="8" cy="10.5" r="3" fill="#fff"/></svg>';
const PLAY_ICON = '<svg width="18" height="18" viewBox="0 0 20 20" fill="#fff"><path d="M5 3 L17 10 L5 17 Z"/></svg>';

let cameraOn = true;
camBtn.addEventListener('click', () => {
  if (cameraOn) {
    if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
    video.srcObject = null;
    cameraOn = false;
    camBtn.innerHTML = PLAY_ICON;
    camBtn.classList.add('off');
    camBtn.setAttribute('aria-pressed', 'false');
    flipBtn.disabled = true;
  } else {
    cameraOn = true;
    camBtn.innerHTML = CAM_ICON;
    camBtn.classList.remove('off');
    camBtn.setAttribute('aria-pressed', 'true');
    flipBtn.disabled = false;
    startCamera();
  }
});
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const fpsEl = document.getElementById('fps');
const debug = new URLSearchParams(location.search).has('debug');
fpsEl.style.display = debug ? 'block' : 'none';

function resizeCanvas() {
  const w = video.videoWidth || window.innerWidth;
  const h = video.videoHeight || window.innerHeight;
  if (canvas.width === w && canvas.height === h) return;
  canvas.width = w;
  canvas.height = h;
  setupWalls();
}

let lastResults = null;

function onResults(results) {
  lastResults = results;
}

// --- Drawing state (P2) ---
const strokes = [];       // completed strokes: [{color, points:[{x,y}]}]
let currentStroke = null;
let currentColor = null;
const COLORS = ['#ff5252', '#ffca28', '#4caf50', '#29b6f6', '#ab47bc', '#ff7043'];

let pinchVotes = [];       // last 3 raw pinch booleans (3-frame vote)
let pinching = false;      // debounced/hysteresis state
const PINCH_ON = 0.3;      // normalized dist below this = pinch closing
const PINCH_OFF = 0.45;    // normalized dist above this = pinch open

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

let lastNorm = 0;

function updatePinch(lm) {
  const pinchDist = dist(lm[4], lm[8]);
  const handScale = dist(lm[0], lm[5]) || 1;
  const norm = pinchDist / handScale;
  lastNorm = norm;
  const rawPinch = pinching ? norm < PINCH_OFF : norm < PINCH_ON;

  pinchVotes.push(rawPinch);
  if (pinchVotes.length > 3) pinchVotes.shift();
  const votedPinch = pinchVotes.filter(Boolean).length >= 2;

  if (votedPinch && !pinching) {
    pinching = true;
    idleHintEl.classList.remove('show');
    if (!currentColor) currentColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    currentStroke = { color: currentColor, points: [] };
    strokes.push(currentStroke);
  } else if (!votedPinch && pinching) {
    pinching = false;
    currentStroke = null;
  }
}

const MAX_STROKE_POINTS = 2000;

function addPoint(lm) {
  if (!pinching || !currentStroke) return;
  const raw = { x: lm[8].x * canvas.width, y: lm[8].y * canvas.height };
  const pts = currentStroke.points;
  const last = pts[pts.length - 1];
  const smoothed = last ? { x: last.x * 0.5 + raw.x * 0.5, y: last.y * 0.5 + raw.y * 0.5 } : raw;
  pts.push(smoothed);

  let total = strokes.reduce((sum, s) => sum + s.points.length, 0);
  while (total > MAX_STROKE_POINTS && strokes.length) {
    const oldest = strokes[0];
    oldest.points.shift();
    total--;
    if (!oldest.points.length && oldest !== currentStroke) strokes.shift();
  }
}

function drawStrokes() {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 10;
  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;
    ctx.strokeStyle = stroke.color;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (const p of stroke.points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
}

document.getElementById('undoBtn').addEventListener('click', () => {
  const removed = strokes.pop();
  if (removed === currentStroke) currentStroke = null;
  if (!strokes.length) currentColor = null;
});

document.getElementById('clearBtn').addEventListener('click', () => {
  strokes.length = 0;
  currentStroke = null;
  currentColor = null;
  for (const c of creatures) Matter.World.remove(world, c.body);
  creatures.length = 0;
});

// --- P3: alive, physics, procedural life ---
const engine = Matter.Engine.create();
const world = engine.world;
let walls = [];
function setupWalls() {
  Matter.World.remove(world, walls);
  const t = 60;
  walls = [
    Matter.Bodies.rectangle(canvas.width / 2, canvas.height + t / 2, canvas.width * 2, t, { isStatic: true }),
    Matter.Bodies.rectangle(-t / 2, canvas.height / 2, t, canvas.height * 2, { isStatic: true }),
    Matter.Bodies.rectangle(canvas.width + t / 2, canvas.height / 2, t, canvas.height * 2, { isStatic: true })
  ];
  Matter.World.add(world, walls);
}

const fingerBody = Matter.Bodies.circle(0, 0, 26, { isStatic: true, label: 'hand' });
const palmBody = Matter.Bodies.circle(0, 0, 45, { isStatic: true, label: 'hand' });
Matter.World.add(world, [fingerBody, palmBody]);

const PHYSICS_STEP = 1000 / 30;
const MAX_PHYSICS_STEPS = 5; // cap catch-up after a hidden/backgrounded tab
let physicsAccum = 0;
let lastPhysicsTime = performance.now();
function stepPhysics() {
  const now = performance.now();
  physicsAccum = Math.min(physicsAccum + (now - lastPhysicsTime), PHYSICS_STEP * MAX_PHYSICS_STEPS);
  lastPhysicsTime = now;
  while (physicsAccum >= PHYSICS_STEP) {
    Matter.Engine.update(engine, PHYSICS_STEP);
    physicsAccum -= PHYSICS_STEP;
  }
}

const creatures = [];
const MAX_CREATURES = 5;

function bboxOfStrokes() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) for (const p of s.points) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

function bringAlive() {
  if (!strokes.some(s => s.points.length >= 2)) return;
  if (navigator.vibrate) navigator.vibrate(15);
  const pad = 20;
  const { minX, minY, maxX, maxY } = bboxOfStrokes();
  const w = maxX - minX + pad * 2, h = maxY - minY + pad * 2;

  const sprite = document.createElement('canvas');
  sprite.width = w; sprite.height = h;
  const sctx = sprite.getContext('2d');
  sctx.lineCap = 'round'; sctx.lineJoin = 'round'; sctx.lineWidth = 10;
  for (const s of strokes) {
    if (s.points.length < 2) continue;
    sctx.strokeStyle = s.color;
    sctx.beginPath();
    sctx.moveTo(s.points[0].x - minX + pad, s.points[0].y - minY + pad);
    for (const p of s.points.slice(1)) sctx.lineTo(p.x - minX + pad, p.y - minY + pad);
    sctx.stroke();
  }

  const radius = Math.max(w, h) / 2 * 1.1;
  const body = Matter.Bodies.circle((minX + maxX) / 2, (minY + maxY) / 2, radius, {
    restitution: 0.6, friction: 0.05
  });
  Matter.World.add(world, body);

  const spawnColor = strokes[0].color;

  const creature = {
    body, sprite, w, h,
    born: performance.now(),
    nextBlink: performance.now() + 3000 + Math.random() * 3000,
    blinkUntil: 0,
    nextHop: performance.now() + 5000 + Math.random() * 7000,
    wigglePhase: Math.random() * Math.PI * 2,
    startleUntil: 0,
    dying: false, fadeStart: 0, opacity: 1,
    spawnColor
  };
  creatures.push(creature);

  if (creatures.length > MAX_CREATURES) {
    const oldest = creatures.find(c => !c.dying);
    if (oldest) { oldest.dying = true; oldest.fadeStart = performance.now(); }
  }

  strokes.length = 0;
  currentStroke = null;
  currentColor = null;
}

Matter.Events.on(engine, 'collisionStart', (evt) => {
  for (const pair of evt.pairs) {
    const a = pair.bodyA, b = pair.bodyB;
    const hand = a.label === 'hand' ? a : (b.label === 'hand' ? b : null);
    const other = hand === a ? b : a;
    if (!hand) continue;
    const c = creatures.find(c => c.body === other);
    if (c) c.startleUntil = performance.now() + 350;
  }
});

document.getElementById('aliveBtn').addEventListener('click', bringAlive);

// fist-1s detection (alive trigger)
let fistSince = null;
let fistTriggered = false;
function fingerExtended(lm, tipIdx, pipIdx) {
  const wrist = lm[0];
  return dist(wrist, lm[tipIdx]) > dist(wrist, lm[pipIdx]) * 1.15;
}
const FIST_HOLD_MS = 600;

function checkFist(lm) {
  const fist = !fingerExtended(lm, 8, 6) && !fingerExtended(lm, 12, 10) &&
               !fingerExtended(lm, 16, 14) && !fingerExtended(lm, 20, 18);
  const now = performance.now();
  if (fist) {
    if (fistSince === null) fistSince = now;
    const progress = Math.min(1, (now - fistSince) / FIST_HOLD_MS);
    if (progress > 0 && progress < 1) {
      const cx = (lm[0].x + lm[9].x) / 2 * canvas.width;
      const cy = (lm[0].y + lm[9].y) / 2 * canvas.height;
      ctx.save();
      ctx.strokeStyle = '#7C3AED';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, 50, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (!fistTriggered && progress >= 1) {
      fistTriggered = true;
      bringAlive();
    }
  } else {
    fistSince = null;
    fistTriggered = false;
  }
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

function drawCreatures() {
  const now = performance.now();
  for (let i = creatures.length - 1; i >= 0; i--) {
    const c = creatures[i];
    if (c.dying) {
      c.opacity = 1 - (now - c.fadeStart) / 1500;
      if (c.opacity <= 0) { Matter.World.remove(world, c.body); creatures.splice(i, 1); continue; }
    }
    if (now >= c.nextHop && !c.dying) {
      Matter.Body.applyForce(c.body, c.body.position, { x: 0, y: -0.03 * c.body.mass });
      c.nextHop = now + 5000 + Math.random() * 7000;
    }
    if (now >= c.nextBlink && c.blinkUntil < now) {
      c.blinkUntil = now + 150;
      c.nextBlink = now + 3000 + Math.random() * 3000;
    }

    const startled = now < c.startleUntil;
    const breathe = 1.03 + 0.03 * Math.sin(now / 1000 * Math.PI);
    const wiggle = Math.sin(now / 900 + c.wigglePhase) * 3 * Math.PI / 180;
    const scaleY = startled ? 0.85 : breathe;
    const scaleX = startled ? 1.15 : 1;

    const spawnT = Math.min(1, (now - c.born) / 250);
    const pop = spawnT < 1 ? easeOut(spawnT) : 1;

    const burstT = Math.min(1, (now - c.born) / 450);
    if (burstT < 1) {
      ctx.save();
      ctx.globalAlpha = (1 - burstT) * Math.max(0, c.opacity);
      ctx.strokeStyle = c.spawnColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(c.body.position.x, c.body.position.y, c.body.circleRadius * (0.4 + 1.3 * burstT), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const rot = c.body.angle + wiggle;

    ctx.save();
    ctx.globalAlpha = Math.max(0, c.opacity);
    ctx.translate(c.body.position.x, c.body.position.y);
    ctx.rotate(rot);
    ctx.scale(scaleX * pop, scaleY * pop);
    ctx.drawImage(c.sprite, -c.w / 2, -c.h / 2);

    if (spawnT >= 0.3) {
      // eyes: local space (upper third of sprite), so they tumble with the body
      const eyeY = -c.h / 2 + c.h / 6;
      const eyeDX = c.w / 5;
      const blinking = now < c.blinkUntil;
      const eyeR = startled ? 10 : 7;

      // target fingertip, transformed from world space into this creature's local space
      let targetLocalX = null, targetLocalY = null;
      if (lastResults && lastResults.multiHandLandmarks.length) {
        const tip = lastResults.multiHandLandmarks[0][8];
        const tipX = tip.x * canvas.width - c.body.position.x;
        const tipY = tip.y * canvas.height - c.body.position.y;
        targetLocalX = tipX * Math.cos(-rot) - tipY * Math.sin(-rot);
        targetLocalY = tipX * Math.sin(-rot) + tipY * Math.cos(-rot);
      }

      for (const side of [-1, 1]) {
        const ex = side * eyeDX;
        ctx.fillStyle = '#fff';
        if (blinking) {
          ctx.fillRect(ex - eyeR, eyeY - 1, eyeR * 2, 2);
        } else {
          ctx.beginPath();
          ctx.arc(ex, eyeY, eyeR, 0, Math.PI * 2);
          ctx.fill();
          let dx = 0, dy = 0;
          if (targetLocalX !== null) {
            dx = targetLocalX - ex;
            dy = targetLocalY - eyeY;
            const d = Math.hypot(dx, dy) || 1;
            dx = (dx / d) * (eyeR * 0.4);
            dy = (dy / d) * (eyeR * 0.4);
          }
          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.arc(ex + dx, eyeY + dy, startled ? 2 : eyeR * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }
}

let currentFacing = 'user';
let trackingStarted = false;

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacing },
      audio: false
    });
    video.srcObject = stream;
    retry.style.display = 'none';
    updateBackgroundInert();
    video.onloadedmetadata = () => {
      resizeCanvas();
      if (!trackingStarted) {
        trackingStarted = true;
        cameraStartTime = performance.now();
        startHandTracking();
      }
    };
  } catch (err) {
    retry.style.display = 'flex';
    updateBackgroundInert();
    document.getElementById('retryBtn').focus();
  }
}

async function flipCamera() {
  const nextFacing = currentFacing === 'user' ? 'environment' : 'user';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: nextFacing },
      audio: false
    });
    if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
    video.srcObject = stream;
    currentFacing = nextFacing;
    document.body.classList.toggle('mirrored', currentFacing === 'user');
  } catch (err) {
    // no alternate camera (e.g. desktop) — keep current stream running
  }
}
document.getElementById('flipBtn').addEventListener('click', flipCamera);

function startHandTracking() {
  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });
  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 0,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  hands.onResults(onResults);

  let handsBusy = false;
  function sendFrame() {
    if (handsBusy) return;
    handsBusy = true;
    hands.send({ image: video }).finally(() => { handsBusy = false; });
  }

  let frames = 0;
  let lastFpsTime = performance.now();
  const colorSwatch = document.getElementById('colorSwatch');

  function render() {
    resizeCanvas();
    stepPhysics();
    sendFrame();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    colorSwatch.style.background = currentColor || 'transparent';

    if (!strokes.length && !creatures.length && cameraStartTime && performance.now() - cameraStartTime > 4000) {
      idleHintEl.classList.add('show');
    } else {
      idleHintEl.classList.remove('show');
    }

    if (lastResults && lastResults.multiHandLandmarks.length) {
      const lm = lastResults.multiHandLandmarks[0];
      updatePinch(lm);
      addPoint(lm);
      if (pinching) {
        fistSince = null;
        fistTriggered = false;
      } else {
        checkFist(lm);
      }

      const tipX = lm[8].x * canvas.width, tipY = lm[8].y * canvas.height;
      const palmX = (lm[0].x + lm[9].x) / 2 * canvas.width, palmY = (lm[0].y + lm[9].y) / 2 * canvas.height;
      Matter.Body.setPosition(fingerBody, { x: tipX, y: tipY });
      Matter.Body.setPosition(palmBody, { x: palmX, y: palmY });

      if (debug) {
        ctx.fillStyle = pinching ? '#0f0' : '#0ff';
        ctx.beginPath();
        ctx.arc(tipX, tipY, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      pinchVotes = [];
      pinching = false;
      currentStroke = null;
      Matter.Body.setPosition(fingerBody, { x: -1000, y: -1000 });
      Matter.Body.setPosition(palmBody, { x: -1000, y: -1000 });
    }

    drawStrokes();
    drawCreatures();
    if (recording) { compositeFrame(); updateRecTimer(); }

    frames++;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
      if (debug) fpsEl.textContent = `${frames} fps | norm ${lastNorm.toFixed(2)} | pinch ${pinching} | fist ${fistSince ? ((performance.now() - fistSince) / 1000).toFixed(1) : '-'}`;
      frames = 0;
      lastFpsTime = now;
    }

    requestAnimationFrame(render);
  }
  render();
}

// --- P4: record & share ---
const recordBtn = document.getElementById('recordBtn');
let recording = false;
let recCanvas, rctx, mediaRecorder, stopTimer;

const WATERMARK_TEXT = 'Made with AirDoodle · chanooooot.github.io/airdoodle';

function drawWatermark(c, w, h) {
  c.save();
  c.font = "600 14px Fredoka, system-ui, sans-serif";
  c.textBaseline = 'bottom';
  const pad = Math.max(14, Math.round(h * 0.04)); // stay in crop-safe margin
  const tw = c.measureText(WATERMARK_TEXT).width;
  const x = w - tw - pad, y = h - pad;
  c.fillStyle = 'rgba(0,0,0,0.45)';
  c.fillRect(x - 8, y - 16, tw + 16, 22);
  c.fillStyle = '#fff';
  c.fillText(WATERMARK_TEXT, x, y);
  c.restore();
}

function compositeFrame() {
  rctx.save();
  rctx.translate(recCanvas.width, 0);
  rctx.scale(-1, 1);
  rctx.drawImage(video, 0, 0, recCanvas.width, recCanvas.height);
  rctx.drawImage(canvas, 0, 0, recCanvas.width, recCanvas.height);
  rctx.restore();
  drawWatermark(rctx, recCanvas.width, recCanvas.height); // unmirrored, drawn outside the flip
}

const REC_ICON = '<span class="icon"><svg width="16" height="16" viewBox="0 0 20 20" fill="#EF4444"><circle cx="10" cy="10" r="7"/></svg></span>Record';
const STOP_ICON = '<span class="icon"><svg width="16" height="16" viewBox="0 0 20 20" fill="#fff"><rect x="6" y="6" width="8" height="8" rx="2"/></svg></span>Stop';

function flashRecordBtn(text) {
  const prevHTML = recordBtn.innerHTML;
  recordBtn.textContent = text;
  setTimeout(() => { recordBtn.innerHTML = prevHTML; }, 2000);
}

const recTimerEl = document.getElementById('recTimer');
const recTimerTextEl = document.getElementById('recTimerText');
let recordStartTime = 0;

function updateRecTimer() {
  const s = Math.floor((performance.now() - recordStartTime) / 1000);
  recTimerTextEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const SHARE_TEXT = 'I drew this in the air and brought it to life ✨ Make yours:';
const SHARE_URL = 'https://chanooooot.github.io/airdoodle/';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function shareOrDownload(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  const fullShare = { files: [file], title: 'AirDoodle', text: SHARE_TEXT, url: SHARE_URL };
  // some browsers accept files alone but reject the files+text+url combo — fall back to file-only share
  const canShareFull = navigator.canShare && navigator.canShare(fullShare);
  const canShareFileOnly = !canShareFull && navigator.canShare && navigator.canShare({ files: [file] });
  if (canShareFull || canShareFileOnly) {
    try {
      await navigator.share(canShareFull ? fullShare : { files: [file] });
      flashRecordBtn('✅ Saved!');
    } catch (e) {
      // user backing out of the share sheet is not a failure — stay quiet.
      // any other error: surface the real name instead of guessing at "not supported"
      if (e.name !== 'AbortError') flashRecordBtn(`⚠ ${e.name || 'error'}`);
    }
    return;
  }
  downloadBlob(blob, filename);
  flashRecordBtn('✅ Saved!');
}

// iOS suspends the camera <video> feed while the native share sheet is open
// and doesn't resume it on its own — restart playback when the app comes back.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && video.srcObject) video.play().catch(() => {});
});

function startRecording() {
  if (!window.MediaRecorder) {
    // iOS/unsupported fallback: single screenshot, camera + drawing composited (not the transparent overlay alone)
    const shot = document.createElement('canvas');
    shot.width = canvas.width; shot.height = canvas.height;
    const sctx = shot.getContext('2d');
    sctx.save();
    sctx.translate(shot.width, 0);
    sctx.scale(-1, 1);
    sctx.drawImage(video, 0, 0, shot.width, shot.height);
    sctx.drawImage(canvas, 0, 0, shot.width, shot.height);
    sctx.restore();
    shot.toBlob((blob) => shareOrDownload(blob, 'airdoodle.png'), 'image/png');
    return;
  }
  recCanvas = document.createElement('canvas');
  recCanvas.width = canvas.width; recCanvas.height = canvas.height;
  rctx = recCanvas.getContext('2d');

  // iOS Photos only saves H.264 .mp4 — prefer an explicit codec so the file is decodable
  const mimeType = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp8', 'video/webm']
    .find((t) => MediaRecorder.isTypeSupported(t)) || '';
  const stream = recCanvas.captureStream(30);
  mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  mediaRecorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  mediaRecorder.onstop = () => {
    recording = false;
    recordBtn.innerHTML = REC_ICON;
    recordBtn.classList.remove('recording');
    recTimerEl.classList.remove('show');
    // strip codec params (e.g. ";codecs=avc1.42E01E") — iOS Photos' Save Video
    // import matches on a clean MIME type, not a parameterized one
    const outType = (mediaRecorder.mimeType || mimeType || 'video/mp4').split(';')[0];
    const blob = new Blob(chunks, { type: outType });
    shareOrDownload(blob, outType.includes('mp4') ? 'airdoodle.mp4' : 'airdoodle.webm');
  };
  mediaRecorder.start();
  recording = true;
  recordStartTime = performance.now();
  recordBtn.innerHTML = STOP_ICON;
  recordBtn.classList.add('recording');
  recTimerEl.classList.add('show');
  updateRecTimer();
  stopTimer = setTimeout(() => stopRecording(), 15000);
}

function stopRecording() {
  clearTimeout(stopTimer);
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
}

recordBtn.addEventListener('click', () => {
  if (navigator.vibrate) navigator.vibrate(10);
  if (recording) stopRecording(); else startRecording();
});

document.getElementById('retryBtn').addEventListener('click', startCamera);
