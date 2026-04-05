import { useState, useEffect } from 'react';
import { DEBUG } from './constants.js';
import FuelSelector from './components/FuelSelector.jsx';
import MapView from './components/MapView.jsx';

function log(...args) {
  if (DEBUG) console.log('[Kaysima App]', ...args);
}

export default function App() {
  const [step, setStep]               = useState('locating'); // 'locating' | 'select' | 'map'
  const [selectedFuel, setSelectedFuel] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [geoError, setGeoError]         = useState(null);

  // Request geolocation on mount
  useEffect(() => {
    log('🚀 App mounted, requesting geolocation...');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        log(`✅ Geolocation success: ${lat}, ${lon}`);
        setUserLocation({ lat, lon });
        setStep('select');
      },
      err => {
        log(`❌ Geolocation error: ${err.code} - ${err.message}`);
        setGeoError('Δεν ήταν δυνατός ο εντοπισμός τοποθεσίας. Βεβαιωθείτε ότι επιτρέπετε την πρόσβαση.');
        // Still show selector even if location fails
        setStep('select');
      },
      { timeout: 12000, enableHighAccuracy: true },
    );
  }, []);

  function handleFuelSelect(fuelCode) {
    log(`🛢️  User selected fuel type: ${fuelCode}`);
    setSelectedFuel(fuelCode);
    setStep('map');
  }

  function handleBack() {
    log('👈 User clicked back');
    setStep('select');
    setSelectedFuel(null);
  }

  log(`📍 Current state: step=${step}, fuel=${selectedFuel}, location=${userLocation ? `${userLocation.lat},${userLocation.lon}` : 'null'}`);

  if (step === 'locating' || step === 'select') {
    return (
      <FuelSelector
        onSelect={handleFuelSelect}
        loading={step === 'locating'}
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
