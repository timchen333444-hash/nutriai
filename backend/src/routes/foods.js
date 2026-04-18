const { Router } = require('express');
const prisma = require('../lib/prisma.js');
const authMiddleware = require('../middleware/auth.js');

const router = Router();

const parseFood = (f) => ({
  ...f,
  aminoAcids: JSON.parse(f.aminoAcids || '{}'),
  fattyAcids: JSON.parse(f.fattyAcids || '{}'),
  vitamins: JSON.parse(f.vitamins || '{}'),
  minerals: JSON.parse(f.minerals || '{}'),
});

router.get('/', authMiddleware, async (req, res) => {
  const { q, category, sort } = req.query;
  // Allow callers to request a different sort order.
  // 'firstScannedAt' → most-recently-scanned first (used by the Scanned Products view).
  const orderBy = sort === 'firstScannedAt'
    ? [{ firstScannedAt: 'desc' }, { createdAt: 'desc' }]
    : { name: 'asc' };
  try {
    const foods = await prisma.food.findMany({
      where: {
        ...(q && { name: { contains: q } }),
        ...(category && { category }),
        // Exclude foods with no category when filtering by 'Scanned Products'
      },
      orderBy,
    });
    res.json(foods.map(parseFood));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/categories', authMiddleware, async (_, res) => {
  try {
    const rows = await prisma.food.groupBy({ by: ['category'], orderBy: { category: 'asc' } });
    res.json(rows.map((r) => r.category));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const food = await prisma.food.findUnique({ where: { id: Number(req.params.id) } });
    if (!food) return res.status(404).json({ error: 'Food not found' });
    res.json(parseFood(food));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;