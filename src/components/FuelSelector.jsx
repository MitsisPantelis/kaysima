import { FUEL_TYPES } from '../constants.js';

const FUEL_META = {
  1: { icon: '⛽', color: '#3b82f6', desc: 'Για τα περισσότερα αυτοκίνητα' },
  2: { icon: '🏁', color: '#8b5cf6', desc: 'Υψηλής απόδοσης βενζίνη' },
  3: { icon: '⭐', color: '#10b981', desc: 'Βελτιωμένη σύνθεση' },
  4: { icon: '🚛', color: '#f59e0b', desc: 'Για diesel κινητήρες' },
  5: { icon: '🔥', color: '#ef4444', desc: 'Πετρέλαιο θέρμανσης' },
  6: { icon: '💧', color: '#06b6d4', desc: 'Υγραέριο LPG' },
};

export default function FuelSelector({ onSelect, loading, error }) {
  return (
    <div className="selector-root">
      <div className="selector-hero">
        <div className="selector-logo">⛽</div>
        <h1 className="selector-title">Κάψιμα</h1>
        <p className="selector-subtitle">
          Τιμές καυσίμων σε πραγματικό χρόνο σε όλη την Ελλάδα
        </p>
      </div>

      <div className="selector-prompt">
        {loading ? '📍 Εντοπισμός τοποθεσίας…' : 'Επίλεξε τύπο καυσίμου'}
      </div>

      {error && <div className="selector-error">{error}</div>}

      <div className="fuel-grid">
        {FUEL_TYPES.map(ft => {
          const meta = FUEL_META[ft.code];
          return (
            <button
              key={ft.code}
              className="fuel-card"
              style={{ '--card-color': meta.color }}
              onClick={() => !loading && onSelect(ft.code)}
              disabled={loading}
            >
              <span className="fuel-icon">{meta.icon}</span>
              <span className="fuel-name">{ft.name}</span>
              <span className="fuel-desc">{meta.desc}</span>
            </button>
          );
        })}
      </div>

      <p className="selector-footer">
        Δεδομένα από το{' '}
        <a href="https://www.fuelprices.gr" target="_blank" rel="noopener noreferrer">
          Παρατηρητήριο Τιμών Υγρών Καυσίμων
        </a>
      </p>
    </div>
  );
}
