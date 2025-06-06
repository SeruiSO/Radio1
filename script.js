import React, { useState, useEffect, useRef } from 'https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js';
import ReactDOM from 'https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js';

const themes = {
  'neon-pulse': { bg: '#0A0A0A', container: '#1A1A1A', accent: '#00F0FF', text: '#F0F0F0', gradient: '#003C4B' },
  'lime-surge': { bg: '#0A0A0A', container: '#1A1A1A', accent: '#B2FF59', text: '#E8F5E9', gradient: '#2E4B2F' },
  'flamingo-flash': { bg: '#0A0A0A', container: '#1A1A1A', accent: '#FF4081', text: '#FCE4EC', gradient: '#4B1A2E' },
};

const App = () => {
  const [currentTab, setCurrentTab] = useState(localStorage.getItem('currentTab') || 'techno');
  const [stations, setStations] = useState({});
  const [currentStation, setCurrentStation] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(parseFloat(localStorage.getItem('volume')) || 0.9);
  const [favorites, setFavorites] = useState(JSON.parse(localStorage.getItem('favoriteStations')) || []);
  const [search, setSearch] = useState('');
  const [theme, setTheme] = useState(localStorage.getItem('selectedTheme') || 'neon-pulse');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const audioRef = useRef(new Audio());

  useEffect(() => {
    fetch('/stations.json')
      .then(res => res.json())
      .then(data => setStations(data))
      .catch(() => setStations({}));
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
    return () => {
      window.removeEventListener('online', () => setIsOnline(true));
      window.removeEventListener('offline', () => setIsOnline(false));
    };
  }, []);

  useEffect(() => {
    audioRef.current.volume = volume;
    localStorage.setItem('volume', volume);
  }, [volume]);

  useEffect(() => {
    localStorage.setItem('favoriteStations', JSON.stringify(favorites));
    if (currentTab === 'best') {
      setCurrentTab('best');
    }
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('selectedTheme', theme);
    document.documentElement.style.setProperty('--body-bg', themes[theme].bg);
    document.documentElement.style.setProperty('--container-bg', themes[theme].container);
    document.documentElement.style.setProperty('--accent', themes[theme].accent);
    document.documentElement.style.setProperty('--text', themes[theme].text);
    document.documentElement.style.setProperty('--accent-gradient', themes[theme].gradient);
  }, [theme]);

  const switchTab = (tab) => {
    setCurrentTab(tab);
    localStorage.setItem('currentTab', tab);
    setCurrentStation(null);
    audioRef.current.pause();
    setIsPlaying(false);
  };

  const playStation = (station) => {
    audioRef.current.src = station.value;
    audioRef.current.play().then(() => {
      setIsPlaying(true);
      setCurrentStation(station);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: station.name,
          artist: `${station.genre} | ${station.country}`,
          album: 'Radio S O',
        });
      }
    }).catch(err => console.error('Playback error:', err));
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else if (currentStation) {
      audioRef.current.play().then(() => setIsPlaying(true));
    }
  };

  const toggleFavorite = (name) => {
    setFavorites(favs => 
      favs.includes(name) ? favs.filter(f => f !== name) : [name, ...favs]
    );
  };

  const filteredStations = () => {
    const stationList = currentTab === 'best'
      ? favorites.map(name => Object.values(stations).flat().find(s => s.name === name)).filter(Boolean)
      : stations[currentTab] || [];
    return stationList.filter(s => 
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.genre.toLowerCase().includes(search.toLowerCase()) ||
      s.country.toLowerCase().includes(search.toLowerCase())
    );
  };

  if (!isOnline) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center">
        <h1 className="text-4xl font-bold mb-4">Offline</h1>
        <p>Please check your internet connection and try again.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-container-bg p-4 border-r border-accent">
        <h1 className="text-3xl font-bold text-accent mb-6">Radio S O</h1>
        <nav>
          {['best', 'techno', 'trance', 'ukraine', 'pop'].map(tab => (
            <button
              key={tab}
              className={`block w-full text-left py-2 px-4 mb-2 rounded-lg ${currentTab === tab ? 'bg-accent text-dark-bg' : 'hover:bg-accent hover:text-dark-bg'}`}
              onClick={() => switchTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
        <select
          className="mt-4 w-full p-2 bg-container-bg border border-accent rounded-lg"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        >
          {Object.keys(themes).map(t => (
            <option key={t} value={t}>{t.replace('-', ' ').toUpperCase()}</option>
          ))}
        </select>
      </aside>
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <input
            type="text"
            placeholder="Search stations..."
            className="w-full p-3 mb-6 bg-container-bg border border-accent rounded-lg text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="bg-container-bg p-4 rounded-lg border border-accent mb-6">
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 bg-accent rounded-full ${isPlaying ? 'animate-wave' : ''}`}
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{currentStation?.name || 'Select a station'}</h2>
                <p className="text-sm">Genre: {currentStation?.genre || '-'}</p>
                <p className="text-sm">Country: {currentStation?.country || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-4">
              <button
                className="p-3 bg-accent text-dark-bg rounded-lg"
                onClick={() => {
                  const list = filteredStations();
                  const idx = list.findIndex(s => s.name === currentStation?.name);
                  playStation(list[idx > 0 ? idx - 1 : list.length - 1]);
                }}
              >
                ⏮
              </button>
              <button
                className="p-3 bg-accent text-dark-bg rounded-lg"
                onClick={togglePlayPause}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button
                className="p-3 bg-accent text-dark-bg rounded-lg"
                onClick={() => {
                  const list = filteredStations();
                  const idx = list.findIndex(s => s.name === currentStation?.name);
                  playStation(list[idx < list.length - 1 ? idx + 1 : 0]);
                }}
              >
                ⏭
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-32"
              />
            </div>
          </div>
          <div className="grid gap-4">
            {filteredStations().map(station => (
              <div
                key={station.name}
                className={`p-4 bg-container-bg border border-accent rounded-lg flex justify-between items-center cursor-pointer ${currentStation?.name === station.name ? 'bg-accent text-dark-bg' : ''}`}
                onClick={() => playStation(station)}
              >
                <span>{station.emoji} {station.name}</span>
                <button
                  className={`text-xl ${favorites.includes(station.name) ? 'text-yellow-400' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(station.name);
                  }}
                >
                  ★
                </button>
              </div>
            ))}
            {filteredStations().length === 0 && (
              <div className="text-center text-gray-400">No stations found</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

const styles = `
  .animate-wave {
    animation: wave 1.2s infinite ease-in-out;
  }
  @keyframes wave {
    0%, 100% { transform: scaleY(0.3); }
    50% { transform: scaleY(1); }
  }
`;
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

ReactDOM.render(<App />, document.getElementById('root'));