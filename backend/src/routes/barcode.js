const { Router } = require('express');
const prisma = require('../lib/prisma.js');
const authMiddleware = require('../middleware/auth.js');

const router = Router();

// ── Open Food Facts category → our category ────────────────────────────────────

const OFacts_CATEGORY_MAP = [
  [/beverages?|drinks?|soda|juice|water|coffee|tea|smoothie/i, 'Beverages'],
  [/dairy|milk|cheese|yogurt|cream|butter/i,                   'Dairy'],
  [/snacks?|chips?|crackers?|popcorn|pretzel/i,                'Snacks'],
  [/bread|cereal|pasta|rice|grain|oat|flour/i,                 'Grains'],
  [/fruit|vegetable|produce|salad/i,                           'Produce'],
  [/meat|poultry|fish|seafood|protein/i,                       'Proteins'],
  [/nuts?|seeds?|oil|peanut/i,                                 'Nuts & Seeds'],
  [/frozen/i,                                                  'Frozen'],
];

function inferCategory(product) {
  const text = [
    product.product_name || '',
    ...(product.categories_tags || []),
    product.categories || '',
  ].join(' ').toLowerCase();

  for (const [re, cat] of OFacts_CATEGORY_MAP) {
    if (re.test(text)) return cat;
  }
  return 'Scanned Products';
}

// Parse a DB food record to the standard API shape (JSON fields decoded).
const parseFood = (f) => ({
  ...f,
  aminoAcids: JSON.parse(f.aminoAcids || '{}'),
  fattyAcids: JSON.parse(f.fattyAcids || '{}'),
  vitamins:   JSON.parse(f.vitamins   || '{}'),
  minerals:   JSON.parse(f.minerals   || '{}'),
});

// ── GET /api/barcode/:code ─────────────────────────────────────────────────────
// Global barcode database — foods scanned by any user are cached and shared
// with all users. scanCount is incremented on every scan, regardless of who
// scans it. firstScannedBy captures the display name of the first scanner.
//
// 1. Check the global FoodItem table first — return immediately if found.
// 2. Fetch from Open Food Facts, save globally (no userId), then return.

router.get('/:code', authMiddleware, async (req, res) => {
  const { code } = req.params;

  try {
    // ── Step 1: global DB lookup — no userId filter ──
    const existing = await prisma.food.findUnique({ where: { barcode: code } });
    if (existing) {
      // Increment scanCount each time any user scans this barcode
      const updated = await prisma.food.update({
        where: { id: existing.id },
        data:  { scanCount: { increment: 1 } },
      });
      console.log('[barcode] cache hit id:', existing.id, '| scanCount:', updated.scanCount);
      return res.json(parseFood(updated));
    }

    // ── Step 2: Open Food Facts ──
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${code}.json`,
      { headers: { 'User-Agent': 'NutriAI/1.0' } }
    );
    const off = await response.json();

    if (off.status !== 1 || !off.product) {
      return res.status(404).json({
        error: 'Product not found in our database. Would you like to add it manually?',
        code:  'NOT_FOUND',
      });
    }

    const p = off.product;
    const n = p.nutriments || {};

    // Resolve the first scanner's display name (non-fatal if lookup fails)
    let firstScannedBy = '';
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
      firstScannedBy = user?.name || '';
    } catch { /* non-fatal */ }

    // ── Step 3: upsert to global food table (no userId — visible to everyone) ──
    // Using upsert handles the rare race condition where two users scan the same
    // barcode simultaneously before either has cached it.
    const food = await prisma.food.upsert({
      where: { barcode: code },
      update: {
        // Another concurrent scan beat us to the DB — just increment
        scanCount: { increment: 1 },
      },
      create: {
        name:           (p.product_name || p.generic_name || 'Unknown product').slice(0, 200),
        brand:          p.brands ? p.brands.split(',')[0].trim() : null,
        barcode:        code,
        category:       inferCategory(p),
        servingSize:    parseFloat(p.serving_size) || 100,
        servingUnit:    'g',
        calories:       Number(n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0),
        protein:        Number(n.proteins_100g      ?? 0),
        carbs:          Number(n.carbohydrates_100g  ?? 0),
        fat:            Number(n.fat_100g            ?? 0),
        fiber:          Number(n.fiber_100g          ?? 0),
        sugar:          Number(n.sugars_100g         ?? 0),
        sodium:         n.sodium_100g ? Number(n.sodium_100g) * 1000 : 0,
        source:         'barcode_scan',
        firstScannedAt: new Date(),
        firstScannedBy,
        scanCount:      1,
        aminoAcids:     '{}',
        fattyAcids:     '{}',
        vitamins:       '{}',
        minerals:       '{}',
      },
    });

    console.log('[barcode] new food saved id:', food.id, '| firstScannedBy:', firstScannedBy);
    res.json(parseFood(food));
  } catch (e) {
    console.error('[barcode] error:', e.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
