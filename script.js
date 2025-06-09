document.addEventListener("DOMContentLoaded", () => {
  const audio = document.getElementById("audioPlayer");
  const stationList = document.getElementById("stationList");
  const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
  const currentStationInfo = document.getElementById("currentStationInfo");
  const searchInput = document.getElementById("searchInput");
  const stationIcon = document.getElementById("stationIcon");

  let currentTab = localStorage.getItem("currentTab") || "techno";
  let currentIndex = 0;
  let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || { best: [], techno: [], trance: [], ua: [], pop: [] };
  let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
  let stationItems = [];
  let stationsCache = {};

  // Отримання випадкового сервера Radio Browser
  async function getRandomServer() {
    const response = await fetch("https://all.api.radio-browser.info/servers");
    const servers = await response.json();
    return servers[Math.floor(Math.random() * servers.length)];
  }

  // Завантаження станцій з Radio Browser
  async function loadStations() {
    stationList.innerHTML = "<div class='station-item empty'>Завантаження...</div>";
    try {
      const server = await getRandomServer();
      const baseUrl = `https://${server.name}`;
      const response = await fetch(`${baseUrl}/json/stations?limit=1000&hidebroken=true`);
      if (response.ok) {
        const stations = await response.json();
        stationsCache = {
          best: stations.filter(s => favoriteStations.best.includes(s.stationuuid)),
          techno: stations.filter(s => s.tags.includes("techno")),
          trance: stations.filter(s => s.tags.includes("trance")),
          ua: stations.filter(s => s.countrycode === "UA"),
          pop: stations.filter(s => s.tags.includes("pop")),
          search: []
        };
        filterAndUpdateStations();
      } else {
        throw new Error("Помилка завантаження станцій");
      }
    } catch (error) {
      stationList.innerHTML = "<div class='station-item empty'>Не вдалося завантажити станції</div>";
    }
  }

  // Фільтрація станцій
  function filterStations(query, tab) {
    let filtered = stationsCache[tab] || [];
    if (query && tab === "search") {
      query = query.toLowerCase();
      filtered = stationsCache.search.filter(station =>
        station.name.toLowerCase().includes(query) ||
        station.tags.join(" ").toLowerCase().includes(query) ||
        station.country.toLowerCase().includes(query)
      );
    }
    return filtered;
  }

  // Оновлення списку станцій
  function filterAndUpdateStations() {
    const query = searchInput.value.trim();
    const tab = currentTab === "search" ? "search" : currentTab;
    let stations = filterStations(query, tab);

    if (!stations.length) {
      currentIndex = 0;
      stationItems = [];
      stationList.innerHTML = `<div class='station-item empty'>${tab === "best" ? "Немає улюблених станцій" : "Немає станцій"}</div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    stations.forEach((station, index) => {
      const item = document.createElement("div");
      item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
      item.dataset.uuid = station.stationuuid;
      item.dataset.name = station.name;
      item.dataset.genre = station.tags.join(", ") || "-";
      item.dataset.country = station.country || "-";
      item.dataset.url = station.url_resolved || station.url;
      item.dataset.icon = station.favicon || `https://via.placeholder.com/30?text=${encodeURIComponent(station.name)}`;
      item.innerHTML = `<img src="${item.dataset.icon}" alt="${station.name} Icon" class="station-item-icon"> ${station.name}<button class="favorite-btn${favoriteStations[tab].includes(station.stationuuid) ? " favorited" : ""}">★</button>`;
      fragment.appendChild(item);
    });
    stationList.innerHTML = "";
    stationList.appendChild(fragment);
    stationItems = stationList.querySelectorAll(".station-item");

    stationList.onclick = (e) => {
      const item = e.target.closest(".station-item");
      const favoriteBtn = e.target.closest(".favorite-btn");
      if (item && !item.classList.contains("empty")) {
        currentIndex = Array.from(stationItems).indexOf(item);
        changeStation(currentIndex);
      }
      if (favoriteBtn) {
        e.stopPropagation();
        showTabSelector(item);
      }
    };

    if (stationItems.length && currentIndex < stationItems.length) {
      changeStation(currentIndex);
    }
  }

  // Показати селектор вкладок для додавання улюблених
  function showTabSelector(item) {
    const uuid = item.dataset.uuid;
    const tabs = ["best", "techno", "trance", "ua", "pop"];
    const dialog = document.createElement("div");
    dialog.className = "tab-selector";
    dialog.innerHTML = tabs.map(tab => `<button class="tab-select-btn" data-tab="${tab}">${tab.toUpperCase()}</button>`).join("");
    document.body.appendChild(dialog);

    dialog.onclick = (e) => {
      const btn = e.target.closest(".tab-select-btn");
      if (btn) {
        const tab = btn.dataset.tab;
        if (!favoriteStations[tab].includes(uuid)) {
          favoriteStations[tab].push(uuid);
          localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
          if (currentTab === "best") switchTab("best");
          else filterAndUpdateStations();
        }
        document.body.removeChild(dialog);
      }
    };
  }

  // Перемикання вкладок
  function switchTab(tab) {
    currentTab = tab;
    currentIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
    document.querySelectorAll(".tab-btn").forEach((btn, index) => btn.classList.toggle("active", ["BEST", "TECHNO", "TRANCE", "UA", "POP", "SEARCH"][index] === tab.toUpperCase()));
    searchInput.value = "";
    filterAndUpdateStations();
    localStorage.setItem("currentTab", tab);
  }

  // Зміна станції
  function changeStation(index) {
    if (index < 0 || index >= stationItems.length || stationItems[index].classList.contains("empty")) return;
    const item = stationItems[index];
    stationItems.forEach(i => i.classList.remove("selected"));
    item.classList.add("selected");
    currentIndex = index;
    updateCurrentStationInfo(item);
    localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
    tryAutoPlay();
    fetchClickCount(item.dataset.uuid);
  }

  // Оновлення інформації про станцію
  function updateCurrentStationInfo(item) {
    stationIcon.src = item.dataset.icon;
    currentStationInfo.querySelector(".station-name").textContent = item.dataset.name;
    currentStationInfo.querySelector(".station-genre").textContent = `жанр: ${item.dataset.genre}`;
    currentStationInfo.querySelector(".station-country").textContent = `країна: ${item.dataset.country}`;
    currentStationInfo.querySelector(".station-artist").textContent = `виконавець: -`;
    currentStationInfo.querySelector(".station-title").textContent = `трек: -`;

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: item.dataset.name,
        artist: "-",
        artwork: [{ src: item.dataset.icon, sizes: "30x30", type: "image/png" }]
      });
    }

    audio.src = item.dataset.url;
    audio.play().then(() => {
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
    }).catch(() => console.error("Помилка відтворення"));
  }

  // Збільшення лічильника кліків
  async function fetchClickCount(uuid) {
    const server = await getRandomServer();
    fetch(`https://${server.name}/json/url/${uuid}`, { method: "POST" })
      .catch(() => console.error("Помилка оновлення кліків"));
  }

  // Відтворення
  function tryAutoPlay() {
    if (isPlaying && stationItems.length) {
      audio.play().catch(() => console.error("Помилка відтворення"));
    }
  }

  // Керування
  function togglePlayPause() {
    if (audio.paused) {
      isPlaying = true;
      tryAutoPlay();
      playPauseBtn.textContent = "⏸";
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
    } else {
      audio.pause();
      isPlaying = false;
      playPauseBtn.textContent = "▶";
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    }
    localStorage.setItem("isPlaying", isPlaying);
  }

  function prevStation() { changeStation(currentIndex > 0 ? currentIndex - 1 : stationItems.length - 1); }
  function nextStation() { changeStation(currentIndex < stationItems.length - 1 ? currentIndex + 1 : 0); }

  // Обробники подій
  searchInput.addEventListener("input", () => {
    if (currentTab === "search") filterAndUpdateStations();
    else switchTab("search");
  });
  document.querySelectorAll(".tab-btn").forEach((btn, index) => {
    btn.addEventListener("click", () => switchTab(["best", "techno", "trance", "ua", "pop", "search"][index]));
  });
  document.querySelector(".controls .control-btn:nth-child(1)").addEventListener("click", prevStation);
  document.querySelector(".controls .control-btn:nth-child(2)").addEventListener("click", togglePlayPause);
  document.querySelector(".controls .control-btn:nth-child(3)").addEventListener("click", nextStation);

  // Ініціалізація
  loadStations();
  switchTab(currentTab);

  // Оновлення метаданих
  audio.addEventListener("timeupdate", () => {
    if ("mediaSession" in navigator && stationItems[currentIndex]) {
      fetch(`https://${(await getRandomServer()).name}/json/url/${stationItems[currentIndex].dataset.uuid}`)
        .then(res => res.json())
        .then(data => {
          navigator.mediaSession.metadata.title = data.name;
          navigator.mediaSession.metadata.artist = data.artist || "-";
        })
        .catch(() => {});
    }
  });
});