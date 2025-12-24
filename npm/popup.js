// HLS Video Player - Popup UI

let historyList, urlInput, playUrlBtn, urlError, toast;

function showToast(message, isError = false) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function playFromInput() {
  const result = validateUrl(urlInput.value);
  
  if (!result.valid) {
    urlError.textContent = result.error;
    urlError.classList.add('show');
    urlInput.classList.add('error');
    return;
  }
  
  urlError.classList.remove('show');
  urlInput.classList.remove('error');
  
  if (!result.isM3u8) {
    showToast('Note: URL may not be a valid HLS stream');
  }
  
  browserAPI.tabs.create({ url: `${browserAPI.runtime.getURL('player.html')}#${result.url}` });
  window.close();
}

async function loadHistoryUI() {
  const { loadHistory } = window.PlayerSettings;
  const history = await loadHistory();
  
  historyList.innerHTML = '';
  
  if (!history?.length) {
    historyList.innerHTML = '<div class="history-empty">No recent streams</div>';
    return;
  }
  
  history.slice(0, 5).forEach(entry => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.setAttribute('role', 'listitem');
    item.tabIndex = 0;
    
    const timeStr = entry.duration > 0
      ? `${formatTime(entry.currentTime)} / ${formatTime(entry.duration)}`
      : `${formatTime(entry.currentTime)} (Live)`;
    
    item.innerHTML = `
      <div class="history-info">
        <div class="history-title" title="${escapeHtml(entry.url)}">${escapeHtml(entry.title)}</div>
        <div class="history-meta">${timeStr} • ${formatRelativeTime(entry.timestamp)}</div>
      </div>
    `;
    
    const openPlayer = () => {
      browserAPI.tabs.create({ url: `${browserAPI.runtime.getURL('player.html')}#${entry.url}` });
      window.close();
    };
    
    item.addEventListener('click', openPlayer);
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPlayer();
      }
    });
    
    historyList.appendChild(item);
  });
}

function init() {
  historyList = document.getElementById('history-list');
  urlInput = document.getElementById('url-input');
  playUrlBtn = document.getElementById('play-url-btn');
  urlError = document.getElementById('url-error');
  toast = document.getElementById('toast');
  
  playUrlBtn?.addEventListener('click', playFromInput);
  
  urlInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') playFromInput();
  });
  
  urlInput?.addEventListener('input', () => {
    urlError?.classList.remove('show');
    urlInput.classList.remove('error');
  });
  
  document.getElementById('open-options')?.addEventListener('click', () => {
    browserAPI.runtime.openOptionsPage();
    window.close();
  });
  
  document.getElementById('open-shortcuts')?.addEventListener('click', () => {
    browserAPI.tabs.create({ url: browserAPI.runtime.getURL('shortcuts.html') });
    window.close();
  });
  
  document.getElementById('view-all-history')?.addEventListener('click', e => {
    e.preventDefault();
    browserAPI.runtime.openOptionsPage();
    window.close();
  });
  
  loadHistoryUI();
  urlInput?.focus();
}

document.addEventListener('DOMContentLoaded', init);
