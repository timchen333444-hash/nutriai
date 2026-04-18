const { Router } = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth');

const router = Router();

const parse = (r) => ({
  ...r,
  ingredients:  JSON.parse(r.ingredients  || '[]'),
  nutrientData: JSON.parse(r.nutrientData || '{}'),
  tags:         JSON.parse(r.tags         || '[]'),
});

// Whether the running Prisma client supports the community fields added in the
// schema update. Determined lazily on first call and cached.
let _communityFieldsSupported = null;
async function communityFieldsSupported() {
  if (_communityFieldsSupported !== null) return _communityFieldsSupported;
  try {
    // Try a no-op update that mentions isPublic — if it throws "Unknown argument"
    // the client is stale.
    await prisma.recipe.findFirst({ where: { isPublic: false }, take: 1 });
    _communityFieldsSupported = true;
  } catch (e) {
    if (e.message?.includes('Unknown argument') || e.message?.includes('unknown field')) {
      console.warn('[recipes] ⚠️  Stale Prisma client — community fields unavailable until server restart.');
      _communityFieldsSupported = false;
    } else {
      // Some other error (DB down, etc.) — don't cache, try again next request
      return true;
    }
  }
  return _communityFieldsSupported;
}

// GET /api/recipes
router.get('/', authMiddleware, async (req, res) => {
  try {
    const recipes = await prisma.recipe.findMany({
      where:   { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(recipes.map(parse));
  } catch (e) {
    console.error('[GET /api/recipes] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/recipes
router.post('/', authMiddleware, async (req, res) => {
  console.log('[POST /api/recipes] req.user:', JSON.stringify(req.user));
  console.log('[POST /api/recipes] hit — userId:', req.user?.id, '| name:', req.body?.name,
    '| ingredients:', req.body?.ingredients?.length ?? 'missing');

  const {
    name, servings, ingredients,
    totalCalories, totalProtein, totalCarbs, totalFat, totalFiber, nutrientData,
    isPublic = false, tags = [], description = null,
  } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  // Core fields that existed before community schema update
  const coreData = {
    userId:        req.user.id,
    name:          name.trim(),
    servings:      Math.max(1, Number(servings) || 1),
    ingredients:   JSON.stringify(ingredients || []),
    totalCalories: Number(totalCalories) || 0,
    totalProtein:  Number(totalProtein)  || 0,
    totalCarbs:    Number(totalCarbs)    || 0,
    totalFat:      Number(totalFat)      || 0,
    totalFiber:    Number(totalFiber)    || 0,
    nutrientData:  JSON.stringify(nutrientData || {}),
  };

  try {
    // Guard against stale JWT tokens after a DB reset
    const existingUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!existingUser) {
      console.error('[POST /api/recipes] user id', req.user.id, 'not found in DB — session is stale');
      return res.status(401).json({ error: 'Your account was not found. Please sign out and sign in again.' });
    }

    const supportsNew = await communityFieldsSupported();

    let recipe;
    if (supportsNew) {
      const createdByName = existingUser.name || '';

      recipe = await prisma.recipe.create({
        data: {
          ...coreData,
          description:     description || null,
          isPublic:        Boolean(isPublic),
          createdByName,
          createdByUserId: req.user.id,
          tags:            tags?.length ? JSON.stringify(tags) : null,
        },
      });
    } else {
      // Stale client — save core fields only, community fields will be populated after restart
      recipe = await prisma.recipe.create({ data: coreData });
    }

    console.log('[POST /api/recipes] saved id:', recipe.id);
    res.json(parse(recipe));
  } catch (e) {
    console.error('[POST /api/recipes] ERROR:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/recipes/:id
router.put('/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  console.log('[PUT /api/recipes/:id] id:', id, '| userId:', req.user?.id);

  const {
    name, servings, ingredients,
    totalCalories, totalProtein, totalCarbs, totalFat, totalFiber, nutrientData,
    isPublic, tags, description,
  } = req.body;

  try {
    const existing = await prisma.recipe.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.id)
      return res.status(404).json({ error: 'Recipe not found' });

    const coreUpdate = {
      ...(name          !== undefined && { name: name.trim() }),
      ...(servings      !== undefined && { servings: Math.max(1, Number(servings) || 1) }),
      ...(ingredients   !== undefined && { ingredients: JSON.stringify(ingredients) }),
      ...(totalCalories !== undefined && { totalCalories: Number(totalCalories) }),
      ...(totalProtein  !== undefined && { totalProtein:  Number(totalProtein) }),
      ...(totalCarbs    !== undefined && { totalCarbs:    Number(totalCarbs) }),
      ...(totalFat      !== undefined && { totalFat:      Number(totalFat) }),
      ...(totalFiber    !== undefined && { totalFiber:    Number(totalFiber) }),
      ...(nutrientData  !== undefined && { nutrientData:  JSON.stringify(nutrientData) }),
    };

    const communityUpdate = {
      ...(description !== undefined && { description }),
      ...(isPublic    !== undefined && { isPublic:  Boolean(isPublic) }),
      ...(tags        !== undefined && { tags: tags?.length ? JSON.stringify(tags) : null }),
    };

    const supportsNew = await communityFieldsSupported();
    const data = supportsNew ? { ...coreUpdate, ...communityUpdate } : coreUpdate;

    const recipe = await prisma.recipe.update({ where: { id }, data });
    console.log('[PUT /api/recipes/:id] updated id:', id);
    res.json(parse(recipe));
  } catch (e) {
    console.error('[PUT /api/recipes/:id] ERROR:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/recipes/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const existing = await prisma.recipe.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.id)
      return res.status(404).json({ error: 'Recipe not found' });

    // Delete related likes if the model exists in current client
    try {
      await prisma.recipeLike.deleteMany({ where: { recipeId: id } });
    } catch { /* recipeLike model may not exist in stale client */ }

    await prisma.recipe.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) {
    console.error('[DELETE /api/recipes/:id] ERROR:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
