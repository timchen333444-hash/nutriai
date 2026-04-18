const { Router } = require('express');
const prisma = require('../lib/prisma.js');
const authMiddleware = require('../middleware/auth.js');

const router = Router();

// ── Parsers ───────────────────────────────────────────────────────────────────

const parseRecipe = (r, likedIds = new Set()) => ({
  ...r,
  _type:       'recipe',
  ingredients: JSON.parse(r.ingredients  || '[]'),
  nutrientData: JSON.parse(r.nutrientData || '{}'),
  tags:        JSON.parse(r.tags         || '[]'),
  likedByMe:   likedIds.has(`recipe-${r.id}`),
});

const parseTemplate = (t, likedIds = new Set()) => ({
  ...t,
  _type:     'template',
  foods:     JSON.parse(t.foods || '[]'),
  tags:      JSON.parse(t.tags  || '[]'),
  likedByMe: likedIds.has(`template-${t.id}`),
});

// Batch-fetch which items the current user has already liked
async function getUserLikes(userId, recipeIds = [], templateIds = []) {
  const likedIds = new Set();
  const [rLikes, tLikes] = await Promise.all([
    recipeIds.length
      ? prisma.recipeLike.findMany({ where: { userId, recipeId: { in: recipeIds } }, select: { recipeId: true } })
      : [],
    templateIds.length
      ? prisma.templateLike.findMany({ where: { userId, templateId: { in: templateIds } }, select: { templateId: true } })
      : [],
  ]);
  rLikes.forEach((l) => likedIds.add(`recipe-${l.recipeId}`));
  tLikes.forEach((l) => likedIds.add(`template-${l.templateId}`));
  return likedIds;
}

// ── GET /api/community/recipes ────────────────────────────────────────────────
router.get('/recipes', authMiddleware, async (req, res) => {
  const { search = '', tag = '', sort = 'popular', limit = '20', offset = '0' } = req.query;
  const lim  = Math.min(50, parseInt(limit)  || 20);
  const skip = Math.max(0,  parseInt(offset) || 0);

  const orderBy =
    sort === 'liked'  ? { likes:      'desc' } :
    sort === 'newest' ? { createdAt:  'desc' } :
                        { usageCount: 'desc' };

  const where = {
    isPublic: true,
    ...(search.trim() && { name: { contains: search.trim() } }),
    ...(tag && tag !== 'all' && { tags: { contains: `"${tag}"` } }),
  };

  try {
    const recipes  = await prisma.recipe.findMany({ where, orderBy, take: lim, skip });
    const likedIds = await getUserLikes(req.user.id, recipes.map((r) => r.id), []);
    res.json(recipes.map((r) => parseRecipe(r, likedIds)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/community/templates ──────────────────────────────────────────────
router.get('/templates', authMiddleware, async (req, res) => {
  const { search = '', tag = '', sort = 'popular', limit = '20', offset = '0' } = req.query;
  const lim  = Math.min(50, parseInt(limit)  || 20);
  const skip = Math.max(0,  parseInt(offset) || 0);

  const orderBy =
    sort === 'liked'  ? { likes:      'desc' } :
    sort === 'newest' ? { createdAt:  'desc' } :
                        { usageCount: 'desc' };

  const where = {
    isPublic: true,
    ...(search.trim() && { name: { contains: search.trim() } }),
    ...(tag && tag !== 'all' && { tags: { contains: `"${tag}"` } }),
  };

  try {
    const templates = await prisma.mealTemplate.findMany({ where, orderBy, take: lim, skip });
    const likedIds  = await getUserLikes(req.user.id, [], templates.map((t) => t.id));
    res.json(templates.map((t) => parseTemplate(t, likedIds)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/community/featured ───────────────────────────────────────────────
router.get('/featured', authMiddleware, async (req, res) => {
  try {
    const [recipes, templates] = await Promise.all([
      prisma.recipe.findMany({
        where:   { isPublic: true },
        orderBy: { usageCount: 'desc' },
        take:    6,
      }),
      prisma.mealTemplate.findMany({
        where:   { isPublic: true },
        orderBy: { usageCount: 'desc' },
        take:    6,
      }),
    ]);

    const mixed = [
      ...recipes.map((r)  => ({ ...r, _rawType: 'recipe' })),
      ...templates.map((t) => ({ ...t, _rawType: 'template' })),
    ]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 6);

    const recipeIds   = mixed.filter((i) => i._rawType === 'recipe').map((i) => i.id);
    const templateIds = mixed.filter((i) => i._rawType === 'template').map((i) => i.id);
    const likedIds    = await getUserLikes(req.user.id, recipeIds, templateIds);

    res.json(
      mixed.map((item) =>
        item._rawType === 'recipe'
          ? parseRecipe(item, likedIds)
          : parseTemplate(item, likedIds)
      )
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/community/recipes/:id/like ─────────────────────────────────────
router.post('/recipes/:id/like', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const recipe = await prisma.recipe.findFirst({ where: { id, isPublic: true } });
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    const existing = await prisma.recipeLike.findUnique({
      where: { userId_recipeId: { userId: req.user.id, recipeId: id } },
    });

    if (existing) {
      await prisma.recipeLike.delete({ where: { id: existing.id } });
      const newCount = Math.max(0, recipe.likes - 1);
      await prisma.recipe.update({ where: { id }, data: { likes: newCount } });
      return res.json({ liked: false, likes: newCount });
    } else {
      await prisma.recipeLike.create({ data: { userId: req.user.id, recipeId: id } });
      const newCount = recipe.likes + 1;
      await prisma.recipe.update({ where: { id }, data: { likes: newCount } });
      return res.json({ liked: true, likes: newCount });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/community/templates/:id/like ───────────────────────────────────
router.post('/templates/:id/like', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const template = await prisma.mealTemplate.findFirst({ where: { id, isPublic: true } });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const existing = await prisma.templateLike.findUnique({
      where: { userId_templateId: { userId: req.user.id, templateId: id } },
    });

    if (existing) {
      await prisma.templateLike.delete({ where: { id: existing.id } });
      const newCount = Math.max(0, template.likes - 1);
      await prisma.mealTemplate.update({ where: { id }, data: { likes: newCount } });
      return res.json({ liked: false, likes: newCount });
    } else {
      await prisma.templateLike.create({ data: { userId: req.user.id, templateId: id } });
      const newCount = template.likes + 1;
      await prisma.mealTemplate.update({ where: { id }, data: { likes: newCount } });
      return res.json({ liked: true, likes: newCount });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/community/recipes/:id/copy ─────────────────────────────────────
router.post('/recipes/:id/copy', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const original = await prisma.recipe.findFirst({ where: { id, isPublic: true } });
    if (!original) return res.status(404).json({ error: 'Recipe not found' });

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { name: true },
    });

    await prisma.$transaction([
      prisma.recipe.create({
        data: {
          userId:         req.user.id,
          name:           original.name,
          description:    original.description,
          servings:       original.servings,
          ingredients:    original.ingredients,
          totalCalories:  original.totalCalories,
          totalProtein:   original.totalProtein,
          totalCarbs:     original.totalCarbs,
          totalFat:       original.totalFat,
          totalFiber:     original.totalFiber,
          nutrientData:   original.nutrientData,
          isPublic:       false,
          createdByName:  user?.name || '',
          createdByUserId: req.user.id,
          tags:           original.tags,
        },
      }),
      prisma.recipe.update({
        where: { id },
        data:  { usageCount: original.usageCount + 1 },
      }),
    ]);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/community/templates/:id/copy ───────────────────────────────────
router.post('/templates/:id/copy', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const original = await prisma.mealTemplate.findFirst({ where: { id, isPublic: true } });
    if (!original) return res.status(404).json({ error: 'Template not found' });

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { name: true },
    });

    await prisma.$transaction([
      prisma.mealTemplate.create({
        data: {
          userId:          req.user.id,
          name:            original.name,
          description:     original.description,
          foods:           original.foods,
          totalCalories:   original.totalCalories,
          totalProtein:    original.totalProtein,
          totalCarbs:      original.totalCarbs,
          totalFat:        original.totalFat,
          isPublic:        false,
          createdByName:   user?.name || '',
          createdByUserId: req.user.id,
          tags:            original.tags,
        },
      }),
      prisma.mealTemplate.update({
        where: { id },
        data:  { usageCount: original.usageCount + 1 },
      }),
    ]);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/community/recipes/:id/use ─────────────────────────────────────
// Increments usageCount without creating a library copy (used by "Add to log")
router.post('/recipes/:id/use', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    await prisma.recipe.updateMany({
      where: { id, isPublic: true },
      data:  { usageCount: { increment: 1 } },
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/community/templates/:id/use ────────────────────────────────────
router.post('/templates/:id/use', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    await prisma.mealTemplate.updateMany({
      where: { id, isPublic: true },
      data:  { usageCount: { increment: 1 } },
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/community/report ────────────────────────────────────────────────
router.post('/report', authMiddleware, async (req, res) => {
  const { contentType, contentId, reason } = req.body;
  if (!contentType || !contentId || !reason?.trim()) {
    return res.status(400).json({ error: 'contentType, contentId, and reason are required' });
  }
  try {
    await prisma.contentReport.create({
      data: {
        reportedByUserId: req.user.id,
        contentType:      String(contentType),
        contentId:        parseInt(contentId),
        reason:           String(reason).trim(),
      },
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
