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
  const audio = document.getElementById("player");
  const stationList = document.querySelector(".station-list");
  const playPauseBtn = document.querySelector("#playPauseBtn");
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
  const tabsContainer = document.querySelector(".tabs");

  if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle || !shareButton || !exportButton || !importButton || !importFileInput || !searchInput || !searchQuery || !searchCountry || !searchGenre || !searchBtn || !tabsContainer) {
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
      tabsContainer: !!tabsContainer
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
    setupSwipeGestures();

    shareButton.addEventListener("click", () => {
      const stationName = currentStationInfo.querySelector(".station-name").textContent || "Radio Music";
      const shareData = {
        title: "Radio Music",
        text: `Слухаю ${stationName} на Radio Music! Приєднуйся до моїх улюблених радіостанцій!`,
        url: window.location.href
      };
      if (navigator.share) {
        navigator.share(shareData)
          .catch(error => console.error("Помилка поширення:", error));
      } else {
        alert(`Функція поширення не підтримується. Скопіюйте: ${shareData.text} ${shareData.url}`);
      }
    });

    exportButton.addEventListener("click", exportSettings);
    importButton.addEventListener("click", () => importFileInput.click());
    importFileInput.addEventListener("change", importSettings);

    document.querySelector("#prevBtn").addEventListener("click", prevStation);
    document.querySelector("#playPauseBtn").addEventListener("click", togglePlayPause);
    document.querySelector("#nextBtn").addEventListener("click", nextStation);

    searchBtn.addEventListener("click", () => {
      const query = searchQuery.value.trim();
      const country = normalizeCountry(searchCountry.value.trim());
      const genre = searchGenre.value.trim().toLowerCase();
      console.log("Пошук:", { query, country, genre });
      if (query || country || genre) {
        if (query && !pastSearches.includes(query)) {
          pastSearches.unshift(query);
          if (pastSearches.length > 5) pastSearches.pop();
          localStorage.setItem("pastSearches", JSON.stringify(pastSearches));
          updatePastSearches();
        }
        searchStations(query, country, genre);
      } else {
        console.warn("Усі поля пошуку порожні");
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

    // Додавання обробників для кнопок очищення пошуку
    document.querySelectorAll(".search-clear").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const input = e.target.previousElementSibling;
        input.value = "";
        input.focus();
        updateClearButtonVisibility();
      });
    });

    [searchQuery, searchCountry, searchGenre].forEach(input => {
      input.addEventListener("input", updateClearButtonVisibility);
    });

    function updateClearButtonVisibility() {
      [searchQuery, searchCountry, searchGenre].forEach(input => {
        const clearBtn = input.nextElementSibling;
        clearBtn.style.display = input.value.trim() ? "block" : "none";
      });
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
      console.log("Налаштування експортовано:", settings);
    }

    function importSettings(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const settings = JSON.parse(e.target.result);
          if (!settings || typeof settings !== "object") {
            alert("Невірний файл налаштувань!");
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

      const countryDatalist = document.getElementById("countrySuggestions");
      const genreDatalist = document.getElementById("genreSuggestions");
      const queryDatalist = document.getElementById("querySuggestions");

      countryDatalist.innerHTML = suggestedCountries.map(country => `<option value="${country}">`).join("");
      genreDatalist.innerHTML = suggestedGenres.map(genre => `<option value="${genre}">`).join("");
      queryDatalist.innerHTML = pastSearches.map(search => `<option value="${search}">`).join("");
    }

    function updatePastSearches() {
      const queryDatalist = document.getElementById("querySuggestions");
      queryDatalist.innerHTML = pastSearches.map(search => `<option value="${search}">`).join("");
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
      if (stationNameElement) stationNameElement.textContent = "Обирайте станцію";
      else console.error(".station-name element not found");
      if (stationGenreElement) stationGenreElement.textContent = "жанр: -";
      else console.error(".station-genre element not found");
      if (stationCountryElement) stationCountryElement.textContent = "країна: -";
      else console.error(".station-country element not found");
      if (stationIconElement) {
        stationIconElement.innerHTML = '<span class="material-symbols-rounded">music_note</span>';
        stationIconElement.style.backgroundImage = "none";
        stationIconElement.classList.remove("playing");
      } else console.error(".station-icon element not found");
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
        console.log(`Response status: ${response.status}`);
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
            console.log(`Added to ${tab}:`, mergedStationLists[tab].map(s => s.name));
          });
        } else {
          console.warn("Не вдалося завантажити stations.json, використовуємо кешовані дані");
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
          console.log(`Saved for custom tab ${tab}:`, mergedStationLists[tab].map(s => s.name));
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
          console.error("Помилка завантаження станцій:", error);
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
            stationLists[tab] = Array.from(uniqueStations.values());
          });
          localStorage.setItem("stationLists", JSON.stringify(stationLists));
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
        console.log("API request:", url);
        const response = await fetch(url, {
          signal: abortController.signal
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        let stations = await response.json();
        stations = stations.filter(station => station.url_resolved && isValidUrl(station.url_resolved));
        console.log("Received stations (after HTTPS filter):", stations.length);
        renderSearchResults(stations);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error("Помилка пошуку станцій:", error);
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
        const iconHtml = item.dataset.favicon ? 
          `<img src="${item.dataset.favicon}" alt="${station.name} icon" onerror="this.outerHTML='<span class=\\"material-symbols-rounded\\">music_note</span>'; console.warn('Error loading favicon:', '${item.dataset.favicon}');">` : 
          '<span class="material-symbols-rounded">music_note</span>';
        item.innerHTML = `
          ${iconHtml}
          <span class="station-name">${station.name}</span>
          <div class="buttons-container">
            <button class="add-btn"><span class="material-symbols-rounded">add</span></button>
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
        <h2>Обрати вкладку</h2>
        <div class="modal-tabs">
          <button class="modal-tab-btn" data-tab="techno">TECHNO</button>
          <button class="modal-tab-btn" data-tab="trance">TRANCE</button>
          <button class="modal-tab-btn" data-tab="ukraine">UA</button>
          <button class="modal-tab-btn" data-tab="pop">POP</button>
          ${customTabs.map(tab => `<button class="modal-tab-btn" data-tab="${tab}">${tab.toUpperCase()}</button>`).join('')}
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
        console.log(`Додано станцію ${stationName} до ${targetTab}:`, newStation);
        if (currentTab !== "search") {
          updateStationList();
        }
      } else {
        alert("Ця станція вже додана до обраної вкладки!");
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
      addBtn.innerHTML = '<span class="material-symbols-rounded">add</span>';
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
      const createBtn = modal.querySelector(".modal-tab-btn");
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
          alert("Введіть назву вкладки!");
          return;
        }
        if (["best", "techno", "trance", "ukraine", "pop", "search"].includes(tabName) || customTabs.includes(tabName)) {
          alert("Ця назва вкладки вже існує!");
          return;
        }
        if (tabName.length > 10 || !/^[a-z0-9_-]+$/.test(tabName)) {
          alert("Назва вкладки не може перевищувати 10 символів і має містити лише латинські літери, цифри, дефіс або підкреслення.");
          return;
        }
        if (customTabs.length >= 7) {
          alert("Досягнуто максимум 7 кастомних вкладок!");
          return;
        }
        customTabs.push(tabName);
        stationLists[tabName] = [];
        userAddedStations[tabName] = [];
        localStorage.setItem("customTabs", JSON.stringify(customTabs));
        localStorage.setItem("stationLists", JSON.stringify(stationLists));
        localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
        console.log(`Створено нову вкладку ${tabName}`);
        renderTabs();
        switchTab(tabName);
        closeModal();
      };

      const keypressHandler = (e) => {
        if (e.key === "Enter") createBtn.click();
      };

      createBtn.addEventListener("click", createTabHandler);
      cancelBtn.addEventListener("click", closeModal);
      overlay.addEventListener("click", closeModal);
      input.addEventListener("keypress", keypressHandler);
    }

    function showEditTabModal(tab) {
      const overlay = document.querySelector(".edit-tab-modal");
      const modal = overlay.querySelector(".modal");
      const input = document.getElementById("editTabName");
      const renameBtn = modal.querySelector(".modal-tab-btn.rename");
      const deleteBtn = modal.querySelector(".modal-tab-btn.delete");
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
          alert("Введіть нову назву вкладки!");
          return;
        }
        if (["best", "techno", "trance", "ukraine", "pop", "search"].includes(newName) || customTabs.includes(newName)) {
          alert("Ця назва вкладки вже існує!");
          return;
        }
        if (newName.length > 10 || !/^[a-z0-9_-]+$/.test(newName)) {
          alert("Назва вкладки не може перевищувати 10 символів і має містити лише латинські літери, цифри, дефіс або підкреслення!");
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
        if (confirm(`Ви впевнені, що хочете видалити вкладку "${tab.toUpperCase()}"?`)) {
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

      const keypressHandler = (e) => {
        if (e.key === "Enter") renameBtn.click();
      };

      renameBtn.addEventListener("click", renameTabHandler);
      deleteBtn.addEventListener("click", deleteTabHandler);
      cancelBtn.addEventListener("click", closeModal);
      overlay.addEventListener("click", closeModal);
      input.addEventListener("keypress", keypressHandler);
    }

    const themes = {
      "shadow-pulse": {
        bodyBg: "linear-gradient(180deg, #0A0E17 0%, #1E2A44 100%)",
        containerBg: "rgba(30, 42, 68, 0.8)",
        accent: "#00DDEB",
        secondaryAccent: "#FF00E6",
        tertiaryAccent: "#00FFAA",
        text: "#E0E0E0",
        highlightText: "#FFFFFF",
        accentGradient: "linear-gradient(45deg, #00A3B5, #00DDEB)",
        shadow: "rgba(0, 221, 235, 0.4)"
      },
      "dark-abyss": {
        bodyBg: "linear-gradient(180deg, #0A0E17 0%, #1E2A44 100%)",
        containerBg: "rgba(30, 42, 68, 0.8)",
        accent: "#FF00E6",
        secondaryAccent: "#00DDEB",
        tertiaryAccent: "#00FFAA",
        text: "#E0E0E0",
        highlightText: "#FFFFFF",
        accentGradient: "linear-gradient(45deg, #B300A3, #FF00E6)",
        shadow: "rgba(255, 0, 230, 0.4)"
      },
      "emerald-glow": {
        bodyBg: "linear-gradient(180deg, #0A0E17 0%, #1E2A44 100%)",
        containerBg: "rgba(30, 42, 68, 0.8)",
        accent: "#00FFAA",
        secondaryAccent: "#00DDEB",
        tertiaryAccent: "#FF00E6",
        text: "#E0E0E0",
        highlightText: "#FFFFFF",
        accentGradient: "linear-gradient(45deg, #00B266, #00FFAA)",
        shadow: "rgba(0, 255, 170, 0.4)"
      },
      "retro-wave": {
        bodyBg: "linear-gradient(180deg, #0A0E17 0%, #1E2A44 100%)",
        containerBg: "rgba(30, 42, 68, 0.8)",
        accent: "#FF00E6",
        secondaryAccent: "#00DDEB",
        tertiaryAccent: "#00FFAA",
        text: "#E0E0E0",
        highlightText: "#FFFFFF",
        accentGradient: "linear-gradient(45deg, #C71585, #FF00E6)",
        shadow: "rgba(255, 0, 230, 0.4)"
      },
      "neon-pulse": {
        bodyBg: "linear-gradient(180deg, #0A0E17 0%, #1E2A44 100%)",
        containerBg: "rgba(30, 42, 68, 0.8)",
        accent: "#00DDEB",
        secondaryAccent: "#FF00E6",
        tertiaryAccent: "#00FFAA",
        text: "#E0E0E0",
        highlightText: "#FFFFFF",
        accentGradient: "linear-gradient(45deg, #0077B6, #00DDEB)",
        shadow: "rgba(0, 221, 235, 0.4)"
      },
      "lime-surge": {
        bodyBg: "linear-gradient(180deg, #0A0E17 0%, #1E2A44 100%)",
        containerBg: "rgba(30, 42, 68, 0.8)",
        accent: "#00FFAA",
        secondaryAccent: "#00DDEB",
        tertiaryAccent: "#FF00E6",
        text: "#E0E0E0",
        highlightText: "#FFFFFF",
        accentGradient: "linear-gradient(45deg, #00B266, #00FFAA)",
        shadow: "rgba(0, 255, 170, 0.4)"
      },
      "flamingo-flash": {
        bodyBg: "linear-gradient(180deg, #0A0E17 0%, #1E2A44 100%)",
        containerBg: "rgba(30, 42, 68, 0.8)",
        accent: "#FF00E6",
        secondaryAccent: "#00DDEB",
        tertiaryAccent: "#00FFAA",
        text: "#E0E0E0",
        highlightText: "#FFFFFF",
        accentGradient: "linear-gradient(45deg, #C71585, #FF00E6)",
        shadow: "rgba(255, 0, 230, 0.4)"
      },
      "aqua-glow": {
        bodyBg: "linear-gradient(180deg, #0A0E17 0%, #1E2A44 100%)",
        containerBg: "rgba(30, 42, 68, 0.8)",
        accent: "#00DDEB",
        secondaryAccent: "#FF00E6",
        tertiaryAccent: "#00FFAA",
        text: "#E0E0E0",
        highlightText: "#FFFFFF",
        accentGradient: "linear-gradient(45deg, #0077B6, #00DDEB)",
        shadow: "rgba(0, 221, 235, 0.4)"
      },
      "aurora-haze": {
        bodyBg: "linear-gradient(180deg, #0A0E17 0%, #1E2A44 100%)",
        containerBg: "rgba(30, 42, 68, 0.8)",
        accent: "#00FFAA",
        secondaryAccent: "#00DDEB",
        tertiaryAccent: "#FF00E6",
        text: "#E0E0E0",
        highlightText: "#FFFFFF",
        accentGradient: "linear-gradient(45deg, #00B266, #00FFAA)",
        shadow: "rgba(0, 255, 170, 0.4)"
      },
      "starlit-amethyst": {
        bodyBg: "linear-gradient(180deg, #0A0E17 0%, #1E2A44 100%)",
        containerBg: "rgba(30, 42, 68, 0.8)",
        accent: "#FF00E6",
        secondaryAccent: "#00DDEB",
        tertiaryAccent: "#00FFAA",
        text: "#E0E0E0",
        highlightText: "#FFFFFF",
        accentGradient: "linear-gradient(45deg, #B300A3, #FF00E6)",
        shadow: "rgba(255, 0, 230, 0.4)"
      },
      "lunar-frost": {
        bodyBg: "linear-gradient(180deg, #0A0E17 0%, #1E2A44 100%)",
        containerBg: "rgba(30, 42, 68, 0.8)",
        accent: "#00DDEB",
        secondaryAccent: "#FF00E6",
        tertiaryAccent: "#00FFAA",
        text: "#E0E0E0",
        highlightText: "#FFFFFF",
        accentGradient: "linear-gradient(45deg, #0077B6, #00DDEB)",
        shadow: "rgba(0, 221, 235, 0.4)"
      }
    };
    let currentTheme = localStorage.getItem("selectedTheme") || "shadow-pulse";
    if (!themes[currentTheme]) {
      currentTheme = "shadow-pulse";
      localStorage.setItem("selectedTheme", currentTheme);
    }

    function applyTheme(theme) {
      if (!themes[theme]) {
        console.warn(`Тема ${theme} не знайдена, використовуємо 'shadow-pulse'`);
        theme = "shadow-pulse";
        localStorage.setItem("selectedTheme", theme);
      }
      const root = document.documentElement;
      root.style.setProperty("--body-bg", themes[theme].bodyBg);
      root.style.setProperty("--container-bg", themes[theme].containerBg);
      root.style.setProperty("--accent", themes[theme].accent);
      root.style.setProperty("--secondary-accent", themes[theme].secondaryAccent);
      root.style.setProperty("--tertiary-accent", themes[theme].tertiaryAccent);
      root.style.setProperty("--text", themes[theme].text);
      root.style.setProperty("--highlight-text", themes[theme].highlightText);
      root.style.setProperty("--accent-gradient", themes[theme].accentGradient);
      root.style.setProperty("--shadow", themes[theme].shadow);
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
        "shadow-pulse", "dark-abyss", "emerald-glow", "retro-wave",
        "neon-pulse", "lime-surge", "flamingo-flash", "aqua-glow",
        "aurora-haze", "starlit-amethyst", "lunar-frost"
      ];
      const nextTheme = themesOrder[(themesOrder.indexOf(currentTheme) + 1) % themesOrder.length];
      applyTheme(nextTheme);
    }

    themeToggle.addEventListener("click", toggleTheme);

    function setupSwipeGestures() {
      let touchStartX = 0;
      let touchStartY = 0;
      let touchEndX = 0;
      let touchEndY = 0;
      const minSwipeDistance = 50;

      stationList.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      });

      stationList.addEventListener("touchend", (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
      });

      tabsContainer.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      });

      tabsContainer.addEventListener("touchend", (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleTabSwipe();
      });

      function handleSwipe() {
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
          if (deltaX > 0) {
            prevStation();
          } else {
            nextStation();
          }
        }
      }

      function handleTabSwipe() {
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
          const tabs = ["best", "techno", "trance", "ukraine", "pop", "search", ...customTabs];
          const currentTabIndex = tabs.indexOf(currentTab);
          if (deltaX > 0 && currentTabIndex > 0) {
            switchTab(tabs[currentTabIndex - 1]);
          } else if (deltaX < 0 && currentTabIndex < tabs.length - 1) {
            switchTab(tabs[currentTabIndex + 1]);
          }
        }
      }
    }

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

      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data.type === "CACHE_UPDATED") {
          console.log("Отримано оновлення кешу, оновлюємо stationLists");
          const currentCacheVersion = localStorage.getItem("cacheVersion") || "0";
          if (currentCacheVersion !== event.data.cacheVersion) {
            favoriteStations = favoriteStations.filter((name) =>
              Object.values(stationLists).flat().some((s) => s.name === name)
            );
            localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
            localStorage.setItem("cacheVersion", event.data.cacheVersion);
            loadStations();
          }
        }
        if (event.data.type === "NETWORK_STATUS" && event.data.online && intendedPlaying && stationItems?.length && currentIndex < stationItems.length) {
          console.log("Мережу відновлено (SW), намагаємося відтворити");
          debouncedTryAutoPlay();
        }
      });
    }

    let autoPlayTimeout = null;
    function debouncedTryAutoPlay(retryCount = 2, delay = 1000) {
      if (isAutoPlayPending) {
        console.log("debouncedTryAutoPlay: Пропускаємо, попередній tryAutoPlay ще активний");
        return;
      }
      const now = Date.now();
      const currentStationUrl = stationItems?.[currentIndex]?.dataset?.value;
      const normalizedCurrentUrl = normalizeUrl(currentStationUrl);
      const normalizedAudioSrc = normalizeUrl(audio.src);
      if (now - lastSuccessfulPlayTime < 500 && normalizedAudioSrc === normalizedCurrentUrl) {
        console.log("debouncedTryAutoPlay: Пропускаємо, нещодавно відтворювалося успішно для тієї ж станції");
        return;
      }
      if (autoPlayTimeout) {
        clearTimeout(autoPlayTimeout);
      }
      autoPlayRequestId++;
      const currentRequestId = autoPlayRequestId;
      autoPlayTimeout = setTimeout(() => tryAutoPlay(retryCount, delay, currentRequestId), 0);
    }

    async function tryAutoPlay(retryCount = 2, delay = 1000, requestId) {
      if (isAutoPlayPending) {
        console.log("tryAutoPlay: Пропускаємо, інший tryAutoPlay активний");
        return;
      }
      if (requestId !== autoPlayRequestId) {
        console.log("tryAutoPlay: Пропускаємо, застарілий ID запиту", { requestId, current: autoPlayRequestId });
        return;
      }
      isAutoPlayPending = true;

      try {
        if (!navigator.onLine) {
          console.log("Пристрій офлайн: пропускаємо відтворення");
          return;
        }
        if (!intendedPlaying || !stationItems?.length || currentIndex >= stationItems.length) {
          console.log("Пропускаємо tryAutoPlay: некоректний стан", { intendedPlaying, hasStationItems: !!stationItems?.length, isIndexValid: currentIndex < stationItems.length });
          document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
          currentStationInfo.querySelector(".station-icon").classList.remove("playing");
          return;
        }
        const currentStationUrl = stationItems[currentIndex].dataset.value;
        const initialStationUrl = currentStationUrl;
        const normalizedCurrentUrl = normalizeUrl(currentStationUrl);
        const normalizedAudioSrc = normalizeUrl(audio.src);
        if (normalizedAudioSrc === normalizedCurrentUrl && !audio.paused && !audio.error && audio.readyState >= 2 && audio.currentTime > 0) {
          console.log("Пропускаємо tryAutoPlay: аудіо вже відтворюється з коректним src, без помилок і активним потоком");
          return;
        }
        if (!isValidUrl(currentStationUrl)) {
          console.error("Невірна URL:", currentStationUrl);
          errorCount++;
          if (errorCount >= ERROR_LIMIT) {
            console.error("Досягнуто ліміт помилок відтворення");
            resetStationInfo();
          }
          return;
        }

        const attemptPlay = async (attemptsLeft) => {
          if (streamAbortController) {
            streamAbortController.abort();
            console.log("Попередній аудіопотік скасовано");
            streamAbortController = null;
          }
          if (stationItems[currentIndex].dataset.value !== initialStationUrl) {
            console.log("tryAutoPlay: Станцію змінено, скасовуємо відтворення для", initialStationUrl);
            return;
          }
          if (requestId !== autoPlayRequestId) {
            console.log("tryAutoPlay: Пропускаємо спробу, застарілий ID запиту", { requestId, current: autoPlayRequestId });
            return;
          }

          streamAbortController = new AbortController();
          audio.pause();
          audio.src = null;
          audio.load();
          audio.src = currentStationUrl + "?nocache=" + Date.now();
          console.log(`Спроба відтворення (${attemptsLeft} залишилося):`, audio.src);

          try {
            await audio.play();
            errorCount = 0;
            isPlaying = true;
            lastSuccessfulPlayTime = Date.now();
            console.log("Відтворення розпочато успішно");
            document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
            currentStationInfo.querySelector(".station-icon").classList.add("playing");
            localStorage.setItem("isPlaying", isPlaying);
            if (stationItems[currentIndex]) {
              updateCurrentStation(stationItems[currentIndex]);
            }
          } catch (error) {
            if (error.name === 'AbortError') {
              console.log("Запит потоку скасовано");
              return;
            }
            console.error("Помилка відтворення:", error);
            document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
            currentStationInfo.querySelector(".station-icon").classList.remove("playing");
            if (attemptsLeft > 1) {
              if (stationItems[currentIndex].dataset.value !== initialStationUrl) {
                console.log("tryAutoPlay: Станцію змінено під час повторної спроби, скасовуємо");
                return;
              }
              if (requestId !== autoPlayRequestId) {
                console.log("tryAutoPlay: Пропускаємо повторну спробу, застарілий ID запиту", { requestId, current: autoPlayRequestId });
                return;
              }
              console.log(`Повторна спроба через ${delay}мс`);
              await new Promise(resolve => setTimeout(resolve, delay));
              await attemptPlay(attemptsLeft - 1);
            } else {
              errorCount++;
              if (errorCount >= ERROR_LIMIT) {
                console.error("Досягнуто ліміт помилок відтворення");
                resetStationInfo();
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
      if (!validTabs.includes(tab)) {
        tab = "techno";
      }
      currentTab = tab;
      localStorage.setItem("currentTab", tab);
      const savedIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
      const maxIndex = tab === "best" ? favoriteStations.length - 1 : tab === "search" ? 0 : stationLists[tab]?.length - 1 || 0;
      currentIndex = savedIndex <= maxIndex && savedIndex >= 0 ? savedIndex : 0;
      searchInput.style.display = tab === "search" ? "flex" : "none";
      searchQuery.value = "";
      searchCountry.value = "";
      searchGenre.value = "";
      updateClearButtonVisibility();
      if (tab === "search") populateSearchSuggestions();
      updateStationList();
      renderTabs();
      if (stationItems?.length && currentIndex < stationItems.length && intendedPlaying) {
        const normalizedCurrentUrl = normalizeUrl(stationItems[currentIndex].dataset.value);
        const normalizedAudioSrc = normalizeUrl(audio.src);
        if (normalizedAudioSrc !== normalizedCurrentUrl || audio.paused || audio.error || audio.readyState < 2 || audio.currentTime === 0) {
          console.log("switchTab: Починаємо відтворення після зміни вкладки");
          isAutoPlayPending = false;
          debouncedTryAutoPlay();
        } else {
          console.log("switchTab: Пропускаємо відтворення, станція вже відтворюється");
        }
      } else {
        console.log("switchTab: Пропускаємо відтворення, некоректний стан");
      }
    }

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
        stationList.innerHTML = `<div class="station-item empty">${currentTab === "best" ? "Немає улюблених станцій" : "Немає станцій у цій категорії"}</div>`;
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
        item.dataset.index = index; // Додаємо індекс для анімації
        const iconHtml = station.favicon && isValidUrl(station.favicon) ? 
          `<img src="${station.favicon}" alt="${station.name} icon" onerror="this.outerHTML='<span class=\\"material-symbols-rounded\\">music_note</span>'; console.warn('Error loading favicon:', '${station.favicon}');">` : 
          '<span class="material-symbols-rounded">music_note</span>';
        const deleteButton = ["techno", "trance", "ukraine", "pop", ...customTabs].includes(currentTab)
          ? `<button class="delete-btn"><span class="material-symbols-rounded">delete</span></button>`
          : "";
        item.innerHTML = `
          ${iconHtml}
          <span class="station-name">${station.name}</span>
          <div class="buttons-container">
            ${deleteButton}
            <button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}"><span class="material-symbols-rounded">star</span></button>
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
          if (confirm(`Ви впевнені, що хочете видалити станцію "${item.dataset.name}" зі списку?`)) {
            deleteStation(item.dataset.name);
          }
        }
      };

      if (stationItems.length && currentIndex < stationItems.length) {
        changeStation(currentIndex);
      }
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
        const station = stationLists[currentTab].find(s => s.name === stationName);
        if (!station) {
          console.warn(`Станцію ${stationName} не знайдено в ${currentTab}`);
          return;
        }
        stationLists[currentTab] = stationLists[currentTab].filter(s => s.name !== stationName);
        userAddedStations[currentTab] = userAddedStations[currentTab]?.filter(s => s.name !== stationName) || [];
        if (!station.isFromSearch && !deletedStations.includes(stationName)) {
          if (!Array.isArray(deletedStations)) deletedStations = [];
          deletedStations.push(stationName);
          localStorage.setItem("deletedStations", JSON.stringify(deletedStations));
          console.log(`Додано ${stationName} до deletedStations:`, deletedStations);
        }
        localStorage.setItem("stationLists", JSON.stringify(stationLists));
        localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
        favoriteStations = favoriteStations.filter(name => name !== stationName);
        localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
        console.log(`Видалено станцію ${stationName} з ${currentTab}`);
        if (stationLists[currentTab].length === 0) {
          currentIndex = 0;
        } else if (currentIndex >= stationLists[currentTab].length) {
          currentIndex = stationLists[currentTab].length - 1;
        }
        switchTab(currentTab);
      }
    }

    function changeStation(index) {
      if (!stationItems || index < 0 || index >= stationItems.length || stationItems[index].classList.contains("empty")) return;
      const item = stationItems[index];
      stationItems.forEach(i => i.classList.remove("selected"));
      item.classList.add("selected");
      currentIndex = index;
      updateCurrentStation(item);
      localStorage.setItem(`lastStation_${currentTab}`, index);
      if (intendedPlaying) {
        const normalizedCurrentUrl = normalizeUrl(item.dataset.value);
        const normalizedAudioSrc = normalizeUrl(audio.src);
        if (normalizedAudioSrc !== normalizedCurrentUrl || audio.paused || audio.error || audio.readyState < 2 || audio.currentTime === 0) {
          console.log("changeStation: Починаємо відтворення після зміни станції");
          isAutoPlayPending = false;
          debouncedTryAutoPlay();
        } else {
          console.log("changeStation: Пропускаємо відтворення, станція вже відтворюється");
        }
      } else {
        console.log("changeStation: Пропускаємо відтворення, некоректний стан");
      }
    }

    function updateCurrentStation(item) {
      if (!currentStationInfo || !item.dataset) {
        console.error("currentStationInfo або item.dataset не знайдено");
        resetStationInfo();
        return;
      }
      const stationNameElement = currentStationInfo.querySelector(".station-name");
      const stationGenreElement = currentStationInfo.querySelector(".station-genre");
      const stationCountryElement = currentStationInfo.querySelector(".station-country");
      const stationIconElement = currentStationInfo.querySelector(".station-icon");

      console.log("Оновлення currentStationInfo з даними:", item.dataset);

      if (stationNameElement) {
        stationNameElement.textContent = item.dataset.name || "";
      } else {
        console.error(".station-name element not found");
      }
      if (stationGenreElement) {
        stationGenreElement.textContent = `жанр: ${item.dataset.genre || ""}`;
      } else {
        console.error(".station-genre element not found");
      }
      if (stationCountryElement) {
        stationCountryElement.textContent = `країна: ${item.dataset.country || ""}`;
      } else {
        console.error(".station-country element not found");
      }
      if (stationIconElement) {
        if (item.dataset.favicon && isValidUrl(item.dataset.favicon)) {
          stationIconElement.innerHTML = "";
          stationIconElement.style.backgroundImage = `url(${item.dataset.favicon})`;
          stationIconElement.style.backgroundSize = "contain";
          stationIconElement.style.backgroundRepeat = "no-repeat";
          stationIconElement.style.backgroundPosition = "center";
        } else {
          stationIconElement.innerHTML = '<span class="material-symbols-rounded">music_note</span>';
          stationIconElement.style.backgroundImage = "none";
        }
        stationIconElement.classList.toggle("playing", isPlaying && intendedPlaying);
      } else {
        console.error(".station-icon element not found");
      }
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: item.dataset.name || "Невідома станція",
          artist: `${item.dataset.genre || ""} | ${item.dataset.country || ""}`,
          album: "Radio Music",
          artwork: item.dataset.favicon && isValidUrl(item.dataset.favicon) ? [
            { src: item.dataset.favicon, sizes: "96x96", type: "image/png" },
            { src: item.dataset.favicon, sizes: "128x128", type: "image/png" },
            { src: item.dataset.favicon, sizes: "192x192", type: "image/png" },
            { src: item.dataset.favicon, sizes: "256x256", type: "image/png" },
            { src: item.dataset.favicon, sizes: "384x384", type: "image/png" },
            { src: item.dataset.favicon, sizes: "512x512", type: "image/png" }
          ] : []
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
      if (!playPauseBtn || !audio) {
        console.error("playPauseBtn або audio не знайдено");
        return;
      }
      if (audio.paused) {
        isPlaying = true;
        intendedPlaying = true;
        debouncedTryAutoPlay();
        playPauseBtn.querySelector("span").textContent = "pause";
        document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
        currentStationInfo.querySelector(".station-icon").classList.add("playing");
      } else {
        audio.pause();
        isPlaying = false;
        intendedPlaying = false;
        playPauseBtn.querySelector("span").textContent = "play_arrow";
        document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
        currentStationInfo.querySelector(".station-icon").classList.remove("playing");
      }
      localStorage.setItem("isPlaying", isPlaying);
      localStorage.setItem("intendedPlaying", intendedPlaying);
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
        if (document.hidden || !intendedPlaying || !navigator.onLine || !stationItems?.length || currentIndex >= stationItems.length) {
          console.log("visibilitychange: Пропускаємо, вкладка прихована або некоректний стан");
          return;
        }
        const normalizedCurrentUrl = normalizeUrl(stationItems[currentIndex].dataset.value);
        const normalizedAudioSrc = normalizeUrl(audio.src);
        if (normalizedAudioSrc === normalizedCurrentUrl && !audio.paused && !audio.error && audio.readyState >= 2 && audio.currentTime > 0) {
          console.log("visibilitychange: Пропускаємо відтворення, станція вже відтворюється");
        } else {
          console.log("visibilitychange: Починаємо відтворення після зміни видимості");
          isAutoPlayPending = false;
          debouncedTryAutoPlay();
        }
      },
      resume: () => {
        if (!intendedPlaying || !navigator.onLine || !stationItems?.length || currentIndex >= stationItems.length) {
          console.log("resume: Пропускаємо, некоректний стан");
          return;
        }
        const normalizedCurrentUrl = normalizeUrl(stationItems[currentIndex].dataset.value);
        const normalizedAudioSrc = normalizeUrl(audio.src);
        if (normalizedAudioSrc === normalizedCurrentUrl && !audio.paused && !audio.error && audio.readyState >= 2 && audio.currentTime > 0) {
          console.log("resume: Пропускаємо відтворення, станція вже відтворюється");
        } else {
          console.log("resume: Починаємо відтворення після відновлення програми");
          isAutoPlayPending = false;
          debouncedTryAutoPlay();
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
      playPauseBtn.querySelector("span").textContent = "pause";
      document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
      currentStationInfo.querySelector(".station-icon").classList.add("playing");
      localStorage.setItem("isPlaying", isPlaying);
      if (errorTimeout) {
        clearTimeout(errorTimeout);
        errorTimeout = null;
      }
    });

    audio.addEventListener("pause", () => {
      isPlaying = false;
      playPauseBtn.querySelector("span").textContent = "play_arrow";
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      currentStationInfo.querySelector(".station-icon").classList.remove("playing");
      localStorage.setItem("isPlaying", isPlaying);
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = null;
      }
    });

    audio.addEventListener("error", () => {
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      currentStationInfo.querySelector(".station-icon").classList.remove("playing");
      console.error("Помилка аудіо:", audio.error?.message || "Невідома помилка", "для URL:", audio.src);
      if (intendedPlaying && errorCount < ERROR_LIMIT && !errorTimeout) {
        errorCount++;
        errorTimeout = setTimeout(() => {
          debouncedTryAutoPlay();
          errorTimeout = null;
        }, 1000);
      } else if (errorCount >= ERROR_LIMIT) {
        console.error("Досягнуто ліміт помилок відтворення");
        resetStationInfo();
      }
    });

    audio.addEventListener("volumechange", () => {
      localStorage.setItem("volume", audio.volume);
    });

    window.addEventListener("online", () => {
      console.log("Мережу відновлено");
      if (intendedPlaying && stationItems?.length && currentIndex < stationItems.length) {
        isAutoPlayPending = false;
        debouncedTryAutoPlay();
      }
    });

    window.addEventListener("offline", () => {
      console.log("Втрачено з'єднання з мережею");
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      currentStationInfo.querySelector(".station-icon").classList.remove("playing");
      errorCount = 0;
    });

    addEventListeners();

    window.addEventListener("beforeunload", () => {
      removeEventListeners();
    });

    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => {
        if (intendedPlaying) return;
        togglePlayPause();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        if (!isPlaying) return;
        togglePlayPause();
      });
      navigator.mediaSession.setActionHandler("previoustrack", prevStation);
      navigator.mediaSession.setActionHandler("nexttrack", nextStation);
    }

    applyTheme(currentTheme);
    loadStations();
    if (intendedPlaying && stationItems?.length && currentIndex < stationItems.length) {
      const normalizedCurrentUrl = normalizeUrl(stationItems[currentIndex].dataset.value);
      const normalizedAudioSrc = normalizeUrl(audio.src);
      if (normalizedAudioSrc !== normalizedCurrentUrl || audio.paused || audio.error || audio.readyState < 2 || audio.currentTime === 0) {
        console.log("initializeApp: Починаємо відтворення після ініціалізації");
        isAutoPlayPending = false;
        debouncedTryAutoPlay();
      } else {
        console.log("initializeApp: Пропускаємо відтворення, станція вже відтворюється");
      }
    } else {
      console.log("initializeApp: Пропускаємо відтворення, некоректний стан");
    }
  }
});