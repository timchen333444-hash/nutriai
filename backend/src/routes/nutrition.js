const { Router } = require('express');
const prisma = require('../lib/prisma.js');
const authMiddleware = require('../middleware/auth.js');
const { getAminoAcidScore, getAminoAcidHistory } = require('../services/aminoAcidScore.js');

const router = Router();

router.get('/amino-score', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { weight: true } });
    const weightKg = user?.weight || 70;
    const result = await getAminoAcidScore(userId, date, weightKg);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/amino-score/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const days = Math.min(parseInt(req.query.days) || 7, 30);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { weight: true } });
    const weightKg = user?.weight || 70;
    const history = await getAminoAcidHistory(userId, days, weightKg);
    res.json(history);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
