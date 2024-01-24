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

player=document.querySelector('media-controller');
var url = window.location.href.split("#")[1];
play_stream(url);
const video = document.querySelector('hls-video');

let mediaTimeDisplay = document.querySelector('media-time-display');
let mediastreamtype;

video.addEventListener('loadedmetadata', function() {
mediastreamtype = player.getAttribute("mediastreamtype");
});

video.addEventListener("timeupdate", function () {
    if (mediastreamtype == "live") {
      let totalDuration = mediaTimeDisplay.getAttribute("mediaseekable");
      let [, end] = totalDuration.split(":");
      let [seconds, milliseconds] = end.split(".");
      seconds = parseFloat(seconds) || 0;
      milliseconds = parseFloat(milliseconds) || 0;
      let totalSeconds =  seconds + milliseconds / 1000;
      mediaTimeDisplay.setAttribute("mediaduration", totalSeconds);
    }
  });


let resumePosition = 0;
video.addEventListener('pause', () => {
  resumePosition = video.currentTime;
});
video.addEventListener('play', () => {
  video.currentTime = resumePosition;
  if (video.currentTime >= video.duration-5) {
    video.currentTime = 0;
  }
});

player.addEventListener('keydown', (event) => {
    // window.addEventListener('load', focusVideo);

    if (event.ctrlKey || event.altKey || event.metaKey) {
        return;
    }

    let roundedPlaybackSpeed;
    switch(event.key) {
        case '>':
        case '+':
            video.playbackRate += event.key === '>' ? 0.1 : 0.5;
            roundedPlaybackSpeed = Math.round(video.playbackRate * 100) / 100;
            video.playbackRate = Math.min(roundedPlaybackSpeed, 10.0);
            break;
        case '<':
        case '-':
            video.playbackRate -= event.key === '<' ? 0.1 : 0.5;
            roundedPlaybackSpeed = Math.round(video.playbackRate * 100) / 100;
            video.playbackRate = Math.max(roundedPlaybackSpeed, 0.1);
            break;
        case 'ArrowUp':
            video.volume = Math.min(video.volume + 0.1, 1.0);
            break;
        case 'ArrowDown':
            video.volume = Math.max(video.volume - 0.1, 0.0);
            break;
        case 'p':
            video.requestPictureInPicture();
            break;
        case 'P':
            document.exitPictureInPicture();
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
            video.pause();
            video.currentTime = resumePosition;
            video.currentTime += event.key === ',' ? -1/48 : 1/48;
            resumePosition = video.currentTime;
            break;
        case '0':
            // Seek to the end of the loaded video
            if (video.buffered.length > 0) {
                video.currentTime = video.buffered.end(video.buffered.length - 1);
            }
            break;
    }
});

// Function to set focus on the video element
function focusVideo() {
    const video = document.querySelector('hls-video');
    video.focus();
}
// Call the focusVideo function when the page loads
window.addEventListener('load', focusVideo);
