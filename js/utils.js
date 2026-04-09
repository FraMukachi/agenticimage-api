// ============================================
// UTILITY FUNCTIONS
// ============================================

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export function getFormattedTime() {
  return new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', minute: '2-digit', second: '2-digit' 
  });
}

export function isValidImageFile(file) {
  return file && file.type.startsWith('image/');
}
