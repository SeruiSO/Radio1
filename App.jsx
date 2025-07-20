import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

const themes = {
  'cosmic-blue': { accent: '#3B82F6', gradient: 'from-blue-500 to-indigo-600', text: '#F3F4F6' },
  'solar-flare': { accent: '#F97316', gradient: 'from-orange-500 to-red-600', text: '#FEE2E2' },
  'neon-lime': { accent: '#22C55E', gradient: 'from-green-400 to-lime-500', text: '#ECFCCB' },
  'twilight-purple': { accent: '#A855F7', gradient: 'from-purple-500 to-pink-500', text: '#F3E8FF' },
  'aurora-teal': { accent: '#14B8A6', gradient: 'from-teal-500 to-cyan-500', text: '#CFFAFE' },
};

const App = () => {
  const [currentTab, setCurrentTab] = useState(localStorage.getItem('currentTab') || 'techno');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [favoriteStations, setFavoriteStations] = useState(JSON.parse(localStorage.getItem('favoriteStations')) || []);
  const [isPlaying, setIsPlaying] = useState(localStorage.getItem('isPlaying') === 'true');
  const [intendedPlaying, setIntendedPlaying] = useState(localStorage.getItem('intendedPlaying') === 'true');
  const [stationLists, setStationLists] = useState(JSON.parse(localStorage.getItem('stationLists')) || {});
  const [userAddedStations, setUserAddedStations] = useState(JSON.parse(localStorage.getItem('userAddedStations')) || {});
  const [stations, setStations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCountry, setSearchCountry] = useState('');
  const [searchGenre, setSearchGenre] = useState('');
  const [pastSearches, setPastSearches] = useState(JSON.parse(localStorage.getItem('pastSearches')) || []);
  const [deletedStations, setDeletedStations] = useState(JSON.parse(localStorage.getItem('deletedStations')) || []);
  const [customTabs, setCustomTabs] = useState(JSON.parse(localStorage.getItem('customTabs')) || []);
  const [theme, setTheme] = useState(localStorage.getItem('selectedTheme') || 'cosmic-blue');
  const [showSearch, setShowSearch] = useState(false);
  const [showNewTabModal, setShowNewTabModal] = useState(false);
  const [showEditTabModal, setShowEditTabModal] = useState(null);
  const [newTabName, setNewTabName] = useState('');
  const audioRef = useRef(new Audio());
  const abortControllerRef = useRef(new AbortController());
  const [errorCount, setErrorCount] = useState(0);
  const ERROR_LIMIT = 15;

  useEffect(() => {
    const audio = audioRef.current;
    audio.preload = 'auto';
    audio.volume = parseFloat(localStorage.getItem('volume')) || 0.9;

    const handlePlaying = () => {
      setIsPlaying(true);
      document.querySelectorAll('.wave-line').forEach(line => line.classList.add('animate-pulse'));
    };
    const handlePause = () => {
      setIsPlaying(false);
      document.querySelectorAll('.wave-line').forEach(line => line.classList.remove('animate-pulse'));
    };
    const handleError = () => {
      document.querySelectorAll('.wave-line').forEach(line => line.classList.remove('animate-pulse'));
      if (intendedPlaying && errorCount < ERROR_LIMIT) {
        setErrorCount(c => c + 1);
        setTimeout(() => tryAutoPlay(), 1000);
      } else if (errorCount >= ERROR_LIMIT) {
        resetStationInfo();
      }
    };
    const handleVolumeChange = () => {
      localStorage.setItem('volume', audio.volume);
    };

    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);
    audio.addEventListener('volumechange', handleVolumeChange);

    loadStations();
    applyTheme(theme);

    return () => {
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('volumechange', handleVolumeChange);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('currentTab', currentTab);
    localStorage.setItem('isPlaying', isPlaying);
    localStorage.setItem('intendedPlaying', intendedPlaying);
    localStorage.setItem('favoriteStations', JSON.stringify(favoriteStations));
    localStorage.setItem('stationLists', JSON.stringify(stationLists));
    localStorage.setItem('userAddedStations', JSON.stringify(userAddedStations));
    localStorage.setItem('pastSearches', JSON.stringify(pastSearches));
    localStorage.setItem('deletedStations', JSON.stringify(deletedStations));
    localStorage.setItem('customTabs', JSON.stringify(customTabs));
    localStorage.setItem('selectedTheme', theme);
  }, [currentTab, isPlaying, intendedPlaying, favoriteStations, stationLists, userAddedStations, pastSearches, deletedStations, customTabs, theme]);

  const applyTheme = (newTheme) => {
    document.documentElement.style.setProperty('--accent', themes[newTheme].accent);
    document.documentElement.style.setProperty('--gradient', themes[newTheme].gradient);
    document.documentElement.style.setProperty('--text', themes[newTheme].text);
    document.querySelector('meta[name="theme-color"]').setAttribute('content', themes[newTheme].accent);
    setTheme(newTheme);
  };

  const toggleTheme = () => {
    const themeKeys = Object.keys(themes);
    const currentIndex = themeKeys.indexOf(theme);
    const nextTheme = themeKeys[(currentIndex + 1) % themeKeys.length];
    applyTheme(nextTheme);
  };

  const loadStations = async () => {
    try {
      abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      const response = await fetch(`stations.json?t=${Date.now()}`, {
        cache: 'no-store',
        signal: abortControllerRef.current.signal,
      });
      if (response.ok) {
        const newStations = await response.json();
        const mergedStationLists = {};
        Object.keys(newStations).forEach(tab => {
          const uniqueStations = new Map();
          (userAddedStations[tab] || []).forEach(s => {
            if (!deletedStations.includes(s.name)) uniqueStations.set(s.name, s);
          });
          newStations[tab].forEach(s => {
            if (!deletedStations.includes(s.name)) uniqueStations.set(s.name, s);
          });
          mergedStationLists[tab] = Array.from(uniqueStations.values());
        });
        customTabs.forEach(tab => {
          const uniqueStations = new Map();
          (userAddedStations[tab] || []).forEach(s => {
            if (!deletedStations.includes(s.name)) uniqueStations.set(s.name, s);
          });
          mergedStationLists[tab] = Array.from(uniqueStations.values());
        });
        setStationLists(mergedStationLists);
        setFavoriteStations(favoriteStations.filter(name => Object.values(mergedStationLists).flat().some(s => s.name === name)));
        switchTab(currentTab);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error loading stations:', error);
        setStations([]);
      }
    }
  };

  const searchStations = async () => {
    if (!searchQuery && !searchCountry && !searchGenre) {
      setStations([]);
      return;
    }
    try {
      abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      const params = new URLSearchParams();
      if (searchQuery) params.append('name', searchQuery);
      if (searchCountry) params.append('country', searchCountry);
      if (searchGenre) params.append('tag', searchGenre.toLowerCase());
      params.append('order', 'clickcount');
      params.append('reverse', 'true');
      params.append('limit', '2000');
      const response = await fetch(`https://de1.api.radio-browser.info/json/stations/search?${params.toString()}`, {
        signal: abortControllerRef.current.signal,
      });
      if (response.ok) {
        const data = await response.json();
        setStations(data.filter(s => s.url_resolved));
        if (searchQuery && !pastSearches.includes(searchQuery)) {
          setPastSearches([searchQuery, ...pastSearches.slice(0, 4)]);
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error searching stations:', error);
        setStations([]);
      }
    }
  };

  const switchTab = (tab) => {
    const validTabs = ['best', 'techno', 'trance', 'ukraine', 'pop', 'search', ...customTabs];
    if (!validTabs.includes(tab)) tab = 'techno';
    setCurrentTab(tab);
    setShowSearch(tab === 'search');
    setCurrentIndex(0);
    const stations = tab === 'best'
      ? favoriteStations.map(name => Object.values(stationLists).flat().find(s => s.name === name)).filter(s => s)
      : tab === 'search' ? [] : stationLists[tab] || [];
    setStations(stations);
    if (intendedPlaying && stations.length) tryAutoPlay();
  };

  const tryAutoPlay = async () => {
    if (!stations.length || currentIndex >= stations.length || !intendedPlaying) return;
    const station = stations[currentIndex];
    const audio = audioRef.current;
    try {
      audio.src = `${station.value}?nocache=${Date.now()}`;
      await audio.play();
      setErrorCount(0);
      setIsPlaying(true);
      setIntendedPlaying(true);
      updateMediaSession(station);
    } catch (error) {
      setErrorCount(c => c + 1);
      if (errorCount < ERROR_LIMIT) {
        setTimeout(tryAutoPlay, 1000);
      } else {
        resetStationInfo();
      }
    }
  };

  const updateMediaSession = (station) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: station.name || 'Unknown Station',
        artist: `${station.genre || ''} | ${station.country || ''}`,
        album: 'WaveRadio',
        artwork: station.favicon ? [{ src: station.favicon, sizes: '96x96', type: 'image/png' }] : [],
      });
      navigator.mediaSession.setActionHandler('play', togglePlayPause);
      navigator.mediaSession.setActionHandler('pause', togglePlayPause);
      navigator.mediaSession.setActionHandler('previoustrack', prevStation);
      navigator.mediaSession.setActionHandler('nexttrack', nextStation);
    }
  };

  const resetStationInfo = () => {
    setCurrentIndex(0);
    setIsPlaying(false);
    setIntendedPlaying(false);
    audioRef.current.pause();
  };

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      setIntendedPlaying(false);
    } else {
      setIntendedPlaying(true);
      tryAutoPlay();
    }
  };

  const prevStation = () => {
    if (!stations.length) return;
    setCurrentIndex(currentIndex > 0 ? currentIndex - 1 : stations.length - 1);
    tryAutoPlay();
  };

  const nextStation = () => {
    if (!stations.length) return;
    setCurrentIndex(currentIndex < stations.length - 1 ? currentIndex + 1 : 0);
    tryAutoPlay();
  };

  const toggleFavorite = (name) => {
    const newFavorites = favoriteStations.includes(name)
      ? favoriteStations.filter(n => n !== name)
      : [name, ...favoriteStations];
    setFavoriteStations(newFavorites);
    if (currentTab === 'best') switchTab('best');
  };

  const deleteStation = (name) => {
    if (!stationLists[currentTab]) return;
    const station = stationLists[currentTab].find(s => s.name === name);
    if (!station) return;
    setStationLists({
      ...stationLists,
      [currentTab]: stationLists[currentTab].filter(s => s.name !== name),
    });
    setUserAddedStations({
      ...userAddedStations,
      [currentTab]: userAddedStations[currentTab]?.filter(s => s.name !== name) || [],
    });
    if (!station.isFromSearch) {
      setDeletedStations([...deletedStations, name]);
    }
    setFavoriteStations(favoriteStations.filter(n => n !== name));
    switchTab(currentTab);
  };

  const addStationToTab = (station, targetTab) => {
    if (!stationLists[targetTab]) stationLists[targetTab] = [];
    if (!userAddedStations[targetTab]) userAddedStations[targetTab] = [];
    if (!stationLists[targetTab].some(s => s.name === station.name)) {
      const newStation = { ...station, isFromSearch: currentTab === 'search' };
      setStationLists({ ...stationLists, [targetTab]: [newStation, ...stationLists[targetTab]] });
      setUserAddedStations({ ...userAddedStations, [currentTab]: [newStation, ...(userAddedStations[currentTab] || [])] });
    }
  };

  const createTab = () => {
    if (!newTabName || customTabs.includes(newTabName) || newTabName.length > 10 || !/^[a-z0-9_-]+$/.test(newTabName)) return;
    setCustomTabs([...customTabs, newTabName]);
    setStationLists({ ...stationLists, [newTabName]: [] });
    setUserAddedStations({ ...userAddedStations, [newTabName]: [] });
    setShowNewTabModal(false);
    switchTab(newTabName);
  };

  const renameTab = (oldName, newName) => {
    if (!newName || customTabs.includes(newName) || newName.length > 10 || !/^[a-z0-9_-]+$/.test(newName)) return;
    const index = customTabs.indexOf(oldName);
    const newTabs = [...customTabs];
    newTabs[index] = newName;
    setCustomTabs(newTabs);
    setStationLists({ ...stationLists, [newName]: stationLists[oldName], [oldName]: undefined });
    setUserAddedStations({ ...userAddedStations, [newName]: userAddedStations[oldName], [oldName]: undefined });
    if (currentTab === oldName) switchTab(newName);
    setShowEditTabModal(null);
  };

  const deleteTab = (tab) => {
    setCustomTabs(customTabs.filter(t => t !== tab));
    setStationLists({ ...stationLists, [tab]: undefined });
    setUserAddedStations({ ...userAddedStations, [tab]: undefined });
    if (currentTab === tab) switchTab('techno');
    setShowEditTabModal(null);
  };

  const exportSettings = () => {
    const settings = { currentTab, favoriteStations, stationLists, userAddedStations, pastSearches, deletedStations, customTabs, selectedTheme: theme };
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'waveradio_settings.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSettings = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const settings = JSON.parse(e.target.result);
      if (settings.currentTab) setCurrentTab(settings.currentTab);
      if (settings.favoriteStations) setFavoriteStations(settings.favoriteStations);
      if (settings.stationLists) setStationLists(settings.stationLists);
      if (settings.userAddedStations) setUserAddedStations(settings.userAddedStations);
      if (settings.pastSearches) setPastSearches(settings.pastSearches.slice(0, 5));
      if (settings.deletedStations) setDeletedStations(settings.deletedStations);
      if (settings.customTabs) setCustomTabs(settings.customTabs);
      if (settings.selectedTheme) applyTheme(settings.selectedTheme);
      switchTab(settings.currentTab || 'techno');
    };
    reader.readAsText(file);
  };

  const currentStation = stations[currentIndex] || { name: 'Select station', genre: '-', country: '-', favicon: '' };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${themes[theme].gradient} flex flex-col items-center justify-between p-4`}>
      <div className="w-full max-w-md">
        <div className={`fixed top-0 left-0 w-full bg-gray-900/90 backdrop-blur-md transition-all duration-300 ${showSearch ? 'translate-y-0' : '-translate-y-full'}`}>
          <div className="p-4 flex flex-col gap-2">
            <input
              className="w-full p-2 bg-gray-800 rounded-lg text-white placeholder-gray-400"
              placeholder="Station name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchStations()}
            />
            <input
              className="w-full p-2 bg-gray-800 rounded-lg text-white placeholder-gray-400"
              placeholder="Country"
              value={searchCountry}
              onChange={(e) => setSearchCountry(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchStations()}
            />
            <input
              className="w-full p-2 bg-gray-800 rounded-lg text-white placeholder-gray-400"
              placeholder="Genre"
              value={searchGenre}
              onChange={(e) => setSearchGenre(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchStations()}
            />
            <button
              className="bg-[var(--accent)] text-white p-2 rounded-lg"
              onClick={searchStations}
            >
              Search
            </button>
            <button
              className="text-[var(--accent)]"
              onClick={() => setShowSearch(false)}
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-[var(--text)]">WaveRadio</h1>
          <button onClick={() => setShowSearch(!showSearch)} className="text-[var(--accent)] text-xl">🔍</button>
        </div>

        <div className="flex flex-col items-center">
          <div className="relative w-64 h-64 bg-gray-900/80 rounded-full flex items-center justify-center shadow-lg">
            <div className="absolute inset-0 bg-[var(--accent)] opacity-20 rounded-full animate-pulse" style={{ display: isPlaying ? 'block' : 'none' }}></div>
            <div className="text-center">
              <img
                src={currentStation.favicon || 'https://via.placeholder.com/64'}
                alt={currentStation.name}
                className="w-16 h-16 mx-auto rounded-full mb-2"
                onError={(e) => (e.target.src = 'https://via.placeholder.com/64')}
              />
              <h2 className="text-lg font-semibold text-[var(--text)]">{currentStation.name}</h2>
              <p className="text-sm text-gray-400">Genre: {currentStation.genre}</p>
              <p className="text-sm text-gray-400">Country: {currentStation.country}</p>
            </div>
            <div className="absolute bottom-4 flex gap-2">
              <div className="w-2 h-8 bg-[var(--accent)] rounded wave-line"></div>
              <div className="w-2 h-8 bg-[var(--accent)] rounded wave-line"></div>
              <div className="w-2 h-8 bg-[var(--accent)] rounded wave-line"></div>
            </div>
          </div>

          <div className="flex gap-4 mt-4">
            <button className="text-[var(--accent)] text-2xl" onClick={prevStation}>⏮</button>
            <button className="text-[var(--accent)] text-2xl" onClick={togglePlayPause}>{isPlaying ? '⏸' : '▶'}</button>
            <button className="text-[var(--accent)] text-2xl" onClick={nextStation}>⏭</button>
          </div>
        </div>

        <div className="mt-4">
          {stations.length ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stations.map((station, index) => (
                <div
                  key={station.name}
                  className={`p-2 bg-gray-800/50 rounded-lg flex items-center justify-between cursor-pointer ${index === currentIndex ? 'border-2 border-[var(--accent)]' : ''}`}
                  onClick={() => {
                    setCurrentIndex(index);
                    tryAutoPlay();
                  }}
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={station.favicon || 'https://via.placeholder.com/40'}
                      alt={station.name}
                      className="w-10 h-10 rounded"
                      onError={(e) => (e.target.src = 'https://via.placeholder.com/40')}
                    />
                    <div>
                      <p className="text-[var(--text)]">{station.name}</p>
                      <p className="text-xs text-gray-400">{station.genre} | {station.country}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {currentTab !== 'search' && (
                      <button
                        className="text-red-500"
                        onClick={(e) => { e.stopPropagation(); deleteStation(station.name); }}
                      >
                        🗑
                      </button>
                    )}
                    <button
                      className={`text-xl ${favoriteStations.includes(station.name) ? 'text-yellow-400' : 'text-gray-400'}`}
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(station.name); }}
                    >
                      ★
                    </button>
                    {currentTab === 'search' && (
                      <button
                        className="text-[var(--accent)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          addStationToTab(station, 'techno');
                        }}
                      >
                        ADD
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-400">No stations available</p>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-gray-900/90 backdrop-blur-md p-2">
        <div className="flex gap-2 overflow-x-auto">
          {['best', 'techno', 'trance', 'ukraine', 'pop', 'search', ...customTabs].map(tab => (
            <button
              key={tab}
              className={`px-3 py-1 rounded-lg ${currentTab === tab ? 'bg-[var(--accent)] text-white' : 'bg-gray-800 text-[var(--text)]'}`}
              onClick={() => switchTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
          <button className="px-3 py-1 bg-gray-800 text-[var(--text)] rounded-lg" onClick={() => setShowNewTabModal(true)}>+</button>
        </div>
      </div>

      {showNewTabModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-gray-900 p-4 rounded-lg">
            <h2 className="text-[var(--text)]">New Tab</h2>
            <input
              className="w-full p-2 bg-gray-800 rounded-lg text-white"
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value.toLowerCase())}
              placeholder="Tab name"
            />
            <div className="flex gap-2 mt-2">
              <button className="bg-[var(--accent)] text-white p-2 rounded-lg" onClick={createTab}>Create</button>
              <button className="text-[var(--accent)]" onClick={() => setShowNewTabModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showEditTabModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-gray-900 p-4 rounded-lg">
            <h2 className="text-[var(--text)]">Edit Tab</h2>
            <input
              className="w-full p-2 bg-gray-800 rounded-lg text-white"
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value.toLowerCase())}
              placeholder="New tab name"
            />
            <div className="flex gap-2 mt-2">
              <button className="bg-[var(--accent)] text-white p-2 rounded-lg" onClick={() => renameTab(showEditTabModal, newTabName)}>Rename</button>
              <button className="text-red-500" onClick={() => deleteTab(showEditTabModal)}>Delete</button>
              <button className="text-[var(--accent)]" onClick={() => setShowEditTabModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed top-4 right-4 flex gap-2">
        <button className="text-[var(--accent)]" onClick={toggleTheme}>🌙</button>
        <button className="text-[var(--accent)]" onClick={exportSettings}>📤</button>
        <label className="text-[var(--accent)] cursor-pointer">
          📥
          <input type="file" accept=".json" className="hidden" onChange={importSettings} />
        </label>
      </div>
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));