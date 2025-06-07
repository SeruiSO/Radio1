// Оголошення змінних на початку для уникнення Temporal Dead Zone
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

// Очікування завантаження DOM
document.addEventListener("DOMContentLoaded", () => {
  // Отримання DOM-елементів
  const audio = document.getElementById("audioPlayer");
  const stationList = document.getElementById("stationList");
  const playPauseBtn = document.querySelector(".play-pause");
  const currentStationInfo = {
    name: document.querySelector(".station-name"),
    genre: document.querySelector(".station-genre"),
    country: document.querySelector(".station-country")
  };
  const artwork = document.querySelector(".station-artwork");
  const progressBar = document.querySelector(".progress");
  const progressTime = document.querySelector(".progress-time");
  const totalTime = document.querySelector(".total-time");
  const navBack = document.querySelector(".nav-back");
  const themeToggle = document.querySelector(".theme-toggle");
  const tabs = document.querySelectorAll(".tab-btn");
  const shuffleBtn = document.querySelector(".shuffle-btn");

  // Перевірка наявності всіх необхідних елементів
  if (!audio || !stationList || !playPauseBtn || !currentStationInfo.name || !artwork || !progressBar || !navBack || !themeToggle || !shuffleBtn) {
    console.error("Один із необхідних DOM-елементів не знайдено");
    setTimeout(initializeApp, 100);
    return;
  }

  // Ініціалізація програми
  initializeApp();

  function initializeApp() {
    audio.preload = "auto";
    audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

    document.querySelectorAll(".control-btn").forEach(btn => {
      if (btn.classList.contains("prev")) btn.addEventListener("click", prevStation);
      if (btn.classList.contains("play-pause")) btn.addEventListener("click", togglePlayPause);
      if (btn.classList.contains("next")) btn.addEventListener("click", nextStation);
    });

    navBack.addEventListener("click", () => console.log("Back clicked"));
    themeToggle.addEventListener("click", toggleTheme);
    tabs.forEach((btn, index) => {
      const tabNames = ["best", "techno", "trance", "ukraine", "pop"];
      btn.addEventListener("click", () => switchTab(tabNames[index]));
    });
    shuffleBtn.addEventListener("click", shuffleStations);

    function isValidUrl(url) {
      return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(url);
    }

    function resetStationInfo() {
      currentStationInfo.name.textContent = "Обирайте станцію";
      currentStationInfo.genre.textContent = "жанр: -";
      currentStationInfo.country.textContent = "країна: -";
      artwork.style.backgroundImage = "none";
    }

    async function loadStations() {
      console.time("loadStations");
      stationList.innerHTML = "<div class='station-item empty'>Завантаження...</div>";
      try {
        abortController.abort();
        abortController = new AbortController();
        const response = await fetch(`stations.json?t=${Date.now()}`, {
          cache: "no-cache",
          headers: { "If-Modified-Since": localStorage.getItem("stationsLastModified") || "" },
          signal: abortController.signal
        });
        if (response.status === 304) {
          const cachedData = await caches.match("stations.json");
          if (cachedData) stationLists = await cachedData.json();
          else throw new Error("Кеш не знайдено");
        } else if (response.ok) {
          stationLists = await response.json();
          localStorage.setItem("stationsLastModified", response.headers.get("Last-Modified") || "");
        } else throw new Error(`HTTP ${response.status}`);
        favoriteStations = favoriteStations.filter(name => Object.values(stationLists).flat().some(s => s.name === name));
        localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
        if (!Object.keys(stationLists).includes(currentTab)) currentTab = Object.keys(stationLists)[0] || "techno";
        currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
        switchTab(currentTab);
      } catch (error) {
        if (error.name !== 'AbortError') stationList.innerHTML = "<div class='station-item empty'>Не вдалося завантажити станції</div>";
      } finally { console.timeEnd("loadStations"); }
    }

    const themes = {
      "neon-pulse": { bodyBg: "#0A0A0A", containerBg: "#1C2526", accent: "#FF5722", text: "#B0BEC5", accentGradient: "#3E2723" },
      "lime-surge": { bodyBg: "#0A0A0A", containerBg: "#1C2526", accent: "#B2FF59", text: "#E8F5E9", accentGradient: "#2E4B2F" }
    };

    function applyTheme(theme) {
      const root = document.documentElement;
      root.style.setProperty("--body-bg", themes[theme].bodyBg);
      root.style.setProperty("--container-bg", themes[theme].containerBg);
      root.style.setProperty("--accent", themes[theme].accent);
      root.style.setProperty("--text", themes[theme].text);
      root.style.setProperty("--accent-gradient", themes[theme].accentGradient);
      localStorage.setItem("selectedTheme", theme);
      document.documentElement.setAttribute("data-theme", theme);
      document.querySelector('meta[name="theme-color"]').setAttribute("content", themes[theme].accent);
    }

    function toggleTheme() {
      const currentTheme = localStorage.getItem("selectedTheme") || "neon-pulse";
      const nextTheme = currentTheme === "neon-pulse" ? "lime-surge" : "neon-pulse";
      applyTheme(nextTheme);
    }

    function tryAutoPlay() {
      if (!navigator.onLine || !isPlaying || !stationItems?.length || currentIndex >= stationItems.length || !hasUserInteracted) return;
      if (!isValidUrl(stationItems[currentIndex].dataset.value)) {
        console.error("Невалідний URL:", stationItems[currentIndex].dataset.value);
        errorCount++;
        return;
      }
      if (!audio.paused) audio.pause(); // Додано для уникнення конфлікту
      audio.src = stationItems[currentIndex].dataset.value;
      const playPromise = audio.play();
      playPromise.then(() => { errorCount = 0; playPauseBtn.textContent = "⏸"; }).catch(error => {
        console.error("Помилка відтворення:", error);
        if (error.name !== "AbortError") errorCount++;
      });
    }

    function switchTab(tab) {
      if (!["best", "techno", "trance", "ukraine", "pop"].includes(tab)) tab = "techno";
      currentTab = tab;
      localStorage.setItem("currentTab", tab);
      currentIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
      updateStationList();
      tabs.forEach(btn => btn.classList.remove("active"));
      document.querySelector(`.tab-btn:nth-child(${["best", "techno", "trance", "ukraine", "pop"].indexOf(tab) + 1})`).classList.add("active");
      if (stationItems?.length && currentIndex < stationItems.length) changeStation(currentIndex);
    }

    function updateStationList() {
      let stations = currentTab === "best" ? favoriteStations.map(name => Object.values(stationLists).flat().find(s => s.name === name)).filter(s => s) : stationLists[currentTab] || [];
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
        item.innerHTML = `${station.emoji} ${station.name} <button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}">♥</button>`;
        fragment.appendChild(item);
      });
      stationList.innerHTML = "";
      stationList.appendChild(fragment);
      stationItems = stationList.querySelectorAll(".station-item");

      stationList.onclick = e => {
        const item = e.target.closest(".station-item");
        const favoriteBtn = e.target.closest(".favorite-btn");
        hasUserInteracted = true;
        if (item && !item.classList.contains("empty")) {
          currentIndex = Array.from(stationItems).indexOf(item);
          changeStation(currentIndex);
        }
        if (favoriteBtn) toggleFavorite(favoriteBtn.parentElement.dataset.name);
      };
    }

    function toggleFavorite(stationName) {
      hasUserInteracted = true;
      if (favoriteStations.includes(stationName)) favoriteStations = favoriteStations.filter(name => name !== stationName);
      else favoriteStations.unshift(stationName);
      localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
      if (currentTab === "best") switchTab("best");
      else updateStationList();
    }

    function changeStation(index) {
      if (index < 0 || index >= stationItems.length || stationItems[index].classList.contains("empty")) return;
      stationItems.forEach(i => i.classList.remove("selected"));
      stationItems[index].classList.add("selected");
      currentIndex = index;
      updateCurrentStationInfo(stationItems[index]);
      localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
      tryAutoPlay();
    }

    function updateCurrentStationInfo(item) {
      currentStationInfo.name.textContent = item.dataset.name || "Unknown";
      currentStationInfo.genre.textContent = `жанр: ${item.dataset.genre || "Unknown"}`;
      currentStationInfo.country.textContent = `країна: ${item.dataset.country || "Unknown"}`;
      artwork.style.backgroundImage = `url('icon-192.png')`;
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: item.dataset.name || "Unknown Station",
          artist: `${item.dataset.genre || "Unknown"} | ${item.dataset.country || "Unknown"}`,
          album: "Radio Music"
        });
      }
    }

    function prevStation() {
      hasUserInteracted = true;
      currentIndex = currentIndex > 0 ? currentIndex - 1 : stationItems.length - 1;
      changeStation(currentIndex);
    }

    function nextStation() {
      hasUserInteracted = true;
      currentIndex = currentIndex < stationItems.length - 1 ? currentIndex + 1 : 0;
      changeStation(currentIndex);
    }

    function shuffleStations() {
      hasUserInteracted = true;
      currentIndex = Math.floor(Math.random() * stationItems.length);
      changeStation(currentIndex);
    }

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

    audio.addEventListener("playing", () => { isPlaying = true; playPauseBtn.textContent = "⏸"; });
    audio.addEventListener("pause", () => { isPlaying = false; playPauseBtn.textContent = "▶"; });
    audio.addEventListener("error", () => { console.error("Помилка аудіо:", audio.error?.message); if (isPlaying) nextStation(); });
    audio.addEventListener("volumechange", () => localStorage.setItem("volume", audio.volume));

    window.addEventListener("online", () => { if (isPlaying) tryAutoPlay(); });
    window.addEventListener("offline", () => console.log("Втрачено з'єднання з мережею"));

    document.addEventListener("click", () => { hasUserInteracted = true; });

    applyTheme(localStorage.getItem("selectedTheme") || "neon-pulse");
    loadStations();
  }
});