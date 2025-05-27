const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("station-list");
const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
const currentStationInfo = document.getElementById("current-station-info");
let currentTab = localStorage.getItem("currentTab") || "techno";
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let stationLists = {};
let stationItems;
let retryCount = 0;
const MAX_RETRIES = 3;
const FAST_RETRY_INTERVAL = 1000;
const SLOW_RETRY_INTERVAL = 5000;
const FAST_RETRY_DURATION = 30000;
let isAutoPlaying = false;
let retryTimer = null;
let retryStartTime = null;

// Налаштування аудіо
audio.preload = "auto";
audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

// Завантаження станцій
async function loadStations(attempt = 1) {
  try {
    const response = await fetch("stations.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    stationLists = await response.json();
    const validTabs = [...Object.keys(stationLists), "best"];
    if (!validTabs.includes(currentTab)) {
      currentTab = validTabs[0] || "techno";
      localStorage.setItem("currentTab", currentTab);
    }
    currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
    switchTab(currentTab);
  } catch (error) {
    console.error("Помилка завантаження станцій (спроба " + attempt + "):", error);
    if ("caches" in window) {
      const cacheResponse = await caches.match("stations.json");
      if (cacheResponse) {
        stationLists = await cacheResponse.json();
        const validTabs = [...Object.keys(stationLists), "best"];
        if (!validTabs.includes(currentTab)) {
          currentTab = validTabs[0] || "techno";
          localStorage.setItem("currentTab", currentTab);
        }
        currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
        switchTab(currentTab);
        return;
      }
    }
    if (attempt < 3) {
      setTimeout(() => loadStations(attempt + 1), 1000);
    }
  }
}

// Теми
const themes = {
  "midnight-lavender": {
    bodyBg: "#000000",
    containerBg: "rgba(203, 182, 255, 0.6)",
    accent: "#C3A8FF",
    text: "#FFFFFF"
  },
  "pure-snow": {
    bodyBg: "#FFFFFF",
    containerBg: "rgba(255, 182, 193, 0.6)",
    accent: "#FF9999",
    text: "#000000"
  },
  "mint-breeze": {
    bodyBg: "#000000",
    containerBg: "rgba(175, 245, 218, 0.6)",
    accent: "#A8E6CF",
    text: "#FFFFFF"
  },
  "peach-sunset": {
    bodyBg: "#FFFFFF",
    containerBg: "rgba(255, 204, 153, 0.6)",
    accent: "#FFCC99",
    text: "#000000"
  },
  "ebony-coral": {
    bodyBg: "#000000",
    containerBg: "rgba(255, 111, 97, 0.6)",
    accent: "#FF8A80",
    text: "#FFFFFF"
  },
  "olive-dark": {
    bodyBg: "#000000",
    containerBg: "rgba(107, 142, 35, 0.6)",
    accent: "#8A9A5B",
    text: "#FFFFFF"
  },
  "steel-dawn": {
    bodyBg: "#FFFFFF",
    containerBg: "rgba(70, 86, 96, 0.6)",
    accent: "#4A6572",
    text: "#000000"
  },
  "charcoal-ember": {
    bodyBg: "#000000",
    containerBg: "rgba(139, 0, 0, 0.6)",
    accent: "#A52A2A",
    text: "#FFFFFF"
  },
  "slate-dark": {
    bodyBg: "#FFFFFF",
    containerBg: "rgba(47, 79, 79, 0.6)",
    accent: "#4682B4",
    text: "#000000"
  },
  "iron-forest": {
    bodyBg: "#000000",
    containerBg: "rgba(34, 53, 38, 0.6)",
    accent: "#355E3B",
    text: "#FFFFFF"
  }
};
let currentTheme = localStorage.getItem("selectedTheme") || "midnight-lavender";

function applyTheme(theme) {
  const root = document.documentElement;
  root.style.setProperty("--body-bg", themes[theme].bodyBg);
  root.style.setProperty("--container-bg", themes[theme].containerBg);
  root.style.setProperty("--accent", themes[theme].accent);
  root.style.setProperty("--text", themes[theme].text);
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem("selectedTheme", theme);
  currentTheme = theme;
}

function toggleTheme() {
  const themesOrder = [
    "midnight-lavender",
    "pure-snow",
    "mint-breeze",
    "peach-sunset",
    "ebony-coral",
    "olive-dark",
    "steel-dawn",
    "charcoal-ember",
    "slate-dark",
    "iron-forest"
  ];
  const nextTheme = themesOrder[(themesOrder.indexOf(currentTheme) + 1) % themesOrder.length];
  applyTheme(nextTheme);
}

// Налаштування Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then(registration => {
    registration.update();
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          if (confirm("Доступна нова версія радіо. Оновити?")) {
            window.location.reload();
          }
        }
      });
    });
  });

  navigator.serviceWorker.addEventListener("message", event => {
    if (event.data.type === "NETWORK_STATUS" && event.data.online && isPlaying && stationItems?.length && currentIndex < stationItems.length) {
      console.log("Отримано повідомлення від Service Worker: мережа відновлена");
      retryCount = 0;
      retryStartTime = null;
      audio.pause();
      audio.src = stationItems[currentIndex].dataset.value;
      tryAutoPlay();
    }
  });
}

function clearRetryTimer() {
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
}

function startRetry() {
  clearInterval(() => {
    if (navigator.onLine && isPlaying && stationItems?.?.length && currentIndex < stationItems?.length && !isAutoPlaying && audio.paused?) {
      console.log("audio play retry (slow)");
      audio.pause();
      audio.src = tryAutoPlay();
    }
  }, SLOW_RETRY);
}

function tryAutoPlay() {
  if (!isPlaying || !stationItems?.length || currentIndex >= stationItems.length || isAutoPlaying) {
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animation = "none");
    return;
  }
  isAutoPlaying = true;
  audio.src = stationItems[currentIndex].dataset.value;
  const playPromise = audio.play();

  playPromise
    .then(() => {
      retryCount = 0;
      retryStartTime = null;
      isAutoPlaying = false;
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animation = "wave 1.5s infinite ease-in-out");
      clearRetryTimer();
    })
    .catch(error => {
      console.error("Playback error:", error);
      isAutoPlaying = false;
      handlePlaybackError();
    });
}

function handlePlaybackError() {
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animation = "none");
  if (!retryStartTime) {
    retryStartTime = setTimeout(() => {
      audio.pause();
      tryAutoPlay();
    }, FAST_RETRY_INTERVAL);
  }
  const elapsedTime = Date.now() - retryStartTime;

  if (elapsedTime < FAST_RETRY_DURATION) {
    retryCount++;
    setTimeout(() => {
      audio.pause();
      tryAutoPlay();
    }, FAST_RETRY_INTERVAL);
  } else {
    retryCount = 0;
    startRetry();
  }
}

function switchTab(tab) {
  if (!["techno", "trance", "ukraine", "best"].includes(tab)) tab = "techno";
  currentTab = tab;
  localStorage.setItem("currentTab", tab);
  const savedIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
  const maxIndex = tab === "best" ? favoriteStations.length : stationLists[tab]?.length || 0;
  currentIndex = savedIndex < maxIndex ? savedIndex : 0;
  updateStationList();
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  const activeBtn = document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`);
  if (activeBtn) activeBtn.classList.add("active");
  if (stationItems?.length && currentIndex < stationItems.length) tryAutoPlay();
}

function updateStationList() {
  stationList.innerHTML = "";
  let stations = currentTab === "best"
    ? favoriteStations
        .map(name => Object.values(stationLists).flat().find(s => s.name === name))
        .filter(s => s)
    : stationLists[currentTab] || [];

  if (!stations.length) {
    currentIndex = 0;
    stationItems = [];
    if (currentTab === "best") {
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "station-item empty";
      emptyMessage.textContent = "Немає улюблених станцій";
      stationList.appendChild(emptyMessage);
    }
    return;
  }

  const favoriteList = currentTab === "best"
    ? stations
    : stations.filter(station => favoriteStations.includes(station.name));
  const nonFavoriteList = currentTab === "best" ? [] : stations.filter(station => !favoriteStations.includes(station.name));
  const sortedStations = [...favoriteList, ...nonFavoriteList];

  sortedStations.forEach((station, index) => {
    const item = document.createElement("div");
    item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
    item.dataset.value = station.value;
    item.dataset.name = station.name;
    item.dataset.genre = station.genre;
    item.dataset.country = station.country;
    item.innerHTML = `${station.emoji} ${station.name}<button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}">★</button>`;
    stationList.appendChild(item);
  });

  stationItems = stationList.querySelectorAll(".station-item");

  stationList.onclick = e => {
    const item = e.target.closest(".station-item");
    const favoriteBtn = e.target.closest(".favorite-btn");
    if (item && !item.classList.contains("empty")) {
      currentIndex = Array.from(stationItems).indexOf(item);
      changeStation(currentIndex);
    }
    if (favoriteBtn) {
      toggleFavorite(favoriteBtn.parentElement.dataset.name);
    }
  };

  if (stationItems.length && currentIndex < stationItems.length) {
    changeStation(currentIndex);
  }
}

function toggleFavorite(stationName) {
  if (favoriteStations.includes(stationName)) {
    favoriteStations = favoriteStations.filter(name => name !== stationName);
  } else {
    favoriteStations.unshift(stationName);
  }
  localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
  if (currentTab === "best") switchTab("best");
  else updateStationList();
}

function changeStation(index) {
  if (index < 0 || index >= stationItems.length || stationItems[index].classList.contains("empty")) return;
  retryCount = 0;
  retryStartTime = null;
  clearRetryTimer();
  const item = stationItems[index];
  stationItems.forEach(i => i.classList.remove("selected"));
  item.classList.add("selected");
  currentIndex = index;
  audio.src = item.dataset.value;
  updateCurrentStationInfo(item);
  localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
  tryAutoPlay();
}

function updateCurrentStationInfo(item) {
  currentStationInfo.querySelector(".station-name").textContent = item.dataset.name || "Немає даних";
  currentStationInfo.querySelector(".station-genre").textContent = `жанр: ${item.dataset.genre || "-"}`;
  currentStationInfo.querySelector(".station-country").textContent = `країна: ${item.dataset.country || "-"}`;
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.dataset.name || "Невідома станція",
      artist: `${item.dataset.genre || "-"} | ${item.dataset.country || "-"}`,
      album: "Radio Music"
    });
  }
}

function prevStation() {
  currentIndex = currentIndex > 0 ? currentIndex - 1 : stationItems.length - 1;
  if (stationItems[currentIndex].classList.contains("empty")) currentIndex = 0;
  changeStation(currentIndex);
}

function nextStation() {
  currentIndex = currentIndex < stationItems.length - 1 ? currentIndex + 1 : 0;
  if (stationItems[currentIndex].classList.contains("empty")) currentIndex = 0;
  changeStation(currentIndex);
}

function togglePlayPause() {
  if (audio.paused) {
    isPlaying = true;
    tryAutoPlay();
    playPauseBtn.textContent = "⏸";
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animation = "wave 1.5s infinite ease-in-out");
  } else {
    audio.pause();
    isPlaying = false;
    playPauseBtn.textContent = "▶";
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animation = "none");
    clearRetryTimer();
  }
  localStorage.setItem("isPlaying", isPlaying);
}

document.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft") prevStation();
  if (e.key === "ArrowRight") nextStation();
  if (e.key === " ") {
    e.preventDefault();
    togglePlayPause();
  }
});

audio.addEventListener("playing", () => {
  isPlaying = true;
  playPauseBtn.textContent = "⏸";
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animation = "wave 1.5s infinite ease-in-out");
  localStorage.setItem("isPlaying", isPlaying);
  clearRetryTimer();
});

audio.addEventListener("pause", () => {
  isPlaying = false;
  playPauseBtn.textContent = "▶";
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animation = "none");
  localStorage.setItem("isPlaying", isPlaying);
  startRetry();
});

audio.addEventListener("error", () => handlePlaybackError());
audio.addEventListener("ended", () => handlePlaybackError());

audio.addEventListener("volumechange", () => {
  localStorage.setItem("volume", audio.volume);
});

window.addEventListener("online", () => {
  console.log("Мережа відновлена (window.online)");
  if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
    retryCount = 0;
    retryStartTime = null;
    audio.pause();
    audio.src = stationItems[currentIndex].dataset.value;
    tryAutoPlay();
  }
  startRetry();
});

window.addEventListener("offline", () => {
  console.log("Втрачено з'єднання з мережею");
  clearRetryTimer();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && isPlaying && navigator.onLine) {
    if (!audio.paused) {
      console.log("Аудіо вже відтворюється, пропускаємо tryAutoPlay");
      return;
    }
    retryCount = 0;
    retryStartTime = null;
    audio.pause();
    audio.srcObject = stationItems[currentIndex].dataset.value;
    tryAutoPlay();
  }
  if (document.hidden && isPlaying && !audio.paused && navigator.onLine) {
    console.log("paused, skipping...");
    startRetry();
  }
});

document.addEventListener("resume", () => {
  if (navigator.onLine && isPlaying) {
    if (!audio.paused) {
      console.log("audio playing after resume, skipping...");
      return;
    }
    retryCount = 0;
    retryStartTime = null;
    audio.pause();
    audio.src = stationItems[currentIndex].dataset.value;
    tryAutoPlay();
  }
});

if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play", togglePlayPause);
  navigator.mediaSession.setActionHandler("pause", togglePlayPause);
  navigator.mediaSession.setActionHandler("previoustrack", prevStation);
  navigator.mediaSession.setActionHandler("nexttrack", nextStation);
}

applyTheme(currentTheme);
loadStations();

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (isPlaying && stationItems?.length && currentIndex < stationItems.length && !stationItems[currentIndex].classList.contains("empty")) {
      tryAutoPlay();
    }
    startRetry();
  }, 0);
});