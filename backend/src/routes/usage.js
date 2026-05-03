const { Router } = require('express');
const prisma = require('../lib/prisma.js');
const authMiddleware = require('../middleware/auth.js');

const router = Router();

const LIMITS = { plan: 3, photo: 5, insight: 4 };
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    const periodStart = user.usagePeriodStart || new Date();
    const resetsAt    = new Date(new Date(periodStart).getTime() + THIRTY_DAYS_MS)
      .toISOString().slice(0, 10);

    res.json({
      aiPlans: {
        used:     user.aiPlansUsedThisMonth    ?? 0,
        limit:    LIMITS.plan,
        resetsAt,
      },
      aiPhotos: {
        used:     user.aiPhotosUsedThisMonth   ?? 0,
        limit:    LIMITS.photo,
        resetsAt,
      },
      aiInsights: {
        used:     user.aiInsightsUsedThisMonth ?? 0,
        limit:    LIMITS.insight,
        resetsAt,
      },
      isPremium: user.isPremium ?? false,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
