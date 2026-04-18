const { Router } = require('express');
const prisma = require('../lib/prisma.js');
const authMiddleware = require('../middleware/auth.js');

const router = Router();

const parse = (t) => ({
  ...t,
  foods: JSON.parse(t.foods || '[]'),
  tags:  JSON.parse(t.tags  || '[]'),
});

const totalsFromFoods = (foods) => ({
  totalCalories: Math.round(foods.reduce((s, f) => s + (f.calories || 0), 0)),
  totalProtein:  Math.round(foods.reduce((s, f) => s + (f.protein  || 0), 0) * 10) / 10,
  totalCarbs:    Math.round(foods.reduce((s, f) => s + (f.carbs    || 0), 0) * 10) / 10,
  totalFat:      Math.round(foods.reduce((s, f) => s + (f.fat      || 0), 0) * 10) / 10,
});

// Cached support check for community fields
let _communityFieldsSupported = null;
async function communityFieldsSupported() {
  if (_communityFieldsSupported !== null) return _communityFieldsSupported;
  try {
    await prisma.mealTemplate.findFirst({ where: { isPublic: false }, take: 1 });
    _communityFieldsSupported = true;
  } catch (e) {
    if (e.message?.includes('Unknown argument') || e.message?.includes('unknown field')) {
      console.warn('[templates] ⚠️  Stale Prisma client — community fields unavailable until server restart.');
      _communityFieldsSupported = false;
    } else {
      return true;
    }
  }
  return _communityFieldsSupported;
}

// GET /api/templates
router.get('/', authMiddleware, async (req, res) => {
  try {
    const templates = await prisma.mealTemplate.findMany({
      where:   { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(templates.map(parse));
  } catch (e) {
    console.error('[GET /api/templates] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/templates
router.post('/', authMiddleware, async (req, res) => {
  console.log('[POST /api/templates] req.user:', JSON.stringify(req.user));
  console.log('[POST /api/templates] hit — userId:', req.user?.id, '| name:', req.body?.name);
  const { name, description = '', foods = [], isPublic = false, tags = [] } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  const coreData = {
    userId:      req.user.id,
    name:        name.trim(),
    description: description.trim(),
    foods:       JSON.stringify(foods),
    ...totalsFromFoods(foods),
  };

  try {
    // Guard against stale JWT tokens after a DB reset
    const existingUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!existingUser) {
      console.error('[POST /api/templates] user id', req.user.id, 'not found in DB — session is stale');
      return res.status(401).json({ error: 'Your account was not found. Please sign out and sign in again.' });
    }

    const supportsNew = await communityFieldsSupported();

    let t;
    if (supportsNew) {
      const createdByName = existingUser.name || '';

      t = await prisma.mealTemplate.create({
        data: {
          ...coreData,
          isPublic:        Boolean(isPublic),
          createdByName,
          createdByUserId: req.user.id,
          tags:            tags?.length ? JSON.stringify(tags) : null,
        },
      });
    } else {
      t = await prisma.mealTemplate.create({ data: coreData });
    }

    console.log('[POST /api/templates] saved id:', t.id);
    res.json(parse(t));
  } catch (e) {
    console.error('[POST /api/templates] ERROR:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/templates/:id
router.patch('/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const existing = await prisma.mealTemplate.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.id)
      return res.status(404).json({ error: 'Template not found' });

    const { name, description, foods, isPublic, tags } = req.body;
    const coreUpdate = {};
    if (name        !== undefined) coreUpdate.name        = name.trim();
    if (description !== undefined) coreUpdate.description = description.trim();
    if (foods       !== undefined) {
      coreUpdate.foods = JSON.stringify(foods);
      Object.assign(coreUpdate, totalsFromFoods(foods));
    }

    const supportsNew = await communityFieldsSupported();
    const data = { ...coreUpdate };
    if (supportsNew) {
      if (isPublic !== undefined) data.isPublic = Boolean(isPublic);
      if (tags     !== undefined) data.tags     = tags?.length ? JSON.stringify(tags) : null;
    }

    const updated = await prisma.mealTemplate.update({ where: { id }, data });
    res.json(parse(updated));
  } catch (e) {
    console.error('[PATCH /api/templates/:id] ERROR:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/templates/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const existing = await prisma.mealTemplate.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.id)
      return res.status(404).json({ error: 'Template not found' });

    // Delete related likes if the model exists in current client
    try {
      await prisma.templateLike.deleteMany({ where: { templateId: id } });
    } catch { /* templateLike model may not exist in stale client */ }

    await prisma.mealTemplate.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) {
    console.error('[DELETE /api/templates/:id] ERROR:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
