/**
 * HLS Video Player - Keyboard Shortcuts
 * Handles all keyboard interactions and shortcuts documentation
 */

// Keyboard shortcut definitions organized by category
const SHORTCUTS_BY_CATEGORY = {
  'Playback Control': [
    { key: 'Space / k', description: 'Toggle play/pause' },
    { key: 'Home', description: 'Seek to the beginning' },
    { key: 'End', description: 'Seek to the end' },
    { key: '0-9', description: 'Seek to percentage (0%-90%)' },
  ],
  'Navigation': [
    { key: 'ArrowLeft (←)', description: 'Seek backward 10 seconds' },
    { key: 'ArrowRight (→)', description: 'Seek forward 10 seconds' },
    { key: 'j', description: 'Seek backward 5 seconds' },
    { key: 'l', description: 'Seek forward 5 seconds' },
  ],
  'Playback Speed': [
    { key: '<', description: 'Decrease speed by 0.1' },
    { key: '>', description: 'Increase speed by 0.1' },
    { key: '-', description: 'Decrease speed by 0.5' },
    { key: '+', description: 'Increase speed by 0.5' },
  ],
  'Volume Control': [
    { key: 'ArrowUp (↑)', description: 'Increase volume by 0.1' },
    { key: 'ArrowDown (↓)', description: 'Decrease volume by 0.1' },
    { key: 'm', description: 'Toggle mute' },
  ],
  'Frame Navigation': [
    { key: ',', description: 'Previous frame' },
    { key: '.', description: 'Next frame' },
  ],
  'View Controls': [
    { key: 'f', description: 'Toggle fullscreen' },
    { key: 'p', description: 'Enter Picture in Picture' },
    { key: 'P', description: 'Exit Picture in Picture' },
    { key: '?', description: 'Toggle keyboard shortcuts' },
    { key: 'Esc', description: 'Close shortcuts panel' },
  ],
};

// Legacy flat array for backward compatibility
const SHORTCUTS = Object.values(SHORTCUTS_BY_CATEGORY).flat();

// Number key to percentage mapping
const KEY_TO_PERCENTAGE = {
  0: 0.0, 1: 0.1, 2: 0.2, 3: 0.3, 4: 0.4,
  5: 0.5, 6: 0.6, 7: 0.7, 8: 0.8, 9: 0.9,
};

/**
 * Generate HTML documentation for keyboard shortcuts with categories
 * @param {Object} shortcutsByCategory - Object with categories as keys and shortcuts arrays as values
 * @returns {HTMLElement} - Container element with categorized shortcuts
 */
function generateShortcutsDocumentation(shortcutsByCategory) {
  const container = document.createElement('div');
  
  Object.entries(shortcutsByCategory).forEach(([category, shortcuts]) => {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'shortcuts-category';
    categoryDiv.dataset.category = category;
    
    const categoryTitle = document.createElement('h3');
    categoryTitle.className = 'category-title';
    categoryTitle.textContent = category;
    categoryDiv.appendChild(categoryTitle);
    
    const shortcutsList = document.createElement('ul');
    // Use full-width for categories with 2 or fewer items
    if (shortcuts.length <= 2) {
      shortcutsList.className = 'full-width';
    }
    
    shortcuts.forEach((shortcut) => {
      const li = document.createElement('li');
      li.dataset.searchText = `${shortcut.key} ${shortcut.description}`.toLowerCase();
      
      const code = document.createElement('code');
      
      const descSpan = document.createElement('span');
      descSpan.className = 'shortcut-desc';
      descSpan.textContent = shortcut.description;
      
      const keyBinding = document.createElement('span');
      keyBinding.className = 'key-binding';
      
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = shortcut.key;
      
      keyBinding.appendChild(key);
      code.appendChild(descSpan);
      code.appendChild(keyBinding);
      li.appendChild(code);
      shortcutsList.appendChild(li);
    });
    
    categoryDiv.appendChild(shortcutsList);
    container.appendChild(categoryDiv);
  });
  
  return container;
}

/**
 * Setup search functionality for shortcuts
 */
function setupShortcutsSearch() {
  const searchInput = document.getElementById('shortcuts-search');
  const categories = document.querySelectorAll('.shortcuts-category');
  
  if (!searchInput) return;
  
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    categories.forEach(category => {
      const items = category.querySelectorAll('li');
      let visibleCount = 0;
      
      items.forEach(item => {
        const searchText = item.dataset.searchText || '';
        if (!query || searchText.includes(query)) {
          item.style.display = '';
          visibleCount++;
        } else {
          item.style.display = 'none';
        }
      });
      
      // Hide category if no visible items
      category.style.display = visibleCount > 0 ? '' : 'none';
    });
  });
  
  // Focus search on modal open
  const modal = document.getElementById('keyboard-shortcuts');
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'style' && modal.style.display === 'block') {
        setTimeout(() => searchInput.focus(), 50);
      }
    });
  });
  
  observer.observe(modal, { attributes: true });
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
  // Settings are auto-saved via ratechange event in player.js
}

/**
 * Handle frame-by-frame navigation
 * @param {string} key - The pressed key (',' or '.')
 */
function handleFrameStep(key) {
  const frameRate = 48; // Assumed frame rate
  const frameDelta = key === ',' ? -1 / frameRate : 1 / frameRate;
  
  video.pause();
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
      // Clear search when closing
      const searchInput = document.getElementById('shortcuts-search');
      if (searchInput) searchInput.value = '';
    }
    focusVideo();
  });
  
  // Close button handler
  closeButton.addEventListener('click', () => {
    modal.style.display = 'none';
    // Clear search when closing
    const searchInput = document.getElementById('shortcuts-search');
    if (searchInput) searchInput.value = '';
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
  // Check if we're in player.html context (has player/video variables)
  const isPlayerContext = typeof player !== 'undefined' && typeof video !== 'undefined';
  
  // Handle player.html modal (with shortcuts-list container and search)
  const shortcutsContainer = document.getElementById('shortcuts-list');
  if (shortcutsContainer) {
    shortcutsContainer.appendChild(generateShortcutsDocumentation(SHORTCUTS_BY_CATEGORY));
    setupShortcutsSearch();
  }
  
  // Handle standalone shortcuts.html page (with shortcuts-container)
  const standaloneContainer = document.getElementById('shortcuts-container');
  if (standaloneContainer && !shortcutsContainer) {
    standaloneContainer.appendChild(generateShortcutsDocumentation(SHORTCUTS_BY_CATEGORY));
  }
  
  // Setup keyboard handlers only if in player context
  if (isPlayerContext) {
    setupKeyboardHandlers();
  } else if (shortcutsContainer && !isPlayerContext) {
    // In player.html but player not ready yet - wait for initialization
    const checkInterval = setInterval(() => {
      if (typeof player !== 'undefined' && typeof video !== 'undefined') {
        clearInterval(checkInterval);
        setupKeyboardHandlers();
      }
    }, 100);
    
    // Stop checking after 5 seconds to prevent infinite loop
    setTimeout(() => clearInterval(checkInterval), 5000);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initShortcuts);
} else {
  initShortcuts();
}
