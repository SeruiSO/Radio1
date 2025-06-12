let currentTab = localStorage.getItem("currentTab") || "techno";
let hasUserInteracted = false;
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let recentlyPlayed = JSON.parse(localStorage.getItem("recentlyPlayed")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let stationLists = {};
let stationItems;
let audioContext, analyser, source;

document.addEventListener("DOMContentLoaded", () => {
  const audio = document.getElementById("audioPlayer");
  const stationList = document.getElementById("stationList");
  const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
  const currentStationInfo = document.querySelector(".current-station-info");
  const themeToggle = document.querySelector(".theme-toggle");
  const searchBtn = document.querySelector(".search-btn");
  const searchContainer = document.querySelector(".search-container");
  const searchInput = document.getElementById("searchInput");
  const genreFilter = document.getElementById("genreFilter");
  const countryFilter = document.getElementById("countryFilter");
  const volumeSlider = document.getElementById("volumeSlider");
  const shareBtn = document.querySelector(".share-btn");
  const offlineNotice = document.querySelector(".offline-notice");

  if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle || !searchBtn || !searchContainer || !searchInput || !genreFilter || !countryFilter || !volumeSlider || !shareBtn || !offlineNotice) {
    console.error("Missing DOM elements");
    setTimeout(initializeApp, 100);
    return;
  }

  initializeApp();

  function initializeApp() {
    audio.preload = "auto";
    audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;
    volumeSlider.value = audio.volume;

    setupAudioVisualizer();
    setupEventListeners();
    applyTheme(localStorage.getItem("selectedTheme") || "cyber-neon");
    loadStations();
  }

  function setupAudioVisualizer() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source = audioContext.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    const canvas = document.getElementById("audioVisualizer");
    const ctx = canvas.getContext("2d");
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    function drawVisualizer() {
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = canvas.width / bufferLength;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] / 2;
        ctx.fillStyle = `hsl(${i * 2}, 70%, 50%)`;
        ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 1, barHeight);
      }
      requestAnimationFrame(drawVisualizer);
    }

    drawVisualizer();
  }

  function setupEventListeners() {
    document.querySelectorAll(".tab-btn").forEach(btn =>
      btn.addEventListener("click", () => switchTab(btn.dataset.tab))
    );

    document.querySelector(".controls .control-btn:nth-child(1)").addEventListener("click", prevStation);
    playPauseBtn.addEventListener("click", togglePlayPause);
    document.querySelector(".controls .control-btn:nth-child(3)").addEventListener("click", nextStation);

    themeToggle.addEventListener("click", toggleTheme);
    searchBtn.addEventListener("click", () => searchContainer.classList.toggle("hidden"));
    shareBtn.addEventListener("click", shareStation);

    searchInput.addEventListener("input", filterStations);
    genreFilter.addEventListener("change", filterStations);
    countryFilter.addEventListener("change", filterStations);
    volumeSlider.addEventListener("input", () => {
      audio.volume = volumeSlider.value;
      localStorage.setItem("volume", audio.volume);
    });

    document.addEventListener("keydown", e => {
      hasUserInteracted = true;
      if (e.key === "ArrowLeft") prevStation();
      if (e.key === "ArrowRight") nextStation();
      if (e.key === " ") {
        e.preventDefault();
        togglePlayPause();
      }
    });

    audio.addEventListener("playing", () => {
      isPlaying = true;
      playPauseBtn.textContent = "⏸";
      localStorage.setItem("isPlaying", isPlaying);
    });

    audio.addEventListener("pause", () => {
      isPlaying = false;
      playPauseBtn.textContent = "▶";
      localStorage.setItem("isPlaying", isPlaying);
    });

    audio.addEventListener("error", () => {
      console.error("Audio error:", audio.error?.message);
      offlineNotice.classList.remove("hidden");
      setTimeout(() => offlineNotice.classList.add("hidden"), 3000);
    });

    window.addEventListener("online", () => {
      offlineNotice.classList.add("hidden");
      if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
        tryAutoPlay();
      }
    });

    window.addEventListener("offline", () => offlineNotice.classList.remove("hidden"));

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").then(registration => {
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "activated" && navigator.serviceWorker.controller) {
                if (confirm("New version available. Update?")) {
                  window.location.reload();
                }
              }
            });
          }
        });
      });

      navigator.serviceWorker.addEventListener("message", event => {
        if (event.data.type === "NETWORK_STATUS") {
          offlineNotice.classList.toggle("hidden", event.data.online);
          if (event.data.online && isPlaying) tryAutoPlay();
        }
      });
    }

    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", togglePlayPause);
      navigator.mediaSession.setActionHandler("pause", togglePlayPause);
      navigator.mediaSession.setActionHandler("previoustrack", prevStation);
      navigator.mediaSession.setActionHandler("nexttrack", nextStation);
    }
  }

  async function loadStations() {
    stationList.innerHTML = "<div class='station-item empty'>Завантаження...</div>";
    try {
      const response = await fetch(`stations.json?t=${Date.now()}`, { cache: "no-cache" });
      if (!response.ok) throw new Error("Failed to fetch stations");
      stationLists = await response.json();
      populateFilters();
      switchTab(currentTab);
    } catch (error) {
      console.error("Error loading stations:", error);
      stationList.innerHTML = "<div class='station-item empty'>Не вдалося завантажити станції</div>";
      offlineNotice.classList.remove("hidden");
    }
  }

  function populateFilters() {
    const genres = new Set();
    const countries = new Set();
    Object.values(stationLists).flat().forEach(station => {
      genres.add(station.genre);
      countries.add(station.country);
    });

    genreFilter.innerHTML = '<option value="">Усі жанри</option>' +
      [...genres].sort().map(genre => `<option value="${genre}">${genre}</option>`).join("");
    countryFilter.innerHTML = '<option value="">Усі країни</option>' +
      [...countries].sort().map(country => `<option value="${country}">${country}</option>`).join("");
  }

  function filterStations() {
    const searchText = searchInput.value.toLowerCase();
    const selectedGenre = genreFilter.value;
    const selectedCountry = countryFilter.value;

    let stations = currentTab === "recent"
      ? recentlyPlayed.map(name => Object.values(stationLists).flat().find(s => s.name === name)).filter(s => s)
      : currentTab === "best"
        ? favoriteStations.map(name => Object.values(stationLists).flat().find(s => s.name === name)).filter(s => s)
        : stationLists[currentTab] || [];

    stations = stations.filter(station =>
      station.name.toLowerCase().includes(searchText) &&
      (!selectedGenre || station.genre === selectedGenre) &&
      (!selectedCountry || station.country === selectedCountry)
    );

    updateStationList(stations);
  }

  function switchTab(tab) {
    if (!["recent", "techno", "trance", "ukraine", "pop"].includes(tab)) tab = "techno";
    currentTab = tab;
    localStorage.setItem("currentTab", tab);
    currentIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tab));
    filterStations();
    if (stationItems?.length && currentIndex < stationItems.length) tryAutoPlay();
  }

  function updateStationList(stations = []) {
    if (!stations.length) {
      stations = currentTab === "recent"
        ? recentlyPlayed.map(name => Object.values(stationLists).flat().find(s => s.name === name)).filter(s => s)
        : currentTab === "best"
          ? favoriteStations.map(name => Object.values(stationLists).flat().find(s => s.name === name)).filter(s => s)
          : stationLists[currentTab] || [];
    }

    if (!stations.length) {
      currentIndex = 0;
      stationList.innerHTML = `<div class='station-item empty'>${currentTab === "recent" ? "Немає нещодавно відтворених" : currentTab === "best" ? "Немає улюблених станцій" : "Немає станцій у цій категорії"}</div>`;
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
      item.innerHTML = `${station.emoji} ${station.name}<button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}" aria-label="Додати до улюблених">★</button>`;
      fragment.appendChild(item);
    });

    stationList.innerHTML = "";
    stationList.appendChild(fragment);
    stationItems = stationList.querySelectorAll(".station-item");

    if (stationItems.length && currentIndex < stationItems.length) {
      stationItems[currentIndex].scrollIntoView({ behavior: "smooth", block: "center" });
      updateCurrentStationInfo(stationItems[currentIndex]);
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
    updateRecentlyPlayed(item.dataset.name);
    localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
    tryAutoPlay();
  }

  function updateRecentlyPlayed(stationName) {
    recentlyPlayed = recentlyPlayed.filter(name => name !== stationName);
    recentlyPlayed.unshift(stationName);
    if (recentlyPlayed.length > 10) recentlyPlayed.pop();
    localStorage.setItem("recentlyPlayed", JSON.stringify(recentlyPlayed));
  }

  function updateCurrentStationInfo(item) {
    currentStationInfo.querySelector(".station-name").textContent = item.dataset.name || "Unknown";
    currentStationInfo.querySelector(".station-genre").textContent = `жанр: ${item.dataset.genre || "Unknown"}`;
    currentStationInfo.querySelector(".station-country").textContent = `країна: ${item.dataset.country || "Unknown"}`;

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: item.dataset.name || "Unknown Station",
        artist: `${item.dataset.genre || "Unknown"} | ${item.dataset.country || "Unknown"}`,
        album: "VibeWave"
      });
    }
  }

  function tryAutoPlay() {
    if (!navigator.onLine || !isPlaying || !stationItems?.length || currentIndex >= stationItems.length || !hasUserInteracted) {
      return;
    }

    audio.pause();
    audio.src = stationItems[currentIndex].dataset.value;
    audio.play().catch(error => {
      console.error("Playback error:", error);
      offlineNotice.classList.remove("hidden");
      setTimeout(() => offlineNotice.classList.add("hidden"), 3000);
    });
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

  function shareStation() {
    if (stationItems[currentIndex] && navigator.share) {
      navigator.share({
        title: `Слухаю ${stationItems[currentIndex].dataset.name} на VibeWave!`,
        text: `Заходь слухати ${stationItems[currentIndex].dataset.name} (${stationItems[currentIndex].dataset.genre}) на VibeWave!`,
        url: window.location.href
      }).catch(error => console.error("Share error:", error));
    }
  }

  const themes = {
    "cyber-neon": {
      bodyBg: "#0D0D0D",
      containerBg: "#1A1A1A",
      accent: "#FF2E63",
      text: "#F5F5F5",
      accentGradient: "#4B1A2E"
    },
    "retro-wave": {
      bodyBg: "#1A0A2E",
      containerBg: "#2A1A4E",
      accent: "#FF00FF",
      text: "#E0E0E0",
      accentGradient: "#4B1A5E"
    },
    "solar-flare": {
      bodyBg: "#0A0A0A",
      containerBg: "#151515",
      accent: "#FF9500",
      text: "#FFE8CC",
      accentGradient: "#4B2E1A"
    }
  };

  function applyTheme(theme) {
    const root = document.documentElement;
    Object.entries(themes[theme]).forEach(([key, value]) =>
      root.style.setProperty(`--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`, value)
    );
    localStorage.setItem("selectedTheme", theme);
    document.querySelector('meta[name="theme-color"]').setAttribute("content", themes[theme].accent);
  }

  function toggleTheme() {
    const themesOrder = ["cyber-neon", "retro-wave", "solar-flare"];
    const currentIndex = themesOrder.indexOf(localStorage.getItem("selectedTheme") || "cyber-neon");
    applyTheme(themesOrder[(currentIndex + 1) % themesOrder.length]);
  }
});