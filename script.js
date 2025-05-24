const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("stationList");
const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
const currentStationInfo = document.getElementById("currentStationInfo");
let currentTab = localStorage.getItem("currentTab") || "techno";
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let stationLists = {};
let stationItems;
let retryCount = 0;
const MAX_FAST_RETRIES = 10; // 10 спроб кожну секунду
const MAX_MEDIUM_RETRIES = 10; // 10 спроб кожні 2 секунди
const MAX_SLOW_RETRIES = 8; // 8 спроб кожні 5 секунд (до 1 хвилини)
const FAST_RETRY_INTERVAL = 1000; // 1 секунда
const MEDIUM_RETRY_INTERVAL = 2000; // 2 секунди
const SLOW_RETRY_INTERVAL = 5000; // 5 секунд
let isAutoPlaying = false;
let retryTimer = null;
let retryStartTime = null;
let retryPhase = "fast"; // fast, medium, slow

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
    updateNetworkIndicator(true); // Онлайн після успішного завантаження
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
        updateNetworkIndicator(false); // Офлайн, якщо використовується кеш
        return;
      }
    }
    if (attempt < 3) {
      setTimeout(() => loadStations(attempt + 1), 1000);
    } else {
      updateNetworkIndicator(false);
    }
  }
}

// Теми
const themes = {
  midnightBlue: { bodyBg: "#1A2533", containerBg: "#2C3A4D", accent: "#3B82F6", text: "#E5E7EB" },
  softIvory: { bodyBg: "#F8F1E9", containerBg: "#EDE4DA", accent: "#6EE7B7", text: "#1F2937" },
  slateGray: { bodyBg: "#2D3748", containerBg: "#4B5563", accent: "#F97316", text: "#D1D5DB" },
  deepCharcoal: { bodyBg: "#111827", containerBg: "#1F2937", accent: "#EF4444", text: "#E5E7EB" },
  mutedLavender: { bodyBg: "#EDE9FE", containerBg: "#DDD6FE", accent: "#1E3A8A", text: "#1F2937" }
};
let currentTheme = localStorage.getItem("selectedTheme") || "midnightBlue";

function applyTheme(theme) {
  const root = document.documentElement;
  root.style.setProperty("--body-bg", themes[theme].bodyBg);
  root.style.setProperty("--container-bg", themes[theme].containerBg);
  root.style.setProperty("--accent", themes[theme].accent);
  root.style.setProperty("--text", themes[theme].text);
  localStorage.setItem("selectedTheme", theme);
  currentTheme = theme;
}

function toggleTheme() {
  const themesOrder = ["midnightBlue", "softIvory", "slateGray", "deepCharcoal", "mutedLavender"];
  const nextTheme = themesOrder[(themesOrder.indexOf(currentTheme) + 1) % themesOrder.length];
  applyTheme(nextTheme);
}

// Індикатор мережі
function updateNetworkIndicator(online) {
  const indicator = currentStationInfo.querySelector(".network-indicator") || document.createElement("span");
  indicator.className = "network-indicator";
  indicator.textContent = online ? "🟢" : "🔴";
  if (!currentStationInfo.querySelector(".network-indicator")) {
    currentStationInfo.querySelector(".station-info-content").appendChild(indicator);
  }
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
      retryPhase = "fast";
      audio.pause();
      audio.src = stationItems[currentIndex].dataset.value;
      tryAutoPlay();
      updateNetworkIndicator(true);
    } else if (event.data.type === "NETWORK_STATUS" && !event.data.online) {
      updateNetworkIndicator(false);
    }
  });
}

// Очищення таймера повторних спроб
function clearRetryTimer() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

// Запуск періодичних перевірок
function startRetryTimer() {
  clearRetryTimer();
  if (retryPhase === "fast" && retryCount < MAX_FAST_RETRIES) {
    retryTimer = setTimeout(() => {
      retryCount++;
      tryAutoPlay();
    }, FAST_RETRY_INTERVAL);
  } else if (retryPhase === "medium" && retryCount < MAX_MEDIUM_RETRIES) {
    retryTimer = setTimeout(() => {
      retryCount++;
      tryAutoPlay();
    }, MEDIUM_RETRY_INTERVAL);
  } else if (retryPhase === "slow" && retryCount < MAX_SLOW_RETRIES) {
    retryTimer = setTimeout(() => {
      retryCount++;
      tryAutoPlay();
    }, SLOW_RETRY_INTERVAL);
  } else {
    showPlaybackError();
  }
}

// Показ сповіщення про помилку
function showPlaybackError() {
  const errorMessage = currentStationInfo.querySelector(".error-message") || document.createElement("div");
  errorMessage.className = "error-message";
  errorMessage.textContent = "Не вдалося відновити відтворення. Спробуйте іншу станцію.";
  errorMessage.style.color = "#FF5555";
  errorMessage.style.marginTop = "5px";
  if (!currentStationInfo.querySelector(".error-message")) {
    currentStationInfo.appendChild(errorMessage);
  }
}

// Автовідтворення
function tryAutoPlay() {
  if (!isPlaying || !stationItems?.length || currentIndex >= stationItems.length || isAutoPlaying) {
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    return;
  }
  isAutoPlaying = true;
  audio.src = stationItems[currentIndex].dataset.value;
  const playPromise = audio.play();

  playPromise
    .then(() => {
      retryCount = 0;
      retryStartTime = null;
      retryPhase = "fast";
      isAutoPlaying = false;
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
      clearRetryTimer();
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "playing";
      }
    })
    .catch(error => {
      console.error("Помилка відтворення:", error);
      isAutoPlaying = false;
      handlePlaybackError();
    });
}

// Обробка помилок відтворення
function handlePlaybackError() {
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
  if (!retryStartTime) {
    retryStartTime = Date.now();
    retryCount = 0;
    retryPhase = "fast";
  }

  const elapsedTime = Date.now() - retryStartTime;
  if (elapsedTime < MAX_FAST_RETRIES * FAST_RETRY_INTERVAL) {
    retryPhase = "fast";
  } else if (elapsedTime < (MAX_FAST_RETRIES * FAST_RETRY_INTERVAL + MAX_MEDIUM_RETRIES * MEDIUM_RETRY_INTERVAL)) {
    retryPhase = "medium";
    if (retryCount >= MAX_FAST_RETRIES) retryCount = 0;
  } else {
    retryPhase = "slow";
    if (retryCount >= MAX_MEDIUM_RETRIES) retryCount = 0;
  }

  audio.pause();
  startRetryTimer();
}

// Перемикання вкладок
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

// Оновлення списку станцій
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
    item.innerHTML = `${station.name}<button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}">★</button>`;
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

// Перемикання улюблених станцій
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

// Зміна станції
function changeStation(index) {
  if (index < 0 || index >= stationItems.length || stationItems[index].classList.contains("empty")) return;
  retryCount = 0;
  retryStartTime = null;
  retryPhase = "fast";
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

// Оновлення інформації про станцію
function updateCurrentStationInfo(item) {
  currentStationInfo.querySelector(".station-name").textContent = item.dataset.name || "Немає даних";
  currentStationInfo.querySelector(".station-genre").textContent = `жанр: ${item.dataset.genre || "-"}`;
  currentStationInfo.querySelector(".station-country").textContent = `країна: ${item.dataset.country || "-"}`;
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: (item.dataset.name || "Невідома станція").substring(0, 30),
      artist: item.dataset.country || "-",
      album: "Radio Music",
      artwork: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }]
    });
  }
}

// Керування відтворенням
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
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "playing";
    }
  } else {
    audio.pause();
    isPlaying = false;
    playPauseBtn.textContent = "▶";
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    clearRetryTimer();
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }
  }
  localStorage.setItem("isPlaying", isPlaying);
}

// Обробники подій
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
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
  localStorage.setItem("isPlaying", isPlaying);
  clearRetryTimer();
  if ("mediaSession" in navigator) {
    navigator.mediaSession.playbackState = "playing";
  }
});

audio.addEventListener("pause", () => {
  isPlaying = false;
  playPauseBtn.textContent = "▶";
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
  localStorage.setItem("isPlaying", isPlaying);
  startRetryTimer();
  if ("mediaSession" in navigator) {
    navigator.mediaSession.playbackState = "paused";
  }
});

audio.addEventListener("canplay", () => {
  if (isPlaying && !isAutoPlaying) {
    tryAutoPlay();
  }
});

audio.addEventListener("error", () => handlePlaybackError());
audio.addEventListener("ended", () => handlePlaybackError());

audio.addEventListener("volumechange", () => {
  localStorage.setItem("volume", audio.volume);
});

// Моніторинг мережі
window.addEventListener("online", () => {
  console.log("Мережа відновлена (window.online)");
  updateNetworkIndicator(true);
  if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
    retryCount = 0;
    retryStartTime = null;
    retryPhase = "fast";
    audio.pause();
    audio.src = stationItems[currentIndex].dataset.value;
    tryAutoPlay();
  }
});

window.addEventListener("offline", () => {
  console.log("Втрачено з'єднання з мережею");
  updateNetworkIndicator(false);
  clearRetryTimer();
});

// Обробка зміни видимості
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && isPlaying && navigator.onLine && audio.paused) {
    retryCount = 0;
    retryStartTime = null;
    retryPhase = "fast";
    audio.pause();
    audio.src = stationItems[currentIndex].dataset.value;
    tryAutoPlay();
  }
});

// Обробка переривань
document.addEventListener("resume", () => {
  if (isPlaying && navigator.connection?.type !== "none" && audio.paused) {
    retryCount = 0;
    retryStartTime = null;
    retryPhase = "fast";
    audio.pause();
    audio.src = stationItems[currentIndex].dataset.value;
    tryAutoPlay();
  }
});

// Media Session API
if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play", togglePlayPause);
  navigator.mediaSession.setActionHandler("pause", togglePlayPause);
  navigator.mediaSession.setActionHandler("previoustrack", prevStation);
  navigator.mediaSession.setActionHandler("nexttrack", nextStation);
  navigator.mediaSession.setActionHandler("seekforward", nextStation);
  navigator.mediaSession.setActionHandler("seekbackward", prevStation);
}

// Ініціалізація
applyTheme(currentTheme);
loadStations();

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (isPlaying && stationItems?.length && currentIndex < stationItems.length && !stationItems[currentIndex].classList.contains("empty")) {
      tryAutoPlay();
    }
    if (isPlaying && navigator.onLine && audio.paused) {
      startRetryTimer();
    }
  }, 0);
});