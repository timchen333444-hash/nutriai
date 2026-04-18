const { Router } = require('express');
const prisma = require('../lib/prisma.js');
const authMiddleware = require('../middleware/auth.js');
const { scaleNutrients } = require('../utils/calculations.js');

const router = Router();

const today = () => new Date().toISOString().slice(0, 10);

router.get('/', authMiddleware, async (req, res) => {
  const date = req.query.date || today();
  try {
    const logs = await prisma.foodLog.findMany({
      where: { userId: req.user.id, date },
      include: { food: true },
      orderBy: { createdAt: 'asc' },
    });
    const parsed = logs.map((l) => ({
      ...l,
      nutrients: JSON.parse(l.nutrients || '{}'),
      food: {
        ...l.food,
        aminoAcids: JSON.parse(l.food.aminoAcids || '{}'),
        fattyAcids: JSON.parse(l.food.fattyAcids || '{}'),
        vitamins:   JSON.parse(l.food.vitamins   || '{}'),
        minerals:   JSON.parse(l.food.minerals   || '{}'),
      },
    }));
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  // Always coerce to integers — the frontend may send strings
  const foodId = parseInt(req.body.foodId, 10);
  const userId = req.user.id;
  const { meal, servingSize, servingUnit, multiplier = 1, date } = req.body;

  console.log('[POST /api/log] userId:', userId, '| foodId:', foodId, '| meal:', meal);

  if (!foodId || !meal) {
    return res.status(400).json({ error: 'foodId and meal are required' });
  }

  try {
    // 1. Verify the user exists (guards against stale JWT tokens after a DB reset)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({
        error: 'Your account was not found. Please sign out and sign in again.',
      });
    }

    // 2. Verify the food exists
    const food = await prisma.food.findUnique({ where: { id: foodId } });
    if (!food) {
      return res.status(404).json({
        error: `Food with id ${foodId} was not found in the database.`,
      });
    }

    // 3. Create the log entry
    const scaled = scaleNutrients(food, multiplier);
    const logEntry = await prisma.foodLog.create({
      data: {
        userId,
        foodId,
        meal,
        servingSize: servingSize || food.servingSize,
        servingUnit: servingUnit || food.servingUnit,
        multiplier,
        ...scaled,
        nutrients: JSON.stringify(scaled.nutrients),
        date: date || today(),
      },
      include: { food: true },
    });

    res.json({
      ...logEntry,
      nutrients: JSON.parse(logEntry.nutrients || '{}'),
    });
  } catch (e) {
    console.error('[POST /api/log] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const log = await prisma.foodLog.findUnique({ where: { id: Number(req.params.id) } });
    if (!log || log.userId !== req.user.id) {
      return res.status(404).json({ error: 'Log entry not found' });
    }
    await prisma.foodLog.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
