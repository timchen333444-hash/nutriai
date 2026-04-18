import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Daily reference values
const DRV = {
  // Carbohydrates (g/day — FDA Daily Values based on 2000 kcal)
  carbs: 275, fiber: 28, sugar: 50,
  // Amino acids (g/day for 70kg person)
  histidine: 1.05, isoleucine: 1.40, leucine: 3.08, lysine: 2.73,
  methionine: 1.05, phenylalanine: 2.38, threonine: 1.47, tryptophan: 0.35, valine: 1.82,
  alanine: 3.5, arginine: 4.0, aspartate: 4.0, cysteine: 0.7,
  glutamate: 8.0, glycine: 3.0, proline: 3.5, serine: 2.5, tyrosine: 2.38,
  // Fatty acids (g/day)
  saturated: 20, monounsaturated: 44, polyunsaturated: 11, omega3: 1.6, omega6: 17, trans: 2,
  // Vitamins
  vitaminA: 900, vitaminD: 15, vitaminE: 15, vitaminK: 120,
  thiamine: 1.2, riboflavin: 1.3, niacin: 16, pantothenicAcid: 5,
  vitaminB6: 1.3, biotin: 30, folate: 400, vitaminB12: 2.4,
  vitaminC: 90, choline: 550,
  // Minerals (mg or mcg as noted)
  calcium: 1000, phosphorus: 700, magnesium: 420, potassium: 3500,
  sodium: 2300, iron: 8, zinc: 11, copper: 0.9, manganese: 2.3,
  selenium: 55, iodine: 150, molybdenum: 45, chromium: 35, fluoride: 4,
};

const UNITS = {
  carbs: 'g', fiber: 'g', sugar: 'g',
  vitaminA: 'mcg', vitaminD: 'mcg', vitaminE: 'mg', vitaminK: 'mcg',
  thiamine: 'mg', riboflavin: 'mg', niacin: 'mg NE', pantothenicAcid: 'mg',
  vitaminB6: 'mg', biotin: 'mcg', folate: 'mcg DFE', vitaminB12: 'mcg',
  vitaminC: 'mg', choline: 'mg',
  calcium: 'mg', phosphorus: 'mg', magnesium: 'mg', potassium: 'mg',
  sodium: 'mg', iron: 'mg', zinc: 'mg', copper: 'mg', manganese: 'mg',
  selenium: 'mcg', iodine: 'mcg', molybdenum: 'mcg', chromium: 'mcg', fluoride: 'mg',
};

const LABELS = {
  carbs: 'Total Carbs', fiber: 'Dietary Fiber', sugar: 'Total Sugar',
  histidine: 'Histidine', isoleucine: 'Isoleucine', leucine: 'Leucine',
  lysine: 'Lysine', methionine: 'Methionine', phenylalanine: 'Phenylalanine',
  threonine: 'Threonine', tryptophan: 'Tryptophan', valine: 'Valine',
  alanine: 'Alanine', arginine: 'Arginine', aspartate: 'Aspartate',
  cysteine: 'Cysteine', glutamate: 'Glutamate', glycine: 'Glycine',
  proline: 'Proline', serine: 'Serine', tyrosine: 'Tyrosine',
  saturated: 'Saturated Fat', monounsaturated: 'Monounsaturated',
  polyunsaturated: 'Polyunsaturated', omega3: 'Omega-3', omega6: 'Omega-6', trans: 'Trans Fat',
  vitaminA: 'Vitamin A', vitaminD: 'Vitamin D', vitaminE: 'Vitamin E', vitaminK: 'Vitamin K',
  thiamine: 'B1 Thiamine', riboflavin: 'B2 Riboflavin', niacin: 'B3 Niacin',
  pantothenicAcid: 'B5 Pantothenic', vitaminB6: 'B6', biotin: 'B7 Biotin',
  folate: 'B9 Folate', vitaminB12: 'B12', vitaminC: 'Vitamin C', choline: 'Choline',
  calcium: 'Calcium', phosphorus: 'Phosphorus', magnesium: 'Magnesium',
  potassium: 'Potassium', sodium: 'Sodium', iron: 'Iron', zinc: 'Zinc',
  copper: 'Copper', manganese: 'Manganese', selenium: 'Selenium',
  iodine: 'Iodine', molybdenum: 'Molybdenum', chromium: 'Chromium', fluoride: 'Fluoride',
};

function NutrientRow({ name, consumed, drv, unit }) {
  const pct = drv > 0 ? Math.min((consumed / drv) * 100, 150) : 0;
  const pctDisplay = drv > 0 ? Math.round((consumed / drv) * 100) : 0;
  const color = pctDisplay >= 90 ? 'bg-primary' : pctDisplay >= 50 ? 'bg-amber-400' : 'bg-red-400';
  const textColor = pctDisplay >= 90 ? 'text-primary' : pctDisplay >= 50 ? 'text-amber-600' : 'text-red-500';

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-xs text-gray-600 w-28 flex-shrink-0">{name}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full progress-bar ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`text-xs font-medium w-10 text-right flex-shrink-0 ${textColor}`}>{pctDisplay}%</span>
      <span className="text-xs text-gray-400 w-16 text-right flex-shrink-0">
        {consumed > 1 ? consumed.toFixed(1) : consumed.toFixed(3)}{unit}
      </span>
    </div>
  );
}

function Section({ title, description, emoji, keys, nutrients }) {
  const [open, setOpen] = useState(false);
  // Guard against empty keys to prevent 0/0 = NaN
  const totalPct = keys.length === 0 ? 0 : keys.reduce((s, k) => {
    const drv = DRV[k] || 1;
    const val = nutrients[k] || 0;
    return s + Math.min((val / drv) * 100, 100);
  }, 0) / keys.length;

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-white text-left"
      >
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <span className="text-lg mt-0.5 flex-shrink-0">{emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{title}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                totalPct >= 90 ? 'bg-primary-light text-primary' :
                totalPct >= 50 ? 'bg-amber-50 text-amber-700' :
                'bg-red-50 text-red-600'
              }`}>
                {Math.round(totalPct)}%
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5 leading-snug">{description}</p>
          </div>
        </div>
        <div className="flex-shrink-0 ml-3 mt-0.5">
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 divide-y divide-gray-50 bg-gray-50/50">
          {keys.map((k) => (
            <NutrientRow
              key={k}
              name={LABELS[k] || k}
              consumed={nutrients[k] || 0}
              drv={DRV[k] || 1}
              unit={UNITS[k] || 'g'}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function NutritionAccordion({ logs, supplementLogs = [] }) {
  // Sum micro-nutrient sub-categories from the nested nutrients object
  const totals = { aminoAcids: {}, fattyAcids: {}, vitamins: {}, minerals: {} };
  for (const log of logs) {
    const n = log.nutrients || {};
    for (const [cat, data] of Object.entries(n)) {
      for (const [k, v] of Object.entries(data || {})) {
        if (!totals[cat]) totals[cat] = {};
        totals[cat][k] = (totals[cat][k] || 0) + (v || 0);
      }
    }
  }

  // Merge supplement nutrient contributions into the same totals
  for (const sLog of supplementLogs) {
    const n = sLog.nutrients || {};
    for (const [cat, data] of Object.entries(n)) {
      for (const [k, v] of Object.entries(data || {})) {
        if (!totals[cat]) totals[cat] = {};
        totals[cat][k] = (totals[cat][k] || 0) + (v || 0);
      }
    }
  }

  // Carbs, fiber, and sugar are stored at the top level of each log entry,
  // not inside the nested nutrients object, so sum them separately.
  const carbNutrients = {
    carbs: logs.reduce((s, l) => s + (l.carbs || 0), 0),
    fiber: logs.reduce((s, l) => s + (l.fiber || 0), 0),
    sugar: logs.reduce((s, l) => s + (l.sugar || 0), 0),
  };

  return (
    <div className="flex flex-col gap-2.5">
      <Section
        title="Protein & Amino Acids" emoji="🔬"
        description="Builds and repairs muscle, supports immune function and hormone production"
        keys={['histidine','isoleucine','leucine','lysine','methionine','phenylalanine','threonine','tryptophan','valine','alanine','arginine','aspartate','cysteine','glutamate','glycine','proline','serine','tyrosine']}
        nutrients={totals.aminoAcids}
      />
      <Section
        title="Lipids & Fatty Acids" emoji="🫒"
        description="Supports brain health, hormone balance, and absorption of fat-soluble vitamins"
        keys={['saturated','monounsaturated','polyunsaturated','omega3','omega6','trans']}
        nutrients={totals.fattyAcids}
      />
      <Section
        title="Carbohydrates" emoji="🌾"
        description="Primary energy source for the brain and muscles, fuels daily activity"
        keys={['carbs','fiber','sugar']}
        nutrients={carbNutrients}
      />
      <Section
        title="Vitamins" emoji="💊"
        description="Essential micronutrients that regulate metabolism, immunity, and cell function"
        keys={['vitaminA','vitaminD','vitaminE','vitaminK','thiamine','riboflavin','niacin','pantothenicAcid','vitaminB6','biotin','folate','vitaminB12','vitaminC','choline']}
        nutrients={totals.vitamins}
      />
      <Section
        title="Minerals" emoji="⚗️"
        description="Support bone strength, fluid balance, nerve signaling, and oxygen transport"
        keys={['calcium','phosphorus','magnesium','potassium','sodium','iron','zinc','copper','manganese','selenium','iodine','molybdenum','chromium','fluoride']}
        nutrients={totals.minerals}
      />
    </div>
  );
}
