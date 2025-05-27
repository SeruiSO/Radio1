const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("stationList");
const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
const currentStationInfo = document.getElementById("currentStationInfo");

// Перевірка існування DOM-елементів
if (!audio || !stationList || !playPauseBtn || !currentStationInfo) {
  console.error("Один із необхідних DOM-елементів не знайдено");
  throw new Error("Не вдалося ініціалізувати програму через відсутність DOM-елементів");
}

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
    const response = await fetch("stations.json", {
      cache: "default",
      headers: {
        "If-Modified-Since": localStorage.getItem("stationsLastModified") || ""
      }
    });
    if (response.status === 304) {
      const cachedData = await caches.match("stations.json");
      if (cachedData) {
        stationLists = await cachedData.json();
      } else {
        throw new Error("Кеш не знайдено");
      }
    } else if (response.ok) {
      stationLists = await response.json();
      localStorage.setItem("stationsLastModified", response.headers.get("Last-Modified") || "");
    } else {
      throw new Error(`HTTP ${response.status}`);
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
  "neon-spark": {
    bodyBg: "#0A0A0A",
    containerBg: "#121212",
    accent: "#00D4FF",
    text: "#E0F7FA",
    accentGradient: "#003C4B",
    icon: "⚡️"
  },
  "vapor-pink": {
    bodyBg: "#0A0A0A",
    containerBg: "#121212",
    accent: "#FF2E63",
    text: "#FCE4EC",
    accentGradient: "#4B1A2E",
    icon: "🌸"
  },
  "tech-mint": {
    bodyBg: "#121212",
    containerBg: "#1A1A1A",
    accent: "#64FFDA",
    text: "#B2DFDB",
    accentGradient: "#1A3C4B",
    icon: "💧"
  },
  "pulse-purple": {
    bodyBg: "#0A0A0A",
    containerBg: "#121212",
    accent: "#B388FF",
    text: "#E1BEE7",
    accentGradient: "#2E1A47",
    icon: "🔮"
  },
  "astro-cyan": {
    bodyBg: "#0A0A0A",
    containerBg: "#121212",
    accent: "#18FFFF",
    text: "#E0F7FA",
    accentGradient: "#003C4B",
    icon: "🌠"
  },
  "retro-wave": {
    bodyBg: "#121212",
    containerBg: "#1A1A1A",
    accent: "#FFAB40",
    text: "#FFF9C4",
    accentGradient: "#3C2F2F",
    icon: "📼"
  },
  "night-teal": {
    bodyBg: "#0A0A0A",
    containerBg: "#121212",
    accent: "#26A69A",
    text: "#B2DFDB",
    accentGradient: "#1A3C4B",
    icon: "🌙"
  },
  "glow-indigo": {
    bodyBg: "#121212",
    containerBg: "#1A1A1A",
    accent: "#3F51B5",
    text: "#BBDEFB",
    accentGradient: "#1A2A5B",
    icon: "🌌"
  },
  "future-lime": {
    bodyBg: "#0A0A0A",
    containerBg: "#121212",
    accent: "#B2FF59",
    text: "#E8F5E9",
    accentGradient: "#2E4B2F",
    icon: "🚀"
  },
  "crystal-light": {
    bodyBg: "#F0F4F8",
    containerBg: "#FFFFFF",
    accent: "#40C4FF",
    text: "#212121",
    accentGradient: "#B3E5FC",
    icon: "💎"
  }
};
let currentTheme = localStorage.getItem("selectedTheme") || "neon-spark";

function applyTheme(theme) {
  const root = document.documentElement;
  root.style.setProperty("--body-bg", themes[theme].bodyBg);
  root.style.setProperty("--container-bg", themes[theme].containerBg);
  root.style.setProperty("--accent", themes[theme].accent);
  root.style.setProperty("--text", themes[theme].text);
  root.style.setProperty("--accent-gradient", themes[theme].accentGradient);
  localStorage.setItem("selectedTheme", theme);
  currentTheme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  const themeToggle = document.querySelector(".theme-toggle");
  if (themeToggle) {
    themeToggle.innerHTML = themes[theme].icon;
  }
}

function toggleTheme() {
  const themesOrder = [
    "neon-spark",
    "vapor-pink",
    "tech-mint",
    "pulse-purple",
    "astro-cyan",
    "retro-wave",
    "night-teal",
    "glow-indigo",
    "future-lime",
    "crystal-light"
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
  retryTimer = setInterval(() => {
    if (navigator.onLine && isPlaying && stationItems?.length && currentIndex < stationItems.length && !isAutoPlaying && audio.paused) {
      console.log("Періодична спроба відновлення відтворення");
      audio.pause();
      audio.src = stationItems[currentIndex].dataset.value;
      tryAutoPlay();
    }
  }, SLOW_RETRY_INTERVAL);
}

// Автовідтворення
function tryAutoPlay() {
  if (!navigator.onLine) {
    console.log("Пристрій офлайн, пропускаємо відтворення");
    handlePlaybackError();
    return;
  }
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

// Обробка помилок відтворення
function handlePlaybackError() {
  if (!currentStationInfo) {
    console.error("currentStationInfo не знайдено");
    return;
  }
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
  if (!retryStartTime) {
    retryStartTime = Date.now();
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
  if (stationItems?.length && currentIndex < stationItems.length) tryAutoPlay();
}

// Оновлення списку станцій
function updateStationList() {
  if (!stationList) {
    console.error("stationList не знайдено");
    return;
  }
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
  if (!currentStationInfo) {
    console.error("currentStationInfo не знайдено");
    return;
  }
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
  if (!playPauseBtn || !audio) {
    console.error("playPauseBtn або audio не знайдено");
    return;
  }
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
const eventListeners = {
  keydown: e => {
    if (e.key === "ArrowLeft") prevStation();
    if (e.key === "ArrowRight") nextStation();
    if (e.key === " ") {
      e.preventDefault();
      togglePlayPause();
    }
  },
  visibilitychange: () => {
    if (!document.hidden && isPlaying && navigator.onLine) {
      if (!audio.paused) {
        console.log("Аудіо вже відтворюється, пропускаємо tryAutoPlay");
        return;
      }
      retryCount = 0;
      retryStartTime = null;
      audio.pause();
      audio.src = stationItems[currentIndex].dataset.value;
      tryAutoPlay();
    }
    if (document.hidden && isPlaying && navigator.onLine) {
      if (!audio.paused) {
        console.log("Аудіо відтворюється у фоновому режимі, пропускаємо startRetryTimer");
        return;
      }
      startRetryTimer();
    }
  },
  resume: () => {
    if (isPlaying && navigator.connection?.type !== "none") {
      if (!audio.paused) {
        console.log("Аудіо вже відтворюється після resume, пропускаємо tryAutoPlay");
        return;
      }
      retryCount = 0;
      retryStartTime = null;
      audio.pause();
      audio.src = stationItems[currentIndex].dataset.value;
      tryAutoPlay();
    }
  }
};

// Додаємо слухачі
function addEventListeners() {
  document.addEventListener("keydown", eventListeners.keydown);
  document.addEventListener("visibilitychange", eventListeners.visibilitychange);
  document.addEventListener("resume", eventListeners.resume);
}

// Очищення слухачів
function removeEventListeners() {
  document.removeEventListener("keydown", eventListeners.keydown);
  document.removeEventListener("visibilitychange", eventListeners.visibilitychange);
  document.removeEventListener("resume", eventListeners.resume);
}

// Додаємо слухачі подій
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

audio.addEventListener("volumechange", () => {
  localStorage.setItem("volume", audio.volume);
});

// Моніторинг мережі
window.addEventListener("online", () => {
  console.log("Мережа відновлена (window.online)");
  if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
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
  clearRetryTimer();
});

// Ініціалізація слухачів
addEventListeners();

// Очищення слухачів перед оновленням сторінки
window.addEventListener("beforeunload", () => {
  removeEventListeners();
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
  setTimeout(() => {
    if (isPlaying && stationItems?.length && currentIndex < stationItems.length && !stationItems[currentIndex].classList.contains("empty")) {
      tryAutoPlay();
    }
    if (isPlaying && navigator.onLine && audio.paused) {
      startRetryTimer();
    }
  }, 0);
});