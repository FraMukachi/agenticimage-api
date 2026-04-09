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
  const modelStatusSpan = document.getElementById('modelStatus');
  
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
  
  // ========== LOAD REAL AI MODELS ==========
  async function loadModels() {
    log('Loading TensorFlow.js models...');
    setAgentStatus('brain', 'Loading', true);
    
    try {
      // Load MobileNet for classification (Brain Agent) [citation:2][citation:7]
      log('Brain: Loading MobileNet...');
      state.models.mobilenet = await mobilenet.load();
      log('Brain: MobileNet loaded ✓');
      setAgentStatus('brain', 'Ready');
      
      // Load Coco SSD for object detection (Vision Agent) [citation:2]
      log('Vision: Loading Coco SSD...');
      state.models.cocossd = await cocoSsd.load();
      log('Vision: Coco SSD loaded ✓');
      setAgentStatus('vision', 'Ready');
      
      // Load Swin2SR via Transformers.js (Hands Agent) [citation:3][citation:5]
      log('Hands: Loading Swin2SR upscaler...');
      const { pipeline } = window.Transformers;
      state.models.swin2sr = await pipeline('image-to-image', 'Xenova/swin2sr-classical-sr-x2-64', {
        device: 'wasm',
        progress_callback: function(progress) {
          if (progress.status === 'progress') {
            var percent = Math.round((progress.loaded / progress.total) * 100);
            setAgentStatus('hands', 'Loading ' + percent + '%', true);
          }
        }
      });
      log('Hands: Swin2SR loaded ✓');
      setAgentStatus('hands', 'Ready');
      
      setAgentStatus('heart', 'Ready'); // Heart uses canvas processing
      
      state.modelsLoaded = true;
      if (modelStatusSpan) modelStatusSpan.textContent = '✅ All models ready';
      log('All AI models loaded successfully!');
      
    } catch (error) {
      log('Error loading models: ' + error.message);
      console.error('Model loading error:', error);
      setAgentStatus('brain', 'Error');
      setAgentStatus('vision', 'Error');
      setAgentStatus('hands', 'Error');
    }
  }
  
  // Start loading models immediately
  loadModels();
  
  // ========== FILE HANDLING ==========
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
  
  // ========== BRAIN AGENT: Real Classification ==========
  classifyBtn.addEventListener('click', async function() {
    if (!state.imgEl || !state.models.mobilenet) {
      log('Brain: Model not ready');
      return;
    }
    
    setAgentStatus('brain', 'Classifying...', true);
    log('Brain: Running MobileNet classification...');
    classifyBtn.disabled = true;
    
    try {
      // Real MobileNet classification [citation:2][citation:7]
      const predictions = await state.models.mobilenet.classify(state.imgEl);
      
      log('Brain: Top prediction: ' + predictions[0].className + ' (' + 
          (predictions[0].probability * 100).toFixed(1) + '%)');
      
      // Display results
      var html = '<div class="result-card"><div class="result-label">🧠 Brain: Classification</div>';
      predictions.slice(0, 3).forEach(function(p) {
        html += '<div style="display: flex; justify-content: space-between; padding: 8px 0;">' +
                '<span>' + p.className + '</span>' +
                '<span style="color: #059669;">' + (p.probability * 100).toFixed(1) + '%</span></div>';
      });
      html += '</div>';
      
      resultsContainer.innerHTML = html;
      resultsSection.classList.remove('hidden');
      setAgentStatus('brain', 'Done');
      
    } catch (error) {
      log('Brain: Classification failed - ' + error.message);
      setAgentStatus('brain', 'Error');
    } finally {
      classifyBtn.disabled = false;
    }
  });
  
  // ========== VISION AGENT: Real Object Detection ==========
  detectBtn.addEventListener('click', async function() {
    if (!state.imgEl || !state.models.cocossd) {
      log('Vision: Model not ready');
      return;
    }
    
    setAgentStatus('vision', 'Detecting...', true);
    log('Vision: Running Coco SSD detection...');
    detectBtn.disabled = true;
    
    try {
      // Real Coco SSD object detection [citation:2]
      const predictions = await state.models.cocossd.detect(state.imgEl);
      
      log('Vision: Detected ' + predictions.length + ' objects');
      
      // Draw bounding boxes on canvas
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      canvas.width = state.imgEl.width;
      canvas.height = state.imgEl.height;
      ctx.drawImage(state.imgEl, 0, 0);
      
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.font = 'bold 16px -apple-system, sans-serif';
      ctx.fillStyle = '#3b82f6';
      
      predictions.forEach(function(pred) {
        var bbox = pred.bbox;
        ctx.strokeRect(bbox[0], bbox[1], bbox[2], bbox[3]);
        ctx.fillText(pred.class + ' ' + Math.round(pred.score * 100) + '%', 
                     bbox[0], bbox[1] - 5);
        log('Vision: ' + pred.class + ' (' + Math.round(pred.score * 100) + '%)');
      });
      
      var detectionUrl = canvas.toDataURL('image/png');
      
      var html = '<div class="result-card">' +
                 '<div class="result-label">👁️ Vision: Object Detection</div>' +
                 '<img src="' + detectionUrl + '" alt="Detection">' +
                 '<p style="margin-top: 12px;">Detected ' + predictions.length + ' objects</p>' +
                 '<a href="' + detectionUrl + '" download="detection.png" class="result-download">Download</a></div>';
      
      resultsContainer.innerHTML = html;
      resultsSection.classList.remove('hidden');
      setAgentStatus('vision', 'Done');
      
    } catch (error) {
      log('Vision: Detection failed - ' + error.message);
      setAgentStatus('vision', 'Error');
    } finally {
      detectBtn.disabled = false;
    }
  });
  
  // ========== HEART AGENT: Canvas Enhancement ==========
  enhanceBtn.addEventListener('click', async function() {
    if (!state.imgEl) return;
    
    setAgentStatus('heart', 'Enhancing...', true);
    log('Heart: Applying color enhancement...');
    enhanceBtn.disabled = true;
    
    await sleep(300);
    
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = state.imgEl.width;
    canvas.height = state.imgEl.height;
    ctx.drawImage(state.imgEl, 0, 0);
    
    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var data = imageData.data;
    for (var i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, data[i] * 1.12);
      data[i+1] = Math.min(255, data[i+1] * 1.12);
      data[i+2] = Math.min(255, data[i+2] * 1.12);
    }
    ctx.putImageData(imageData, 0, 0);
    var enhanced = canvas.toDataURL('image/jpeg', 0.92);
    
    var html = '<div class="result-card"><img src="' + state.image + '"><div class="result-label">📸 Original</div></div>' +
               '<div class="result-card"><img src="' + enhanced + '"><div class="result-label">❤️ Heart: Enhanced</div>' +
               '<a href="' + enhanced + '" download="enhanced.jpg" class="result-download">Download</a></div>';
    
    resultsContainer.innerHTML = html;
    resultsSection.classList.remove('hidden');
    
    log('Heart: Enhancement complete');
    setAgentStatus('heart', 'Done');
    enhanceBtn.disabled = false;
  });
  
  // ========== HANDS AGENT: Real Swin2SR Upscaling ==========
  upscaleBtn.addEventListener('click', async function() {
    if (!state.imgEl) return;
    if (!state.models.swin2sr) {
      log('Hands: Swin2SR model not loaded yet');
      return;
    }
    
    setAgentStatus('hands', 'Upscaling...', true);
    log('Hands: Running Swin2SR 2x upscaling...');
    upscaleBtn.disabled = true;
    
    progressContainer.classList.remove('hidden');
    progressFill.style.width = '30%';
    progressText.textContent = 'Hands: AI upscaling...';
    
    try {
      // Create canvas from image
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      canvas.width = state.imgEl.width;
      canvas.height = state.imgEl.height;
      ctx.drawImage(state.imgEl, 0, 0);
      
      progressFill.style.width = '50%';
      
      // Real Swin2SR upscaling via Transformers.js [citation:3][citation:5]
      const dataUrl = canvas.toDataURL('image/png');
      const result = await state.models.swin2sr(dataUrl);
      
      progressFill.style.width = '90%';
      
      // Create image from result
      const upscaledImg = new Image();
      await new Promise(function(resolve) {
        upscaledImg.onload = resolve;
        upscaledImg.src = result;
      });
      
      var upCanvas = document.createElement('canvas');
      upCanvas.width = upscaledImg.width;
      upCanvas.height = upscaledImg.height;
      var upCtx = upCanvas.getContext('2d');
      upCtx.drawImage(upscaledImg, 0, 0);
      var upscaled = upCanvas.toDataURL('image/png');
      
      progressFill.style.width = '100%';
      progressText.textContent = 'Complete!';
      
      var html = '<div class="result-card"><img src="' + state.image + '"><div class="result-label">📸 Original</div></div>' +
                 '<div class="result-card"><img src="' + upscaled + '"><div class="result-label">👐 Hands: Swin2SR 2x Upscale</div>' +
                 '<a href="' + upscaled + '" download="upscaled.png" class="result-download">Download PNG</a></div>';
      
      resultsContainer.innerHTML = html;
      resultsSection.classList.remove('hidden');
      
      log('Hands: Swin2SR upscaling complete (' + upCanvas.width + '×' + upCanvas.height + ')');
      setAgentStatus('hands', 'Done');
      
    } catch (error) {
      log('Hands: AI upscaling failed - ' + error.message);
      log('Hands: Falling back to canvas upscaling...');
      
      // Fallback: Canvas-based upscaling
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
      
      var html = '<div class="result-card"><img src="' + state.image + '"><div class="result-label">📸 Original</div></div>' +
                 '<div class="result-card"><img src="' + upscaled + '"><div class="result-label">👐 Hands: 2x Upscale (Canvas)</div>' +
                 '<a href="' + upscaled + '" download="upscaled.png" class="result-download">Download PNG</a></div>';
      
      resultsContainer.innerHTML = html;
      resultsSection.classList.remove('hidden');
      
      setAgentStatus('hands', 'Done (fallback)');
    } finally {
      progressContainer.classList.add('hidden');
      upscaleBtn.disabled = false;
    }
  });
  
  // ========== FULL PIPELINE ==========
  processBtn.addEventListener('click', async function() {
    if (!state.imgEl) return;
    
    enableButtons(false);
    progressContainer.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    resetAgents();
    log('Starting full AI pipeline...');
    
    var results = { image: state.image };
    
    try {
      // Step 1: Brain - Classification
      if (state.models.mobilenet) {
        progressFill.style.width = '10%';
        progressText.textContent = 'Brain: Classifying...';
        setAgentStatus('brain', 'Classifying', true);
        
        const predictions = await state.models.mobilenet.classify(state.imgEl);
        results.classification = predictions;
        log('Brain: ' + predictions[0].className + ' (' + (predictions[0].probability * 100).toFixed(1) + '%)');
        setAgentStatus('brain', 'Done');
      }
      
      // Step 2: Vision - Detection
      if (state.models.cocossd) {
        progressFill.style.width = '30%';
        progressText.textContent = 'Vision: Detecting objects...';
        setAgentStatus('vision', 'Detecting', true);
        
        const predictions = await state.models.cocossd.detect(state.imgEl);
        results.detection = predictions;
        log('Vision: Detected ' + predictions.length + ' objects');
        setAgentStatus('vision', 'Done');
      }
      
      // Step 3: Heart - Enhancement
      progressFill.style.width = '50%';
      progressText.textContent = 'Heart: Enhancing...';
      setAgentStatus('heart', 'Enhancing', true);
      
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      canvas.width = state.imgEl.width;
      canvas.height = state.imgEl.height;
      ctx.drawImage(state.imgEl, 0, 0);
      
      var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var data = imageData.data;
      for (var i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] * 1.12);
        data[i+1] = Math.min(255, data[i+1] * 1.12);
        data[i+2] = Math.min(255, data[i+2] * 1.12);
      }
      ctx.putImageData(imageData, 0, 0);
      results.enhanced = canvas.toDataURL('image/jpeg', 0.92);
      
      setAgentStatus('heart', 'Done');
      log('Heart: Enhancement complete');
      
      // Step 4: Hands - Upscaling
      progressFill.style.width = '70%';
      progressText.textContent = 'Hands: AI upscaling...';
      setAgentStatus('hands', 'Upscaling', true);
      
      if (state.models.swin2sr) {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          const result = await state.models.swin2sr(dataUrl);
          
          const upscaledImg = new Image();
          await new Promise(function(r) { upscaledImg.onload = r; upscaledImg.src = result; });
          
          var upCanvas = document.createElement('canvas');
          upCanvas.width = upscaledImg.width;
          upCanvas.height = upscaledImg.height;
          upCanvas.getContext('2d').drawImage(upscaledImg, 0, 0);
          results.upscaled = upCanvas.toDataURL('image/png');
          log('Hands: Swin2SR upscaling complete');
        } catch (e) {
          // Fallback
          var upCanvas = document.createElement('canvas');
          upCanvas.width = canvas.width * 2;
          upCanvas.height = canvas.height * 2;
          var upCtx = upCanvas.getContext('2d');
          upCtx.imageSmoothingEnabled = true;
          upCtx.imageSmoothingQuality = 'high';
          upCtx.drawImage(canvas, 0, 0, upCanvas.width, upCanvas.height);
          results.upscaled = upCanvas.toDataURL('image/png');
        }
      }
      
      setAgentStatus('hands', 'Done');
      progressFill.style.width = '100%';
      progressText.textContent = 'Complete!';
      
      // Display results
      var html = '';
      if (results.classification) {
        html += '<div class="result-card"><div class="result-label">🧠 Brain: Classification</div>';
        results.classification.slice(0, 3).forEach(function(p) {
          html += '<div style="display: flex; justify-content: space-between;">' +
                  '<span>' + p.className + '</span><span>' + (p.probability * 100).toFixed(1) + '%</span></div>';
        });
        html += '</div>';
      }
      
      html += '<div class="result-card"><img src="' + state.image + '"><div class="result-label">📸 Original</div></div>';
      html += '<div class="result-card"><img src="' + results.enhanced + '"><div class="result-label">❤️ Heart: Enhanced</div>' +
              '<a href="' + results.enhanced + '" download="enhanced.jpg" class="result-download">Download</a></div>';
      html += '<div class="result-card"><img src="' + results.upscaled + 
