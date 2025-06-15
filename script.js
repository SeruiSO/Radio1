let audio = new Audio();
let isPlaying = false;
let stationItems = [];
let currentIndex = 0;
let errorCount = 0;
const ERROR_LIMIT = 5;
let hasUserInteracted = false;
const retryDelays = [1000, 1000, 1000, 1000, 1000, 2000, 2000, 2000, 2000, 2000, 4000, 5000, 6000];
let retryCount = 0;
const maxRetries = 13;

const tabButtons = document.querySelectorAll(".tab-btn");
const modal = document.querySelector(".modal");
const modalTabButtons = document.querySelectorAll(".modal-tab-btn");
const stationList = document.querySelector(".station-list");
const currentStationInfo = document.querySelector("#currentStationInfo");
const searchInput = document.querySelector("#searchInput");
const playPauseBtn = document.querySelector("#playPause");
const prevBtn = document.querySelector("#prevBtn");
const nextBtn = document.querySelector("#nextBtn");
const volumeSlider = document.querySelector("#volume");
const themeToggle = document.querySelector("#theme-toggle");

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then(registration => {
    registration.update();
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "activated" && navigator.serviceWorker.controller) {
          if (window.confirm("Доступна нова версія додатка. Оновити зараз?")) {
            window.location.reload();
          }
        }
      });
    });
  });
}

navigator.serviceWorker.addEventListener("message", event => {
  if (event.data.type === "NETWORK_STATUS" && event.data.online && isPlaying && stationItems?.length && currentIndex < stationItems.length) {
    console.log("Отримано повідомлення від Service Worker: мережа відновлена");
    audio.pause();
    audio.src = "";
    audio.src = stationItems[currentIndex].dataset.value;
    retryCount = 0;
    tryAutoPlay();
  }
});

window.addEventListener("online", () => {
  console.log("Мережа відновлена");
  if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
    audio.pause();
    audio.src = "";
    audio.src = stationItems[currentIndex].dataset.value;
    retryCount = 0;
    tryAutoPlay();
  }
});

window.addEventListener("offline", () => {
  console.log("Втрачено з'єднання з мережею");
});

document.addEventListener("click", () => {
  hasUserInteracted = true;
});

function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

function tryAutoPlay() {
  if (!navigator.onLine) {
    console.log("Пристрій офлайн, пропускаємо відтворення");
    return;
  }
  if (!isPlaying || !stationItems?.length || currentIndex >= stationItems.length || !hasUserInteracted) {
    console.log("Пропуск tryAutoPlay", { isPlaying, hasStationItems: !!stationItems?.length, isIndexValid: currentIndex < stationItems.length, hasUserInteracted });
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    return;
  }
  if (audio.src === stationItems[currentIndex].dataset.value && !audio.paused) {
    console.log("Пропуск tryAutoPlay: аудіо вже відтворюється з правильним src");
    return;
  }
  if (!isValidUrl(stationItems[currentIndex].dataset.value)) {
    console.error("Невалідний URL:", stationItems[currentIndex].dataset.value);
    errorCount++;
    if (errorCount >= ERROR_LIMIT) {
      console.error("Досягнуто ліміт помилок відтворення");
    }
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    return;
  }
  audio.pause();
  audio.src = "";
  audio.src = stationItems[currentIndex].dataset.value;
  console.log("Спроба відтворення:", audio.src);
  const playPromise = audio.play();
  playPromise
    .then(() => {
      errorCount = 0;
      retryCount = 0;
      console.log("Відтворення розпочато успішно");
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
    })
    .catch(error => {
      console.error("Помилка відтворення:", error);
      if (error.name !== "AbortError" && retryCount < maxRetries) {
        errorCount++;
        retryCount++;
        if (errorCount >= ERROR_LIMIT) {
          console.error("Досягнуто ліміт помилок відтворення");
          document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
          return;
        }
        const delay = retryDelays[retryCount - 1] || 6000;
        console.log(`Повторна спроба через ${delay} мс (спроба ${retryCount}/${maxRetries})`);
        setTimeout(tryAutoPlay, delay);
      } else {
        console.error("Досягнуто максимальну кількість спроб або помилка AbortError");
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
      }
    });
}

playPauseBtn.addEventListener("click", () => {
  if (isPlaying) {
    audio.pause();
    isPlaying = false;
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
  } else {
    isPlaying = true;
    playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    tryAutoPlay();
  }
});

prevBtn.addEventListener("click", () => {
  if (stationItems.length && currentIndex > 0) {
    currentIndex--;
    audio.pause();
    audio.src = "";
    audio.src = stationItems[currentIndex].dataset.value;
    tryAutoPlay();
    updateCurrentStationInfo();
  }
});

nextBtn.addEventListener("click", () => {
  if (stationItems.length && currentIndex < stationItems.length - 1) {
    currentIndex++;
    audio.pause();
    audio.src = "";
    audio.src = stationItems[currentIndex].dataset.value;
    tryAutoPlay();
    updateCurrentStationInfo();
  }
});

volumeSlider.addEventListener("input", () => {
  audio.volume = volumeSlider.value / 100;
});

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("lunar-frost");
  themeToggle.innerHTML = document.body.classList.contains("lunar-frost")
    ? '<i class="fas fa-moon"></i>'
    : '<i class="fas fa-sun"></i>';
});

tabButtons.forEach(button => {
  button.addEventListener("click", () => {
    tabButtons.forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");
    loadStations(button.dataset.tab);
  });
});

modalTabButtons.forEach(button => {
  button.addEventListener("click", () => {
    tabButtons.forEach(btn => {
      if (btn.dataset.tab === button.dataset.tab) {
        btn.click();
      }
    });
    modal.classList.add("hidden");
  });
});

searchInput.addEventListener("input", () => {
  const query = searchInput.value.toLowerCase();
  if (query.length > 2) {
    searchStations(query);
  } else {
    loadStations(document.querySelector(".tab-btn.active").dataset.tab);
  }
});

function loadStations(tab) {
  fetch("/stations.json")
    .then(response => response.json())
    .then(data => {
      stationItems = [];
      stationList.innerHTML = "";
      const stations = data[tab] || [];
      stations.forEach((station, index) => {
        const li = document.createElement("li");
        li.textContent = station.name;
        li.dataset.value = station.url;
        li.addEventListener("click", () => {
          currentIndex = index;
          stationItems = document.querySelectorAll(".station-list li");
          audio.pause();
          audio.src = "";
          audio.src = station.url;
          isPlaying = true;
          playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
          tryAutoPlay();
          updateCurrentStationInfo();
        });
        stationList.appendChild(li);
      });
      stationItems = document.querySelectorAll(".station-list li");
      updateCurrentStationInfo();
    })
    .catch(error => console.error("Помилка завантаження станцій:", error));
}

function searchStations(query) {
  fetch(`https://de1.api.radio-browser.info/json/stations/search?${new URLSearchParams({ name: query, limit: 500 })}`)
    .then(response => response.json())
    .then(data => {
      stationItems = [];
      stationList.innerHTML = "";
      data.forEach((station, index) => {
        const li = document.createElement("li");
        li.textContent = station.name;
        li.dataset.value = station.url_resolved;
        li.addEventListener("click", () => {
          currentIndex = index;
          stationItems = document.querySelectorAll(".station-list li");
          audio.pause();
          audio.src = "";
          audio.src = station.url_resolved;
          isPlaying = true;
          playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
          tryAutoPlay();
          updateCurrentStationInfo();
        });
        stationList.appendChild(li);
      });
      stationItems = document.querySelectorAll(".station-list li");
      updateCurrentStationInfo();
    })
    .catch(error => console.error("Помилка пошуку станцій:", error));
}

function updateCurrentStationInfo() {
  if (stationItems.length && currentIndex < stationItems.length) {
    currentStationInfo.textContent = stationItems[currentIndex].textContent;
  } else {
    currentStationInfo.textContent = "Станція не вибрана";
  }
}