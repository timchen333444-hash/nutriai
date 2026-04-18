import { createContext, useContext, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const UnitsContext = createContext(null);

// ── Physical constants ─────────────────────────────────────────────────────────

const KJ_PER_KCAL    = 4.184;
const LBS_PER_KG     = 2.20462;
const ML_PER_GLASS   = 240;   // 1 glass = 240 ml (standard US cup)
const FLOZ_PER_GLASS = 8;     // 1 glass = 8 fl oz

// ── Provider ───────────────────────────────────────────────────────────────────

export function UnitsProvider({ children }) {
  const { user, updateUser } = useAuth();
  const toast = useToast();

  // Derive preferences from the authenticated user (re-runs whenever user changes)
  const units = useMemo(() => ({
    weightUnit:     user?.weightUnit     ?? 'lbs',
    heightUnit:     user?.heightUnit     ?? 'ft',
    waterUnit:      user?.waterUnit      ?? 'floz',
    energyUnit:     user?.energyUnit     ?? 'kcal',
    dateFormat:     user?.dateFormat     ?? 'MM/DD/YYYY',
    firstDayOfWeek: user?.firstDayOfWeek ?? 'sunday',
  }), [user]);

  /**
   * Persist one or more unit preferences to the server.
   * On success, updateUser() propagates the change through AuthContext so every
   * consumer re-renders immediately — no page reload needed.
   */
  const saveUnits = async (changes) => {
    try {
      const { data } = await axios.put('/api/auth/units', changes);
      updateUser(data);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
  };

  // ── Energy (stored as kcal, displayed as kcal or kJ) ──────────────────────

  const energyLabel = units.energyUnit === 'kJ' ? 'kJ' : 'kcal';

  /** Return the display value in the user's preferred energy unit. */
  const displayEnergy = (kcal) => {
    if (kcal == null) return 0;
    if (units.energyUnit === 'kJ') return Math.round(kcal * KJ_PER_KCAL);
    return Math.round(kcal);
  };

  /** Return a formatted string, e.g. "2,000 kcal" or "8,368 kJ". */
  const formatEnergy = (kcal) => `${displayEnergy(kcal).toLocaleString()} ${energyLabel}`;

  // ── Weight (stored as kg, displayed as kg or lbs) ─────────────────────────

  const weightLabel = units.weightUnit;

  /** Return the display value in the user's preferred weight unit. */
  const displayWeight = (kg) => {
    if (kg == null) return null;
    if (units.weightUnit === 'lbs') return Math.round(kg * LBS_PER_KG * 10) / 10;
    return Math.round(kg * 10) / 10;
  };

  /** Return a formatted string, e.g. "74.5 kg" or "164.2 lbs". */
  const formatWeight = (kg) => {
    const v = displayWeight(kg);
    return v != null ? `${v} ${units.weightUnit}` : '—';
  };

  /**
   * Convert a display-unit weight back to kg for storage.
   * Used when the user types a weight into an input field.
   */
  const weightToKg = (displayValue) => {
    const v = parseFloat(displayValue);
    if (!v) return null;
    if (units.weightUnit === 'lbs') return Math.round((v / LBS_PER_KG) * 10) / 10;
    return v;
  };

  // ── Height (stored as cm, displayed as cm or ft & in) ─────────────────────

  const heightLabel = units.heightUnit === 'ft' ? 'ft & in' : 'cm';

  /** Format a cm height as "5 ft 9 in" or "175 cm". */
  const formatHeight = (cm) => {
    if (!cm) return '—';
    if (units.heightUnit === 'ft') {
      const totalIn = cm / 2.54;
      const ft = Math.floor(totalIn / 12);
      const inch = Math.round(totalIn % 12);
      return `${ft} ft ${inch} in`;
    }
    return `${Math.round(cm)} cm`;
  };

  /**
   * Parse a height input in the user's preferred unit to centimetres.
   * Accepts "5'10" / "5 10" for imperial or a plain number for metric.
   */
  const heightToCm = (input) => {
    const s = String(input ?? '').trim();
    if (!s) return null;
    if (units.heightUnit === 'ft') {
      const match = s.match(/^(\d+)['\s](\d+)?/);
      if (match) {
        const ft = parseInt(match[1]);
        const inch = parseInt(match[2] || 0);
        return Math.round((ft * 12 + inch) * 2.54 * 10) / 10;
      }
      return parseFloat(s) * 2.54;
    }
    return parseFloat(s);
  };

  // ── Water (stored as glasses, 1 glass = 240 ml = 8 fl oz) ─────────────────

  const waterLabel = units.waterUnit === 'ml' ? 'ml' : 'fl oz';

  /** Return total water in the user's preferred unit. */
  const displayWater = (glasses) => {
    if (units.waterUnit === 'ml')   return Math.round(glasses * ML_PER_GLASS);
    if (units.waterUnit === 'floz') return Math.round(glasses * FLOZ_PER_GLASS * 10) / 10;
    return glasses;
  };

  /** Return a formatted string, e.g. "1,200 ml" or "40 fl oz". */
  const formatWater = (glasses) => {
    if (units.waterUnit === 'ml')   return `${(glasses * ML_PER_GLASS).toLocaleString()} ml`;
    if (units.waterUnit === 'floz') return `${Math.round(glasses * FLOZ_PER_GLASS * 10) / 10} fl oz`;
    return `${glasses} glasses`;
  };

  return (
    <UnitsContext.Provider value={{
      units, saveUnits,
      energyLabel, displayEnergy, formatEnergy,
      weightLabel, displayWeight, formatWeight, weightToKg,
      heightLabel, formatHeight, heightToCm,
      waterLabel,  displayWater, formatWater,
    }}>
      {children}
    </UnitsContext.Provider>
  );
}

export function useUnits() {
  const ctx = useContext(UnitsContext);
  if (!ctx) throw new Error('useUnits must be inside <UnitsProvider>');
  return ctx;
}
