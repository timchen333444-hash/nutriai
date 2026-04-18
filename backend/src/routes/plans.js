const { Router } = require('express');
const prisma = require('../lib/prisma.js');
const authMiddleware = require('../middleware/auth.js');

const router = Router();

const parsePlan = (p) => ({ ...p, planData: JSON.parse(p.planData) });

// GET /api/plans — list all saved plans for the authenticated user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const plans = await prisma.savedPlan.findMany({
      where:   { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(plans.map(parsePlan));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/plans — save a new plan
router.post('/', authMiddleware, async (req, res) => {
  console.log('[POST /api/plans] user:', req.user?.id, '| name:', req.body?.name, '| days:', req.body?.days, '| planData length:', Array.isArray(req.body?.planData) ? req.body.planData.length : typeof req.body?.planData);
  const { name, planData, days, calorieTarget } = req.body;
  if (!name?.trim())  return res.status(400).json({ error: 'name is required' });
  if (!planData)      return res.status(400).json({ error: 'planData is required' });
  try {
    const plan = await prisma.savedPlan.create({
      data: {
        userId:        req.user.id,
        name:          name.trim(),
        planData:      JSON.stringify(planData),
        days:          Number(days)          || 1,
        calorieTarget: Number(calorieTarget) || 2000,
      },
    });
    res.json(parsePlan(plan));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/plans/:id — remove a saved plan (owner-only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const plan = await prisma.savedPlan.findUnique({ where: { id: Number(req.params.id) } });
    if (!plan || plan.userId !== req.user.id)
      return res.status(404).json({ error: 'Plan not found' });
    await prisma.savedPlan.delete({ where: { id: plan.id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;