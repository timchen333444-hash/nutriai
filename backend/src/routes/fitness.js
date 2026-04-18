const { Router } = require('express');
const prisma = require('../lib/prisma.js');
const authMiddleware = require('../middleware/auth.js');
const { syncGoogleFit } = require('../services/googleFitSync.js');

const router = Router();

const todayStr = () => new Date().toISOString().slice(0, 10);

const EMPTY_LOG = { steps: 0, caloriesBurned: 0, activeMinutes: 0, distanceKm: 0, heartRateAvg: null, source: null };

// GET /api/fitness/today
router.get('/today', authMiddleware, async (req, res) => {
  const date = req.query.date || todayStr();
  try {
    const log = await prisma.fitnessLog.findUnique({
      where: { userId_date: { userId: req.user.id, date } },
    });
    res.json(log || { ...EMPTY_LOG, date });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/fitness/history?range=7d|14d|30d
router.get('/history', authMiddleware, async (req, res) => {
  const range = req.query.range || '7d';
  const days  = range === '30d' ? 30 : range === '14d' ? 14 : 7;

  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });

  try {
    const logs = await prisma.fitnessLog.findMany({
      where:   { userId: req.user.id, date: { gte: dates[0], lte: dates[dates.length - 1] } },
      orderBy: { date: 'asc' },
    });
    const map    = Object.fromEntries(logs.map(l => [l.date, l]));
    const result = dates.map(date => map[date] || { ...EMPTY_LOG, date });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/fitness/manual
router.post('/manual', authMiddleware, async (req, res) => {
  const { steps = 0, caloriesBurned = 0, activeMinutes = 0, distanceKm = 0, date } = req.body;
  const logDate = date || todayStr();

  try {
    const log = await prisma.fitnessLog.upsert({
      where:  { userId_date: { userId: req.user.id, date: logDate } },
      create: {
        userId: req.user.id,
        date:   logDate,
        steps:          parseInt(steps)          || 0,
        caloriesBurned: parseFloat(caloriesBurned) || 0,
        activeMinutes:  parseInt(activeMinutes)  || 0,
        distanceKm:     parseFloat(distanceKm)   || 0,
        source: 'manual',
      },
      update: {
        steps:          parseInt(steps)          || 0,
        caloriesBurned: parseFloat(caloriesBurned) || 0,
        activeMinutes:  parseInt(activeMinutes)  || 0,
        distanceKm:     parseFloat(distanceKm)   || 0,
        source: 'manual',
      },
    });
    res.json(log);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/fitness/apple-health
// Accepts pre-parsed records from the frontend's Apple Health XML parser
router.post('/apple-health', authMiddleware, async (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'records array required' });
  }

  try {
    let imported = 0;
    for (const r of records) {
      if (!r.date) continue;
      await prisma.fitnessLog.upsert({
        where:  { userId_date: { userId: req.user.id, date: r.date } },
        create: {
          userId:         req.user.id,
          date:           r.date,
          steps:          r.steps          || 0,
          caloriesBurned: r.caloriesBurned || 0,
          activeMinutes:  r.activeMinutes  || 0,
          distanceKm:     r.distanceKm     || 0,
          heartRateAvg:   r.heartRateAvg   || null,
          source: 'apple_health',
        },
        update: {
          steps:          r.steps          || 0,
          caloriesBurned: r.caloriesBurned || 0,
          activeMinutes:  r.activeMinutes  || 0,
          distanceKm:     r.distanceKm     || 0,
          heartRateAvg:   r.heartRateAvg   || null,
          source: 'apple_health',
        },
      });
      imported++;
    }
    res.json({ imported });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/fitness/sync — triggers sync from all connected providers
router.get('/sync', authMiddleware, async (req, res) => {
  try {
    const result = await syncGoogleFit(req.user.id);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
