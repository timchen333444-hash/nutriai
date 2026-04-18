const { Router } = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const prisma = require('../lib/prisma.js');
const authMiddleware = require('../middleware/auth.js');
const {
  analyzeDailyDeficiencies,
  analyzeWeeklySummary,
  MONITORED_NUTRIENTS,
} = require('../services/deficiencyEngine.js');

const router = Router();

const DEFAULT_ALERT_SETTINGS = {
  deficiencyAlerts: false,
  dailySummary:     false,
  streakWarnings:   false,
  foodSuggestions:  false,
  weeklyReport:     false,
};

function parseAlertSettings(raw) {
  try { return JSON.parse(raw || 'null') || DEFAULT_ALERT_SETTINGS; }
  catch { return DEFAULT_ALERT_SETTINGS; }
}

// ── GET /api/alerts/settings ──────────────────────────────────────────────────
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ settings: parseAlertSettings(user.alertSettings), configured: user.alertSettings !== null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/alerts/settings ──────────────────────────────────────────────────
router.put('/settings', authMiddleware, async (req, res) => {
  console.log('[PUT /alerts/settings] userId:', req.user?.id, 'body:', JSON.stringify(req.body));
  const incoming = req.body.settings || req.body;
  // Merge with defaults so partial updates are safe
  const merged = { ...DEFAULT_ALERT_SETTINGS, ...incoming };
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data:  { alertSettings: JSON.stringify(merged) },
    });
    console.log('[PUT /alerts/settings] saved ok for userId:', req.user?.id);
    res.json({ settings: merged });
  } catch (e) {
    console.error('[PUT /alerts/settings] prisma error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/alerts/weekly-report ─────────────────────────────────────────────
router.get('/weekly-report', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const settings = parseAlertSettings(user?.alertSettings);
    if (!settings.weeklyReport) return res.status(403).json({ error: 'Weekly report not enabled' });

    const summary = await analyzeWeeklySummary(req.user.id);

    const wins = Object.entries(summary)
      .filter(([, v]) => v.avgPercent >= 90)
      .sort((a, b) => b[1].avgPercent - a[1].avgPercent)
      .slice(0, 3)
      .map(([key, v]) => ({ nutrientKey: key, name: v.name, avgPercent: v.avgPercent }));

    const gaps = Object.entries(summary)
      .filter(([, v]) => v.avgPercent < 60)
      .sort((a, b) => a[1].avgPercent - b[1].avgPercent)
      .slice(0, 3)
      .map(([key, v]) => ({ nutrientKey: key, name: v.name, avgPercent: v.avgPercent }));

    // Generate a personalized tip via Claude if there are gaps
    let tip = null;
    if (gaps.length > 0) {
      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const deficientList = gaps.map(g => g.name).join(', ');
        const msg = await client.messages.create({
          model:      'claude-sonnet-4-6',
          max_tokens: 120,
          messages: [{
            role:    'user',
            content: `A nutrition app user has been consistently low this week in: ${deficientList}. Write one specific, friendly, actionable tip (2 sentences max) to help them improve. No bullet points, no headers — just the tip text.`,
          }],
        });
        tip = msg.content[0]?.text?.trim() || null;
      } catch {
        // Claude tip is optional — don't fail the whole report
      }
    }

    res.json({ wins, gaps, tip });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/alerts ───────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const alerts = await prisma.deficiencyAlert.findMany({
      where:   { userId: req.user.id, isRead: false },
      orderBy: { createdAt: 'desc' },
    });
    res.json(alerts.map(a => ({
      ...a,
      suggestions: JSON.parse(a.suggestions || '[]'),
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/alerts/analyze ──────────────────────────────────────────────────
router.post('/analyze', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const settings = parseAlertSettings(user?.alertSettings);

    if (!settings.deficiencyAlerts) {
      return res.json({ skipped: true, alerts: [] });
    }

    const today = new Date().toISOString().slice(0, 10);
    const deficiencies = await analyzeDailyDeficiencies(req.user.id, today);

    // Upsert one alert record per deficient nutrient for today
    const upserted = await Promise.all(deficiencies.map(d =>
      prisma.deficiencyAlert.upsert({
        where: {
          userId_nutrientKey_date: {
            userId:      req.user.id,
            nutrientKey: d.nutrientKey,
            date:        today,
          },
        },
        update: {
          currentPercent: d.currentPercent,
          streakDays:     d.streakDays,
          severity:       d.severity,
          suggestions:    JSON.stringify(d.topFoodSuggestions),
          isRead:         false,
        },
        create: {
          userId:         req.user.id,
          nutrientName:   d.nutrientName,
          nutrientKey:    d.nutrientKey,
          currentPercent: d.currentPercent,
          streakDays:     d.streakDays,
          severity:       d.severity,
          suggestions:    JSON.stringify(d.topFoodSuggestions),
          date:           today,
        },
      })
    ));

    // Remove stale alerts for today that are no longer deficient
    const deficientKeys = new Set(deficiencies.map(d => d.nutrientKey));
    await prisma.deficiencyAlert.deleteMany({
      where: {
        userId: req.user.id,
        date:   today,
        nutrientKey: { notIn: [...deficientKeys] },
      },
    });

    res.json({
      alerts: upserted.map(a => ({
        ...a,
        suggestions: JSON.parse(a.suggestions || '[]'),
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/alerts/:id/read ──────────────────────────────────────────────────
router.put('/:id/read', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const alert = await prisma.deficiencyAlert.findFirst({ where: { id, userId: req.user.id } });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    await prisma.deficiencyAlert.update({ where: { id }, data: { isRead: true } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/alerts/:id ────────────────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const alert = await prisma.deficiencyAlert.findFirst({ where: { id, userId: req.user.id } });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    await prisma.deficiencyAlert.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
