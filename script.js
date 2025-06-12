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
  const audio = document.getElementById("audioPlayer");
  const stationList = document.getElementById("stationList");
  const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
  const currentStationInfo = document.getElementById("currentStationInfo");
  const themeToggle = document.querySelector(".theme-toggle");

  if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle) {
    console.error("Один із необхідних DOM-елементів не знайдено");
    setTimeout(initializeApp, 100);
    return;
  }

  initializeApp();

  function initializeApp() {
    audio.preload = "auto";
    audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

    document.querySelectorAll(".tab-btn").forEach((btn, index) => {
      const tabs = ["best", "techno", "trance", "ukraine", "pop"];
      const tab = tabs[index];
      btn.addEventListener("click", () => switchTab(tab));
    });

    document.querySelector(".controls .control-btn:nth-child(1)").addEventListener("click", prevStation);
    document.querySelector(".controls .control-btn:nth-child(2)").addEventListener("click", togglePlayPause);
    document.querySelector(".controls .control-btn:nth-child(3)").addEventListener("click", nextStation);

    function isValidUrl(url) {
      return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(url);
    }

    function resetStationInfo() {
      const stationNameElement = currentStationInfo.querySelector(".station-name");
      const stationGenreElement = currentStationInfo.querySelector(".station-genre");
      const stationCountryElement = currentStationInfo.querySelector(".station-country");
      if (stationNameElement) stationNameElement.textContent = "Обирайте станцію";
      if (stationGenreElement) stationGenreElement.textContent = "жанр: -";
      if (stationCountryElement) stationCountryElement.textContent = "країна: -";
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
        favoriteStations = favoriteStations.filter(name => Object.values(stationLists).flat().some(s => s.name === name));
        localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
        const validTabs = [...Object.keys(stationLists), "best"];
        if (!validTabs.includes(currentTab)) {
          currentTab = validTabs[0] || "techno";
          localStorage.setItem("currentTab", currentTab);
        }
        currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
        switchTab(currentTab);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error("Помилка завантаження станцій:", error);
          stationList.innerHTML = "<div class='station-item empty'>Не вдалося завантажити станції</div>";
        }
      } finally {
        console.timeEnd("loadStations");
      }
    }

    const themes = {
      "emerald-deep": {
        bodyBg: "#0A0F0F",
        containerBg: "#152020",
        accent: "#2E7D32",
        text: "#E0E8E6",
        accentGradient: "#00695C"
      },
      "aquamarine-soft": {
        bodyBg: "#0A0F0F",
        containerBg: "#152020",
        accent: "#00BCD4",
        text: "#E0E8E6",
        accentGradient: "#0097A7"
      },
      "terracotta-warm": {
        bodyBg: "#0A0F0F",
        containerBg: "#152020",
        accent: "#EF6C00",
        text: "#E0E8E6",
        accentGradient: "#F57C00"
      },
      "violet-gentle": {
        bodyBg: "#0A0F0F",
        containerBg: "#152020",
        accent: "#9C27B0",
        text: "#E0E8E6",
        accentGradient: "#7B1FA2"
      },
      "quartz-light": {
        bodyBg: "#0A0F0F",
        containerBg: "#152020",
        accent: "#ECEFF1",
        text: "#E0E8E6",
        accentGradient: "#CFD8DC"
      },
      "sapphire-rich": {
        bodyBg: "#0A0F0F",
        containerBg: "#152020",
        accent: "#1E88E5",
        text: "#E0E8E6",
        accentGradient: "#1976D2"
      },
      "khaki-warm": {
        bodyBg: "#0A0F0F",
        containerBg: "#152020",
        accent: "#8A9A5B",
        text: "#E0E8E6",
        accentGradient: "#6F7B3A"
      },
      "coral-pale": {
        bodyBg: "#0A0F0F",
        containerBg: "#152020",
        accent: "#FF8A80",
        text: "#E0E8E6",
        accentGradient: "#EF5350"
      },
      "burgundy-deep": {
        bodyBg: "#0A0F0F",
        containerBg: "#152020",
        accent: "#880E4F",
        text: "#E0E8E6",
        accentGradient: "#AD1457"
      },
      "sand-soft": {
        bodyBg: "#0A0F0F",
        containerBg: "#152020",
        accent: "#F1EDEB",
        text: "#E0E8E6",
        accentGradient: "#D7CCC8"
      }
    };
    let currentTheme = localStorage.getItem("selectedTheme") || "emerald-deep";

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
      const themesOrder = ["emerald-deep", "aquamarine-soft", "terracotta-warm", "violet-gentle", "quartz-light", "sapphire-rich", "khaki-warm", "coral-pale", "burgundy-deep", "sand-soft"];
      const nextTheme = themesOrder[(themesOrder.indexOf(currentTheme) + 1) % themesOrder.length];
      applyTheme(nextTheme);
    }

    themeToggle.addEventListener("click", toggleTheme);

    function tryAutoPlay() {
      if (!navigator.onLine) return;
      if (!isPlaying || !stationItems?.length || currentIndex >= stationItems.length || !hasUserInteracted) {
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
        return;
      }
      if (audio.src === stationItems[currentIndex].dataset.value && !audio.paused) return;
      if (!isValidUrl(stationItems[currentIndex].dataset.value)) {
        console.error("Невалідний URL:", stationItems[currentIndex].dataset.value);
        errorCount++;
        if (errorCount >= ERROR_LIMIT) console.error("Досягнуто ліміт помилок відтворення");
        return;
      }
      audio.pause();
      audio.src = stationItems[currentIndex].dataset.value;
      const playPromise = audio.play();
      playPromise.then(() => {
        errorCount = 0;
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
      }).catch(error => {
        console.error("Помилка відтворення:", error);
        if (error.name !== "AbortError") {
          errorCount++;
          if (errorCount >= ERROR_LIMIT) console.error("Досягнуто ліміт помилок відтворення");
        }
      });
    }

    function switchTab(tab) {
      if (!["techno", "trance", "ukraine", "pop", "best"].includes(tab)) tab = "techno";
      currentTab = tab;
      localStorage.setItem("currentTab", tab);
      const savedIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
      const maxIndex = tab === "best" ? favoriteStations.length : stationLists[tab]?.length || 0;
      currentIndex = savedIndex < maxIndex ? savedIndex : 0;
      updateStationList();
      document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
      const activeBtn = document.querySelector(`.tab-btn:nth-child(${["best", "techno", "trance", "ukraine", "pop"].indexOf(tab) + 1})`);
      if (activeBtn) activeBtn.classList.add("active");
      if (stationItems?.length && currentIndex < stationItems.length) tryAutoPlay();
    }

    function updateStationList() {
      if (!stationList) return;
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
        item.innerHTML = `${station.emoji} ${station.name}<button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}">★</button>`;
        fragment.appendChild(item);
      });
      stationList.innerHTML = "";
      stationList.appendChild(fragment);
      stationItems = stationList.querySelectorAll(".station-item");
      if (stationItems.length && currentIndex < stationItems.length && !stationItems[currentIndex].classList.contains("empty")) {
        stationItems[currentIndex].scrollIntoView({ block: "start" });
      }
      stationList.onclick = e => {
        const item = e.target.closest(".station-item");
        const favoriteBtn = e.target.closest(".favorite-btn");
        hasUserInteracted = true;
        if (item && !item.classList.contains("empty")) {
          currentIndex = Array.from(stationItems).indexOf(item);
          changeStation(currentIndex);
        }
        if (favoriteBtn) {
          e.stopPropagation();
          toggleFavorite(favoriteBtn.parentElement.dataset.name);
        }
      };
      if (stationItems.length && currentIndex < stationItems.length) changeStation(currentIndex);
    }

    function toggleFavorite(stationName) {
      hasUserInteracted = true;
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
      const item = stationItems[index];
      stationItems.forEach(i => i.classList.remove("selected"));
      item.classList.add("selected");
      currentIndex = index;
      updateCurrentStationInfo(item);
      localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
      tryAutoPlay();
    }

    function updateCurrentStationInfo(item) {
      if (!currentStationInfo) return;
      const stationNameElement = currentStationInfo.querySelector(".station-name");
      const stationGenreElement = currentStationInfo.querySelector(".station-genre");
      const stationCountryElement = currentStationInfo.querySelector(".station-country");
      if (stationNameElement) stationNameElement.textContent = item.dataset.name || "Unknown";
      if (stationGenreElement) stationGenreElement.textContent = `жанр: ${item.dataset.genre || "Unknown"}`;
      if (stationCountryElement) stationCountryElement.textContent = `країна: ${item.dataset.country || "Unknown"}`;
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
      if (stationItems[currentIndex].classList.contains("empty")) currentIndex = 0;
      changeStation(currentIndex);
    }

    function nextStation() {
      hasUserInteracted = true;
      currentIndex = currentIndex < stationItems.length - 1 ? currentIndex + 1 : 0;
      if (stationItems[currentIndex].classList.contains("empty")) currentIndex = 0;
      changeStation(currentIndex);
    }

    function togglePlayPause() {
      if (!playPauseBtn || !audio) return;
      hasUserInteracted = true;
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
      if (isPlaying && errorCount < ERROR_LIMIT) {
        errorCount++;
        setTimeout(nextStation, 1000);
      }
    });

    audio.addEventListener("volumechange", () => {
      localStorage.setItem("volume", audio.volume);
    });

    window.addEventListener("online", () => {
      if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
        audio.pause();
        audio.src = stationItems[currentIndex].dataset.value;
        tryAutoPlay();
      }
    });

    applyTheme(currentTheme);
    loadStations();
  }
});