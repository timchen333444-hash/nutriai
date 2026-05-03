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

// Curated supermarket-only food suggestions per nutrient, sorted by % DV descending.
const APPROVED_SUGGESTIONS = {
  calcium: [
    { name: 'Tofu',      emoji: '🫘', serving: '½ cup',        percentDV: 43 },
    { name: 'Yogurt',    emoji: '🥛', serving: '1 cup',        percentDV: 42 },
    { name: 'Sardines',  emoji: '🐟', serving: '3 oz',         percentDV: 33 },
    { name: 'Cheese',    emoji: '🧀', serving: '1.5 oz',       percentDV: 31 },
    { name: 'Milk',      emoji: '🥛', serving: '1 cup',        percentDV: 30 },
    { name: 'Kale',      emoji: '🥬', serving: '1 cup cooked', percentDV: 9  },
    { name: 'Almonds',   emoji: '🌰', serving: '1 oz',         percentDV: 8  },
    { name: 'Broccoli',  emoji: '🥦', serving: '1 cup',        percentDV: 6  },
  ],
  iron: [
    { name: 'Lentils',           emoji: '🫘', serving: '1 cup cooked', percentDV: 83 },
    { name: 'Spinach',           emoji: '🥬', serving: '1 cup cooked', percentDV: 80 },
    { name: 'Kidney Beans',      emoji: '🫘', serving: '1 cup',        percentDV: 65 },
    { name: 'Fortified Oatmeal', emoji: '🌾', serving: '1 packet',     percentDV: 45 },
    { name: 'Tofu',              emoji: '🫘', serving: '½ cup',        percentDV: 43 },
    { name: 'Beef',              emoji: '🥩', serving: '3 oz',         percentDV: 30 },
    { name: 'Eggs',              emoji: '🥚', serving: '2 large',      percentDV: 23 },
    { name: 'Chicken',           emoji: '🍗', serving: '3 oz',         percentDV: 14 },
  ],
  potassium: [
    { name: 'Potato',        emoji: '🥔', serving: '1 medium',     percentDV: 26 },
    { name: 'Spinach',       emoji: '🥬', serving: '1 cup cooked', percentDV: 24 },
    { name: 'Sweet Potato',  emoji: '🍠', serving: '1 medium',     percentDV: 16 },
    { name: 'Yogurt',        emoji: '🥛', serving: '1 cup',        percentDV: 15 },
    { name: 'Salmon',        emoji: '🐟', serving: '3 oz',         percentDV: 15 },
    { name: 'Avocado',       emoji: '🥑', serving: '½ avocado',    percentDV: 14 },
    { name: 'Orange Juice',  emoji: '🍊', serving: '8 oz',         percentDV: 14 },
    { name: 'Banana',        emoji: '🍌', serving: '1 medium',     percentDV: 12 },
  ],
  zinc: [
    { name: 'Beef',          emoji: '🥩', serving: '3 oz',         percentDV: 48 },
    { name: 'Chickpeas',     emoji: '🫘', serving: '1 cup',        percentDV: 23 },
    { name: 'Chicken',       emoji: '🍗', serving: '3 oz',         percentDV: 22 },
    { name: 'Oatmeal',       emoji: '🌾', serving: '1 cup cooked', percentDV: 21 },
    { name: 'Pumpkin Seeds', emoji: '🌱', serving: '1 oz',         percentDV: 20 },
    { name: 'Yogurt',        emoji: '🥛', serving: '1 cup',        percentDV: 15 },
    { name: 'Cashews',       emoji: '🌰', serving: '1 oz',         percentDV: 15 },
    { name: 'Eggs',          emoji: '🥚', serving: '2 large',      percentDV: 12 },
  ],
  vitaminD: [
    { name: 'Salmon',                 emoji: '🐟', serving: '3 oz',  percentDV: 74 },
    { name: 'Mushrooms',              emoji: '🍄', serving: '½ cup', percentDV: 61 },
    { name: 'Sardines',               emoji: '🐟', serving: '3 oz',  percentDV: 27 },
    { name: 'Fortified Milk',         emoji: '🥛', serving: '1 cup', percentDV: 19 },
    { name: 'Fortified Orange Juice', emoji: '🍊', serving: '8 oz',  percentDV: 17 },
    { name: 'Eggs',                   emoji: '🥚', serving: '2 large', percentDV: 13 },
    { name: 'Tuna',                   emoji: '🐟', serving: '3 oz',  percentDV: 11 },
  ],
  vitaminB12: [
    { name: 'Salmon',  emoji: '🐟', serving: '3 oz',    percentDV: 133 },
    { name: 'Tuna',    emoji: '🐟', serving: '3 oz',    percentDV: 104 },
    { name: 'Beef',    emoji: '🥩', serving: '3 oz',    percentDV: 100 },
    { name: 'Milk',    emoji: '🥛', serving: '1 cup',   percentDV: 50  },
    { name: 'Eggs',    emoji: '🥚', serving: '2 large', percentDV: 46  },
    { name: 'Yogurt',  emoji: '🥛', serving: '1 cup',   percentDV: 46  },
    { name: 'Cheese',  emoji: '🧀', serving: '1.5 oz',  percentDV: 21  },
    { name: 'Chicken', emoji: '🍗', serving: '3 oz',    percentDV: 13  },
  ],
  magnesium: [
    { name: 'Pumpkin Seeds', emoji: '🌱', serving: '1 oz',         percentDV: 37 },
    { name: 'Spinach',       emoji: '🥬', serving: '1 cup cooked', percentDV: 37 },
    { name: 'Brown Rice',    emoji: '🌾', serving: '1 cup cooked', percentDV: 21 },
    { name: 'Almonds',       emoji: '🌰', serving: '1 oz',         percentDV: 19 },
    { name: 'Dark Chocolate',emoji: '🍫', serving: '1 oz',         percentDV: 16 },
    { name: 'Avocado',       emoji: '🥑', serving: '1 medium',     percentDV: 15 },
    { name: 'Oatmeal',       emoji: '🌾', serving: '1 cup cooked', percentDV: 15 },
    { name: 'Banana',        emoji: '🍌', serving: '1 medium',     percentDV: 8  },
  ],
  folate: [
    { name: 'Lentils',      emoji: '🫘', serving: '1 cup cooked', percentDV: 90 },
    { name: 'Spinach',      emoji: '🥬', serving: '1 cup cooked', percentDV: 66 },
    { name: 'Black Beans',  emoji: '🫘', serving: '1 cup',        percentDV: 64 },
    { name: 'Asparagus',    emoji: '🌿', serving: '6 spears',     percentDV: 34 },
    { name: 'Broccoli',     emoji: '🥦', serving: '1 cup cooked', percentDV: 26 },
    { name: 'Avocado',      emoji: '🥑', serving: '½ avocado',    percentDV: 20 },
    { name: 'Orange Juice', emoji: '🍊', serving: '8 oz',         percentDV: 19 },
    { name: 'Eggs',         emoji: '🥚', serving: '2 large',      percentDV: 12 },
  ],
  vitaminC: [
    { name: 'Broccoli',    emoji: '🥦', serving: '1 cup cooked', percentDV: 112 },
    { name: 'Bell Pepper', emoji: '🫑', serving: '½ cup',        percentDV: 106 },
    { name: 'Strawberries',emoji: '🍓', serving: '1 cup',        percentDV: 99  },
    { name: 'Orange',      emoji: '🍊', serving: '1 medium',     percentDV: 78  },
    { name: 'Kiwi',        emoji: '🥝', serving: '1 medium',     percentDV: 71  },
    { name: 'Grapefruit',  emoji: '🍊', serving: '½ fruit',      percentDV: 49  },
    { name: 'Spinach',     emoji: '🥬', serving: '1 cup cooked', percentDV: 20  },
    { name: 'Tomato',      emoji: '🍅', serving: '1 medium',     percentDV: 19  },
  ],
  omega3: [
    { name: 'Chia Seeds', emoji: '🌱', serving: '1 oz',   percentDV: 313 },
    { name: 'Walnuts',    emoji: '🌰', serving: '1 oz',   percentDV: 163 },
    { name: 'Flaxseeds',  emoji: '🌱', serving: '1 tbsp', percentDV: 150 },
    { name: 'Salmon',     emoji: '🐟', serving: '3 oz',   percentDV: 144 },
    { name: 'Sardines',   emoji: '🐟', serving: '3 oz',   percentDV: 88  },
    { name: 'Edamame',    emoji: '🫘', serving: '1 cup',  percentDV: 35  },
    { name: 'Tuna',       emoji: '🐟', serving: '3 oz',   percentDV: 16  },
    { name: 'Eggs',       emoji: '🥚', serving: '2 large',percentDV: 7   },
  ],
  vitaminA: [
    { name: 'Sweet Potato', emoji: '🍠', serving: '1 medium',     percentDV: 214 },
    { name: 'Spinach',      emoji: '🥬', serving: '1 cup cooked', percentDV: 105 },
    { name: 'Kale',         emoji: '🥬', serving: '1 cup cooked', percentDV: 98  },
    { name: 'Carrots',      emoji: '🥕', serving: '1 medium',     percentDV: 73  },
    { name: 'Eggs',         emoji: '🥚', serving: '2 large',      percentDV: 18  },
    { name: 'Salmon',       emoji: '🐟', serving: '3 oz',         percentDV: 11  },
    { name: 'Milk',         emoji: '🥛', serving: '1 cup',        percentDV: 10  },
    { name: 'Bell Pepper',  emoji: '🫑', serving: '½ cup',        percentDV: 9   },
  ],
  vitaminK: [
    { name: 'Kale',            emoji: '🥬', serving: '1 cup cooked', percentDV: 987 },
    { name: 'Spinach',         emoji: '🥬', serving: '1 cup cooked', percentDV: 888 },
    { name: 'Brussels Sprouts',emoji: '🥦', serving: '1 cup cooked', percentDV: 195 },
    { name: 'Broccoli',        emoji: '🥦', serving: '1 cup cooked', percentDV: 184 },
    { name: 'Lettuce',         emoji: '🥗', serving: '1 cup',        percentDV: 57  },
    { name: 'Blueberries',     emoji: '🫐', serving: '1 cup',        percentDV: 29  },
    { name: 'Green Beans',     emoji: '🫛', serving: '1 cup cooked', percentDV: 20  },
    { name: 'Avocado',         emoji: '🥑', serving: '½ avocado',    percentDV: 18  },
  ],
  vitaminE: [
    { name: 'Sunflower Seeds', emoji: '🌻', serving: '1 oz',         percentDV: 49 },
    { name: 'Almonds',         emoji: '🌰', serving: '1 oz',         percentDV: 45 },
    { name: 'Spinach',         emoji: '🥬', serving: '1 cup cooked', percentDV: 25 },
    { name: 'Salmon',          emoji: '🐟', serving: '3 oz',         percentDV: 24 },
    { name: 'Avocado',         emoji: '🥑', serving: '½ avocado',    percentDV: 13 },
    { name: 'Peanut Butter',   emoji: '🥜', serving: '2 tbsp',       percentDV: 13 },
    { name: 'Olive Oil',       emoji: '🫒', serving: '1 tbsp',       percentDV: 13 },
    { name: 'Eggs',            emoji: '🥚', serving: '2 large',      percentDV: 7  },
  ],
  selenium: [
    { name: 'Tuna',            emoji: '🐟', serving: '3 oz',         percentDV: 143 },
    { name: 'Salmon',          emoji: '🐟', serving: '3 oz',         percentDV: 65  },
    { name: 'Chicken',         emoji: '🍗', serving: '3 oz',         percentDV: 56  },
    { name: 'Eggs',            emoji: '🥚', serving: '2 large',      percentDV: 56  },
    { name: 'Beef',            emoji: '🥩', serving: '3 oz',         percentDV: 36  },
    { name: 'Sunflower Seeds', emoji: '🌻', serving: '1 oz',         percentDV: 27  },
    { name: 'Brown Rice',      emoji: '🌾', serving: '1 cup cooked', percentDV: 27  },
    { name: 'Oatmeal',         emoji: '🌾', serving: '1 cup cooked', percentDV: 22  },
  ],
  iodine: [
    { name: 'Cod',          emoji: '🐟', serving: '3 oz',    percentDV: 63 },
    { name: 'Yogurt',       emoji: '🥛', serving: '1 cup',   percentDV: 58 },
    { name: 'Milk',         emoji: '🥛', serving: '1 cup',   percentDV: 44 },
    { name: 'Eggs',         emoji: '🥚', serving: '2 large', percentDV: 26 },
    { name: 'Navy Beans',   emoji: '🫘', serving: '½ cup',   percentDV: 26 },
    { name: 'Cheddar Cheese',emoji: '🧀', serving: '1.5 oz', percentDV: 24 },
    { name: 'Tuna',         emoji: '🐟', serving: '3 oz',    percentDV: 23 },
    { name: 'Shrimp',       emoji: '🦐', serving: '3 oz',    percentDV: 23 },
  ],
  copper: [
    { name: 'Cashews',         emoji: '🌰', serving: '1 oz',         percentDV: 69 },
    { name: 'Sunflower Seeds', emoji: '🌻', serving: '1 oz',         percentDV: 41 },
    { name: 'Dark Chocolate',  emoji: '🍫', serving: '1 oz',         percentDV: 33 },
    { name: 'Lentils',         emoji: '🫘', serving: '1 cup cooked', percentDV: 26 },
    { name: 'Avocado',         emoji: '🥑', serving: '½ avocado',    percentDV: 19 },
    { name: 'Mushrooms',       emoji: '🍄', serving: '½ cup cooked', percentDV: 16 },
    { name: 'Almonds',         emoji: '🌰', serving: '1 oz',         percentDV: 15 },
    { name: 'Beef',            emoji: '🥩', serving: '3 oz',         percentDV: 10 },
  ],
  manganese: [
    { name: 'Oatmeal',      emoji: '🌾', serving: '1 cup cooked', percentDV: 191 },
    { name: 'Pineapple',    emoji: '🍍', serving: '1 cup chunks', percentDV: 109 },
    { name: 'Brown Rice',   emoji: '🌾', serving: '1 cup cooked', percentDV: 88  },
    { name: 'Chickpeas',    emoji: '🫘', serving: '1 cup',        percentDV: 73  },
    { name: 'Spinach',      emoji: '🥬', serving: '1 cup cooked', percentDV: 39  },
    { name: 'Almonds',      emoji: '🌰', serving: '1 oz',         percentDV: 32  },
    { name: 'Sweet Potato', emoji: '🍠', serving: '1 medium',     percentDV: 26  },
    { name: 'Black Tea',    emoji: '🍵', serving: '8 oz',         percentDV: 26  },
  ],
  chromium: [
    { name: 'Broccoli',          emoji: '🥦', serving: '1 cup',    percentDV: 34 },
    { name: 'Grape Juice',       emoji: '🍇', serving: '8 oz',     percentDV: 31 },
    { name: 'Beef',              emoji: '🥩', serving: '3 oz',     percentDV: 17 },
    { name: 'Whole Wheat Bread', emoji: '🍞', serving: '2 slices', percentDV: 14 },
    { name: 'Turkey',            emoji: '🍗', serving: '3 oz',     percentDV: 14 },
    { name: 'Orange Juice',      emoji: '🍊', serving: '8 oz',     percentDV: 11 },
    { name: 'Potatoes',          emoji: '🥔', serving: '1 medium', percentDV: 9  },
    { name: 'Apples',            emoji: '🍎', serving: '1 medium', percentDV: 8  },
  ],
};

/**
 * Returns the top `count` common supermarket foods highest in `nutrientKey`.
 * Uses a curated list to avoid obscure or restaurant items.
 */
function getTopFoodSuggestions(nutrientKey, count = 3) {
  const list = APPROVED_SUGGESTIONS[nutrientKey];
  if (!list) return [];
  return list.slice(0, count);
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
