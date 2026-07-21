const video = document.getElementById('cam');
const retry = document.getElementById('retry');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const fpsEl = document.getElementById('fps');
const debug = new URLSearchParams(location.search).has('debug');
fpsEl.style.display = debug ? 'block' : 'none';

function resizeCanvas() {
  canvas.width = video.videoWidth || window.innerWidth;
  canvas.height = video.videoHeight || window.innerHeight;
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
    if (!currentColor) currentColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    currentStroke = { color: currentColor, points: [] };
    strokes.push(currentStroke);
  } else if (!votedPinch && pinching) {
    pinching = false;
    currentStroke = null;
  }
}

function addPoint(lm) {
  if (!pinching || !currentStroke) return;
  const raw = { x: lm[8].x * canvas.width, y: lm[8].y * canvas.height };
  const pts = currentStroke.points;
  const last = pts[pts.length - 1];
  const smoothed = last ? { x: last.x * 0.5 + raw.x * 0.5, y: last.y * 0.5 + raw.y * 0.5 } : raw;
  pts.push(smoothed);
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

const fingerBody = Matter.Bodies.circle(0, 0, 14, { isStatic: true, label: 'hand' });
const palmBody = Matter.Bodies.circle(0, 0, 30, { isStatic: true, label: 'hand' });
Matter.World.add(world, [fingerBody, palmBody]);

setInterval(() => Matter.Engine.update(engine, 1000 / 30), 1000 / 30);

const creatures = [];
const MAX_CREATURES = 3;

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

  const creature = {
    body, sprite, w, h,
    born: performance.now(),
    nextBlink: performance.now() + 3000 + Math.random() * 3000,
    blinkUntil: 0,
    nextHop: performance.now() + 5000 + Math.random() * 7000,
    wigglePhase: Math.random() * Math.PI * 2,
    startleUntil: 0,
    dying: false, fadeStart: 0, opacity: 1
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
let palmOpenSince = null;
let palmTriggered = false;
function fingerExtended(lm, tipIdx, pipIdx) {
  const wrist = lm[0];
  return dist(wrist, lm[tipIdx]) > dist(wrist, lm[pipIdx]) * 1.15;
}
function checkOpenPalm(lm) {
  const fist = !fingerExtended(lm, 8, 6) && !fingerExtended(lm, 12, 10) &&
               !fingerExtended(lm, 16, 14) && !fingerExtended(lm, 20, 18);
  const now = performance.now();
  if (fist) {
    if (palmOpenSince === null) palmOpenSince = now;
    if (!palmTriggered && now - palmOpenSince >= 1000) {
      palmTriggered = true;
      bringAlive();
    }
  } else {
    palmOpenSince = null;
    palmTriggered = false;
  }
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

    ctx.save();
    ctx.globalAlpha = Math.max(0, c.opacity);
    ctx.translate(c.body.position.x, c.body.position.y);
    ctx.rotate(c.body.angle + wiggle);
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(c.sprite, -c.w / 2, -c.h / 2);
    ctx.restore();

    // eyes: upper third of sprite bounds, in world space
    const eyeY = c.body.position.y - c.h / 2 + c.h / 6;
    const eyeDX = c.w / 5;
    const blinking = now < c.blinkUntil;
    const eyeR = startled ? 10 : 7;
    for (const side of [-1, 1]) {
      const ex = c.body.position.x + side * eyeDX;
      ctx.fillStyle = '#fff';
      if (blinking) {
        ctx.fillRect(ex - eyeR, eyeY - 1, eyeR * 2, 2);
      } else {
        ctx.beginPath();
        ctx.arc(ex, eyeY, eyeR, 0, Math.PI * 2);
        ctx.fill();
        // pupil looks toward last tracked fingertip
        let dx = 0, dy = 0;
        if (lastResults && lastResults.multiHandLandmarks.length) {
          const tip = lastResults.multiHandLandmarks[0][8];
          dx = tip.x * canvas.width - ex;
          dy = tip.y * canvas.height - eyeY;
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
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false
    });
    video.srcObject = stream;
    retry.style.display = 'none';
    video.onloadedmetadata = () => {
      resizeCanvas();
      setupWalls();
      startHandTracking();
    };
  } catch (err) {
    retry.style.display = 'flex';
  }
}

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

  const camera = new Camera(video, {
    onFrame: async () => { await hands.send({ image: video }); },
    width: 640,
    height: 480
  });
  camera.start();

  let frames = 0;
  let lastFpsTime = performance.now();

  function render() {
    resizeCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (lastResults && lastResults.multiHandLandmarks.length) {
      const lm = lastResults.multiHandLandmarks[0];
      updatePinch(lm);
      addPoint(lm);
      if (pinching) {
        palmOpenSince = null;
        palmTriggered = false;
      } else {
        checkOpenPalm(lm);
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
    if (recording) compositeFrame();

    frames++;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
      if (debug) fpsEl.textContent = `${frames} fps | norm ${lastNorm.toFixed(2)} | pinch ${pinching} | palm ${palmOpenSince ? ((performance.now() - palmOpenSince) / 1000).toFixed(1) : '-'}`;
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

function compositeFrame() {
  rctx.save();
  rctx.translate(recCanvas.width, 0);
  rctx.scale(-1, 1);
  rctx.drawImage(video, 0, 0, recCanvas.width, recCanvas.height);
  rctx.drawImage(canvas, 0, 0, recCanvas.width, recCanvas.height);
  rctx.restore();
}

async function shareOrDownload(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'AirToon' }); return; } catch (e) {}
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function startRecording() {
  if (!window.MediaRecorder) {
    // iOS/unsupported fallback: single screenshot
    canvas.toBlob((blob) => shareOrDownload(blob, 'airtoon.png'), 'image/png');
    return;
  }
  recCanvas = document.createElement('canvas');
  recCanvas.width = canvas.width; recCanvas.height = canvas.height;
  rctx = recCanvas.getContext('2d');

  const mimeType = MediaRecorder.isTypeSupported('video/mp4')
    ? 'video/mp4' : 'video/webm';
  const stream = recCanvas.captureStream(30);
  mediaRecorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];
  mediaRecorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  mediaRecorder.onstop = () => {
    recording = false;
    recordBtn.textContent = '⏺ Record';
    recordBtn.classList.remove('recording');
    const blob = new Blob(chunks, { type: mimeType });
    shareOrDownload(blob, mimeType === 'video/mp4' ? 'airtoon.mp4' : 'airtoon.webm');
  };
  mediaRecorder.start();
  recording = true;
  recordBtn.textContent = '⏹ Stop';
  recordBtn.classList.add('recording');
  stopTimer = setTimeout(() => stopRecording(), 15000);
}

function stopRecording() {
  clearTimeout(stopTimer);
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
}

recordBtn.addEventListener('click', () => {
  if (recording) stopRecording(); else startRecording();
});

document.getElementById('retryBtn').addEventListener('click', startCamera);
startCamera();
