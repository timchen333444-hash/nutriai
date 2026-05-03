const { Router } = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const authMiddleware = require('../middleware/auth.js');
const usageLimit     = require('../middleware/usageLimit.js');
const prisma = require('../lib/prisma.js');

const router = Router();

const getClient = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Returns the current day of week and broad time-of-day so the prompt
 * carries natural temporal context — Claude will lean toward different
 * suggestions on a Monday morning vs a Saturday evening without any
 * explicit randomisation.
 */
function temporalContext() {
  const now  = new Date();
  const day  = now.toLocaleDateString('en-US', { weekday: 'long' }); // e.g. "Tuesday"
  const hour = now.getHours();
  const time = hour < 11 ? 'morning' : hour < 15 ? 'midday' : hour < 19 ? 'afternoon' : 'evening';
  return { day, time };
}

/**
 * Robustly parse JSON from a Claude response.
 * Handles markdown fences, leading/trailing prose, and truncated responses.
 */
function parseClaudeJSON(text) {
  const clean = text
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/```\s*$/im, '')
    .trim();

  try { return JSON.parse(clean); } catch { /* fall through */ }

  const start = clean.indexOf('{');
  const end   = clean.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(clean.slice(start, end + 1)); } catch { /* fall through */ }
  }

  throw new Error('Could not parse plan — please try again');
}

/**
 * Build the prompt for a single day within a potentially multi-day plan.
 */
function buildDayPrompt({ dayNumber, totalDays, mealsPerDay, target, reqs, varietyReqs, varietySettings, day, time }) {
  const lines = [
    `Generate a ${mealsPerDay}-meal day plan targeting ${target} kcal (within ±50 kcal).`,
    ``,
    `CONTEXT: It is ${day}, ${time}.`,
    ``,
    `VARIETY GUIDELINES:`,
    `Vary the meals naturally — avoid defaulting to chicken breast and brown rice every time. Rotate proteins across chicken, salmon, tuna, beef, shrimp, eggs, tofu, lentils, and pork. Vary grains between rice, quinoa, oats, pasta, bread, and sweet potato. Mix up vegetables and fruits each time. Use different cooking methods like grilled, baked, stir-fried, steamed, and raw. Occasionally suggest meals from different cuisines like Mediterranean, Asian, Mexican, and American. The plan should feel fresh and natural, not repetitive.`,
  ];

  if (totalDays > 1) {
    lines.push(
      ``,
      `MULTI-DAY CONTEXT (Day ${dayNumber} of ${totalDays}):`,
      `- Each day must use a different primary protein — no repeating the same protein source across days.`,
      `- Vary the grains, vegetables, and cuisine style between days.`,
    );
    if (varietySettings.rotateCuisines) {
      const CUISINES = ['Mediterranean', 'Asian', 'American', 'Mexican', 'Middle Eastern'];
      lines.push(`- Day ${dayNumber} cuisine inspiration: ${CUISINES[(dayNumber - 1) % CUISINES.length]}.`);
    }
  }

  const allReqs = [...reqs, ...varietyReqs];
  if (allReqs.length) {
    lines.push(``, `REQUIREMENTS:`, ...allReqs.map(r => `- ${r}`));
  }

  lines.push(
    ``,
    `Return only valid JSON in this exact structure:`,
    `{`,
    `  "totalCalories": number,`,
    `  "totalProtein": number,`,
    `  "totalCarbs": number,`,
    `  "totalFat": number,`,
    `  "meals": [`,
    `    {`,
    `      "name": "Meal name",`,
    `      "time": "e.g. 8:00 AM",`,
    `      "calories": number,`,
    `      "protein": number,`,
    `      "carbs": number,`,
    `      "fat": number,`,
    `      "items": [`,
    `        {`,
    `          "food": "food name",`,
    `          "amount": "amount with unit",`,
    `          "calories": number,`,
    `          "protein": number,`,
    `          "carbs": number,`,
    `          "fat": number,`,
    `          "notes": "optional prep note"`,
    `        }`,
    `      ],`,
    `      "aminoHighlights": "brief note on amino acid coverage",`,
    `      "omega3Source": "brief note on omega-3 sources if present"`,
    `    }`,
    `  ],`,
    `  "nutritionHighlights": ["key nutrition win 1", "key nutrition win 2", "key nutrition win 3"]`,
    `}`,
  );

  return lines.join('\n');
}

// ── POST /api/ai/meal-plan ────────────────────────────────────────────────────

router.post('/meal-plan', authMiddleware, usageLimit('plan'), async (req, res) => {
  const {
    calorieTarget,
    mealsPerDay          = 3,
    restrictions         = [],
    macroGoals,
    micronutrientPriorities = [],
    healthFocus          = [],
    days                 = 1,
    varietySettings      = {},
  } = req.body;

  const user   = await prisma.user.findUnique({ where: { id: req.user.id } });
  const target = calorieTarget || user?.calorieTarget || 2000;
  const planDays = Math.max(1, Math.min(7, Number(days)));

  // ── Base requirements (same for every day) ──
  const reqs = [
    restrictions.length
      ? `Strictly avoid: ${restrictions.join(', ')}`
      : 'No dietary restrictions',
    macroGoals
      ? `Macro targets: ${macroGoals.protein}g protein, ${macroGoals.carbs}g carbs, ${macroGoals.fat}g fat`
      : 'Well-balanced macros',
  ];
  if (micronutrientPriorities.length) reqs.push(`Prioritise these micronutrients: ${micronutrientPriorities.join(', ')}`);
  if (healthFocus.length)             reqs.push(`Health focus: ${healthFocus.join('; ')}`);
  reqs.push('Cover all 9 essential amino acids across the day', 'Realistic portion sizes in grams or common measures');

  // ── Variety requirements ──
  const varietyReqs = [];
  if (varietySettings.noRepeatedProteins)
    varietyReqs.push('Use a different primary protein source on this day compared to all other days in the plan');
  if (varietySettings.includeNewFoods)
    varietyReqs.push('Include at least one uncommon or novel ingredient the user may not have eaten recently');
  if (varietySettings.mixCookingMethods)
    varietyReqs.push('Vary cooking methods across meals: incorporate grilled, baked, steamed, raw, and stir-fried preparations');

  try {
    const client = getClient();
    const { day, time } = temporalContext();

    // Generate all days in parallel — each call is independent so there's no
    // serial bottleneck. For variety, each prompt carries its day number and
    // temporal context so Claude can make meaningfully different choices.
    const dayPlans = await Promise.all(
      Array.from({ length: planDays }, (_, i) => {
        const dayNumber = i + 1;
        const prompt = buildDayPrompt({
          dayNumber, totalDays: planDays, mealsPerDay, target,
          reqs, varietyReqs, varietySettings, day, time,
        });
        return client.messages.create({
          model:      'claude-sonnet-4-6',
          max_tokens: 4096,
          system:     'You are a registered dietitian. Return only valid JSON with no extra text, markdown, or code blocks.',
          messages:   [{ role: 'user', content: prompt }],
        }).then(response => ({
          dayNumber,
          dayLabel: `Day ${dayNumber}`,
          ...parseClaudeJSON(response.content[0].text),
        }));
      })
    );

    res.json({ days: dayPlans });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/ai/regenerate-meal ─────────────────────────────────────────────
// Regenerates a single meal while keeping the rest of the day's meals intact.

router.post('/regenerate-meal', authMiddleware, async (req, res) => {
  const {
    mealName          = 'Meal',
    mealCalorieTarget = 600,
    existingMeals     = [],   // other meals in the same day (to avoid repeating foods)
    restrictions      = [],
    macroGoals,
    healthFocus       = [],
  } = req.body;

  // Flatten all food names already used in today's other meals
  const usedFoods = existingMeals
    .flatMap(m => (m.items || []).map(i => i.food))
    .filter(Boolean);

  const reqs = [
    `Target approximately ${mealCalorieTarget} kcal for this one meal`,
    usedFoods.length
      ? `Do NOT reuse any of these foods already in today's plan: ${usedFoods.join(', ')}`
      : 'Use varied, interesting ingredients',
    restrictions.length ? `Strictly avoid: ${restrictions.join(', ')}` : 'No dietary restrictions',
  ];
  if (macroGoals) {
    const perMeal = (v) => Math.round(v / Math.max(1, existingMeals.length + 1));
    reqs.push(`Approximate per-meal macro targets: ${perMeal(macroGoals.protein)}g protein, ${perMeal(macroGoals.carbs)}g carbs, ${perMeal(macroGoals.fat)}g fat`);
  }
  if (healthFocus.length) reqs.push(`Health focus: ${healthFocus.join('; ')}`);
  reqs.push('Realistic portion sizes in grams or common measures');

  const prompt = `Generate exactly 1 meal named "${mealName}" for a day-plan.

REQUIREMENTS:
${reqs.map(r => `- ${r}`).join('\n')}

Return only valid JSON:
{
  "name": "${mealName}",
  "time": "suggested time e.g. 12:00 PM",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "items": [
    {
      "food": "food name",
      "amount": "amount with unit",
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "notes": "optional prep note"
    }
  ],
  "aminoHighlights": "brief amino acid note",
  "omega3Source": "brief omega-3 note if present"
}`;

  try {
    const client = getClient();
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1500,
      system:     'You are a registered dietitian. Return only valid JSON with no extra text, markdown, or code blocks.',
      messages:   [{ role: 'user', content: prompt }],
    });
    res.json(parseClaudeJSON(response.content[0].text));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/ai/photo-estimate ───────────────────────────────────────────────

router.post('/photo-estimate', authMiddleware, usageLimit('photo'), async (req, res) => {
  const { imageBase64, mimeType = 'image/jpeg' } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });

  const prompt = `Analyze this food image and estimate the nutritional content. Be as accurate as possible based on what you can see.

Return only valid JSON in this exact format:
{
  "description": "brief description of what you see",
  "estimatedWeight": number,
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "fiber": number,
  "confidence": "low|medium|high",
  "items": [
    {
      "name": "food item name",
      "estimatedPortion": "e.g. 1 cup, 150g",
      "calories": number
    }
  ],
  "notes": "any assumptions or caveats"
}`;

  try {
    const client = getClient();
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1000,
      system:     'You are a nutrition expert. Return only valid JSON with no extra text, markdown, or code blocks.',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
          { type: 'text', text: prompt },
        ],
      }],
    });

    res.json(parseClaudeJSON(response.content[0].text));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;