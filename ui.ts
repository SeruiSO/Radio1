import { Station } from './audio.js';

interface Theme {
  bodyBg: string;
  containerBg: string;
  accent: string;
  text: string;
}

const themes: { [key: string]: Theme } = {
  dark: { bodyBg: "#000000", containerBg: "#252525", accent: "#4682b4", text: "#f5f5f5" },
  light: { bodyBg: "#e8ecef", containerBg: "#ffffff", accent: "#1e90ff", text: "#212121" },
  neon: { bodyBg: "#000000", containerBg: "#1a1a2e", accent: "#40c4b4", text: "#e8e8e8" },
  coralVibe: { bodyBg: "#1c2526", containerBg: "#2e3b3e", accent: "#ff6f61", text: "#f5e6e6" },
  emeraldGlow: { bodyBg: "#1a2f2f", containerBg: "#2c3e50", accent: "#2ecc71", text: "#e6f5e6" },
  midnightBlue: { bodyBg: "#0f172a", containerBg: "#1e293b", accent: "#3b82f6", text: "#e6f0fa" }
};

let currentTheme = localStorage.getItem("selectedTheme") || "dark";
let stationLists: { [key: string]: Station[] } = {};

export function applyTheme(theme: string) {
  const root = document.documentElement;
  root.style.setProperty("--body-bg", themes[theme].bodyBg);
  root.style.setProperty("--container-bg", themes[theme].containerBg);
  root.style.setProperty("--accent", themes[theme].accent);
  root.style.setProperty("--text", themes[theme].text);
  localStorage.setItem("selectedTheme", theme);
  currentTheme = theme;
  document.documentElement.setAttribute("data-theme", theme);
}

export function toggleTheme() {
  const themesOrder = ["dark", "light", "neon", "coralVibe", "emeraldGlow", "midnightBlue"];
  const nextTheme = themesOrder[(themesOrder.indexOf(currentTheme) + 1) % themesOrder.length];
  applyTheme(nextTheme);
}

export function switchTab(tab: string) {
  if (!["techno", "trance", "ukraine", "best"].includes(tab)) tab = "techno";
  state.currentTab = tab;
  localStorage.setItem("currentTab", tab);
  const savedIndex = parseInt(localStorage.getItem(`lastStation_${tab}`) || "0");
  const maxIndex = tab === "best" ? state.favoriteStations.length : stationLists[tab]?.length || 0;
  state.currentIndex = savedIndex < maxIndex ? savedIndex : 0;
  updateStationList(tab, state.currentIndex, state.favoriteStations);
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  const activeBtn = document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`);
  if (activeBtn) activeBtn.classList.add("active");
}

export function updateStationList(tab: string, currentIndex: number, favoriteStations: string[]) {
  const stationList = document.getElementById("stationList") as HTMLElement;
  stationList.innerHTML = "";
  let stations = tab === "best"
    ? favoriteStations
        .map(name => Object.values(stationLists).flat().find(s => s.name === name))
        .filter(s => s) as Station[]
    : stationLists[tab] || [];

  if (!stations.length) {
    state.currentIndex = 0;
    if (tab === "best") {
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "station-item empty";
      emptyMessage.textContent = "Немає улюблених станцій";
      stationList.appendChild(emptyMessage);
    }
    return;
  }

  const favoriteList = tab === "best"
    ? stations
    : stations.filter(station => favoriteStations.includes(station.name));
  const nonFavoriteList = tab === "best" ? [] : stations.filter(station => !favoriteStations.includes(station.name));
  const sortedStations = [...favoriteList, ...nonFavoriteList];

  sortedStations.forEach((station, index) => {
    const item = document.createElement("div");
    item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
    item.dataset.value = station.value;
    item.dataset.name = station.name;
    item.dataset.genre = station.genre;
    item.dataset.country = station.country;
    item.innerHTML = `${station.emoji} ${station.name}<button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}">★</button>`;
    stationList.appendChild(item);
  });

  const stationItems = stationList.querySelectorAll(".station-item") as NodeListOf<HTMLElement>;
  stationList.onclick = e => {
    const item = (e.target as HTMLElement).closest(".station-item");
    const favoriteBtn = (e.target as HTMLElement).closest(".favorite-btn");
    if (item && !item.classList.contains("empty")) {
      state.currentIndex = Array.from(stationItems).indexOf(item);
      changeStation(state.currentIndex);
    }
    if (favoriteBtn) {
      toggleFavorite((favoriteBtn.parentElement as HTMLElement).dataset.name!);
    }
  };

  if (stationItems.length && currentIndex < stationItems.length) {
    changeStation(currentIndex);
  }
}

// Глобальний стан (тимчасово тут, можна винести в окремий модуль)
const state: { currentTab: string; currentIndex: number; isPlaying: boolean; favoriteStations: string[] } = {
  currentTab: localStorage.getItem("currentTab") || "techno",
  currentIndex: 0,
  isPlaying: localStorage.getItem("isPlaying") === "true" || false,
  favoriteStations: JSON.parse(localStorage.getItem("favoriteStations") || "[]")
};

export function setStationLists(lists: { [key: string]: Station[] }) {
  stationLists = lists;
}