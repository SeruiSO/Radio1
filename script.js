import React, { useState, useEffect, useRef } from 'https://cdn.jsdelivr.net/npm/react@18.2.0/umd/react.production.min.js';
import ReactDOM from 'https://cdn.jsdelivr.net/npm/react-dom@18.2.0/umd/react-dom.production.min.js';

const App = () => {
  const [currentTab, setCurrentTab] = useState(localStorage.getItem('currentTab') || 'techno');
  const [stations, setStations] = useState({});
  const [favorites, setFavorites] = useState(JSON.parse(localStorage.getItem('favorites')) || []);
  const [currentStation, setCurrentStation] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [streak, setStreak] = useState(parseInt(localStorage.getItem('streak')) || 0);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'coral-vibe');
  const audioRef = useRef(new Audio());
  const [showThemeModal, setShowThemeModal] = useState(false);

  const themes = {
    'coral-vibe': { primary: '#FF6F61', secondary: '#2D2D2D', text: '#F0F0F0', gradient: '#4B1A2E' },
    'neon-lime': { primary: '#B2FF59', secondary: '#2D2D2D', text: '#E8F5E9', gradient: '#2E4B2F' },
    'cyber-purple': { primary: '#7C4DFF', secondary: '#1A1A1A', text: '#EDE7F6', gradient: '#2E1A47' }
  };

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary', themes[theme].primary);
    root.style.setProperty('--secondary', themes[theme].secondary);
    root.style.setProperty('--text', themes[theme].text);
    root.style.setProperty('--gradient', themes[theme].gradient);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const loadStations = async () => {
      try {
        const response = await fetch(`stations.json?t=${Date.now()}`, { cache: 'no-cache' });
        const data = await response.json();
        setStations(data);
        const savedStation = JSON.parse(localStorage.getItem('currentStation'));
        if (savedStation && data[currentTab]?.find(s => s.name === savedStation.name)) {
          setCurrentStation(savedStation);
          audioRef.current.src = savedStation.value;
          if (localStorage.getItem('isPlaying') === 'true') {
            audioRef.current.play().catch(() => {});
            setIsPlaying(true);
          }
        }
      } catch (error) {
        console.error('Error loading stations:', error);
      }
    };
    loadStations();

    const updateStreak = () => {
      const lastVisit = localStorage.getItem('lastVisit');
      const today = new Date().toDateString();
      if (lastVisit !== today) {
        setStreak(s => {
          const newStreak = lastVisit ? s + 1 : 1;
          localStorage.setItem('streak', newStreak);
          localStorage.setItem('lastVisit', today);
          return newStreak;
        });
      }
    };
    updateStreak();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
  }, []);

  const switchTab = (tab) => {
    setCurrentTab(tab);
    localStorage.setItem('currentTab', tab);
    setSearchQuery('');
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else if (currentStation) {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
    localStorage.setItem('isPlaying', !isPlaying);
  };

  const selectStation = (station) => {
    setCurrentStation(station);
    audioRef.current.src = station.value;
    audioRef.current.play().catch(() => {});
    setIsPlaying(true);
    localStorage.setItem('currentStation', JSON.stringify(station));
    localStorage.setItem('isPlaying', true);
  };

  const toggleFavorite = (stationName) => {
    const newFavorites = favorites.includes(stationName)
      ? favorites.filter(name => name !== stationName)
      : [...favorites, stationName];
    setFavorites(newFavorites);
    localStorage.setItem('favorites', JSON.stringify(newFavorites));
  };

  const shareStation = (station) => {
    if (navigator.share) {
      navigator.share({
        title: `Слухай ${station.name} на VibeWave Radio!`,
        text: `Перевір цю круту радіостанцію: ${station.name} (${station.genre}) з ${station.country}!`,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(`${station.name} (${station.genre}) - ${station.country}`);
      alert('Посилання скопійовано до буферу обміну!');
    }
  };

  const filteredStations = currentTab === 'favorites'
    ? favorites.map(name => Object.values(stations).flat().find(s => s.name === name)).filter(Boolean)
    : stations[currentTab]?.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.genre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.country.toLowerCase().includes(searchQuery.toLowerCase())
      ) || [];

  return (
    <div className="min-h-screen bg-secondary flex flex-col">
      <header className="p-4 flex justify-between items-center bg-gradient-to-r from-primary to-gradient">
        <h1 className="text-2xl font-bold text-text">VibeWave Radio</h1>
        <button onClick={() => setShowThemeModal(true)} className="p-2 rounded-full bg-primary text-secondary">
          🎨
        </button>
      </header>

      {showThemeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-secondary p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-text">Обери тему</h2>
            <div className="grid grid-cols-2 gap-4">
              {Object.keys(themes).map(t => (
                <button
                  key={t}
                  onClick={() => { setTheme(t); setShowThemeModal(false); }}
                  className={`p-4 rounded-lg ${theme === t ? 'bg-primary text-secondary' : 'bg-gray-800 text-text'}`}
                >
                  {t.replace('-', ' ')}
                </button>
              ))}
            </div>
            <button onClick={() => setShowThemeModal(false)} className="mt-4 p-2 bg-primary text-secondary rounded-lg w-full">
              Закрити
            </button>
          </div>
        </div>
      )}

      {currentStation && (
        <div className="p-4 bg-gradient-to-r from-primary to-gradient rounded-lg m-4 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-text">{currentStation.name}</h2>
              <p className="text-text">Жанр: {currentStation.genre}</p>
              <p className="text-text">Країна: {currentStation.country}</p>
            </div>
            <button
              onClick={() => toggleFavorite(currentStation.name)}
              className={`text-2xl ${favorites.includes(currentStation.name) ? 'text-yellow-400' : 'text-text'}`}
            >
              ★
            </button>
            <button onClick={() => shareStation(currentStation)} className="text-2xl text-text">
              📤
            </button>
          </div>
          <div className="flex justify-center gap-4 mt-4">
            <button onClick={togglePlayPause} className="p-4 bg-primary text-secondary rounded-full text-2xl">
              {isPlaying ? '⏸' : '▶'}
            </button>
          </div>
          <div className="flex gap-2 mt-4 justify-center">
            {[...Array(7)].map((_, i) => (
              <div
                key={i}
                className="w-2 bg-primary rounded-full"
                style={{
                  animation: isPlaying ? `wave 1.2s infinite ease-in-out ${i * 0.1}s` : 'none',
                  height: '40px'
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="p-4 flex-1">
        <input
          type="text"
          placeholder="Пошук станцій..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-3 rounded-lg bg-gray-800 text-text mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {filteredStations.length ? (
            filteredStations.map(station => (
              <div
                key={station.value}
                onClick={() => selectStation(station)}
                className="p-4 bg-gray-800 rounded-lg shadow-lg hover:bg-primary hover:text-secondary transition-all cursor-pointer flex justify-between items-center"
              >
                <div>
                  <h3 className="text-lg font-semibold">{station.emoji} {station.name}</h3>
                  <p className="text-sm">{station.genre} | {station.country}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(station.name);
                  }}
                  className={`text-xl ${favorites.includes(station.name) ? 'text-yellow-400' : 'text-text'}`}
                >
                  ★
                </button>
              </div>
            ))
          ) : (
            <div className="text-center text-text opacity-70">Немає станцій</div>
          )}
        </div>
      </div>

      <nav className="fixed bottom-0 w-full bg-secondary p-4 flex justify-around border-t border-primary">
        {['techno', 'trance', 'ukraine', 'favorites'].map(tab => (
          <button
            key={tab}
            onClick={() => switchTab(tab)}
            className={`p-2 rounded-lg ${currentTab === tab ? 'bg-primary text-secondary' : 'text-text'}`}
          >
            {tab === 'favorites' ? '⭐ Улюблені' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
        <button onClick={() => switchTab('profile')} className={`p-2 rounded-lg ${currentTab === 'profile' ? 'bg-primary text-secondary' : 'text-text'}`}>
          Профіль
        </button>
      </nav>

      {currentTab === 'profile' && (
        <div className="p-4 flex-1">
          <h2 className="text-2xl font-bold text-text mb-4">Твій профіль</h2>
          <p className="text-text">Стрік: {streak} днів 🔥</p>
          <p className="text-text mt-2">Слухай щодня, щоб збільшити стрік!</p>
        </div>
      )}

      <style>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));