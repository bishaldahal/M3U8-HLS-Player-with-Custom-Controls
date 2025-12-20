/**
 * HLS Video Player - Main player logic
 * Handles stream playback, live stream time display, and video focus management
 */

// Player state - exported for use in shortcuts.js
let player = null;
let video = null;
let mediaTimeDisplay = null;
let mediastreamtype = null;
let resumePosition = 0;

/**
 * Initialize and play an HLS stream
 * @param {string} url - The M3U8 stream URL (with optional extTitle parameter)
 */
function playStream(url) {
  try {
    const m3u8Url = new URL(url);
    const title = m3u8Url.searchParams.get('extTitle');
    m3u8Url.searchParams.delete('extTitle');

    // Set the page title if provided
    if (title) {
      document.title = title;
    }

    // Create the HLS video element
    const videoElement = document.createElement('hls-video');
    videoElement.setAttribute('slot', 'media');
    videoElement.setAttribute('crossorigin', '');
    videoElement.setAttribute('autoplay', '');
    videoElement.setAttribute('src', m3u8Url.href);

    // Append to the media controller
    player.appendChild(videoElement);
    document.body.appendChild(player);

    return videoElement;
  } catch (error) {
    console.error('Failed to play stream:', error);
    document.body.innerHTML = `
      <div style="color: white; padding: 20px; font-family: sans-serif;">
        <h1>Error Loading Stream</h1>
        <p>Failed to parse URL: ${error.message}</p>
        <p>URL: ${url}</p>
      </div>
    `;
    return null;
  }
}

/**
 * Handle live stream time display updates
 */
function setupLiveTimeDisplay() {
  video.addEventListener('timeupdate', () => {
    if (mediastreamtype !== 'live') return;

    const totalDuration = mediaTimeDisplay.getAttribute('mediaseekable');
    if (!totalDuration) return;

    const [, end] = totalDuration.split(':');
    const [seconds, milliseconds] = end.split('.');
    const totalSeconds = (parseFloat(seconds) || 0) + (parseFloat(milliseconds) || 0) / 1000;

    mediaTimeDisplay.setAttribute('mediaduration', totalSeconds);
    mediaTimeDisplay.setAttribute('remaining', '');
  });
}

/**
 * Handle pause/play resume position tracking
 */
function setupResumePosition() {
  video.addEventListener('pause', () => {
    resumePosition = video.currentTime;
  });

  video.addEventListener('play', () => {
    video.currentTime = resumePosition;
    // Reset to beginning if near the end
    if (video.currentTime >= video.duration - 5) {
      video.currentTime = 0;
    }
  });
}

/**
 * Focus the video element for keyboard controls
 */
function focusVideo() {
  if (video) {
    video.focus();
  }
}

/**
 * Initialize the player
 */
function init() {
  player = document.querySelector('media-controller');
  
  if (!player) {
    console.error('Media controller not found');
    return;
  }

  // Get URL from hash fragment
  const url = window.location.hash.slice(1);
  
  if (!url) {
    document.body.innerHTML = `
      <div style="color: white; padding: 20px; font-family: sans-serif;">
        <h1>No Stream URL</h1>
        <p>Please provide an M3U8 URL in the hash fragment.</p>
      </div>
    `;
    return;
  }

  // Play the stream
  video = playStream(url);
  
  if (!video) return;

  mediaTimeDisplay = document.querySelector('media-time-display');

  // Wait for metadata to determine stream type
  video.addEventListener('loadedmetadata', () => {
    mediastreamtype = player.getAttribute('mediastreamtype');
  });

  // Setup event handlers
  setupLiveTimeDisplay();
  setupResumePosition();

  // Focus video on load
  window.addEventListener('load', focusVideo);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
