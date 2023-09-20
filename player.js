function play_stream(url) {
    var m3u8Url = decodeURIComponent(url);
    console.log(m3u8Url);
    // Create the video element
    const video = document.createElement('hls-video');
    video.setAttribute('slot', 'media');
    video.setAttribute('crossorigin', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('src', m3u8Url);
    // Append the video element to the media controller
    player.appendChild(video);

    // Append the media controller to the document body
    document.body.appendChild(player);
}

const player = document.querySelector('media-controller');

var url = window.location.href.split("#")[1];
play_stream(url);

const video = document.querySelector('hls-video');

player.addEventListener('keydown', (event) => {
    if (event.key === '>') {
        video.playbackRate += 0.1;
        // Round the playback speed value to two decimal places
        const roundedPlaybackSpeed = Math.round(video.playbackRate * 100) / 100;
        // Limit the playback speed to a maximum of 2.0
        video.playbackRate = Math.min(roundedPlaybackSpeed, 10.0);
    }
});

player.addEventListener('keydown', (event) => {
    if (event.key === '<') {
        video.playbackRate -= 0.1;
        // Round the playback speed value to two decimal places
        const roundedPlaybackSpeed = Math.round(video.playbackRate * 100) / 100;
        // Limit the playback speed to a minimum of 0.1
        video.playbackRate = Math.max(roundedPlaybackSpeed, 0.1);
    }
});

player.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp') {
        currentVolume = video.volume + 0.1;
        // Limit the volume to a maximum of 1.0
        video.volume = Math.min(currentVolume, 1.0);
    } else if (event.key === 'ArrowDown') {
        currentVolume -= 0.1;
        video.volume = Math.max(currentVolume, 0.0);
    }
});

video.addEventListener('dblclick', () => {
    // Toggle fullscreen mode
    if (document.fullscreenElement === player) {
        document.exitFullscreen();
    } else {
        player.requestFullscreen();
    }
});

// Picture-in-picture on P
player.addEventListener('keydown', (event) => {
    if (event.key === 'p') {
        video.requestPictureInPicture();
    }
});
// Exit PIP on Esc
document.addEventListener('keydown', (event) => {
    if (event.key === 'P') {
        document.exitPictureInPicture();
    }
});

// Seek backward on J
player.addEventListener('keydown', (event) => {
    if (event.key === 'J' || event.key === 'j') {
        event.preventDefault();
        video.currentTime -= 5;
    }
});

// Seek forward on L
player.addEventListener('keydown', (event) => {
    if (event.key === 'L' || event.key === 'l') {
        event.preventDefault();
        video.currentTime += 5;
    }
});

video.addEventListener('keydown', (event) => {
    const estimatedFrameRate = video.duration / (video.videoWidth * video.videoHeight);
    const reducedFrameRate = estimatedFrameRate * 100000;
    if (event.key === ',') {
        // Move back  frame
        video.currentTime = Math.max(0, video.currentTime - 1 / reducedFrameRate);
    } else if (event.key === '.') {
        // Move forward  frame
        video.currentTime = Math.min(video.duration, video.currentTime + 1 / reducedFrameRate);
    }
});

// Function to set focus on the video element
function focusVideo() {
    const video = document.querySelector('hls-video');
    video.focus();
}
// Call the focusVideo function when the page loads
window.addEventListener('load', focusVideo);
