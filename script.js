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
    var time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    var entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = '<span class="log-time">[' + time + ']</span><span class="log-agent">🎯 Orch</span><span>' + msg + '</span>';
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
    state.logCount++;
    logCountSpan.textContent = state.logCount + ' events';
  }
  
  function setAgentStatus(agent, status, thinking) {
    thinking = thinking || false;
    var map = { brain: [brainStatus, brainDot], vision: [visionStatus, visionDot], heart: [heartStatus, heartDot], hands: [handsStatus, handsDot] };
    var parts = map[agent];
    if (parts && parts[0] && parts[1]) {
      parts[0].textContent = status;
      parts[1].className = 'status-dot' + (thinking ? ' thinking' : '');
    }
  }
  
  function resetAgents() {
    setAgentStatus('brain', 'Idle'); 
    setAgentStatus('vision', 'Idle'); 
    setAgentStatus('heart', 'Idle'); 
    setAgentStatus('hands', 'Idle');
  }
  
  function enableButtons(enabled) {
    var btns = [processBtn, classifyBtn, detectBtn, enhanceBtn, upscaleBtn];
    for (var i = 0; i < btns.length; i++) {
      if (btns[i]) btns[i].disabled = !enabled;
    }
  }
  
  function sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }
  
  fileInput.addEventListener('change', function() {
    var file = fileInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Select an image file'); return; }
    
    state.file = file;
    fileName.textContent = file.name;
    fileSize.textContent = (file.size / 1024).toFixed(1) + ' KB';
    
    var reader = new FileReader();
    reader.onload = function(e) {
      state.image = e.target.result;
      previewImage.src = e.target.result;
      previewBox.classList.remove('hidden');
      var uploadLabel = document.querySelector('.upload-label');
      if (uploadLabel) uploadLabel.style.display = 'none';
      
      var img = new Image();
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
  
  processBtn.addEventListener('click', async function() {
    if (!state.imgEl) { log('No image loaded'); return; }
    
    enableButtons(false);
    progressContainer.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    resetAgents();
    log('Starting pipeline...');
    
    progressFill.style.width = '10%';
    progressText.textContent = 'Brain analyzing...';
    setAgentStatus('brain', 'Analyzing', true);
    await sleep(300);
    setAgentStatus('brain', 'Done');
    
    progressFill.style.width = '30%';
    progressText.textContent = 'Vision scanning...';
    setAgentStatus('vision', 'Scanning', true);
    await sleep(300);
    setAgentStatus('vision', 'Done');
    
    progressFill.style.width = '50%';
    progressText.textContent = 'Heart enhancing...';
    setAgentStatus('heart', 'Enhancing', true);
    
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = state.imgEl.width;
    canvas.height = state.imgEl.height;
    ctx.drawImage(state.imgEl, 0, 0);
    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var data = imageData.data;
    for (var i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, data[i] * 1.2);
      data[i+1] = Math.min(255, data[i+1] * 1.2);
      data[i+2] = Math.min(255, data[i+2] * 1.2);
    }
    ctx.putImageData(imageData, 0, 0);
    var enhanced = canvas.toDataURL('image/jpeg', 0.92);
    await sleep(300);
    setAgentStatus('heart', 'Done');
    
    progressFill.style.width = '75%';
    progressText.textContent = 'Hands upscaling...';
    setAgentStatus('hands', 'Upscaling', true);
    
    var upCanvas = document.createElement('canvas');
    var upCtx = upCanvas.getContext('2d');
    upCanvas.width = canvas.width * 2;
    upCanvas.height = canvas.height * 2;
    upCtx.imageSmoothingEnabled = true;
    upCtx.imageSmoothingQuality = 'high';
    upCtx.drawImage(canvas, 0, 0, upCanvas.width, upCanvas.height);
    var upscaled = upCanvas.toDataURL('image/png');
    await sleep(300);
    setAgentStatus('hands', 'Done');
    
    progressFill.style.width = '100%';
    progressText.textContent = 'Complete!';
    
    resultsContainer.innerHTML = '';
    var origCard = document.createElement('div');
    origCard.className = 'result-card';
    origCard.innerHTML = '<img src="' + state.image + '"><div class="result-label">📸 Original</div>';
    resultsContainer.appendChild(origCard);
    
    var enhCard = document.createElement('div');
    enhCard.className = 'result-card';
    enhCard.innerHTML = '<img src="' + enhanced + '"><div class="result-label">❤️ Enhanced</div><a href="' + enhanced + '" download="enhanced.jpg" class="result-download">Download</a>';
    resultsContainer.appendChild(enhCard);
    
    var upCard = document.createElement('div');
    upCard.className = 'result-card';
    upCard.innerHTML = '<img src="' + upscaled + '"><div class="result-label">👐 2x Upscaled</div><a href="' + upscaled + '" download="upscaled.png" class="result-download">Download</a>';
    resultsContainer.appendChild(upCard);
    
    resultsSection.classList.remove('hidden');
    setTimeout(function() { progressContainer.classList.add('hidden'); enableButtons(true); log('Pipeline complete'); }, 500);
  });
  
  clearBtn.addEventListener('click', function() {
    state.file = null; state.image = null; state.imgEl = null;
    fileInput.value = '';
    previewBox.classList.add('hidden');
    resultsSection.classList.add('hidden');
    var uploadLabel = document.querySelector('.upload-label');
    if (uploadLabel) uploadLabel.style.display = 'block';
    enableButtons(false);
    resetAgents();
    log('Cleared');
  });
  
  enhanceBtn.addEventListener('click', function() {
    if (!state.imgEl) return;
    setAgentStatus('heart', 'Enhancing', true);
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = state.imgEl.width;
    canvas.height = state.imgEl.height;
    ctx.drawImage(state.imgEl, 0, 0);
    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var data = imageData.data;
    for (var i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, data[i] * 1.2);
      data[i+1] = Math.min(255, data[i+1] * 1.2);
      data[i+2] = Math.min(255, data[i+2] * 1.2);
    }
    ctx.putImageData(imageData, 0, 0);
    var enhanced = canvas.toDataURL('image/jpeg', 0.92);
    resultsContainer.innerHTML = '<div class="result-card"><img src="' + state.image + '"><div class="result-label">📸 Original</div></div><div class="result-card"><img src="' + enhanced + '"><div class="result-label">❤️ Enhanced</div><a href="' + enhanced + '" download="enhanced.jpg" class="result-download">Download</a></div>';
    resultsSection.classList.remove('hidden');
    setAgentStatus('heart', 'Done');
    log('Heart: Enhanced');
  });
  
  upscaleBtn.addEventListener('click', function() {
    if (!state.imgEl) return;
    setAgentStatus('hands', 'Upscaling', true);
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = state.imgEl.width;
    canvas.height = state.imgEl.height;
    ctx.drawImage(state.imgEl, 0, 0);
    var upCanvas = document.createElement('canvas');
    var upCtx = upCanvas.getContext('2d');
    upCanvas.width = canvas.width * 2;
    upCanvas.height = canvas.height * 2;
    upCtx.imageSmoothingEnabled = true;
    upCtx.imageSmoothingQuality = 'high';
    upCtx.drawImage(canvas, 0, 0, upCanvas.width, upCanvas.height);
    var upscaled = upCanvas.toDataURL('image/png');
    resultsContainer.innerHTML = '<div class="result-card"><img src="' + state.image + '"><div class="result-label">📸 Original</div></div><div class="result-card"><img src="' + upscaled + '"><div class="result-label">👐 2x Upscaled</div><a href="' + upscaled + '" download="upscaled.png" class="result-download">Download</a></div>';
    resultsSection.classList.remove('hidden');
    setAgentStatus('hands', 'Done');
    log('Hands: Upscaled');
  });
  
  classifyBtn.addEventListener('click', function() {
    if (!state.imgEl) return;
    setAgentStatus('brain', 'Analyzing', true);
    setTimeout(function() {
      resultsContainer.innerHTML = '<div class="result-card"><div class="result-label">🧠 Analysis</div><div>Dimensions: ' + state.imgEl.width + ' × ' + state.imgEl.height + '</div></div>';
      resultsSection.classList.remove('hidden');
      setAgentStatus('brain', 'Done');
      log('Brain: Analyzed');
    }, 300);
  });
  
  detectBtn.addEventListener('click', function() {
    if (!state.imgEl) return;
    setAgentStatus('vision', 'Scanning', true);
    setTimeout(function() {
      resultsContainer.innerHTML = '<div class="result-card"><div class="result-label">👁️ Scan</div><div>Image structure analyzed</div></div>';
      resultsSection.classList.remove('hidden');
      setAgentStatus('vision', 'Done');
      log('Vision: Scanned');
    }, 300);
  });
  
  resetAgents();
  log('System ready');
})();
