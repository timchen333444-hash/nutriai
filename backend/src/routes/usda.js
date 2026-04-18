const { Router } = require('express');
const prisma = require('../lib/prisma.js');
const authMiddleware = require('../middleware/auth.js');

const router = Router();
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';

// ── Nutrient ID → schema field mappings ──────────────────────────────────────

const AMINO_MAP = {
  1221: 'histidine',
  1212: 'isoleucine',
  1213: 'leucine',
  1214: 'lysine',
  1215: 'methionine',
  1217: 'phenylalanine',
  1211: 'threonine',
  1210: 'tryptophan',
  1219: 'valine',
  1222: 'alanine',
  1220: 'arginine',
  1223: 'aspartate',
  1216: 'cysteine',
  1224: 'glutamate',
  1225: 'glycine',
  1226: 'proline',
  1227: 'serine',
  1218: 'tyrosine',
};

// For omega3, IDs 1278 (ALA), 1316 (EPA), 1323 (DHA) are all summed together.
// For omega6, ID 1269 is linoleic acid (18:2 n-6), the principal dietary n-6.
const FATTY_MAP = {
  1258: 'saturated',
  1292: 'monounsaturated',
  1293: 'polyunsaturated',
  1278: 'omega3',
  1316: 'omega3',
  1323: 'omega3',
  1269: 'omega6',
  1257: 'trans',
};

const VITAMIN_MAP = {
  1106: 'vitaminA',       // Vitamin A, RAE (mcg)
  1110: 'vitaminD',       // Vitamin D (D2+D3) (mcg)
  1109: 'vitaminE',       // Vitamin E (mg)
  1185: 'vitaminK',       // Vitamin K (mcg)
  1165: 'thiamine',       // B1 (mg)
  1166: 'riboflavin',     // B2 (mg)
  1167: 'niacin',         // B3 (mg)
  1170: 'pantothenicAcid', // B5 (mg)
  1175: 'vitaminB6',      // B6 (mg)
  1176: 'biotin',         // B7 (mcg)
  1177: 'folate',         // B9 (mcg)
  1178: 'vitaminB12',     // B12 (mcg)
  1162: 'vitaminC',       // (mg)
  1180: 'choline',        // (mg)
};

const MINERAL_MAP = {
  1087: 'calcium',
  1091: 'phosphorus',
  1090: 'magnesium',
  1092: 'potassium',
  1093: 'sodium',
  1089: 'iron',
  1095: 'zinc',
  1098: 'copper',
  1101: 'manganese',
  1103: 'selenium',
  1134: 'iodine',
  1102: 'molybdenum',
  1096: 'chromium',
  1099: 'fluoride',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Maps a USDA foodNutrients array (from either the search or detail endpoint)
 * into our internal schema shape.
 *
 * Search endpoint shape:  { nutrientId, value, ... }
 * Detail endpoint shape:  { nutrient: { id }, amount, ... }
 */
function mapNutrients(foodNutrients) {
  // First pass: index all values by nutrient ID
  const raw = {};
  for (const fn of foodNutrients) {
    const id = fn.nutrientId ?? fn.nutrient?.id;
    const val = parseFloat(fn.value ?? fn.amount ?? 0) || 0;
    if (id) raw[id] = val;
  }

  // Resolve energy: prefer 1008 (Energy kcal), fall back to 2047 (Energy, Atwater General),
  // then convert kJ from 1062 (Energy kJ) as last resort.
  const energyKcal =
    raw[1008] != null ? raw[1008] :
    raw[2047] != null ? raw[2047] :
    raw[1062] != null ? Math.round((raw[1062] / 4.184) * 10) / 10 :
    0;

  const macros = {
    calories: energyKcal,
    protein:  raw[1003] || 0,
    carbs:    raw[1005] || 0,
    fat:      raw[1004] || 0,
    fiber:    raw[1079] || 0,
    // Prefer nutrient 2000 (Total Sugars); fall back to 1063 (Sugars incl. NLEA)
    sugar:    raw[2000] ?? raw[1063] ?? 0,
    sodium:   raw[1093] || 0,
  };

  const aminoAcids = {};
  for (const [id, field] of Object.entries(AMINO_MAP)) {
    if (raw[id] !== undefined) aminoAcids[field] = raw[id];
  }

  // Fatty acids: omega3 accumulates ALA + EPA + DHA
  const fattyAcids = {};
  for (const [id, field] of Object.entries(FATTY_MAP)) {
    if (raw[id] !== undefined) {
      fattyAcids[field] = (fattyAcids[field] || 0) + raw[id];
    }
  }

  const vitamins = {};
  for (const [id, field] of Object.entries(VITAMIN_MAP)) {
    if (raw[id] !== undefined) vitamins[field] = raw[id];
  }

  const minerals = {};
  for (const [id, field] of Object.entries(MINERAL_MAP)) {
    if (raw[id] !== undefined) minerals[field] = raw[id];
  }

  return { macros, aminoAcids, fattyAcids, vitamins, minerals };
}

/**
 * Infer a category from USDA food metadata.
 * foodCategory can be a string (search endpoint) or { description } (detail endpoint).
 */
function inferCategory(food) {
  const cat =
    (typeof food.foodCategory === 'object'
      ? food.foodCategory?.description
      : food.foodCategory) || '';
  const text = `${food.description || ''} ${cat} ${food.brandedFoodCategory || ''}`.toLowerCase();

  if (/chicken|beef|pork|turkey|fish|salmon|tuna|shrimp|crab|lobster|meat|poultry|seafood/.test(text)) return 'Proteins';
  if (/milk|cheese|yogurt|dairy|cream|butter/.test(text)) return 'Dairy';
  if (/bean|lentil|legume|chickpea|\bpea\b|edamame/.test(text)) return 'Legumes';
  if (/bread|rice|pasta|oat|wheat|grain|cereal|flour|tortilla|cracker/.test(text)) return 'Grains';
  if (/vegetable|broccoli|spinach|carrot|kale|lettuce|onion|tomato|pepper|zucchini|cucumber/.test(text)) return 'Vegetables';
  if (/fruit|apple|banana|orange|berry|grape|mango|peach|pear|melon/.test(text)) return 'Fruits';
  if (/\bnut\b|seed|almond|walnut|cashew|peanut|pistachio|pecan/.test(text)) return 'Nuts & Seeds';
  if (/\boil\b|lard|margarine|shortening/.test(text)) return 'Oils & Fats';
  if (/soy milk|almond milk|oat milk|coconut milk|plant.based milk/.test(text)) return 'Dairy Alternatives';
  if (/protein powder|supplement|whey|creatine|protein shake/.test(text)) return 'Supplements';
  return cat || 'Other';
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /api/usda/search?q=query
 * Searches the USDA FoodData Central API (Foundation + SR Legacy datasets)
 * and returns results shaped to match our local Food schema.
 * Results are NOT yet persisted — they carry fdcId so the client can
 * call /api/usda/import to cache a selected food.
 */
router.get('/search', authMiddleware, async (req, res) => {
  const { q } = req.query;
  if (!q?.trim()) return res.json([]);

  try {
    const url =
      `${USDA_BASE}/foods/search` +
      `?query=${encodeURIComponent(q)}` +
      `&api_key=${process.env.USDA_API_KEY}` +
      `&pageSize=10` +
      `&dataType=Foundation,SR%20Legacy`;

    const response = await fetch(url);
    if (!response.ok) return res.status(502).json({ error: 'USDA API unavailable' });
    const data = await response.json();

    const results = (data.foods || []).map((f) => {
      const { macros, aminoAcids, fattyAcids, vitamins, minerals } = mapNutrients(
        f.foodNutrients || []
      );
      return {
        fdcId:       f.fdcId,
        name:        f.description,
        brand:       f.brandOwner || f.brandName || null,
        category:    inferCategory(f),
        servingSize: f.servingSize || 100,
        servingUnit: (f.servingSizeUnit || 'g').toLowerCase(),
        source:      'usda',
        ...macros,
        aminoAcids,
        fattyAcids,
        vitamins,
        minerals,
      };
    });

    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/usda/browse?page=1
 * Returns a paginated alphabetical list of USDA Foundation + SR Legacy foods.
 * Only name, category, and fdcId are returned — no nutrient data.
 * Call /api/usda/import to fetch full details for a selected food.
 */
router.get('/browse', authMiddleware, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const PAGE_SIZE = 25;

  try {
    const url =
      `${USDA_BASE}/foods/list` +
      `?api_key=${process.env.USDA_API_KEY}` +
      `&dataType=Foundation,SR%20Legacy` +
      `&pageSize=${PAGE_SIZE}` +
      `&pageNumber=${page}` +
      `&sortBy=lowercaseDescription` +
      `&sortOrder=asc`;

    const response = await fetch(url);
    if (!response.ok) return res.status(502).json({ error: 'USDA API unavailable' });
    const foods = await response.json();

    const results = (Array.isArray(foods) ? foods : []).map((f) => ({
      fdcId:    f.fdcId,
      name:     f.description,
      category: inferCategory(f),
      source:   'usda',
    }));

    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/usda/import  { fdcId }
 * Fetches the full nutrient detail for a USDA food, saves it to the local
 * database (cache), and returns the DB Food record (with its integer id).
 * Subsequent calls with the same fdcId return the cached record immediately.
 */
router.post('/import', authMiddleware, async (req, res) => {
  const { fdcId } = req.body;
  if (!fdcId) return res.status(400).json({ error: 'fdcId required' });

  const parseFood = (f) => ({
    ...f,
    aminoAcids: JSON.parse(f.aminoAcids || '{}'),
    fattyAcids: JSON.parse(f.fattyAcids || '{}'),
    vitamins:   JSON.parse(f.vitamins   || '{}'),
    minerals:   JSON.parse(f.minerals   || '{}'),
  });

  try {
    // Return cached record if already imported
    const existing = await prisma.food.findUnique({ where: { fdcId: Number(fdcId) } });
    if (existing) return res.json(parseFood(existing));

    // Fetch full nutrient detail from USDA
    const url = `${USDA_BASE}/food/${fdcId}?api_key=${process.env.USDA_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return res.status(502).json({ error: 'USDA API unavailable' });
    const f = await response.json();

    const { macros, aminoAcids, fattyAcids, vitamins, minerals } = mapNutrients(
      f.foodNutrients || []
    );

    const food = await prisma.food.create({
      data: {
        fdcId:       Number(fdcId),
        name:        f.description,
        brand:       f.brandOwner || f.brandName || null,
        category:    inferCategory(f),
        servingSize: f.servingSize || 100,
        servingUnit: (f.servingSizeUnit || 'g').toLowerCase(),
        source:      'usda',
        ...macros,
        aminoAcids:  JSON.stringify(aminoAcids),
        fattyAcids:  JSON.stringify(fattyAcids),
        vitamins:    JSON.stringify(vitamins),
        minerals:    JSON.stringify(minerals),
      },
    });

    res.json(parseFood(food));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;