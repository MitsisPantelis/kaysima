import { useState } from 'react';
import FuelSelector from './components/FuelSelector.jsx';
import MapView from './components/MapView.jsx';

export default function App() {
  const [step, setStep]               = useState('select'); // 'select' | 'locating' | 'map'
  const [selectedFuel, setSelectedFuel] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [geoError, setGeoError]         = useState(null);

  function handleFuelSelect(fuelCode) {
    setSelectedFuel(fuelCode);
    setStep('locating');
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setStep('map');
      },
      err => {
        setGeoError('Δεν ήταν δυνατός ο εντοπισμός τοποθεσίας. Βεβαιωθείτε ότι επιτρέπετε την πρόσβαση.');
        console.error('Geolocation error:', err.message);
        setStep('select');
        setSelectedFuel(null);
      },
      { timeout: 12000, enableHighAccuracy: true },
    );
  }

  function handleBack() {
    setStep('select');
    setSelectedFuel(null);
    setUserLocation(null);
  }

  if (step === 'select' || step === 'locating') {
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
