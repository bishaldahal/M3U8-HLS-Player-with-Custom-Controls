/**
 * HLS Video Player - Keyboard Shortcuts
 * Handles all keyboard interactions and shortcuts documentation
 */

// Keyboard shortcut definitions
const SHORTCUTS = [
  { key: '<', description: 'Decrease playback speed by 0.1' },
  { key: '>', description: 'Increase playback speed by 0.1' },
  { key: '-', description: 'Decrease playback speed by 0.5' },
  { key: '+', description: 'Increase playback speed by 0.5' },
  { key: 'ArrowDown (↓)', description: 'Decrease volume by 0.1' },
  { key: 'ArrowUp (↑)', description: 'Increase volume by 0.1' },
  { key: 'ArrowLeft (←)', description: 'Seek backward 10 seconds' },
  { key: 'ArrowRight (→)', description: 'Seek forward 10 seconds' },
  { key: 'p', description: 'Request Picture in Picture' },
  { key: 'P', description: 'Exit Picture in Picture' },
  { key: 'j', description: 'Seek backward 5 seconds' },
  { key: 'Space / k', description: 'Toggle play/pause' },
  { key: 'l', description: 'Seek forward 5 seconds' },
  { key: ',', description: 'Previous frame' },
  { key: '.', description: 'Next frame' },
  { key: 'Home', description: 'Seek to the beginning of the video' },
  { key: 'End', description: 'Seek to the end of the video' },
  { key: '0-9', description: 'Seek to a percentage of the video' },
  { key: 'Esc', description: 'Close keyboard shortcuts' },
  { key: '?', description: 'Toggle keyboard shortcuts' },
  { key: 'f', description: 'Toggle fullscreen' },
  { key: 'm', description: 'Toggle mute' },
];

// Number key to percentage mapping
const KEY_TO_PERCENTAGE = {
  0: 0.0, 1: 0.1, 2: 0.2, 3: 0.3, 4: 0.4,
  5: 0.5, 6: 0.6, 7: 0.7, 8: 0.8, 9: 0.9,
};

/**
 * Generate HTML documentation for keyboard shortcuts
 * @param {Array} shortcuts - Array of shortcut definitions
 * @returns {HTMLElement} - UL element containing shortcuts
 */
function generateShortcutsDocumentation(shortcuts) {
  const shortcutsList = document.createElement('ul');
  
  shortcuts.forEach((shortcut) => {
    const li = document.createElement('li');
    const code = document.createElement('code');
    
    const keyBinding = document.createElement('span');
    keyBinding.className = 'key-binding';
    
    const key = document.createElement('span');
    key.className = 'key';
    key.textContent = shortcut.key;
    
    keyBinding.appendChild(key);
    code.appendChild(keyBinding);
    code.insertAdjacentText('beforeend', ` ${shortcut.description}`);
    li.appendChild(code);
    shortcutsList.appendChild(li);
  });
  
  return shortcutsList;
}

/**
 * Handle number key seeking (0-9)
 * @param {string} key - The pressed key
 */
function handleNumberKeySeek(key) {
  if (!Object.prototype.hasOwnProperty.call(KEY_TO_PERCENTAGE, key)) return;
  
  const percentage = KEY_TO_PERCENTAGE[key];
  
  if (mediastreamtype !== 'live') {
    video.currentTime = video.duration * percentage;
    return;
  }
  
  // Handle live stream seeking within buffer
  for (let i = 0; i < video.buffered.length; i++) {
    if (video.currentTime >= video.buffered.start(i) && 
        video.currentTime <= video.buffered.end(i)) {
      const bufferTime = video.buffered.end(i) - video.buffered.start(i);
      if (bufferTime > 0) {
        video.currentTime = video.buffered.start(i) + bufferTime * percentage;
      }
      break;
    }
  }
}

/**
 * Handle playback speed changes
 * @param {string} key - The pressed key
 */
function handlePlaybackSpeed(key) {
  const isIncrease = key === '>' || key === '+';
  const delta = (key === '>' || key === '<') ? 0.1 : 0.5;
  
  let newRate;
  if (isIncrease) {
    if (video.playbackRate === 0.1 && key === '+') {
      newRate = 0.5;
    } else {
      newRate = video.playbackRate + delta;
    }
    newRate = Math.min(Math.round(newRate * 100) / 100, 10.0);
  } else {
    newRate = video.playbackRate - delta;
    newRate = Math.max(Math.round(newRate * 100) / 100, 0.1);
  }
  
  video.playbackRate = newRate;
}

/**
 * Handle frame-by-frame navigation
 * @param {string} key - The pressed key (',' or '.')
 */
function handleFrameStep(key) {
  const frameRate = 48; // Assumed frame rate
  const frameDelta = key === ',' ? -1 / frameRate : 1 / frameRate;
  
  video.pause();
  video.currentTime = resumePosition;
  video.currentTime += frameDelta;
  resumePosition = video.currentTime;
}

/**
 * Setup keyboard event handlers
 */
function setupKeyboardHandlers() {
  const modal = document.getElementById('keyboard-shortcuts');
  const closeButton = document.getElementById('close-shortcuts');
  
  // Global keyboard handler for modal
  document.addEventListener('keydown', (event) => {
    if (event.key === '?') {
      modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
    }
    if (event.key === 'Escape') {
      modal.style.display = 'none';
    }
    focusVideo();
  });
  
  // Close button handler
  closeButton.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  // Double-click fullscreen toggle
  player.addEventListener('dblclick', () => {
    if (!document.fullscreenElement) {
      player.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  });
  
  // Player keyboard controls
  player.addEventListener('keydown', (event) => {
    // Ignore if modifier keys are pressed
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    
    // Handle number keys for seeking
    handleNumberKeySeek(event.key);
    
    switch (event.key) {
      case '>':
      case '+':
      case '<':
      case '-':
        handlePlaybackSpeed(event.key);
        break;
        
      case 'ArrowUp':
        video.volume = Math.min(video.volume + 0.1, 1.0);
        break;
        
      case 'ArrowDown':
        video.volume = Math.max(video.volume - 0.1, 0.0);
        break;
        
      case 'p':
        video.requestPictureInPicture?.();
        break;
        
      case 'P':
        document.exitPictureInPicture?.();
        break;
        
      case 'J':
      case 'j':
        event.preventDefault();
        video.currentTime -= 5;
        resumePosition = video.currentTime;
        break;
        
      case 'L':
      case 'l':
        event.preventDefault();
        video.currentTime += 5;
        resumePosition = video.currentTime;
        break;
        
      case ',':
      case '.':
        handleFrameStep(event.key);
        break;
        
      case 'Home':
        video.currentTime = 0;
        break;
        
      case 'End':
        if (mediastreamtype !== 'live') {
          video.currentTime = video.duration;
        } else if (video.buffered.length > 0) {
          video.currentTime = video.buffered.end(video.buffered.length - 1);
        }
        break;
    }
  });
}

/**
 * Initialize shortcuts module
 */
function initShortcuts() {
  // Generate and append shortcuts documentation
  const shortcutsContainer = document.getElementById('keyboard-shortcuts');
  if (shortcutsContainer) {
    shortcutsContainer.appendChild(generateShortcutsDocumentation(SHORTCUTS));
  }
  
  // Setup keyboard handlers (wait for player to be ready)
  if (player && video) {
    setupKeyboardHandlers();
  } else {
    // Wait for player initialization
    const checkInterval = setInterval(() => {
      if (player && video) {
        clearInterval(checkInterval);
        setupKeyboardHandlers();
      }
    }, 100);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initShortcuts);
} else {
  initShortcuts();
}
