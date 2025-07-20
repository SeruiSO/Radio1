let currentTab = localStorage.getItem("currentTab") || "techno";
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let intendedPlaying = localStorage.getItem("intendedPlaying") === "true" || false;
let stationLists = JSON.parse(localStorage.getItem("stationLists")) || {};
let userAddedStations = JSON.parse(localStorage.getItem("userAddedStations")) || {};
let stationItems = [];
let abortController = new AbortController();
let errorCount = 0;
const ERROR_LIMIT = 15;
let pastSearches = JSON.parse(localStorage.getItem("pastSearches")) || [];
let deletedStations = JSON.parse(localStorage.getItem("deletedStations")) || [];
let customTabs = JSON.parse(localStorage.getItem("customTabs")) || [];
let isAutoPlayPending = false;
let lastSuccessfulPlayTime = 0;
let streamAbortController = null;
let errorTimeout = null;
let autoPlayRequestId = 0; // Unique ID for autoplay requests
customTabs = Array.isArray(customTabs) ? customTabs.filter(tab => typeof tab === "string" && tab.trim()) : [];

document.addEventListener("DOMContentLoaded", () => {
  const audio = document.getElementById("audioPlayer");
  const stationList = document.getElementById("stationList");
  const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
  const currentStationInfo = document.getElementById("currentStationInfo");
  const themeToggle = document.querySelector(".theme-toggle");
  const shareButton = document.querySelector(".share-button");
  const exportButton = document.querySelector(".export-button");
  const importButton = document.querySelector(".import-button");
  const importFileInput = document.getElementById("importFileInput");
  const searchInput = document.getElementById("searchInput");
  const searchQuery = document.getElementById("searchQuery");
  const searchCountry = document.getElementById("searchCountry");
  const searchGenre = document.getElementById("searchGenre");
  const searchBtn = document.querySelector(".search-btn");
  const pastSearchesList = document.getElementById("pastSearches");
  const tabsContainer = document.getElementById("tabs");
  const addTabBtn = document.querySelector(".add-tab-btn");
  const newTabModal = document.querySelector(".new-tab-modal");
  const editTabModal = document.querySelector(".edit-tab-modal");
  const newTabName = document.getElementById("newTabName");
  const renameTabName = document.getElementById("renameTabName");
  const createTabBtn = document.getElementById("createTabBtn");
  const renameTabBtn = document.getElementById("renameTabBtn");
  const deleteTabBtn = document.getElementById("deleteTabBtn");

  if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle || !shareButton || 
      !exportButton || !importButton || !importFileInput || !searchInput || !searchQuery || 
      !searchCountry || !searchGenre || !searchBtn || !pastSearchesList || !tabsContainer || 
      !addTabBtn || !newTabModal || !editTabModal || !newTabName || !renameTabName || 
      !createTabBtn || !renameTabBtn || !deleteTabBtn) {
    console.error("One of required DOM elements not found", {
      audio: !!audio,
      stationList: !!stationList,
      playPauseBtn: !!playPauseBtn,
      currentStationInfo: !!currentStationInfo,
      themeToggle: !!themeToggle,
      shareButton: !!shareButton,
      exportButton: !!exportButton,
      importButton: !!importButton,
      importFileInput: !!importFileInput,
      searchInput: !!searchInput,
      searchQuery: !!searchQuery,
      searchCountry: !!searchCountry,
      searchGenre: !!searchGenre,
      searchBtn: !!searchBtn,
      pastSearchesList: !!pastSearchesList,
      tabsContainer: !!tabsContainer,
      addTabBtn: !!addTabBtn,
      newTabModal: !!newTabModal,
      editTabModal: !!editTabModal,
      newTabName: !!newTabName,
      renameTabName: !!renameTabName,
      createTabBtn: !!createTabBtn,
      renameTabBtn: !!renameTabBtn,
      deleteTabBtn: !!deleteTabBtn
    });
    setTimeout(initializeApp, 100);
    return;
  }

  initializeApp();

  function initializeApp() {
    audio.preload = "auto";
    audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

    updatePastSearches();
    populateSearchSuggestions();
    applyTheme(localStorage.getItem("selectedTheme") || "shadow-pulse");
    renderTabs();
    loadStations();

    themeToggle.addEventListener("click", toggleTheme);
    shareButton.addEventListener("click", () => {
      const stationName = currentStationInfo.querySelector(".station-name").textContent || "Radio Music";
      const shareData = {
        title: "Radio Music",
        text: `Listening to ${stationName} on Radio Music! Join my favorite radio stations!`,
        url: window.location.href
      };
      if (navigator.share) {
        navigator.share(shareData)
          .catch(error => console.error("Error sharing:", error));
      } else {
        alert(`Share function not supported. Copy: ${shareData.text} ${shareData.url}`);
      }
    });

    exportButton.addEventListener("click", exportSettings);
    importButton.addEventListener("click", () => importFileInput.click());
    importFileInput.addEventListener("change", importSettings);

    document.querySelector(".controls .control-btn:nth-child(1)").addEventListener("click", prevStation);
    playPauseBtn.addEventListener("click", togglePlayPause);
    document.querySelector(".controls .control-btn:nth-child(3)").addEventListener("click", nextStation);

    searchBtn.addEventListener("click", () => {
      const query = searchQuery.value.trim();
      const country = normalizeCountry(searchCountry.value.trim());
      const genre = searchGenre.value.trim().toLowerCase();
      console.log("Search:", { query, country, genre });
      if (query || country || genre) {
        if (query && !pastSearches.includes(query)) {
          pastSearches.unshift(query);
          if (pastSearches.length > 5) pastSearches.pop();
          localStorage.setItem("pastSearches", JSON.stringify(pastSearches));
          updatePastSearches();
        }
        searchStations(query, country, genre);
      } else {
        console.warn("All search fields are empty");
        stationList.innerHTML = "<div class='station-item empty'>Введіть назву станції, країну або жанр</div>";
      }
    });

    searchQuery.addEventListener("keypress", (e) => {
      if (e.key === "Enter") searchBtn.click();
    });

    searchCountry.addEventListener("keypress", (e) => {
      if (e.key === "Enter") searchBtn.click();
    });

    searchGenre.addEventListener("keypress", (e) => {
      if (e.key === "Enter") searchBtn.click();
    });

    addTabBtn.addEventListener("click", () => {
      newTabModal.style.display = "flex";
      newTabName.value = "";
      newTabName.focus();
    });

    createTabBtn.addEventListener("click", () => {
      const tabName = newTabName.value.trim().toLowerCase();
      if (tabName && !["best", "techno", "trance", "ukraine", "pop", "search"].includes(tabName) && 
          !customTabs.includes(tabName) && /^[a-z0-9_-]+$/.test(tabName) && tabName.length <= 10) {
        customTabs.push(tabName);
        localStorage.setItem("customTabs", JSON.stringify(customTabs));
        renderTabs();
        switchTab(tabName);
        newTabModal.style.display = "none";
      } else {
        alert("Некоректна назва вкладки. Використовуйте до 10 символів (a-z, 0-9, _, -).");
      }
    });

    newTabModal.querySelector(".modal-cancel-btn").addEventListener("click", () => {
      newTabModal.style.display = "none";
    });

    editTabModal.querySelector(".modal-cancel-btn").addEventListener("click", () => {
      editTabModal.style.display = "none";
    });

    renameTabBtn.addEventListener("click", () => {
      const newName = renameTabName.value.trim().toLowerCase();
      if (newName && !["best", "techno", "trance", "ukraine", "pop", "search"].includes(newName) && 
          !customTabs.includes(newName) && /^[a-z0-9_-]+$/.test(newName) && newName.length <= 10) {
        const oldTab = editTabModal.dataset.tab;
        const index = customTabs.indexOf(oldTab);
        if (index !== -1) {
          customTabs[index] = newName;
          if (userAddedStations[oldTab]) {
            userAddedStations[newName] = userAddedStations[oldTab];
            delete userAddedStations[oldTab];
          }
          if (stationLists[oldTab]) {
            stationLists[newName] = stationLists[oldTab];
            delete stationLists[oldTab];
          }
          localStorage.setItem("customTabs", JSON.stringify(customTabs));
          localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
          localStorage.setItem("stationLists", JSON.stringify(stationLists));
          if (currentTab === oldTab) {
            currentTab = newName;
            localStorage.setItem("currentTab", currentTab);
          }
          renderTabs();
          switchTab(newName);
          editTabModal.style.display = "none";
        }
      } else {
        alert("Некоректна нова назва вкладки. Використовуйте до 10 символів (a-z, 0-9, _, -).");
      }
    });

    deleteTabBtn.addEventListener("click", () => {
      const tab = editTabModal.dataset.tab;
      const index = customTabs.indexOf(tab);
      if (index !== -1) {
        customTabs.splice(index, 1);
        delete userAddedStations[tab];
        delete stationLists[tab];
        localStorage.setItem("customTabs", JSON.stringify(customTabs));
        localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
        localStorage.setItem("stationLists", JSON.stringify(stationLists));
        if (currentTab === tab) {
          currentTab = "techno";
          localStorage.setItem("currentTab", currentTab);
        }
        renderTabs();
        switchTab(currentTab);
        editTabModal.style.display = "none";
      }
    });

    audio.addEventListener("play", () => {
      isPlaying = true;
      intendedPlaying = true;
      localStorage.setItem("isPlaying", "true");
      localStorage.setItem("intendedPlaying", "true");
      updatePlayPauseButton();
      updateWaveAnimation(true);
    });

    audio.addEventListener("pause", () => {
      isPlaying = false;
      localStorage.setItem("isPlaying", "false");
      updatePlayPauseButton();
      updateWaveAnimation(false);
    });

    audio.addEventListener("error", () => {
      errorCount++;
      console.error(`Audio error ${errorCount}/${ERROR_LIMIT}`);
      if (errorCount >= ERROR_LIMIT) {
        console.warn("Error limit reached, stopping playback");
        stopPlayback();
      } else {
        setTimeout(() => {
          if (intendedPlaying) {
            console.log("Retrying playback after error...");
            playStation(currentIndex);
          }
        }, 1000);
      }
    });

    audio.addEventListener("volumechange", () => {
      localStorage.setItem("volume", audio.volume.toString());
    });
  }

  function toggleTheme() {
    const themes = [
      "shadow-pulse", "dark-abyss", "emerald-glow", "retro-wave",
      "neon-pulse", "lime-surge", "flamingo-flash", "aqua-glow",
      "aurora-haze", "starlit-amethyst", "lunar-frost"
    ];
    let currentTheme = localStorage.getItem("selectedTheme") || "shadow-pulse";
    let nextIndex = (themes.indexOf(currentTheme) + 1) % themes.length;
    let newTheme = themes[nextIndex];
    applyTheme(newTheme);
    localStorage.setItem("selectedTheme", newTheme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    console.log(`Theme applied: ${theme}`);
  }

  function renderTabs() {
    const tabsContainer = document.getElementById("tabs");
    tabsContainer.innerHTML = `
      <button class="tab-btn" data-tab="best">Best</button>
      <button class="tab-btn" data-tab="techno">Techno</button>
      <button class="tab-btn" data-tab="trance">Trance</button>
      <button class="tab-btn" data-tab="ukraine">UA</button>
      <button class="tab-btn" data-tab="pop">Pop</button>
      <button class="tab-btn" data-tab="search">Search</button>
      ${customTabs.map(tab => `<button class="tab-btn" data-tab="${tab}">${tab.charAt(0).toUpperCase() + tab.slice(1)}</button>`).join("")}
      <button class="add-tab-btn">+</button>
    `;
    const tabButtons = tabsContainer.querySelectorAll(".tab-btn");
    tabButtons.forEach(btn => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (!["best", "techno", "trance", "ukraine", "pop", "search"].includes(btn.dataset.tab)) {
          editTabModal.dataset.tab = btn.dataset.tab;
          renameTabName.value = btn.dataset.tab;
          editTabModal.style.display = "flex";
          renameTabName.focus();
        }
      });
    });
    const activeBtn = tabsContainer.querySelector(`.tab-btn[data-tab="${currentTab}"]`);
    if (activeBtn) activeBtn.classList.add("active");
    console.log("Tabs rendered:", customTabs);
  }

  function switchTab(tab) {
    currentTab = tab;
    localStorage.setItem("currentTab", currentTab);
    const tabButtons = document.querySelectorAll(".tab-btn");
    tabButtons.forEach(btn => btn.classList.remove("active"));
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    if (activeBtn) activeBtn.classList.add("active");
    document.getElementById("searchInput").style.display = tab === "search" ? "block" : "none";
    loadStations();
    console.log(`Switched to tab: ${tab}`);
  }

  function loadStations() {
    const stationList = document.getElementById("stationList");
    stationList.innerHTML = "<div class='station-item empty'>Завантаження...</div>";
    currentIndex = 0;
    stationItems = [];

    if (currentTab === "best") {
      stationItems = favoriteStations.map(name => ({
        name,
        value: userAddedStations[currentTab]?.find(s => s.name === name)?.value || "",
        genre: userAddedStations[currentTab]?.find(s => s.name === name)?.genre || "Unknown",
        country: userAddedStations[currentTab]?.find(s => s.name === name)?.country || "Unknown"
      }));
      renderStations();
    } else if (currentTab === "search") {
      stationList.innerHTML = "<div class='station-item empty'>Введіть критерії пошуку</div>";
    } else {
      if (stationLists[currentTab] && stationLists[currentTab].length > 0) {
        stationItems = [...stationLists[currentTab]];
        if (userAddedStations[currentTab]) {
          stationItems = [...stationItems, ...userAddedStations[currentTab]];
        }
        stationItems = stationItems.filter(s => !deletedStations.includes(s.name));
        renderStations();
      } else {
        fetchStations(currentTab);
      }
    }

    if (intendedPlaying && stationItems.length > 0) {
      playStation(currentIndex);
    }
  }

  async function fetchStations(category) {
    const stationList = document.getElementById("stationList");
    try {
      abortController.abort();
      abortController = new AbortController();
      let url = `https://de1.api.radio-browser.info/json/stations/by${category}?limit=100`;
      const response = await fetch(url, { signal: abortController.signal });
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data = await response.json();
      stationLists[currentTab] = data
        .filter(station => station.url_resolved && !deletedStations.includes(station.name))
        .map(station => ({
          name: station.name,
          value: station.url_resolved,
          genre: station.tags.split(",")[0] || "Unknown",
          country: station.country || "Unknown"
        }));
      if (userAddedStations[currentTab]) {
        stationLists[currentTab].push(...userAddedStations[currentTab]);
      }
      stationItems = stationLists[currentTab];
      localStorage.setItem("stationLists", JSON.stringify(stationLists));
      renderStations();
    } catch (error) {
      if (error.name === "AbortError") {
        console.log("Fetch aborted");
      } else {
        console.error("Error fetching stations:", error);
        stationList.innerHTML = "<div class='station-item empty'>Помилка завантаження станцій</div>";
      }
    }
  }

  async function searchStations(query, country, genre) {
    const stationList = document.getElementById("stationList");
    stationList.innerHTML = "<div class='station-item empty'>Пошук...</div>";
    try {
      abortController.abort();
      abortController = new AbortController();
      let url = "https://de1.api.radio-browser.info/json/stations/search?limit=100";
      if (query) url += `&name=${encodeURIComponent(query)}`;
      if (country) url += `&country=${encodeURIComponent(country)}`;
      if (genre) url += `&tag=${encodeURIComponent(genre)}`;
      const response = await fetch(url, { signal: abortController.signal });
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data = await response.json();
      stationItems = data
        .filter(station => station.url_resolved && !deletedStations.includes(station.name))
        .map(station => ({
          name: station.name,
          value: station.url_resolved,
          genre: station.tags.split(",")[0] || "Unknown",
          country: station.country || "Unknown",
          favicon: station.favicon || ""
        }));
      renderStations();
    } catch (error) {
      if (error.name === "AbortError") {
        console.log("Search aborted");
      } else {
        console.error("Error searching stations:", error);
        stationList.innerHTML = "<div class='station-item empty'>Помилка пошуку станцій</div>";
      }
    }
  }

  function renderStations() {
    const stationList = document.getElementById("stationList");
    if (stationItems.length === 0) {
      stationList.innerHTML = "<div class='station-item empty'>Немає станцій</div>";
      return;
    }
    stationList.innerHTML = "";
    stationItems.forEach((station, index) => {
      const div = document.createElement("div");
      div.className = `station-item ${currentIndex === index && currentTab !== "search" ? "selected" : ""}`;
      div.innerHTML = `
        <img src="${station.favicon || 'icon.png'}" alt="${station.name}" onerror="this.src='icon.png'">
        <span class="station-name">${station.name}</span>
        <div class="buttons-container">
          <button class="favorite-btn ${favoriteStations.includes(station.name) ? "favorited" : ""}">
            ${favoriteStations.includes(station.name) ? "★" : "☆"}
          </button>
          <button class="add-btn">+</button>
          <button class="delete-btn">🗑</button>
        </div>
      `;
      div.querySelector(".station-name").addEventListener("click", () => {
        currentIndex = index;
        playStation(index);
      });
      div.querySelector(".favorite-btn").addEventListener("click", () => toggleFavorite(station.name));
      div.querySelector(".add-btn").addEventListener("click", () => addToCustomTab(station));
      div.querySelector(".delete-btn").addEventListener("click", () => deleteStation(station.name));
      stationList.appendChild(div);
    });
    console.log(`Rendered ${stationItems.length} stations for tab: ${currentTab}`);
  }

  function toggleFavorite(name) {
    const index = favoriteStations.indexOf(name);
    if (index === -1) {
      favoriteStations.push(name);
    } else {
      favoriteStations.splice(index, 1);
    }
    localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
    if (currentTab === "best") {
      loadStations();
    } else {
      renderStations();
    }
    console.log(`Favorite toggled: ${name}, Favorites:`, favoriteStations);
  }

  function addToCustomTab(station) {
    if (customTabs.length === 0) {
      alert("Створіть вкладку для додавання станції!");
      return;
    }
    const select = document.createElement("select");
    select.innerHTML = customTabs.map(tab => `<option value="${tab}">${tab.charAt(0).toUpperCase() + tab.slice(1)}</option>`).join("");
    const modal = document.querySelector(".new-tab-modal");
    modal.innerHTML = `
      <h2>Додати до вкладки</h2>
      <select id="customTabSelect">${select.innerHTML}</select>
      <div class="modal-tabs">
        <button id="addToTabBtn" class="modal-tab-btn">Додати</button>
        <button class="modal-cancel-btn">Відміна</button>
      </div>
    `;
    modal.style.display = "flex";
    document.getElementById("addToTabBtn").addEventListener("click", () => {
      const selectedTab = document.getElementById("customTabSelect").value;
      if (!userAddedStations[selectedTab]) {
        userAddedStations[selectedTab] = [];
      }
      if (!userAddedStations[selectedTab].some(s => s.name === station.name)) {
        userAddedStations[selectedTab].push(station);
        localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
        if (currentTab === selectedTab) {
          stationItems.push(station);
          renderStations();
        }
        console.log(`Station ${station.name} added to ${selectedTab}`);
      }
      modal.style.display = "none";
    });
    modal.querySelector(".modal-cancel-btn").addEventListener("click", () => {
      modal.style.display = "none";
    });
  }

  function deleteStation(name) {
    deletedStations.push(name);
    localStorage.setItem("deletedStations", JSON.stringify(deletedStations));
    stationItems = stationItems.filter(s => s.name !== name);
    if (stationLists[currentTab]) {
      stationLists[currentTab] = stationLists[currentTab].filter(s => s.name !== name);
      localStorage.setItem("stationLists", JSON.stringify(stationLists));
    }
    if (userAddedStations[currentTab]) {
      userAddedStations[currentTab] = userAddedStations[currentTab].filter(s => s.name !== name);
      localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
    }
    if (favoriteStations.includes(name)) {
      favoriteStations = favoriteStations.filter(f => f !== name);
      localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
    }
    renderStations();
    if (currentIndex >= stationItems.length && currentIndex > 0) {
      currentIndex--;
    }
    if (isPlaying && stationItems.length > 0) {
      playStation(currentIndex);
    } else {
      stopPlayback();
    }
    console.log(`Station deleted: ${name}`);
  }

  function playStation(index) {
    const audio = document.getElementById("audioPlayer");
    if (!stationItems[index]) {
      console.warn("No station at index:", index);
      stopPlayback();
      return;
    }
    const station = stationItems[index];
    currentIndex = index;
    intendedPlaying = true;
    localStorage.setItem("intendedPlaying", "true");
    audio.src = station.value;
    audio.play().then(() => {
      errorCount = 0;
      lastSuccessfulPlayTime = Date.now();
      updateCurrentStationInfo(station);
      updatePlayPauseButton();
      renderStations();
      console.log(`Playing station: ${station.name}`);
    }).catch(error => {
      console.error("Playback error:", error);
      errorCount++;
      if (errorCount < ERROR_LIMIT) {
        setTimeout(() => {
          if (intendedPlaying) {
            console.log("Retrying playback...");
            playStation(index);
          }
        }, 1000);
      } else {
        console.warn("Error limit reached, stopping playback");
        stopPlayback();
      }
    });
  }

  function stopPlayback() {
    const audio = document.getElementById("audioPlayer");
    intendedPlaying = false;
    isPlaying = false;
    localStorage.setItem("intendedPlaying", "false");
    localStorage.setItem("isPlaying", "false");
    audio.pause();
    audio.src = "";
    updatePlayPauseButton();
    updateWaveAnimation(false);
    updateCurrentStationInfo({ name: "Обирайте станцію", genre Facet: genre: "-", country: "-" });
    console.log("Playback stopped");
  }

  function togglePlayPause() {
    const audio = document.getElementById("audioPlayer");
    if (isPlaying) {
      stopPlayback();
    } else if (stationItems[currentIndex]) {
      playStation(currentIndex);
    }
  }

  function prevStation() {
    if (currentIndex > 0) {
      currentIndex--;
      if (isPlaying) {
        playStation(currentIndex);
      } else {
        renderStations();
        updateCurrentStationInfo(stationItems[currentIndex]);
      }
    }
  }

  function nextStation() {
    if (currentIndex < stationItems.length - 1) {
      currentIndex++;
      if (isPlaying) {
        playStation(currentIndex);
      } else {
        renderStations();
        updateCurrentStationInfo(stationItems[currentIndex]);
      }
    }
  }

  function updateCurrentStationInfo(station) {
    const currentStationInfo = document.getElementById("currentStationInfo");
    currentStationInfo.querySelector(".station-name").textContent = station.name;
    currentStationInfo.querySelector(".station-genre").textContent = `жанр: ${station.genre}`;
    currentStationInfo.querySelector(".station-country").textContent = `країна: ${station.country}`;
    const icon = currentStationInfo.querySelector(".station-icon");
    icon.style.backgroundImage = station.favicon ? `url(${station.favicon})` : "none";
    icon.textContent = station.favicon ? "" : "🎵";
  }

  function updatePlayPauseButton() {
    const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
    playPauseBtn.textContent = isPlaying ? "⏸" : "▶";
  }

  function updateWaveAnimation(playing) {
    const waveLines = document.querySelectorAll(".wave-line");
    waveLines.forEach(line => {
      if (playing) {
        line.classList.add("playing");
      } else {
        line.classList.remove("playing");
      }
    });
  }

  function normalizeCountry(country) {
    const countryMap = {
      "usa": "United States",
      "uk": "United Kingdom",
      "ua": "Ukraine",
      "us": "United States"
    };
    return countryMap[country.toLowerCase()] || country.charAt(0).toUpperCase() + country.slice(1).toLowerCase();
  }

  function isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  function exportSettings() {
    const settings = {
      selectedTheme: localStorage.getItem("selectedTheme") || "shadow-pulse",
      customTabs: JSON.parse(localStorage.getItem("customTabs")) || [],
      userAddedStations: JSON.parse(localStorage.getItem("userAddedStations")) || {},
      favoriteStations: JSON.parse(localStorage.getItem("favoriteStations")) || [],
      pastSearches: JSON.parse(localStorage.getItem("pastSearches")) || [],
      deletedStations: JSON.parse(localStorage.getItem("deletedStations")) || [],
      currentTab: localStorage.getItem("currentTab") || "techno"
    };
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "radio_settings.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log("Settings exported:", settings);
  }

  function importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const settings = JSON.parse(e.target.result);
        if (!settings || typeof settings !== "object") {
          alert("Некоректний файл налаштувань!");
          return;
        }
        const validThemes = [
          "shadow-pulse", "dark-abyss", "emerald-glow", "retro-wave",
          "neon-pulse", "lime-surge", "flamingo-flash", "aqua-glow",
          "aurora-haze", "starlit-amethyst", "lunar-frost"
        ];
        if (settings.selectedTheme && validThemes.includes(settings.selectedTheme)) {
          localStorage.setItem("selectedTheme", settings.selectedTheme);
          applyTheme(settings.selectedTheme);
        }
        if (Array.isArray(settings.customTabs)) {
          const validTabs = settings.customTabs.filter(tab => 
            typeof tab === "string" && 
            tab.trim() && 
            tab.length <= 10 && 
            /^[a-z0-9_-]+$/.test(tab) && 
            !["best", "techno", "trance", "ukraine", "pop", "search"].includes(tab) &&
            !customTabs.includes(tab)
          );
          if (validTabs.length + customTabs.length <= 7) {
            customTabs = validTabs;
            localStorage.setItem("customTabs", JSON.stringify(customTabs));
          } else {
            console.warn("Імпортовані вкладки перевищують ліміт у 7, пропускаємо");
          }
        }
        if (settings.userAddedStations && typeof settings.userAddedStations === "object") {
          const validStations = {};
          Object.keys(settings.userAddedStations).forEach(tab => {
            if (["techno", "trance", "ukraine", "pop", ...customTabs].includes(tab)) {
              const stations = Array.isArray(settings.userAddedStations[tab]) 
                ? settings.userAddedStations[tab].filter(s => 
                    s && typeof s === "object" && 
                    s.name && typeof s.name === "string" && 
                    s.value && isValidUrl(s.value) && 
                    s.genre && typeof s.genre === "string" && 
                    s.country && typeof s.country === "string"
                  )
                : [];
              validStations[tab] = stations;
            }
          });
          userAddedStations = validStations;
          localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
        }
        if (Array.isArray(settings.favoriteStations)) {
          favoriteStations = settings.favoriteStations.filter(name => typeof name === "string");
          localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
        }
        if (Array.isArray(settings.pastSearches)) {
          pastSearches = settings.pastSearches.filter(search => typeof search === "string").slice(0, 5);
          localStorage.setItem("pastSearches", JSON.stringify(pastSearches));
          updatePastSearches();
        }
        if (Array.isArray(settings.deletedStations)) {
          deletedStations = settings.deletedStations.filter(name => typeof name === "string");
          localStorage.setItem("deletedStations", JSON.stringify(deletedStations));
        }
        if (settings.currentTab && typeof settings.currentTab === "string") {
          const validTabs = ["best", "techno", "trance", "ukraine", "pop", "search", ...customTabs];
          if (validTabs.includes(settings.currentTab)) {
            currentTab = settings.currentTab;
            localStorage.setItem("currentTab", currentTab);
          }
        }
        loadStations();
        switchTab(currentTab);
        console.log("Налаштування імпортовано:", settings);
        alert("Налаштування успішно імпортовано!");
      } catch (error) {
        console.error("Помилка імпорту налаштувань:", error);
        alert("Помилка імпорту налаштувань. Перевірте формат файлу.");
      }
      importFileInput.value = "";
    };
    reader.readAsText(file);
  }

  function populateSearchSuggestions() {
    const suggestedCountries = [
      "Germany", "France", "United Kingdom", "Italy", "Spain", "Netherlands",
      "Switzerland", "Belgium", "Sweden", "Norway", "Denmark", "Austria",
      "Poland", "Ukraine", "Canada", "United States", "Australia", "Japan",
      "South Korea", "New Zealand"
    ];
    const suggestedGenres = [
      "Pop", "Rock", "Dance", "Electronic", "Techno", "Trance", "House",
      "EDM", "Hip-Hop", "Rap", "Jazz", "Classical", "Country", "Reggae",
      "Blues", "Folk", "Metal", "R&B", "Soul", "Ambient"
    ];

    const countryDatalist = document.getElementById("suggestedCountries");
    const genreDatalist = document.getElementById("suggestedGenres");

    countryDatalist.innerHTML = suggestedCountries.map(country => `<option value="${country}">`).join("");
    genreDatalist.innerHTML = suggestedGenres.map(genre => `<option value="${genre}">`).join("");
  }

  function updatePastSearches() {
    const pastSearchesList = document.getElementById("pastSearches");
    pastSearchesList.innerHTML = "";
    pastSearches.forEach(search => {
      const option = document.createElement("option");
      option.value = search;
      pastSearchesList.appendChild(option);
    });
  }
});