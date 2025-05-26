import { initializeAudio, prevStation, nextStation, togglePlayPause, Station } from './audio.js';
import { switchTab, toggleTheme, updateStationList, applyTheme } from './ui.js';
import { loadStations, toggleFavorite } from './storage.js';

// Типи для стану
interface AppState {
  currentTab: string;
  currentIndex: number;
  isPlaying: boolean;
  favoriteStations: string[];
}

const state: AppState = {
  currentTab: localStorage.getItem("currentTab") || "techno",
  currentIndex: 0,
  isPlaying: localStorage.getItem("isPlaying") === "true" || false,
  favoriteStations: JSON.parse(localStorage.getItem("favoriteStations") || "[]")
};

// Ініціалізація
document.addEventListener("DOMContentLoaded", () => {
  applyTheme(localStorage.getItem("selectedTheme") || "dark");
  loadStations().then(() => {
    updateStationList(state.currentTab, state.currentIndex, state.favoriteStations);
    if (state.isPlaying && state.currentIndex >= 0) {
      togglePlayPause();
    }
  });

  // Обробники клавіатури
  document.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") prevStation();
    if (e.key === "ArrowRight") nextStation();
    if (e.key === " ") {
      e.preventDefault();
      togglePlayPause();
    }
  });

  // Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(registration => {
      registration.update();
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              if (confirm("Доступна нова версія радіо. Оновити?")) {
                window.location.reload();
              }
            }
          });
        }
      });
    });

    navigator.serviceWorker.addEventListener("message", event => {
      if (event.data.type === "NETWORK_STATUS" && event.data.online && state.isPlaying) {
        console.log("Мережа відновлена (Service Worker)");
        togglePlayPause();
      } else if (event.data.type === "SYNC_FAVORITES") {
        state.favoriteStations = JSON.parse(localStorage.getItem("favoriteStations") || "[]");
        updateStationList(state.currentTab, state.currentIndex, state.favoriteStations);
      }
    });
  }
});

// Експорт функцій для використання в HTML
(window as any).switchTab = switchTab;
(window as any).toggleTheme = toggleTheme;
(window as any).prevStation = prevStation;
(window as any).nextStation = nextStation;
(window as any).togglePlayPause = togglePlayPause;
(window as any).setSleepTimer = () => {
  const sleepTimer = document.getElementById("sleepTimer") as HTMLSelectElement;
  const minutes = parseInt(sleepTimer.value);
  if (minutes > 0) {
    setTimeout(() => {
      togglePlayPause();
      sleepTimer.value = "0";
    }, minutes * 60 * 1000);
  }
};