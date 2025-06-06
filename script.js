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
  const volumeSlider = document.getElementById("volumeSlider");
  const searchInput = document.getElementById("searchInput");
  const sleepTimerBtn = document.getElementById("sleepTimerBtn");
  const qualityToggle = document.getElementById("qualityToggle");
  let sleepTimerId = null;

  if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle) {
    console.error("Один із необхідних DOM-елементів не знайдено");
    setTimeout(initializeApp, 100);
    return;
  }

  function initializeApp() {
    audio.preload = "auto";
    audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;
    if (volumeSlider) volumeSlider.value = audio.volume;

    document.querySelectorAll(".tab-btn").forEach((btn, index) => {
      const tabs = ["best", "techno", "trance", "ukraine", "pop"];
      const tab = tabs[index];
      btn.addEventListener("click", () => switchTab(tab));
    });

    document.querySelector(".controls .control-btn:nth-child(1)").addEventListener("click", prevStation);
    document.querySelector(".controls .control-btn:nth-child(2)").addEventListener("click", togglePlayPause);
    document.querySelector(".controls .control-btn:nth-child(3)").addEventListener("click", nextStation);

    if (volumeSlider) {
      volumeSlider.addEventListener("input", () => {
        audio.volume = volumeSlider.value;
        localStorage.setItem("volume", audio.volume);
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        updateStationList(searchInput.value.toLowerCase());
      });
    }

    if (sleepTimerBtn) {
      sleepTimerBtn.addEventListener("click", () => {
        const minutes = prompt("Введіть час для таймера сну (хвилини, 15-60):", "30");
        const time = parseInt(minutes);
        if (time >= 15 && time <= 60) {
          if (sleepTimerId) clearTimeout(sleepTimerId);
          sleepTimerId = setTimeout(() => {
            audio.pause();
            isPlaying = false;
            playPauseBtn.textContent = "▶";
            document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
            localStorage.setItem("isPlaying", isPlaying);
            alert("Таймер сну завершився, відтворення зупинено");
          }, time * 60 * 1000);
          alert(`Таймер сну встановлено на ${time} хвилин`);
        } else {
          alert("Введіть число від 15 до 60 хвилин");
        }
      });
    }

    if (qualityToggle) {
      qualityToggle.addEventListener("click", () => {
        const currentQuality = qualityToggle.textContent.includes("Висока") ? "high" : "low";
        const newQuality = currentQuality === "high" ? "low" : "high";
        qualityToggle.textContent = newQuality === "high" ? "Якість: Висока" : "Якість: Низька";
        localStorage.setItem("streamQuality", newQuality);
        if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
          audio.pause();
          audio.src = "";
          audio.src = getStreamUrl(stationItems[currentIndex].dataset.value, newQuality);
          tryAutoPlay();
        }
      });
      qualityToggle.textContent = localStorage.getItem("streamQuality") === "low" ? "Якість: Низька" : "Якість: Висока";
    }

    function isValidUrl(url) {
      return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(url);
    }

    async function testStream(url) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, { method: "HEAD", signal: controller.signal });
        clearTimeout(timeoutId);
        return response.ok;
      } catch (error) {
        console.error("Помилка перевірки потоку:", error);
        return false;
      }
    }

    function getStreamUrl(url, quality) {
      if (quality === "low" && url.includes("192")) {
        return url.replace("192", "64");
      } else if (quality === "low" && url.includes("320")) {
        return url.replace("320", "128");
      }
      return url;
    }

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

    async function loadStations() {
      console.time("loadStations");
      stationList.innerHTML = "<div class='station-item empty'>Завантаження...</div>";
      try {
        abortController.abort();
        abortController = new AbortController();
        const response = await fetch(`stations.json`, {
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
          stationList.innerHTML = "<div class='station-item empty'>Не вдалося завантажити станції. Спробуйте ще раз.</div>";
          if (!navigator.onLine) {
            alert("Немає мережі, відтворення з кешу");
            updateStationList();
          }
        }
      } finally {
        console.timeEnd("loadStations");
      }
    }

    const themes = {
      "neon-pulse": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#00F0FF", text: "#F0F0F0", accentGradient: "#003C4B" },
      "lime-surge": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#B2FF59", text: "#E8F5E9", accentGradient: "#2E4B2F" },
      "flamingo-flash": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#FF4081", text: "#FCE4EC", accentGradient: "#4B1A2E" },
      "violet-vortex": { bodyBg: "#121212", containerBg: "#1A1A1A", accent: "#7C4DFF", text: "#EDE7F6", accentGradient: "#2E1A47" },
      "aqua-glow": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#26C6DA", text: "#B2EBF2", accentGradient: "#1A3C4B" },
      "cosmic-indigo": { bodyBg: "#121212", containerBg: "#1A1A1A", accent: "#3F51B5", text: "#BBDEFB", accentGradient: "#1A2A5A" },
      "mystic-jade": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#26A69A", text: "#B2DFDB", accentGradient: "#1A3C4B" },
      "aurora-haze": { bodyBg: "#121212", containerBg: "#1A1A1A", accent: "#64FFDA", text: "#E0F7FA", accentGradient: "#1A4B4B" },
      "starlit-amethyst": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#B388FF", text: "#E1BEE7", accentGradient: "#2E1A47" },
      "lunar-frost": { bodyBg: "#F5F7FA", containerBg: "#FFFFFF", accent: "#40C4FF", text: "#212121", accentGradient: "#B3E5FC" }
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
      const themeIcon = themeToggle.querySelector(".theme-icon");
      if (themeIcon) {
        themeIcon.textContent = theme === "lunar-frost" ? "☀️" : "🌙";
      }
    }

    function toggleTheme() {
      const themesOrder = [
        "neon-pulse", "lime-surge", "flamingo-flash", "violet-vortex", "aqua-glow",
        "cosmic-indigo", "mystic-jade", "aurora-haze", "starlit-amethyst", "lunar-frost"
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
          audio.src = getStreamUrl(stationItems[currentIndex].dataset.value, localStorage.getItem("streamQuality") || "high");
          tryAutoPlay();
        }
      });
    }

    async function tryAutoPlay() {
      if (!navigator.onLine) {
        console.log("Пристрій офлайн, пропускаємо відтворення");
        alert("Немає мережі, перевірте з'єднання");
        return;
      }
      if (!isPlaying || !stationItems?.length || currentIndex >= stationItems.length || !hasUserInteracted) {
        console.log("Пропуск tryAutoPlay", { isPlaying, hasStationItems: !!stationItems?.length, isIndexValid: currentIndex < stationItems.length, hasUserInteracted });
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
        return;
      }
      const url = getStreamUrl(stationItems[currentIndex].dataset.value, localStorage.getItem("streamQuality") || "high");
      if (!isValidUrl(url)) {
        console.error("Невалідний URL:", url);
        errorCount++;
        if (errorCount >= ERROR_LIMIT) {
          console.error("Досягнуто ліміт помилок відтворення");
          alert("Проблема з відтворенням, оберіть іншу станцію");
        }
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
        return;
      }
      const isStreamValid = await testStream(url);
      if (!isStreamValid) {
        console.error("Потік недоступний:", url);
        errorCount++;
        if (errorCount >= ERROR_LIMIT) {
          console.error("Досягнуто ліміт помилок відтворення");
          alert("Проблема з відтворенням, оберіть іншу станцію");
        }
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
        return;
      }
      audio.pause();
      audio.src = "";
      audio.src = url;
      console.log("Спроба відтворення:", audio.src);
      const playPromise = audio.play();
      playPromise
        .then(() => {
          errorCount = 0;
          console.log("Відтворення розпочато успішно");
          document.querySelectorAll(".wave-bar").forEach(bar => {
            bar.style.animationPlayState = "running";
            bar.style.animationDuration = currentTab === "techno" ? "0.8s" : "1.2s";
          });
        })
        .catch(error => {
          console.error("Помилка відтворення:", error);
          if (error.name !== "AbortError") {
            errorCount++;
            if (errorCount >= ERROR_LIMIT) {
              console.error("Досягнуто ліміт помилок відтворення");
              alert("Проблема з відтворенням, оберіть іншу станцію");
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

    function updateStationList(searchTerm = "") {
      if (!stationList) {
        console.error("stationList не знайдено");
        return;
      }
      let stations = currentTab === "best"
        ? favoriteStations
            .map(name => Object.values(stationLists).flat().find(s => s.name === name))
            .filter(s => s)
        : stationLists[currentTab] || [];
      if (searchTerm) {
        stations = stations.filter(s => 
          s.name.toLowerCase().includes(searchTerm) || 
          s.genre.toLowerCase().includes(searchTerm) || 
          s.country.toLowerCase().includes(searchTerm)
        );
      }
      if (!stations.length) {
        currentIndex = 0;
        stationItems = [];
        stationList.innerHTML = `<div class='station-item empty'>${currentTab === "best" ? "Немає улюблених станцій" : "Немає станцій у цій категорії"}</div>`;
        return;
      }
      const fragment = document.createDocumentFragment();
      const visibleCount = 10;
      stations.slice(0, visibleCount).forEach((station, index) => {
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
      stationList.onscroll = () => {
        if (stationList.scrollTop + stationList.clientHeight >= stationList.scrollHeight - 50) {
          const currentItems = stationList.querySelectorAll(".station-item").length;
          if (currentItems < stations.length) {
            stations.slice(currentItems, currentItems + visibleCount).forEach((station, index) => {
              const item = document.createElement("div");
              item.className = `station-item ${index + currentItems === currentIndex ? "selected" : ""}`;
              item.dataset.value = station.value;
              item.dataset.name = station.name;
              item.dataset.genre = station.genre;
              item.dataset.country = station.country;
              item.innerHTML = `${station.emoji} ${station.name}<button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}">★</button>`;
              stationList.appendChild(item);
            });
            stationItems = stationList.querySelectorAll(".station-item");
          }
        }
      };
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
      else updateStationList(searchInput?.value.toLowerCase() || "");
    }

    function changeStation(index) {
      if (index < 0 || index >= stationItems.length || stationItems[index].classList.contains("empty")) {
        currentIndex = 0;
        alert("Немає доступних станцій, скидаємо вибір");
        return;
      }
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
        console.error("Елемент .station-name не знайдено");
      }
      if (stationGenreElement) {
        stationGenreElement.textContent = `жанр: ${item.dataset.genre || "Unknown"}`;
      } else {
        console.error("Елемент .station-genre не знайдено");
      }
      if (stationCountryElement) {
        stationCountryElement.textContent = `країна: ${item.dataset.country || "Unknown"}`;
      } else {
        console.error("Елемент .station-country не знайдено");
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
        document.querySelectorAll(".wave-bar").forEach(bar => {
          bar.style.animationPlayState = "running";
          bar.style.animationDuration = currentTab === "techno" ? "0.8s" : "1.2s";
        });
      } else {
        audio.pause();
        isPlaying = false;
        playPauseBtn.textContent = "▶";
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
      }
      localStorage.setItem("isPlaying", isPlaying);
    }

    document.addEventListener("keydown", e => {
      hasUserInteracted = true;
      if (e.key === "ArrowLeft") prevStation();
      if (e.key === "ArrowRight") nextStation();
      if (e.key === " ") {
        e.preventDefault();
        togglePlayPause();
      }
    });

    let touchStartX = 0;
    document.addEventListener("touchstart", e => {
      touchStartX = e.touches[0].clientX;
    });
    document.addEventListener("touchend", e => {
      const touchEndX = e.changedTouches[0].clientX;
      const diff = touchStartX - touchEndX;
      if (diff > 50) nextStation();
      if (diff < -50) prevStation();
      if (Math.abs(diff) < 20 && e.target.closest(".controls") && !e.target.closest(".control-btn")) {
        togglePlayPause();
      }
    });

    audio.addEventListener("playing", () => {
      isPlaying = true;
      playPauseBtn.textContent = "⏸";
      document.querySelectorAll(".wave-bar").forEach(bar => {
        bar.style.animationPlayState = "running";
        bar.style.animationDuration = currentTab === "techno" ? "0.8s" : "1.2s";
      });
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
        alert("Проблема з відтворенням, оберіть іншу станцію");
      }
    });

    audio.addEventListener("volumechange", () => {
      localStorage.setItem("volume", audio.volume);
      if (volumeSlider) volumeSlider.value = audio.volume;
    });

    window.addEventListener("online", () => {
      console.log("Мережа відновлена");
      if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
        audio.pause();
        audio.src = "";
        audio.src = getStreamUrl(stationItems[currentIndex].dataset.value, localStorage.getItem("streamQuality") || "high");
        tryAutoPlay();
      }
    });

    window.addEventListener("offline", () => {
      console.log("Втрачено з'єднання з мережею");
      alert("Немає мережі, перевірте з'єднання");
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

  initializeApp();
});