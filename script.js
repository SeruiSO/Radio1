let currentTab = localStorage.getItem("currentTab") || "techno";
let hasUserInteracted = false;
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let stationLists = {};
let searchResults = [];
let stationItems = null;
let abortController = new AbortController();
let errorCount = 0;
const ERROR_LIMIT = 5;

document.addEventListener("DOMContentLoaded", async () => {
  const audio = document.getElementById("audioPlayer");
  const stationList = document.getElementById("stationList");
  const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
  const currentStationInfo = document.getElementById("currentStationInfo");
  const themeToggle = document.querySelector(".theme-toggle");
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const clearSearchBtn = document.getElementById("clearSearchBtn");

  if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle || !searchInput || !searchBtn || !clearSearchBtn) {
    console.error("Один із необхідних DOM-елементів не знайдено");
    setTimeout(initializeApp, 100);
    return;
  }

  await initializeApp();

  async function initializeApp() {
    audio.preload = "auto";
    audio.playsinline = true;
    audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

    document.querySelectorAll(".tab-btn").forEach((btn, index) => {
      const tabs = ["best", "techno", "trance", "ukraine", "pop", "search"];
      const tab = tabs[index];
      btn.addEventListener("click", () => switchTab(tab));
    });

    document.querySelector(".controls .control-btn:nth-child(1)").addEventListener("click", prevStation);
    document.querySelector(".controls .control-btn:nth-child(2)").addEventListener("click", togglePlayPause);
    document.querySelector(".controls .control-btn:nth-child(3)").addEventListener("click", nextStation);

    searchBtn.addEventListener("click", () => searchStations(searchInput.value));
    clearSearchBtn.addEventListener("click", clearSearch);
    searchInput.addEventListener("keypress", e => {
      if (e.key === "Enter") searchStations(searchInput.value);
    });

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
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = null;
      }
    }

    async function searchStations(query) {
      if (!query.trim()) {
        stationList.innerHTML = "<div class='station-item empty'>Введіть запит для пошуку</div>";
        searchResults = [];
        return;
      }
      stationList.innerHTML = "<div class='station-item empty'>Пошук...</div>";
      try {
        abortController.abort();
        abortController = new AbortController();
        const response = await fetch(`https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(query)}`, {
          cache: "no-cache",
          signal: abortController.signal
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        searchResults = data
          .filter(station => station.url_resolved && isValidUrl(station.url_resolved))
          .map(station => ({
            value: station.url_resolved,
            name: station.name || "Без назви",
            genre: station.tags ? station.tags.split(",")[0] : "Невідомий жанр",
            country: station.country || "Невідома країна",
            emoji: getEmojiForGenre(station.tags || "")
          }));
        if (!searchResults.length) {
          stationList.innerHTML = "<div class='station-item empty'>Нічого не знайдено</div>";
          return;
        }
        currentTab = "search";
        localStorage.setItem("currentTab", currentTab);
        currentIndex = 0;
        await updateStationList();
        document.querySelectorAll(".tab-btn").forEach(btn => btn.setAttribute("aria-selected", "false"));
        document.querySelector(".tab-btn:nth-child(6)").setAttribute("aria-selected", "true");
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Помилка пошуку:", error);
          stationList.innerHTML = "<div class='station-item empty'>Помилка пошуку</div>";
        }
      }
    }

    function clearSearch() {
      searchInput.value = "";
      searchResults = [];
      if (currentTab === "search") {
        stationList.innerHTML = "<div class='station-item empty'>Введіть запит для пошуку</div>";
      }
    }

    function getEmojiForGenre(tags) {
      const tag = tags.toLowerCase();
      if (tag.includes("techno")) return "⚡";
      if (tag.includes("trance")) return "🎶";
      if (tag.includes("pop")) return "🎶";
      if (tag.includes("rock")) return "🎸";
      if (tag.includes("jazz")) return "🎷";
      return "📻";
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
        const validTabs = [...Object.keys(stationLists), "best", "search"];
        if (!validTabs.includes(currentTab)) {
          currentTab = validTabs[0] || "techno";
          localStorage.setItem("currentTab", currentTab);
        }
        currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
        await switchTab(currentTab);
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
      if (!themes[theme]) {
        console.warn(`Тема ${theme} не знайдена, застосовується стандартна тема neon-pulse`);
        theme = "neon-pulse";
      }
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

    async function fetchStreamMetadata(url) {
      try {
        const response = await fetch(`${url}/status-json.xsl`, { cache: "no-cache" });
        const data = await response.json();
        const track = data.icestats?.source?.title || stationItems[currentIndex]?.dataset.name || "Unknown Station";
        if ("mediaSession" in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: track,
            artist: stationItems[currentIndex]?.dataset.genre || "Unknown",
            album: stationItems[currentIndex]?.dataset.country || "Unknown",
            artwork: [
              { src: "icon-192.png", sizes: "192x192", type: "image/png" },
              { src: "icon-512.png", sizes: "512x512", type: "image/png" }
            ]
          });
        }
      } catch (error) {
        console.error("Помилка отримання метаданих:", error);
      }
    }

    function tryAutoPlay() {
      if (!navigator.onLine) {
        console.log("Пристрій офлайн, пропускаємо відтворення");
        return;
      }
      if (!isPlaying || !stationItems?.length || currentIndex >= stationItems.length || !hasUserInteracted) {
        console.log("Пропуск tryAutoPlay", { isPlaying, hasStationItems: !!stationItems?.length, isIndexValid: currentIndex < stationItems?.length, hasUserInteracted });
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
          resetStationInfo();
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
          fetchStreamMetadata(stationItems[currentIndex].dataset.value);
        })
        .catch(error => {
          console.error("Помилка відтворення:", error);
          if (error.name !== "AbortError") {
            errorCount++;
            if (errorCount >= ERROR_LIMIT) {
              console.error("Досягнуто ліміт помилок відтворення");
              resetStationInfo();
            }
          }
          document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
        });
    }

    async function switchTab(tab) {
      if (!["techno", "trance", "ukraine", "pop", "best", "search"].includes(tab)) tab = "techno";
      currentTab = tab;
      localStorage.setItem("currentTab", tab);
      const savedIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
      const maxIndex = tab === "best" ? favoriteStations.length : tab === "search" ? searchResults.length : stationLists[tab]?.length || 0;
      currentIndex = savedIndex < maxIndex ? savedIndex : 0;
      await updateStationList();
      document.querySelectorAll(".tab-btn").forEach(btn => btn.setAttribute("aria-selected", "false"));
      const tabIndex = ["best", "techno", "trance", "ukraine", "pop", "search"].indexOf(tab) + 1;
      const activeBtn = document.querySelector(`.tab-btn:nth-child(${tabIndex})`);
      if (activeBtn) activeBtn.setAttribute("aria-selected", "true");
      if (stationItems?.length && currentIndex < stationItems.length) tryAutoPlay();
    }

    async function updateStationList() {
      if (!stationList) {
        console.error("stationList не знайдено");
        return;
      }
      let stations = currentTab === "best"
        ? favoriteStations
            .map(name => Object.values(stationLists).flat().find(s => s.name === name) || searchResults.find(s => s.name === name))
            .filter(s => s)
        : currentTab === "search"
        ? searchResults
        : stationLists[currentTab] || [];

      if (!stations.length) {
        currentIndex = 0;
        stationItems = [];
        stationList.innerHTML = `<div class='station-item empty'>${currentTab === "best" ? "Немає улюблених станцій" : currentTab === "search" ? "Введіть запит для пошуку" : "Немає станцій у цій категорії"}</div>`;
        resetStationInfo();
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
        item.setAttribute("role", "option");
        item.setAttribute("tabindex", "0");
        item.setAttribute("aria-selected", index === currentIndex ? "true" : "false");
        item.innerHTML = `${station.emoji} ${station.name}<button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}" aria-label="Додати до улюблених">★</button>`;
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

      stationItems.forEach(item => {
        item.addEventListener("keydown", e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            item.click();
          }
        });
      });

      if (stationItems.length && currentIndex < stationItems.length) {
        changeStation(currentIndex);
      }
    }

    function toggleFavorite(stationName) {
      hasUserInteracted = true;
      const station = Object.values(stationLists).flat().find(s => s.name === stationName) || searchResults.find(s => s.name === stationName);
      if (!station) return;
      if (favoriteStations.includes(stationName)) {
        favoriteStations = favoriteStations.filter(name => name !== stationName);
      } else {
        favoriteStations.unshift(stationName);
        if (!Object.values(stationLists).flat().some(s => s.name === stationName)) {
          const existingStation = Object.values(stationLists).flat().find(s => s.value === station.value);
          if (!existingStation) {
            stationLists.search = stationLists.search || [];
            stationLists.search.push(station);
          }
        }
      }
      localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
      if (currentTab === "best") switchTab("best");
      else updateStationList();
    }

    function changeStation(index) {
      if (!stationItems || index < 0 || index >= stationItems.length || stationItems[index].classList.contains("empty")) {
        console.warn("Неможливо змінити станцію: stationItems не ініціалізовано або невалідний індекс");
        resetStationInfo();
        return;
      }
      const item = stationItems[index];
      stationItems?.forEach(i => i.setAttribute("aria-selected", "false"));
      item.setAttribute("aria-selected", "true");
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
          artist: item.dataset.genre || "Unknown",
          album: item.dataset.country || "Unknown",
          artwork: [
            { src: "icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "icon-512.png", sizes: "512x512", type: "image/png" }
          ]
        });
      }
    }

    function prevStation() {
      hasUserInteracted = true;
      if (!stationItems || !stationItems.length) {
        console.warn("stationItems не ініціалізовано, пропускаємо prevStation");
        return;
      }
      currentIndex = currentIndex > 0 ? currentIndex - 1 : stationItems.length - 1;
      if (stationItems[currentIndex].classList.contains("empty")) currentIndex = 0;
      changeStation(currentIndex);
    }

    function nextStation() {
      hasUserInteracted = true;
      if (!stationItems || !stationItems.length) {
        console.warn("stationItems не ініціалізовано, пропускаємо nextStation");
        return;
      }
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
        if (!document.hidden && isPlaying && navigator.onLine && stationItems?.length) {
          if (!audio.paused) return;
          audio.pause();
          audio.src = "";
          if (stationItems[currentIndex]) {
            audio.src = stationItems[currentIndex].dataset.value;
            tryAutoPlay();
          }
        }
      },
      resume: () => {
        if (isPlaying && navigator.connection?.type !== "none" && stationItems?.length) {
          if (!audio.paused) return;
          audio.pause();
          audio.src = "";
          if (currentIndex < stationItems.length) {
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
      if (stationItems?.length && currentIndex < stationItems.length) {
        fetchStreamMetadata(stationItems[currentIndex].dataset.value);
      }
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
      if (isPlaying && errorCount < ERROR_LIMIT && stationItems?.length) {
        errorCount++;
        setTimeout(nextStation, 1000);
      } else if (errorCount >= ERROR_LIMIT) {
        console.error("Досягнуто ліміт помилок відтворення");
        resetStationInfo();
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
      resetStationInfo();
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
      navigator.mediaSession.setActionHandler("seekbackward", () => {
        console.log("Seek backward");
      });
      navigator.mediaSession.setActionHandler("seekforward", () => {
        console.log("Seek forward");
      });
      navigator.mediaSession.setActionHandler("stop", () => {
        audio.pause();
        togglePlayPause();
      });
      navigator.mediaSession.setActionHandler("seekto", details => {
        console.log("Seek to:", details.seekTime);
      });
    }

    document.addEventListener("click", () => {
      hasUserInteracted = true;
    });

    applyTheme(currentTheme);
    await loadStations();
    if (stationItems?.length && currentIndex < stationItems.length) {
      tryAutoPlay();
    }
  }
});