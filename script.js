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
const ERROR_LIMIT = 5;
let pastSearches = JSON.parse(localStorage.getItem("pastSearches")) || [];
let deletedStations = JSON.parse(localStorage.getItem("deletedStations")) || [];
let isAutoPlayPending = false;
let lastSuccessfulPlayTime = 0;
let streamAbortController = null;
let customTabs = Object.keys(stationLists).filter(tab => !["techno", "trance", "ukraine", "pop"].includes(tab));

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
  const tabsContainer = document.querySelector(".tabs");

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
    audio.preload = "auto";
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

    function validateTabName(name) {
      if (!name) return "Назва не може бути порожньою";
      if (name.length > 10) return "Назва не може перевищувати 10 символів";
      if (!/^[a-zA-Z]+$/.test(name)) return "Дозволені лише латинські літери";
      if (Object.keys(stationLists).includes(name.toLowerCase())) return "Вкладка з такою назвою вже існує";
      return null;
    }

    function showCreateTabModal() {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      const modal = document.createElement("div");
      modal.className = "modal";
      modal.innerHTML = `
        <input type="text" class="modal-input" id="newTabName" maxlength="10">
        <div class="modal-tabs">
          <button class="modal-confirm-btn">Підтвердити</button>
          <button class="modal-cancel-btn">Відміна</button>
        </div>
      `;
      document.body.appendChild(overlay);
      document.body.appendChild(modal);
      const input = modal.querySelector("#newTabName");
      const confirmBtn = modal.querySelector(".modal-confirm-btn");
      const closeModal = () => {
        overlay.remove();
        modal.remove();
      };
      overlay.addEventListener("click", closeModal);
      modal.querySelector(".modal-cancel-btn").addEventListener("click", closeModal);
      confirmBtn.addEventListener("click", () => {
        const tabName = input.value.trim().toLowerCase();
        const error = validateTabName(tabName);
        if (error) {
          alert(error);
          return;
        }
        if (customTabs.length >= 7) {
          alert("Досягнуто ліміт у 7 вкладок");
          closeModal();
          return;
        }
        customTabs.push(tabName);
        stationLists[tabName] = [];
        userAddedStations[tabName] = [];
        localStorage.setItem("stationLists", JSON.stringify(stationLists));
        localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
        renderTabs();
        switchTab(tabName);
        closeModal();
      });
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") confirmBtn.click();
      });
      input.focus();
    }

    function showEditTabModal(tabName) {
      if (["best", "techno", "trance", "ukraine", "pop", "search"].includes(tabName)) return;
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      const modal = document.createElement("div");
      modal.className = "modal";
      modal.innerHTML = `
        <div class="modal-tabs">
          <button class="modal-tab-btn" data-action="rename">Перейменувати</button>
          <button class="modal-tab-btn" data-action="delete">Видалити</button>
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
      modal.querySelector(".modal-cancel-btn").addEventListener("click", closeModal);
      modal.querySelectorAll(".modal-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const action = btn.dataset.action;
          closeModal();
          if (action === "rename") showRenameTabModal(tabName);
          else if (action === "delete") deleteTab(tabName);
        });
      });
    }

    function showRenameTabModal(tabName) {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      const modal = document.createElement("div");
      modal.className = "modal";
      modal.innerHTML = `
        <input type="text" class="modal-input" id="renameTabName" value="${tabName}" maxlength="10">
        <div class="modal-tabs">
          <button class="modal-confirm-btn">Підтвердити</button>
          <button class="modal-cancel-btn">Відміна</button>
        </div>
      `;
      document.body.appendChild(overlay);
      document.body.appendChild(modal);
      const input = modal.querySelector("#renameTabName");
      const confirmBtn = modal.querySelector(".modal-confirm-btn");
      const closeModal = () => {
        overlay.remove();
        modal.remove();
      };
      overlay.addEventListener("click", closeModal);
      modal.querySelector(".modal-cancel-btn").addEventListener("click", closeModal);
      confirmBtn.addEventListener("click", () => {
        const newTabName = input.value.trim().toLowerCase();
        const error = validateTabName(newTabName);
        if (error && newTabName !== tabName) {
          alert(error);
          return;
        }
        if (newTabName !== tabName) {
          stationLists[newTabName] = stationLists[tabName];
          userAddedStations[newTabName] = userAddedStations[tabName] || [];
          delete stationLists[tabName];
          delete userAddedStations[tabName];
          customTabs = customTabs.map(t => t === tabName ? newTabName : t);
          localStorage.setItem("stationLists", JSON.stringify(stationLists));
          localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
          if (currentTab === tabName) {
            currentTab = newTabName;
            localStorage.setItem("currentTab", currentTab);
          }
          renderTabs();
        }
        closeModal();
      });
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") confirmBtn.click();
      });
      input.focus();
    }

    function deleteTab(tabName) {
      if (!confirm(`Ви впевнені, що хочете видалити вкладку "${tabName}"?`)) return;
      const stations = stationLists[tabName] || [];
      const stationNames = stations.map(s => s.name);
      favoriteStations = favoriteStations.filter(name => !stationNames.includes(name));
      localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
      delete stationLists[tabName];
      delete userAddedStations[tabName];
      customTabs = customTabs.filter(t => t !== tabName);
      localStorage.setItem("stationLists", JSON.stringify(stationLists));
      localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
      let newTab;
      const allTabs = ["best", "techno", "trance", "ukraine", "pop", ...customTabs, "search"];
      const currentTabIndex = allTabs.indexOf(tabName);
      if (currentTab === tabName) {
        newTab = currentTabIndex > 0 ? allTabs[currentTabIndex - 1] : allTabs[1];
        switchTab(newTab);
      }
      renderTabs();
    }

    function renderTabs() {
      const standardTabs = [
        { name: "best", label: "Best" },
        { name: "techno", label: "Techno" },
        { name: "trance", label: "Trance" },
        { name: "ukraine", label: "UA" },
        { name: "pop", label: "Pop" }
      ];
      const tabsFragment = document.createDocumentFragment();
      standardTabs.forEach(tab => {
        const btn = document.createElement("button");
        btn.className = `tab-btn ${currentTab === tab.name ? "active" : ""}`;
        btn.textContent = tab.label;
        btn.dataset.tab = tab.name;
        tabsFragment.appendChild(btn);
      });
      customTabs.forEach(tab => {
        const btn = document.createElement("button");
        btn.className = `tab-btn ${currentTab === tab ? "active" : ""}`;
        btn.textContent = tab.toUpperCase();
        btn.dataset.tab = tab;
        tabsFragment.appendChild(btn);
      });
      const searchBtn = document.createElement("button");
      searchBtn.className = `tab-btn ${currentTab === "search" ? "active" : ""}`;
      searchBtn.textContent = "Search";
      searchBtn.dataset.tab = "search";
      tabsFragment.appendChild(searchBtn);
      const addBtn = document.createElement("button");
      addBtn.className = "add-tab-btn";
      addBtn.textContent = "+";
      tabsFragment.appendChild(addBtn);
      tabsContainer.innerHTML = "";
      tabsContainer.appendChild(tabsFragment);

      tabsContainer.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          if (btn.dataset.tab) switchTab(btn.dataset.tab);
        });
        let longPressTimeout;
        const startLongPress = () => {
          longPressTimeout = setTimeout(() => showEditTabModal(btn.dataset.tab), 500);
        };
        const cancelLongPress = () => {
          clearTimeout(longPressTimeout);
        };
        btn.addEventListener("mousedown", startLongPress);
        btn.addEventListener("mouseup", cancelLongPress);
        btn.addEventListener("mouseleave", cancelLongPress);
        btn.addEventListener("touchstart", startLongPress, { passive: true });
        btn.addEventListener("touchend", cancelLongPress);
        btn.addEventListener("touchcancel", cancelLongPress);
      });
      tabsContainer.querySelector(".add-tab-btn").addEventListener("click", showCreateTabModal);
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
        if (response.ok) {
          const newStations = await response.json();
          const mergedStationLists = {};
          Object.keys(newStations).forEach(tab => {
            mergedStationLists[tab] = [
              ...(userAddedStations[tab] || []).filter(s => !deletedStations.includes(s.name)),
              ...newStations[tab].filter(s => !deletedStations.includes(s.name))
            ];
            console.log(`Додано до ${tab}:`, mergedStationLists[tab].map(s => s.name));
          });
          Object.keys(userAddedStations).forEach(tab => {
            if (!newStations[tab]) {
              mergedStationLists[tab] = (userAddedStations[tab] || []).filter(s => !deletedStations.includes(s.name));
            }
          });
          stationLists = mergedStationLists;
          localStorage.setItem("stationLists", JSON.stringify(stationLists));
        } else {
          if (Object.keys(stationLists).length) {
            console.warn("Використовуємо кешовані stationLists із localStorage");
          } else {
            throw new Error(`HTTP ${response.status}`);
          }
        }
        favoriteStations = favoriteStations.filter(name => 
          Object.values(stationLists).flat().some(s => s.name === name)
        );
        localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
        customTabs = Object.keys(stationLists).filter(tab => !["techno", "trance", "ukraine", "pop"].includes(tab));
        const validTabs = [...Object.keys(stationLists), "best", "search"];
        if (!validTabs.includes(currentTab)) {
          currentTab = validTabs[0] || "techno";
          localStorage.setItem("currentTab", currentTab);
        }
        currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
        renderTabs();
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
        item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
        item.dataset.value = station.url || station.url_resolved;
        item.dataset.name = station.name || "Unknown";
        item.dataset.genre = shortenGenre(station.tags || "Unknown");
        item.dataset.country = station.country || "Unknown";
        item.dataset.favicon = station.favicon && isValidUrl(station.favicon) ? station.favicon : "";
        const iconHtml = item.dataset.favicon ? `<img src="${item.dataset.favicon}" alt="${station.name} icon" style="max-width: 32px; max-height: 32px; width: auto; height: auto; object-fit: contain; margin-right: 10px;" onerror="this.outerHTML='🎵 '">` : "🎵 ";
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
      return genres.length > 4 ? genres.slice(0, 4).join(", ") + "..." : genres.join(", ") || "Unknown";
    }

    function showTabModal(item) {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      const modal = document.createElement("div");
      modal.className = "modal";
      const tabsFragment = document.createDocumentFragment();
      ["techno", "trance", "ukraine", "pop", ...customTabs].forEach(tab => {
        const btn = document.createElement("button");
        btn.className = "modal-tab-btn";
        btn.dataset.tab = tab;
        btn.textContent = tab.toUpperCase();
        tabsFragment.appendChild(btn);
      });
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "modal-cancel-btn";
      cancelBtn.textContent = "Відміна";
      tabsFragment.appendChild(cancelBtn);
      modal.innerHTML = `<h2>Оберіть вкладку</h2><div class="modal-tabs"></div>`;
      modal.querySelector(".modal-tabs").appendChild(tabsFragment);
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
        userAddedStations[targetTab].unshift(newStation);
        localStorage.setItem("stationLists", JSON.stringify(stationLists));
        localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
        if (currentTab !== "search") {
          updateStationList();
        }
      } else {
        alert("Ця станція вже додана до обраної вкладки!");
      }
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
            favoriteStations = favoriteStations.filter((name) =>
              Object.values(stationLists).flat().some((s) => s.name === name)
            );
            localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
            localStorage.setItem("cacheVersion", event.data.cacheVersion);
            loadStations();
          }
        }
        if (event.data.type === "NETWORK_STATUS" && event.data.online && intendedPlaying && stationItems?.length && currentIndex < stationItems.length) {
          console.log("Мережа відновлена (SW), пробуємо відтворити");
          debouncedTryAutoPlay();
        }
      });
    }

    let networkCheckInterval = null;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        if (intendedPlaying && stationItems?.length && currentIndex < stationItems.length) {
          localStorage.setItem("lastStationUrl", stationItems[currentIndex].dataset.value);
          networkCheckInterval = setInterval(() => {
            if (navigator.onLine && intendedPlaying) {
              console.log("Мережа доступна в фоновому режимі, пробуємо відтворити");
              debouncedTryAutoPlay();
            }
          }, 5000);
        }
      } else {
        clearInterval(networkCheckInterval);
        if (intendedPlaying && navigator.onLine && stationItems?.length && currentIndex < stationItems.length) {
          console.log("Сторінка знову видима, пробуємо відновити відтворення");
          debouncedTryAutoPlay();
        }
      }
    });

    let autoPlayTimeout = null;
    function debouncedTryAutoPlay(retryCount = 2, delay = 1000) {
      if (isAutoPlayPending) {
        console.log("debouncedTryAutoPlay: Пропуск, попередній виклик tryAutoPlay ще активний");
        return;
      }
      const now = Date.now();
      const currentStationUrl = stationItems?.[currentIndex]?.dataset?.value || localStorage.getItem("lastStationUrl");
      const normalizedCurrentUrl = normalizeUrl(currentStationUrl);
      const normalizedAudioSrc = normalizeUrl(audio.src);
      if (now - lastSuccessfulPlayTime < 500 && normalizedAudioSrc === normalizedCurrentUrl) {
        console.log("debouncedTryAutoPlay: Пропуск, нещодавно відтворення було успішним для тієї ж станції");
        return;
      }
      if (autoPlayTimeout) {
        clearTimeout(autoPlayTimeout);
      }
      autoPlayTimeout = setTimeout(() => tryAutoPlay(retryCount, delay), 0);
    }

    async function tryAutoPlay(retryCount = 2, delay = 1000) {
      if (isAutoPlayPending) {
        console.log("tryAutoPlay: Пропуск, інший виклик tryAutoPlay активний");
        return;
      }
      isAutoPlayPending = true;

      try {
        if (!navigator.onLine) {
          console.log("Пристрій офлайн: пропускання відтворення");
          return;
        }
        if (!intendedPlaying || !stationItems?.length || currentIndex >= stationItems.length) {
          console.log("Пропуск tryAutoPlay: невалідний стан", { intendedPlaying, hasStationItems: !!stationItems?.length, isIndexValid: currentIndex < stationItems.length });
          document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
          return;
        }
        const currentStationUrl = stationItems[currentIndex].dataset.value;
        const initialStationUrl = currentStationUrl;
        const normalizedCurrentUrl = normalizeUrl(currentStationUrl);
        const normalizedAudioSrc = normalizeUrl(audio.src);
        if (normalizedAudioSrc === normalizedCurrentUrl && !audio.paused && !audio.error && audio.readyState >= 2 && audio.currentTime > 0) {
          console.log("Пропуск tryAutoPlay: аудіо вже відтворюється з правильним src, без помилок і активним потоком");
          return;
        }
        if (!isValidUrl(currentStationUrl)) {
          console.error("Невалідний URL:", currentStationUrl);
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
          }
          streamAbortController = new AbortController();

          if (stationItems[currentIndex].dataset.value !== initialStationUrl) {
            console.log("tryAutoPlay: Станція змінилася, скасовуємо відтворення для", initialStationUrl);
            return;
          }

          audio.pause();
          audio.src = null;
          audio.load();
          audio.src = currentStationUrl + "?nocache=" + Date.now();
          console.log(`Спроба відтворення (${attemptsLeft} залишилось):`, audio.src);
          localStorage.setItem("lastStationUrl", currentStationUrl);

          try {
            const response = await fetch(audio.src, { signal: streamAbortController.signal });
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            await audio.play();
            errorCount = 0;
            isPlaying = true;
            lastSuccessfulPlayTime = Date.now();
            console.log("Відтворення розпочато успішно");
            document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
            localStorage.setItem("isPlaying", isPlaying);
          } catch (error) {
            if (error.name === 'AbortError') {
              console.log("Запит до потоку скасовано");
              return;
            }
            console.error("Помилка відтворення:", error);
            document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
            if (attemptsLeft > 1) {
              if (stationItems[currentIndex].dataset.value !== initialStationUrl) {
                console.log("tryAutoPlay: Станція змінилася під час повторної спроби, скасовуємо");
                return;
              }
              console.log(`Повторна спроба через ${delay}ms`);
              await new Promise(resolve => setTimeout(resolve, delay));
              await attemptPlay(attemptsLeft - 1);
            } else {
              errorCount++;
              if (errorCount >= ERROR_LIMIT) {
                console.error("Досягнуто ліміт помилок відтворення");
                resetStationInfo();
              }
            }
          }
        };

        await attemptPlay(retryCount);
      } finally {
        isAutoPlayPending = false;
      }
    }

    function switchTab(tab) {
      const validTabs = ["best", "techno", "trance", "ukraine", "pop", "search", ...customTabs];
      if (!validTabs.includes(tab)) {
        tab = "techno";
      }
      currentTab = tab;
      localStorage.setItem("currentTab", currentTab);
      const savedIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
      const maxIndex = tab === "best" ? favoriteStations.length - 1 : tab === "search" ? 0 : stationLists[currentTab]?.length - 1 || 0;
      currentIndex = savedIndex <= maxIndex && savedIndex >= 0 ? savedIndex : 0;
      searchInput.style.display = tab === "search" ? "flex" : "none";
      searchQuery.value = "";
      searchCountry.value = "";
      searchGenre.value = "";
      if (tab === "search") populateSearchSuggestions();
      updateStationList();
      renderTabs();
      if (stationItems?.length && currentIndex < stationItems.length && intendedPlaying) {
        const normalizedCurrentUrl = normalizeUrl(stationItems[currentIndex].dataset.value);
        const normalizedAudioSrc = normalizeUrl(audio.src);
        if (normalizedAudioSrc !== normalizedCurrentUrl || audio.paused || audio.error || audio.readyState < 2 || audio.currentTime === 0) {
          console.log("switchTab: Запуск відтворення через зміну вкладки");
          isAutoPlayPending = false;
          debouncedTryAutoPlay();
        } else {
          console.log("switchTab: Пропуск відтворення, станція вже відтворюється");
        }
      } else {
        console.log("switchTab: Пропуск відтворення, невалідний стан");
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
        const iconHtml = item.dataset.favicon ? `<img src="${item.dataset.favicon}" alt="${station.name} icon" style="max-width: 32px; max-height: 32px; width: auto; height: auto; object-fit: contain; margin-right: 10px;" onerror="this.outerHTML='🎵 '; console.warn('Помилка завантаження favicon:', '${item.dataset.favicon}');">` : "🎵 ";
        const deleteButton = ["techno", "trance", "ukraine", "pop", ...customTabs].includes(currentTab)
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
      console.log(`Видалено станцію ${stationName} з ${currentTab}, додано до deletedStations:`, deletedStations);
      if (stationLists[currentTab]?.length === 0) {
        currentIndex = 0;
        audio.pause();
        isPlaying = false;
        intendedPlaying = false;
        localStorage.setItem("isPlaying", isPlaying);
        localStorage.setItem("intendedPlaying", intendedPlaying);
        resetStationInfo();
        document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      } else if (currentIndex >= stationLists[currentTab].length) {
        currentIndex = stationLists[currentTab].length - 1;
        changeStation(currentIndex);
      }
      localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
      updateStationList();
      if (intendedPlaying && stationItems?.length && currentIndex < stationItems.length) {
        debouncedTryAutoPlay();
      }
    }

    function changeStation(index) {
      if (!stationItems?.length || index < 0 || index >= stationItems.length) {
        console.log("changeStation: Невалідний індекс або відсутні станції", { index, stationItemsLength: stationItems?.length });
        return;
      }
      currentIndex = index;
      localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
      stationItems.forEach(item => item.classList.remove("selected"));
      stationItems[currentIndex].classList.add("selected");
      const station = stationItems[currentIndex];
      const stationNameElement = currentStationInfo.querySelector(".station-name");
      const stationGenreElement = currentStationInfo.querySelector(".station-genre");
      const stationCountryElement = currentStationInfo.querySelector(".station-country");
      const stationIconElement = currentStationInfo.querySelector(".station-icon");
      if (stationNameElement) stationNameElement.textContent = station.dataset.name || "Unknown";
      if (stationGenreElement) stationGenreElement.textContent = `жанр: ${station.dataset.genre || "-"}`;
      if (stationCountryElement) stationCountryElement.textContent = `країна: ${station.dataset.country || "-"}`;
      if (stationIconElement) {
        if (station.dataset.favicon) {
          stationIconElement.innerHTML = `<img src="${station.dataset.favicon}" alt="${station.dataset.name} icon" style="max-width: 65px; max-height: 65px; width: auto; height: auto; object-fit: contain;" onerror="this.outerHTML='🎵'; console.warn('Помилка завантаження favicon:', '${station.dataset.favicon}');">`;
        } else {
          stationIconElement.innerHTML = "🎵";
        }
      }
      if (intendedPlaying) {
        isAutoPlayPending = false;
        debouncedTryAutoPlay();
      }
    }

    function prevStation() {
      if (stationItems?.length) {
        currentIndex = (currentIndex - 1 + stationItems.length) % stationItems.length;
        changeStation(currentIndex);
      }
    }

    function nextStation() {
      if (stationItems?.length) {
        currentIndex = (currentIndex + 1) % stationItems.length;
        changeStation(currentIndex);
      }
    }

    function togglePlayPause() {
      if (!stationItems?.length || currentIndex >= stationItems.length) {
        console.log("togglePlayPause: Немає станцій для відтворення");
        return;
      }
      intendedPlaying = !intendedPlaying;
      localStorage.setItem("intendedPlaying", intendedPlaying);
      if (intendedPlaying) {
        isAutoPlayPending = false;
        debouncedTryAutoPlay();
        playPauseBtn.textContent = "⏸";
      } else {
        audio.pause();
        isPlaying = false;
        localStorage.setItem("isPlaying", isPlaying);
        document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
        playPauseBtn.textContent = "▶";
      }
    }

    audio.addEventListener("play", () => {
      isPlaying = true;
      localStorage.setItem("isPlaying", isPlaying);
      document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
      playPauseBtn.textContent = "⏸";
    });

    audio.addEventListener("pause", () => {
      isPlaying = false;
      localStorage.setItem("isPlaying", isPlaying);
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      playPauseBtn.textContent = "▶";
    });

    audio.addEventListener("error", (e) => {
      console.error("Помилка аудіо:", e);
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      errorCount++;
      if (errorCount < ERROR_LIMIT) {
        console.log(`Спроба повторного відтворення після помилки (${errorCount}/${ERROR_LIMIT})`);
        debouncedTryAutoPlay();
      } else {
        console.error("Досягнуто ліміт помилок відтворення");
        resetStationInfo();
      }
    });

    audio.addEventListener("volumechange", () => {
      localStorage.setItem("volume", audio.volume);
    });

    window.addEventListener("online", () => {
      console.log("Мережа відновлена (window.online)");
      if (intendedPlaying && stationItems?.length && currentIndex < stationItems.length) {
        debouncedTryAutoPlay();
      }
    });

    window.addEventListener("offline", () => {
      console.log("Втрачено з'єднання з мережею");
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
    });

    applyTheme(currentTheme);
    loadStations();

    if (intendedPlaying && stationItems?.length && currentIndex < stationItems.length) {
      debouncedTryAutoPlay();
    }
  }
});