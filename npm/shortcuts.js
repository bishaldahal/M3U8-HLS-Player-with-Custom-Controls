// HLS Video Player - Keyboard Shortcuts

let shortcutKeyMap = {};
let shortcutsByCategory = {};
let isInitialized = false;
let handlersAttached = false;

const FRAME_RATE = 30;
const KEY_TO_PERCENT = { '0': 0, '1': 0.1, '2': 0.2, '3': 0.3, '4': 0.4, '5': 0.5, '6': 0.6, '7': 0.7, '8': 0.8, '9': 0.9 };

function getRefs() {
  return {
    player: window.player,
    video: window.video,
    mediastreamtype: window.mediastreamtype,
    resumePosition: window.resumePosition
  };
}

function setResumePosition(v) {
  window.resumePosition = v;
}

function buildShortcutKeyMap(shortcuts) {
  shortcutKeyMap = {};
  Object.entries(shortcuts || {}).forEach(([id, data]) => {
    if (data?.key) shortcutKeyMap[data.key.toLowerCase()] = id;
  });
}

function buildShortcutsByCategory() {
  const shortcuts = window.PlayerSettings?.DEFAULT_SHORTCUTS || {};
  const byCategory = {};
  Object.entries(shortcuts).forEach(([id, data]) => {
    const cat = data.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push({ actionId: id, key: data.display, description: data.description });
  });
  if (!byCategory.Playback) byCategory.Playback = [];
  byCategory.Playback.push({ key: '0-9', description: 'Seek to percentage (0%-90%)' });
  if (!byCategory.View) byCategory.View = [];
  byCategory.View.push({ key: 'Esc', description: 'Close shortcuts/stats panel' });
  return byCategory;
}

function getActionForKey(key) {
  return key ? shortcutKeyMap[key.toLowerCase()] : null;
}

async function invalidateShortcutKeyMap() {
  if (window.PlayerSettings) {
    const shortcuts = await window.PlayerSettings.getShortcuts();
    buildShortcutKeyMap(shortcuts);
    shortcutsByCategory = buildShortcutsByCategory();
  }
}
window.invalidateShortcutKeyMap = invalidateShortcutKeyMap;

function generateShortcutsDoc(byCategory) {
  const container = document.createElement('div');
  Object.entries(byCategory).forEach(([cat, shortcuts]) => {
    const div = document.createElement('div');
    div.className = 'shortcuts-category';
    div.dataset.category = cat;
    
    const title = document.createElement('h3');
    title.className = 'category-title';
    title.textContent = cat;
    div.appendChild(title);
    
    const ul = document.createElement('ul');
    if (shortcuts.length <= 2) ul.className = 'full-width';
    
    shortcuts.forEach(s => {
      const li = document.createElement('li');
      li.dataset.searchText = `${s.key} ${s.description}`.toLowerCase();
      li.innerHTML = `<code><span class="shortcut-desc">${s.description}</span><span class="key-binding"><span class="key">${s.key}</span></span></code>`;
      ul.appendChild(li);
    });
    
    div.appendChild(ul);
    container.appendChild(div);
  });
  return container;
}

function setupShortcutsSearch() {
  const input = document.getElementById('shortcuts-search');
  const categories = document.querySelectorAll('.shortcuts-category');
  if (!input) return;
  
  input.addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    categories.forEach(cat => {
      const items = cat.querySelectorAll('li');
      let visible = 0;
      items.forEach(li => {
        const match = !q || li.dataset.searchText?.includes(q);
        li.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      cat.style.display = visible > 0 ? '' : 'none';
    });
  });
  
  const modal = document.getElementById('keyboard-shortcuts');
  if (modal) {
    new MutationObserver(() => {
      if (modal.style.display === 'block') setTimeout(() => input.focus(), 50);
    }).observe(modal, { attributes: true });
  }
}

function handleNumberKeySeek(key) {
  if (!(key in KEY_TO_PERCENT)) return false;
  const { video, mediastreamtype } = getRefs();
  if (!video) return false;
  
  const pct = KEY_TO_PERCENT[key];
  
  if (mediastreamtype !== 'live') {
    const dur = safeVideoGet(video, 'duration', 0);
    if (dur > 0) safeVideoSet(video, 'currentTime', dur * pct);
    return true;
  }
  
  const time = safeVideoGet(video, 'currentTime', 0);
  const buf = getBufferInfo(video, time);
  if (buf?.end > buf?.start) {
    safeVideoSet(video, 'currentTime', buf.start + (buf.end - buf.start) * pct);
  }
  return true;
}

function createActionHandlers() {
  const seek = (delta) => {
    const { video } = getRefs();
    if (!video) return;
    const cur = safeVideoGet(video, 'currentTime', 0);
    const dur = safeVideoGet(video, 'duration', Infinity);
    const t = clamp(cur + delta, 0, dur);
    safeVideoSet(video, 'currentTime', t);
    setResumePosition(t);
  };
  
  const changeSpeed = (delta) => {
    const { video } = getRefs();
    if (!video) return;
    const rate = safeVideoGet(video, 'playbackRate', 1);
    safeVideoSet(video, 'playbackRate', clamp(roundTo(rate + delta, 2), 0.1, 10));
  };
  
  const changeVolume = (delta) => {
    const { video } = getRefs();
    if (!video) return;
    safeVideoSet(video, 'volume', clamp(safeVideoGet(video, 'volume', 1) + delta, 0, 1));
  };
  
  const frameStep = (delta) => {
    const { video, resumePosition } = getRefs();
    if (!video) return;
    video.pause?.();
    const dur = safeVideoGet(video, 'duration', Infinity);
    const t = clamp(resumePosition + delta / FRAME_RATE, 0, dur);
    safeVideoSet(video, 'currentTime', t);
    setResumePosition(t);
  };
  
  return {
    playPause: () => { const { video } = getRefs(); video?.[safeVideoGet(video, 'paused', true) ? 'play' : 'pause']?.(); },
    playPauseAlt: () => { const { video } = getRefs(); video?.[safeVideoGet(video, 'paused', true) ? 'play' : 'pause']?.(); },
    seekBack10: () => seek(-10),
    seekForward10: () => seek(10),
    seekBack5: () => seek(-5),
    seekForward5: () => seek(5),
    seekStart: () => { const { video } = getRefs(); safeVideoSet(video, 'currentTime', 0); setResumePosition(0); },
    seekEnd: () => {
      const { video, mediastreamtype } = getRefs();
      if (!video) return;
      if (mediastreamtype !== 'live') {
        const dur = safeVideoGet(video, 'duration', 0);
        if (dur > 0) { safeVideoSet(video, 'currentTime', dur); setResumePosition(dur); }
      } else if (video.buffered?.length) {
        const end = video.buffered.end(video.buffered.length - 1);
        safeVideoSet(video, 'currentTime', end);
        setResumePosition(end);
      }
    },
    speedUp01: () => changeSpeed(0.1),
    speedDown01: () => changeSpeed(-0.1),
    speedUp05: () => changeSpeed(0.5),
    speedDown05: () => changeSpeed(-0.5),
    volumeUp: () => changeVolume(0.1),
    volumeDown: () => changeVolume(-0.1),
    mute: () => { const { video } = getRefs(); safeVideoSet(video, 'muted', !safeVideoGet(video, 'muted', false)); },
    framePrev: () => frameStep(-1),
    frameNext: () => frameStep(1),
    fullscreen: () => {
      const { player } = getRefs();
      document.fullscreenElement ? document.exitFullscreen?.() : player?.requestFullscreen?.();
    },
    pipEnter: () => getRefs().video?.requestPictureInPicture?.(),
    pipExit: () => document.pictureInPictureElement && document.exitPictureInPicture?.(),
    stats: () => window.toggleStatsOverlay?.(),
    shortcuts: () => {
      const modal = document.getElementById('keyboard-shortcuts');
      if (modal) modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
    }
  };
}

function setupKeyboardHandlers() {
  if (handlersAttached) return;
  handlersAttached = true;
  
  const modal = document.getElementById('keyboard-shortcuts');
  const closeBtn = document.getElementById('close-shortcuts');
  const handlers = createActionHandlers();
  
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    
    // Helper to stop event from reaching media-chrome
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    
    if (e.key === 'Escape') {
      stop();
      if (modal) modal.style.display = 'none';
      window.hideStatsOverlay?.();
      const search = document.getElementById('shortcuts-search');
      if (search) search.value = '';
      return;
    }
    
    if (handleNumberKeySeek(e.key)) {
      stop();
      return;
    }
    
    const action = getActionForKey(e.key);
    
    if (e.key === '?' || action === 'shortcuts') {
      stop();
      if (modal) modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
      return;
    }
    
    if (action && handlers[action]) {
      stop();
      handlers[action]();
      return;
    }
    
    // Handle shifted keys
    if (e.key === '>') { stop(); handlers.speedUp01(); }
    else if (e.key === '<') { stop(); handlers.speedDown01(); }
    else if (e.key === '+') { stop(); handlers.speedUp05(); }
    else if (e.key === '-') { stop(); handlers.speedDown05(); }
  }, true);
  
  closeBtn?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
    const search = document.getElementById('shortcuts-search');
    if (search) search.value = '';
  });
  
  getRefs().player?.addEventListener('dblclick', () => {
    document.fullscreenElement ? document.exitFullscreen?.() : getRefs().player?.requestFullscreen?.();
  });
}

async function initShortcuts() {
  if (isInitialized) return;
  
  // Wait for PlayerSettings
  const start = Date.now();
  while (!window.PlayerSettings && Date.now() - start < 5000) {
    await new Promise(r => setTimeout(r, 50));
  }
  
  if (window.PlayerSettings) {
    const shortcuts = await window.PlayerSettings.getShortcuts();
    buildShortcutKeyMap(shortcuts);
  }
  
  shortcutsByCategory = buildShortcutsByCategory();
  
  const listEl = document.getElementById('shortcuts-list');
  if (listEl) {
    listEl.innerHTML = '';
    listEl.appendChild(generateShortcutsDoc(shortcutsByCategory));
    setupShortcutsSearch();
  }
  
  const standaloneEl = document.getElementById('shortcuts-container');
  if (standaloneEl && !listEl) {
    standaloneEl.innerHTML = '';
    standaloneEl.appendChild(generateShortcutsDoc(shortcutsByCategory));
  }
  
  // Wait for player to be ready
  const { player, video } = getRefs();
  if (player && video) {
    setupKeyboardHandlers();
    isInitialized = true;
  } else if (listEl) {
    const checkStart = Date.now();
    const interval = setInterval(() => {
      const refs = getRefs();
      if (refs.player && refs.video) {
        clearInterval(interval);
        setupKeyboardHandlers();
        isInitialized = true;
      } else if (Date.now() - checkStart > 5000) {
        clearInterval(interval);
      }
    }, 100);
  }
}

document.addEventListener('DOMContentLoaded', initShortcuts);
