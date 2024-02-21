const keyToPercentage = {
  0: 0.0,
  1: 0.1,
  2: 0.2,
  3: 0.3,
  4: 0.4,
  5: 0.5,
  6: 0.6,
  7: 0.7,
  8: 0.8,
  9: 0.9,
};

let modal = document.getElementById("keyboard-shortcuts");

document.addEventListener("keydown", function (event) {
    console.log("Document keydown event", event.key);
  if (event.key === "?") {
    if (modal.style.display === "block") {
      modal.style.display = "none";
    } else {
      modal.style.display = "block";
    }
  }
});

let button = document.getElementById("close-shortcuts");
button.addEventListener("click", function () {
  modal.style.display = "none";
});

player.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.altKey || event.metaKey) {
    return;
  }

  if (keyToPercentage.hasOwnProperty(event.key) && mediastreamtype !== "live") {
    video.currentTime = video.duration * keyToPercentage[event.key];
  }

  if (
    keyToPercentage.hasOwnProperty(event.key) &&
    // video.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA &&
    mediastreamtype === "live"
  ) {
    let bufferTime = 0;
    let bufferIndex = 0;
    for (let i = 0; i < video.buffered.length; i++) {
      if (
        video.currentTime >= video.buffered.start(i) &&
        video.currentTime <= video.buffered.end(i)
      ) {
        bufferTime = video.buffered.end(i) - video.buffered.start(i);
        bufferIndex = i;
        break;
      }
    }
    if (bufferTime > 0) {
      video.currentTime =
        video.buffered.start(bufferIndex) +
        bufferTime * keyToPercentage[event.key];
    }
  }

  let roundedPlaybackSpeed;
  switch (event.key) {
    case ">":
    case "+":
      video.playbackRate += event.key === ">" ? 0.1 : 0.5;
      roundedPlaybackSpeed = Math.round(video.playbackRate * 100) / 100;
      video.playbackRate = Math.min(roundedPlaybackSpeed, 10.0);
      break;
    case "<":
    case "-":
      video.playbackRate -= event.key === "<" ? 0.1 : 0.5;
      roundedPlaybackSpeed = Math.round(video.playbackRate * 100) / 100;
      video.playbackRate = Math.max(roundedPlaybackSpeed, 0.1);
      break;
    case "ArrowUp":
      video.volume = Math.min(video.volume + 0.1, 1.0);
      break;
    case "ArrowDown":
      video.volume = Math.max(video.volume - 0.1, 0.0);
      break;
    case "p":
      video.requestPictureInPicture();
      break;
    case "P":
      document.exitPictureInPicture();
      break;
    case "J":
    case "j":
      event.preventDefault();
      video.currentTime -= 5;
      resumePosition = video.currentTime;
      break;
    case "L":
    case "l":
      event.preventDefault();
      video.currentTime += 5;
      resumePosition = video.currentTime;
      break;
    case ",":
    case ".":
      video.pause();
      video.currentTime = resumePosition;
      video.currentTime += event.key === "," ? -1 / 48 : 1 / 48;
      resumePosition = video.currentTime;
      break;
    case "Home":
      // Seek to the beginning of the video
      video.currentTime = 0;
      break;
    case "End":
      // Seek to the end of the video
      if (mediastreamtype !== "live") {
        video.currentTime = video.duration;
      } else if (video.buffered.length > 0) {
        video.currentTime = video.buffered.end(video.buffered.length - 1);
      }
      break;
  }
});
