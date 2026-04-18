const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma.js');
const { calculateTargets } = require('../utils/calculations.js');
const authMiddleware = require('../middleware/auth.js');

const router = Router();

const sign = (user) =>
  jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });

const DEFAULT_ALERT_SETTINGS = {
  deficiencyAlerts: false,
  dailySummary:     false,
  streakWarnings:   false,
  foodSuggestions:  false,
  weeklyReport:     false,
};

const safeUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  goal: u.goal,
  age: u.age,
  sex: u.sex,
  height: u.height,
  weight: u.weight,
  activityLevel: u.activityLevel,
  dietaryRestrictions: JSON.parse(u.dietaryRestrictions || '[]'),
  calorieTarget: u.calorieTarget,
  proteinTarget: u.proteinTarget,
  carbTarget: u.carbTarget,
  fatTarget: u.fatTarget,
  units: u.units,
  weightUnit:     u.weightUnit     || 'lbs',
  heightUnit:     u.heightUnit     || 'ft',
  waterUnit:      u.waterUnit      || 'floz',
  energyUnit:     u.energyUnit     || 'kcal',
  dateFormat:     u.dateFormat     || 'MM/DD/YYYY',
  firstDayOfWeek: u.firstDayOfWeek || 'sunday',
  onboardingComplete: u.onboardingComplete,
  // null means "never configured" (show opt-in banner); parsed object means configured
  alertSettings:  u.alertSettings !== null && u.alertSettings !== undefined
    ? (() => { try { return JSON.parse(u.alertSettings); } catch { return DEFAULT_ALERT_SETTINGS; } })()
    : null,
});

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name)
    return res.status(400).json({ error: 'email, password and name are required' });
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hashed, name } });
    res.json({ token: sign(user), user: safeUser(user) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  console.log('[LOGIN] Route hit — body:', { email: req.body.email, passwordLen: req.body.password?.length });
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    console.log('[LOGIN] User found:', user ? `id=${user.id}` : 'NOT FOUND');
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    console.log('[LOGIN] bcrypt compare result:', ok);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    console.log('[LOGIN] Success — returning token for', email);
    res.json({ token: sign(user), user: safeUser(user) });
  } catch (e) {
    console.error('[LOGIN] Caught error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(safeUser(user));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/onboarding', authMiddleware, async (req, res) => {
  const { goal, age, sex, height, weight, activityLevel, dietaryRestrictions,
          weightUnit, heightUnit, waterUnit, energyUnit } = req.body;
  try {
    const targets = calculateTargets({ age, sex, height, weight, activityLevel, goal });
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        goal,
        age,
        sex,
        height,
        weight,
        activityLevel,
        dietaryRestrictions: JSON.stringify(dietaryRestrictions || []),
        ...(targets || {}),
        onboardingComplete: true,
        // Unit preferences set during onboarding
        ...(weightUnit && { weightUnit }),
        ...(heightUnit && { heightUnit }),
        ...(waterUnit  && { waterUnit  }),
        ...(energyUnit && { energyUnit }),
        // Keep legacy units field in sync with weightUnit for BMR calculations
        ...(weightUnit === 'kg' ? { units: 'metric' } : { units: 'imperial' }),
      },
    });
    res.json(safeUser(user));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/auth/units — save unit and display preferences
router.put('/units', authMiddleware, async (req, res) => {
  const { weightUnit, heightUnit, waterUnit, energyUnit, dateFormat, firstDayOfWeek } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(weightUnit     !== undefined && { weightUnit     }),
        ...(heightUnit     !== undefined && { heightUnit     }),
        ...(waterUnit      !== undefined && { waterUnit      }),
        ...(energyUnit     !== undefined && { energyUnit     }),
        ...(dateFormat     !== undefined && { dateFormat     }),
        ...(firstDayOfWeek !== undefined && { firstDayOfWeek }),
        // Keep legacy units in sync
        ...(weightUnit === 'kg'  ? { units: 'metric'   } : {}),
        ...(weightUnit === 'lbs' ? { units: 'imperial' } : {}),
      },
    });
    res.json(safeUser(user));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/profile', authMiddleware, async (req, res) => {
  const { name, goal, age, sex, height, weight, activityLevel, dietaryRestrictions, units } =
    req.body;
  try {
    const targets = calculateTargets({ age, sex, height, weight, activityLevel, goal });
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(goal && { goal }),
        ...(age && { age }),
        ...(sex && { sex }),
        ...(height && { height }),
        ...(weight && { weight }),
        ...(activityLevel && { activityLevel }),
        ...(dietaryRestrictions !== undefined && {
          dietaryRestrictions: JSON.stringify(dietaryRestrictions),
        }),
        ...(units && { units }),
        ...(targets || {}),
      },
    });
    res.json(safeUser(user));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;