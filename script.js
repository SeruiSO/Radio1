const audio = document.getElementById('audio-player');
const stationList = document.getElementById('station-list');
const searchInput = document.getElementById('search-input');
const currentStation = document.getElementById('current-station');
const stationName = document.getElementById('station-name');
const stationGenre = document.getElementById('station-genre');
const stationCountry = document.getElementById('station-country');
const playPauseBtn = document.getElementById('play-pause-btn');
const favoriteBtn = document.getElementById('favorite-btn');
const shareBtn = document.getElementById('share-btn');
const themeToggle = document.getElementById('theme-toggle');
const themeModal = document.getElementById('theme-modal');
const closeModal = document.getElementById('close-modal');
const profile = document.getElementById('profile');
const streak = document.getElementById('streak');
const navButtons = document.querySelectorAll('.nav-btn');

let currentTab = localStorage.getItem('currentTab') || 'techno';
let stations = {};
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let currentStationData = JSON.parse(localStorage.getItem('currentStation')) || null;
let isPlaying = localStorage.getItem('isPlaying') === 'true';
let searchQuery = '';
let streakCount = parseInt(localStorage.getItem('streak')) || 0;
let currentTheme = localStorage.getItem('theme') || 'coral-vibe';

const themes = {
  'coral-vibe': { primary: '#FF6F61', secondary: '#2D2D2D', text: '#F0F0F0', gradient: '#4B1A2E' },
  'neon-lime': { primary: '#B2FF59', secondary: '#2D2D2D', text: '#E8F5E9', gradient: '#2E4B2F' },
  'cyber-purple': { primary: '#7C4DFF', secondary: '#1A1A1A', text: '#EDE7F6', gradient: '#2E1A47' }
};

function applyTheme(theme) {
  // Перевіряємо, чи є тема валідною, інакше використовуємо тему за замовчуванням
  const validTheme = themes[theme] ? theme : 'coral-vibe';
  if (theme !== validTheme) {
    localStorage.setItem('theme', validTheme);
    currentTheme = validTheme;
  }
  const root = document.documentElement;
  root.style.setProperty('--primary', themes[validTheme].primary);
  root.style.setProperty('--secondary', themes[validTheme].secondary);
  root.style.setProperty('--text', themes[validTheme].text);
  root.style.setProperty('--gradient', themes[validTheme].gradient);
  document.querySelectorAll('.theme-grid button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === validTheme);
  });
}

function toggleThemeModal() {
  themeModal.classList.toggle('hidden');
}

function loadStations() {
  stationList.innerHTML = '<div class="station-item">Завантаження...</div>';
  fetch(`stations.json?t=${Date.now()}`, { cache: 'no-cache' })
    .then(response => response.json())
    .then(data => {
      stations = data;
      updateStationList();
      if (currentStationData && stations[currentTab]?.find(s => s.name === currentStationData.name)) {
        updateCurrentStation(currentStationData);
        audio.src = currentStationData.value;
        if (isPlaying) {
          audio.play().catch(() => {});
          playPauseBtn.textContent = '⏸';
          document.querySelectorAll('.wave-bar').forEach(bar => bar.style.animationPlayState = 'running');
        }
      }
    })
    .catch(error => {
      console.error('Помилка завантаження станцій:', error);
      stationList.innerHTML = '<div class="station-item">Не вдалося завантажити станції</div>';
    });
}

function updateStationList() {
  const filteredStations = currentTab === 'favorites'
    ? favorites.map(name => Object.values(stations).flat().find(s => s.name === name)).filter(Boolean)
    : stations[currentTab]?.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.genre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.country.toLowerCase().includes(searchQuery.toLowerCase())
      ) || [];

  stationList.innerHTML = '';
  if (!filteredStations.length) {
    stationList.innerHTML = '<div class="station-item">Немає станцій</div>';
    return;
  }

  filteredStations.forEach(station => {
    const div = document.createElement('div');
    div.className = 'station-item';
    div.innerHTML = `
      <div>
        <h3>${station.emoji} ${station.name}</h3>
        <p>${station.genre} | ${station.country}</p>
      </div>
      <button class="favorite-btn${favorites.includes(station.name) ? ' favorited' : ''}">★</button>
    `;
    div.addEventListener('click', () => selectStation(station));
    div.querySelector('.favorite-btn').addEventListener('click', e => {
      e.stopPropagation();
      toggleFavorite(station.name);
    });
    stationList.appendChild(div);
  });
}

function selectStation(station) {
  currentStationData = station;
  updateCurrentStation(station);
  audio.src = station.value;
  audio.play().catch(() => {});
  isPlaying = true;
  playPauseBtn.textContent = '⏸';
  document.querySelectorAll('.wave-bar').forEach(bar => bar.style.animationPlayState = 'running');
  localStorage.setItem('currentStation', JSON.stringify(station));
  localStorage.setItem('isPlaying', true);
}

function updateCurrentStation(station) {
  currentStation.classList.remove('hidden');
  stationName.textContent = station.name;
  stationGenre.textContent = `Жанр: ${station.genre}`;
  stationCountry.textContent = `Країна: ${station.country}`;
  favoriteBtn.classList.toggle('favorited', favorites.includes(station.name));
}

function toggleFavorite(stationName) {
  if (favorites.includes(stationName)) {
    favorites = favorites.filter(name => name !== stationName);
  } else {
    favorites.push(stationName);
  }
  localStorage.setItem('favorites', JSON.stringify(favorites));
  updateStationList();
}

function shareStation() {
  if (!currentStationData) return;
  if (navigator.share) {
    navigator.share({
      title: `Слухай ${currentStationData.name} на VibeWave Radio!`,
      text: `Перевір цю круту радіостанцію: ${currentStationData.name} (${currentStationData.genre}) з ${currentStationData.country}!`,
      url: window.location.href
    });
  } else {
    navigator.clipboard.writeText(`${currentStationData.name} (${currentStationData.genre}) - ${currentStationData.country}`);
    alert('Посилання скопійовано до буферу обміну!');
  }
}

function togglePlayPause() {
  if (!currentStationData) return;
  if (isPlaying) {
    audio.pause();
    isPlaying = false;
    playPauseBtn.textContent = '▶';
    document.querySelectorAll('.wave-bar').forEach(bar => bar.style.animationPlayState = 'paused');
  } else {
    audio.play().catch(() => {});
    isPlaying = true;
    playPauseBtn.textContent = '⏸';
    document.querySelectorAll('.wave-bar').forEach(bar => bar.style.animationPlayState = 'running');
  }
  localStorage.setItem('isPlaying', isPlaying);
}

function switchTab(tab) {
  currentTab = tab;
  localStorage.setItem('currentTab', tab);
  navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  stationList.classList.toggle('hidden', tab === 'profile');
  profile.classList.toggle('hidden', tab !== 'profile');
  searchQuery = '';
  searchInput.value = '';
  updateStationList();
}

function updateStreak() {
  const lastVisit = localStorage.getItem('lastVisit');
  const today = new Date().toDateString();
  if (lastVisit !== today) {
    streakCount = lastVisit ? streakCount + 1 : 1;
    localStorage.setItem('streak', streakCount);
    localStorage.setItem('lastVisit', today);
  }
  streak.textContent = `Стрік: ${streakCount} днів 🔥`;
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

themeToggle.addEventListener('click', toggleThemeModal);
closeModal.addEventListener('click', toggleThemeModal);
document.querySelectorAll('.theme-grid button').forEach(btn => {
  btn.addEventListener('click', () => {
    applyTheme(btn.dataset.theme);
    toggleThemeModal();
  });
});
playPauseBtn.addEventListener('click', togglePlayPause);
favoriteBtn.addEventListener('click', () => toggleFavorite(currentStationData?.name));
shareBtn.addEventListener('click', shareStation);
searchInput.addEventListener('input', e => {
  searchQuery = e.target.value;
  updateStationList();
});
navButtons.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

audio.addEventListener('playing', () => {
  isPlaying = true;
  playPauseBtn.textContent = '⏸';
  document.querySelectorAll('.wave-bar').forEach(bar => bar.style.animationPlayState = 'running');
});

audio.addEventListener('pause', () => {
  isPlaying = false;
  playPauseBtn.textContent = '▶';
  document.querySelectorAll('.wave-bar').forEach(bar => bar.style.animationPlayState = 'paused');
});

window.addEventListener('online', () => {
  if (isPlaying && currentStationData) {
    audio.src = currentStationData.value;
    audio.play().catch(() => {});
  }
});

// Ініціалізація
applyTheme(currentTheme);
loadStations();
updateStreak();