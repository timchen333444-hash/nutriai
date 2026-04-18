import { useState, useEffect } from 'react';
import { useUnits } from '../../context/UnitsContext';

// ── Serving preference helpers (localStorage) ─────────────────────────────────

const PREF_KEY = 'nutriai_serving_prefs';

export function getServingPref(foodId) {
  if (!foodId) return null;
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}')[foodId] ?? null; }
  catch { return null; }
}

export function saveServingPref(foodId, grams) {
  if (!foodId || !grams) return;
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    p[foodId] = grams;
    localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {}
}

// ── Serving option definitions ─────────────────────────────────────────────────

const OZ = 28.35; // grams per ounce

const CAT_OPTIONS = {
  Proteins: [
    { label: '1 oz',  grams: OZ * 1, imperial: true  },
    { label: '2 oz',  grams: OZ * 2, imperial: true  },
    { label: '3 oz',  grams: OZ * 3, imperial: true  },
    { label: '4 oz',  grams: OZ * 4, imperial: true  },
    { label: '6 oz',  grams: OZ * 6, imperial: true  },
    { label: '8 oz',  grams: OZ * 8, imperial: true  },
    { label: '100g',  grams: 100,    imperial: false  },
    { label: '150g',  grams: 150,    imperial: false  },
    { label: '200g',  grams: 200,    imperial: false  },
  ],
  Vegetables: [
    { label: '1 tbsp', grams: 15,  imperial: false },
    { label: '½ cup',  grams: 45,  imperial: false },
    { label: '1 cup',  grams: 90,  imperial: false },
    { label: '1 oz',   grams: OZ,  imperial: true  },
    { label: '50g',    grams: 50,  imperial: false },
    { label: '100g',   grams: 100, imperial: false },
  ],
  Fruits: [
    { label: '1 small',  grams: 100, imperial: false },
    { label: '1 medium', grams: 150, imperial: false },
    { label: '1 large',  grams: 200, imperial: false },
    { label: '1 cup',    grams: 150, imperial: false },
    { label: '1 oz',     grams: OZ,  imperial: true  },
    { label: '100g',     grams: 100, imperial: false },
  ],
  Grains: [
    { label: '¼ cup dry',    grams: 45,  imperial: false },
    { label: '½ cup dry',    grams: 90,  imperial: false },
    { label: '1 cup dry',    grams: 180, imperial: false },
    { label: '½ cup cooked', grams: 80,  imperial: false },
    { label: '1 cup cooked', grams: 185, imperial: false },
    { label: '100g',         grams: 100, imperial: false },
    { label: '1 oz',         grams: OZ,  imperial: true  },
  ],
  Legumes: [
    { label: '¼ cup dry',    grams: 45,  imperial: false },
    { label: '½ cup cooked', grams: 90,  imperial: false },
    { label: '1 cup cooked', grams: 185, imperial: false },
    { label: '100g',         grams: 100, imperial: false },
    { label: '1 oz',         grams: OZ,  imperial: true  },
  ],
  Dairy: [
    { label: '1 fl oz', grams: 30,  imperial: true  },
    { label: '4 fl oz', grams: 120, imperial: true  },
    { label: '8 fl oz', grams: 240, imperial: true  },
    { label: '1 cup',   grams: 244, imperial: false },
    { label: '100ml',   grams: 100, imperial: false },
    { label: '200ml',   grams: 200, imperial: false },
  ],
  'Dairy Alternatives': [
    { label: '1 fl oz', grams: 30,  imperial: true  },
    { label: '4 fl oz', grams: 120, imperial: true  },
    { label: '8 fl oz', grams: 240, imperial: true  },
    { label: '1 cup',   grams: 244, imperial: false },
    { label: '100ml',   grams: 100, imperial: false },
  ],
  'Nuts & Seeds': [
    { label: '1 tsp',  grams: 5,   imperial: false },
    { label: '1 tbsp', grams: 10,  imperial: false },
    { label: '1 oz',   grams: OZ,  imperial: true  },
    { label: '50g',    grams: 50,  imperial: false },
    { label: '100g',   grams: 100, imperial: false },
  ],
  'Oils & Fats': [
    { label: '1 tsp',  grams: 5,   imperial: false },
    { label: '1 tbsp', grams: 14,  imperial: false },
    { label: '2 tbsp', grams: 28,  imperial: false },
    { label: '50g',    grams: 50,  imperial: false },
    { label: '100g',   grams: 100, imperial: false },
  ],
  Beverages: [
    { label: '1 fl oz',  grams: 30,  imperial: true  },
    { label: '4 fl oz',  grams: 120, imperial: true  },
    { label: '8 fl oz',  grams: 240, imperial: true  },
    { label: '12 fl oz', grams: 355, imperial: true  },
    { label: '16 fl oz', grams: 473, imperial: true  },
    { label: '100ml',    grams: 100, imperial: false },
    { label: '330ml',    grams: 330, imperial: false },
    { label: '500ml',    grams: 500, imperial: false },
  ],
  Snacks: [
    { label: '1 oz',  grams: OZ,  imperial: true  },
    { label: '50g',   grams: 50,  imperial: false },
    { label: '100g',  grams: 100, imperial: false },
    { label: '150g',  grams: 150, imperial: false },
  ],
  'Fast Food': [
    // '1 serving' and '½ serving' are prepended dynamically from food.servingSize
    { label: '1 oz',  grams: OZ,  imperial: true  },
    { label: '100g',  grams: 100, imperial: false },
    { label: '200g',  grams: 200, imperial: false },
  ],
  Supplements: [
    { label: '1g',   grams: 1,   imperial: false },
    { label: '2g',   grams: 2,   imperial: false },
    { label: '5g',   grams: 5,   imperial: false },
    { label: '10g',  grams: 10,  imperial: false },
    { label: '20g',  grams: 20,  imperial: false },
  ],
};

const DEFAULT_OPTIONS = [
  { label: '1g',   grams: 1,      imperial: false },
  { label: '5g',   grams: 5,      imperial: false },
  { label: '10g',  grams: 10,     imperial: false },
  { label: '25g',  grams: 25,     imperial: false },
  { label: '50g',  grams: 50,     imperial: false },
  { label: '100g', grams: 100,    imperial: false },
  { label: '1 oz', grams: OZ,     imperial: true  },
  { label: '2 oz', grams: OZ * 2, imperial: true  },
];

/**
 * Build the serving option list for a given food, sorted by unit preference.
 * Both oz and gram options are always included; the preferred unit's entries
 * are placed first.
 */
export function getServingOptions(food, preferImperial = false) {
  const cat = food?.category || '';
  let opts = CAT_OPTIONS[cat] ? [...CAT_OPTIONS[cat]] : [...DEFAULT_OPTIONS];

  // For restaurant / fast food, prepend the food's actual serving size
  if (cat === 'Fast Food' && food?.servingSize > 0) {
    const sz = Math.round(food.servingSize);
    opts = [
      { label: '1 serving', grams: sz,       imperial: false },
      { label: '½ serving', grams: sz / 2,   imperial: false },
      ...opts,
    ];
  }

  // Sort: preferred-unit options first, preserving relative order within groups
  if (preferImperial) {
    const imp  = opts.filter(o => o.imperial);
    const metr = opts.filter(o => !o.imperial);
    opts = [...imp, ...metr];
  }

  return opts;
}

/**
 * Given raw grams and a food object, return a human-readable serving label.
 * Used in the food log to display "4 oz (113g)" instead of "1.13×".
 */
export function getServingLabel(grams, food, preferImperial = false) {
  const g = Math.round(grams);
  if (!food || g <= 0) return `${g}g`;

  const options = getServingOptions(food, preferImperial);
  const match   = options.find(o => Math.abs(o.grams - grams) < 0.6);

  if (match) {
    // If the label already encodes the gram/ml amount, don't append "(Xg)"
    if (/\d+(g|ml)$/.test(match.label)) return match.label;
    return `${match.label} (${g}g)`;
  }

  // For imperial users try to format as a clean oz fraction
  if (preferImperial) {
    const oz = grams / OZ;
    const roundOz = Math.round(oz);
    if (roundOz > 0 && roundOz <= 32 && Math.abs(oz - roundOz) < 0.2) {
      return `${roundOz} oz (${g}g)`;
    }
  }

  return `${g}g`;
}

// ── ServingSizeSelector component ─────────────────────────────────────────────

const MATCH_TOL = 0.6; // gram tolerance for option matching

/**
 * ServingSizeSelector — controlled serving size picker.
 *
 * Props
 *   food       food object (needs .category and .servingSize)
 *   grams      current selected grams (controlled by parent)
 *   onChange   called with new grams value
 *   compact    if true, renders as a select + number input row (RecipeBuilder)
 */
export default function ServingSizeSelector({ food, grams, onChange, compact = false }) {
  const { units } = useUnits();
  const preferImperial = units.weightUnit === 'lbs';

  const options = getServingOptions(food, preferImperial);

  // 'auto' — determined by whether grams matches any option
  // 'named' — user clicked a named pill
  // 'custom' — user clicked Custom or grams doesn't match anything
  const [mode,       setMode]       = useState('auto');
  const [customVal,  setCustomVal]  = useState('');
  const [customUnit, setCustomUnit] = useState(preferImperial ? 'oz' : 'g');

  // Effective mode: resolve 'auto' based on whether grams has a match
  const hasMatch  = !!options.find(o => Math.abs(o.grams - grams) < MATCH_TOL);
  const effMode   = mode === 'auto' ? (hasMatch ? 'named' : 'custom') : mode;
  const selectedOpt = effMode === 'named'
    ? options.find(o => Math.abs(o.grams - grams) < MATCH_TOL)
    : null;

  // Reset state when food changes
  useEffect(() => {
    setMode('auto');
    const u = preferImperial ? 'oz' : 'g';
    setCustomUnit(u);
    setCustomVal(
      u === 'oz'
        ? (grams / OZ).toFixed(1).replace(/\.0$/, '')
        : Math.round(grams).toString()
    );
  }, [food?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────────

  const selectOption = (opt) => {
    setMode('named');
    onChange(opt.grams);
  };

  const activateCustom = () => {
    const u = preferImperial ? 'oz' : 'g';
    setMode('custom');
    setCustomUnit(u);
    setCustomVal(
      u === 'oz'
        ? (grams / OZ).toFixed(1).replace(/\.0$/, '')
        : Math.round(grams).toString()
    );
  };

  const handleCustomInput = (val) => {
    setCustomVal(val);
    const n = parseFloat(val);
    if (n > 0) onChange(Math.round((customUnit === 'oz' ? n * OZ : n) * 10) / 10);
  };

  const switchCustomUnit = (u) => {
    const n = parseFloat(customVal) || 0;
    let newVal = customVal;
    if (n > 0) {
      newVal = u === 'oz'
        ? (customUnit === 'g'  ? (n / OZ).toFixed(1).replace(/\.0$/, '') : customVal)
        : (customUnit === 'oz' ? Math.round(n * OZ).toString()            : customVal);
    }
    setCustomUnit(u);
    setCustomVal(newVal);
    const parsed = parseFloat(newVal);
    if (parsed > 0) onChange(Math.round((u === 'oz' ? parsed * OZ : parsed) * 10) / 10);
  };

  // Subtitle: show gram equiv when a named option with a non-gram label is selected
  const needsSubtitle = (o) => !/\d+(g|ml)$/.test(o.label) && !o.label.includes('serving');

  const roundedG = Math.round(grams);
  const ozStr    = (grams / OZ).toFixed(1);

  // ── Compact mode (RecipeBuilder ingredient rows) ──────────────────────────

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <select
          value=""
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (v > 0) onChange(v);
          }}
          className="flex-1 min-w-0 border border-gray-200 rounded-lg py-1.5 px-2 text-xs text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Quick select…</option>
          {options.map((o, i) => (
            <option key={i} value={o.grams}>
              {o.label} ({Math.round(o.grams)}g)
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0.1"
          step="0.1"
          value={Math.round(grams * 10) / 10}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (v > 0) onChange(v);
          }}
          className="w-16 text-center border border-gray-200 rounded-lg py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <span className="text-xs text-gray-500 flex-shrink-0">g</span>
      </div>
    );
  }

  // ── Full mode ─────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Scrollable pill row */}
      <div
        className="flex gap-1.5 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {options.map((o, i) => {
          const active = effMode === 'named' && selectedOpt?.label === o.label;
          return (
            <button
              key={i}
              type="button"
              onClick={() => selectOption(o)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all whitespace-nowrap ${
                active
                  ? 'bg-primary border-primary text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-primary hover:text-primary'
              }`}
            >
              {o.label}
            </button>
          );
        })}

        {/* Custom pill */}
        <button
          type="button"
          onClick={activateCustom}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all whitespace-nowrap ${
            effMode === 'custom'
              ? 'bg-primary border-primary text-white'
              : 'bg-white border-gray-200 text-gray-600 hover:border-primary hover:text-primary'
          }`}
        >
          Custom
        </button>
      </div>

      {/* Gram subtitle — only when a named option with a non-gram label is selected */}
      {effMode === 'named' && selectedOpt && needsSubtitle(selectedOpt) && (
        <p className="text-xs text-gray-400 mt-1.5">
          = {roundedG}g
          {preferImperial && !selectedOpt.imperial && (
            <span> · {ozStr} oz</span>
          )}
        </p>
      )}

      {/* Custom amount input */}
      {effMode === 'custom' && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={customVal}
            onChange={(e) => handleCustomInput(e.target.value)}
            autoFocus
            placeholder="Amount"
            className="flex-1 border border-primary/40 rounded-xl px-3 py-2 text-sm font-medium text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          <div className="flex gap-1">
            {['g', 'oz'].map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => switchCustomUnit(u)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                  customUnit === u
                    ? 'bg-primary border-primary text-white'
                    : 'border-gray-200 text-gray-500 hover:border-primary hover:text-primary'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversion hint below custom input */}
      {effMode === 'custom' && grams > 0 && (
        <p className="text-xs text-gray-400 mt-1.5">
          {customUnit === 'oz' ? `= ${roundedG}g` : `= ${ozStr} oz`}
        </p>
      )}
    </div>
  );
}
