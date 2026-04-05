# Frontend Integration Guide

This document describes the backend API contract for the frontend repository. **This repo (fuelprices_greece) is private**; the frontend will be in a separate public repository and communicates **only** via Supabase REST API using the anonymous (read-only) API key.

---

## Backend Overview

The backend is powered by **Supabase PostgreSQL** (free tier, 500 MB). Daily CI/CD workflows scrape fuel prices from fuelprices.gr and load them into the database. The data is always kept current — one price record per station per fuel type.

### Key Architecture Points

- **No direct backend API** — frontend queries Supabase PostgREST directly
- **Row-Level Security (RLS) enabled** — anonymous users can only SELECT; no writes
- **One row per (station, fuel_type)** — prices are upserted daily, latest always wins
- **5,000+ stations across 54 Greek prefectures**
- **6 fuel types** — unleaded 95/100, Super, Diesel, Heating Diesel, LPG
- **Location data** — stations are geocoded (latitude/longitude available)

---

## Supabase Schema

### Connection Details

```javascript
const SUPABASE_URL      = 'https://pdagrqklqozlztwifkdv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // safe to commit — read-only
```

The **anonymous key** is public; it can only SELECT from tables with RLS policies allowing `anon` role read access.

### Tables

#### `stations`
Unique fuel stations across Greece. Never purged; geocoding happens incrementally.

```sql
id           BIGINT PRIMARY KEY
station_name TEXT          — e.g. "ΣΙΔΕΡΗΣ ΙΩΑΝΝΗΣ"
brand        TEXT          — e.g. "ΑΙΓΑΙΟ (AEGEAN)"
address      TEXT          — full street address
nomos_code   TEXT          — 8-digit prefecture code (e.g. "01000000" or "A1000000" for Attica)
lat          REAL          — latitude (NULL until geocoded)
lon          REAL          — longitude (NULL until geocoded)
```

#### `prices`
One row per (station, fuel_type). Updated daily with the latest prices.

```sql
id           BIGINT PRIMARY KEY
station_id   BIGINT        — FK to stations(id)
fuel_type    INTEGER       — 1-6 (see fuel type codes below)
product      TEXT          — e.g. "Αμόλυβδη 95 - Self Service"
price        REAL          — price in EUR (e.g. 1.787)
scrape_date  DATE          — date the scraper ran (most recent date available)
reported_at  TEXT          — when station reported to fuelprices.gr (e.g. "Τετ, 01/04 06:53:21")
updated_at   TIMESTAMPTZ   — when this row was last written to DB (auto-set by trigger)
UNIQUE(station_id, fuel_type)   — ensures one price per fuel per station
```

#### `prices_with_station` (VIEW)
Frontend queries **this view**, which joins `prices + stations` for convenience.

```sql
SELECT p.id, p.fuel_type, p.product, p.price,
       p.scrape_date, p.reported_at, p.updated_at,
       s.station_name, s.brand, s.address, s.nomos_code, s.lat, s.lon
FROM prices p JOIN stations s ON s.id = p.station_id;
```

**Columns returned:**
- `id` — price record ID
- `fuel_type` — 1-6
- `product` — product name/variant
- `price` — EUR per liter
- `scrape_date` — date scraped (all rows for a query have the same value)
- `reported_at` — station's reported timestamp
- `updated_at` — when price was last updated in DB
- `station_name`, `brand`, `address` — station details
- `nomos_code` — prefecture code
- `lat`, `lon` — coordinates (may be NULL if geocoding not yet done)

---

## Fuel Type Codes

| Code | Name |
|------|------|
| 1 | Αμόλυβδη 95 |
| 2 | Αμόλυβδη 100 |
| 3 | Super |
| 4 | Diesel |
| 5 | Diesel Θέρμανσης |
| 6 | Υγραέριο (LPG) |

---

## Nomos (Prefecture) Codes

54 prefectures total. Code format: `NN000000` (8-digit string). **Attica has special prefix**: `AN000000` where N is 1-4.

### Full List

**Attica (special prefix `A`):**
- `A1000000` — Αθήνα (Athens)
- `A2000000` — Ανατολική Αττική (East Attica)
- `A3000000` — Δυτική Αττική (West Attica)
- `A4000000` — Πειραιάς (Piraeus)

**Central Greece & Peloponnese:**
- `01000000` — Αιτωλοακαρνανία
- `11000000` — Αργολίδα
- `12000000` — Αρκαδία
- `13000000` — Αχαΐα
- `03000000` — Βοιωτία
- `04000000` — Εύβοια
- `05000000` — Ευρυτανία
- `14000000` — Ηλεία
- `15000000` — Κορινθία
- `16000000` — Λακωνία
- `17000000` — Μεσσηνία
- `06000000` — Φθιώτιδα
- `07000000` — Φωκίδα

**Epirus:**
- `31000000` — Άρτα
- `32000000` — Θεσπρωτία
- `33000000` — Ιωάννινα
- `34000000` — Πρέβεζα

**Thessaly:**
- `41000000` — Καρδίτσα
- `42000000` — Λάρισα
- `43000000` — Μαγνησία
- `44000000` — Τρίκαλα

**Macedonia:**
- `51000000` — Γρεβενά
- `52000000` — Δράμα
- `53000000` — Ημαθία
- `54000000` — Θεσσαλονίκη
- `55000000` — Καβάλα
- `56000000` — Καστοριά
- `57000000` — Κιλκίς
- `58000000` — Κοζάνη
- `59000000` — Πέλλα
- `61000000` — Πιερία
- `62000000` — Σέρρες
- `63000000` — Φλώρινα
- `64000000` — Χαλκιδική

**Thrace:**
- `71000000` — Έβρος
- `72000000` — Ξάνθη
- `73000000` — Ροδόπη

**Ionian Islands:**
- `21000000` — Ζάκυνθος
- `22000000` — Κέρκυρα
- `23000000` — Κεφαλονιά
- `24000000` — Λευκάδα

**Aegean Islands:**
- `81000000` — Δωδεκάνησα
- `82000000` — Κυκλάδες
- `83000000` — Λέσβος
- `84000000` — Σάμος
- `85000000` — Χίος

**Crete:**
- `91000000` — Ηράκλειο
- `92000000` — Λασίθι
- `93000000` — Ρέθυμνο
- `94000000` — Χανιά

---

## API Query Examples

All queries go to `https://pdagrqklqozlztwifkdv.supabase.co/rest/v1/prices_with_station`.

### Headers
```javascript
{
  apikey:        SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`
}
```

### Example 1: Get All Diesel Prices in Athens

```
GET /rest/v1/prices_with_station?fuel_type=eq.4&nomos_code=eq.A1000000&order=price.asc&limit=1000
```

**Parameters:**
- `fuel_type=eq.4` — Diesel (code 4)
- `nomos_code=eq.A1000000` — Athens
- `order=price.asc` — sort cheap to expensive
- `limit=1000` — max 1000 rows

**Response:** Array of stations with their diesel prices, sorted by price.

### Example 2: Get Station Details with Coordinates

```
GET /rest/v1/prices_with_station?fuel_type=eq.1&nomos_code=eq.54000000&select=station_name,brand,address,price,lat,lon,scrape_date
```

Returns only the specified columns. This is for building a map view or location-based search.

### Query Parameters Reference

| Parameter | Example | Behavior |
|-----------|---------|----------|
| `fuel_type=eq.N` | `fuel_type=eq.1` | Filter by fuel type code (1-6) |
| `nomos_code=eq.CODE` | `nomos_code=eq.A1000000` | Filter by prefecture code |
| `price=gt.X` | `price=gt.1.5` | Greater than price (in EUR) |
| `price=lt.X` | `price=lt.2.0` | Less than price |
| `lat=not.is.null` | (no value) | Only rows with geocoded coordinates |
| `order=COL.asc\|desc` | `order=price.asc` | Sort by column ascending/descending |
| `select=COL1,COL2` | `select=station_name,price` | Return only these columns |
| `limit=N` | `limit=500` | Return at most N rows |

---

## Frontend Implementation Guidelines

### 1. Query Pattern

**Don't** fetch `scrape_date` separately. It comes in every row (all rows for a query have the same date).

```javascript
// ✅ Good — fetch prices once
const prices = await fetch(
  `${SUPABASE_URL}/rest/v1/prices_with_station` +
  `?fuel_type=eq.1&nomos_code=eq.54000000&order=price.asc`
);
const data = await prices.json();
const scrapeDate = data[0]?.scrape_date; // all rows have same date
```

### 2. Null Handling

**Stations without geocoding** have `lat = null` and `lon = null`. Handle this in map rendering:

```javascript
const hasLocation = row.lat !== null && row.lon !== null;
// conditionally render marker or skip
```

### 3. Price Formatting

Prices are numeric (e.g. `1.787`). Format as EUR2 decimal places:

```javascript
price.toFixed(2) + ' €'
```

### 4. Performance Considerations

- PostgREST limits pages to 1000 rows. Most queries return well under that, but **don't** loop pagination unless truly needed.
- **Index on** `fuel_type`, `nomos_code` exists; queries are fast.
- Fetch once on page load, cache in React state. Poll if you want live updates (suggest 5-10 min intervals).

### 5. Reported_at Field

This is a **text string** from the station owner (Greek locale timestamp). Examples:
- `"Τετ, 01/04 06:53:21"` (Wednesday, 01/04 06:53:21)
- `"Παρ, 06/03 11:45:21"` (Friday, 06/03 11:45:21)

Don't parse it; display as-is or strip to just the time portion.

### 6. Updated_at Field

This is a **TIMESTAMPTZ** (ISO 8601 format): `"2026-04-05T14:32:10.123Z"`. Use for:
- Showing "data is live as of [time]"
- Detecting stale data (if `updated_at` is very old, data might be outdated)

---

## Row-Level Security (RLS)

The database has RLS enabled on both `stations` and `prices` tables:

```sql
-- Anonymous users can only SELECT
CREATE POLICY "anon read-only" ON prices   FOR SELECT TO anon USING (true);
CREATE POLICY "anon read-only" ON stations FOR SELECT TO anon USING (true);
```

This means:
- ✅ Frontend can read all data
- ❌ Frontend **cannot** insert, update, delete
- ❌ Frontend cannot use the `service_role` key (stay away from backend secrets)

---

## Deployment & Vite Configuration

The frontend is built with **Vite**. GitHub Pages deployment requires:

```javascript
// vite.config.js
export default {
  base: '/fuelprices_greece/',  // if deployed to https://user.github.io/fuelprices_greece/
  // or
  base: '/',                      // if deployed to custom domain
};
```

### Environment Variables

Create `.env.local` (never commit):

```
VITE_SUPABASE_URL=https://pdagrqklqozlztwifkdv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

Or embed directly in `constants.js` (it's safe—anon key is public).

---

## Data Freshness

- **Update frequency:** Daily, early morning UTC (~08:00)
- **Row age:** Data is always current; old prices are **not** kept in the database
- **Querying latest:** All rows returned have the same `scrape_date`; no need to filter by date

---

## Troubleshooting

### No rows returned when querying

1. Check `nomos_code` spelling (must be exactly 8 digits or `A` + 7 digits)
2. Verify `fuel_type` is 1-6
3. Try a broader query first (e.g., no `nomos_code` filter) to confirm data exists

### High latency

1. Check Supabase status page
2. Avoid filtering by multiple conditions simultaneously if possible—use minimal filters
3. Consider caching the response client-side for a few minutes

### Null lat/lon

Geocoding is ongoing. Some stations may not have coordinates yet. This is expected; skip them in map rendering.

---

## Constants to Include in Frontend

Keep a `constants.js` in the frontend repo with these constants. If the backend adds/removes prefectures or fuel types, update them here.

```javascript
export const FUEL_TYPES = [
  { code: 1, name: 'Αμόλυβδη 95' },
  { code: 2, name: 'Αμόλυβδη 100' },
  { code: 3, name: 'Super' },
  { code: 4, name: 'Diesel' },
  { code: 5, name: 'Diesel Θέρμανσης' },
  { code: 6, name: 'Υγραέριο (LPG)' },
];

export const NOMOS_CODES = [
  { code: 'A1000000', name: 'Αθήνα' },
  { code: 'A2000000', name: 'Ανατολική Αττική' },
  // ... all 54 prefectures
];
```

---

## Contact / Support

This is a separate frontend repo. For **backend issues** (missing data, stale prices, bugs in Supabase schema):
- Refer to the main `fuelprices_greece` repository (private)
- Document the expected API contract in the backend README

For **frontend issues** (UI bugs, deployment, Vite config):
- Handle in the frontend repo
