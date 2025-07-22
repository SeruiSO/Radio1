const audio = document.getElementById("audio");
const stationList = document.getElementById("stationList");
const tabsContainer = document.getElementById("tabs");
const searchInput = document.getElementById("searchInput");
const searchQuery = document.getElementById("searchQuery");
const searchCountry = document.getElementById("searchCountry");
const searchGenre = document.getElementById("searchGenre");
const searchBtn = document.querySelector("#searchInput button.search-btn");
const currentStationInfo = document.getElementById("currentStationInfo");
const stationText = currentStationInfo.querySelector(".station-text");
const stationIcon = currentStationInfo.querySelector(".station-icon");
const waveLines = currentStationInfo.querySelectorAll(".wave-line");
const themeToggle = document.querySelector(".theme-toggle");
const shareButton = document.querySelector(".share-button");
const exportButton = document.querySelector(".export-button");
const importButton = document.querySelector(".import-button");
const importFileInput = document.getElementById("importFileInput");
const controls = document.querySelector(".controls");
let isPlaying = false;
let intendedPlaying = false;
let isAutoPlayPending = false;
let autoPlayTimeout = null;
let autoPlayRequestId = 0;
let stationLists = {};
let currentTab = "";
let stationItems = [];
let currentIndex = -1;
let userAddedStations = [];
let themes = {
  "shadow-pulse": { accent: "#00E676" },
  "darkexpectations-dark-abyss": { accent: "#AA00FF" },
  "emerald-glow": { accent: "#2EC4B6" },
  "retro-wave": { accent: "#FF69B4" },
  "neon-pulse": { accent: "#00F0FF" },
  "lime-surge": { accent: "#B2FF59" },
  "flamingo-flash": { accent: "#FF4081" },
  "aqua-glow": { accent: "#26C6DA" },
  "aurora-haze": { accent: "#64FFDA" },
  "starlit-amethyst": { accent: "#B388FF" },
  "lunar-frost": { accent: "#40C4FF" }
};
let currentTheme = localStorage.getItem("theme") || "shadow-pulse";

// IndexedDB Setup
const dbPromise = indexedDB.open("RadioSO", 1);

dbPromise.onupgradeneeded = (event) => {
  const db = event.target.result;
  db.createObjectStore("stations", { keyPath: "tab" });
  db.createObjectStore("searches", { keyPath: "key" });
};

async function saveStationLists(stationLists) {
  const db = await dbPromise;
  const tx = db.transaction("stations", "readwrite");
  const store = tx.objectStore("stations");
  await store.put({ tab: "stationLists", data: stationLists });
  return tx.complete;
}

async function getStationLists() {
  const db = await dbPromise;
  const tx = db.transaction("stations", "readonly");
  const store = tx.objectStore("stations");
  const request = await store.get("stationLists");
  return request?.data || {};
}

async function saveSearchResults(query, country, genre, stations) {
  const db = await dbPromise;
  const tx = db.transaction("searches", "readwrite");
  const store = tx.objectStore("searches");
  await store.put({ key: `${query}|${country}|${genre}`, data: stations, timestamp: Date.now() });
  return tx.complete;
}

async function getSearchResults(query, country, genre) {
  const db = await dbPromise;
  const tx = db.transaction("searches", "readonly");
  const store = tx.objectStore("searches");
  const request = await store.get(`${query}|${country}|${genre}`);
  return request?.data || [];
}

async function loadStations() {
  try {
    const response = await fetch(`stations.json?t=${Date.now()}`, { cache: "no-store" });
    if (response.ok) {
      const newStations = await response.json();
      await saveStationLists(newStations);
      return newStations;
    }
  } catch (error) {
    console.warn("Failed to load stations, using cached data");
    return await getStationLists();
  }
}

function normalizeUrl(url) {
  if (!url) return "";
  return url.replace(/^http:\/\//i, "https://").replace(/\/$/, "");
}

function isValidUrl(url) {
  if (!url) return false;
  try {
    new URL(url);
    return /^(https?|mms|rtsp):\/\/[^\s/$.?#].[^\s]*$/i.test(url);
  } catch {
    return false;
  }
}

async function tryAutoPlay(retryCount = 2, delay = 1000, requestId) {
  if (requestId !== autoPlayRequestId) {
    console.log("tryAutoPlay: Aborted due to outdated request ID");
    return;
  }
  isAutoPlayPending = true;
  try {
    await audio.play();
    isPlaying = true;
    intendedPlaying = true;
    updatePlayPauseButton();
    waveLines.forEach(line => line.classList.add("playing"));
    isAutoPlayPending = false;
    clearTimeout(autoPlayTimeout);
    autoPlayTimeout = null;
  } catch (error) {
    console.log("tryAutoPlay error:", error.message);
    if (retryCount > 0) {
      autoPlayTimeout = setTimeout(() => tryAutoPlay(retryCount - 1, delay * 2, requestId), delay);
    } else {
      isPlaying = false;
      intendedPlaying = false;
      isAutoPlayPending = false;
      updatePlayPauseButton();
      clearTimeout(autoPlayTimeout);
      autoPlayTimeout = null;
    }
  }
}

function debouncedTryAutoPlay(retryCount = 2, delay = 1000) {
  if (isAutoPlayPending) {
    console.log("debouncedTryAutoPlay: Skip, previous tryAutoPlay still active");
    return;
  }
  if (autoPlayTimeout) {
    clearTimeout(autoPlayTimeout);
    autoPlayTimeout = null;
  }
  autoPlayRequestId++;
  const currentRequestId = autoPlayRequestId;
  autoPlayTimeout = setTimeout(() => tryAutoPlay(retryCount, delay, currentRequestId), 0);
}

function updatePlayPauseButton() {
  controls.children[1].textContent = isPlaying ? "⏸" : "▶";
}

function selectTab(tab) {
  if (!stationLists[tab]) {
    console.warn(`Tab ${tab} not found`);
    return;
  }
  currentTab = tab;
  localStorage.setItem("currentTab", tab);
  const allTabs = tabsContainer.querySelectorAll(".tab-btn");
  allTabs.forEach(t => t.classList.remove("active"));
  const activeTab = tabsContainer.querySelector(`[data-tab="${tab}"]`);
  if (activeTab) activeTab.classList.add("active");
  stationItems = stationLists[tab] || [];
  currentIndex = -1;
  renderStations();
}

function renderStations() {
  stationList.innerHTML = "";
  if (!stationItems.length) {
    stationList.innerHTML = `<div class="station-item empty">Loading...</div>`;
    return;
  }
  stationItems.forEach((station, index) => {
    const div = document.createElement("div");
    div.className = `station-item ${index === currentIndex ? "selected" : ""}`;
    div.innerHTML = `
      <img src="${station.favicon || ""}" alt="${station.name} icon" loading="lazy" onerror="this.outerHTML='🎵';">
      <span class="station-name">${station.name}</span>
      <div class="buttons-container">
        <button class="favorite-btn ${station.favorited ? "favorited" : ""}" title="${station.favorited ? "Remove from favorites" : "Add to favorites"}">${station.favorited ? "★" : "☆"}</button>
        <button class="add-btn" title="Add to custom tab">➕</button>
        ${station.userAdded ? '<button class="delete-btn" title="Delete station">🗑</button>' : ""}
      `;
    div.querySelector(".favorite-btn").onclick = () => toggleFavorite(index);
    div.querySelector(".add-btn").onclick = () => showAddToTabModal(station);
    if (station.userAdded) {
      div.querySelector(".delete-btn").onclick = () => deleteStation(index);
    }
    div.onclick = (e) => {
      if (!e.target.classList.contains("favorite-btn") && !e.target.classList.contains("add-btn") && !e.target.classList.contains("delete-btn")) {
        selectStation(index);
      }
    };
    stationList.appendChild(div);
  });
}

function toggleFavorite(index) {
  if (currentTab === "favorites") {
    stationItems.splice(index, 1);
    userAddedStations = userAddedStations.filter(s => s.url !== stationItems[index]?.url);
    saveStationLists({ ...stationLists, favorites: stationItems });
  } else {
    const station = stationItems[index];
    station.favorited = !station.favorited;
    stationLists[currentTab][index] = station;
    if (station.favorited) {
      stationLists.favorites = stationLists.favorites || [];
      if (!stationLists.favorites.some(s => s.url === station.url)) {
        stationLists.favorites.push({ ...station });
      }
    } else {
      stationLists.favorites = stationLists.favorites.filter(s => s.url !== station.url);
    }
    saveStationLists(stationLists);
  }
  renderStations();
}

function deleteStation(index) {
  const station = stationItems[index];
  userAddedStations = userAddedStations.filter(s => s.url !== station.url);
  stationLists[currentTab] = stationItems.filter(s => s.url !== station.url);
  if (currentTab === "favorites") {
    stationLists.favorites = stationLists.favorites.filter(s => s.url !== station.url);
  }
  saveStationLists(stationLists);
  renderStations();
  if (index === currentIndex) {
    currentIndex = -1;
    audio.src = "";
    isPlaying = false;
    intendedPlaying = false;
    updatePlayPauseButton();
    updateCurrentStationInfo();
  }
}

function selectStation(index) {
  const station = stationItems[index];
  currentIndex = index;
  audio.src = normalizeUrl(station.url);
  debouncedTryAutoPlay();
  renderStations();
  updateCurrentStationInfo();
  localStorage.setItem("currentStation", JSON.stringify(station));
}

function updateCurrentStationInfo() {
  const station = stationItems[currentIndex];
  if (station) {
    stationText.innerHTML = `
      <span class="station-name">${station.name}</span>
      <span class="station-genre">${station.genre || "Unknown genre"}</span>
      <span class="station-country">${station.country || "Unknown country"}</span>
    `;
    stationIcon.innerHTML = station.favicon ? `<img src="${station.favicon}" alt="${station.name} icon" loading="lazy" onerror="this.outerHTML='🎵';">` : "🎵";
  } else {
    stationText.innerHTML = `
      <span class="station-name">No station selected</span>
      <span class="station-genre"></span>
      <span class="station-country"></span>
    `;
    stationIcon.innerHTML = "🎵";
  }
}

function showAddToTabModal(station) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal new-tab-modal">
      <h2>Add "${station.name}" to tab</h2>
      <div class="modal-tabs"></div>
      <button class="modal-cancel-btn">Cancel</button>
    </div>
  `;
  const modalTabs = modal.querySelector(".modal-tabs");
  Object.keys(stationLists).forEach(tab => {
    if (tab !== "favorites" && !stationLists[tab].some(s => s.url === station.url)) {
      const btn = document.createElement("button");
      btn.className = "modal-tab-btn";
      btn.textContent = tab;
      btn.onclick = () => {
        stationLists[tab].push({ ...station });
        saveStationLists(stationLists);
        document.body.removeChild(modal);
      };
      modalTabs.appendChild(btn);
    }
  });
  modal.querySelector(".modal-cancel-btn").onclick = () => document.body.removeChild(modal);
  document.body.appendChild(modal);
}

function togglePlayPause() {
  if (isPlaying) {
    audio.pause();
    isPlaying = false;
    intendedPlaying = false;
    waveLines.forEach(line => line.classList.remove("playing"));
  } else {
    intendedPlaying = true;
    debouncedTryAutoPlay();
  }
  updatePlayPauseButton();
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  currentTheme = theme;
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", themes[theme].accent);
  }
}

function nextTheme() {
  const themeKeys = Object.keys(themes);
  const currentIndex = themeKeys.indexOf(currentTheme);
  const nextIndex = (currentIndex + 1) % themeKeys.length;
  setTheme(themeKeys[nextIndex]);
}

async function searchStations() {
  const query = searchQuery.value.trim();
  const country = searchCountry.value.trim();
  const genre = searchGenre.value.trim();
  const cachedResults = await getSearchResults(query, country, genre);
  if (cachedResults.length) {
    stationItems = cachedResults;
    renderStations();
    return;
  }
  const params = new URLSearchParams();
  if (query) params.append("name", query);
  if (country) params.append("country", country);
  if (genre) params.append("tag", genre);
  params.append("limit", "100");
  try {
    const response = await fetch(`https://de1.api.radio-browser.info/json/stations/search?${params.toString()}`, {
      cache: "no-store"
    });
    if (response.ok) {
      const stations = await response.json();
      await saveSearchResults(query, country, genre, stations);
      stationItems = stations.map(s => ({
        name: s.name,
        url: s.url_resolved,
        favicon: s.favicon,
        genre: s.tags,
        country: s.country,
        favorited: stationLists.favorites?.some(f => f.url === s.url_resolved) || false
      }));
      renderStations();
    }
  } catch (error) {
    console.error("Search failed:", error);
    stationList.innerHTML = `<div class="station-item empty">Search failed, try again later</div>`;
  }
}

async function init() {
  stationLists = await loadStations();
  const savedTab = localStorage.getItem("currentTab") || Object.keys(stationLists)[0] || "favorites";
  selectTab(savedTab);
  const savedStation = localStorage.getItem("currentStation");
  if (savedStation) {
    const station = JSON.parse(savedStation);
    const index = stationItems.findIndex(s => s.url === station.url);
    if (index !== -1) {
      selectStation(index);
    }
  }
  setTheme(currentTheme);
  if ("mediaSession" in navigator && navigator.mediaSession) {
    navigator.mediaSession.setActionHandler("play", () => {
      if (intendedPlaying) return;
      togglePlayPause();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      if (!isPlaying) return;
      togglePlayPause();
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => {
      if (currentIndex < stationItems.length - 1) {
        selectStation(currentIndex + 1);
      }
    });
    navigator.mediaSession.setActionHandler("previoustrack", () => {
      if (currentIndex > 0) {
        selectStation(currentIndex - 1);
      }
    });
  }
}

let networkTimeout = null;
window.addEventListener("online", () => {
  clearTimeout(networkTimeout);
  networkTimeout = setTimeout(() => {
    console.log("Network restored");
    if (intendedPlaying && stationItems?.length && currentIndex < stationItems.length) {
      isAutoPlayPending = false;
      debouncedTryAutoPlay();
    }
  }, 500);
});

window.addEventListener("offline", () => {
  clearTimeout(networkTimeout);
  networkTimeout = setTimeout(() => {
    console.log("Network offline");
    waveLines.forEach(line => line.classList.remove("playing"));
  }, 500);
});

controls.children[0].onclick = () => {
  if (currentIndex > 0) {
    selectStation(currentIndex - 1);
  }
};

controls.children[1].onclick = togglePlayPause;

controls.children[2].onclick = () => {
  if (currentIndex < stationItems.length - 1) {
    selectStation(currentIndex + 1);
  }
};

themeToggle.onclick = nextTheme;

shareButton.onclick = () => {
  if (navigator.share && stationItems[currentIndex]) {
    navigator.share({
      title: `Listen to ${stationItems[currentIndex].name}`,
      url: stationItems[currentIndex].url
    }).catch(console.error);
  }
};

exportButton.onclick = () => {
  const data = JSON.stringify({ stationLists, userAddedStations });
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "radio-so-stations.json";
  a.click();
  URL.revokeObjectURL(url);
};

importButton.onclick = () => importFileInput.click();

importFileInput.onchange = async (event) => {
  const file = event.target.files[0];
  if (file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.stationLists) {
        stationLists = data.stationLists;
        userAddedStations = data.userAddedStations || [];
        await saveStationLists(stationLists);
        selectTab(currentTab);
      }
    } catch (error) {
      console.error("Import failed:", error);
    }
  }
};

searchBtn.onclick = searchStations;
searchQuery.onkeypress = (e) => {
  if (e.key === "Enter") searchStations();
};
searchCountry.onkeypress = (e) => {
  if (e.key === "Enter") searchStations();
};
searchGenre.onkeypress = (e) => {
  if (e.key === "Enter") searchStations();
};

audio.onended = () => {
  if (currentIndex < stationItems.length - 1) {
    selectStation(currentIndex + 1);
  } else {
    isPlaying = false;
    intendedPlaying = false;
    updatePlayPauseButton();
    waveLines.forEach(line => line.classList.remove("playing"));
  }
};

audio.onpause = () => {
  isPlaying = false;
  updatePlayPauseButton();
  waveLines.forEach(line => line.classList.remove("playing"));
};

audio.onerror = () => {
  console.error("Audio error:", audio.error);
  isPlaying = false;
  intendedPlaying = false;
  updatePlayPauseButton();
  waveLines.forEach(line => line.classList.remove("playing"));
};

navigator.serviceWorker.addEventListener("message", (event) => {
  if (event.data.type === "NETWORK_STATUS") {
    const status = document.getElementById("network-status");
    status.textContent = event.data.online ? "Network restored" : "Network offline";
    status.style.display = "block";
    setTimeout(() => (status.style.display = "none"), 3000);
  }
});

init();