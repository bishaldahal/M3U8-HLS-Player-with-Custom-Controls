function play_stream(url) {
  var m3u8Url = decodeURIComponent(url);
  console.log(m3u8Url);
  // Create the video element
  const video = document.createElement("hls-video");
  video.setAttribute("slot", "media");
  video.setAttribute("crossorigin", "");
  video.setAttribute("autoplay", "");
  video.setAttribute("src", m3u8Url);
  // Append the video element to the media controller
  player.appendChild(video);

  // Append the media controller to the document body
  document.body.appendChild(player);
}

let player = document.querySelector("media-controller");
var url = window.location.href.split("#")[1];
play_stream(url);
const video = document.querySelector("hls-video");

let mediaTimeDisplay = document.querySelector("media-time-display");
let mediastreamtype;

video.addEventListener("loadedmetadata", function () {
  mediastreamtype = player.getAttribute("mediastreamtype");
});

video.addEventListener("timeupdate", function () {
  if (mediastreamtype == "live") {
    let totalDuration = mediaTimeDisplay.getAttribute("mediaseekable");
    let [, end] = totalDuration.split(":");
    let [seconds, milliseconds] = end.split(".");
    seconds = parseFloat(seconds) || 0;
    milliseconds = parseFloat(milliseconds) || 0;
    let totalSeconds = seconds + milliseconds / 1000;
    mediaTimeDisplay.setAttribute("mediaduration", totalSeconds);
    mediaTimeDisplay.setAttribute("remaining", "");
  }
});

let resumePosition = 0;
video.addEventListener("pause", () => {
  resumePosition = video.currentTime;
});
video.addEventListener("play", () => {
  video.currentTime = resumePosition;
  if (video.currentTime >= video.duration - 5) {
    video.currentTime = 0;
  }
});

// Function to set focus on the video element
function focusVideo() {
  const video = document.querySelector("hls-video");
  video.focus();
}
// Call the focusVideo function when the page loads
window.addEventListener("load", focusVideo);
