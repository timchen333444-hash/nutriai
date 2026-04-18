const { Router } = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth');

const router = Router();

const parse = (g) => ({
  ...g,
  items: JSON.parse(g.items || '[]'),
});

// GET /api/grocery
router.get('/', authMiddleware, async (req, res) => {
  try {
    const lists = await prisma.groceryList.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(lists.map(parse));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/grocery
router.post('/', authMiddleware, async (req, res) => {
  const { name, items, totalEstimatedCost, planId } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const list = await prisma.groceryList.create({
      data: {
        userId:             req.user.id,
        name:               name.trim(),
        items:              JSON.stringify(items || []),
        totalEstimatedCost: Number(totalEstimatedCost) || 0,
        ...(planId != null && { planId: Number(planId) }),
      },
    });
    res.json(parse(list));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/grocery/:id — update items and/or checked state
router.put('/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const { items, totalEstimatedCost, name } = req.body;
  try {
    const existing = await prisma.groceryList.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.id)
      return res.status(404).json({ error: 'List not found' });
    const list = await prisma.groceryList.update({
      where: { id },
      data: {
        ...(items             !== undefined && { items: JSON.stringify(items) }),
        ...(totalEstimatedCost !== undefined && { totalEstimatedCost: Number(totalEstimatedCost) }),
        ...(name              !== undefined && { name: name.trim() }),
      },
    });
    res.json(parse(list));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/grocery/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const existing = await prisma.groceryList.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.id)
      return res.status(404).json({ error: 'List not found' });
    await prisma.groceryList.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
