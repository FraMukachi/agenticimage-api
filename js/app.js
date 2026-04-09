// ============================================
// AGENTICIMAGE API - MAIN APPLICATION
// ============================================

import { formatFileSize, isValidImageFile } from './utils.js';
import { resetAllAgents, AGENTS } from './agents.js';
import { runFullPipeline } from './pipeline.js';

// State
const state = {
  originalFile: null,
  originalImage: null,
  imageElement: null,
  logCount: 0,
  isProcessing: false
};

// DOM Elements
const elements = {
  fileInput: document.getElementById('fileInput'),
  previewBox: document.getElementById('previewBox'),
  previewImage: document.getElementById('previewImage'),
  fileName: document.getElementById('fileName'),
  fileSize: document.getElementById('fileSize'),
  fileDimensions: document.getElementById('fileDimensions'),
  processBtn: document.getElementById('processBtn'),
  classifyBtn: document.getElementById('classifyBtn'),
  detectBtn: document.getElementById('detectBtn'),
  enhanceBtn: document.getElementById('enhanceBtn'),
  upscaleBtn: document.getElementById('upscaleBtn'),
  clearBtn: document.getElementById('clearBtn'),
  progressContainer: document.getElementById('progressContainer'),
  progressFill: document.getElementById('progressFill'),
  progressText: document.getElementById('progressText'),
  logContainer: document.getElementById('logContainer'),
  logCountSpan: document.getElementById('logCount'),
  resultsSection: document.getElementById('resultsSection'),
  resultsContainer: document.getElementById('resultsContainer')
};

// Logging
function log(agent, message) {
  const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  
  const agentInfo = Object.values(AGENTS).find(a => a.name === agent) || AGENTS.ORCH;
  const agentClass = `log-${agentInfo.id}`;
  
  entry.innerHTML = `
    <span class="log-time">[${time}]</span>
    <span class="log-agent ${agentClass}">${agentInfo.emoji} ${agent}</span>
    <span class="log-message">${message}</span>
  `;
  
  elements.logContainer.appendChild(entry);
  elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
  state.logCount++;
  elements.logCountSpan.textContent = `${state.logCount} event${state.logCount !== 1 ? 's' : ''}`;
}

// Progress
function updateProgress(percent, text) {
  elements.progressFill.style.width = `${percent}%`;
  elements.progressText.textContent = text;
}

function showProgress(show) {
  if (show) {
    elements.progressContainer.classList.remove('hidden');
  } else {
    elements.progressContainer.classList.add('hidden');
    elements.progressFill.style.width = '0%';
  }
}

// Enable/disable buttons
function setButtonsEnabled(enabled) {
  const btns = ['processBtn', 'classifyBtn', 'detectBtn', 'enhanceBtn', 'upscaleBtn'];
  btns.forEach(id => { elements[id].disabled = !enabled; });
}

// File handling
function handleFile(file) {
  if (!isValidImageFile(file)) {
    alert('Please select an image file');
    return;
  }
  
  state.originalFile = file;
  elements.fileName.textContent = file.name;
  elements.fileSize.textContent = formatFileSize(file.size);
  
  const reader = new FileReader();
  reader.onload = (e) => {
    state.originalImage = e.target.result;
    elements.previewImage.src = e.target.result;
    elements.previewBox.classList.remove('hidden');
    
    const img = new Image();
    img.onload = () => {
      state.imageElement = img;
      elements.fileDimensions.textContent = `${img.width} × ${img.height}`;
      setButtonsEnabled(true);
      log('Orchestrator', `Image loaded: ${img.width}×${img.height}`);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Display results
function displayResults(results) {
  elements.resultsContainer.innerHTML = `
    <div class="result-card">
      <img src="${state.originalImage}" alt="Original">
      <div class="result-label">📸 Original</div>
    </div>
    <div class="result-card">
      <img src="${results.enhanced}" alt="Enhanced">
      <div class="result-label">❤️ Heart Enhanced</div>
      <a href="${results.enhanced}" download="enhanced.jpg" class="result-download">
        <i class="fas fa-download"></i> Download
      </a>
    </div>
    <div class="result-card">
      <img src="${results.upscaled}" alt="Upscaled">
      <div class="result-label">👐 Hands 2x Upscale</div>
      <a href="${results.upscaled}" download="upscaled.png" class="result-download">
        <i class="fas fa-download"></i> Download
      </a>
    </div>
  `;
  elements.resultsSection.classList.remove('hidden');
}

// Pipeline execution
async function executePipeline() {
  if (!state.imageElement || state.isProcessing) return;
  
  state.isProcessing = true;
  elements.resultsSection.classList.add('hidden');
  showProgress(true);
  setButtonsEnabled(false);
  resetAllAgents();
  
  log('Orchestrator', '══════ Starting Pipeline ══════');
  
  try {
    const results = await runFullPipeline(state.imageElement, updateProgress);
    displayResults(results);
    log('Orchestrator', '══════ Pipeline Complete ══════');
  } catch (error) {
    log('Orchestrator', `Error: ${error.message}`);
  } finally {
    state.isProcessing = false;
    setButtonsEnabled(true);
    setTimeout(() => showProgress(false), 1000);
  }
}

// Clear
function clearAll() {
  state.originalFile = null;
  state.originalImage = null;
  state.imageElement = null;
  elements.fileInput.value = '';
  elements.previewBox.classList.add('hidden');
  elements.resultsSection.classList.add('hidden');
  setButtonsEnabled(false);
  resetAllAgents();
  log('Orchestrator', 'Cleared. Ready for new image.');
}

// Event listeners
function bindEvents() {
  elements.fileInput.addEventListener('change', (e) => {
    if (elements.fileInput.files[0]) handleFile(elements.fileInput.files[0]);
  });
  
  elements.processBtn.addEventListener('click', executePipeline);
  elements.clearBtn.addEventListener('click', clearAll);
  
  elements.classifyBtn.addEventListener('click', () => log('Brain', 'Classification requested'));
  elements.detectBtn.addEventListener('click', () => log('Vision', 'Detection requested'));
  elements.enhanceBtn.addEventListener('click', () => log('Heart', 'Enhancement requested'));
  elements.upscaleBtn.addEventListener('click', () => log('Hands', 'Upscaling requested'));
}

// Initialize
function init() {
  bindEvents();
  log('Orchestrator', 'System ready. Upload an image to begin.');
  console.log('✅ AgenticImage API Ready');
}

init();
