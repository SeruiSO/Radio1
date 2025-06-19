let currentTab = localStorage.getItem("currentTab") || "techno";
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let stationLists = JSON.parse(localStorage.getItem("stationLists")) || {};
let userAddedStations = JSON.parse(localStorage.getItem("userAddedStations")) || {};
let customTabs = JSON.parse(localStorage.getItem("customTabs")) || [];
let stationItems = [];
let abortController = new AbortController();
let errorCount = 0;
const ERROR_LIMIT = 5;
let pastSearches = JSON.parse(localStorage.getItem("pastSearches")) || [];
let deletedStations = JSON.parse(localStorage.getItem("deletedStations")) || [];

document.addEventListener("DOMContentLoaded", () => {
  const audio = document.getElementById("audioPlayer");
  const stationList = document.getElementById("stationList");
  const playPauseBtn = document.querySelector(".play-pause-btn");
  const currentStationInfo = document.getElementById("currentStationInfo");
  const themeToggle = document.querySelector(".theme-toggle");
  const shareButton = document.querySelector(".share-button");
  const searchInput = document.getElementById("searchInput");
  const searchQuery = document.getElementById("searchQuery");
  const searchCountry = document.getElementById("searchCountry");
  const searchGenre = document.getElementById("searchGenre");
  const searchBtn = document.querySelector(".search-btn");
  const pastSearchesList = document.getElementById("pastSearches");
  const tabsContainer = document.querySelector(".tabs");

  if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle || !shareButton || !searchInput || !searchQuery || !searchCountry || !searchGenre || !searchBtn || !pastSearchesList || !tabsContainer) {
    console.error("DOM elements missing", {
      audio: !!audio, stationList: !!stationList, playPauseBtn: !!playPauseBtn, currentStationInfo: !!currentStationInfo,
      themeToggle: !!themeToggle, shareButton: !!shareButton, searchInput: !!searchInput, searchQuery: !!searchQuery,
      searchCountry: !!searchCountry, searchGenre: !!searchGenre, searchBtn: !!searchBtn, pastSearchesList: !!pastSearchesList, tabsContainer: !!tabsContainer
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
    renderTabs();

    shareButton.addEventListener("click", () => {
      const stationName = currentStationInfo.querySelector(".station-name").textContent || "Radio S O";
      const shareData = {
        title: "Radio S O",
        text: `Слухаю ${stationName} на Radio S O! Приєднуйтесь!`,
        url: window.location.href
      };
      if (navigator.share) {
        navigator.share(shareData).catch(error => console.error("Share error:", error));
      } else {
        alert(`Share not supported. Copy: ${shareData.text} ${shareData.url}`);
      }
    });

    document.querySelector(".prev-btn").addEventListener("click", prevStation);
    playPauseBtn.addEventListener("click", togglePlayPause);
    document.querySelector(".next-btn").addEventListener("click", nextStation);

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
        stationList.innerHTML = "<div class='station-item empty'>Введіть назву, країну чи жанр</div>";
      }
    });

    searchQuery.addEventListener("keypress", (e) => { if (e.key === "Enter") searchBtn.click(); });
    searchCountry.addEventListener("keypress", (e) => { if (e.key === "Enter") searchBtn.click(); });
    searchGenre.addEventListener("keypress", (e) => { if (e.key === "Enter") searchBtn.click(); });

    function renderTabs() {
      const defaultTabs = [
        { id: "best", label: "Best" },
        { id: "techno", label: "Techno" },
        { id: "trance", label: "Trance" },
        { id: "ukraine", label: "UA" },
        { id: "pop", label: "Pop" },
        { id: "search", label: "Search" }
      ];
      tabsContainer.innerHTML = "";
      [...defaultTabs, ...customTabs].forEach(tab => {
        const btn = document.createElement("button");
        btn.className = `tab-btn ${currentTab === tab.id ? "active" : ""}`;
        btn.dataset.tab = tab.id;
        btn.textContent = tab.label;
        btn.addEventListener("click", () => switchTab(tab.id));
        tabsContainer.appendChild(btn);
      });
      const addBtn = document.createElement("button");
      addBtn.className = "tab-btn add-tab-btn";
      addBtn.textContent = "+";
      addBtn.addEventListener("click", showAddTabModal);
      tabsContainer.appendChild(addBtn);
    }

    function showAddTabModal() {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      const modal = document.createElement("div");
      modal.className = "modal";
      modal.innerHTML = `
        <h2>Нова вкладка</h2>
        <div class="modal-content">
          <input type="text" class="modal-input" id="newTabName" placeholder="Назва вкладки" maxlength="20">
          <button class="modal-submit-btn">Додати</button>
          <button class="modal-cancel-btn">Відміна</button>
        </div>
      `;
      document.body.appendChild(overlay);
      document.body.appendChild(modal);
      const input = modal.querySelector("#newTabName");
      const submitBtn = modal.querySelector(".modal-submit-btn");
      const cancelBtn = modal.querySelector(".modal-cancel-btn");
      const closeModal = () => {
        overlay.remove();
        modal.remove();
      };
      submitBtn.addEventListener("click", () => {
        const tabName = input.value.trim();
        if (tabName && ![...Object.keys(stationLists), ...customTabs.map(t => t.id)].includes(tabName.toLowerCase())) {
          const tabId = tabName.toLowerCase().replace(/\s/g, "-");
          customTabs.push({ id: tabId, label: tabName });
          stationLists[tabId] = [];
          userAddedStations[tabId] = [];
          localStorage.setItem("customTabs", JSON.stringify(customTabs));
          localStorage.setItem("stationLists", JSON.stringify(stationLists));
          localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
          renderTabs();
          switchTab(tabId);
          closeModal();
        } else {
          alert("Назва вкладки порожня або вже існує!");
        }
      });
      cancelBtn.addEventListener("click", closeModal);
      overlay.addEventListener("click", closeModal);
      input.focus();
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
      document.getElementById("suggestedCountries").innerHTML = suggestedCountries.map(c => `<option value="${c}">`).join("");
      document.getElementById("suggestedGenres").innerHTML = suggestedGenres.map(g => `<option value="${g}">`).join("");
    }

    function updatePastSearches() {
      pastSearchesList.innerHTML = pastSearches.map(search => `<option value="${search}">`).join("");
    }

    function normalizeCountry(country) {
      if (!country) return "";
      const countryMap = {
        ukraine: "Ukraine", italy: "Italy", german: "Germany", germany: "Germany",
        france: "France", spain: "Spain", usa: "United States", "united states": "United States",
        uk: "United Kingdom", "united kingdom": "United Kingdom", netherlands: "Netherlands",
        canada: "Canada", australia: "Australia", switzerland: "Switzerland", belgium: "Belgium",
        poland: "Poland", austria: "Austria", sweden: "Sweden", norway: "Norway",
        denmark: "Denmark", japan: "Japan", "south korea": "South Korea", "new zealand": "New Zealand"
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

    function resetStationInfo() {
      const stationName = currentStationInfo.querySelector(".station-name");
      const stationGenre = currentStationInfo.querySelector(".station-genre");
      const stationCountry = currentStationInfo.querySelector(".station-country");
      const stationIcon = currentStationInfo.querySelector(".station-icon");
      if (stationName) stationName.textContent = "Обирайте станцію";
      if (stationGenre) stationGenre.textContent = "жанр: -";
      if (stationCountry) stationCountry.textContent = "країна: -";
      if (stationIcon) {
        stationIcon.innerHTML = `<svg class="icon"><use href="/icons.svg#radio"></use></svg>`;
        stationIcon.style.backgroundImage = "none";
      }
    }

    async function loadStations() {
      console.time("loadStations");
      stationList.innerHTML = "<div class='station-item empty'>Завантаження...</div>";
      try {
        abortController.abort();
        abortController = new AbortController();
        const response = await fetch(`stations.json?t=${Date.now()}`, {
          cache: "no-store",
          signal: abortController.signal
        });
        if (response.ok) {
          const newStations = await response.json();
          const mergedStationLists = {};
          Object.keys(newStations).forEach(tab => {
            mergedStationLists[tab] = [
              ...(userAddedStations[tab] || []).filter(s => !deletedStations.includes(s.name)),
              ...newStations[tab].filter(s => !deletedStations.includes(s.name))
            ];
          });
          customTabs.forEach(tab => {
            if (!mergedStationLists[tab.id]) {
              mergedStationLists[tab.id] = userAddedStations[tab.id] || [];
            }
          });
          stationLists = mergedStationLists;
          localStorage.setItem("stationLists", JSON.stringify(stationLists));
        } else if (Object.keys(stationLists).length) {
          console.warn("Using cached stationLists");
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
          console.error("Load stations error:", error);
          stationList.innerHTML = "<div class='station-item empty'>Не вдалося завантажити станції</div>";
        }
      } finally {
        console.timeEnd("loadStations");
      }
    }

    async function searchStations(query, country, genre) {
      stationList.innerHTML = "<div class='station-item empty'>Пошук...</div>";
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
        const url = `https://de1.api.radio-browser.info/json/stations/search?${params.toString()}`;
        const response = await fetch(url, { signal: abortController.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        let stations = await response.json();
        stations = stations.filter(station => station.url_resolved && isValidUrl(station.url_resolved));
        renderSearchResults(stations);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error("Search error:", error);
          stationList.innerHTML = "<div class='station-item empty'>Не вдалося знайти станції</div>";
        }
      }
    }

    function renderSearchResults(stations) {
      if (!stations.length) {
        stationList.innerHTML = "<div class='station-item empty'>Нічого не знайдено</div>";
        stationItems = [];
        return;
      }
      const fragment = document.createDocumentFragment();
      stations.forEach((station, index) => {
        const item = document.createElement("div");
        item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
        item.dataset.value = station.url || station.url_resolved;
        item.dataset.name = station.name || "Unknown";
        item.dataset.genre = shortenGenre(station.tags || "Unknown");
        item.dataset.country = station.country || "Unknown";
        item.dataset.favicon = station.favicon && isValidUrl(station.favicon) ? station.favicon : "";
        const iconHtml = item.dataset.favicon ? `<img src="${item.dataset.favicon}" alt="${station.name} icon" onerror="this.outerHTML='<svg class=\\'icon\\'><use href=\\'/icons.svg#radio\\'></use></svg>'">` : `<svg class="icon"><use href="/icons.svg#radio"></use></svg>`;
        item.innerHTML = `${iconHtml}<span class="station-name">${station.name}</span><button class="add-btn">ADD</button>`;
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
      const tabs = [...Object.keys(stationLists).filter(tab => !["best", "search"].includes(tab)), ...customTabs.map(t => t.id)];
      modal.innerHTML = `
        <h2>Оберіть вкладку</h2>
        <div class="modal-tabs">
          ${tabs.map(tab => `<button class="modal-tab-btn" data-tab="${tab}">${tab.charAt(0).toUpperCase() + tab.slice(1)}</button>`).join("")}
          <button class="modal-cancel-btn">Відміна</button>
        </div>
      `;
      document.body.appendChild(overlay);
      document.body.appendChild(modal);
      const closeModal = () => {
        overlay.remove();
        modal.remove();
      };
      overlay.addEventListener("click", closeModal);
      modal.querySelectorAll(".modal-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          saveStation(item, btn.dataset.tab);
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
          favicon: item.dataset.favicon || ""
        };
        stationLists[targetTab].unshift(newStation);
        userAddedStations[targetTab].unshift(newStation);
        localStorage.setItem("stationLists", JSON.stringify(stationLists));
        localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
        if (currentTab !== "search") updateStationList();
      } else {
        alert("Ця станція вже додана!");
      }
    }

    const themes = {
      "cyberwave": {
        bodyBg: "#0D1B2A",
        containerBg: "#1B263B",
        accent: "#00D4FF",
        text: "#F5F7FA",
        accentGradient: "linear-gradient(45deg, #1B263B, #00D4FF)"
      },
      "velvet-dusk": {
        bodyBg: "#1A0B2E",
        containerBg: "#311B92",
        accent: "#D81B60",
        text: "#E8EAF6",
        accentGradient: "linear-gradient(45deg, #311B92, #D81B60)"
      },
      "solar-flare": {
        bodyBg: "#F5F6F5",
        containerBg: "#FFFFFF",
        accent: "#FF5722",
        text: "#212121",
        accentGradient: "linear-gradient(45deg, #FFAB40, #FF5722)"
      },
      "emerald-pulse": {
        bodyBg: "#0A2A1B",
        containerBg: "#1A3C34",
        accent: "#26A69A",
        text: "#B2DFDB",
        accentGradient: "linear-gradient(45deg, #1A3C34, #26A69A)"
      },
      "stellar-void": {
        bodyBg: "#000000",
        containerBg: "#4A148C",
        accent: "#AB47BC",
        text: "#FFFFFF",
        accentGradient: "linear-gradient(45deg, #4A148C, #AB47BC)"
      }
    };
    let currentTheme = localStorage.getItem("selectedTheme") || "cyberwave";

    function applyTheme(theme) {
      const root = document.documentElement;
      Object.entries(themes[theme]).forEach(([key, value]) => {
        root.style.setProperty(`--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`, value);
      });
      localStorage.setItem("selectedTheme", theme);
      currentTheme = theme;
      document.documentElement.setAttribute("data-theme", theme);
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) themeColorMeta.setAttribute("content", themes[theme].accent);
    }

    function toggleTheme() {
      const themesOrder = ["cyberwave", "velvet-dusk", "solar-flare", "emerald-pulse", "stellar-void"];
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
                if (window.confirm("Нова версія доступна. Оновити?")) {
                  window.location.reload();
                }
              }
            });
          }
        });
      });

      navigator.serviceWorker.addEventListener("message", (event) => {
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
        if (event.data.type === "NETWORK_STATUS" && event.data.online && isPlaying && stationItems?.length && currentIndex < stationItems.length) {
          audio.pause();
          audio.src = "";
          audio.src = stationItems[currentIndex].dataset.value;
          tryAutoPlay();
        }
      });
    }

    function tryAutoPlay() {
      if (!navigator.onLine || !isPlaying || !stationItems?.length || currentIndex >= stationItems.length) {
        document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
        return;
      }
      if (audio.src === stationItems[currentIndex].dataset.value && !audio.paused) return;
      if (!isValidUrl(stationItems[currentIndex].dataset.value)) {
        errorCount++;
        if (errorCount >= ERROR_LIMIT) console.error("Error limit reached");
        document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
        return;
      }
      audio.pause();
      audio.src = "";
      audio.src = stationItems[currentIndex].dataset.value;
      const playPromise = audio.play();
      playPromise.then(() => {
        errorCount = 0;
        document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
      }).catch(error => {
        if (error.name !== "AbortError") {
          errorCount++;
          if (errorCount >= ERROR_LIMIT) console.error("Error limit reached");
        }
        document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      });
    }

    function switchTab(tab) {
      if (![...Object.keys(stationLists), "best", "search"].includes(tab)) tab = "techno";
      currentTab = tab;
      localStorage.setItem("currentTab", tab);
      const savedIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
      const maxIndex = tab === "best" ? favoriteStations.length : tab === "search" ? 0 : stationLists[tab]?.length || 0;
      currentIndex = savedIndex < maxIndex ? savedIndex : 0;
      searchInput.style.display = tab === "search" ? "flex" : "none";
      searchQuery.value = "";
      searchCountry.value = "";
      searchGenre.value = "";
      if (tab === "search") populateSearchSuggestions();
      updateStationList();
      renderTabs();
      if (stationItems?.length && currentIndex < stationItems.length) tryAutoPlay();
    }

    function updateStationList() {
      let stations = currentTab === "best"
        ? favoriteStations.map(name => Object.values(stationLists).flat().find(s => s.name === name)).filter(s => s)
        : stationLists[currentTab] || [];
      if (!stations.length) {
        currentIndex = 0;
        stationItems = [];
        stationList.innerHTML = `<div class="station-item empty">${currentTab === "best" ? "Немає улюблених станцій" : "Немає станцій"}</div>`;
        return;
      }
      const fragment = document.createDocumentFragment();
      stations.forEach((station, index) => {
        const item = document.createElement("div");
        item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
        item.dataset.value = station.value;
        item.dataset.name = station.name;
        item.dataset.genre = shortenGenre(station.genre);
        item.dataset.country = station.country;
        item.dataset.favicon = station.favicon && isValidUrl(station.favicon) ? station.favicon : "";
        const iconHtml = item.dataset.favicon ? `<img src="${item.dataset.favicon}" alt="${station.name} icon" onerror="this.outerHTML='<svg class=\\'icon\\'><use href=\\'/icons.svg#radio\\'></use></svg>'">` : `<svg class="icon"><use href="/icons.svg#radio"></use></svg>`;
        const deleteButton = !["best", "search"].includes(currentTab) ? `<button class="delete-btn">🗑</button>` : "";
        item.innerHTML = `
          ${iconHtml}
          <span class="station-name">${station.name}</span>
          <div class="buttons-container">
            ${deleteButton}
            <button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}">★</button>
          </div>`;
        fragment.appendChild(item);
      });
      stationList.innerHTML = "";
      stationList.appendChild(fragment);
      stationItems = stationList.querySelectorAll(".station-item");
      if (stationItems.length && stationItems[currentIndex] && !stationItems[currentIndex].classList.contains("empty")) {
        stationItems[currentIndex].scrollIntoView({ behavior: "smooth", block: "center" });
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
          toggleFavorite(item.dataset.name);
        }
        if (deleteBtn) {
          e.stopPropagation();
          if (confirm(`Видалити "${item.dataset.name}"?`)) deleteStation(item.dataset.name);
        }
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

    function deleteStation(stationName) {
      if (Array.isArray(stationLists[currentTab])) {
        stationLists[currentTab] = stationLists[currentTab].filter(s => s.name !== stationName);
        userAddedStations[currentTab] = userAddedStations[currentTab]?.filter(s => s.name !== stationName) || [];
      }
      favoriteStations = favoriteStations.filter(name => name !== stationName);
      if (!Array.isArray(deletedStations)) deletedStations = [];
      deletedStations.push(stationName);
      localStorage.setItem("stationLists", JSON.stringify(stationLists));
      localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
      localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
      localStorage.setItem("deletedStations", JSON.stringify(deletedStations));
      if (stationLists[currentTab].length === 0) currentIndex = 0;
      else if (currentIndex >= stationLists[currentTab].length) currentIndex = stationLists[currentTab].length - 1;
      switchTab(currentTab);
    }

    function changeStation(index) {
      if (!stationItems || index < 0 || index >= stationItems.length || stationItems[index].classList.contains("empty")) return;
      const item = stationItems[index];
      stationItems.forEach(i => i.classList.remove("selected"));
      item.classList.add("selected");
      currentIndex = index;
      updateCurrentStation(item);
      localStorage.setItem(`lastStation_${currentTab}`, index);
      tryAutoPlay();
    }

    function updateCurrentStation(item) {
      const stationName = currentStationInfo.querySelector(".station-name");
      const stationGenre = currentStationInfo.querySelector(".station-genre");
      const stationCountry = currentStationInfo.querySelector(".station-country");
      const stationIcon = currentStationInfo.querySelector(".station-icon");
      if (stationName) stationName.textContent = item.dataset.name || "";
      if (stationGenre) stationGenre.textContent = `жанр: ${item.dataset.genre || ""}`;
      if (stationCountry) stationCountry.textContent = `країна: ${item.dataset.country || ""}`;
      if (stationIcon) {
        if (item.dataset.favicon && isValidUrl(item.dataset.favicon)) {
          stationIcon.innerHTML = "";
          stationIcon.style.backgroundImage = `url(${item.dataset.favicon})`;
        } else {
          stationIcon.innerHTML = `<svg class="icon"><use href="/icons.svg#radio"></use></svg>`;
          stationIcon.style.backgroundImage = "none";
        }
      }
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: item.dataset.name || "Unknown Station",
          artist: `${item.dataset.genre || ""} | ${item.dataset.country || ""}`,
          album: "Radio S O"
        });
      }
    }

    function prevStation() {
      if (!stationItems?.length) return;
      currentIndex = currentIndex > 0 ? currentIndex - 1 : stationItems.length - 1;
      if (stationItems[currentIndex].classList.contains("empty")) currentIndex = 0;
      changeStation(currentIndex);
    }

    function nextStation() {
      if (!stationItems?.length) return;
      currentIndex = currentIndex < stationItems.length - 1 ? currentIndex + 1 : 0;
      if (stationItems[currentIndex].classList.contains("empty")) currentIndex = 0;
      changeStation(currentIndex);
    }

    function togglePlayPause() {
      if (audio.paused) {
        isPlaying = true;
        tryAutoPlay();
        playPauseBtn.innerHTML = `<svg class="icon"><use href="/icons.svg#pause"></use></svg>`;
        document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
        if (navigator.vibrate) navigator.vibrate(50);
      } else {
        audio.pause();
        isPlaying = false;
        playPauseBtn.innerHTML = `<svg class="icon"><use href="/icons.svg#play"></use></svg>`;
        document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
        if (navigator.vibrate) navigator.vibrate(50);
      }
      localStorage.setItem("isPlaying", isPlaying);
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
          audio.src = "";
          audio.src = stationItems[currentIndex]?.dataset.value || "";
          tryAutoPlay();
        }
      },
      resume: () => {
        if (isPlaying && navigator.connection?.type !== "none") {
          if (!audio.paused) return;
          audio.pause();
          audio.src = "";
          audio.src = stationItems[currentIndex]?.dataset.value || "";
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
      playPauseBtn.innerHTML = `<svg class="icon"><use href="/icons.svg#pause"></use></svg>`;
      document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
      localStorage.setItem("isPlaying", isPlaying);
    });

    audio.addEventListener("pause", () => {
      isPlaying = false;
      playPauseBtn.innerHTML = `<svg class="icon"><use href="/icons.svg#play"></use></svg>`;
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      localStorage.setItem("isPlaying", isPlaying);
      if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
    });

    audio.addEventListener("error", () => {
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      console.error("Audio error:", audio.error?.message || "Unknown error", "URL:", audio.src);
      if (isPlaying && errorCount < ERROR_LIMIT) {
        errorCount++;
        setTimeout(nextStation, 1000);
      }
    });

    audio.addEventListener("volumechange", () => {
      localStorage.setItem("volume", audio.volume);
    });

    window.addEventListener("online", () => {
      if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
        audio.pause();
        audio.src = "";
        audio.src = stationItems[currentIndex].dataset.value;
        tryAutoPlay();
      }
    });

    window.addEventListener("offline", () => {
      console.log("Network lost");
    });

    addEventListeners();
    window.addEventListener("beforeunload", removeEventListeners);

    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", togglePlayPause);
      navigator.mediaSession.setActionHandler("pause", togglePlayPause);
      navigator.mediaSession.setActionHandler("previoustrack", prevStation);
      navigator.mediaSession.setActionHandler("nexttrack", nextStation);
    }

    applyTheme(currentTheme);
    loadStations();
  }
});