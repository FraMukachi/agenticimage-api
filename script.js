(function() {
  "use strict";
  
  // ========== DOM ELEMENTS ==========
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
  
  // ========== STATE ==========
  let state = { 
    file: null, 
    image: null, 
    imgEl: null, 
    logCount: 0,
    modelsLoaded: false,
    models: {
      mobilenet: null,
      cocossd: null,
      swin2sr: null
    }
  };
  
  // ========== LOGGING ==========
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
    if (parts) {
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
  
  // ========== LOAD MODELS ==========
  async function loadModels() {
    log('Loading AI models...');
    setAgentStatus('brain', 'Loading', true);
    
    try {
      if (typeof mobilenet !== 'undefined') {
        state.models.mobilenet = await mobilenet.load();
        log('Brain: MobileNet loaded');
        setAgentStatus('brain', 'Ready');
      }
      
      if (typeof cocoSsd !== 'undefined') {
        state.models.cocossd = await cocoSsd.load();
        log('Vision: Coco SSD loaded');
        setAgentStatus('vision', 'Ready');
      }
      
      if (typeof window.Transformers !== 'undefined') {
        var pipeline = window.Transformers.pipeline;
        state.models.swin2sr = await pipeline('image-to-image', 'Xenova/swin2sr-classical-sr-x2-64');
        log('Hands: Swin2SR loaded');
        setAgentStatus('hands', 'Ready');
      }
      
      setAgentStatus('heart', 'Ready');
      state.modelsLoaded = true;
      log('All models ready');
      
    } catch (error) {
      log('Model load error: ' + error.message);
      console.error(error);
    }
  }
  
  loadModels();
  
  // ========== FILE HANDLING (FIXED) ==========
  fileInput.addEventListener('change', function(event) {
    console.log('File input changed');
    
    var file = fileInput.files[0];
    if (!file) {
      console.log('No file selected');
      return;
    }
    
    console.log('File selected:', file.name, file.type, file.size);
    
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, WEBP)');
      return;
    }
    
    state.file = file;
    fileName.textContent = file.name;
    fileSize.textContent = (file.size / 1024).toFixed(1) + ' KB';
    
    var reader = new FileReader();
    
    reader.onload = function(e) {
      console.log('FileReader loaded');
      
      state.image = e.target.result;
      previewImage.src = e.target.result;
      previewBox.classList.remove('hidden');
      
      // Also hide the upload zone when preview is shown
      var uploadLabel = document.querySelector('.upload-label');
      if (uploadLabel) uploadLabel.style.display = 'none';
      
      var img = new Image();
      img.onload = function() {
        console.log('Image loaded:', img.width, 'x', img.height);
        state.imgEl = img;
        fileDimensions.textContent = img.width + ' × ' + img.height;
        enableButtons(true);
        log('Image loaded: ' + img.width + '×' + img.height);
      };
      
      img.onerror = function() {
        console.error('Failed to load image');
        log('Error: Failed to load image');
      };
      
      img.src = e.target.result;
    };
    
    reader.onerror = function() {
      console.error('FileReader error');
      log('Error: Failed to read file');
    };
    
    reader.readAsDataURL(file);
  });
  
  // ========== CLEAR ==========
  clearBtn.addEventListener('click', function() {
    state.file = null;
    state.image = null;
    state.imgEl = null;
    fileInput.value = '';
    previewBox.classList.add('hidden');
    resultsSection.classList.add('hidden');
    
    var uploadLabel = document.querySelector('.upload-label');
    if (uploadLabel) uploadLabel.style.display = 'block';
    
    enableButtons(false);
    resetAgents();
    log('Cleared');
  });
  
  // ========== ENHANCE (Works immediately) ==========
  enhanceBtn.addEventListener('click', function() {
    if (!state.imgEl) {
      log('No image loaded');
      return;
    }
    
    setAgentStatus('heart', 'Enhancing...', true);
    log('Heart: Enhancing image...');
    enhanceBtn.disabled = true;
    
    setTimeout(function() {
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      canvas.width = state.imgEl.width;
      canvas.height = state.imgEl.height;
      ctx.drawImage(state.imgEl, 0, 0);
      
      var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var data = imageData.data;
      for (var i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] * 1.15);
        data[i+1] = Math.min(255, data[i+1] * 1.15);
        data[i+2] = Math.min(255, data[i+2] * 1.15);
      }
      ctx.putImageData(imageData, 0, 0);
      var enhanced = canvas.toDataURL('image/jpeg', 0.92);
      
      resultsContainer.innerHTML = '<div class="result-card"><img src="' + state.image + '"><div class="result-label">📸 Original</div></div>' +
                                   '<div class="result-card"><img src="' + enhanced + '"><div class="result-label">❤️ Enhanced</div>' +
                                   '<a href="' + enhanced + '" download="enhanced.jpg" class="result-download">Download</a></div>';
      resultsSection.classList.remove('hidden');
      
      setAgentStatus('heart', 'Done');
      enhanceBtn.disabled = false;
      log('Heart: Enhancement complete');
    }, 100);
  });
  
  // ========== UPSCALE ==========
  upscaleBtn.addEventListener('click', function() {
    if (!state.imgEl) {
      log('No image loaded');
      return;
    }
    
    setAgentStatus('hands', 'Upscaling...', true);
    log('Hands: Upscaling image...');
    upscaleBtn.disabled = true;
    
    setTimeout(function() {
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      canvas.width = state.imgEl.width;
      canvas.height = state.imgEl.height;
      ctx.drawImage(state.imgEl, 0, 0);
      
      var upCanvas = document.createElement('canvas');
      upCanvas.width = canvas.width * 2;
      upCanvas.height = canvas.height * 2;
      var upCtx = upCanvas.getContext('2d');
      upCtx.imageSmoothingEnabled = true;
      upCtx.imageSmoothingQuality = 'high';
      upCtx.drawImage(canvas, 0, 0, upCanvas.width, upCanvas.height);
      var upscaled = upCanvas.toDataURL('image/png');
      
      resultsContainer.innerHTML = '<div class="result-card"><img src="' + state.image + '"><div class="result-label">📸 Original</div></div>' +
                                   '<div class="result-card"><img src="' + upscaled + '"><div class="result-label">👐 2x Upscaled</div>' +
                                   '<a href="' + upscaled + '" download="upscaled.png" class="result-download">Download</a></div>';
      resultsSection.classList.remove('hidden');
      
      setAgentStatus('hands', 'Done');
      upscaleBtn.disabled = false;
      log('Hands: Upscale complete');
    }, 100);
  });
  
  // ========== CLASSIFY ==========
  classifyBtn.addEventListener('click', async function() {
    if (!state.imgEl) {
      log('No image loaded');
      return;
    }
    
    if (!state.models.mobilenet) {
      log('Brain: Model not loaded yet');
      return;
    }
    
    setAgentStatus('brain', 'Classifying...', true);
    classifyBtn.disabled = true;
    
    try {
      var predictions = await state.models.mobilenet.classify(state.imgEl);
      var html = '<div class="result-card"><div class="result-label">🧠 Classification</div>';
      for (var i = 0; i < Math.min(predictions.length, 5); i++) {
        html += '<div style="display: flex; justify-content: space-between; padding: 8px 0;">' +
                '<span>' + predictions[i].className + '</span>' +
                '<span style="color: #059669;">' + (predictions[i].probability * 100).toFixed(1) + '%</span></div>';
      }
      html += '</div>';
      resultsContainer.innerHTML = html;
      resultsSection.classList.remove('hidden');
      
      log('Brain: ' + predictions[0].className + ' (' + (predictions[0].probability * 100).toFixed(1) + '%)');
      setAgentStatus('brain', 'Done');
    } catch (error) {
      log('Brain: Error - ' + error.message);
      setAgentStatus('brain', 'Error');
    } finally {
      classifyBtn.disabled = false;
    }
  });
  
  // ========== DETECT ==========
  detectBtn.addEventListener('click', async function() {
    if (!state.imgEl) {
      log('No image loaded');
      return;
    }
    
    if (!state.models.cocossd) {
      log('Vision: Model not loaded yet');
      return;
    }
    
    setAgentStatus('vision', 'Detecting...', true);
    detectBtn.disabled = true;
    
    try {
      var predictions = await state.models.cocossd.detect(state.imgEl);
      
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      canvas.width = state.imgEl.width;
      canvas.height = state.imgEl.height;
      ctx.drawImage(state.imgEl, 0, 0);
      
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.font = 'bold 16px -apple-system, sans-serif';
      ctx.fillStyle = '#3b82f6';
      
      for (var i = 0; i < predictions.length; i++) {
        var bbox = predictions[i].bbox;
        ctx.strokeRect(bbox[0], bbox[1], bbox[2], bbox[3]);
        ctx.fillText(predictions[i].class + ' ' + Math.round(predictions[i].score * 100) + '%', 
                     bbox[0], bbox[1] - 5);
      }
      
      var detectionUrl = canvas.toDataURL('image/png');
      
      var html = '<div class="result-card"><div class="result-label">👁️ Object Detection</div>' +
                 '<img src="' + detectionUrl + '" alt="Detection">' +
                 '<p style="margin-top: 12px;">Detected ' + predictions.length + ' objects</p>' +
                 '<a href="' + detectionUrl + '" download="detection.png" class="result-download">Download</a></div>';
      resultsContainer.innerHTML = html;
      resultsSection.classList.remove('hidden');
      
      log('Vision: Detected ' + predictions.length + ' objects');
      setAgentStatus('vision', 'Done');
    } catch (error) {
      log('Vision: Error - ' + error.message);
      setAgentStatus('vision', 'Error');
    } finally {
      detectBtn.disabled = false;
    }
  });
  
  // ========== FULL PIPELINE ==========
  processBtn.addEventListener('click', async function() {
    if (!state.imgEl) {
      log('No image loaded');
      return;
    }
    
    enableButtons(false);
    progressContainer.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    resetAgents();
    
    progressFill.style.width = '10%';
    progressText.textContent = 'Processing...';
    
    setTimeout(async function() {
      progressFill.style.width = '30%';
      
      // Enhance
      setAgentStatus('heart', 'Enhancing', true);
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      canvas.width = state.imgEl.width;
      canvas.height = state.imgEl.height;
      ctx.drawImage(state.imgEl, 0, 0);
      
      var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var data = imageData.data;
      for (var i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] * 1.15);
        data[i+1] = Math.min(255, data[i+1] * 1.15);
        data[i+2] = Math.min(255, data[i+2] * 1.15);
      }
      ctx.putImageData(imageData, 0, 0);
      var enhanced = canvas.toDataURL('image/jpeg', 0.92);
      setAgentStatus('heart', 'Done');
      
      progressFill.style.width = '60%';
      
      // Upscale
      setAgentStatus('hands', 'Upscaling', true);
      var upCanvas = document.createElement('canvas');
      upCanvas.width = canvas.width * 2;
      upCanvas.height = canvas.height * 2;
      var upCtx = upCanvas.getContext('2d');
      upCtx.imageSmoothingEnabled = true;
      upCtx.imageSmoothingQuality = 'high';
      upCtx.drawImage(canvas, 0, 0, upCanvas.width, upCanvas.height);
      var upscaled = upCanvas.toDataURL('image/png');
      setAgentStatus('hands', 'Done');
      
      progressFill.style.width = '100%';
      progressText.textContent = 'Complete!';
      
      resultsContainer.innerHTML = '<div class="result-card"><img src="' + state.image + '"><div class="result-label">📸 Original</div></div>' +
                                   '<div class="result-card"><img src="' + enhanced + '"><div class="result-label">❤️ Enhanced</div>' +
                                   '<a href="' + enhanced + '" download="enhanced.jpg" class="result-download">Download</a></div>' +
                                   '<div class="result-card"><img src="' + upscaled + '"><div class="result-label">👐 2x Upscaled</div>' +
                                   '<a href="' + upscaled + '" download="upscaled.png" class="result-download">Download</a></div>';
      resultsSection.classList.remove('hidden');
      
      progressContainer.classList.add('hidden');
      enableButtons(true);
      log('Pipeline complete');
    }, 200);
  });
  
  log('System ready');
})();
