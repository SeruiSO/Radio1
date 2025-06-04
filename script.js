// Оголошення змінних
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
let sleepTimer = null;
let touchStartX = null;
let touchEndX = null;

document.addEventListener("DOMContentLoaded", () => {
  // DOM-елементи
  const audio = document.getElementById("audioPlayer");
  const stationList = document.getElementById("stationList");
  const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
  const currentStationInfo = document.getElementById("currentStationInfo");
  const themeToggle = document.querySelector(".theme-toggle");
  const sleepTimerBtn = document.querySelector(".sleep-timer-btn");
  const sleepTimerModal = document.getElementById("sleepTimerModal");
  const volumeBtn = document.querySelector(".volume-btn");
  const volumeSlider = document.getElementById("volumeSlider");
  const volumeRange = document.getElementById("volumeRange");

  // Перевірка елементів
  if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle || !sleepTimerBtn || !sleepTimerModal || !volumeBtn || !volumeSlider || !volumeRange) {
    console.error("Один із необхідних DOM-елементів не знайдено");
    setTimeout(initializeApp, 100);
    return;
  }

  // Ініціалізація
  initializeApp();

  function initializeApp() {
    // Налаштування аудіо
    audio.preload = "auto";
    audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;
    volumeRange.value = audio.volume;

    // Функція дебоунса
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

    // Прив’язка обробників для кнопок вкладок з дебонсом
    document.querySelectorAll(".tab-btn").forEach((btn, index) => {
      const tabs = ["best", "techno", "trance", "ukraine", "pop"];
      const tab = tabs[index];
      const debouncedSwitchTab = debounce(() => switchTab(tab), 300);
      btn.addEventListener("click", debouncedSwitchTab);
    });

    // Прив’язка обробників для кнопок управління
    document.querySelector(".controls .control-btn:nth-child(1)").addEventListener("click", prevStation);
    playPauseBtn.addEventListener("click", togglePlayPause);
    document.querySelector(".controls .control-btn:nth-child(3)").addEventListener("click", nextStation);

    // Обробники для таймера сну
    sleepTimerBtn.addEventListener("click", () => {
      sleepTimerModal.style.display = "flex";
      sleepTimerModal.classList.add("show");
    });

    sleepTimerModal.addEventListener("click", e => {
      const target = e.target.closest(".timer-option");
      if (!target) return;
      sleepTimerModal.classList.remove("show");
      setTimeout(() => {
        sleepTimerModal.style.display = "none";
      }, 300);
      if (target.classList.contains("cancel")) {
        clearTimeout(sleepTimer);
        sleepTimer = null;
        return;
      }
      const minutes = parseInt(target.dataset.minutes);
      clearTimeout(sleepTimer);
      sleepTimer = setTimeout(() => {
        audio.pause();
        isPlaying = false;
        playPauseBtn.textContent = "▶";
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
        localStorage.setItem("isPlaying", isPlaying);
        sleepTimer = null;
      }, minutes * 60 * 1000);
    });

    // Обробники для гучності
    volumeBtn.addEventListener("click", () => {
      volumeSlider.style.display = volumeSlider.style.display === "none" ? "block" : "none";
    });

    volumeRange.addEventListener("input", () => {
      audio.volume = parseFloat(volumeRange.value);
      localStorage.setItem("volume", audio.volume);
    });

    // Жести для перемикання станцій
    stationList.addEventListener("touchstart", e => {
      touchStartX = e.touches[0].clientX;
    });

    stationList.addEventListener("touchend", e => {
      touchEndX = e.changedTouches[0].clientX;
      const deltaX = touchStartX - touchEndX;
      if (Math.abs(deltaX) > 50) {
        hasUserInteracted = true;
        if (deltaX > 0) {
          nextStation();
        } else {
          prevStation();
        }
      }
    });

    // Перевірка валідності URL
    function isValidUrl(url) {
      return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(url);
    }

    // Скидання інформації про станцію
    function resetStationInfo() {
      const stationNameElement = currentStationInfo.querySelector(".station-name");
      const stationGenreElement = currentStationInfo.querySelector(".station-genre");
      const stationCountryElement = currentStationInfo.querySelector(".station-country");
      if (stationNameElement) stationNameElement.textContent = "Обирайте станцію";
      else console.error("Елемент .station-name не знайдено");
      if (stationGenreElement) stationGenreElement.textContent = "жанр: -";
      else console.error("Елемент .station-genre не знайдено");
      if (stationCountryElement) stationCountryElement.textContent = "країна: -";
      else console.error("Елемент .station-country не знайдено");
    }

    // Завантаження станцій
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
      }).catch(error => console.error("Помилка реєстрації Service Worker:", error));

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

    // Спроба відтворення
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
          document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
          return;
        }
        nextStation();
        return;
      }
      // Скасувати попереднє відтворення
      audio.pause();
      audio.src = "";
      audio.src = stationItems[currentIndex].dataset.value;
      console.log("Спроба відтворення:", audio.src);
      const playPromise = audio.play();
      playPromise.then(() => {
        errorCount = 0;
        console.log("Відтворення розпочато успішно");
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
        if ("mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "playing";
        }
      }).catch(error => {
        console.error("Помилка відтворення:", error);
        if (error.name !== "AbortError") {
          errorCount++;
          if (errorCount >= ERROR_LIMIT) {
            console.error("Досягнуто ліміт помилок відтворення");
            document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
          } else {
            nextStation();
          }
        }
      });
    }

    // Перемикання вкладок
    function switchTab(tab) {
      if (!["best", "techno", "trance", "ukraine", "pop"].includes(tab)) tab = "techno";
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
        item.innerHTML = `
          <span>${station.emoji || "🎶"} ${station.name}</span>
          <button class="favorite-btn ${favoriteStations.includes(station.name) ? "favorited" : ""}">★</button>
        `;
        fragment.appendChild(item);
      });
      stationList.innerHTML = "";
      stationList.appendChild(fragment);
      stationItems = stationList.querySelectorAll(".station-item");

      // Прокрутка до поточної станції
      if (stationItems.length && currentIndex < stationItems.length && !stationItems[currentIndex].classList.contains("empty")) {
        stationItems[currentIndex].scrollIntoView({ behavior: "smooth", block: "center" });
      }

      // Дебонс для кліках по станціях
      const debouncedStationClick = debounce(e => {
        const item = e.target.closest(".station-item");
        const favoriteBtn = e.target.closest(".favorite-btn");
        if (item && !item.classList.contains("empty")) {
          hasUserInteracted = true;
          currentIndex = Array.from(stationItems).indexOf(item);
          changeStation(currentIndex);
        }
        if (favoriteBtn) {
          e.stopPropagation();
          toggleFavorite(item.dataset.name);
        }
      }, 300);

      stationList.addEventListener("click", debouncedStationClick);
      stationList.addEventListener("click", debouncedStationClick);

      if (stationItems?.length && currentIndex < stationItems.length) {
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
      if (currentTab === "best") {
        switchTab("best");
      } else {
        updateStationList();
      }
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

    // Обновлення інформації про станцію
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
      } else console.error("Елемент .station-name не знайдено");
      if (stationGenreElement) {
        stationGenreElement.textContent = `жанр: ${item.dataset.genre || ""}`;
      } else console.error("Елемент .station-genre не знайдено");
      if (stationCountryElement) {
        stationCountryElement.textContent = `країна: ${item.dataset.country || ""}`;
      } else console.error("Елемент .station-country не знайдено");
      if ("mediaSession" in window.navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: item.dataset.name || "Unknown Station",
          artist: `${item.dataset.genre || "Unknown"} | ${item.dataset.country || "Unknown"}`,
          album: "Radio S O"
        });
      }
    }

    // Керування відтворенням
    function prevStation() {
      hasUserInteracted = true;
      currentIndex = currentIndex > 0 ? currentIndex - 1 : stationItems.length - 1;
      if (stationItems?.[currentIndex]?.classList.contains("empty")) currentIndex = 0;
      changeStation(currentIndex);
    }

    function nextStation() {
      hasUserInteracted = true;
      currentIndex = currentIndex < stationItems.length - 1 ? currentIndex + 1 : 0;
      if (stationItems?.[currentIndex]?.classList.contains("empty")) currentIndex = 0;
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

    // Обробники подій
    const eventListeners = {
      keydown: e => {
        hasUserInteracted = true;
        if (e.key === "ArrowLeft") prevStation();
        else if (e.key === "ArrowRight") nextStation();
        else if (e.key === " ") {
          e.preventDefault();
          togglePlayPause();
        }
      },
      visibilitychange: () => {
        if (!document.hidden && isPlaying && navigator.onLine) {
          if (!audio.paused) return;
          audio.pause();
          audio.src = "";
          if (stationItems?.length && currentIndex < stationItems.length) {
            audio.src = stationItems[currentIndex].dataset.value;
            tryAutoPlay();
          }
        } else if (document.hidden && isPlaying) {
          if ("mediaSession" in navigator) {
            navigator.mediaSession.playbackState = "playing";
          }
        }
      },
      resume: () => {
        if (isPlaying && navigator.connection?.type !== "none") {
          if (!audio.paused) return;
          audio.pause();
          audio.src = "";
          if (stationItems?.length && currentIndex < stationItems.length) {
            audio.src = stationItems[currentIndex].dataset.value;
            tryAutoPlay();
          }
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

    // Додаємо слухачі audio
    audio.addEventListener("playing", () => {
      isPlaying = true;
      playPauseBtn.textContent = "⏸";
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
      localStorage.setItem("isPlaying", isPlaying);
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "playing";
      }
    });

    audio.addEventListener("pause", () => {
      isPlaying = false;
      playPauseBtn.textContent = "▶";
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
      localStorage.setItem("isPlaying", isPlaying);
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "paused";
      }
    });

    audio.addEventListener("error", () => {
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
      console.error("Audio error:", audio.error?.message, "for URL:", audio.src);
      if (isPlaying && errorCount < ERROR_LIMIT) {
        errorCount++;
        setTimeout(nextStation, 500);
      } else if (errorCount >= ERROR_LIMIT) {
        console.error("Досягнуто ліміт помилок відтворення");
      }
    });

    audio.addEventListener("volumechange", () => {
      localStorage.setItem("volume", audio.volume);
      volumeRange.value = audio.volume;
    });

    // Моніторинг мережі
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
      console.log("Втрата мережі");
      if (isPlaying) {
        audio.pause();
        isPlaying = false;
        playPauseBtn.textContent = "▶";
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
        localStorage.setItem("isPlaying", isPlaying);
      }
    });

    // MediaSession API для керування відтворенням
    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => {
        hasUserInteracted = true;
        togglePlayPause();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        hasUserInteracted = true;
        togglePlayPause();
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        hasUserInteracted = true;
        prevStation();
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        hasUserInteracted = true;
        nextStation();
      });
    }

    // Запуск завантаження станцій
    applyTheme(currentTheme);
    addEventListeners();
    loadStations();

    // Очищення при закритті сторінки
    window.addEventListener("unload", () => {
      removeEventListeners();
      audio.pause();
      audio.src = "";
      abortController.abort();
    });
  }
});