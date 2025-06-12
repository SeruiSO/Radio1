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

// Кешування DOM-елементів
const elements = {
  audio: document.getElementById("audioPlayer"),
  stationList: document.getElementById("stationList"),
  playPauseBtn: document.querySelector(".controls .control-btn:nth-child(2)"),
  currentStationInfo: document.getElementById("currentStationInfo"),
  themeToggle: document.querySelector(".theme-toggle"),
  themeSelect: document.getElementById("theme-select"),
  bluetoothBtn: document.getElementById("bluetooth-btn"),
  prevBtn: document.querySelector(".controls .control-btn:nth-child(1)"),
  nextBtn: document.querySelector(".controls .control-btn:nth-child(3)")
};

// Функція для debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Очікування завантаження DOM
document.addEventListener("DOMContentLoaded", () => {
  // Перевірка наявності всіх необхідних елементів
  if (!elements.audio || !elements.stationList || !elements.playPauseBtn || !elements.currentStationInfo || !elements.themeToggle || !elements.themeSelect || !elements.bluetoothBtn) {
    console.error("Один із необхідних DOM-елементів не знайдено");
    setTimeout(initializeApp, 100);
    return;
  }

  // Ініціалізація програми
  initializeApp();

  function initializeApp() {
    // Налаштування аудіо
    elements.audio.preload = "auto";
    elements.audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

    // Прив’язка обробників подій для кнопок вкладок
    document.querySelectorAll(".tab-btn").forEach((btn, index) => {
      const tabs = ["best", "techno", "trance", "ukraine", "pop"];
      const tab = tabs[index];
      btn.addEventListener("click", () => switchTab(tab));
    });

    // Прив’язка обробників для кнопок керування
    elements.prevBtn.addEventListener("click", prevStation);
    elements.playPauseBtn.addEventListener("click", togglePlayPause);
    elements.nextBtn.addEventListener("click", nextStation);

    // Функція для перевірки валідності URL
    function isValidUrl(url) {
      return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(url);
    }

    // Функція для скидання інформації про станцію
    function resetStationInfo() {
      const stationNameElement = elements.currentStationInfo.querySelector(".station-name");
      const stationGenreElement = elements.currentStationInfo.querySelector(".station-genre");
      const stationCountryElement = elements.currentStationInfo.querySelector(".station-country");
      if (stationNameElement) stationNameElement.textContent = "Обирайте станцію";
      else console.error("Елемент .station-name не знайдено в currentStationInfo");
      if (stationGenreElement) stationGenreElement.textContent = "жанр: -";
      else console.error("Елемент .station-genre не знайдено в currentStationInfo");
      if (stationCountryElement) stationCountryElement.textContent = "країна: -";
      else console.error("Елемент .station-country не знайдено в currentStationInfo");
    }

    // Завантаження станцій
    async function loadStations() {
      console.time("loadStations");
      elements.stationList.innerHTML = "<div class='station-item empty'>Завантаження...</div>";
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
          elements.stationList.innerHTML = "<div class='station-item empty'>Не вдалося завантажити станції</div>";
        }
      } finally {
        console.timeEnd("loadStations");
      }
    }

    // Теми (усунуто дублювання кольорів)
    const themes = {
      "neon-pulse": {
        bodyBg: "#0A0A0A",
        containerBg: "#121212",
        accent: "#00F0FF",
        text: "#F0F0F0",
        accentGradient: "#003C4B"
      },
      "lime-surge": {
        bodyBg: "#1A1A1A",
        containerBg: "#222222",
        accent: "#B2FF59",
        text: "#E8F5E9",
        accentGradient: "#2E4B2F"
      },
      "flamingo-flash": {
        bodyBg: "#141414",
        containerBg: "#1C1C1C",
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
        bodyBg: "#0E0E0E",
        containerBg: "#161616",
        accent: "#26C6DA",
        text: "#B2EBF2",
        accentGradient: "#1A3C4B"
      },
      "cosmic-indigo": {
        bodyBg: "#111111",
        containerBg: "#191919",
        accent: "#3F51B5",
        text: "#BBDEFB",
        accentGradient: "#1A2A5A"
      },
      "mystic-jade": {
        bodyBg: "#0C0C0C",
        containerBg: "#141414",
        accent: "#26A69A",
        text: "#B2DFDB",
        accentGradient: "#1A3C4B"
      },
      "aurora-haze": {
        bodyBg: "#131313",
        containerBg: "#1B1B1B",
        accent: "#64FFDA",
        text: "#E0F7FA",
        accentGradient: "#1A4B4B"
      },
      "starlit-amethyst": {
        bodyBg: "#0B0B0B",
        containerBg: "#131313",
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
      // Оновлення іконки theme-toggle
      elements.themeToggle.textContent = theme === "lunar-frost" ? "☀️" : "🌙";
    }

    // Популяція випадаючого списку тем
    function populateThemeSelect() {
      const themeOptions = Object.keys(themes).map(theme => 
        `<option value="${theme}" ${theme === currentTheme ? "selected" : ""}>${theme}</option>`
      ).join('');
      elements.themeSelect.innerHTML = themeOptions;
      elements.themeSelect.addEventListener('change', () => applyTheme(elements.themeSelect.value));
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
      elements.themeSelect.value = nextTheme;
    }

    // Додаємо обробники подій для зміни теми
    elements.themeToggle.addEventListener("click", toggleTheme);
    populateThemeSelect();

    // Bluetooth інтеграція
    async function connectToBluetooth() {
      try {
        const device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['battery_service', 'device_information']
        });
        console.log('Підключено до:', device.name);
        // Логіка для керування відтворенням через Bluetooth
        const server = await device.gatt.connect();
        console.log('GATT сервер підключено');
      } catch (error) {
        console.error('Помилка Bluetooth:', error);
      }
    }

    elements.bluetoothBtn.addEventListener('click', connectToBluetooth);

    // Налаштування Service Worker
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
          elements.audio.pause();
          elements.audio.src = "";
          elements.audio.src = stationItems[currentIndex].dataset.value;
          tryAutoPlay();
        }
      });
    }

    // Функція для спроби відтворення
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
      if (elements.audio.src === stationItems[currentIndex].dataset.value && !elements.audio.paused) {
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
      elements.audio.pause();
      elements.audio.src = "";
      elements.audio.src = stationItems[currentIndex].dataset.value;
      console.log("Спроба відтворення:", elements.audio.src);
      const playPromise = elements.audio.play();

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

    // Перемикання вкладок
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

    // Оновлення списку станцій з новими емодзі
    function updateStationList() {
      if (!elements.stationList) {
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
        elements.stationList.innerHTML = `<div class='station-item empty'>${currentTab === "best" ? "Немає улюблених станцій" : "Немає станцій у цій категорії"}</div>`;
        return;
      }

      // Визначення емодзі за жанром
      const genreEmojis = {
        "Techno": "🎛️",
        "Minimal Techno": "🎛️",
        "Melodic Techno": "🎛️",
        "Big Room": "🎛️",
        "Trance": "🎵",
        "Vocal Trance": "🎵",
        "Uplifting Trance": "🎵",
        "Psytrance": "🎵",
        "Танцювальна музика": "💃",
        "Танцювальна/EDM": "💃",
        "Поп-музика": "🎤",
        "Рок-музика": "🎸",
        "Легка музика": "🌿",
        "Романтична музика": "🎵",
        "Шансон/Естрада": "🎙",
        "Класична музика": "🎻",
        "Українська музика": "🇺🇦",
        "Pop": "🎤",
        "Pop/Top 40": "🎤",
        "Pop/Rock": "🎸",
        "Christian Pop": "🎤",
        "Italo-Pop": "🎤",
        "default": "📻"
      };

      const fragment = document.createDocumentFragment();
      stations.forEach((station, index) => {
        const item = document.createElement("div");
        item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
        item.dataset.value = station.value;
        item.dataset.name = station.name;
        item.dataset.genre = station.genre;
        item.dataset.country = station.country;
        const emoji = genreEmojis[station.genre] || genreEmojis.default;
        item.innerHTML = `${emoji} ${station.name}<button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}">★</button>`;
        fragment.appendChild(item);
      });
      elements.stationList.innerHTML = "";
      elements.stationList.appendChild(fragment);
      stationItems = elements.stationList.querySelectorAll(".station-item");

      if (stationItems.length && currentIndex < stationItems.length && !stationItems[currentIndex].classList.contains("empty")) {
        stationItems[currentIndex].scrollIntoView({ behavior: "smooth", block: "start" });
      }

      elements.stationList.onclick = e => {
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

    // Перемикання улюблених станцій
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

    // Зміна станції
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

    // Оновлення інформації про станцію
    function updateCurrentStationInfo(item) {
      if (!elements.currentStationInfo) {
        console.error("currentStationInfo не знайдено");
        return;
      }
      const stationNameElement = elements.currentStationInfo.querySelector(".station-name");
      const stationGenreElement = elements.currentStationInfo.querySelector(".station-genre");
      const stationCountryElement = elements.currentStationInfo.querySelector(".station-country");

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

    // Керування відтворенням
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
      if (!elements.playPauseBtn || !elements.audio) {
        console.error("playPauseBtn або audio не знайдено");
        return;
      }
      hasUserInteracted = true;
      if (elements.audio.paused) {
        isPlaying = true;
        tryAutoPlay();
        elements.playPauseBtn.textContent = "⏸";
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
      } else {
        elements.audio.pause();
        isPlaying = false;
        elements.playPauseBtn.textContent = "▶";
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
      }
      localStorage.setItem("isPlaying", isPlaying);
    }

    // Обробники подій
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
          if (!elements.audio.paused) return;
          elements.audio.pause();
          elements.audio.src = "";
          elements.audio.src = stationItems[currentIndex].dataset.value;
          tryAutoPlay();
        }
      },
      resume: () => {
        if (isPlaying && navigator.connection?.type !== "none") {
          if (!elements.audio.paused) return;
          elements.audio.pause();
          elements.audio.src = "";
          elements.audio.src = stationItems[currentIndex].dataset.value;
          tryAutoPlay();
        }
      }
    };

    // Додаємо слухачі
    function addEventListeners() {
      document.addEventListener("keydown", debounce(eventListeners.keydown, 200));
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
    elements.audio.addEventListener("playing", () => {
      isPlaying = true;
      elements.playPauseBtn.textContent = "⏸";
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
      localStorage.setItem("isPlaying", isPlaying);
    });

    elements.audio.addEventListener("pause", () => {
      isPlaying = false;
      elements.playPauseBtn.textContent = "▶";
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
      localStorage.setItem("isPlaying", isPlaying);
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = null;
      }
    });

    elements.audio.addEventListener("error", () => {
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
      console.error("Помилка аудіо:", elements.audio.error?.message, "для URL:", elements.audio.src);
      if (isPlaying && errorCount < ERROR_LIMIT) {
        errorCount++;
        setTimeout(() => {
          elements.audio.src = stationItems[currentIndex].dataset.value;
          tryAutoPlay();
        }, 2000);
      } else if (errorCount >= ERROR_LIMIT) {
        console.error("Досягнуто ліміт помилок відтворення");
      }
    });

    elements.audio.addEventListener("volumechange", () => {
      localStorage.setItem("volume", elements.audio.volume);
    });

    // Моніторинг мережі
    window.addEventListener("online", () => {
      console.log("Мережа відновлена");
      if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
        elements.audio.pause();
        elements.audio.src = "";
        elements.audio.src = stationItems[currentIndex].dataset.value;
        tryAutoPlay();
      }
    });

    window.addEventListener("offline", () => {
      console.log("Втрачено з'єднання з мережею");
    });

    // Ініціалізація слухачів
    addEventListeners();

    // Очищення слухачів перед оновленням сторінки
    window.addEventListener("beforeunload", () => {
      removeEventListeners();
    });

    // Media Session API з підтримкою seekforward/seekbackward
    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", togglePlayPause);
      navigator.mediaSession.setActionHandler("pause", togglePlayPause);
      navigator.mediaSession.setActionHandler("previoustrack", prevStation);
      navigator.mediaSession.setActionHandler("nexttrack", nextStation);
      navigator.mediaSession.setActionHandler("seekforward", nextStation);
      navigator.mediaSession.setActionHandler("seekbackward", prevStation);
    }

    // Відстеження взаємодії користувача
    document.addEventListener("click", () => {
      hasUserInteracted = true;
    });

    // Ініціалізація
    applyTheme(currentTheme);
    loadStations();
  }
});