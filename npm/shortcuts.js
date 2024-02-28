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

function generateShortcutsDocumentation(shortcuts) {
  const shortcutsList = document.createElement("ul");
  shortcuts.forEach((shortcut) => {
    const shortcutListItem = document.createElement("li");
    const shortcutCode = document.createElement("code");
    const keyBinding = document.createElement("span");
    const key = document.createElement("span");
    key.className = "key";
    key.textContent = shortcut.key;
    keyBinding.className = "key-binding";
    keyBinding.appendChild(key);
    shortcutCode.appendChild(keyBinding);
    shortcutCode.insertAdjacentText("beforeend", ` ${shortcut.description}`);
    shortcutListItem.appendChild(shortcutCode);
    shortcutsList.appendChild(shortcutListItem);
  });
  return shortcutsList;
}

const shortcuts = [
  { key: "<", description: "Decrease playback speed by 0.1" },
  { key: ">", description: "Increase playback speed by 0.1" },
  { key: "-", description: "Decrease playback speed by 0.5" },
  { key: "+", description: "Increase playback speed by 0.5" },
  { key: "ArrowDown (↓)", description: "Decrease volume by 0.1" },
  { key: "ArrowUp (↑)", description: "Increase volume by 0.1" },
  { key: "ArrowLeft (←)", description: "Seek backward 10 seconds" },
  { key: "ArrowRight (→)", description: "Seek forward 10 seconds" },
  { key: "p", description: "Request Picture in Picture" },
  { key: "P", description: "Exit Picture in Picture" },
  { key: "j", description: "Seek backward 5 seconds" },
  { key: "Space / k", description: "Toggle play/pause" },
  { key: "l", description: "Seek forward 5 seconds" },
  { key: ",", description: "Previous frame" },
  { key: ".", description: "Next frame" },
  { key: "Home", description: "Seek to the beginning of the video" },
  { key: "End", description: "Seek to the end of the video" },
  { key: "0-9", description: "Seek to a percentage of the video" },
  { key: "Esc", description: "Close keyboard shortcuts" },
  { key: "?", description: "Toggle keyboard shortcuts" },
  { key: "f", description: "Toggle fullscreen" },
  { key: "m", description: "Toggle mute" },
];

const shortcutsContainer = document.getElementById("keyboard-shortcuts");
shortcutsContainer.appendChild(generateShortcutsDocumentation(shortcuts));

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

  if (event.key === "Escape") {
    modal.style.display = "none";
  }
  focusVideo();
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
      if (video.playbackRate === 0.1 && event.key === "+") {
        video.playbackRate = 0.5;
      }
      else{
      video.playbackRate += event.key === ">" ? 0.1 : 0.5;
      }
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
