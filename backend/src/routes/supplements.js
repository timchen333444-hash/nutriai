const { Router } = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth');

const router = Router();

const today = () => new Date().toISOString().slice(0, 10);

const parse = (s) => ({
  ...s,
  nutrients: JSON.parse(s.nutrients || '{}'),
});

// GET /api/supplements/log?date=YYYY-MM-DD
router.get('/log', authMiddleware, async (req, res) => {
  const date = req.query.date || today();
  try {
    const logs = await prisma.supplementLog.findMany({
      where: { userId: req.user.id, date },
      orderBy: { loggedAt: 'asc' },
    });
    res.json(logs.map(parse));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/supplements/log
router.post('/log', authMiddleware, async (req, res) => {
  const { name, brand, dosage, dosageUnit, nutrients, notes, date } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const log = await prisma.supplementLog.create({
      data: {
        userId:     req.user.id,
        name:       name.trim(),
        brand:      brand?.trim() || '',
        dosage:     Number(dosage) || 0,
        dosageUnit: dosageUnit || 'mg',
        nutrients:  JSON.stringify(nutrients || {}),
        notes:      notes?.trim() || '',
        date:       date || today(),
      },
    });
    res.json(parse(log));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/supplements/log/:id
router.delete('/log/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const log = await prisma.supplementLog.findUnique({ where: { id } });
    if (!log || log.userId !== req.user.id)
      return res.status(404).json({ error: 'Log entry not found' });
    await prisma.supplementLog.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
