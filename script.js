// Updated script.js with autoplay, Bluetooth, network handling, fast switching, favorites, background mode, sticky station, and memory optimization
const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("stationList");
const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
const currentStationInfo = document.getElementById("currentStationInfo");
const themeToggle = document.querySelector(".theme-toggle");
const splashScreen = document.getElementById("splashScreen");
const startPlaybackBtn = document.getElementById("startPlayback");
const toast = document.getElementById("toast");
const stickyStation = document.getElementById("stickyStation");

// Check for missing DOM elements
if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle || !splashScreen || !startPlaybackBtn || !toast || !stickyStation) {
  console.error("Missing required DOM element");
  throw new Error("Failed to initialize app due to missing DOM elements");
}

let currentTab = localStorage.getItem("currentTab") || "techno";
let currentIndex = parseInt(localStorage.getItem("currentIndex")) || 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let stationLists = {};
let stationItems;
let isAutoPlaying = false;
let retryCount = 0;
const MAX_RETRIES = 3;
const MAX_FAVORITES = 20;
let abortController = null;
let audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Audio setup
audio.preload = "auto";
audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

// Show toast notification
function showToast(message, duration = 3000, isError = false) {
  toast.textContent = message;
  toast.style.display = "block";
  toast.style.borderColor = isError ? "#FF0000" : "transparent";
  setTimeout(() => {
    toast.style.display = "none";
  }, duration);
}

// Reset station info
function resetStationInfo() {
  const stationNameElement = currentStationInfo.querySelector(".station-name");
  const stationGenreElement = currentStationInfo.querySelector(".station-genre");
  const stationCountryElement = currentStationInfo.querySelector(".station-country");
  if (stationNameElement) stationNameElement.textContent = "Обирайте станцію";
  else console.error("Element .station-name not found");
  if (stationGenreElement) stationGenreElement.textContent = "жанр: -";
  else console.error("Element .station-genre not found");
  if (stationCountryElement) stationCountryElement.textContent = "країна: -";
  else console.error("Element .station-country not found");
  stickyStation.style.display = "none";
}

// Load stations
async function loadStations() {
  console.time("loadStations");
  stationList.innerHTML = "<div class='station-item empty'>Завантаження...</div>";
  try {
    const response = await fetch("stations.json", { cache: "no-cache" });
    console.log(`Response status: ${response.status}`);
    if (response.ok) {
      stationLists = await response.json();
      console.log("Stations loaded successfully");
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
    const validTabs = [...Object.keys(stationLists), "best"];
    if (!validTabs.includes(currentTab)) {
      currentTab = validTabs[0] || "techno";
      localStorage.setItem("currentTab", currentTab);
    }
    currentIndex = parseInt(localStorage.getItem("currentIndex")) || 0;
    switchTab(currentTab);
    if (isPlaying) {
      setTimeout(tryAutoPlay, 500); // Delay to ensure stationItems
    }
  } catch (error) {
    console.error("Error loading stations:", error);
    stationList.innerHTML = "<div class='station-item empty'>Не вдалося завантажити станції</div>";
    showToast("Не вдалося завантажити станції", 3000, true);
  } finally {
    console.timeEnd("loadStations");
  }
}

// Themes (unchanged)
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

// Service Worker setup
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
      console.log("Network restored via Service Worker");
      audio.pause();
      audio.src = stationItems[currentIndex].dataset.value;
      tryAutoPlay();
    }
  });
}

// Autoplay with exponential backoff
async function tryAutoPlay() {
  if (!navigator.onLine) {
    console.log("Device offline");
    showToast("Пристрій офлайн", 3000, true);
    return;
  }
  if (!isPlaying || !stationItems?.length || currentIndex >= stationItems.length || isAutoPlaying) {
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    return;
  }
  isAutoPlaying = true;
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  audio.src = stationItems[currentIndex].dataset.value;
  localStorage.setItem("lastStationUrl", audio.src);

  const delays = [1000, 2000, 4000];
  const attemptPlay = async (attempt = 0) => {
    if (attempt >= MAX_RETRIES) {
      showToast("Автовідтворення заблоковано. Натисніть 'Play'", 5000, true);
      splashScreen.style.display = "flex";
      isAutoPlaying = false;
      return;
    }
    try {
      await audio.play();
      isAutoPlaying = false;
      retryCount = 0;
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
      stationItems.forEach(item => item.classList.remove("loading"));
    } catch (error) {
      console.error(`Playback error (attempt ${attempt + 1}):`, error);
      isAutoPlaying = false;
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
      setTimeout(() => attemptPlay(attempt + 1), delays[attempt]);
    }
  };
  attemptPlay();
}

// Handle splash screen
startPlaybackBtn.addEventListener("click", () => {
  splashScreen.style.display = "none";
  isPlaying = true;
  localStorage.setItem("isPlaying", isPlaying);
  tryAutoPlay();
});

// Switch tabs
function switchTab(tab) {
  if (!["techno", "trance", "ukraine", "best"].includes(tab)) tab = "techno";
  currentTab = tab;
  localStorage.setItem("currentTab", tab);
  const savedIndex = parseInt(localStorage.getItem("currentIndex")) || 0;
  const maxIndex = tab === "best" ? favoriteStations.length : stationLists[tab]?.length || 0;
  currentIndex = savedIndex < maxIndex ? savedIndex : 0;
  updateStationList();
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  const activeBtn = document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`);
  if (activeBtn) activeBtn.classList.add("active");
  if (stationItems?.length && currentIndex < stationItems.length) tryAutoPlay();
}

// Update station list with sticky current station
function updateStationList() {
  if (!stationList) {
    console.error("stationList not found");
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
    stickyStation.style.display = "none";
    return;
  }

  requestAnimationFrame(() => {
    const fragment = document.createDocumentFragment();
    stations.forEach((station, index) => {
      const item = document.createElement("div");
      item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
      item.dataset.value = station.value;
      item.dataset.name = station.name;
      item.dataset.genre = station.genre;
      item.dataset.country = station.country;
      item.innerHTML = `
        ${station.emoji} ${station.name}
        <span class="loading-spinner" style="display: none; margin-left: 10px;">⏳</span>
        <button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}" aria-label="Toggle Favorite">★</button>
      `;
      fragment.appendChild(item);
    });
    stationList.innerHTML = "";
    stationList.appendChild(fragment);
    stationItems = stationList.querySelectorAll(".station-item");

    // Sticky station observer
    const observer = new IntersectionObserver(entries => {
      const selected = stationItems[currentIndex];
      if (selected && !entries.find(entry => entry.target === selected && entry.isIntersecting)) {
        stickyStation.innerHTML = selected.innerHTML;
        stickyStation.style.display = "block";
      } else {
        stickyStation.style.display = "none";
      }
    }, { root: stationList, threshold: 0 });
    stationItems.forEach(item => observer.observe(item));

    if (stationItems.length && currentIndex < stationItems.length) {
      changeStation(currentIndex);
    }
  });
}

// Toggle favorite without interrupting playback
function toggleFavorite(stationName) {
  if (favoriteStations.includes(stationName)) {
    favoriteStations = favoriteStations.filter(name => name !== stationName);
  } else {
    if (favoriteStations.length >= MAX_FAVORITES) {
      showToast("Досягнуто ліміт улюблених станцій (20)", 3000, true);
      return;
    }
    favoriteStations.unshift(stationName);
  }
  localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
  stationItems.forEach(item => {
    const btn = item.querySelector(".favorite-btn");
    if (item.dataset.name === stationName) {
      btn.classList.toggle("favorited");
    }
  });
  if (currentTab === "best") switchTab("best");
}

// Change station with AbortController
async function changeStation(index) {
  if (index < 0 || index >= stationItems.length || stationItems[index].classList.contains("empty")) return;
  if (abortController) abortController.abort();
  abortController = new AbortController();
  const item = stationItems[index];
  stationItems.forEach(i => {
    i.classList.remove("selected");
    i.querySelector(".loading-spinner").style.display = "none";
  });
  item.classList.add("selected");
  item.querySelector(".loading-spinner").style.display = "inline";
  currentIndex = index;
  audio.pause();
  audio.src = "";
  audio.src = item.dataset.value;
  updateCurrentStationInfo(item);
  localStorage.setItem("currentIndex", currentIndex);
  localStorage.setItem("lastStationUrl", audio.src);
  tryAutoPlay();
}

// Update current station info
function updateCurrentStationInfo(item) {
  if (!currentStationInfo) {
    console.error("currentStationInfo not found");
    return;
  }
  const stationNameElement = currentStationInfo.querySelector(".station-name");
  const stationGenreElement = currentStationInfo.querySelector(".station-genre");
  const stationCountryElement = currentStationInfo.querySelector(".station-country");

  console.log("Updating currentStationInfo:", item.dataset);

  if (stationNameElement) stationNameElement.textContent = item.dataset.name || "Unknown";
  if (stationGenreElement) stationGenreElement.textContent = `жанр: ${item.dataset.genre || "Unknown"}`;
  if (stationCountryElement) stationCountryElement.textContent = `країна: ${item.dataset.country || "Unknown"}`;
  stickyStation.innerHTML = item.innerHTML;
  stickyStation.style.display = stationItems[currentIndex] ? "block" : "none";

  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.dataset.name || "Unknown Station",
      artist: `${item.dataset.genre || "Unknown"} | ${item.dataset.country || "Unknown"}`,
      album: "Radio Music"
    });
    navigator.mediaSession.setPositionState({
      duration: 0,
      playbackRate: 1,
      position: 0
    });
  }
}

// Playback controls
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
    console.error("playPauseBtn or audio not found");
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

// Event listeners
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
      audio.src = stationItems[currentIndex]?.dataset.value || localStorage.getItem("lastStationUrl") || "";
      tryAutoPlay();
    }
  },
  resume: () => {
    if (isPlaying && navigator.connection?.type !== "none") {
      if (!audio.paused) return;
      audio.pause();
      audio.src = stationItems[currentIndex]?.dataset.value || localStorage.getItem("lastStationUrl") || "";
      tryAutoPlay();
    }
  },
  devicechange: async () => {
    console.log("Audio device changed");
    if (isPlaying && audio.paused) {
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      tryAutoPlay();
    }
  },
  networkchange: () => {
    console.log("Network status changed:", navigator.connection?.type);
    if (navigator.onLine && isPlaying) {
      tryAutoPlay();
    } else if (!navigator.onLine) {
      showToast("Втрачено з’єднання", 3000, true);
    }
  }
};

function addEventListeners() {
  document.addEventListener("keydown", eventListeners.keydown);
  document.addEventListener("visibilitychange", eventListeners.visibilitychange);
  document.addEventListener("resume", eventListeners.resume);
  navigator.mediaDevices.addEventListener("devicechange", eventListeners.devicechange);
  if (navigator.connection) {
    navigator.connection.addEventListener("change", eventListeners.networkchange);
  }
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
}

function removeEventListeners() {
  document.removeEventListener("keydown", eventListeners.keydown);
  document.removeEventListener("visibilitychange", eventListeners.visibilitychange);
  document.removeEventListener("resume", eventListeners.resume);
  navigator.mediaDevices.removeEventListener("devicechange", eventListeners.devicechange);
  if (navigator.connection) {
    navigator.connection.removeEventListener("change", eventListeners.networkchange);
  }
}

// Audio event listeners
audio.addEventListener("playing", () => {
  isPlaying = true;
  playPauseBtn.textContent = "⏸";
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
  localStorage.setItem("isPlaying", isPlaying);
  splashScreen.style.display = "none";
  stationItems.forEach(item => item.querySelector(".loading-spinner").style.display = "none");
});

audio.addEventListener("pause", () => {
  isPlaying = false;
  playPauseBtn.textContent = "▶";
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
  localStorage.setItem("isPlaying", isPlaying);
});

audio.addEventListener("error", () => {
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
  showToast("Помилка відтворення станції", 3000, true);
  if (retryCount < MAX_RETRIES) {
    retryCount++;
    setTimeout(tryAutoPlay, 1000 * Math.pow(2, retryCount));
  } else {
    nextStation();
  }
});

audio.addEventListener("volumechange", () => {
  localStorage.setItem("volume", audio.volume);
});

// Media Session API
if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play", togglePlayPause);
  navigator.mediaSession.setActionHandler("pause", togglePlayPause);
  navigator.mediaSession.setActionHandler("previoustrack", prevStation);
  navigator.mediaSession.setActionHandler("nexttrack", nextStation);
  navigator.mediaSession.setActionHandler("seekforward", () => nextStation());
  navigator.mediaSession.setActionHandler("seekbackward", () => prevStation());
}

// Check autoplay permission
if (navigator.permissions && navigator.permissions.query) {
  navigator.permissions.query({ name: "autoplay" }).then(permission => {
    if (permission.state === "denied" && isPlaying) {
      splashScreen.style.display = "flex";
    }
  }).catch(() => {
    if (isPlaying) splashScreen.style.display = "flex";
  });
}

// Initialization
applyTheme(currentTheme);
addEventListeners();
loadStations();

window.addEventListener("beforeunload", () => {
  removeEventListeners();
});