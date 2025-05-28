// Ініціалізація змінних
let currentTab = localStorage.getItem("currentTab") || "techno";
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let stationLists = {};
let stationItems = [];
let isAutoPlaying = false;
let lastPlayPromise = null;
let changeStationTimeout = null;

// DOM-елементи
const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("stationList");
const playPauseBtn = document.querySelector(".play-pause-btn");
const prevBtn = document.querySelector(".prev-btn");
const nextBtn = document.querySelector(".next-btn");
const currentStationInfo = document.querySelector(".current-station-info");
const networkStatus = currentStationInfo?.querySelector(".network-status");
const themeToggle = document.querySelector(".theme-toggle");
const tabButtons = document.querySelectorAll(".tab-btn");

// Перевірка існування DOM-елементів
if (!audio || !stationList || !playPauseBtn || !prevBtn || !nextBtn || !currentStationInfo || !networkStatus || !themeToggle || !tabButtons.length) {
  console.error("Один із необхідних DOM-елементів не знайдено");
  throw new Error("Не вдалося ініціалізувати програму через відсутність DOM-елементів");
}

// Налаштування аудіо
audio.preload = "auto";
audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

// Валідація localStorage
function validateLocalStorage() {
  const validTabs = ["techno", "trance", "ukraine", "best"];
  if (!validTabs.includes(localStorage.getItem("currentTab"))) {
    localStorage.removeItem("currentTab");
  }
  for (const tab of validTabs) {
    const lastStation = localStorage.getItem(`lastStation_${tab}`);
    if (lastStation && isNaN(parseInt(lastStation))) {
      localStorage.removeItem(`lastStation_${tab}`);
    }
  }
  const favoriteStations = JSON.parse(localStorage.getItem("favoriteStations") || "[]");
  if (!Array.isArray(favoriteStations)) {
    localStorage.setItem("favoriteStations", "[]");
  }
}
validateLocalStorage();

// Завантаження станцій з повторними спробами
async function loadStations(attempt = 1, maxAttempts = 3) {
  console.time("loadStations");
  stationList.classList.add("loading");
  stationList.innerHTML = "<div class='station-item empty'>Завантаження...</div>";
  try {
    const response = await fetch("stations.json", {
      cache: "no-cache",
      headers: {
        "If-Modified-Since": localStorage.getItem("stationsLastModified") || ""
      }
    });
    console.log(`Статус відповіді: ${response.status}`);
    if (response.status === 304) {
      const cachedData = await caches.match("stations.json");
      if (cachedData) {
        stationLists = await cachedData.json();
        console.log("Використовується кешована версія stations.json");
      } else {
        throw new Error("Кеш не знайдено");
      }
    } else if (response.ok) {
      stationLists = await response.json();
      if (!stationLists || typeof stationLists !== "object" || !Object.keys(stationLists).length) {
        throw new Error("Некоректна структура stations.json");
      }
      for (const tab of Object.keys(stationLists)) {
        if (!Array.isArray(stationLists[tab]) || stationLists[tab].some(station => !station.value || !station.name)) {
          throw new Error(`Некоректні дані у вкладці ${tab}`);
        }
      }
      localStorage.setItem("stationsLastModified", response.headers.get("Last-Modified") || "");
      console.log("Новий stations.json успішно завантажено");
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
    updateNetworkStatus("Онлайн");
  } catch (error) {
    console.error(`Помилка завантаження станцій (спроба ${attempt}):`, error);
    if (attempt < maxAttempts) {
      setTimeout(() => loadStations(attempt + 1, maxAttempts), 5000);
      updateNetworkStatus("Відновлення з’єднання");
    } else {
      stationList.innerHTML = `
        <div class='station-item empty'>
          Не вдалося завантажити станції
          <button onclick="loadStations()" style="margin-left: 10px; padding: 5px 10px; background: var(--accent); color: #0A0A0A; border: none; border-radius: 5px; cursor: pointer;">
            Спробувати ще раз
          </button>
        </div>`;
      updateNetworkStatus("Офлайн");
    }
  } finally {
    console.timeEnd("loadStations");
    stationList.classList.remove("loading");
  }
}

// Оновлення статусу мережі
function updateNetworkStatus(status) {
  if (!networkStatus) return;
  networkStatus.textContent = status;
  networkStatus.classList.remove("offline", "reconnecting");
  if (status === "Офлайн") {
    networkStatus.classList.add("offline");
  } else if (status === "Відновлення з’єднання") {
    networkStatus.classList.add("reconnecting");
  }
}

// Теми
const themes = {
  "neon-pulse": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#00F0FF", text: "#F0F0F0", accentGradient: "#003C4B" },
  "lime-surge": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#B2FF59", text: "#E8F5E9", accentGradient: "#2E4B2F" },
  "flamingo-flash": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#FF4081", text: "#FCE4EC", accentGradient: "#4B1A2E" },
  "violet-vortex": { bodyBg: "#121212", containerBg: "#1A1A1A", accent: "#7C4DFF", text: "#EDE7F6", accentGradient: "#2E1A47" },
  "aqua-glow": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#26C6DA", text: "#B2EBF2", accentGradient: "#1A3C4B" },
  "cosmic-indigo": { bodyBg: "#121212", containerBg: "#1A1A1A", accent: "#3F51B5", text: "#BBDEFB", accentGradient: "#1A2A5A" },
  "mystic-jade": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#26A69A", text: "#B2DFDB", accentGradient: "#1A3C4B" },
  "aurora-haze": { bodyBg: "#121212", containerBg: "#1A1A1A", accent: "#64FFDA", text: "#E0F7FA", accentGradient: "#1A4B4B" },
  "starlit-amethyst": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#B388FF", text: "#E1BEE7", accentGradient: "#2E1A47" },
  "lunar-frost": { bodyBg: "#F5F7FA", containerBg: "#FFFFFF", accent: "#40C4FF", text: "#212121", accentGradient: "#B3E5FC" }
};
let currentTheme = localStorage.getItem("selectedTheme") || "neon-pulse";

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
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", themes[theme].accent);
  }
}

function toggleTheme() {
  const themesOrder = [
    "neon-pulse", "lime-surge", "flamingo-flash", "violet-vortex", "aqua-glow",
    "cosmic-indigo", "mystic-jade", "aurora-haze", "starlit-amethyst", "lunar-frost"
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
    if (event.data.type === "NETWORK_STATUS") {
      updateNetworkStatus(event.data.online ? "Онлайн" : "Офлайн");
      if (event.data.online && isPlaying && stationItems?.length && currentIndex < stationItems.length) {
        console.log("Мережа відновлена, перезапуск відтворення");
        audio.pause();
        audio.src = stationItems[currentIndex].dataset.value;
        tryAutoPlay();
      }
    } else if (event.data.type === "NETWORK_RECONNECT" || event.data.type === "BLUETOOTH_RECONNECT") {
      console.log(`Отримано повідомлення від Service Worker: ${event.data.type}`);
      tryAutoPlay();
    }
  });
}

// Автовідтворення
function tryAutoPlay() {
  if (!navigator.onLine) {
    console.log("Пристрій офлайн, пропускаємо відтворення");
    return;
  }
  if (!isPlaying || !stationItems?.length || currentIndex >= stationItems.length || isAutoPlaying || !audio.paused) {
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    return;
  }
  isAutoPlaying = true;

  // Скасувати попередній запит відтворення
  if (lastPlayPromise) {
    audio.pause();
  }

  audio.src = stationItems[currentIndex].dataset.value;
  const playPromise = audio.play();
  lastPlayPromise = playPromise;

  playPromise
    .then(() => {
      isAutoPlaying = false;
      isPlaying = true;
      playPauseBtn.textContent = "⏸";
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
      localStorage.setItem("isPlaying", isPlaying);
      localStorage.setItem("lastActivity", Date.now());
      updateNetworkStatus("Онлайн");
      lastPlayPromise = null;
    })
    .catch(error => {
      if (error.name === "NotAllowedError") {
        console.warn("Автовідтворення заблоковано браузером:", error);
      } else if (error.name !== "AbortError") {
        console.error("Помилка відтворення:", error);
      }
      isAutoPlaying = false;
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
      // Не змінювати статус мережі для AbortError
      if (error.name !== "AbortError" && !navigator.onLine) {
        updateNetworkStatus("Офлайн");
      }
      lastPlayPromise = null;
      if (document.hidden && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "REQUEST_RECONNECT",
          reason: error.name === "NotAllowedError" ? "media" : "network"
        });
      }
    });
}

// Відстеження підключення Bluetooth
function setupBluetooth() {
  if ("mediaDevices" in navigator) {
    navigator.mediaDevices.ondevicechange = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter(device => device.kind === "audiooutput");
        const hasBluetooth = audioOutputs.some(device => device.label.toLowerCase().includes("bluetooth"));
        if (hasBluetooth && stationItems?.length && currentIndex < stationItems.length) {
          console.log("Виявлено підключення Bluetooth-пристрою");
          localStorage.setItem("lastActivity", Date.now());
          if (!isPlaying) {
            isPlaying = true;
            tryAutoPlay();
          }
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: "BLUETOOTH_STATUS",
              connected: true
            });
          }
        } else if (!hasBluetooth) {
          console.log("Bluetooth-пристрій відключено");
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: "BLUETOOTH_STATUS",
              connected: false
            });
          }
        }
      } catch (error) {
        console.error("Помилка при відстеженні аудіопристроїв:", error);
      }
    };
  }

  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", () => {
      if (stationItems?.length && currentIndex < stationItems.length) {
        console.log("Команда 'play' із Bluetooth-пристрою");
        isPlaying = true;
        localStorage.setItem("lastActivity", Date.now());
        tryAutoPlay();
      }
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      audio.pause();
      isPlaying = false;
      playPauseBtn.textContent = "▶";
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
      localStorage.setItem("isPlaying", isPlaying);
    });
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
  const activeBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  if (activeBtn) activeBtn.classList.add("active");
  if (stationItems?.length && currentIndex < stationItems.length) tryAutoPlay();
}

// Оновлення списку станцій
function updateStationList() {
  if (!stationList) {
    console.error("stationList не знайдено");
    return;
  }

  let stations = currentTab === "best"
    ? favoriteStations
        .map(name => Object.values(stationLists).flat().find(s => s.name === name))
        .filter(s => s)
    : stationLists[currentTab] || [];

  if (!stations.length) {
    currentIndex = 0;
    stationItems = [];
    stationList.innerHTML = `<div class='station-item empty'>${currentTab === "best" ? "Немає улюблених станцій" : "Немає станцій у цій категорії"}</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  stations.forEach((station, index) => {
    const item = document.createElement("div");
    item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
    item.dataset.value = station.value;
    item.dataset.name = station.name;
    item.dataset.genre = station.genre;
    item.dataset.country = station.country;
    item.innerHTML = `${station.emoji} ${station.name}<button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}">★</button>`;
    fragment.appendChild(item);
  });
  stationList.innerHTML = "";
  stationList.appendChild(fragment);
  stationItems = stationList.querySelectorAll(".station-item");

  stationList.onclick = e => {
    const favoriteBtn = e.target.closest(".favorite-btn");
    if (favoriteBtn) {
      toggleFavorite(favoriteBtn.parentElement.dataset.name);
      return;
    }
    const item = e.target.closest(".station-item");
    if (item && !item.classList.contains("empty")) {
      currentIndex = Array.from(stationItems).indexOf(item);
      debouncedChangeStation(currentIndex);
    }
  };

  if (stationItems.length && currentIndex < stationItems.length) {
    debouncedChangeStation(currentIndex);
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
  if (currentTab === "best") {
    switchTab("best");
  } else {
    updateStationList();
  }
}

// Дебатизація changeStation
function debouncedChangeStation(index) {
  if (changeStationTimeout) {
    clearTimeout(changeStationTimeout);
  }
  changeStationTimeout = setTimeout(() => {
    changeStation(index);
  }, 200);
}

// Зміна станції
function changeStation(index) {
  if (index < 0 || index >= stationItems.length || stationItems[index].classList.contains("empty")) return;
  const item = stationItems[index];
  stationItems?.forEach(i => i.classList.remove("selected"));
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
  const stationNameElement = currentStationInfo.querySelector(".station-name");
  const stationGenreElement = currentStationInfo.querySelector(".station-genre");
  const stationCountryElement = currentStationInfo.querySelector(".station-country");

  if (stationNameElement) {
    stationNameElement.textContent = item.dataset.name || "Unknown";
  }
  if (stationGenreElement) {
    stationGenreElement.textContent = `Genre: ${item.dataset.genre || "Unknown"}`;
  }
  if (stationCountryElement) {
    stationCountryElement.textContent = `Country: ${item.dataset.country || "Unknown"}`;
  }
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.dataset.name || "Unknown Station",
      artist: `${item.dataset.genre || "Unknown"} | ${item.dataset.country || "Unknown"}`,
      album: "Radio Music"
    });
  }
}

// Керування відтворенням
function prevStation() {
  if (typeof currentIndex === "undefined" || !stationItems) return;
  currentIndex = currentIndex > 0 ? currentIndex - 1 : stationItems.length - 1;
  if (stationItems[currentIndex].classList.contains("empty")) currentIndex = 0;
  debouncedChangeStation(currentIndex);
}

function nextStation() {
  if (typeof currentIndex === "undefined" || !stationItems) return;
  currentIndex = currentIndex < stationItems.length - 1 ? currentIndex + 1 : 0;
  if (stationItems[currentIndex].classList.contains("empty")) currentIndex = 0;
  debouncedChangeStation(currentIndex);
}

function togglePlayPause() {
  if (!playPauseBtn || !audio || typeof isPlaying === "undefined") {
    console.error("playPauseBtn, audio або isPlaying не ініціалізовані");
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
  }
  localStorage.setItem("isPlaying", isPlaying);
}

// Додаємо слухачі подій для кнопок
function addControlListeners() {
  prevBtn.addEventListener("click", prevStation);
  nextBtn.addEventListener("click", nextStation);
  playPauseBtn.addEventListener("click", togglePlayPause);
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  themeToggle.addEventListener("click", toggleTheme);
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
      if (!audio.paused) return;
      audio.pause();
      audio.src = stationItems[currentIndex].dataset.value;
      tryAutoPlay();
    }
  },
  resume: () => {
    if (isPlaying && navigator.connection?.type !== "none") {
      if (!audio.paused) return;
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
  localStorage.setItem("lastActivity", Date.now());
  localStorage.setItem("isPlaying", isPlaying);
});

audio.addEventListener("pause", () => {
  isPlaying = false;
  playPauseBtn.textContent = "▶";
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
  localStorage.setItem("isPlaying", isPlaying);
});

audio.addEventListener("error", () => {
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
  if (!navigator.onLine) {
    updateNetworkStatus("Офлайн");
  }
});

audio.addEventListener("volumechange", () => {
  localStorage.setItem("volume", audio.volume);
});

// Моніторинг мережі
window.addEventListener("online", () => {
  console.log("Мережа відновлена");
  updateNetworkStatus("Онлайн");
  if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
    audio.pause();
    audio.src = stationItems[currentIndex].dataset.value;
    tryAutoPlay();
  }
});

window.addEventListener("offline", () => {
  console.log("Втрачено з'єднання з мережею");
  updateNetworkStatus("Офлайн");
});

// Ініціалізація слухачів
addControlListeners();
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

// Ініціалізація Bluetooth
setupBluetooth();

// Ініціалізація
applyTheme(currentTheme);
loadStations();