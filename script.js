document.addEventListener("DOMContentLoaded", () => {
  const audio = document.getElementById("audioPlayer");
  const stationList = document.getElementById("stationList");
  const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
  const currentStationInfo = document.getElementById("currentStationInfo");
  const searchInput = document.getElementById("searchInput");
  const stationIcon = document.getElementById("stationIcon");

  let currentTab = localStorage.getItem("currentTab") || "techno";
  let currentIndex = 0;
  let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
  let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
  let stationLists = {};
  let stationItems = [];

  // Завантаження станцій із іконками
  async function loadStations() {
    stationList.innerHTML = "<div class='station-item empty'>Завантаження...</div>";
    try {
      const response = await fetch("stations.json?t=" + Date.now(), { cache: "no-cache" });
      if (response.ok) {
        stationLists = await response.json();
        // Додаємо іконки (поки за замовчуванням, можна розширити)
        Object.keys(stationLists).forEach(category => {
          stationLists[category] = stationLists[category].map(station => ({
            ...station,
            icon: `https://via.placeholder.com/60?text=${encodeURIComponent(station.name)}`
          }));
        });
        filterAndUpdateStations();
      } else {
        throw new Error("Помилка завантаження станцій");
      }
    } catch (error) {
      stationList.innerHTML = "<div class='station-item empty'>Не вдалося завантажити станції</div>";
    }
  }

  // Фільтрація станцій
  function filterStations(query) {
    let allStations = Object.values(stationLists).flat();
    if (query) {
      query = query.toLowerCase();
      allStations = allStations.filter(station =>
        station.name.toLowerCase().includes(query) ||
        station.genre.toLowerCase().includes(query) ||
        station.country.toLowerCase().includes(query)
      );
    }
    return currentTab === "best" ? allStations.filter(s => favoriteStations.includes(s.name)) : allStations;
  }

  // Оновлення списку станцій
  function filterAndUpdateStations() {
    const query = searchInput.value.trim();
    let stations = filterStations(query);

    if (!stations.length) {
      currentIndex = 0;
      stationItems = [];
      stationList.innerHTML = `<div class='station-item empty'>${currentTab === "best" ? "Немає улюблених станцій" : "Немає станцій"}</div>`;
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
      item.dataset.icon = station.icon;
      item.innerHTML = `<img src="${station.icon}" alt="${station.name} Icon" class="station-item-icon"> ${station.emoji} ${station.name}<button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}">★</button>`;
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
        toggleFavorite(favoriteBtn.parentElement.dataset.name);
      }
    };

    if (stationItems.length && currentIndex < stationItems.length) {
      changeStation(currentIndex);
    }
  }

  // Перемикання вкладок
  function switchTab(tab) {
    if (!["techno", "trance", "ukraine", "pop", "best"].includes(tab)) tab = "techno";
    currentTab = tab;
    localStorage.setItem("currentTab", tab);
    currentIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    document.querySelector(`.tab-btn:nth-child(${["best", "techno", "trance", "ukraine", "pop"].indexOf(tab) + 1})`).classList.add("active");
    filterAndUpdateStations();
  }

  // Додавання/видалення улюблених
  function toggleFavorite(stationName) {
    if (favoriteStations.includes(stationName)) {
      favoriteStations = favoriteStations.filter(name => name !== stationName);
    } else {
      favoriteStations.unshift(stationName);
    }
    localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
    if (currentTab === "best") switchTab("best");
    else filterAndUpdateStations();
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
  }

  // Оновлення інформації про станцію
  function updateCurrentStationInfo(item) {
    stationIcon.src = item.dataset.icon;
    currentStationInfo.querySelector(".station-name").textContent = item.dataset.name || "Unknown";
    currentStationInfo.querySelector(".station-genre").textContent = `жанр: ${item.dataset.genre || "Unknown"}`;
    currentStationInfo.querySelector(".station-country").textContent = `країна: ${item.dataset.country || "Unknown"}`;
    currentStationInfo.querySelector(".station-artist").textContent = `виконавець: -`;
    currentStationInfo.querySelector(".station-title").textContent = `трек: -`;

    // Оновлення метаданих через Media Session API
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: item.dataset.name || "Unknown Station",
        artist: "-",
        album: item.dataset.genre || "Unknown"
      });
    }

    // Прослуховування метаданих із потоку (поки заглушка, потребує реального парсингу ICY)
    audio.addEventListener("loadedmetadata", () => {
      const artist = audio.getAttribute("data-artist") || "-";
      const title = audio.getAttribute("data-title") || "-";
      currentStationInfo.querySelector(".station-artist").textContent = `виконавець: ${artist}`;
      currentStationInfo.querySelector(".station-title").textContent = `трек: ${title}`;
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata.title = title;
        navigator.mediaSession.metadata.artist = artist;
      }
    }, { once: true });
  }

  // Відтворення
  function tryAutoPlay() {
    if (isPlaying && stationItems.length && currentIndex < stationItems.length) {
      audio.src = stationItems[currentIndex].dataset.value;
      audio.play().catch(() => console.error("Помилка відтворення"));
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
    }
  }

  // Керування
  function togglePlayPause() {
    if (audio.paused) {
      isPlaying = true;
      tryAutoPlay();
      playPauseBtn.textContent = "⏸";
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
  searchInput.addEventListener("input", filterAndUpdateStations);
  document.querySelectorAll(".tab-btn").forEach((btn, index) => {
    btn.addEventListener("click", () => switchTab(["best", "techno", "trance", "ukraine", "pop"][index]));
  });
  document.querySelector(".controls .control-btn:nth-child(1)").addEventListener("click", prevStation);
  document.querySelector(".controls .control-btn:nth-child(2)").addEventListener("click", togglePlayPause);
  document.querySelector(".controls .control-btn:nth-child(3)").addEventListener("click", nextStation);

  // Ініціалізація
  loadStations();
  switchTab(currentTab);
});