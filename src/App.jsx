import { useState, useEffect } from 'react';
import { DEBUG } from './constants.js';
import FuelSelector from './components/FuelSelector.jsx';
import MapView from './components/MapView.jsx';

function log(...args) {
  if (DEBUG) console.log('[Kaysima App]', ...args);
}

const LOCATION_STORAGE_KEY = 'kaysima_user_location';

export default function App() {
  const [step, setStep]               = useState('select'); // 'select' | 'map'
  const [selectedFuel, setSelectedFuel] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [geoError, setGeoError]         = useState(null);
  const [isLocating, setIsLocating]     = useState(true);

  // Request geolocation on mount (or retrieve from sessionStorage)
  useEffect(() => {
    log('🚀 App mounted, checking for stored location...');
    
    // Try to get from sessionStorage first
    const stored = sessionStorage.getItem(LOCATION_STORAGE_KEY);
    if (stored) {
      try {
        const loc = JSON.parse(stored);
        log(`✅ Location restored from sessionStorage: ${loc.lat}, ${loc.lon}`);
        setUserLocation(loc);
        setIsLocating(false);
        return;
      } catch (e) {
        log(`⚠️  Failed to parse stored location: ${e.message}`);
      }
    }

    // Request fresh geolocation
    log('📍 Requesting fresh geolocation...');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        log(`✅ Geolocation success: ${loc.lat}, ${loc.lon}`);
        
        // Store in sessionStorage for reuse
        sessionStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(loc));
        log('💾 Location stored in sessionStorage');
        
        setUserLocation(loc);
        setIsLocating(false);
      },
      err => {
        log(`❌ Geolocation error: ${err.code} - ${err.message}`);
        setGeoError('Δεν ήταν δυνατός ο εντοπισμός τοποθεσίας. Βεβαιωθείτε ότι επιτρέπετε την πρόσβαση.');
        setIsLocating(false);
      },
      { timeout: 12000, enableHighAccuracy: true },
    );
  }, []);

  function handleFuelSelect(fuelCode) {
    log(`🛢️  User selected fuel type: ${fuelCode}`);
    
    if (!userLocation) {
      log(`⏳ Location not ready yet, keeping user on selector with loading indicator`);
      setSelectedFuel(fuelCode);
      return;
    }

    setSelectedFuel(fuelCode);
    setStep('map');
  }

  function handleBack() {
    log('👈 User clicked back');
    setStep('select');
    setSelectedFuel(null);
  }

  log(`📍 Current state: step=${step}, fuel=${selectedFuel}, location=${userLocation ? `${userLocation.lat},${userLocation.lon}` : 'null'}, locating=${isLocating}`);

  if (step === 'select') {
    return (
      <FuelSelector
        onSelect={handleFuelSelect}
        loading={isLocating || (selectedFuel && !userLocation)}
        selectedFuel={selectedFuel}
        error={geoError}
      />
    );
  }

  return (
    <MapView
      selectedFuel={selectedFuel}
      userLocation={userLocation}
      onBack={handleBack}
    />
  );
}
