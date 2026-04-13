import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { fetchAllFuelTypesInBounds, fetchNomosAverages } from '../api.js';
import { FUEL_TYPES, NOMOS_CODES, DEBUG } from '../constants.js';

const BRAND_LOGO_EXTENSIONS = {
  AVIN: 'png',
  BP: 'png',
  CYCLON: 'jpg',
  DRIVE: 'png',
  EKO: 'png',
  JETOIL: 'jpg',
  KAOIL: 'jpg',
  KMOIL: 'jpg',
  MEDOIL: 'jpg',
  REVOIL: 'jpg',
  SHELL: 'png',
  SILKOIL: 'png',
  VALIN: 'jpg',
  WIN: 'png',
  'ΑΙΓΑΙΟ (AEGEAN)': 'png',
  'ΑΝΕΞΑΡΤΗΤΟ ΠΡΑΤΗΡΙΟ': 'png',
  'ΑΡΓΩ': 'jpg',
  'ΕΛΙΝΟΙΛ': 'png',
  'ΕΤΕΚΑ': 'jpg',
  'ΤΡΙΑΙΝΑ': 'png',
};

function log(...args) {
  if (DEBUG) console.log('[Kaysima MapView]', ...args);
}

// Helper to get nomos name from code
function getNomosName(code) {
  const nomos = NOMOS_CODES.find(n => n.code === code);
  return nomos ? nomos.name : code;
}

function getBrandLogoPath(brand) {
  if (!brand) return null;

  const extension = BRAND_LOGO_EXTENSIONS[brand];
  if (!extension) return null;

  return `${import.meta.env.BASE_URL}brands/${encodeURIComponent(brand)}.${extension}`;
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

function createNomosIcon(price, cls) {
  const bg    = PRICE_COLORS[cls] ?? PRICE_COLORS.none;
  const label = price !== null && price !== undefined ? price.toFixed(3) : '—';
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${bg};
      color:#fff;
      font-size:13px;
      font-weight:700;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
      padding:6px 10px;
      border-radius:50%;
      width:40px;
      height:40px;
      display:flex;
      align-items:center;
      justify-content:center;
      white-space:nowrap;
      box-shadow:0 2px 8px rgba(0,0,0,0.55);
      border:2px solid rgba(255,255,255,0.7);
    ">${label}</div>`,
    iconSize:   [40, 40],
    iconAnchor: [20, 20],
  });
}

// ─── Map Event Listener Sub-component ───────────────────────────────────────

function MapEventListener({ onBoundsChange }) {
  const map = useMap();

  useEffect(() => {
    const handleMove = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      log(`🗺️  Map moved to: lat=${center.lat.toFixed(5)}, lon=${center.lng.toFixed(5)}, zoom=${zoom}`);
      onBoundsChange(center.lat, center.lng, zoom);
    };

    map.on('moveend', handleMove);
    map.on('zoomend', handleMove);

    return () => {
      map.off('moveend', handleMove);
      map.off('zoomend', handleMove);
    };
  }, [map, onBoundsChange]);

  return null;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function MapView({ selectedFuel, userLocation, onBack }) {
  const [stations,   setStations]   = useState([]);
  const [nomosData,  setNomosData]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [scrapeDate, setScrapeDate] = useState('');
  const [mapCenter,  setMapCenter]  = useState({ lat: userLocation.lat, lon: userLocation.lon });
  const [zoom,       setZoom]       = useState(13);
  const fetchAbortRef = useRef(null);

  const fetchStations = (lat, lon) => {
    // Cancel previous request if still pending
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }

    log(`📍 Fetching stations for: lat=${lat.toFixed(5)}, lon=${lon.toFixed(5)}`);
    setLoading(true);
    setError(null);

    fetchAllFuelTypesInBounds(lat, lon)
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
  };

  const fetchNomosData = () => {
    log(`📍 Fetching nomos averages for fuel type: ${selectedFuel}`);
    setLoading(true);
    setError(null);

    fetchNomosAverages(selectedFuel)
      .then(data => {
        log(`✅ Nomos averages fetched: ${data.length} total`);
        setNomosData(data);
        const withDate = data.find(n => n.last_updated);
        if (withDate) {
          log(`📅 Last updated: ${withDate.last_updated}`);
          setScrapeDate(withDate.last_updated);
        }
      })
      .catch(e => {
        log(`❌ Error fetching nomos averages: ${e.message}`);
        setError(e.message);
      })
      .finally(() => setLoading(false));
  };

  // Initial fetch on mount
  useEffect(() => {
    log(`📍 MapView mounted, fetching stations for location: ${userLocation.lat}, ${userLocation.lon}`);
    fetchStations(userLocation.lat, userLocation.lon);
  }, []);

  // Handle map bounds change (from MapEventListener)
  const handleBoundsChange = (lat, lon, z) => {
    setMapCenter({ lat, lon });
    setZoom(z);
    
    // Zoom threshold: show nomos averages when zoom < 12
    if (z < 12) {
      fetchNomosData();
    } else {
      fetchStations(lat, lon);
    }
  };

  // Aggregate stations by nomos (for zoomed-out view)
  const ZOOM_THRESHOLD = 12;
  const isZoomedOut = zoom < ZOOM_THRESHOLD;

  const aggregatedByNomos = isZoomedOut ? nomosData.map(n => ({
    nomos_code: n.nomos_code,
    avgLat: n.centroid_lat,
    avgLon: n.centroid_lon,
    stationCount: n.station_count,
    prices: {
      [selectedFuel]: { avg: n.avg_price }
    }
  })) : [];

  // Price range for selected fuel type (for colour coding)
  let selectedPrices, minP, maxP;
  if (isZoomedOut) {
    selectedPrices = aggregatedByNomos
      .map(n => n.prices[selectedFuel]?.avg)
      .filter(p => p !== null && p !== undefined);
  } else {
    selectedPrices = stations
      .map(s => s.prices[selectedFuel]?.price)
      .filter(p => p !== null && p !== undefined);
  }
  minP = selectedPrices.length ? Math.min(...selectedPrices) : 0;
  maxP = selectedPrices.length ? Math.max(...selectedPrices) : 0;

  log(`💰 Selected fuel (${selectedFuel}): ${selectedPrices.length} prices, range €${minP.toFixed(3)}-€${maxP.toFixed(3)}, zoom=${zoom}, aggregated=${isZoomedOut}`);

  const fuelName = FUEL_TYPES.find(f => f.code === selectedFuel)?.name ?? '';

  return (
    <div className="map-wrapper">
      {/* ── Top bar ── */}
      <div className="map-topbar">
        <button className="back-btn" onClick={onBack}>← Πίσω</button>
        <span className="map-title">⛽ {fuelName}</span>
        {loading && <span className="map-loading">Φόρτωση…</span>}
        {!loading && !error && (
          <>
            <span className="map-count">{isZoomedOut ? `${aggregatedByNomos.length} περιοχές` : `${stations.length} σταθμοί`}</span>
            <span className="map-zoom" style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '8px' }}>🔍 zoom={zoom}</span>
          </>
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

        {/* Listen for map movement to update stations */}
        <MapEventListener onBoundsChange={handleBoundsChange} />

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

        {/* Station markers or aggregated nomos markers */}
        {isZoomedOut ? (
          // Zoomed out: show aggregated nomos markers
          aggregatedByNomos.map((nomosGroup, i) => {
            const price = nomosGroup.prices[selectedFuel]?.avg ?? null;
            const cls   = getPriceClass(price, minP, maxP);
            const icon  = createNomosIcon(price, cls);

            return (
              <Marker key={`nomos-${i}`} position={[nomosGroup.avgLat, nomosGroup.avgLon]} icon={icon}>
                <Popup maxWidth={280}>
                  <div className="popup-content">
                    <div className="popup-name">📍 {getNomosName(nomosGroup.nomos_code)}</div>
                    <div className="popup-address">{nomosGroup.stationCount} σταθμοί</div>
                    <div className="popup-prices">
                      <div className="popup-price-row popup-price-row--selected">
                        <span className="popup-fuel-name">Μέσος όρος {FUEL_TYPES.find(f => f.code === selectedFuel)?.name}</span>
                        <span className="popup-fuel-price">
                          {price != null ? price.toFixed(3) + ' €' : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })
        ) : (
          // Zoomed in: show individual station markers
          stations.map((station, i) => {
            const priceInfo = station.prices[selectedFuel];
            const price     = priceInfo?.price ?? null;
            const cls       = getPriceClass(price, minP, maxP);
            const icon      = createPriceIcon(price, cls);

            return (
              <Marker key={i} position={[station.lat, station.lon]} icon={icon}>
                <Popup maxWidth={280}>
                  <div className="popup-content">
                    <div className="popup-header">
                      {station.brand && getBrandLogoPath(station.brand) && (
                        <img
                          className="popup-logo"
                          src={getBrandLogoPath(station.brand)}
                          alt={station.brand}
                          loading="lazy"
                        />
                      )}
                      <div className="popup-header-text">
                        {station.brand && (
                          <div className="popup-name">{station.brand}</div>
                        )}
                        <div className="popup-brand">{station.station_name}</div>
                      </div>
                    </div>
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
          })
        )}
      </MapContainer>
    </div>
  );
}
