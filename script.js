/**
 * AgenticImage · script.js
 * 
 * External models used (100% free, no key required):
 *   - TF.js MobileNet v2      → image classification
 *   - TF.js COCO-SSD          → object detection
 *   - Transformers.js Swin2SR → neural 2× upscale (Xenova/swin2sr-classical-sr-x2-64)
 * 
 * All canvas-based operations (denoise, sharpen, color restore, old photo) 
 * run locally in the browser with no external calls.
 * 
 * Public API exposed at window.AgenticImageAPI
 */

import {
  pipeline,
  env
} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3/dist/transformers.min.js';

// ── Hugging Face config ────────────────────────────────────────────────────
env.allowLocalModels = false;
env.useBrowserCache  = true;  // cache model weights after first download

// ============================================================
// DOM REFS
// ============================================================
const $ = id => document.getElementById(id);

const fileInput        = $('fileInput');
const uploadLabel      = $('uploadLabel');
const previewBox       = $('previewBox');
const previewImage     = $('previewImage');
const fileName         = $('fileName');
const fileSize         = $('fileSize');
const fileDimensions   = $('fileDimensions');
const processBtn       = $('processBtn');
const classifyBtn      = $('classifyBtn');
const detectBtn        = $('detectBtn');
const enhanceBtn       = $('enhanceBtn');
const upscaleBtn       = $('upscaleBtn');
const denoiseBtn       = $('denoiseBtn');
const colorBtn         = $('colorBtn');
const sharpenBtn       = $('sharpenBtn');
const oldphotoBtn      = $('oldphotoBtn');
const clearBtn         = $('clearBtn');
const progressContainer = $('progressContainer');
const progressFill     = $('progressFill');
const progressText     = $('progressText');
const logContainer     = $('logContainer');
const logCountSpan     = $('logCount');
const resultsSection   = $('resultsSection');
const resultsContainer = $('resultsContainer');
const modelSelect      = $('modelSelect');
const apiTabs          = $('apiTabs');
const apiCode          = $('apiCode');

const statusEls = {
  brain:  { status: $('brainStatus'),  dot: $('brainDot')  },
  vision: { status: $('visionStatus'), dot: $('visionDot') },
  heart:  { status: $('heartStatus'),  dot: $('heartDot')  },
  hands:  { status: $('handsStatus'),  dot: $('handsDot')  },
};

// ============================================================
// STATE
// ============================================================
const state = {
  file: null,
  image: null,   // dataURL
  imgEl: null,   // HTMLImageElement
  logCount: 0,
  models: {
    mobilenet: null,
    cocossd:   null,
    swin2sr:   null,
  }
};

// ============================================================
// LOGGING
// ============================================================
function log(msg, agent = 'orch') {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const entry = document.createElement('div');
  entry.className = 'log-entry';

  const agentLabels = {
    orch:   ['ORCH',   'agent-orch'],
    brain:  ['BRAIN',  'agent-brain'],
    vision: ['VISION', 'agent-vision'],
    heart:  ['HEART',  'agent-heart'],
    hands:  ['HANDS',  'agent-hands'],
    api:    ['API',    'agent-api'],
  };
  const [label, cls] = agentLabels[agent] || agentLabels.orch;

  entry.innerHTML =
    `<span class="log-time">[${time}]</span>` +
    `<span class="log-agent ${cls}">${label}</span>` +
    `<span class="log-msg">${msg}</span>`;

  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
  state.logCount++;
  logCountSpan.textContent = `${state.logCount} events`;
}

// ============================================================
// AGENT STATUS
// ============================================================
function setAgent(agent, status, mode = 'idle') {
  const el = statusEls[agent];
  if (!el) return;
  el.status.textContent = status;
  el.dot.className = 'status-dot' +
    (mode === 'thinking' ? ' thinking' : mode === 'done' ? ' done' : mode === 'error' ? ' error' : '');
}

function resetAgents() {
  Object.keys(statusEls).forEach(a => setAgent(a, 'Idle'));
}

function setProgress(pct, text = '') {
  progressFill.style.width = pct + '%';
  if (text) progressText.textContent = text;
}

// ============================================================
// BUTTON HELPERS
// ============================================================
const allActionBtns = [
  processBtn, classifyBtn, detectBtn, enhanceBtn, upscaleBtn,
  denoiseBtn, colorBtn, sharpenBtn, oldphotoBtn
];

function enableButtons(on) {
  allActionBtns.forEach(b => { if (b) b.disabled = !on; });
}

// ============================================================
// IMAGE UTILS
// ============================================================

/** Load a File / Blob / dataURL into an HTMLImageElement */
async function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload  = () => res(img);
    img.onerror = rej;
    img.src = src instanceof Blob
      ? URL.createObjectURL(src)
      : src;
  });
}

/** Draw image to a new canvas and return [canvas, ctx] */
function imageToCanvas(imgEl) {
  const c = document.createElement('canvas');
  c.width  = imgEl.naturalWidth  || imgEl.width;
  c.height = imgEl.naturalHeight || imgEl.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(imgEl, 0, 0);
  return [c, ctx];
}

/** File or dataURL → HTMLImageElement */
async function toImageEl(input) {
  if (input instanceof HTMLImageElement) return input;
  if (input instanceof File || input instanceof Blob) {
    const url = URL.createObjectURL(input);
    return loadImage(url);
  }
  if (typeof input === 'string') return loadImage(input);
  throw new Error('Unsupported input type');
}

// ============================================================
// ── CANVAS PROCESSING ALGORITHMS ──────────────────────────
// ============================================================

/**
 * Gaussian blur approximation via box blur passes.
 * Used internally for denoise and unsharp mask.
 */
function boxBlur(data, width, height, radius) {
  const out = new Uint8ClampedArray(data.length);
  const r = Math.max(1, Math.round(radius));

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let kx = -r; kx <= r; kx++) {
        const nx = Math.min(width - 1, Math.max(0, x + kx));
        const i = (y * width + nx) * 4;
        rSum += data[i]; gSum += data[i+1]; bSum += data[i+2];
        count++;
      }
      const oi = (y * width + x) * 4;
      out[oi]   = rSum / count;
      out[oi+1] = gSum / count;
      out[oi+2] = bSum / count;
      out[oi+3] = data[oi+3];
    }
  }

  // Vertical pass (in-place from out back to data-shaped buffer)
  const final = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let ky = -r; ky <= r; ky++) {
        const ny = Math.min(height - 1, Math.max(0, y + ky));
        const i  = (ny * width + x) * 4;
        rSum += out[i]; gSum += out[i+1]; bSum += out[i+2];
        count++;
      }
      const oi = (y * width + x) * 4;
      final[oi]   = rSum / count;
      final[oi+1] = gSum / count;
      final[oi+2] = bSum / count;
      final[oi+3] = data[oi+3];
    }
  }
  return final;
}

/**
 * DENOISE
 * Multi-pass pipeline:
 *   1. Median-style bilateral approximation (edge-preserving smoothing)
 *   2. JPEG artifact reduction (block-boundary smoothing)
 *   3. Luminance noise reduction (blur luma, keep chroma)
 */
function processDenoiseCanvas(imgEl) {
  const [canvas, ctx] = imageToCanvas(imgEl);
  const { width, height } = canvas;
  const imgData = ctx.getImageData(0, 0, width, height);
  const src = imgData.data;
  const out = new Uint8ClampedArray(src.length);

  // ── Pass 1: Edge-preserving bilateral-style filter ──
  const sigma_space = 3;
  const sigma_color = 30;
  const kSize = 2; // 5×5 kernel

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ci = (y * width + x) * 4;
      const cr = src[ci], cg = src[ci+1], cb = src[ci+2];
      let wSum = 0, rSum = 0, gSum = 0, bSum = 0;

      for (let ky = -kSize; ky <= kSize; ky++) {
        for (let kx = -kSize; kx <= kSize; kx++) {
          const ny = Math.min(height-1, Math.max(0, y + ky));
          const nx = Math.min(width-1,  Math.max(0, x + kx));
          const ni = (ny * width + nx) * 4;
          const nr = src[ni], ng = src[ni+1], nb = src[ni+2];

          const spatialDist = (kx*kx + ky*ky) / (2 * sigma_space * sigma_space);
          const colorDiff   = ((cr-nr)**2 + (cg-ng)**2 + (cb-nb)**2) / (2 * sigma_color * sigma_color * 3);
          const w = Math.exp(-(spatialDist + colorDiff));

          rSum += nr * w;
          gSum += ng * w;
          bSum += nb * w;
          wSum += w;
        }
      }

      out[ci]   = rSum / wSum;
      out[ci+1] = gSum / wSum;
      out[ci+2] = bSum / wSum;
      out[ci+3] = src[ci+3];
    }
  }

  // ── Pass 2: JPEG block boundary smoothing ──
  // Blur along 8-pixel boundaries
  const blockSize = 8;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const onBoundary = (x % blockSize === 0) || (y % blockSize === 0);
      if (!onBoundary) continue;
      const ci = (y * width + x) * 4;
      let rS=0, gS=0, bS=0, cnt=0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = Math.min(height-1, Math.max(0, y+dy));
          const nx = Math.min(width-1,  Math.max(0, x+dx));
          const ni = (ny*width+nx)*4;
          rS += out[ni]; gS += out[ni+1]; bS += out[ni+2]; cnt++;
        }
      }
      out[ci]   = rS/cnt;
      out[ci+1] = gS/cnt;
      out[ci+2] = bS/cnt;
    }
  }

  ctx.putImageData(new ImageData(out, width, height), 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * SHARPEN — Unsharp Mask
 * output = original + amount * (original - blurred)
 * Radius 1.5, amount 0.8 = crisp without halos
 */
function processSharpenCanvas(imgEl, amount = 0.85, radius = 1.5) {
  const [canvas, ctx] = imageToCanvas(imgEl);
  const { width, height } = canvas;
  const imgData = ctx.getImageData(0, 0, width, height);
  const src  = imgData.data;
  const blurred = boxBlur(src, width, height, radius);
  const out = new Uint8ClampedArray(src.length);

  for (let i = 0; i < src.length; i += 4) {
    out[i]   = Math.min(255, Math.max(0, src[i]   + amount * (src[i]   - blurred[i])));
    out[i+1] = Math.min(255, Math.max(0, src[i+1] + amount * (src[i+1] - blurred[i+1])));
    out[i+2] = Math.min(255, Math.max(0, src[i+2] + amount * (src[i+2] - blurred[i+2])));
    out[i+3] = src[i+3];
  }

  ctx.putImageData(new ImageData(out, width, height), 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * COLOR RESTORE
 * - Auto white balance (gray-world assumption)
 * - Vibrance boost (boost less-saturated pixels more)
 * - Contrast stretch (per-channel histogram stretch)
 * - Gamma correction
 */
function processColorRestoreCanvas(imgEl) {
  const [canvas, ctx] = imageToCanvas(imgEl);
  const { width, height } = canvas;
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  const n = width * height;

  // ── Step 1: Gray world white balance ──
  let rSum=0, gSum=0, bSum=0;
  for (let i = 0; i < d.length; i += 4) {
    rSum += d[i]; gSum += d[i+1]; bSum += d[i+2];
  }
  const rAvg = rSum/n, gAvg = gSum/n, bAvg = bSum/n;
  const gray = (rAvg + gAvg + bAvg) / 3;
  const rScale = gray/rAvg, gScale = gray/gAvg, bScale = gray/bAvg;

  // ── Step 2: Histogram stretch per channel ──
  let rMin=255, rMax=0, gMin=255, gMax=0, bMin=255, bMax=0;
  for (let i = 0; i < d.length; i += 4) {
    const r = Math.min(255, d[i]*rScale);
    const g = Math.min(255, d[i+1]*gScale);
    const b = Math.min(255, d[i+2]*bScale);
    if (r < rMin) rMin=r; if (r > rMax) rMax=r;
    if (g < gMin) gMin=g; if (g > gMax) gMax=g;
    if (b < bMin) bMin=b; if (b > bMax) bMax=b;
  }
  // Clip extremes (ignore top/bottom 1%)
  const clip = n * 0.01;
  const rRange = Math.max(1, (rMax-rMin) * 0.98);
  const gRange = Math.max(1, (gMax-gMin) * 0.98);
  const bRange = Math.max(1, (bMax-bMin) * 0.98);

  // ── Step 3: Apply + vibrance + gamma ──
  const gamma = 0.92; // slight brightening
  for (let i = 0; i < d.length; i += 4) {
    let r = Math.min(255, d[i]*rScale);
    let g = Math.min(255, d[i+1]*gScale);
    let b = Math.min(255, d[i+2]*bScale);

    // Histogram stretch
    r = (r - rMin) / rRange * 255;
    g = (g - gMin) / gRange * 255;
    b = (b - bMin) / bRange * 255;

    // Vibrance — boost saturation more on low-sat pixels
    const maxC = Math.max(r,g,b), minC = Math.min(r,g,b);
    const sat  = maxC > 0 ? (maxC-minC)/maxC : 0;
    const vibBoost = (1-sat) * 0.35; // up to +35% saturation on grey pixels
    const avg  = (r+g+b)/3;
    r = avg + (r - avg) * (1 + vibBoost);
    g = avg + (g - avg) * (1 + vibBoost);
    b = avg + (b - avg) * (1 + vibBoost);

    // Gamma
    r = Math.pow(Math.max(0, r)/255, gamma) * 255;
    g = Math.pow(Math.max(0, g)/255, gamma) * 255;
    b = Math.pow(Math.max(0, b)/255, gamma) * 255;

    d[i]   = Math.min(255, Math.max(0, r));
    d[i+1] = Math.min(255, Math.max(0, g));
    d[i+2] = Math.min(255, Math.max(0, b));
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * OLD PHOTO RESTORE
 * Pipeline:
 *   1. Denoise (bilateral) — remove scratches/dust noise
 *   2. Contrast + brightness adaptive boost
 *   3. Desaturate fade correction (restore lost colour)
 *   4. Warm tone recovery (old photos lose warm tones)
 *   5. Subtle sharpening
 */
function processOldPhotoCanvas(imgEl) {
  const [canvas, ctx] = imageToCanvas(imgEl);
  const { width, height } = canvas;
  let imgData = ctx.getImageData(0, 0, width, height);
  let d = imgData.data;

  // ── 1. Denoise pass ──
  const denoised = boxBlur(d, width, height, 1);

  // ── 2. Contrast + adaptive brightness ──
  // Find luma percentiles
  const lumas = [];
  for (let i = 0; i < denoised.length; i += 4) {
    lumas.push(0.299*denoised[i] + 0.587*denoised[i+1] + 0.114*denoised[i+2]);
  }
  lumas.sort((a,b) => a-b);
  const p2  = lumas[Math.floor(lumas.length * 0.02)] || 0;
  const p98 = lumas[Math.floor(lumas.length * 0.98)] || 255;
  const lumaRange = Math.max(1, p98-p2);

  const out = new Uint8ClampedArray(denoised.length);

  for (let i = 0; i < denoised.length; i += 4) {
    let r = denoised[i], g = denoised[i+1], b = denoised[i+2];

    // Levels stretch
    r = (r - p2) / lumaRange * 255;
    g = (g - p2) / lumaRange * 255;
    b = (b - p2) / lumaRange * 255;

    // ── 3. Fade correction — boost saturation on dull pixels ──
    const maxC = Math.max(r,g,b), minC = Math.min(r,g,b);
    const sat  = maxC > 0 ? (maxC-minC)/maxC : 0;
    if (sat < 0.25) {
      const avg = (r+g+b)/3;
      const boost = 1 + (0.25-sat) * 1.5;
      r = avg + (r-avg) * boost;
      g = avg + (g-avg) * boost;
      b = avg + (b-avg) * boost;
    }

    // ── 4. Warm tone recovery ──
    // Old photos often lose reds/yellows; gently warm them back
    r = r * 1.06;
    g = g * 1.02;
    b = b * 0.95;

    // ── 5. S-curve contrast ──
    const curve = v => {
      const n = v / 255;
      return Math.min(255, Math.max(0, 255 * (n < 0.5
        ? 2 * n * n
        : 1 - Math.pow(-2*n+2, 2)/2)));
    };
    r = curve(r); g = curve(g); b = curve(b);

    out[i]   = Math.min(255, Math.max(0, r));
    out[i+1] = Math.min(255, Math.max(0, g));
    out[i+2] = Math.min(255, Math.max(0, b));
    out[i+3] = denoised[i+3];
  }

  // ── 6. Unsharp mask for final crispness ──
  const sharpened = new Uint8ClampedArray(out.length);
  const blurred   = boxBlur(out, width, height, 1);
  for (let i = 0; i < out.length; i += 4) {
    sharpened[i]   = Math.min(255, Math.max(0, out[i]   + 0.5*(out[i]   - blurred[i])));
    sharpened[i+1] = Math.min(255, Math.max(0, out[i+1] + 0.5*(out[i+1] - blurred[i+1])));
    sharpened[i+2] = Math.min(255, Math.max(0, out[i+2] + 0.5*(out[i+2] - blurred[i+2])));
    sharpened[i+3] = out[i+3];
  }

  ctx.putImageData(new ImageData(sharpened, width, height), 0, 0);
  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * ENHANCE — fast brightness + contrast
 * Simple but predictable: multiply + offset per pixel
 */
function processEnhanceCanvas(imgEl, brightness = 1.18, contrast = 1.12) {
  const [canvas, ctx] = imageToCanvas(imgEl);
  const { width, height } = canvas;
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  const offset = 128 * (1 - contrast);

  for (let i = 0; i < d.length; i += 4) {
    d[i]   = Math.min(255, Math.max(0, d[i]   * brightness * contrast + offset));
    d[i+1] = Math.min(255, Math.max(0, d[i+1] * brightness * contrast + offset));
    d[i+2] = Math.min(255, Math.max(0, d[i+2] * brightness * contrast + offset));
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.93);
}

// ============================================================
// ── NEURAL UPSCALE — Swin2SR via Transformers.js ──────────
// ============================================================
async function neuralUpscale(imgEl) {
  if (!state.models.swin2sr) throw new Error('Swin2SR not loaded');

  // Swin2SR needs a Blob/URL, so we convert canvas → blob
  const [canvas] = imageToCanvas(imgEl);

  // Convert canvas to blob
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  const blobUrl = URL.createObjectURL(blob);

  const result = await state.models.swin2sr(blobUrl);
  URL.revokeObjectURL(blobUrl);

  // result is an object with .url or .data depending on transformers version
  // Handle both cases
  let outputUrl;
  if (result && result[0] && result[0].url) {
    outputUrl = result[0].url;
  } else if (result && result.url) {
    outputUrl = result.url;
  } else if (typeof result === 'string') {
    outputUrl = result;
  } else {
    // Fallback: try to extract from result object
    outputUrl = result?.output || result?.data || result;
  }

  const upImg = await loadImage(outputUrl);
  const [upCanvas] = imageToCanvas(upImg);
  return {
    dataURL: upCanvas.toDataURL('image/png'),
    width:   upImg.width,
    height:  upImg.height,
  };
}

// ============================================================
// MODEL LOADING
// ============================================================
async function loadModels() {
  log('Loading AI models — this may take a moment on first run...', 'orch');

  // MobileNet
  setAgent('brain', 'Loading...', 'thinking');
  try {
    state.models.mobilenet = await mobilenet.load({ version: 2, alpha: 1.0 });
    setAgent('brain', 'Ready', 'done');
    log('MobileNet v2 loaded ✓', 'brain');
  } catch(e) {
    setAgent('brain', 'Failed', 'error');
    log('MobileNet failed: ' + e.message, 'brain');
  }

  // COCO-SSD
  setAgent('vision', 'Loading...', 'thinking');
  try {
    state.models.cocossd = await cocoSsd.load({ base: 'mobilenet_v2' });
    setAgent('vision', 'Ready', 'done');
    log('COCO-SSD loaded ✓', 'vision');
  } catch(e) {
    setAgent('vision', 'Failed', 'error');
    log('COCO-SSD failed: ' + e.message, 'vision');
  }

  // Swin2SR
  setAgent('hands', 'Loading...', 'thinking');
  log('Loading Swin2SR (neural upscaler) — downloading ~50MB on first run...', 'hands');
  try {
    state.models.swin2sr = await pipeline(
      'image-to-image',
      'Xenova/swin2sr-classical-sr-x2-64'
    );
    setAgent('hands', 'Ready', 'done');
    log('Swin2SR loaded ✓ (2× neural upscale active)', 'hands');
  } catch(e) {
    setAgent('hands', 'Failed', 'error');
    log('Swin2SR failed: ' + e.message + ' — canvas upscale will be used as fallback', 'hands');
  }

  setAgent('heart', 'Ready', 'done');
  log('All canvas processors ready (denoise · sharpen · color · old-photo · enhance)', 'heart');
  log('System ready ✓', 'orch');
}

// ============================================================
// FILE UPLOAD
// ============================================================
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
  if (file.size > 10 * 1024 * 1024) { alert('File too large. Max 10MB.'); return; }

  state.file = file;
  fileName.textContent = file.name;
  fileSize.textContent  = (file.size / 1024).toFixed(1) + ' KB';

  const reader = new FileReader();
  reader.onload = e => {
    state.image = e.target.result;
    previewImage.src = e.target.result;
    previewBox.classList.remove('hidden');
    uploadLabel.style.display = 'none';

    const img = new Image();
    img.onload = () => {
      state.imgEl = img;
      fileDimensions.textContent = img.width + ' × ' + img.height;
      enableButtons(true);
      log(`Image loaded: ${img.width}×${img.height} · ${(file.size/1024).toFixed(0)}KB · ${file.name}`, 'orch');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

// ============================================================
// RESULT RENDERING HELPERS
// ============================================================
function makeCompareCard(originalSrc, processedSrc, label, dimInfo = '') {
  const card = document.createElement('div');
  card.className = 'result-card';
  card.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid var(--border2)">
      <div style="position:relative">
        <img src="${originalSrc}" style="width:100%;display:block;max-height:180px;object-fit:contain;background:#060610">
        <div style="position:absolute;bottom:6px;left:6px;font-family:var(--mono);font-size:8px;
          background:rgba(0,0,0,0.75);color:var(--text2);padding:2px 6px;border-radius:3px;letter-spacing:.08em">BEFORE</div>
      </div>
      <div style="position:relative;border-left:1px solid var(--border2)">
        <img src="${processedSrc}" style="width:100%;display:block;max-height:180px;object-fit:contain;background:#060610">
        <div style="position:absolute;bottom:6px;right:6px;font-family:var(--mono);font-size:8px;
          background:rgba(0,255,136,0.15);color:var(--green);padding:2px 6px;border-radius:3px;letter-spacing:.08em">AFTER</div>
      </div>
    </div>
    <div class="result-label">
      <span>${label}</span>
      ${dimInfo ? `<span class="dim-info">${dimInfo}</span>` : ''}
    </div>
    <a href="${processedSrc}" download="${label.replace(/[^a-z0-9]/gi,'_').toLowerCase()}.png" class="result-download">
      ↓ Download Result
    </a>`;
  return card;
}

function makeClassifyCard(predictions) {
  const card = document.createElement('div');
  card.className = 'result-card';
  let inner = `<div class="result-label">🧠 BRAIN · CLASSIFICATION</div>`;
  predictions.slice(0,5).forEach(p => {
    const pct = (p.probability * 100).toFixed(1);
    inner += `
      <div class="result-row">
        <span class="result-row-name">${p.className.split(',')[0]}</span>
        <span class="result-row-value">${pct}%</span>
      </div>
      <div class="result-bar-wrap">
        <div class="result-bar-track">
          <div class="result-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>`;
  });
  card.innerHTML = inner;
  return card;
}

function makeDetectCard(imgEl, predictions) {
  const canvas = document.createElement('canvas');
  const ctx    = canvas.getContext('2d');
  canvas.width  = imgEl.width;
  canvas.height = imgEl.height;
  ctx.drawImage(imgEl, 0, 0);

  const colors = ['#00ff88','#4488ff','#ffaa00','#ff4466','#aa66ff','#00ccff'];
  predictions.forEach((p, i) => {
    const [x,y,w,h] = p.bbox;
    const c = colors[i % colors.length];
    ctx.strokeStyle = c;
    ctx.lineWidth   = Math.max(2, canvas.width * 0.004);
    ctx.strokeRect(x, y, w, h);

    // Label background
    const label = `${p.class} ${Math.round(p.score*100)}%`;
    const fontSize = Math.max(11, canvas.width * 0.025);
    ctx.font = `bold ${fontSize}px Space Mono, monospace`;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = c;
    ctx.fillRect(x-1, y - fontSize - 6, tw + 10, fontSize + 8);
    ctx.fillStyle = '#000';
    ctx.fillText(label, x+4, y - 4);
  });

  const url  = canvas.toDataURL('image/png');
  const card = document.createElement('div');
  card.className = 'result-card';
  card.innerHTML = `
    <img src="${url}" style="width:100%;display:block;background:#060610">
    <div class="result-label">
      <span>👁️ VISION · DETECTION</span>
      <span class="dim-info">${predictions.length} object${predictions.length!==1?'s':''} found</span>
    </div>
    <a href="${url}" download="detection.png" class="result-download">↓ Download Annotated</a>`;
  return card;
}

// ============================================================
// INDIVIDUAL TOOL HANDLERS
// ============================================================

classifyBtn.addEventListener('click', async () => {
  if (!state.imgEl || !state.models.mobilenet) {
    log(!state.models.mobilenet ? 'MobileNet not loaded' : 'No image', 'brain');
    return;
  }
  setAgent('brain', 'Classifying', 'thinking');
  classifyBtn.disabled = true;
  log('Classifying image with MobileNet v2...', 'brain');
  try {
    const preds = await state.models.mobilenet.classify(state.imgEl, 5);
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(makeClassifyCard(preds));
    resultsSection.classList.remove('hidden');
    setAgent('brain', 'Done', 'done');
    log(`Top result: ${preds[0].className.split(',')[0]} (${(preds[0].probability*100).toFixed(1)}%)`, 'brain');
  } catch(e) {
    log('Classification error: ' + e.message, 'brain');
    setAgent('brain', 'Error', 'error');
  }
  classifyBtn.disabled = false;
});

detectBtn.addEventListener('click', async () => {
  if (!state.imgEl || !state.models.cocossd) {
    log(!state.models.cocossd ? 'COCO-SSD not loaded' : 'No image', 'vision');
    return;
  }
  setAgent('vision', 'Detecting', 'thinking');
  detectBtn.disabled = true;
  log('Running COCO-SSD object detection...', 'vision');
  try {
    const preds = await state.models.cocossd.detect(state.imgEl);
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(makeDetectCard(state.imgEl, preds));
    resultsSection.classList.remove('hidden');
    setAgent('vision', 'Done', 'done');
    log(`Detected ${preds.length} object(s)`, 'vision');
  } catch(e) {
    log('Detection error: ' + e.message, 'vision');
    setAgent('vision', 'Error', 'error');
  }
  detectBtn.disabled = false;
});

denoiseBtn.addEventListener('click', async () => {
  if (!state.imgEl) return;
  setAgent('heart', 'Denoising', 'thinking');
  denoiseBtn.disabled = true;
  log('Running bilateral denoise + JPEG artifact reduction...', 'heart');
  // Yield to let UI update before heavy computation
  await new Promise(r => setTimeout(r, 20));
  try {
    const output = processDenoiseCanvas(state.imgEl);
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(makeCompareCard(state.image, output, '🔇 HEART · DENOISE'));
    resultsSection.classList.remove('hidden');
    setAgent('heart', 'Done', 'done');
    log('Denoise complete (bilateral filter + artifact reduction)', 'heart');
  } catch(e) {
    log('Denoise error: ' + e.message, 'heart');
  }
  denoiseBtn.disabled = false;
});

sharpenBtn.addEventListener('click', async () => {
  if (!state.imgEl) return;
  setAgent('heart', 'Sharpening', 'thinking');
  sharpenBtn.disabled = true;
  log('Applying unsharp mask (radius:1.5 amount:0.85)...', 'heart');
  await new Promise(r => setTimeout(r, 20));
  try {
    const output = processSharpenCanvas(state.imgEl);
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(makeCompareCard(state.image, output, '🔪 HEART · SHARPEN'));
    resultsSection.classList.remove('hidden');
    setAgent('heart', 'Done', 'done');
    log('Sharpen complete', 'heart');
  } catch(e) {
    log('Sharpen error: ' + e.message, 'heart');
  }
  sharpenBtn.disabled = false;
});

colorBtn.addEventListener('click', async () => {
  if (!state.imgEl) return;
  setAgent('heart', 'Color Restoring', 'thinking');
  colorBtn.disabled = true;
  log('Restoring color — white balance + vibrance + contrast stretch...', 'heart');
  await new Promise(r => setTimeout(r, 20));
  try {
    const output = processColorRestoreCanvas(state.imgEl);
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(makeCompareCard(state.image, output, '🎨 HEART · COLOR RESTORE'));
    resultsSection.classList.remove('hidden');
    setAgent('heart', 'Done', 'done');
    log('Color restore complete', 'heart');
  } catch(e) {
    log('Color restore error: ' + e.message, 'heart');
  }
  colorBtn.disabled = false;
});

oldphotoBtn.addEventListener('click', async () => {
  if (!state.imgEl) return;
  setAgent('heart', 'Restoring Photo', 'thinking');
  oldphotoBtn.disabled = true;
  log('Running old photo restoration pipeline (6-pass)...', 'heart');
  await new Promise(r => setTimeout(r, 20));
  try {
    const output = processOldPhotoCanvas(state.imgEl);
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(makeCompareCard(state.image, output, '📷 HEART · OLD PHOTO RESTORE'));
    resultsSection.classList.remove('hidden');
    setAgent('heart', 'Done', 'done');
    log('Old photo restoration complete', 'heart');
  } catch(e) {
    log('Old photo error: ' + e.message, 'heart');
  }
  oldphotoBtn.disabled = false;
});

enhanceBtn.addEventListener('click', async () => {
  if (!state.imgEl) return;
  setAgent('heart', 'Enhancing', 'thinking');
  enhanceBtn.disabled = true;
  log('Applying brightness/contrast enhancement...', 'heart');
  await new Promise(r => setTimeout(r, 10));
  try {
    const output = processEnhanceCanvas(state.imgEl);
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(makeCompareCard(state.image, output, '✨ HEART · ENHANCE'));
    resultsSection.classList.remove('hidden');
    setAgent('heart', 'Done', 'done');
    log('Enhance complete', 'heart');
  } catch(e) {
    log('Enhance error: ' + e.message, 'heart');
  }
  enhanceBtn.disabled = false;
});

upscaleBtn.addEventListener('click', async () => {
  if (!state.imgEl) return;
  setAgent('hands', 'Upscaling', 'thinking');
  upscaleBtn.disabled = true;
  progressContainer.classList.remove('hidden');
  setProgress(15, 'Preparing image for Swin2SR...');
  log('Starting Swin2SR neural upscale (2×)...', 'hands');

  try {
    setProgress(35, 'Running Swin2SR inference...');
    const { dataURL, width, height } = await neuralUpscale(state.imgEl);
    setProgress(90, 'Finalizing output...');

    const origW = state.imgEl.width, origH = state.imgEl.height;
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(makeCompareCard(
      state.image, dataURL,
      '🔍 HANDS · SWIN2SR 2× UPSCALE',
      `${origW}×${origH} → ${width}×${height}`
    ));
    resultsSection.classList.remove('hidden');
    setProgress(100, 'Done');
    setAgent('hands', 'Done', 'done');
    log(`Swin2SR complete: ${origW}×${origH} → ${width}×${height}`, 'hands');
  } catch(e) {
    log('Swin2SR error: ' + e.message + ' · trying canvas bicubic fallback...', 'hands');
    // Canvas 2× fallback
    const scale = 2;
    const c = document.createElement('canvas');
    c.width  = state.imgEl.width  * scale;
    c.height = state.imgEl.height * scale;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled  = true;
    ctx.imageSmoothingQuality  = 'high';
    ctx.drawImage(state.imgEl, 0, 0, c.width, c.height);
    const fallback = c.toDataURL('image/png');
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(makeCompareCard(
      state.image, fallback,
      '🔍 HANDS · 2× CANVAS UPSCALE (FALLBACK)',
      `${state.imgEl.width}×${state.imgEl.height} → ${c.width}×${c.height}`
    ));
    resultsSection.classList.remove('hidden');
    setAgent('hands', 'Done (Fallback)', 'done');
    setProgress(100);
  }

  await new Promise(r => setTimeout(r, 600));
  progressContainer.classList.add('hidden');
  upscaleBtn.disabled = false;
});

// ============================================================
// FULL PIPELINE
// ============================================================
processBtn.addEventListener('click', async () => {
  if (!state.imgEl) return;

  const profile = modelSelect.value;
  enableButtons(false);
  progressContainer.classList.remove('hidden');
  resultsContainer.innerHTML = '';
  resultsSection.classList.add('hidden');
  resetAgents();
  log(`Starting pipeline: ${profile.toUpperCase()}`, 'orch');

  const cards = [];

  try {
    // ── Brain: Classify ──────────────────────────────────────
    if (['full','analyze'].includes(profile)) {
      setAgent('brain', 'Classifying', 'thinking');
      setProgress(8, 'Brain: Classifying...');
      if (state.models.mobilenet) {
        const preds = await state.models.mobilenet.classify(state.imgEl, 5);
        cards.push(makeClassifyCard(preds));
        log(`Classification: ${preds[0].className.split(',')[0]} (${(preds[0].probability*100).toFixed(1)}%)`, 'brain');
      }
      setAgent('brain', 'Done', 'done');
    }

    // ── Vision: Detect ───────────────────────────────────────
    if (['full','analyze'].includes(profile)) {
      setAgent('vision', 'Detecting', 'thinking');
      setProgress(18, 'Vision: Detecting objects...');
      if (state.models.cocossd) {
        const preds = await state.models.cocossd.detect(state.imgEl);
        cards.push(makeDetectCard(state.imgEl, preds));
        log(`Detection: ${preds.length} object(s) found`, 'vision');
      }
      setAgent('vision', 'Done', 'done');
    }

    // ── Heart: Restore ───────────────────────────────────────
    let restoredDataURL = state.image;
    let restoredImgEl   = state.imgEl;

    if (['full','denoise','color','oldphoto','restore'].includes(profile)) {
      setAgent('heart', 'Restoring', 'thinking');

      if (profile === 'oldphoto') {
        setProgress(35, 'Heart: Old photo restoration...');
        log('Running full old-photo restoration pipeline...', 'heart');
        await new Promise(r => setTimeout(r, 20));
        restoredDataURL = processOldPhotoCanvas(restoredImgEl);
      } else {
        // Full pipeline: denoise → color → sharpen
        setProgress(30, 'Heart: Denoising...');
        log('Denoising...', 'heart');
        await new Promise(r => setTimeout(r, 20));
        restoredDataURL = processDenoiseCanvas(restoredImgEl);

        restoredImgEl = await loadImage(restoredDataURL);
        setProgress(42, 'Heart: Restoring color...');
        log('Restoring color...', 'heart');
        await new Promise(r => setTimeout(r, 10));
        restoredDataURL = processColorRestoreCanvas(restoredImgEl);

        restoredImgEl = await loadImage(restoredDataURL);
        setProgress(52, 'Heart: Sharpening...');
        log('Sharpening...', 'heart');
        await new Promise(r => setTimeout(r, 10));
        restoredDataURL = processSharpenCanvas(restoredImgEl);
      }

      restoredImgEl = await loadImage(restoredDataURL);
      cards.push(makeCompareCard(state.image, restoredDataURL, '❤️ HEART · RESTORATION'));
      setAgent('heart', 'Done', 'done');
      log('Heart restoration complete', 'heart');
    }

    // ── Hands: Upscale ───────────────────────────────────────
    if (['full','upscale'].includes(profile)) {
      setAgent('hands', 'Upscaling', 'thinking');
      setProgress(65, 'Hands: AI upscaling (Swin2SR)...');
      log('Starting Swin2SR neural upscale...', 'hands');

      try {
        const { dataURL, width, height } = await neuralUpscale(restoredImgEl);
        setProgress(90, 'Hands: Finalizing...');
        const origW = restoredImgEl.width || restoredImgEl.naturalWidth;
        const origH = restoredImgEl.height || restoredImgEl.naturalHeight;
        cards.push(makeCompareCard(
          restoredDataURL, dataURL,
          '🔍 HANDS · SWIN2SR 2× UPSCALE',
          `${origW}×${origH} → ${width}×${height}`
        ));
        log(`Upscale complete: → ${width}×${height}`, 'hands');
      } catch(e) {
        log('Neural upscale failed, using canvas 2× fallback', 'hands');
        const scale = 2;
        const fc = document.createElement('canvas');
        fc.width  = restoredImgEl.width  * scale;
        fc.height = restoredImgEl.height * scale;
        const fctx = fc.getContext('2d');
        fctx.imageSmoothingEnabled = true;
        fctx.imageSmoothingQuality = 'high';
        fctx.drawImage(restoredImgEl, 0, 0, fc.width, fc.height);
        const fbUrl = fc.toDataURL('image/png');
        cards.push(makeCompareCard(restoredDataURL, fbUrl, '🔍 HANDS · 2× UPSCALE (FALLBACK)',
          `${restoredImgEl.width}×${restoredImgEl.height} → ${fc.width}×${fc.height}`));
      }
      setAgent('hands', 'Done', 'done');
    }

    setProgress(100, 'Pipeline complete ✓');
    cards.forEach(c => resultsContainer.appendChild(c));
    resultsSection.classList.remove('hidden');
    log('Pipeline complete ✓', 'orch');

  } catch(e) {
    log('Pipeline error: ' + e.message, 'orch');
    setProgress(0, 'Error occurred');
  }

  await new Promise(r => setTimeout(r, 800));
  progressContainer.classList.add('hidden');
  enableButtons(true);
});

// ============================================================
// CLEAR
// ============================================================
clearBtn.addEventListener('click', () => {
  state.file = null; state.image = null; state.imgEl = null;
  fileInput.value = '';
  previewBox.classList.add('hidden');
  resultsSection.classList.add('hidden');
  uploadLabel.style.display = '';
  resultsContainer.innerHTML = '';
  enableButtons(false);
  resetAgents();
  log('Workspace cleared', 'orch');
});

// ============================================================
// API TABS
// ============================================================
const apiSnippets = {
  upscale: `// AI Upscale (2× Swin2SR neural model)
const api = window.AgenticImageAPI;
const result = await api.upscale(imageFile);
// result.output → base64 PNG
// result.width, result.height, result.time`,

  restore: `// Full Color + Denoise + Sharpen Restore
const api = window.AgenticImageAPI;
const result = await api.restoreColor(imageFile);
// result.output → base64 JPEG
// Works with File, Blob, or base64 dataURL`,

  denoise: `// Remove noise, JPEG artifacts, grain
const api = window.AgenticImageAPI;
const result = await api.denoise(imageFile);
// Uses bilateral edge-preserving filter
// + JPEG block boundary smoothing`,

  classify: `// MobileNet v2 classification
const api = window.AgenticImageAPI;
const result = await api.classify(imageFile);
// result.predictions → [{ className, probability }]
// result.top → highest confidence label`,

  pipeline: `// Full restoration pipeline
const api = window.AgenticImageAPI;
const result = await api.pipeline(imageFile, {
  denoise:    true,  // bilateral denoise
  colorRestore: true,// white balance + vibrance
  sharpen:    true,  // unsharp mask
  upscale:    true,  // Swin2SR 2×
  classify:   false, // skip MobileNet
  detect:     false, // skip COCO-SSD
});
// result.stages → { denoise, color, upscale, ... }
// result.final  → last stage output base64`,
};

apiTabs.addEventListener('click', e => {
  const tab = e.target.closest('.api-tab');
  if (!tab) return;
  document.querySelectorAll('.api-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  apiCode.textContent = apiSnippets[tab.dataset.tab] || '';
});

// ============================================================
// PUBLIC API — window.AgenticImageAPI
// ============================================================
window.AgenticImageAPI = {

  /** Get current model status */
  status() {
    return {
      mobilenet: !!state.models.mobilenet,
      cocossd:   !!state.models.cocossd,
      swin2sr:   !!state.models.swin2sr,
    };
  },

  /** Denoise image — bilateral filter + JPEG artifact removal */
  async denoise(input) {
    const t0   = Date.now();
    const img  = await toImageEl(input);
    const out  = processDenoiseCanvas(img);
    return { output: out, time: Date.now()-t0 };
  },

  /** Unsharp mask sharpening */
  async sharpen(input, amount = 0.85, radius = 1.5) {
    const t0  = Date.now();
    const img = await toImageEl(input);
    const out = processSharpenCanvas(img, amount, radius);
    return { output: out, time: Date.now()-t0 };
  },

  /** Color restoration — white balance + vibrance + contrast stretch + gamma */
  async restoreColor(input) {
    const t0  = Date.now();
    const img = await toImageEl(input);
    const out = processColorRestoreCanvas(img);
    return { output: out, time: Date.now()-t0 };
  },

  /** Old photo restoration — 6-pass pipeline */
  async restoreOldPhoto(input) {
    const t0  = Date.now();
    const img = await toImageEl(input);
    const out = processOldPhotoCanvas(img);
    return { output: out, time: Date.now()-t0 };
  },

  /** Brightness + contrast enhance */
  async enhance(input, brightness = 1.18, contrast = 1.12) {
    const t0  = Date.now();
    const img = await toImageEl(input);
    const out = processEnhanceCanvas(img, brightness, contrast);
    return { output: out, time: Date.now()-t0 };
  },

  /** Neural 2× upscale via Swin2SR */
  async upscale(input) {
    if (!state.models.swin2sr) throw new Error('Swin2SR not loaded yet. Wait for loadModels() to complete.');
    const t0  = Date.now();
    const img = await toImageEl(input);
    const res = await neuralUpscale(img);
    return { output: res.dataURL, width: res.width, height: res.height, time: Date.now()-t0 };
  },

  /** MobileNet classification */
  async classify(input, topK = 5) {
    if (!state.models.mobilenet) throw new Error('MobileNet not loaded yet.');
    const t0  = Date.now();
    const img = await toImageEl(input);
    const preds = await state.models.mobilenet.classify(img, topK);
    return { predictions: preds, top: preds[0]?.className, time: Date.now()-t0 };
  },

  /** COCO-SSD object detection */
  async detect(input) {
    if (!state.models.cocossd) throw new Error('COCO-SSD not loaded yet.');
    const t0  = Date.now();
    const img = await toImageEl(input);
    const preds = await state.models.cocossd.detect(img);
    return { objects: preds, count: preds.length, time: Date.now()-t0 };
  },

  /**
   * Full restoration pipeline
   * @param {File|Blob|string} input
   * @param {object} opts - { denoise, colorRestore, sharpen, upscale, classify, detect }
   */
  async pipeline(input, opts = {}) {
    const cfg = {
      denoise:      true,
      colorRestore: true,
      sharpen:      true,
      upscale:      true,
      classify:     false,
      detect:       false,
      ...opts,
    };

    const t0     = Date.now();
    const stages = {};
    let   img    = await toImageEl(input);
    let   current = img.src || input;

    if (cfg.denoise) {
      current = processDenoiseCanvas(img);
      stages.denoise = current;
      img = await loadImage(current);
    }
    if (cfg.colorRestore) {
      current = processColorRestoreCanvas(img);
      stages.colorRestore = current;
      img = await loadImage(current);
    }
    if (cfg.sharpen) {
      current = processSharpenCanvas(img);
      stages.sharpen = current;
      img = await loadImage(current);
    }
    if (cfg.upscale && state.models.swin2sr) {
      const res = await neuralUpscale(img);
      current = res.dataURL;
      stages.upscale = current;
      img = await loadImage(current);
    }
    if (cfg.classify && state.models.mobilenet) {
      stages.classify = await state.models.mobilenet.classify(img, 5);
    }
    if (cfg.detect && state.models.cocossd) {
      stages.detect = await state.models.cocossd.detect(img);
    }

    return { final: current, stages, time: Date.now()-t0 };
  }
};

// ============================================================
// INIT
// ============================================================
resetAgents();
log('AgenticImage v2.0.0 · Free AI image restoration', 'orch');
log('window.AgenticImageAPI exposed — see API docs below', 'api');
loadModels();
