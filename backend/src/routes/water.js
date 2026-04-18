const { Router } = require('express');
const prisma = require('../lib/prisma.js');
const authMiddleware = require('../middleware/auth.js');

const router = Router();

const today = () => new Date().toISOString().slice(0, 10);

router.get('/', authMiddleware, async (req, res) => {
  const date = req.query.date || today();
  try {
    const log = await prisma.waterLog.findUnique({
      where: { userId_date: { userId: req.user.id, date } },
    });
    res.json({ glasses: log?.glasses ?? 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { glasses, date } = req.body;
  const d = date || today();

  console.log('[PUT /api/water] userId:', userId, '| glasses:', glasses, '| date:', d);

  try {
    // Verify the user exists (guards against stale JWT after a DB reset)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({
        error: 'Your account was not found. Please sign out and sign in again.',
      });
    }

    const log = await prisma.waterLog.upsert({
      where:  { userId_date: { userId, date: d } },
      update: { glasses },
      create: { userId, date: d, glasses },
    });
    res.json({ glasses: log.glasses });
  } catch (e) {
    console.error('[PUT /api/water] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
