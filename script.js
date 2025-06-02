// VibeWave Radio Script
import { stations } from './stations.js';

const state = {
  currentTab: localStorage.getItem('currentTab') || 'techno',
  currentIndex: parseInt(localStorage.getItem('currentIndex')) || 0,
  isPlaying: localStorage.getItem('isPlaying') === 'true',
  favoriteStations: JSON.parse(localStorage.getItem('favoriteStations')) || [],
  hasInteracted: false,
  audioContext: null,
  analyser: null
};

const elements = {
  audio: document.getElementById('audioPlayer'),
  stationList: document.getElementById('stationList'),
  playPauseBtn: document.querySelector('.play-pause-btn'),
  visualizer: document.getElementById('visualizer'),
  nowPlaying: document.querySelector('.now-playing'),
  themeToggle: document.querySelector('.theme-toggle'),
  shareBtn: document.querySelector('.share-btn')
};

function initializeApp() {
  if (!Object.values(elements).every(el => el)) {
    console.error('Один із необхідних елементів не знайдено');
    setTimeout(initializeApp, 100);
    return;
  }

  elements.audio.volume = parseFloat(localStorage.getItem('volume')) || 0.8;
  setupEventListeners();
  setupAudioContext();
  applyTheme(localStorage.getItem('theme') || 'dark');
  loadStations();
}

function setupEventListeners() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  elements.playPauseBtn.addEventListener('click', togglePlayPause);
  document.querySelector('.prev-btn').addEventListener('click', prevStation);
  document.querySelector('.next-btn').addEventListener('click', nextStation);
  elements.themeToggle.addEventListener('click', toggleTheme);
  elements.shareBtn.addEventListener('click', shareStation);
  elements.stationList.addEventListener('click', handleStationClick);
  document.addEventListener('touchstart', handleSwipe);
  window.addEventListener('online', tryAutoPlay);
  window.addEventListener('offline', () => console.log('Офлайн-режим'));
}

function setupAudioContext() {
  state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  state.analyser = state.audioContext.createAnalyser();
  const source = state.audioContext.createMediaElementSource(elements.audio);
  source.connect(state.analyser);
  state.analyser.connect(state.audioContext.destination);
  state.analyser.fftSize = 64;
  renderVisualizer();
}

function renderVisualizer() {
  const bufferLength = state.analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const bars = Array.from({ length: 6 }, () => {
    const bar = document.createElement('div');
    bar.className = 'wave-bar';
    elements.visualizer.appendChild(bar);
    return bar;
  });

  function animate() {
    if (state.isPlaying) {
      state.analyser.getByteFrequencyData(dataArray);
      bars.forEach((bar, i) => {
        const value = dataArray[i * 2] / 255;
        bar.style.transform = `scaleY(${Math.max(0.3, value)})`;
      });
    }
    requestAnimationFrame(animate);
  }
  animate();
}

function loadStations() {
  elements.stationList.innerHTML = '<div class="station-item empty">Завантаження...</div>';
  setTimeout(() => {
    switchTab(state.currentTab);
  }, 100);
}

function switchTab(tab) {
  if (!['best', 'techno', 'trance', 'ukraine', 'pop'].includes(tab)) tab = 'techno';
  state.currentTab = tab;
  localStorage.setItem('currentTab', tab);
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  updateStationList();
}

function updateStationList() {
  const stationsData = state.currentTab === 'best'
    ? state.favoriteStations.map(name => stations[state.currentTab]?.find(s => s.name === name) || Object.values(stations).flat().find(s => s.name === name)).filter(Boolean)
    : stations[state.currentTab] || [];

  if (!stationsData.length) {
    elements.stationList.innerHTML = `<div class="station-item empty">${state.currentTab === 'best' ? 'Додайте улюблені станції' : 'Немає станцій'}</div>`;
    return;
  }

  elements.stationList.innerHTML = '';
  stationsData.forEach((station, index) => {
    const item = document.createElement('div');
    item.className = `station-item ${index === state.currentIndex ? 'selected' : ''}`;
    item.dataset.value = station.value;
    item.dataset.name = station.name;
    item.dataset.genre = station.genre;
    item.dataset.country = station.country;
    item.innerHTML = `
      ${station.emoji} ${station.name}
      <button class="favorite-btn${state.favoriteStations.includes(station.name) ? ' favorited' : ''}" aria-label="Додати до улюблених">★</button>
    `;
    elements.stationList.appendChild(item);
  });

  state.stationItems = elements.stationList.querySelectorAll('.station-item');
  if (state.stationItems.length && state.currentIndex < state.stationItems.length) {
    updateCurrentStationInfo(state.stationItems[state.currentIndex]);
    tryAutoPlay();
  }
}

function handleStationClick(e) {
  const item = e.target.closest('.station-item');
  const favoriteBtn = e.target.closest('.favorite-btn');
  if (item && !item.classList.contains('empty')) {
    state.currentIndex = Array.from(state.stationItems).indexOf(item);
    changeStation(state.currentIndex);
  }
  if (favoriteBtn) {
    e.stopPropagation();
    toggleFavorite(favoriteBtn.parentElement.dataset.name);
  }
}

function toggleFavorite(stationName) {
  if (state.favoriteStations.includes(stationName)) {
    state.favoriteStations = state.favoriteStations.filter(name => name !== stationName);
  } else {
    state.favoriteStations.push(stationName);
  }
  localStorage.setItem('favoriteStations', JSON.stringify(state.favoriteStations));
  if (state.currentTab === 'best') switchTab('best');
  else updateStationList();
}

function changeStation(index) {
  if (index < 0 || index >= state.stationItems.length || state.stationItems[index].classList.contains('empty')) return;
  state.stationItems.forEach(item => item.classList.remove('selected'));
  state.stationItems[index].classList.add('selected');
  state.currentIndex = index;
  localStorage.setItem('currentIndex', index);
  updateCurrentStationInfo(state.stationItems[index]);
  tryAutoPlay();
}

function updateCurrentStationInfo(item) {
  elements.nowPlaying.querySelector('.station-name').textContent = item.dataset.name || 'Невідома станція';
  elements.nowPlaying.querySelector('.station-genre').textContent = `жанр: ${item.dataset.genre || '-'}`;
  elements.nowPlaying.querySelector('.station-country').textContent = `країна: ${item.dataset.country || '-'}`;
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.dataset.name,
      artist: `${item.dataset.genre} | ${item.dataset.country}`,
      album: 'VibeWave Radio'
    });
  }
}

function tryAutoPlay() {
  if (!navigator.onLine || !state.isPlaying || !state.stationItems?.length || state.currentIndex >= state.stationItems.length || !state.hasInteracted) {
    elements.visualizer.querySelectorAll('.wave-bar').forEach(bar => bar.style.animationPlayState = 'paused');
    return;
  }

  elements.audio.src = state.stationItems[state.currentIndex].dataset.value;
  elements.audio.play().then(() => {
    state.isPlaying = true;
    elements.playPauseBtn.textContent = '⏸';
    elements.visualizer.querySelectorAll('.wave-bar').forEach(bar => bar.style.animationPlayState = 'running');
  }).catch(err => {
    console.error('Помилка відтворення:', err);
    elements.visualizer.querySelectorAll('.wave-bar').forEach(bar => bar.style.animationPlayState = 'paused');
  });
}

function togglePlayPause() {
  state.hasInteracted = true;
  if (elements.audio.paused) {
    state.isPlaying = true;
    tryAutoPlay();
  } else {
    elements.audio.pause();
    state.isPlaying = false;
    elements.playPauseBtn.textContent = '▶';
    elements.visualizer.querySelectorAll('.wave-bar').forEach(bar => bar.style.animationPlayState = 'paused');
  }
  localStorage.setItem('isPlaying', state.isPlaying);
}

function prevStation() {
  state.hasInteracted = true;
  state.currentIndex = state.currentIndex > 0 ? state.currentIndex - 1 : state.stationItems.length - 1;
  changeStation(state.currentIndex);
}

function nextStation() {
  state.hasInteracted = true;
  state.currentIndex = state.currentIndex < state.stationItems.length - 1 ? state.currentIndex + 1 : 0;
  changeStation(state.currentIndex);
}

function shareStation() {
  if (!state.stationItems[state.currentIndex]) return;
  const station = state.stationItems[state.currentIndex].dataset;
  const shareData = {
    title: `Слухаю ${station.name} на VibeWave Radio!`,
    text: `Чекай цей трек: ${station.name} (${station.genre}, ${station.country})`,
    url: window.location.href
  };
  if (navigator.share) {
    navigator.share(shareData).catch(err => console.error('Помилка шарингу:', err));
  } else {
    alert('Поділитися: ' + shareData.text);
  }
}

function handleSwipe(e) {
  let touchStartX = e.touches[0].clientX;
  document.addEventListener('touchend', (endEvent) => {
    const touchEndX = endEvent.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) nextStation();
      else prevStation();
    }
  }, { once: true });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

function toggleTheme() {
  const currentTheme = localStorage.getItem('theme') || 'dark';
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(reg => reg.update());
}

document.addEventListener('DOMContentLoaded', initializeApp);
document.addEventListener('click', () => state.hasInteracted = true);