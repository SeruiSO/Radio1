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
      else console.error("Елемент .station-name не знайдено в currentStationInfo");
      if (stationGenreElement) stationGenreElement.textContent = "жанр: -";
      else console.error("Елемент .station-genre не знайдено в currentStationInfo");
      if (stationCountryElement) stationCountryElement.textContent = "країна: -";
      else console.error("Елемент .station-country не знайдено в currentStationInfo");
    }

    async function loadStations() {
      console.time("loadStations");
      stationList.innerHTML = "<div class='station-item empty'>Завантаження...</div>";
      try {
        abortController.abort();
        abortController = new AbortController();
        const response = await fetch(`stations.json?t=${Date.now()}`, {
          cache: "no-cache",
          headers: {
            "If-Modified-Since": localStorage.getItem("stationsLastModified") || ""
          },
          signal: abortController.signal
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
          localStorage.setItem("stationsLastModified", response.headers.get("Last-Modified") || "");
          console.log("Новий stations.json успішно завантажено");
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
        favoriteStations = favoriteStations.filter(name => 
          Object.values(stationLists).flat().some(s => s.name === name)
        );
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
      // Feminine Themes
      "sakura-bloom": {
        bodyBg: "#FFF0F5",
        containerBg: "#FFE4E1",
        accent: "#FF69B4",
        text: "#4B2E39",
        accentGradient: "#FFB6C1"
      },
      "lavender-mist": {
        bodyBg: "#F3E5F5",
        containerBg: "#E1BEE7",
        accent: "#AB47BC",
        text: "#3F2A44",
        accentGradient: "#CE93D8"
      },
      "coral-sunset": {
        bodyBg: "#FFF3E0",
        containerBg: "#FFCCBC",
        accent: "#FF7043",
        text: "#4A2F27",
        accentGradient: "#FFAB91"
      },
      "mint-breeze": {
        bodyBg: "#E0F2E9",
        containerBg: "#B2DFDB",
        accent: "#26A69A",
        text: "#2E3D3A",
        accentGradient: "#80CBC4"
      },
      "rose-quartz": {
        bodyBg: "#FCE4EC",
        containerBg: "#F8BBD0",
        accent: "#EC407A",
        text: "#4C2F38",
        accentGradient: "#F48FB1"
      },
      // Masculine Themes
      "obsidian-gloss": {
        bodyBg: "#1C2526",
        containerBg: "#2E2E2E",
        accent: "#00CED1",
        text: "#E0E0E0",
        accentGradient: "#4682B4"
      },
      "steel-blue": {
        bodyBg: "#263238",
        containerBg: "#37474F",
        accent: "#0288D1",
        text: "#CFD8DC",
        accentGradient: "#4FC3F7"
      },
      "forest-dusk": {
        bodyBg: "#1B2A1F",
        containerBg: "#2E3D30",
        accent: "#4CAF50",
        text: "#C8E6C9",
        accentGradient: "#81C784"
      },
      "crimson-forge": {
        bodyBg: "#2C1A1D",
        containerBg: "#3E2723",
        accent: "#D32F2F",
        text: "#EF9A9A",
        accentGradient: "#EF5350"
      },
      "slate-storm": {
        bodyBg: "#2A2F3A",
        containerBg: "#3F4C5A",
        accent: "#78909C",
        text: "#ECEFF1",
        accentGradient: "#B0BEC5"
      }
    };
    let currentTheme = localStorage.getItem("selectedTheme") || "sakura-bloom";

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
        "sakura-bloom",
        "lavender-mist",
        "coral-sunset",
        "mint-breeze",
        "rose-quartz",
        "obsidian-gloss",
        "steel-blue",
        "forest-dusk",
        "crimson-forge",
        "slate-storm"
      ];
      const nextTheme = themesOrder[(themesOrder.indexOf(currentTheme) + 1) % themesOrder.length];
      applyTheme(nextTheme);
    }

    themeToggle.addEventListener("click", toggleTheme);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").then(registration => {
        registration.update();
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "activated" && navigator.serviceWorker.controller) {
                if (window.confirm("Доступна нова версія радіо. Оновити?")) {
                  window.location.reload();
                }
              }
            });
          }
        });
      });

      navigator.serviceWorker.addEventListener("message", event => {
        if (event.data.type === "NETWORK_STATUS" && event.data.online && isPlaying && stationItems?.length && currentIndex < stationItems.length) {
          console.log("Отримано повідомлення від Service Worker: мережа відновлена");
          audio.pause();
          audio.src = "";
          audio.src = stationItems[currentIndex].dataset.value;
          tryAutoPlay();
        }
      });
    }

    function tryAutoPlay() {
      if (!navigator.onLine) {
        console.log("Пристрій офлайн, пропускаємо відтворення");
        return;
      }
      if (!isPlaying || !stationItems?.length || currentIndex >= stationItems.length || !hasUserInteracted) {
        console.log("Пропуск tryAutoPlay", { isPlaying, hasStationItems: !!stationItems?.length, isIndexValid: currentIndex < stationItems.length, hasUserInteracted });
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
        return;
      }
      if (audio.src === stationItems[currentIndex].dataset.value && !audio.paused) {
        console.log("Пропуск tryAutoPlay: аудіо вже відтворюється з правильним src");
        return;
      }
      if (!isValidUrl(stationItems[currentIndex].dataset.value)) {
        console.error("Невалідний URL:", stationItems[currentIndex].dataset.value);
        errorCount++;
        if (errorCount >= ERROR_LIMIT) {
          console.error("Досягнуто ліміт помилок відтворення");
        }
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
        return;
      }
      audio.pause();
      audio.src = "";
      audio.src = stationItems[currentIndex].dataset.value;
      console.log("Спроба відтворення:", audio.src);
      const playPromise = audio.play();

      playPromise
        .then(() => {
          errorCount = 0;
          console.log("Відтворення розпочато успішно");
          document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
        })
        .catch(error => {
          console.error("Помилка відтворення:", error);
          if (error.name !== "AbortError") {
            errorCount++;
            if (errorCount >= ERROR_LIMIT) {
              console.error("Досягнуто ліміт помилок відтворення");
            }
          }
          document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
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

      if (stationItems.length && currentIndex < stationItems.length) {
        changeStation(currentIndex);
      }
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
      stationItems?.forEach(i => i.classList.remove("selected"));
      item.classList.add("selected");
      currentIndex = index;
      updateCurrentStationInfo(item);
      localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
      tryAutoPlay();
    }

    function updateCurrentStationInfo(item) {
      if (!currentStationInfo) {
        console.error("currentStationInfo не знайдено");
        return;
      }
      const stationNameElement = currentStationInfo.querySelector(".station-name");
      const stationGenreElement = currentStationInfo.querySelector(".station-genre");
      const stationCountryElement = currentStationInfo.querySelector(".station-country");

      console.log("Оновлення currentStationInfo з даними:", item.dataset);

      if (stationNameElement) {
        stationNameElement.textContent = item.dataset.name || "Unknown";
      } else {
        console.error("Елемент .station-name не знайдено в currentStationInfo");
      }
      if (stationGenreElement) {
        stationGenreElement.textContent = `жанр: ${item.dataset.genre || "Unknown"}`;
      } else {
        console.error("Елемент .station-genre не знайдено в currentStationInfo");
      }
      if (stationCountryElement) {
        stationCountryElement.textContent = `країна: ${item.dataset.country || "Unknown"}`;
      } else {
        console.error("Елемент .station-country не знайдено в currentStationInfo");
      }
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
      if (!playPauseBtn || !audio) {
        console.error("playPauseBtn або audio не знайдено");
        return;
      }
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

    const eventListeners = {
      keydown: e => {
        hasUserInteracted = true;
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
          audio.src = "";
          audio.src = stationItems[currentIndex].dataset.value;
          tryAutoPlay();
        }
      },
      resume: () => {
        if (isPlaying && navigator.connection?.type !== "none") {
          if (!audio.paused) return;
          audio.pause();
          audio.src = "";
          audio.src = stationItems[currentIndex].dataset.value;
          tryAutoPlay();
        }
      }
    };

    function addEventListeners() {
      document.addEventListener("keydown", eventListeners.keydown);
      document.addEventListener("visibilitychange", eventListeners.visibilitychange);
      document.addEventListener("resume", eventListeners.resume);
    }

    function removeEventListeners() {
      document.removeEventListener("keydown", eventListeners.keydown);
      document.removeEventListener("visibilitychange", eventListeners.visibilitychange);
      document.removeEventListener("resume", eventListeners.resume);
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
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = null;
      }
    });

    audio.addEventListener("error", () => {
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
      console.error("Помилка аудіо:", audio.error?.message, "для URL:", audio.src);
      if (isPlaying && errorCount < ERROR_LIMIT) {
        errorCount++;
        setTimeout(nextStation, 1000);
      } else if (errorCount >= ERROR_LIMIT) {
        console.error("Досягнуто ліміт помилок відтворення");
      }
    });

    audio.addEventListener("volumechange", () => {
      localStorage.setItem("volume", audio.volume);
    });

    window.addEventListener("online", () => {
      console.log("Мережа відновлена");
      if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
        audio.pause();
        audio.src = "";
        audio.src = stationItems[currentIndex].dataset.value;
        tryAutoPlay();
      }
    });

    window.addEventListener("offline", () => {
      console.log("Втрачено з'єднання з мережею");
    });

    addEventListeners();

    window.addEventListener("beforeunload", () => {
      removeEventListeners();
    });

    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", togglePlayPause);
      navigator.mediaSession.setActionHandler("pause", togglePlayPause);
      navigator.mediaSession.setActionHandler("previoustrack", prevStation);
      navigator.mediaSession.setActionHandler("nexttrack", nextStation);
    }

    document.addEventListener("click", () => {
      hasUserInteracted = true;
    });

    applyTheme(currentTheme);
    loadStations();
  }
});