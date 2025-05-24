const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("stationList");
const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
const currentStationInfo = document.getElementById("currentStationInfo");
const errorMessage = document.getElementById("errorMessage");
const networkStatus = document.getElementById("networkStatus");
let currentTab = localStorage.getItem("currentTab") || "techno";
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let stationLists = {};
let stationItems;
let retryCount = 0;
const MAX_RETRIES = 10;
const FAST_RETRY_INTERVAL = 1000; // Спроби кожну секунду
const SLOW_RETRY_INTERVAL = 5000; // Спроби кожні 5 секунд
const FAST_RETRY_DURATION = 10000; // 10 секунд для частих спроб
let isAutoPlaying = false;
let retryTimer = null;
let retryStartTime = null;
const STATIONS_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 хвилин

// Налаштування аудіо
audio.preload = "auto";
audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

// Завантаження станцій
async function loadStations(attempt = 1) {
  try {
    const response = await fetch("stations.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    stationLists = await response.json();
    if (Object.keys(stationLists).length === 0) {
      errorMessage.textContent = "Помилка: Список станцій порожній";
      return;
    }
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
        if (Object.keys(stationLists).length === 0) {
          errorMessage.textContent = "Помилка: Список станцій порожній (кеш)";
          return;
        }
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
    } else {
      errorMessage.textContent = "Не вдалося завантажити станції. Спробуйте пізніше.";
    }
  }
}

// Періодичне оновлення станцій
function refreshStations() {
  if (navigator.onLine) {
    loadStations();
  }
  setTimeout(refreshStations, STATIONS_REFRESH_INTERVAL);
}

// Теми
const themes = {
  "black-metal": { bodyBg: "#1A1A1A", containerBg: "#2A2A2A", accent: "#B0B0B0", text: "#FFFFFF" },
  "deep-blue": { bodyBg: "#0A1D37", containerBg: "#1E3A5F", accent: "#4FC3F7", text: "#E0E7FF" },
  "emerald-green": { bodyBg: "#1A3C34", containerBg: "#2E5C4A", accent: "#4CAF50", text: "#E8F5E9" },
  "pure-white": { bodyBg: "#FFFFFF", containerBg: "#F5F5F5", accent: "#1976D2", text: "#212121" },
  "turquoise-pink": { bodyBg: "#006064", containerBg: "#00838F", accent: "#EC407A", text: "#FFFFFF" }
};
let currentTheme = localStorage.getItem("selectedTheme") || "black-metal";

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
  const themesOrder = ["black-metal", "deep-blue", "emerald-green", "pure-white", "turquoise-pink"];
  const nextTheme = themesOrder[(themesOrder.indexOf(currentTheme) + 1) % 5];
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
    if (event.data.type === "NETWORK_STATUS") {
      networkStatus.textContent = event.data.online ? "Онлайн" : "Офлайн";
      if (event.data.online && isPlaying && stationItems?.length && currentIndex < stationItems.length && audio.paused) {
        console.log("Отримано повідомлення від Service Worker: мережа відновлена");
        retryCount = 0;
        retryStartTime = null;
        audio.pause();
        audio.src = stationItems[currentIndex].dataset.value;
        tryAutoPlay();
      }
    }
  });
}

// Перевірка умов для автовідтворення
function canAutoPlay() {
  return isPlaying && stationItems?.length && currentIndex < stationItems.length && !isAutoPlaying && !stationItems[currentIndex].classList.contains("empty") && audio.paused;
}

// Очищення таймера повторних спроб
function clearRetryTimer() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

// Запуск періодичних перевірок (рекурсивний setTimeout)
function startRetryTimer() {
  clearRetryTimer();
  if (!navigator.onLine || !isPlaying || !stationItems?.length || !audio.paused) return;
  retryTimer = setTimeout(() => {
    if (canAutoPlay()) {
      console.log("Періодична спроба відновлення відтворення (повільний режим)");
      audio.pause();
      audio.src = stationItems[currentIndex].dataset.value;
      tryAutoPlay();
    }
    startRetryTimer();
  }, SLOW_RETRY_INTERVAL);
}

// Автовідтворення
function tryAutoPlay() {
  if (!canAutoPlay()) {
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    errorMessage.textContent = "";
    return;
  }
  isAutoPlaying = true;
  audio.src = stationItems[currentIndex].dataset.value;
  setTimeout(() => {
    const playPromise = audio.play();
    playPromise
      .then(() => {
        retryCount = 0;
        retryStartTime = null;
        isAutoPlaying = false;
        errorMessage.textContent = "";
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
        clearRetryTimer();
      })
      .catch(error => {
        console.error("Помилка відтворення:", error);
        isAutoPlaying = false;
        handlePlaybackError();
      });
  }, 500); // Затримка 500 мс для Bluetooth
}

// Обробка помилок відтворення
function handlePlaybackError() {
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
  if (!retryStartTime) {
    retryStartTime = Date.now();
  }
  const elapsedTime = Date.now() - retryStartTime;

  if (retryCount < MAX_RETRIES && elapsedTime < FAST_RETRY_DURATION) {
    retryCount++;
    errorMessage.textContent = `Спроба відтворення ${retryCount}/${MAX_RETRIES}`;
    setTimeout(() => {
      audio.pause();
      tryAutoPlay();
    }, FAST_RETRY_INTERVAL);
  } else {
    errorMessage.textContent = "Не вдалося відтворити. Оберіть іншу станцію.";
    retryCount = 0;
    startRetryTimer();
  }
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
  if (stationItems?.length && currentIndex < stationItems.length && audio.paused) tryAutoPlay();
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
    errorMessage.textContent = "Список станцій порожній";
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

  // Видаляємо попередній слухач
  stationList.onclick = null;
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
  clearRetryTimer();
  errorMessage.textContent = "";
  const item = stationItems[index];
  stationItems.forEach(i => i.classList.remove("selected"));
  item.classList.add("selected");
  currentIndex = index;
  audio.src = item.dataset.value;
  updateCurrentStationInfo(item);
  localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
  if (audio.paused) tryAutoPlay();
}

// Оновлення інформації про станцію
function updateCurrentStationInfo(item) {
  currentStationInfo.querySelector(".station-name").textContent = item.dataset.name || "Немає даних";
  currentStationInfo.querySelector(".station-genre").textContent = `жанр: ${item.dataset.genre || "-"}`;
  currentStationInfo.querySelector(".station-country").textContent = `країна: ${item.dataset.country || "-"}`;
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.dataset.name || "Невідома станція",
      artist: item.dataset.genre || "-"
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
  } else {
    audio.pause();
    isPlaying = false;
    playPauseBtn.textContent = "▶";
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    clearRetryTimer();
  }
  localStorage.setItem("isPlaying", isPlaying);
}

function stopPlayback() {
  audio.pause();
  audio.src = "";
  isPlaying = false;
  playPauseBtn.textContent = "▶";
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
  clearRetryTimer();
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
  errorMessage.textContent = "";
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

audio.addEventListener("volumechange", () => {
  localStorage.setItem("volume", audio.volume);
});

// Моніторинг мережі
window.addEventListener("online", () => {
  console.log("Мережа відновлена (window.online)");
  networkStatus.textContent = "Онлайн";
  if (isPlaying && stationItems?.length && currentIndex < stationItems.length && audio.paused) {
    retryCount = 0;
    retryStartTime = null;
    audio.pause();
    audio.src = stationItems[currentIndex].dataset.value;
    tryAutoPlay();
  }
  startRetryTimer();
});

window.addEventListener("offline", () => {
  console.log("Втрачено з'єднання з мережею");
  networkStatus.textContent = "Офлайн";
  if (isPlaying && stationItems?.length && currentIndex < stationItems.length && audio.paused) {
    retryCount = 0;
    retryStartTime = null;
    audio.pause();
    audio.src = stationItems[currentIndex].dataset.value;
    tryAutoPlay();
  }
});

// Обробка зміни видимості
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && isPlaying && navigator.onLine && audio.paused) {
    retryCount = 0;
    retryStartTime = null;
    audio.pause();
    audio.src = stationItems[currentIndex].dataset.value;
    tryAutoPlay();
  }
  if (document.hidden && isPlaying && navigator.onLine && audio.paused) {
    retryCount = 0;
    retryStartTime = null;
    audio.pause();
    audio.src = stationItems[currentIndex].dataset.value;
    tryAutoPlay();
  }
});

// Обробка переривань (наприклад, дзвінки)
document.addEventListener("resume", () => {
  if (isPlaying && navigator.connection?.type !== "none" && audio.paused) {
    retryCount = 0;
    retryStartTime = null;
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
  navigator.mediaSession.setActionHandler("stop", stopPlayback);
}

// Ініціалізація
applyTheme(currentTheme);
loadStations();
refreshStations();
networkStatus.textContent = navigator.onLine ? "Онлайн" : "Офлайн";

// Автовідтворення при завантаженні сторінки
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (isPlaying && stationItems?.length && currentIndex < stationItems.length && !stationItems[currentIndex].classList.contains("empty") && audio.paused) {
      tryAutoPlay();
    }
    if (isPlaying && navigator.onLine && audio.paused) {
      startRetryTimer();
    }
  }, 0);
});