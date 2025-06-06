// Оголошення змінних на початку
let currentTab = localStorage.getItem("currentTab") || "techno";
let hasUserInteracted = false;
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let stationLists = {};
let stationItems;
let abortController = new AbortController();
let errorCount = 0;
const ERROR_LIMIT = 5;

document.addEventListener("DOMContentLoaded", () => {
  const audio = document.getElementById("audioPlayer");
  const stationList = document.getElementById("stationList");
  const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
  const currentStationInfo = document.querySelector(".current-station-info");
  const themeToggle = document.querySelector(".theme-toggle");
  const sleepTimerBtn = document.querySelector(".sleep-timer-btn");
  const stationSearch = document.getElementById("stationSearch");

  if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle || !sleepTimerBtn || !stationSearch) {
    console.error("Один із DOM-елементів не знайдено");
    setTimeout(initializeApp, 100);
    return;
  }

  audio.preload = "auto";
  audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

  document.querySelectorAll(".tab-btn").forEach((btn, index) => {
    const tabs = ["best", "techno", "trance", "ua", "pop"];
    btn.addEventListener("click", () => switchTab(tabs[index]));
  });

  document.querySelector(".controls .control-btn:nth-child(1)").addEventListener("click", prevStation);
  document.querySelector(".controls .control-btn:nth-child(2)").addEventListener("click", togglePlayPause);
  document.querySelector(".controls .control-btn:nth-child(3)").addEventListener("click", nextStation);
  themeToggle.addEventListener("click", toggleTheme);
  sleepTimerBtn.addEventListener("click", toggleSleepTimer);
  stationSearch.addEventListener("input", filterStations);

  async function loadStations() {
    stationList.innerHTML = "<div class='station-item empty'>Завантаження...</div>";
    try {
      abortController.abort();
      abortController = new AbortController();
      const response = await fetch("stations.json", { cache: "no-cache", signal: abortController.signal });
      if (response.ok) {
        stationLists = await response.json();
        favoriteStations = favoriteStations.filter(name => Object.values(stationLists).flat().some(s => s.name === name));
        localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
        switchTab(currentTab);
      } else throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (error.name !== 'AbortError') stationList.innerHTML = "<div class='station-item empty'>Помилка завантаження</div>";
    }
  }

  const themes = {
    "neon": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#00F0FF", text: "#F0F0F0", accentGradient: "#003C4B" },
    "dark-green": { bodyBg: "#0A1A0A", containerBg: "#1A2A1A", accent: "#00FF00", text: "#E0F0E0", accentGradient: "#003C00" },
    "pink": { bodyBg: "#1A0A1A", containerBg: "#2A1A2A", accent: "#FF00FF", text: "#F0E0F0", accentGradient: "#4B004B" },
    "light": { bodyBg: "#F5F7FA", containerBg: "#FFFFFF", accent: "#40C4FF", text: "#212121", accentGradient: "#B3E5FC" }
  };
  let currentTheme = localStorage.getItem("selectedTheme") || "neon";

  function applyTheme(theme) {
    const root = document.documentElement;
    Object.entries(themes[theme]).forEach(([key, value]) => root.style.setProperty(`--${key}`, value));
    localStorage.setItem("selectedTheme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelector('meta[name="theme-color"]').setAttribute("content", themes[theme].accent);
  }

  function toggleTheme() {
    const themesOrder = Object.keys(themes);
    const nextTheme = themesOrder[(themesOrder.indexOf(currentTheme) + 1) % themesOrder.length];
    applyTheme(nextTheme);
  }

  let sleepTimer = null;
  function toggleSleepTimer() {
    if (sleepTimer) {
      clearTimeout(sleepTimer);
      sleepTimer = null;
      sleepTimerBtn.textContent = "⏰";
      alert("Таймер сну вимкнено");
    } else {
      const minutes = prompt("Введіть хвилини для таймера сну:", 30);
      const time = parseInt(minutes) * 60 * 1000;
      if (time > 0) {
        sleepTimer = setTimeout(() => {
          audio.pause();
          isPlaying = false;
          playPauseBtn.textContent = "▶";
          document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
          localStorage.setItem("isPlaying", isPlaying);
          sleepTimer = null;
          alert("Таймер сну завершився");
        }, time);
        sleepTimerBtn.textContent = `⏰ ${minutes}min`;
        alert(`Таймер сну встановлено на ${minutes} хвилин`);
      }
    }
  }

  function filterStations() {
    const query = stationSearch.value.toLowerCase();
    const stations = currentTab === "best" ? favoriteStations.map(name => Object.values(stationLists).flat().find(s => s.name === name)).filter(s => s) : stationLists[currentTab] || [];
    const filtered = stations.filter(station => station.name.toLowerCase().includes(query) || station.genre.toLowerCase().includes(query) || station.country.toLowerCase().includes(query));
    updateStationList(filtered);
  }

  function updateStationList(stations = []) {
    if (!stations.length) {
      currentIndex = 0;
      stationItems = [];
      stationList.innerHTML = `<div class='station-item empty'>${currentTab === "best" ? "Немає улюблених" : "Немає станцій"}</div>`;
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
      const item = e.target.closest(".station-item");
      const favoriteBtn = e.target.closest(".favorite-btn");
      if (item && !item.classList.contains("empty")) {
        currentIndex = Array.from(stationItems).indexOf(item);
        changeStation(currentIndex);
      }
      if (favoriteBtn) toggleFavorite(favoriteBtn.parentElement.dataset.name);
    };
    if (stationItems.length) changeStation(currentIndex);
  }

  function switchTab(tab) {
    currentTab = tab;
    localStorage.setItem("currentTab", tab);
    currentIndex = 0;
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    document.querySelector(`.tab-btn:nth-child(${["best", "techno", "trance", "ua", "pop"].indexOf(tab) + 1})`).classList.add("active");
    stationSearch.value = "";
    filterStations();
  }

  function toggleFavorite(stationName) {
    if (favoriteStations.includes(stationName)) favoriteStations = favoriteStations.filter(name => name !== stationName);
    else favoriteStations.unshift(stationName);
    localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
    if (currentTab === "best") switchTab("best");
    else filterStations();
  }

  function changeStation(index) {
    if (index < 0 || index >= stationItems.length || stationItems[index].classList.contains("empty")) return;
    stationItems.forEach(i => i.classList.remove("selected"));
    stationItems[index].classList.add("selected");
    currentIndex = index;
    updateCurrentStationInfo(stationItems[index]);
    tryAutoPlay();
  }

  function updateCurrentStationInfo(item) {
    currentStationInfo.querySelector(".station-name").textContent = item.dataset.name || "Unknown";
    currentStationInfo.querySelector(".station-genre").textContent = `жанр: ${item.dataset.genre || "Unknown"}`;
    currentStationInfo.querySelector(".station-country").textContent = `країна: ${item.dataset.country || "Unknown"}`;
  }

  function tryAutoPlay() {
    if (!navigator.onLine || !stationItems?.length || currentIndex >= stationItems.length || !hasUserInteracted) return;
    audio.pause();
    audio.src = stationItems[currentIndex].dataset.value;
    const playPromise = audio.play();
    playPromise.then(() => {
      errorCount = 0;
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
    }).catch(error => {
      console.error("Помилка відтворення:", error);
      errorCount++;
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    });
  }

  function prevStation() { currentIndex = currentIndex > 0 ? currentIndex - 1 : stationItems.length - 1; changeStation(currentIndex); }
  function nextStation() { currentIndex = currentIndex < stationItems.length - 1 ? currentIndex + 1 : 0; changeStation(currentIndex); }
  function togglePlayPause() {
    hasUserInteracted = true;
    if (audio.paused) {
      isPlaying = true;
      tryAutoPlay();
      playPauseBtn.textContent = "⏸";
    } else {
      audio.pause();
      isPlaying = false;
      playPauseBtn.textContent = "▶";
    }
    localStorage.setItem("isPlaying", isPlaying);
  }

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
    if (isPlaying && errorCount < ERROR_LIMIT) setTimeout(nextStation, 1000);
  });
  audio.addEventListener("volumechange", () => localStorage.setItem("volume", audio.volume));

  window.addEventListener("online", () => { if (isPlaying) tryAutoPlay(); });
  window.addEventListener("offline", () => console.log("Офлайн"));

  document.addEventListener("click", () => hasUserInteracted = true);

  applyTheme(currentTheme);
  loadStations();
});