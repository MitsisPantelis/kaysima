import { SUPABASE_URL, SUPABASE_ANON_KEY, FUEL_TYPES, DEBUG } from './constants';

function log(...args) {
  if (DEBUG) console.log('[Kaysima]', ...args);
}

function buildHeaders() {
  return {
    apikey:        SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

/**
 * Fetch all 6 fuel types for stations within a bounding box.
 * Makes 6 parallel requests and merges results by station.
 * Only returns stations that have geocoded coordinates.
 *
 * radiusDeg: approximate degree offset (~0.18° ≈ 20 km at Greek latitudes)
 */
export async function fetchAllFuelTypesInBounds(lat, lon, radiusDeg = 0.18) {
  log(`🔍 Fetching stations in bounding box: lat=${lat}, lon=${lon}, radius=${radiusDeg}°`);

  const latMin = (lat - radiusDeg).toFixed(5);
  const latMax = (lat + radiusDeg).toFixed(5);
  const lonMin = (lon - radiusDeg * 1.35).toFixed(5);
  const lonMax = (lon + radiusDeg * 1.35).toFixed(5);

  log(`📦 Bounds: lat [${latMin}, ${latMax}], lon [${lonMin}, ${lonMax}]`);

  const requests = FUEL_TYPES.map(({ code: fuelType }) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/prices_with_station`);
    url.searchParams.set('fuel_type', `eq.${fuelType}`);
    // PostgREST treats repeated params as AND conditions
    url.searchParams.append('lat', `gte.${latMin}`);
    url.searchParams.append('lat', `lte.${latMax}`);
    url.searchParams.append('lon', `gte.${lonMin}`);
    url.searchParams.append('lon', `lte.${lonMax}`);
    url.searchParams.set(
      'select',
      'station_name,brand,address,price,lat,lon,nomos_code,fuel_type,product,reported_at,scrape_date',
    );
    url.searchParams.set('limit', '1000');

    log(`⛽ Fuel type ${fuelType}: ${url.toString().substring(0, 100)}...`);

    return fetch(url.toString(), { headers: buildHeaders() }).then(r => {
      if (!r.ok) {
        log(`❌ HTTP ${r.status} for fuel type ${fuelType}`);
        throw new Error(`HTTP ${r.status}`);
      }
      return r.json().then(data => {
        log(`✅ Fuel type ${fuelType}: ${data.length} stations`);
        return data;
      });
    });
  });

  try {
    const results = await Promise.all(requests);

    // Merge into one object per station keyed by name+address
    const stationMap = new Map();
    for (const rows of results) {
      for (const row of rows) {
        if (row.lat === null || row.lon === null) {
          log(`⚠️  Skipping station ${row.station_name}: no coordinates`);
          continue;
        }
        const key = `${row.station_name}||${row.address}`;
        if (!stationMap.has(key)) {
          stationMap.set(key, {
            station_name: row.station_name,
            brand:        row.brand,
            address:      row.address,
            lat:          row.lat,
            lon:          row.lon,
            nomos_code:   row.nomos_code,
            scrape_date:  row.scrape_date,
            prices:       {},
          });
        }
        stationMap.get(key).prices[row.fuel_type] = {
          price:       row.price,
          product:     row.product,
          reported_at: row.reported_at,
        };
      }
    }

    const merged = Array.from(stationMap.values());
    log(`📍 Total unique stations merged: ${merged.length}`);
    return merged;
  } catch (error) {
    log(`❌ Error fetching stations:`, error);
    throw error;
  }
}
