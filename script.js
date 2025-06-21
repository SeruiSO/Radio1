let currentTab = localStorage.getItem("currentTab") || "techno";
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let stationLists = JSON.parse(localStorage.getItem("stationLists")) || {};
let userAddedStations = JSON.parse(localStorage.getItem("userAddedStations")) || {};
let stationItems = [];
let abortController = new AbortController();
let reconnectionTimeout = null;
let reconnectionTimerCount = 0; // Лічильник активних таймерів
const RECONNECTION_LIMIT = 20 * 60 * 1000; // 20 хвилин
let reconnectionStartTime = null;
let pastSearches = JSON.parse(localStorage.getItem("pastSearches")) || [];
let deletedStations = JSON.parse(localStorage.getItem("deletedStations")) || [];
let customTabs = JSON.parse(localStorage.getItem("customTabs")) || [];
// Ensure customTabs is an array of strings
customTabs = Array.isArray(customTabs) ? customTabs.filter(tab => typeof tab === "string" && tab.trim()) : [];

// Централізований об’єкт стану
let playerState = {
  isPlaying: isPlaying,
  currentStation: null,
  currentTab: currentTab,
  currentIndex: currentIndex
};

document.addEventListener("DOMContentLoaded", () => {
  const audio = document.getElementById("audioPlayer");
  const stationList = document.getElementById("stationList");
  const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
  const currentStationInfo = document.getElementById("currentStationInfo");
  const themeToggle = document.querySelector(".theme-toggle");
  const shareButton = document.querySelector(".share-button");
  const searchInput = document.getElementById("searchInput");
  const searchQuery = document.getElementById("searchQuery");
  const searchCountry = document.getElementById("searchCountry");
  const searchGenre = document.getElementById("searchGenre");
  const searchBtn = document.querySelector(".search-btn");
  const pastSearchesList = document.getElementById("pastSearches");
  const tabsContainer = document.getElementById("tabs");

  if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle || !shareButton || !searchInput || !searchQuery || !searchCountry || !searchGenre || !searchBtn || !pastSearchesList || !tabsContainer) {
    console.error("Один із необхідних DOM-елементів не знайдено", {
      audio: !!audio,
      stationList: !!stationList,
      playPauseBtn: !!playPauseBtn,
      currentStationInfo: !!currentStationInfo,
      themeToggle: !!themeToggle,
      shareButton: !!shareButton,
      searchInput: !!searchInput,
      searchQuery: !!searchQuery,
      searchCountry: !!searchCountry,
      searchGenre: !!searchGenre,
      searchBtn: !!searchBtn,
      pastSearchesList: !!pastSearchesList,
      tabsContainer: !!tabsContainer
    });
    setTimeout(initializeApp, 100);
    return;
  }

  initializeApp();

  function initializeApp() {
    audio.preload = "none";
    audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

    updatePastSearches();
    populateSearchSuggestions();
    renderTabs();

    shareButton.addEventListener("click", () => {
      const stationName = currentStationInfo.querySelector(".station-name").textContent || "Radio S O";
      const shareData = {
        title: "Radio S O",
        text: `Слухаю ${stationName} на Radio S O! Приєднуйтесь до улюблених радіостанцій!`,
        url: window.location.href
      };
      if (navigator.share) {
        navigator.share(shareData)
          .catch(error => console.error("Помилка при спробі поділитися:", error));
      } else {
        alert(`Функція поділитися не підтримується. Скопіюйте: ${shareData.text} ${shareData.url}`);
      }
    });

    document.querySelector(".controls .control-btn:nth-child(1)").addEventListener("click", prevStation);
    document.querySelector(".controls .control-btn:nth-child(2)").addEventListener("click", togglePlayPause);
    document.querySelector(".controls .control-btn:nth-child(3)").addEventListener("click", nextStation);

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
        stationList.innerHTML = "<div class='station-item empty'>Введіть назву, країну чи жанр</div>";
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

    function resetStationInfo() {
      const stationNameElement = currentStationInfo.querySelector(".station-name");
      const stationGenreElement = currentStationInfo.querySelector(".station-genre");
      const stationCountryElement = currentStationInfo.querySelector(".station-country");
      const stationIconElement = currentStationInfo.querySelector(".station-icon");
      if (stationNameElement) stationNameElement.textContent = "Обирайте станцію";
      else console.error("Елемент .station-name не знайдено");
      if (stationGenreElement) stationGenreElement.textContent = "жанр: -";
      else console.error("Елемент .station-genre не знайдено");
      if (stationCountryElement) stationCountryElement.textContent = "країна: -";
      else console.error("Елемент .station-country не знайдено");
      if (stationIconElement) {
        stationIconElement.innerHTML = "🎵";
        stationIconElement.style.backgroundImage = "none";
      } else console.error("Елемент .station-icon не знайдено");
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
        console.log(`Статус відповіді: ${response.status}`);
        const mergedStationLists = {};
        if (response.ok) {
          const newStations = await response.json();
          // Process standard tabs from stations.json
          Object.keys(newStations).forEach(tab => {
            const uniqueStations = new Map();
            // Add user-added stations
            (userAddedStations[tab] || []).forEach(s => {
              if (!deletedStations.includes(s.name)) {
                uniqueStations.set(s.name, s);
              }
            });
            // Add stations from stations.json
            newStations[tab].forEach(s => {
              if (!deletedStations.includes(s.name)) {
                uniqueStations.set(s.name, s);
              }
            });
            mergedStationLists[tab] = Array.from(uniqueStations.values());
            console.log(`Додано до ${tab}:`, mergedStationLists[tab].map(s => s.name));
          });
        } else {
          console.warn("Не вдалося завантажити stations.json, використовуємо кешовані дані");
        }
        // Process custom tabs
        customTabs.forEach(tab => {
          const uniqueStations = new Map();
          // Add user-added stations
          (userAddedStations[tab] || []).forEach(s => {
            if (!deletedStations.includes(s.name)) {
              uniqueStations.set(s.name, s);
            }
          });
          // Add existing stations from stationLists (if any)
          (stationLists[tab] || []).forEach(s => {
            if (!deletedStations.includes(s.name)) {
              uniqueStations.set(s.name, s);
            }
          });
          mergedStationLists[tab] = Array.from(uniqueStations.values());
          console.log(`Збережено для кастомної вкладки ${tab}:`, mergedStationLists[tab].map(s => s.name));
        });
        // Clean up stationLists and userAddedStations
        Object.keys(stationLists).forEach(tab => {
          if (stationLists[tab]) {
            stationLists[tab] = stationLists[tab].filter(s => !deletedStations.includes(s.name));
          }
        });
        Object.keys(userAddedStations).forEach(tab => {
          if (userAddedStations[tab]) {
            userAddedStations[tab] = userAddedStations[tab].filter(s => !deletedStations.includes(s.name));
          }
        });
        stationLists = mergedStationLists;
        localStorage.setItem("stationLists", JSON.stringify(stationLists));
        localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
        favoriteStations = favoriteStations.filter(name => 
          Object.values(stationLists).flat().some(s => s.name === name)
        );
        localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
        const validTabs = [...Object.keys(stationLists), "best", "search", ...customTabs];
        if (!validTabs.includes(currentTab)) {
          currentTab = validTabs[0] || "techno";
          playerState.currentTab = currentTab;
          localStorage.setItem("currentTab", currentTab);
        }
        currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
        playerState.currentIndex = currentIndex;
        switchTab(currentTab);
        if (playerState.isPlaying && stationItems.length && currentIndex < stationItems.length) {
          debouncedTryAutoPlay();
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error("Помилка завантаження станцій:", error);
          // Preserve custom tabs even on error
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
          localStorage.setItem("stationLists", JSON.stringify(stationLists));
          localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
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
        console.log("Запит до API:", url);
        const response = await fetch(url, {
          signal: abortController.signal
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        let stations = await response.json();
        stations = stations.filter(station => station.url_resolved && isValidUrl(station.url_resolved));
        console.log("Отримано станцій (після фільтрації HTTPS):", stations.length);
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
        item.className = `station-item ${index === playerState.currentIndex ? "selected" : ""}`;
        item.dataset.value = station.url || station.url_resolved;
        item.dataset.name = station.name || "Unknown";
        item.dataset.genre = shortenGenre(station.tags || "Unknown");
        item.dataset.country = station.country || "Unknown";
        item.dataset.favicon = station.favicon && isValidUrl(station.favicon) ? station.favicon : "";
        const iconHtml = item.dataset.favicon ? `<img src="${item.dataset.favicon}" alt="${station.name} icon" style="width: 32px; height: 32px; object-fit: contain; margin-right: 10px;" onerror="this.outerHTML='🎵 '">` : "🎵 ";
        item.innerHTML = `${iconHtml}<span class="station-name">${station.name}</span><button class="add-btn">ADD</button>`;
        fragment.appendChild(item);
      });
      stationList.innerHTML = "";
      stationList.appendChild(fragment);
      stationItems = document.querySelectorAll(".station-item");
      if (stationItems.length && playerState.currentIndex < stationItems.length) {
        changeStation(playerState.currentIndex);
      }
      stationList.onclick = e => {
        const item = e.target.closest(".station-item");
        const addBtn = e.target.closest(".add-btn");
        if (addBtn) {
          e.stopPropagation();
          showTabModal(item);
        } else if (item && !item.classList.contains("empty")) {
          playerState.currentIndex = Array.from(stationItems).indexOf(item);
          changeStation(playerState.currentIndex);
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
        <h2>Оберіть вкладку</h2>
        <div class="modal-tabs">
          <button class="modal-tab-btn" data-tab="techno">TECHNO</button>
          <button class="modal-tab-btn" data-tab="trance">Trance</button>
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
          favicon: item.dataset.favicon || ""
        };
        stationLists[targetTab].unshift(newStation);
        if (!userAddedStations[targetTab].some(s => s.name === stationName)) {
          userAddedStations[targetTab].unshift(newStation);
        }
        localStorage.setItem("stationLists", JSON.stringify(stationLists));
        localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
        console.log(`Додано станцію ${stationName} до ${targetTab}:`, newStation);
        if (playerState.currentTab !== "search") {
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
        btn.className = `tab-btn ${playerState.currentTab === tab ? "active" : ""}`;
        btn.dataset.tab = tab;
        btn.textContent = tab === "best" ? "Best" : tab === "ukraine" ? "UA" : tab === "search" ? "Search" : tab.charAt(0).toUpperCase() + tab.slice(1);
        tabsContainer.appendChild(btn);
      });
      customTabs.forEach(tab => {
        if (typeof tab !== "string" || !tab.trim()) return;
        const btn = document.createElement("button");
        btn.className = `tab-btn ${playerState.currentTab === tab ? "active" : ""}`;
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
          alert("Введіть назву вкладки!");
          return;
        }
        if (["best", "techno", "trance", "ukraine", "pop", "search"].includes(tabName) || customTabs.includes(tabName)) {
          alert("Ця назва вкладки вже існує!");
          return;
        }
        if (tabName.length > 20 || !/^[a-z0-9_-]+$/.test(tabName)) {
          alert("Назва вкладки не може перевищувати 20 символів і має містити лише латинські літери, цифри, дефіс або підкреслення.");
          return;
        }
        if (!tabName.match(/^[a-z][a-z0-9_-]*$/)) {
          alert("Назва вкладки має починатися з літери та містити лише латинські літери, цифри, дефіс або підкреслення!");
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
          alert("Введіть нову назву вкладки!");
          return;
        }
        if (["best", "techno", "trance", "ukraine", "pop", "search"].includes(newName) || customTabs.includes(newName)) {
          alert("Ця назва вкладки вже існує!");
          return;
        }
        if (newName.length > 20 || !/^[a-z0-9_-]+$/.test(newName)) {
          alert("Назва вкладки не може перевищувати 20 символів і має містити лише латинські літери, цифри, дефіс або підкреслення!");
          return;
        }
        if (!newName.match(/^[a-z][a-z0-9_-]*$/)) {
          alert("Назва вкладки має починатися з літери та містити лише латинські літери, цифри, дефіс або підкреслення!");
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
        if (playerState.currentTab === tab) switchTab(newName);
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
          if (playerState.currentTab === tab) switchTab("techno");
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
    if (!themes[currentTheme]) {
      currentTheme = "neon-pulse";
      localStorage.setItem("selectedTheme", currentTheme);
    }

    function applyTheme(theme) {
      if (!themes[theme]) {
        console.warn(`Тема ${theme} не знайдена, використовується 'neon-pulse'`);
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
            favoriteStations = favoriteStations.filter(name =>
              Object.values(stationLists).flat().some(s => s.name === name)
            );
            localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
            localStorage.setItem("cacheVersion", event.data.cacheVersion);
            loadStations();
          }
        }
        if (event.data.type === "NETWORK_STATUS" && event.data.online && playerState.isPlaying && stationItems?.length && playerState.currentIndex < stationItems.length) {
          console.log("Мережа відновлена, пробуємо відтворити поточну станцію");
          debouncedTryAutoPlay();
        }
      });
    }

    function getReconnectionDelay(attemptTime) {
      const twoMinutes = 2 * 60 * 1000;
      const fiveMinutes = 5 * 60 * 1000;
      if (attemptTime < twoMinutes) {
        return 1000;
      } else if (attemptTime < fiveMinutes) {
        return 2000;
      } else {
        const elapsedAfterFive = attemptTime - fiveMinutes;
        const attemptsAfterFive = Math.floor(elapsedAfterFive / 1000);
        let delay = 4000;
        for (let i = 0; i < attemptsAfterFive; i++) {
          delay = Math.min(delay * 2, 32000);
        }
        return delay;
      }
    }

    // Дебансинг функція
    function debounce(func, wait) {
      let timeout;
      return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    }

    function tryAutoPlay() {
      if (!navigator.onLine) {
        console.log("Пристрій офлайн, пропускаємо відтворення", { playerState, reconnectionTimerCount });
        if (playerState.isPlaying) {
          if (!reconnectionStartTime) reconnectionStartTime = Date.now();
          scheduleReconnection();
        }
        return;
      }
      if (!playerState.isPlaying || !stationItems?.length || playerState.currentIndex >= stationItems.length || !stationItems[playerState.currentIndex]) {
        console.log("Пропуск tryAutoPlay", {
          isPlaying: playerState.isPlaying,
          hasStationItems: !!stationItems?.length,
          isIndexValid: playerState.currentIndex < stationItems.length,
          stationExists: !!stationItems[playerState.currentIndex]
        });
        document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
        return;
      }
      if (!isValidUrl(stationItems[playerState.currentIndex].dataset.value)) {
        console.error("Невалідний URL:", stationItems[playerState.currentIndex].dataset.value, { playerState });
        if (playerState.isPlaying) {
          if (!reconnectionStartTime) reconnectionStartTime = Date.now();
          scheduleReconnection();
        }
        document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
        return;
      }
      const targetSrc = stationItems[playerState.currentIndex].dataset.value;
      if (audio.src === targetSrc && !audio.paused) {
        console.log("Аудіо вже відтворюється, пропускаємо", { src: audio.src, playerState });
        return;
      }
      audio.pause();
      audio.src = targetSrc;
      audio.currentTime = 0; // Скинути позицію
      console.log("Спроба відтворення:", audio.src, { playerState, reconnectionTimerCount });
      const playPromise = audio.play();
      playPromise
        .then(() => {
          console.log("Відтворення розпочато успішно", { src: audio.src, playerState });
          document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
          clearTimeout(reconnectionTimeout);
          reconnectionTimerCount--;
          reconnectionStartTime = null;
        })
        .catch(error => {
          console.error("Помилка відтворення:", {
            message: error.message,
            code: audio.error?.code,
            src: audio.src,
            playerState,
            reconnectionTimerCount
          });
          if (playerState.isPlaying && (!reconnectionStartTime || Date.now() - reconnectionStartTime < RECONNECTION_LIMIT)) {
            if (!reconnectionStartTime) reconnectionStartTime = Date.now();
            scheduleReconnection();
          } else if (playerState.isPlaying && Date.now() - reconnectionStartTime >= RECONNECTION_LIMIT) {
            console.log("Досягнуто ліміт часу для відновлення, ставимо на паузу", { playerState });
            togglePlayPause();
          }
          document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
        });
    }

    const debouncedTryAutoPlay = debounce(tryAutoPlay, 500);

    function scheduleReconnection() {
      clearTimeout(reconnectionTimeout);
      reconnectionTimerCount--;
      const elapsed = reconnectionStartTime ? Date.now() - reconnectionStartTime : 0;
      if (elapsed >= RECONNECTION_LIMIT) {
        console.log("Досягнуто ліміт часу для відновлення, ставимо на паузу", { playerState, reconnectionTimerCount });
        togglePlayPause();
        return;
      }
      const delay = getReconnectionDelay(elapsed);
      console.log(`Плануємо повторну спробу через ${delay} мс`, { elapsed, delay, playerState });
      audio.src = ""; // Очистити буфер
      reconnectionTimeout = setTimeout(() => {
        reconnectionTimerCount++;
        debouncedTryAutoPlay();
      }, delay);
    }

    function switchTab(tab) {
      const validTabs = ["best", "techno", "trance", "ukraine", "pop", "search", ...customTabs];
      if (!validTabs.includes(tab)) {
        tab = "techno";
      }
      playerState.currentTab = tab;
      currentTab = tab;
      localStorage.setItem("currentTab", tab);
      const savedIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
      const maxIndex = tab === "best" ? favoriteStations.length : tab === "search" ? 0 : stationLists[tab]?.length || 0;
      playerState.currentIndex = savedIndex < maxIndex ? savedIndex : 0;
      currentIndex = playerState.currentIndex;
      searchInput.style.display = tab === "search" ? "flex" : "none";
      searchQuery.value = "";
      searchCountry.value = "";
      searchGenre.value = "";
      if (tab === "search") populateSearchSuggestions();
      updateStationList();
      renderTabs();
      if (playerState.isPlaying && stationItems?.length && playerState.currentIndex < stationItems.length) {
        debouncedTryAutoPlay();
      }
    }

    function updateStationList() {
      if (!stationList) {
        console.error("stationList не знайдено");
        return;
      }
      let stations = playerState.currentTab === "best"
        ? favoriteStations
            .map(name => Object.values(stationLists).flat().find(s => s.name === name))
            .filter(s => s)
        : stationLists[playerState.currentTab] || [];

      if (!stations.length) {
        playerState.currentIndex = 0;
        currentIndex = 0;
        playerState.currentStation = null;
        stationItems = [];
        stationList.innerHTML = `<div class="station-item empty">${playerState.currentTab === "best" ? "Немає улюблених станцій" : "Немає станцій у цій категорії"}</div>`;
        return;
      }

      const fragment = document.createDocumentFragment();
      stations.forEach((station, index) => {
        const item = document.createElement("div");
        item.className = `station-item ${index === playerState.currentIndex ? "selected" : ""}`;
        item.dataset.value = station.value;
        item.dataset.name = station.name;
        item.dataset.genre = shortenGenre(station.genre);
        item.dataset.country = station.country;
        item.dataset.favicon = station.favicon && isValidUrl(station.favicon) ? station.favicon : "";
        const iconHtml = item.dataset.favicon ? `<img src="${item.dataset.favicon}" alt="${station.name} icon" style="width: 32px; height: 32px; object-fit: contain; margin-right: 10px;" onerror="this.outerHTML='✨ '">` : "🎵 ";
        const deleteButton = ["techno", "trance", "ukraine", "pop", ...customTabs].includes(playerState.currentTab)
          ? `<button class="delete-btn">🗑</button>`
          : "";
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

      if (stationItems.length && stationItems[playerState.currentIndex] && !stationItems[playerState.currentIndex].classList.contains("empty")) {
        stationItems[playerState.currentIndex].scrollIntoView({ behavior: "smooth", block: "center" });
      }

      stationList.onclick = e => {
        const item = e.target.closest(".station-item");
        const favoriteBtn = e.target.closest(".favorite-btn");
        const deleteBtn = e.target.closest(".delete-btn");
        if (favoriteBtn) {
          e.stopPropagation();
          toggleFavorite(item.dataset.name);
        } else if (deleteBtn) {
          e.stopPropagation();
          if (confirm(`Ви дійсно хочете видалити станцію "${item.dataset.name}" зі спіску?`)) {
            deleteStation(item.dataset.name);
          }
        } else if (item && !item.classList.contains("empty")) {
          playerState.currentIndex = Array.from(stationItems).indexOf(item);
          currentIndex = playerState.currentIndex;
          changeStation(playerState.currentIndex);
        }
      };

      if (stationItems.length && playerState.currentIndex < stationItems.length) {
        changeStation(playerState.currentIndex);
      }
    }

    function toggleFavorite(stationName) {
      if (favoriteStations.includes(stationName)) {
        favoriteStations = favoriteStations.filter(name => name !== stationName);
      } else {
        favoriteStations.unshift(stationName);
      }
      localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
      if (playerState.currentTab === "best") switchTab("best");
      else updateStationList();
    }

    function deleteStation(stationName) {
      if (Array.isArray(stationLists[playerState.currentTab])) {
        stationLists[playerState.currentTab] = stationLists[playerState.currentTab].filter(s => s.name !== stationName);
        userAddedStations[playerState.currentTab] = userAddedStations[playerState.currentTab]?.filter(s => s.name !== stationName) || [];
      }
      favoriteStations = favoriteStations.filter(name => name !== stationName);
      if (!Array.isArray(deletedStations)) deletedStations = [];
      deletedStations.push(stationName);
      localStorage.setItem("stationLists", JSON.stringify(stationLists));
      localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
      localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
      localStorage.setItem("deletedStations", JSON.stringify(deletedStations));
      console.log(`Видалено станцію ${stationName} з ${playerState.currentTab}, додано до deletedStations:`, deletedStations);
      if (stationLists[playerState.currentTab].length === 0) {
        playerState.currentIndex = 0;
        currentIndex = 0;
        playerState.currentStation = null;
      } else if (playerState.currentIndex >= stationLists[playerState.currentTab].length) {
        playerState.currentIndex = stationLists[playerState.currentTab].length - 1;
        currentIndex = playerState.currentIndex;
      }
      switchTab(playerState.currentTab);
    }

    function changeStation(index) {
      if (!stationItems || index < 0 || index >= stationItems.length || stationItems[index].classList.contains("empty")) return;
      const item = stationItems[index];
      stationItems.forEach(i => i.classList.remove("selected"));
      item.classList.add("selected");
      playerState.currentIndex = index;
      currentIndex = index;
      playerState.currentStation = {
        value: item.dataset.value,
        name: item.dataset.name,
        genre: item.dataset.genre,
        country: item.dataset.country,
        favicon: item.dataset.favicon
      };
      updateCurrentStation(item);
      localStorage.setItem(`lastStation_${playerState.currentTab}`, index);
      clearTimeout(reconnectionTimeout);
      reconnectionTimerCount--;
      reconnectionStartTime = null;
      if (playerState.isPlaying) debouncedTryAutoPlay();
    }

    function updateCurrentStation(item) {
      if (!currentStationInfo) {
        console.error("currentStationInfo не знайдено");
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
        console.error("Елемент .station-name не знайдено");
      }
      if (stationGenreElement) {
        stationGenreElement.textContent = `жанр: ${item.dataset.genre || ""}`;
      } else {
        console.error("Елемент .station-genre не знайдено");
      }
      if (stationCountryElement) {
        stationCountryElement.textContent = `країна: ${item.dataset.country || ""}`;
      } else {
        console.error("Елемент .station-country не знайдено");
      }
      if (stationIconElement) {
        if (item.dataset.favicon && isValidUrl(item.dataset.favicon)) {
          stationIconElement.innerHTML = "";
          stationIconElement.style.backgroundImage = `url(${item.dataset.favicon})`;
          stationIconElement.style.backgroundSize = "contain";
          stationIconElement.style.backgroundRepeat = "no-repeat";
          stationIconElement.style.backgroundPosition = "center";
        } else {
          stationIconElement.innerHTML = "🎵";
          stationIconElement.style.backgroundImage = "none";
        }
      } else {
        console.error("Елемент .station-icon не знайдено");
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
      playerState.currentIndex = playerState.currentIndex > 0 ? playerState.currentIndex - 1 : stationItems.length - 1;
      currentIndex = playerState.currentIndex;
      if (stationItems[playerState.currentIndex].classList.contains("empty")) {
        playerState.currentIndex = 0;
        currentIndex = 0;
      }
      changeStation(playerState.currentIndex);
    }

    function nextStation() {
      if (!stationItems?.length) return;
      playerState.currentIndex = playerState.currentIndex < stationItems.length - 1 ? playerState.currentIndex + 1 : 0;
      currentIndex = playerState.currentIndex;
      if (stationItems[playerState.currentIndex].classList.contains("empty")) {
        playerState.currentIndex = 0;
        currentIndex = 0;
      }
      changeStation(playerState.currentIndex);
    }

    function togglePlayPause() {
      if (!playPauseBtn || !audio) {
        console.error("playPauseBtn або audio не знайдено");
        return;
      }
      if (audio.paused) {
        playerState.isPlaying = true;
        isPlaying = true;
        debouncedTryAutoPlay();
        playPauseBtn.textContent = "⏸";
      } else {
        audio.pause();
        playerState.isPlaying = false;
        isPlaying = false;
        playPauseBtn.textContent = "▶";
        document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
        clearTimeout(reconnectionTimeout);
        reconnectionTimerCount--;
        reconnectionStartTime = null;
      }
      localStorage.setItem("isPlaying", playerState.isPlaying);
    }

    const eventListeners = {
      keydown: e => {
        if (e.key === "ArrowLeft") {
          prevStation();
        } else if (e.key === "ArrowRight") {
          nextStation();
        } else if (e.key === " ") {
          e.preventDefault();
          togglePlayPause();
        }
      },
      visibilitychange: debounce(() => {
        if (!document.hidden && playerState.isPlaying && navigator.onLine) {
          console.log("Вкладка активна, пробуємо відтворити", { playerState });
          debouncedTryAutoPlay();
        }
      }, 500),
      resume: debounce(() => {
        if (playerState.isPlaying && navigator.connection?.type !== "none") {
          console.log("Додаток відновлено, пробуємо відтворити", { playerState });
          debouncedTryAutoPlay();
        }
      }, 500),
      online: debounce(() => {
        console.log("Мережа відновлена, пробуємо відтворити", { playerState });
        if (playerState.isPlaying && stationItems?.length && playerState.currentIndex < stationItems.length) {
          debouncedTryAutoPlay();
        }
      }, 500)
    };

    function addEventListeners() {
      document.addEventListener("keydown", eventListeners.keydown);
      document.addEventListener("visibilitychange", eventListeners.visibilitychange);
      document.addEventListener("resume", eventListeners.resume);
      window.addEventListener("online", eventListeners.online);
    }

    function removeEventListeners() {
      document.removeEventListener("keydown", eventListeners.keydown);
      document.removeEventListener("visibilitychange", eventListeners.visibilitychange);
      document.removeEventListener("resume", eventListeners.resume);
      window.removeEventListener("online", eventListeners.online);
    }

    audio.addEventListener("playing", () => {
      playerState.isPlaying = true;
      isPlaying = true;
      playPauseBtn.textContent = "⏸";
      document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
      localStorage.setItem("isPlaying", playerState.isPlaying);
      clearTimeout(reconnectionTimeout);
      reconnectionTimerCount--;
      reconnectionStartTime = null;
    });

    audio.addEventListener("pause", () => {
      if (!playerState.isPlaying) {
        playPauseBtn.textContent = "▶";
        document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
        if ("mediaSession" in navigator) {
          navigator.mediaSession.metadata = null;
        }
      }
    });

    audio.addEventListener("error", () => {
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      console.error("Помилка:", {
        message: audio.error?.message || "Невідома помилка",
        code: audio.error?.code,
        src: audio.src,
        playerState,
        reconnectionTimerCount
      });
      if (playerState.isPlaying && (!reconnectionStartTime || Date.now() - reconnectionStartTime < RECONNECTION_LIMIT)) {
        if (!reconnectionStartTime) reconnectionStartTime = Date.now();
        scheduleReconnection();
      } else if (playerState.isPlaying && Date.now() - reconnectionStartTime >= RECONNECTION_LIMIT) {
        console.log("Досягнуто ліміт часу для відновлення, ставимо на паузу", { playerState });
        togglePlayPause();
      }
    });

    audio.addEventListener("volumechange", () => {
      localStorage.setItem("volume", audio.volume);
    });

    window.addEventListener("offline", () => {
      console.log("Втрачено зв’язок", { playerState });
      if (playerState.isPlaying) {
        audio.pause();
        if (!reconnectionStartTime) reconnectionStartTime = Date.now();
        scheduleReconnection();
      }
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
    }

    applyTheme(currentTheme);
    loadStations();
  }
});