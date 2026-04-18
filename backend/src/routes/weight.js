const { Router } = require('express');
const prisma = require('../lib/prisma.js');
const authMiddleware = require('../middleware/auth.js');

const router = Router();

// ── GET /api/weight?range=7d|30d|90d|all ─────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  const { range = '30d' } = req.query;

  let since = null;
  if (range === '7d')  since = new Date(Date.now() - 7  * 86400_000);
  if (range === '30d') since = new Date(Date.now() - 30 * 86400_000);
  if (range === '90d') since = new Date(Date.now() - 90 * 86400_000);

  try {
    const logs = await prisma.weightLog.findMany({
      where: {
        userId: req.user.id,
        ...(since ? { loggedAt: { gte: since } } : {}),
      },
      orderBy: { loggedAt: 'asc' },
    });
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/weight ──────────────────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  const { weight, unit = 'kg', notes = '' } = req.body;
  if (!weight || isNaN(Number(weight)))
    return res.status(400).json({ error: 'weight is required and must be a number' });

  // Always store internally in kg — convert lbs input before saving
  let weightKg = Number(weight);
  const u = String(unit).toLowerCase();
  if (u === 'lbs' || u === 'imperial') {
    weightKg = Math.round((weightKg / 2.20462) * 10) / 10;
  }

  try {
    const log = await prisma.weightLog.create({
      data: {
        userId:   req.user.id,
        weight:   weightKg,
        unit:     'kg',
        notes:    notes ?? '',
        loggedAt: new Date(),
      },
    });
    res.json(log);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/weight/:id ────────────────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const log = await prisma.weightLog.findUnique({ where: { id: Number(req.params.id) } });
    if (!log || log.userId !== req.user.id)
      return res.status(404).json({ error: 'Entry not found' });
    await prisma.weightLog.delete({ where: { id: log.id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;