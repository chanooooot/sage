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

function updatePinch(lm) {
  const pinchDist = dist(lm[4], lm[8]);
  const handScale = dist(lm[0], lm[5]) || 1;
  const norm = pinchDist / handScale;
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
});

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

      if (debug) {
        ctx.fillStyle = pinching ? '#0f0' : '#0ff';
        ctx.beginPath();
        ctx.arc(lm[8].x * canvas.width, lm[8].y * canvas.height, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      pinchVotes = [];
      pinching = false;
      currentStroke = null;
    }

    drawStrokes();

    frames++;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
      if (debug) fpsEl.textContent = `${frames} fps`;
      frames = 0;
      lastFpsTime = now;
    }

    requestAnimationFrame(render);
  }
  render();
}

document.getElementById('retryBtn').addEventListener('click', startCamera);
startCamera();
