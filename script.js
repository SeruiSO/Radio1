import { BleClient } from '@capacitor-community/bluetooth-le';
import { BackgroundRunner } from '@capacitor/background-runner';

console.log("Script.js loaded successfully");

document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM content loaded");
  const audio = document.getElementById("audioPlayer");
  const stationList = document.getElementById("stationList");
  const playPauseBtn = document.getElementById("playPauseBtn");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const currentStationInfo = document.getElementById("currentStationInfo");
  const themeToggle = document.querySelector(".theme-toggle");

  console.log("Checking DOM elements:", { audio, stationList, playPauseBtn, prevBtn, nextBtn, currentStationInfo, themeToggle });
  if (!audio || !stationList || !playPauseBtn || !prevBtn || !nextBtn || !currentStationInfo || !themeToggle) {
    console.error("One of the required DOM elements not found");
    throw new Error("Failed to initialize app due to missing DOM elements");
  }
  console.log("DOM elements verified");

  let currentTab = localStorage.getItem("currentTab") || "techno";
  let currentIndex = 0;
  let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
  let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
  let stationLists = {};
  let stationItems;
  let isAutoPlaying = false;
  let lastStationUrl = localStorage.getItem("lastStationUrl") || "";

  audio.preload = "auto";
  audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

  function resetStationInfo() {
    const stationNameElement = currentStationInfo.querySelector(".station-name");
    const stationGenreElement = currentStationInfo.querySelector(".station-genre");
    const stationCountryElement = currentStationInfo.querySelector(".station-country");
    if (stationNameElement) stationNameElement.textContent = "Обирайте станцію";
    else console.error("Element .station-name not found in currentStationInfo");
    if (stationGenreElement) stationGenreElement.textContent = "жанр: -";
    else console.error("Element .station-genre not found in currentStationInfo");
    if (stationCountryElement) stationCountryElement.textContent = "країна: -";
    else console.error("Element .station-country not found in currentStationInfo");
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = null;
    }
  }

  async function loadStations() {
    console.log("loadStations function called");
    console.time("loadStations");
    stationList.innerHTML = "<div class='station-item empty'>Завантаження...</div>";
    try {
      console.log("Attempting to fetch stations.json");
      const response = await fetch(`stations.json?t=${Date.now()}`, {
        cache: "no-cache",
        headers: {
          "If-Modified-Since": localStorage.getItem("stationsLastModified") || ""
        }
      });
      console.log(`Fetch response status: ${response.status}`);
      if (response.status === 304) {
        console.log("Response status 304, checking cache");
        const cachedData = await caches.match("stations.json");
        if (cachedData) {
          stationLists = await cachedData.json();
          console.log("Using cached version of stations.json:", stationLists);
        } else {
          throw new Error("Cache not found");
        }
      } else if (response.ok && response.status === 200) {
        stationLists = await response.json();
        // Валідація структури JSON
        if (!stationLists || typeof stationLists !== 'object' || !Object.keys(stationLists).length) {
          throw new Error("Invalid or empty stations.json");
        }
        for (const tab in stationLists) {
          if (!Array.isArray(stationLists[tab]) || !stationLists[tab].every(station => station.value && station.name)) {
            throw new Error(`Invalid data in stations.json for tab ${tab}`);
          }
        }
        localStorage.setItem("stationsLastModified", response.headers.get("Last-Modified") || "");
        console.log("New stations.json loaded successfully:", stationLists);
      } else {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }
      const validTabs = [...Object.keys(stationLists), "best"];
      console.log("Valid tabs:", validTabs);
      if (!validTabs.includes(currentTab)) {
        currentTab = validTabs[0] || "techno";
        localStorage.setItem("currentTab", currentTab);
        console.log("Updated currentTab to:", currentTab);
      }
      currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
      console.log("Current index:", currentIndex);
      // Фільтрація favoriteStations для видалення неіснуючих станцій
      favoriteStations = favoriteStations.filter(name => 
        Object.values(stationLists).flat().some(station => station.name === name)
      );
      localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
      switchTab(currentTab);
    } catch (error) {
      console.error("Error loading stations:", error);
      stationList.innerHTML = "<div class='station-item empty'>Не вдалося завантажити станції: " + error.message + "</div>";
    } finally {
      console.timeEnd("loadStations");
      if (stationItems?.length && currentIndex < stationItems.length) tryAutoPlay();
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
    if (themeColorMeta) themeColorMeta.setAttribute("content", themes[theme].accent);
  }

  function toggleTheme() {
    const themesOrder = ["neon-pulse", "lime-surge", "flamingo-flash", "violet-vortex", "aqua-glow", "cosmic-indigo", "mystic-jade", "aurora-haze", "starlit-amethyst", "lunar-frost"];
    const nextTheme = themesOrder[(themesOrder.indexOf(currentTheme) + 1) % themesOrder.length];
    applyTheme(nextTheme);
  }

  themeToggle.addEventListener("click", toggleTheme);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(registration => {
      console.log("Service Worker registered successfully");
      registration.update();
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            if (confirm("Доступна нова версія радіо. Оновити?")) window.location.reload();
          }
        });
      });
    }).catch(error => console.error("Service Worker registration error:", error));

    navigator.serviceWorker.addEventListener("message", event => {
      if (event.data.type === "NETWORK_STATUS" && event.data.online && isPlaying && stationItems?.length && currentIndex < stationItems.length) {
        console.log("Received message from Service Worker: network restored");
        audio.pause();
        audio.src = stationItems[currentIndex].dataset.value;
        tryAutoPlay();
      }
    });
  }

  function tryAutoPlay() {
    if (!navigator.onLine) {
      console.log("Device is offline, skipping playback");
      return;
    }
    if (!isPlaying || !stationItems?.length || currentIndex >= stationItems.length || isAutoPlaying) {
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
      return;
    }
    // Перевірка, чи відтворення вже активне
    if (!audio.paused && audio.src === stationItems[currentIndex].dataset.value) {
      console.log("Playback already active for current station");
      return;
    }
    // Перевірка валідності audio.src
    if (!stationItems[currentIndex].dataset.value || !/^https?:\/\//.test(stationItems[currentIndex].dataset.value)) {
      console.error("Invalid audio source URL:", stationItems[currentIndex].dataset.value);
      resetStationInfo();
      stationList.innerHTML = "<div class='station-item empty'>Невалідна URL станції</div>";
      return;
    }
    isAutoPlaying = true;
    audio.src = stationItems[currentIndex].dataset.value;
    const playPromise = audio.play();

    playPromise
      .then(() => {
        isAutoPlaying = false;
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
      })
      .catch(error => {
        console.error("Playback error:", error);
        isAutoPlaying = false;
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
        stationList.innerHTML = "<div class='station-item empty'>Помилка відтворення: " + error.message + "</div>";
      });
  }

  function switchTab(tab) {
    if (!["techno", "trance", "ukraine", "best"].includes(tab)) tab = "techno";
    currentTab = tab;
    localStorage.setItem("currentTab", tab);
    const savedIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
    const maxIndex = tab === "best" ? favoriteStations.length : stationLists[tab]?.length || 0;
    currentIndex = savedIndex < maxIndex ? savedIndex : 0;
    updateStationList();
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    if (activeBtn) activeBtn.classList.add("active");
    if (stationItems?.length && currentIndex < stationItems.length) {
      tryAutoPlay();
    }
  }

  function updateStationList() {
    if (!stationList) {
      console.error("stationList not found");
      return;
    }
    let stations = currentTab === "best"
      ? favoriteStations.map(name => Object.values(stationLists).flat().find(s => s.name === name)).filter(s => s)
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
      item.setAttribute("aria-selected", index === currentIndex);
      item.setAttribute("role", "option");
      item.innerHTML = `${station.emoji} ${station.name}<button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}" aria-label="Додати до улюблених">★</button>`;
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

    if (stationItems.length && currentIndex < stationItems.length) changeStation(currentIndex);
  }

  function toggleFavorite(stationName) {
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
    stationItems?.forEach(i => i.setAttribute("aria-selected", i === item));
    currentIndex = index;
    lastStationUrl = item.dataset.value;
    localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
    localStorage.setItem("lastStationUrl", lastStationUrl);
    // Перевірка валідності audio.src
    if (!lastStationUrl || !/^https?:\/\//.test(lastStationUrl)) {
      console.error("Invalid audio source URL:", lastStationUrl);
      resetStationInfo();
      stationList.innerHTML = "<div class='station-item empty'>Невалідна URL станції</div>";
      return;
    }
    audio.src = lastStationUrl;
    updateCurrentStationInfo(item);
    tryAutoPlay();
  }

  function updateCurrentStationInfo(item) {
    if (!currentStationInfo) {
      console.error("currentStationInfo not found");
      return;
    }
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
        album: "Radio SO3"
      });
      navigator.mediaSession.setActionHandler("play", () => {
        if (audio.paused) togglePlayPause();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        if (!audio.paused) togglePlayPause();
      });
      navigator.mediaSession.setActionHandler("previoustrack", prevStation);
      navigator.mediaSession.setActionHandler("nexttrack", nextStation);
    }
  }

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
      playPauseBtn.setAttribute("aria-label", "Призупинити відтворення");
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
    } else {
      audio.pause();
      isPlaying = false;
      playPauseBtn.textContent = "▶";
      playPauseBtn.setAttribute("aria-label", "Почати відтворення");
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = null;
      }
    }
    localStorage.setItem("isPlaying", isPlaying);
  }

  async function startBluetoothMonitoring() {
    console.log("Starting Bluetooth monitoring");
    try {
      const { Permissions } = await import('@capacitor/core');
      console.log("Imported Permissions module");
      const permissionsToRequest = ['bluetooth'];

      if (window.device?.platform === 'android' && parseInt(window.device.version.split('.')[0]) >= 12) {
        permissionsToRequest.push('bluetooth_scan', 'bluetooth_connect');
      }

      for (const perm of permissionsToRequest) {
        const permissionStatus = await Permissions.query({ name: perm });
        console.log(`Permission status for ${perm}:`, permissionStatus);
        if (permissionStatus.state !== 'granted') {
          const result = await Permissions.requestPermissions({ permissions: [perm] });
          console.log(`Permission request result for ${perm}:`, result);
          if (result[perm] !== 'granted') {
            console.log(`${perm} permission denied`);
            return;
          }
        }
      }

      try {
        await BleClient.initialize();
        console.log('Bluetooth initialized');
      } catch (error) {
        console.error('Bluetooth initialization failed:', error);
        return;
      }

      await BackgroundRunner.register({
        id: 'bluetoothScanTask',
        callback: async () => {
          try {
            await BleClient.requestLEScan({}, (result) => {
              console.log('Found Bluetooth device:', result.device.name || result.device.deviceId);
              if (result.device && !isPlaying && lastStationUrl) {
                console.log('Bluetooth device detected, starting playback');
                isPlaying = true;
                playPauseBtn.textContent = "⏸";
                playPauseBtn.setAttribute("aria-label", "Призупинити відтворення");
                audio.src = lastStationUrl;
                tryAutoPlay();
              }
            }, { timeout: 5000 });

            const status = await BleClient.isEnabled();
            if (!status.value && isPlaying) {
              console.log('Bluetooth disabled, pausing playback');
              await new Promise(resolve => setTimeout(resolve, 1000));
              if (!await BleClient.isEnabled().value) {
                audio.pause();
                isPlaying = false;
                playPauseBtn.textContent = "▶";
                playPauseBtn.setAttribute("aria-label", "Почати відтворення");
                document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
                localStorage.setItem("isPlaying", isPlaying);
              }
            }

            await BleClient.stopLEScan();
          } catch (error) {
            console.error('Bluetooth scan error:', error);
          }
        },
        schedule: {
          type: 'interval',
          interval: 30000
        }
      });

      await BackgroundRunner.start({ id: 'bluetoothScanTask' })
        .then(() => console.log('Background Bluetooth scan started'))
        .catch(error => console.error('Failed to start BackgroundRunner:', error));
    } catch (error) {
      console.error('Bluetooth initialization error:', error);
    }
  }

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
        audio.src = stationItems[currentIndex].dataset.value;
        tryAutoPlay();
      }
    },
    resume: () => {
      if (isPlaying && navigator.connection?.type !== "none") {
        if (!audio.paused) return;
        audio.pause();
        audio.src = stationItems[currentIndex].dataset.value;
        tryAutoPlay();
      }
    }
  };

  function addEventListeners() {
    document.addEventListener("keydown", eventListeners.keydown);
    document.addEventListener("visibilitychange", eventListeners.visibilitychange);
    document.addEventListener("resume", eventListeners.resume);
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab")));
    });
    playPauseBtn.addEventListener("click", togglePlayPause);
    prevBtn.addEventListener("click", prevStation);
    nextBtn.addEventListener("click", nextStation);
  }

  function removeEventListeners() {
    document.removeEventListener("keydown", eventListeners.keydown);
    document.removeEventListener("visibilitychange", eventListeners.visibilitychange);
    document.removeEventListener("resume", eventListeners.resume);
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.removeEventListener("click", () => switchTab(btn.getAttribute("data-tab")));
    });
    playPauseBtn.removeEventListener("click", togglePlayPause);
    prevBtn.removeEventListener("click", prevStation);
    nextBtn.removeEventListener("click", nextStation);
  }

  audio.addEventListener("playing", () => {
    isPlaying = true;
    playPauseBtn.textContent = "⏸";
    playPauseBtn.setAttribute("aria-label", "Призупинити відтворення");
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
    localStorage.setItem("isPlaying", isPlaying);
  });

  audio.addEventListener("pause", () => {
    isPlaying = false;
    playPauseBtn.textContent = "▶";
    playPauseBtn.setAttribute("aria-label", "Почати відтворення");
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    localStorage.setItem("isPlaying", isPlaying);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = null;
    }
  });

  audio.addEventListener("error", () => {
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
  });

  audio.addEventListener("volumechange", () => {
    localStorage.setItem("volume", audio.volume);
  });

  window.addEventListener("online", () => {
    console.log("Network restored");
    if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
      audio.pause();
      audio.src = stationItems[currentIndex].dataset.value;
      tryAutoPlay();
    }
  });

  window.addEventListener("offline", () => {
    console.log("Network connection lost");
  });

  document.addEventListener('deviceready', () => {
    console.log("Device ready event fired");
    startBluetoothMonitoring();
    addEventListeners();
  });

  window.addEventListener("beforeunload", () => {
    removeEventListeners();
  });

  applyTheme(currentTheme);
  loadStations();
});