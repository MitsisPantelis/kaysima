import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { fetchAllFuelTypesInBounds } from '../api.js';
import { FUEL_TYPES, DEBUG } from '../constants.js';

function log(...args) {
  if (DEBUG) console.log('[Kaysima MapView]', ...args);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getPriceClass(price, min, max) {
  if (price === null || price === undefined) return 'none';
  const range = max - min || 1;
  const pct = (price - min) / range;
  if (pct < 0.33) return 'cheap';
  if (pct < 0.66) return 'mid';
  return 'pricey';
}

const PRICE_COLORS = {
  cheap:  '#22c55e',
  mid:    '#f59e0b',
  pricey: '#ef4444',
  none:   '#94a3b8',
};

function createPriceIcon(price, cls) {
  const bg    = PRICE_COLORS[cls] ?? PRICE_COLORS.none;
  const label = price !== null && price !== undefined ? price.toFixed(3) : '—';
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${bg};
      color:#fff;
      font-size:11px;
      font-weight:700;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
      padding:3px 7px;
      border-radius:10px;
      white-space:nowrap;
      box-shadow:0 1px 5px rgba(0,0,0,0.45);
      border:1.5px solid rgba(255,255,255,0.55);
    ">${label}</div>`,
    iconSize:   [50, 22],
    iconAnchor: [25, 11],
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function MapView({ selectedFuel, userLocation, onBack }) {
  const [stations,   setStations]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [scrapeDate, setScrapeDate] = useState('');

  useEffect(() => {
    log(`📍 MapView mounted, fetching stations for location: ${userLocation.lat}, ${userLocation.lon}`);
    setLoading(true);
    setError(null);

    fetchAllFuelTypesInBounds(userLocation.lat, userLocation.lon)
      .then(data => {
        log(`✅ Stations fetched: ${data.length} total`);
        setStations(data);
        const withDate = data.find(s => s.scrape_date);
        if (withDate) {
          log(`📅 Scrape date: ${withDate.scrape_date}`);
          setScrapeDate(withDate.scrape_date);
        }
      })
      .catch(e => {
        log(`❌ Error fetching stations: ${e.message}`);
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [userLocation.lat, userLocation.lon]);

  // Price range for selected fuel type (for colour coding)
  const selectedPrices = stations
    .map(s => s.prices[selectedFuel]?.price)
    .filter(p => p !== null && p !== undefined);
  const minP = selectedPrices.length ? Math.min(...selectedPrices) : 0;
  const maxP = selectedPrices.length ? Math.max(...selectedPrices) : 0;

  log(`💰 Selected fuel (${selectedFuel}): ${selectedPrices.length} prices, range €${minP.toFixed(3)}-€${maxP.toFixed(3)}`);

  const fuelName = FUEL_TYPES.find(f => f.code === selectedFuel)?.name ?? '';

  return (
    <div className="map-wrapper">
      {/* ── Top bar ── */}
      <div className="map-topbar">
        <button className="back-btn" onClick={onBack}>← Πίσω</button>
        <span className="map-title">⛽ {fuelName}</span>
        {loading && <span className="map-loading">Φόρτωση…</span>}
        {!loading && !error && (
          <span className="map-count">{stations.length} σταθμοί</span>
        )}
        {scrapeDate && (
          <span className="map-date">Δεδομένα: {scrapeDate}</span>
        )}
        {error && <span className="map-error">⚠ {error}</span>}

        {/* Colour legend */}
        {!loading && !error && (
          <div className="map-legend">
            <span className="legend-dot" style={{ background: PRICE_COLORS.cheap }}  /> Φθηνό
            <span className="legend-dot" style={{ background: PRICE_COLORS.mid }}    /> Μέτριο
            <span className="legend-dot" style={{ background: PRICE_COLORS.pricey }} /> Ακριβό
          </div>
        )}
      </div>

      {/* ── Map ── */}
      <MapContainer
        center={[userLocation.lat, userLocation.lon]}
        zoom={13}
        style={{ flex: 1 }}
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}.png"
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={20}
          eventHandlers={{
            load: () => log('✅ TileLayer loaded'),
            error: (e) => log('❌ TileLayer error:', e),
          }}
        />

        {/* User location dot */}
        <CircleMarker
          center={[userLocation.lat, userLocation.lon]}
          radius={8}
          pathOptions={{
            color:       '#6366f1',
            fillColor:   '#818cf8',
            fillOpacity: 0.9,
            weight:      2,
          }}
        />

        {/* Station markers */}
        {stations.map((station, i) => {
          const priceInfo = station.prices[selectedFuel];
          const price     = priceInfo?.price ?? null;
          const cls       = getPriceClass(price, minP, maxP);
          const icon      = createPriceIcon(price, cls);

          return (
            <Marker key={i} position={[station.lat, station.lon]} icon={icon}>
              <Popup maxWidth={280}>
                <div className="popup-content">
                  <div className="popup-name">{station.station_name}</div>
                  {station.brand && (
                    <div className="popup-brand">{station.brand}</div>
                  )}
                  <div className="popup-address">{station.address}</div>

                  <div className="popup-prices">
                    {FUEL_TYPES.map(ft => {
                      const info       = station.prices[ft.code];
                      const isSelected = ft.code === selectedFuel;
                      return (
                        <div
                          key={ft.code}
                          className={`popup-price-row${isSelected ? ' popup-price-row--selected' : ''}`}
                        >
                          <span className="popup-fuel-name">{ft.name}</span>
                          <span className="popup-fuel-price">
                            {info?.price != null ? info.price.toFixed(3) + ' €' : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {priceInfo?.reported_at && (
                    <div className="popup-reported">🕒 {priceInfo.reported_at}</div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
