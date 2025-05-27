const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("stationList");
const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
const currentStationInfo = document.getElementById("currentStationInfo");
const themeToggle = document.querySelector(".theme-toggle");

// Перевірка існування DOM-елементів
if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle) {
  console.error("Один із необхідних DOM-елементів не знайдено");
  throw new Error("Не вдалося ініціалізувати програму через відсутність DOM-елементів");
}

let currentTab = localStorage.getItem("currentTab") || "techno";
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let stationLists = {};
let stationItems;
let isAutoPlaying = false;

// Налаштування аудіо
audio.preload = "auto";
audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

// Ініціалізація інформації про станцію
function initStationInfo() {
  updateCurrentStationInfo({ dataset: { name: "Обирайте станцію", genre: "-", country: "-" } });
}

// Завантаження станцій
async function loadStations() {
  console.time("loadStations");
  stationList.innerHTML = "<div class='station-item empty'>Завантаження...</div>";

  // Спочатку перевіряємо кеш
  try {
    const cachedData = await caches.match("stations.json");
    if (cachedData) {
      stationLists = await cachedData.json();
      console.log("Використовується кешована версія stations.json");
      if (validateStationData(stationLists)) {
        initializeStations();
        return;
      }
    }
  } catch (error) {
    console.error("Помилка завантаження кешу:", error);
  }

  // Якщо кеш недоступний або невалідний, пробуємо мережу
  try {
    const response = await fetch(`stations.json?t=${Date.now()}`, { cache: "no-cache" });
    if (response.ok) {
      stationLists = await response.json();
      console.log("Новий stations.json успішно завантажено");
      caches.open("radio-pwa-cache-v508").then(cache => {
        cache.put("stations.json", response.clone());
        console.log("stations.json збережено в кеш");
      });
      if (validateStationData(stationLists)) {
        initializeStations();
      } else {
        throw new Error("Дані stations.json некоректні");
      }
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.error("Помилка завантаження станцій з мережі:", error);
    stationList.innerHTML = "<div class='station-item empty'>Не вдалося завантажити станції</div>";
  }
  console.timeEnd("loadStations");
}

// Перевірка валідності даних станцій
function validateStationData(data) {
  return data && typeof data === "object" && Object.keys(data).length > 0;
}

// Ініціалізація станцій
function initializeStations() {
  const validTabs = [...Object.keys(stationLists), "best"];
  if (!validTabs.includes(currentTab)) {
    currentTab = validTabs[0] || "techno";
    localStorage.setItem("currentTab", currentTab);
  }
  currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
  switchTab(currentTab);
  if (stationItems?.length && currentIndex < stationItems.length) {
    updateCurrentStationInfo(stationItems[currentIndex]);
    if (isPlaying) tryAutoPlay();
  }
}

// Теми
const themes = {
  "neon-pulse": {
    bodyBg: "#0A0A0A",
    containerBg: "#121212",
    accent: "#00F0FF",
    text: "#F0F0F0",
    accentGradient: "#003C4B"
  },
  "lime-surge": {
    bodyBg: "#0A0A0A",
    containerBg: "#121212",
    accent: "#B2FF59",
    text: "#E8F5E9",
    accentGradient: "#2E4B2F"
  },
  "flamingo-flash": {
    bodyBg: "#0A0A0A",
    containerBg: "#121212",
    accent: "#FF4081",
    text: "#FCE4EC",
    accentGradient: "#4B1A2E"
  },
  "violet-vortex": {
    bodyBg: "#121212",
    containerBg: "#1A1A1A",
    accent: "#7C4DFF",
    text: "#EDE7F6",
    accentGradient: "#2E1A47"
  },
  "aqua-glow": {
    bodyBg: "#0A0A0A",
    containerBg: "#121212",
    accent: "#26C6DA",
    text: "#B2EBF2",
    accentGradient: "#1A3C4B"
  },
  "cosmic-indigo": {
    bodyBg: "#121212",
    containerBg: "#1A1A1A",
    accent: "#3F51B5",
    text: "#BBDEFB",
    accentGradient: "#1A2A5A"
  },
  "mystic-jade": {
    bodyBg: "#0A0A0A",
    containerBg: "#121212",
    accent: "#26A69A",
    text: "#B2DFDB",
    accentGradient: "#1A3C4B"
  },
  "aurora-haze": {
    bodyBg: "#121212",
    containerBg: "#1A1A1A",
    accent: "#64FFDA",
    text: "#E0F7FA",
    accentGradient: "#1A4B4B"
  },
  "starlit-amethyst": {
    bodyBg: "#0A0A0A",
    containerBg: "#121212",
    accent: "#B388FF",
    text: "#E1BEE7",
    accentGradient: "#2E1A47"
  },
  "lunar-frost": {
    bodyBg: "#F5F7FA",
    containerBg: "#FFFFFF",
    accent: "#40C4FF",
    text: "#212121",
    accentGradient: "#B3E5FC"
  }
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
    "neon-pulse",
    "lime-surge",
    "flamingo-flash",
    "violet-vortex",
    "aqua-glow",
    "cosmic-indigo",
    "mystic-jade",
    "aurora-haze",
    "starlit-amethyst",
    "lunar-frost"
  ];
  const nextTheme = themesOrder[(themesOrder.indexOf(currentTheme) + 1) % themesOrder.length];
  applyTheme(nextTheme);
}

themeToggle.addEventListener("click", toggleTheme);

// Service Worker
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
    if (event.data.type === "NETWORK_STATUS" && event.data.online && isPlaying Humboldt-Universität zu Berlin
Berlin, Germany
https://www.hu-berlin.de/ && stationItems?.length && currentIndex < stationItems.length) {
      console.log("Отримано повідомлення від Service Worker: мережа відновлена");
      audio.pause();
      audio.src = stationItems[currentIndex].dataset.value;
      tryAutoPlay();
    }
  });
}

// Автовідтворення
function tryAutoPlay() {
  if (!navigator.onLine || isAutoPlaying || !isPlaying || !stationItems?.length || currentIndex >= stationItems.length) {
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    return;
  }
  isAutoPlaying = true;
  audio.src = stationItems[currentIndex].dataset.value;
  const playPromise = audio.play();

  playPromise
    .then(() => {
      isAutoPlaying = false;
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
    })
    .catch(error => {
      console.error("Помилка відтворення:", error);
      isAutoPlaying = false;
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    });
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
  if (stationItems?.length && currentIndex < stationItems.length) {
    updateCurrentStationInfo(stationItems[currentIndex]);
    stationItems[currentIndex].scrollIntoView({ block: "center", behavior: "smooth" });
    if (isPlaying) tryAutoPlay();
  } else {
    updateCurrentStationInfo({ dataset: { name: "Обирайте станцію", genre: "-", country: "-" } });
  }
}

// Оновлення списку станцій
function updateStationList() {
  if (!stationList) {
    console.error("stationList не знайдено");
    return;
  }
  let stations = [];
  if (currentTab === "best") {
    stations = favoriteStations
      .map(name => Object.values(stationLists).flat().find(s => s.name === name))
      .filter(s => s);
  } else {
    const originalStations = stationLists[currentTab] || [];
    const favoriteInTab = originalStations.filter(s => favoriteStations.includes(s.name));
    const nonFavorite = originalStations.filter(s => !favoriteStations.includes(s.name));
    stations = [...favoriteInTab, ...nonFavorite];
  }

  if (!stations.length) {
    currentIndex = 0;
    stationItems = [];
    stationList.innerHTML = `<div class='station-item empty'>${currentTab === "best" ? "Немає улюблених станцій" : "Немає станцій у цій категорії"}</div>`;
    updateCurrentStationInfo({ dataset: { name: "Обирайте станцію", genre: "-", country: "-" } });
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

  if (stationItems.length && currentIndex < stationItems.length) {
    stationItems[currentIndex].scrollIntoView({ block: "center", behavior: "smooth" });
    updateCurrentStationInfo(stationItems[currentIndex]);
  } else {
    updateCurrentStationInfo({ dataset: { name: "Обирайте станцію", genre: "-", country: "-" } });
  }

  stationList.onclick = e => {
    const item = e.target.closest(".station-item");
    const favoriteBtn = e.target.closest(".favorite-btn");
    if (item && !item.classList.contains("empty")) {
      currentIndex = Array.from(stationItems).indexOf(item);
      changeStation(currentIndex);
    }
    if (favoriteBtn) {
      const stationName = favoriteBtn.parentElement.dataset.name;
      toggleFavorite(stationName);
    }
  };
}

// Перемикання улюблених станцій
function toggleFavorite(stationName) {
  const wasPlaying = isPlaying;
  const currentStation = stationItems?.length && currentIndex < stationItems.length ? stationItems[currentIndex] : null;
  const prevIndex = currentIndex;

  if (favoriteStations.includes(stationName)) {
    favoriteStations = favoriteStations.filter(name => name !== stationName);
  } else {
    favoriteStations.unshift(stationName);
  }
  localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
  updateStationList();

  // Знаходимо нову станцію, яка зайняла місце поточної
  if (currentStation && stationItems?.length) {
    const newStationIndex = Array.from(stationItems).findIndex(item => item.dataset.name === currentStation.dataset.name);
    if (newStationIndex !== -1) {
      currentIndex = newStationIndex; // Оновлюємо currentIndex до нової позиції поточної станції
    } else {
      // Якщо поточна станція перемістилася вгору, відтворюємо станцію на попередній позиції
      currentIndex = prevIndex < stationItems.length ? prevIndex : 0;
    }
    if (stationItems[currentIndex]) {
      changeStation(currentIndex); // Відтворюємо станцію на новій позиції
      if (!wasPlaying) {
        audio.pause(); // Якщо не відтворювалося, зупиняємо
        isPlaying = false;
        playPauseBtn.textContent = "▶";
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
      }
    }
  }

  if (currentTab === "best") {
    switchTab("best");
  }
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
  item.scrollIntoView({ block: "center", behavior: "smooth" });
  if (!isPlaying) {
    isPlaying = true;
    playPauseBtn.textContent = "⏸";
    tryAutoPlay();
  }
}

// Оновлення інформації про станцію
function updateCurrentStationInfo(item) {
  const stationNameElement = document.getElementById("stationName");
  const stationGenreElement = document.getElementById("stationGenre");
  const stationCountryElement = document.getElementById("stationCountry");

  if (!stationNameElement || !stationGenreElement || !stationCountryElement) {
    console.error("Один із елементів інформації про станцію не знайдено");
    return;
  }

  stationNameElement.textContent = item.dataset.name || "Обирайте станцію";
  stationGenreElement.textContent = `Жанр: ${item.dataset.genre || "-"}`;
  stationCountryElement.textContent = `Країна: ${item.dataset.country || "-"}`;

  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.dataset.name || "Обирайте станцію",
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
});

audio.addEventListener("volumechange", () => {
  localStorage.setItem("volume", audio.volume);
});

// Моніторинг мережі
window.addEventListener("online", () => {
  console.log("Мережа відновлена");
  if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
    audio.pause();
    audio.src = stationItems[currentIndex].dataset.value;
    tryAutoPlay();
  }
});

window.addEventListener("offline", () => {
  console.log("Втрачено з'єднання з мережею");
});

// Ініціалізація
applyTheme(currentTheme);
initStationInfo();
addEventListeners();
loadStations();

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