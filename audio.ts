export interface Station {
  value: string;
  name: string;
  genre: string;
  emoji: string;
  country: string;
}

const audio = document.getElementById("audioPlayer") as HTMLAudioElement;
const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)") as HTMLButtonElement;
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let isAutoPlaying = false;
let retryCount = 0;
let retryTimer: number | null = null;
const MAX_RETRIES = 3;
const MAX_BACKOFF = 30000; // Максимальна затримка 30 секунд

// Web Audio API для еквалайзера
const audioCtx = new AudioContext();
const source = audioCtx.createMediaElementSource(audio);
const bassFilter = audioCtx.createBiquadFilter();
const trebleFilter = audioCtx.createBiquadFilter();
bassFilter.type = "lowshelf";
bassFilter.frequency.setValueAtTime(200, audioCtx.currentTime);
trebleFilter.type = "highshelf";
trebleFilter.frequency.setValueAtTime(4000, audioCtx.currentTime);
source.connect(bassFilter).connect(trebleFilter).connect(audioCtx.destination);

// Налаштування еквалайзера
const bassControl = document.getElementById("bassControl") as HTMLInputElement;
const trebleControl = document.getElementById("trebleControl") as HTMLInputElement;
bassControl.addEventListener("input", () => {
  bassFilter.gain.setValueAtTime(parseFloat(bassControl.value), audioCtx.currentTime);
});
trebleControl.addEventListener("input", () => {
  trebleFilter.gain.setValueAtTime(parseFloat(trebleControl.value), audioCtx.currentTime);
});

// Налаштування аудіо
audio.preload = "auto";
audio.volume = parseFloat(localStorage.getItem("volume") || "0.9");

export function initializeAudio() {
  audio.addEventListener("canplay", () => {
    if (isPlaying && !isAutoPlaying) {
      tryAutoPlay();
    }
  });
  audio.addEventListener("playing", () => {
    isPlaying = true;
    playPauseBtn.textContent = "⏸";
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
    localStorage.setItem("isPlaying", isPlaying.toString());
    clearRetryTimer();
  });
  audio.addEventListener("pause", () => {
    isPlaying = false;
    playPauseBtn.textContent = "▶";
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    localStorage.setItem("isPlaying", isPlaying.toString());
    startRetryTimer();
  });
  audio.addEventListener("error", handlePlaybackError);
  audio.addEventListener("ended", handlePlaybackError);
  audio.addEventListener("volumechange", () => {
    localStorage.setItem("volume", audio.volume.toString());
  });

  // Media Session API
  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", togglePlayPause);
    navigator.mediaSession.setActionHandler("pause", togglePlayPause);
    navigator.mediaSession.setActionHandler("previoustrack", prevStation);
    navigator.mediaSession.setActionHandler("nexttrack", nextStation);
  }
}

function clearRetryTimer() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function startRetryTimer() {
  clearRetryTimer();
  if (retryCount < MAX_RETRIES) {
    const backoff = Math.min(1000 * Math.pow(2, retryCount), MAX_BACKOFF);
    retryTimer = setTimeout(() => {
      if (navigator.onLine && isPlaying && !isAutoPlaying && audio.paused) {
        console.log(`Експоненційна спроба відтворення (спроба ${retryCount + 1}, затримка ${backoff}ms)`);
        audio.pause();
        tryAutoPlay();
      }
    }, backoff);
    retryCount++;
  } else {
    retryCount = 0; // Скидаємо після досягнення максимуму
  }
}

function handlePlaybackError() {
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
  startRetryTimer();
}

function tryAutoPlay() {
  const stationItems = document.querySelectorAll(".station-item") as NodeListOf<HTMLElement>;
  if (!isPlaying || !stationItems.length || state.currentIndex >= stationItems.length || isAutoPlaying) {
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    return;
  }
  isAutoPlaying = true;
  audio.src = stationItems[state.currentIndex].dataset.value!;
  const playPromise = audio.play();

  playPromise
    .then(() => {
      retryCount = 0;
      isAutoPlaying = false;
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
      clearRetryTimer();
    })
    .catch(error => {
      console.error("Помилка відтворення:", error);
      isAutoPlaying = false;
      handlePlaybackError();
    });
}

export function prevStation() {
  const stationItems = document.querySelectorAll(".station-item") as NodeListOf<HTMLElement>;
  state.currentIndex = state.currentIndex > 0 ? state.currentIndex - 1 : stationItems.length - 1;
  if (stationItems[state.currentIndex].classList.contains("empty")) state.currentIndex = 0;
  changeStation(state.currentIndex);
}

export function nextStation() {
  const stationItems = document.querySelectorAll(".station-item") as NodeListOf<HTMLElement>;
  state.currentIndex = state.currentIndex < stationItems.length - 1 ? state.currentIndex + 1 : 0;
  if (stationItems[state.currentIndex].classList.contains("empty")) state.currentIndex = 0;
  changeStation(state.currentIndex);
}

export function togglePlayPause() {
  if (audio.paused) {
    isPlaying = true;
    tryAutoPlay();
    playPauseBtn.textContent = "⏸";
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
  } else {
    audio.pause();
    isPlaying = false;
    playPauseBtn.textContent = "▶";
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    clearRetryTimer();
  }
  localStorage.setItem("isPlaying", isPlaying.toString());
}

function changeStation(index: number) {
  const stationItems = document.querySelectorAll(".station-item") as NodeListOf<HTMLElement>;
  if (index < 0 || index >= stationItems.length || stationItems[index].classList.contains("empty")) return;
  retryCount = 0;
  clearRetryTimer();
  stationItems.forEach(i => i.classList.remove("selected"));
  stationItems[index].classList.add("selected");
  state.currentIndex = index;
  audio.src = stationItems[index].dataset.value!;
  updateCurrentStationInfo(stationItems[index]);
  localStorage.setItem(`lastStation_${state.currentTab}`, index.toString());
  tryAutoPlay();
}

function updateCurrentStationInfo(item: HTMLElement) {
  const currentStationInfo = document.getElementById("currentStationInfo") as HTMLElement;
  currentStationInfo.classList.add("transition");
  setTimeout(() => currentStationInfo.classList.remove("transition"), 500);
  currentStationInfo.querySelector(".station-name")!.textContent = item.dataset.name || "Немає даних";
  currentStationInfo.querySelector(".station-genre")!.textContent = `жанр: ${item.dataset.genre || "-"}`;
  currentStationInfo.querySelector(".station-country")!.textContent = `країна: ${item.dataset.country || "-"}`;
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.dataset.name || "Невідома станція",
      artist: `${item.dataset.genre || "-"} | ${item.dataset.country || "-"}`,
      album: "Radio Music"
    });
  }
}

// Глобальний стан (тимчасово тут, можна винести в окремий модуль)
const state: AppState = {
  currentTab: localStorage.getItem("currentTab") || "techno",
  currentIndex: 0,
  isPlaying: localStorage.getItem("isPlaying") === "true" || false,
  favoriteStations: JSON.parse(localStorage.getItem("favoriteStations") || "[]")
};