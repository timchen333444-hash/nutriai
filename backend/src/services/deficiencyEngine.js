const prisma = require('../lib/prisma.js');

// Monitored nutrients with DRV (daily reference values) and storage category
const MONITORED_NUTRIENTS = {
  vitaminD:   { name: 'Vitamin D',   drv: 15,    category: 'vitamins'   },
  iron:       { name: 'Iron',        drv: 8,     category: 'minerals'   },
  magnesium:  { name: 'Magnesium',   drv: 420,   category: 'minerals'   },
  calcium:    { name: 'Calcium',     drv: 1000,  category: 'minerals'   },
  zinc:       { name: 'Zinc',        drv: 11,    category: 'minerals'   },
  vitaminB12: { name: 'Vitamin B12', drv: 2.4,   category: 'vitamins'   },
  folate:     { name: 'Folate',      drv: 400,   category: 'vitamins'   },
  potassium:  { name: 'Potassium',   drv: 3500,  category: 'minerals'   },
  omega3:     { name: 'Omega-3',     drv: 1.6,   category: 'fattyAcids' },
  vitaminC:   { name: 'Vitamin C',   drv: 90,    category: 'vitamins'   },
};

const CATEGORY_EMOJI = {
  proteins:    '🥩',
  dairy:       '🥛',
  fruits:      '🍎',
  vegetables:  '🥦',
  grains:      '🌾',
  seafood:     '🐟',
  nuts:        '🥜',
  legumes:     '🫘',
  beverages:   '🥤',
  supplements: '💊',
  oils:        '🫒',
  snacks:      '🍿',
};

function getCategoryEmoji(category) {
  if (!category) return '🍽️';
  const lower = category.toLowerCase();
  for (const [key, emoji] of Object.entries(CATEGORY_EMOJI)) {
    if (lower.includes(key)) return emoji;
  }
  return '🍽️';
}

// Sum the monitored nutrients from food logs and supplement logs for a single day
async function getNutrientsForDay(userId, date) {
  const [foodLogs, suppLogs] = await Promise.all([
    prisma.foodLog.findMany({ where: { userId, date } }),
    prisma.supplementLog.findMany({ where: { userId, date } }),
  ]);

  const totals = {};
  for (const key of Object.keys(MONITORED_NUTRIENTS)) {
    totals[key] = 0;
  }

  const processLog = (log) => {
    let n = {};
    try { n = JSON.parse(log.nutrients || '{}'); } catch {}
    for (const [nutrientKey, { category }] of Object.entries(MONITORED_NUTRIENTS)) {
      totals[nutrientKey] += n[category]?.[nutrientKey] || 0;
    }
  };

  foodLogs.forEach(processLog);
  suppLogs.forEach(processLog);

  return totals;
}

/**
 * Returns the top `count` foods from the database that are highest in `nutrientKey`.
 */
async function getTopFoodSuggestions(nutrientKey, count = 3) {
  const nutrientInfo = MONITORED_NUTRIENTS[nutrientKey];
  if (!nutrientInfo) return [];

  const { category, drv } = nutrientInfo;

  // Map nutrient category to the Food model column name
  const columnMap = {
    vitamins:   'vitamins',
    minerals:   'minerals',
    fattyAcids: 'fattyAcids',
  };
  const column = columnMap[category];
  if (!column) return [];

  const foods = await prisma.food.findMany({
    select: { id: true, name: true, category: true, servingSize: true, servingUnit: true, [column]: true },
  });

  const scored = foods.map(f => {
    let data = {};
    try { data = JSON.parse(f[column] || '{}'); } catch {}
    return { ...f, _value: data[nutrientKey] || 0 };
  });

  return scored
    .filter(f => f._value > 0)
    .sort((a, b) => b._value - a._value)
    .slice(0, count)
    .map(f => ({
      name:       f.name,
      emoji:      getCategoryEmoji(f.category),
      serving:    `${f.servingSize}${f.servingUnit}`,
      percentDV:  Math.round((f._value / drv) * 100),
    }));
}

/**
 * Looks at the last 7 days and counts how many consecutive days each monitored
 * nutrient has been below 60% DV (streak ends when a non-deficient day is found).
 */
async function analyzeStreaks(userId) {
  // days[0] = today, days[6] = 6 days ago
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });

  const dayNutrients = await Promise.all(days.map(date => getNutrientsForDay(userId, date)));

  const streaks = {};
  for (const [key, { drv }] of Object.entries(MONITORED_NUTRIENTS)) {
    streaks[key] = 0;
    for (let i = 0; i < days.length; i++) {
      const pct = (dayNutrients[i][key] / drv) * 100;
      if (pct < 60) {
        streaks[key]++;
      } else {
        break; // streak broken — stop counting
      }
    }
  }

  return streaks;
}

/**
 * Analyzes today's nutrition data and returns an array of deficient nutrients
 * (those under 40% DV). Each entry includes severity, streak, and food suggestions.
 */
async function analyzeDailyDeficiencies(userId, date) {
  const [nutrients, streaks] = await Promise.all([
    getNutrientsForDay(userId, date),
    analyzeStreaks(userId),
  ]);

  const deficiencies = [];

  for (const [key, { name, drv }] of Object.entries(MONITORED_NUTRIENTS)) {
    const currentPercent = Math.round((nutrients[key] / drv) * 100);
    if (currentPercent >= 40) continue;

    let severity;
    if (currentPercent < 10)      severity = 'critical';
    else if (currentPercent < 20) severity = 'very_low';
    else                          severity = 'low';

    const suggestions = await getTopFoodSuggestions(key, 3);

    deficiencies.push({
      nutrientName:      name,
      nutrientKey:       key,
      currentPercent,
      goalPercent:       100,
      severity,
      streakDays:        streaks[key] || 0,
      topFoodSuggestions: suggestions,
    });
  }

  return deficiencies;
}

/**
 * Returns per-nutrient % of DV averaged over the last 7 days.
 * Used for the weekly report (wins + gaps summary).
 */
async function analyzeWeeklySummary(userId) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });

  const dayNutrients = await Promise.all(days.map(date => getNutrientsForDay(userId, date)));

  const summary = {};
  for (const [key, { name, drv }] of Object.entries(MONITORED_NUTRIENTS)) {
    const avgAmount = dayNutrients.reduce((s, n) => s + n[key], 0) / 7;
    summary[key] = {
      name,
      avgPercent: Math.round((avgAmount / drv) * 100),
    };
  }

  return summary;
}

module.exports = {
  analyzeDailyDeficiencies,
  analyzeStreaks,
  getTopFoodSuggestions,
  analyzeWeeklySummary,
  MONITORED_NUTRIENTS,
};
