(function() {
  "use strict";
  
  const fileInput = document.getElementById('fileInput');
  const previewBox = document.getElementById('previewBox');
  const previewImage = document.getElementById('previewImage');
  const fileName = document.getElementById('fileName');
  const fileSize = document.getElementById('fileSize');
  const fileDimensions = document.getElementById('fileDimensions');
  const processBtn = document.getElementById('processBtn');
  const classifyBtn = document.getElementById('classifyBtn');
  const detectBtn = document.getElementById('detectBtn');
  const enhanceBtn = document.getElementById('enhanceBtn');
  const upscaleBtn = document.getElementById('upscaleBtn');
  const clearBtn = document.getElementById('clearBtn');
  const progressContainer = document.getElementById('progressContainer');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const logContainer = document.getElementById('logContainer');
  const logCountSpan = document.getElementById('logCount');
  const resultsSection = document.getElementById('resultsSection');
  const resultsContainer = document.getElementById('resultsContainer');
  const brainStatus = document.getElementById('brainStatus');
  const visionStatus = document.getElementById('visionStatus');
  const heartStatus = document.getElementById('heartStatus');
  const handsStatus = document.getElementById('handsStatus');
  const brainDot = document.getElementById('brainDot');
  const visionDot = document.getElementById('visionDot');
  const heartDot = document.getElementById('heartDot');
  const handsDot = document.getElementById('handsDot');
  
  let state = { file: null, image: null, imgEl: null, logCount: 0 };
  
  function log(msg) {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `<span class="log-time">[${time}]</span><span class="log-agent">🎯 Orch</span><span>${msg}</span>`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
    state.logCount++;
    logCountSpan.textContent = state.logCount + ' events';
  }
  
  function setAgentStatus(agent, status, thinking = false) {
    const map = {
      brain: [brainStatus, brainDot],
      vision: [visionStatus, visionDot],
      heart: [heartStatus, heartDot],
      hands: [handsStatus, handsDot]
    };
    const [el, dot] = map[agent];
    if (el) el.textContent = status;
    if (dot) dot.className = 'status-dot' + (thinking ? ' thinking' : '');
  }
  
  function resetAgents() {
    setAgentStatus('brain', 'Idle');
    setAgentStatus('vision', 'Idle');
    setAgentStatus('heart', 'Idle');
    setAgentStatus('hands', 'Idle');
  }
  
  function enableButtons(enabled) {
    const btns = [processBtn, classifyBtn, detectBtn, enhanceBtn, upscaleBtn];
    btns.forEach(b => b.disabled = !enabled);
  }
  
  fileInput.addEventListener('change', function() {
    const file = fileInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Select an image file'); return; }
    
    state.file = file;
    fileName.textContent = file.name;
    fileSize.textContent = (file.size / 1024).toFixed(1) + ' KB';
    
    const reader = new FileReader();
    reader.onload = function(e) {
      state.image = e.target.result;
      previewImage.src = e.target.result;
      previewBox.classList.remove('hidden');
      
      const img = new Image();
      img.onload = function() {
        state.imgEl = img;
        fileDimensions.textContent = img.width + ' × ' + img.height;
        enableButtons(true);
        log('Image loaded: ' + img.width + '×' + img.height);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
  
  async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  
  processBtn.addEventListener('click', async function() {
    if (!state.imgEl) return;
    
    enableButtons(false);
    progressContainer.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    resetAgents();
    
    log('Starting pipeline...');
    progressFill.style.width = '10%';
    progressText.textContent = 'Brain analyzing...';
    setAgentStatus('brain', 'Analyzing', true);
    await sleep(600);
    setAgentStatus('brain', 'Done');
    progressFill.style.width = '25%';
    
    progressText.textContent = 'Vision scanning...';
    setAgentStatus('vision', 'Scanning', true);
    await sleep(500);
    setAgentStatus('vision', 'Done');
    progressFill.style.width = '40%';
    
    progressText.textContent = 'Heart enhancing...';
    setAgentStatus('heart', 'Enhancing', true);
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = state.imgEl.width;
    canvas.height = state.imgEl.height;
    ctx.drawImage(state.imgEl, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, data[i] * 1.12);
      data[i+1] = Math.min(255, data[i+1] * 1.12);
      data[i+2] = Math.min(255, data[i+2] * 1.12);
    }
    ctx.putImageData(imageData, 0, 0);
    const enhanced = canvas.toDataURL('image/jpeg', 0.92);
    
    await sleep(500);
    setAgentStatus('heart', 'Done');
    progressFill.style.width = '70%';
    
    progressText.textContent = 'Hands upscaling...';
    setAgentStatus('hands', 'Upscaling', true);
    
    const upCanvas = document.createElement('canvas');
    upCanvas.width = canvas.width * 2;
    upCanvas.height = canvas.height * 2;
    const upCtx = upCanvas.getContext('2d');
    upCtx.imageSmoothingEnabled = true;
    upCtx.imageSmoothingQuality = 'high';
    upCtx.drawImage(canvas, 0, 0, upCanvas.width, upCanvas.height);
    const upscaled = upCanvas.toDataURL('image/png');
    
    await sleep(600);
    setAgentStatus('hands', 'Done');
    progressFill.style.width = '100%';
    progressText.textContent = 'Complete!';
    
    resultsContainer.innerHTML = `
      <div class="result-card"><img src="${state.image}" alt="Original"><div class="result-label">📸 Original</div></div>
      <div class="result-card"><img src="${enhanced}" alt="Enhanced"><div class="result-label">❤️ Enhanced</div><a href="${enhanced}" download="enhanced.jpg" class="result-download">Download</a></div>
      <div class="result-card"><img src="${upscaled}" alt="Upscaled"><div class="result-label">👐 2x Upscale</div><a href="${upscaled}" download="upscaled.png" class="result-download">Download</a></div>
    `;
    resultsSection.classList.remove('hidden');
    
    log('Pipeline complete');
    
    setTimeout(() => {
      progressContainer.classList.add('hidden');
      enableButtons(true);
    }, 1000);
  });
  
  clearBtn.addEventListener('click', function() {
    state = { file: null, image: null, imgEl: null, logCount: state.logCount };
    fileInput.value = '';
    previewBox.classList.add('hidden');
    resultsSection.classList.add('hidden');
    enableButtons(false);
    resetAgents();
    log('Cleared');
  });
  
  classifyBtn.addEventListener('click', () => log('Classification requested'));
  detectBtn.addEventListener('click', () => log('
