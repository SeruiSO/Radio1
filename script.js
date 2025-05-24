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
let retryStartTime = null;
let isAutoPlaying = false;
let retryTimer = null;

// Налаштування графіку повторних спроб
const RETRY_SCHEDULE = [
  { duration: 15000, interval: 1000 }, // 15 сек щосекунди
  { duration: 15000, interval: 2000 }, // 15 сек кожні 2 сек
  { duration: 30000, interval: 5000 }  // 30 сек кожні 5 сек
];

// Налаштування аудіо
audio.preload = "auto";
audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

// Завантаження станцій
async function loadStations(attempt = 1) {
  try {
    const response = await fetch("stations.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    stationLists = await response.json();
    initializeStations();
  } catch (error) {
    console.error("Помилка завантаження станцій (спроба " + attempt + "):", error);
    if ("caches" in window) {
      const cacheResponse = await caches.match("stations.json");
      if (cacheResponse) {
        stationLists = await cacheResponse.json();
        initializeStations();
        return;
      }
    }
    if (attempt < 2) {
      setTimeout(() => loadStations(attempt + 1), 1000);
    } else {
      console.error("Не вдалося завантажити станції");
    }
  }
}

function initializeStations() {
  const validTabs = [...Object.keys(stationLists), "best"];
  if (!validTabs.includes(currentTab)) {
    currentTab = validTabs[0] || "techno";
    localStorage.setItem("currentTab", currentTab);
  }
  currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
  switchTab(currentTab);
}

// Теми
const themes = {
  dark: { bodyBg: "#000000", containerBg: "#252525", accent: "#4682b4", text: "#f5f5f5" },
  light: { bodyBg: "#e8ecef", containerBg: "#ffffff", accent: "#1e90ff", text: "#212121" },
  neon: { bodyBg: "#000000", containerBg: "#1a1a2e", accent: "#40c4b4", text: "#e8e8e8" },
  softBlue: { bodyBg: "#000000", containerBg: "#1a1a1a", accent: "#0288d1", text: "#e6f0fa" },
  mutedGreen: { bodyBg: "#000000", containerBg: "#1a1a1a", accent: "#4caf50", text: "#e6f5e6" },
  pastelPink: { bodyBg: "#000000", containerBg: "#1a1a1a", accent: "#f48fb1", text: "#f5e6e6" },
  lavenderGlow: { bodyBg: "#000000", containerBg: "#1a1a1a", accent: "#9575cd", text: "#f0e6fa" },
  aquaMist: { bodyBg: "#000000", containerBg: "#1a1a1a", accent: "#26a69a", text: "#e6f5f5" }
};
let currentTheme = localStorage.getItem("selectedTheme") || "dark";

function applyTheme(theme) {
  const root = document.documentElement;
  root.style.setProperty("--body-bg", themes[theme].bodyBg);
  root.style.setProperty("--container-bg", themes[theme].containerBg);
  root.style.setProperty("--accent", themes[theme].accent);
  root.style.setProperty("--text", themes[theme].text);
  localStorage.setItem("selectedTheme", theme);
  currentTheme = theme;
  document.documentElement.setAttribute("data-theme", theme);
}

function toggleTheme() {
  const themesOrder = ["dark", "light", "neon", "softBlue", "mutedGreen", "pastelPink", "lavenderGlow", "aquaMist"];
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
      retryStartTime = Date.now();
      audio.pause();
      audio.src = stationItems[currentIndex].dataset.value;
      tryAutoPlay();
    }
  });
}

// Очищення таймера повторних спроб
function clearRetryTimer() {
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
}

// Запуск періодичних перевірок
function startRetryTimer() {
  clearRetryTimer();
  let phaseIndex = 0;
  let phaseStartTime = Date.now();

  retryTimer = setInterval(() => {
    const elapsedTotal = Date.now() - retryStartTime;
    const currentPhase = RETRY_SCHEDULE[phaseIndex];
    const phaseElapsed = Date.now() - phaseStartTime;

    if (phaseElapsed >= currentPhase.duration && phaseIndex < RETRY_SCHEDULE.length - 1) {
      phaseIndex++;
      phaseStartTime = Date.now();
    }

    if (elapsedTotal >= 60000) {
      clearRetryTimer();
      console.log("Досягнуто ліміт повторних спроб (1 хвилина)");
      return;
    }

    if (navigator.onLine && isPlaying && stationItems?.length && currentIndex < stationItems.length && !isAutoPlaying && audio.paused) {
      console.log(`Спроба відновлення (фаза ${phaseIndex + 1}, інтервал ${currentPhase.interval}ms)`);
      audio.pause();
      audio.src = stationItems[currentIndex].dataset.value;
      tryAutoPlay();
    }
  }, RETRY_SCHEDULE[phaseIndex].interval);
}

// Автовідтворення
function tryAutoPlay() {
  if (!isPlaying || !stationItems?.length || currentIndex >= stationItems.length || isAutoPlaying) {
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    return;
  }
  if (!audio.paused) {
    console.log("Аудіо вже відтворюється, пропускаємо tryAutoPlay");
    return;
  }
  isAutoPlaying = true;
  audio.src = stationItems[currentIndex].dataset.value;
  const playPromise = audio.play();

  playPromise
    .then(() => {
      retryStartTime = null;
      isAutoPlaying = false;
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
      clearRetryTimer();
      preloadNextStation();
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
  if (!retryStartTime) retryStartTime = Date.now();
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

// Перемикання улюблених станцій
function toggleFavorite(stationName) {
  if (favoriteStations.includes(stationName)) {
    favoriteStations = favoriteStations.filter(name => name !== stationName);
  } else if (favoriteStations.length < 20) {
    favoriteStations.unshift(stationName);
  } else {
    console.warn("Досягнуто ліміт улюблених станцій");
    return;
  }
  localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
  if (currentTab === "best") switchTab("best");
  else updateStationList();
}

// Зміна станції
function changeStation(index) {
  if (index < 0 || index >= stationItems.length || stationItems[index].classList.contains("empty")) return;
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

// Оновлення інформації про станцію
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

// Попереднє завантаження наступної станції
function preloadNextStation() {
  if (stationItems?.length && currentIndex < stationItems.length - 1) {
    const nextAudio = new Audio(stationItems[currentIndex + 1].dataset.value);
    nextAudio.preload = "auto";
    nextAudio.load();
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
  } else {
    audio.pause();
    isPlaying = false;
    playPauseBtn.textContent = "▶";
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    clearRetryTimer();
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
});

audio.addEventListener("pause", () => {
  isPlaying = false;
  playPauseBtn.textContent = "▶";
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
  localStorage.setItem("isPlaying", isPlaying);
  startRetryTimer();
});

audio.addEventListener("error", () => handlePlaybackError());
audio.addEventListener("ended", () => handlePlaybackError());
audio.addEventListener("waiting", () => {
  console.log("Аудіо в очікуванні (можливо, зміна пристрою)");
  if (isPlaying) {
    retryStartTime = Date.now();
    startRetryTimer();
  }
});
audio.addEventListener("canplay", () => {
  if (isPlaying && !isAutoPlaying && audio.paused) {
    tryAutoPlay();
  }
});
audio.addEventListener("stalled", () => {
  console.log("Потік зупинено (Bluetooth або мережа)");
  handlePlaybackError();
});

audio.addEventListener("volumechange", () => {
  localStorage.setItem("volume", audio.volume);
});

// Моніторинг мережі
window.addEventListener("online", () => {
  console.log("Мережа відновлена");
  if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
    retryStartTime = Date.now();
    audio.pause();
    audio.src = stationItems[currentIndex].dataset.value;
    tryAutoPlay();
  }
});

window.addEventListener("offline", () => {
  console.log("Втрачено з'єднання з мережею");
  clearRetryTimer();
});

// Обробка зміни видимості
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && isPlaying && navigator.onLine) {
    if (!audio.paused) {
      console.log("Аудіо вже відтворюється, пропускаємо tryAutoPlay");
      return;
    }
    retryStartTime = Date.now();
    audio.pause();
    audio.src = stationItems[currentIndex].dataset.value;
    tryAutoPlay();
  } else if (document.hidden && isPlaying && navigator.onLine) {
    if (!audio.paused) {
      console.log("Аудіо відтворюється у фоновому режимі, пропускаємо startRetryTimer");
      return;
    }
    startRetryTimer();
  }
});

// Обробка переривань (наприклад, дзвінки)
document.addEventListener("resume", () => {
  if (isPlaying && navigator.connection?.type !== "none") {
    if (!audio.paused) {
      console.log("Аудіо вже відтворюється після resume, пропускаємо tryAutoPlay");
      return;
    }
    retryStartTime = Date.now();
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
}

// Ініціалізація
applyTheme(currentTheme);
loadStations();

// Автовідтворення при завантаженні сторінки
document.addEventListener("DOMContentLoaded", () => {
  if (isPlaying && stationItems?.length && currentIndex < stationItems.length && !stationItems[currentIndex].classList.contains("empty")) {
    tryAutoPlay();
  } else if (isPlaying && navigator.onLine && audio.paused) {
    startRetryTimer();
  }
});