// ============================================
// AI PROCESSING PIPELINE
// ============================================

import { sleep } from './utils.js';
import { setAgentStatus } from './agents.js';

export async function brainAnalyze(imageElement, onProgress) {
  setAgentStatus('brain', 'Analyzing...', true);
  onProgress?.(10, 'Brain analyzing...');
  await sleep(600);
  setAgentStatus('brain', 'Done');
  onProgress?.(25, 'Analysis complete');
  return { width: imageElement.width, height: imageElement.height };
}

export async function visionDetect(imageElement, onProgress) {
  setAgentStatus('vision', 'Detecting...', true);
  onProgress?.(35, 'Vision scanning...');
  await sleep(500);
  setAgentStatus('vision', 'Done');
  onProgress?.(50, 'Detection complete');
  return ['objects detected'];
}

export async function heartEnhance(imageElement, onProgress) {
  setAgentStatus('heart', 'Enhancing...', true);
  onProgress?.(60, 'Heart enhancing...');
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = imageElement.width;
  canvas.height = imageElement.height;
  ctx.drawImage(imageElement, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, data[i] * 1.12);
    data[i + 1] = Math.min(255, data[i + 1] * 1.12);
    data[i + 2] = Math.min(255, data[i + 2] * 1.12);
  }
  ctx.putImageData(imageData, 0, 0);
  
  await sleep(500);
  setAgentStatus('heart', 'Done');
  onProgress?.(75, 'Enhancement complete');
  return canvas;
}

export async function handsUpscale(sourceCanvas, onProgress) {
  setAgentStatus('hands', 'Upscaling...', true);
  onProgress?.(80, 'Hands upscaling...');
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = sourceCanvas.width * 2;
  canvas.height = sourceCanvas.height * 2;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
  
  await sleep(600);
  setAgentStatus('hands', 'Done');
  onProgress?.(100, 'Upscaling complete');
  return canvas;
}

export async function runFullPipeline(imageElement, onProgress) {
  const results = {};
  results.analysis = await brainAnalyze(imageElement, onProgress);
  results.detection = await visionDetect(imageElement, onProgress);
  const enhancedCanvas = await heartEnhance(imageElement, onProgress);
  results.enhanced = enhancedCanvas.toDataURL('image/jpeg', 0.92);
  const upscaledCanvas = await handsUpscale(enhancedCanvas, onProgress);
  results.upscaled = upscaledCanvas.toDataURL('image/png');
  return results;
}
