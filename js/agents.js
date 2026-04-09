// ============================================
// AGENTICIMAGE API - MAIN APPLICATION
// ============================================

import { formatFileSize, isValidImageFile } from './utils.js';
import { initAgents, resetAllAgents, AGENTS } from './agents.js';
import { runFullPipeline } from './pipeline.js';

// ========== STATE ==========
const state = {
  originalFile: null,
  originalImage: null,
  imageElement: null,
  processedResults: {},
  logCount: 0,
  isProcessing: false
};

// ========== DOM ELEMENTS ==========
const elements = {
  uploadZone: document.getElementById('uploadZone'),
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
  resultsContainer: document.getElementById('resultsContainer'),
  modelSelect: document.getElementById('modelSelect')
};

// ========== LOGGING ==========
function log(agent, message) {
  const time = new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', minute: '2-digit', second: '2-digit' 
  });
  
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

// ========== PROGRESS ==========
function updateProgress(percent, text) {
  elements.progressFill.style.width = `${percent}%`;
  elements.progressText.textContent = text;
}

function showProgress(show = true) {
  if (show) {
    elements.progressContainer.classList.remove('hidden');
  } else {
    elements.progressContainer.classList.add('hidden');
    elements.progressFill.style.width = '0%';
  }
}

// ========== FILE HANDLING ==========
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
    elements.uploadZone.classList.add('hidden');
    
    const img = new Image();
    img.onload = () => {
      state.imageElement = img;
      elements.fileDimensions.textContent = `${img.width} × ${img.height} pixels`;
      
      // Enable buttons
      elements.processBtn.disabled = false;
      elements.classifyBtn.disabled = false;
      elements.detectBtn.disabled = false;
      elements.enhanceBtn.disabled = false;
      elements.upscaleBtn.disabled = false;
      
      log('Orchestrator', `Image loaded: ${img.width}×${img.height}, ${formatFileSize(file.size)}`);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ========== DISPLAY RESULTS ==========
function displayResults(results) {
  elements.resultsContainer.innerHTML = '';
  
  // Original
  elements.resultsContainer.innerHTML += `
    <div class="result-card">
      <img src="${state.originalImage}" alt="Original">
      <div class="result-label">📸 Original</div>
    </div>
  `;
  
  // Enhanced
  if (results.enhanced) {
    elements.resultsContainer.innerHTML += `
      <div class="result-card">
        <img src="${results.enhanced}" alt="Enhanced">
        <div class="result-label">❤️ Heart Enhanced</div>
        <a href="${results.enhanced}" download="enhanced.jpg" class="result-download">
          <i class="fas fa-download"></i> Download JPG
        </a>
      </div>
    `;
  }
  
  // Upscaled
  if (results.upscaled) {
    elements.resultsContainer.innerHTML += `
      <div class="result-card">
        <img src="${results.upscaled}" alt="Upscaled">
        <div class="result-label">👐 Hands 2x Upscale</div>
        <a href="${results.upscaled}" download="upscaled.png" class="result-download">
          <i class="fas fa-download"></i> Download PNG
        </a>
      </div>
    `;
  }
  
  elements.resultsSection.classList.remove('hidden');
}

// ========== PIPELINE EXECUTION ==========
async function executePipeline() {
  if (!state.imageElement || state.isProcessing) return;
  
  state.isProcessing = true;
  elements.resultsContainer.innerHTML = '';
  elements.resultsSection.classList.add('hidden');
  showProgress(true);
  
  // Disable buttons
  ['processBtn', 'classifyBtn', 'detectBtn', 'enhanceBtn', 'upscaleBtn'].forEach(btn => {
    elements[btn].disabled = true;
  });
  
  resetAllAgents();
  log('Orchestrator', '══════ Starting AI Pipeline ══════');
  
  try {
    const results = await runFullPipeline(
      state.imageElement,
      { mode: elements.modelSelect.value },
      (percent, text) => updateProgress(percent, text)
    );
    
    state.processedResults = results;
    displayResults(results);
    
    log('Orchestrator', '══════ Pipeline Complete! ══════');
  } catch (error) {
    log('Orchestrator', `Error: ${error.message}`);
  } finally {
    state.isProcessing = false;
    elements.processBtn.disabled = false;
    elements.classifyBtn.disabled = false;
    elements.detectBtn.disabled = false;
    elements.enhanceBtn.disabled = false;
    elements.upscaleBtn.disabled = false;
    
    setTimeout(() => showProgress(false), 1000);
  }
}

// ========== CLEAR ==========
function clearAll() {
  state.originalFile = null;
  state.originalImage = null;
  state.imageElement = null;
  state.processedResults = {};
  
  elements.fileInput.value = '';
  elements.previewBox.classList.add('hidden');
  elements.uploadZone.classList.remove('hidden');
  elements.resultsSection.classList.add('hidden');
  
  ['processBtn', 'classifyBtn', 'detectBtn', 'enhanceBtn', 'upscaleBtn'].forEach(btn => {
    elements[btn].disabled = true;
  });
  
  resetAllAgents();
  log('Orchestrator', 'Cleared. Ready for new image.');
}

// ========== EVENT LISTENERS ==========
function bindEvents() {
  // Upload
  elements.uploadZone.addEventListener('click', () => elements.fileInput.click());
  
  elements.uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.uploadZone.style.borderColor = '#1c1c1c';
  });
  
  elements.uploadZone.addEventListener('dragleave', () => {
    elements.uploadZone.style.borderColor = '#eceae4';
  });
  
  elements.uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.uploadZone.style.borderColor = '#eceae4';
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  
  elements.fileInput.addEventListener('change', (e) => {
    if (elements.fileInput.files[0]) handleFile(elements.fileInput.files[0]);
  });
  
  // Actions
  elements.processBtn.addEventListener('click', executePipeline);
  elements.clearBtn.addEventListener('click', clearAll);
  
  // Individual agent triggers
  elements.classifyBtn.addEventListener('click', () => log('Brain', 'Classification requested'));
  elements.detectBtn.addEventListener('click', () => log('Vision', 'Detection requested'));
  elements.enhanceBtn.addEventListener('click', () => log('Heart', 'Enhancement requested'));
  elements.upscaleBtn.addEventListener('click', () => log('Hands', 'Upscaling requested'));
}

// ========== INITIALIZATION ==========
function init() {
  initAgents();
  bindEvents();
  
  log('Orchestrator', 'AgenticImage API initialized');
  log('Orchestrator', 'Agents: Brain, Vision, Heart, Hands online');
  log('Orchestrator', 'Ready — upload an image to begin');
  
  console.log('✅ AgenticImage API Ready');
}

// Start the application
init();

// Export for debugging
window.AgenticImage = {
  state,
  executePipeline,
  clearAll,
  log
};
