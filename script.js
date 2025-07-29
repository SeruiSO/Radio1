let currentTab = localStorage.getItem("currentTab") || "favorites";
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let recentStations = JSON.parse(localStorage.getItem("recentStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let intendedPlaying = localStorage.getItem("intendedPlaying") === "true" || false;
let stationLists = JSON.parse(localStorage.getItem("stationLists")) || {};
let userAddedStations = JSON.parse(localStorage.getItem("userAddedStations")) || {};
let stationItems = [];
let abortController = new AbortController();
let errorCount = 0;
const ERROR_LIMIT = 7;
let pastSearches = JSON.parse(localStorage.getItem("pastSearches")) || [];
let deletedStations = JSON.parse(localStorage.getItem("deletedStations")) || [];
let customTabs = JSON.parse(localStorage.getItem("customTabs")) || [];
let isAutoPlayPending = false;
let lastSuccessfulPlayTime = 0;
let streamAbortController = null;
let errorTimeout = null;
let autoPlayRequestId = 0;
let searchTimeout = null;
customTabs = Array.isArray(customTabs) ? customTabs.filter(tab => typeof tab === "string" && tab.trim()) : [];

document.addEventListener("DOMContentLoaded", () => {
  const audio = document.createElement("audio");
  audio.id = "audioPlayer";
  document.body.appendChild(audio);
  const stationList = document.querySelector(".station-list");
  const playPauseBtn = document.querySelector(".control-btn.play-btn");
  const currentStationInfo = document.querySelector("#currentStationInfo");
  const themeToggle = document.querySelector(".theme-toggle");
  const shareButton = document.querySelector(".share-button");
  const exportButton = document.querySelector(".export-button");
  const importButton = document.querySelector(".import-button");
  const importFileInput = document.querySelector("#importFileInput");
  const searchInput = document.querySelector("#searchInput");
  const searchQuery = document.querySelector("#searchQuery");
  const searchCountry = document.querySelector("#searchCountry");
  const searchGenre = document.querySelector("#searchGenre");
  const searchBtn = document.querySelector(".search-btn");
  const tabsContainer = document.querySelector(".tabs");
  const volumeControl = document.querySelector(".volume-control input");

  if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle || !shareButton || !exportButton || !importButton || !importFileInput || !searchInput || !searchQuery || !searchCountry || !searchGenre || !searchBtn || !tabsContainer || !volumeControl) {
    console.error("Required DOM elements missing", {
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
      tabsContainer: !!tabsContainer,
      volumeControl: !!volumeControl
    });
    setTimeout(initializeApp, 100);
    return;
  }

  initializeApp();

  function initializeApp() {
    audio.preload = "auto";
    audio.volume = parseFloat(localStorage.getItem("volume")) || 0.5;
    volumeControl.value = audio.volume * 100;

    updatePastSearches();
    populateSearchSuggestions();
    renderTabs();
    setupSwipeGestures();

    shareButton.addEventListener("click", () => {
      const stationName = currentStationInfo.querySelector(".station-name")?.textContent || "Radio Music";
      const shareData = {
        title: "Radio Music",
        text: `Слухаю ${stationName} на Radio Music! Приєднуйся!`,
        url: window.location.href
      };
      if (navigator.share) {
        navigator.share(shareData).catch(error => console.error("Помилка поширення:", error));
      } else {
        alert(`Функція поширення не підтримується. Скопіюйте: ${shareData.text} ${shareData.url}`);
      }
    });

    exportButton.addEventListener("click", exportSettings);
    importButton.addEventListener("click", () => importFileInput.click());
    importFileInput.addEventListener("change", importSettings);

    document.querySelector(".control-btn.prev-btn").addEventListener("click", prevStation);
    document.querySelector(".control-btn.play-btn").addEventListener("click", togglePlayPause);
    document.querySelector(".control-btn.next-btn").addEventListener("click", nextStation);

    volumeControl.addEventListener("input", () => {
      audio.volume = volumeControl.value / 100;
      localStorage.setItem("volume", audio.volume);
      currentStationInfo.setAttribute("aria-label", `Поточна станція: ${currentStationInfo.querySelector(".station-name")?.textContent || "Немає"}, гучність: ${Math.round(audio.volume * 100)}%`);
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
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => searchStations(query, country, genre), 300);
      } else {
        stationList.innerHTML = "<div class='station-item empty'>Введіть назву, країну або жанр</div>";
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

    function setupSwipeGestures() {
      let touchStartX = 0;
      let touchEndX = 0;
      stationList.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].screenX;
      });
      stationList.addEventListener("touchend", (e) => {
        touchEndX = e.changedTouches[0].screenX;
        if (touchStartX - touchEndX > 50) nextStation();
        if (touchEndX - touchStartX > 50) prevStation();
      });
    }

    function exportSettings() {
      const settings = {
        selectedTheme: "cyber-grid",
        customTabs,
        userAddedStations,
        favoriteStations,
        recentStations,
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
      reader.onload = (e) => {
        try {
          const settings = JSON.parse(e.target.result);
          if (!settings || typeof settings !== "object") {
            alert("Невірний формат файлу!");
            return;
          }
          if (Array.isArray(settings.customTabs)) {
            const validTabs = settings.customTabs.filter(tab =>
              typeof tab === "string" &&
              tab.trim() &&
              tab.length <= 10 &&
              /^[a-z0-9_-]+$/.test(tab) &&
              !["favorites", "recent", "search"].includes(tab) &&
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
              if (["favorites", "recent", ...customTabs].includes(tab)) {
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
          if (Array.isArray(settings.recentStations)) {
            recentStations = settings.recentStations.filter(s =>
              s && typeof s === "object" &&
              s.name && typeof s.name === "string" &&
              s.value && isValidUrl(s.value)
            ).slice(0, 5);
            localStorage.setItem("recentStations", JSON.stringify(recentStations));
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
          if (settings.currentTab && ["favorites", "recent", "search", ...customTabs].includes(settings.currentTab)) {
            currentTab = settings.currentTab;
            localStorage.setItem("currentTab", currentTab);
          }
          loadStations();
          switchTab(currentTab);
          alert("Налаштування успішно імпортовано!");
        } catch (error) {
          console.error("Помилка імпорту:", error);
          alert("Помилка імпорту. Перевірте формат файлу.");
        }
        importFileInput.value = "";
      };
      reader.readAsText(file);
    }

    function populateSearchSuggestions() {
      const suggestedCountries = [
        "Україна", "Німеччина", "Франція", "Велика Британія", "Італія", "Іспанія",
        "Нідерланди", "Швейцарія", "Бельгія", "Швеція", "Норвегія", "Данія",
        "Австрія", "Польща", "Канада", "США", "Австралія", "Японія", "Південна Корея"
      ];
      const suggestedGenres = [
        "Поп", "Рок", "Танцювальна", "Електронна", "Техно", "Транс", "Хаус",
        "EDM", "Хіп-хоп", "Реп", "Джаз", "Класика", "Кантрі", "Реггі",
        "Блюз", "Фолк", "Метал", "R&B", "Соул", "Ембієнт"
      ];

      const countryDatalist = document.getElementById("countries");
      const genreDatalist = document.getElementById("genres");

      countryDatalist.innerHTML = suggestedCountries.map(country => `<option value="${country}">`).join("");
      genreDatalist.innerHTML = suggestedGenres.map(genre => `<option value="${genre}">`).join("");
    }

    function updatePastSearches() {
      const pastSearchesList = document.getElementById("pastSearches");
      if (pastSearchesList) {
        pastSearchesList.innerHTML = pastSearches.map(search => `<option value="${search}">`).join("");
      }
    }

    function normalizeCountry(country) {
      if (!country) return "";
      const countryMap = {
        "україна": "Україна", "ukraine": "Україна",
        "німеччина": "Німеччина", "germany": "Німеччина",
        "франція": "Франція", "france": "Франція",
        "велика британія": "Велика Британія", "uk": "Велика Британія",
        "італія": "Італія", "italy": "Італія",
        "іспанія": "Іспанія", "spain": "Іспанія",
        "нідерланди": "Нідерланди", "netherlands": "Нідерланди",
        "швейцарія": "Швейцарія", "switzerland": "Швейцарія",
        "бельгія": "Бельгія", "belgium": "Бельгія",
        "швеція": "Швеція", "sweden": "Швеція",
        "норвегія": "Норвегія", "norway": "Норвегія",
        "данія": "Данія", "denmark": "Данія",
        "австрія": "Австрія", "austria": "Австрія",
        "польща": "Польща", "poland": "Польща",
        "канада": "Канада", "canada": "Канада",
        "сша": "США", "usa": "США",
        "австралія": "Австралія", "australia": "Австралія",
        "японія": "Японія", "japan": "Японія",
        "південна корея": "Південна Корея", "south korea": "Південна Корея"
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
      if (stationGenreElement) stationGenreElement.textContent = "жанр: -";
      if (stationCountryElement) stationCountryElement.textContent = "країна: -";
      if (stationIconElement) {
        stationIconElement.innerHTML = "🎵";
        stationIconElement.style.backgroundImage = "none";
      }
      currentStationInfo.setAttribute("aria-label", "Поточна станція: Обирайте станцію");
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
        recentStations = recentStations.filter(s =>
          Object.values(stationLists).flat().some(st => st.name === s.name && st.value === s.value)
        );
        localStorage.setItem("recentStations", JSON.stringify(recentStations));
        const validTabs = ["favorites", "recent", "search", ...customTabs];
        if (!validTabs.includes(currentTab)) {
          currentTab = "favorites";
          localStorage.setItem("currentTab", currentTab);
        }
        currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
        switchTab(currentTab);
      } catch (error) {
        if (error.name !== "AbortError") {
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
        const response = await fetch(url, { signal: abortController.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        let stations = await response.json();
        stations = stations.filter(station => station.url_resolved && isValidUrl(station.url_resolved));
        renderSearchResults(stations);
      } catch (error) {
        if (error.name !== "AbortError") {
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
        item.dataset.name = station.name || "Невідома";
        item.dataset.genre = shortenGenre(station.tags || "Невідомий");
        item.dataset.country = station.country || "Невідома";
        item.dataset.favicon = station.favicon && isValidUrl(station.favicon) ? station.favicon : "";
        const iconHtml = item.dataset.favicon ? `<img src="${item.dataset.favicon}" alt="${station.name} icon" onerror="this.outerHTML='🎵'">` : "🎵";
        item.innerHTML = `
          ${iconHtml}
          <span class="station-name">${station.name}</span>
          <div class="buttons-container">
            <button class="add-btn">Додати</button>
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
      const overlay = document.querySelector(".modal-overlay");
      const modal = document.querySelector(".new-tab-modal");
      modal.innerHTML = `
        <h2>Обрати вкладку</h2>
        <div class="modal-tabs">
          <button class="modal-tab-btn" data-tab="favorites">Favorites</button>
          <button class="modal-tab-btn" data-tab="recent">Recent</button>
          ${customTabs.map(tab => `<button class="modal-tab-btn" data-tab="${tab}">${tab.toUpperCase()}</button>`).join('')}
          <button class="modal-cancel-btn">Відміна</button>
        </div>`;
      overlay.style.display = "block";
      modal.style.display = "block";
      const closeModal = () => {
        overlay.style.display = "none";
        modal.style.display = "none";
      };
      overlay.addEventListener("click", closeModal, { once: true });
      modal.querySelectorAll(".modal-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          saveStation(item, btn.dataset.tab);
          closeModal();
        }, { once: true });
      });
      modal.querySelector(".modal-cancel-btn").addEventListener("click", closeModal, { once: true });
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
        if (targetTab === "recent") {
          recentStations.unshift(newStation);
          if (recentStations.length > 5) recentStations.pop();
          localStorage.setItem("recentStations", JSON.stringify(recentStations));
        }
        if (currentTab !== "search") updateStationList();
      } else {
        alert("Ця станція вже додана до обраної вкладки!");
      }
    }

    function renderTabs() {
      const fixedTabs = ["favorites", "recent", "search"];
      tabsContainer.innerHTML = "";
      fixedTabs.forEach(tab => {
        const btn = document.createElement("button");
        btn.className = `tab-btn ${currentTab === tab ? "active" : ""}`;
        btn.dataset.tab = tab;
        btn.textContent = tab === "favorites" ? "Favorites" : tab === "recent" ? "Recent" : "Search";
        btn.setAttribute("aria-label", `Вкладка ${btn.textContent}`);
        tabsContainer.appendChild(btn);
      });
      customTabs.forEach(tab => {
        if (typeof tab !== "string" || !tab.trim()) return;
        const btn = document.createElement("button");
        btn.className = `tab-btn ${currentTab === tab ? "active" : ""}`;
        btn.dataset.tab = tab;
        btn.textContent = tab.toUpperCase();
        btn.setAttribute("aria-label", `Вкладка ${tab.toUpperCase()}`);
        tabsContainer.appendChild(btn);
      });
      const addBtn = document.createElement("button");
      addBtn.className = "add-tab-btn";
      addBtn.textContent = "+";
      addBtn.setAttribute("aria-label", "Додати нову вкладку");
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
      const overlay = document.querySelector(".modal-overlay");
      const modal = document.querySelector(".new-tab-modal");
      modal.innerHTML = `
        <h2>Створити нову вкладку</h2>
        <div class="modal-tabs">
          <input type="text" id="newTabName" placeholder="Назва вкладки">
          <button class="modal-tab-btn" id="createTabBtn">Створити</button>
          <button class="modal-cancel-btn">Відміна</button>
        </div>`;
      overlay.style.display = "block";
      modal.style.display = "block";
      const input = modal.querySelector("#newTabName");
      const createBtn = modal.querySelector("#createTabBtn");
      const cancelBtn = modal.querySelector(".modal-cancel-btn");
      input.focus();

      const closeModal = () => {
        overlay.style.display = "none";
        modal.style.display = "none";
      };

      const createTabHandler = () => {
        const tabName = input.value.trim().toLowerCase();
        if (!tabName) {
          alert("Введіть назву вкладки!");
          return;
        }
        if (["favorites", "recent", "search"].includes(tabName) || customTabs.includes(tabName)) {
          alert("Ця назва вкладки вже існує!");
          return;
        }
        if (tabName.length > 10 || !/^[a-z0-9_-]+$/.test(tabName)) {
          alert("Назва вкладки не може перевищувати 10 символів і повинна містити лише латинські літери, цифри, дефіс або підкреслення.");
          return;
        }
        if (customTabs.length >= 7) {
          alert("Досягнуто максимум 7 власних вкладок!");
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

      createBtn.addEventListener("click", createTabHandler, { once: true });
      cancelBtn.addEventListener("click", closeModal, { once: true });
      overlay.addEventListener("click", closeModal, { once: true });
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") createTabHandler();
      }, { once: true });
    }

    function showEditTabModal(tab) {
      const overlay = document.querySelector(".modal-overlay");
      const modal = document.querySelector(".edit-tab-modal");
      modal.innerHTML = `
        <h2>Дії з вкладкою</h2>
        <div class="modal-tabs">
          <input type="text" id="renameTabName" placeholder="Нова назва вкладки" value="${tab}">
          <button class="modal-tab-btn rename-btn">Перейменувати</button>
          <button class="modal-tab-btn delete-btn">Видалити</button>
          <button class="modal-cancel-btn">Відміна</button>
        </div>`;
      overlay.style.display = "block";
      modal.style.display = "block";
      const input = modal.querySelector("#renameTabName");
      const renameBtn = modal.querySelector(".rename-btn");
      const deleteBtn = modal.querySelector(".delete-btn");
      const cancelBtn = modal.querySelector(".modal-cancel-btn");
      input.focus();

      const closeModal = () => {
        overlay.style.display = "none";
        modal.style.display = "none";
      };

      const renameTabHandler = () => {
        const newName = input.value.trim().toLowerCase();
        if (!newName) {
          alert("Введіть нову назву вкладки!");
          return;
        }
        if (["favorites", "recent", "search"].includes(newName) || customTabs.includes(newName)) {
          alert("Ця назва вкладки вже існує!");
          return;
        }
        if (newName.length > 10 || !/^[a-z0-9_-]+$/.test(newName)) {
          alert("Назва вкладки не може перевищувати 10 символів і повинна містити лише латинські літери, цифри, дефіс або підкреслення!");
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
          if (currentTab === tab) switchTab("favorites");
          renderTabs();
          closeModal();
        }
      };

      renameBtn.addEventListener("click", renameTabHandler, { once: true });
      deleteBtn.addEventListener("click", deleteTabHandler, { once: true });
      cancelBtn.addEventListener("click", closeModal, { once: true });
      overlay.addEventListener("click", closeModal, { once: true });
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") renameTabHandler();
      }, { once: true });
    }

    function applyTheme() {
      document.documentElement.setAttribute("data-theme", "cyber-grid");
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) themeColorMeta.setAttribute("content", "#0D1B2A");
    }

    function toggleTheme() {
      // Зарезервовано для майбутнього розширення тем
      applyTheme();
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
          const currentCacheVersion = localStorage.getItem("cacheVersion") || "0";
          if (currentCacheVersion !== event.data.cacheVersion) {
            favoriteStations = favoriteStations.filter(name =>
              Object.values(stationLists).flat().some(s => s.name === name)
            );
            recentStations = recentStations.filter(s =>
              Object.values(stationLists).flat().some(st => st.name === s.name && st.value === s.value)
            );
            localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
            localStorage.setItem("recentStations", JSON.stringify(recentStations));
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
        if (!navigator.onLine) {
          console.log("Пристрій офлайн: пропуск відтворення");
          return;
        }
        if (!intendedPlaying || !stationItems?.length || currentIndex >= stationItems.length) {
          document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
          return;
        }
        const currentStationUrl = stationItems[currentIndex].dataset.value;
        const initialStationUrl = currentStationUrl;
        const normalizedCurrentUrl = normalizeUrl(currentStationUrl);
        const normalizedAudioSrc = normalizeUrl(audio.src);
        if (normalizedAudioSrc === normalizedCurrentUrl && !audio.paused && !audio.error && audio.readyState >= 2 && audio.currentTime > 0) {
          return;
        }
        if (!isValidUrl(currentStationUrl)) {
          errorCount++;
          if (errorCount >= ERROR_LIMIT) resetStationInfo();
          return;
        }

        const attemptPlay = async (attemptsLeft) => {
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

          try {
            await audio.play();
            errorCount = 0;
            isPlaying = true;
            lastSuccessfulPlayTime = Date.now();
            document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
            localStorage.setItem("isPlaying", isPlaying);
            if (stationItems[currentIndex]) {
              updateCurrentStation(stationItems[currentIndex]);
            }
          } catch (error) {
            if (error.name === "AbortError") return;
            document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
            if (attemptsLeft > 1) {
              if (stationItems[currentIndex].dataset.value !== initialStationUrl || requestId !== autoPlayRequestId) return;
              await new Promise(resolve => setTimeout(resolve, delay));
              await attemptPlay(attemptsLeft - 1);
            } else {
              errorCount++;
              if (errorCount >= ERROR_LIMIT) resetStationInfo();
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
      const validTabs = ["favorites", "recent", "search", ...customTabs];
      if (!validTabs.includes(tab)) tab = "favorites";
      currentTab = tab;
      localStorage.setItem("currentTab", tab);
      const savedIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
      const maxIndex = tab === "favorites" ? favoriteStations.length - 1 : tab === "recent" ? recentStations.length - 1 : tab === "search" ? 0 : stationLists[tab]?.length - 1 || 0;
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
          isAutoPlayPending = false;
          debouncedTryAutoPlay();
        }
      }
    }

    function updateStationList() {
      if (!stationList) return;
      let stations = currentTab === "favorites"
        ? favoriteStations.map(name => Object.values(stationLists).flat().find(s => s.name === name)).filter(s => s)
        : currentTab === "recent"
        ? recentStations
        : stationLists[currentTab] || [];

      if (!stations.length) {
        currentIndex = 0;
        stationItems = [];
        stationList.innerHTML = `<div class="station-item empty">${currentTab === "favorites" ? "Немає улюблених станцій" : currentTab === "recent" ? "Немає нещодавніх станцій" : "Немає станцій у цій категорії"}</div>`;
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
        const iconHtml = item.dataset.favicon ? `<img src="${item.dataset.favicon}" alt="${station.name} icon" onerror="this.outerHTML='🎵'">` : "🎵";
        const deleteButton = ["favorites", "recent", ...customTabs].includes(currentTab)
          ? `<button class="delete-btn">🗑</button>`
          : "";
        item.innerHTML = `
          ${iconHtml}
          <span class="station-name">${station.name}</span>
          <div class="buttons-container">
            ${deleteButton}
            <button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}">★</button>
          </div>`;
        item.setAttribute("aria-label", `Станція ${station.name}, жанр: ${station.genre}, країна: ${station.country}`);
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
          if (confirm(`Ви впевнені, що хочете видалити станцію "${item.dataset.name}"?`)) {
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
      if (currentTab === "favorites") switchTab("favorites");
      else updateStationList();
    }

    function deleteStation(stationName) {
      if (Array.isArray(stationLists[currentTab])) {
        const station = stationLists[currentTab].find(s => s.name === stationName);
        if (!station) return;
        stationLists[currentTab] = stationLists[currentTab].filter(s => s.name !== stationName);
        userAddedStations[currentTab] = userAddedStations[currentTab]?.filter(s => s.name !== stationName) || [];
        if (currentTab === "recent") {
          recentStations = recentStations.filter(s => s.name !== stationName);
          localStorage.setItem("recentStations", JSON.stringify(recentStations));
        }
        if (!station.isFromSearch && !deletedStations.includes(stationName)) {
          deletedStations.push(stationName);
          localStorage.setItem("deletedStations", JSON.stringify(deletedStations));
        }
        localStorage.setItem("stationLists", JSON.stringify(stationLists));
        localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
        favoriteStations = favoriteStations.filter(name => name !== stationName);
        localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
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
          isAutoPlayPending = false;
          debouncedTryAutoPlay();
          if (currentTab !== "recent") {
            const newStation = {
              value: item.dataset.value,
              name: item.dataset.name,
              genre: item.dataset.genre,
              country: item.dataset.country,
              favicon: item.dataset.favicon
            };
            recentStations = recentStations.filter(s => s.name !== newStation.name);
            recentStations.unshift(newStation);
            if (recentStations.length > 5) recentStations.pop();
            localStorage.setItem("recentStations", JSON.stringify(recentStations));
          }
        }
      }
    }

    function updateCurrentStation(item) {
      if (!currentStationInfo || !item.dataset) {
        resetStationInfo();
        return;
      }
      const stationNameElement = currentStationInfo.querySelector(".station-name");
      const stationGenreElement = currentStationInfo.querySelector(".station-genre");
      const stationCountryElement = currentStationInfo.querySelector(".station-country");
      const stationIconElement = currentStationInfo.querySelector(".station-icon");

      if (stationNameElement) stationNameElement.textContent = item.dataset.name || "";
      if (stationGenreElement) stationGenreElement.textContent = `жанр: ${item.dataset.genre || ""}`;
      if (stationCountryElement) stationCountryElement.textContent = `країна: ${item.dataset.country || ""}`;
      if (stationIconElement) {
        if (item.dataset.favicon && isValidUrl(item.dataset.favicon)) {
          stationIconElement.innerHTML = "";
          stationIconElement.style.backgroundImage = `url(${item.dataset.favicon})`;
        } else {
          stationIconElement.innerHTML = "🎵";
          stationIconElement.style.backgroundImage = "none";
        }
      }
      currentStationInfo.setAttribute("aria-label", `Поточна станція: ${item.dataset.name || "Немає"}, гучність: ${Math.round(audio.volume * 100)}%`);

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
      if (!playPauseBtn || !audio) return;
      if (audio.paused) {
        isPlaying = true;
        intendedPlaying = true;
        debouncedTryAutoPlay();
        playPauseBtn.querySelector("span").className = "icon-pause";
        playPauseBtn.querySelector("span").textContent = "⏸";
        document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
      } else {
        audio.pause();
        isPlaying = false;
        intendedPlaying = false;
        playPauseBtn.querySelector("span").className = "icon-play";
        playPauseBtn.querySelector("span").textContent = "▶";
        document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
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
        if (document.hidden || !intendedPlaying || !navigator.onLine || !stationItems?.length || currentIndex >= stationItems.length) return;
        const normalizedCurrentUrl = normalizeUrl(stationItems[currentIndex].dataset.value);
        const normalizedAudioSrc = normalizeUrl(audio.src);
        if (normalizedAudioSrc === normalizedCurrentUrl && !audio.paused && !audio.error && audio.readyState >= 2 && audio.currentTime > 0) return;
        isAutoPlayPending = false;
        debouncedTryAutoPlay();
      },
      resume: () => {
        if (!intendedPlaying || !navigator.onLine || !stationItems?.length || currentIndex >= stationItems.length) return;
        const normalizedCurrentUrl = normalizeUrl(stationItems[currentIndex].dataset.value);
        const normalizedAudioSrc = normalizeUrl(audio.src);
        if (normalizedAudioSrc === normalizedCurrentUrl && !audio.paused && !audio.error && audio.readyState >= 2 && audio.currentTime > 0) return;
        isAutoPlayPending = false;
        debouncedTryAutoPlay();
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
      playPauseBtn.querySelector("span").className = "icon-pause";
      playPauseBtn.querySelector("span").textContent = "⏸";
      document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
      localStorage.setItem("isPlaying", isPlaying);
      if (errorTimeout) {
        clearTimeout(errorTimeout);
        errorTimeout = null;
      }
    });

    audio.addEventListener("pause", () => {
      isPlaying = false;
      playPauseBtn.querySelector("span").className = "icon-play";
      playPauseBtn.querySelector("span").textContent = "▶";
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      localStorage.setItem("isPlaying", isPlaying);
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = null;
      }
    });

    audio.addEventListener("error", () => {
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      if (intendedPlaying && errorCount < ERROR_LIMIT && !errorTimeout) {
        errorCount++;
        errorTimeout = setTimeout(() => {
          debouncedTryAutoPlay();
          errorTimeout = null;
        }, 1000);
      } else if (errorCount >= ERROR_LIMIT) {
        resetStationInfo();
      }
    });

    audio.addEventListener("volumechange", () => {
      volumeControl.value = audio.volume * 100;
      localStorage.setItem("volume", audio.volume);
      currentStationInfo.setAttribute("aria-label", `Поточна станція: ${currentStationInfo.querySelector(".station-name")?.textContent || "Немає"}, гучність: ${Math.round(audio.volume * 100)}%`);
    });

    window.addEventListener("online", () => {
      if (intendedPlaying && stationItems?.length && currentIndex < stationItems.length) {
        isAutoPlayPending = false;
        debouncedTryAutoPlay();
      }
    });

    window.addEventListener("offline", () => {
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
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

    applyTheme();
    loadStations();
    if (intendedPlaying && stationItems?.length && currentIndex < stationItems.length) {
      const normalizedCurrentUrl = normalizeUrl(stationItems[currentIndex].dataset.value);
      const normalizedAudioSrc = normalizeUrl(audio.src);
      if (normalizedAudioSrc !== normalizedCurrentUrl || audio.paused || audio.error || audio.readyState < 2 || audio.currentTime === 0) {
        isAutoPlayPending = false;
        debouncedTryAutoPlay();
      }
    }
  }
});