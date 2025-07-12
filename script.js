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
let autoPlayRequestId = 0;
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
  const floatingMenuBtn = document.querySelector(".floating-menu-btn");
  const floatingMenu = document.querySelector(".floating-menu");
  const canvas = document.getElementById("circleVisualizer");
  const ctx = canvas?.getContext("2d");
  const progressBar = document.querySelector(".progress");

  if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle || !shareButton || !exportButton || !importButton || !importFileInput || !searchInput || !searchQuery || !searchCountry || !searchGenre || !searchBtn || !pastSearchesList || !tabsContainer || !floatingMenuBtn || !floatingMenu || !canvas || !ctx) {
    console.error("One of required DOM elements not found");
    setTimeout(initializeApp, 100);
    return;
  }

  initializeApp();

  function initializeApp() {
    audio.preload = "auto";
    audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;
    audio.crossOrigin = "anonymous";

    let analyser, source;
    function initVisualizer() {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      source = audioContext.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      analyser.fftSize = 128;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      function drawVisualizer() {
        requestAnimationFrame(drawVisualizer);
        analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(canvas.width, canvas.height) / 4;
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent');
        ctx.lineWidth = 2;

        for (let i = 0; i < bufferLength; i++) {
          const angle = (i / bufferLength) * Math.PI * 2;
          const amplitude = dataArray[i] / 255;
          const r = radius + amplitude * radius * 0.5;
          ctx.beginPath();
          ctx.arc(centerX, centerY, r, angle, angle + Math.PI / bufferLength);
          ctx.stroke();
        }
      }

      drawVisualizer();
    }

    if (audio.paused) {
      document.querySelectorAll(".progress").forEach(p => p.style.width = "0%");
    } else {
      initVisualizer();
    }

    floatingMenuBtn.addEventListener("click", () => {
      floatingMenu.classList.toggle("active");
    });

    updatePastSearches();
    populateSearchSuggestions();
    renderTabs();
    loadStations();

    shareButton.addEventListener("click", () => {
      const stationName = currentStationInfo.querySelector(".station-name").textContent || "Radio S O";
      const shareData = {
        title: "Radio S O",
        text: `Listening to ${stationName} on Radio S O! Join my favorite radio stations!`,
        url: window.location.href
      };
      if (navigator.share) {
        navigator.share(shareData).catch(error => console.error("Error sharing:", error));
      } else {
        alert(`Share function not supported. Copy: ${shareData.text} ${shareData.url}`);
      }
    });

    exportButton.addEventListener("click", exportSettings);
    importButton.addEventListener("click", () => importFileInput.click());
    importFileInput.addEventListener("change", importSettings);

    document.querySelector(".controls .control-btn:nth-child(1)").addEventListener("click", prevStation);
    document.querySelector(".controls .control-btn:nth-child(2)").addEventListener("click", togglePlayPause);
    document.querySelector(".controls .control-btn:nth-child(3)").addEventListener("click", nextStation);

    let touchStartX = 0;
    let touchEndX = 0;
    stationList.addEventListener("touchstart", e => touchStartX = e.changedTouches[0].screenX);
    stationList.addEventListener("touchend", e => {
      touchEndX = e.changedTouches[0].screenX;
      if (touchStartX - touchEndX > 50) nextStation();
      if (touchEndX - touchStartX > 50) prevStation();
    });

    tabsContainer.addEventListener("touchstart", e => touchStartX = e.changedTouches[0].screenX);
    tabsContainer.addEventListener("touchend", e => {
      touchEndX = e.changedTouches[0].screenX;
      const tabs = Array.from(tabsContainer.querySelectorAll(".tab-btn"));
      const currentIdx = tabs.findIndex(btn => btn.classList.contains("active"));
      if (touchStartX - touchEndX > 50 && currentIdx < tabs.length - 1) {
        switchTab(tabs[currentIdx + 1].dataset.tab);
      }
      if (touchEndX - touchStartX > 50 && currentIdx > 0) {
        switchTab(tabs[currentIdx - 1].dataset.tab);
      }
    });

    searchBtn.addEventListener("click", () => {
      const query = searchQuery.value.trim();
      const country = normalizeCountry(searchCountry.value.trim());
      const genre = searchGenre.value.trim().toLowerCase();
      if (query || country || genre) {
        if (query && !pastSearches.includes(query)) {
          pastSearches.unshift(query);
          if (pastSearches.length > 5) pastSearches.pop();
          localStorage.setItem("pastSearches", JSON.stringify(pastSearches));
          updatePastSearches();
        }
        searchStations(query, country, genre);
      } else {
        stationList.innerHTML = "<div class='station-item empty'>Enter station name, country or genre</div>";
      }
    });

    searchQuery.addEventListener("keypress", e => {
      if (e.key === "Enter") searchBtn.click();
    });

    searchCountry.addEventListener("keypress", e => {
      if (e.key === "Enter") searchBtn.click();
    });

    searchGenre.addEventListener("keypress", e => {
      if (e.key === "Enter") searchBtn.click();
    });
  }

  function exportSettings() {
    const settings = {
      selectedTheme: localStorage.getItem("selectedTheme") || "neon-pulse",
      customTabs,
      userAddedStations,
      favoriteStations,
      pastSearches,
      deletedStations,
      currentTab
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
  }

  function importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const settings = JSON.parse(e.target.result);
        if (!settings || typeof settings !== "object") {
          alert("Invalid settings file!");
          return;
        }
        const validThemes = [
          "neon-pulse", "lime-surge", "flamingo-flash", "violet-vortex",
          "aqua-glow", "cosmic-indigo", "mystic-jade", "aurora-haze",
          "starlit-amethyst", "lunar-frost"
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
        alert("Settings imported successfully!");
      } catch (error) {
        console.error("Error importing settings:", error);
        alert("Error importing settings. Please check the file format.");
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
    pastSearchesList.innerHTML = "";
    pastSearches.forEach(search => {
      const option = document.createElement("option");
      option.value = search;
      pastSearchesList.appendChild(option);
    });
  }

  function normalizeCountry(country) {
    if (!country) return "";
    const countryMap = {
      "ukraine": "Ukraine", "italy": "Italy", "german": "Germany",
      "germany": "Germany", "france": "France", "spain": "Spain",
      "usa": "United States", "united states": "United States",
      "uk": "United Kingdom", "united kingdom": "United Kingdom",
      "netherlands": "Netherlands", "canada": "Canada", "australia": "Australia",
      "switzerland": "Switzerland", "belgium": "Belgium", "poland": "Poland",
      "austria": "Austria", "sweden": "Sweden", "norway": "Norway",
      "denmark": "Denmark", "japan": "Japan", "south korea": "South Korea",
      "new zealand": "New Zealand"
    };
    const normalized = country.toLowerCase();
    return countryMap[normalized] || country.charAt(0).toUpperCase() + country.slice(1).toLowerCase();
  }

  function isValidUrl(url) {
    if (!url) return false;
    try {
      new URL(url);
      return /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(url);
    } catch {
      return false;
    }
  }

  function normalizeUrl(url) {
    if (!url) return "";
    try {
      const urlObj = new URL(url);
      return urlObj.origin + urlObj.pathname;
    } catch {
      return url;
    }
  }

  function resetStationInfo() {
    const stationNameElement = currentStationInfo.querySelector(".station-name");
    const stationGenreElement = currentStationInfo.querySelector(".station-genre");
    const stationCountryElement = currentStationInfo.querySelector(".station-country");
    const stationIconElement = currentStationInfo.querySelector(".station-icon");
    if (stationNameElement) stationNameElement.textContent = "Select station";
    if (stationGenreElement) stationGenreElement.textContent = "genre: -";
    if (stationCountryElement) stationCountryElement.textContent = "country: -";
    if (stationIconElement) {
      stationIconElement.innerHTML = "🎵";
      stationIconElement.style.backgroundImage = "none";
    }
    progressBar.style.width = "0%";
  }

  async function loadStations() {
    stationList.innerHTML = "<div class='station-item empty'>Loading...</div>";
    try {
      abortController.abort();
      abortController = new AbortController();
      const response = await fetch(`stations.json?t=${Date.now()}`, {
        cache: "no-store",
        signal: abortController.signal
      });
      const mergedStationLists = {};
      if (response.ok) {
        const newStations = await response.json();
        Object.keys(newStations).forEach(tab => {
          const uniqueStations = new Map();
          (userAddedStations[tab] || []).forEach(s => {
            if (!deletedStations.includes(s.name)) {
              uniqueStations.set(s.name, s);
            }
          });
          newStations[tab].forEach(s => {
            if (!deletedStations.includes(s.name)) {
              uniqueStations.set(s.name, s);
            }
          });
          mergedStationLists[tab] = Array.from(uniqueStations.values());
        });
      }
      customTabs.forEach(tab => {
        const uniqueStations = new Map();
        (userAddedStations[tab] || []).forEach(s => {
          if (!deletedStations.includes(s.name)) {
            uniqueStations.set(s.name, s);
          }
        });
        (stationLists[tab] || []).forEach(s => {
          if (!deletedStations.includes(s.name)) {
            uniqueStations.set(s.name, s);
          }
        });
        mergedStationLists[tab] = Array.from(uniqueStations.values());
      });
      stationLists = mergedStationLists;
      localStorage.setItem("stationLists", JSON.stringify(stationLists));
      favoriteStations = favoriteStations.filter(name => 
        Object.values(stationLists).flat().some(s => s.name === name)
      );
      localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
      const validTabs = [...Object.keys(stationLists), "best", "search", ...customTabs];
      if (!validTabs.includes(currentTab)) {
        currentTab = validTabs[0] || "techno";
        localStorage.setItem("currentTab", currentTab);
      }
      currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
      switchTab(currentTab);
    } catch (error) {
      if (error.name !== 'AbortError') {
        stationList.innerHTML = "<div class='station-item empty'>Failed to load stations</div>";
      }
    }
  }

  async function searchStations(query, country, genre) {
    stationList.innerHTML = "<div class='station-item empty'>Searching...</div>";
    try {
      abortController.abort();
      abortController = new AbortController();
      const params = new URLSearchParams();
      if (query) params.append("name", query);
      if (country) params.append("country", country);
      if (genre) params.append("tag", genre);
      params.append("order", "clickcount");
      params.append("reverse", "true");
      params.append("limit", "2000");
      const response = await fetch(`https://de1.api.radio-browser.info/json/stations/search?${params.toString()}`, {
        signal: abortController.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let stations = await response.json();
      stations = stations.filter(station => station.url_resolved && isValidUrl(station.url_resolved));
      renderSearchResults(stations);
    } catch (error) {
      if (error.name !== 'AbortError') {
        stationList.innerHTML = "<div class='station-item empty'>Failed to find stations</div>";
      }
    }
  }

  function renderSearchResults(stations) {
    if (!stations.length) {
      stationList.innerHTML = "<div class='station-item empty'>Nothing found</div>";
      stationItems = [];
      return;
    }
    const fragment = document.createDocumentFragment();
    stations.forEach((station, index) => {
      const item = document.createElement("div");
      item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
      item.dataset.value = station.url_resolved;
      item.dataset.name = station.name || "Unknown";
      item.dataset.genre = shortenGenre(station.tags || "Unknown");
      item.dataset.country = station.country || "Unknown";
      item.dataset.favicon = station.favicon && isValidUrl(station.favicon) ? station.favicon : "";
      const iconHtml = item.dataset.favicon ? `<img src="${item.dataset.favicon}" alt="${station.name} icon" style="width: 28px; height: 28px;" onerror="this.outerHTML='🎵 '">` : "🎵 ";
      item.innerHTML = `
        ${iconHtml}
        <div class="station-info">
          <span class="station-name">${station.name}</span>
          <div class="station-details">${item.dataset.genre} | ${item.dataset.country}</div>
        </div>
        <div class="buttons-container">
          <button class="add-btn material-icons">add</button>
        </div>`;
      fragment.appendChild(item);
    });
    stationList.innerHTML = "";
    stationList.appendChild(fragment);
    stationItems = document.querySelectorAll(".station-item");
    if (stationItems.length && currentIndex < stationItems.length) {
      changeStation(currentIndex);
    }
    stationList.onclick = e => {
      const item = e.target.closest(".station-item");
      const addBtn = e.target.closest(".add-btn");
      if (item && !item.classList.contains("empty")) {
        currentIndex = Array.from(stationItems).indexOf(item);
        changeStation(currentIndex);
      }
      if (addBtn) {
        e.stopPropagation();
        showTabModal(item);
      }
    };
  }

  function shortenGenre(tags) {
    const genres = tags.split(",").map(g => g.trim()).filter(g => g);
    return genres.length > 4 ? genres.slice(0, 4).join(", ") + "..." : genres.join(", ");
  }

  function showTabModal(item) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <h2>Select tab</h2>
      <div class="modal-tabs">
        <button class="modal-tab-btn" data-tab="techno">TECHNO</button>
        <button class="modal-tab-btn" data-tab="trance">TRANCE</button>
        <button class="modal-tab-btn" data-tab="ukraine">UA</button>
        <button class="modal-tab-btn" data-tab="pop">POP</button>
        ${customTabs.map(tab => `<button class="modal-tab-btn" data-tab="${tab}">${tab.toUpperCase()}</button>`).join('')}
        <button class="modal-cancel-btn">Cancel</button>
      </div>`;
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
    const closeModal = () => {
      overlay.remove();
      modal.remove();
    };
    overlay.addEventListener("click", closeModal);
    modal.querySelectorAll(".modal-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const targetTab = btn.dataset.tab;
        saveStation(item, targetTab);
        closeModal();
      });
    });
    modal.querySelector(".modal-cancel-btn").addEventListener("click", closeModal);
  }

  function saveStation(item, targetTab) {
    const stationName = item.dataset.name;
    if (!stationLists[targetTab]) stationLists[targetTab] = [];
    if (!userAddedStations[targetTab]) userAddedStations[targetTab] = [];
    if (!stationLists[targetTab].some(s => s.name === stationName)) {
      const newStation = {
        value: item.dataset.value,
        name: item.dataset.name,
        genre: item.dataset.genre,
        country: item.dataset.country,
        favicon: item.dataset.favicon || "",
        isFromSearch: currentTab === "search"
      };
      stationLists[targetTab].unshift(newStation);
      userAddedStations[targetTab].unshift(newStation);
      localStorage.setItem("stationLists", JSON.stringify(stationLists));
      localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
      if (currentTab !== "search") {
        updateStationList();
      }
    } else {
      alert("This station is already added to the selected tab!");
    }
  }

  function renderTabs() {
    const fixedTabs = ["best", "techno", "trance", "ukraine", "pop", "search"];
    tabsContainer.innerHTML = "";
    fixedTabs.forEach(tab => {
      const btn = document.createElement("button");
      btn.className = `tab-btn ${currentTab === tab ? "active" : ""}`;
      btn.dataset.tab = tab;
      btn.textContent = tab === "best" ? "Best" : tab === "ukraine" ? "UA" : tab === "search" ? "Search" : tab.charAt(0).toUpperCase() + tab.slice(1);
      tabsContainer.appendChild(btn);
    });
    customTabs.forEach(tab => {
      if (typeof tab !== "string" || !tab.trim()) return;
      const btn = document.createElement("button");
      btn.className = `tab-btn ${currentTab === tab ? "active" : ""}`;
      btn.dataset.tab = tab;
      btn.textContent = tab.toUpperCase();
      tabsContainer.appendChild(btn);
    });
    const addBtn = document.createElement("button");
    addBtn.className = "add-tab-btn";
    addBtn.textContent = "+";
    tabsContainer.appendChild(addBtn);

    tabsContainer.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
      if (customTabs.includes(btn.dataset.tab)) {
        let longPressTimer;
        btn.addEventListener("pointerdown", () => {
          longPressTimer = setTimeout(() => showEditTabModal(btn.dataset.tab), 500);
        });
        btn.addEventListener("pointerup", () => clearTimeout(longPressTimer));
        btn.addEventListener("pointerleave", () => clearTimeout(longPressTimer));
      }
    });

    addBtn.addEventListener("click", showNewTabModal);
  }

  function showNewTabModal() {
    const overlay = document.querySelector(".new-tab-modal");
    const modal = overlay.querySelector(".modal");
    const input = document.getElementById("newTabName");
    const createBtn = document.getElementById("createTabBtn");
    const cancelBtn = modal.querySelector(".modal-cancel-btn");

    overlay.style.display = "block";
    input.value = "";
    input.focus();

    const closeModal = () => {
      overlay.style.display = "none";
      createBtn.removeEventListener("click", createTabHandler);
      cancelBtn.removeEventListener("click", closeModal);
      overlay.removeEventListener("click", closeModal);
      input.removeEventListener("keypress", keypressHandler);
    };

    const createTabHandler = () => {
      const tabName = input.value.trim().toLowerCase();
      if (!tabName) {
        alert("Enter tab name!");
        return;
      }
      if (["best", "techno", "trance", "ukraine", "pop", "search"].includes(tabName) || customTabs.includes(tabName)) {
        alert("This tab name already exists!");
        return;
      }
      if (tabName.length > 10 || !/^[a-z0-9_-]+$/.test(tabName)) {
        alert("Tab name cannot exceed 10 characters and must contain only Latin letters, numbers, hyphen or underscore.");
        return;
      }
      if (customTabs.length >= 7) {
        alert("Maximum of 7 custom tabs reached!");
        return;
      }
      customTabs.push(tabName);
      stationLists[tabName] = [];
      userAddedStations[tabName] = [];
      localStorage.setItem("customTabs", JSON.stringify(customTabs));
      localStorage.setItem("stationLists", JSON.stringify(stationLists));
      localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
      renderTabs();
      switchTab(tabName);
      closeModal();
    };

    const keypressHandler = e => {
      if (e.key === "Enter") createTabHandler();
    };

    createBtn.addEventListener("click", createTabHandler);
    cancelBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", closeModal);
    input.addEventListener("keypress", keypressHandler);
  }

  function showEditTabModal(tab) {
    const overlay = document.querySelector(".edit-tab-modal");
    const modal = overlay.querySelector(".modal");
    const input = document.getElementById("renameTabName");
    const renameBtn = document.getElementById("renameTabBtn");
    const deleteBtn = document.getElementById("deleteTabBtn");
    const cancelBtn = modal.querySelector(".modal-cancel-btn");

    overlay.style.display = "block";
    input.value = tab;
    input.focus();

    const closeModal = () => {
      overlay.style.display = "none";
      renameBtn.removeEventListener("click", renameTabHandler);
      deleteBtn.removeEventListener("click", deleteTabHandler);
      cancelBtn.removeEventListener("click", closeModal);
      overlay.removeEventListener("click", closeModal);
      input.removeEventListener("keypress", keypressHandler);
    };

    const renameTabHandler = () => {
      const newName = input.value.trim().toLowerCase();
      if (!newName) {
        alert("Enter new tab name!");
        return;
      }
      if (["best", "techno", "trance", "ukraine", "pop", "search"].includes(newName) || customTabs.includes(newName)) {
        alert("This tab name already exists!");
        return;
      }
      if (newName.length > 10 || !/^[a-z0-9_-]+$/.test(newName)) {
        alert("Tab name cannot exceed 10 characters and must contain only Latin letters, numbers, hyphen or underscore!");
        return;
      }
      const index = customTabs.indexOf(tab);
      customTabs[index] = newName;
      stationLists[newName] = stationLists[tab] || [];
      userAddedStations[newName] = userAddedStations[tab] || [];
      delete stationLists[tab];
      delete userAddedStations[tab];
      localStorage.setItem("customTabs", JSON.stringify(customTabs));
      localStorage.setItem("stationLists", JSON.stringify(stationLists));
      localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
      if (currentTab === tab) switchTab(newName);
      renderTabs();
      closeModal();
    };

    const deleteTabHandler = () => {
      if (confirm(`Are you sure you want to delete the "${tab.toUpperCase()}" tab?`)) {
        customTabs = customTabs.filter(t => t !== tab);
        delete stationLists[tab];
        delete userAddedStations[tab];
        localStorage.setItem("customTabs", JSON.stringify(customTabs));
        localStorage.setItem("stationLists", JSON.stringify(stationLists));
        localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
        if (currentTab === tab) {
          const newTab = customTabs.length > 0 ? customTabs[0] : "techno";
          switchTab(newTab);
        }
        renderTabs();
        closeModal();
      }
    };

    const keypressHandler = e => {
      if (e.key === "Enter") renameTabHandler();
    };

    renameBtn.addEventListener("click", renameTabHandler);
    deleteBtn.addEventListener("click", deleteTabHandler);
    cancelBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", closeModal);
    input.addEventListener("keypress", keypressHandler);
  }

  const themes = {
    "neon-pulse": {
      bodyBg: "linear-gradient(180deg, #0A0A0A, #1A1A1A)",
      containerBg: "rgba(18, 18, 18, 0.8)",
      accent: "#00F0FF",
      text: "#F0F0F0",
      accentGradient: "linear-gradient(45deg, #003C4B, #00F0FF)"
    },
    "lime-surge": {
      bodyBg: "linear-gradient(180deg, #0A0A0A, #1A1A1A)",
      containerBg: "rgba(18, 18, 18, 0.8)",
      accent: "#B2FF59",
      text: "#E8F5E9",
      accentGradient: "linear-gradient(45deg, #2E4B2F, #B2FF59)"
    },
    "flamingo-flash": {
      bodyBg: "linear-gradient(180deg, #0A0A0A, #1A1A1A)",
      containerBg: "rgba(18, 18, 18, 0.8)",
      accent: "#FF4081",
      text: "#FCE4EC",
      accentGradient: "linear-gradient(45deg, #4B1A2E, #FF4081)"
    },
    "violet-vortex": {
      bodyBg: "linear-gradient(180deg, #121212, #1A1A1A)",
      containerBg: "rgba(26, 26, 26, 0.8)",
      accent: "#7C4DFF",
      text: "#EDE7F6",
      accentGradient: "linear-gradient(45deg, #2E1A47, #7C4DFF)"
    },
    "aqua-glow": {
      bodyBg: "linear-gradient(180deg, #0A0A0A, #1A1A1A)",
      containerBg: "rgba(18, 18, 18, 0.8)",
      accent: "#26C6DA",
      text: "#B2EBF2",
      accentGradient: "linear-gradient(45deg, #1A3C4B, #26C6DA)"
    },
    "cosmic-indigo": {
      bodyBg: "linear-gradient(180deg, #121212, #1A1A1A)",
      containerBg: "rgba(26, 26, 26, 0.8)",
      accent: "#3F51B5",
      text: "#BBDEFB",
      accentGradient: "linear-gradient(45deg, #1A2A5A, #3F51B5)"
    },
    "mystic-jade": {
      bodyBg: "linear-gradient(180deg, #0A0A0A, #1A1A1A)",
      containerBg: "rgba(18, 18, 18, 0.8)",
      accent: "#26A69A",
      text: "#B2DFDB",
      accentGradient: "linear-gradient(45deg, #1A3C4B, #26A69A)"
    },
    "aurora-haze": {
      bodyBg: "linear-gradient(180deg, #121212, #1A1A1A)",
      containerBg: "rgba(26, 26, 26, 0.8)",
      accent: "#64FFDA",
      text: "#E0F7FA",
      accentGradient: "linear-gradient(45deg, #1A4B4B, #64FFDA)"
    },
    "starlit-amethyst": {
      bodyBg: "linear-gradient(180deg, #0A0A0A, #1A1A1A)",
      containerBg: "rgba(18, 18, 18, 0.8)",
      accent: "#B388FF",
      text: "#E1BEE7",
      accentGradient: "linear-gradient(45deg, #2E1A47, #B388FF)"
    },
    "lunar-frost": {
      bodyBg: "linear-gradient(180deg, #F5F7FA, #E0E7FF)",
      containerBg: "rgba(255, 255, 255, 0.9)",
      accent: "#40C4FF",
      text: "#212121",
      accentGradient: "linear-gradient(45deg, #B3E5FC, #40C4FF)"
    }
  };
  let currentTheme = localStorage.getItem("selectedTheme") || "neon-pulse";
  if (!themes[currentTheme]) {
    currentTheme = "neon-pulse";
    localStorage.setItem("selectedTheme", currentTheme);
  }

  function applyTheme(theme) {
    if (!themes[theme]) {
      theme = "neon-pulse";
      localStorage.setItem("selectedTheme", theme);
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
      "neon-pulse", "lime-surge", "flamingo-flash", "violet-vortex",
      "aqua-glow", "cosmic-indigo", "mystic-jade", "aurora-haze",
      "starlit-amethyst", "lunar-frost"
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
              if (window.confirm("New version of radio available. Update?")) {
                window.location.reload();
              }
            }
          });
        }
      });
    });

    navigator.serviceWorker.addEventListener("message", event => {
      if (event.data.type === "CACHE_UPDATED") {
        const currentCacheVersion = localStorage.getItem("cacheVersion") || "0";
        if (currentCacheVersion !== event.data.cacheVersion) {
          favoriteStations = favoriteStations.filter(name =>
            Object.values(stationLists).flat().some(s => s.name === name)
          );
          localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
          localStorage.setItem("cacheVersion", event.data.cacheVersion);
          loadStations();
        }
      }
      if (event.data.type === "NETWORK_STATUS" && event.data.online && intendedPlaying && stationItems?.length && currentIndex < stationItems.length) {
        debouncedTryAutoPlay();
      }
    });
  }

  let autoPlayTimeout = null;
  function debouncedTryAutoPlay(retryCount = 2, delay = 1000) {
    if (isAutoPlayPending) return;
    const now = Date.now();
    const currentStationUrl = stationItems?.[currentIndex]?.dataset?.value;
    const normalizedCurrentUrl = normalizeUrl(currentStationUrl);
    const normalizedAudioSrc = normalizeUrl(audio.src);
    if (now - lastSuccessfulPlayTime < 500 && normalizedAudioSrc === normalizedCurrentUrl) return;
    if (autoPlayTimeout) clearTimeout(autoPlayTimeout);
    autoPlayRequestId++;
    const currentRequestId = autoPlayRequestId;
    autoPlayTimeout = setTimeout(() => tryAutoPlay(retryCount, delay, currentRequestId), 0);
  }

  async function tryAutoPlay(retryCount = 2, delay = 1000, requestId) {
    if (isAutoPlayPending || requestId !== autoPlayRequestId) return;
    isAutoPlayPending = true;

    try {
      if (!navigator.onLine || !intendedPlaying || !stationItems?.length || currentIndex >= stationItems.length) {
        progressBar.style.width = "0%";
        return;
      }
      const currentStationUrl = stationItems[currentIndex].dataset.value;
      const initialStationUrl = currentStationUrl;
      const normalizedCurrentUrl = normalizeUrl(currentStationUrl);
      const normalizedAudioSrc = normalizeUrl(audio.src);
      if (normalizedAudioSrc === normalizedCurrentUrl && !audio.paused && !audio.error && audio.readyState >= 2 && audio.currentTime > 0) return;

      if (!isValidUrl(currentStationUrl)) {
        errorCount++;
        if (errorCount >= ERROR_LIMIT) resetStationInfo();
        return;
      }

      const attemptPlay = async attemptsLeft => {
        if (streamAbortController) {
          streamAbortController.abort();
          streamAbortController = null;
        }
        if (stationItems[currentIndex].dataset.value !== initialStationUrl || requestId !== autoPlayRequestId) return;

        streamAbortController = new AbortController();
        audio.pause();
        audio.src = null;
        audio.load();
        audio.src = currentStationUrl + "?nocache=" + Date.now();
        progressBar.style.width = "30%";

        try {
          await audio.play();
          errorCount = 0;
          isPlaying = true;
          lastSuccessfulPlayTime = Date.now();
          progressBar.style.width = "100%";
          localStorage.setItem("isPlaying", isPlaying);
          updateCurrentStation(stationItems[currentIndex]);
          initVisualizer();
        } catch (error) {
          if (error.name === 'AbortError') return;
          progressBar.style.width = "0%";
          if (attemptsLeft > 1 && stationItems[currentIndex].dataset.value === initialStationUrl && requestId === autoPlayRequestId) {
            await new Promise(resolve => setTimeout(resolve, delay));
            await attemptPlay(attemptsLeft - 1);
          } else {
            errorCount++;
            if (errorCount >= ERROR_LIMIT) {
              resetStationInfo();
              intendedPlaying = false;
              localStorage.setItem("intendedPlaying", intendedPlaying);
              playPauseBtn.textContent = "play_arrow";
            } else {
              nextStation();
            }
          }
        } finally {
          streamAbortController = null;
        }
      };

      await attemptPlay(retryCount);
    } finally {
      isAutoPlayPending = false;
      streamAbortController = null;
    }
  }

  function switchTab(tab) {
    const validTabs = ["best", "techno", "trance", "ukraine", "pop", "search", ...customTabs];
    if (!validTabs.includes(tab)) tab = "techno";
    currentTab = tab;
    localStorage.setItem("currentTab", currentTab);
    const savedIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
    const maxIndex = tab === "best" ? favoriteStations.length - 1 : tab === "search" ? 0 : stationLists[tab]?.length - 1 || 0;
    currentIndex = savedIndex <= maxIndex && savedIndex >= 0 ? savedIndex : 0;
    searchInput.style.display = tab === "search" ? "flex" : "none";
    searchQuery.value = "";
    searchCountry.value = "";
    searchGenre.value = "";
    if (tab === "search") {
      stationList.innerHTML = "<div class='station-item empty'>Enter station name, country or genre</div>";
      stationItems = [];
    } else {
      updateStationList();
    }
    renderTabs();
    if (stationItems?.length && currentIndex < stationItems.length && intendedPlaying) {
      const normalizedCurrentUrl = normalizeUrl(stationItems[currentIndex].dataset.value);
      const normalizedAudioSrc = normalizeUrl(audio.src);
      if (normalizedAudioSrc !== normalizedCurrentUrl || audio.paused || audio.error || audio.readyState < 2 || audio.currentTime === 0) {
        debouncedTryAutoPlay();
      }
    } else {
      resetStationInfo();
      audio.pause();
      isPlaying = false;
      localStorage.setItem("isPlaying", isPlaying);
      playPauseBtn.textContent = "play_arrow";
    }
  }

  function updateStationList() {
    stationList.innerHTML = "";
    let stations = [];
    if (currentTab === "best") {
      stations = favoriteStations
        .map(name => Object.values(stationLists).flat().find(s => s.name === name))
        .filter(s => s && !deletedStations.includes(s.name));
    } else {
      stations = (stationLists[currentTab] || []).filter(s => !deletedStations.includes(s.name));
    }
    if (!stations.length) {
      stationList.innerHTML = "<div class='station-item empty'>No stations available</div>";
      stationItems = [];
      return;
    }
    const fragment = document.createDocumentFragment();
    stations.forEach((station, index) => {
      const item = document.createElement("div");
      item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
      item.dataset.value = station.value;
      item.dataset.name = station.name || "Unknown";
      item.dataset.genre = shortenGenre(station.genre || "Unknown");
      item.dataset.country = station.country || "Unknown";
      item.dataset.favicon = station.favicon && isValidUrl(station.favicon) ? station.favicon : "";
      const iconHtml = item.dataset.favicon ? `<img src="${item.dataset.favicon}" alt="${station.name} icon" style="width: 28px; height: 28px;" onerror="this.outerHTML='🎵 '">` : "🎵 ";
      const isFavorited = favoriteStations.includes(station.name);
      item.innerHTML = `
        ${iconHtml}
        <div class="station-info">
          <span class="station-name">${station.name}</span>
          <div class="station-details">${item.dataset.genre} | ${item.dataset.country}</div>
        </div>
        <div class="buttons-container">
          <button class="favorite-btn material-icons ${isFavorited ? "favorited" : ""}">${isFavorited ? "star" : "star_border"}</button>
          ${currentTab !== "best" ? '<button class="delete-btn material-icons">delete</button>' : ""}
        </div>`;
      fragment.appendChild(item);
    });
    stationList.appendChild(fragment);
    stationItems = document.querySelectorAll(".station-item");
    if (stationItems.length && currentIndex < stationItems.length) {
      updateCurrentStation(stationItems[currentIndex]);
      if (intendedPlaying) debouncedTryAutoPlay();
    } else {
      resetStationInfo();
    }
    stationList.onclick = e => {
      const item = e.target.closest(".station-item");
      const favoriteBtn = e.target.closest(".favorite-btn");
      const deleteBtn = e.target.closest(".delete-btn");
      if (item && !item.classList.contains("empty")) {
        currentIndex = Array.from(stationItems).indexOf(item);
        changeStation(currentIndex);
      }
      if (favoriteBtn) {
        e.stopPropagation();
        toggleFavorite(item);
      }
      if (deleteBtn) {
        e.stopPropagation();
        deleteStation(item);
      }
    };
  }

  function toggleFavorite(item) {
    const stationName = item.dataset.name;
    const index = favoriteStations.indexOf(stationName);
    if (index === -1) {
      favoriteStations.push(stationName);
    } else {
      favoriteStations.splice(index, 1);
    }
    localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
    updateStationList();
    if (currentTab === "best") switchTab("best");
  }

  function deleteStation(item) {
    const stationName = item.dataset.name;
    if (confirm(`Are you sure you want to delete "${stationName}"?`)) {
      deletedStations.push(stationName);
      localStorage.setItem("deletedStations", JSON.stringify(deletedStations));
      favoriteStations = favoriteStations.filter(name => name !== stationName);
      localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
      if (currentTab !== "best") {
        stationLists[currentTab] = stationLists[currentTab].filter(s => s.name !== stationName);
        userAddedStations[currentTab] = userAddedStations[currentTab].filter(s => s.name !== stationName);
        localStorage.setItem("stationLists", JSON.stringify(stationLists));
        localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
      }
      if (currentIndex >= stationLists[currentTab]?.length) {
        currentIndex = Math.max(0, stationLists[currentTab]?.length - 1);
      }
      localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
      updateStationList();
    }
  }

  function changeStation(index) {
    if (index < 0 || index >= stationItems.length) return;
    currentIndex = index;
    localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
    stationItems.forEach(item => item.classList.remove("selected"));
    stationItems[currentIndex].classList.add("selected");
    updateCurrentStation(stationItems[currentIndex]);
    if (intendedPlaying) debouncedTryAutoPlay();
  }

  function updateCurrentStation(item) {
    const stationNameElement = currentStationInfo.querySelector(".station-name");
    const stationGenreElement = currentStationInfo.querySelector(".station-genre");
    const stationCountryElement = currentStationInfo.querySelector(".station-country");
    const stationIconElement = currentStationInfo.querySelector(".station-icon");
    if (stationNameElement) stationNameElement.textContent = item.dataset.name;
    if (stationGenreElement) stationGenreElement.textContent = `genre: ${item.dataset.genre}`;
    if (stationCountryElement) stationCountryElement.textContent = `country: ${item.dataset.country}`;
    if (stationIconElement) {
      stationIconElement.innerHTML = item.dataset.favicon ? `<img src="${item.dataset.favicon}" alt="${item.dataset.name} icon" style="width: 64px; height: 64px;" onerror="this.outerHTML='🎵 '">` : "🎵";
    }
  }

  function togglePlayPause() {
    intendedPlaying = !intendedPlaying;
    localStorage.setItem("intendedPlaying", intendedPlaying);
    if (intendedPlaying && stationItems.length && currentIndex < stationItems.length) {
      debouncedTryAutoPlay();
      playPauseBtn.textContent = "pause";
    } else {
      audio.pause();
      isPlaying = false;
      localStorage.setItem("isPlaying", isPlaying);
      playPauseBtn.textContent = "play_arrow";
      progressBar.style.width = "0%";
    }
  }

  function prevStation() {
    if (stationItems.length) {
      currentIndex = currentIndex === 0 ? stationItems.length - 1 : currentIndex - 1;
      changeStation(currentIndex);
    }
  }

  function nextStation() {
    if (stationItems.length) {
      currentIndex = currentIndex === stationItems.length - 1 ? 0 : currentIndex + 1;
      changeStation(currentIndex);
    }
  }

  audio.addEventListener("volumechange", () => {
    localStorage.setItem("volume", audio.volume);
  });

  audio.addEventListener("error", () => {
    errorCount++;
    if (errorCount >= ERROR_LIMIT) {
      resetStationInfo();
      intendedPlaying = false;
      localStorage.setItem("intendedPlaying", intendedPlaying);
      playPauseBtn.textContent = "play_arrow";
    } else {
      nextStation();
    }
  });

  audio.addEventListener("ended", () => {
    nextStation();
  });

  applyTheme(currentTheme);
});