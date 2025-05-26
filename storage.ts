import { Station } from './audio.js';
import { setStationLists, updateStationList } from './ui.js';

export async function loadStations(attempt = 1): Promise<void> {
  try {
    const response = await fetch("stations.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const stationLists: { [key: string]: Station[] } = await response.json();
    setStationLists(stationLists);
    const validTabs = [...Object.keys(stationLists), "best"];
    let currentTab = localStorage.getItem("currentTab") || "techno";
    if (!validTabs.includes(currentTab)) {
      currentTab = validTabs[0] || "techno";
      localStorage.setItem("currentTab", currentTab);
    }
    const currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`) || "0");
    updateStationList(currentTab, currentIndex, JSON.parse(localStorage.getItem("favoriteStations") || "[]"));
  } catch (error) {
    console.error("Помилка завантаження станцій (спроба " + attempt + "):", error);
    if ("caches" in window && attempt < 3) {
      const cacheResponse = await caches.match("stations.json");
      if (cacheResponse) {
        const stationLists: { [key: string]: Station[] } = await cacheResponse.json();
        setStationLists(stationLists);
        const validTabs = [...Object.keys(stationLists), "best"];
        let currentTab = localStorage.getItem("currentTab") || "techno";
        if (!validTabs.includes(currentTab)) {
          currentTab = validTabs[0] || "techno";
          localStorage.setItem("currentTab", currentTab);
        }
        const currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`) || "0");
        updateStationList(currentTab, currentIndex, JSON.parse(localStorage.getItem("favoriteStations") || "[]"));
        return;
      }
    }
    if (attempt < 3) {
      setTimeout(() => loadStations(attempt + 1), 1000);
    }
  }
}

export function toggleFavorite(stationName: string) {
  let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations") || "[]") as string[];
  if (favoriteStations.includes(stationName)) {
    favoriteStations = favoriteStations.filter(name => name !== stationName);
  } else {
    favoriteStations.unshift(stationName);
  }
  localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "SYNC_FAVORITES_REQUEST" });
  }
  updateStationList(localStorage.getItem("currentTab") || "techno", parseInt(localStorage.getItem(`lastStation_${localStorage.getItem("currentTab") || "techno"}`) || "0"), favoriteStations);
}