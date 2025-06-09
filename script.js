let currentTab = localStorage.getItem("currentTab") || "best";
let hasUserInteracted = false;
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let stationLists = {};
let stationItems;
let searchResults = [];
let abortController = new AbortController();
let errorCount = 0;
const ERROR_LIMIT = 5;

document.addEventListener("DOMContentLoaded", () => {
  // Ініціалізація DOM-елементів
  const audio = document.getElementById("audioPlayer");
  const stationList = document.getElementById("stationList");
  const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
  const prevBtn = document.querySelector(".controls .control-btn:nth-child(1)");
  const nextBtn = document.querySelector(".controls .control-btn:nth-child(3)");
  const currentStationInfo = document.getElementById("currentStationInfo");
  const themeToggle = document.querySelector(".theme-toggle");
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const clearSearchBtn = document.getElementById("clearSearchBtn");
  const tabButtons = document.querySelectorAll(".tab-btn");

  // Перевірка наявності всіх необхідних елементів
  if (!audio || !stationList || !playPauseBtn || !prevBtn || !nextBtn || !currentStationInfo || !themeToggle || !searchInput || !searchBtn || !clearSearchBtn || !tabButtons.length) {
    console.error("Один або кілька необхідних DOM-елементів не знайдено:", {
      audio: !!audio,
      stationList: !!stationList,
      playPauseBtn: !!playPauseBtn,
      prevBtn: !!prevBtn,
      nextBtn: !!nextBtn,
      currentStationInfo: !!currentStationInfo,
      themeToggle: !!themeToggle,
      searchInput: !!searchInput,
      searchBtn: !!searchBtn,
      clearSearchBtn: !!clearSearchBtn,
      tabButtons: tabButtons.length
    });
    if (!audio) {
      console.error("Критична помилка: елемент <audio id='audioPlayer'> не знайдено. Перевірте index.html.");
      return; // Зупиняємо виконання, якщо audio відсутній
    }
    setTimeout(initializeApp, 100); // Спробувати ще раз через 100 мс
    return;
  }

  initializeApp();

  function initializeApp() {
    // Налаштування аудіоплеєра
    audio.preload = "auto";
    audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

    // Перевірка кількості вкладок
    const tabs = ["best", "techno", "trance", "ukraine", "pop", "search"];
    if (tabButtons.length !== tabs.length) {
      console.error(`Невідповідність кількості вкладок: очікується ${tabs.length}, знайдено ${tabButtons.length}`);
      stationList.innerHTML = "<div class='station-item empty'>Помилка ініціалізації вкладок</div>";
      return;
    }

    // Прив’язка обробників подій до вкладок
    tabButtons.forEach((btn, index) => {
      const tab = tabs[index];
      btn.addEventListener("click", () => switchTab(tab));
    });

    // Прив’язка обробників подій до кнопок керування
    prevBtn.addEventListener("click", prevStation);
    playPauseBtn.addEventListener("click", togglePlayPause);
    nextBtn.addEventListener("click", nextStation);

    // Обробники для пошуку
    searchBtn.addEventListener("click", () => {
      const query = searchInput.value.trim();
      if (query) searchStations(query);
    });

    searchInput.addEventListener("keypress", e => {
      if (e.key === "Enter") {
        const query = searchInput.value.trim();
        if (query) searchStations(query);
      }
    });

    clearSearchBtn.addEventListener("click", () => {
      searchInput.value = "";
      searchResults = [];
      clearSearchBtn.style.display = "none";
      if (currentTab === "search") updateStationList();
    });

    searchInput.addEventListener("input", () => {
      clearSearchBtn.style.display = searchInput.value ? "block" : "none";
    });

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

    async function searchStations(query) {
      stationList.innerHTML = "<div class='station-item empty'>Пошук...</div>";
      try {
        abortController.abort();
        abortController = new AbortController();
        const proxyUrl = "https://cors-anywhere.herokuapp.com/";
        const apiUrl = `https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(query)}&limit=20`;
        const response = await fetch(proxyUrl + apiUrl, {
          signal: abortController.signal,
          headers: { "X-Requested-With": "XMLHttpRequest" }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        searchResults = data.map(station => ({
          value: station.url_resolved,
          name: station.name,
          genre: station.tags || "Unknown",
          country: station.country || "Unknown",
          emoji: "📻"
        }));
        if (currentTab === "search") {
          currentIndex = 0;
          updateStationList();
        }
        switchTab("search");
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Помилка пошуку:", error);
          stationList.innerHTML = "<div class='station-item empty'>Помилка пошуку. Спробуйте ще раз.</div>";
        }
      }
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
        } else if (response.ok) {
          stationLists = await response.json();
          localStorage.setItem("stationsLastModified", response.headers.get("Last-Modified") || "");
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
        favoriteStations = favoriteStations.filter(name => 
          Object.values(stationLists).flat().some(s => s.name === name)
        );
        localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
        const validTabs = [...Object.keys(stationLists), "best", "search"];
        if (!validTabs.includes(currentTab)) currentTab = "best";
        localStorage.setItem("currentTab", currentTab);
        currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
        switchTab(currentTab);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Помилка завантаження станцій:", error);
          stationList.innerHTML = "<div class='station-item empty'>Не вдалося завантажити станції</div>";
        }
      } finally {
        console.timeEnd("loadStations");
      }
    }

    const themes = {
      "neon-pulse": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#00F0FF", textColor: "#F0F0F0", accentGradient: "#003C4B" },
      "lime-surge": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#B2FF59", textColor: "#E8F5E9", accentGradient: "#2E4B2F" },
      "flamingo-flash": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#FF4081", textColor: "#FCE4EC", accentGradient: "#4B1A2E" },
      "violet-vortex": { bodyBg: "#121212", containerBg: "#1A1A1A", accent: "#7C4DFF", textColor: "#EDE7F6", accentGradient: "#2E1A47" },
      "aqua-glow": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#26C6DA", textColor: "#B2EBF2", accentGradient: "#1A3C4B" },
      "cosmic-indigo": { bodyBg: "#121212", containerBg: "#1A1A1A", accent: "#3F51B5", textColor: "#BBDEFB", accentGradient: "#1A2A5A" },
      "mystic-jade": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#26A69A", textColor: "#B2DFDB", accentGradient: "#1A3C4B" },
      "aurora-haze": { bodyBg: "#121212", containerBg: "#1A1A1A", accent: "#64FFDA", textColor: "#E0F7FA", accentGradient: "#1A4B4B" },
      "starlit-amethyst": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#B388FF", textColor: "#E1BEE7", accentGradient: "#2E1A47" },
      "lunar-frost": { bodyBg: "#F5F7FA", containerBg: "#FFFFFF", accent: "#40C4FF", textColor: "#212121", accentGradient: "#B3E5FC" }
    };
    let currentTheme = localStorage.getItem("selectedTheme") || "neon-pulse";

    function applyTheme(theme) {
      const root = document.documentElement;
      root.style.setProperty("--body-bg", themes[theme].bodyBg);
      root.style.setProperty("--container-bg", themes[theme].containerBg);
      root.style.setProperty("--accent", themes[theme].accent);
      root.style.setProperty("--text", themes[theme].textColor);
      root.style.setProperty("--accent-gradient", themes[theme].accentGradient);
      localStorage.setItem("selectedTheme", theme);
      currentTheme = theme;
      document.documentElement.setAttribute("data-theme", theme);
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) themeColorMeta.setAttribute("content", themes[theme].accent);
    }

    themeToggle.addEventListener("click", () => {
      const themesOrder = ["neon-pulse", "lime-surge", "flamingo-flash", "violet-vortex", "aqua-glow", "cosmic-indigo", "mystic-jade", "aurora-haze", "starlit-amethyst", "lunar-frost"];
      const nextTheme = themesOrder[(themesOrder.indexOf(currentTheme) + 1) % themesOrder.length];
      applyTheme(nextTheme);
    });

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").then(registration => {
        registration.update();
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "activated" && navigator.serviceWorker.controller) {
                if (window.confirm("Доступна нова версія радіо. Оновити?")) window.location.reload();
              }
            });
          }
        });
      });

      navigator.serviceWorker.addEventListener("message", event => {
        if (event.data.type === "NETWORK_STATUS" && event.data.online && isPlaying && stationItems?.length && currentIndex < stationItems.length) {
          audio.pause();
          audio.src = "";
          audio.src = stationItems[currentIndex].dataset.value;
          tryAutoPlay();
        }
      });
    }

    function tryAutoPlay() {
      if (!navigator.onLine || !isPlaying || !stationItems?.length || currentIndex >= stationItems.length || !hasUserInteracted) {
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
        return;
      }
      if (audio.src === stationItems[currentIndex].dataset.value && !audio.paused) return;
      if (!isValidUrl(stationItems[currentIndex].dataset.value)) {
        console.error("Невалідний URL:", stationItems[currentIndex].dataset.value);
        errorCount++;
        if (errorCount >= ERROR_LIMIT) console.error("Досягнуто ліміт помилок відтворення");
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
        return;
      }
      audio.pause();
      audio.src = "";
      audio.src = stationItems[currentIndex].dataset.value;
      const playPromise = audio.play();
      playPromise
        .then(() => {
          errorCount = 0;
          document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
        })
        .catch(error => {
          console.error("Помилка відтворення:", error);
          if (error.name !== "AbortError") {
            errorCount++;
            if (errorCount >= ERROR_LIMIT) console.error("Досягнуто ліміт помилок");
          }
          document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
        });
    }

    function switchTab(tab) {
      if (!["best", "techno", "trance", "ukraine", "pop", "search"].includes(tab)) tab = "best";
      currentTab = tab;
      localStorage.setItem("currentTab", currentTab);
      const savedIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
      const maxIndex = tab === "best" ? favoriteStations.length : tab === "search" ? searchResults.length : stationLists[tab]?.length || 0;
      currentIndex = Math.min(savedIndex, maxIndex - 1);
      if (currentIndex < 0) currentIndex = 0;
      updateStationList();
      tabButtons.forEach(btn => btn.classList.remove("active"));
      const activeBtn = tabButtons[tabs.indexOf(tab)];
      if (activeBtn) activeBtn.classList.add("active");
      if (stationItems?.length && currentIndex < stationItems.length) tryAutoPlay();
    }

    function updateStationList() {
      if (!stationList) return;
      let stations = currentTab === "best"
        ? favoriteStations.map(name => Object.values(stationLists).flat().find(s => s.name === name)).filter(s => s)
        : currentTab === "search"
        ? searchResults
        : stationLists[currentTab] || [];

      if (!stations.length) {
        currentIndex = 0;
        stationItems = [];
        stationList.innerHTML = `<div class='station-item empty'>${name === tabName ? tabName === "best" ? "Немає улюблених станцій" : "Введіть запит для пошуку" : "Немає станцій у цій категорії"}</div>`;
        return;
      }

      const fragment = document.createDocumentFragment();
      stations.forEach((station, index) => {
        const item = document.createElement("div");
        item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
        item.dataset.value = value;
        item.dataset.name = name;
        item.dataset.genre = station.genre;
        item.dataset.country = country.name;
        item.appendHTML = `<div>${station.emoji} ${stationName || ''}<button class="favorite-btn${favoriteStations.includes(stationName) ? " favorited" : ""}">${station.emoji}</button>`;
        fragment.appendChild(item);
      });
      stationList.appendHTML = "";
      stationList.appendChild(fragment);
      stationItems = document.querySelectorAll(".station-item");

      stationItems.onclick = stationListItems;

      e => {
        const item = e.target.closest(".station-item');
        const favoriteBtn = document.querySelector(".favorite-btn");
        hasUserInteracted = true;
        if (!item && !item.classList.contains("hidden')) {
          document.currentIndex = indexOf(stationItems).indexOf(item);
          changeStation(currentIndex);
        }
        if ("favoriteBtn") {
          document.stopPropagation();
          toggleFavorite(item);
        }
      }

      if (stationItems?.length && currentIndex < stationItems.length) changeStation(currentIndex);
      }
    }

    function toggleFavorite(item) {
      hasUserInteracted = true;
      if (favoriteStations.includes("stationName")) {
        favoriteStations = stationsStations.filter(name => name !== stationName);
      } else {
        toggleFavoriteStations(stationItem);
      }
      localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
      if (hasCurrentStation === "best") {
        toggleStation("best");
      } else {
        updateStationList();
      }
    }

    function changeStation(index) {
      if (index < 0 || index >= stationItems.length || stationItems[index].classList.contains("hidden")) {
        return;
      }
      const item = document.stationItems[index];
      item?.forEach?.(i => i.classList.remove("selected"));
      stationItem.classList.add("selected");
      currentIndex = index;
      updateCurrentStationInfo(item);
      localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
      tryAutoPlay();
    }

    function updateCurrentStationInfo(item) {
      if (!currentStationInfo) {
        return;
      }
      const stationName = currentStationInfo.querySelector(".station-name");
      const stationGenre = currentStationInfo.querySelector(".station-genre");
      const stationCountry = currentStationInfo.querySelector(".station-country");

      if (stationName) {
        stationName.textContent = item.dataset.name || "Unknown";
      }
      if (stationGenre) {
        stationGenre.textContent = `жанр: ${item.dataset.genre || "Unknown"}`;
      }
      if (stationCountry) {
        stationCountry.textContent = `країна: ${item.dataset.country || "Unknown"}`;
      }
      if ("mediaSession" !== in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: item.dataset.name || "Unknown Station",
          artist: `${item.dataset.genre || "Unknown"} | ${item.dataset.country || "Unknown"}`,
          album: "Radio Music"
        });
      }
    }

    function prevStation() {
      hasUserInteracted = true;
      prevStation.setItem = currentIndex > 0 ? currentIndex - prev1 : stationItems.length - 1;
      if (stationItems[currentIndex].classList.contains("hidden")) {
        currentIndex = 0;
      }
      changeStation(currentIndex);
    }

    function nextStation() {
      hasUserInteracted = true;
      currentIndex = parseInt(currentIndex < stationItems.length - 1 ? currentIndex + 1 : 0);
      if (stationItems[currentIndex].classList.contains("hidden")) {
        currentIndex = 0;
      }
      changeStation(currentIndex);
    }

    function togglePlayPause() {
      if (!playPauseBtn || !audio || !audio) {
        return;
      }
      hasUserInteracted = true;
      if (audio.paused) {
        isPlaying = true;
        tryAutoPlay();
        playPauseBtn.textContent = "⏸";
        document.querySelectorAll(".wave-bar").forEach(bar => {
          bar.style.animationPlayState = "running";
        });
      } else {
        audio.pause();
        isPlaying = false;
        playPauseBtn.textContent = "▶";
        document.querySelectorAll(".wave-bar").forEach(bar => {
          bar.style.animationPlayState = "paused";
        }));
      }
      localStorage.setItem("isPlaying", isPlaying);
    }

    const eventListeners = {
      keydown: function(e) => {
        hasUserInteracted = true;
        if (e.key === "ArrowLeft") {
          prevStation();
        }
        if (e.key === "ArrowRight") {
          nextStation();
        }
        if (e.key === " ") {
          e.preventDefault();
          togglePlayPause();
        }
      },
      visibilitychange: () => {
        if (!document.hidden && isPlaying && navigator.isOnline) {
          if (!audio.paused) {
            return;
          }
          audio.pause();
          audio.src = "";
          audio.src = stationItems[currentIndex].dataset.value;
          tryAutoPlay();
        }
      },
      resume: () => {
          if (isPlaying && navigator.connection?.connection?.type !== "none") {
            if (!audio.paused) {
              return;
            }
            audio.paused();
            audio.src = "";
            audio.src = stationItems[currentIndex].dataset.value;
            tryAutoPlay();
          }
        }
      }
    };

    function addEventListeners() {
      document.addEventListener("keydown", eventListeners.keydown);
      document.addEventListener("visibilitychange", eventListeners.visibilitychange);
      document.addEventListener("resume", eventListeners.resume);
    }

    function removeEventListener() {
      document.removeEventListener("keydown", eventListeners.keydown);
      document.removeEventListener("visibilitychange", eventListeners.visibilitychange);
      document.removeEventListener("resume", eventListeners.resume);
    });

    audio.addEventListener("playing", () => {
      isPlaying = true;
      playPauseBtn.textContent = "⏸";
      document.querySelectorAll(".wave-bar").forEach(bar => {
        bar.style.animationPlayState = "running";
      });
      localStorage.setItem("isPlaying", isPlaying);
    });

    audio.addEventListener("pause", () => {
      document.querySelector(".isPlaying") = false;
      document.querySelector(".playPauseBtn").textContent = "▶";
      document.querySelectorAll(".wave-bar").forEach(bar => {
        bar.style.animationPlayState = "paused";
      });
      localStorage.setItem("isPlaying", isPlaying);
      if ("mediaSession" !== navigator.document.querySelector) {
        navigator.mediaSession.metadata = null;
      }
    });

    audio.addEventListener("error", () => {
      document.querySelectorAll(".wave-bar").forEach(bar => {
        bar.style.animationPlayState = "paused";
      });
      console.error("Помилка аудіо:", audio.error?.error?.message, "для URL:", audio.src);
      if (isPlaying && errorCount < ERROR_LIMIT) {
        errorCount++;
        setTimeout(nextStation, 1000);
      }) else if (errorCount >= ERROR_LIMIT) {
        console.error("Досягнуто ліміт помилок відтворення");
      }
    });

    audio.addEventListener("volumechange", () => {
      localStorage.setItem("volume", audio.volume);
    });

    window.addEventListener("online", () => {
      if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
        audio.paused();
        audio.src = "";
        audio.src = stationItems[currentIndex].dataset.value;
        tryAutoPlay();
      }
    });

    window.addEventListener("offline", () => {
      console.log("Втрачено з'єднання з мережею");
    }));

    addEventListeners();

    window.addEventListener("beforeunload", () => {
      removeEventListeners();
    }));

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