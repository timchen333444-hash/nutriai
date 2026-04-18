const { Router } = require('express');
const prisma = require('../lib/prisma.js');
const authMiddleware = require('../middleware/auth.js');

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  // Build last 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  try {
    const logs = await prisma.foodLog.findMany({
      where: { userId, date: { in: days } },
    });

    const waterLogs = await prisma.waterLog.findMany({
      where: { userId, date: { in: days } },
    });

    // Aggregate by day
    const dailyData = days.map((date) => {
      const dayLogs = logs.filter((l) => l.date === date);
      const water = waterLogs.find((w) => w.date === date);
      return {
        date,
        calories: dayLogs.reduce((s, l) => s + l.calories, 0),
        protein: dayLogs.reduce((s, l) => s + l.protein, 0),
        carbs: dayLogs.reduce((s, l) => s + l.carbs, 0),
        fat: dayLogs.reduce((s, l) => s + l.fat, 0),
        loggedMeals: dayLogs.length,
        water: water?.glasses ?? 0,
      };
    });

    // Streak: consecutive days with any logs
    let streak = 0;
    const today = new Date().toISOString().slice(0, 10);
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i] > today) continue;
      const dayLogs = logs.filter((l) => l.date === days[i]);
      if (dayLogs.length > 0) streak++;
      else break;
    }

    // Nutrient totals for gap analysis
    const allNutrients = {};
    for (const log of logs) {
      const n = JSON.parse(log.nutrients || '{}');
      const merge = (obj) => {
        for (const [k, v] of Object.entries(obj || {})) {
          allNutrients[k] = (allNutrients[k] || 0) + v;
        }
      };
      merge(n.vitamins);
      merge(n.minerals);
    }

    // Reference daily values
    const drv = {
      vitaminD: 105, // 15mcg * 7 days
      vitaminB12: 16.8,
      vitaminC: 630,
      iron: 56,
      calcium: 7000,
      magnesium: 2800,
      potassium: 24500,
      omega3: 11.2,
      zinc: 77,
      selenium: 385,
    };

    const gaps = [];
    const wins = [];
    for (const [k, target] of Object.entries(drv)) {
      const pct = allNutrients[k] ? (allNutrients[k] / target) * 100 : 0;
      if (pct < 50) gaps.push({ nutrient: k, pct: Math.round(pct) });
      else if (pct >= 90) wins.push({ nutrient: k, pct: Math.round(pct) });
    }

    const calorieTarget = user?.calorieTarget || 2000;
    const avgCalories = Math.round(
      dailyData.reduce((s, d) => s + d.calories, 0) / 7
    );

    res.json({
      dailyData,
      streak,
      avgCalories,
      calorieTarget,
      gaps: gaps.slice(0, 5),
      wins: wins.slice(0, 5),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;