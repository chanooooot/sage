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
      const indexTip = lm[8];
      const palm = lm[0];

      ctx.fillStyle = '#0ff';
      ctx.beginPath();
      ctx.arc(indexTip.x * canvas.width, indexTip.y * canvas.height, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f0f';
      ctx.beginPath();
      ctx.arc(palm.x * canvas.width, palm.y * canvas.height, 16, 0, Math.PI * 2);
      ctx.fill();
    }

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
