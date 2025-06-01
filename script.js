const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("stationList");
const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
const currentStationInfo = document.getElementById("currentStationInfo");
const themeToggle = document.querySelector(".theme-toggle");

// Перевірка існування DOM-елементів
if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle) {
  console.error("Один із необхідних DOM-елементів не знайдено");
  throw new Error("Не вдалося ініціалізувати програму через відсутність DOM-елементів");
}

let currentTab = localStorage.getItem("currentTab") || "techno";
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let stationLists = {}; // Початково порожній об'єкт
let stationItems;
let isAutoPlaying = false;
let abortController = new AbortController();
let stationHealthCheckInterval;

// Налаштування аудіо
audio.preload = "auto";
audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

// Функція для перевірки валідності URL
function isValidUrl(url) {
  try {
    return Boolean(new URL(url));
  } catch (e) {
    return false;
  }
}

// Функція для перевірки доступності станції
async function checkStationAvailability(url) {
  if (!url || !isValidUrl(url)) return false;
  
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store'
    });
    return true;
  } catch (error) {
    console.log(`Станція недоступна: ${url}`, error);
    return false;
  }
}

// Функція для скидання інформації про станцію
function resetStationInfo() {
  const stationNameElement = currentStationInfo.querySelector(".station-name");
  const stationGenreElement = currentStationInfo.querySelector(".station-genre");
  const stationCountryElement = currentStationInfo.querySelector(".station-country");
  if (stationNameElement) stationNameElement.textContent = "Обирайте станцію";
  else console.error("Елемент .station-name не знайдено в currentStationInfo");
  if (stationGenreElement) stationGenreElement.textContent = "жанр: -";
  else console.error("Елемент .station-genre не знайдено в currentStationInfo");
  if (stationCountryElement) stationCountryElement.textContent = "країна: -";
  else console.error("Елемент .station-country не знайдено в currentStationInfo");
}

// Завантаження станцій
async function loadStations() {
  console.time("loadStations");
  stationList.innerHTML = "<div class='station-item empty'>Завантаження...</div>";
  
  // Скасувати попередній запит
  abortController.abort();
  abortController = new AbortController();

  try {
    const response = await fetch(`stations.json?t=${Date.now()}`, {
      cache: "no-cache",
      headers: {
        "If-Modified-Since": localStorage.getItem("stationsLastModified") || ""
      },
      signal: abortController.signal
    });
    
    console.log(`Статус відповіді: ${response.status}`);
    if (response.status === 304) {
      const cachedData = await caches.match("stations.json");
      if (cachedData) {
        stationLists = await cachedData.json();
        console.log("Використовується кешована версія stations.json");
      } else {
        throw new Error("Кеш не знайдено");
      }
    } else if (response.ok) {
      stationLists = await response.json();
      localStorage.setItem("stationsLastModified", response.headers.get("Last-Modified") || "");
      console.log("Новий stations.json успішно завантажено");
    } else {
      throw new Error(`HTTP ${response.status}`);
    }

    // Фільтрація неіснуючих улюблених станцій
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

    // Запустити перевірку доступності станцій
    startStationHealthCheck();
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error("Помилка завантаження станцій:", error);
      stationList.innerHTML = "<div class='station-item empty'>Не вдалося завантажити станції</div>";
    }
  } finally {
    console.timeEnd("loadStations");
  }
}

// Функція для запуску перевірки доступності станцій
function startStationHealthCheck() {
  if (stationHealthCheckInterval) {
    clearInterval(stationHealthCheckInterval);
  }
  
  stationHealthCheckInterval = setInterval(async () => {
    if (!stationItems || !stationItems.length) return;
    
    const currentItem = stationItems[currentIndex];
    if (!currentItem) return;
    
    const isAvailable = await checkStationAvailability(currentItem.dataset.value);
    if (!isAvailable && isPlaying) {
      console.log("Поточна станція недоступна, перехід до наступної");
      nextStation();
    }
  }, 30000); // Перевіряти кожні 30 секунд
}

// Автовідтворення
async function tryAutoPlay() {
  if (!navigator.onLine) {
    console.log("Пристрій офлайн, пропускаємо відтворення");
    return;
  }
  
  if (!isPlaying || !stationItems?.length || currentIndex >= stationItems.length || isAutoPlaying) {
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    return;
  }
  
  const currentItem = stationItems[currentIndex];
  if (!currentItem || !isValidUrl(currentItem.dataset.value)) {
    console.log("Невалідний URL станції, перехід до наступної");
    nextStation();
    return;
  }
  
  if (audio.src === currentItem.dataset.value && !audio.paused) {
    return;
  }

  isAutoPlaying = true;
  audio.src = currentItem.dataset.value;
  
  try {
    await audio.play();
    isAutoPlaying = false;
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
  } catch (error) {
    console.error("Помилка відтворення:", error);
    isAutoPlaying = false;
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    
    // Якщо помилка відтворення, спробувати наступну станцію
    if (isPlaying) {
      nextStation();
    }
  }
}

// Зміна станції
async function changeStation(index) {
  if (index < 0 || index >= stationItems.length || stationItems[index].classList.contains("empty")) return;
  
  const item = stationItems[index];
  stationItems?.forEach(i => i.classList.remove("selected"));
  item.classList.add("selected");
  currentIndex = index;
  
  if (!isValidUrl(item.dataset.value)) {
    console.log("Невалідний URL станції, перехід до наступної");
    nextStation();
    return;
  }
  
  audio.src = item.dataset.value;
  updateCurrentStationInfo(item);
  localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
  
  if (isPlaying) {
    tryAutoPlay();
  }
}

// Оновлення інформації про станцію
function updateCurrentStationInfo(item) {
  if (!currentStationInfo) {
    console.error("currentStationInfo не знайдено");
    return;
  }
  
  const stationNameElement = currentStationInfo.querySelector(".station-name");
  const stationGenreElement = currentStationInfo.querySelector(".station-genre");
  const stationCountryElement = currentStationInfo.querySelector(".station-country");

  if (stationNameElement) {
    stationNameElement.textContent = item.dataset.name || "Unknown";
  } else {
    console.error("Елемент .station-name не знайдено в currentStationInfo");
  }
  
  if (stationGenreElement) {
    stationGenreElement.textContent = `жанр: ${item.dataset.genre || "Unknown"}`;
  } else {
    console.error("Елемент .station-genre не знайдено в currentStationInfo");
  }
  
  if (stationCountryElement) {
    stationCountryElement.textContent = `країна: ${item.dataset.country || "Unknown"}`;
  } else {
    console.error("Елемент .station-country не знайдено в currentStationInfo");
  }
  
  if ("mediaSession" in navigator) {
    if (isPlaying) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: item.dataset.name || "Unknown Station",
        artist: `${item.dataset.genre || "Unknown"} | ${item.dataset.country || "Unknown"}`,
        album: "Radio Music"
      });
    } else {
      navigator.mediaSession.metadata = null;
    }
  }
}

// Керування відтворенням
function togglePlayPause() {
  if (!playPauseBtn || !audio) {
    console.error("playPauseBtn або audio не знайдено");
    return;
  }
  
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
    
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = null;
    }
  }
  
  localStorage.setItem("isPlaying", isPlaying);
}

// Обробник помилок аудіо
audio.addEventListener("error", () => {
  console.error("Помилка відтворення аудіо");
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
  
  if (isPlaying && stationItems?.length) {
    // Затримка перед переходом до наступної станції
    setTimeout(() => {
      nextStation();
    }, 1000);
  }
});

// Інші функції залишаються без змін (switchTab, updateStationList, toggleFavorite, prevStation, nextStation, themes, applyTheme, toggleTheme)
// ... (тут мають бути всі інші функції з вашого оригінального коду, які я не змінював)

// Ініціалізація
applyTheme(currentTheme);
loadStations();