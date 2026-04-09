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
    if (parts) {
      parts[0].textContent = status;
      parts[1].className = 'status-dot' + (thinking ? ' thinking' : '');
    }
  }
  
  function resetAgents() {
    setAgentStatus('brain', 'Idle'); setAgentStatus('vision', 'Idle'); setAgentStatus('heart', 'Idle'); setAgentStatus('hands', 'Idle');
  }
  
  function enableButtons(enabled) {
    var btns = [processBtn, classifyBtn, detectBtn, enhanceBtn, upscaleBtn];
    for (var i = 0; i < btns.length; i++) btns[i].disabled = !enabled;
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
  
  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
  
  processBtn.addEventListener('click', function() {
    if (!state.imgEl) return;
    enableButtons(false);
    progressContainer.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    resetAgents();
    log('Starting pipeline...');
    progressFill.style.width = '10%'; progressText.textContent = 'Brain analyzing...'; setAgentStatus('brain', 'Analyzing', true);
    sleep(600).then(function() {
      setAgentStatus('brain', 'Done'); progressFill.style.width = '25%'; progressText.textContent = 'Vision scanning...'; setAgentStatus('vision', 'Scanning', true);
      return sleep(500);
    }).then(function() {
      setAgentStatus('vision', 'Done'); progressFill.style.width = '40%'; progressText.textContent = 'Heart enhancing...'; setAgentStatus('heart', 'Enhancing', true);
      var canvas = document.createElement('canvas'); var ctx = canvas.getContext('2d');
      canvas.width = state.imgEl.width; canvas.height = state.imgEl.height; ctx.drawImage(state.imgEl, 0, 0);
      var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); var data = imageData.data;
      for (var i = 0; i < data.length; i += 4) { data[i] = Math.min(255, data[i] * 1.12); data[i+1] = Math.min(255, data[i+1] * 1.12); data[i+2] = Math.min(255, data[i+2] * 1.12); }
      ctx.putImageData(imageData, 0, 0); var enhanced = canvas.toDataURL('image/jpeg', 0.92);
      return sleep(500).then(function() { return enhanced; });
    }).then(function(enhanced) {
      setAgentStatus('heart', 'Done'); progressFill.style.width = '70%'; progressText.textContent = 'Hands upscaling...'; setAgentStatus('hands', 'Upscaling', true);
      var canvas = document.createElement('canvas'); var ctx = canvas.getContext('2d'); canvas.width = state.imgEl.width; canvas.height = state.imgEl.height; ctx.drawImage(state.imgEl, 0, 0);
      var upCanvas = document.createElement('canvas'); upCanvas.width = canvas.width * 2; upCanvas.height = canvas.height * 2;
      var upCtx = upCanvas.getContext('2d'); upCtx.imageSmoothingEnabled = true; upCtx.imageSmoothingQuality = 'high'; upCtx.drawImage(canvas, 0, 0, upCanvas.width, upCanvas.height);
      var upscaled = upCanvas.toDataURL('image/png');
      return sleep(600).then(function() { return { enhanced: enhanced, upscaled: upscaled }; });
    }).then(function(results) {
      setAgentStatus('hands', 'Done'); progressFill.style.width = '100%'; progressText.textContent = 'Complete!';
      resultsContainer.innerHTML = '<div class="result-card"><img src="' + state.image + '"><div class="result-label">📸 Original</div></div>' +
        '<div class="result-card"><img src="' + results.enhanced + '"><div class="result-label">❤️ Enhanced</div><a href="' + results.enhanced + '" download="enhanced.jpg" class="result-download">Download</a></div>' +
        '<div class="result-card"><img src="' + results.upscaled + '"><div class="result-label">👐 2x Upscale</div><a href="' + results.upscaled + '" download="upscaled.png" class="result-download">Download</a></div>';
      resultsSection.classList.remove('hidden'); log('Pipeline complete');
      setTimeout(function() { progressContainer.classList.add('hidden'); enableButtons(true); }, 1000);
    });
  });
  
  clearBtn.addEventListener('click', function() {
    state = { file: null, image: null, imgEl: null, logCount: state.logCount }; fileInput.value = ''; previewBox.classList.add('hidden');
    resultsSection.classList.add('hidden'); enableButtons(false); resetAgents(); log('Cleared');
  });
  
  classifyBtn.addEventListener('click', function() { log('Classification requested'); });
  detectBtn.addEventListener('click', function() { log('Detection requested'); });
  enhanceBtn.addEventListener('click', function() { log('Enhancement requested'); });
  upscaleBtn.addEventListener('click', function() { log('Upscaling requested'); });
  
  log('System ready');
})();
