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

// Returns the cheapest price across all product variants for a given fuel type.
// station.prices[fuelCode] is now an array of { price, product, reported_at }.
function getMinPrice(station, fuelCode) {
  const variants = station.prices[fuelCode];
  if (!variants || variants.length === 0) return null;
  const prices = variants.map(v => v.price).filter(p => p != null);
  return prices.length ? Math.min(...prices) : null;
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

// Previous color logic kept as a reference:
// each price was compared against the current dataset's min/max range,
// with the bottom third shown as green, the middle third as orange,
// and the top third as red.
function getPriceClass(price, min, max) {
  if (price === null || price === undefined) return 'none';
  const range = max - min || 1;
  const pct = (price - min) / range;
  if (pct < 0.33) return 'cheap';
  if (pct < 0.66) return 'mid';
  return 'pricey';
}

const PRICE_COLORS = {
  top3:   '#38bdf8',
  cheap:  '#22c55e',
  mid:    '#f59e0b',
  pricey: '#ef4444',
  none:   '#cbd5e1',
};

const PRICE_Z_INDEX = {
  top3:  400,
  cheap: 300,
  mid:   200,
  pricey: 100,
  none:  50,
};

function getStationPriceClass(price, nomosAverage, isTopThree = false) {
  if (isTopThree) return 'top3';
  if (price === null || price === undefined) return 'none';
  if (nomosAverage === null || nomosAverage === undefined) return 'mid';

  const delta = price - nomosAverage;

  if (delta <= -0.01) return 'cheap';
  if (delta >= 0.01) return 'pricey';
  return 'mid';
}

function getMarkerStyle(cls) {
  if (cls === 'top3') {
    return {
      border: '2px solid rgba(255,255,255,0.95)',
      boxShadow: '0 0 0 4px rgba(56,189,248,0.28), 0 4px 14px rgba(14,165,233,0.55)',
      opacity: 1,
      transform: 'scale(1.08)',
    };
  }

  if (cls === 'cheap') {
    return {
      border: '2px solid rgba(255,255,255,0.8)',
      boxShadow: '0 3px 10px rgba(34,197,94,0.35)',
      opacity: 1,
      transform: 'scale(1.02)',
    };
  }

  if (cls === 'none') {
    return {
      border: '1.5px solid rgba(255,255,255,0.45)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
      opacity: 0.72,
      transform: 'scale(0.96)',
    };
  }

  return {
    border: '1.5px solid rgba(255,255,255,0.55)',
    boxShadow: '0 1px 5px rgba(0,0,0,0.45)',
    opacity: 1,
    transform: 'scale(1)',
  };
}

function getMarkerZIndex(cls) {
  return PRICE_Z_INDEX[cls] ?? 0;
}

function createPriceIcon(price, cls) {
  const bg    = PRICE_COLORS[cls] ?? PRICE_COLORS.none;
  const label = price !== null && price !== undefined ? price.toFixed(3) : '—';
  const markerStyle = getMarkerStyle(cls);
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
      box-shadow:${markerStyle.boxShadow};
      border:${markerStyle.border};
      opacity:${markerStyle.opacity};
      transform:${markerStyle.transform};
    ">${label}</div>`,
    iconSize:   [50, 22],
    iconAnchor: [25, 11],
  });
}

function createNomosIcon(price, cls) {
  const bg    = PRICE_COLORS[cls] ?? PRICE_COLORS.none;
  const label = price !== null && price !== undefined ? price.toFixed(3) : '—';
  const markerStyle = getMarkerStyle(cls);
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
      box-shadow:${markerStyle.boxShadow};
      border:${markerStyle.border};
      opacity:${markerStyle.opacity};
      transform:${markerStyle.transform};
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

function RecenterControl({ userLocation }) {
  const map = useMap();

  const handleClick = () => {
    const targetZoom = Math.max(map.getZoom(), 13);
    log(`📍 Recentering map to user location: ${userLocation.lat}, ${userLocation.lon}, zoom=${targetZoom}`);
    map.flyTo([userLocation.lat, userLocation.lon], targetZoom, {
      animate: true,
      duration: 0.8,
    });
  };

  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-control leaflet-bar map-recenter-control">
        <button
          type="button"
          className="map-recenter-btn"
          onClick={handleClick}
          title="Κέντρο στη θέση μου"
          aria-label="Κέντρο στη θέση μου"
        >
          ◎
        </button>
      </div>
    </div>
  );
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
    fetchNomosData();
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

  const nomosAverageByCode = new Map(
    nomosData.map(n => [n.nomos_code, n.avg_price])
  );

  const topThreeStationKeys = new Set(
    stations
      .filter(station => getMinPrice(station, selectedFuel) != null)
      .sort((a, b) => getMinPrice(a, selectedFuel) - getMinPrice(b, selectedFuel))
      .slice(0, 3)
      .map(station => `${station.station_name}||${station.address}`)
  );

  // Price range for selected fuel type (for colour coding)
  let selectedPrices, minP, maxP;
  if (isZoomedOut) {
    selectedPrices = aggregatedByNomos
      .map(n => n.prices[selectedFuel]?.avg)
      .filter(p => p !== null && p !== undefined);
  } else {
    selectedPrices = stations
      .map(s => getMinPrice(s, selectedFuel))
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
            <span className="legend-dot" style={{ background: PRICE_COLORS.top3 }}   /> Top 3
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
        <RecenterControl userLocation={userLocation} />

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
              <Marker
                key={`nomos-${i}`}
                position={[nomosGroup.avgLat, nomosGroup.avgLon]}
                icon={icon}
                zIndexOffset={getMarkerZIndex(cls)}
              >
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
            const price      = getMinPrice(station, selectedFuel);
            const stationKey = `${station.station_name}||${station.address}`;
            const nomosAverage = nomosAverageByCode.get(station.nomos_code) ?? null;
            const isTopThree = topThreeStationKeys.has(stationKey);
            const cls       = getStationPriceClass(price, nomosAverage, isTopThree);
            const icon      = createPriceIcon(price, cls);

            return (
              <Marker key={i} position={[station.lat, station.lon]} icon={icon} zIndexOffset={getMarkerZIndex(cls)}>
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

                    <div className="popup-address">
                      Μέσος όρος νομού: {nomosAverage != null ? `${nomosAverage.toFixed(3)} €` : '—'}
                    </div>

                    <div className="popup-prices">
                      {FUEL_TYPES.map(ft => {
                        const variants   = station.prices[ft.code];
                        const isSelected = ft.code === selectedFuel;
                        if (!variants || variants.length === 0) {
                          return (
                            <div
                              key={ft.code}
                              className={`popup-price-row${isSelected ? ' popup-price-row--selected' : ''}`}
                            >
                              <span className="popup-fuel-name">{ft.name}</span>
                              <span className="popup-fuel-price">—</span>
                            </div>
                          );
                        }
                        if (variants.length === 1) {
                          const v = variants[0];
                          return (
                            <div
                              key={ft.code}
                              className={`popup-price-row${isSelected ? ' popup-price-row--selected' : ''}`}
                            >
                              <span className="popup-fuel-name">{v.product || ft.name}</span>
                              <span className="popup-fuel-price">
                                {v.price != null ? v.price.toFixed(3) + ' €' : '—'}
                              </span>
                            </div>
                          );
                        }
                        // Multiple product variants — show group heading + sub-rows
                        return (
                          <div
                            key={ft.code}
                            className={`popup-fuel-group${isSelected ? ' popup-fuel-group--selected' : ''}`}
                          >
                            <div className="popup-fuel-group-name">{ft.name}</div>
                            {variants.map((v, vi) => (
                              <div key={vi} className="popup-price-row popup-price-row--variant">
                                <span className="popup-fuel-name">{v.product || '—'}</span>
                                <span className="popup-fuel-price">
                                  {v.price != null ? v.price.toFixed(3) + ' €' : '—'}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>

                    {(() => {
                      const variants = station.prices[selectedFuel];
                      if (!variants || variants.length === 0) return null;
                      const cheapest = variants.reduce((a, b) =>
                        (a.price ?? Infinity) <= (b.price ?? Infinity) ? a : b
                      );
                      return cheapest.reported_at
                        ? <div className="popup-reported">🕒 {cheapest.reported_at}</div>
                        : null;
                    })()}
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
